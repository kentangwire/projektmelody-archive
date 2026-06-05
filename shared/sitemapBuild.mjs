export const PM_SITE = 'https://projektmelody.cc';

export function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDate(raw) {
  const d = String(raw || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

export function buildSitemapXml(videos = []) {
  const urls = [
    { loc: `${PM_SITE}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${PM_SITE}/vods`, changefreq: 'daily', priority: '0.95' }
  ];

  for (const v of videos) {
    if (!v?.id || v.ready === false) continue;
    urls.push({
      loc: `${PM_SITE}/vod/${encodeURIComponent(String(v.id))}`,
      lastmod: isoDate(v.date),
      changefreq: v.pinned ? 'weekly' : 'monthly',
      priority: v.pinned ? '0.9' : '0.7'
    });
  }

  const body = urls
    .map(u => {
      const parts = [`    <loc>${escXml(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`    <lastmod>${u.lastmod}</lastmod>`);
      if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (u.priority) parts.push(`    <priority>${u.priority}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
