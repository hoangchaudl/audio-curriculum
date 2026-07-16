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
      <div className="flex h-screen w-full items-center justify-center bg-[#FDFDFB] text-gray-400 font-bold text-sm">
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
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-[#FDFDFB] px-6 text-center">
        <p className="text-sm font-bold text-gray-600 max-w-sm">
          {authError || "You're signed in, but we couldn't load your profile yet."}
        </p>
        <button
          onClick={logout}
          className="text-xs font-bold text-white bg-[#2E9DF7] px-5 py-2.5 rounded-full hover:bg-[#1b85df] transition-colors"
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
    <div className="flex h-screen w-full bg-[#FDFDFB] text-[#2D2D2D] font-sans overflow-hidden">
      <Sidebar
        selectedModuleId={selectedModuleId}
        setSelectedModuleId={(id) => {
          setSelectedModuleId(id);
          setView('module');
        }}
        isRealAdmin={isRealAdmin}
        previewRole={previewRole}
        onChangePreviewRole={setPreviewRole}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {isRealAdmin && previewRole && (
          <div className="bg-[#F4511E] text-white text-xs font-bold px-6 py-2 flex items-center justify-between flex-shrink-0">
            <span>
              👁 Previewing as {previewRole.replace('_', ' ')} - you're still signed in as admin, this is view-only for checking the experience.
            </span>
            <button
              onClick={() => setPreviewRole(null)}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
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


