import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createVideosRouter } from './videos';

describe('GET /api/videos', () => {
  it('returns videos with tags', async () => {
    const prisma = {
      video: {
        findMany: vi.fn(async () => [
          {
            id: 'v1',
            title: 't',
            description: 'd',
            hlsMasterUrl: 'https://x/master.m3u8',
            torrentUrl: null,
            magnetUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            videoTags: [{ tag: { id: 'tag1', name: 'Platform: Twitch', category: 'platform' } }]
          }
        ]),
        findUnique: vi.fn()
      }
    };

    const app = express();
    app.use('/api/videos', createVideosRouter({ prisma }));

    const res = await request(app).get('/api/videos');
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe('v1');
    expect(res.body[0].tags).toHaveLength(1);
    expect(res.body[0].tags[0].id).toBe('tag1');
  });
});

describe('GET /api/videos/:id', () => {
  it('returns video with ordered timestamps', async () => {
    const prisma = {
      video: {
        findMany: vi.fn(),
        findUnique: vi.fn(async () => ({
          id: 'v1',
          title: 't',
          description: 'd',
          hlsMasterUrl: 'https://x/master.m3u8',
          torrentUrl: null,
          magnetUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          videoTags: [{ tag: { id: 'tag1', name: 'niche', category: 'niche' } }],
          timestamps: [
            { id: 'a', timeInSec: 20, description: 'b', upvotes: 0, downvotes: 0, userIp: '1.1.1.1', createdAt: new Date().toISOString() },
            { id: 'b', timeInSec: 10, description: 'a', upvotes: 0, downvotes: 0, userIp: '1.1.1.1', createdAt: new Date().toISOString() }
          ]
        }))
      }
    };

    const app = express();
    app.use('/api/videos', createVideosRouter({ prisma }));

    const res = await request(app).get('/api/videos/v1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('v1');
    expect(res.body.tags).toHaveLength(1);
    expect(res.body.timestamps).toHaveLength(2);
  });
});
