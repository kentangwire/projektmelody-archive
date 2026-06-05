import { readFileSync, writeFileSync } from 'node:fs';
import { buildSitemapXml, PM_SITE } from '../shared/sitemapBuild.mjs';

const videos = JSON.parse(readFileSync('videos.json', 'utf8'));
writeFileSync('public/sitemap.xml', buildSitemapXml(videos));
writeFileSync(
  'public/robots.txt',
  `User-agent: *
Allow: /

Sitemap: ${PM_SITE}/sitemap.xml
`
);

process.stdout.write(`seo: wrote sitemap.xml (${videos.length} vod urls) and robots.txt\n`);
