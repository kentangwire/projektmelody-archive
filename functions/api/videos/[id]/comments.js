import { isValidationError, parseCommentBody } from '../../../apiValidate.js';
import {
  apiError,
  commentDepth,
  dbUnavailable,
  fetchCommentById,
  fetchComments,
  getClientIp,
  getSql,
  insertComment,
  json,
  recentComment,
  videoExists
} from '../../../neonDb.js';
import { parseVideoId } from '../../../statsUtil.js';

const MAX_DEPTH = 3;
const RATE_MS = 30_000;

export async function onRequestGet({ env, params }) {
  const id = parseVideoId(params?.id);
  if (!id) return apiError(400, 'BAD_REQUEST', 'Missing id');

  const sql = getSql(env);
  if (!sql) return dbUnavailable();

  try {
    const rows = await fetchComments(sql, id);
    return json({ comments: rows });
  } catch {
    return apiError(500, 'INTERNAL_ERROR', 'Internal server error');
  }
}

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
    parsed = parseCommentBody(body);
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
    if (await recentComment(sql, id, ip, cutoff)) {
      return apiError(429, 'RATE_LIMITED', 'Too many requests');
    }

    if (parsed.parentId) {
      const parent = await fetchCommentById(sql, parsed.parentId);
      if (!parent || parent.videoId !== id) {
        return apiError(400, 'BAD_REQUEST', 'parent comment not found');
      }
      const depth = await commentDepth(sql, parsed.parentId, MAX_DEPTH);
      if (depth < 0) return apiError(400, 'BAD_REQUEST', 'parent comment not found');
      if (depth >= MAX_DEPTH) return apiError(400, 'BAD_REQUEST', 'reply nesting too deep');
    }

    const created = await insertComment(sql, {
      videoId: id,
      parentId: parsed.parentId,
      body: parsed.body,
      displayName: parsed.displayName,
      timeInSec: parsed.timeInSec,
      userIp: ip
    });

    return json(created, 201);
  } catch {
    return apiError(500, 'INTERNAL_ERROR', 'Internal server error');
  }
}
