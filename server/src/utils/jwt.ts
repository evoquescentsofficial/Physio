import jwt from 'jsonwebtoken';

import { config } from '../config';

const SECRET = config.jwtSecret;

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}
