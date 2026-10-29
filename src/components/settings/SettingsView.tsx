import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Globe,
  Copy,
  Check,
  Shield,
  Cpu,
  Save,
  Play,
  RotateCcw,
  Zap,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

interface ProviderPreset {
  id: string;
  name: string;
  defaultBaseUrl: string;
  defaultModel: string;
  recommendedModels: string[];
  docUrl: string;
  notes: string;
}

const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-3.5-flash',
    recommendedModels: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'],
    docUrl: 'https://aistudio.google.com/app/apikey',
    notes: 'Mặc định sử dụng API Key nội bộ từ Google AI Studio nếu để trống ô API Key.',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    recommendedModels: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
    docUrl: 'https://platform.openai.com/api-keys',
    notes: 'Hỗ trợ định dạng OpenAI Chat Completions tiêu chuẩn.',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    recommendedModels: ['deepseek-chat', 'deepseek-reasoner'],
    docUrl: 'https://platform.deepseek.com/api_keys',
    notes: 'Mô hình DeepSeek V3 / R1 tốc độ cao, tối ưu chi phí cực tốt.',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    recommendedModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    docUrl: 'https://console.anthropic.com/settings/keys',
    notes: 'Yêu cầu x-api-key và anthropic-version 2023-06-01.',
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    recommendedModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    docUrl: 'https://console.groq.com/keys',
    notes: 'Tốc độ phản hồi cực nhanh (~500 tokens/s), phù hợp trả lời tin nhắn tức thì.',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    recommendedModels: [
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.0-flash-exp:free',
      'deepseek/deepseek-chat',
      'anthropic/claude-3.5-sonnet',
    ],
    docUrl: 'https://openrouter.ai/keys',
    notes: 'Cổng kết nối tổng hợp hơn 200+ mô hình AI toàn cầu qua một API Key duy nhất.',
  },
  custom: {
    id: 'custom',
    name: 'Tùy chỉnh (Local Ollama / vLLM / LM Studio)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    recommendedModels: ['llama3', 'qwen2.5:7b', 'mistral', 'deepseek-r1'],
    docUrl: 'https://ollama.com',
    notes: 'Kết nối bất kỳ máy chủ tương thích chuẩn OpenAI Chat Completions nào.',
  },
};

