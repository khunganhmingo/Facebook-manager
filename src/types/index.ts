export interface User {
  id: number;
  email: string;
  role?: 'admin' | 'user';
  plan?: 'free' | 'pro' | 'enterprise';
  subscription_expires_at?: string | null;
  max_pages?: number;
  max_agents?: number;
  is_active?: boolean;
  ai_provider: string;
  ai_base_url?: string;
  ai_model?: string;
  has_custom_key?: boolean;
  masked_api_key?: string;
  timezone?: string;
  created_at?: string;
}

export interface SavedAIConfig {
  id: number;
  user_id: number;
  name: string;
  provider: string;
  model: string;
  base_url?: string | null;
  has_custom_key?: boolean;
  masked_api_key?: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AdminUserStats {
  id: number;
  email: string;
  role: 'admin' | 'user';
  plan: 'free' | 'pro' | 'enterprise';
  is_active: boolean;
  subscription_expires_at: string | null;
  max_pages: number;
  max_agents: number;
  pages_count: number;
  agents_count: number;
  messages_count: number;
  comments_count: number;
  posts_count: number;
  days_remaining: number;
  status: 'active' | 'expiring_soon' | 'expired' | 'blocked';
  pages?: Array<{ id: number; page_name: string; page_id: string; is_active: boolean; avatar_url?: string }>;
  created_at: string;
}

export interface AdminOverviewStats {
  total_users: number;
  active_users: number;
  expired_users: number;
  total_pages: number;
  total_agents: number;
  total_messages: number;
  total_comments: number;
  total_posts: number;
  ai_reply_rate: number;
}

export interface FacebookPage {
  id: number;
  page_id: string;
  page_name: string;
  masked_token?: string;
  avatar_url?: string;
  is_active: boolean;
  auto_reply_messages: boolean;
  auto_reply_comments: boolean;
  active_hours?: { from: string; to: string; days: number[] } | null;
  reply_delay_min: number;
  reply_delay_max: number;
  skip_keywords: string[];
  unhandled_count?: number;
  total_messages?: number;
  total_comments?: number;
  created_at?: string;
}

export interface MessageItem {
  id: number;
  content: string;
  direction: 'in' | 'out';
  ai_generated: boolean;
  status: 'pending' | 'sent' | 'failed' | 'requires_human';
  requires_human: boolean;
  intent?: string;
  sentiment?: string;
  created_at: string;
}

export interface Conversation {
  sender_id: string;
  sender_name: string;
  latest_message: string;
  latest_time: string;
  requires_human: boolean;
  unread: boolean;
  messages: MessageItem[];
}

export interface CommentItem {
  id: number;
  page_id: number;
  post_id?: string;
  fb_comment_id?: string;
  author_id: string;
  author_name: string;
  content: string;
  post_content?: string;
  ai_reply?: string | null;
  status: 'pending' | 'replied' | 'skipped' | 'hidden' | 'failed';
  created_at: string;
}

export interface ScheduledPost {
  id: number;
  page_id: number;
  user_id: number;
  content: string;
  image_url?: string | null;
  scheduled_at: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  fb_post_id?: string | null;
  error_message?: string | null;
  retry_count?: number;
  page_name?: string;
  page_avatar?: string;
  created_at?: string;
}

export interface ContentLibraryItem {
  id: number;
  user_id: number;
  content: string;
  topic?: string;
  tone?: string;
  used_count: number;
  created_at: string;
}

export interface PromptItem {
  id: number;
  page_id: number;
  type: 'message_reply' | 'comment_reply' | 'post_generation';
  content: string;
  ai_provider?: string | null;
  ai_model?: string | null;
  version: number;
  is_active: number | boolean;
  created_at?: string;
}

export interface ActivityLog {
  id: number;
  page_id?: number;
  page_name?: string;
  action: string;
  details_json?: string;
  created_at: string;
}

export interface AnalyticsOverview {
  total_messages: number;
  ai_replies_count: number;
  total_comments: number;
  replied_comments: number;
  human_handoffs: number;
  scheduled_posts: number;
  published_posts: number;
  ai_success_rate: number;
}
