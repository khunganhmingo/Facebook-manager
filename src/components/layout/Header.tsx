import React from 'react';
import { PlusCircle, Sparkles, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { NavTab } from './Sidebar';

interface HeaderProps {
  currentTab: NavTab;
  onOpenCreatePost: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: { title: 'Tổng quan hoạt động', subtitle: 'Báo cáo tương tác và hiệu quả phản hồi tự động' },
  inbox: { title: 'Hộp thư Messenger', subtitle: 'Quản lý tin nhắn khách hàng & Chuyển giao hỗ trợ nhân viên' },
  comments: { title: 'Bình luận Fanpage', subtitle: 'Tự động phản hồi bình luận và lọc spam theo từ khóa' },
  content: { title: 'Tạo nội dung bằng AI', subtitle: 'Sáng tạo bài đăng đa biến thể với hình ảnh và hashtag tối ưu' },
  calendar: { title: 'Lịch đăng & Quản lý bài', subtitle: 'Lên lịch xuất bản tự động trên Facebook Graph API' },
  prompts: { title: 'Cấu hình System Prompt', subtitle: 'Tùy biến hành vi AI Agent và biến số cho từng Fanpage' },
  pages: { title: 'Danh sách Fanpage', subtitle: 'Kết nối và quản lý mã token của các trang Facebook' },
  settings: { title: 'Cài đặt hệ thống & Webhook', subtitle: 'Cấu hình AI Provider và thông số xác thực Webhook' },
  admin: { title: 'Quản trị hệ thống & Hạn mức User', subtitle: 'Theo dõi lượng Facebook, số lượng AI Agent và gia hạn thời gian sử dụng' },
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenCreatePost,
  onRefresh,
  isRefreshing,
}) => {
  const { activePage } = useAuth();
  const currentInfo = tabTitles[currentTab] || { title: 'SocialAgent', subtitle: '' };

  return (
    <header className="h-16 px-8 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* Zone 1: Contextual Title & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight whitespace-nowrap">
            {currentInfo.title}
          </h1>
          <p className="text-xs text-slate-500 whitespace-nowrap hidden sm:block">
            {activePage?.page_name ? `${activePage.page_name} · ${currentInfo.subtitle}` : currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Zone 2: Primary Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 text-xs flex items-center gap-1.5"
            title="Làm mới dữ liệu"
            aria-label="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Làm mới</span>
          </button>
        )}

        <button
          onClick={onOpenCreatePost}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-200" />
          <span>Tạo bài viết AI</span>
        </button>
      </div>
    </header>
  );
};
