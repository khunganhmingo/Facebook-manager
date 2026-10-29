import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  interpolatePrompt,
  analyzeIntentAndSafety,
  getFallbackReply,
  type IntentType,
  type SentimentType,
  type ClassificationResult,
} from './promptTemplate';

export interface PostVariant {
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  fullPost: string;
  imagePrompt: string;
}

export interface MessageReplyResult {
  reply: string;
  intent: IntentType;
  sentiment: SentimentType;
  needsHuman: boolean;
  reason?: string;
  tokensUsed?: number;
}

export interface CommentReplyResult {
  reply: string;
  intent: IntentType;
  sentiment: SentimentType;
  shouldHide: boolean;
  isSpam: boolean;
  reason?: string;
}

export interface TestConnectionResult {
  success: boolean;
  provider: string;
  model: string;
  baseUrl: string;
  latencyMs: number;
  message?: string;
  error?: string;
}

export class AIAgent {
  public provider: string;
  public apiKey?: string;
  public baseUrl: string;
  public model: string;
  private genAI?: GoogleGenAI;

  constructor(
    provider: string = 'gemini',
    apiKey?: string,
    baseUrl?: string,
    model?: string
  ) {
    this.provider = provider.toLowerCase();

    // Default Base URLs & Models per provider
    const defaults: Record<string, { baseUrl: string; model: string }> = {
      gemini: { baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-3.5-flash' },
      openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
      anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
      groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
      openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct' },
      custom: { baseUrl: 'http://localhost:11434/v1', model: 'llama3' },
    };

    const provDefaults = defaults[this.provider] || defaults.gemini;
    this.baseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : provDefaults.baseUrl;
    this.model = model || provDefaults.model;

    // API Key resolution
    if (apiKey && apiKey !== 'demo_api_key' && apiKey.length > 5 && !apiKey.includes('••••')) {
      this.apiKey = apiKey;
    } else if (this.provider === 'gemini') {
      this.apiKey = process.env.GEMINI_API_KEY;
    }

    if (this.provider === 'gemini' && this.apiKey && this.apiKey !== 'demo_api_key' && this.apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        this.genAI = new GoogleGenAI({
          apiKey: this.apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      } catch (err) {
        console.error('Failed to init GoogleGenAI:', err);
      }
    }
  }

  /**
   * Universal internal caller across Gemini, OpenAI-compatible, and Anthropic
   */
  private async executeLLM(options: {
    prompt: string;
    systemPrompt?: string;
    jsonMode?: boolean;
    timeoutMs?: number;
  }): Promise<string> {
    const timeout = options.timeoutMs || 12000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI Request timeout')), timeout)
    );

    // 1. Gemini Native Provider
    if (this.provider === 'gemini' && this.genAI) {
      const callPromise = this.genAI.models.generateContent({
        model: this.model || 'gemini-3.5-flash',
        contents: options.prompt,
        config: {
          systemInstruction: options.systemPrompt,
          responseMimeType: options.jsonMode ? 'application/json' : undefined,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const res = await Promise.race([callPromise, timeoutPromise]);
      return (res.text || '').trim();
    }

    // 2. Anthropic Claude Provider
    if (this.provider === 'anthropic') {
      if (!this.apiKey) throw new Error('Chưa cấu hình API Key cho Anthropic');
      const endpoint = `${this.baseUrl}/messages`;
      const body: any = {
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: options.prompt }],
      };
      if (options.systemPrompt) {
        body.system = options.systemPrompt;
      }

      const resPromise = fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }).then(async r => {
        const data = await r.json() as any;
        if (!r.ok || data.error) {
          throw new Error(data.error?.message || `Anthropic HTTP ${r.status}`);
        }
        return data.content?.[0]?.text || '';
      });

      return await Promise.race([resPromise, timeoutPromise]);
    }

    // 3. OpenAI-Compatible Providers (OpenAI, DeepSeek, Groq, OpenRouter, Custom / Ollama)
    if (this.provider !== 'gemini' || !this.genAI) {
      if (!this.apiKey && this.provider !== 'custom') {
        throw new Error(`Chưa cấu hình API Key cho ${this.provider}`);
      }

      const cleanBase = this.baseUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '');
      const endpoint = `${cleanBase}/chat/completions`;

      const messages: any[] = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: options.prompt });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const body: any = {
        model: this.model,
        messages,
        temperature: 0.7,
      };

      if (options.jsonMode && this.provider !== 'anthropic') {
        body.response_format = { type: 'json_object' };
      }

      const resPromise = fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }).then(async r => {
        const data = await r.json() as any;
        if (!r.ok || data.error) {
          throw new Error(data.error?.message || `AI API HTTP ${r.status}`);
        }
        return data.choices?.[0]?.message?.content || '';
      });

      return await Promise.race([resPromise, timeoutPromise]);
    }

    throw new Error('Chưa cấu hình hoặc kết nối AI Provider hợp lệ');
  }

  /**
   * Test Connection to configured AI Provider
   */
  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now();
    try {
      const response = await this.executeLLM({
        prompt: 'Xin chào! Hãy phản hồi ngắn gọn đúng 1 câu tiếng Việt: "Kết nối AI Engine thành công!"',
        timeoutMs: 14000,
      });

      return {
        success: true,
        provider: this.provider,
        model: this.model,
        baseUrl: this.baseUrl,
        latencyMs: Date.now() - startTime,
        message: response.slice(0, 150),
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.provider,
        model: this.model,
        baseUrl: this.baseUrl,
        latencyMs: Date.now() - startTime,
        error: err.message || 'Không thể kết nối tới AI Provider với thông số hiện tại.',
      };
    }
  }

  /**
   * Classify user message into intent & sentiment
   */
  async classifyIntent(message: string): Promise<ClassificationResult> {
    // Fast heuristic rule check first
    const ruleResult = analyzeIntentAndSafety(message);
    if (ruleResult.needsHuman || ruleResult.intent === 'spam') {
      return ruleResult;
    }

    try {
      const prompt = `Phân loại tin nhắn sau đây của khách hàng gửi tới Fanpage:
"${message}"

Trả về ĐÚNG định dạng JSON sau:
{
  "intent": "price_inquiry" | "shipping_inquiry" | "consultation" | "praise" | "complaint" | "spam" | "other",
  "sentiment": "positive" | "neutral" | "negative",
  "needsHuman": boolean,
  "confidence": number,
  "reason": "Giải thích ngắn gọn lý do phân loại"
}
Quy tắc: nếu khách tức giận, đe dọa, đòi hoàn tiền, kiện cáo hoặc chửi bới thì BẮT BUỘC "needsHuman": true và "sentiment": "negative".`;

      const responseText = await this.executeLLM({
        prompt,
        jsonMode: true,
        timeoutMs: 6000,
      });

      const parsed = JSON.parse(responseText || '{}');
      return {
        intent: parsed.intent || ruleResult.intent,
        sentiment: parsed.sentiment || ruleResult.sentiment,
        needsHuman: Boolean(parsed.needsHuman ?? ruleResult.needsHuman),
        confidence: parsed.confidence || 0.9,
        reason: parsed.reason || ruleResult.reason,
      };
    } catch {
      return ruleResult;
    }
  }

  /**
   * Generate intelligent contextual reply to a Messenger chat
   */
  async generateReplyToMessage(
    userMessage: string,
    context: Array<{ role: 'user' | 'assistant'; text: string }> = [],
    customPromptTemplate?: string,
    pageInfo: { pageName: string; customerName?: string; productList?: string; tone?: string } = { pageName: 'Fanpage' }
  ): Promise<MessageReplyResult> {
    const classification = await this.classifyIntent(userMessage);

    if (classification.needsHuman) {
      return {
        reply: '',
        intent: classification.intent,
        sentiment: classification.sentiment,
        needsHuman: true,
        reason: classification.reason || 'Cần nhân viên trực tiếp hỗ trợ giải quyết thắc mắc/khiếu nại này.'
      };
    }

    const defaultTemplate = `Bạn là trợ lý AI thông minh, nhiệt tình của Fanpage "{{page_name}}".
Khách hàng "{{customer_name}}" đang nhắn: "{{last_message}}".
Danh mục sản phẩm/dịch vụ: {{product_list}}.
Giọng điệu (tone): {{tone}}.

Yêu cầu phản hồi:
- Trả lời đúng trọng tâm câu hỏi của khách hàng, ngắn gọn, súc tích (khoảng 2-4 câu).
- Tự nhiên, thân thiện, dùng 1-2 emoji phù hợp.
- Nếu khách hỏi giá/sản phẩm, gợi ý hỗ trợ thông tin nhanh hoặc xin kích thước/nhu cầu.
- Không bịa đặt chính sách chưa có.`;

    const rawTemplate = customPromptTemplate || defaultTemplate;
    const systemPrompt = interpolatePrompt(rawTemplate, {
      page_name: pageInfo.pageName,
      customer_name: pageInfo.customerName || 'bạn',
      last_message: userMessage,
      product_list: pageInfo.productList || 'Sản phẩm decor & quà tặng ý nghĩa',
      tone: pageInfo.tone || 'Thân thiện, chu đáo, nhiệt tình',
    });

    try {
      const conversationHistory = context.slice(-6).map(c => `${c.role === 'user' ? 'Khách hàng' : 'Fanpage'}: ${c.text}`).join('\n');
      const prompt = `Lịch sử trò chuyện gần nhất:
${conversationHistory || '(Bắt đầu trò chuyện mới)'}

Tin nhắn mới nhất từ khách hàng:
"${userMessage}"

Viết câu trả lời trực tiếp của Fanpage (chỉ xuất nội dung câu trả lời, không thêm nhãn prefix):`;

      const reply = await this.executeLLM({
        prompt,
        systemPrompt,
        timeoutMs: 7000,
      });

      return {
        reply: reply || getFallbackReply(classification.intent, pageInfo.pageName, pageInfo.customerName),
        intent: classification.intent,
        sentiment: classification.sentiment,
        needsHuman: false,
        tokensUsed: 150,
      };
    } catch {
      return {
        reply: getFallbackReply(classification.intent, pageInfo.pageName, pageInfo.customerName),
        intent: classification.intent,
        sentiment: classification.sentiment,
        needsHuman: false,
        reason: 'Fallback tự động do sự cố kết nối AI.'
      };
    }
  }

  /**
   * Generate reply to a Facebook Post Comment
   */
  async generateReplyToComment(
    commentText: string,
    postContext: string,
    customPromptTemplate?: string,
    pageInfo: { pageName: string; authorName?: string; skipKeywords?: string[] } = { pageName: 'Fanpage' }
  ): Promise<CommentReplyResult> {
    const classification = await this.classifyIntent(commentText);

    const skipWords = pageInfo.skipKeywords || ['lừa đảo', 'scam', 'vay vốn', 'tài xỉu', 'bắn cá'];
    const isSpam = classification.intent === 'spam' || skipWords.some(kw => commentText.toLowerCase().includes(kw));

    if (isSpam) {
      return {
        reply: '',
        intent: 'spam',
        sentiment: 'negative',
        shouldHide: true,
        isSpam: true,
        reason: 'Bình luận chứa nội dung spam hoặc từ khóa nhạy cảm. Đã tự động ẩn.'
      };
    }

    const defaultTemplate = `Bạn là chăm sóc khách hàng của page "{{page_name}}".
Bài viết đang được bình luận: "{{post_content}}".
Bình luận của khách: "{{last_message}}".

Hãy phản hồi bình luận này:
- Lịch sự, vui tươi, tối đa 2 câu.
- Mời khách nhắn tin inbox hoặc cho biết shop đã nhắn tin inbox cho khách.
- Kèm 1 emoji thân thiện.`;

    const rawTemplate = customPromptTemplate || defaultTemplate;
    const systemPrompt = interpolatePrompt(rawTemplate, {
      page_name: pageInfo.pageName,
      customer_name: pageInfo.authorName || 'bạn',
      last_message: commentText,
      post_content: postContext,
    });

    try {
      const reply = await this.executeLLM({
        prompt: 'Viết câu trả lời bình luận (chỉ xuất nội dung câu trả lời):',
        systemPrompt,
        timeoutMs: 6000,
      });

      return {
        reply: reply || `Dạ chào bạn! ${pageInfo.pageName} đã nhắn tin inbox chi tiết cho bạn rồi ạ, bạn xem giúp shop nha! ❤️`,
        intent: classification.intent,
        sentiment: classification.sentiment,
        shouldHide: false,
        isSpam: false
      };
    } catch {
      return {
        reply: `Dạ chào bạn! ${pageInfo.pageName} đã nhắn tin inbox chi tiết cho bạn rồi ạ, bạn xem giúp shop nha! ❤️`,
        intent: classification.intent,
        sentiment: classification.sentiment,
        shouldHide: false,
        isSpam: false
      };
    }
  }

  /**
   * Generate Post Content Variants with live Facebook preview format
   */
  async generatePostContent(
    topic: string,
    tone: string = 'Hấp dẫn, chuyên nghiệp',
    length: string = 'Vừa phải',
    hashtags: string | string[] = '#KhungAnh #Decor #Mingo',
    cta: string = 'Nhắn tin ngay hôm nay!',
    pageName: string = 'Khung Ảnh Mingo'
  ): Promise<{ variants: PostVariant[]; imagePrompt: string }> {
    const hashtagsStr = Array.isArray(hashtags)
      ? hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ')
      : String(hashtags || '#Decor #Facebook');
    const hashtagsArray = Array.isArray(hashtags)
      ? hashtags.map(h => (h.startsWith('#') ? h : `#${h}`))
      : hashtagsStr.split(/\s+/).filter(Boolean).map(h => (h.startsWith('#') ? h : `#${h}`));

    const prompt = `Bạn là Social Media Manager xuất sắc cho Fanpage "${pageName}".
Hãy sáng tạo 3 phiên bản bài đăng Facebook (Variants) độc đáo về chủ đề: "${topic}".
Giọng điệu (Tone): ${tone}.
Độ dài bài viết: ${length}.
Lời kêu gọi hành động (CTA): ${cta}.
Hashtags mong muốn: ${hashtagsStr}.

Yêu cầu cho mỗi phiên bản:
1. Hook mở đầu gây ấn tượng mạnh mẽ, giữ chân người đọc lướt newfeed.
2. Thân bài chia đoạn ngắn, dễ đọc trên mobile, bố cục thẩm mỹ với các icon thích hợp.
3. Lời kêu gọi hành động (CTA) khéo léo, kích thích tương tác/inbox.
4. Gợi ý 1 câu prompt chi tiết để tạo hình ảnh minh họa phù hợp với bài viết.

Trả về ĐÚNG định dạng JSON sau:
{
  "imagePrompt": "Prompt tiếng Anh chi tiết để tạo ảnh minh họa 16:9 hoặc 4:3 đẹp mắt bằng AI",
  "variants": [
    {
      "title": "Tiêu đề ngắn phong cách 1 (Ví dụ: Trực diện & Đánh trúng nhu cầu)",
      "hook": "Câu mở đầu giật gân/hấp dẫn",
      "body": "Nội dung chính của bài viết...",
      "cta": "Lời kêu gọi hành động...",
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "fullPost": "Toàn bộ bài viết hoàn chỉnh sẵn sàng copy để đăng lên Facebook..."
    },
    {
      "title": "Tiêu đề ngắn phong cách 2 (Ví dụ: Kể chuyện cảm xúc / Storytelling)",
      "hook": "...",
      "body": "...",
      "cta": "...",
      "hashtags": ["#tag1", "#tag2"],
      "fullPost": "..."
    },
    {
      "title": "Tiêu đề ngắn phong cách 3 (Ví dụ: Hài hước / Bắt trend / Ưu đãi khẩn cấp)",
      "hook": "...",
      "body": "...",
      "cta": "...",
      "hashtags": ["#tag1", "#tag2"],
      "fullPost": "..."
    }
  ]
}`;

    const fallbackPost = `🌿 ${topic.toUpperCase()} - BẠN ĐÃ THỬ CHƯA?

Một không gian đẹp bắt đầu từ những góc nhỏ kỷ niệm yêu thương. ${pageName} mang đến giải pháp decor tinh tế và ấm áp cho ngôi nhà của bạn.

✨ Điểm nổi bật:
- Chất lượng tinh xảo, độ bền vượt trội
- Thiết kế tối giản, phù hợp mọi phong cách nội thất
- Tặng kèm phụ kiện treo lắp dễ dàng không cần khoan đục

👉 ${cta}

${hashtagsStr}`;

    const fallbackResult = {
      imagePrompt: `Cozy minimalist room interior showcasing framed photo gallery on warm textured wall, natural daylight, soft aesthetic, 8k commercial photography`,
      variants: [
        {
          title: 'Trực diện & Thuyết phục',
          hook: `🌿 ${topic.toUpperCase()} - GIẢI PHÁP TỐI ƯU CHO BẠN!`,
          body: `Một không gian sống ấm cúng không thể thiếu những góc nhỏ kỷ niệm yêu thương. ${pageName} mang đến bộ sưu tập mới nhất với ưu đãi đặc biệt hôm nay.`,
          cta: cta,
          hashtags: hashtagsArray,
          fullPost: fallbackPost,
          imagePrompt: `Cozy room interior with beautiful minimalist frames on wall`,
        },
        {
          title: 'Kể chuyện cảm xúc (Storytelling)',
          hook: `Có những khoảnh khắc trôi qua rồi ta mới nhận ra: Kỷ niệm quý giá biết bao...`,
          body: `Đừng để những tấm ảnh đẹp chỉ nằm lại trong album điện thoại. Hãy in ra và lồng vào những chiếc khung xinh xắn để mỗi ngày về nhà đều thấy nụ cười của người thân yêu.`,
          cta: `Nhắn tin cho ${pageName} để in ảnh và lên khung ngay hôm nay nhé!`,
          hashtags: ['#LuuGiuKyNiem', '#GiaDinh', '#DecorAmAp'],
          fullPost: `Có những khoảnh khắc trôi qua rồi ta mới nhận ra: Kỷ niệm quý giá biết bao...\n\nĐừng để những tấm ảnh đẹp chỉ nằm lại trong album điện thoại. Hãy in ra và lồng vào những chiếc khung xinh xắn để mỗi ngày về nhà đều thấy nụ cười của người thân yêu.\n\n👉 Nhắn tin cho ${pageName} để in ảnh và lên khung ngay hôm nay nhé!\n\n#LuuGiuKyNiem #GiaDinh #DecorAmAp`,
          imagePrompt: `Emotional family photo frame on nightstand, soft warm lighting`,
        },
        {
          title: 'Ưu đãi & Kêu gọi khẩn cấp (FOMO)',
          hook: `⚡ DUY NHẤT 48H: SẮM NGAY KẺO LỠ!`,
          body: `Cơ hội sở hữu trọn bộ sản phẩm chất lượng cao với mức giá ưu đãi nhất mùa hè. Số lượng quà tặng có hạn chỉ dành cho 30 khách hàng nhắn tin sớm nhất!`,
          cta: `Inbox ngay để nhận mã giảm 20% + Freeship toàn quốc!`,
          hashtags: ['#DealHot', '#UuDaiFacebook', '#FlashSale'],
          fullPost: `⚡ DUY NHẤT 48H: SẮM NGAY KẺO LỠ!\n\nCơ hội sở hữu trọn bộ sản phẩm chất lượng cao với mức giá ưu đãi nhất mùa hè. Số lượng quà tặng có hạn chỉ dành cho 30 khách hàng nhắn tin sớm nhất!\n\n👉 Inbox ngay để nhận mã giảm 20% + Freeship toàn quốc!\n\n#DealHot #UuDaiFacebook #FlashSale`,
          imagePrompt: `Modern product showcase with gift ribbon and special offer badge`,
        },
      ],
    };

    try {
      const responseText = await this.executeLLM({
        prompt,
        jsonMode: true,
        timeoutMs: 7000,
      });

      const parsed = JSON.parse(responseText || '{}');
      if (Array.isArray(parsed.variants) && parsed.variants.length > 0) {
        return {
          variants: parsed.variants,
          imagePrompt: parsed.imagePrompt || `Modern photo showcase for ${topic}`,
        };
      }
      return fallbackResult;
    } catch (err) {
      console.warn('AI Post Generation fallback:', err);
      return fallbackResult;
    }
  }

  /**
   * Summarize a conversation for quick staff handoff
   */
  async summarizeConversation(messages: Array<{ role: string; text: string }>): Promise<string> {
    if (!messages.length) return 'Chưa có tin nhắn nào trong hội thoại.';

    try {
      const conversation = messages.map(m => `${m.role}: ${m.text}`).join('\n');
      const response = await this.executeLLM({
        prompt: `Tóm tắt ngắn gọn trong 2 câu nhu cầu chính của khách hàng và trạng thái hiện tại:\n${conversation}`,
        timeoutMs: 6000,
      });
      return response || `Hội thoại gồm ${messages.length} tin nhắn.`;
    } catch {
      return `Hội thoại gồm ${messages.length} tin nhắn. Tin cuối: "${messages[messages.length - 1].text.slice(0, 50)}..."`;
    }
  }
}
