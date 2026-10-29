import { Router } from 'express';
import { db } from '../config/db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { AIAgent } from '../services/aiAgent';
import { FacebookService } from '../services/facebook';
import { decryptData } from '../services/encryption';

export const commentsRouter = Router();

// Get comments for a page
commentsRouter.get('/', authMiddleware, (req: AuthRequest, res) => {
  const { page_id, status } = req.query;
  if (!page_id) {
    return res.status(400).json({ success: false, error: 'Thiếu page_id' });
  }

  try {
    const page = db.prepare('SELECT id FROM pages WHERE id = ? AND user_id = ?').get(page_id, req.user!.id);
    if (!page) {
      return res.status(403).json({ success: false, error: 'Không có quyền truy cập trang' });
    }

    let query = 'SELECT * FROM comments WHERE page_id = ?';
    const params: any[] = [page_id];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC LIMIT 50';

    const comments = db.prepare(query).all(...params);
    res.json({ success: true, comments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reply to a comment
commentsRouter.post('/:id/reply', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { reply_text } = req.body;
  if (!reply_text) {
    return res.status(400).json({ success: false, error: 'Nội dung phản hồi không được để trống' });
  }

  try {
    const comment = db.prepare(`
      SELECT c.*, p.page_access_token_encrypted, p.page_name
      FROM comments c
      JOIN pages p ON c.page_id = p.id
      WHERE c.id = ? AND p.user_id = ?
    `).get(id, req.user!.id) as any;

    if (!comment) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bình luận' });
    }

    const token = decryptData(comment.page_access_token_encrypted);
    await FacebookService.replyComment(token, comment.fb_comment_id, reply_text.trim());

    db.prepare(`
      UPDATE comments
      SET ai_reply = ?, status = 'replied'
      WHERE id = ?
    `).run(reply_text.trim(), id);

    db.prepare(`
      INSERT INTO activity_logs (page_id, action, details_json)
      VALUES (?, 'reply_comment', ?)
    `).run(comment.page_id, JSON.stringify({ author_name: comment.author_name, reply: reply_text.slice(0, 50) }));

    res.json({ success: true, reply: reply_text.trim() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Hide comment
commentsRouter.post('/:id/hide', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const comment = db.prepare(`
      SELECT c.*, p.page_access_token_encrypted
      FROM comments c
      JOIN pages p ON c.page_id = p.id
      WHERE c.id = ? AND p.user_id = ?
    `).get(id, req.user!.id) as any;

    if (!comment) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bình luận' });
    }

    const token = decryptData(comment.page_access_token_encrypted);
    await FacebookService.hideComment(token, comment.fb_comment_id);

    db.prepare('UPDATE comments SET status = "hidden" WHERE id = ?').run(id);

    res.json({ success: true, message: 'Đã ẩn bình luận thành công' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simulate incoming comment
commentsRouter.post('/simulate', authMiddleware, async (req: AuthRequest, res) => {
  const { page_id, author_name, content, post_content } = req.body;
  if (!page_id || !content) {
    return res.status(400).json({ success: false, error: 'Thiếu nội dung bình luận' });
  }

  try {
    const page = db.prepare('SELECT * FROM pages WHERE id = ? AND user_id = ?').get(page_id, req.user!.id) as any;
    if (!page) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy trang' });
    }

    const cmtId = `fb_cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const author = author_name || 'Khách hàng FB';
    const postTitle = post_content || 'BST Khung Ảnh Canvas & Treo Tường Hiện Đại';

    // Fetch active prompt
    const activePrompt = db.prepare('SELECT content, ai_provider, ai_model FROM prompts WHERE page_id = ? AND type = "comment_reply" AND is_active = 1').get(page_id) as any;

    const user = db.prepare('SELECT ai_provider, ai_base_url, ai_model, ai_api_key_encrypted FROM users WHERE id = ?').get(req.user!.id) as any;
    const userApiKey = user?.ai_api_key_encrypted ? decryptData(user.ai_api_key_encrypted) : undefined;
    
    const chosenProvider = activePrompt?.ai_provider || user?.ai_provider || 'gemini';
    const chosenModel = activePrompt?.ai_model || (chosenProvider === user?.ai_provider ? user?.ai_model : undefined);
    const chosenBaseUrl = (chosenProvider === user?.ai_provider) ? user?.ai_base_url : undefined;
    const aiAgent = new AIAgent(chosenProvider, userApiKey, chosenBaseUrl, chosenModel);

    const skipKeywords = page.skip_keywords ? JSON.parse(page.skip_keywords) : [];
    const replyResult = await aiAgent.generateReplyToComment(
      content.trim(),
      postTitle,
      activePrompt?.content,
      { pageName: page.page_name, authorName: author, skipKeywords }
    );

    let finalStatus = 'pending';
    let aiReplyText: string | null = null;

    if (replyResult.isSpam || replyResult.shouldHide) {
      finalStatus = 'hidden';
    } else if (page.auto_reply_comments && replyResult.reply) {
      finalStatus = 'replied';
      aiReplyText = replyResult.reply;
    }

    const insertResult = db.prepare(`
      INSERT INTO comments (page_id, post_id, fb_comment_id, author_id, author_name, content, post_content, ai_reply, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      page_id,
      'fb_post_sample',
      cmtId,
      `user_${Date.now()}`,
      author,
      content.trim(),
      postTitle,
      aiReplyText,
      finalStatus
    );

    db.prepare(`
      INSERT INTO activity_logs (page_id, action, details_json)
      VALUES (?, 'reply_comment', ?)
    `).run(page_id, JSON.stringify({ author_name: author, status: finalStatus, isSpam: replyResult.isSpam }));

    res.json({
      success: true,
      comment: {
        id: insertResult.lastInsertRowid,
        author_name: author,
        content: content.trim(),
        post_content: postTitle,
        ai_reply: aiReplyText,
        status: finalStatus,
        isSpam: replyResult.isSpam,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
