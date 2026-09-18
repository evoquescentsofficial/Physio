import { NextFunction, Request, Response } from 'express';
import { TokenPayload, verifyToken } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = header.slice('Bearer '.length);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Who may do what. Receptionists run the front desk — book, mark attendance, take money —
 * but must not delete records, change the clinic's fees, or read the practice's finances.
 * Junior doctors are clinical-only: patients, diagnoses, sessions, reports — never money, and
 * never a delete (see NOT_JUNIOR below).
 */
export const ADMIN_ONLY = requireRole('ADMIN');
export const CLINICAL = requireRole('ADMIN', 'DOCTOR');
// FINANCE deliberately excludes JUNIOR_DOCTOR by simply not naming it — the role has no
// financial access anywhere, so nothing here needs to change as roles are added.
export const FINANCE = requireRole('ADMIN', 'DOCTOR');
/** Everyone except a junior doctor — the delete-and-money-adjacent gate for clinical routes. */
export const NOT_JUNIOR = requireRole('ADMIN', 'DOCTOR', 'RECEPTIONIST');
