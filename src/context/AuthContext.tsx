import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setStoredToken, clearStoredToken } from '../services/api';
import type { User, FacebookPage } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  pages: FacebookPage[];
  activePage: FacebookPage | null;
  activePageId: number | null;
  setActivePageId: (id: number) => void;
  refreshPages: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [activePageId, setActivePageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const toast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  const refreshPages = useCallback(async () => {
    try {
      const res = await api.getPages();
      if (res.success && res.pages) {
        setPages(res.pages);
        if (res.pages.length > 0) {
          setActivePageId(prev => (prev && res.pages.some(p => p.id === prev) ? prev : res.pages[0].id));
        }
      }
    } catch (err: any) {
      console.warn('Failed to load pages:', err.message);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await api.getProfile();
      if (res.success && res.user) {
        setUser(res.user);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const isLoggedOut = localStorage.getItem('socialagent_logged_out') === 'true';
        if (!isLoggedOut) {
          await refreshProfile();
          await refreshPages();
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [refreshProfile, refreshPages]);

  const login = async (email: string, pass: string) => {
    const res = await api.login({ email, password: pass });
    if (res.success) {
      localStorage.removeItem('socialagent_logged_out');
      setStoredToken(res.token);
      setUser(res.user);
      await refreshPages();
      toast('Đăng nhập thành công!', 'success');
    }
  };

  const logout = () => {
    clearStoredToken();
    try {
      localStorage.setItem('socialagent_logged_out', 'true');
    } catch {}
    setUser(null);
    setPages([]);
    setActivePageId(null);
    toast('Đã thoát tài khoản thành công', 'info');
  };

  const activePage = pages.find(p => p.id === activePageId) || pages[0] || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        pages,
        activePage,
        activePageId,
        setActivePageId,
        refreshPages,
        refreshProfile,
        login,
        logout,
        toast,
        toastMessage,
      }}
    >
      {children}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
            toastMessage.type === 'success'
              ? 'bg-slate-900 text-emerald-400 border border-emerald-500/30'
              : toastMessage.type === 'error'
              ? 'bg-slate-900 text-rose-400 border border-rose-500/30'
              : 'bg-slate-900 text-slate-100 border border-slate-700'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs ml-2"
            aria-label="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
