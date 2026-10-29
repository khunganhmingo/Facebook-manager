import { Router } from 'express';
import { db } from '../config/db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { SchedulerService } from '../services/scheduler';
import { decryptData } from '../services/encryption';
import { FacebookService } from '../services/facebook';

export const postsRouter = Router();

// Get scheduled posts for calendar / list
postsRouter.get('/', authMiddleware, (req: AuthRequest, res) => {
  const { page_id, status } = req.query;

  try {
    let query = `
      SELECT sp.*, p.page_name, p.avatar_url as page_avatar
      FROM scheduled_posts sp
      JOIN pages p ON sp.page_id = p.id
      WHERE sp.user_id = ?
    `;
    const params: any[] = [req.user!.id];

    if (page_id) {
      query += ' AND sp.page_id = ?';
      params.push(page_id);
    }
    if (status && status !== 'all') {
      query += ' AND sp.status = ?';
      params.push(status);
    }

    query += ' ORDER BY sp.scheduled_at ASC';
    const posts = db.prepare(query).all(...params);

    res.json({ success: true, posts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new post (schedule or publish)
postsRouter.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const { page_id, content, image_url, scheduled_at, publish_now } = req.body;
  if (!page_id || !content) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin trang hoặc nội dung bài đăng' });
  }

  try {
    const page = db.prepare('SELECT id, page_id, page_name, page_access_token_encrypted FROM pages WHERE id = ? AND user_id = ?').get(page_id, req.user!.id) as any;
    if (!page) {
      return res.status(403).json({ success: false, error: 'Không tìm thấy trang' });
    }

    const scheduledDate = scheduled_at ? new Date(scheduled_at) : new Date();

    // Conflict detection: warn if another post is within 30 minutes on the same page
    const thirtyMinBefore = new Date(scheduledDate.getTime() - 30 * 60000).toISOString();
    const thirtyMinAfter = new Date(scheduledDate.getTime() + 30 * 60000).toISOString();
    const conflict = db.prepare(`
      SELECT id, scheduled_at FROM scheduled_posts
      WHERE page_id = ? AND status = 'scheduled'
        AND scheduled_at BETWEEN ? AND ?
    `).get(page_id, thirtyMinBefore, thirtyMinAfter) as any;

    let hasConflict = false;
    let conflictWarning = '';
    if (conflict && !publish_now) {
      hasConflict = true;
      conflictWarning = `Lưu ý: Đã có bài viết #${conflict.id} lên lịch vào lúc ${new Date(conflict.scheduled_at).toLocaleTimeString('vi-VN')} (cách dưới 30 phút).`;
    }

    if (publish_now) {
      // Publish immediately
      const token = decryptData(page.page_access_token_encrypted);
      const pubResult = await FacebookService.publishPost(token, page.page_id, content.trim(), image_url);

      const insertResult = db.prepare(`
        INSERT INTO scheduled_posts (page_id, user_id, content, image_url, scheduled_at, status, fb_post_id)
        VALUES (?, ?, ?, ?, ?, 'published', ?)
      `).run(page_id, req.user!.id, content.trim(), image_url || null, new Date().toISOString(), pubResult.postId || 'sim_post');

      db.prepare(`
        INSERT INTO activity_logs (page_id, action, details_json)
        VALUES (?, 'publish_post', ?)
      `).run(page_id, JSON.stringify({ title: content.slice(0, 50), immediate: true }));

      return res.json({
        success: true,
        post: {
          id: insertResult.lastInsertRowid,
          status: 'published',
          fb_post_id: pubResult.postId,
        },
        hasConflict,
        conflictWarning,
      });
    }

    // Schedule for later
    const insertResult = db.prepare(`
      INSERT INTO scheduled_posts (page_id, user_id, content, image_url, scheduled_at, status)
      VALUES (?, ?, ?, ?, ?, 'scheduled')
    `).run(page_id, req.user!.id, content.trim(), image_url || null, scheduledDate.toISOString());

    res.json({
      success: true,
      post: {
        id: insertResult.lastInsertRowid,
        status: 'scheduled',
        scheduled_at: scheduledDate.toISOString(),
      },
      hasConflict,
      conflictWarning,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update or reschedule post
postsRouter.put('/:id', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { content, image_url, scheduled_at, status } = req.body;

  try {
    const existing = db.prepare('SELECT id FROM scheduled_posts WHERE id = ? AND user_id = ?').get(id, req.user!.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    }

    db.prepare(`
      UPDATE scheduled_posts
      SET content = COALESCE(?, content),
          image_url = COALESCE(?, image_url),
          scheduled_at = COALESCE(?, scheduled_at),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(content, image_url, scheduled_at, status, id);

    res.json({ success: true, message: 'Cập nhật bài viết thành công' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete post
postsRouter.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const result = db.prepare('DELETE FROM scheduled_posts WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    }
    res.json({ success: true, message: 'Đã xóa bài viết' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Publish now
postsRouter.post('/:id/publish-now', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const post = db.prepare(`
      SELECT sp.*, p.page_id as fb_page_id, p.page_access_token_encrypted
      FROM scheduled_posts sp
      JOIN pages p ON sp.page_id = p.id
      WHERE sp.id = ? AND sp.user_id = ?
    `).get(id, req.user!.id) as any;

    if (!post) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    }

    const token = decryptData(post.page_access_token_encrypted);
    const pubResult = await FacebookService.publishPost(token, post.fb_page_id, post.content, post.image_url);

    if (pubResult.success) {
      db.prepare(`
        UPDATE scheduled_posts
        SET status = 'published', fb_post_id = ?, error_message = NULL
        WHERE id = ?
      `).run(pubResult.postId || 'sim_post', id);

      return res.json({ success: true, postId: pubResult.postId });
    } else {
      return res.status(500).json({ success: false, error: pubResult.error || 'Đăng bài thất bại' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Content Library
postsRouter.get('/library', authMiddleware, (req: AuthRequest, res) => {
  try {
    const items = db.prepare('SELECT * FROM content_library WHERE user_id = ? ORDER BY created_at DESC').all(req.user!.id);
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add to content library
postsRouter.post('/library', authMiddleware, (req: AuthRequest, res) => {
  const { content, topic, tone } = req.body;
  if (!content) {
    return res.status(400).json({ success: false, error: 'Thiếu nội dung' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO content_library (user_id, content, topic, tone, used_count)
      VALUES (?, ?, ?, ?, 1)
    `).run(req.user!.id, content.trim(), topic || 'Chung', tone || 'Mặc định');

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
