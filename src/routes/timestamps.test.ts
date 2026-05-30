import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createTimestampsRouter } from './timestamps';

function makeApp(prisma: any) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/videos', createTimestampsRouter({ prisma }));
  return app;
}

describe('POST /api/videos/:id/timestamps', () => {
  it('rejects description containing urls', async () => {
    const prisma = {
      timestamp: { findFirst: vi.fn(), create: vi.fn() }
    };
    const app = makeApp(prisma);

    const res = await request(app)
      .post('/api/videos/v1/timestamps')
      .set('X-Forwarded-For', '1.2.3.4')
      .send({ timeInSec: 10, description: 'see https://example.com' });

    expect(res.status).toBe(400);
    expect(prisma.timestamp.create).not.toHaveBeenCalled();
  });

  it('rate limits by IP within 60 seconds', async () => {
    const prisma = {
      timestamp: {
        findFirst: vi.fn(async () => ({ id: 't1' })),
        create: vi.fn()
      }
    };
    const app = makeApp(prisma);

    const res = await request(app)
      .post('/api/videos/v1/timestamps')
      .set('X-Forwarded-For', '1.2.3.4')
      .send({ timeInSec: 10, description: 'ok' });

    expect(res.status).toBe(429);
    expect(prisma.timestamp.create).not.toHaveBeenCalled();
  });

  it('creates timestamp when valid', async () => {
    const created = {
      id: 't1',
      videoId: 'v1',
      timeInSec: 10,
      description: 'ok',
      upvotes: 0,
      downvotes: 0,
      userIp: '1.2.3.4',
      createdAt: new Date().toISOString()
    };

    const prisma = {
      timestamp: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => created)
      }
    };
    const app = makeApp(prisma);

    const res = await request(app)
      .post('/api/videos/v1/timestamps')
      .set('X-Forwarded-For', '1.2.3.4')
      .send({ timeInSec: 10, description: 'ok' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('t1');
  });
});

