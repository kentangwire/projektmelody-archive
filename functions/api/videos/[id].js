import { parseVideoId } from '../../statsUtil.js';
import { apiError, dbUnavailable, fetchVideoDetail, getSql, json } from '../../neonDb.js';

export async function onRequestGet({ request, env, params }) {
  const id = parseVideoId(params?.id);
  if (!id) return apiError(400, 'BAD_REQUEST', 'Missing id');

  const sql = getSql(env);
  if (!sql) return dbUnavailable();

  try {
    const row = await fetchVideoDetail(sql, id);
    if (!row) return apiError(404, 'NOT_FOUND', 'Video not found');
    return json(row);
  } catch {
    return apiError(500, 'INTERNAL_ERROR', 'Internal server error');
  }
}
