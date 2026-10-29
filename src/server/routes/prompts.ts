import { Router } from 'express';
import { db } from '../config/db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { AIAgent } from '../services/aiAgent';
import { decryptData } from '../services/encryption';

export const promptsRouter = Router();

// Get active prompts for page
promptsRouter.get('/', authMiddleware, (req: AuthRequest, res) => {
  const { page_id } = req.query;
  if (!page_id) {
    return res.status(400).json({ success: false, error: 'Thiếu page_id' });
  }

  try {
    const page = db.prepare('SELECT id FROM pages WHERE id = ? AND user_id = ?').get(page_id, req.user!.id);
    if (!page) {
      return res.status(403).json({ success: false, error: 'Không có quyền truy cập trang' });
    }

    const prompts = db.prepare(`
      SELECT id, page_id, type, content, ai_provider, ai_model, version, is_active, created_at
      FROM prompts
      WHERE page_id = ? AND is_active = 1
      ORDER BY type ASC
    `).all(page_id);

    res.json({ success: true, prompts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update prompt (creates new version, deactivates old)
promptsRouter.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { page_id, type, content, ai_provider, ai_model } = req.body;
  if (!page_id || !type || !content) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin prompt' });
  }

  try {
    const page = db.prepare('SELECT id FROM pages WHERE id = ? AND user_id = ?').get(page_id, req.user!.id);
    if (!page) {
      return res.status(403).json({ success: false, error: 'Không có quyền truy cập trang' });
    }

    // Get current max version
    const current = db.prepare(`
      SELECT MAX(version) as max_version FROM prompts
      WHERE page_id = ? AND type = ?
    `).get(page_id, type) as { max_version: number | null };

    const nextVersion = (current?.max_version || 0) + 1;

    // Deactivate previous
    db.prepare('UPDATE prompts SET is_active = 0 WHERE page_id = ? AND type = ?').run(page_id, type);

    const cleanProvider = ai_provider && ai_provider !== 'default' ? ai_provider.trim() : null;
    const cleanModel = ai_model && ai_model.trim() ? ai_model.trim() : null;

    // Insert new version with ai_provider & ai_model
    const insertResult = db.prepare(`
      INSERT INTO prompts (page_id, type, content, ai_provider, ai_model, version, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(page_id, type, content.trim(), cleanProvider, cleanModel, nextVersion);

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (page_id, action, details_json)
      VALUES (?, 'prompt_updated', ?)
    `).run(page_id, JSON.stringify({ type, version: nextVersion, ai_provider: cleanProvider, ai_model: cleanModel }));

    res.json({
      success: true,
      prompt: {
        id: insertResult.lastInsertRowid,
        page_id,
        type,
        content: content.trim(),
        ai_provider: cleanProvider,
        ai_model: cleanModel,
        version: nextVersion,
        is_active: 1,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get version history
promptsRouter.get('/history', authMiddleware, (req: AuthRequest, res) => {
  const { page_id, type } = req.query;
  if (!page_id || !type) {
    return res.status(400).json({ success: false, error: 'Thiếu page_id hoặc type' });
  }

  try {
    const history = db.prepare(`
      SELECT id, type, content, ai_provider, ai_model, version, is_active, created_at
      FROM prompts
      WHERE page_id = ? AND type = ?
      ORDER BY version DESC
    `).all(page_id, type);

    res.json({ success: true, history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rollback to previous version
promptsRouter.post('/rollback', authMiddleware, (req: AuthRequest, res) => {
  const { prompt_id } = req.body;
  if (!prompt_id) {
    return res.status(400).json({ success: false, error: 'Thiếu prompt_id' });
  }

  try {
    const target = db.prepare('SELECT * FROM prompts WHERE id = ?').get(prompt_id) as any;
    if (!target) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy phiên bản' });
    }

    // Verify user owns page
    const page = db.prepare('SELECT id FROM pages WHERE id = ? AND user_id = ?').get(target.page_id, req.user!.id);
    if (!page) {
      return res.status(403).json({ success: false, error: 'Không có quyền' });
    }

    // Deactivate all of this type
    db.prepare('UPDATE prompts SET is_active = 0 WHERE page_id = ? AND type = ?').run(target.page_id, target.type);

    // Activate target
    db.prepare('UPDATE prompts SET is_active = 1 WHERE id = ?').run(prompt_id);

    res.json({
      success: true,
      message: `Đã khôi phục về phiên bản v${target.version}`,
      prompt: target,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test prompt in preview sandbox
promptsRouter.post('/test', authMiddleware, async (req: AuthRequest, res) => {
  const { page_id, prompt_content, sample_input, prompt_type, ai_provider, ai_model } = req.body;
  if (!prompt_content || !sample_input) {
    return res.status(400).json({ success: false, error: 'Thiếu nội dung prompt hoặc câu hỏi mẫu' });
  }

  try {
    const user = db.prepare('SELECT ai_provider, ai_base_url, ai_model, ai_api_key_encrypted FROM users WHERE id = ?').get(req.user!.id) as any;
    const userApiKey = user?.ai_api_key_encrypted ? decryptData(user.ai_api_key_encrypted) : undefined;

    // Determine engine & model to use
    const resolvedProvider = (ai_provider && ai_provider !== 'default') ? ai_provider : (user?.ai_provider || 'gemini');
    let resolvedModel = ai_model && ai_model.trim() ? ai_model.trim() : undefined;
    if (!resolvedModel && (!ai_provider || ai_provider === 'default' || ai_provider === user?.ai_provider)) {
      resolvedModel = user?.ai_model;
    }

    const resolvedBaseUrl = (resolvedProvider === user?.ai_provider) ? user?.ai_base_url : undefined;
    const aiAgent = new AIAgent(resolvedProvider, userApiKey, resolvedBaseUrl, resolvedModel);

    const page = page_id ? db.prepare('SELECT page_name FROM pages WHERE id = ?').get(page_id) as any : null;
    const pageName = page?.page_name || 'Khung Ảnh Đẹp Mingo';

    const engineInfo = {
      provider: aiAgent.provider,
      model: aiAgent.model,
      isSavedDefault: !ai_provider || ai_provider === 'default',
    };

    if (prompt_type === 'comment_reply') {
      const result = await aiAgent.generateReplyToComment(
        sample_input,
        'BST Khung Ảnh Canvas & Treo Tường Hiện Đại',
        prompt_content,
        { pageName }
      );
      return res.json({ success: true, result, engineUsed: engineInfo });
    }

    if (prompt_type === 'post_generation') {
      const result = await aiAgent.generatePostContent(
        sample_input,
        'Hấp dẫn, tự nhiên',
        'Vừa phải (150-250 từ)',
        ['#Mingo', '#KhungAnh'],
        'Inbox shop ngay nhé!',
        pageName
      );
      return res.json({
        success: true,
        result: {
          reply: result.variants[0]?.fullPost || 'Nội dung bài viết mẫu đã được tạo',
          intent: 'post_draft',
          variants: result.variants,
          imagePrompt: result.imagePrompt,
        },
        engineUsed: engineInfo,
      });
    }

    const result = await aiAgent.generateReplyToMessage(
      sample_input,
      [],
      prompt_content,
      { pageName, customerName: 'Khách hàng thử nghiệm' }
    );
    res.json({ success: true, result, engineUsed: engineInfo });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
