import {
  authorizeGatewayRequest,
  identityEmail,
  type GatewayAuthEnv,
  type GatewayIdentity,
} from '../_auth';
import { validateAdministrativeAction } from '../_access-control';

interface Env extends GatewayAuthEnv {
  APPS_SCRIPT_URL: string;
  APPS_SCRIPT_GATEWAY_TOKEN: string;
}

const READ_EDGE_CACHE_SECONDS = 30;
const APPS_SCRIPT_EXECUTION_HOST = 'script.google.com';
const APPS_SCRIPT_CONTENT_HOST = 'script.googleusercontent.com';
const MAX_APPS_SCRIPT_REDIRECTS = 4;
const CLOSEOUT_MUTATION_ACTIONS = new Set(['FECHAR', 'SALVAR_NF', 'CONCILIAR', 'ENCERRAR']);
const EXCEPTION_MUTATION_ACTIONS = new Set(['DECIDIR']);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function edgeCache_(): Cache | null {
  if (typeof caches === 'undefined') return null;
  return (caches as unknown as { default?: Cache }).default || null;
}

function scopedCacheKey_(request: Request, identity: GatewayIdentity): Request {
  const url = new URL(request.url);
  url.searchParams.delete('fresh');
  url.searchParams.set('_financial', '1');
  url.searchParams.set('_subject', identityEmail(identity));
  return new Request(url.toString(), { method: 'GET' });
}

async function matchEdgeCache_(request: Request, identity: GatewayIdentity): Promise<Response | null> {
  const cache = edgeCache_();
  if (!cache) return null;
  try {
    const cached = await cache.match(scopedCacheKey_(request, identity));
    if (!cached) return null;
    const headers = new Headers(cached.headers);
    headers.set('cache-control', 'no-store');
    return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
  } catch {
    return null;
  }
}

function cacheSuccessful_(
  context: EventContext<Env, string, unknown>,
  request: Request,
  identity: GatewayIdentity,
  response: Response,
): void {
  if (response.status !== 200) return;
  const cache = edgeCache_();
  if (!cache) return;
  const headers = new Headers(response.headers);
  headers.set('cache-control', `public, max-age=${READ_EDGE_CACHE_SECONDS}`);
  const copy = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  try {
    context.waitUntil(cache.put(scopedCacheKey_(request, identity), copy).catch(() => undefined));
  } catch {
    // Cache é apenas otimização.
  }
}

function targetUrl_(env: Env, route: string): URL {
  const targetUrl = new URL(env.APPS_SCRIPT_URL);
  targetUrl.searchParams.set('route', route);
  return targetUrl;
}

function serviceBody_(env: Env, payload: Record<string, unknown>): string {
  return JSON.stringify({ ...payload, _gatewayToken: env.APPS_SCRIPT_GATEWAY_TOKEN });
}

function isRedirectStatus_(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function fetchAppsScriptRead_(
  env: Env,
  payload: Record<string, unknown>,
  route: string,
): Promise<Response> {
  let currentUrl = targetUrl_(env, route).toString();
  const body = serviceBody_(env, payload);

  for (let hop = 0; hop < MAX_APPS_SCRIPT_REDIRECTS; hop += 1) {
    const response = await fetch(currentUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body,
      redirect: 'manual',
    });

    if (!isRedirectStatus_(response.status)) return response;

    const location = response.headers.get('location');
    if (!location) return response;

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.hostname === APPS_SCRIPT_CONTENT_HOST) {
      return fetch(nextUrl.toString(), {
        method: 'GET',
        headers: { accept: 'application/json' },
        redirect: 'follow',
      });
    }

    if (nextUrl.hostname === APPS_SCRIPT_EXECUTION_HOST) {
      currentUrl = nextUrl.toString();
      continue;
    }

    console.warn('Apps Script retornou redirecionamento inesperado em leitura financeira.', {
      route,
      status: response.status,
      host: nextUrl.hostname,
    });
    return response;
  }

  throw new Error('Apps Script excedeu o limite de redirecionamentos na leitura financeira.');
}

