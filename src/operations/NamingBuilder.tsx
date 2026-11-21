import { useT } from './language';
import React, { useState } from 'react';
import { card, input, primaryBtn, secondaryBtn } from '../components/assessment/ui';
import { OpsAccess, assignedEmails, buildFilename, canEdit, namingTokens } from './model';
import { Banner, ContentState } from './pages';

export const NamingBuilder: React.FC<{ email: string; access: OpsAccess; content: ContentState }> = ({ email, access, content }) => {
  const t = useT();
  const [selected, setSelected] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const titles = content.items.filter(c => c.type === 'naming' && c.status === 'published' && assignedEmails(c.assignees ?? '').includes(email.toLowerCase()));
  const title = titles.find(c => c.id === selected) ?? titles[0];
  const pattern = title?.namingPattern ?? '';
  const tokens = namingTokens(pattern).filter(k => k !== 'title');
  const filename = title ? buildFilename(pattern, { ...values, title: title.namingCode ?? '' }) : null;
  return <div className="space-y-5">
    <header><h1 className="font-bold text-2xl text-gray-900 tracking-tight">{t("Naming Builder")}</h1>
      <p className="text-sm text-gray-600">{t("Build a filename using the published pattern for a title assigned to you.")}</p></header>
    {canEdit(access) && <a href="#/titles" className={secondaryBtn}>{t("Manage title assignments")}</a>}
    {content.error ? <Banner tone="error">{t(content.error)}</Banner> : !content.loaded ? <p role="status">{t("Loading…")}</p> : !titles.length ?
      <Banner>{t("No titles are assigned to your email yet. Ask an admin to publish a title assignment with your email and its naming pattern.")}</Banner> : <section className={`${card} space-y-4`}>
      <label className="block text-sm font-bold text-gray-700">{t("Assigned title")}<select className={`${input} mt-1`} value={title?.id ?? ''} onChange={e => { setSelected(e.target.value); setValues({}); setNotice(''); }}>
          {titles.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      <p className="font-mono text-sm text-gray-600 break-all">{pattern}</p>
      <div className="grid sm:grid-cols-2 gap-4">{tokens.map(key => <label key={key} className="block text-sm font-bold text-gray-700">{key}
        <input className={`${input} mt-1`} maxLength={100} value={values[key] ?? ''} onChange={e => { setValues({ ...values, [key]: e.target.value }); setNotice(''); }} />
      </label>)}</div>
      {filename ? <>
        <label className="block text-sm font-bold text-gray-700">{t("Filename preview")}<input readOnly value={filename} className={`${input} mt-1 font-mono`} /></label>
        <button className={primaryBtn} onClick={async () => {
          try { await navigator.clipboard.writeText(filename); setNotice(t('Copied.')); }
          catch { setNotice(t('Could not copy. Select the preview and copy it manually.')); }
        }}>{t("Copy filename")}</button>
      </> : <p className="text-sm text-gray-600">{t("Fill in every field using filename-safe characters. Slashes, reserved characters and trailing dots are not allowed.")}</p>}
      {notice && <Banner>{t(notice)}</Banner>}
    </section>}
  </div>;
};
