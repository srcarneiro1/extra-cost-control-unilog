import {
  appSessionCookie,
  createAppSessionToken,
  type AppSessionUser,
  type GatewayAuthEnv,
} from '../../_auth';

interface Env extends GatewayAuthEnv {
  APPS_SCRIPT_URL: string;
  APPS_SCRIPT_GATEWAY_TOKEN: string;
}

interface AppsScriptSuccess {
  ok: true;
  data: {
    email: string;
    nome: string;
    perfil: string;
    operacao: string;
  };
}

interface AppsScriptFailure {
  ok: false;
  error?: {
    code?: string;
    message?: string;
  };
}

const FAILED_LOGIN_COOLDOWN_SECONDS = 10;

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function edgeCache_(): Cache | null {
  if (typeof caches === 'undefined') return null;
  return (caches as unknown as { default?: Cache }).default || null;
}

function clientIp_(request: Request): string {
  return String(request.headers.get('cf-connecting-ip') || 'unknown').trim();
}

function loginCooldownKey_(request: Request, email: string): Request {
  const url = new URL(request.url);
  url.searchParams.set('_login_ip', clientIp_(request));
  url.searchParams.set('_login_email', email);
  return new Request(url.toString(), { method: 'GET' });
}

async function hasLoginCooldown_(request: Request, email: string): Promise<boolean> {
  const cache = edgeCache_();
  if (!cache) return false;

  try {
    return Boolean(await cache.match(loginCooldownKey_(request, email)));
  } catch {
    return false;
  }
}

function registerLoginCooldown_(
  context: EventContext<Env, string, unknown>,
  request: Request,
  email: string,
): void {
  const cache = edgeCache_();
  if (!cache) return;

  const response = new Response('1', {
    headers: {
      'cache-control': `public, max-age=${FAILED_LOGIN_COOLDOWN_SECONDS}`,
    },
  });

  try {
    context.waitUntil(
      cache.put(loginCooldownKey_(request, email), response).catch(() => undefined),
    );
  } catch {
    // Proteção adicional não pode indisponibilizar o login.
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  let body: { email?: unknown; password?: unknown };

  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return jsonResponse({ ok: false, error: { code: 'INVALID_JSON', message: 'Corpo JSON inválido.' } }, 400);
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    return jsonResponse({ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Informe e-mail e senha.' } }, 400);
  }

  if (await hasLoginCooldown_(request, email)) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: 'LOGIN_RATE_LIMITED',
          message: 'Aguarde alguns segundos antes de tentar novamente.',
        },
      },
      429,
      { 'retry-after': String(FAILED_LOGIN_COOLDOWN_SECONDS) },
    );
  }

  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) {
    return jsonResponse({ ok: false, error: { code: 'GATEWAY_CONFIG_ERROR', message: 'Gateway não configurado.' } }, 500);
  }

  const targetUrl = new URL(env.APPS_SCRIPT_URL);
  targetUrl.searchParams.set('route', 'auth');

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        acao: 'LOGIN',
        email,
        password,
        _gatewayToken: env.APPS_SCRIPT_GATEWAY_TOKEN,
      }),
      redirect: 'follow',
    });
  } catch {
    return jsonResponse({ ok: false, error: { code: 'AUTH_UPSTREAM_UNAVAILABLE', message: 'Não foi possível validar o acesso.' } }, 502);
  }

  let upstream: AppsScriptSuccess | AppsScriptFailure;
  try {
    upstream = (await upstreamResponse.json()) as AppsScriptSuccess | AppsScriptFailure;
  } catch {
    return jsonResponse({ ok: false, error: { code: 'AUTH_INVALID_RESPONSE', message: 'O serviço de autenticação retornou uma resposta inválida.' } }, 502);
  }

  if (!upstreamResponse.ok || !upstream.ok) {
    registerLoginCooldown_(context, request, email);
    return jsonResponse(
      {
        ok: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: upstream.ok ? 'E-mail ou senha inválidos.' : upstream.error?.message || 'E-mail ou senha inválidos.',
        },
      },
      401,
    );
  }

  const user: AppSessionUser = {
    email: String(upstream.data.email || '').trim().toLowerCase(),
    name: String(upstream.data.nome || '').trim(),
    profile: String(upstream.data.perfil || 'OPERACIONAL').trim().toUpperCase(),
    operation: String(upstream.data.operacao || '').trim().toUpperCase(),
  };

  let token: string;
  try {
    token = await createAppSessionToken(env, user);
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: 'SESSION_CONFIG_ERROR',
          message: error instanceof Error ? error.message : 'Sessão não configurada.',
        },
      },
      500,
    );
  }

  return jsonResponse(
    {
      ok: true,
      data: {
        ...user,
        provider: 'session',
      },
    },
    200,
    { 'set-cookie': appSessionCookie(token) },
  );
};
