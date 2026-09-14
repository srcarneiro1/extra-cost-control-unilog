import { authorizeGatewayRequest, type GatewayAuthEnv } from '../_auth';
import { validateAreaAccess } from '../_access-control';

interface Env extends GatewayAuthEnv {
  APPS_SCRIPT_URL: string;
  APPS_SCRIPT_GATEWAY_TOKEN: string;
}

const APPS_SCRIPT_EXECUTION_HOST = 'script.google.com';
const APPS_SCRIPT_CONTENT_HOST = 'script.googleusercontent.com';
const MAX_APPS_SCRIPT_REDIRECTS = 4;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function isRedirectStatus_(status: number): boolean {
  return status === 301
    || status === 302
    || status === 303
    || status === 307
    || status === 308;
}

function targetUrl_(env: Env, route: string): URL {
  const targetUrl = new URL(env.APPS_SCRIPT_URL);
  targetUrl.searchParams.set('route', route);
  return targetUrl;
}

function serviceBody_(
  env: Env,
  payload: Record<string, unknown>,
): string {
  return JSON.stringify({
    ...payload,
    _gatewayToken: env.APPS_SCRIPT_GATEWAY_TOKEN,
  });
}

/**
 * Usado somente para operações de leitura/idempotentes.
 *
 * Mantém POST enquanto o Google ainda estiver redirecionando dentro
 * de script.google.com. Quando o ContentService entrega a URL final
 * em script.googleusercontent.com, busca somente o conteúdo com GET.
 */
async function fetchAppsScriptRead_(
  env: Env,
  route: string,
  payload: Record<string, unknown>,
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

    if (!isRedirectStatus_(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) {
      return response;
    }

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

    console.warn(
      'Apps Script retornou redirecionamento inesperado na rota de usuários.',
      {
        route,
        status: response.status,
        host: nextUrl.hostname,
      },
    );

    return response;
  }

  throw new Error(
    'Apps Script excedeu o limite de redirecionamentos na rota de usuários.',
  );
}

/**
 * Mutação é enviada exatamente uma vez.
 *
 * Não existe retry deste POST. Caso o retorno seja ambíguo,
 * o estado é reconciliado posteriormente por leituras.
 */
async function fetchUserMutationOnce_(
  env: Env,
  payload: Record<string, unknown>,
): Promise<Response> {
  return fetch(targetUrl_(env, 'usuarios').toString(), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: serviceBody_(env, payload),
    redirect: 'follow',
  });
}

async function parseUpstream_(
  response: Response,
): Promise<unknown | null> {
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

function upstreamResponse_(
  response: Response,
  payload: unknown,
): Response {
  return jsonResponse(
    payload,
    apiSucceeded_(payload)
      ? 200
      : response.ok
        ? 400
        : 502,
  );
}

function invalidUpstreamResponse_(
  response?: Response,
): Response {
  return jsonResponse(
    {
      ok: false,
      error: {
        code: 'UPSTREAM_INVALID_RESPONSE',
        message: 'Apps Script retornou uma resposta inválida.',
        details: response
          ? {
              upstreamStatus: response.status,
              upstreamContentType:
                response.headers.get('content-type') || null,
              upstreamRedirected: response.redirected,
              upstreamFinalHost: response.url
                ? new URL(response.url).hostname
                : null,
            }
          : null,
      },
    },
    502,
  );
}

async function proxyRead_(
  env: Env,
  route: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  try {
    const response = await fetchAppsScriptRead_(
      env,
      route,
      payload,
    );

    const upstream = await parseUpstream_(response);

    if (upstream === null) {
      return invalidUpstreamResponse_(response);
    }

    return upstreamResponse_(response, upstream);
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: 'UPSTREAM_CONNECTION_ERROR',
          message: 'Não foi possível conectar ao Apps Script.',
        },
      },
      502,
    );
  }
}

async function listUsers_(
  env: Env,
): Promise<Record<string, unknown>[] | null> {
  try {
    const response = await fetchAppsScriptRead_(
      env,
      'usuarios',
      { acao: 'LISTAR' },
    );

    const upstream = await parseUpstream_(response);

    if (!apiSucceeded_(upstream)) {
      return null;
    }

    const data = (upstream as { data?: unknown }).data;

    if (!Array.isArray(data)) {
      return null;
    }

    return data.filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    );
  } catch {
    return null;
  }
}

