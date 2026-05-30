import cors from 'cors';
import express from 'express';
import { getEnv } from './env';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './prisma';
import { createAdsRouter } from './routes/ads';
import { createTimestampsRouter } from './routes/timestamps';
import { createVideosRouter } from './routes/videos';

export function createApp() {
  const env = getEnv();
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (env.corsOrigins.length === 0) return cb(null, true);
        if (env.corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: false
    })
  );

  app.use(express.json({ limit: '64kb' }));

  app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

  app.use('/api/ads', createAdsRouter({ exoClickVastUrl: env.exoClickVastUrl }));
  app.use('/api/videos', createVideosRouter({ prisma }));
  app.use('/api/videos', createTimestampsRouter({ prisma }));

  app.use(errorHandler);

  return app;
}

