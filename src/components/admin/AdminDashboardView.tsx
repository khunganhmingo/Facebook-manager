import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  Layers,
  Bot,
  Clock,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lock,
  Unlock,
  Trash2,
  TrendingUp,
  MessageSquare,
  MessageCircle,
  Check,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { AdminUserStats, AdminOverviewStats } from '../../types';

export const AdminDashboardView: React.FC = () => {
  const { user: currentUser, toast } = useAuth();
  const [users, setUsers] = useState<AdminUserStats[]>([]);
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'pro' | 'enterprise'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'expired' | 'blocked'>('all');

  // Renewal Modal
  const [selectedUser, setSelectedUser] = useState<AdminUserStats | null>(null);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewDaysToAdd, setRenewDaysToAdd] = useState<number | null>(30);
  const [customExpiryDate, setCustomExpiryDate] = useState('');
  const [renewMaxPages, setRenewMaxPages] = useState(5);
  const [renewMaxAgents, setRenewMaxAgents] = useState(10);
  const [renewPlan, setRenewPlan] = useState<'free' | 'pro' | 'enterprise'>('pro');
  const [renewRole, setRenewRole] = useState<'admin' | 'user'>('user');
  const [renewIsActive, setRenewIsActive] = useState(true);
  const [submittingRenew, setSubmittingRenew] = useState(false);

  // Create User Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [newPlan, setNewPlan] = useState<'free' | 'pro' | 'enterprise'>('pro');
  const [newMaxPages, setNewMaxPages] = useState(5);
  const [newMaxAgents, setNewMaxAgents] = useState(10);
  const [newSubDays, setNewSubDays] = useState(30);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [overviewRes, usersRes] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminUsers(),
      ]);

      if (overviewRes.success) {
        setStats(overviewRes.stats);
      }
      if (usersRes.success) {
        setUsers(usersRes.users);
      }
    } catch (err: any) {
      toast(err.message || 'Lỗi tải dữ liệu quản trị', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenRenew = (u: AdminUserStats) => {
    setSelectedUser(u);
    setRenewDaysToAdd(30);
    setCustomExpiryDate(u.subscription_expires_at ? u.subscription_expires_at.replace(' ', 'T').substring(0, 16) : '');
    setRenewMaxPages(u.max_pages);
    setRenewMaxAgents(u.max_agents);
    setRenewPlan(u.plan);
    setRenewRole(u.role);
    setRenewIsActive(u.is_active);
    setRenewModalOpen(true);
  };

  const handleSaveRenew = async () => {
    if (!selectedUser) return;
    setSubmittingRenew(true);
    try {
      const payload: any = {
        max_pages: renewMaxPages,
        max_agents: renewMaxAgents,
        plan: renewPlan,
        role: renewRole,
        is_active: renewIsActive,
      };

      if (customExpiryDate) {
        payload.subscription_expires_at = customExpiryDate.replace('T', ' ') + ':00';
      } else if (renewDaysToAdd) {
        payload.add_days = renewDaysToAdd;
      }

      const res = await api.renewUserQuota(selectedUser.id, payload);
      if (res.success) {
        toast(res.message || 'Gia hạn và cập nhật hạn mức thành công!', 'success');
        setRenewModalOpen(false);
        fetchData();
      }
    } catch (err: any) {
      toast(err.message || 'Lỗi khi gia hạn tài khoản', 'error');
    } finally {
      setSubmittingRenew(false);
    }
  };

  const handleToggleStatus = async (userId: number, currentEmail: string) => {
    try {
      const res = await api.toggleUserStatus(userId);
      if (res.success) {
        toast(res.message, 'success');
        setUsers(prev =>
          prev.map(u => (u.id === userId ? { ...u, is_active: res.is_active, status: !res.is_active ? 'blocked' : (u.days_remaining < 0 ? 'expired' : 'active') } : u))
        );
        fetchData();
      }
    } catch (err: any) {
      toast(err.message || 'Lỗi khi đổi trạng thái', 'error');
    }
  };

  const handleDeleteUser = async (userId: number, email: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản ${email} và toàn bộ Fanpage/tin nhắn liên quan?`)) {
      return;
    }
    try {
      const res = await api.deleteAdminUser(userId);
      if (res.success) {
        toast(res.message, 'success');
        setUsers(prev => prev.filter(u => u.id !== userId));
        fetchData();
      }
    } catch (err: any) {
      toast(err.message || 'Lỗi khi xóa người dùng', 'error');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      toast('Vui lòng điền đầy đủ email và mật khẩu', 'warning');
      return;
    }
    setSubmittingCreate(true);
    try {
      const res = await api.createAdminUser({
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        plan: newPlan,
        max_pages: newMaxPages,
        max_agents: newMaxAgents,
        subscription_days: newSubDays,
      });
      if (res.success) {
        toast(res.message, 'success');
        setCreateModalOpen(false);
        setNewEmail('');
        setNewPassword('');
        fetchData();
      }
    } catch (err: any) {
      toast(err.message || 'Lỗi khi tạo tài khoản', 'error');
    } finally {
      setSubmittingCreate(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchPlan = planFilter === 'all' || u.plan === planFilter;
      const matchStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchSearch && matchPlan && matchStatus;
    });
  }, [users, searchQuery, planFilter, statusFilter]);

  const calculatedProjectedExpiry = useMemo(() => {
    if (customExpiryDate) {
      return new Date(customExpiryDate).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    if (!selectedUser || !renewDaysToAdd) return 'Chưa chọn';
    const base = selectedUser.subscription_expires_at
      ? new Date(selectedUser.subscription_expires_at).getTime()
      : Date.now();
    const start = base > Date.now() ? base : Date.now();
    const proj = new Date(start + renewDaysToAdd * 86400000);
    return proj.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedUser, renewDaysToAdd, customExpiryDate]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Khu vực Quản trị Hệ thống
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-medium">
              Real-time Multi-tenant
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Quản trị Tài khoản & Thống kê Tài nguyên User
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            Theo dõi lượng Facebook liên kết, số lượng AI Agent lưu trữ, phân loại hạn mức và gia hạn thời gian sử dụng cho từng người dùng.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-medium rounded-lg backdrop-blur-sm border border-white/10 transition-all cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm tài khoản mới</span>
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-500 block">Tổng Tài khoản User</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-slate-900">{stats.total_users}</span>
                <span className="text-[11px] text-emerald-600 font-medium">
                  {stats.active_users} hoạt động
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block truncate">
                {stats.expired_users} hết hạn / tạm khóa
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-500 block">Facebook Pages Liên Kết</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-slate-900">{stats.total_pages}</span>
                <span className="text-[11px] text-indigo-600 font-medium">Toàn hệ thống</span>
              </div>
              <span className="text-[11px] text-slate-400 block truncate">
                Được giám sát & auto-reply
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-500 block">AI Agent Đang Lưu Trữ</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-slate-900">{stats.total_agents}</span>
                <span className="text-[11px] text-purple-600 font-medium">Config Engine</span>
              </div>
              <span className="text-[11px] text-slate-400 block truncate">
                Gemini, OpenAI, DeepSeek, Claude...
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-500 block">Tương Tác Tự Động (AI)</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-slate-900">{stats.total_messages + stats.total_comments}</span>
                <span className="text-[11px] text-emerald-600 font-semibold">{stats.ai_reply_rate}% tự động</span>
              </div>
              <span className="text-[11px] text-slate-400 block truncate">
                {stats.total_messages} tin nhắn • {stats.total_comments} cmt
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo email người dùng..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
            {(['all', 'free', 'pro', 'enterprise'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPlanFilter(p)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition-all cursor-pointer ${
                  planFilter === p
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {p === 'all' ? 'Tất cả gói' : p}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">🟢 Đang hoạt động</option>
            <option value="expiring_soon">🟡 Sắp hết hạn (≤ 7 ngày)</option>
            <option value="expired">🔴 Đã hết hạn</option>
            <option value="blocked">⚫ Đã khóa</option>
          </select>
        </div>
      </div>

      {/* Users Management Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Danh Sách Tài Khoản Người Dùng ({filteredUsers.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Click vào nút <strong>"Gia hạn & Hạn mức"</strong> để điều chỉnh thời hạn hoặc tăng số lượng Facebook/Agent
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            Đang tải dữ liệu tài khoản và hạn mức...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Không tìm thấy tài khoản nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Người Dùng</th>
                  <th className="px-4 py-3">Facebook Pages</th>
                  <th className="px-4 py-3">AI Agents Lưu Trữ</th>
                  <th className="px-4 py-3 text-center">Tương Tác</th>
                  <th className="px-4 py-3">Thời Hạn Sử Dụng</th>
                  <th className="px-5 py-3 text-right">Thao Tác Quản Trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredUsers.map(u => {
                  const isCurrentAdmin = u.id === currentUser?.id;
                  const pageUsagePercent = Math.min(100, Math.round((u.pages_count / (u.max_pages || 1)) * 100));
                  const agentUsagePercent = Math.min(100, Math.round((u.agents_count / (u.max_agents || 1)) * 100));

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {u.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 text-xs truncate">
                                {u.email}
                              </span>
                              {isCurrentAdmin && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-100 text-blue-700 font-semibold">
                                  Bạn (Admin)
                                </span>
                              )}
                              {u.role === 'admin' && !isCurrentAdmin && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-100 text-purple-700 font-semibold">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${
                                u.plan === 'enterprise'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : u.plan === 'pro'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {u.plan}
                              </span>
                              <span className="text-[11px] text-slate-400">ID #{u.id}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-1 max-w-[150px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-900">
                              {u.pages_count} / {u.max_pages}
                            </span>
                            <span className="text-[10px] text-slate-400">{pageUsagePercent}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                pageUsagePercent >= 100
                                  ? 'bg-rose-500'
                                  : pageUsagePercent >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-indigo-600'
                              }`}
                              style={{ width: `${pageUsagePercent}%` }}
                            />
                          </div>
                          {u.pages && u.pages.length > 0 && (
                            <span className="text-[10px] text-slate-500 block truncate" title={u.pages.map(p => p.page_name).join(', ')}>
                              {u.pages[0].page_name} {u.pages.length > 1 ? `(+${u.pages.length - 1})` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-1 max-w-[150px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-900">
                              {u.agents_count} / {u.max_agents}
                            </span>
                            <span className="text-[10px] text-slate-400">{agentUsagePercent}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                agentUsagePercent >= 100
                                  ? 'bg-rose-500'
                                  : agentUsagePercent >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-purple-600'
                              }`}
                              style={{ width: `${agentUsagePercent}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            Đã lưu {u.agents_count} cấu hình
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                          <span className="flex items-center gap-1 text-blue-700" title="Tổng tin nhắn Messenger">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {u.messages_count}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="flex items-center gap-1 text-emerald-700" title="Tổng bình luận Facebook">
                            <MessageCircle className="w-3.5 h-3.5" />
                            {u.comments_count}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {u.status === 'blocked' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                              <Lock className="w-3 h-3 text-slate-500" />
                              Tạm khóa
                            </span>
                          ) : u.status === 'expired' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Đã hết hạn ({Math.abs(u.days_remaining)} ngày)
                            </span>
                          ) : u.status === 'expiring_soon' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Còn {u.days_remaining} ngày
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Còn {u.days_remaining} ngày
                            </span>
                          )}

                          <span className="text-[11px] text-slate-400 block font-mono">
                            {u.subscription_expires_at
                              ? new Date(u.subscription_expires_at).toLocaleDateString('vi-VN')
                              : 'Vô thời hạn'}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenRenew(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            title="Gia hạn thời gian sử dụng & Cấu hình hạn mức"
                          >
                            <Zap className="w-3.5 h-3.5 text-blue-600" />
                            <span>Gia hạn & Hạn mức</span>
                          </button>

                          {!isCurrentAdmin && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(u.id, u.email)}
                                className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                                  u.is_active
                                    ? 'border-slate-200 text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                    : 'border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                                }`}
                                title={u.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                              >
                                {u.is_active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Xóa tài khoản"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RENEW MODAL */}
      {renewModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Gia Hạn & Cấu Hình Hạn Mức Tài Khoản
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedUser.email} (ID #{selectedUser.id})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setRenewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                <div>
                  <span className="text-[11px] text-slate-500 block">Facebook hiện tại</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                    {selectedUser.pages_count} / {selectedUser.max_pages}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Agent hiện tại</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                    {selectedUser.agents_count} / {selectedUser.max_agents}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Hạn hiện tại</span>
                  <span className="text-xs font-semibold text-slate-900 mt-0.5 block truncate">
                    {selectedUser.subscription_expires_at
                      ? new Date(selectedUser.subscription_expires_at).toLocaleDateString('vi-VN')
                      : 'Vô thời hạn'}
                  </span>
                </div>
              </div>

              {/* 1. Gia hạn thời gian sử dụng */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  1. Gia Hạn Thời Gian Sử Dụng
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: '+30 ngày', days: 30 },
                    { label: '+90 ngày', days: 90 },
                    { label: '+180 ngày', days: 180 },
                    { label: '+1 năm', days: 365 },
                    { label: '+2 năm', days: 730 },
                  ].map(item => (
                    <button
                      key={item.days}
                      type="button"
                      onClick={() => {
                        setRenewDaysToAdd(item.days);
                        setCustomExpiryDate('');
                      }}
                      className={`px-2 py-2 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                        renewDaysToAdd === item.days && !customExpiryDate
                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="pt-1.5">
                  <label className="text-[11px] text-slate-500 mb-1 block">Hoặc chọn ngày hết hạn cụ thể:</label>
                  <input
                    type="datetime-local"
                    value={customExpiryDate}
                    onChange={e => {
                      setCustomExpiryDate(e.target.value);
                      setRenewDaysToAdd(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-lg text-blue-800 text-[11px] flex items-center justify-between">
                  <span>Dự kiến thời hạn mới sau khi gia hạn:</span>
                  <strong className="text-xs font-bold">{calculatedProjectedExpiry}</strong>
                </div>
              </div>

              {/* 2. Gia hạn số lượng Facebook Page */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    2. Gia Hạn Số Lượng Facebook Page Sử Dụng
                  </label>
                  <span className="text-xs font-bold text-indigo-700 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md">
                    Tối đa {renewMaxPages} Fanpage
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[3, 5, 10, 20, 50, 100].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setRenewMaxPages(cnt)}
                      className={`flex-1 py-1.5 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                        renewMaxPages === cnt
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={renewMaxPages}
                  onChange={e => setRenewMaxPages(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* 3. Gia hạn số lượng AI Agent Lưu Trữ */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Bot className="w-3.5 h-3.5 text-purple-600" />
                    3. Gia Hạn Số Lượng AI Agent Lưu Trữ
                  </label>
                  <span className="text-xs font-bold text-purple-700 px-2 py-0.5 bg-purple-50 border border-purple-100 rounded-md">
                    Tối đa {renewMaxAgents} Agent
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[5, 10, 20, 50, 100].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setRenewMaxAgents(cnt)}
                      className={`flex-1 py-1.5 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                        renewMaxAgents === cnt
                          ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={renewMaxAgents}
                  onChange={e => setRenewMaxAgents(Number(e.target.value))}
                  className="w-full accent-purple-600"
                />
              </div>

              {/* 4. Gói Dịch Vụ & Quyền Hạn */}
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 mb-1 block">Gói Dịch Vụ (Plan):</label>
                  <select
                    value={renewPlan}
                    onChange={e => setRenewPlan(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="free">Gói Free</option>
                    <option value="pro">Gói Pro (Khuyên dùng)</option>
                    <option value="enterprise">Gói Enterprise (Doanh nghiệp)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 mb-1 block">Vai Trò Hệ Thống (Role):</label>
                  <select
                    value={renewRole}
                    onChange={e => setRenewRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="user">User Thông Thường</option>
                    <option value="admin">Quản Trị Viên (Admin)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRenewModalOpen(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveRenew}
                disabled={submittingRenew}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {submittingRenew ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Xác nhận Gia hạn & Lưu cấu hình</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Thêm Tài Khoản Người Dùng Mới</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Email Đăng Nhập:</label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Mật Khẩu Khởi Tạo:</label>
                <input
                  type="password"
                  required
                  placeholder="Tối thiểu 6 ký tự"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Gói Dịch Vụ:</label>
                  <select
                    value={newPlan}
                    onChange={e => setNewPlan(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Phân Quyền:</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Số Facebook:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newMaxPages}
                    onChange={e => setNewMaxPages(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Số Agent:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newMaxAgents}
                    onChange={e => setNewMaxAgents(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Thời Hạn:</label>
                  <select
                    value={newSubDays}
                    onChange={e => setNewSubDays(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value={30}>30 ngày</option>
                    <option value={90}>90 ngày</option>
                    <option value={365}>1 năm</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {submittingCreate ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
