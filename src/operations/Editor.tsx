import { useT } from './language';
import React, { useState } from 'react';
import { card, input, primaryBtn, secondaryBtn } from '../components/assessment/ui';
import { CHECKLIST_KINDS, ContentType, Draft, OpsAccess, RESOURCE_KINDS, Route, SECTIONS, WORKFLOWS, draftFields, draftOf, validateDraft } from './model';
import { createDraft, friendlyError, saveContent } from './data';
import { MarkdownEditor } from '../components/assessment/MarkdownEditor';
import { Diagram } from './Diagram';
import { Banner, ContentState, StatusBadge } from './pages';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => {
  const t = useT();
  return (
  <label className="block text-xs font-bold text-gray-600 space-y-1">
    <span>{label}</span>
    {children}
    {hint && <span className="block font-medium text-gray-500">{hint}</span>}
  </label>
  );
};

export const EditorPage: React.FC<{ route: Extract<Route, { page: 'new' | 'edit' }>; uid: string; access: OpsAccess; content: ContentState }> = ({ route, uid, access, content }) => {
  const t = useT();
  const existing = route.page === 'edit' ? content.items.find(c => c.id === route.id) : undefined;
  const type: ContentType | undefined = route.page === 'new' ? route.type : existing?.type;
  const [d, setD] = useState<Draft>(() => draftOf(existing));
  const [seeded, setSeeded] = useState(!!existing || route.page === 'new');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [restricted, setRestricted] = useState(!!existing?.restricted);

  // The listener may deliver the document after the first render.
  if (!seeded && existing) { setSeeded(true); setD(draftOf(existing)); setRestricted(!!existing.restricted); }

  if (route.page === 'edit' && !existing) {
    return content.loaded ? <Banner tone="error">{t("This item doesn't exist or you can't edit it.")}</Banner> : <p role="status" className="text-sm text-gray-400 font-bold">{t("Loading…")}</p>;
  }
  // Published/archived items are admin-only; editors propose a revision draft instead.
  if (existing && existing.status !== 'draft' && access !== 'admin') {
    return <Banner tone="error">{t("Only admins edit ")}{t(existing.status)} {t(" items. Open the item and choose \"Propose changes\" to start a draft.")}</Banner>;
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
      const id = existing ? (await saveContent(uid, existing.id, fields, existing.restricted), existing.id) : await createDraft(uid, fields, undefined, restricted);
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
      <a href={existing ? `#/${s.path}/${encodeURIComponent(existing.id)}` : `#/${s.path}`} className="text-sm font-bold text-brand">{t("← Cancel")}</a>
      <header className="flex items-center gap-3">
        <h1 className="font-display font-bold text-2xl text-gray-800">{existing ? `${t('Edit')} ${t(s.singular)}` : `${t('New')} ${t(s.singular)}`}</h1>
        <StatusBadge status={existing?.status ?? 'draft'} />
      </header>
      {!existing && <Banner>{t("New items are saved as drafts. Only admins can publish them.")}</Banner>}
      {existing?.status === 'published' && <Banner>{t("You are editing the live version. Changes are visible to members as soon as you save.")}</Banner>}
      <div className={`${card} space-y-4`}>
        <Field label={t("Title")}><input required maxLength={200} value={d.title} onChange={e => set('title', e.target.value)} className={input} /></Field>
        {access === 'admin' && (
          <label className="flex items-start gap-2 text-sm font-semibold text-gray-700">
            <input type="checkbox" className="accent-brand mt-0.5" checked={restricted} disabled={!!existing} onChange={e => setRestricted(e.target.checked)} />
            <span>{t("Leadership only")}<span className="block text-xs font-medium text-gray-500">{existing ? t("Who can see this can't be changed after saving.") : t("Hidden from members and editors; only leadership and admins can read it. Only admins can edit it.")}</span></span>
          </label>
        )}
        {type === 'naming' && <>
          <Field label={t("Title code")} hint={t("The value substituted for {title} in the filename.")}><input maxLength={100} required value={d.namingCode ?? ''} onChange={e => set('namingCode', e.target.value)} className={input} /></Field>
          <Field label={t("Filename pattern")} hint={t("Use placeholders like {title}, {episode}, {version}, {character} or {extension}. Include any punctuation and file extension in your pattern.")}><input maxLength={200} required placeholder="{title}_EP{episode}_{version}.{extension}" value={d.namingPattern ?? ''} onChange={e => set('namingPattern', e.target.value)} className={`${input} font-mono`} /></Field>
          <Field label={t("Assigned team members")} hint={t("One account email per line. Assignments are visible to the Operations team; they do not grant site access.")}><textarea maxLength={5000} required rows={4} value={d.assignees ?? ''} onChange={e => set('assignees', e.target.value)} className={input} /></Field>
        </>}
        <Field label={t("Summary")} hint={t("One or two sentences shown in lists.")}><textarea maxLength={500} rows={2} value={d.summary} onChange={e => set('summary', e.target.value)} className={input} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={type === 'checklist' ? t('Checklist type') : t('Category')}>
            {categoryOptions ? (
              <select value={d.category} onChange={e => set('category', e.target.value)} className={input}>
                <option value="">{t("None")}</option>
                {categoryOptions.map(c => <option key={c} value={c}>{t(c)}</option>)}
              </select>
            ) : <input maxLength={100} value={d.category} onChange={e => set('category', e.target.value)} className={input} placeholder={t("e.g. Mixing")} />}
          </Field>
          <Field label={t("Owner")}><input maxLength={100} value={d.owner} onChange={e => set('owner', e.target.value)} className={input} placeholder={t("Person or team")} /></Field>
          {type === 'sop' && <Field label={t("Effective date (optional)")}><input type="date" value={d.effectiveDate} onChange={e => set('effectiveDate', e.target.value)} className={input} /></Field>}
        </div>
        <fieldset>
          <legend className="text-xs font-bold text-gray-600 mb-1">{t("Workflows")}</legend>
          <div className="flex flex-wrap gap-4">
            {WORKFLOWS.map(w => (
              <label key={w} className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input type="checkbox" className="accent-brand" checked={d.workflows.includes(w)}
                  onChange={e => set('workflows', e.target.checked ? [...d.workflows, w] : d.workflows.filter(x => x !== w))} />
                {t(w)}
              </label>
            ))}
          </div>
        </fieldset>
        {type === 'checklist' && (
          <Field label={t("Checklist items")} hint={t("One item per line.")}>
            <textarea rows={8} value={d.itemsText} onChange={e => set('itemsText', e.target.value)} className={`${input} font-mono`} />
          </Field>
        )}
        {/* div, not Field: a <label> would forward toolbar-gap clicks to the first button. */}
        <div className="space-y-1">
          <span className="block text-xs font-bold text-gray-600">{type === 'sop' ? t('Content (Markdown)') : t('Notes (Markdown, optional)')}</span>
          <MarkdownEditor value={d.body} onChange={v => set('body', v)} height={type === 'sop' ? 'h-96' : 'h-40'} />
        </div>
        <div className="space-y-1">
          <span className="block text-xs font-bold text-gray-600">{t("Diagram (optional)")}</span>
          <Diagram value={d.diagram ?? ''} onChange={v => set('diagram', v)} />
          <span className="block text-xs font-medium text-gray-500">{t("Draw boxes, arrows, text and sketches like a whiteboard. Shown under the text.")}</span>
        </div>
        <Field label={type === 'workshop' ? t('YouTube links') : type === 'sop' ? t('Reference links') : t('Links')} hint={type === 'sop' ? t('One per line: "Label | https://…" or just the URL. YouTube links play inline on the SOP; other links go under References.') : t('One per line: "Label | https://…" or just the URL. Link to existing storage - no uploads.')}>
          <textarea rows={4} value={d.linksText} onChange={e => set('linksText', e.target.value)} className={`${input} font-mono`} />
        </Field>
      </div>
      {errors.length > 0 && (
        <Banner tone="error"><ul className="list-disc pl-5">{errors.map(e => <li key={e}>{t(e)}</li>)}</ul></Banner>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={primaryBtn}>{saving ? t('Saving…') : existing ? t('Save changes') : t('Save draft')}</button>
        <a href={existing ? `#/${s.path}/${encodeURIComponent(existing.id)}` : `#/${s.path}`} className={secondaryBtn}>{t("Cancel")}</a>
      </div>
    </form>
  );
};
