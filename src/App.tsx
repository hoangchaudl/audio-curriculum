/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { WaitingView } from './components/WaitingView';
import { AdminHeader } from './components/AdminHeader';
import { NotificationBell } from './components/NotificationBell';
import { ProfileView } from './components/ProfileView';
import { AuthView } from './components/AuthView';
import { AccountSetupView } from './components/AccountSetupView';
import { AppProvider, useAppContext } from './store';
import { Role } from './types';
import { useApplyTheme, useResolvedTheme } from './theme';
import { ProgramOverview } from './components/assessment/ProgramOverview';
import { ContentPageView } from './components/assessment/ContentPageView';
import { AssignmentView } from './components/assessment/AssignmentView';
import { EpisodeView } from './components/assessment/EpisodeView';
import { SavedToast, SyncErrorBanner } from './components/assessment/ui';
// Loaded on demand so trainees never download the admin screens.
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const ReviewerQueue = lazy(() => import('./components/assessment/ReviewerQueue').then(m => ({ default: m.ReviewerQueue })));

// Modules are addressable via the URL hash (#/module/<id>) so each one has
// a shareable, bookmarkable link and the browser back/forward buttons work.
const getModuleIdFromHash = (): string => {
  const match = window.location.hash.match(/^#\/module\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : '';
};

type View = 'module' | 'profile' | 'program' | 'review' | 'episode' | 'assignment';
type EpisodeStage = 'B' | 'P1' | 'P2' | 'DA';

// Non-module pages of the assessment program, also addressable by hash so
// they're linkable and back/forward works: #/program, #/review, #/episode/B.
const getPageFromHash = (): { view: View; stage?: EpisodeStage; assignmentId?: string } | null => {
  const h = window.location.hash;
  const asg = h.match(/^#\/assignment\/(.+)$/);
  if (asg) return { view: 'assignment', assignmentId: decodeURIComponent(asg[1]) };
  if (h === '#/program' || h.startsWith('#/program/')) return { view: 'program' };
  if (h === '#/review') return { view: 'review' };
  const m = h.match(/^#\/episode\/(B|P1|P2|DA)$/);
  return m ? { view: 'episode', stage: m[1] as EpisodeStage } : null;
};

const AppContent = () => {
  const { currentUser, authLoading, hasSession, profileMissing, authError, logout, modules, enrollments, ownEnrollmentLoaded } = useAppContext();
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  useApplyTheme(useResolvedTheme(currentUser));
  const initialPage = useRef(getPageFromHash());
  const [view, setView] = useState<View>(initialPage.current?.view ?? 'module');
  const [episodeStage, setEpisodeStage] = useState<EpisodeStage>(initialPage.current?.stage ?? 'B');
  const [assignmentId, setAssignmentId] = useState<string>(initialPage.current?.assignmentId ?? '');

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

  // A module named in the URL (#/module/<id>) opens on load, so shared or
  // bookmarked lesson links land where they point. Otherwise the landing
  // page below (My Program / Review Queue) applies.
  const defaultAppliedForUser = useRef<string | null>(null);
  useEffect(() => {
    if (!currentUser || modules.length === 0) return;
    if (defaultAppliedForUser.current === currentUser.id) return;
    defaultAppliedForUser.current = currentUser.id;
    const fromHash = getModuleIdFromHash();
    if (fromHash && modules.some(m => m.id === fromHash)) setSelectedModuleId(fromHash);
  }, [currentUser, modules]);

  // Signing out forgets the page you were on, so the next sign-in starts
  // fresh instead of inheriting the last user's page (and URL).
  const signedInThisVisit = useRef(false);
  const hadUser = useRef(false);
  useEffect(() => {
    if (currentUser) { hadUser.current = true; return; }
    if (authLoading || hasSession) return;
    signedInThisVisit.current = true; // the sign-in screen is showing
    if (hadUser.current) {
      hadUser.current = false;
      setView('module');
      setSelectedModuleId('');
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [currentUser, authLoading, hasSession]);

  // Landing page, once per login, only when the URL didn't already name a
  // page: trainees start on My Program, reviewers and engineers on their
  // queue. Admins who just signed in always start on the dashboard
  // (Curriculum Management); a refresh keeps the page they're on.
  const landingAppliedForUser = useRef<string | null>(null);
  useEffect(() => {
    if (!currentUser || landingAppliedForUser.current === currentUser.id) return;
    if (currentUser.role === 'admin' && signedInThisVisit.current) {
      landingAppliedForUser.current = currentUser.id;
      setView('module');
      setSelectedModuleId('');
      if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }
    if (window.location.hash.startsWith('#/module/') || getPageFromHash()) { landingAppliedForUser.current = currentUser.id; return; }
    if (currentUser.role === 'reviewer' || currentUser.role === 'audio_engineer') {
      landingAppliedForUser.current = currentUser.id;
      window.location.hash = '#/review';
    } else if (currentUser.role === 'sound_designer' && enrollments.some(e => e.id === currentUser.id)) {
      landingAppliedForUser.current = currentUser.id;
      window.location.hash = '#/program';
    }
  }, [currentUser, enrollments]);

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
      const page = getPageFromHash();
      if (page) {
        setView(page.view);
        if (page.stage) setEpisodeStage(page.stage);
        if (page.assignmentId) setAssignmentId(page.assignmentId);
        return;
      }
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
      <div role="status" className="flex h-screen w-full items-center justify-center bg-page text-gray-400 font-bold text-sm">
        Loading...
      </div>
    );
  }

  // Signed in with no profile at all: a new (invite-only) sign-up that
  // still has to verify its email and be matched to an invite.
  if (hasSession && !currentUser && profileMissing && !authError) return <AccountSetupView />;

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
        <div role="status" className="flex h-screen w-full items-center justify-center bg-page text-gray-400 font-bold text-sm">
          Loading...
        </div>
      );
    }
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-page px-6 text-center">
        <p className="text-sm font-bold text-gray-600 max-w-sm">
          {authError || "You're signed in, but we couldn't load your profile yet."}
        </p>
        <button
          onClick={logout}
          className="text-xs font-bold uppercase tracking-wide text-white bg-[#2E9DF7] px-6 py-3 rounded-2xl transition-all shadow-[0_4px_0_#1b85df] active:shadow-none active:translate-y-[2px]"
        >
          Sign out and try again
        </button>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView />;
  }

  // A sound designer account that isn't enrolled yet waits here instead of
  // (real role, so an admin's preview isn't affected).
  const awaitingEnrollment = currentUser.role === 'sound_designer' && ownEnrollmentLoaded && !enrollments.some(e => e.id === currentUser.id);

  const renderContent = () => {
    if (view === 'profile') {
      return <ProfileView />;
    }
    if (awaitingEnrollment) return <WaitingView />;
    if (view === 'program') return <ProgramOverview />;
    if (view === 'episode') return <EpisodeView key={episodeStage} stage={episodeStage} />;
    if (view === 'review') return <ReviewerQueue />;
    if (view === 'assignment') return <AssignmentView key={assignmentId} assignmentId={assignmentId} />;

    // Admins manage lessons from the dashboard; everyone else reads a lesson
    // as a program content page (submissions happen on assignment pages).
    if (effectiveRole === 'admin') {
      return <AdminDashboard focusModuleId={selectedModuleId} focusNonce={moduleNavNonce} onPreview={setPreviewRole} />;
    }
    if (modules.some(m => m.id === selectedModuleId)) return <ContentPageView moduleId={selectedModuleId} />;
    // Nothing selected: a trainee's home is My Program; reviewers' and
    // engineers' is their review queue.
    if (effectiveRole === 'sound_designer') return <ProgramOverview />;
    if (effectiveRole === 'reviewer' || effectiveRole === 'audio_engineer') return <ReviewerQueue />;
    return null;
  };

  // Admins (not previewing) get no sidebar - the dashboard header carries
  // the brand and account menu; other pages get a slim bar back to it.
  const adminShell = isRealAdmin && !previewRole;
  if (adminShell) {
    const onDashboard = view === 'module';
    return (
      <div className="flex flex-col h-screen w-full bg-page text-ink font-sans overflow-hidden">
        {!onDashboard && <AdminHeader onPreview={setPreviewRole} onBack={() => { setView('module'); window.location.hash = ''; }} />}
        <Suspense fallback={<div role="status" className="flex-1 flex items-center justify-center text-gray-400 font-bold text-sm">Loading…</div>}>{renderContent()}</Suspense>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-page text-ink font-sans overflow-hidden">
      <Sidebar
        selectedModuleId={view === 'module' ? selectedModuleId : ''}
        activePage={view === 'episode' ? `episode:${episodeStage}` : view === 'assignment' ? `assignment:${assignmentId}` : view}
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
        <div className="lg:hidden flex items-center gap-3 h-14 px-4 bg-surface border-b flex-shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open menu"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-sky text-[#2E9DF7] hover:bg-[#2E9DF7]/20 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <span className="font-black text-sm uppercase tracking-tight text-[#2E9DF7] truncate">Story Co Audio Training Program</span>
          <div className="ml-auto"><NotificationBell align="right" light /></div>
        </div>
        {isRealAdmin && previewRole && (
          <div className="bg-[#F4511E] text-white text-xs font-bold px-6 py-2 shadow-md z-10 flex items-center justify-between flex-shrink-0">
            <span>
              👁 Previewing as {previewRole.replace('_', ' ')} - you're still signed in as admin, this is view-only for checking the experience.
            </span>
            <button
              onClick={() => setPreviewRole(null)}
              className="bg-surface text-[#F4511E] hover:bg-white/90 px-3 py-1 rounded-full transition-colors font-black uppercase text-[10px] tracking-wide shadow-sm"
            >
              Return to Admin View
            </button>
          </div>
        )}
        <Suspense fallback={<div role="status" className="flex-1 flex items-center justify-center text-gray-400 font-bold text-sm">Loading…</div>}>{renderContent()}</Suspense>
      </div>
    </div>
  );
};

// Save results and "couldn't load" alerts, for whoever is signed in (a
// fresh banner per account, so one user's alert never carries over).
const Alerts = () => {
  const { currentUser } = useAppContext();
  if (!currentUser) return null;
  return <><SavedToast /><SyncErrorBanner key={currentUser.id} /></>;
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
      <Alerts />
    </AppProvider>
  );
}


