import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  EyeOff,
  Send,
  Plus,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { CommentItem } from '../../types';

export const CommentsView: React.FC = () => {
  const { activePage, toast } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Manual reply inline
  const [activeReplyId, setActiveReplyId] = useState<number | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [replying, setReplying] = useState(false);

  // Simulation modal
  const [showSimModal, setShowSimModal] = useState(false);
  const [simAuthor, setSimAuthor] = useState('Phạm Hương Lan');
  const [simContent, setSimContent] = useState('');
  const [simPostTitle, setSimPostTitle] = useState('BST Khung Ảnh Canvas Treo Tường Hiện Đại 2026');
  const [simulating, setSimulating] = useState(false);

  const loadComments = useCallback(async () => {
    if (!activePage) return;
    try {
      const res = await api.getComments(activePage.id, statusFilter);
      if (res.success && res.comments) {
        setComments(res.comments);
      }
    } catch (err: any) {
      console.warn('Load comments error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [activePage, statusFilter]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSendReply = async (commentId: number) => {
    if (!replyInput.trim() || replying) return;
    setReplying(true);
    try {
      const res = await api.replyComment(commentId, replyInput.trim());
      if (res.success) {
        toast('Đã phản hồi bình luận công khai', 'success');
        setActiveReplyId(null);
        setReplyInput('');
        await loadComments();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setReplying(false);
    }
  };

  const handleHideComment = async (commentId: number) => {
    try {
      await api.hideComment(commentId);
      toast('Đã ẩn bình luận spam trên Fanpage', 'info');
      await loadComments();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePage || !simContent.trim() || simulating) return;

    setSimulating(true);
    try {
      const res = await api.simulateComment({
        page_id: activePage.id,
        author_name: simAuthor.trim() || 'Khách hàng FB',
        content: simContent.trim(),
        post_content: simPostTitle.trim(),
      });

      if (res.success) {
        toast(
          res.comment.isSpam
            ? '🛡️ Bình luận chứa từ khóa spam/lừa đảo → AI đã tự động ẨN bình luận!'
            : '✨ AI Agent đã phản hồi bình luận bài viết thành công!',
          res.comment.isSpam ? 'info' : 'success'
        );
        setShowSimModal(false);
        setSimContent('');
        await loadComments();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
            Quản lý bình luận Fanpage ({comments.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tự động trả lời bình luận bài viết, lọc spam và tự động chuyển hướng khách vào inbox
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md transition-colors ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter('replied')}
              className={`px-3 py-1 rounded-md transition-colors ${statusFilter === 'replied' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Đã trả lời
            </button>
            <button
              onClick={() => setStatusFilter('hidden')}
              className={`px-3 py-1 rounded-md transition-colors ${statusFilter === 'hidden' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Đã ẩn (Spam)
            </button>
          </div>

          <button
            onClick={() => setShowSimModal(true)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Mô phỏng Comment mới</span>
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-xs">
            <MessageCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p>Chưa có bình luận nào theo bộ lọc này.</p>
          </div>
        ) : (
          comments.map(c => (
            <div
              key={c.id}
              className={`bg-white border rounded-xl p-5 shadow-xs transition-colors ${
                c.status === 'hidden' ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                    {c.author_name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900">
                        {c.author_name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(c.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {new Date(c.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    {c.post_content && (
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        Trên bài viết: <span className="font-medium text-slate-700">"{c.post_content}"</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {c.status === 'replied' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      <CheckCircle className="w-3 h-3" />
                      <span>Đã phản hồi</span>
                    </span>
                  )}
                  {c.status === 'hidden' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                      <EyeOff className="w-3 h-3 text-slate-500" />
                      <span>Đã ẩn tự động (Spam)</span>
                    </span>
                  )}
                  {c.status === 'pending' && (
                    <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      Chờ phản hồi
                    </span>
                  )}
                </div>
              </div>

              {/* Comment Content */}
              <div className="pl-11 space-y-3">
                <p className="text-xs text-slate-800 bg-slate-50 rounded-lg p-3 border border-slate-100 leading-relaxed">
                  "{c.content}"
                </p>

                {/* AI Reply if available */}
                {c.ai_reply && (
                  <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs">
                    <div className="flex items-center gap-1.5 text-blue-700 font-semibold mb-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Câu trả lời của Fanpage ({activePage?.page_name || 'Fanpage'}):</span>
                    </div>
                    <p className="text-slate-800 leading-relaxed">{c.ai_reply}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-1">
                  {c.status !== 'hidden' && (
                    <button
                      onClick={() => {
                        setActiveReplyId(activeReplyId === c.id ? null : c.id);
                        setReplyInput(c.ai_reply || '');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {activeReplyId === c.id ? 'Đóng hộp trả lời' : 'Viết phản hồi khác'}
                    </button>
                  )}

                  {c.status !== 'hidden' && (
                    <button
                      onClick={() => handleHideComment(c.id)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1"
                    >
                      <EyeOff className="w-3 h-3" />
                      <span>Ẩn bình luận</span>
                    </button>
                  )}
                </div>

                {/* Inline Reply Form */}
                {activeReplyId === c.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <input
                      type="text"
                      value={replyInput}
                      onChange={e => setReplyInput(e.target.value)}
                      placeholder="Nhập nội dung phản hồi bình luận công khai..."
                      className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleSendReply(c.id)}
                      disabled={replying || !replyInput.trim()}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Send className="w-3 h-3" />
                      <span>{replying ? 'Đang gửi...' : 'Gửi reply'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Simulation Modal */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Mô phỏng bình luận bài viết (Webhook Feed Event)
                </h3>
              </div>
              <button
                onClick={() => setShowSimModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Tên người bình luận
                </label>
                <input
                  type="text"
                  value={simAuthor}
                  onChange={e => setSimAuthor(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Bài viết đang được comment
                </label>
                <input
                  type="text"
                  value={simPostTitle}
                  onChange={e => setSimPostTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Nội dung bình luận
                </label>
                <textarea
                  rows={3}
                  value={simContent}
                  onChange={e => setSimContent(e.target.value)}
                  placeholder="Ví dụ: 'Set khung ảnh phòng khách này giá bao nhiêu vậy shop?' hoặc nội dung quảng cáo spam..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Quick sample chips */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-medium text-slate-500 block">Mẫu thử nghiệm nhanh:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSimContent('Set khung tranh canvas phòng ngủ giá bao nhiêu vậy shop?')}
                    className="text-[11px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md"
                  >
                    Hỏi giá mẫu
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimContent('Khung viền dày bao nhiêu cm và có tặng đinh treo tường không ạ?')}
                    className="text-[11px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md"
                  >
                    Hỏi chất liệu
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimContent('Vay vốn nhanh giải ngân 15 phút không cần thế chấp liên hệ zalo 09xx')}
                    className="text-[11px] px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md"
                  >
                    🚨 Test Spam (Tự động ẩn)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={simulating || !simContent.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{simulating ? 'Đang phân tích...' : 'Gửi Comment qua Webhook'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
