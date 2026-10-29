import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, LogIn, Sparkles, User, CheckCircle2, Lock } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Email hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string = 'admin123') => {
    setEmail(demoEmail);
    setPassword(demoPass);
    try {
      setLoading(true);
      setError(null);
      await login(demoEmail, demoPass);
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center mx-auto mb-3 text-white font-bold text-xl shadow-inner">
            SA
          </div>
          <h1 className="text-xl font-bold tracking-tight">SocialAgent AI</h1>
          <p className="text-xs text-blue-100 mt-1">
            Hệ thống Quản lý Facebook & Phản hồi Tự động AI
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-5 text-center">
            <h2 className="text-base font-semibold text-slate-800">Đăng nhập tài khoản</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Đăng nhập để quản lý Fanpage và kích hoạt AI Agent
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tenban@gmail.com"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Đang xử lý...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
              Tài khoản mẫu thử nghiệm
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('khunganhredepmingo@gmail.com', 'admin123')}
                disabled={loading}
                className="w-full text-left p-2.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-purple-900">khunganhredepmingo@gmail.com</span>
                    <span className="px-1.5 py-0.2 bg-purple-200 text-purple-800 text-[9px] font-bold rounded uppercase">Admin</span>
                  </div>
                  <span className="text-[10px] text-purple-700 block">Quyền quản trị toàn hệ thống • Gói Enterprise</span>
                </div>
                <LogIn className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('shopgiasi@gmail.com', 'admin123')}
                disabled={loading}
                className="w-full text-left p-2.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-blue-900">shopgiasi@gmail.com</span>
                    <span className="px-1.5 py-0.2 bg-blue-200 text-blue-800 text-[9px] font-bold rounded uppercase">Pro</span>
                  </div>
                  <span className="text-[10px] text-blue-700 block">User chuẩn • Đang quản lý 2 Fanpage</span>
                </div>
                <LogIn className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('mypham.zen@gmail.com', 'admin123')}
                disabled={loading}
                className="w-full text-left p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-800">mypham.zen@gmail.com</span>
                    <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[9px] font-bold rounded uppercase">Free</span>
                  </div>
                  <span className="text-[10px] text-slate-600 block">User gói miễn phí</span>
                </div>
                <LogIn className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