async function fetchAppsScriptMutationOnce_(
  env: Env,
  payload: Record<string, unknown>,
  route: string,
): Promise<Response> {
  const targetUrl = targetUrl_(env, route);
  const response = await fetch(targetUrl.toString(), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: serviceBody_(env, payload),
    redirect: 'manual',
  });

  if (!isRedirectStatus_(response.status)) return response;

  const location = response.headers.get('location');
  if (!location) return response;

  const nextUrl = new URL(location, targetUrl.toString());
  if (nextUrl.hostname === APPS_SCRIPT_CONTENT_HOST) {
    return fetch(nextUrl.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'follow',
    });
  }

  // Nunca repetimos a escrita em outro redirect. O estado será reconciliado por leitura.
  return response;
}

async function parseUpstream_(response: Response): Promise<unknown | null> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function apiSucceeded_(payload: unknown): boolean {
  return typeof payload === 'object'
    && payload !== null
    && 'ok' in payload
    && (payload as { ok?: unknown }).ok === true;
}

function upstreamResponse_(response: Response, payload: unknown): Response {
  return jsonResponse(payload, apiSucceeded_(payload) ? 200 : response.ok ? 400 : 502);
}

function responseDiagnostics_(response?: Response): Record<string, unknown> | null {
  if (!response) return null;
  const location = response.headers.get('location');
  let redirectHost: string | null = null;
  if (location) {
    try {
      redirectHost = new URL(location, response.url || 'https://script.google.com').hostname;
    } catch {
      redirectHost = null;
    }
  }
  return {
    upstreamStatus: response.status,
    upstreamContentType: response.headers.get('content-type') || null,
    upstreamRedirected: response.redirected,
    upstreamFinalHost: response.url ? new URL(response.url).hostname : null,
    upstreamRedirectHost: redirectHost,
  };
}

function invalidUpstreamResponse_(response?: Response): Response {
  return jsonResponse(
    {
      ok: false,
      error: {
        code: 'UPSTREAM_INVALID_RESPONSE',
        message: 'Apps Script retornou uma resposta inválida.',
        details: responseDiagnostics_(response),
      },
    },
    502,
  );
}

async function proxyRead_(
  env: Env,
  payload: Record<string, unknown>,
  route: string,
): Promise<Response> {
  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) {
    return jsonResponse(
      { ok: false, error: { code: 'GATEWAY_CONFIG_ERROR', message: 'Gateway não configurado no ambiente Cloudflare.' } },
      500,
    );
  }

  try {
    const response = await fetchAppsScriptRead_(env, payload, route);
    const upstream = await parseUpstream_(response);
    if (upstream === null) return invalidUpstreamResponse_(response);
    return upstreamResponse_(response, upstream);
  } catch {
    return jsonResponse(
      { ok: false, error: { code: 'UPSTREAM_CONNECTION_ERROR', message: 'Não foi possível conectar ao Apps Script.' } },
      502,
    );
  }
}

