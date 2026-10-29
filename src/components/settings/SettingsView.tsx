import React, { useState, useEffect, useCallback } from 'react';
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
  Plus,
  Trash2,
  Star,
  Bot,
  X,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { SavedAIConfig } from '../../types';

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
    notes: 'Mặc định dùng API Key nội bộ từ Google AI Studio nếu để trống ô API Key.',
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
    notes: 'Tốc độ phản hồi cực nhanh (~500 tokens/s), phù hợp trả lời tức thì.',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    recommendedModels: ['meta-llama/llama-3.3-70b-instruct', 'google/gemini-2.0-flash-exp:free', 'deepseek/deepseek-chat'],
    docUrl: 'https://openrouter.ai/keys',
    notes: 'Cổng kết nối 200+ mô hình AI toàn cầu qua một API Key duy nhất.',
  },
  custom: {
    id: 'custom',
    name: 'Tùy chỉnh (Local Ollama / vLLM)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    recommendedModels: ['llama3', 'qwen2.5:7b', 'mistral', 'deepseek-r1'],
    docUrl: 'https://ollama.com',
    notes: 'Kết nối bất kỳ máy chủ tương thích OpenAI Chat Completions.',
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

  const [savedConfigs, setSavedConfigs] = useState<SavedAIConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalProvider, setModalProvider] = useState('gemini');
  const [modalBaseUrl, setModalBaseUrl] = useState('');
  const [modalModel, setModalModel] = useState('');
  const [modalApiKey, setModalApiKey] = useState('');
  const [modalIsDefault, setModalIsDefault] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    model: string;
    message?: string;
    error?: string;
  } | null>(null);

  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const loadSavedConfigs = useCallback(async () => {
    setLoadingConfigs(true);
    try {
      const res = await api.getSavedAiConfigs();
      if (res.success && res.configs) {
        setSavedConfigs(res.configs);
      }
    } catch (err: any) {
      console.warn('Load saved configs error:', err.message);
    } finally {
      setLoadingConfigs(false);
    }
  }, []);

  useEffect(() => {
    loadSavedConfigs();
  }, [loadSavedConfigs]);

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

  const handleTestConnection = async (override?: { provider: string; baseUrl?: string; model?: string; apiKey?: string }) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testAiConnection({
        provider: override?.provider || provider,
        baseUrl: (override?.baseUrl || baseUrl).trim() || undefined,
        model: (override?.model || model).trim() || undefined,
        apiKey: (override?.apiKey || apiKey).trim() || undefined,
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
        model: override?.model || model,
        error: err.message,
      });
      toast(`Lỗi: ${err.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSetDefaultConfig = async (id: number) => {
    try {
      const res = await api.setDefaultAiConfig(id);
      if (res.success) {
        toast(res.message, 'success');
        await refreshProfile();
        loadSavedConfigs();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleDeleteConfig = async (id: number, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa cấu hình AI Engine "${name}"?`)) return;
    try {
      const res = await api.deleteAiConfig(id);
      if (res.success) {
        toast(res.message, 'success');
        await refreshProfile();
        loadSavedConfigs();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleOpenAddConfig = () => {
    setModalName('');
    setModalProvider('gemini');
    const p = PROVIDER_PRESETS.gemini;
    setModalBaseUrl(p.defaultBaseUrl);
    setModalModel(p.defaultModel);
    setModalApiKey('');
    setModalIsDefault(false);
    setConfigModalOpen(true);
  };

  const handleSaveModalConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalName.trim() || !modalModel.trim()) {
      toast('Vui lòng nhập tên cấu hình và tên model', 'warning');
      return;
    }
    setModalSubmitting(true);
    try {
      const res = await api.saveAiConfig({
        name: modalName.trim(),
        provider: modalProvider,
        model: modalModel.trim(),
        baseUrl: modalBaseUrl.trim() || undefined,
        apiKey: modalApiKey.trim() || undefined,
        isDefault: modalIsDefault,
      });

      if (res.success) {
        toast(res.message, 'success');
        setConfigModalOpen(false);
        await refreshProfile();
        loadSavedConfigs();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleSaveActiveSettings = async (e: React.FormEvent) => {
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
      loadSavedConfigs();
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

  const maxAgentsQuota = user?.max_agents || 10;
  const isAgentLimitReached = savedConfigs.length >= maxAgentsQuota;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
            Cài đặt hệ thống & Cấu hình AI Agent Engine
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý danh sách AI Engine đã lưu, Base URL tùy ý, API Key mã hóa và mô hình AI cho toàn bộ hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-medium">
            Hạn mức: {savedConfigs.length} / {maxAgentsQuota} Agent
          </span>
        </div>
      </div>

      {/* 1. DANH SÁCH AI AGENT ENGINE ĐÃ LƯU */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-xs font-semibold text-slate-900">
                Danh Sách AI Agent Engine Đã Lưu ({savedConfigs.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Chọn nhanh hoặc thiết lập Engine mặc định để tự động trả lời tin nhắn, bình luận và tạo bài viết
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAddConfig}
            disabled={isAgentLimitReached}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isAgentLimitReached
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-xs'
            }`}
            title={isAgentLimitReached ? `Đã đạt giới hạn ${maxAgentsQuota} Agent` : 'Thêm cấu hình AI mới'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Engine Mới</span>
          </button>
        </div>

        {loadingConfigs ? (
          <div className="p-6 text-center text-xs text-slate-400">
            Đang tải danh sách AI Agent đã lưu...
          </div>
        ) : savedConfigs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
            Chưa có cấu hình nào. Bấm <strong>"+ Thêm Engine Mới"</strong> để tạo cấu hình AI Agent.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedConfigs.map(c => {
              const preset = PROVIDER_PRESETS[c.provider] || PROVIDER_PRESETS.gemini;
              const isDefault = c.is_default;

              return (
                <div
                  key={c.id}
                  className={`p-3.5 rounded-xl border transition-all text-xs space-y-2.5 ${
                    isDefault
                      ? 'border-blue-500 bg-blue-50/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-slate-900 font-semibold text-xs truncate">
                          {c.name}
                        </strong>
                        {isDefault && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[10px] font-bold flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            Mặc định
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {preset.name}
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 font-medium shrink-0">
                      {c.model}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 space-y-0.5 font-mono truncate">
                    <span className="block truncate">
                      Endpoint: {c.base_url || preset.defaultBaseUrl}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {c.has_custom_key ? `Key: ${c.masked_api_key}` : 'Key: Mặc định tài khoản'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                    <div className="flex items-center gap-1">
                      {!isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultConfig(c.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 rounded font-medium transition-colors cursor-pointer"
                        >
                          ⚡ Đặt mặc định
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          handleTestConnection({
                            provider: c.provider,
                            baseUrl: c.base_url || undefined,
                            model: c.model,
                          });
                        }}
                        disabled={testing}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium transition-colors cursor-pointer"
                      >
                        🧪 Test
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteConfig(c.id, c.name)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                      title="Xóa cấu hình"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. CẤU HÌNH AI ENGINE CHI TIẾT */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <div>
              <h3 className="text-xs font-semibold text-slate-900">
                Hiệu Chỉnh Thông Số Động Cơ Đang Kích Hoạt
              </h3>
              <p className="text-[11px] text-slate-500">
                Đang dùng: <strong>{currentPreset.name}</strong> • Model: <code>{model}</code>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục mặc định</span>
          </button>
        </div>

        <form onSubmit={handleSaveActiveSettings} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Chọn Provider AI:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.values(PROVIDER_PRESETS).map(p => {
                const isSelected = provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                      {p.defaultModel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Base URL (API Endpoint):
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800 text-xs focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">Tên Model:</label>
              <span className="text-[10px] text-slate-400">Gợi ý:</span>
            </div>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="gemini-3.8-flash, gpt-4o-mini, deepseek-chat..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800 text-xs focus:ring-1 focus:ring-blue-500"
              required
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {currentPreset.recommendedModels.map(rec => (
                <button
                  key={rec}
                  type="button"
                  onClick={() => setModel(rec)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors cursor-pointer ${
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">API Key Riêng (Tùy chọn):</label>
              {user?.has_custom_key && (
                <span className="text-[10px] text-emerald-600 font-mono">
                  Đang dùng key: {user.masked_api_key}
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
                    ? 'Để trống để tự động dùng API Key AI Studio mặc định'
                    : 'Dán API Key (sk-..., dsk-..., hoặc token riêng)'
                }
                className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800 text-xs focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

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
                  <p className="mt-0.5 text-[11px] leading-relaxed">
                    {testResult.success ? testResult.message : testResult.error}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={() => handleTestConnection()}
              disabled={testing}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-500 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu...' : 'Lưu vào tài khoản'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. WEBHOOK CONFIGURATION BOX */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-semibold text-slate-900">
            Thông số Facebook Webhook (Realtime Messenger & Comment)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Callback URL:
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-700 select-all"
              />
              <button
                onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Verify Token:
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                readOnly
                value={verifyToken}
                className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-700 select-all"
              />
              <button
                onClick={() => copyToClipboard(verifyToken, 'token')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
              >
                {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL THÊM CẤU HÌNH AI ENGINE */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Lưu Cấu Hình AI Agent Mới
                </h3>
              </div>
              <button
                onClick={() => setConfigModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModalConfig} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">
                  Tên Gợi Nhớ (Label):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Tư Vấn Báo Giá DeepSeek V3"
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Provider:</label>
                  <select
                    value={modalProvider}
                    onChange={e => {
                      const newProv = e.target.value;
                      setModalProvider(newProv);
                      const p = PROVIDER_PRESETS[newProv] || PROVIDER_PRESETS.gemini;
                      setModalBaseUrl(p.defaultBaseUrl);
                      setModalModel(p.defaultModel);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  >
                    {Object.values(PROVIDER_PRESETS).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Tên Model:</label>
                  <input
                    type="text"
                    required
                    value={modalModel}
                    onChange={e => setModalModel(e.target.value)}
                    placeholder="gemini-3.5-flash, gpt-4o-mini..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Base URL:</label>
                <input
                  type="text"
                  value={modalBaseUrl}
                  onChange={e => setModalBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">
                  API Key Riêng Cho Engine Này (Tùy chọn):
                </label>
                <input
                  type="password"
                  value={modalApiKey}
                  onChange={e => setModalApiKey(e.target.value)}
                  placeholder="Để trống để dùng key tài khoản"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="modalIsDefault"
                  checked={modalIsDefault}
                  onChange={e => setModalIsDefault(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="modalIsDefault" className="font-medium text-slate-700 cursor-pointer">
                  Đặt cấu hình này làm AI Engine mặc định của hệ thống
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfigModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {modalSubmitting ? 'Đang lưu...' : 'Lưu Cấu Hình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
