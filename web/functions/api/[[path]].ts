// Pages Function: proxy /api/* to the worker, attaching the Cloudflare Access
// service token headers so it bypasses the worker's Access app.
//
// Why this exists: browser fetches from pages.dev to workers.dev are different
// origins. The worker's CF Access cookie can't be sent cross-origin, and the
// 302 SSO redirect can't be followed by XHR. Routing the API through Pages
// makes everything same-origin (Pages Access already gated the user at the
// page load), and this function authenticates server-to-server using the
// service token (the same one local cron uses).

interface Env {
  WORKER_ORIGIN: string;            // e.g. https://finance-dashboard-worker.nihongo.workers.dev
  CF_ACCESS_CLIENT_ID: string;
  CF_ACCESS_CLIENT_SECRET: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, env.WORKER_ORIGIN);

  const headers = new Headers(request.headers);
  headers.set('CF-Access-Client-Id', env.CF_ACCESS_CLIENT_ID);
  headers.set('CF-Access-Client-Secret', env.CF_ACCESS_CLIENT_SECRET);
  // Strip browser hop-by-hop headers that confuse upstream
  headers.delete('host');

  return fetch(target.toString(), {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });
};
