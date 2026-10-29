import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  MessageCircle,
  Sparkles,
  CalendarDays,
  FileCode2,
  Layers,
  Settings,
  ChevronDown,
  ShieldAlert,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'inbox'
  | 'comments'
  | 'content'
  | 'calendar'
  | 'prompts'
  | 'pages'
  | 'settings'
  | 'admin';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user, pages, activePage, activePageId, setActivePageId, logout } = useAuth();

  const totalUnhanlded = pages.reduce((acc, p) => acc + (p.unhandled_count || 0), 0);

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode; badge?: number; badgeText?: string }> = [
    { id: 'dashboard', label: 'Tổng quan Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'inbox',
      label: 'Hộp thư Messenger',
      icon: <MessageSquare className="w-4 h-4" />,
      badge: totalUnhanlded,
    },
    { id: 'comments', label: 'Bình luận bài viết', icon: <MessageCircle className="w-4 h-4" /> },
    { id: 'content', label: 'Tạo bài viết AI', icon: <Sparkles className="w-4 h-4 text-amber-500" /> },
    { id: 'calendar', label: 'Lịch đăng & Bài viết', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'prompts', label: 'Cấu hình Prompt AI', icon: <FileCode2 className="w-4 h-4" /> },
    { id: 'pages', label: 'Quản lý Fanpage', icon: <Layers className="w-4 h-4" />, badge: pages.length },
    { id: 'settings', label: 'Cài đặt & Webhook', icon: <Settings className="w-4 h-4" /> },
    ...(user?.role === 'admin'
      ? [{
          id: 'admin' as NavTab,
          label: 'Quản trị Admin',
          icon: <ShieldCheck className="w-4 h-4 text-purple-600" />,
          badgeText: 'Admin',
        }]
      : []),
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 h-screen sticky top-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-200 gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
          SA
        </div>
        <div>
          <span className="font-semibold text-sm text-slate-900 block leading-tight tracking-tight">
            SocialAgent AI
          </span>
          <span className="text-[11px] text-slate-500 block">
            Facebook AI Automation
          </span>
        </div>
      </div>

      {/* Fanpage Selector */}
      <div className="p-3 border-b border-slate-100">
        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block px-2 mb-1.5">
          Fanpage đang quản lý
        </label>
        <div className="relative">
          <select
            value={activePageId || ''}
            onChange={e => setActivePageId(Number(e.target.value))}
            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium truncate cursor-pointer"
          >
            {pages.map(p => (
              <option key={p.id} value={p.id}>
                {p.page_name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {activePage && (
          <div className="mt-2 px-2 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${activePage.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span>{activePage.is_active ? 'Đang hoạt động' : 'Tạm dừng'}</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">ID: {activePage.page_id.slice(-6)}</span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={isActive ? 'text-blue-600' : 'text-slate-500'}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.badgeText && (
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700">
                  {item.badgeText}
                </span>
              )}
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md ${
                    item.id === 'inbox' && item.badge > 0
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Human Support Alert notice if any */}
      {totalUnhanlded > 0 && (
        <div className="mx-3 mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block leading-tight">Cần hỗ trợ</span>
            <span className="text-[11px] text-rose-700 leading-tight block mt-0.5">
              Có {totalUnhanlded} hội thoại cần người thật xử lý.
            </span>
          </div>
        </div>
      )}

      {/* Footer Profile */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-semibold text-xs flex items-center justify-center shrink-0 uppercase shadow-xs">
            {user?.email ? user.email.charAt(0) : 'U'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-900 block truncate max-w-[95px]" title={user?.email || 'Mingo Administrator'}>
                {user?.email?.split('@')[0] || 'admin'}
              </span>
              {user?.role === 'admin' ? (
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 font-bold text-[9px] rounded uppercase shrink-0">
                  Admin
                </span>
              ) : (
                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-medium text-[9px] rounded uppercase shrink-0">
                  {user?.plan || 'PRO'}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-500 block truncate mt-0.5">
              Gói {user?.plan?.toUpperCase() || 'PRO'} • {pages.length}/{user?.max_pages || 5} Page
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer shrink-0"
          title="Thoát tài khoản"
          aria-label="Thoát tài khoản"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">Thoát</span>
        </button>
      </div>
    </aside>
  );
};
