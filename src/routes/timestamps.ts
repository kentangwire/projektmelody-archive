import { Router } from 'express';
import { ApiError } from '../errors';

export type TimestampsRouteDeps = {
  prisma: {
    timestamp: {
      findFirst: (args: unknown) => Promise<unknown | null>;
      create: (args: unknown) => Promise<unknown>;
    };
  };
};

type CreateTimestampBody = {
  timeInSec?: unknown;
  description?: unknown;
};

function containsHtmlOrUrl(s: string): boolean {
  if (/<[^>]*>/.test(s)) return true;
  if (/https?:\/\//i.test(s)) return true;
  return false;
}

function parseBody(body: CreateTimestampBody) {
  const timeInSec = body.timeInSec;
  const description = body.description;

  if (!Number.isInteger(timeInSec)) throw new ApiError(400, 'BAD_REQUEST', 'timeInSec must be an integer');
  if (typeof description !== 'string') throw new ApiError(400, 'BAD_REQUEST', 'description must be a string');

  const trimmed = description.trim();
  if (!trimmed) throw new ApiError(400, 'BAD_REQUEST', 'description is required');
  if (trimmed.length > 60) throw new ApiError(400, 'BAD_REQUEST', 'description too long');
  if (containsHtmlOrUrl(trimmed)) throw new ApiError(400, 'BAD_REQUEST', 'description contains forbidden content');
  const t = timeInSec as number;
  if (t < 0) throw new ApiError(400, 'BAD_REQUEST', 'timeInSec must be >= 0');

  return { timeInSec: t, description: trimmed };
}

function getClientIp(ip: string | undefined | null): string {
  const v = String(ip || '').trim();
  return v || '0.0.0.0';
}

export function createTimestampsRouter(deps: TimestampsRouteDeps): Router {
  const router = Router();

  router.post('/:id/timestamps', async (req, res, next) => {
    try {
      const videoId = String(req.params.id || '');
      if (!videoId) throw new ApiError(400, 'BAD_REQUEST', 'Missing id');

      const ip = getClientIp(req.ip);
      const { timeInSec, description } = parseBody(req.body as CreateTimestampBody);
      const now = Date.now();
      const cutoff = new Date(now - 60_000);

      const recent = await deps.prisma.timestamp.findFirst({
        where: { videoId, userIp: ip, createdAt: { gte: cutoff } },
        orderBy: { createdAt: 'desc' }
      });

      if (recent) throw new ApiError(429, 'RATE_LIMITED', 'Too many requests');

      const created = await deps.prisma.timestamp.create({
        data: { videoId, timeInSec, description, userIp: ip }
      });

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
