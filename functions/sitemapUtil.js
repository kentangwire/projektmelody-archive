import { buildSitemapXml, PM_SITE } from '../shared/sitemapBuild.mjs';
import { loadCatalog } from './vodSeoUtil.js';

export { PM_SITE, buildSitemapXml };

export const SITEMAP_HEADERS = {
  'content-type': 'application/xml; charset=utf-8',
  'cache-control': 'public, max-age=3600',
  'cdn-cache-control': 'public, max-age=3600'
};

export const ROBOTS_HEADERS = {
  'content-type': 'text/plain; charset=utf-8',
  'cache-control': 'public, max-age=86400',
  'cdn-cache-control': 'public, max-age=86400'
};

export async function serveSitemap(context) {
  const assetUrl = new URL('/sitemap.xml', context.request.url);
  const assetRes = await context.env.ASSETS.fetch(new Request(assetUrl, context.request));
  if (assetRes.ok) {
    const text = await assetRes.text();
    if (text.includes('<urlset') && text.includes('<loc>') && !text.includes('#recent')) {
      return new Response(text, { status: 200, headers: SITEMAP_HEADERS });
    }
  }

  const catalog = await loadCatalog(context.env);
  return new Response(buildSitemapXml(catalog), { status: 200, headers: SITEMAP_HEADERS });
}

export function serveRobots() {
  const body = `User-agent: *
Allow: /

Sitemap: ${PM_SITE}/sitemap.xml
`;
  return new Response(body, { status: 200, headers: ROBOTS_HEADERS });
}
