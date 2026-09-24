// Firestore security rules tests. Runs against the local emulator only,
// with a `demo-` project id (which can never reach a real project) and
// fake accounts - never live trainee data.
//
//   npm run test:rules
//
import { after, before, beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

let env;
const as = (uid) => env.authenticatedContext(uid).firestore();
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-audio-curriculum',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const baseUsers = (db) => Promise.all([
  setDoc(doc(db, 'users/designer'), { id: 'designer', role: 'sound_designer', name: 'D' }),
  setDoc(doc(db, 'users/unlocked'), { id: 'unlocked', role: 'sound_designer', name: 'U', unlockedCategories: ['Advanced'] }),
  setDoc(doc(db, 'users/engineer'), { id: 'engineer', role: 'audio_engineer', name: 'E' }),
  setDoc(doc(db, 'users/admin'), { id: 'admin', role: 'admin', name: 'A' }),
]);

// ---------------------------------------------------------------------------
describe('category lock (curriculum)', () => {
  beforeEach(() => seed(async (db) => {
    await baseUsers(db);
    await setDoc(doc(db, 'modules/open'), { id: 'open', category: 'Onboarding', restricted: false });
    await setDoc(doc(db, 'modules/adv'), { id: 'adv', category: 'Advanced', restricted: true });
    await setDoc(doc(db, 'modules/legacy'), { id: 'legacy', category: 'Onboarding' });
    await setDoc(doc(db, 'moduleVideos/advVideo'), { id: 'advVideo', moduleId: 'adv', category: 'Advanced', restricted: true });
  }));

  it('designer can query unrestricted modules and read an open one', async () => {
    await assertSucceeds(getDocs(query(collection(as('designer'), 'modules'), where('restricted', '==', false))));
    await assertSucceeds(getDoc(doc(as('designer'), 'modules/open')));
  });
  it('designer cannot read locked content by id, list, or category query', async () => {
    const d = as('designer');
    await assertFails(getDoc(doc(d, 'modules/adv')));
    await assertFails(getDoc(doc(d, 'moduleVideos/advVideo')));
    await assertFails(getDocs(collection(d, 'modules')));
    await assertFails(getDocs(query(collection(d, 'modules'), where('category', '==', 'Advanced'))));
  });
  it('documents without the restricted flag stay locked until backfilled', async () => {
    await assertFails(getDoc(doc(as('designer'), 'modules/legacy')));
    await assertSucceeds(updateDoc(doc(as('admin'), 'modules/legacy'), { restricted: false }));
    await assertSucceeds(getDoc(doc(as('designer'), 'modules/legacy')));
  });
  it('unlocked designer can read the unlocked category', async () => {
    await assertSucceeds(getDocs(query(collection(as('unlocked'), 'modules'), where('category', '==', 'Advanced'))));
    await assertSucceeds(getDoc(doc(as('unlocked'), 'moduleVideos/advVideo')));
  });
  it('engineer and admin read everything', async () => {
    await assertSucceeds(getDocs(collection(as('engineer'), 'modules')));
    await assertSucceeds(getDocs(collection(as('admin'), 'modules')));
  });
  it('users cannot unlock themselves; admins can unlock them', async () => {
    await assertSucceeds(updateDoc(doc(as('designer'), 'users/designer'), { theme: 'dark' }));
    await assertFails(updateDoc(doc(as('designer'), 'users/designer'), { unlockedCategories: ['Advanced'] }));
    await assertFails(updateDoc(doc(as('unlocked'), 'users/unlocked'), { unlockedCategories: ['Advanced', 'X'] }));
    await assertSucceeds(updateDoc(doc(as('admin'), 'users/designer'), { unlockedCategories: ['Advanced'] }));
  });
  it('only admins change roles (e.g. to reviewer); users cannot change their own', async () => {
    await assertSucceeds(updateDoc(doc(as('admin'), 'users/designer'), { role: 'reviewer' }));
    await assertFails(updateDoc(doc(as('engineer'), 'users/unlocked'), { role: 'reviewer' }));
    await assertFails(updateDoc(doc(as('unlocked'), 'users/unlocked'), { role: 'reviewer' }));
    await assertFails(updateDoc(doc(as('engineer'), 'users/engineer'), { role: 'admin' }));
  });
  it('only admins manage categories', async () => {
    const cat = { id: 'x', name: 'X', order: 9, restricted: false };
    await assertFails(setDoc(doc(as('designer'), 'categories/x'), cat));
    await assertFails(setDoc(doc(as('engineer'), 'categories/x'), cat));
    await assertSucceeds(setDoc(doc(as('admin'), 'categories/x'), cat));
    await assertSucceeds(getDocs(collection(as('designer'), 'categories')));
  });
});

