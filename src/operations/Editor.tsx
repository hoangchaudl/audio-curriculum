import React, { useState } from 'react';
import { input, primaryBtn, secondaryBtn } from '../components/assessment/ui';
import { CHECKLIST_KINDS, ContentType, Draft, OpsAccess, RESOURCE_KINDS, Route, SECTIONS, WORKFLOWS, draftFields, draftOf, validateDraft } from './model';
import { createDraft, friendlyError, saveContent } from './data';
import { Banner, ContentState, StatusBadge, pageTitle, panel } from './pages';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block text-xs font-bold text-gray-600 space-y-1">
    <span>{label}</span>
    {children}
    {hint && <span className="block font-medium text-gray-500">{hint}</span>}
  </label>
);

export const EditorPage: React.FC<{ route: Extract<Route, { page: 'new' | 'edit' }>; uid: string; access: OpsAccess; content: ContentState }> = ({ route, uid, access, content }) => {
  const existing = route.page === 'edit' ? content.items.find(c => c.id === route.id) : undefined;
  const type: ContentType | undefined = route.page === 'new' ? route.type : existing?.type;
  const [d, setD] = useState<Draft>(() => draftOf(existing));
  const [seeded, setSeeded] = useState(!!existing || route.page === 'new');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // The listener may deliver the document after the first render.
  if (!seeded && existing) { setSeeded(true); setD(draftOf(existing)); }

  if (route.page === 'edit' && !existing) {
    return content.loaded ? <Banner tone="error">This item doesn't exist or you can't edit it.</Banner> : <p role="status" className="text-sm text-gray-400 font-bold">Loading…</p>;
  }
  // Published/archived items are admin-only; editors propose a revision draft instead.
  if (existing && existing.status !== 'draft' && access !== 'admin') {
    return <Banner tone="error">Only admins edit {existing.status} items. Open the item and choose "Propose changes" to start a draft.</Banner>;
  }
  const s = SECTIONS[type!];
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const problems = validateDraft(type!, d);
    setErrors(problems);
    if (problems.length) return;
    setSaving(true);
    try {
      const fields = draftFields(type!, d);
      const id = existing ? (await saveContent(uid, existing.id, fields), existing.id) : await createDraft(uid, fields);
      // Only navigate away once the server confirmed the write.
      window.location.hash = `#/${s.path}/${encodeURIComponent(id)}`;
    } catch (err) {
      setErrors([friendlyError(err)]);
      setSaving(false);
    }
  };

  const categoryOptions = type === 'checklist' ? CHECKLIST_KINDS : type === 'resource' ? RESOURCE_KINDS : null;
  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <a href={existing ? `#/${s.path}/${encodeURIComponent(existing.id)}` : `#/${s.path}`} className="text-sm font-bold text-[#2E9DF7]">← Cancel</a>
      <header className="flex items-center gap-3">
        <h1 className={pageTitle}>{existing ? `Edit ${s.singular}` : `New ${s.singular}`}</h1>
        <StatusBadge status={existing?.status ?? 'draft'} />
      </header>
      {!existing && <Banner>New items are saved as drafts. Only admins can publish them.</Banner>}
      {existing?.status === 'published' && <Banner>You are editing the live version. Changes are visible to members as soon as you save.</Banner>}
      <div className={`${panel} p-5 md:p-6 space-y-4`}>
        <Field label="Title"><input required maxLength={200} value={d.title} onChange={e => set('title', e.target.value)} className={input} /></Field>
        <Field label="Summary" hint="One or two sentences shown in lists."><textarea maxLength={500} rows={2} value={d.summary} onChange={e => set('summary', e.target.value)} className={input} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={type === 'checklist' ? 'Checklist type' : 'Category'}>
            {categoryOptions ? (
              <select value={d.category} onChange={e => set('category', e.target.value)} className={input}>
                <option value="">None</option>
                {categoryOptions.map(c => <option key={c}>{c}</option>)}
              </select>
            ) : <input maxLength={100} value={d.category} onChange={e => set('category', e.target.value)} className={input} placeholder="e.g. Mixing" />}
          </Field>
          <Field label="Owner"><input maxLength={100} value={d.owner} onChange={e => set('owner', e.target.value)} className={input} placeholder="Person or team" /></Field>
          {type === 'sop' && <Field label="Effective date (optional)"><input type="date" value={d.effectiveDate} onChange={e => set('effectiveDate', e.target.value)} className={input} /></Field>}
        </div>
        <fieldset>
          <legend className="text-xs font-bold text-gray-600 mb-1">Workflows</legend>
          <div className="flex flex-wrap gap-4">
            {WORKFLOWS.map(w => (
              <label key={w} className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input type="checkbox" className="accent-[#2E9DF7]" checked={d.workflows.includes(w)}
                  onChange={e => set('workflows', e.target.checked ? [...d.workflows, w] : d.workflows.filter(x => x !== w))} />
                {w}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input type="checkbox" className="w-4 h-4 accent-[#2E9DF7]" checked={d.pinned} onChange={e => set('pinned', e.target.checked)} />
          Show in "Start here" on Home (once published)
        </label>
        {type === 'checklist' && (
          <Field label="Checklist items" hint="One item per line.">
            <textarea rows={8} value={d.itemsText} onChange={e => set('itemsText', e.target.value)} className={`${input} font-mono`} />
          </Field>
        )}
        <Field label={type === 'sop' ? 'Content (Markdown)' : 'Notes (Markdown, optional)'}>
          <textarea rows={type === 'sop' ? 14 : 5} value={d.body} onChange={e => set('body', e.target.value)} className={`${input} font-mono`} />
        </Field>
        <Field label={type === 'sop' ? 'Reference links' : 'Links'} hint='One per line: "Label | https://…" or just the URL. Link to existing storage - no uploads.'>
          <textarea rows={4} value={d.linksText} onChange={e => set('linksText', e.target.value)} className={`${input} font-mono`} />
        </Field>
      </div>
      {errors.length > 0 && (
        <Banner tone="error"><ul className="list-disc pl-5">{errors.map(e => <li key={e}>{e}</li>)}</ul></Banner>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Saving…' : existing ? 'Save changes' : 'Save draft'}</button>
        <a href={existing ? `#/${s.path}/${encodeURIComponent(existing.id)}` : `#/${s.path}`} className={secondaryBtn}>Cancel</a>
      </div>
    </form>
  );
};
