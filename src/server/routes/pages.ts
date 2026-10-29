import { Router } from 'express';
import { db } from '../config/db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { encryptData, decryptData, maskToken } from '../services/encryption';
import { FacebookService } from '../services/facebook';

export const pagesRouter = Router();

// List user's pages
pagesRouter.get('/', authMiddleware, (req: AuthRequest, res) => {
  try {
    const pages = db.prepare(`
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM messages m WHERE m.page_id = p.id AND m.requires_human = 1) as unhandled_count,
        (SELECT COUNT(*) FROM messages m WHERE m.page_id = p.id) as total_messages,
        (SELECT COUNT(*) FROM comments c WHERE c.page_id = p.id) as total_comments
      FROM pages p
      WHERE p.user_id = ?
      ORDER BY p.id ASC
    `).all(req.user!.id) as any[];

    const result = pages.map(p => {
      const decrypted = decryptData(p.page_access_token_encrypted);
      return {
        id: p.id,
        page_id: p.page_id,
        page_name: p.page_name,
        masked_token: maskToken(decrypted),
        avatar_url: p.avatar_url,
        is_active: Boolean(p.is_active),
        auto_reply_messages: Boolean(p.auto_reply_messages),
        auto_reply_comments: Boolean(p.auto_reply_comments),
        active_hours: p.active_hours_json ? JSON.parse(p.active_hours_json) : null,
        reply_delay_min: p.reply_delay_min,
        reply_delay_max: p.reply_delay_max,
        skip_keywords: p.skip_keywords ? JSON.parse(p.skip_keywords) : [],
        unhandled_count: p.unhandled_count,
        total_messages: p.total_messages,
        total_comments: p.total_comments,
        created_at: p.created_at,
      };
    });

    res.json({ success: true, pages: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Connect new Page
pagesRouter.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const { page_id, page_name, page_access_token, avatar_url } = req.body;
  if (!page_id || !page_access_token) {
    return res.status(400).json({ success: false, error: 'Page ID và Access Token là bắt buộc' });
  }

  try {
    const encryptedToken = encryptData(page_access_token.trim());
    const finalName = page_name ? page_name.trim() : `Fanpage (${page_id})`;

    const insertResult = db.prepare(`
      INSERT INTO pages (user_id, page_id, page_name, page_access_token_encrypted, avatar_url, is_active, auto_reply_messages, auto_reply_comments)
      VALUES (?, ?, ?, ?, ?, 1, 1, 1)
    `).run(
      req.user!.id,
      page_id.trim(),
      finalName,
      encryptedToken,
      avatar_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80'
    );

    const newPageId = insertResult.lastInsertRowid;

    // Seed default prompts for this newly connected page
    const promptInsert = db.prepare(`
      INSERT INTO prompts (page_id, type, content, version, is_active)
      VALUES (?, ?, ?, 1, 1)
    `);

    promptInsert.run(
      newPageId,
      'message_reply',
      `Bạn là trợ lý AI thông minh của page "{{page_name}}". Khách hàng nhắn: "{{last_message}}". Trả lời lịch sự, thân thiện, ngắn gọn và hữu ích!`
    );
    promptInsert.run(
      newPageId,
      'comment_reply',
      `Bạn là CSKH của page "{{page_name}}". Khách bình luận: "{{last_message}}" trên bài viết: "{{post_content}}". Trả lời thân thiện và mời khách check inbox nhé!`
    );
    promptInsert.run(
      newPageId,
      'post_generation',
      `Viết bài đăng Facebook thu hút cho page "{{page_name}}" về chủ đề: {{topic}}, tone: {{tone}}, kèm CTA và hashtag liên quan.`
    );

    // Activity log
    db.prepare(`
      INSERT INTO activity_logs (page_id, action, details_json)
      VALUES (?, 'page_connected', ?)
    `).run(newPageId, JSON.stringify({ message: `Đã kết nối Page "${finalName}" (ID: ${page_id})` }));

    res.json({
      success: true,
      page: {
        id: newPageId,
        page_id,
        page_name: finalName,
        masked_token: maskToken(page_access_token),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Page settings
pagesRouter.put('/:id', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const {
    page_name,
    page_access_token,
    is_active,
    auto_reply_messages,
    auto_reply_comments,
    active_hours,
    reply_delay_min,
    reply_delay_max,
    skip_keywords,
  } = req.body;

  try {
    const existing = db.prepare('SELECT id, page_access_token_encrypted FROM pages WHERE id = ? AND user_id = ?').get(id, req.user!.id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy trang hoặc không có quyền' });
    }

    let tokenToSave = existing.page_access_token_encrypted;
    if (page_access_token && page_access_token.length > 10 && !page_access_token.includes('••')) {
      tokenToSave = encryptData(page_access_token.trim());
    }

    db.prepare(`
      UPDATE pages
      SET page_name = COALESCE(?, page_name),
          page_access_token_encrypted = ?,
          is_active = COALESCE(?, is_active),
          auto_reply_messages = COALESCE(?, auto_reply_messages),
          auto_reply_comments = COALESCE(?, auto_reply_comments),
          active_hours_json = COALESCE(?, active_hours_json),
          reply_delay_min = COALESCE(?, reply_delay_min),
          reply_delay_max = COALESCE(?, reply_delay_max),
          skip_keywords = COALESCE(?, skip_keywords)
      WHERE id = ?
    `).run(
      page_name,
      tokenToSave,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      auto_reply_messages !== undefined ? (auto_reply_messages ? 1 : 0) : null,
      auto_reply_comments !== undefined ? (auto_reply_comments ? 1 : 0) : null,
      active_hours ? JSON.stringify(active_hours) : null,
      reply_delay_min,
      reply_delay_max,
      skip_keywords ? JSON.stringify(skip_keywords) : null,
      id
    );

    res.json({ success: true, message: 'Cập nhật cài đặt Fanpage thành công' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Page
pagesRouter.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const result = db.prepare('DELETE FROM pages WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Trang không tồn tại' });
    }
    res.json({ success: true, message: 'Đã xóa kết nối Fanpage' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check Facebook token
pagesRouter.get('/:id/health', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const page = db.prepare('SELECT page_access_token_encrypted FROM pages WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any;
    if (!page) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy trang' });
    }

    const token = decryptData(page.page_access_token_encrypted);
    const health = await FacebookService.checkTokenHealth(token);
    res.json({ success: true, health });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
