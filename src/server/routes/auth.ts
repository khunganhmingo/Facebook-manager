import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/db';
import { generateToken, authMiddleware, type AuthRequest } from '../middleware/auth';
import { encryptData, decryptData, maskToken } from '../services/encryption';

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
      INSERT INTO users (email, password_hash, ai_provider, ai_api_key_encrypted)
      VALUES (?, ?, ?, ?)
    `).run(email, passwordHash, aiProvider || 'gemini', encryptedKey);

    const user = {
      id: Number(result.lastInsertRowid),
      email,
      ai_provider: aiProvider || 'gemini',
    };

    const token = generateToken(user);
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
    const user = db.prepare('SELECT id, email, ai_provider, ai_base_url, ai_model, ai_api_key_encrypted, timezone, created_at FROM users WHERE id = ?').get(req.user!.id) as any;
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
    }

    const decryptedKey = user.ai_api_key_encrypted ? decryptData(user.ai_api_key_encrypted) : '';
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
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
    // If apiKey is not passed in request body, retrieve saved one from DB
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

