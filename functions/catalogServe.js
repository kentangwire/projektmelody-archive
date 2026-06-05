import { filterCatalogTags } from './tagAllowlist.js';

export const CATALOG_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  'pragma': 'no-cache',
  'expires': '0',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
  'access-control-allow-origin': '*'
};

export async function serveCatalog(context) {
  const assetUrl = new URL('/catalog-source.json', context.request.url);
  const assetRes = await context.env.ASSETS.fetch(new Request(assetUrl, context.request));
  if (!assetRes.ok) {
    return new Response(JSON.stringify({ error: 'catalog_unavailable' }), {
      status: 503,
      headers: CATALOG_HEADERS
    });
  }

  const text = await assetRes.text();
  let data;
  try {
    data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('invalid_catalog');
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_catalog' }), {
      status: 500,
      headers: CATALOG_HEADERS
    });
  }

  const sanitized = data.map(entry => {
    if (!entry || typeof entry !== 'object') return entry;
    const tags = filterCatalogTags(entry.tags);
    if (tags.length === (Array.isArray(entry.tags) ? entry.tags.length : 0)) return entry;
    return { ...entry, tags };
  });

  return new Response(JSON.stringify(sanitized), { status: 200, headers: CATALOG_HEADERS });
}
