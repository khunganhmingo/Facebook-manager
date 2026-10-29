import React, { useState } from 'react';
import {
  Layers,
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Settings,
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { FacebookPage } from '../../types';

export const PagesView: React.FC = () => {
  const { pages, refreshPages, toast, activePageId, setActivePageId } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Settings modal
  const [editingPage, setEditingPage] = useState<FacebookPage | null>(null);
  const [autoReplyMsg, setAutoReplyMsg] = useState(true);
  const [autoReplyCmt, setAutoReplyCmt] = useState(true);
  const [activeFrom, setActiveFrom] = useState('08:00');
  const [activeTo, setActiveTo] = useState('22:00');
  const [delayMin, setDelayMin] = useState(3);
  const [delayMax, setDelayMax] = useState(8);
  const [skipKeywordsText, setSkipKeywordsText] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const handleConnectPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageId.trim() || !accessToken.trim() || saving) return;

    setSaving(true);
    try {
      const res = await api.createPage({
        page_id: pageId.trim(),
        page_name: pageName.trim() || `Fanpage ${pageId}`,
        page_access_token: accessToken.trim(),
        avatar_url: avatarUrl.trim() || undefined,
      });

      if (res.success) {
        toast('Kết nối Fanpage thành công qua API Key!', 'success');
        setShowAddModal(false);
        setPageId('');
        setPageName('');
        setAccessToken('');
        setAvatarUrl('');
        await refreshPages();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSettings = (page: FacebookPage) => {
    setEditingPage(page);
    setAutoReplyMsg(page.auto_reply_messages);
    setAutoReplyCmt(page.auto_reply_comments);
    setActiveFrom(page.active_hours?.from || '08:00');
    setActiveTo(page.active_hours?.to || '22:00');
    setDelayMin(page.reply_delay_min || 3);
    setDelayMax(page.reply_delay_max || 8);
    setSkipKeywordsText(Array.isArray(page.skip_keywords) ? page.skip_keywords.join(', ') : 'lừa đảo, scam, vay vốn');
  };

  const handleSavePageSettings = async () => {
    if (!editingPage || savingSettings) return;
    setSavingSettings(true);
    try {
      const keywordsArray = skipKeywordsText
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);

      await api.updatePage(editingPage.id, {
        auto_reply_messages: autoReplyMsg,
        auto_reply_comments: autoReplyCmt,
        active_hours: { from: activeFrom, to: activeTo, days: [1, 2, 3, 4, 5, 6, 7] },
        reply_delay_min: Number(delayMin),
        reply_delay_max: Number(delayMax),
        skip_keywords: keywordsArray,
      });

      toast('Cập nhật cài đặt Fanpage thành công', 'success');
      setEditingPage(null);
      await refreshPages();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa kết nối Fanpage "${name}"?`)) return;
    try {
      await api.deletePage(id);
      toast('Đã xóa kết nối trang', 'info');
      await refreshPages();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
            Quản lý Fanpage Facebook ({pages.length} trang đã kết nối)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kết nối trực tiếp qua Page Access Token và Page ID. Toàn bộ token được mã hóa bảo mật AES-256.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Kết nối Fanpage mới</span>
        </button>
      </div>

      {/* Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pages.map(page => {
          const isSelected = page.id === activePageId;
          return (
            <div
              key={page.id}
              className={`bg-white border rounded-xl p-6 shadow-xs space-y-5 transition-all ${
                isSelected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-700">
                    {page.avatar_url ? (
                      <img src={page.avatar_url} alt={page.page_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      page.page_name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {page.page_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span className="font-mono">Page ID: {page.page_id}</span>
                      <span>·</span>
                      <span className="font-mono">{page.masked_token}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Hoạt động</span>
                  </span>
                </div>
              </div>

              {/* Status toggles preview */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-[11px] text-slate-500 block mb-0.5">Tự động trả lời tin nhắn:</span>
                  <span className={`font-semibold ${page.auto_reply_messages ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {page.auto_reply_messages ? 'Đang bật' : 'Đã tắt'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-[11px] text-slate-500 block mb-0.5">Tự động trả lời comment:</span>
                  <span className={`font-semibold ${page.auto_reply_comments ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {page.auto_reply_comments ? 'Đang bật' : 'Đã tắt'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>Khung giờ phản hồi: <strong>{page.active_hours?.from || '08:00'} - {page.active_hours?.to || '22:00'}</strong></span>
                <span>Random Delay: <strong>{page.reply_delay_min || 3}s - {page.reply_delay_max || 8}s</strong></span>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={() => setActivePageId(page.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {isSelected ? 'Đang chọn quản lý' : 'Chọn quản lý trang này'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenSettings(page)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs flex items-center gap-1"
                    title="Cấu hình nâng cao"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Cấu hình</span>
                  </button>
                  <button
                    onClick={() => handleDelete(page.id, page.page_name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                    title="Xóa trang"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Kết nối Facebook Page qua API Key
                </h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 text-sm">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Chỉ cần nhập Page ID và Page Access Token từ Facebook Graph API Explorer hoặc Meta for Developers. Không cần trải qua quy trình OAuth phức tạp.
            </p>

            <form onSubmit={handleConnectPage} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Facebook Page ID *
                </label>
                <input
                  type="text"
                  value={pageId}
                  onChange={e => setPageId(e.target.value)}
                  placeholder="Ví dụ: 109283749102938"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Tên Fanpage (Ghi nhớ)
                </label>
                <input
                  type="text"
                  value={pageName}
                  onChange={e => setPageName(e.target.value)}
                  placeholder="Ví dụ: Khung Ảnh Rẻ Đẹp Mingo Store"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Facebook Page Access Token *
                </label>
                <textarea
                  rows={3}
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  placeholder="Dán mã Token (bắt đầu bằng EAAG... hoặc EAAK...)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  URL Ảnh đại diện Fanpage (Tùy chọn)
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
                🔒 Bảo mật: Token được mã hóa AES-256-GCM trước khi lưu vào SQLite database, không bao giờ lộ ra frontend.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving || !pageId.trim() || !accessToken.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Đang kết nối...' : 'Lưu & Kích hoạt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {editingPage && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                Cấu hình tương tác tự động · {editingPage.page_name}
              </h3>
              <button onClick={() => setEditingPage(null)} className="text-slate-400 hover:text-slate-600 text-sm">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReplyMsg}
                    onChange={e => setAutoReplyMsg(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Tự động phản hồi tin nhắn Messenger (Auto-Reply)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReplyCmt}
                    onChange={e => setAutoReplyCmt(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Tự động phản hồi bình luận bài viết (Auto-Reply Comments)</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Khung giờ hoạt động từ
                  </label>
                  <input
                    type="time"
                    value={activeFrom}
                    onChange={e => setActiveFrom(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Đến
                  </label>
                  <input
                    type="time"
                    value={activeTo}
                    onChange={e => setActiveTo(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Random Delay tối thiểu (giây)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={delayMin}
                    onChange={e => setDelayMin(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Random Delay tối đa (giây)
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="60"
                    value={delayMax}
                    onChange={e => setDelayMax(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Từ khóa Spam cần tự động ẩn (Cách nhau bằng dấu phẩy)
                </label>
                <textarea
                  rows={2}
                  value={skipKeywordsText}
                  onChange={e => setSkipKeywordsText(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingPage(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSavePageSettings}
                disabled={savingSettings}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {savingSettings ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
