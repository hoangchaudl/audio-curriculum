import { useT } from './language';
import React, { useState } from 'react';
import { card, input, primaryBtn, secondaryBtn, sectionTitle } from '../components/assessment/ui';
import { OpsMember, OpsRole } from './model';
import { friendlyError, saveMember, useOpsMembers } from './data';
import { Banner, fmtDate } from './pages';

const ROLE_HELP: Record<OpsRole, string> = {
  member: 'Reads published content',
  leadership: 'Also reads leadership-only documents',
  editor: 'Also creates and edits drafts',
  admin: 'Also publishes, archives and manages access',
};

// Operations access is granted per verified email address of an existing
// Audio account. It never changes the person's Training Program role.
export const AccessPage: React.FC<{ uid: string; selfEmail: string }> = ({ uid, selfEmail }) => {
  const t = useT();
  const members = useOpsMembers(true);
  const [form, setForm] = useState({ email: '', name: '', role: 'member' as OpsRole });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const write = async (key: string, m: { email: string; name: string; role: OpsRole; active: boolean }, done: string) => {
    setBusy(key); setError(''); setNotice('');
    try {
      await saveMember(uid, m);
      setNotice(done);
      return true;
    } catch (err) {
      setError(friendlyError(err));
      return false;
    } finally {
      setBusy('');
    }
  };

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t('Enter a valid email address.')); return; }
    const existing = members.items.find(m => m.email === email);
    if (existing?.active && !window.confirm(t('{email} already has {role} access. Change it to {nextRole}?', { email, role: t(existing.role), nextRole: t(form.role) }))) return;
    if (await write('new', { ...form, email, active: true }, t('Access granted to {email}.', { email }))) setForm({ email: '', name: '', role: 'member' });
  };
  const update = (m: OpsMember, changes: Partial<Pick<OpsMember, 'role' | 'active'>>, done: string) =>
    write(m.email, { email: m.email, name: m.name ?? '', role: m.role, active: m.active, ...changes }, done);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display font-bold text-2xl text-gray-800">{t("Access")}</h1>
        <p className="text-sm text-gray-600">{t("Grant Audio Hub access by email address. People sign in with that Google account. Training Program roles are not affected. Training Program admins always administer the Audio Hub.")}</p>
      </header>
      <form onSubmit={grant} className={`${card} space-y-3`} noValidate>
        <h2 className={sectionTitle}>{t("Grant access")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input aria-label={t("Email")} type="email" placeholder="name@story.co" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={input} />
          <input aria-label={t("Name (optional)")} placeholder={t("Name (optional)")} maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={input} />
          <select aria-label={t("Role")} value={form.role} onChange={e => setForm({ ...form, role: e.target.value as OpsRole })} className={input}>
            {(Object.keys(ROLE_HELP) as OpsRole[]).map(r => <option key={r} value={r}>{t(r)} - {t(ROLE_HELP[r])}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-500">{t("The person signs in with this email. It must be a verified Google account (no Training Program account needed).")}</p>
        <button type="submit" disabled={busy === 'new'} className={primaryBtn}>{busy === 'new' ? t('Saving…') : t('Grant access')}</button>
      </form>
      {error && <Banner tone="error">{t(error)}</Banner>}
      {notice && !error && <Banner>{t(notice)}</Banner>}
      <section className={card}>
        <h2 className={sectionTitle}>{t("People with access")}</h2>
        {members.error ? <div className="mt-3"><Banner tone="error">{t(members.error)}</Banner></div>
          : !members.loaded ? <p role="status" className="text-sm text-gray-400 font-bold mt-3">{t("Loading…")}</p>
          : members.items.length === 0 ? <p className="text-sm text-gray-600 mt-3">{t("No one has been granted access yet.")}</p>
          : (
            <ul className="mt-3 divide-y divide-gray-100">
              {members.items.map(m => (
                <li key={m.email} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[12rem]">
                    <p className={`font-bold ${m.active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{m.name || m.email}{m.email === selfEmail && t(' (you)')}</p>
                    <p className="text-xs text-gray-500">{m.name && `${m.email} · `}{m.active ? t('Active') : t('Revoked')}{m.updatedAt && ` · ${t('changed {date}', { date: fmtDate(m.updatedAt) })}`}</p>
                  </div>
                  <select aria-label={t('Role for {email}', { email: m.email })} value={m.role} disabled={!!busy || !m.active}
                    onChange={e => update(m, { role: e.target.value as OpsRole }, t('{email} is now {role}.', { email: m.email, role: t(e.target.value) }))} className={`${input} !w-auto`}>
                    {(Object.keys(ROLE_HELP) as OpsRole[]).map(r => <option key={r} value={r}>{t(r)}</option>)}
                  </select>
                  {m.active ? (
                    <button disabled={!!busy} className={`${secondaryBtn} !text-ember`}
                      onClick={() => window.confirm(t('Revoke Audio Hub access for {email}?{self}', { email: m.email, self: m.email === selfEmail ? t(' This includes your own access.') : '' })) && update(m, { active: false }, t('Access revoked for {email}.', { email: m.email }))}>{t("Revoke")}</button>
                  ) : (
                    <button disabled={!!busy} className={secondaryBtn} onClick={() => update(m, { active: true }, t('Access restored for {email}.', { email: m.email }))}>{t("Restore")}</button>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
};
