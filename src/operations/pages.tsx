import { useT } from './language';
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, ClipboardCheck, ExternalLink, FolderOpen, Link2, Plus, Video, FileText } from 'lucide-react';
import { card, input, primaryBtn, secondaryBtn, sectionTitle, Md } from '../components/assessment/ui';
import {
  CHECKLIST_KINDS, ContentType, OpsAccess, OpsContent, RESOURCE_KINDS, SECTIONS, WORKFLOWS,
  byUpdatedDesc, canEdit, checklistKey, draftFields, draftOf, isHttpUrl, miroEmbedUrl, matchesFilters, workshopVideoId,
} from './model';
import { SOP_SEEDS, seedFields } from './sopSeeds';
import { createDraft, deleteContent, friendlyError, publishRevision, setStatus, useOpsContent } from './data';

// The banner art pulls in three.js, so it loads only with the Home page.
const VinylArt = lazy(() => import('./VinylHero').then(m => ({ default: m.VinylArt })));

export type ContentState = ReturnType<typeof useOpsContent>;

export const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const shortDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

export const SECTION_ICON: Record<ContentType, React.FC<{ className?: string }>> = {
  sop: BookOpen, checklist: ClipboardCheck, schedule: CalendarDays, resource: FolderOpen, workshop: Video, naming: FileText,
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'text-ember', published: 'text-leaf', archived: 'text-gray-500',
};
export const LeadershipTag: React.FC = () => {
  const t = useT();
  return <span className="inline-flex items-center text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap bg-violet-500/12 text-violet-700 dark:text-violet-300">{t("Leadership only")}</span>;
};
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const t = useT();
  return (
  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize whitespace-nowrap ${STATUS_STYLE[status] ?? ''}`}>
    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />{t(status)}
  </span>
  );
};
// Workflows get their own color so WEBTOON and Audible work tell apart at a glance.
const WORKFLOW_STYLE: Record<string, string> = {
  WEBTOON: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  Audible: 'bg-amber-500/14 text-amber-700 dark:text-amber-300',
};
const Tag: React.FC<{ children: string }> = ({ children }) => {
  const t = useT();
  return (
  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${WORKFLOW_STYLE[children] ?? 'bg-gray-500/10 text-gray-600'}`}>
    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />{t(children)}
  </span>
  );
};