function asRecord_(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function text_(value: unknown): string {
  return String(value == null ? '' : value).trim();
}

function upper_(value: unknown): string {
  return text_(value).toUpperCase();
}

function number_(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameMoney_(left: unknown, right: unknown): boolean {
  const leftNumber = number_(left);
  const rightNumber = number_(right);
  return leftNumber !== null && rightNumber !== null && Math.abs(leftNumber - rightNumber) <= 0.009;
}

async function readData_(
  env: Env,
  payload: Record<string, unknown>,
  route: string,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetchAppsScriptRead_(env, payload, route);
    const upstream = await parseUpstream_(response);
    if (!apiSucceeded_(upstream)) return null;
    return asRecord_((upstream as { data?: unknown }).data);
  } catch {
    return null;
  }
}

async function readCloseoutList_(
  env: Env,
  competencia: string,
): Promise<Record<string, unknown> | null> {
  if (!competencia) return null;
  return readData_(env, { acao: 'LISTAR', competencia }, 'fechamentos');
}

function closeoutCompetenceFromId_(idFechamento: string): string {
  const match = /^FEC-(\d{4})(\d{2})-/i.exec(idFechamento);
  return match ? `${match[1]}-${match[2]}` : '';
}

function findGroupInList_(
  data: Record<string, unknown> | null,
  predicate: (group: Record<string, unknown>) => boolean,
): Record<string, unknown> | null {
  const groups = data && Array.isArray(data.grupos) ? data.grupos : [];
  for (const item of groups) {
    const group = asRecord_(item);
    if (group && predicate(group)) return group;
  }
  return null;
}

async function findGroupByCloseoutId_(
  env: Env,
  idFechamento: string,
): Promise<Record<string, unknown> | null> {
  const derivedCompetence = closeoutCompetenceFromId_(idFechamento);
  if (derivedCompetence) {
    const direct = findGroupInList_(
      await readCloseoutList_(env, derivedCompetence),
      (group) => text_(group.idFechamento) === idFechamento,
    );
    if (direct) return direct;
  }

  const metadata = await readData_(env, { acao: 'METADADOS' }, 'fechamentos');
  const competencies = metadata && Array.isArray(metadata.competencias) ? metadata.competencias : [];
  for (const rawCompetence of competencies) {
    const competencia = text_(rawCompetence);
    if (!competencia || competencia === derivedCompetence) continue;
    const found = findGroupInList_(
      await readCloseoutList_(env, competencia),
      (group) => text_(group.idFechamento) === idFechamento,
    );
    if (found) return found;
  }
  return null;
}

async function reconcileCloseoutMutation_(
  env: Env,
  action: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  if (action === 'FECHAR') {
    const competencia = text_(payload.competencia);
    const fornecedor = upper_(payload.fornecedor);
    const group = findGroupInList_(
      await readCloseoutList_(env, competencia),
      (item) => upper_(item.fornecedor) === fornecedor,
    );
    if (!group || !text_(group.idFechamento) || upper_(group.statusFechamento) === 'EM_ACOMPANHAMENTO') return null;
    return {
      idFechamento: text_(group.idFechamento),
      competencia,
      fornecedor: text_(group.fornecedor),
      statusFechamento: text_(group.statusFechamento),
      qtdSolicitacoes: number_(group.qtdFechada) ?? number_(group.totalSolicitacoes) ?? 0,
      valorControle: number_(group.valorFechado) ?? number_(group.valorRealAcumulado) ?? 0,
      dataFechamento: text_(group.dataFechamento),
    };
  }

  const idFechamento = text_(payload.idFechamento);
  if (!idFechamento) return null;
  const group = await findGroupByCloseoutId_(env, idFechamento);
  if (!group) return null;

  if (action === 'SALVAR_NF') {
    const invoice = asRecord_(group.notaFiscal);
    if (!invoice) return null;
    if (text_(invoice.numeroNf) !== text_(payload.numeroNf)) return null;
    if (text_(invoice.dataEmissao) !== text_(payload.dataEmissao)) return null;
    if (text_(invoice.dataRecebimento) !== text_(payload.dataRecebimento)) return null;
    if (!sameMoney_(invoice.valorNf, payload.valorNf)) return null;
    return {
      idFechamento,
      statusFechamento: text_(group.statusFechamento),
      notaFiscal: invoice,
    };
  }

  if (action === 'CONCILIAR') {
    const status = upper_(group.statusFechamento);
    if (status !== 'CONFERIDA' && status !== 'ENCERRADA') return null;
    if (upper_(group.resultadoConciliacao) !== upper_(payload.resultadoConciliacao)) return null;
    const invoice = asRecord_(group.notaFiscal);
    if (!invoice) return null;
    if (payload.valorAjuste !== undefined && !sameMoney_(invoice.valorAjuste, payload.valorAjuste)) return null;
    if (payload.observacaoConciliacao !== undefined
      && text_(invoice.observacaoConciliacao) !== text_(payload.observacaoConciliacao)) return null;
    return {
      idFechamento,
      statusFechamento: text_(group.statusFechamento),
      resultadoConciliacao: text_(group.resultadoConciliacao),
      notaFiscal: invoice,
    };
  }

  if (action === 'ENCERRAR') {
    if (upper_(group.statusFechamento) !== 'ENCERRADA') return null;
    return {
      idFechamento,
      statusFechamento: 'ENCERRADA',
      dataEncerramento: text_(group.dataEncerramento),
    };
  }

  return null;
}

async function proxyMutation_(
  env: Env,
  payload: Record<string, unknown>,
  route: string,
  action: string,
): Promise<Response> {
  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) {
    return jsonResponse(
      { ok: false, error: { code: 'GATEWAY_CONFIG_ERROR', message: 'Gateway não configurado no ambiente Cloudflare.' } },
      500,
    );
  }

  let response: Response | undefined;
  try {
    response = await fetchAppsScriptMutationOnce_(env, payload, route);
    const upstream = await parseUpstream_(response);
    if (upstream !== null) return upstreamResponse_(response, upstream);
  } catch {
    // O POST pode ter sido processado mesmo sem uma resposta utilizável.
  }

  if (route === 'fechamentos') {
    const reconciled = await reconcileCloseoutMutation_(env, action, payload);
    if (reconciled) return jsonResponse({ ok: true, data: reconciled }, 200);
  }

  return jsonResponse(
    {
      ok: false,
      error: {
        code: 'UPSTREAM_AMBIGUOUS_MUTATION',
        message: 'Não foi possível confirmar a resposta da alteração financeira. Atualize os dados antes de tentar novamente.',
        details: responseDiagnostics_(response),
      },
    },
    502,
  );
}

