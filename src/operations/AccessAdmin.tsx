import React, { useState } from 'react';
import { card, input, primaryBtn, secondaryBtn, sectionTitle } from '../components/assessment/ui';
import { OpsMember, OpsRole } from './model';
import { friendlyError, saveMember, useOpsMembers } from './data';
import { Banner, fmtDate } from './pages';

const ROLE_HELP: Record<OpsRole, string> = {
  member: 'Reads published content',
  editor: 'Also creates and edits drafts',
  admin: 'Also publishes, archives and manages access',
};

// Operations access is granted per verified email address of an existing
// Audio account. It never changes the person's Training Program role.
export const AccessPage: React.FC<{ uid: string; selfEmail: string }> = ({ uid, selfEmail }) => {
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address.'); return; }
    const existing = members.items.find(m => m.email === email);
    if (existing?.active && !window.confirm(`${email} already has ${existing.role} access. Change it to ${form.role}?`)) return;
    if (await write('new', { ...form, email, active: true }, `Access granted to ${email}.`)) setForm({ email: '', name: '', role: 'member' });
  };
  const update = (m: OpsMember, changes: Partial<Pick<OpsMember, 'role' | 'active'>>, done: string) =>
    write(m.email, { email: m.email, name: m.name ?? '', role: m.role, active: m.active, ...changes }, done);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display font-black text-2xl text-gray-800">Access</h1>
        <p className="text-sm text-gray-600">Grant Operations access to an existing StoryCo Audio account by its email address. Training Program roles are not affected. Training Program admins always administer Operations.</p>
      </header>
      <form onSubmit={grant} className={`${card} space-y-3`} noValidate>
        <h2 className={sectionTitle}>Grant access</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input aria-label="Email" type="email" placeholder="name@story.co" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={input} />
          <input aria-label="Name (optional)" placeholder="Name (optional)" maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={input} />
          <select aria-label="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as OpsRole })} className={input}>
            {(Object.keys(ROLE_HELP) as OpsRole[]).map(r => <option key={r} value={r}>{r} - {ROLE_HELP[r]}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-500">The person signs in with this email. It must be verified and belong to an account that already exists in the Training Program.</p>
        <button type="submit" disabled={busy === 'new'} className={primaryBtn}>{busy === 'new' ? 'Saving…' : 'Grant access'}</button>
      </form>
      {error && <Banner tone="error">{error}</Banner>}
      {notice && !error && <Banner>{notice}</Banner>}
      <section className={card}>
        <h2 className={sectionTitle}>People with access</h2>
        {members.error ? <div className="mt-3"><Banner tone="error">{members.error}</Banner></div>
          : !members.loaded ? <p role="status" className="text-sm text-gray-400 font-bold mt-3">Loading…</p>
          : members.items.length === 0 ? <p className="text-sm text-gray-600 mt-3">No one has been granted access yet.</p>
          : (
            <ul className="mt-3 divide-y divide-gray-100">
              {members.items.map(m => (
                <li key={m.email} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[12rem]">
                    <p className={`font-bold ${m.active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{m.name || m.email}{m.email === selfEmail && ' (you)'}</p>
                    <p className="text-xs text-gray-500">{m.name && `${m.email} · `}{m.active ? 'Active' : 'Revoked'}{m.updatedAt && ` · changed ${fmtDate(m.updatedAt)}`}</p>
                  </div>
                  <select aria-label={`Role for ${m.email}`} value={m.role} disabled={!!busy || !m.active}
                    onChange={e => update(m, { role: e.target.value as OpsRole }, `${m.email} is now ${e.target.value}.`)} className={`${input} !w-auto`}>
                    {(Object.keys(ROLE_HELP) as OpsRole[]).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {m.active ? (
                    <button disabled={!!busy} className={`${secondaryBtn} !text-ember`}
                      onClick={() => window.confirm(`Revoke Operations access for ${m.email}?${m.email === selfEmail ? ' This includes your own access.' : ''}`) && update(m, { active: false }, `Access revoked for ${m.email}.`)}>Revoke</button>
                  ) : (
                    <button disabled={!!busy} className={secondaryBtn} onClick={() => update(m, { active: true }, `Access restored for ${m.email}.`)}>Restore</button>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
};
