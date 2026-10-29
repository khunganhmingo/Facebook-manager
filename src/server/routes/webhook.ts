import { Router } from 'express';
import { db } from '../config/db';
import { FacebookService } from '../services/facebook';
import { AIAgent } from '../services/aiAgent';
import { decryptData } from '../services/encryption';

export const webhookRouter = Router();

const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'socialagent_fb_verify_token_2026';
const FB_APP_SECRET = process.env.FB_APP_SECRET || '';

// Webhook Verification (GET)
webhookRouter.get('/facebook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
    console.log('Facebook Webhook Verified successfully');
    return res.status(200).send(challenge);
  }

  res.status(403).send('Forbidden: Invalid verify token');
});

// Incoming Webhook Events (POST)
webhookRouter.post('/facebook', async (req, res) => {
  // Respond immediately with 200 within < 5s as per Facebook Platform Policy
  res.status(200).json({ status: 'EVENT_RECEIVED' });

  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (FB_APP_SECRET && !FacebookService.verifySignature(signature, JSON.stringify(req.body), FB_APP_SECRET)) {
    console.warn('Webhook signature verification failed');
    return;
  }

  const { object, entry } = req.body;
  if (object !== 'page' || !Array.isArray(entry)) return;

  for (const item of entry) {
    const pageFbId = item.id;
    // Find page in database
    const page = db.prepare('SELECT * FROM pages WHERE page_id = ?').get(pageFbId) as any;
    if (!page || !page.is_active) continue;

    // Check active hours
    if (page.active_hours_json) {
      try {
        const activeHours = JSON.parse(page.active_hours_json);
        const now = new Date();
        const currentHour = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (activeHours.from && activeHours.to) {
          if (currentHour < activeHours.from || currentHour > activeHours.to) {
            console.log(`Outside active hours (${activeHours.from} - ${activeHours.to}) for page ${page.page_name}`);
            continue;
          }
        }
      } catch {}
    }

    // 1. Process Messenger Messaging events
    if (Array.isArray(item.messaging)) {
      for (const event of item.messaging) {
        if (event.message && !event.message.is_echo && event.message.text) {
          const senderId = event.sender?.id;
          const msgText = event.message.text;
          const msgId = event.message.mid;

          // Deduplication: avoid re-processing on webhook retries
          const existing = db.prepare('SELECT id FROM messages WHERE fb_message_id = ?').get(msgId);
          if (existing) continue;

          // Save incoming
          const inInsert = db.prepare(`
            INSERT INTO messages (page_id, fb_message_id, sender_id, sender_name, content, direction, ai_generated, status, requires_human)
            VALUES (?, ?, ?, ?, ?, 'in', 0, 'pending', 0)
          `).run(page.id, msgId, senderId, 'Khách hàng FB', msgText);

          const insertedId = inInsert.lastInsertRowid;

          // Process AI auto-reply async
          if (page.auto_reply_messages) {
            processMessageAsync(page, insertedId, senderId, msgText).catch(err => {
              console.error('Async message reply error:', err);
            });
          }
        }
      }
    }

    // 2. Process Feed Changes (Comments)
    if (Array.isArray(item.changes)) {
      for (const change of item.changes) {
        if (change.field === 'feed' && change.value?.item === 'comment' && change.value?.verb === 'add') {
          const val = change.value;
          const commentId = val.comment_id;
          const authorId = val.from?.id;
          const authorName = val.from?.name || 'Khách hàng FB';
          const message = val.message;
          const postId = val.post_id;

          // Ignore comments from the page itself
          if (authorId === page.page_id) continue;

          // Deduplication
          const existing = db.prepare('SELECT id FROM comments WHERE fb_comment_id = ?').get(commentId);
          if (existing) continue;

          if (page.auto_reply_comments) {
            processCommentAsync(page, commentId, authorId, authorName, message, postId).catch(err => {
              console.error('Async comment reply error:', err);
            });
          }
        }
      }
    }
  }
});

