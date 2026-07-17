/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ModuleView } from './components/ModuleView';
import { EngineerDashboard } from './components/EngineerDashboard';
import { ProfileView } from './components/ProfileView';
import { AuthView } from './components/AuthView';
import { AdminDashboard } from './components/AdminDashboard';
import { AppProvider, useAppContext } from './store';
import { Role } from './types';

const AppContent = () => {
  const { currentUser, authLoading, hasSession, authError, logout } = useAppContext();
  const [selectedModuleId, setSelectedModuleId] = useState<string>('m4');
  const [view, setView] = useState<'module' | 'profile'>('module');

  // Admin-only "preview as" mode: lets an admin look at the Sound Designer /
  // Audio Engineer views without actually changing anyone's real role or
  // signing in as anyone else. This is purely a client-side render toggle -
  // currentUser (and every Firestore write) is always the admin's own real,
  // authenticated identity. It resets whenever the signed-in user changes,
  // and is only ever readable/settable by someone whose *real* role is admin
  // (enforced below, not just hidden in the UI).
  const [previewRole, setPreviewRole] = useState<Role | null>(null);
  useEffect(() => {
    setPreviewRole(null);
  }, [currentUser?.id]);

  // Admin-only sidebar collapse toggle - purely a layout preference, not
  // persisted or role-gated beyond hiding the toggle control itself in
  // Sidebar (see isRealAdmin usage there).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Below the lg: breakpoint the sidebar renders as an off-canvas drawer
  // (see Sidebar.tsx) instead of taking a fixed 288px out of a phone-width
  // screen. Closed by default; opened via the hamburger button below.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isRealAdmin = currentUser?.role === 'admin';
  const effectiveRole: Role | undefined = isRealAdmin ? (previewRole ?? 'admin') : currentUser?.role;

  // Listen to custom event from sidebar to open profile
  useEffect(() => {
    const handleOpenProfile = () => setView('profile');
    const handleOpenModule = () => setView('module');
    window.addEventListener('open-profile', handleOpenProfile);
    window.addEventListener('open-module', handleOpenModule);
    return () => {
      window.removeEventListener('open-profile', handleOpenProfile);
      window.removeEventListener('open-module', handleOpenModule);
    };
  }, []);

  // Wait for Firebase Auth to report the real session before deciding
  // whether to show the sign-in screen - otherwise there's a flash of the
  // login page for already-signed-in users on every refresh.
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F5FAFF] text-gray-400 font-bold text-sm">
        Loading...
      </div>
    );
  }

  // Signed in (Firebase Auth confirms a real session) but no matching
  // /users/{uid} profile doc could be loaded - either it's still arriving
  // (rare race) or something failed while writing it during signup. Showing
  // the sign-in form here would be confusing since the person IS signed in;
  // show a clear message with a way out instead.
  if (hasSession && !currentUser) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-[#F5FAFF] px-6 text-center">
        <p className="text-sm font-bold text-gray-600 max-w-sm">
          {authError || "You're signed in, but we couldn't load your profile yet."}
        </p>
        <button
          onClick={logout}
          className="text-xs font-black uppercase tracking-wide text-white bg-[#2E9DF7] border-2 border-black px-5 py-2.5 rounded-full hover:bg-black transition-colors"
        >
          Sign out and try again
        </button>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView />;
  }

  const renderContent = () => {
    if (view === 'profile') {
      return <ProfileView />;
    }

    if (effectiveRole === 'sound_designer') {
      return <ModuleView moduleId={selectedModuleId} />;
    }

    if (effectiveRole === 'audio_engineer') {
      return <EngineerDashboard moduleId={selectedModuleId} />;
    }

    if (effectiveRole === 'admin') {
      return <AdminDashboard />;
    }
    return null;
  };

  return (
    <div className="flex h-screen w-full bg-[#F5FAFF] text-[#2D2D2D] font-sans overflow-hidden">
      <Sidebar
        selectedModuleId={selectedModuleId}
        setSelectedModuleId={(id) => {
          setSelectedModuleId(id);
          setView('module');
          setMobileSidebarOpen(false);
        }}
        isRealAdmin={isRealAdmin}
        previewRole={previewRole}
        onChangePreviewRole={setPreviewRole}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center gap-3 h-14 px-4 bg-white border-b-[3px] border-black flex-shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open menu"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center border-2 border-black rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <span className="font-black text-sm uppercase tracking-tight text-black truncate">Story Co Audio Academy</span>
        </div>
        {isRealAdmin && previewRole && (
          <div className="bg-[#F4511E] border-b-[3px] border-black text-white text-xs font-bold px-6 py-2 flex items-center justify-between flex-shrink-0">
            <span>
              👁 Previewing as {previewRole.replace('_', ' ')} - you're still signed in as admin, this is view-only for checking the experience.
            </span>
            <button
              onClick={() => setPreviewRole(null)}
              className="bg-white/20 hover:bg-white/30 border-2 border-black px-3 py-1 rounded-full transition-colors font-black uppercase text-[10px] tracking-wide"
            >
              Return to Admin View
            </button>
          </div>
        )}
        {renderContent()}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}


