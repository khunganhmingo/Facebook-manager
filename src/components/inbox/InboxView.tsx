import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  ShieldAlert,
  CheckCircle,
  HelpCircle,
  Search,
  Filter,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { Conversation, MessageItem } from '../../types';

export const InboxView: React.FC = () => {
  const { activePage, toast } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNeedsHumanOnly, setFilterNeedsHumanOnly] = useState(false);

  // Simulation Modal state
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simName, setSimName] = useState('Khách hàng thử nghiệm');
  const [simText, setSimText] = useState('');
  const [simulating, setSimulating] = useState(false);

  // AI Summary state
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!activePage) return;
    try {
      const res = await api.getConversations(activePage.id);
      if (res.success && res.conversations) {
        setConversations(res.conversations);
        if (!selectedSenderId && res.conversations.length > 0) {
          setSelectedSenderId(res.conversations[0].sender_id);
        }
      }
    } catch (err: any) {
      console.warn('Load conversations error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [activePage, selectedSenderId]);

  useEffect(() => {
    loadConversations();
    // Realtime polling every 5 seconds as specified in prompt
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedSenderId, conversations]);

  const activeConversation = conversations.find(c => c.sender_id === selectedSenderId);

  const handleSendManualReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activePage || !selectedSenderId || !replyText.trim() || sending) return;

    setSending(true);
    try {
      const res = await api.sendReply({
        page_id: activePage.id,
        sender_id: selectedSenderId,
        sender_name: activeConversation?.sender_name,
        content: replyText.trim(),
      });

      if (res.success) {
        setReplyText('');
        toast('Đã gửi phản hồi cho khách hàng', 'success');
        await loadConversations();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleToggleHumanStatus = async (messageId: number, currentVal: boolean) => {
    try {
      await api.toggleHumanStatus(messageId, !currentVal);
      toast(!currentVal ? 'Đã đánh dấu cần người xử lý' : 'Đã bỏ cờ cần người xử lý', 'info');
      await loadConversations();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleSimulateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePage || !simText.trim() || simulating) return;

    setSimulating(true);
    try {
      const res = await api.simulateMessage({
        page_id: activePage.id,
        sender_name: simName.trim() || 'Khách hàng FB',
        content: simText.trim(),
      });

      if (res.success) {
        toast(
          res.needsHuman
            ? '⚠️ AI phát hiện khiếu nại/tiêu cực → Đã kích hoạt Chuyển giao người thật!'
            : '✨ AI Agent đã tự động phân tích & gửi phản hồi ngay!',
          res.needsHuman ? 'error' : 'success'
        );
        setShowSimulateModal(false);
        setSimText('');
        await loadConversations();
        if (res.incomingMessage) {
          setSelectedSenderId(res.incomingMessage.sender_id);
        }
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSimulating(false);
    }
  };

  const handleSummarize = async () => {
    if (!activeConversation) return;
    setSummarizing(true);
    try {
      const msgs = activeConversation.messages.map(m => ({
        role: m.direction === 'in' ? 'Khách hàng' : 'Fanpage',
        text: m.content,
      }));
      const res = await api.summarizeConversation(msgs);
      if (res.success) {
        setSummary(res.summary);
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSummarizing(false);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    const matchesSearch =
      c.sender_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.latest_message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesHuman = filterNeedsHumanOnly ? c.requires_human : true;
    return matchesSearch && matchesHuman;
  });

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50">
      {/* Top Action Bar */}
      <div className="h-14 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-800">
            Hộp thư Messenger ({conversations.length} hội thoại)
          </span>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => setFilterNeedsHumanOnly(!filterNeedsHumanOnly)}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              filterNeedsHumanOnly
                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Chỉ xem ca cần nhân viên</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSimulateModal(true)}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Mô phỏng tin nhắn đến (Webhook Test)</span>
          </button>
        </div>
      </div>

      {/* Main Inbox Workspace (Split View) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Conversations List */}
        <div className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0">
          {/* Search box */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm theo tên khách hoặc nội dung..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Không tìm thấy hội thoại nào.
              </div>
            ) : (
              filteredConversations.map(c => {
                const isSelected = c.sender_id === selectedSenderId;
                return (
                  <button
                    key={c.sender_id}
                    onClick={() => {
                      setSelectedSenderId(c.sender_id);
                      setSummary(null);
                    }}
                    className={`w-full p-3 text-left transition-colors flex items-start gap-3 cursor-pointer ${
                      isSelected ? 'bg-blue-50/70 border-l-2 border-l-blue-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0">
                      {c.sender_name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {c.sender_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {new Date(c.latest_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate leading-tight">
                        {c.latest_message}
                      </p>

                      {c.requires_human && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                          <span>Cần nhân viên xử lý</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Thread View */}
        {activeConversation ? (
          <div className="flex-1 flex flex-col bg-white">
            {/* Thread Header */}
            <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  {activeConversation.sender_name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900">
                      {activeConversation.sender_name}
                    </span>
                    {activeConversation.requires_human && (
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-medium px-1.5 py-0.5 rounded">
                        Khiếu nại / Cần người
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID Facebook: {activeConversation.sender_id}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSummarize}
                  disabled={summarizing}
                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{summarizing ? 'Đang tóm tắt...' : 'Tóm tắt AI'}</span>
                </button>
              </div>
            </div>

            {/* AI Summary Box if requested */}
            {summary && (
              <div className="p-3 mx-6 mt-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Tóm tắt nhu cầu khách hàng:</span>
                    <p className="mt-0.5 text-amber-800">{summary}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSummary(null)}
                  className="text-amber-700 hover:text-amber-900 text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
              {activeConversation.messages.map(m => {
                const isIncoming = m.direction === 'in';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isIncoming ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                      <span>{isIncoming ? activeConversation.sender_name : activePage?.page_name || 'Fanpage'}</span>
                      {m.ai_generated && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 font-medium bg-blue-50 px-1 py-0.2 rounded">
                          <Bot className="w-3 h-3" />
                          <span>AI Auto-Reply</span>
                        </span>
                      )}
                      <span>·</span>
                      <span className="font-mono">
                        {new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                        isIncoming
                          ? m.requires_human
                            ? 'bg-rose-50 text-slate-900 border border-rose-300 rounded-tl-sm'
                            : 'bg-white text-slate-900 border border-slate-200 rounded-tl-sm'
                          : 'bg-blue-600 text-white rounded-tr-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>

                    {/* Metadata tags for incoming message */}
                    {isIncoming && (
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                        {m.intent && (
                          <span className="capitalize">
                            Ý định: <strong className="text-slate-600">{m.intent}</strong>
                          </span>
                        )}
                        {m.sentiment && (
                          <span>
                            Cảm xúc:{' '}
                            <strong
                              className={
                                m.sentiment === 'negative'
                                  ? 'text-rose-600'
                                  : m.sentiment === 'positive'
                                  ? 'text-emerald-600'
                                  : 'text-slate-600'
                              }
                            >
                              {m.sentiment}
                            </strong>
                          </span>
                        )}
                        <button
                          onClick={() => handleToggleHumanStatus(m.id, m.requires_human)}
                          className="text-blue-600 hover:underline ml-1"
                        >
                          {m.requires_human ? 'Bỏ cờ cần hỗ trợ' : 'Gắn cờ cần nhân viên'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Manual Reply Box */}
            <form onSubmit={handleSendManualReply} className="p-4 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nhập tin nhắn trả lời với tư cách Nhân viên Fanpage..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  disabled={sending}
                  className="flex-1 px-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sending ? 'Đang gửi...' : 'Gửi trả lời'}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
            <Bot className="w-10 h-10 text-slate-300 mb-2" />
            <p>Chọn một cuộc trò chuyện ở cột bên trái để xem chi tiết</p>
          </div>
        )}
      </div>

      {/* Simulation Modal (Webhook Tester) */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Mô phỏng tin nhắn Facebook đến (Webhook Simulator)
                </h3>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Thử nghiệm cách AI Agent nhận diện ý định, phân tích cảm xúc (Sentiment) và tự động phản hồi hoặc kích hoạt Chuyển giao người thật khi có khiếu nại.
            </p>

            <form onSubmit={handleSimulateMessage} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Tên khách hàng
                </label>
                <input
                  type="text"
                  value={simName}
                  onChange={e => setSimName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Nội dung tin nhắn khách hàng gửi tới
                </label>
                <textarea
                  rows={3}
                  value={simText}
                  onChange={e => setSimText(e.target.value)}
                  placeholder="Ví dụ: 'Shop ơi khung ảnh 20x30 bao nhiêu tiền thế?', hoặc 'Hàng giao bị vỡ kính rồi, shop giải quyết đổi gấp cho tôi!'"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Quick sample chips */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-medium text-slate-500 block">Chọn nhanh câu hỏi mẫu:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSimText('Shop ơi cho mình xin kích thước khung ảnh để bàn và giá combo 3 khung nhé!')}
                    className="text-[11px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md"
                  >
                    Hỏi giá combo
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimText('Phí ship về Hải Phòng bao nhiêu và mấy ngày tới shop ơi?')}
                    className="text-[11px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md"
                  >
                    Hỏi phí ship
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimText('Khung ảnh đẹp và dày dặn lắm, cả nhà mình ai cũng khen!')}
                    className="text-[11px] px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md"
                  >
                    Khen ngợi
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimText('Sản phẩm giao bị nứt góc kính rồi, shop làm ăn tắc trách quá, hoàn tiền ngay!')}
                    className="text-[11px] px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md"
                  >
                    🚨 Khiếu nại bức xúc
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={simulating || !simText.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{simulating ? 'AI đang phân tích...' : 'Gửi qua Webhook'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
