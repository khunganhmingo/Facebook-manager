import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/db';
import { generateToken, authMiddleware, type AuthRequest } from '../middleware/auth';
import { encryptData, decryptData, maskToken } from '../services/encryption';
import { seedDefaultAiConfigsForUser } from '../config/db';

export const authRouter = Router();

// Register
authRouter.post('/register', (req, res) => {
  const { email, password, aiProvider, aiApiKey } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email và mật khẩu là bắt buộc' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email đã được đăng ký' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const encryptedKey = aiApiKey ? encryptData(aiApiKey) : null;

    const result = db.prepare(`
      INSERT INTO users (email, password_hash, ai_provider, ai_api_key_encrypted, role, plan, max_pages, max_agents, is_active)
      VALUES (?, ?, ?, ?, 'user', 'pro', 5, 10, 1)
    `).run(email, passwordHash, aiProvider || 'gemini', encryptedKey);

    const newUserId = Number(result.lastInsertRowid);
    seedDefaultAiConfigsForUser(newUserId);

    const user = {
      id: newUserId,
      email,
      role: 'user',
      plan: 'pro',
      max_pages: 5,
      max_agents: 10,
      is_active: true,
      ai_provider: aiProvider || 'gemini',
    };

    const token = generateToken(user as any);
    res.json({ success: true, user, token });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Login
authRouter.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập email và mật khẩu' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ success: false, error: 'Email hoặc mật khẩu không chính xác' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      plan: user.plan || 'pro',
      subscription_expires_at: user.subscription_expires_at || null,
      max_pages: user.max_pages || 5,
      max_agents: user.max_agents || 10,
      is_active: user.is_active !== 0,
      ai_provider: user.ai_provider || 'gemini',
      ai_base_url: user.ai_base_url || '',
      ai_model: user.ai_model || 'gemini-3.5-flash',
    };
    const token = generateToken(payload);
    res.json({ success: true, user: payload, token });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Me (Profile)
authRouter.get('/me', authMiddleware, (req: AuthRequest, res) => {
  try {
    const user = db.prepare('SELECT id, email, role, plan, subscription_expires_at, max_pages, max_agents, is_active, ai_provider, ai_base_url, ai_model, ai_api_key_encrypted, timezone, created_at FROM users WHERE id = ?').get(req.user!.id) as any;
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
    }

    const decryptedKey = user.ai_api_key_encrypted ? decryptData(user.ai_api_key_encrypted) : '';
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role || 'user',
        plan: user.plan || 'pro',
        subscription_expires_at: user.subscription_expires_at || null,
        max_pages: user.max_pages || 5,
        max_agents: user.max_agents || 10,
        is_active: user.is_active !== 0,
        ai_provider: user.ai_provider || 'gemini',
        ai_base_url: user.ai_base_url || '',
        ai_model: user.ai_model || 'gemini-3.5-flash',
        has_custom_key: Boolean(decryptedKey),
        masked_api_key: decryptedKey ? maskToken(decryptedKey) : '',
        timezone: user.timezone,
        created_at: user.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update settings
authRouter.put('/settings', authMiddleware, (req: AuthRequest, res) => {
  const { aiProvider, aiBaseUrl, aiModel, aiApiKey, timezone } = req.body;
  try {
    let encryptedKeyQuery = '';
    const params: any[] = [
      aiProvider || 'gemini',
      aiBaseUrl || null,
      aiModel || 'gemini-3.5-flash',
      timezone || 'Asia/Ho_Chi_Minh',
    ];

    if (aiApiKey !== undefined) {
      encryptedKeyQuery = ', ai_api_key_encrypted = ?';
      params.push(aiApiKey ? encryptData(aiApiKey) : null);
    }
    params.push(req.user!.id);

    db.prepare(`
      UPDATE users
      SET ai_provider = ?, ai_base_url = ?, ai_model = ?, timezone = ? ${encryptedKeyQuery}
      WHERE id = ?
    `).run(...params);

    res.json({ success: true, message: 'Cập nhật cấu hình AI Engine thành công' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test AI Connection
authRouter.post('/test-ai', authMiddleware, async (req: AuthRequest, res) => {
  const { provider, baseUrl, model, apiKey } = req.body;
  try {
    let keyToUse = apiKey;
    if (!keyToUse) {
      const user = db.prepare('SELECT ai_api_key_encrypted FROM users WHERE id = ?').get(req.user!.id) as any;
      if (user?.ai_api_key_encrypted) {
        keyToUse = decryptData(user.ai_api_key_encrypted);
      }
    }

    const { AIAgent } = await import('../services/aiAgent');
    const agent = new AIAgent(provider || 'gemini', keyToUse, baseUrl, model);
    const result = await agent.testConnection();

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get user's saved AI agent configurations
authRouter.get('/ai-configs', authMiddleware, async (req: AuthRequest, res) => {
  try {
    seedDefaultAiConfigsForUser(req.user!.id);

    const rows = db.prepare(`
      SELECT id, user_id, name, provider, model, base_url, api_key_encrypted, is_default, created_at, updated_at
      FROM saved_ai_configs
      WHERE user_id = ?
      ORDER BY is_default DESC, id ASC
    `).all(req.user!.id) as any[];

    const configs = rows.map(r => {
      const dec = r.api_key_encrypted ? decryptData(r.api_key_encrypted) : '';
      return {
        id: r.id,
        user_id: r.user_id,
        name: r.name,
        provider: r.provider,
        model: r.model,
        base_url: r.base_url,
        has_custom_key: Boolean(dec),
        masked_api_key: dec ? maskToken(dec) : '',
        is_default: Boolean(r.is_default),
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });

    res.json({ success: true, configs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save (create or update) AI config with max_agents quota check
authRouter.post('/ai-configs', authMiddleware, (req: AuthRequest, res) => {
  const { id, name, provider, model, baseUrl, apiKey, isDefault } = req.body;
  if (!name || !provider || !model) {
    return res.status(400).json({ success: false, error: 'Tên cấu hình, Provider và Model là bắt buộc' });
  }

  try {
    const user = db.prepare('SELECT max_agents, subscription_expires_at FROM users WHERE id = ?').get(req.user!.id) as any;
    const maxAgents = user?.max_agents || 10;

    if (id) {
      const existing = db.prepare('SELECT id FROM saved_ai_configs WHERE id = ? AND user_id = ?').get(id, req.user!.id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy cấu hình AI' });
      }

      let encryptedKeyPart = '';
      const params: any[] = [name.trim(), provider, model.trim(), baseUrl ? baseUrl.trim() : null];
      if (apiKey !== undefined) {
        encryptedKeyPart = ', api_key_encrypted = ?';
        params.push(apiKey ? encryptData(apiKey) : null);
      }
      params.push(id, req.user!.id);

      db.prepare(`
        UPDATE saved_ai_configs
        SET name = ?, provider = ?, model = ?, base_url = ? ${encryptedKeyPart}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(...params);

      if (isDefault) {
        db.prepare('UPDATE saved_ai_configs SET is_default = 0 WHERE user_id = ?').run(req.user!.id);
        db.prepare('UPDATE saved_ai_configs SET is_default = 1 WHERE id = ? AND user_id = ?').run(id, req.user!.id);
        db.prepare(`
          UPDATE users
          SET ai_provider = ?, ai_model = ?, ai_base_url = ?
          WHERE id = ?
        `).run(provider, model.trim(), baseUrl ? baseUrl.trim() : null, req.user!.id);
      }

      return res.json({ success: true, message: 'Cập nhật cấu hình AI Agent thành công' });
    }

    // New config: check max_agents quota
    const currentCount = db.prepare('SELECT COUNT(*) as count FROM saved_ai_configs WHERE user_id = ?').get(req.user!.id) as { count: number };
    if (currentCount.count >= maxAgents) {
      return res.status(403).json({
        success: false,
        error: `Đã đạt giới hạn số lượng AI Agent lưu trữ (${currentCount.count}/${maxAgents}). Vui lòng liên hệ Admin để gia hạn thêm.`,
      });
    }

    const encryptedKey = apiKey ? encryptData(apiKey) : null;
    const defaultFlag = isDefault ? 1 : 0;

    if (defaultFlag === 1) {
      db.prepare('UPDATE saved_ai_configs SET is_default = 0 WHERE user_id = ?').run(req.user!.id);
    }

    const insertRes = db.prepare(`
      INSERT INTO saved_ai_configs (user_id, name, provider, model, base_url, api_key_encrypted, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user!.id, name.trim(), provider, model.trim(), baseUrl ? baseUrl.trim() : null, encryptedKey, defaultFlag);

    if (defaultFlag === 1) {
      db.prepare(`
        UPDATE users
        SET ai_provider = ?, ai_model = ?, ai_base_url = ?
        WHERE id = ?
      `).run(provider, model.trim(), baseUrl ? baseUrl.trim() : null, req.user!.id);
    }

    res.json({
      success: true,
      message: 'Lưu cấu hình AI Agent mới thành công',
      id: Number(insertRes.lastInsertRowid),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Set config as default
authRouter.post('/ai-configs/:id/set-default', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const config = db.prepare('SELECT * FROM saved_ai_configs WHERE id = ? AND user_id = ?').get(id, req.user!.id) as any;
    if (!config) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy cấu hình' });
    }

    db.prepare('UPDATE saved_ai_configs SET is_default = 0 WHERE user_id = ?').run(req.user!.id);
    db.prepare('UPDATE saved_ai_configs SET is_default = 1 WHERE id = ? AND user_id = ?').run(id, req.user!.id);

    db.prepare(`
      UPDATE users
      SET ai_provider = ?, ai_model = ?, ai_base_url = ?
      WHERE id = ?
    `).run(config.provider, config.model, config.base_url || null, req.user!.id);

    res.json({
      success: true,
      message: `Đã đặt "${config.name}" làm AI Agent mặc định của hệ thống`,
      config: {
        id: config.id,
        name: config.name,
        provider: config.provider,
        model: config.model,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete AI config
authRouter.delete('/ai-configs/:id', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const config = db.prepare('SELECT is_default FROM saved_ai_configs WHERE id = ? AND user_id = ?').get(id, req.user!.id) as any;
    if (!config) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy cấu hình' });
    }

    db.prepare('DELETE FROM saved_ai_configs WHERE id = ? AND user_id = ?').run(id, req.user!.id);

    if (config.is_default) {
      const remaining = db.prepare('SELECT id, provider, model, base_url FROM saved_ai_configs WHERE user_id = ? ORDER BY id ASC LIMIT 1').get(req.user!.id) as any;
      if (remaining) {
        db.prepare('UPDATE saved_ai_configs SET is_default = 1 WHERE id = ?').run(remaining.id);
        db.prepare('UPDATE users SET ai_provider = ?, ai_model = ?, ai_base_url = ? WHERE id = ?').run(remaining.provider, remaining.model, remaining.base_url || null, req.user!.id);
      }
    }

    res.json({ success: true, message: 'Đã xóa cấu hình AI Agent' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
