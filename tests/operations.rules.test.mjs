// Firestore rules tests for the Audio Operations workspace. Local emulator
// only (demo- project id), fake accounts.
//
//   npm run test:rules
//
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

let env;
// Every Operations caller signs in with a verified email: memberships are keyed by it.
const emailOf = (uid) => `${uid.toLowerCase()}@story.co`;
const as = (uid) => env.authenticatedContext(uid, { email: emailOf(uid), email_verified: true }).firestore();
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
const member = (uid, role, active = true) => ({ email: emailOf(uid), name: uid, role, active, updatedAt: new Date(), updatedBy: 'admin' });

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-audio-curriculum',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const content = (uid, extra = {}) => ({
  type: 'sop', status: 'draft', title: 'Mix handoff', summary: '', body: '# Steps', category: 'Mixing',
  workflows: ['WEBTOON'], owner: 'Audio', effectiveDate: '', links: [{ label: 'Doc', url: 'https://example.com' }], items: [],
  createdBy: uid, createdAt: serverTimestamp(), updatedBy: uid, updatedAt: serverTimestamp(), ...extra,
});
const edit = (uid, extra = {}) => ({ updatedBy: uid, updatedAt: serverTimestamp(), ...extra });

beforeEach(() => seed(async (db) => {
  const users = {
    trainee: 'sound_designer', opsDesigner: 'sound_designer', editor: 'sound_designer', opsAdmin: 'audio_engineer',
    revoked: 'sound_designer', reviewer: 'reviewer', leader: 'leadership', engineer: 'audio_engineer', admin: 'admin',
  };
  for (const [id, role] of Object.entries(users)) await setDoc(doc(db, `users/${id}`), { id, role, name: id, email: emailOf(id) });
  await setDoc(doc(db, `operationsMembers/${emailOf('opsDesigner')}`), member('opsDesigner', 'member'));
  await setDoc(doc(db, `operationsMembers/${emailOf('editor')}`), member('editor', 'editor'));
  await setDoc(doc(db, `operationsMembers/${emailOf('opsAdmin')}`), member('opsAdmin', 'admin'));
  await setDoc(doc(db, `operationsMembers/${emailOf('revoked')}`), member('revoked', 'editor', false));
  await setDoc(doc(db, `operationsMembers/${emailOf('noProfile')}`), member('noProfile', 'admin'));
  await setDoc(doc(db, `operationsMembers/${emailOf('weird')}`), member('weird', 'owner'));
  await setDoc(doc(db, 'users/weird'), { id: 'weird', role: 'sound_designer' });
  const base = { ...content('editor'), createdAt: new Date(), updatedAt: new Date() };
  await setDoc(doc(db, 'operationsContent/pub'), { ...base, status: 'published', publishedAt: new Date(), publishedBy: 'admin' });
  await setDoc(doc(db, 'operationsContent/draft'), base);
  await setDoc(doc(db, 'operationsContent/old'), { ...base, status: 'archived' });
  // Curriculum content an Operations membership must not unlock.
  await setDoc(doc(db, 'modules/adv'), { id: 'adv', category: 'Advanced', restricted: true });
}));

const published = (db) => query(collection(db, 'operationsContent'), where('status', '==', 'published'));

describe('operations: who gets in', () => {
  it('a trainee without membership is denied, even for published content', async () => {
    const t = as('trainee');
    await assertFails(getDocs(published(t)));
    await assertFails(getDoc(doc(t, 'operationsContent/pub')));
    await assertFails(getDocs(collection(t, 'operationsMembers')));
    await assertSucceeds(getDoc(doc(t, `operationsMembers/${emailOf('trainee')}`))); // own (missing) membership
  });
  it('Curriculum roles alone grant nothing (reviewer, leadership, engineer)', async () => {
    for (const uid of ['reviewer', 'leader', 'engineer']) await assertFails(getDocs(published(as(uid))));
  });
  it('an explicitly authorized sound designer reads published content; their Curriculum role is unchanged', async () => {
    await assertSucceeds(getDocs(published(as('opsDesigner'))));
    await assertSucceeds(getDoc(doc(as('opsDesigner'), 'operationsContent/pub')));
    const profile = await getDoc(doc(as('opsDesigner'), 'users/opsDesigner'));
    assert.equal(profile.data().role, 'sound_designer');
  });
  it('missing, inactive or invalid membership denies access', async () => {
    await assertFails(getDocs(published(as('revoked'))));
    await assertFails(getDocs(published(as('weird')))); // unknown role
    // Unverified email: the membership doesn't count.
    const unverified = env.authenticatedContext('opsDesigner', { email: emailOf('opsDesigner'), email_verified: false }).firestore();
    await assertFails(getDocs(published(unverified)));
    await assertFails(getDocs(published(env.unauthenticatedContext().firestore())));
  });
  it('an Operations-only account (no Training Program profile) gets its granted role and nothing in Curriculum', async () => {
    const o = as('noProfile');
    await assertSucceeds(getDocs(published(o)));
    await assertSucceeds(getDocs(collection(o, 'operationsMembers'))); // granted admin
    await assertFails(getDocs(collection(o, 'categories')));
    await assertFails(getDocs(query(collection(o, 'modules'), where('restricted', '==', false))));
    await assertFails(getDocs(collection(o, 'users')));
    await assertFails(setDoc(doc(o, 'users/noProfile'), { id: 'noProfile', role: 'admin' }));
  });
  it('revocation applies on the next read', async () => {
    await assertSucceeds(getDocs(published(as('opsDesigner'))));
    await assertSucceeds(updateDoc(doc(as('admin'), `operationsMembers/${emailOf('opsDesigner')}`), edit('admin', { active: false })));
    await assertFails(getDocs(published(as('opsDesigner'))));
    await assertFails(getDoc(doc(as('opsDesigner'), 'operationsContent/pub')));
  });
});

