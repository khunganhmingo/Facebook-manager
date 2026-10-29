import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCode2,
  Sparkles,
  History,
  RotateCcw,
  Save,
  Play,
  Check,
  Bot,
  Layers,
  Cpu,
  Zap,
  Globe,
  Sliders,
  ChevronDown,
  Info,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { PromptItem } from '../../types';

// Supported AI Agent Engines with presets and recommendations
export const ENGINE_PRESETS: Record<
  string,
  {
    id: string;
    name: string;
    badge: string;
    iconColor: string;
    defaultModel: string;
    recommendedModels: string[];
    description: string;
  }
> = {
  gemini: {
    id: 'gemini',
    name: 'Gemini (Google AI)',
    badge: 'Khuyên dùng',
    iconColor: 'text-blue-600 bg-blue-50 border-blue-200',
    defaultModel: 'gemini-3.5-flash',
    recommendedModels: ['gemini-3.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    description: 'Tối ưu tốc độ & tiếng Việt tự nhiên cho Fanpage.',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    badge: 'Phổ biến',
    iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    defaultModel: 'gpt-4o-mini',
    recommendedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    description: 'Mô hình đa năng, phân loại ý định chính xác cao.',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    badge: 'Tiết kiệm chi phí',
    iconColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    defaultModel: 'deepseek-chat',
    recommendedModels: ['deepseek-chat', 'deepseek-reasoner'],
    description: 'V3 / R1 thông minh vượt trội, chi phí cực thấp.',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'Chất lượng cao',
    iconColor: 'text-amber-700 bg-amber-50 border-amber-200',
    defaultModel: 'claude-3-5-sonnet-20241022',
    recommendedModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    description: 'Văn phong tự nhiên, thấu hiểu ngữ cảnh khách hàng sâu sắc.',
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    badge: 'Tốc độ cực nhanh',
    iconColor: 'text-orange-600 bg-orange-50 border-orange-200',
    defaultModel: 'llama-3.3-70b-versatile',
    recommendedModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    description: 'Xử lý tin nhắn tức thì dưới 1 giây (~500 tokens/giây).',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    badge: '200+ mô hình',
    iconColor: 'text-purple-600 bg-purple-50 border-purple-200',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    recommendedModels: [
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
      'google/gemini-2.0-flash-exp:free',
    ],
    description: 'Kết nối mọi mô hình AI thế giới qua một tài khoản duy nhất.',
  },
  custom: {
    id: 'custom',
    name: 'Tùy chỉnh (Local Ollama / vLLM)',
    badge: 'Nội bộ / On-premise',
    iconColor: 'text-slate-700 bg-slate-100 border-slate-300',
    defaultModel: 'llama3',
    recommendedModels: ['llama3', 'qwen2.5:7b', 'mistral', 'deepseek-r1'],
    description: 'Kết nối máy chủ local OpenAI-compatible.',
  },
};

export const PromptManagerView: React.FC = () => {
  const { user, activePage, toast } = useAuth();
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [activeType, setActiveType] = useState<'message_reply' | 'comment_reply' | 'post_generation'>('message_reply');
  const [promptContent, setPromptContent] = useState('');
  const [version, setVersion] = useState(1);
  const [saving, setSaving] = useState(false);

  // Engine & Model selection state
  // mode: 'default' uses account saved settings; 'custom' configures engine/model for this specific prompt
  const [engineMode, setEngineMode] = useState<'default' | 'custom'>('default');
  const [selectedProvider, setSelectedProvider] = useState<string>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('');

  // History state
  const [history, setHistory] = useState<PromptItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Test sandbox state
  const [sampleInput, setSampleInput] = useState('Shop ơi cho mình hỏi giá khung ảnh 15x21 bao nhiêu ạ?');
  const [testResult, setTestResult] = useState<any>(null);
  const [testEngineInfo, setTestEngineInfo] = useState<{ provider: string; model: string; isSavedDefault?: boolean } | null>(null);
  const [testing, setTesting] = useState(false);

  // User's default saved engine and model
  const savedProvider = user?.ai_provider || 'gemini';
  const savedModel = user?.ai_model || 'gemini-3.5-flash';
  const savedPreset = ENGINE_PRESETS[savedProvider] || ENGINE_PRESETS.gemini;

  // Active resolved engine and model for current prompt
  const effectiveProvider = engineMode === 'custom' ? selectedProvider : savedProvider;
  const effectiveModel = engineMode === 'custom' ? (selectedModel || ENGINE_PRESETS[selectedProvider]?.defaultModel || savedModel) : savedModel;
  const effectivePreset = ENGINE_PRESETS[effectiveProvider] || ENGINE_PRESETS.gemini;

  const loadPrompts = useCallback(async () => {
    if (!activePage) return;
    try {
      const res = await api.getPrompts(activePage.id);
      if (res.success && res.prompts) {
        setPrompts(res.prompts);
        const current = res.prompts.find((p: any) => p.type === activeType);
        if (current) {
          setPromptContent(current.content);
          setVersion(current.version);
          if (current.ai_provider) {
            setEngineMode('custom');
            setSelectedProvider(current.ai_provider);
            setSelectedModel(current.ai_model || ENGINE_PRESETS[current.ai_provider]?.defaultModel || '');
          } else {
            setEngineMode('default');
            setSelectedProvider(savedProvider);
            setSelectedModel(current.ai_model || savedModel);
          }
        }
      }
    } catch (err: any) {
      console.warn('Load prompts error:', err.message);
    }
  }, [activePage, activeType, savedProvider, savedModel]);

  const loadHistory = useCallback(async () => {
    if (!activePage) return;
    setLoadingHistory(true);
    try {
      const res = await api.getPromptHistory(activePage.id, activeType);
      if (res.success && res.history) {
        setHistory(res.history);
      }
    } catch (err: any) {
      console.warn('Load history error:', err.message);
    } finally {
      setLoadingHistory(false);
    }
  }, [activePage, activeType]);

  useEffect(() => {
    loadPrompts();
    loadHistory();
  }, [loadPrompts, loadHistory]);

  const handleSelectType = (type: 'message_reply' | 'comment_reply' | 'post_generation') => {
    setActiveType(type);
    const found = prompts.find(p => p.type === type);
    if (found) {
      setPromptContent(found.content);
      setVersion(found.version);
      if (found.ai_provider) {
        setEngineMode('custom');
        setSelectedProvider(found.ai_provider);
        setSelectedModel(found.ai_model || ENGINE_PRESETS[found.ai_provider]?.defaultModel || '');
      } else {
        setEngineMode('default');
        setSelectedProvider(savedProvider);
        setSelectedModel(found.ai_model || savedModel);
      }
    } else {
      setPromptContent('');
      setVersion(1);
      setEngineMode('default');
      setSelectedProvider(savedProvider);
      setSelectedModel(savedModel);
    }

    if (type === 'message_reply') {
      setSampleInput('Shop ơi cho mình hỏi giá khung ảnh 15x21 bao nhiêu ạ?');
    } else if (type === 'comment_reply') {
      setSampleInput('Mẫu khung này đẹp quá, shop có freeship không?');
    } else {
      setSampleInput('Giới thiệu chương trình khuyến mãi mừng khai trương xưởng khung');
    }
    setTestResult(null);
    setTestEngineInfo(null);
  };

  const handleInsertVariable = (variableName: string) => {
    setPromptContent(prev => `${prev} {{${variableName}}}`);
    toast(`Đã chèn biến {{${variableName}}}`, 'info');
  };

  const handleProviderChange = (prov: string) => {
    setSelectedProvider(prov);
    const preset = ENGINE_PRESETS[prov];
    if (prov === savedProvider && savedModel) {
      // If user chooses their saved provider, suggest user's saved model
      setSelectedModel(savedModel);
    } else if (preset) {
      setSelectedModel(preset.defaultModel);
    }
  };

  const handleSelectModel = (modelName: string) => {
    setSelectedModel(modelName);
  };

  const handleUseSavedModel = () => {
    setSelectedModel(savedModel);
    toast(`Đã chọn model đã lưu: ${savedModel}`, 'info');
  };

  const handleSavePrompt = async () => {
    if (!activePage || !promptContent.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        page_id: activePage.id,
        type: activeType,
        content: promptContent.trim(),
        ai_provider: engineMode === 'custom' ? selectedProvider : null,
        ai_model: engineMode === 'custom' ? (selectedModel.trim() || null) : null,
      };

      const res = await api.savePrompt(payload);

      if (res.success) {
        const engineLabel = engineMode === 'custom'
          ? `${ENGINE_PRESETS[selectedProvider]?.name || selectedProvider} (${selectedModel})`
          : `Mặc định (${savedPreset.name} - ${savedModel})`;

        toast(`Đã lưu phiên bản v${res.prompt.version} thành công! [${engineLabel}]`, 'success');
        setVersion(res.prompt.version);
        await loadPrompts();
        await loadHistory();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (promptId: number, targetVersion: number) => {
    try {
      const res = await api.rollbackPrompt(promptId);
      if (res.success) {
        toast(res.message, 'success');
        if (res.prompt) {
          setPromptContent(res.prompt.content);
          setVersion(res.prompt.version);
          if (res.prompt.ai_provider) {
            setEngineMode('custom');
            setSelectedProvider(res.prompt.ai_provider);
            setSelectedModel(res.prompt.ai_model || '');
          } else {
            setEngineMode('default');
            setSelectedProvider(savedProvider);
            setSelectedModel(res.prompt.ai_model || savedModel);
          }
        }
        await loadPrompts();
        await loadHistory();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleRunTest = async () => {
    if (!promptContent.trim() || !sampleInput.trim() || testing) return;
    setTesting(true);
    setTestResult(null);
    setTestEngineInfo(null);
    try {
      const res = await api.testPrompt({
        page_id: activePage?.id,
        prompt_content: promptContent.trim(),
        sample_input: sampleInput.trim(),
        prompt_type: activeType,
        ai_provider: engineMode === 'custom' ? selectedProvider : undefined,
        ai_model: engineMode === 'custom' ? (selectedModel.trim() || undefined) : undefined,
      });

      if (res.success) {
        setTestResult(res.result);
        if (res.engineUsed) {
          setTestEngineInfo(res.engineUsed);
        }
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const templateVariables = [
    { key: 'page_name', label: 'Tên Fanpage' },
    { key: 'customer_name', label: 'Tên khách hàng' },
    { key: 'last_message', label: 'Tin nhắn/bình luận của khách' },
    { key: 'product_list', label: 'Danh mục sản phẩm' },
    { key: 'tone', label: 'Giọng điệu trả lời' },
    { key: 'company_info', label: 'Thông tin liên hệ & địa chỉ' },
    { key: 'post_content', label: 'Nội dung bài viết (cho Comment)' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header & Prompt Type Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
              Cấu hình System Prompt & AI Agent Engine
            </h2>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Active v{version}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tùy biến System Prompt và chỉ định AI Engine hoặc Model đã lưu cho từng loại tác vụ (Tin nhắn, Bình luận, Bài viết)
          </p>
        </div>

        {/* Prompt Category Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
          <button
            onClick={() => handleSelectType('message_reply')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeType === 'message_reply'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trả lời tin nhắn (Messenger)
          </button>
          <button
            onClick={() => handleSelectType('comment_reply')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeType === 'comment_reply'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trả lời bình luận (Comment)
          </button>
          <button
            onClick={() => handleSelectType('post_generation')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeType === 'post_generation'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sáng tạo bài viết (Post)
          </button>
        </div>
      </div>

      {/* Main Grid: Prompt Editor & Engine Picker (Left 7) & Sandbox / History (Right 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Editor & Engine Left Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: AI Agent Engine & Model Selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-semibold text-slate-900">
                  AI Agent Engine & Model cho tác vụ này
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEngineMode('default')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    engineMode === 'default'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  ⚡ Mặc định đã lưu
                </button>
                <button
                  type="button"
                  onClick={() => setEngineMode('custom')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    engineMode === 'custom'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  🛠️ Chỉ định riêng
                </button>
              </div>
            </div>

            {/* Mode: Default from Settings */}
            {engineMode === 'default' ? (
              <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-lg flex items-start gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      Sử dụng cấu hình AI mặc định từ Cài đặt
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full border border-emerald-200">
                      Đã đồng bộ
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Động cơ: <strong className="text-slate-900">{savedPreset.name}</strong> • Model đã lưu:{' '}
                    <code className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-blue-700 font-mono text-[11px]">
                      {savedModel}
                    </code>
                  </p>
                  <p className="text-slate-400 text-[10px]">
                    Muốn chạy tác vụ này bằng một Engine/Model khác (ví dụ Groq cho tốc độ cao hoặc Claude cho văn phong sắc sảo)? Nhấp vào <strong>"Chỉ định riêng"</strong> ở góc phải.
                  </p>
                </div>
              </div>
            ) : (
              /* Mode: Custom Engine & Model Selector */
              <div className="space-y-4 pt-1 border-t border-slate-100">
                {/* 1. Select Engine / Provider */}
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1.5">
                    1. Chọn Động cơ AI (AI Agent Engine):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.values(ENGINE_PRESETS).map(item => {
                      const isSelected = selectedProvider === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleProviderChange(item.id)}
                          className={`p-2.5 rounded-lg border text-left transition-all relative ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500 text-slate-900 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold">{item.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                          </div>
                          <span className="text-[10px] text-slate-500 line-clamp-1 block">
                            {item.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Select / Configure Model */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-slate-700">
                      2. Chọn hoặc nhập Model cho {ENGINE_PRESETS[selectedProvider]?.name || selectedProvider}:
                    </label>

                    {/* Quick button: Use user's saved model */}
                    <button
                      type="button"
                      onClick={handleUseSavedModel}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                      title="Chọn nhanh model đã lưu trong Cài đặt chung"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Chọn model đã lưu: <strong>{savedModel}</strong></span>
                    </button>
                  </div>

                  {/* Preset Model Chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-medium mr-1">Gợi ý:</span>
                    {ENGINE_PRESETS[selectedProvider]?.recommendedModels.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSelectModel(m)}
                        className={`text-[11px] font-mono px-2.5 py-1 rounded-md border transition-all ${
                          selectedModel === m
                            ? 'bg-blue-600 text-white border-blue-600 font-medium shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {m}
                        {m === savedModel && <span className="ml-1 text-[9px] text-amber-300">★</span>}
                      </button>
                    ))}
                  </div>

                  {/* Custom Model Input */}
                  <div className="relative pt-1">
                    <input
                      type="text"
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                      placeholder={`Ví dụ: ${ENGINE_PRESETS[selectedProvider]?.defaultModel || 'gemini-3.5-flash'}`}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900"
                    />
                    {selectedModel === savedModel && (
                      <span className="absolute right-2.5 top-3 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        ✓ Trùng model đã lưu
                      </span>
                    )}
                  </div>
                </div>

                {/* Summary status chip */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-slate-600 text-[11px]">
                      Cấu hình áp dụng: <strong>{ENGINE_PRESETS[selectedProvider]?.name}</strong> • Model:{' '}
                      <code className="font-mono text-blue-600">{selectedModel || 'Mặc định'}</code>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEngineMode('default')}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                  >
                    Quay lại mặc định
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Prompt Editor */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-slate-800">
                  Nội dung System Prompt ({activeType})
                </span>
              </div>
              <button
                onClick={handleSavePrompt}
                disabled={saving || !promptContent.trim()}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Đang lưu...' : 'Lưu phiên bản mới (v' + (version + 1) + ')'}</span>
              </button>
            </div>

            {/* Current Active Engine Badge in Prompt Editor */}
            <div className="px-3 py-1.5 bg-slate-100/80 rounded-lg border border-slate-200/80 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Engine khi chạy:</span>
                <span className="font-semibold text-slate-800">{effectivePreset.name}</span>
                <span className="text-slate-400">•</span>
                <code className="font-mono text-blue-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                  {effectiveModel}
                </code>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                engineMode === 'default'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}>
                {engineMode === 'default' ? 'Dùng Model Đã Lưu' : 'Chỉ Định Riêng'}
              </span>
            </div>

            {/* Template Variables Inserter Bar */}
            <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[11px] font-semibold text-slate-600 block">
                Biến số hệ thống (Click để chèn vào prompt):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {templateVariables.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => handleInsertVariable(v.key)}
                    className="text-[11px] font-mono px-2 py-0.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-700 text-slate-700 rounded transition-colors"
                  >
                    &#123;&#123;{v.key}&#125;&#125;
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <textarea
                rows={12}
                value={promptContent}
                onChange={e => setPromptContent(e.target.value)}
                className="w-full p-4 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed text-slate-900"
                placeholder="Nhập System Prompt tùy biến tại đây..."
              />
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 Lưu ý: Hệ thống tự động kích hoạt bảo vệ khiếu nại (Human Handoff): Nếu khách phàn nàn bức xúc hoặc yêu cầu hoàn tiền, AI Agent sẽ chủ động dừng tự động trả lời để chuyển nhân viên xử lý.
            </p>
          </div>
        </div>

        {/* Right Column: Sandbox Simulator & Version History */}
        <div className="lg:col-span-5 space-y-6">
          {/* Sandbox Test Box */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-semibold text-slate-900">
                  Sandbox thử nghiệm Prompt trực tiếp
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {effectivePreset.name}
              </span>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Câu hỏi / Tình huống mẫu của khách:
              </label>
              <textarea
                rows={2}
                value={sampleInput}
                onChange={e => setSampleInput(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleRunTest}
              disabled={testing || !sampleInput.trim() || !promptContent.trim()}
              className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 text-blue-600" />
              <span>{testing ? 'AI đang xử lý...' : `Chạy thử với ${effectivePreset.name} (${effectiveModel})`}</span>
            </button>

            {/* Test Output */}
            {testResult && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] text-blue-800 font-semibold">
                  <div className="flex items-center gap-1">
                    <span>Kết quả AI phản hồi:</span>
                    {testEngineInfo && (
                      <span className="text-[10px] font-mono font-normal bg-white px-1.5 py-0.2 rounded border border-blue-200 text-blue-900">
                        {testEngineInfo.provider} / {testEngineInfo.model}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px]">Intent: {testResult.intent || 'ok'}</span>
                </div>
                <p className="text-slate-800 leading-relaxed bg-white p-2.5 rounded border border-blue-100">
                  {testResult.reply || 'Chưa nhận được câu trả lời'}
                </p>
                {testResult.needsHuman && (
                  <span className="text-[11px] text-rose-700 font-medium block">
                    ⚠️ Tin nhắn này sẽ chuyển cho nhân viên xử lý thay vì tự trả lời.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Version History & Rollback */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-900">
                  Lịch sử phiên bản (Version History)
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Rollback tức thì</span>
            </div>

            {loadingHistory ? (
              <div className="text-xs text-slate-400 py-3 text-center">Đang tải lịch sử...</div>
            ) : history.length === 0 ? (
              <div className="text-xs text-slate-400 py-3 text-center">Chưa có lịch sử phiên bản nào</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {history.map(item => {
                  const itemProviderName = item.ai_provider
                    ? (ENGINE_PRESETS[item.ai_provider]?.name || item.ai_provider)
                    : 'Mặc định';
                  const itemModel = item.ai_model || 'Model lưu';

                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                        item.is_active
                          ? 'bg-blue-50/60 border-blue-200 text-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">Phiên bản v{item.version}</span>
                          {item.is_active ? (
                            <span className="text-[9px] bg-blue-600 text-white font-medium px-1.5 rounded">
                              Đang dùng
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="font-medium text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {itemProviderName}
                          </span>
                          <span className="font-mono text-slate-500">
                            {itemModel}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-400 font-mono">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : 'Gốc'}
                          </span>
                        </div>
                      </div>

                      {!item.is_active && (
                        <button
                          onClick={() => handleRollback(item.id, item.version)}
                          className="px-2 py-1 text-[11px] font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded transition-colors flex items-center gap-1"
                          title="Khôi phục phiên bản này cùng Engine & Model của nó"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Khôi phục</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
