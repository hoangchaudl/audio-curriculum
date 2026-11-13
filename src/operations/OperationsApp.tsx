import React, { Suspense, lazy, useEffect, useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { BookOpen, CalendarDays, ClipboardCheck, FolderOpen, Home, Users } from 'lucide-react';
import { auth } from '../firebase';
import { useApplyTheme } from '../theme';
import { card, input, primaryBtn, secondaryBtn } from '../components/assessment/ui';
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
    <div className={`${card} w-full max-w-md space-y-4`}>
      <div className="flex items-center gap-3">
        <img src="/storyco-logo-light.png" alt="" className="w-10 h-auto rounded-md shadow-md dark:hidden" />
        <img src="/storyco-logo-dark.png" alt="" className="w-10 h-auto rounded-md shadow-md hidden dark:block" />
        <h1 className="font-display font-black text-xl text-gray-800">StoryCo Audio Operations</h1>
      </div>
      {children}
    </div>
  </main>
);

const SignIn: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(code === 'auth/too-many-requests' ? 'Too many attempts. Please wait a moment and try again.'
        : code === 'auth/network-request-failed' ? 'Could not reach the server. Check your connection.'
        : 'Incorrect email or password.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Centered>
      <p className="text-sm text-gray-600">Sign in with your StoryCo Audio account. Access is granted by an Operations admin.</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-bold text-gray-600">Email
          <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-xs font-bold text-gray-600">Password
          <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className={`${input} mt-1`} />
        </label>
        {error && <p role="alert" className="text-sm font-bold text-ember">{error}</p>}
        <button type="submit" disabled={busy} className={`${primaryBtn} w-full`}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="text-xs text-gray-500">Forgot your password or new here? Use the <a href="/" className="text-[#2E9DF7] underline">Audio Training Program sign-in</a>.</p>
    </Centered>
  );
};

const NoAccess: React.FC<{ session: OpsSession }> = ({ session }) => (
  <Centered>
    {session.error ? <p role="alert" className="text-sm font-bold text-ember">{session.error}</p> : (
      <>
        <p className="text-sm text-gray-700 font-semibold">You don't have access to Operations.</p>
        <p className="text-sm text-gray-600">
          {session.email
            ? <>You're signed in as <strong>{session.fbUser?.email}</strong>. Ask an Operations admin to grant access to this email address.</>
            : <>Your email address isn't verified yet. Finish setting up your account in the <a href="/" className="text-[#2E9DF7] underline">Audio Training Program</a>, then come back.</>}
        </p>
      </>
    )}
    <div className="flex gap-2">
      <button onClick={() => signOut(auth)} className={secondaryBtn}>Sign out</button>
      <a href="/" className={secondaryBtn}>Go to the Training Program</a>
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
  useEffect(() => setOpen(false), [route]);
  const links = session.access === 'admin'
    ? [...NAV, { href: '#/access', label: 'Access', icon: <Users className="w-5 h-5" />, match: (r: Route) => r.page === 'access' }]
    : NAV;
  return (
    <div className="flex h-screen w-full bg-page text-ink font-sans overflow-hidden">
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/50 z-30 lg:hidden" aria-hidden="true" />}
      <aside className={`w-72 fixed lg:static inset-y-0 left-0 z-40 bg-rail flex flex-col p-4 shadow-xl flex-shrink-0 transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`} aria-label="Operations navigation">
        <div className="flex items-center gap-3 mb-8">
          <img src="/storyco-logo-light.png" alt="StoryCo" className="w-10 h-auto rounded-md shadow-md dark:hidden" />
          <img src="/storyco-logo-dark.png" alt="StoryCo" className="w-10 h-auto rounded-md shadow-md hidden dark:block" />
          <p className="flex flex-col leading-none">
            <span className="text-white font-black text-sm">StoryCo</span>
            <span className="text-[#E0F2FE] text-[10px] font-extrabold uppercase tracking-[0.08em] mt-0.5">Audio Operations</span>
          </p>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="ml-auto lg:hidden w-7 h-7 bg-white/20 rounded-full text-white font-black text-xs">✕</button>
        </div>
        <nav className="flex-1 overflow-y-auto space-y-2">
          {links.map(l => {
            const active = l.match(route);
            return (
              <a key={l.href} href={l.href} aria-current={active ? 'page' : undefined}
                className={`w-full p-3 gap-3 flex items-center rounded-2xl transition-all ${active ? 'theme-light bg-surface text-navy font-bold shadow-md' : 'text-white/80 font-semibold hover:bg-white/10'}`}>
                <span aria-hidden="true" className="w-6 flex justify-center">{l.icon}</span>
                <span className="leading-tight">{l.label}</span>
              </a>
            );
          })}
        </nav>
        <div className="pt-4 border-t border-white/20 space-y-2 text-white">
          <p className="text-sm font-bold truncate">{session.name}</p>
          <p className="text-[10px] uppercase font-extrabold tracking-widest text-[#E0F2FE]">Operations {session.access}</p>
          <div className="flex gap-2">
            <a href="/" className="text-xs font-bold bg-white/15 hover:bg-white/25 rounded-xl px-3 py-1.5">Training Program</a>
            <button onClick={() => { window.location.hash = '#/'; signOut(auth); }} className="text-xs font-bold bg-white/15 hover:bg-white/25 rounded-xl px-3 py-1.5">Sign out</button>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center gap-3 h-14 px-4 bg-surface border-b flex-shrink-0">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="w-9 h-9 flex items-center justify-center rounded-xl bg-sky text-[#2E9DF7]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <span className="font-black text-sm uppercase tracking-tight text-[#2E9DF7] truncate">StoryCo Audio Operations</span>
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
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
