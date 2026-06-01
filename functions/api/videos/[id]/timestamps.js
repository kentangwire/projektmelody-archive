import { isValidationError, parseTimestampBody } from '../../../apiValidate.js';
import {
  apiError,
  dbUnavailable,
  getClientIp,
  getSql,
  insertTimestamp,
  json,
  recentTimestamp,
  videoExists
} from '../../../neonDb.js';
import { parseVideoId } from '../../../statsUtil.js';

const RATE_MS = 60_000;

export async function onRequestPost({ request, env, params }) {
  const id = parseVideoId(params?.id);
  if (!id) return apiError(400, 'BAD_REQUEST', 'Missing id');

  const sql = getSql(env);
  if (!sql) return dbUnavailable();

  let body = {};
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'BAD_REQUEST', 'Invalid JSON');
  }

  let parsed;
  try {
    parsed = parseTimestampBody(body);
  } catch (err) {
    if (isValidationError(err)) return apiError(400, err.code, err.message);
    return apiError(400, 'BAD_REQUEST', 'Invalid body');
  }

  const ip = getClientIp(request);

  try {
    if (!(await videoExists(sql, id))) {
      return apiError(404, 'NOT_FOUND', 'Video not found');
    }

    const cutoff = new Date(Date.now() - RATE_MS);
    if (await recentTimestamp(sql, id, ip, cutoff)) {
      return apiError(429, 'RATE_LIMITED', 'Too many requests');
    }

    const created = await insertTimestamp(sql, {
      videoId: id,
      timeInSec: parsed.timeInSec,
      description: parsed.description,
      userIp: ip
    });

    return json(created, 201);
  } catch {
    return apiError(500, 'INTERNAL_ERROR', 'Internal server error');
  }
}
