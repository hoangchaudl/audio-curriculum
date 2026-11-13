import React, { useEffect, useMemo, useRef, useState } from 'react';
import { input, primaryBtn, secondaryBtn } from '../components/assessment/ui';
import { OpsMarkdown } from './OpsMarkdown';
import {
  CHECKLIST_KINDS, ContentType, OpsAccess, OpsContent, RESOURCE_KINDS, SECTIONS, WORKFLOWS,
  byUpdatedDesc, canEdit, checklistKey, draftFields, draftOf, isHttpUrl, matchesFilters, searchContent,
} from './model';
import { createDraft, deleteContent, friendlyError, publishRevision, setStatus, useOpsContent } from './data';

export type ContentState = ReturnType<typeof useOpsContent>;

export const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

// Operations' quieter surface: flat bordered panels, sentence-case headings
// in ink. Blue is kept for links and actions only.
export const panel = 'bg-surface rounded-2xl border border-gray-200';
export const heading = 'text-base font-bold text-gray-800';
export const pageTitle = 'font-display font-extrabold text-2xl md:text-3xl text-gray-900';

const STATUS: Record<string, { label: string; style: string }> = {
  draft: { label: 'Draft', style: 'bg-peach text-ember' },
  published: { label: 'Published', style: 'bg-mint text-leaf' },
  archived: { label: 'Archived', style: 'bg-gray-100 text-gray-600' },
};
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`text-xs font-semibold rounded-md px-1.5 py-0.5 ${STATUS[status]?.style ?? ''}`}>{STATUS[status]?.label ?? status}</span>
);
const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-xs font-medium rounded-md px-1.5 py-0.5 bg-gray-100 text-gray-700">{children}</span>
);

export const Banner: React.FC<{ tone?: 'error' | 'info' | 'draft'; children: React.ReactNode }> = ({ tone = 'info', children }) => (
  <div role={tone === 'error' ? 'alert' : 'status'}
    className={`rounded-xl px-4 py-3 text-sm ${tone === 'error' ? 'bg-rose text-ember font-semibold' : tone === 'draft' ? 'bg-peach text-gray-800 border border-ember/30' : 'bg-sky text-navy'}`}>{children}</div>
);

const LinkList: React.FC<{ links?: OpsContent['links'] }> = ({ links }) => (
  <ul className="space-y-1">
    {(links ?? []).filter(l => isHttpUrl(l.url)).map((l, i) => (
      <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#176BBA] dark:text-[#6CB8FF] underline underline-offset-2 break-all">{l.label || l.url}</a></li>
    ))}
  </ul>
);

const hrefOf = (c: OpsContent) => `#/${SECTIONS[c.type].path}/${encodeURIComponent(c.id)}`;

// One line of facts: status (editors only), category, workflows; date on the right.
const Meta: React.FC<{ c: OpsContent; showStatus: boolean; withType?: boolean }> = ({ c, showStatus, withType }) => (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
    {showStatus && <StatusBadge status={c.status} />}
    {withType && <span className="text-gray-600">{SECTIONS[c.type].singular[0].toUpperCase() + SECTIONS[c.type].singular.slice(1)}</span>}
    {c.category && <span className="text-gray-600">{c.category}</span>}
    {(c.workflows ?? []).map(w => <Chip key={w}>{w}</Chip>)}
    {c.updatedAt && <span className="sm:ml-auto">Updated {fmtDate(c.updatedAt)}</span>}
  </div>
);

const Loader: React.FC<{ content: ContentState }> = ({ content }) =>
  content.error ? <Banner tone="error">{content.error}</Banner> : !content.loaded ? <p role="status" className="text-sm text-gray-500">Loading…</p> : null;

