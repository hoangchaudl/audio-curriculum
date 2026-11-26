import { useT, useLanguage, LanguageSwitch } from './language';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { GoogleAuthProvider, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { BookOpen, CalendarDays, ClipboardCheck, FolderOpen, Home, Users, Video, FileText } from 'lucide-react';
import { auth } from '../firebase';
import { useApplyTheme, setStoredTheme } from '../theme';
import { ThemeToggle } from '../components/ThemeToggle';
import { AuthShell } from '../components/AuthShell';
import { card, input, primaryBtn, secondaryBtn } from '../components/assessment/ui';
import { ContentType, OpsAccess, Route, SECTIONS, canEdit, parseRoute } from './model';
import { OpsSession, useOpsContent, useOpsSession } from './data';
import { NamingBuilder } from './NamingBuilder';
import { DetailPage, HomePage, ListPage } from './pages';

// Only editors/admins ever load the editor and access screens.
const EditorPage = lazy(() => import('./Editor').then(m => ({ default: m.EditorPage })));
const AccessPage = lazy(() => import('./AccessAdmin').then(m => ({ default: m.AccessPage })));

const useRoute = () => {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
};

const useOsTheme = () => {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const q = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setDark(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return dark ? 'dark' : 'light';
};

// The Hub's own light/dark choice, remembered on this device (Hub-only people have no
// account profile to save it in) and shared by every toggle on the page.
type Theme = 'light' | 'dark';
const readTheme = (): Theme | null => { try { const v = localStorage.getItem('opsTheme'); return v === 'light' || v === 'dark' ? v : null; } catch { return null; } };
const useStoredTheme = () => {
  const [theme, setTheme] = useState<Theme | null>(readTheme);
  useEffect(() => {
    const on = () => setTheme(readTheme());
    window.addEventListener('ops-theme', on);
    return () => window.removeEventListener('ops-theme', on);
  }, []);
  return theme;
};
const setHubTheme = (dark: boolean) => setStoredTheme(dark ? 'dark' : 'light');
const HubThemeToggle: React.FC = () => {
  const stored = useStoredTheme();
  const os = useOsTheme();
  return <ThemeToggle isDark={(stored ?? os) === 'dark'} onChange={setHubTheme} />;
};

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const t = useT();
  return (
  <main className="min-h-screen w-full bg-page text-ink font-sans flex items-center justify-center p-4">
    <div className={`${card} w-full max-w-md space-y-4`}>
      <div className="flex items-center gap-3">
        <img src="/storyco-logo-light.png" alt="" className="w-10 h-auto rounded-md shadow-md dark:hidden" />
        <img src="/storyco-logo-dark.png" alt="" className="w-10 h-auto rounded-md shadow-md hidden dark:block" />
        <h1 className="font-display font-bold text-xl text-gray-800">{t("StoryCo Audio Hub")}</h1>
      </div>
      <div className="flex items-center justify-between gap-3"><LanguageSwitch /><HubThemeToggle /></div>
      {children}
    </div>
  </main>
  );
};

const AUTH_ERRORS: Record<string, string> = {
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Could not reach the server. Check your connection.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'Enter a valid email address.',
};

const SignIn: React.FC = () => {
  const t = useT();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const switchMode = (m: typeof mode) => { setMode(m); setError(''); setNotice(''); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setNotice('');
    setBusy(true);
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice('If an account exists for that email, a reset link is on its way.');
      } else if (mode === 'signup') {
        const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(user);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(AUTH_ERRORS[code] ?? (mode === 'signup' ? 'Could not create the account. Try again.' : 'Incorrect email or password.'));
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    setError('');
    setBusy(true);
    try {
      // `hd` only pre-selects the story.co account; Hub access is still the admin's Access list.
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ hd: 'story.co', prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(code === 'auth/network-request-failed' ? t('Could not reach the server. Check your connection.')
          : code === 'auth/popup-blocked' ? t('The sign-in window was blocked. Allow pop-ups and try again.')
          : t('Could not sign in with Google. Try again.'));
      }
    } finally {
      setBusy(false);
    }
  };
  const { language, setLanguage } = useLanguage();
  const stored = useStoredTheme();
  const os = useOsTheme();
  return (
    <AuthShell subtitle={t("Audio Hub")}
      language={{ label: t('Language'), value: language, onChange: setLanguage }}
      isDark={(stored ?? os) === 'dark'} onTheme={setHubTheme}
      back={<a href="/">← {t("Choose another place")}</a>}>
        <div className="bg-surface rounded-2xl p-8 shadow-2xl border-4 border-surface">
          {mode !== 'reset' && (
            <div className="flex gap-4 mb-8">
              {(['signin', 'signup'] as const).map(m => (
                <button key={m} type="button" onClick={() => switchMode(m)}
                  className={`flex-1 font-bold py-3 rounded-2xl transition-all ${mode === m ? 'bg-brand text-white active:translate-y-[2px] active:shadow-none' : 'bg-sky text-navy hover:bg-brand/20'}`}>
                  {t(m === 'signin' ? 'Sign In' : 'Sign Up')}
                </button>
              ))}
            </div>
          )}
          {mode === 'reset' && <h2 className="text-lg font-bold text-brand mb-6">{t('Reset your password')}</h2>}
          {error && <p role="alert" className="bg-rose text-ember px-4 py-3 rounded-2xl text-xs font-bold mb-4">{t(error)}</p>}
          {notice && <p role="status" className="bg-sky text-navy px-4 py-3 rounded-2xl text-xs font-bold mb-4">{t(notice)}</p>}
          {mode !== 'reset' && (
            <>
              <button type="button" onClick={google} disabled={busy} className="w-full bg-sky text-navy font-bold py-4 rounded-2xl hover:bg-brand/20 transition-colors text-sm disabled:opacity-60">{t('Continue with Google')}</button>
              <p className="text-center text-xs font-bold text-gray-400 my-4">{t("or use your email")}</p>
            </>
          )}
          {mode === 'reset' && <p className="text-xs text-gray-500 font-bold mb-4">{t("Enter the email on your account and we'll send you a reset link.")}</p>}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="hub-email" className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">{t("Email")}</label>
              <input id="hub-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand transition-all font-medium" />
            </div>
            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1 ml-1 mr-1">
                  <label htmlFor="hub-password" className="block text-xs font-bold text-gray-500 uppercase">{t("Password")}</label>
                  {mode === 'signin' && <button type="button" onClick={() => switchMode('reset')} className="text-xs font-bold text-brand hover:underline">{t("Forgot password?")}</button>}
                </div>
                <input id="hub-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 6 : undefined} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-brand transition-all font-medium" />
                {mode === 'signup' && <p className="text-[10px] text-gray-400 mt-1 ml-1">{t("Minimum 6 characters.")}</p>}
              </div>
            )}
            <button type="submit" disabled={busy} className="w-full bg-warm text-white font-bold py-4 rounded-2xl transition-all text-sm uppercase tracking-wider disabled:opacity-60 active:shadow-none active:translate-y-[2px]">
              {busy ? t('Please wait…') : mode === 'reset' ? t('Send Reset Link') : mode === 'signup' ? t('Create Account') : t('Sign In')}
            </button>
          </form>
          {mode === 'reset' && <button type="button" onClick={() => switchMode('signin')} className="w-full text-center text-xs font-bold text-gray-500 hover:text-brand transition-colors mt-4">{t('Back to Sign In')}</button>}
        </div>
    </AuthShell>
  );
};

