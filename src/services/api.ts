const TOKEN_KEY = 'socialagent_jwt_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Lỗi máy chủ (${response.status})`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    request<{ success: boolean; user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  register: (payload: { email: string; password: string; aiProvider?: string; aiApiKey?: string }) =>
    request<{ success: boolean; user: any; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getProfile: () => request<{ success: boolean; user: any }>('/api/auth/me'),

  updateSettings: (payload: { aiProvider: string; aiBaseUrl?: string; aiModel?: string; aiApiKey?: string; timezone: string }) =>
    request<{ success: boolean; message: string }>('/api/auth/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  testAiConnection: (payload: { provider: string; baseUrl?: string; model?: string; apiKey?: string }) =>
    request<{
      success: boolean;
      provider: string;
      model: string;
      baseUrl: string;
      latencyMs: number;
      message?: string;
      error?: string;
    }>('/api/auth/test-ai', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Pages
  getPages: () => request<{ success: boolean; pages: any[] }>('/api/pages'),

  createPage: (payload: { page_id: string; page_name: string; page_access_token: string; avatar_url?: string }) =>
    request<{ success: boolean; page: any }>('/api/pages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updatePage: (id: number, payload: any) =>
    request<{ success: boolean; message: string }>(`/api/pages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deletePage: (id: number) =>
    request<{ success: boolean; message: string }>(`/api/pages/${id}`, {
      method: 'DELETE',
    }),

  checkPageHealth: (id: number) =>
    request<{ success: boolean; health: { valid: boolean; pageName?: string; error?: string } }>(`/api/pages/${id}/health`),

  // Messages (Inbox)
  getConversations: (pageId: number) =>
    request<{ success: boolean; conversations: any[] }>(`/api/messages?page_id=${pageId}`),

  sendReply: (payload: { page_id: number; sender_id: string; sender_name?: string; content: string }) =>
    request<{ success: boolean; message: any }>('/api/messages/reply', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  toggleHumanStatus: (messageId: number, requiresHuman: boolean) =>
    request<{ success: boolean; requires_human: boolean }>(`/api/messages/${messageId}/human-status`, {
      method: 'PUT',
      body: JSON.stringify({ requires_human: requiresHuman }),
    }),

  simulateMessage: (payload: { page_id: number; sender_name?: string; content: string; sender_id?: string }) =>
    request<{ success: boolean; incomingMessage: any; outgoingReply: any; needsHuman: boolean }>('/api/messages/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Comments
  getComments: (pageId: number, status?: string) =>
    request<{ success: boolean; comments: any[] }>(`/api/comments?page_id=${pageId}${status ? `&status=${status}` : ''}`),

  replyComment: (id: number, replyText: string) =>
    request<{ success: boolean; reply: string }>(`/api/comments/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply_text: replyText }),
    }),

  hideComment: (id: number) =>
    request<{ success: boolean; message: string }>(`/api/comments/${id}/hide`, {
      method: 'POST',
    }),

  simulateComment: (payload: { page_id: number; author_name: string; content: string; post_content?: string }) =>
    request<{ success: boolean; comment: any }>('/api/comments/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Posts & Calendar
  getPosts: (pageId?: number, status?: string) =>
    request<{ success: boolean; posts: any[] }>(`/api/posts?${pageId ? `page_id=${pageId}` : ''}${status ? `&status=${status}` : ''}`),

  createPost: (payload: { page_id: number; content: string; image_url?: string; scheduled_at?: string; publish_now?: boolean }) =>
    request<{ success: boolean; post: any; hasConflict?: boolean; conflictWarning?: string }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updatePost: (id: number, payload: any) =>
    request<{ success: boolean; message: string }>(`/api/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deletePost: (id: number) =>
    request<{ success: boolean; message: string }>(`/api/posts/${id}`, {
      method: 'DELETE',
    }),

  publishNow: (id: number) =>
    request<{ success: boolean; postId: string }>(`/api/posts/${id}/publish-now`, {
      method: 'POST',
    }),

  getContentLibrary: () =>
    request<{ success: boolean; items: any[] }>('/api/posts/library'),

  saveToLibrary: (payload: { content: string; topic?: string; tone?: string }) =>
    request<{ success: boolean; id: number }>('/api/posts/library', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Prompts
  getPrompts: (pageId: number) =>
    request<{ success: boolean; prompts: any[] }>(`/api/prompts?page_id=${pageId}`),

  savePrompt: (payload: { page_id: number; type: string; content: string; ai_provider?: string | null; ai_model?: string | null }) =>
    request<{ success: boolean; prompt: any }>('/api/prompts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getPromptHistory: (pageId: number, type: string) =>
    request<{ success: boolean; history: any[] }>(`/api/prompts/history?page_id=${pageId}&type=${type}`),

  rollbackPrompt: (promptId: number) =>
    request<{ success: boolean; message: string; prompt?: any }>('/api/prompts/rollback', {
      method: 'POST',
      body: JSON.stringify({ prompt_id: promptId }),
    }),

  testPrompt: (payload: {
    page_id?: number;
    prompt_content: string;
    sample_input: string;
    prompt_type: string;
    ai_provider?: string | null;
    ai_model?: string | null;
  }) =>
    request<{
      success: boolean;
      result: any;
      engineUsed?: { provider: string; model: string; isSavedDefault?: boolean };
    }>('/api/prompts/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // AI Content Generator
  generatePost: (payload: { topic: string; tone?: string; length?: string; hashtags?: string; cta?: string; page_id?: number }) =>
    request<{ success: boolean; variants: any[]; imagePrompt: string }>('/api/ai/generate-post', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateWeekly: (payload: { pillar: string; page_id?: number; tone?: string }) =>
    request<{ success: boolean; weeklyPosts: any[] }>('/api/ai/generate-weekly', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  summarizeConversation: (messages: Array<{ role: string; text: string }>) =>
    request<{ success: boolean; summary: string }>('/api/ai/summarize', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),

  // Analytics
  getOverview: (pageId?: number) =>
    request<{ success: boolean; metrics: any; intents: any[] }>(`/api/analytics/overview${pageId ? `?page_id=${pageId}` : ''}`),

  getActivityLogs: (pageId?: number) =>
    request<{ success: boolean; logs: any[] }>(`/api/analytics/activity${pageId ? `?page_id=${pageId}` : ''}`),
};
