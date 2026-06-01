import { ensureVideo, json, parseVideoId, readStats, writeStats } from '../../../statsUtil.js';

const ALLOWED = new Set(['like', 'unlike', 'dislike', 'undislike']);

export async function onRequestPost({ request, env, params }) {
  const id = parseVideoId(params?.id);
  if (!id) return json({ ok: false, error: 'bad_id' }, 400);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = String(body?.action || '').trim();
  if (!ALLOWED.has(action)) return json({ ok: false, error: 'bad_action' }, 400);

  const bucket = env.R2_VIDEOS;
  if (!bucket) return json({ ok: false, error: 'storage_unavailable' }, 503);

  const stats = await readStats(bucket);
  const row = ensureVideo(stats, id);

  if (action === 'like') {
    row.likes += 1;
    if (row.dislikes > 0) row.dislikes -= 1;
  } else if (action === 'unlike') {
    if (row.likes > 0) row.likes -= 1;
  } else if (action === 'dislike') {
    row.dislikes += 1;
    if (row.likes > 0) row.likes -= 1;
  } else if (action === 'undislike') {
    if (row.dislikes > 0) row.dislikes -= 1;
  }

  await writeStats(bucket, stats);

  return json({
    ok: true,
    id,
    likes: row.likes,
    dislikes: row.dislikes
  });
}