const VerifyActions: React.FC = () => {
  const t = useT();
  const [msg, setMsg] = useState('');
  const resend = async () => {
    try { if (auth.currentUser) await sendEmailVerification(auth.currentUser); setMsg('Verification email sent.'); }
    catch { setMsg('Too many attempts. Please wait a moment and try again.'); }
  };
  // Verification happens in another tab, so reload the account state to pick it up.
  const recheck = async () => { await auth.currentUser?.reload(); window.location.reload(); };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button onClick={recheck} className={primaryBtn}>{t("I've verified, continue")}</button>
        <button onClick={resend} className={secondaryBtn}>{t("Resend email")}</button>
      </div>
      {msg && <p role="status" className="text-xs font-bold text-gray-500">{t(msg)}</p>}
    </div>
  );
};

const NoAccess: React.FC<{ session: OpsSession }> = ({ session }) => {
  const t = useT();
  return (
  <Centered>
    {session.error ? <p role="alert" className="text-sm font-bold text-ember">{t(session.error)}</p> : (
      <>
        <p className="text-sm text-gray-700 font-semibold">{t("You don't have access to the Audio Hub.")}</p>
        <p className="text-sm text-gray-600">
          {session.email
            ? <>{t("You're signed in as ")}<strong>{session.fbUser?.email}</strong>{t(". Ask an Audio Hub admin to grant access to this email address.")}</>
            : <>{t("Your email address isn't verified yet. Open the verification link we sent to ")}<strong>{session.fbUser?.email}</strong>{t(", then continue.")}</>}
        </p>
        {!session.email && session.fbUser && <VerifyActions />}
      </>
    )}
    <div className="flex gap-2">
      <button onClick={() => signOut(auth)} className={secondaryBtn}>{t("Sign out")}</button>
      <a href="/" className={secondaryBtn}>{t("Go to the Training Program")}</a>
    </div>
  </Centered>
  );
};

