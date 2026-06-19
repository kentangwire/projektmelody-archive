import {
  SEO_HTML_HEADERS,
  buildVodsListPage,
  isSeoBot,
  loadCatalog,
  serveSpaIndex
} from './vodSeoUtil.js';

export async function onRequestGet({ env, request }) {
  const ua = request.headers.get('User-Agent') || '';
  if (!isSeoBot(ua)) {
    return serveSpaIndex(request, env);
  }

  const catalog = await loadCatalog(env);
  return new Response(buildVodsListPage(catalog), { status: 200, headers: SEO_HTML_HEADERS });
}
