import { neon } from '@neondatabase/serverless';

export function getSql(env) {
  const url = env?.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export function apiError(status, code, message) {
  return json({ error: { code, message } }, status);
}

export function dbUnavailable() {
  return apiError(503, 'DB_UNAVAILABLE', 'Database not configured');
}

export function newId() {
  return crypto.randomUUID();
}

export function getClientIp(request) {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return String(xff).split(',')[0].trim();
  return '0.0.0.0';
}

export async function videoExists(sql, videoId) {
  const rows = await sql`SELECT id FROM "Video" WHERE id = ${videoId} LIMIT 1`;
  return rows.length > 0;
}

export async function fetchVideoDetail(sql, videoId) {
  const videos = await sql`
    SELECT id, title, description, "hlsMasterUrl", "torrentUrl", "magnetUrl", "createdAt", "updatedAt"
    FROM "Video"
    WHERE id = ${videoId}
    LIMIT 1
  `;
  if (!videos.length) return null;

  const tags = await sql`
    SELECT t.id, t.name, t.category
    FROM "Tag" t
    INNER JOIN "VideoTag" vt ON vt."tagId" = t.id
    WHERE vt."videoId" = ${videoId}
  `;

  const timestamps = await sql`
    SELECT id, "timeInSec", description, upvotes, downvotes, "userIp", "createdAt"
    FROM "Timestamp"
    WHERE "videoId" = ${videoId}
    ORDER BY "timeInSec" ASC, "createdAt" ASC
  `;

  const v = videos[0];
  return {
    id: v.id,
    title: v.title,
    description: v.description,
    hlsMasterUrl: v.hlsMasterUrl,
    torrentUrl: v.torrentUrl,
    magnetUrl: v.magnetUrl,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    tags,
    timestamps
  };
}

export async function fetchComments(sql, videoId) {
  return sql`
    SELECT id, "videoId", "parentId", body, "displayName", "timeInSec", "createdAt"
    FROM "Comment"
    WHERE "videoId" = ${videoId}
    ORDER BY "createdAt" ASC
  `;
}

export async function fetchCommentById(sql, commentId) {
  const rows = await sql`
    SELECT id, "videoId", "parentId"
    FROM "Comment"
    WHERE id = ${commentId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function commentDepth(sql, parentId, maxDepth) {
  let depth = 0;
  let cur = parentId;
  while (cur) {
    depth += 1;
    const row = await fetchCommentById(sql, cur);
    if (!row) return -1;
    cur = row.parentId;
    if (depth > maxDepth) break;
  }
  return depth;
}

export async function recentComment(sql, videoId, userIp, cutoff) {
  const rows = await sql`
    SELECT id
    FROM "Comment"
    WHERE "videoId" = ${videoId} AND "userIp" = ${userIp} AND "createdAt" >= ${cutoff}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function recentTimestamp(sql, videoId, userIp, cutoff) {
  const rows = await sql`
    SELECT id
    FROM "Timestamp"
    WHERE "videoId" = ${videoId} AND "userIp" = ${userIp} AND "createdAt" >= ${cutoff}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function insertComment(sql, data) {
  const now = new Date();
  const id = newId();
  const rows = await sql`
    INSERT INTO "Comment" (id, "videoId", "parentId", body, "displayName", "timeInSec", "userIp", "createdAt", "updatedAt")
    VALUES (${id}, ${data.videoId}, ${data.parentId}, ${data.body}, ${data.displayName}, ${data.timeInSec}, ${data.userIp}, ${now}, ${now})
    RETURNING id, "videoId", "parentId", body, "displayName", "timeInSec", "createdAt"
  `;
  return rows[0];
}

export async function insertTimestamp(sql, data) {
  const now = new Date();
  const id = newId();
  const rows = await sql`
    INSERT INTO "Timestamp" (id, "videoId", "timeInSec", description, upvotes, downvotes, "userIp", "createdAt", "updatedAt")
    VALUES (${id}, ${data.videoId}, ${data.timeInSec}, ${data.description}, 0, 0, ${data.userIp}, ${now}, ${now})
    RETURNING id, "videoId", "timeInSec", description, upvotes, downvotes, "userIp", "createdAt", "updatedAt"
  `;
  return rows[0];
}
