import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/db';
import { adminMiddleware, type AuthRequest } from '../middleware/auth';
import { seedDefaultAiConfigsForUser } from '../config/db';

export const adminRouter = Router();

// Apply adminMiddleware to all admin endpoints
adminRouter.use(adminMiddleware);

// 1. Overview Statistics
adminRouter.get('/overview', (req: AuthRequest, res) => {
  try {
    const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const activeUsers = (db.prepare(`
      SELECT COUNT(*) as count FROM users
      WHERE is_active = 1 AND (subscription_expires_at IS NULL OR subscription_expires_at > ?)
    `).get(nowIso) as any).count;

    const expiredUsers = (db.prepare(`
      SELECT COUNT(*) as count FROM users
      WHERE is_active = 0 OR (subscription_expires_at IS NOT NULL AND subscription_expires_at <= ?)
    `).get(nowIso) as any).count;

    const totalPages = (db.prepare('SELECT COUNT(*) as count FROM pages').get() as any).count;
    const totalAgents = (db.prepare('SELECT COUNT(*) as count FROM saved_ai_configs').get() as any).count;
    const totalMessages = (db.prepare('SELECT COUNT(*) as count FROM messages').get() as any).count;
    const totalAiMessages = (db.prepare('SELECT COUNT(*) as count FROM messages WHERE ai_generated = 1').get() as any).count;
    const totalComments = (db.prepare('SELECT COUNT(*) as count FROM comments').get() as any).count;
    const totalPosts = (db.prepare('SELECT COUNT(*) as count FROM scheduled_posts').get() as any).count;

    const aiReplyRate = totalMessages + totalComments > 0
      ? Math.round((totalAiMessages / (totalMessages || 1)) * 100)
      : 92;

    res.json({
      success: true,
      stats: {
        total_users: totalUsers,
        active_users: activeUsers,
        expired_users: expiredUsers,
        total_pages: totalPages,
        total_agents: totalAgents,
        total_messages: totalMessages,
        total_comments: totalComments,
        total_posts: totalPosts,
        ai_reply_rate: Math.min(100, Math.max(10, aiReplyRate)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. List all users with detailed live statistics
adminRouter.get('/users', (req: AuthRequest, res) => {
  try {
    const users = db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.role,
        u.plan,
        u.is_active,
        u.subscription_expires_at,
        u.max_pages,
        u.max_agents,
        u.created_at,
        (SELECT COUNT(*) FROM pages p WHERE p.user_id = u.id) as pages_count,
        (SELECT COUNT(*) FROM saved_ai_configs a WHERE a.user_id = u.id) as agents_count,
        (SELECT COUNT(*) FROM messages m WHERE m.page_id IN (SELECT id FROM pages WHERE user_id = u.id)) as messages_count,
        (SELECT COUNT(*) FROM comments c WHERE c.page_id IN (SELECT id FROM pages WHERE user_id = u.id)) as comments_count,
        (SELECT COUNT(*) FROM scheduled_posts sp WHERE sp.user_id = u.id) as posts_count
      FROM users u
      ORDER BY u.id ASC
    `).all() as any[];

    const now = Date.now();

    const formatted = users.map(user => {
      let daysRemaining = 999;
      let status: 'active' | 'expiring_soon' | 'expired' | 'blocked' = 'active';

      if (!user.is_active) {
        status = 'blocked';
      } else if (user.subscription_expires_at) {
        const expiresTime = new Date(user.subscription_expires_at).getTime();
        daysRemaining = Math.ceil((expiresTime - now) / 86400000);
        if (daysRemaining < 0) {
          status = 'expired';
        } else if (daysRemaining <= 7) {
          status = 'expiring_soon';
        } else {
          status = 'active';
        }
      }

      const userPages = db.prepare(`
        SELECT id, page_name, page_id, is_active, avatar_url
        FROM pages
        WHERE user_id = ?
        ORDER BY id ASC
      `).all(user.id) as any[];

      return {
        id: user.id,
        email: user.email,
        role: user.role || 'user',
        plan: user.plan || 'pro',
        is_active: Boolean(user.is_active),
        subscription_expires_at: user.subscription_expires_at,
        max_pages: user.max_pages || 5,
        max_agents: user.max_agents || 10,
        pages_count: user.pages_count || 0,
        agents_count: user.agents_count || 0,
        messages_count: user.messages_count || 0,
        comments_count: user.comments_count || 0,
        posts_count: user.posts_count || 0,
        days_remaining: daysRemaining,
        status,
        pages: userPages,
        created_at: user.created_at,
      };
    });

    res.json({ success: true, users: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Renew & update user quota (time, max pages, max agents, plan, role, status)
adminRouter.put('/users/:id/renew', (req: AuthRequest, res) => {
  const { id } = req.params;
  const {
    subscription_expires_at,
    add_days,
    max_pages,
    max_agents,
    plan,
    role,
    is_active,
  } = req.body;

  try {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!target) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
    }

    let newExpiresAt = target.subscription_expires_at;

    if (subscription_expires_at) {
      newExpiresAt = subscription_expires_at;
    } else if (add_days !== undefined) {
      const days = Number(add_days);
      const currentExpiry = target.subscription_expires_at ? new Date(target.subscription_expires_at).getTime() : Date.now();
      const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
      const nextDate = new Date(baseTime + days * 86400000);
      newExpiresAt = nextDate.toISOString().replace('T', ' ').substring(0, 19);
    }

    const newMaxPages = max_pages !== undefined ? Number(max_pages) : target.max_pages;
    const newMaxAgents = max_agents !== undefined ? Number(max_agents) : target.max_agents;
    const newPlan = plan !== undefined ? plan : target.plan;
    const newRole = role !== undefined ? role : target.role;
    const newIsActive = is_active !== undefined ? (is_active ? 1 : 0) : target.is_active;

    db.prepare(`
      UPDATE users
      SET subscription_expires_at = ?,
          max_pages = ?,
          max_agents = ?,
          plan = ?,
          role = ?,
          is_active = ?
      WHERE id = ?
    `).run(newExpiresAt, newMaxPages, newMaxAgents, newPlan, newRole, newIsActive, id);

    db.prepare(`
      INSERT INTO activity_logs (action, details_json)
      VALUES ('admin_renew_user', ?)
    `).run(JSON.stringify({
      target_user_id: id,
      target_email: target.email,
      new_expires_at: newExpiresAt,
      new_max_pages: newMaxPages,
      new_max_agents: newMaxAgents,
      new_plan: newPlan,
      new_role: newRole,
      new_active: newIsActive,
      renewed_by: req.user!.email,
    }));

    res.json({
      success: true,
      message: `Đã gia hạn thành công cho tài khoản ${target.email}`,
      user: {
        id: Number(id),
        email: target.email,
        subscription_expires_at: newExpiresAt,
        max_pages: newMaxPages,
        max_agents: newMaxAgents,
        plan: newPlan,
        role: newRole,
        is_active: Boolean(newIsActive),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Create new user by Admin
adminRouter.post('/users', (req: AuthRequest, res) => {
  const {
    email,
    password,
    role = 'user',
    plan = 'pro',
    max_pages = 5,
    max_agents = 10,
    subscription_days = 30,
  } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email và mật khẩu là bắt buộc' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email đã tồn tại trong hệ thống' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const expiresAt = new Date(Date.now() + Number(subscription_days) * 86400000)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    const result = db.prepare(`
      INSERT INTO users (email, password_hash, role, plan, subscription_expires_at, max_pages, max_agents, is_active, ai_provider)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'gemini')
    `).run(email, passwordHash, role, plan, expiresAt, Number(max_pages), Number(max_agents));

    const newUserId = Number(result.lastInsertRowid);
    seedDefaultAiConfigsForUser(newUserId);

    res.json({
      success: true,
      message: `Tạo tài khoản ${email} thành công`,
      user: {
        id: newUserId,
        email,
        role,
        plan,
        subscription_expires_at: expiresAt,
        max_pages: Number(max_pages),
        max_agents: Number(max_agents),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Toggle user active status
adminRouter.post('/users/:id/toggle-status', (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    if (Number(id) === req.user!.id) {
      return res.status(400).json({ success: false, error: 'Không thể tự khóa tài khoản Admin đang đăng nhập' });
    }

    const user = db.prepare('SELECT id, email, is_active FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
    }

    const nextState = user.is_active ? 0 : 1;
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(nextState, id);

    res.json({
      success: true,
      message: nextState ? `Đã mở khóa tài khoản ${user.email}` : `Đã tạm khóa tài khoản ${user.email}`,
      is_active: Boolean(nextState),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Delete user
adminRouter.delete('/users/:id', (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    if (Number(id) === req.user!.id) {
      return res.status(400).json({ success: false, error: 'Không thể xóa chính tài khoản Admin đang thao tác' });
    }

    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.json({
      success: true,
      message: `Đã xóa tài khoản ${user.email} khỏi hệ thống`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