async function authorizeAdministrative_(request: Request, env: Env) {
  const identity = await authorizeGatewayRequest(request, env);
  if (!identity) {
    return {
      identity: null,
      denied: jsonResponse(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão da plataforma não autenticada.' } },
        401,
      ),
    };
  }
  const denied = validateAdministrativeAction(identity);
  return { identity, denied };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const { identity, denied } = await authorizeAdministrative_(request, env);
  if (denied || !identity) return denied!;

  const url = new URL(request.url);
  const fresh = text_(url.searchParams.get('fresh')) === '1';

  if (!fresh) {
    const cached = await matchEdgeCache_(request, identity);
    if (cached) return cached;
  }

  const competencia = text_(url.searchParams.get('competencia'));
  const metadata = text_(url.searchParams.get('metadata')) === '1';
  const exceptions = text_(url.searchParams.get('excecoes')) === '1';
  const fornecedor = text_(url.searchParams.get('fornecedor'));

  const response = exceptions
    ? await proxyRead_(env, {
        acao: 'LISTAR',
        ...(competencia ? { competencia } : {}),
        ...(fornecedor ? { fornecedor } : {}),
      }, 'excecoes_financeiras')
    : await proxyRead_(env, metadata
      ? { acao: 'METADADOS' }
      : { acao: 'LISTAR', competencia }, 'fechamentos');

  if (!fresh) cacheSuccessful_(context, request, identity, response);
  return response;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { identity, denied } = await authorizeAdministrative_(request, env);
  if (denied || !identity) return denied!;

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(
      { ok: false, error: { code: 'INVALID_JSON', message: 'Corpo JSON inválido.' } },
      400,
    );
  }

  const action = upper_(payload.acao || 'FECHAR');
  const isException = EXCEPTION_MUTATION_ACTIONS.has(action);
  if (!isException && !CLOSEOUT_MUTATION_ACTIONS.has(action)) {
    return jsonResponse(
      { ok: false, error: { code: 'INVALID_ACTION', message: 'Ação financeira inválida.' } },
      400,
    );
  }

  const trustedPayload = {
    ...payload,
    acao: action,
    usuarioAdministrativo: identityEmail(identity),
  };

  return proxyMutation_(
    env,
    trustedPayload,
    isException ? 'excecoes_financeiras' : 'fechamentos',
    action,
  );
};
