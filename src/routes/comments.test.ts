import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createCommentsRouter } from './comments';

function makeApp(prisma: unknown) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/videos', createCommentsRouter({ prisma: prisma as any }));
  return app;
}

describe('GET /api/videos/:id/comments', () => {
  it('returns comments without userIp', async () => {
    const prisma = {
      comment: {
        findMany: vi.fn(async () => [
          {
            id: 'c1',
            videoId: 'v1',
            parentId: null,
            body: 'hello',
            displayName: 'Fan',
            timeInSec: null,
            userIp: 'secret',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ])
      }
    };
    const app = makeApp(prisma);

    const res = await request(app).get('/api/videos/v1/comments');
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].body).toBe('hello');
    expect(res.body.comments[0].userIp).toBeUndefined();
  });
});

describe('POST /api/videos/:id/comments', () => {
  it('rejects urls in body', async () => {
    const prisma = {
      comment: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() }
    };
    const app = makeApp(prisma);

    const res = await request(app)
      .post('/api/videos/v1/comments')
      .send({ body: 'see https://evil.test' });

    expect(res.status).toBe(400);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('creates top-level comment with optional display name', async () => {
    const created = {
      id: 'c1',
      videoId: 'v1',
      parentId: null,
      body: 'great stream',
      displayName: 'MelodyFan',
      timeInSec: 120,
      userIp: '1.2.3.4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const prisma = {
      comment: {
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(),
        create: vi.fn(async () => created)
      }
    };
    const app = makeApp(prisma);

    const res = await request(app)
      .post('/api/videos/v1/comments')
      .set('X-Forwarded-For', '1.2.3.4')
      .send({ body: 'great stream', displayName: 'MelodyFan', timeInSec: 120 });

    expect(res.status).toBe(201);
    expect(res.body.displayName).toBe('MelodyFan');
    expect(res.body.timeInSec).toBe(120);
  });

  it('creates reply when parent exists', async () => {
    const prisma = {
      comment: {
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === 'p1') {
            return {
              id: 'p1',
              videoId: 'v1',
              parentId: null,
              body: 'x',
              displayName: null,
              timeInSec: null,
              userIp: '9',
              createdAt: '',
              updatedAt: ''
            };
          }
          return null;
        }),
        create: vi.fn(async () => ({
          id: 'c2',
          videoId: 'v1',
          parentId: 'p1',
          body: 'reply',
          displayName: null,
          timeInSec: null,
          userIp: '1.2.3.4',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }))
      }
    };
    const app = makeApp(prisma);

    const res = await request(app)
      .post('/api/videos/v1/comments')
      .set('X-Forwarded-For', '1.2.3.4')
      .send({ body: 'reply', parentId: 'p1' });

    expect(res.status).toBe(201);
    expect(res.body.parentId).toBe('p1');
  });
});
