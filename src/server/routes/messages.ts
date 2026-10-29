import { Router } from 'express';
import { db } from '../config/db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { AIAgent } from '../services/aiAgent';
import { FacebookService } from '../services/facebook';
import { decryptData } from '../services/encryption';

export const messagesRouter = Router();

// Get list of conversations for a page
messagesRouter.get('/', authMiddleware, (req: AuthRequest, res) => {
  const { page_id } = req.query;
  if (!page_id) {
    return res.status(400).json({ success: false, error: 'Thiếu page_id' });
  }

  try {
    // Verify user owns page
    const page = db.prepare('SELECT id, page_name FROM pages WHERE id = ? AND user_id = ?').get(page_id, req.user!.id);
    if (!page) {
      return res.status(403).json({ success: false, error: 'Không có quyền truy cập trang này' });
    }

    // Get all messages for page ordered chronologically
    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE page_id = ?
      ORDER BY created_at ASC
    `).all(page_id) as any[];

    // Group into conversations by sender_id
    const conversationsMap = new Map<string, any>();
    for (const msg of messages) {
      if (!conversationsMap.has(msg.sender_id)) {
        conversationsMap.set(msg.sender_id, {
          sender_id: msg.sender_id,
          sender_name: msg.sender_name,
          latest_message: msg.content,
          latest_time: msg.created_at,
          requires_human: Boolean(msg.requires_human),
          unread: msg.direction === 'in' && msg.status === 'pending',
          messages: [],
        });
      }
      const convo = conversationsMap.get(msg.sender_id);
      convo.latest_message = msg.content;
      convo.latest_time = msg.created_at;
      if (msg.requires_human) {
        convo.requires_human = true;
      }
      convo.messages.push({
        id: msg.id,
        content: msg.content,
        direction: msg.direction,
        ai_generated: Boolean(msg.ai_generated),
        status: msg.status,
        requires_human: Boolean(msg.requires_human),
        intent: msg.intent,
        sentiment: msg.sentiment,
        created_at: msg.created_at,
      });
    }

    const conversations = Array.from(conversationsMap.values()).reverse();
    res.json({ success: true, conversations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send manual reply from human agent
messagesRouter.post('/reply', authMiddleware, async (req: AuthRequest, res) => {
  const { page_id, sender_id, sender_name, content } = req.body;
  if (!page_id || !sender_id || !content) {
    return res.status(400).json({ success: false, error: 'Thông tin gửi tin nhắn không hợp lệ' });
  }

  try {
    const page = db.prepare('SELECT id, page_name, page_access_token_encrypted FROM pages WHERE id = ? AND user_id = ?').get(page_id, req.user!.id) as any;
    if (!page) {
      return res.status(403).json({ success: false, error: 'Không tìm thấy trang' });
    }

    const token = decryptData(page.page_access_token_encrypted);
    const fbRes = await FacebookService.sendMessengerReply(token, sender_id, content.trim());

    // Insert outgoing message
    const insertResult = db.prepare(`
      INSERT INTO messages (page_id, fb_message_id, sender_id, sender_name, content, direction, ai_generated, status, requires_human, created_at)
      VALUES (?, ?, ?, ?, ?, 'out', 0, 'sent', 0, CURRENT_TIMESTAMP)
    `).run(
      page_id,
      fbRes.messageId || `mid.manual_${Date.now()}`,
      sender_id,
      sender_name || 'Khách hàng',
      content.trim()
    );

    // Reset requires_human flag on this sender's recent messages
    db.prepare('UPDATE messages SET requires_human = 0, status = "sent" WHERE page_id = ? AND sender_id = ?').run(page_id, sender_id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (page_id, action, details_json)
      VALUES (?, 'reply_message', ?)
    `).run(page_id, JSON.stringify({ sender_id, content: content.slice(0, 50), manual: true }));

    res.json({
      success: true,
      message: {
        id: insertResult.lastInsertRowid,
        content: content.trim(),
        direction: 'out',
        ai_generated: false,
        status: 'sent',
        requires_human: false,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle Human Handoff status
messagesRouter.put('/:id/human-status', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { requires_human } = req.body;

  try {
    db.prepare('UPDATE messages SET requires_human = ?, status = ? WHERE id = ?').run(
      requires_human ? 1 : 0,
      requires_human ? 'requires_human' : 'sent',
      id
    );
    res.json({ success: true, requires_human: Boolean(requires_human) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simulate incoming message to test AI auto-reply
messagesRouter.post('/simulate', authMiddleware, async (req: AuthRequest, res) => {
  const { page_id, sender_name, content, sender_id } = req.body;
  if (!page_id || !content) {
    return res.status(400).json({ success: false, error: 'Thiếu nội dung tin nhắn' });
  }

  try {
    const page = db.prepare('SELECT * FROM pages WHERE id = ? AND user_id = ?').get(page_id, req.user!.id) as any;
    if (!page) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy trang' });
    }

    const sid = sender_id || `sim_user_${Math.floor(100 + Math.random() * 900)}`;
    const sname = sender_name || 'Khách hàng Facebook';
    const fbMsgId = `fb_sim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // 1. Save incoming message
    const inInsert = db.prepare(`
      INSERT INTO messages (page_id, fb_message_id, sender_id, sender_name, content, direction, ai_generated, status, requires_human)
      VALUES (?, ?, ?, ?, ?, 'in', 0, 'pending', 0)
    `).run(page_id, fbMsgId, sid, sname, content.trim());
    const incomingId = inInsert.lastInsertRowid;

    // 2. Fetch active prompt for page
    const activePrompt = db.prepare('SELECT content, ai_provider, ai_model FROM prompts WHERE page_id = ? AND type = "message_reply" AND is_active = 1').get(page_id) as any;

    // 3. Trigger AI Agent if page auto-reply is on
    const user = db.prepare('SELECT ai_provider, ai_base_url, ai_model, ai_api_key_encrypted FROM users WHERE id = ?').get(req.user!.id) as any;
    const userApiKey = user?.ai_api_key_encrypted ? decryptData(user.ai_api_key_encrypted) : undefined;
    
    const chosenProvider = activePrompt?.ai_provider || user?.ai_provider || 'gemini';
    const chosenModel = activePrompt?.ai_model || (chosenProvider === user?.ai_provider ? user?.ai_model : undefined);
    const chosenBaseUrl = (chosenProvider === user?.ai_provider) ? user?.ai_base_url : undefined;
    const aiAgent = new AIAgent(chosenProvider, userApiKey, chosenBaseUrl, chosenModel);

    // Get previous messages context
    const previous = db.prepare(`
      SELECT content, direction FROM messages WHERE page_id = ? AND sender_id = ? ORDER BY created_at ASC LIMIT 6
    `).all(page_id, sid) as any[];

    const context = previous.map(p => ({
      role: (p.direction === 'in' ? 'user' : 'assistant') as 'user' | 'assistant',
      text: p.content,
    }));

    const replyResult = await aiAgent.generateReplyToMessage(
      content.trim(),
      context,
      activePrompt?.content,
      { pageName: page.page_name, customerName: sname }
    );

    // Update incoming message with classification
    db.prepare(`
      UPDATE messages
      SET intent = ?, sentiment = ?, requires_human = ?, status = ?
      WHERE id = ?
    `).run(
      replyResult.intent,
      replyResult.sentiment,
      replyResult.needsHuman ? 1 : 0,
      replyResult.needsHuman ? 'requires_human' : 'sent',
      incomingId
    );

    let outgoingMsg = null;
    if (page.auto_reply_messages && !replyResult.needsHuman && replyResult.reply) {
      // Simulate random response delay
      const outInsert = db.prepare(`
        INSERT INTO messages (page_id, fb_message_id, sender_id, sender_name, content, direction, ai_generated, status, requires_human, intent, sentiment)
        VALUES (?, ?, ?, ?, ?, 'out', 1, 'sent', 0, ?, ?)
      `).run(
        page_id,
        `fb_reply_${Date.now()}`,
        sid,
        page.page_name,
        replyResult.reply,
        replyResult.intent,
        replyResult.sentiment
      );

      outgoingMsg = {
        id: outInsert.lastInsertRowid,
        content: replyResult.reply,
        direction: 'out',
        ai_generated: true,
        status: 'sent',
        requires_human: false,
        created_at: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO activity_logs (page_id, action, details_json)
        VALUES (?, 'reply_message', ?)
      `).run(page_id, JSON.stringify({ sender_name: sname, intent: replyResult.intent, ai: true }));
    }

    res.json({
      success: true,
      incomingMessage: {
        id: incomingId,
        content: content.trim(),
        direction: 'in',
        sender_id: sid,
        sender_name: sname,
        intent: replyResult.intent,
        sentiment: replyResult.sentiment,
        requires_human: replyResult.needsHuman,
      },
      outgoingReply: outgoingMsg,
      needsHuman: replyResult.needsHuman,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
