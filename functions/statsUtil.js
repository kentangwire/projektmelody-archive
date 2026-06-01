export const STATS_KEY = 'site/stats.json';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    }
  });
}

export function parseVideoId(raw) {
  const id = String(raw || '').trim();
  if (!id || !/^[a-zA-Z0-9._-]{1,200}$/.test(id)) return '';
  return id;
}

export async function readStats(bucket) {
  if (!bucket) return emptyStats();
  try {
    const obj = await bucket.get(STATS_KEY);
    if (!obj) return emptyStats();
    const data = JSON.parse(await obj.text());
    if (!data || typeof data !== 'object') return emptyStats();
    if (!data.videos || typeof data.videos !== 'object') data.videos = {};
    return data;
  } catch {
    return emptyStats();
  }
}

export async function writeStats(bucket, data) {
  if (!bucket) return false;
  data.updatedAt = new Date().toISOString();
  await bucket.put(STATS_KEY, JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' }
  });
  return true;
}

export function emptyStats() {
  return { version: 1, updatedAt: null, videos: {} };
}

export function ensureVideo(stats, id) {
  if (!stats.videos[id]) {
    stats.videos[id] = { views: 0, likes: 0, dislikes: 0, tags: {}, tagVoters: {} };
  }
  const row = stats.videos[id];
  row.views = Number(row.views) || 0;
  row.likes = Number(row.likes) || 0;
  row.dislikes = Number(row.dislikes) || 0;
  if (!row.tags || typeof row.tags !== 'object') row.tags = {};
  if (!row.tagVoters || typeof row.tagVoters !== 'object') row.tagVoters = {};
  return row;
}

export function publicVideoRow(row) {
  return {
    views: Number(row?.views) || 0,
    likes: Number(row?.likes) || 0,
    dislikes: Number(row?.dislikes) || 0,
    tags: row?.tags && typeof row.tags === 'object' ? row.tags : {}
  };
}

export function voterId(request) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'anon';
  return String(ip).split(',')[0].trim().slice(0, 64) || 'anon';
}

export function summarizeStats(stats) {
  const videos = stats?.videos && typeof stats.videos === 'object' ? stats.videos : {};
  let totalViews = 0;
  let totalLikes = 0;
  for (const row of Object.values(videos)) {
    totalViews += Number(row?.views) || 0;
    totalLikes += Number(row?.likes) || 0;
  }
  return { totalViews, totalLikes, videoCount: Object.keys(videos).length };
}
