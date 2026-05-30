import type { ErrorRequestHandler } from 'express';
import { isApiError } from '../errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isApiError(err)) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
};

