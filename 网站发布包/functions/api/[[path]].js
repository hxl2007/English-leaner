// Pages Functions：仅拦截 /api/*，静态资源不受影响
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  try {
    const headers = new Headers();
    for (const k of ['Authorization', 'Content-Type']) {
      if (request.headers.has(k)) headers.set(k, request.headers.get(k));
    }
    const response = await fetch(
      'https://zhuanshengben-api.adadaadadaaa.workers.dev' + url.pathname + url.search,
      {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual',
      }
    );
    const out = new Headers(response.headers);
    out.set('Cache-Control', 'no-store');
    out.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: response.status, headers: out });
  } catch {
    return Response.json(
      { error: '云端账户服务暂时无法连接，请稍后重试。' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