describe('operations: members', () => {
  it('read published only; drafts and archived are denied by id and by query', async () => {
    const m = as('opsDesigner');
    await assertFails(getDoc(doc(m, 'operationsContent/draft')));
    await assertFails(getDoc(doc(m, 'operationsContent/old')));
    await assertFails(getDocs(collection(m, 'operationsContent')));
    await assertFails(getDocs(query(collection(m, 'operationsContent'), where('status', '==', 'draft'))));
  });
  it('cannot write content', async () => {
    const m = as('opsDesigner');
    await assertFails(setDoc(doc(m, 'operationsContent/new'), content('opsDesigner')));
    await assertFails(updateDoc(doc(m, 'operationsContent/pub'), edit('opsDesigner', { title: 'x' })));
    await assertFails(deleteDoc(doc(m, 'operationsContent/pub')));
  });
});

describe('operations: editors', () => {
  it('create and edit drafts, and read drafts', async () => {
    const e = as('editor');
    await assertSucceeds(setDoc(doc(e, 'operationsContent/new'), content('editor')));
    await assertSucceeds(updateDoc(doc(e, 'operationsContent/new'), edit('editor', { title: 'Better title' })));
    await assertSucceeds(getDocs(collection(e, 'operationsContent')));
    await assertSucceeds(deleteDoc(doc(e, 'operationsContent/new')));
  });
  it('cannot publish, archive, or create pre-published content', async () => {
    const e = as('editor');
    await assertFails(updateDoc(doc(e, 'operationsContent/draft'), edit('editor', { status: 'published' })));
    await assertFails(updateDoc(doc(e, 'operationsContent/draft'), edit('editor', { status: 'archived' })));
    await assertFails(setDoc(doc(e, 'operationsContent/new'), content('editor', { status: 'published' })));
    await assertFails(setDoc(doc(e, 'operationsContent/new'), content('editor', { publishedAt: serverTimestamp(), publishedBy: 'editor' })));
  });
  it('cannot modify or delete the live published (or archived) version', async () => {
    const e = as('editor');
    await assertFails(updateDoc(doc(e, 'operationsContent/pub'), edit('editor', { body: 'sneaky change' })));
    await assertFails(updateDoc(doc(e, 'operationsContent/pub'), edit('editor', { status: 'draft' })));
    await assertFails(updateDoc(doc(e, 'operationsContent/old'), edit('editor', { status: 'draft' })));
    await assertFails(deleteDoc(doc(e, 'operationsContent/pub')));
    // A revision is a separate draft; the published document is untouched.
    await assertSucceeds(setDoc(doc(e, 'operationsContent/rev'), content('editor', { revisionOf: 'pub' })));
  });
  it('rejects forged authorship, bad fields and client timestamps', async () => {
    const e = as('editor');
    await assertFails(setDoc(doc(e, 'operationsContent/n1'), content('editor', { createdBy: 'admin' })));
    await assertFails(setDoc(doc(e, 'operationsContent/n2'), content('editor', { updatedAt: new Date() })));
    await assertFails(setDoc(doc(e, 'operationsContent/n3'), content('editor', { type: 'secret' })));
    await assertFails(setDoc(doc(e, 'operationsContent/n4'), content('editor', { extra: true })));
    await assertFails(setDoc(doc(e, 'operationsContent/n5'), content('editor', { title: '' })));
    await assertFails(setDoc(doc(e, 'operationsContent/n6'), content('editor', { workflows: ['Netflix'] })));
    await assertFails(updateDoc(doc(e, 'operationsContent/draft'), edit('editor', { createdBy: 'editor2' })));
  });
});

