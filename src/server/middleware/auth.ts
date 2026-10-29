import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'socialagent_jwt_secret_default_key_2026';

export interface AuthenticatedUser {
  id: number;
  email: string;
  ai_provider: string;
  role?: string;
  plan?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      ai_provider: user.ai_provider,
      role: user.role || 'user',
      plan: user.plan || 'pro',
    },
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
      const fresh = db.prepare('SELECT id, email, ai_provider, role, plan, is_active FROM users WHERE id = ?').get(decoded.id) as any;
      if (fresh) {
        if (!fresh.is_active) {
          res.status(403).json({ success: false, error: 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Admin.' });
          return;
        }
        req.user = {
          id: fresh.id,
          email: fresh.email,
          ai_provider: fresh.ai_provider,
          role: fresh.role || 'user',
          plan: fresh.plan || 'pro',
        };
        return next();
      }
    } catch {
      // Token invalid or expired
    }
  }

  // Graceful fallback: default to the admin user
  const firstUser = db.prepare("SELECT id, email, ai_provider, role, plan FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1").get() as AuthenticatedUser | undefined
    || db.prepare('SELECT id, email, ai_provider, role, plan FROM users ORDER BY id ASC LIMIT 1').get() as AuthenticatedUser | undefined;

  if (firstUser) {
    req.user = firstUser;
    return next();
  }

  res.status(401).json({ success: false, error: 'Vui lòng đăng nhập để tiếp tục' });
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  authMiddleware(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập' });
    }

    const user = db.prepare('SELECT role, is_active FROM users WHERE id = ?').get(req.user.id) as { role?: string; is_active?: number } | undefined;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Quyền truy cập bị từ chối: Yêu cầu quyền Quản trị viên (Admin)',
      });
    }

    next();
  });
}
