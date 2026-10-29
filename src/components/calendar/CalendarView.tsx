import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Trash2,
  Edit2,
  Plus,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { ScheduledPost } from '../../types';

interface CalendarViewProps {
  onOpenCreatePost: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onOpenCreatePost }) => {
  const { activePage, toast } = useAuth();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Edit/Reschedule Modal
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDate, setEditDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const res = await api.getPosts(activePage?.id, statusFilter);
      if (res.success && res.posts) {
        setPosts(res.posts);
      }
    } catch (err: any) {
      console.warn('Load posts error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [activePage, statusFilter]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handlePublishNow = async (postId: number) => {
    try {
      await api.publishNow(postId);
      toast('Đã xuất bản bài viết lên Facebook!', 'success');
      await loadPosts();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleDelete = async (postId: number) => {
    if (!confirm('Bạn có chắc muốn xóa bài đăng này?')) return;
    try {
      await api.deletePost(postId);
      toast('Đã xóa bài đăng khỏi lịch', 'info');
      await loadPosts();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPost || !editContent.trim()) return;
    setSavingEdit(true);
    try {
      await api.updatePost(editingPost.id, {
        content: editContent.trim(),
        scheduled_at: editDate,
      });
      toast('Đã cập nhật bài đăng thành công!', 'success');
      setEditingPost(null);
      await loadPosts();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Conflict calculation: check if any 2 scheduled posts are within 30 minutes
  const scheduledPosts = posts.filter(p => p.status === 'scheduled');
  const hasAnyConflict = scheduledPosts.some((p1, idx) => {
    const t1 = new Date(p1.scheduled_at).getTime();
    return scheduledPosts.some((p2, idx2) => {
      if (idx === idx2 || p1.page_id !== p2.page_id) return false;
      const t2 = new Date(p2.scheduled_at).getTime();
      return Math.abs(t1 - t2) < 30 * 60 * 1000;
    });
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
            Lịch đăng bài tự động ({posts.length} bài)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý hàng đợi bài đăng, tự động xuất bản qua Graph API theo giờ định sẵn
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md transition-colors ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              className={`px-3 py-1 rounded-md transition-colors ${statusFilter === 'scheduled' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Đang lên lịch
            </button>
            <button
              onClick={() => setStatusFilter('published')}
              className={`px-3 py-1 rounded-md transition-colors ${statusFilter === 'published' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Đã xuất bản
            </button>
          </div>

          <button
            onClick={onOpenCreatePost}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm bài mới</span>
          </button>
        </div>
      </div>

      {/* Conflict Warning Notice if detected */}
      {hasAnyConflict && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Cảnh báo trùng lịch đăng bài (Conflict Warning)</span>
            <span className="text-amber-800 leading-relaxed block mt-0.5">
              Hệ thống phát hiện có ít nhất 2 bài đăng được lên lịch cách nhau dưới 30 phút trên cùng một Fanpage. Theo chính sách phân phối của Facebook, bạn nên dãn cách bài đăng ít nhất 1-2 tiếng để đạt reach cao nhất.
            </span>
          </div>
        </div>
      )}

      {/* Posts List View */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-400 text-xs space-y-3">
            <CalendarDays className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-medium text-slate-700">Chưa có bài viết nào trong lịch</p>
            <p className="max-w-xs mx-auto text-slate-400">
              Hãy dùng công cụ Tạo bài viết AI hoặc nhấn nút "Thêm bài mới" để xếp lịch bài đầu tiên.
            </p>
          </div>
        ) : (
          posts.map(post => {
            const isDue = new Date(post.scheduled_at) <= new Date() && post.status === 'scheduled';
            return (
              <div
                key={post.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                {/* Left Content Area */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                    {post.image_url ? (
                      <img
                        src={post.image_url}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px]">
                        Text Post
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        {post.page_name || 'Fanpage'}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(post.scheduled_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {new Date(post.scheduled_at).toLocaleDateString('vi-VN')}
                        </span>
                      </span>
                      {isDue && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                          Đến hạn xuất bản
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                      {post.content}
                    </p>

                    {post.error_message && (
                      <p className="text-[11px] text-rose-600 font-medium">
                        Lỗi: {post.error_message} (Đã thử {post.retry_count || 0}/3 lần)
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Status & Actions */}
                <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                  {post.status === 'published' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đã xuất bản</span>
                    </span>
                  )}
                  {post.status === 'scheduled' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Đã lên lịch</span>
                    </span>
                  )}
                  {post.status === 'failed' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Thất bại</span>
                    </span>
                  )}

                  {post.status === 'scheduled' && (
                    <button
                      onClick={() => handlePublishNow(post.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                      title="Đăng ngay lên Fanpage không cần đợi giờ"
                    >
                      <Play className="w-3 h-3 text-emerald-600" />
                      <span>Đăng ngay</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setEditingPost(post);
                      setEditContent(post.content);
                      setEditDate(new Date(post.scheduled_at).toISOString().slice(0, 16));
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                    title="Chỉnh sửa nội dung / Đổi giờ"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(post.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                    title="Xóa bài đăng"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit / Reschedule Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                Chỉnh sửa bài đăng & Đổi giờ (Reschedule)
              </h3>
              <button onClick={() => setEditingPost(null)} className="text-slate-400 hover:text-slate-600 text-sm">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Thời gian xuất bản mới
                </label>
                <input
                  type="datetime-local"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Nội dung bài viết
                </label>
                <textarea
                  rows={5}
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
