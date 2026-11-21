import { useT, LanguageSwitch } from './language';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { BookOpen, CalendarDays, ClipboardCheck, FolderOpen, Home, Users, Video, FileText } from 'lucide-react';
import { auth } from '../firebase';
import { useApplyTheme } from '../theme';
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
      <LanguageSwitch />
      {children}
    </div>
  </main>
  );
};

const SignIn: React.FC = () => {
  const t = useT();
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
      setError(code === 'auth/too-many-requests' ? t('Too many attempts. Please wait a moment and try again.')
        : code === 'auth/network-request-failed' ? t('Could not reach the server. Check your connection.')
        : t('Incorrect email or password.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Centered>
      <p className="text-sm text-gray-600">{t("Sign in with your StoryCo Audio account. Access is granted by an Audio Hub admin.")}</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-bold text-gray-600">{t("Email")}<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-xs font-bold text-gray-600">{t("Password")}<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className={`${input} mt-1`} />
        </label>
        {error && <p role="alert" className="text-sm font-bold text-ember">{t(error)}</p>}
        <button type="submit" disabled={busy} className={`${primaryBtn} w-full`}>{busy ? t('Signing in…') : t('Sign in')}</button>
      </form>
      <p className="text-xs text-gray-500">{t("Forgot your password or new here? Use the ")}<a href="/" className="text-brand underline">{t("Audio Training Program sign-in")}</a>.</p>
    </Centered>
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
            : <>{t("Your email address isn't verified yet. Finish setting up your account in the ")}<a href="/" className="text-brand underline">{t("Audio Training Program")}</a>{t(", then come back.")}</>}
        </p>
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
  useEffect(() => setOpen(false), [route]);
  const links = access === 'admin'
    ? [...NAV, { href: '#/access', label: t('Access'), icon: <Users className="w-5 h-5" />, match: (r: Route) => r.page === 'access' }]
    : NAV;
  return (
    <div className="flex h-screen w-full bg-page text-ink font-sans overflow-hidden">
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/50 z-30 lg:hidden" aria-hidden="true" />}
      <aside className={`w-64 fixed lg:static inset-y-0 left-0 z-40 glass bg-surface lg:bg-rail lg:m-3 lg:rounded-2xl flex flex-col p-3 gap-6 flex-shrink-0 transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`} aria-label={t("Operations navigation")}>
        <div className="flex items-center gap-2.5 px-1.5 pt-1">
          <img src="/storyco-logo-light.png" alt="StoryCo" className="w-8 h-auto rounded-lg dark:hidden" />
          <img src="/storyco-logo-dark.png" alt="StoryCo" className="w-8 h-auto rounded-lg hidden dark:block" />
          <p className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-gray-900">StoryCo</span>
            <span className="text-xs text-rail-ink">{t("Audio Hub")}</span>
          </p>
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
          <LanguageSwitch />
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
          <span className="font-semibold text-sm text-gray-900 truncate">{t("StoryCo Audio Hub")}</span>
        </div>
        {previewMember && (
          <div role="status" className="flex flex-wrap items-center gap-3 bg-warm text-white text-xs font-semibold px-4 md:px-7 py-2 flex-shrink-0">
            <span className="flex-1 min-w-48">{t("Previewing as a member: you see only published items and no editing. You're still signed in as an admin.")}</span>
            <button onClick={() => onPreviewMember(false)} className="bg-white/90 text-ember rounded-full px-3 py-1 font-bold">{t("Return to admin view")}</button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-4 md:p-7">
          <div className="max-w-5xl mx-auto">{children}</div>
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
  useApplyTheme(session.theme ?? osTheme);
  const uid = session.fbUser?.uid;
  const [previewMember, setPreviewMember] = useState(false);
  const access: OpsAccess = session.access === 'admin' && previewMember ? 'member' : session.access;
  const content = useOpsContent(uid, access);

  useEffect(() => { document.title = t('StoryCo Audio Hub'); }, []);

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
    if (route.page === 'list') return <ListPage key={route.type} type={route.type} access={access} content={content} />;
    if (route.page === 'detail') return <DetailPage key={route.id} id={route.id} uid={uid!} access={access} content={content} />;
    return <HomePage access={access} content={content} name={session.name} />;
  })();

  return (
    <Shell session={session} access={access} route={route} previewMember={previewMember} onPreviewMember={setPreviewMember}>
      <Suspense fallback={<p role="status" className="text-gray-400 font-bold text-sm">{t("Loading…")}</p>}>{page}</Suspense>
    </Shell>
  );
};
