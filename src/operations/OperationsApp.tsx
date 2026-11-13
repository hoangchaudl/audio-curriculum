import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile,
} from 'firebase/auth';
import { BookOpen, CalendarDays, ClipboardCheck, FolderOpen, Home, Users } from 'lucide-react';
import { auth } from '../firebase';
import { useApplyTheme } from '../theme';
import { input, primaryBtn, secondaryBtn } from '../components/assessment/ui';
import { ContentType, Route, SECTIONS, canEdit, parseRoute } from './model';
import { OpsSession, useOpsContent, useOpsSession } from './data';
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

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="min-h-screen w-full bg-page text-ink font-sans flex items-center justify-center p-4">
    <div className="bg-surface rounded-2xl border border-gray-200 p-6 md:p-8 w-full max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <img src="/storyco-logo-light.png" alt="" className="w-10 h-auto rounded-md shadow-md dark:hidden" />
        <img src="/storyco-logo-dark.png" alt="" className="w-10 h-auto rounded-md shadow-md hidden dark:block" />
        <h1 className="font-display font-black text-xl text-gray-800">StoryCo Audio Operations</h1>
      </div>
      {children}
    </div>
  </main>
);

const authMessage = (err: unknown) => {
  const code = (err as { code?: string }).code ?? '';
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists. Sign in instead.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (code === 'auth/invalid-email') return 'That email address looks invalid.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.';
  if (code === 'auth/network-request-failed') return 'Could not reach the server. Check your connection.';
  return 'Incorrect email or password.';
};

// Operations-only staff create their account here; it gives no access until
// an Operations admin grants this email (and gives no Training Program access).
const SignIn: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const switchTo = (m: typeof mode) => { setMode(m); setError(''); setSent(false); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        setSent(true);
      } else if (mode === 'signup') {
        if (!name.trim()) { setError('Enter your name.'); return; }
        const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(user, { displayName: name.trim().slice(0, 100) });
        await sendEmailVerification(user);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Centered>
      <p className="text-sm text-gray-600">
        {mode === 'signup' ? 'Create your account with your work email. An Operations admin must also grant access to this email.'
          : mode === 'reset' ? "Enter your email and we'll send a link to reset your password."
          : 'Sign in with your StoryCo Audio account. Access is granted by an Operations admin.'}
      </p>
      <form onSubmit={submit} className="space-y-3">
        {mode === 'signup' && (
          <label className="block text-xs font-bold text-gray-600">Name
            <input autoComplete="name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} className={`${input} mt-1`} />
          </label>
        )}
        <label className="block text-xs font-bold text-gray-600">Email
          <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className={`${input} mt-1`} />
        </label>
        {mode !== 'reset' && (
          <label className="block text-xs font-bold text-gray-600">Password
            <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className={`${input} mt-1`} />
          </label>
        )}
        {error && <p role="alert" className="text-sm font-bold text-ember">{error}</p>}
        {sent && <p role="status" className="text-sm font-bold text-leaf">If an account exists for that email, a reset link is on its way.</p>}
        <button type="submit" disabled={busy} className={`${primaryBtn} w-full`}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
        </button>
      </form>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-[#2E9DF7]">
        {mode !== 'signin' && <button onClick={() => switchTo('signin')}>Back to sign in</button>}
        {mode === 'signin' && <button onClick={() => switchTo('signup')}>Create an account</button>}
        {mode === 'signin' && <button onClick={() => switchTo('reset')}>Forgot password?</button>}
      </div>
    </Centered>
  );
};

