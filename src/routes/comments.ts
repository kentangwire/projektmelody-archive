import { Router } from 'express';
import { ApiError } from '../errors';

export type CommentRow = {
  id: string;
  videoId: string;
  parentId: string | null;
  body: string;
  displayName: string | null;
  timeInSec: number | null;
  userIp: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type CommentsRouteDeps = {
  prisma: {
    comment: {
      findMany: (args: unknown) => Promise<CommentRow[]>;
      findFirst: (args: unknown) => Promise<CommentRow | null>;
      findUnique: (args: unknown) => Promise<CommentRow | null>;
      create: (args: unknown) => Promise<CommentRow>;
    };
  };
};

type CreateCommentBody = {
  body?: unknown;
  displayName?: unknown;
  parentId?: unknown;
  timeInSec?: unknown;
};

const MAX_BODY = 500;
const MAX_NAME = 32;
const MAX_DEPTH = 3;
const RATE_MS = 30_000;

function containsHtmlOrUrl(s: string): boolean {
  if (/<[^>]*>/.test(s)) return true;
  if (/https?:\/\//i.test(s)) return true;
  return false;
}

function getClientIp(ip: string | undefined | null): string {
  const v = String(ip || '').trim();
  return v || '0.0.0.0';
}

function parseDisplayName(raw: unknown): string {
  if (raw == null || raw === '') throw new ApiError(400, 'BAD_REQUEST', 'displayName is required');
  if (typeof raw !== 'string') throw new ApiError(400, 'BAD_REQUEST', 'displayName must be a string');
  const trimmed = raw.trim();
  if (!trimmed) throw new ApiError(400, 'BAD_REQUEST', 'displayName is required');
  if (trimmed.length > MAX_NAME) throw new ApiError(400, 'BAD_REQUEST', 'displayName too long');
  if (!/^[\w\s\-_.]{1,32}$/u.test(trimmed)) {
    throw new ApiError(400, 'BAD_REQUEST', 'displayName contains invalid characters');
  }
  return trimmed;
}

function parseTimeInSec(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (!Number.isInteger(raw)) throw new ApiError(400, 'BAD_REQUEST', 'timeInSec must be an integer');
  const t = raw as number;
  if (t < 0) throw new ApiError(400, 'BAD_REQUEST', 'timeInSec must be >= 0');
  return t;
}

function parseBody(body: CreateCommentBody) {
  if (typeof body.body !== 'string') throw new ApiError(400, 'BAD_REQUEST', 'body must be a string');
  const trimmed = body.body.trim();
  if (!trimmed) throw new ApiError(400, 'BAD_REQUEST', 'body is required');
  if (trimmed.length > MAX_BODY) throw new ApiError(400, 'BAD_REQUEST', 'body too long');
  if (containsHtmlOrUrl(trimmed)) throw new ApiError(400, 'BAD_REQUEST', 'body contains forbidden content');

  let parentId: string | null = null;
  if (body.parentId != null && body.parentId !== '') {
    if (typeof body.parentId !== 'string') throw new ApiError(400, 'BAD_REQUEST', 'parentId must be a string');
    parentId = body.parentId.trim();
    if (!parentId) parentId = null;
  }

  return {
    body: trimmed,
    displayName: parseDisplayName(body.displayName),
    parentId,
    timeInSec: parseTimeInSec(body.timeInSec)
  };
}

function mapPublicComment(row: CommentRow) {
  return {
    id: row.id,
    videoId: row.videoId,
    parentId: row.parentId,
    body: row.body,
    displayName: row.displayName,
    timeInSec: row.timeInSec,
    createdAt: row.createdAt
  };
}

async function commentDepth(deps: CommentsRouteDeps, parentId: string): Promise<number> {
  let depth = 0;
  let cur: string | null = parentId;
  while (cur) {
    depth += 1;
    const row = await deps.prisma.comment.findUnique({ where: { id: cur } });
    if (!row) throw new ApiError(400, 'BAD_REQUEST', 'parent comment not found');
    cur = row.parentId;
    if (depth > MAX_DEPTH) break;
  }
  return depth;
}

export function createCommentsRouter(deps: CommentsRouteDeps): Router {
  const router = Router();

  router.get('/:id/comments', async (req, res, next) => {
    try {
      const videoId = String(req.params.id || '');
      if (!videoId) throw new ApiError(400, 'BAD_REQUEST', 'Missing id');

      const rows = await deps.prisma.comment.findMany({
        where: { videoId },
        orderBy: [{ createdAt: 'asc' }]
      });

      res.json({ comments: rows.map(mapPublicComment) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/comments', async (req, res, next) => {
    try {
      const videoId = String(req.params.id || '');
      if (!videoId) throw new ApiError(400, 'BAD_REQUEST', 'Missing id');

      const ip = getClientIp(req.ip);
      const parsed = parseBody(req.body as CreateCommentBody);
      const cutoff = new Date(Date.now() - RATE_MS);

      const recent = await deps.prisma.comment.findFirst({
        where: { videoId, userIp: ip, createdAt: { gte: cutoff } },
        orderBy: { createdAt: 'desc' }
      });
      if (recent) throw new ApiError(429, 'RATE_LIMITED', 'Too many requests');

      if (parsed.parentId) {
        const parent = await deps.prisma.comment.findUnique({ where: { id: parsed.parentId } });
        if (!parent || parent.videoId !== videoId) {
          throw new ApiError(400, 'BAD_REQUEST', 'parent comment not found');
        }
        const depth = await commentDepth(deps, parsed.parentId);
        if (depth >= MAX_DEPTH) throw new ApiError(400, 'BAD_REQUEST', 'reply nesting too deep');
      }

      const created = await deps.prisma.comment.create({
        data: {
          videoId,
          parentId: parsed.parentId,
          body: parsed.body,
          displayName: parsed.displayName,
          timeInSec: parsed.timeInSec,
          userIp: ip
        }
      });

      res.status(201).json(mapPublicComment(created));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