describe('operations: admins', () => {
  it('Curriculum admins and Operations admins publish, archive and edit live content', async () => {
    for (const uid of ['admin', 'opsAdmin']) {
      const a = as(uid);
      await assertSucceeds(updateDoc(doc(a, 'operationsContent/draft'), edit(uid, { status: 'published', publishedAt: serverTimestamp(), publishedBy: uid })));
      await assertSucceeds(updateDoc(doc(a, 'operationsContent/draft'), edit(uid, { body: 'live fix' })));
      await assertSucceeds(updateDoc(doc(a, 'operationsContent/draft'), edit(uid, { status: 'archived' })));
      await assertSucceeds(updateDoc(doc(a, 'operationsContent/draft'), edit(uid, { status: 'draft' })));
    }
  });
  it('publish a revision over the original atomically', async () => {
    await seed((db) => setDoc(doc(db, 'operationsContent/rev'), { ...content('editor', { revisionOf: 'pub', body: 'v2' }), createdAt: new Date(), updatedAt: new Date() }));
    const a = as('opsAdmin');
    const batch = writeBatch(a);
    batch.update(doc(a, 'operationsContent/pub'), edit('opsAdmin', { body: 'v2', status: 'published', publishedAt: serverTimestamp(), publishedBy: 'opsAdmin' }));
    batch.delete(doc(a, 'operationsContent/rev'));
    await assertSucceeds(batch.commit());
  });
  it('cannot forge publication stamps without publishing', async () => {
    await assertFails(updateDoc(doc(as('admin'), 'operationsContent/draft'), edit('admin', { publishedAt: serverTimestamp(), publishedBy: 'admin' })));
  });
  it('manage memberships: grant, change role, revoke', async () => {
    const a = as('opsAdmin');
    const email = emailOf('trainee');
    await assertSucceeds(getDocs(collection(a, 'operationsMembers')));
    await assertSucceeds(setDoc(doc(a, `operationsMembers/${email}`), { email, name: 'T', role: 'member', active: true, ...edit('opsAdmin') }));
    await assertSucceeds(getDocs(published(as('trainee'))));
    await assertSucceeds(updateDoc(doc(a, `operationsMembers/${email}`), edit('opsAdmin', { role: 'editor' })));
    await assertSucceeds(updateDoc(doc(as('admin'), `operationsMembers/${email}`), edit('admin', { active: false })));
    await assertFails(getDocs(published(as('trainee'))));
  });
  it('membership documents are validated', async () => {
    const a = as('admin');
    const email = emailOf('trainee');
    const ok = { email, role: 'member', active: true, ...edit('admin') };
    await assertFails(setDoc(doc(a, `operationsMembers/${email}`), { ...ok, role: 'owner' }));
    await assertFails(setDoc(doc(a, `operationsMembers/${email}`), { ...ok, email: 'other@story.co' }));
    await assertFails(setDoc(doc(a, 'operationsMembers/Trainee@story.co'), { ...ok, email: 'Trainee@story.co' }));
    await assertFails(setDoc(doc(a, `operationsMembers/${email}`), { ...ok, active: 'yes' }));
    await assertFails(setDoc(doc(a, `operationsMembers/${email}`), { ...ok, curriculumRole: 'admin' }));
  });
});

describe('operations: escalation', () => {
  it('nobody grants themselves membership or raises their own role', async () => {
    const t = as('trainee');
    const email = emailOf('trainee');
    await assertFails(setDoc(doc(t, `operationsMembers/${email}`), { email, role: 'admin', active: true, ...edit('trainee') }));
    await assertFails(updateDoc(doc(as('editor'), `operationsMembers/${emailOf('editor')}`), edit('editor', { role: 'admin' })));
    await assertFails(updateDoc(doc(as('revoked'), `operationsMembers/${emailOf('revoked')}`), edit('revoked', { active: true })));
    await assertFails(setDoc(doc(as('opsDesigner'), `operationsMembers/${emailOf('trainee')}`), { email: emailOf('trainee'), role: 'member', active: true, ...edit('opsDesigner') }));
    // Members can't see other people's memberships.
    await assertFails(getDoc(doc(as('opsDesigner'), `operationsMembers/${emailOf('editor')}`)));
    await assertFails(getDocs(collection(as('editor'), 'operationsMembers')));
  });
  it('Operations access grants no Curriculum access', async () => {
    for (const uid of ['opsAdmin', 'editor', 'opsDesigner']) {
      const db = as(uid);
      await assertFails(updateDoc(doc(db, `users/${uid}`), { role: 'admin' }));
      await assertFails(setDoc(doc(db, 'categories/x'), { id: 'x', name: 'X', order: 9, restricted: false }));
    }
    // Sound-designer Ops admin/editor: still no roster and no locked lessons.
    for (const uid of ['editor', 'opsDesigner']) {
      await assertFails(getDocs(collection(as(uid), 'users')));
      await assertFails(getDoc(doc(as(uid), 'modules/adv')));
    }
    await assertFails(getDocs(collection(as('opsAdmin'), 'programOutcomes')));
  });
});