const VerifyEmail: React.FC<{ session: OpsSession }> = ({ session }) => {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (work: () => Promise<string>) => {
    setBusy(true);
    try { setMsg(await work()); } catch (err) { setMsg(authMessage(err)); } finally { setBusy(false); }
  };
  return (
    <>
      <p className="text-sm text-gray-700 font-semibold">Verify your email address</p>
      <p className="text-sm text-gray-600">We sent a verification link to <strong>{session.fbUser?.email}</strong>. Open it, then come back and continue.</p>
      {msg && <p role="status" className="text-sm font-bold text-navy">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className={primaryBtn} onClick={() => act(async () =>
          (await session.recheckVerification()) ? '' : "Your email isn't verified yet. Check your inbox (and spam folder).")}>I've verified - continue</button>
        <button disabled={busy} className={secondaryBtn} onClick={() => act(async () => {
          await sendEmailVerification(session.fbUser!);
          return 'Verification email sent again.';
        })}>Resend email</button>
      </div>
    </>
  );
};

const NoAccess: React.FC<{ session: OpsSession }> = ({ session }) => (
  <Centered>
    {session.error ? <p role="alert" className="text-sm font-bold text-ember">{session.error}</p>
      : !session.email ? <VerifyEmail session={session} />
      : (
        <>
          <p className="text-sm text-gray-700 font-semibold">You don't have access to Operations yet.</p>
          <p className="text-sm text-gray-600">You're signed in as <strong>{session.fbUser?.email}</strong>. Ask an Operations admin to grant access to this email address - this page updates as soon as they do.</p>
        </>
      )}
    <div className="flex gap-2">
      <button onClick={() => signOut(auth)} className={secondaryBtn}>Sign out</button>
    </div>
  </Centered>
);

const NAV: { href: string; label: string; icon: React.ReactNode; match: (r: Route) => boolean }[] = [
  { href: '#/', label: 'Home', icon: <Home className="w-5 h-5" />, match: r => r.page === 'home' },
  ...(Object.keys(SECTIONS) as ContentType[]).map(type => ({
    href: `#/${SECTIONS[type].path}`, label: SECTIONS[type].label,
    icon: { sop: <BookOpen className="w-5 h-5" />, checklist: <ClipboardCheck className="w-5 h-5" />, schedule: <CalendarDays className="w-5 h-5" />, resource: <FolderOpen className="w-5 h-5" /> }[type],
    match: (r: Route) => ('type' in r && r.type === type),
  })),
];

const Shell: React.FC<{ session: OpsSession; route: Route; children: React.ReactNode }> = ({ session, route, children }) => {
  const [open, setOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  // A new page starts at the top (the scroll container is <main>, not the window).
  useEffect(() => { setOpen(false); mainRef.current?.scrollTo(0, 0); }, [route]);
  const links = session.access === 'admin'
    ? [...NAV, { href: '#/access', label: 'Access', icon: <Users className="w-5 h-5" />, match: (r: Route) => r.page === 'access' }]
    : NAV;
  return (
    <div className="flex h-screen w-full bg-page text-ink font-sans overflow-hidden">
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/50 z-30 lg:hidden" aria-hidden="true" />}
      <aside className={`w-72 fixed lg:static inset-y-0 left-0 z-40 bg-[#1B3A64] dark:bg-[#10233F] flex flex-col p-4 shadow-xl flex-shrink-0 transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`} aria-label="Operations navigation">
        <div className="flex items-center gap-3 mb-5">
          <img src="/storyco-logo-light.png" alt="StoryCo" className="w-10 h-auto rounded-md shadow-md dark:hidden" />
          <img src="/storyco-logo-dark.png" alt="StoryCo" className="w-10 h-auto rounded-md shadow-md hidden dark:block" />
          <p className="flex flex-col leading-none">
            <span className="text-white font-extrabold text-sm">StoryCo</span>
            <span className="text-[#C9DCF5] text-xs font-semibold mt-0.5">Audio Operations</span>
          </p>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="ml-auto lg:hidden w-7 h-7 bg-white/20 rounded-full text-white font-black text-xs">✕</button>
        </div>
        {/* Which app you're in, and the way back to the other one. */}
        {session.hasProfile && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/10 p-1 mb-5 text-xs font-semibold">
            <a href="/" className="rounded-lg px-2 py-1.5 text-center text-white/80 hover:bg-white/10 hover:text-white">Training Program</a>
            <span aria-current="true" className="rounded-lg px-2 py-1.5 text-center bg-white text-[#1B3A64]">Operations</span>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto space-y-1">
          {links.map(l => {
            const active = l.match(route);
            return (
              <a key={l.href} href={l.href} aria-current={active ? 'page' : undefined}
                className={`w-full px-3 py-2.5 gap-3 flex items-center rounded-xl ${active ? 'bg-white/15 text-white font-semibold shadow-[inset_3px_0_0_#6CB8FF]' : 'text-white/85 font-medium hover:bg-white/10 hover:text-white'}`}>
                <span aria-hidden="true" className="w-6 flex justify-center">{l.icon}</span>
                <span className="leading-tight">{l.label}</span>
              </a>
            );
          })}
        </nav>
        <div className="pt-4 border-t border-white/20 space-y-2 text-white">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{session.name}</p>
              <p className="text-xs text-[#C9DCF5]">{{ admin: 'Admin', editor: 'Editor', member: 'Member', none: '' }[session.access]}</p>
            </div>
            <button onClick={() => { window.location.hash = '#/'; signOut(auth); }} className="text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5">Sign out</button>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center gap-3 h-14 px-4 bg-surface border-b flex-shrink-0">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1B3A64] text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <span className="font-display font-extrabold text-gray-900 truncate">Audio Operations</span>
        </div>
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};

const Loading = () => <div role="status" className="min-h-screen bg-page flex items-center justify-center text-gray-400 font-bold text-sm">Loading…</div>;

export const OperationsApp: React.FC = () => {
  const session = useOpsSession();
  const route = useRoute();
  const osTheme = useOsTheme();
  useApplyTheme(session.theme ?? osTheme);
  const uid = session.fbUser?.uid;
  const content = useOpsContent(uid, session.access);

  useEffect(() => { document.title = 'StoryCo Audio Operations'; }, []);

  if (session.loading) return <Loading />;
  if (!session.fbUser) return <SignIn />;
  if (session.access === 'none') return <NoAccess session={session} />;

  const editor = canEdit(session.access);
  const page = (() => {
    if (route.page === 'access') return session.access === 'admin' ? <AccessPage uid={uid!} selfEmail={session.email} /> : <p>Only Operations admins manage access.</p>;
    if (route.page === 'new' || route.page === 'edit') {
      if (!editor) return <p className="text-sm text-gray-600">You can read Operations content but not edit it.</p>;
      return <EditorPage key={route.page === 'edit' ? route.id : `new-${route.type}`} route={route} uid={uid!} access={session.access} content={content} />;
    }
    if (route.page === 'list') return <ListPage key={route.type} type={route.type} access={session.access} content={content} />;
    if (route.page === 'detail') return <DetailPage key={route.id} id={route.id} uid={uid!} access={session.access} content={content} />;
    return <HomePage access={session.access} content={content} />;
  })();

  return (
    <Shell session={session} route={route}>
      <Suspense fallback={<p role="status" className="text-gray-400 font-bold text-sm">Loading…</p>}>{page}</Suspense>
    </Shell>
  );
};
