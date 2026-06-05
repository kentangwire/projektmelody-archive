import { serveCatalog } from './catalogServe.js';
import { serveRobots, serveSitemap } from './sitemapUtil.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.pathname === '/sitemap.xml' && context.request.method === 'GET') {
    return serveSitemap(context);
  }

  if (url.pathname === '/robots.txt' && context.request.method === 'GET') {
    return serveRobots();
  }

  if (url.pathname === '/videos.json' && context.request.method === 'GET') {
    return serveCatalog(context);
  }

  if (url.hostname === 'www.projektmelody.cc') {
    url.hostname = 'projektmelody.cc';
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
