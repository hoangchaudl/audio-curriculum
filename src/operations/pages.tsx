import React, { useMemo, useState } from 'react';
import { card, input, primaryBtn, secondaryBtn, sectionTitle, Md } from '../components/assessment/ui';
import {
  CHECKLIST_KINDS, ContentType, OpsAccess, OpsContent, RESOURCE_KINDS, SECTIONS, WORKFLOWS,
  byUpdatedDesc, canEdit, checklistKey, draftFields, draftOf, isHttpUrl, matchesFilters,
} from './model';
import { createDraft, deleteContent, friendlyError, publishRevision, setStatus, useOpsContent } from './data';

export type ContentState = ReturnType<typeof useOpsContent>;

export const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-peach text-ember', published: 'bg-mint text-leaf', archived: 'bg-gray-100 text-gray-600',
};
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`text-[10px] uppercase font-black tracking-widest rounded-full px-2 py-0.5 ${STATUS_STYLE[status] ?? ''}`}>{status}</span>
);
const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-sky text-navy">{children}</span>
);

export const Banner: React.FC<{ tone?: 'error' | 'info'; children: React.ReactNode }> = ({ tone = 'info', children }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${tone === 'error' ? 'bg-rose text-ember' : 'bg-sky text-navy'}`}>{children}</div>
);

const LinkList: React.FC<{ links?: OpsContent['links'] }> = ({ links }) => (
  <ul className="space-y-1">
    {(links ?? []).filter(l => isHttpUrl(l.url)).map((l, i) => (
      <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#2E9DF7] underline break-all">{l.label || l.url}</a></li>
    ))}
  </ul>
);

const Meta: React.FC<{ c: OpsContent; showStatus: boolean }> = ({ c, showStatus }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
    {showStatus && <StatusBadge status={c.status} />}
    {c.category && <span className="font-bold text-gray-600">{c.category}</span>}
    {(c.workflows ?? []).map(w => <Tag key={w}>{w}</Tag>)}
    {c.updatedAt && <span>Updated {fmtDate(c.updatedAt)}</span>}
  </div>
);

const Loader: React.FC<{ content: ContentState }> = ({ content }) =>
  content.error ? <Banner tone="error">{content.error}</Banner> : !content.loaded ? <p role="status" className="text-sm text-gray-400 font-bold">Loading…</p> : null;

export const HomePage: React.FC<{ access: OpsAccess; content: ContentState }> = ({ access, content }) => {
  const published = content.items.filter(c => c.status === 'published');
  const recent = [...published].sort(byUpdatedDesc).slice(0, 8);
  const drafts = canEdit(access) ? content.items.filter(c => c.status === 'draft').sort(byUpdatedDesc) : [];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display font-black text-3xl text-gray-800">StoryCo Audio Operations</h1>
        <p className="text-sm text-gray-600 mt-1">SOPs, handoff checklists, schedules and resources for the audio team.</p>
      </header>
      <Loader content={content} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(Object.keys(SECTIONS) as ContentType[]).map(type => (
          <a key={type} href={`#/${SECTIONS[type].path}`} className={`${card} !p-5 block hover:shadow-md transition-shadow`}>
            <p className="font-black text-gray-800">{SECTIONS[type].label}</p>
            <p className="text-sm text-gray-600 mt-1">{SECTIONS[type].blurb}</p>
            <p className="text-xs font-bold text-[#2E9DF7] mt-2">{published.filter(c => c.type === type).length} published</p>
          </a>
        ))}
      </div>
      {drafts.length > 0 && (
        <section className={card}>
          <h2 className={sectionTitle}>Drafts in progress</h2>
          <ul className="mt-3 divide-y divide-gray-100">
            {drafts.map(c => <Row key={c.id} c={c} showStatus />)}
          </ul>
        </section>
      )}
      <section className={card}>
        <h2 className={sectionTitle}>Recently updated</h2>
        {content.loaded && recent.length === 0 ? (
          <p className="text-sm text-gray-600 mt-3">
            Nothing has been published yet.{canEdit(access) ? ' Open a section and create the first item - it stays a draft until an admin publishes it.' : ' Published SOPs, checklists and links will appear here.'}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">{recent.map(c => <Row key={c.id} c={c} showStatus={false} withType />)}</ul>
        )}
      </section>
    </div>
  );
};

