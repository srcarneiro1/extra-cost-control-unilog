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
    exigeTrocaSenha?: boolean;
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
const APPS_SCRIPT_EXECUTION_HOST = 'script.google.com';
const APPS_SCRIPT_CONTENT_HOST = 'script.googleusercontent.com';
const MAX_APPS_SCRIPT_REDIRECTS = 4;

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function isRedirectStatus_(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function appsScriptTarget_(env: Env, route: string): URL {
  const targetUrl = new URL(env.APPS_SCRIPT_URL);
  targetUrl.searchParams.set('route', route);
  return targetUrl;
}

function appsScriptBody_(env: Env, payload: Record<string, unknown>): string {
  return JSON.stringify({ ...payload, _gatewayToken: env.APPS_SCRIPT_GATEWAY_TOKEN });
}

async function appsScriptReadPost_(
  env: Env,
  route: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  let currentUrl = appsScriptTarget_(env, route).toString();
  const body = appsScriptBody_(env, payload);

  for (let hop = 0; hop < MAX_APPS_SCRIPT_REDIRECTS; hop += 1) {
    const response = await fetch(currentUrl, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
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

    return response;
  }

  throw new Error('Apps Script excedeu o limite de redirecionamentos na autenticação.');
}

async function appsScriptMutationOnce_(
  env: Env,
  route: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  const targetUrl = appsScriptTarget_(env, route);
  const response = await fetch(targetUrl.toString(), {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: appsScriptBody_(env, payload),
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

  // A troca de senha é mutação: nunca repetimos o POST em outro redirect.
  return response;
}

async function authenticateWithRetry(
  env: Env,
  email: string,
  password: string,
): Promise<Response> {
  try {
    return await appsScriptReadPost_(env, 'auth', { acao: 'LOGIN', email, password });
  } catch {
    await delay(200);
    return appsScriptReadPost_(env, 'auth', { acao: 'LOGIN', email, password });
  }
}

async function reconcilePasswordChange(
  env: Env,
  email: string,
  newPassword: string,
): Promise<AppsScriptSuccess | null> {
  try {
    const response = await authenticateWithRetry(env, email, newPassword);
    const payload = (await response.json()) as AppsScriptSuccess | AppsScriptFailure;
    if (response.ok && payload.ok && payload.data.exigeTrocaSenha !== true) return payload;
    return null;
  } catch {
    return null;
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  let body: { email?: unknown; password?: unknown; newPassword?: unknown };

  try {
    body = (await request.json()) as { email?: unknown; password?: unknown; newPassword?: unknown };
  } catch {
    return jsonResponse({ ok: false, error: { code: 'INVALID_JSON', message: 'Corpo JSON inválido.' } }, 400);
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const newPassword = String(body.newPassword || '');

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

  let upstreamResponse: Response;
  try {
    upstreamResponse = await authenticateWithRetry(env, email, password);
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

  if (upstream.data.exigeTrocaSenha === true) {
    if (!newPassword) {
      return jsonResponse(
        {
          ok: false,
          error: {
            code: 'PASSWORD_CHANGE_REQUIRED',
            message: 'Defina uma nova senha para concluir o primeiro acesso.',
          },
        },
        409,
      );
    }

    if (newPassword.length < 8) {
      return jsonResponse(
        { ok: false, error: { code: 'INVALID_NEW_PASSWORD', message: 'A nova senha deve possuir pelo menos 8 caracteres.' } },
        400,
      );
    }

    let passwordChangeSucceeded = false;
    try {
      const passwordChangeResponse = await appsScriptMutationOnce_(env, 'usuarios', {
        acao: 'REDEFINIR_SENHA',
        email,
        password: newPassword,
        concluirTroca: true,
      });

      try {
        const payload = (await passwordChangeResponse.json()) as { ok?: unknown };
        passwordChangeSucceeded = passwordChangeResponse.ok && payload?.ok === true;
      } catch {
        passwordChangeSucceeded = false;
      }
    } catch {
      passwordChangeSucceeded = false;
    }

    if (!passwordChangeSucceeded) {
      const reconciled = await reconcilePasswordChange(env, email, newPassword);
      if (reconciled) {
        upstream = reconciled;
        passwordChangeSucceeded = true;
      }
    }

    if (!passwordChangeSucceeded) {
      return jsonResponse(
        { ok: false, error: { code: 'PASSWORD_CHANGE_FAILED', message: 'Não foi possível concluir a troca de senha.' } },
        502,
      );
    }
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