// ---------------------------------------------------------------------------
describe('signup roles and first-admin bootstrap', () => {
  beforeEach(() => seed(baseUsers));

  it('new accounts can only create themselves as sound designers', async () => {
    await assertSucceeds(setDoc(doc(as('new1'), 'users/new1'), { id: 'new1', role: 'sound_designer' }));
    await assertFails(setDoc(doc(as('new2'), 'users/new2'), { id: 'new2', role: 'admin' }));
    await assertFails(setDoc(doc(as('new3'), 'users/new3'), { id: 'new3', role: 'audio_engineer' }));
    await assertFails(setDoc(doc(as('new4'), 'users/new4'), { id: 'new4', role: 'reviewer' }));
    await assertFails(setDoc(doc(as('new5'), 'users/new5'), { id: 'new5', role: 'sound_designer', unlockedCategories: ['Advanced'] }));
  });
  it('bootstrap claim: not on behalf of others, not without an admin profile', async () => {
    await assertFails(setDoc(doc(as('evil'), 'config/bootstrap'), { adminUid: 'someoneElse' }));
    await assertFails(setDoc(doc(as('designer'), 'config/bootstrap'), { adminUid: 'designer' }));
  });
  it('existing admin records the claim; it is then immutable and closes the path', async () => {
    await assertSucceeds(setDoc(doc(as('admin'), 'config/bootstrap'), { adminUid: 'admin' }));
    await assertFails(updateDoc(doc(as('admin'), 'config/bootstrap'), { adminUid: 'designer' }));
    await assertFails(deleteDoc(doc(as('admin'), 'config/bootstrap')));
    const late = as('late');
    const b = writeBatch(late);
    b.set(doc(late, 'users/late'), { id: 'late', role: 'admin' });
    b.set(doc(late, 'config/bootstrap'), { adminUid: 'late' });
    await assertFails(b.commit());
  });
  it('first signup claims admin atomically; a second claimant is rejected', async () => {
    const first = as('first');
    const b1 = writeBatch(first);
    b1.set(doc(first, 'users/first'), { id: 'first', role: 'admin' });
    b1.set(doc(first, 'config/bootstrap'), { adminUid: 'first' });
    await assertSucceeds(b1.commit());
    const second = as('second');
    const b2 = writeBatch(second);
    b2.set(doc(second, 'users/second'), { id: 'second', role: 'admin' });
    b2.set(doc(second, 'config/bootstrap'), { adminUid: 'second' });
    await assertFails(b2.commit());
    await assertSucceeds(setDoc(doc(second, 'users/second'), { id: 'second', role: 'sound_designer' }));
    await assertFails(updateDoc(doc(second, 'users/second'), { role: 'admin' }));
  });
});

