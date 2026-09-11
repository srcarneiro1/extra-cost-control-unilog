import { clearAppSessionCookie } from '../../_auth';

export const onRequestPost: PagesFunction = async () => {
  return new Response(JSON.stringify({ ok: true, data: { signedOut: true } }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'set-cookie': clearAppSessionCookie(),
    },
  });
};
