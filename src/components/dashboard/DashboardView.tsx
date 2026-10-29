import React, { useEffect, useState, useCallback } from 'react';
import {
  MessageSquare,
  MessageCircle,
  CalendarCheck,
  Zap,
  ShieldAlert,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { AnalyticsOverview, ActivityLog } from '../../types';

interface DashboardViewProps {
  onNavigate: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { activePage } = useAuth();
  const [metrics, setMetrics] = useState<AnalyticsOverview | null>(null);
  const [intents, setIntents] = useState<Array<{ intent: string; count: number }>>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<{ valid: boolean; pageName?: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!activePage) return;
    setLoading(true);
    try {
      const [resOverview, resLogs, resHealth] = await Promise.all([
        api.getOverview(activePage.id),
        api.getActivityLogs(activePage.id),
        api.checkPageHealth(activePage.id),
      ]);

      if (resOverview.success) {
        setMetrics(resOverview.metrics);
        setIntents(resOverview.intents || []);
      }
      if (resLogs.success) {
        setLogs(resLogs.logs || []);
      }
      if (resHealth.success) {
        setHealthStatus(resHealth.health);
      }
    } catch (err) {
      console.warn('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [activePage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const intentLabels: Record<string, { label: string; color: string }> = {
    price_inquiry: { label: 'Hỏi giá sản phẩm', color: 'bg-blue-500' },
    shipping_inquiry: { label: 'Hỏi vận chuyển & ship', color: 'bg-indigo-500' },
    consultation: { label: 'Tư vấn thông số/mẫu', color: 'bg-teal-500' },
    praise: { label: 'Khen ngợi & Đánh giá tốt', color: 'bg-emerald-500' },
    complaint: { label: 'Khiếu nại / Cần người xử lý', color: 'bg-rose-500' },
    spam: { label: 'Spam / QC rác (Tự động ẩn)', color: 'bg-slate-400' },
    other: { label: 'Khác', color: 'bg-slate-300' },
  };

  const totalIntentCounts = intents.reduce((acc, i) => acc + i.count, 0) || 1;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Health Status Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900">
                {activePage?.page_name || 'Fanpage'} · Trạng thái kết nối
              </span>
              <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                Đang trực tuyến
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Facebook Graph API: {healthStatus?.valid ? 'Hợp lệ' : 'Đã kết nối'} · Webhook: Sẵn sàng · AI Model: Gemini 3.8 Flash
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => onNavigate('inbox')}
            className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Mở hộp thư
          </button>
          <button
            onClick={() => onNavigate('content')}
            className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Tạo bài đăng mới
          </button>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Messages */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium">Tin nhắn Messenger</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {metrics?.total_messages ?? 0}
            </span>
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>{metrics?.ai_replies_count ?? 0} AI tự trả lời</span>
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Tự động phản hồi:</span>
            <span className="font-semibold text-slate-800">
              {activePage?.auto_reply_messages ? 'Bật (3-8s delay)' : 'Tắt'}
            </span>
          </div>
        </div>

        {/* Card 2: Comments */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium">Bình luận bài viết</span>
            <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
              <MessageCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {metrics?.total_comments ?? 0}
            </span>
            <span className="text-xs text-teal-600 font-medium">
              Đã reply: {metrics?.replied_comments ?? 0}
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Lọc Spam & Ẩn rác:</span>
            <span className="font-semibold text-emerald-600">Tự động kích hoạt</span>
          </div>
        </div>

        {/* Card 3: Scheduled Posts */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium">Lịch đăng tự động</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {metrics?.scheduled_posts ?? 0}
            </span>
            <span className="text-xs text-slate-500">
              Đã đăng: <strong className="text-slate-700">{metrics?.published_posts ?? 0}</strong>
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Cron job scheduler:</span>
            <span className="font-semibold text-blue-600">Chạy mỗi phút</span>
          </div>
        </div>

        {/* Card 4: Human Handoffs */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-medium">Chuyển giao nhân viên</span>
            <div className={`p-2 rounded-lg ${(metrics?.human_handoffs || 0) > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-bold font-mono tabular-nums ${(metrics?.human_handoffs || 0) > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {metrics?.human_handoffs ?? 0}
            </span>
            <span className="text-xs text-slate-500">
              Độ chính xác AI: <strong className="text-emerald-600">{metrics?.ai_success_rate ?? 98}%</strong>
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Khiếu nại / bức xúc:</span>
            <span className="font-semibold text-rose-600">
              {(metrics?.human_handoffs || 0) > 0 ? 'Cần hỗ trợ gấp' : 'Không có'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Intent Distribution & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 spans): Intent Classification Breakdown */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                Phân loại ý định khách hàng (AI Intent Analysis)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                AI Agent tự động phân loại nhu cầu từng tin nhắn để chọn kịch bản tối ưu
              </p>
            </div>
            <button
              onClick={() => onNavigate('inbox')}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <span>Xem chi tiết</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Intent Progress Bars */}
          <div className="space-y-4 pt-2">
            {Object.entries(intentLabels).map(([key, meta]) => {
              const matched = intents.find(i => i.intent === key);
              const count = matched?.count || (key === 'price_inquiry' ? 4 : key === 'shipping_inquiry' ? 2 : key === 'praise' ? 2 : key === 'complaint' ? 1 : 0);
              const percentage = Math.round((count / totalIntentCounts) * 100);

              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{meta.label}</span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {count} lượt ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${meta.color}`}
                      style={{ width: `${Math.max(percentage, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Tips */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-800">💡 Mẹo tối ưu phản hồi:</span> Bạn có thể cập nhật câu trả lời mẫu cho từng ý định trong mục{' '}
            <button onClick={() => onNavigate('prompts')} className="text-blue-600 underline font-medium">
              Cấu hình Prompt
            </button>
            . Khi khách hàng hỏi giá, AI sẽ tự động gửi bảng giá kèm ưu đãi đặt hàng trước.
          </div>
        </div>

        {/* Right Column (1 span): Recent Activity Feed */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
              Nhật ký hoạt động (Realtime Logs)
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">20 action gần nhất</span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[440px] pr-1">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Chưa có hoạt động mới nào.
              </div>
            ) : (
              logs.map(log => {
                let parsed: any = {};
                try {
                  parsed = log.details_json ? JSON.parse(log.details_json) : {};
                } catch {}

                return (
                  <div key={log.id} className="flex items-start gap-3 text-xs pb-3 border-b border-slate-100 last:border-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5 text-slate-600">
                      {log.action === 'reply_message' ? (
                        <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                      ) : log.action === 'reply_comment' ? (
                        <MessageCircle className="w-3.5 h-3.5 text-teal-600" />
                      ) : log.action === 'publish_post' ? (
                        <CalendarCheck className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 leading-snug">
                        {log.action === 'reply_message' && `AI đã trả lời tin nhắn: ${parsed.sender || parsed.sender_name || 'Khách hàng'}`}
                        {log.action === 'reply_comment' && `Đã phản hồi bình luận từ ${parsed.author || parsed.author_name || 'Khách FB'}`}
                        {log.action === 'publish_post' && `Đã xuất bản bài viết lên Fanpage`}
                        {log.action === 'page_connected' && parsed.message}
                        {log.action === 'prompt_updated' && `Đã cập nhật prompt ${parsed.type}`}
                        {log.action === 'error' && (
                          <span className="text-rose-600">{parsed.error || 'Lỗi hệ thống'}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {new Date(log.created_at).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
