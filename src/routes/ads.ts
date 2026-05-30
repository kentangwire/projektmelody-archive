import { Router } from 'express';
import { ApiError } from '../errors';

export type AdsRouteDeps = {
  exoClickVastUrl: string;
  fetchFn?: typeof fetch;
};

export function createAdsRouter(deps: AdsRouteDeps): Router {
  const router = Router();
  const fetchFn = deps.fetchFn || fetch;

  router.get('/pre-roll', async (_req, res, next) => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const upstream = await fetchFn(deps.exoClickVastUrl, {
        signal: ctrl.signal,
        headers: { accept: 'application/xml,text/xml,*/*' }
      }).finally(() => clearTimeout(t));

      const xml = await upstream.text();
      if (!upstream.ok) {
        throw new ApiError(502, 'UPSTREAM_AD_ERROR', `Upstream ad error: ${upstream.status}`);
      }

      res.set('Content-Type', 'application/xml');
      res.set('Cache-Control', 'no-store');
      res.status(200).send(xml);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

