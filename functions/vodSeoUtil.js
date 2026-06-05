import { filterCatalogTags } from './tagAllowlist.js';

export const PM_SITE = 'https://projektmelody.cc';

export function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseVideoId(raw) {
  const id = String(raw || '').trim();
  if (!id || !/^[a-zA-Z0-9._-]{1,200}$/.test(id)) return '';
  return id;
}

export async function loadCatalog(env) {
  const assetUrl = new URL('/catalog-source.json', PM_SITE);
  const res = await env.ASSETS.fetch(new Request(assetUrl.toString()));
  if (!res.ok) return [];
  try {
    const data = JSON.parse(await res.text());
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function findVideo(catalog, id) {
  const vid = parseVideoId(id);
  if (!vid) return null;
  return catalog.find(v => String(v?.id || '') === vid) || null;
}

export function fmtDate(raw) {
  const d = String(raw || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  try {
    return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  } catch {
    return d;
  }
}

export function fmtDuration(sec) {
  const n = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function isoDuration(sec) {
  const n = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  let out = 'PT';
  if (h) out += `${h}H`;
  if (m) out += `${m}M`;
  if (s || (!h && !m)) out += `${s}S`;
  return out;
}

export function videoDescription(v) {
  const tags = filterCatalogTags(v?.tags).slice(0, 8);
  const tagText = tags.length ? ` Tags: ${tags.join(', ')}.` : '';
  const dateText = v?.date ? ` Streamed ${fmtDate(v.date)}.` : '';
  return `Watch ${v?.title || 'this stream'} — free Projekt Melody Twitch VOD archive.${dateText} Duration ${fmtDuration(v?.duration)}.${tagText} Resume playback, community tags, and timestamps.`;
}

export function pageShell({ title, description, canonical, jsonLd, bodyHtml }) {
  const ld = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  const ldScripts = ld
    .map(obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n  ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${escHtml(canonical)}">
<meta property="og:type" content="video.other">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(description)}">
<meta property="og:url" content="${escHtml(canonical)}">
<meta property="og:image" content="${PM_SITE}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(description)}">
<meta name="twitter:image" content="${PM_SITE}/assets/og-image.png">
<link rel="icon" type="image/png" href="/assets/og-image.png">
  ${ldScripts}
<style>
  :root { color-scheme: dark; --bg:#060910; --text:#cdd8ee; --dim:#5a6888; --cyan:#28d4ec; --border:#1c2640; }
  body { margin:0; font-family: system-ui, sans-serif; background:var(--bg); color:var(--text); line-height:1.55; }
  a { color: var(--cyan); }
  .wrap { max-width: 720px; margin: 0 auto; padding: 1.5rem 1.1rem 3rem; }
  .crumb { font-size: 0.85rem; color: var(--dim); margin-bottom: 1rem; }
  h1 { font-size: 1.55rem; line-height: 1.25; margin: 0 0 0.75rem; }
  .meta { color: var(--dim); font-size: 0.92rem; margin-bottom: 1rem; }
  .tags { display:flex; flex-wrap:wrap; gap:0.4rem; margin: 1rem 0; }
  .tag { border:1px solid var(--border); padding:0.2rem 0.55rem; border-radius:4px; font-size:0.78rem; }
  .cta { display:inline-block; margin: 1.25rem 0; padding: 0.85rem 1.2rem; background: var(--cyan); color:#041018; text-decoration:none; font-weight:700; border-radius:4px; }
  .cta:hover { filter: brightness(1.06); }
  p { margin: 0 0 1rem; }
  ul.vlist { list-style:none; padding:0; margin:0; }
  ul.vlist li { border-bottom:1px solid var(--border); padding:0.75rem 0; }
  ul.vlist a { text-decoration:none; font-weight:600; }
  ul.vlist small { display:block; color:var(--dim); margin-top:0.25rem; }
</style>
</head>
<body>
<div class="wrap">
${bodyHtml}
</div>
</body>
</html>`;
}

export function buildVideoPage(v) {
  const id = String(v.id);
  const canonical = `${PM_SITE}/vod/${encodeURIComponent(id)}`;
  const watchUrl = `${PM_SITE}/?v=${encodeURIComponent(id)}`;
  const title = `${v.title} — Projekt Melody VOD`;
  const description = videoDescription(v).slice(0, 300);
  const tags = filterCatalogTags(v.tags);
  const tagHtml = tags.length
    ? `<div class="tags">${tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>`
    : '';

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: String(v.title || id),
      description,
      uploadDate: v.date || undefined,
      duration: isoDuration(v.duration),
      thumbnailUrl: `${PM_SITE}/assets/og-image.png`,
      embedUrl: watchUrl,
      url: canonical,
      isFamilyFriendly: false,
      publisher: { '@type': 'Organization', name: 'pROJEKT mELODY Archive', url: PM_SITE }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Archive', item: `${PM_SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'All VODs', item: `${PM_SITE}/vods` },
        { '@type': 'ListItem', position: 3, name: String(v.title || id), item: canonical }
      ]
    }
  ];

  const bodyHtml = `
  <nav class="crumb"><a href="${PM_SITE}/">Archive</a> · <a href="${PM_SITE}/vods">All VODs</a></nav>
  <h1>${escHtml(v.title || id)}</h1>
  <p class="meta">${escHtml(fmtDate(v.date))}${v.duration ? ` · ${escHtml(fmtDuration(v.duration))}` : ''}</p>
  <p>${escHtml(description)}</p>
  ${tagHtml}
  <a class="cta" href="${escHtml(watchUrl)}">Watch full stream</a>
  <p><a href="${PM_SITE}/vods">Browse all Projekt Melody VODs</a> · <a href="${PM_SITE}/">Back to archive home</a></p>`;

  return pageShell({ title, description, canonical, jsonLd, bodyHtml });
}

export function buildVodsListPage(videos) {
  const canonical = `${PM_SITE}/vods`;
  const title = 'Projekt Melody VODs — Full Twitch Archive List';
  const description =
    'Browse every archived Projekt Melody Twitch VOD. Search-friendly list with dates, duration, and direct watch links. Free community archive with resume playback and tags.';
  const ready = videos.filter(v => v?.id && v.ready !== false);
  const items = ready
    .map(v => {
      const url = `${PM_SITE}/vod/${encodeURIComponent(String(v.id))}`;
      return `<li><a href="${escHtml(url)}">${escHtml(v.title || v.id)}</a><small>${escHtml(fmtDate(v.date))}${v.duration ? ` · ${escHtml(fmtDuration(v.duration))}` : ''}</small></li>`;
    })
    .join('\n');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    description,
    numberOfItems: ready.length,
    itemListElement: ready.slice(0, 50).map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${PM_SITE}/vod/${encodeURIComponent(String(v.id))}`,
      name: String(v.title || v.id)
    }))
  };

  const bodyHtml = `
  <nav class="crumb"><a href="${PM_SITE}/">Archive</a></nav>
  <h1>Projekt Melody VOD archive</h1>
  <p>${escHtml(description)}</p>
  <p><strong>${ready.length}</strong> archived streams available.</p>
  <ul class="vlist">${items}</ul>
  <p><a href="${PM_SITE}/">Open interactive archive</a></p>`;

  return pageShell({ title, description, canonical, jsonLd, bodyHtml });
}

export const SEO_HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=300, stale-while-revalidate=600'
};
