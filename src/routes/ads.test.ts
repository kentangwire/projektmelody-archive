import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createAdsRouter } from './ads';

describe('GET /api/ads/pre-roll', () => {
  it('returns upstream XML with application/xml', async () => {
    const upstreamXml = '<?xml version="1.0"?><VAST version="3.0"></VAST>';
    const fetchFn = vi.fn(async () => {
      return new Response(upstreamXml, {
        status: 200,
        headers: { 'content-type': 'application/xml' }
      });
    });

    const app = express();
    app.use('/api/ads', createAdsRouter({ exoClickVastUrl: 'https://example.test/vast', fetchFn }));

    const res = await request(app).get('/api/ads/pre-roll');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.text).toBe(upstreamXml);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

