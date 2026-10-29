import { Router } from 'express';
import { db } from '../config/db';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { AIAgent } from '../services/aiAgent';
import { decryptData } from '../services/encryption';

export const aiRouter = Router();

// Generate Post with 3-5 variants
aiRouter.post('/generate-post', authMiddleware, async (req: AuthRequest, res) => {
  const { topic, tone, length, hashtags, cta, page_id } = req.body;
  if (!topic) {
    return res.status(400).json({ success: false, error: 'Chủ đề bài đăng là bắt buộc' });
  }

  try {
    let pageName = 'Fanpage';
    let promptConfig: any = null;
    if (page_id) {
      const page = db.prepare('SELECT page_name FROM pages WHERE id = ?').get(page_id) as any;
      if (page) pageName = page.page_name;
      promptConfig = db.prepare('SELECT ai_provider, ai_model FROM prompts WHERE page_id = ? AND type = "post_generation" AND is_active = 1').get(page_id);
    }

    const user = db.prepare('SELECT ai_provider, ai_base_url, ai_model, ai_api_key_encrypted FROM users WHERE id = ?').get(req.user!.id) as any;
    const userApiKey = user?.ai_api_key_encrypted ? decryptData(user.ai_api_key_encrypted) : undefined;
    
    const chosenProvider = promptConfig?.ai_provider || user?.ai_provider || 'gemini';
    const chosenModel = promptConfig?.ai_model || (chosenProvider === user?.ai_provider ? user?.ai_model : undefined);
    const chosenBaseUrl = (chosenProvider === user?.ai_provider) ? user?.ai_base_url : undefined;
    const aiAgent = new AIAgent(chosenProvider, userApiKey, chosenBaseUrl, chosenModel);

    const result = await aiAgent.generatePostContent(
      topic.trim(),
      tone || 'Chuyên nghiệp, cuốn hút',
      length || 'Vừa phải (150-250 từ)',
      hashtags || '#Facebook #KinhDoanh #Trending',
      cta || 'Nhắn tin ngay để nhận ưu đãi đặc biệt hôm nay!',
      pageName
    );

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk 7-day content generator
aiRouter.post('/generate-weekly', authMiddleware, async (req: AuthRequest, res) => {
  const { pillar, page_id, tone } = req.body;
  if (!pillar) {
    return res.status(400).json({ success: false, error: 'Trụ cột nội dung (content pillar) là bắt buộc' });
  }

  try {
    const user = db.prepare('SELECT ai_provider, ai_base_url, ai_model, ai_api_key_encrypted FROM users WHERE id = ?').get(req.user!.id) as any;
    const userApiKey = user?.ai_api_key_encrypted ? decryptData(user.ai_api_key_encrypted) : undefined;
    const aiAgent = new AIAgent(user?.ai_provider || 'gemini', userApiKey, user?.ai_base_url, user?.ai_model);

    let pageName = 'Fanpage';
    if (page_id) {
      const page = db.prepare('SELECT page_name FROM pages WHERE id = ?').get(page_id) as any;
      if (page) pageName = page.page_name;
    }

    const days = [
      { day: 'Thứ 2', angle: 'Truyền cảm hứng đầu tuần & Khởi động năng lượng mới' },
      { day: 'Thứ 3', angle: 'Mẹo hay / Bí quyết hữu ích cho khách hàng' },
      { day: 'Thứ 4', angle: 'Feedback thực tế & Câu chuyện khách hàng hài lòng' },
      { day: 'Thứ 5', angle: 'Giới thiệu cận cảnh sản phẩm / Dịch vụ nổi bật' },
      { day: 'Thứ 6', angle: 'Mini-game tương tác hoặc câu hỏi thăm dò ý kiến' },
      { day: 'Thứ 7', angle: 'Ưu đãi cuối tuần bùng nổ (Weekend Special Offer)' },
      { day: 'Chủ Nhật', angle: 'Tâm sự cuối tuần, chia sẻ cuộc sống ấm áp' },
    ];

    const weeklyPosts = [];
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + (i + 1));
      scheduledDate.setHours(9, 30, 0, 0);

      const topic = `${pillar} - ${d.angle}`;
      const postResult = await aiAgent.generatePostContent(
        topic,
        tone || 'Thân thiện, hấp dẫn',
        'Vừa phải',
        '#Mingo #Decor #GiaDinh #KhungAnh',
        'Inbox ngay cho page nhé!',
        pageName
      );

      const selectedVariant = postResult.variants[0] || {
        title: d.angle,
        fullPost: `✨ [${d.day}] ${d.angle}\n\nChào ngày mới cùng ${pageName}! Hôm nay chúng mình mang đến gợi ý tuyệt vời cho bạn...`,
      };

      weeklyPosts.push({
        day: d.day,
        date: scheduledDate.toISOString(),
        title: selectedVariant.title,
        content: selectedVariant.fullPost,
        imagePrompt: postResult.imagePrompt,
      });
    }

    res.json({ success: true, weeklyPosts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Summarize conversation
aiRouter.post('/summarize', authMiddleware, async (req: AuthRequest, res) => {
  const { messages } = req.body;
  try {
    const user = db.prepare('SELECT ai_provider, ai_base_url, ai_model, ai_api_key_encrypted FROM users WHERE id = ?').get(req.user!.id) as any;
    const userApiKey = user?.ai_api_key_encrypted ? decryptData(user.ai_api_key_encrypted) : undefined;
    const aiAgent = new AIAgent(user?.ai_provider || 'gemini', userApiKey, user?.ai_base_url, user?.ai_model);

    const summary = await aiAgent.summarizeConversation(messages || []);
    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