const Row: React.FC<{ c: OpsContent; showStatus: boolean; withType?: boolean; snippet?: string }> = ({ c, showStatus, withType, snippet }) => (
  <li>
    <a href={hrefOf(c)} className="block px-4 py-3 hover:bg-gray-50 focus-visible:bg-gray-50 group">
      <p className="font-semibold text-gray-900 group-hover:text-[#176BBA]">
        {c.title}{c.revisionOf && <span className="text-xs font-medium text-ember ml-2">Revision</span>}
      </p>
      {(snippet || c.summary) && <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">{snippet || c.summary}</p>}
      <div className="mt-1.5"><Meta c={c} showStatus={showStatus} withType={withType} /></div>
    </a>
  </li>
);

const Panel: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className={panel}>
    <div className="flex items-center gap-3 px-4 pt-4 pb-2">
      <h2 className={heading}>{title}</h2>
      {action && <div className="ml-auto">{action}</div>}
    </div>
    {children}
  </section>
);
const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="px-4 pb-4 text-sm text-gray-600">{children}</p>;

export const HomePage: React.FC<{ access: OpsAccess; content: ContentState }> = ({ access, content }) => {
  const [q, setQ] = useState('');
  const editor = canEdit(access);
  const live = content.items.filter(c => c.status !== 'archived');
  const published = live.filter(c => c.status === 'published');
  const pinned = published.filter(c => c.pinned).sort((a, b) => a.title.localeCompare(b.title));
  const recent = [...published].sort(byUpdatedDesc).slice(0, 6);
  const drafts = editor ? live.filter(c => c.status === 'draft').sort(byUpdatedDesc) : [];
  const results = searchContent(live, q);
  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div>
          <h1 className={pageTitle}>StoryCo Audio Operations</h1>
          <p className="text-gray-600 mt-1">SOPs, handoff checklists, schedules and resources for the audio team.</p>
        </div>
        <label className="block">
          <span className="sr-only">Search Operations</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search SOPs, checklists and links"
            className="w-full rounded-xl border border-gray-300 bg-surface px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#2E9DF7] focus:border-transparent" />
        </label>
      </header>
      <Loader content={content} />
      {q.trim() ? (
        <Panel title={results.length ? `${results.length} ${results.length === 1 ? 'result' : 'results'}` : 'No results'}>
          {results.length ? (
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {results.map(r => <Row key={r.c.id} c={r.c} snippet={r.snippet} showStatus={editor} withType />)}
            </ul>
          ) : <Empty>Nothing matches "{q.trim()}". Try fewer words, or browse a section below.</Empty>}
        </Panel>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <Panel title="Start here">
            {pinned.length ? (
              <ul className="divide-y divide-gray-100 border-t border-gray-100">{pinned.map(c => <Row key={c.id} c={c} showStatus={false} withType />)}</ul>
            ) : <Empty>{access === 'admin' ? 'Pin key documents here: edit one and tick "Show in Start here".' : 'Key documents your team pins will appear here.'}</Empty>}
          </Panel>
          <Panel title="Recently updated">
            {recent.length ? (
              <ul className="divide-y divide-gray-100 border-t border-gray-100">{recent.map(c => <Row key={c.id} c={c} showStatus={false} withType />)}</ul>
            ) : content.loaded ? <Empty>Nothing is published yet.{editor ? ' Open a section to create the first item. It stays a draft until an admin publishes it.' : ''}</Empty> : null}
          </Panel>
        </div>
      )}
      {!q.trim() && drafts.length > 0 && (
        <Panel title={`Drafts in progress (${drafts.length})`}>
          <ul className="divide-y divide-gray-100 border-t border-gray-100">{drafts.map(c => <Row key={c.id} c={c} showStatus withType />)}</ul>
        </Panel>
      )}
      <nav aria-label="Sections" className="flex flex-wrap gap-2">
        {(Object.keys(SECTIONS) as ContentType[]).map(type => (
          <a key={type} href={`#/${SECTIONS[type].path}`}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-surface px-3 py-2 text-sm font-semibold text-gray-800 hover:border-[#2E9DF7]">
            {SECTIONS[type].label}<span className="text-xs font-medium text-gray-500">{published.filter(c => c.type === type).length}</span>
          </a>
        ))}
      </nav>
    </div>
  );
};

