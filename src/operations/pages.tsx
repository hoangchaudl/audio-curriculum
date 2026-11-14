import React, { Suspense, lazy, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, ClipboardCheck, ExternalLink, FolderOpen, Link2, Plus } from 'lucide-react';
import { card, input, primaryBtn, secondaryBtn, sectionTitle, Md } from '../components/assessment/ui';
import {
  CHECKLIST_KINDS, ContentType, OpsAccess, OpsContent, RESOURCE_KINDS, SECTIONS, WORKFLOWS,
  byUpdatedDesc, canEdit, checklistKey, draftFields, draftOf, isHttpUrl, matchesFilters,
} from './model';
import { createDraft, deleteContent, friendlyError, publishRevision, setStatus, useOpsContent } from './data';

// The banner art pulls in three.js, so it loads only with the Home page.
const VinylArt = lazy(() => import('./VinylHero').then(m => ({ default: m.VinylArt })));

export type ContentState = ReturnType<typeof useOpsContent>;

export const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const shortDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

export const SECTION_ICON: Record<ContentType, React.FC<{ className?: string }>> = {
  sop: BookOpen, checklist: ClipboardCheck, schedule: CalendarDays, resource: FolderOpen,
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'text-ember', published: 'text-leaf', archived: 'text-gray-500',
};
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize whitespace-nowrap ${STATUS_STYLE[status] ?? ''}`}>
    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />{status}
  </span>
);
// Workflows get their own color so WEBTOON and Audible work tell apart at a glance.
const WORKFLOW_STYLE: Record<string, string> = {
  WEBTOON: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  Audible: 'bg-amber-500/14 text-amber-700 dark:text-amber-300',
};
const Tag: React.FC<{ children: string }> = ({ children }) => (
  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${WORKFLOW_STYLE[children] ?? 'bg-gray-500/10 text-gray-600'}`}>
    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />{children}
  </span>
);