export const SettingsView: React.FC = () => {
  const { user, refreshProfile, toast } = useAuth();
  const [provider, setProvider] = useState('gemini');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [saving, setSaving] = useState(false);

  // Test Connection State
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    model: string;
    message?: string;
    error?: string;
  } | null>(null);

  // Webhook copy state
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    if (user) {
      const currentProv = user.ai_provider || 'gemini';
      setProvider(currentProv);
      const preset = PROVIDER_PRESETS[currentProv] || PROVIDER_PRESETS.gemini;
      setBaseUrl(user.ai_base_url || preset.defaultBaseUrl);
      setModel(user.ai_model || preset.defaultModel);
      setTimezone(user.timezone || 'Asia/Ho_Chi_Minh');
    }
  }, [user]);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const preset = PROVIDER_PRESETS[newProvider] || PROVIDER_PRESETS.gemini;
    setBaseUrl(preset.defaultBaseUrl);
    setModel(preset.defaultModel);
    setTestResult(null);
  };

  const handleResetDefaults = () => {
    const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.gemini;
    setBaseUrl(preset.defaultBaseUrl);
    setModel(preset.defaultModel);
    toast('Đã khôi phục Base URL và Model mặc định cho ' + preset.name, 'info');
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testAiConnection({
        provider,
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });

      setTestResult(res);
      if (res.success) {
        toast(`Kết nối thành công tới ${res.model} (${res.latencyMs}ms)!`, 'success');
      } else {
        toast(`Lỗi kết nối: ${res.error || 'Thất bại'}`, 'error');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        model,
        error: err.message,
      });
      toast(`Lỗi: ${err.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        aiProvider: provider,
        aiBaseUrl: baseUrl.trim(),
        aiModel: model.trim(),
        aiApiKey: apiKey.trim() || undefined,
        timezone,
      });

      toast('Đã lưu cấu hình AI Engine thành công!', 'success');
      setApiKey('');
      await refreshProfile();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const currentPreset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.gemini;
  const webhookUrl = `${window.location.origin}/api/webhook/facebook`;
  const verifyToken = 'socialagent_fb_verify_token_2026';

  const copyToClipboard = (text: string, type: 'webhook' | 'token') => {
    navigator.clipboard.writeText(text);
    if (type === 'webhook') {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
    toast('Đã sao chép vào bộ nhớ tạm', 'info');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
          Cài đặt hệ thống & Cấu hình AI Agent Engine
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Tùy biến AI Provider, Base URL tùy ý, API Key mã hóa và mô hình (Model) xử lý cho toàn bộ hệ thống
        </p>
      </div>

      {/* AI Provider Config Box */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-xs font-semibold text-slate-900">
                Cấu hình AI Agent Engine đa nền tảng
              </h3>
              <p className="text-[11px] text-slate-500">
                Hỗ trợ Google Gemini, OpenAI, DeepSeek, Claude, Groq, OpenRouter hoặc máy chủ OpenAI-compatible riêng
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
            title="Khôi phục Base URL và Model mặc định của Provider đang chọn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mặc định</span>
          </button>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-5">
          {/* 1. Provider Selector */}
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Chọn Nhà cung cấp AI (AI Provider)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.values(PROVIDER_PRESETS).map(p => {
                const isSelected = provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all text-xs ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="block truncate">{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal block truncate mt-0.5">
                      {p.defaultModel}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              ℹ️ {currentPreset.notes}
            </p>
          </div>

          {/* 2. Base URL */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                Base URL (API Endpoint)
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                Chuẩn: OpenAI-compatible / Gemini REST
              </span>
            </div>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="Ví dụ: https://api.openai.com/v1 hoặc http://localhost:11434/v1"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800"
              required
            />
          </div>

          {/* 3. Model Name & Quick Chips */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                Tên Model (Model Identifier)
              </label>
              <span className="text-[10px] text-slate-400">
                Gợi ý nhanh theo provider:
              </span>
            </div>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="Ví dụ: gemini-3.8-flash, gpt-4o-mini, deepseek-chat, v.v."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800"
              required
            />

            {/* Recommended Model Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {currentPreset.recommendedModels.map(rec => (
                <button
                  key={rec}
                  type="button"
                  onClick={() => setModel(rec)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded transition-colors ${
                    model === rec
                      ? 'bg-blue-600 text-white font-medium'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {rec}
                </button>
              ))}
            </div>
          </div>

          {/* 4. API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                API Key ({currentPreset.name})
              </label>
              {user?.has_custom_key && (
                <span className="text-[11px] text-emerald-600 font-mono">
                  Đang dùng key đã lưu: {user.masked_api_key}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={
                  provider === 'gemini'
                    ? 'Để trống để tự động dùng Gemini API Key từ AI Studio'
                    : 'Dán API Key của bạn (sk-..., dsk-..., hoặc token riêng)'
                }
                className="w-full pl-3 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title={showApiKey ? 'Ẩn' : 'Hiện'}
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              🔒 Bảo mật: Key được mã hóa AES-256-GCM trước khi ghi vào SQLite database.
            </p>
          </div>

          {/* 5. Test Connection Feedback Result */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {testResult.success ? 'Kết nối thành công!' : 'Kết nối thất bại'}
                    </span>
                    <span className="font-mono text-[10px] opacity-75">
                      ⚡ Độ trễ: {testResult.latencyMs}ms · Model: {testResult.model}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed">
                    {testResult.success ? testResult.message : testResult.error}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="text-slate-400 hover:text-slate-700 text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Action Bar */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Kiểm tra thông số trước khi lưu vào hệ thống
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 text-amber-500 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Đang lưu...' : 'Lưu cấu hình AI'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Webhook Configuration Box */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5">
          <Globe className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-xs font-semibold text-slate-900">
              Thông số cấu hình Facebook Webhook
            </h3>
            <p className="text-[11px] text-slate-500">
              Điền 2 thông số sau vào trang Meta for Developers &gt; Webhooks &gt; Page
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Callback URL (Endpoint nhận sự kiện Webhook)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-700 select-all"
              />
              <button
                onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors flex items-center gap-1 shrink-0"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWebhook ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Verify Token (Mã xác minh)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={verifyToken}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-700 select-all"
              />
              <button
                onClick={() => copyToClipboard(verifyToken, 'token')}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors flex items-center gap-1 shrink-0"
              >
                {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedToken ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Setup guide checklist */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-800 block">Các bước tích hợp với Facebook App:</span>
          <ol className="list-decimal pl-4 space-y-1 text-slate-600">
            <li>Vào cổng <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-blue-600 underline">developers.facebook.com</a> chọn Ứng dụng của bạn.</li>
            <li>Tại mục <strong>Webhooks</strong>, chọn đối tượng là <strong>Page</strong> và nhấn <em>Subscribe to this object</em>.</li>
            <li>Dán <strong>Callback URL</strong> và <strong>Verify Token</strong> ở trên vào form xác minh của Facebook.</li>
            <li>Đăng ký (Subscribe) các quyền sự kiện: <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">messages</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">messaging_postbacks</code>, và <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">feed</code>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