const Row: React.FC<{ c: OpsContent; showStatus: boolean; withType?: boolean }> = ({ c, showStatus, withType }) => (
  <li className="py-3">
    <a href={`#/${SECTIONS[c.type].path}/${encodeURIComponent(c.id)}`} className="block group">
      <p className="font-bold text-gray-800 group-hover:text-[#2E9DF7]">
        {withType && <span className="text-xs font-black uppercase text-gray-400 mr-2">{SECTIONS[c.type].singular}</span>}
        {c.title}{c.revisionOf && <span className="text-xs font-bold text-ember ml-2">(revision)</span>}
      </p>
      {c.summary && <p className="text-sm text-gray-600 line-clamp-2">{c.summary}</p>}
      <div className="mt-1"><Meta c={c} showStatus={showStatus} /></div>
    </a>
  </li>
);

export const ListPage: React.FC<{ type: ContentType; access: OpsAccess; content: ContentState }> = ({ type, access, content }) => {
  const s = SECTIONS[type];
  const editor = canEdit(access);
  const [f, setF] = useState({ q: '', category: '', workflow: '', status: '' });
  const ofType = content.items.filter(c => c.type === type);
  const categories = useMemo(() => {
    const preset = type === 'checklist' ? CHECKLIST_KINDS : type === 'resource' ? RESOURCE_KINDS : [];
    return [...new Set([...preset, ...ofType.map(c => c.category ?? '').filter(Boolean)])].sort();
  }, [type, ofType]);
  const shown = ofType
    .filter(c => (f.status ? true : c.status !== 'archived'))
    .filter(c => matchesFilters(c, f))
    .sort((a, b) => a.title.localeCompare(b.title));
  const filtered = !!(f.q || f.category || f.workflow || f.status);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-black text-2xl text-gray-800">{s.label}</h1>
          <p className="text-sm text-gray-600">{s.blurb}</p>
        </div>
        {editor && <a href={`#/new/${type}`} className={primaryBtn}>New {s.singular}</a>}
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <input aria-label="Search by title" placeholder="Search by title" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} className={input} />
        <select aria-label="Category" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className={input}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="Workflow" value={f.workflow} onChange={e => setF({ ...f, workflow: e.target.value })} className={input}>
          <option value="">All workflows</option>
          {WORKFLOWS.map(w => <option key={w}>{w}</option>)}
        </select>
        {editor && (
          <select aria-label="Status" value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className={input}>
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
        ) : (
          <ul className={`${card} !py-2 divide-y divide-gray-100`}>
            {shown.map(c => (type === 'schedule' || type === 'resource') ? (
              <li key={c.id} className="py-3 space-y-1">
                <a href={`#/${s.path}/${encodeURIComponent(c.id)}`} className="font-bold text-gray-800 hover:text-[#2E9DF7]">{c.title}</a>
                {c.summary && <p className="text-sm text-gray-600">{c.summary}</p>}
                <LinkList links={c.links} />
                <Meta c={c} showStatus={editor} />
              </li>
            ) : <Row key={c.id} c={c} showStatus={editor} />)}
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
  return (
    <section className={card}>
      <div className="flex items-center gap-3">
        <h2 className={sectionTitle}>Checklist</h2>
        <span className="text-xs font-bold text-gray-500">{checked.filter(i => i < items.length).length}/{items.length}</span>
        <button onClick={() => save([])} disabled={!checked.length} className={`${secondaryBtn} ml-auto`}>Reset my checks</button>
      </div>
      <p className="text-xs text-gray-500 mt-1">Your checks are saved only in this browser for your own use. They are not shared and are not a completion record.</p>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#2E9DF7]" checked={checked.includes(i)}
                onChange={e => save(e.target.checked ? [...checked, i] : checked.filter(x => x !== i))} />
              <span className={checked.includes(i) ? 'line-through text-gray-400' : ''}>{item}</span>
            </label>
          </li>
        ))}
      </ul>
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
      <a href={`#/${s.path}`} className="text-sm font-bold text-[#2E9DF7]">← {s.label}</a>
      <header className="space-y-2">
        <h1 className="font-display font-black text-2xl text-gray-800">{c.title}</h1>
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
