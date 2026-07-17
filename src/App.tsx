/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ModuleView } from './components/ModuleView';
import { EngineerDashboard } from './components/EngineerDashboard';
import { ProfileView } from './components/ProfileView';
import { AuthView } from './components/AuthView';
import { AdminDashboard } from './components/AdminDashboard';
import { AppProvider, useAppContext } from './store';
import { Role } from './types';
import { getNextActionableModule } from './progress';

// Modules are addressable via the URL hash (#/module/<id>) so each one has
// a shareable, bookmarkable link and the browser back/forward buttons work.
const getModuleIdFromHash = (): string => {
  const match = window.location.hash.match(/^#\/module\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : '';
};

const AppContent = () => {
  const { currentUser, authLoading, hasSession, authError, logout, modules, submissions, submissionsLoaded } = useAppContext();
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [view, setView] = useState<'module' | 'profile'>('module');

  // hasSession-but-no-currentUser is a normal, brief gap on every sign-in
  // (Firebase Auth resolves before the /users/{uid} listener's first
  // snapshot arrives) and especially on sign-up (that snapshot can arrive
  // before the profile doc write finishes). It used to jump straight to a
  // "couldn't load your profile, sign out and try again" error screen for
  // that entire window, which read as a broken sign-in on every attempt.
  // Now it only escalates to that error state if the gap actually persists.
  const [profileLoadTimedOut, setProfileLoadTimedOut] = useState(false);
  useEffect(() => {
    if (!hasSession || currentUser) {
      setProfileLoadTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setProfileLoadTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [hasSession, currentUser]);

  // Lands a student on the module they should actually work on next
  // (first without a graded submission) instead of a hardcoded module id -
  // previously every new student's first screen was module 6 of 11. Runs
  // once per login: the ref guard stops it from yanking the student back to
  // "next actionable" after they've deliberately navigated elsewhere. Waits
  // on submissionsLoaded for designers specifically, so it doesn't compute
  // "next" off a still-empty submissions array on the very first render.
  const defaultAppliedForUser = useRef<string | null>(null);
  useEffect(() => {
    if (!currentUser || modules.length === 0) return;
    if (currentUser.role === 'sound_designer' && !submissionsLoaded) return;
    if (defaultAppliedForUser.current === currentUser.id) return;
    defaultAppliedForUser.current = currentUser.id;
    // A module named in the URL (#/module/<id>) wins over the computed
    // default, so shared/bookmarked module links land where they point.
    const fromHash = getModuleIdFromHash();
    if (fromHash && modules.some(m => m.id === fromHash)) {
      setSelectedModuleId(fromHash);
      return;
    }
    const sorted = [...modules].sort((a, b) => a.order - b.order);
    const nextId = currentUser.role === 'sound_designer'
      ? getNextActionableModule(modules, submissions, currentUser.id)?.id
      : sorted[0]?.id;
    if (nextId) setSelectedModuleId(nextId);
  }, [currentUser, modules, submissions, submissionsLoaded]);

  // Keep the URL hash in sync with the selected module so every module has
  // its own link. Assigning location.hash pushes a history entry, which is
  // what makes browser back/forward step through visited modules.
  useEffect(() => {
    if (!selectedModuleId || view !== 'module') return;
    const target = `#/module/${selectedModuleId}`;
    if (window.location.hash !== target) window.location.hash = target;
  }, [selectedModuleId, view]);

  // Bumped every time the sidebar is used to jump to a module - lets
  // AdminDashboard tell "the admin just clicked a module in the sidebar"
  // apart from "selectedModuleId already happened to have this value when
  // I mounted" (see focusNonce prop below).
  const [moduleNavNonce, setModuleNavNonce] = useState(0);

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

  // Handle the browser back/forward buttons (and pasted #/module/<id>
  // links after the app is already open): parse the hash and select that
  // module. Setting the same id again is a no-op, so the hash-sync effect
  // above and this listener don't loop.
  useEffect(() => {
    const handleHashChange = () => {
      const id = getModuleIdFromHash();
      if (!id) return;
      setSelectedModuleId(id);
      setView('module');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
  // /users/{uid} profile doc has arrived yet. Almost always this resolves
  // within a second (the listener just needs a round trip, or - on
  // sign-up - the profile doc write to finish) - show the same loading
  // spinner as authLoading for that window instead of alarming the user.
  // Only escalate to a real error state if it's an actual Firestore error
  // (authError) or the gap has genuinely persisted (profileLoadTimedOut).
  if (hasSession && !currentUser) {
    if (!authError && !profileLoadTimedOut) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-[#F5FAFF] text-gray-400 font-bold text-sm">
          Loading...
        </div>
      );
    }
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

    // selectedModuleId is briefly '' on first render while the "next
    // actionable module" effect above resolves - show a loading state
    // instead of letting ModuleView/EngineerDashboard flash "Module not
    // found" for an id that hasn't been picked yet.
    if (!selectedModuleId && (effectiveRole === 'sound_designer' || effectiveRole === 'audio_engineer')) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-400 font-bold text-sm">
          Loading your course...
        </div>
      );
    }

    if (effectiveRole === 'sound_designer') {
      return <ModuleView moduleId={selectedModuleId} />;
    }

    if (effectiveRole === 'audio_engineer') {
      return <EngineerDashboard moduleId={selectedModuleId} />;
    }

    if (effectiveRole === 'admin') {
      return <AdminDashboard focusModuleId={selectedModuleId} focusNonce={moduleNavNonce} />;
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
          setModuleNavNonce(n => n + 1);
        }}
        isRealAdmin={isRealAdmin}
        effectiveRole={effectiveRole}
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


