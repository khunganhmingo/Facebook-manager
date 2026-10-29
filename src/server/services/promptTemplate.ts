export interface PromptVariables {
  page_name?: string;
  customer_name?: string;
  product_list?: string;
  tone?: string;
  company_info?: string;
  last_message?: string;
  topic?: string;
  length?: string;
  post_content?: string;
}

/**
 * Replace template variables formatted as {{variable_name}} with provided values.
 */
export function interpolatePrompt(template: string, vars: PromptVariables): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const val = (vars as Record<string, string | undefined>)[key];
    if (val !== undefined && val !== null) {
      return String(val);
    }
    return match; // keep placeholder if missing
  });
}

export type IntentType = 'price_inquiry' | 'shipping_inquiry' | 'consultation' | 'praise' | 'complaint' | 'spam' | 'other';
export type SentimentType = 'positive' | 'neutral' | 'negative';

export interface ClassificationResult {
  intent: IntentType;
  sentiment: SentimentType;
  needsHuman: boolean;
  confidence: number;
  reason?: string;
}

/**
 * Deterministic intent & sentiment classifier rule engine
 * Used both for fast standalone categorization and as safe fallback for AI agent.
 */
export function analyzeIntentAndSafety(text: string): ClassificationResult {
  const lower = (text || '').toLowerCase().trim();

  // 1. Complaint / Scams / Negative detection -> Triggers Human Handoff immediately
  const complaintKeywords = [
    'khiếu nại', 'báo công an', 'lừa đảo', 'gian lận', 'scam', 'hỏng',
    'bể vỡ', 'hư hỏng', 'tẩy chay', 'thái độ tồi', 'vô trách nhiệm',
    'hoàn tiền ngay', 'trả hàng gấp', 'chờ quá lâu', 'lừa tiền', 'bực mình'
  ];
  if (complaintKeywords.some(kw => lower.includes(kw))) {
    return {
      intent: 'complaint',
      sentiment: 'negative',
      needsHuman: true,
      confidence: 0.95,
      reason: 'Phát hiện từ khóa khiếu nại hoặc phàn nàn bức xúc. Đã chuyển cho nhân viên xử lý.'
    };
  }

  // 2. Spam detection
  const spamKeywords = [
    'vay tiền', 'tài xỉu', 'link sex', 'bắn cá', 'ku casino', 'lô đề', 'mua follow',
    'tăng sub', 'like page giá rẻ', 'việc nhẹ lương cao', 'hoa hồng 20%'
  ];
  if (spamKeywords.some(kw => lower.includes(kw))) {
    return {
      intent: 'spam',
      sentiment: 'neutral',
      needsHuman: false,
      confidence: 0.9,
      reason: 'Phát hiện từ khóa spam/quảng cáo rác.'
    };
  }

  // 3. Price inquiry
  const priceKeywords = ['giá bao nhiêu', 'bao tiền', 'xin giá', 'báo giá', 'inbox giá', 'nhiêu tiền', 'chi phí', 'rổ giá'];
  if (priceKeywords.some(kw => lower.includes(kw))) {
    return {
      intent: 'price_inquiry',
      sentiment: 'neutral',
      needsHuman: false,
      confidence: 0.88,
      reason: 'Khách hàng hỏi giá sản phẩm.'
    };
  }

  // 4. Shipping inquiry
  const shipKeywords = ['ship không', 'phí ship', 'giao hàng', 'vận chuyển', 'mấy ngày tới', 'freeship', 'gửi về', 'nhận hàng'];
  if (shipKeywords.some(kw => lower.includes(kw))) {
    return {
      intent: 'shipping_inquiry',
      sentiment: 'neutral',
      needsHuman: false,
      confidence: 0.85,
      reason: 'Khách hàng hỏi thời gian hoặc chi phí vận chuyển.'
    };
  }

  // 5. Praise / Compliments
  const praiseKeywords = ['tuyệt vời', 'chất lượng', 'ưng ý', 'rất đẹp', 'uy tín', 'ưng lắm', 'đáng tiền', 'cảm ơn shop', 'dễ thương'];
  if (praiseKeywords.some(kw => lower.includes(kw))) {
    return {
      intent: 'praise',
      sentiment: 'positive',
      needsHuman: false,
      confidence: 0.9,
      reason: 'Khách hàng khen ngợi sản phẩm/dịch vụ.'
    };
  }

  // 6. Consultation / General inquiry
  const consultKeywords = ['tư vấn', 'cho em hỏi', 'màu gì', 'kích thước', 'size nào', 'chất liệu', 'dùng thế nào'];
  if (consultKeywords.some(kw => lower.includes(kw))) {
    return {
      intent: 'consultation',
      sentiment: 'neutral',
      needsHuman: false,
      confidence: 0.8,
      reason: 'Khách cần tư vấn thêm chi tiết.'
    };
  }

  return {
    intent: 'other',
    sentiment: 'neutral',
    needsHuman: false,
    confidence: 0.6,
    reason: 'Tin nhắn hội thoại thông thường.'
  };
}

/**
 * Fallback response templates when AI encounters rate limits or errors
 */
export function getFallbackReply(intent: IntentType, pageName: string, customerName?: string): string {
  const name = customerName ? `${customerName} ` : '';
  switch (intent) {
    case 'price_inquiry':
      return `Dạ chào ${name}ạ! Cảm ơn bạn đã quan tâm đến ${pageName}. Shop đã gửi bảng báo giá chi tiết và ưu đãi riêng qua tin nhắn, bạn kiểm tra giúp shop nhé!`;
    case 'shipping_inquiry':
      return `Dạ chào ${name}ơi! ${pageName} hỗ trợ giao hàng toàn quốc và miễn phí vận chuyển cho đơn từ 2 sản phẩm. Bạn ở khu vực nào để shop kiểm tra thời gian giao nhanh nhất nhé!`;
    case 'praise':
      return `Dạ ${pageName} chân thành cảm ơn phản hồi đáng yêu từ ${name}❤️! Sự hài lòng của bạn là động lực lớn nhất của đội ngũ chúng mình.`;
    case 'complaint':
      return `Dạ chào ${name}, ${pageName} rất lấy làm tiếc vì trải nghiệm chưa trọn vẹn này. Quản lý cửa hàng đang trực tiếp kiểm tra và sẽ phản hồi ngay trong ít phút để giải quyết thỏa đáng cho bạn ạ!`;
    case 'consultation':
      return `Dạ chào ${name}! ${pageName} rất sẵn lòng tư vấn chi tiết cho bạn. Bạn có thể cho shop biết thêm nhu cầu cụ thể để shop hỗ trợ tốt nhất nhé!`;
    default:
      return `Dạ chào ${name}ạ! ${pageName} đã nhận được tin nhắn và sẽ hỗ trợ giải đáp mọi thắc mắc của bạn ngay ạ!`;
  }
}
