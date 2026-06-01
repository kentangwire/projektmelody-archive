import { ensureVideo, json, parseVideoId, readStats, writeStats } from '../../../statsUtil.js';

export async function onRequestPost({ env, params }) {
  const id = parseVideoId(params?.id);
  if (!id) return json({ ok: false, error: 'bad_id' }, 400);

  const bucket = env.R2_VIDEOS;
  if (!bucket) return json({ ok: false, error: 'storage_unavailable', views: 0 }, 503);

  const stats = await readStats(bucket);
  const row = ensureVideo(stats, id);
  row.views += 1;
  await writeStats(bucket, stats);

  return json({ ok: true, id, views: row.views });
}
