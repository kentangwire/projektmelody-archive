import {
  SEO_HTML_HEADERS,
  buildVideoPage,
  findVideo,
  loadCatalog
} from '../vodSeoUtil.js';

export async function onRequestGet({ env, params }) {
  const catalog = await loadCatalog(env);
  const v = findVideo(catalog, params?.id);
  if (!v) {
    return new Response('VOD not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  return new Response(buildVideoPage(v), { status: 200, headers: SEO_HTML_HEADERS });
}