function normalizeEmail_(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeUpper_(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

function matchesSavedUser_(
  user: Record<string, unknown>,
  payload: Record<string, unknown>,
): boolean {
  const expectedProfile = normalizeUpper_(payload.perfil);

  const expectedOperation =
    expectedProfile === 'OWNER'
      ? 'TODOS'
      : normalizeUpper_(payload.operacao);

  return normalizeEmail_(user.email) === normalizeEmail_(payload.email)
    && String(user.nome || '').trim()
      === String(payload.nome || '').trim()
    && normalizeUpper_(user.perfil) === expectedProfile
    && normalizeUpper_(user.operacao) === expectedOperation
    && Boolean(user.ativo) === Boolean(payload.ativo);
}

/**
 * LOGIN é uma leitura de autenticação e pode ser usada para confirmar
 * se a senha temporária realmente foi persistida.
 */
async function credentialMatches_(
  env: Env,
  email: string,
  password: string,
): Promise<boolean> {
  if (!email || !password) {
    return false;
  }

  try {
    const response = await fetchAppsScriptRead_(
      env,
      'auth',
      {
        acao: 'LOGIN',
        email,
        password,
      },
    );

    const upstream = await parseUpstream_(response);

    if (!apiSucceeded_(upstream)) {
      return false;
    }

    const data = (upstream as { data?: unknown }).data;

    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const user = data as Record<string, unknown>;

    return normalizeEmail_(user.email) === normalizeEmail_(email)
      && user.exigeTrocaSenha === true;
  } catch {
    return false;
  }
}

async function reconcileUserMutation_(
  env: Env,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const action = normalizeUpper_(payload.acao);
  const email = normalizeEmail_(payload.email);

  if (!email) {
    return null;
  }

  const users = await listUsers_(env);

  if (!users) {
    return null;
  }

  const user = users.find(
    (item) => normalizeEmail_(item.email) === email,
  );

  if (!user) {
    return null;
  }

  if (action === 'SALVAR') {
    if (!matchesSavedUser_(user, payload)) {
      return null;
    }

    const password = String(payload.password || '');

    if (password) {
      if (
        user.senhaConfigurada !== true
        || user.exigeTrocaSenha !== true
      ) {
        return null;
      }

      const credentialConfirmed = await credentialMatches_(
        env,
        email,
        password,
      );

      if (!credentialConfirmed) {
        return null;
      }
    }

    return user;
  }

  if (action === 'REDEFINIR_SENHA') {
    const password = String(payload.password || '');

    if (
      !password
      || user.senhaConfigurada !== true
      || user.exigeTrocaSenha !== true
    ) {
      return null;
    }

    const credentialConfirmed = await credentialMatches_(
      env,
      email,
      password,
    );

    if (!credentialConfirmed) {
      return null;
    }

    return user;
  }

  return null;
}

async function proxyMutation_(
  env: Env,
  payload: Record<string, unknown>,
): Promise<Response> {
  let response: Response | undefined;

  try {
    response = await fetchUserMutationOnce_(env, payload);

    const upstream = await parseUpstream_(response);

    if (upstream !== null) {
      return upstreamResponse_(response, upstream);
    }
  } catch {
    // A escrita pode ter concluído mesmo sem resposta utilizável.
  }

  /*
   * A partir daqui não repetimos a mutação.
   * Apenas consultamos o estado atual.
   */
  const reconciled = await reconcileUserMutation_(
    env,
    payload,
  );

  if (reconciled) {
    return jsonResponse(
      {
        ok: true,
        data: reconciled,
      },
      200,
    );
  }

  return jsonResponse(
    {
      ok: false,
      error: {
        code: 'UPSTREAM_AMBIGUOUS_MUTATION',
        message:
          'Não foi possível confirmar o resultado da alteração de usuário. Consulte a lista antes de tentar novamente.',
        details: response
          ? {
              upstreamStatus: response.status,
              upstreamContentType:
                response.headers.get('content-type') || null,
              upstreamRedirected: response.redirected,
              upstreamFinalHost: response.url
                ? new URL(response.url).hostname
                : null,
            }
          : null,
      },
    },
    502,
  );
}

async function authorize(
  request: Request,
  env: Env,
) {
  const identity = await authorizeGatewayRequest(
    request,
    env,
  );

  if (!identity) {
    return {
      response: jsonResponse(
        {
          ok: false,
          error: {
            code: 'UNAUTHORIZED',
            message:
              'Sessão da plataforma não autenticada.',
          },
        },
        401,
      ),
    };
  }

  const denied = validateAreaAccess(
    identity,
    'USUARIOS',
  );

  if (denied) {
    return { response: denied };
  }

  return { identity };
}

function validateGatewayConfig_(
  env: Env,
): Response | null {
  if (
    env.APPS_SCRIPT_URL
    && env.APPS_SCRIPT_GATEWAY_TOKEN
  ) {
    return null;
  }

  return jsonResponse(
    {
      ok: false,
      error: {
        code: 'GATEWAY_CONFIG_ERROR',
        message:
          'Gateway não configurado no ambiente Cloudflare.',
      },
    },
    500,
  );
}

export const onRequestGet: PagesFunction<Env> =
  async ({ request, env }) => {
    const auth = await authorize(request, env);

    if ('response' in auth) {
      return auth.response;
    }

    const configError =
      validateGatewayConfig_(env);

    if (configError) {
      return configError;
    }

    return proxyRead_(
      env,
      'usuarios',
      { acao: 'LISTAR' },
    );
  };

export const onRequestPost: PagesFunction<Env> =
  async ({ request, env }) => {
    const auth = await authorize(request, env);

    if ('response' in auth) {
      return auth.response;
    }

    const configError =
      validateGatewayConfig_(env);

    if (configError) {
      return configError;
    }

    let payload: Record<string, unknown>;

    try {
      payload =
        (await request.json())
        as Record<string, unknown>;
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Corpo JSON inválido.',
          },
        },
        400,
      );
    }

    return proxyMutation_(env, payload);
  };