type Tab = 'published' | 'draft' | 'archived';
export const ListPage: React.FC<{ type: ContentType; access: OpsAccess; content: ContentState }> = ({ type, access, content }) => {
  const s = SECTIONS[type];
  const editor = canEdit(access);
  const [tab, setTab] = useState<Tab>('published');
  const [f, setF] = useState({ q: '', category: '', workflow: '' });
  const ofType = content.items.filter(c => c.type === type);
  const categories = useMemo(() => {
    const preset = type === 'checklist' ? CHECKLIST_KINDS : type === 'resource' ? RESOURCE_KINDS : [];
    return [...new Set([...preset, ...ofType.map(c => c.category ?? '').filter(Boolean)])].sort();
  }, [type, ofType]);
  const inTab = ofType.filter(c => c.status === tab);
  const matchIds = f.q.trim() ? new Set(searchContent(inTab, f.q).map(r => r.c.id)) : null;
  const shown = inTab
    .filter(c => (!matchIds || matchIds.has(c.id)) && matchesFilters(c, { ...f, q: '', status: '' }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const filtered = !!(f.q || f.category || f.workflow);
  const linkRows = type === 'schedule' || type === 'resource';
  const count = (t: Tab) => ofType.filter(c => c.status === t).length;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <h1 className={pageTitle}>{s.label}</h1>
          <p className="text-gray-600 mt-1">{s.blurb}</p>
        </div>
        {editor && <a href={`#/new/${type}`} className={primaryBtn}>New {s.singular}</a>}
      </header>
      {editor && (
        <div role="tablist" aria-label="Status" className="flex gap-1 border-b border-gray-200">
          {(['published', 'draft', 'archived'] as Tab[]).map(t => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`-mb-px px-3 py-2 text-sm font-semibold border-b-2 ${tab === t ? 'border-[#2E9DF7] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {STATUS[t].label === 'Draft' ? 'Drafts' : STATUS[t].label} <span className="font-medium text-gray-500">{count(t)}</span>
            </button>
          ))}
        </div>
      )}
      <section className={panel}>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 p-3 border-b border-gray-100">
          <input type="search" aria-label={`Search ${s.label}`} placeholder="Search" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} className={input} />
          <select aria-label="Category" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className={input}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <select aria-label="Workflow" value={f.workflow} onChange={e => setF({ ...f, workflow: e.target.value })} className={input}>
            <option value="">All workflows</option>
            {WORKFLOWS.map(w => <option key={w}>{w}</option>)}
          </select>
        </div>
        {!content.loaded || content.error ? <div className="p-4"><Loader content={content} /></div>
          : shown.length === 0 ? (
            <Empty>
              <span className="block pt-3">
                {filtered ? 'Nothing matches these filters.'
                  : tab === 'published' ? (editor ? `Nothing published here yet. Use "New ${s.singular}" to start a draft.` : 'Nothing published here yet.')
                  : tab === 'draft' ? 'No drafts.' : 'Nothing archived.'}
              </span>
            </Empty>
          ) : (
            <ul className="divide-y divide-gray-100">
              {shown.map(c => linkRows ? (
                <li key={c.id} className="px-4 py-3 space-y-1.5">
                  <a href={hrefOf(c)} className="font-semibold text-gray-900 hover:text-[#176BBA]">{c.title}</a>
                  {c.summary && <p className="text-sm text-gray-600">{c.summary}</p>}
                  <LinkList links={c.links} />
                  <Meta c={c} showStatus={false} />
                </li>
              ) : <Row key={c.id} c={c} showStatus={false} />)}
            </ul>
          )}
      </section>
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
    <section className={`${panel} p-4 md:p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className={heading}>Checklist</h2>
        <span className="text-sm text-gray-600">{done} of {items.length} done</span>
        <button onClick={() => save([])} disabled={!checked.length} className={`${secondaryBtn} ml-auto`}>Reset my checks</button>
      </div>
      <p className="text-xs text-gray-500 mt-1">Your checks are saved only in this browser. They aren't shared and aren't a completion record.</p>
      <ul className="mt-3 divide-y divide-gray-100">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex items-start gap-3 py-2.5 text-[15px] text-gray-800 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-5 h-5 flex-shrink-0 accent-[#2E9DF7]" checked={checked.includes(i)}
                onChange={e => save(e.target.checked ? [...checked, i] : checked.filter(x => x !== i))} />
              <span className={checked.includes(i) ? 'line-through text-gray-500' : ''}>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
};

// Long documents get an "On this page" menu built from their rendered
// headings: beside the text on wide screens, a collapsible list above it on
// phones. Buttons scroll instead of #anchors, which the hash router owns.
const Body: React.FC<{ markdown: string }> = ({ markdown }) => {
  const ref = useRef<HTMLElement>(null);
  const [heads, setHeads] = useState<{ el: HTMLElement; text: string; level: number }[]>([]);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const read = () => setHeads([...root.querySelectorAll<HTMLElement>('h1, h2, h3')]
      .map(el => ({ el, text: el.textContent?.trim() ?? '', level: Number(el.tagName[1]) }))
      .filter(h => h.text));
    read();
    // The Markdown renderer loads lazily, so headings appear after mount.
    const observer = new MutationObserver(read);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [markdown]);
  const toc = heads.length >= 3 ? heads : [];
  const top = Math.min(...toc.map(h => h.level));
  const list = (
    <ul className="space-y-1.5 text-sm">
      {toc.map((h, i) => (
        <li key={i} style={{ paddingLeft: (h.level - top) * 12 }}>
          <button onClick={() => h.el.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`text-left hover:text-[#176BBA] ${h.level === top ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{h.text}</button>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      {toc.length > 0 && (
        <nav aria-label="On this page" className="mb-4 lg:mb-0 lg:order-2 lg:w-60 lg:flex-shrink-0 lg:sticky lg:top-0">
          <details className={`${panel} p-4 lg:hidden`}>
            <summary className="text-sm font-semibold text-gray-800 cursor-pointer">On this page ({toc.length} sections)</summary>
            <div className="mt-3">{list}</div>
          </details>
          <div className={`${panel} p-4 hidden lg:block max-h-[calc(100vh-4rem)] overflow-y-auto`}>
            <p className="text-sm font-semibold text-gray-800">On this page</p>
            <div className="mt-3">{list}</div>
          </div>
        </nav>
      )}
      <section ref={ref} className={`${panel} p-5 md:p-8 min-w-0 lg:flex-1`}><OpsMarkdown>{markdown}</OpsMarkdown></section>
    </div>
  );
};

// Secondary actions behind "More" so a destructive one is never a stray click away.
const MoreMenu: React.FC<{ items: { label: string; danger?: boolean; onClick: () => void }[]; disabled: boolean }> = ({ items, disabled }) => {
  const ref = useRef<HTMLDetailsElement>(null);
  if (!items.length) return null;
  return (
    <details ref={ref} className="relative">
      <summary className={`${secondaryBtn} list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden`} aria-disabled={disabled}>More</summary>
      <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-gray-200 bg-surface p-1 shadow-lg">
        {items.map(it => (
          <button key={it.label} disabled={disabled} onClick={() => { if (ref.current) ref.current.open = false; it.onClick(); }}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-gray-100 ${it.danger ? 'text-ember' : 'text-gray-800'}`}>{it.label}</button>
        ))}
      </div>
    </details>
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

  const more = [
    ...(admin && c.status === 'published' ? [{ label: 'Archive', onClick: () => confirmRun('Archive this item? Members will no longer see it.', 'Archived.', () => setStatus(uid, c.id, 'archived')) }] : []),
    ...(admin && c.status === 'archived' ? [{ label: 'Restore as draft', onClick: () => run('Moved back to drafts.', () => setStatus(uid, c.id, 'draft')) }] : []),
    ...(c.status === 'draft' || admin ? [{ label: 'Delete', danger: true, onClick: () => confirmRun(`Delete "${c.title}" permanently? This can't be undone.`, 'Deleted.', () => deleteContent(c.id), () => { window.location.hash = `#/${s.path}`; }) }] : []),
  ];

  return (
    <article className="space-y-5">
      <a href={`#/${s.path}`} className="text-sm font-semibold text-[#176BBA] dark:text-[#6CB8FF]">← {s.label}</a>
      <header className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-[16rem] space-y-2">
          <h1 className={pageTitle}>{c.title}</h1>
          {c.summary && <p className="text-gray-600 max-w-[70ch]">{c.summary}</p>}
          <Meta c={c} showStatus={false} />
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
            {c.owner && <div><dt className="inline text-gray-500">Owner </dt><dd className="inline font-medium text-gray-800">{c.owner}</dd></div>}
            {c.effectiveDate && <div><dt className="inline text-gray-500">Effective </dt><dd className="inline font-medium text-gray-800">{fmtDate(c.effectiveDate + 'T00:00:00')}</dd></div>}
            {c.publishedAt && editor && <div><dt className="inline text-gray-500">Last published </dt><dd className="inline font-medium text-gray-800">{fmtDate(c.publishedAt)}</dd></div>}
          </dl>
        </div>
        {editor && (
          <div className="flex flex-wrap items-center gap-2">
            {admin && c.status === 'draft' && (
              <button disabled={busy} className={primaryBtn} onClick={() => c.revisionOf
                ? confirmRun('Publish this revision? It replaces the live version.', 'Published.', () => publishRevision(uid, c), () => { window.location.hash = `#/${s.path}/${encodeURIComponent(c.revisionOf!)}`; })
                : run('Published. Members can see it now.', () => setStatus(uid, c.id, 'published'))}>Publish</button>
            )}
            {(c.status === 'draft' || admin) && <a href={`#/edit/${encodeURIComponent(c.id)}`} className={secondaryBtn}>Edit</a>}
            {c.status === 'published' && !admin && !openRevision && (
              <button disabled={busy} className={secondaryBtn} onClick={() => run('Draft revision created.', async () => {
                const newId = await createDraft(uid, draftFields(c.type, draftOf(c)), c.id);
                window.location.hash = `#/edit/${encodeURIComponent(newId)}`;
              })}>Propose changes</button>
            )}
            <MoreMenu items={more} disabled={busy} />
          </div>
        )}
      </header>

      {editor && c.status === 'draft' && (
        <Banner tone="draft">
          <strong>Draft.</strong> Members can't see this yet. {c.revisionOf
            ? <>It revises {original ? <a className="underline" href={hrefOf(original)}>the published version</a> : 'a published item'}, which stays live until this is published.</>
            : admin ? 'Publish it when it’s ready.' : 'An admin publishes it when it’s ready.'}
        </Banner>
      )}
      {editor && c.status === 'archived' && <Banner tone="draft"><strong>Archived.</strong> Hidden from members.</Banner>}
      {openRevision && editor && (
        <Banner>A revision of this item is in progress: <a className="underline" href={hrefOf(openRevision)}>open the draft</a>.</Banner>
      )}
      {busy && <p role="status" className="text-sm text-gray-600">Saving…</p>}
      {error && <Banner tone="error">{error}</Banner>}
      {notice && !error && <Banner>{notice}</Banner>}

      {c.type === 'checklist' && <Checklist key={checklistKey(uid, c)} uid={uid} c={c} />}
      {c.body.trim() && <Body markdown={c.body} />}
      {(c.links ?? []).length > 0 && (
        <section className={`${panel} p-4 md:p-5`}>
          <h2 className={heading}>{c.type === 'sop' ? 'References' : 'Links'}</h2>
          <div className="mt-3"><LinkList links={c.links} /></div>
        </section>
      )}
    </article>
  );
};
