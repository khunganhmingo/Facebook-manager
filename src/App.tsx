/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Sidebar, type NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { InboxView } from './components/inbox/InboxView';
import { CommentsView } from './components/comments/CommentsView';
import { ContentGeneratorView } from './components/content/ContentGeneratorView';
import { CalendarView } from './components/calendar/CalendarView';
import { useAuth } from './context/AuthContext';
import { LoginView } from './components/auth/LoginView';
import { PromptManagerView } from './components/prompts/PromptManagerView';
import { PagesView } from './components/pages/PagesView';
import { SettingsView } from './components/settings/SettingsView';
import { AdminDashboardView } from './components/admin/AdminDashboardView';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans antialiased text-slate-900">
      {/* Fixed Left Sidebar */}
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Contract */}
        <Header
          currentTab={currentTab}
          onOpenCreatePost={() => setCurrentTab('content')}
          onRefresh={handleRefresh}
        />

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto">
          {currentTab === 'dashboard' && (
            <DashboardView key={`dash-${refreshTrigger}`} onNavigate={setCurrentTab} />
          )}
          {currentTab === 'inbox' && (
            <InboxView key={`inbox-${refreshTrigger}`} />
          )}
          {currentTab === 'comments' && (
            <CommentsView key={`cmt-${refreshTrigger}`} />
          )}
          {currentTab === 'content' && (
            <ContentGeneratorView
              onNavigateToCalendar={() => setCurrentTab('calendar')}
              onScheduleCreated={() => setCurrentTab('calendar')}
            />
          )}
          {currentTab === 'calendar' && (
            <CalendarView
              key={`cal-${refreshTrigger}`}
              onOpenCreatePost={() => setCurrentTab('content')}
            />
          )}
          {currentTab === 'prompts' && (
            <PromptManagerView key={`prm-${refreshTrigger}`} />
          )}
          {currentTab === 'pages' && (
            <PagesView key={`pg-${refreshTrigger}`} />
          )}
          {currentTab === 'settings' && (
            <SettingsView key={`set-${refreshTrigger}`} />
          )}
          {currentTab === 'admin' && (
            <AdminDashboardView key={`adm-${refreshTrigger}`} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