export const Banner: React.FC<{ tone?: 'error' | 'info'; children: React.ReactNode }> = ({ tone = 'info', children }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-sm font-medium ${tone === 'error' ? 'bg-rose text-ember' : 'bg-sky text-navy'}`}>{children}</div>
);

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

// Each link as a button that says where it opens.
const LinkList: React.FC<{ links?: OpsContent['links'] }> = ({ links }) => (
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

const Meta: React.FC<{ c: OpsContent; showStatus: boolean }> = ({ c, showStatus }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
    {showStatus && <StatusBadge status={c.status} />}
    {c.category && <span className="font-semibold text-gray-600">{c.category}</span>}
    {(c.workflows ?? []).map(w => <Tag key={w}>{w}</Tag>)}
    {c.updatedAt && <span>Updated {fmtDate(c.updatedAt)}</span>}
  </div>
);

const Loader: React.FC<{ content: ContentState }> = ({ content }) =>
  content.error ? <Banner tone="error">{content.error}</Banner> : !content.loaded ? <p role="status" className="text-sm text-gray-400 font-semibold">Loading…</p> : null;

const itemHash = (c: OpsContent) => `#/${SECTIONS[c.type].path}/${encodeURIComponent(c.id)}`;
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

const Hero: React.FC<{ title: string; body: string; action?: { label: string; href: string } }> = ({ title, body, action }) => (
  <section className="relative overflow-hidden rounded-2xl border border-white/80 dark:border-white/10 min-h-44 flex items-center px-6 md:px-7 py-6 bg-[linear-gradient(110deg,#DCE6FF_0%,#E6F6EE_48%,#EFE6FF_100%)] dark:bg-[linear-gradient(110deg,rgb(61_99_245/.3)_0%,rgb(14_159_110/.14)_48%,rgb(124_92_245/.28)_100%)]">
    <div className="relative z-10 md:max-w-[50%] space-y-2">
      <h2 className="text-lg md:text-xl font-bold text-gray-900 text-balance">{title}</h2>
      <p className="text-sm text-gray-600">{body}</p>
      {action && <a href={action.href} className={`${primaryBtn} inline-block mt-1`}>{action.label}</a>}
    </div>
    <Suspense fallback={null}><VinylArt /></Suspense>
  </section>
);

export const HomePage: React.FC<{ access: OpsAccess; content: ContentState; name?: string }> = ({ access, content, name }) => {
  const editor = canEdit(access);
  const published = content.items.filter(c => c.status === 'published');
  const recent = [...published].sort(byUpdatedDesc).slice(0, 6);
  const drafts = editor ? content.items.filter(c => c.status === 'draft').sort(byUpdatedDesc) : [];
  // Members get the links from published schedules and resources up front.
  const quickLinks = published.filter(c => c.type === 'schedule' || c.type === 'resource').sort(byUpdatedDesc)
    .flatMap(c => (c.links ?? []).filter(l => isHttpUrl(l.url)).map(l => ({ ...l, from: c.title }))).slice(0, 6);
  const first = name?.split(/\s+/)[0];
  const hero = editor && drafts.length
    ? { title: `${drafts.length} draft${drafts.length === 1 ? ' is' : 's are'} waiting for review`, body: drafts.slice(0, 3).map(d => d.title).join(', ') + (access === 'admin' ? '. Publish them so the team works from one version.' : '. An admin publishes them.'), action: { label: 'Open the latest draft', href: itemHash(drafts[0]) } }
    : recent[0]
      ? { title: `Updated: ${recent[0].title}`, body: recent[0].summary || `Updated ${fmtDate(recent[0].updatedAt)}. Read it before your next session.`, action: { label: 'Read it', href: itemHash(recent[0]) } }
      : { title: 'Your team’s SOPs, checklists and schedules live here', body: editor ? 'Open a section and create the first item. It stays a draft until an admin publishes it.' : 'Published SOPs, checklists and links will appear here.' };
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-bold text-2xl text-gray-900 tracking-tight">{greeting()}{first ? `, ${first}` : ''}</h1>
        <p className="text-sm text-gray-600 mt-1">
          {published.length} published item{published.length === 1 ? '' : 's'} across 4 sections{editor && drafts.length ? ` · ${drafts.length} draft${drafts.length === 1 ? '' : 's'} waiting for review` : ''}
        </p>
      </header>
      <Loader content={content} />
      <Hero {...hero} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(SECTIONS) as ContentType[]).map(type => {
          const Icon = SECTION_ICON[type];
          const draftCount = drafts.filter(c => c.type === type).length;
          return (
            <a key={type} href={`#/${SECTIONS[type].path}`} className="glass rounded-2xl p-4 flex flex-col gap-2 hover:border-brand/30 transition-colors">
              <span className="w-8 h-8 rounded-xl bg-sky text-navy flex items-center justify-center"><Icon className="w-4 h-4" aria-hidden="true" /></span>
              <span className="font-semibold text-gray-900">{SECTIONS[type].label}</span>
              <span className="text-xs text-gray-600 leading-snug">{SECTIONS[type].blurb}</span>
              <span className="mt-auto pt-1 text-xs text-gray-500">
                <b className="text-lg font-bold text-gray-900 mr-1">{published.filter(c => c.type === type).length}</b>published{draftCount ? ` · ${draftCount} draft${draftCount === 1 ? '' : 's'}` : ''}
              </span>
            </a>
          );
        })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 items-start">
        <section className="glass rounded-2xl min-w-0">
          <h2 className="px-5 py-3.5 border-b border-gray-200/70 text-sm font-semibold text-gray-900">Recently updated</h2>
          {content.loaded && recent.length === 0
            ? <p className="px-5 py-4 text-sm text-gray-600">Nothing has been published yet.</p>
            : <ul className="divide-y divide-gray-200/60">{recent.map(c => <Row key={c.id} c={c} showStatus={false} withType />)}</ul>}
        </section>
        {editor ? (
          <section className="glass rounded-2xl min-w-0">
            <h2 className="px-5 py-3.5 border-b border-gray-200/70 text-sm font-semibold text-gray-900 flex items-center">Drafts to review<span className="ml-auto text-xs font-semibold text-gray-500">{drafts.length}</span></h2>
            {drafts.length === 0
              ? <p className="px-5 py-4 text-sm text-gray-600">No drafts waiting.</p>
              : <ul className="divide-y divide-gray-200/60">{drafts.slice(0, 6).map(c => <Row key={c.id} c={c} showStatus />)}</ul>}
          </section>
        ) : (
          <section className="glass rounded-2xl min-w-0">
            <h2 className="px-5 py-3.5 border-b border-gray-200/70 text-sm font-semibold text-gray-900">Quick links</h2>
            {quickLinks.length === 0
              ? <p className="px-5 py-4 text-sm text-gray-600">Links from schedules and resources will appear here.</p>
              : <div className="p-3"><LinkList links={quickLinks} /></div>}
          </section>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ c: OpsContent; showStatus: boolean; withType?: boolean }> = ({ c, showStatus, withType }) => (
  <li>
    <a href={itemHash(c)} className="flex items-center gap-3 px-5 py-3 group min-w-0 hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
      {withType && <span className="hidden sm:block w-20 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{SECTIONS[c.type].singular}</span>}
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-sm text-gray-900 truncate group-hover:text-brand">
          {c.title}{c.revisionOf && <span className="text-xs font-semibold text-ember ml-2">(revision)</span>}
        </span>
        {c.summary && <span className="block text-xs text-gray-600 truncate">{c.summary}</span>}
      </span>
      <span className="hidden md:flex gap-1.5">{(c.workflows ?? []).slice(0, 2).map(w => <Tag key={w}>{w}</Tag>)}</span>
      {showStatus ? <StatusBadge status={c.status} /> : <span className="hidden sm:block text-xs text-gray-500 whitespace-nowrap tabular-nums">{shortDate(c.updatedAt)}</span>}
    </a>
  </li>
);

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={on}
    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${on ? 'bg-gray-900 text-white border-transparent dark:bg-white dark:text-gray-50' : 'bg-surface text-gray-600 border-gray-200 hover:border-gray-300'}`}>
    {children}
  </button>
);

export const ListPage: React.FC<{ type: ContentType; access: OpsAccess; content: ContentState }> = ({ type, access, content }) => {
  const s = SECTIONS[type];
  const Icon = SECTION_ICON[type];
  const editor = canEdit(access);
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
          <h1 className="font-bold text-2xl text-gray-900 tracking-tight">{s.label}</h1>
          <p className="text-sm text-gray-600">{s.blurb}{type === 'schedule' ? ' Each one opens in a new tab.' : ''}</p>
        </div>
        {editor && <a href={`#/new/${type}`} className={`${primaryBtn} inline-flex items-center gap-1.5`}><Plus className="w-4 h-4" aria-hidden="true" />New {s.singular}</a>}
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search by title" placeholder="Search by title" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} className={`${input} !w-auto flex-1 min-w-52`} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Workflow">
          <Chip on={!f.workflow} onClick={() => setF({ ...f, workflow: '' })}>All <span className="opacity-70 font-medium">{count('')}</span></Chip>
          {WORKFLOWS.map(w => <Chip key={w} on={f.workflow === w} onClick={() => setF({ ...f, workflow: f.workflow === w ? '' : w })}>{w} <span className="opacity-70 font-medium">{count(w)}</span></Chip>)}
        </div>
        {categories.length > 0 && (
          <select aria-label="Category" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className={`${input} !w-auto`}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        )}
        {editor && (
          <select aria-label="Status" value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className={`${input} !w-auto`}>
            <option value="">Drafts and published</option>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        )}
      </div>
      <Loader content={content} />
      {content.loaded && !content.error && (
        shown.length === 0 ? (
          <div className={card}>
            <p className="text-sm text-gray-600">
              {filtered ? 'Nothing matches these filters.' : `Nothing in ${s.label} yet.`}
              {!filtered && (editor ? ` Use "New ${s.singular}" to add one.` : ' Check back once your team publishes some.')}
            </p>
          </div>
        ) : asCards ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shown.map(c => (
              <article key={c.id} className={`glass rounded-2xl p-4 flex flex-col gap-3 min-w-0 ${c.status === 'draft' ? '!border-dashed !border-gray-300' : ''}`}>
                <div className="flex items-start gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-sky text-navy flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" aria-hidden="true" /></span>
                  <a href={itemHash(c)} className="flex-1 min-w-0 pt-1 font-semibold text-gray-900 hover:text-brand">{c.title}</a>
                  {editor && <span className="pt-1.5"><StatusBadge status={c.status} /></span>}
                </div>
                {c.summary && <p className="text-sm text-gray-600">{c.summary}</p>}
                <LinkList links={c.links} />
                <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {c.category && <span className="font-semibold text-gray-600">{c.category}</span>}
                  {(c.workflows ?? []).map(w => <Tag key={w}>{w}</Tag>)}
                  {c.updatedAt && <span className="ml-auto">Updated {shortDate(c.updatedAt)}</span>}
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
        <h2 className="sr-only">Checklist</h2>
        <span className="text-lg font-bold text-gray-900 tabular-nums">{done}/{items.length}</span>
        <span className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden" aria-hidden="true">
          <span className="block h-full bg-brand rounded-full transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </span>
        <button onClick={() => save([])} disabled={!checked.length} className={secondaryBtn}>Reset my checks</button>
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
      <p className="px-5 py-2.5 border-t border-gray-200/70 text-xs text-gray-500">Your checks are saved only in this browser for your own use. They are not shared and are not a completion record.</p>
    </section>
  );
};

export const DetailPage: React.FC<{ id: string; uid: string; access: OpsAccess; content: ContentState }> = ({ id, uid, access, content }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const c = content.items.find(x => x.id === id);
  if (!c) {
    return content.loaded || content.error ? (
      <div className="space-y-3">
        <Loader content={content} />
        <Banner>This item doesn't exist, isn't published, or was archived. <a href="#/" className="underline">Back to Home</a></Banner>
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
      <a href={`#/${s.path}`} className="text-sm font-semibold text-brand">← {s.label}</a>
      <header className="space-y-2">
        <h1 className="font-bold text-2xl text-gray-900 tracking-tight text-balance">{c.title}</h1>
        {c.summary && <p className="text-gray-600">{c.summary}</p>}
        <Meta c={c} showStatus={editor} />
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
          {c.owner && <div><dt className="inline font-bold">Owner: </dt><dd className="inline">{c.owner}</dd></div>}
          {c.effectiveDate && <div><dt className="inline font-bold">Effective: </dt><dd className="inline">{fmtDate(c.effectiveDate + 'T00:00:00')}</dd></div>}
          {c.publishedAt && editor && <div><dt className="inline font-bold">Last published: </dt><dd className="inline">{fmtDate(c.publishedAt)}</dd></div>}
        </dl>
      </header>

      {c.revisionOf && (
        <Banner>This draft revises {original ? <a className="underline" href={`#/${s.path}/${encodeURIComponent(original.id)}`}>the published version</a> : 'a published item'}. The published version stays live until an admin publishes this draft.</Banner>
      )}
      {openRevision && editor && (
        <Banner>A revision of this item is in progress: <a className="underline" href={`#/${s.path}/${encodeURIComponent(openRevision.id)}`}>open the draft</a>.</Banner>
      )}

      {editor && (
        <div className="flex flex-wrap gap-2">
          {(c.status === 'draft' || admin) && <a href={`#/edit/${encodeURIComponent(c.id)}`} className={secondaryBtn}>Edit</a>}
          {c.status === 'published' && !admin && !openRevision && (
            <button disabled={busy} className={secondaryBtn} onClick={() => run('Draft revision created.', async () => {
              const newId = await createDraft(uid, draftFields(c.type, draftOf(c)), c.id);
              window.location.hash = `#/edit/${encodeURIComponent(newId)}`;
            })}>Propose changes (new draft)</button>
          )}
          {admin && c.status === 'draft' && (
            <button disabled={busy} className={primaryBtn} onClick={() => c.revisionOf
              ? confirmRun('Publish this revision? It replaces the live version.', 'Published.', () => publishRevision(uid, c), () => { window.location.hash = `#/${s.path}/${encodeURIComponent(c.revisionOf!)}`; })
              : run('Published.', () => setStatus(uid, c.id, 'published'))}>Publish</button>
          )}
          {admin && c.status === 'published' && (
            <button disabled={busy} className={secondaryBtn} onClick={() => confirmRun('Archive this item? Members will no longer see it.', 'Archived.', () => setStatus(uid, c.id, 'archived'))}>Archive</button>
          )}
          {admin && c.status === 'archived' && (
            <button disabled={busy} className={secondaryBtn} onClick={() => run('Moved back to drafts.', () => setStatus(uid, c.id, 'draft'))}>Restore as draft</button>
          )}
          {(c.status === 'draft' || admin) && (
            <button disabled={busy} className={`${secondaryBtn} !text-ember`} onClick={() => confirmRun(`Delete "${c.title}" permanently? This can't be undone.`, 'Deleted.', () => deleteContent(c.id), () => { window.location.hash = `#/${s.path}`; })}>Delete</button>
          )}
        </div>
      )}
      {busy && <p role="status" className="text-sm font-bold text-gray-500">Saving…</p>}
      {error && <Banner tone="error">{error}</Banner>}
      {notice && !error && <Banner>{notice}</Banner>}

      {c.type === 'checklist' && <Checklist key={checklistKey(uid, c)} uid={uid} c={c} />}
      {c.body.trim() && <section className={card}><Md>{c.body}</Md></section>}
      {(c.links ?? []).length > 0 && (
        <section className={card}>
          <h2 className={sectionTitle}>{c.type === 'sop' ? 'References' : 'Links'}</h2>
          <div className="mt-3"><LinkList links={c.links} /></div>
        </section>
      )}
    </article>
  );
};
