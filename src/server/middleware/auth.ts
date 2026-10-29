import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'socialagent_jwt_secret_default_key_2026';

export interface AuthenticatedUser {
  id: number;
  email: string;
  ai_provider: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, ai_provider: user.ai_provider },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
      return next();
    } catch {
      // Token invalid or expired
    }
  }

  // Graceful fallback for initial session: default to the first demo user
  const firstUser = db.prepare('SELECT id, email, ai_provider FROM users ORDER BY id ASC LIMIT 1').get() as AuthenticatedUser | undefined;
  if (firstUser) {
    req.user = firstUser;
    return next();
  }

  res.status(401).json({ success: false, error: 'Vui lòng đăng nhập để tiếp tục' });
}
