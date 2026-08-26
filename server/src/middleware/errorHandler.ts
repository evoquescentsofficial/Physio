import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
  }
  console.error(err);

  // Deliberate, safe-to-show failures set a status; anything else is a bug and its
  // message may contain query fragments or paths, so the client gets a generic line.
  const status = err.status || 500;
  if (status >= 500) {
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  res.status(status).json({ error: err.message || 'Request failed' });
}