export const Banner: React.FC<{ tone?: 'error' | 'info'; children: React.ReactNode }> = ({ tone = 'info', children }) => {
  const t = useT();
  return (
  <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-sm font-medium ${tone === 'error' ? 'bg-rose text-ember' : 'bg-sky text-navy'}`}>{children}</div>
  );
};

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

// Each link as a button that says where it opens.
const LinkList: React.FC<{ links?: OpsContent['links'] }> = ({ links }) => {
  const t = useT();
  return (
  <ul className="space-y-1.5">
    {(links ?? []).filter(l => isHttpUrl(l.url)).map((l, i) => (
      <li key={i}>
        <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-white/70 dark:border-white/10 px-3 py-2 text-sm font-semibold text-gray-800 hover:border-brand/40 transition-colors min-w-0">
          <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0 truncate">{l.label || l.url}</span>
          <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{hostOf(l.url)}</span>
          <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
        </a>
      </li>
    ))}
  </ul>
  );
};

const Meta: React.FC<{ c: OpsContent; showStatus: boolean }> = ({ c, showStatus }) => {
  const t = useT();
  return (
  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
    {showStatus && <StatusBadge status={c.status} />}
    {c.restricted && <LeadershipTag />}
    {c.category && <span className="font-semibold text-gray-600">{c.category}</span>}
    {(c.workflows ?? []).map(w => <Tag key={w}>{w}</Tag>)}
    {c.updatedAt && <span>{t("Updated ")}{fmtDate(c.updatedAt)}</span>}
  </div>
  );
};

const Loader: React.FC<{ content: ContentState }> = ({ content }) => {
  const t = useT();
  return content.error ? <Banner tone="error">{t(content.error)}</Banner> : !content.loaded ? <p role="status" className="text-sm text-gray-400 font-semibold">{t("Loading…")}</p> : null;
};

const itemHash = (c: OpsContent) => `#/${SECTIONS[c.type].path}/${encodeURIComponent(c.id)}`;
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

const Hero: React.FC<{ title: string; body: string; action?: { label: string; href: string } }> = ({ title, body, action }) => {
  const t = useT();
  return (
  <section className="relative overflow-hidden rounded-2xl border border-white/80 dark:border-white/10 min-h-44 flex items-center px-6 md:px-7 py-6 bg-[linear-gradient(110deg,#DCE6FF_0%,#E6F6EE_48%,#EFE6FF_100%)] dark:bg-[linear-gradient(110deg,rgb(61_99_245/.3)_0%,rgb(14_159_110/.14)_48%,rgb(124_92_245/.28)_100%)]">
    <div className="relative z-10 md:max-w-[50%] space-y-2">
      <h2 className="text-lg md:text-xl font-bold text-gray-900 text-balance">{title}</h2>
      <p className="text-sm text-gray-600">{body}</p>
      {action && <a href={action.href} className={`${primaryBtn} inline-block mt-1`}>{action.label}</a>}
    </div>
    <Suspense fallback={null}><VinylArt /></Suspense>
  </section>
  );
};

export const HomePage: React.FC<{ access: OpsAccess; content: ContentState; name?: string }> = ({ access, content, name }) => {
  const t = useT();
  const editor = canEdit(access);
  const published = content.items.filter(c => c.status === 'published');
  const recent = [...published].sort(byUpdatedDesc).slice(0, 6);
  const drafts = editor ? content.items.filter(c => c.status === 'draft').sort(byUpdatedDesc) : [];
  // Members get the links from published schedules and resources up front.
  const quickLinks = published.filter(c => c.type === 'schedule' || c.type === 'resource').sort(byUpdatedDesc)
    .flatMap(c => (c.links ?? []).filter(l => isHttpUrl(l.url)).map(l => ({ ...l, from: c.title }))).slice(0, 6);
  const first = name?.split(/\s+/)[0];
  const hero = editor && drafts.length
    ? { title: t(drafts.length === 1 ? '{count} draft is waiting for review' : '{count} drafts are waiting for review', { count: drafts.length }), body: drafts.slice(0, 3).map(d => d.title).join(', ') + (access === 'admin' ? t('. Publish them so the team works from one version.') : t('. An admin publishes them.')), action: { label: t('Open the latest draft'), href: itemHash(drafts[0]) } }
    : recent[0]
      ? { title: t('Updated: {title}', { title: recent[0].title }), body: recent[0].summary || t('Updated {date}. Read it before your next session.', { date: fmtDate(recent[0].updatedAt) }), action: { label: t('Read it'), href: itemHash(recent[0]) } }
      : { title: t('Your team’s SOPs, checklists and schedules live here'), body: editor ? t('Open a section and create the first item. It stays a draft until an admin publishes it.') : t('Published SOPs, checklists and links will appear here.') };
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-bold text-2xl text-gray-900 tracking-tight">{t(greeting())}{first ? `, ${first}` : ''}</h1>
        <p className="text-sm text-gray-600 mt-1">
          {t(published.length === 1 ? '{count} published item across {sections} sections' : '{count} published items across {sections} sections', { count: published.length, sections: Object.keys(SECTIONS).length })}{editor && drafts.length ? ` · ${t(drafts.length === 1 ? '{count} draft waiting for review' : '{count} drafts waiting for review', { count: drafts.length })}` : ''}
        </p>
      </header>
      <Loader content={content} />
      <Hero {...hero} />
      <a href="#/naming" className={secondaryBtn}>{t("Open Naming Builder")}</a>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(Object.keys(SECTIONS) as ContentType[]).map(type => {
          const Icon = SECTION_ICON[type];
          const draftCount = drafts.filter(c => c.type === type).length;
          return (
            <a key={type} href={`#/${SECTIONS[type].path}`} className="glass rounded-2xl p-4 flex flex-col gap-2 hover:border-brand/30 transition-colors">
              <span className="w-8 h-8 rounded-xl bg-sky text-navy flex items-center justify-center"><Icon className="w-4 h-4" aria-hidden="true" /></span>
              <span className="font-semibold text-gray-900">{t(SECTIONS[type].label)}</span>
              <span className="text-xs text-gray-600 leading-snug">{t(SECTIONS[type].blurb)}</span>
              <span className="mt-auto pt-1 text-xs text-gray-500">
                <b className="text-lg font-bold text-gray-900 mr-1">{published.filter(c => c.type === type).length}</b>{t("published")}{draftCount ? ` · ${t(draftCount === 1 ? '{count} draft' : '{count} drafts', { count: draftCount })}` : ''}
              </span>
            </a>
          );
        })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 items-start">
        <section className="glass rounded-2xl min-w-0">
          <h2 className="px-5 py-3.5 border-b border-gray-200/70 text-sm font-semibold text-gray-900">{t("Recently updated")}</h2>
          {content.loaded && recent.length === 0
            ? <p className="px-5 py-4 text-sm text-gray-600">{t("Nothing has been published yet.")}</p>
            : <ul className="divide-y divide-gray-200/60">{recent.map(c => <Row key={c.id} c={c} showStatus={false} withType />)}</ul>}
        </section>
        {editor ? (
          <section className="glass rounded-2xl min-w-0">
            <h2 className="px-5 py-3.5 border-b border-gray-200/70 text-sm font-semibold text-gray-900 flex items-center">{t("Drafts to review")}<span className="ml-auto text-xs font-semibold text-gray-500">{drafts.length}</span></h2>
            {drafts.length === 0
              ? <p className="px-5 py-4 text-sm text-gray-600">{t("No drafts waiting.")}</p>
              : <ul className="divide-y divide-gray-200/60">{drafts.slice(0, 6).map(c => <Row key={c.id} c={c} showStatus />)}</ul>}
          </section>
        ) : (
          <section className="glass rounded-2xl min-w-0">
            <h2 className="px-5 py-3.5 border-b border-gray-200/70 text-sm font-semibold text-gray-900">{t("Quick links")}</h2>
            {quickLinks.length === 0
              ? <p className="px-5 py-4 text-sm text-gray-600">{t("Links from schedules and resources will appear here.")}</p>
              : <div className="p-3"><LinkList links={quickLinks} /></div>}
          </section>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ c: OpsContent; showStatus: boolean; withType?: boolean }> = ({ c, showStatus, withType }) => {
  const t = useT();
  return (
  <li>
    <a href={itemHash(c)} className="flex items-center gap-3 px-5 py-3 group min-w-0 hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
      {withType && <span className="hidden sm:block w-20 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t(SECTIONS[c.type].singular)}</span>}
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-sm text-gray-900 truncate group-hover:text-brand">
          {c.title}{c.revisionOf && <span className="text-xs font-semibold text-ember ml-2">{t("(revision)")}</span>}
        </span>
        {c.summary && <span className="block text-xs text-gray-600 truncate">{c.summary}</span>}
      </span>
      <span className="hidden md:flex gap-1.5">{(c.workflows ?? []).slice(0, 2).map(w => <Tag key={w}>{w}</Tag>)}</span>
      {c.restricted && <LeadershipTag />}
      {showStatus ? <StatusBadge status={c.status} /> : <span className="hidden sm:block text-xs text-gray-500 whitespace-nowrap tabular-nums">{shortDate(c.updatedAt)}</span>}
    </a>
  </li>
  );
};

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => {
  const t = useT();
  return (
  <button type="button" onClick={onClick} aria-pressed={on}
    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${on ? 'bg-gray-900 text-white border-transparent dark:bg-white dark:text-gray-50' : 'bg-surface text-gray-600 border-gray-200 hover:border-gray-300'}`}>
    {children}
  </button>
  );
};

export const ListPage: React.FC<{ type: ContentType; uid: string; access: OpsAccess; content: ContentState }> = ({ type, uid, access, content }) => {
  const t = useT();
  const s = SECTIONS[type];
  const Icon = SECTION_ICON[type];
  const editor = canEdit(access);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  // Starter SOP drafts from the Miro board; titles already present (any status) are skipped.
  const missingSeeds = type === 'sop' && content.loaded ? SOP_SEEDS.filter(x => !content.items.some(c => c.type === 'sop' && c.title === x.title)) : [];
  const importSeeds = async () => {
    setImporting(true); setImportError('');
    try { for (const x of missingSeeds) await createDraft(uid, seedFields(x)); }
    catch (e) { setImportError(friendlyError(e)); }
    setImporting(false);
  };
  const [f, setF] = useState({ q: '', category: '', workflow: '', status: '' });
  const ofType = content.items.filter(c => c.type === type);
  const categories = useMemo(() => {
    const preset = type === 'checklist' ? CHECKLIST_KINDS : type === 'resource' ? RESOURCE_KINDS : [];
    return [...new Set([...preset, ...ofType.map(c => c.category ?? '').filter(Boolean)])].sort();
  }, [type, ofType]);
  const visible = ofType.filter(c => (f.status ? true : c.status !== 'archived'));
  const shown = visible
    .filter(c => matchesFilters(c, f))
    .sort((a, b) => a.title.localeCompare(b.title));
  const filtered = !!(f.q || f.category || f.workflow || f.status);
  const count = (w: string) => visible.filter(c => matchesFilters(c, { ...f, workflow: w })).length;
  // Schedules and resources are mostly links, so they read best as cards.
  const asCards = type === 'schedule' || type === 'resource';
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-2xl text-gray-900 tracking-tight">{t(s.label)}</h1>
          <p className="text-sm text-gray-600">{t(s.blurb)}{type === 'schedule' ? t(' Each one opens in a new tab.') : ''}</p>
        </div>
        {editor && missingSeeds.length > 0 && <button disabled={importing} onClick={importSeeds} className={secondaryBtn}>{importing ? 'Importing…' : `Import ${missingSeeds.length} starter SOP drafts`}</button>}
        {editor && <a href={`#/new/${type}`} className={`${primaryBtn} inline-flex items-center gap-1.5`}><Plus className="w-4 h-4" aria-hidden="true" />{t("New ")}{t(s.singular)}</a>}
      </header>
      {importError && <p role="alert" className="text-sm font-bold text-ember">{importError}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label={t("Search by title")} placeholder={t("Search by title")} value={f.q} onChange={e => setF({ ...f, q: e.target.value })} className={`${input} !w-auto flex-1 min-w-52`} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Workflow")}>
          <Chip on={!f.workflow} onClick={() => setF({ ...f, workflow: '' })}>{t("All ")}<span className="opacity-70 font-medium">{count('')}</span></Chip>
          {WORKFLOWS.map(w => <Chip key={w} on={f.workflow === w} onClick={() => setF({ ...f, workflow: f.workflow === w ? '' : w })}>{t(w)} <span className="opacity-70 font-medium">{count(w)}</span></Chip>)}
        </div>
        {categories.length > 0 && (
          <select aria-label={t("Category")} value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className={`${input} !w-auto`}>
            <option value="">{t("All categories")}</option>
            {categories.map(c => <option key={c} value={c}>{t(c)}</option>)}
          </select>
        )}
        {editor && (
          <select aria-label={t("Status")} value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className={`${input} !w-auto`}>
            <option value="">{t("Drafts and published")}</option>
            <option value="draft">{t("Drafts")}</option>
            <option value="published">{t("Published")}</option>
            <option value="archived">{t("Archived")}</option>
          </select>
        )}
      </div>
      <Loader content={content} />
      {content.loaded && !content.error && (
        shown.length === 0 ? (
          <div className={card}>
            <p className="text-sm text-gray-600">
              {filtered ? t('Nothing matches these filters.') : t('Nothing in {section} yet.', { section: t(s.label) })}
              {!filtered && (editor ? ' ' + t('Use “New {section}” to add one.', { section: t(s.singular) }) : t(' Check back once your team publishes some.'))}
            </p>
          </div>
        ) : asCards ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shown.map(c => (
              <article key={c.id} className={`glass rounded-2xl p-4 flex flex-col gap-3 min-w-0 ${c.status === 'draft' ? '!border-dashed !border-gray-300' : ''}`}>
                <div className="flex items-start gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-sky text-navy flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" aria-hidden="true" /></span>
                  <a href={itemHash(c)} className="flex-1 min-w-0 pt-1 font-semibold text-gray-900 hover:text-brand">{c.title}</a>
                  {c.restricted && <span className="pt-1.5"><LeadershipTag /></span>}
                  {editor && <span className="pt-1.5"><StatusBadge status={c.status} /></span>}
                </div>
                {c.summary && <p className="text-sm text-gray-600">{c.summary}</p>}
                <LinkList links={c.links} />
                <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {c.category && <span className="font-semibold text-gray-600">{c.category}</span>}
                  {(c.workflows ?? []).map(w => <Tag key={w}>{w}</Tag>)}
                  {c.updatedAt && <span className="ml-auto">{t("Updated ")}{shortDate(c.updatedAt)}</span>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <ul className="glass rounded-2xl divide-y divide-gray-200/60 overflow-hidden">
            {shown.map(c => <Row key={c.id} c={c} showStatus={editor} />)}
          </ul>
        )
      )}
    </div>
  );
};

// Personal ticks, kept in this browser only (never shared or reported).
const Checklist: React.FC<{ uid: string; c: OpsContent }> = ({ uid, c }) => {
  const t = useT();
  const key = checklistKey(uid, c);
  const [checked, setChecked] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  });
  const save = (next: number[]) => {
    setChecked(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage blocked: ticks last for this visit */ }
  };
  const items = c.items ?? [];
  const done = checked.filter(i => i < items.length).length;
  return (
    <section className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200/70">
        <h2 className="sr-only">{t("Checklist")}</h2>
        <span className="text-lg font-bold text-gray-900 tabular-nums">{done}/{items.length}</span>
        <span className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden" aria-hidden="true">
          <span className="block h-full bg-brand rounded-full transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </span>
        <button onClick={() => save([])} disabled={!checked.length} className={secondaryBtn}>{t("Reset my checks")}</button>
      </div>
      <ul className="divide-y divide-gray-200/50">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex items-start gap-3 px-5 py-3 text-sm text-gray-800 cursor-pointer hover:bg-white/40 dark:hover:bg-white/5">
              <span className="w-5 pt-0.5 text-xs font-semibold text-gray-400 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-brand" checked={checked.includes(i)}
                onChange={e => save(e.target.checked ? [...checked, i] : checked.filter(x => x !== i))} />
              <span className={checked.includes(i) ? 'line-through text-gray-400' : ''}>{item}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="px-5 py-2.5 border-t border-gray-200/70 text-xs text-gray-500">{t("Your checks are saved only in this browser for your own use. They are not shared and are not a completion record.")}</p>
    </section>
  );
};

export const DetailPage: React.FC<{ id: string; uid: string; access: OpsAccess; content: ContentState }> = ({ id, uid, access, content }) => {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const c = content.items.find(x => x.id === id);
  if (!c) {
    return content.loaded || content.error ? (
      <div className="space-y-3">
        <Loader content={content} />
        <Banner>{t("This item doesn't exist, isn't published, or was archived. ")}<a href="#/" className="underline">{t("Back to Home")}</a></Banner>
      </div>
    ) : <Loader content={content} />;
  }
  const s = SECTIONS[c.type];
  const editor = canEdit(access);
  const admin = access === 'admin';
  const original = c.revisionOf ? content.items.find(x => x.id === c.revisionOf) : undefined;
  const openRevision = c.status === 'published' ? content.items.find(x => x.revisionOf === c.id && x.status === 'draft') : undefined;

  const run = async (label: string, work: () => Promise<unknown>, after?: () => void) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await work();
      setNotice(label);
      after?.();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };
  const confirmRun = (q: string, ...args: Parameters<typeof run>) => { if (window.confirm(q)) run(...args); };

  return (
    <article className="space-y-5">
      <a href={`#/${s.path}`} className="text-sm font-semibold text-brand">← {t(s.label)}</a>
      <header className="space-y-2">
        <h1 className="font-bold text-2xl text-gray-900 tracking-tight text-balance">{c.title}</h1>
        {c.summary && <p className="text-gray-600">{c.summary}</p>}
        <Meta c={c} showStatus={editor} />
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
          {c.owner && <div><dt className="inline font-bold">{t("Owner: ")}</dt><dd className="inline">{c.owner}</dd></div>}
          {c.effectiveDate && <div><dt className="inline font-bold">{t("Effective: ")}</dt><dd className="inline">{fmtDate(c.effectiveDate + 'T00:00:00')}</dd></div>}
          {c.publishedAt && editor && <div><dt className="inline font-bold">{t("Last published: ")}</dt><dd className="inline">{fmtDate(c.publishedAt)}</dd></div>}
        </dl>
      </header>

      {c.revisionOf && (
        <Banner>{t("This draft revises ")}{original ? <a className="underline" href={`#/${s.path}/${encodeURIComponent(original.id)}`}>{t("the published version")}</a> : t('a published item')}{t(". The published version stays live until an admin publishes this draft.")}</Banner>
      )}
      {openRevision && editor && (
        <Banner>{t("A revision of this item is in progress: ")}<a className="underline" href={`#/${s.path}/${encodeURIComponent(openRevision.id)}`}>{t("open the draft")}</a>.</Banner>
      )}

      {editor && (
        <div className="flex flex-wrap gap-2">
          {(c.status === 'draft' || admin) && <a href={`#/edit/${encodeURIComponent(c.id)}`} className={secondaryBtn}>{t("Edit")}</a>}
          {c.status === 'published' && !admin && !openRevision && (
            <button disabled={busy} className={secondaryBtn} onClick={() => run(t('Draft revision created.'), async () => {
              const newId = await createDraft(uid, draftFields(c.type, draftOf(c)), c.id, c.restricted);
              window.location.hash = `#/edit/${encodeURIComponent(newId)}`;
            })}>{t("Propose changes (new draft)")}</button>
          )}
          {admin && c.status === 'draft' && (
            <button disabled={busy} className={primaryBtn} onClick={() => c.revisionOf
              ? confirmRun(t('Publish this revision? It replaces the live version.'), t('Published.'), () => publishRevision(uid, c), () => { window.location.hash = `#/${s.path}/${encodeURIComponent(c.revisionOf!)}`; })
              : run(t('Published.'), () => setStatus(uid, c.id, 'published', c.restricted))}>{t("Publish")}</button>
          )}
          {admin && c.status === 'published' && (
            <button disabled={busy} className={secondaryBtn} onClick={() => confirmRun(t('Archive this item? Members will no longer see it.'), t('Archived.'), () => setStatus(uid, c.id, 'archived', c.restricted))}>{t("Archive")}</button>
          )}
          {admin && c.status === 'archived' && (
            <button disabled={busy} className={secondaryBtn} onClick={() => run(t('Moved back to drafts.'), () => setStatus(uid, c.id, 'draft', c.restricted))}>{t("Restore as draft")}</button>
          )}
          {(c.status === 'draft' || admin) && (
            <button disabled={busy} className={`${secondaryBtn} !text-ember`} onClick={() => confirmRun(t('Delete "{title}" permanently? This can\'t be undone.', { title: c.title }), t('Deleted.'), () => deleteContent(c.id, c.restricted), () => { window.location.hash = `#/${s.path}`; })}>{t("Delete")}</button>
          )}
        </div>
      )}
      {busy && <p role="status" className="text-sm font-bold text-gray-500">{t("Saving…")}</p>}
      {error && <Banner tone="error">{t(error)}</Banner>}
      {notice && !error && <Banner>{t(notice)}</Banner>}

      {c.type === 'naming' && <section className={`${card} space-y-3`}>
        <h2 className={sectionTitle}>{t('Filename pattern')}</h2>
        <p className="font-mono text-sm text-gray-700 break-all">{c.namingPattern}</p>
        <p className="text-sm text-gray-600">{t('Title code')}: <span className="font-mono">{c.namingCode}</span></p>
        <h3 className="text-sm font-bold text-gray-700">{t('Assigned team members')}</h3>
        <p className="text-sm text-gray-600 whitespace-pre-line">{c.assignees}</p>
        <a href="#/naming" className={secondaryBtn}>{t('Open Naming Builder')}</a>
      </section>}
      {c.type === 'checklist' && <Checklist key={checklistKey(uid, c)} uid={uid} c={c} />}
      {c.type === 'workshop' && (c.links ?? []).map((link, i) => {
        const videoId = workshopVideoId(link.url);
        return videoId ? <section key={i} className={`${card} space-y-3`}>
          <h2 className={sectionTitle}>{link.label || c.title}</h2>
          <iframe className="w-full aspect-video rounded-xl" src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={link.label || c.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          <a href={link.url} target="_blank" rel="noreferrer" className="text-sm text-[#2E9DF7] underline">{t("Watch on YouTube")}</a>
        </section> : null;
      })}
      {c.body.trim() && <section className={card}><Md>{c.body}</Md></section>}
      {(c.links ?? []).map((link, i) => {
        const embed = miroEmbedUrl(link.url);
        return embed ? <section key={`miro${i}`} className={`${card} space-y-3`}>
          <iframe className="w-full h-[480px] rounded-xl border border-gray-200" src={embed} title={link.label || 'Miro board'} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </section> : null;
      })}
      {(c.links ?? []).length > 0 && (
        <section className={card}>
          <h2 className={sectionTitle}>{c.type === 'sop' ? t('References') : t('Links')}</h2>
          <div className="mt-3"><LinkList links={c.links} /></div>
        </section>
      )}
    </article>
  );
};