async function processMessageAsync(page: any, messageDbId: number | bigint, senderId: string, msgText: string) {
  // Fetch active prompt
  const activePrompt = db.prepare('SELECT content, ai_provider, ai_model FROM prompts WHERE page_id = ? AND type = "message_reply" AND is_active = 1').get(page.id) as any;
  const user = db.prepare('SELECT ai_provider, ai_base_url, ai_model, ai_api_key_encrypted FROM users WHERE id = ?').get(page.user_id) as any;
  const userApiKey = user?.ai_api_key_encrypted ? decryptData(user.ai_api_key_encrypted) : undefined;
  
  const chosenProvider = activePrompt?.ai_provider || user?.ai_provider || 'gemini';
  const chosenModel = activePrompt?.ai_model || (chosenProvider === user?.ai_provider ? user?.ai_model : undefined);
  const chosenBaseUrl = (chosenProvider === user?.ai_provider) ? user?.ai_base_url : undefined;
  const aiAgent = new AIAgent(chosenProvider, userApiKey, chosenBaseUrl, chosenModel);

  const previous = db.prepare(`
    SELECT content, direction FROM messages WHERE page_id = ? AND sender_id = ? ORDER BY created_at ASC LIMIT 6
  `).all(page.id, senderId) as any[];

  const context = previous.map(p => ({
    role: (p.direction === 'in' ? 'user' : 'assistant') as 'user' | 'assistant',
    text: p.content,
  }));

  const replyResult = await aiAgent.generateReplyToMessage(
    msgText,
    context,
    activePrompt?.content,
    { pageName: page.page_name, customerName: 'bạn' }
  );

  // Update classification
  db.prepare(`
    UPDATE messages
    SET intent = ?, sentiment = ?, requires_human = ?, status = ?
    WHERE id = ?
  `).run(
    replyResult.intent,
    replyResult.sentiment,
    replyResult.needsHuman ? 1 : 0,
    replyResult.needsHuman ? 'requires_human' : 'sent',
    messageDbId
  );

  if (!replyResult.needsHuman && replyResult.reply) {
    const token = decryptData(page.page_access_token_encrypted);
    const fbRes = await FacebookService.sendMessengerReply(token, senderId, replyResult.reply);

    db.prepare(`
      INSERT INTO messages (page_id, fb_message_id, sender_id, sender_name, content, direction, ai_generated, status, requires_human, intent, sentiment)
      VALUES (?, ?, ?, ?, ?, 'out', 1, 'sent', 0, ?, ?)
    `).run(
      page.id,
      fbRes.messageId || `mid.out_${Date.now()}`,
      senderId,
      page.page_name,
      replyResult.reply,
      replyResult.intent,
      replyResult.sentiment
    );

    db.prepare(`
      INSERT INTO activity_logs (page_id, action, details_json)
      VALUES (?, 'reply_message', ?)
    `).run(page.id, JSON.stringify({ sender_id: senderId, intent: replyResult.intent, ai: true }));
  }
}

async function processCommentAsync(page: any, commentId: string, authorId: string, authorName: string, message: string, postId: string) {
  const activePrompt = db.prepare('SELECT content, ai_provider, ai_model FROM prompts WHERE page_id = ? AND type = "comment_reply" AND is_active = 1').get(page.id) as any;
  const user = db.prepare('SELECT ai_provider, ai_base_url, ai_model, ai_api_key_encrypted FROM users WHERE id = ?').get(page.user_id) as any;
  const userApiKey = user?.ai_api_key_encrypted ? decryptData(user.ai_api_key_encrypted) : undefined;
  
  const chosenProvider = activePrompt?.ai_provider || user?.ai_provider || 'gemini';
  const chosenModel = activePrompt?.ai_model || (chosenProvider === user?.ai_provider ? user?.ai_model : undefined);
  const chosenBaseUrl = (chosenProvider === user?.ai_provider) ? user?.ai_base_url : undefined;
  const aiAgent = new AIAgent(chosenProvider, userApiKey, chosenBaseUrl, chosenModel);

  const skipKeywords = page.skip_keywords ? JSON.parse(page.skip_keywords) : [];
  const replyResult = await aiAgent.generateReplyToComment(
    message,
    'Bài viết trên Fanpage',
    activePrompt?.content,
    { pageName: page.page_name, authorName, skipKeywords }
  );

  const token = decryptData(page.page_access_token_encrypted);
  let status = 'pending';

  if (replyResult.isSpam || replyResult.shouldHide) {
    await FacebookService.hideComment(token, commentId);
    status = 'hidden';
  } else if (replyResult.reply) {
    await FacebookService.replyComment(token, commentId, replyResult.reply);
    status = 'replied';
  }

  db.prepare(`
    INSERT INTO comments (page_id, post_id, fb_comment_id, author_id, author_name, content, post_content, ai_reply, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    page.id,
    postId,
    commentId,
    authorId,
    authorName,
    message,
    'Bài viết trên Fanpage',
    replyResult.reply || null,
    status
  );
}
