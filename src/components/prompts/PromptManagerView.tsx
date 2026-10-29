import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileCode2,
  Sparkles,
  History,
  RotateCcw,
  Save,
  Play,
  Check,
  Bot,
  Cpu,
  Zap,
  ChevronDown,
  Clock,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  MessageCircle,
  FileText,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { PromptItem, SavedAIConfig } from '../../types';

export const PromptManagerView: React.FC = () => {
  const { user, activePage, toast } = useAuth();
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [activeType, setActiveType] = useState<'message_reply' | 'comment_reply' | 'post_generation'>('message_reply');
  const [promptContent, setPromptContent] = useState('');
  const [version, setVersion] = useState(1);
  const [saving, setSaving] = useState(false);

  // Saved AI Configurations for quick 1-click selection
  const [savedConfigs, setSavedConfigs] = useState<SavedAIConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('default');

  // History state
  const [history, setHistory] = useState<PromptItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Test sandbox state
  const [sampleInput, setSampleInput] = useState('Shop ơi cho mình hỏi giá khung ảnh 15x21 bao nhiêu ạ?');
  const [testResult, setTestResult] = useState<any>(null);
  const [testEngineInfo, setTestEngineInfo] = useState<{ provider: string; model: string; isSavedDefault?: boolean } | null>(null);
  const [testing, setTesting] = useState(false);

  // Load saved AI configurations list
  const loadSavedConfigs = useCallback(async () => {
    try {
      const res = await api.getSavedAiConfigs();
      if (res.success && res.configs) {
        setSavedConfigs(res.configs);
      }
    } catch (err: any) {
      console.warn('Load saved configs error:', err.message);
    }
  }, []);

  // Selected config details
  const activeSelectedConfig = useMemo(() => {
    if (selectedConfigId === 'default') {
      const def = savedConfigs.find(c => c.is_default);
      if (def) return def;
      return {
        id: 0,
        user_id: user?.id || 0,
        name: `Mặc định (${user?.ai_provider || 'gemini'} - ${user?.ai_model || 'gemini-3.5-flash'})`,
        provider: user?.ai_provider || 'gemini',
        model: user?.ai_model || 'gemini-3.5-flash',
        is_default: true,
      } as SavedAIConfig;
    }
    return savedConfigs.find(c => String(c.id) === String(selectedConfigId)) || null;
  }, [selectedConfigId, savedConfigs, user]);

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
          if (current.ai_provider && current.ai_model) {
            // Check if matching saved config
            const match = savedConfigs.find(
              c => c.provider === current.ai_provider && c.model === current.ai_model
            );
            if (match) {
              setSelectedConfigId(String(match.id));
            } else {
              setSelectedConfigId('default');
            }
          } else {
            setSelectedConfigId('default');
          }
        }
      }
    } catch (err: any) {
      console.warn('Load prompts error:', err.message);
    }
  }, [activePage, activeType, savedConfigs]);

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
    loadSavedConfigs();
  }, [loadSavedConfigs]);

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
      if (found.ai_provider && found.ai_model) {
        const match = savedConfigs.find(
          c => c.provider === found.ai_provider && c.model === found.ai_model
        );
        setSelectedConfigId(match ? String(match.id) : 'default');
      } else {
        setSelectedConfigId('default');
      }
    } else {
      setPromptContent('');
      setVersion(1);
      setSelectedConfigId('default');
    }

    if (type === 'message_reply') {
      setSampleInput('Shop ơi cho mình hỏi giá khung ảnh 15x21 bao nhiêu ạ?');
    } else if (type === 'comment_reply') {
      setSampleInput('Mẫu khung này đẹp quá, shop có freeship về Đà Nẵng không?');
    } else {
      setSampleInput('Giới thiệu chương trình khuyến mãi mừng khai trương xưởng khung canvas');
    }
    setTestResult(null);
    setTestEngineInfo(null);
  };

  const handleSavePrompt = async () => {
    if (!activePage) {
      toast('Vui lòng chọn Fanpage trước khi lưu prompt', 'warning');
      return;
    }
    if (!promptContent.trim()) {
      toast('Nội dung System Prompt không được để trống', 'warning');
      return;
    }

    setSaving(true);
    try {
      const targetProvider = selectedConfigId === 'default' ? null : activeSelectedConfig?.provider || null;
      const targetModel = selectedConfigId === 'default' ? null : activeSelectedConfig?.model || null;

      const res = await api.savePrompt({
        page_id: activePage.id,
        type: activeType,
        content: promptContent.trim(),
        ai_provider: targetProvider,
        ai_model: targetModel,
      });

      if (res.success) {
        const configName = activeSelectedConfig?.name || 'Mặc định';
        toast(`Đã lưu System Prompt v${res.prompt.version} thành công với Engine "${configName}"!`, 'success');
        setVersion(res.prompt.version);
        loadPrompts();
        loadHistory();
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
        loadPrompts();
        loadHistory();
        setShowHistory(false);
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
      const targetProvider = selectedConfigId === 'default' ? undefined : activeSelectedConfig?.provider || undefined;
      const targetModel = selectedConfigId === 'default' ? undefined : activeSelectedConfig?.model || undefined;

      const res = await api.testPrompt({
        page_id: activePage?.id,
        prompt_content: promptContent.trim(),
        sample_input: sampleInput.trim(),
        prompt_type: activeType,
        ai_provider: targetProvider,
        ai_model: targetModel,
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

  const insertVariable = (variableKey: string) => {
    setPromptContent(prev => prev + ` {{${variableKey}}}`);
  };

  const templateVariables = [
    { key: 'page_name', label: 'Tên Page' },
    { key: 'customer_name', label: 'Tên Khách' },
    { key: 'last_message', label: 'Nội dung chat/cmt' },
    { key: 'product_list', label: 'Sản phẩm' },
    { key: 'tone', label: 'Tone giọng' },
    { key: 'post_content', label: 'Bài viết gốc' },
  ];

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-4">
      {/* COMPACT TOP TOOLBAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Category Tabs: Compact Pills */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => handleSelectType('message_reply')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeType === 'message_reply'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
            <span>Tin nhắn Messenger</span>
          </button>
          <button
            onClick={() => handleSelectType('comment_reply')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeType === 'comment_reply'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bình luận Comment</span>
          </button>
          <button
            onClick={() => handleSelectType('post_generation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeType === 'post_generation'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Bài viết Fanpage</span>
          </button>
        </div>

        {/* AI Agent Engine Quick Selector: "Chỉ việc lựa chọn" */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <Bot className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium">AI Engine:</span>
            <select
              value={selectedConfigId}
              onChange={e => setSelectedConfigId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer max-w-[220px] truncate"
            >
              <option value="default">
                ⭐ Mặc định hệ thống ({user?.ai_provider} - {user?.ai_model})
              </option>
              {savedConfigs.map(c => (
                <option key={c.id} value={String(c.id)}>
                  {c.name} ({c.model}) {c.is_default ? '★' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Version badge */}
          <span className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-mono font-medium">
            v{version}
          </span>

          {/* Action: History Toggle */}
          <button
            type="button"
            onClick={() => setShowHistory(prev => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              showHistory
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Lịch sử phiên bản"
          >
            <History className="w-3.5 h-3.5" />
            <span>Lịch sử ({history.length})</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSavePrompt}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Đang lưu...' : 'Lưu Prompt'}</span>
          </button>
        </div>
      </div>

      {/* COMPACT DUAL-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Editor & Variable Pills (Col 7) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Active Engine Summary Pill */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-slate-600 text-[11px]">Động cơ xử lý:</span>
              <strong className="text-slate-900 font-semibold truncate">
                {activeSelectedConfig?.name || 'Mặc định'}
              </strong>
              <code className="px-1.5 py-0.2 bg-white border border-slate-200 text-blue-700 rounded text-[10px] font-mono">
                {activeSelectedConfig?.model || user?.ai_model}
              </code>
            </div>
            <span className="text-[10px] text-slate-400">
              {activePage?.page_name || 'Fanpage'}
            </span>
          </div>

          {/* History Collapsible List */}
          {showHistory && (
            <div className="bg-white border border-indigo-200 rounded-xl p-3 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-600" />
                  Lịch Sử Phiên Bản Prompt
                </span>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  Đóng
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {history.map(h => (
                  <div
                    key={h.id}
                    className="p-2 border border-slate-100 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-800">v{h.version}</strong>
                        {h.is_active ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                            Đang dùng
                          </span>
                        ) : null}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {h.ai_model || 'mặc định'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5 max-w-md">
                        {h.content}
                      </p>
                    </div>
                    {!h.is_active && (
                      <button
                        onClick={() => handleRollback(h.id, h.version)}
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold transition-colors shrink-0"
                      >
                        Khôi phục
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Editor Container */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2.5">
            {/* Variable Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Chèn biến:
              </span>
              {templateVariables.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 text-slate-700 rounded text-[11px] font-mono transition-colors cursor-pointer"
                  title={`Chèn biến {{${v.key}}}`}
                >
                  +{v.label}
                </button>
              ))}
            </div>

            {/* Prompt Textarea */}
            <textarea
              value={promptContent}
              onChange={e => setPromptContent(e.target.value)}
              rows={12}
              placeholder="Nhập hướng dẫn System Prompt cho AI Agent..."
              className="w-full bg-slate-50/70 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Độ dài: {promptContent.length} ký tự (~{Math.round(promptContent.length / 4)} tokens)</span>
              <span>Hỗ trợ định dạng biến: <code className="text-slate-600">{"{{tên_biến}}"}</code></span>
            </div>
          </div>
        </div>

        {/* Right Column: Compact Live Test Sandbox (Col 5) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-900">
                Sandbox Test Nhanh Phản Hồi AI
              </h3>
            </div>
            {testEngineInfo && (
              <span className="text-[10px] text-slate-500 font-mono">
                {testEngineInfo.model}
              </span>
            )}
          </div>

          {/* Quick preset samples */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-slate-400">Mẫu thử:</span>
            {[
              'Hỏi giá combo khung',
              'Hỏi phí ship Đà Nẵng',
              'Kính bị nứt đổi hàng',
            ].map(sample => (
              <button
                key={sample}
                type="button"
                onClick={() => setSampleInput(sample)}
                className="px-2 py-0.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded text-[10px] transition-colors"
              >
                {sample}
              </button>
            ))}
          </div>

          {/* Input text */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700 block">
              Dữ liệu đầu vào giả lập:
            </label>
            <textarea
              value={sampleInput}
              onChange={e => setSampleInput(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Run button */}
          <button
            type="button"
            onClick={handleRunTest}
            disabled={testing || !promptContent.trim()}
            className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-98 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            {testing ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>AI đang suy nghĩ và phản hồi...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Thực thi Test Với Engine Đã Chọn</span>
              </>
            )}
          </button>

          {/* Output Display */}
          {testResult ? (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Kết quả trả về:
                </span>
                {testResult.sentiment && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${
                    testResult.sentiment === 'positive'
                      ? 'bg-emerald-100 text-emerald-800'
                      : testResult.sentiment === 'negative'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {testResult.sentiment}
                  </span>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                {testResult.reply || testResult.content || JSON.stringify(testResult, null, 2)}
              </div>

              {testResult.needsHuman && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700">
                  ⚠️ AI đánh dấu cần người thật xử lý (Human Handoff)!
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
              Bấm nút <strong>"Thực thi Test"</strong> để kiểm tra câu trả lời trực tiếp của AI.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
