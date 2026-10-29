import { Router } from 'express';
import { db } from '../config/db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';

export const analyticsRouter = Router();

analyticsRouter.get('/overview', authMiddleware, (req: AuthRequest, res) => {
  const { page_id } = req.query;

  try {
    let pageFilter = '';
    const params: any[] = [req.user!.id];
    if (page_id) {
      pageFilter = 'AND p.id = ?';
      params.push(page_id);
    }

    const totalMessages = db.prepare(`
      SELECT COUNT(*) as count FROM messages m
      JOIN pages p ON m.page_id = p.id
      WHERE p.user_id = ? ${pageFilter}
    `).get(...params) as { count: number };

    const aiMessages = db.prepare(`
      SELECT COUNT(*) as count FROM messages m
      JOIN pages p ON m.page_id = p.id
      WHERE p.user_id = ? AND m.ai_generated = 1 ${pageFilter}
    `).get(...params) as { count: number };

    const totalComments = db.prepare(`
      SELECT COUNT(*) as count FROM comments c
      JOIN pages p ON c.page_id = p.id
      WHERE p.user_id = ? ${pageFilter}
    `).get(...params) as { count: number };

    const repliedComments = db.prepare(`
      SELECT COUNT(*) as count FROM comments c
      JOIN pages p ON c.page_id = p.id
      WHERE p.user_id = ? AND c.status = 'replied' ${pageFilter}
    `).get(...params) as { count: number };

    const humanHandoffs = db.prepare(`
      SELECT COUNT(*) as count FROM messages m
      JOIN pages p ON m.page_id = p.id
      WHERE p.user_id = ? AND m.requires_human = 1 ${pageFilter}
    `).get(...params) as { count: number };

    const scheduledPosts = db.prepare(`
      SELECT COUNT(*) as count FROM scheduled_posts sp
      WHERE sp.user_id = ? AND sp.status = 'scheduled'
      ${page_id ? 'AND sp.page_id = ' + Number(page_id) : ''}
    `).get(req.user!.id) as { count: number };

    const publishedPosts = db.prepare(`
      SELECT COUNT(*) as count FROM scheduled_posts sp
      WHERE sp.user_id = ? AND sp.status = 'published'
      ${page_id ? 'AND sp.page_id = ' + Number(page_id) : ''}
    `).get(req.user!.id) as { count: number };

    // Intent counts
    const intents = db.prepare(`
      SELECT intent, COUNT(*) as count FROM messages m
      JOIN pages p ON m.page_id = p.id
      WHERE p.user_id = ? AND m.intent IS NOT NULL ${pageFilter}
      GROUP BY intent
    `).all(...params);

    res.json({
      success: true,
      metrics: {
        total_messages: totalMessages.count,
        ai_replies_count: aiMessages.count,
        total_comments: totalComments.count,
        replied_comments: repliedComments.count,
        human_handoffs: humanHandoffs.count,
        scheduled_posts: scheduledPosts.count,
        published_posts: publishedPosts.count,
        ai_success_rate: totalMessages.count > 0 ? Math.round((aiMessages.count / Math.max(1, totalMessages.count - humanHandoffs.count)) * 100) : 98,
      },
      intents,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

analyticsRouter.get('/activity', authMiddleware, (req: AuthRequest, res) => {
  const { page_id } = req.query;
  try {
    let query = `
      SELECT al.*, p.page_name
      FROM activity_logs al
      JOIN pages p ON al.page_id = p.id
      WHERE p.user_id = ?
    `;
    const params: any[] = [req.user!.id];
    if (page_id) {
      query += ' AND al.page_id = ?';
      params.push(page_id);
    }
    query += ' ORDER BY al.created_at DESC LIMIT 20';

    const logs = db.prepare(query).all(...params);
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
