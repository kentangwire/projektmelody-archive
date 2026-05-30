import { Router } from 'express';
import { ApiError } from '../errors';

type Tag = { id: string; name: string; category: string | null };

type VideoRow = {
  id: string;
  title: string;
  description: string;
  hlsMasterUrl: string;
  torrentUrl: string | null;
  magnetUrl: string | null;
  createdAt: unknown;
  updatedAt: unknown;
  videoTags: Array<{ tag: Tag }>;
};

type VideoWithTimestampsRow = VideoRow & {
  timestamps: Array<{
    id: string;
    timeInSec: number;
    description: string;
    upvotes: number;
    downvotes: number;
    userIp: string;
    createdAt: unknown;
  }>;
};

export type VideosRouteDeps = {
  prisma: {
    video: {
      findMany: (args: unknown) => Promise<VideoRow[]>;
      findUnique: (args: unknown) => Promise<VideoWithTimestampsRow | null>;
    };
  };
};

function parseTagIds(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function mapVideo(row: VideoRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    hlsMasterUrl: row.hlsMasterUrl,
    torrentUrl: row.torrentUrl,
    magnetUrl: row.magnetUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags: row.videoTags.map(vt => vt.tag)
  };
}

export function createVideosRouter(deps: VideosRouteDeps): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const tagIds = parseTagIds(req.query.tagIds);
      const where =
        tagIds.length > 0
          ? {
              videoTags: {
                some: { tagId: { in: tagIds } }
              }
            }
          : undefined;

      const rows = await deps.prisma.video.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { videoTags: { include: { tag: true } } }
      });

      res.json(rows.map(mapVideo));
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const id = String(req.params.id || '');
      if (!id) throw new ApiError(400, 'BAD_REQUEST', 'Missing id');

      const row = await deps.prisma.video.findUnique({
        where: { id },
        include: {
          videoTags: { include: { tag: true } },
          timestamps: { orderBy: [{ timeInSec: 'asc' }, { createdAt: 'asc' }] }
        }
      });

      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Video not found');

      res.json({
        ...mapVideo(row),
        timestamps: row.timestamps
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

