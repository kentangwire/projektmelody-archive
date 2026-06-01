import { MAX_TAGS_PER_USER, normalizeTag } from '../../../tagAllowlist.js';
import {
  ensureVideo,
  json,
  parseVideoId,
  publicVideoRow,
  readStats,
  voterId,
  writeStats
} from '../../../statsUtil.js';

export async function onRequestPost({ request, env, params }) {
  const id = parseVideoId(params?.id);
  if (!id) return json({ ok: false, error: 'bad_id' }, 400);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const tag = normalizeTag(body?.tag);
  const action = String(body?.action || 'add').trim();
  if (!tag) return json({ ok: false, error: 'bad_tag' }, 400);
  if (action !== 'add' && action !== 'remove') return json({ ok: false, error: 'bad_action' }, 400);

  const bucket = env.R2_VIDEOS;
  if (!bucket) return json({ ok: false, error: 'storage_unavailable' }, 503);

  const voter = voterId(request);
  const voteKey = `${voter}:${tag}`;

  const stats = await readStats(bucket);
  const row = ensureVideo(stats, id);

  const userTags = Object.keys(row.tagVoters).filter(k => k.startsWith(voter + ':'));

  if (action === 'add') {
    if (row.tagVoters[voteKey]) {
      return json({ ok: true, already: true, ...publicVideoRow(row) });
    }
    if (userTags.length >= MAX_TAGS_PER_USER) {
      return json({ ok: false, error: 'tag_limit', limit: MAX_TAGS_PER_USER }, 429);
    }
    row.tagVoters[voteKey] = true;
    row.tags[tag] = (Number(row.tags[tag]) || 0) + 1;
  } else {
    if (!row.tagVoters[voteKey]) {
      return json({ ok: true, already: true, ...publicVideoRow(row) });
    }
    delete row.tagVoters[voteKey];
    const next = Math.max(0, (Number(row.tags[tag]) || 0) - 1);
    if (next <= 0) delete row.tags[tag];
    else row.tags[tag] = next;
  }

  await writeStats(bucket, stats);

  return json({ ok: true, id, tag, action, ...publicVideoRow(row) });
}