const NAV: { href: string; label: string; icon: React.ReactNode; match: (r: Route) => boolean }[] = [
  { href: '#/', label: 'Home', icon: <Home className="w-5 h-5" />, match: r => r.page === 'home' },
  ...(Object.keys(SECTIONS) as ContentType[]).flatMap(type => [{
    href: `#/${SECTIONS[type].path}`, label: SECTIONS[type].label,
    icon: { sop: <BookOpen className="w-5 h-5" />, checklist: <ClipboardCheck className="w-5 h-5" />, schedule: <CalendarDays className="w-5 h-5" />, resource: <FolderOpen className="w-5 h-5" />, workshop: <Video className="w-5 h-5" />, naming: <FileText className="w-5 h-5" /> }[type],
    match: (r: Route) => ('type' in r && r.type === type),
  }, ...(type === 'naming' ? [{ href: '#/naming', label: 'Naming Builder', icon: <FileText className="w-5 h-5" />, match: (r: Route) => r.page === 'naming' }] : [])]),
];

// `access` is what the screens render for: an admin previewing as a member
// gets 'member' here while `session.access` stays 'admin'.
const Shell: React.FC<{ session: OpsSession; access: OpsAccess; route: Route; previewMember: boolean; onPreviewMember: (on: boolean) => void; children: React.ReactNode }> = ({ session, access, route, previewMember, onPreviewMember, children }) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  // Desktop: the sidebar slides away and returns when the pointer hits the left edge
  // (or keyboard focus enters it), leaving the page full width. Pin keeps it open.
  const [pinned, setPinned] = useState(() => { try { return localStorage.getItem('opsNavPinned') === '1'; } catch { return false; } });
  const togglePin = () => setPinned(p => { try { localStorage.setItem('opsNavPinned', p ? '0' : '1'); } catch { /* storage blocked: stays per-visit */ } return !p; });
  useEffect(() => setOpen(false), [route]);
  const links = access === 'admin'
    ? [...NAV, { href: '#/access', label: t('Access'), icon: <Users className="w-5 h-5" />, match: (r: Route) => r.page === 'access' }]
    : NAV;
  return (
    <div className="flex h-screen w-full bg-page text-ink font-sans overflow-hidden">
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/50 z-30 lg:hidden" aria-hidden="true" />}
      {!pinned && <div aria-hidden="true" className="peer hidden lg:block fixed left-0 inset-y-0 w-3 z-40" />}
      <aside className={`w-64 fixed inset-y-0 left-0 z-40 glass bg-surface lg:bg-rail lg:rounded-2xl flex flex-col p-3 gap-6 flex-shrink-0 transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} ${pinned ? 'lg:static lg:m-3 lg:translate-x-0' : 'lg:inset-y-3 lg:left-3 lg:shadow-2xl lg:-translate-x-[110%] lg:peer-hover:translate-x-0 lg:hover:translate-x-0 lg:focus-within:translate-x-0'}`} aria-label={t("Operations navigation")}>
        <div className="flex items-center gap-2.5 px-1.5 pt-1">
          <img src="/storyco-logo-light.png" alt="StoryCo" className="w-8 h-auto rounded-lg dark:hidden" />
          <img src="/storyco-logo-dark.png" alt="StoryCo" className="w-8 h-auto rounded-lg hidden dark:block" />
          <p className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-gray-900">StoryCo</span>
            <span className="text-xs text-rail-ink">{t("Audio Hub")}</span>
          </p>
          <button onClick={togglePin} aria-pressed={pinned} className="ml-auto hidden lg:block text-[11px] font-semibold rounded-full px-2 py-1 bg-white/60 dark:bg-white/5 text-gray-700">{pinned ? t('Auto-hide') : t('Pin')}</button>
          <button onClick={() => setOpen(false)} aria-label={t("Close menu")} className="ml-auto lg:hidden w-7 h-7 bg-gray-100 rounded-full text-gray-600 font-bold text-xs">✕</button>
        </div>
        <nav className="flex-1 overflow-y-auto space-y-5">
          {[{ label: t('Workspace'), items: links.filter(l => l.href !== '#/access') }, { label: t('Admin'), items: links.filter(l => l.href === '#/access') }]
            .filter(g => g.items.length).map(g => (
              <div key={t(g.label)} className="space-y-0.5">
                <p className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-wide text-rail-ink">{t(g.label)}</p>
                {g.items.map(l => {
                  const active = l.match(route);
                  return (
                    <a key={l.href} href={l.href} aria-current={active ? 'page' : undefined}
                      className={`w-full px-2.5 py-2 gap-2.5 flex items-center rounded-xl text-sm transition-colors ${active ? 'bg-surface text-navy font-semibold shadow-sm' : 'text-gray-700 font-medium hover:bg-white/60 dark:hover:bg-white/5'}`}>
                      <span aria-hidden="true" className="flex justify-center [&>svg]:w-4 [&>svg]:h-4">{l.icon}</span>
                      <span className="leading-tight">{t(l.label)}</span>
                    </a>
                  );
                })}
              </div>
            ))}
        </nav>
        <div className="pt-3 border-t border-gray-200/70 space-y-2.5 px-1">
          <div className="flex items-center justify-between gap-2"><LanguageSwitch /><HubThemeToggle /></div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center flex-shrink-0" aria-hidden="true">{session.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
            <p className="min-w-0 leading-tight">
              <span className="block text-sm font-semibold text-gray-900 truncate">{session.name}</span>
              <span className="block text-xs text-rail-ink capitalize">{t("Audio Hub ")}{access}{previewMember ? t(' (preview)') : ''}</span>
            </p>
          </div>
          {session.access === 'admin' && (
            <button onClick={() => onPreviewMember(!previewMember)} aria-pressed={previewMember}
              className={`w-full text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${previewMember ? 'bg-brand text-white border-transparent' : 'bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border-white/70 dark:border-white/10 text-gray-700'}`}>
              {previewMember ? t('Return to admin view') : t('Preview as member')}
            </button>
          )}
          <div className="flex gap-2">
            <a href="/" className="text-xs font-semibold bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-white/70 dark:border-white/10 rounded-full px-3 py-1.5 text-gray-700">{t("Training Program")}</a>
            <button onClick={() => { window.location.hash = '#/'; signOut(auth); }} className="text-xs font-semibold bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-white/70 dark:border-white/10 rounded-full px-3 py-1.5 text-gray-700">{t("Sign out")}</button>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center gap-3 h-14 px-4 glass !rounded-none !border-x-0 !border-t-0 flex-shrink-0">
          <button onClick={() => setOpen(true)} aria-label={t("Open menu")} className="w-9 h-9 flex items-center justify-center rounded-full bg-sky text-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <img src="/storyco-logo-text-light.png" alt={t("StoryCo Audio Hub")} className="h-6 w-auto dark:hidden" />
          <img src="/storyco-logo-text-dark.png" alt="" aria-hidden="true" className="h-6 w-auto hidden dark:block" />
          <span className="ml-auto"><HubThemeToggle /></span>
        </div>
        {previewMember && (
          <div role="status" className="flex flex-wrap items-center gap-3 bg-warm text-white text-xs font-semibold px-4 md:px-7 py-2 flex-shrink-0">
            <span className="flex-1 min-w-48">{t("Previewing as a member: you see only published items and no editing. You're still signed in as an admin.")}</span>
            <button onClick={() => onPreviewMember(false)} className="bg-white/90 text-ember rounded-full px-3 py-1 font-bold">{t("Return to admin view")}</button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-4 md:p-7">
          <div className={`${pinned ? 'max-w-5xl' : 'max-w-7xl'} mx-auto`}>{children}</div>
        </main>
      </div>
    </div>
  );
};

const Loading = () => {
  const t = useT();
  return <div role="status" className="min-h-screen bg-page flex items-center justify-center text-gray-400 font-bold text-sm">{t("Loading…")}</div>;
};

export const OperationsApp: React.FC = () => {
  const t = useT();
  const session = useOpsSession();
  const route = useRoute();
  const osTheme = useOsTheme();
  const storedTheme = useStoredTheme();
  useApplyTheme(storedTheme ?? session.theme ?? osTheme);
  const uid = session.fbUser?.uid;
  const [previewMember, setPreviewMember] = useState(false);
  const access: OpsAccess = session.access === 'admin' && previewMember ? 'member' : session.access;
  const content = useOpsContent(uid, access);

  // Tab title: team name on the sign-in screen, "Audio Hub" once signed in.
  useEffect(() => { document.title = session.fbUser ? t('Audio Hub') : 'StoryCo Audio Team'; }, [session.fbUser]);

  if (session.loading) return <Loading />;
  if (!session.fbUser) return <SignIn />;
  if (session.access === 'none') return <NoAccess session={session} />;

  const editor = canEdit(access);
  const page = (() => {
    if (route.page === 'naming') return <NamingBuilder key={uid} email={session.email} access={access} content={content} />;
    if (route.page === 'access') return access === 'admin' ? <AccessPage uid={uid!} selfEmail={session.email} /> : <p>{t("Only Audio Hub admins manage access.")}</p>;
    if (route.page === 'new' || route.page === 'edit') {
      if (!editor) return <p className="text-sm text-gray-600">{t("You can read Audio Hub content but not edit it.")}</p>;
      return <EditorPage key={route.page === 'edit' ? route.id : `new-${route.type}`} route={route} uid={uid!} access={access} content={content} />;
    }
    if (route.page === 'list') return <ListPage key={route.type} type={route.type} uid={uid!} access={access} content={content} />;
    if (route.page === 'detail') return <DetailPage key={route.id} id={route.id} uid={uid!} access={access} content={content} />;
    return <HomePage access={access} content={content} name={session.name} />;
  })();

  return (
    <Shell session={session} access={access} route={route} previewMember={previewMember} onPreviewMember={setPreviewMember}>
      <Suspense fallback={<p role="status" className="text-gray-400 font-bold text-sm">{t("Loading…")}</p>}>{page}</Suspense>
    </Shell>
  );
};