// ---------------------------------------------------------------------------
describe('assessment program', () => {
  const T = 'trainee';
  const sub = (stage, target, version, isComplete = true, traineeId = T) => ({
    id: `${traineeId}__${stage}__${target}__v${version}`, traineeId, stage, target, version, isComplete,
    links: [{ label: 'Session', url: 'https://drive.google.com/fake' }], submittedAt: '2026-01-05T10:00:00Z',
  });
  const rev = (stage, target, slot, reviewerUid, submissionId, scores, status = 'submitted') => ({
    id: `${T}__${stage}__${target}__${slot}`, traineeId: T, stage, target, reviewerSlot: slot, reviewerUid,
    submissionId, scores, status, updatedAt: '2026-01-06T10:00:00Z',
  });
  const put = (uid, r) => setDoc(doc(as(uid), `reviews/${r.id}`), r);
  const FULL = { workflow: 4, dialogue: 4, sfx: 4, music: 4 };

  beforeEach(() => seed(async (db) => {
    await baseUsers(db);
    for (const [id, role] of [[T, 'sound_designer'], ['trainee2', 'sound_designer'], ['unenrolled', 'sound_designer'],
      ['trainer', 'reviewer'], ['duy', 'audio_engineer'], ['ksd', 'reviewer'], ['producer', 'reviewer'], ['outsider', 'reviewer']]) {
      await setDoc(doc(db, `users/${id}`), { id, role, name: id });
    }
    await setDoc(doc(db, `enrollments/${T}`), {
      id: T, traineeId: T, startDate: '2026-01-05', podEpisodesRequired: 1, createdAt: '2026-01-01',
      reviewers: { trainer: 'trainer', engineer: 'duy', keySoundDesigner: 'ksd', producer: 'producer' },
      reviewerUids: ['trainer', 'duy', 'ksd', 'producer'],
    });
    await setDoc(doc(db, 'enrollments/trainee2'), {
      id: 'trainee2', traineeId: 'trainee2', startDate: '2026-01-05', podEpisodesRequired: 2, createdAt: '2026-01-01',
      reviewers: { trainer: 'outsider' }, reviewerUids: ['outsider'],
    });
    await setDoc(doc(db, 'exercises/ex1'), { id: 'ex1', moduleId: 'epA_m3', title: 'Ex 1', order: 1, weight: 100 });
    for (const s of [sub('A', 'ex1', 1), sub('B', 'episode', 1, false), sub('B', 'episode', 2), sub('P1', 'episode', 1), sub('A', 'ex1', 1, true, 'trainee2')]) {
      await setDoc(doc(db, `assessmentSubmissions/${s.id}`), s);
    }
  }));

  // --- submissions ---
  it('trainee submits new revisions of their own work', async () => {
    const s = sub('A', 'ex1', 2);
    await assertSucceeds(setDoc(doc(as(T), `assessmentSubmissions/${s.id}`), s));
  });
  it('submitted versions are preserved: no overwrite, edit, or delete (even by admin)', async () => {
    const v1 = sub('A', 'ex1', 1);
    await assertFails(setDoc(doc(as(T), `assessmentSubmissions/${v1.id}`), { ...v1, links: [{ label: 'x', url: 'y' }] }));
    await assertFails(updateDoc(doc(as(T), `assessmentSubmissions/${v1.id}`), { note: 'edited' }));
    await assertFails(deleteDoc(doc(as(T), `assessmentSubmissions/${v1.id}`)));
    await assertFails(deleteDoc(doc(as('admin'), `assessmentSubmissions/${v1.id}`)));
  });
  it('trainees cannot submit for someone else, when unenrolled, or with invalid targets', async () => {
    const other = sub('A', 'ex1', 2, true, 'trainee2');
    await assertFails(setDoc(doc(as(T), `assessmentSubmissions/${other.id}`), other));
    const unenrolled = sub('A', 'ex1', 1, true, 'unenrolled');
    await assertFails(setDoc(doc(as('unenrolled'), `assessmentSubmissions/${unenrolled.id}`), unenrolled));
    const noExercise = sub('A', 'missing', 1);
    await assertFails(setDoc(doc(as(T), `assessmentSubmissions/${noExercise.id}`), noExercise));
    const p2 = sub('P2', 'episode', 1); // this trainee needs only 1 pod episode
    await assertFails(setDoc(doc(as(T), `assessmentSubmissions/${p2.id}`), p2));
    const badId = sub('A', 'ex1', 3);
    await assertFails(setDoc(doc(as(T), 'assessmentSubmissions/whatever'), { ...badId, id: 'whatever' }));
  });
  it('a trainee sees only their own submissions', async () => {
    await assertSucceeds(getDocs(query(collection(as(T), 'assessmentSubmissions'), where('traineeId', '==', T))));
    await assertFails(getDoc(doc(as(T), 'assessmentSubmissions/trainee2__A__ex1__v1')));
    await assertFails(getDocs(query(collection(as(T), 'assessmentSubmissions'), where('traineeId', '==', 'trainee2'))));
  });
  it('reviewers see only assigned trainees and only stages they review', async () => {
    const q = (uid, traineeId, stage) =>
      getDocs(query(collection(as(uid), 'assessmentSubmissions'), where('traineeId', '==', traineeId), where('stage', '==', stage)));
    await assertSucceeds(q('trainer', T, 'A'));
    await assertSucceeds(q('duy', T, 'B'));
    await assertFails(q('duy', T, 'A')); // Episode A is trainer-only
    await assertFails(q('producer', T, 'B'));
    await assertSucceeds(q('producer', T, 'P1'));
    await assertSucceeds(q('ksd', T, 'P1'));
    await assertFails(q('outsider', T, 'A')); // not assigned to this trainee
    await assertFails(q('trainer', 'trainee2', 'A'));
  });

  // --- reviews ---
  it('trainer grades an Episode A exercise on the 1-5 scale', async () => {
    await assertSucceeds(put('trainer', rev('A', 'ex1', 'trainer', 'trainer', 'trainee__A__ex1__v1', { exercise: 4 })));
  });
  it('scores must be whole numbers from 1 to 5', async () => {
    await assertFails(put('trainer', rev('A', 'ex1', 'trainer', 'trainer', 'trainee__A__ex1__v1', { exercise: 6 })));
    await assertFails(put('trainer', rev('A', 'ex1', 'trainer', 'trainer', 'trainee__A__ex1__v1', { exercise: 0 })));
    await assertFails(put('trainer', rev('A', 'ex1', 'trainer', 'trainer', 'trainee__A__ex1__v1', { exercise: 3.5 })));
  });
  it('only the assigned account can write a slot, and only as themselves', async () => {
    await assertFails(put('outsider', rev('A', 'ex1', 'trainer', 'outsider', 'trainee__A__ex1__v1', { exercise: 4 })));
    await assertFails(put('duy', rev('A', 'ex1', 'trainer', 'trainer', 'trainee__A__ex1__v1', { exercise: 4 })));
    await assertFails(put(T, rev('A', 'ex1', 'trainer', T, 'trainee__A__ex1__v1', { exercise: 5 })));
  });
  it('Episode A accepts only the trainer; Episode B only trainer and engineer', async () => {
    await assertFails(put('duy', rev('A', 'ex1', 'engineer', 'duy', 'trainee__A__ex1__v1', { exercise: 4 })));
    await assertFails(put('producer', rev('B', 'episode', 'producer', 'producer', 'trainee__B__episode__v2', { sfx: 4, music: 4 })));
    await assertSucceeds(put('duy', rev('B', 'episode', 'engineer', 'duy', 'trainee__B__episode__v2', FULL)));
  });
  it('producer can score only SFX and Music', async () => {
    await assertFails(put('producer', rev('P1', 'episode', 'producer', 'producer', 'trainee__P1__episode__v1', FULL)));
    await assertFails(put('producer', rev('P1', 'episode', 'producer', 'producer', 'trainee__P1__episode__v1', { workflow: 4 }, 'draft')));
    await assertSucceeds(put('producer', rev('P1', 'episode', 'producer', 'producer', 'trainee__P1__episode__v1', { sfx: 4, music: 5 })));
    await assertSucceeds(put('ksd', rev('P1', 'episode', 'keySoundDesigner', 'ksd', 'trainee__P1__episode__v1', FULL)));
  });
  it('reviews must point at a matching submission; Episode B needs a complete one', async () => {
    await assertFails(put('trainer', rev('B', 'episode', 'trainer', 'trainer', 'trainee__B__episode__v1', FULL))); // not complete
    await assertFails(put('trainer', rev('B', 'episode', 'trainer', 'trainer', 'trainee__A__ex1__v1', FULL))); // wrong stage
    await assertFails(put('trainer', rev('A', 'ex1', 'trainer', 'trainer', 'trainee2__A__ex1__v1', { exercise: 4 }))); // other trainee
    await assertSucceeds(put('trainer', rev('B', 'episode', 'trainer', 'trainer', 'trainee__B__episode__v2', FULL)));
  });
  it('a submitted review needs every criterion; drafts may be partial', async () => {
    await assertFails(put('duy', rev('B', 'episode', 'engineer', 'duy', 'trainee__B__episode__v2', { workflow: 4, dialogue: 4, sfx: 4 })));
    await assertSucceeds(put('duy', rev('B', 'episode', 'engineer', 'duy', 'trainee__B__episode__v2', { workflow: 4 }, 'draft')));
  });
  it('reviewers are independent: they cannot read each other\'s reviews', async () => {
    const r = rev('B', 'episode', 'trainer', 'trainer', 'trainee__B__episode__v2', FULL);
    await put('trainer', r);
    await assertSucceeds(getDoc(doc(as('trainer'), `reviews/${r.id}`)));
    await assertFails(getDoc(doc(as('duy'), `reviews/${r.id}`)));
    await assertSucceeds(getDocs(query(collection(as('duy'), 'reviews'), where('reviewerUid', '==', 'duy'))));
  });

  // --- publication ---
  it('trainees see scores only after publication, per stage', async () => {
    await put('trainer', rev('B', 'episode', 'trainer', 'trainer', 'trainee__B__episode__v2', FULL));
    await put('trainer', rev('A', 'ex1', 'trainer', 'trainer', 'trainee__A__ex1__v1', { exercise: 4 }));
    const q = (stage) => getDocs(query(collection(as(T), 'reviews'), where('traineeId', '==', T), where('stage', '==', stage)));
    await assertFails(q('B'));
    await assertFails(getDoc(doc(as(T), 'reviews/trainee__B__episode__trainer')));
    await assertFails(setDoc(doc(as(T), `publications/${T}`), { id: T, episodeA: true, episodeB: true, pod: true }));
    await assertSucceeds(setDoc(doc(as('admin'), `publications/${T}`), { id: T, episodeA: false, episodeB: true, pod: false }));
    await assertSucceeds(q('B'));
    await assertFails(q('A')); // Episode A not published yet
  });
  it('publishing locks that stage\'s reviews; other stages stay editable', async () => {
    const b = rev('B', 'episode', 'trainer', 'trainer', 'trainee__B__episode__v2', FULL);
    await put('trainer', b);
    await seed((db) => setDoc(doc(db, `publications/${T}`), { id: T, episodeA: false, episodeB: true, pod: false }));
    await assertFails(put('trainer', { ...b, scores: { ...FULL, music: 5 } }));
    await assertSucceeds(put('trainer', rev('A', 'ex1', 'trainer', 'trainer', 'trainee__A__ex1__v1', { exercise: 3 })));
  });
  it('trainee and assigned reviewers can read publication state; outsiders cannot', async () => {
    await seed((db) => setDoc(doc(db, `publications/${T}`), { id: T, episodeA: false, episodeB: false, pod: false }));
    await assertSucceeds(getDoc(doc(as(T), `publications/${T}`)));
    await assertSucceeds(getDoc(doc(as('producer'), `publications/${T}`)));
    await assertFails(getDoc(doc(as('outsider'), `publications/${T}`)));
    await assertFails(getDoc(doc(as('trainee2'), `publications/${T}`)));
  });

  // --- configuration ---
  it('trainees cannot change weights, enrollment, reviewers, or publication', async () => {
    await assertFails(updateDoc(doc(as(T), 'exercises/ex1'), { weight: 50 }));
    await assertFails(setDoc(doc(as(T), 'assessmentConfig/current'), { id: 'current', passThreshold: 1 }));
    await assertFails(updateDoc(doc(as(T), `enrollments/${T}`), { podEpisodesRequired: 2 }));
    await assertFails(updateDoc(doc(as(T), `enrollments/${T}`), { 'reviewers.trainer': T, reviewerUids: [T] }));
    await assertFails(updateDoc(doc(as('duy'), `enrollments/${T}`), { podEpisodesRequired: 2 }));
    await assertSucceeds(updateDoc(doc(as('admin'), 'exercises/ex1'), { weight: 50 }));
  });
  it('enrollment is visible to the trainee and assigned reviewers only', async () => {
    await assertSucceeds(getDoc(doc(as(T), `enrollments/${T}`)));
    await assertSucceeds(getDocs(query(collection(as('producer'), 'enrollments'), where('reviewerUids', 'array-contains', 'producer'))));
    await assertFails(getDoc(doc(as('outsider'), `enrollments/${T}`)));
    await assertFails(getDoc(doc(as('trainee2'), `enrollments/${T}`)));
  });
});
