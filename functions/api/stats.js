import { json, publicVideoRow, readStats, summarizeStats } from '../statsUtil.js';

function publicVideosMap(stats) {
  const src = stats?.videos && typeof stats.videos === 'object' ? stats.videos : {};
  const out = {};
  for (const [id, row] of Object.entries(src)) out[id] = publicVideoRow(row);
  return out;
}

export async function onRequestGet({ env }) {
  const bucket = env.R2_VIDEOS;
  if (!bucket) {
    return json({ live: false, updatedAt: null, videos: {}, totals: { totalViews: 0, totalLikes: 0 } });
  }

  const stats = await readStats(bucket);
  const totals = summarizeStats(stats);

  return json({
    live: true,
    updatedAt: stats.updatedAt || null,
    videos: publicVideosMap(stats),
    totals
  });
}
