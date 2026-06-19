import {
  SEO_HTML_HEADERS,
  buildVideoPage,
  findVideo,
  isSeoBot,
  loadCatalog,
  serveSpaIndex
} from '../vodSeoUtil.js';

export async function onRequestGet({ env, params, request }) {
  const ua = request.headers.get('User-Agent') || '';
  if (!isSeoBot(ua)) {
    return serveSpaIndex(request, env);
  }

  const catalog = await loadCatalog(env);
  const v = findVideo(catalog, params?.id);
  if (!v) {
    return new Response('VOD not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  return new Response(buildVideoPage(v), { status: 200, headers: SEO_HTML_HEADERS });
}
