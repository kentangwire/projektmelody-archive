import { SEO_HTML_HEADERS, buildVodsListPage, loadCatalog } from './vodSeoUtil.js';

export async function onRequestGet({ env }) {
  const catalog = await loadCatalog(env);
  return new Response(buildVodsListPage(catalog), { status: 200, headers: SEO_HTML_HEADERS });
}
