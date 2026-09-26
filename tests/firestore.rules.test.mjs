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
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

let env;
const as = (uid) => env.authenticatedContext(uid).firestore();
// Invites only match a verified email; asUnverified is someone who typed
// that address at sign-up but hasn't proved they own the inbox.
const asEmail = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
const asUnverified = (uid, email) => env.authenticatedContext(uid, { email, email_verified: false }).firestore();
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
  it('a signed-in account without a profile (uninvited sign-up) reads no program content', async () => {
    const stranger = as('stranger');
    await assertFails(getDocs(collection(stranger, 'categories')));
    await assertFails(getDocs(query(collection(stranger, 'modules'), where('restricted', '==', false))));
    await assertFails(getDoc(doc(stranger, 'modules/open')));
    await assertFails(getDocs(collection(stranger, 'assignments')));
    await assertFails(getDocs(collection(stranger, 'exercises')));
    await assertFails(getDoc(doc(stranger, 'assessmentConfig/current')));
    await assertFails(getDoc(doc(stranger, 'programOutline/current')));
    // Still allowed: sign-up has to check whether the first admin exists.
    await assertSucceeds(getDoc(doc(stranger, 'config/bootstrap')));
  });
  it('users edit only their own name/avatar/theme/pod/read notifications', async () => {
    const d = as('designer');
    await assertSucceeds(updateDoc(doc(d, 'users/designer'), { name: 'New name', pod: 'Blue', readNotifications: ['a'] }));
    await assertFails(updateDoc(doc(d, 'users/designer'), { email: 'admin@story.co' }));
    await assertFails(updateDoc(doc(d, 'users/designer'), { anything: true }));
    await assertFails(updateDoc(doc(d, 'users/designer'), { name: 'x'.repeat(101) }));
    await assertFails(updateDoc(doc(d, 'users/designer'), { avatarBase64: 'x'.repeat(300001) }));
    await assertFails(updateDoc(doc(d, 'users/unlocked'), { name: 'Hijacked' }));
  });
});

// ---------------------------------------------------------------------------
describe('privacy: profiles and progress', () => {
  beforeEach(() => seed(async (db) => {
    await baseUsers(db);
    await setDoc(doc(db, 'users/reviewer'), { id: 'reviewer', role: 'reviewer', name: 'R' });
    await setDoc(doc(db, 'enrollments/designer'), { id: 'designer', traineeId: 'designer', reviewers: { producer: 'reviewer' }, reviewerUids: ['reviewer'] });
    await setDoc(doc(db, 'videoProgress/m1_designer'), { id: 'm1_designer', moduleId: 'm1', userId: 'designer', watchedAt: '2026-01-01' });
  }));

  it('profiles: own, admins/engineers, and assigned reviewers only', async () => {
    await assertSucceeds(getDoc(doc(as('designer'), 'users/designer')));
    await assertFails(getDoc(doc(as('designer'), 'users/unlocked'))); // another trainee
    await assertFails(getDocs(collection(as('designer'), 'users'))); // no roster for trainees
    await assertSucceeds(getDocs(collection(as('admin'), 'users')));
    await assertSucceeds(getDocs(collection(as('engineer'), 'users')));
    await assertSucceeds(getDoc(doc(as('reviewer'), 'users/designer'))); // assigned trainee
    await assertFails(getDoc(doc(as('reviewer'), 'users/unlocked'))); // not assigned
    await assertFails(getDocs(collection(as('reviewer'), 'users')));
  });

  it('video progress: own records, plus admins/engineers', async () => {
    await assertSucceeds(getDocs(query(collection(as('designer'), 'videoProgress'), where('userId', '==', 'designer'))));
    await assertFails(getDocs(collection(as('designer'), 'videoProgress')));
    await assertFails(getDoc(doc(as('unlocked'), 'videoProgress/m1_designer')));
    await assertFails(getDoc(doc(as('reviewer'), 'videoProgress/m1_designer')));
    await assertSucceeds(getDocs(collection(as('admin'), 'videoProgress')));
    await assertSucceeds(getDocs(collection(as('engineer'), 'videoProgress')));
  });
});

// ---------------------------------------------------------------------------
describe('videoProgress (mark as done)', () => {
  beforeEach(() => seed(baseUsers));

  it('trainees mark and un-mark only their own items', async () => {
    const rec = { id: 'm1_designer', moduleId: 'm1', userId: 'designer', watchedAt: '2026-01-01' };
    await assertSucceeds(setDoc(doc(as('designer'), 'videoProgress/m1_designer'), rec));
    await assertFails(deleteDoc(doc(as('unlocked'), 'videoProgress/m1_designer')));
    await assertFails(setDoc(doc(as('unlocked'), 'videoProgress/m1_x'), { ...rec, userId: 'designer' }));
    await assertSucceeds(deleteDoc(doc(as('designer'), 'videoProgress/m1_designer')));
  });
  it('nobody can take over (overwrite) another trainee\'s record', async () => {
    const rec = { id: 'm1_designer', moduleId: 'm1', userId: 'designer', watchedAt: '2026-01-01' };
    await assertSucceeds(setDoc(doc(as('designer'), 'videoProgress/m1_designer'), rec));
    await assertFails(setDoc(doc(as('unlocked'), 'videoProgress/m1_designer'), { ...rec, userId: 'unlocked' }));
    // Record ids are always <moduleId>_<own uid>.
    await assertFails(setDoc(doc(as('unlocked'), 'videoProgress/whatever'), { ...rec, id: 'whatever', userId: 'unlocked' }));
    await assertSucceeds(setDoc(doc(as('unlocked'), 'videoProgress/m1_unlocked'), { ...rec, id: 'm1_unlocked', userId: 'unlocked' }));
  });
});

// ---------------------------------------------------------------------------
describe('legacy 1-4 homework archive', () => {
  beforeEach(() => seed(async (db) => {
    await baseUsers(db);
    await setDoc(doc(db, 'submissions/s1'), { id: 's1', userId: 'designer', moduleId: 'm1', status: 'graded' });
    await setDoc(doc(db, 'grades/g1'), { id: 'g1', submissionId: 's1', score: 3 });
  }));
  it('admins can read it (to export); nobody else reads, and nobody writes', async () => {
    await assertSucceeds(getDocs(collection(as('admin'), 'submissions')));
    await assertSucceeds(getDocs(collection(as('admin'), 'grades')));
    await assertFails(getDoc(doc(as('designer'), 'submissions/s1')));
    await assertFails(getDoc(doc(as('engineer'), 'grades/g1')));
    await assertFails(setDoc(doc(as('designer'), 'submissions/s2'), { id: 's2', userId: 'designer' }));
    await assertFails(setDoc(doc(as('admin'), 'grades/g2'), { id: 'g2' }));
  });
});

// ---------------------------------------------------------------------------
describe('invites', () => {
  const trainee = {
    id: 'kim@story.co', email: 'kim@story.co', role: 'sound_designer', startDate: '2026-10-05', podEpisodesRequired: 2,
    reviewers: { trainer: 'trainer' }, reviewerUids: ['trainer'], createdAt: '2026-10-01', createdBy: 'admin',
  };
  const enrollment = { id: 'kim', traineeId: 'kim', startDate: '2026-10-05', podEpisodesRequired: 2, reviewers: { trainer: 'trainer' }, reviewerUids: ['trainer'], createdAt: '2026-10-05' };
  beforeEach(() => seed(async (db) => {
    await baseUsers(db);
    await setDoc(doc(db, 'invites/kim@story.co'), trainee);
    await setDoc(doc(db, 'invites/pat@story.co'), { id: 'pat@story.co', email: 'pat@story.co', role: 'reviewer', createdAt: '', createdBy: 'admin' });
  }));

  it('only admins create invites, and never for the admin role', async () => {
    await assertSucceeds(setDoc(doc(as('admin'), 'invites/new@story.co'), { ...trainee, id: 'new@story.co', email: 'new@story.co' }));
    await assertFails(setDoc(doc(as('admin'), 'invites/boss@story.co'), { ...trainee, id: 'boss@story.co', role: 'admin' }));
    await assertFails(setDoc(doc(as('designer'), 'invites/me@story.co'), { ...trainee, id: 'me@story.co' }));
  });
  it('the invited person (matching email, any case) reads and deletes only their own invite', async () => {
    await assertSucceeds(getDoc(doc(asEmail('kim', 'Kim@Story.co'), 'invites/kim@story.co')));
    await assertFails(getDoc(doc(asEmail('kim', 'kim@story.co'), 'invites/pat@story.co')));
    await assertSucceeds(deleteDoc(doc(asEmail('kim', 'kim@story.co'), 'invites/kim@story.co')));
  });
  it('an unverified email can\'t see or use the invite', async () => {
    const squatter = asUnverified('squat', 'pat@story.co');
    await assertFails(getDoc(doc(squatter, 'invites/pat@story.co')));
    await assertFails(setDoc(doc(squatter, 'users/squat'), { id: 'squat', role: 'reviewer', email: 'pat@story.co' }));
    await assertFails(deleteDoc(doc(squatter, 'invites/pat@story.co')));
    const kim = asUnverified('kim', 'kim@story.co');
    await assertFails(setDoc(doc(kim, 'enrollments/kim'), enrollment));
  });
  it('an invited reviewer signs up with the reviewer role; nobody else can', async () => {
    await assertSucceeds(setDoc(doc(asEmail('pat', 'pat@story.co'), 'users/pat'), { id: 'pat', role: 'reviewer', email: 'Pat@story.co' }));
    await assertFails(setDoc(doc(asEmail('pat', 'pat@story.co'), 'users/pat'), { id: 'pat', role: 'admin', email: 'pat@story.co' }));
    await assertFails(setDoc(doc(asEmail('pat', 'pat@story.co'), 'users/pat'), { id: 'pat', role: 'reviewer', email: 'someone@story.co' }));
    await assertFails(setDoc(doc(asEmail('zed', 'zed@story.co'), 'users/zed'), { id: 'zed', role: 'reviewer', email: 'zed@story.co' }));
  });
  it('an invited trainee creates a trainee profile - not a different role', async () => {
    await assertSucceeds(setDoc(doc(asEmail('kim', 'kim@story.co'), 'users/kim'), { id: 'kim', role: 'sound_designer', email: 'kim@story.co' }));
    await assertFails(setDoc(doc(asEmail('kim', 'kim@story.co'), 'users/kim2'), { id: 'kim2', role: 'sound_designer', email: 'kim@story.co' }));
  });
  it('an invited trainee enrolls themselves only with the invited settings', async () => {
    await assertFails(setDoc(doc(asEmail('kim', 'kim@story.co'), 'enrollments/kim'), { ...enrollment, startDate: '2026-09-01' }));
    await assertFails(setDoc(doc(asEmail('kim', 'kim@story.co'), 'enrollments/kim'), { ...enrollment, reviewerUids: ['trainer', 'kim'] }));
    await assertFails(setDoc(doc(asEmail('zed', 'zed@story.co'), 'enrollments/zed'), { ...enrollment, id: 'zed', traineeId: 'zed' }));
    await assertSucceeds(setDoc(doc(asEmail('kim', 'kim@story.co'), 'enrollments/kim'), enrollment));
    await assertFails(updateDoc(doc(asEmail('kim', 'kim@story.co'), 'enrollments/kim'), { podEpisodesRequired: 1 }));
  });
});

// ---------------------------------------------------------------------------
describe('signup roles and first-admin bootstrap', () => {
  beforeEach(() => seed(baseUsers));

  it('without an invite, new accounts cannot create any profile (invite-only)', async () => {
    await assertFails(setDoc(doc(as('new1'), 'users/new1'), { id: 'new1', role: 'sound_designer' }));
    await assertFails(setDoc(doc(asEmail('new1', 'new1@story.co'), 'users/new1'), { id: 'new1', role: 'sound_designer', email: 'new1@story.co' }));
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
    // Invite-only: the losing claimant gets no profile at all without an invite.
    await assertFails(setDoc(doc(second, 'users/second'), { id: 'second', role: 'sound_designer' }));
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
  // Writes stamp the server time, as the app does (rules require it).
  const put = (uid, r) => setDoc(doc(as(uid), `reviews/${r.id}`), { ...r, updatedAt: serverTimestamp() });
  const putSub = (uid, s) => setDoc(doc(as(uid), `assessmentSubmissions/${s.id}`), { ...s, submittedAt: serverTimestamp() });
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
    // Week-1-style assignment graded on two lines (Workflow + Dialogue).
    await setDoc(doc(db, 'assignments/asg1'), { id: 'asg1', title: 'Week 1', stage: 'A', materials: [] });
    await setDoc(doc(db, 'assignments/asgB'), { id: 'asgB', title: 'Episode B', stage: 'B', materials: [] });
    await setDoc(doc(db, 'exercises/lineWf'), { id: 'lineWf', moduleId: 'epA_m1', assignmentId: 'asg1', title: 'Workflow', order: 1, weight: 100 });
    await setDoc(doc(db, 'exercises/lineDx'), { id: 'lineDx', moduleId: 'epA_m2', assignmentId: 'asg1', title: 'Dialogue', order: 1, weight: 100 });
    await setDoc(doc(db, 'assessmentSubmissions/trainee__A__asg1__v1'), sub('A', 'asg1', 1));
    for (const s of [sub('A', 'ex1', 1), sub('B', 'episode', 1, false), sub('B', 'episode', 2), sub('P1', 'episode', 1), sub('A', 'ex1', 1, true, 'trainee2')]) {
      await setDoc(doc(db, `assessmentSubmissions/${s.id}`), s);
    }
  }));

  // --- submissions ---
  it('trainee submits new revisions of their own work', async () => {
    const s = sub('A', 'ex1', 2);
    await assertSucceeds(putSub(T, s));
  });
  it('the submission time is the server\'s, not the trainee\'s clock', async () => {
    const s = sub('A', 'ex1', 2);
    await assertFails(setDoc(doc(as(T), `assessmentSubmissions/${s.id}`), { ...s, submittedAt: '2026-01-01T00:00:00Z' }));
    await assertSucceeds(putSub(T, s));
  });
  it('links must be 1-10 labelled http(s) URLs; notes are capped', async () => {
    const s = sub('A', 'ex1', 2);
    const link = (url, label = 'Session') => ({ label, url });
    await assertFails(putSub(T, { ...s, links: [link('javascript:alert(1)')] }));
    await assertFails(putSub(T, { ...s, links: [link('https://ok.example'), link('ftp://files.example')] }));
    await assertFails(putSub(T, { ...s, links: [{ url: 'https://ok.example' }] }));
    await assertFails(putSub(T, { ...s, links: [link('https://ok.example', 'x'.repeat(101))] }));
    await assertFails(putSub(T, { ...s, links: Array.from({ length: 11 }, () => link('https://ok.example')) }));
    await assertFails(putSub(T, { ...s, note: 'x'.repeat(5001) }));
    await assertSucceeds(putSub(T, { ...s, note: 'Mixed at -23 LUFS', links: [link('HTTPS://drive.google.com/a'), link('https://f.io/b', 'Review')] }));
  });
  it('submitted versions are preserved: no overwrite, edit, or delete (even by admin)', async () => {
    const v1 = sub('A', 'ex1', 1);
    await assertFails(putSub(T, { ...v1, links: [{ label: 'x', url: 'y' }] }));
    await assertFails(updateDoc(doc(as(T), `assessmentSubmissions/${v1.id}`), { note: 'edited' }));
    await assertFails(deleteDoc(doc(as(T), `assessmentSubmissions/${v1.id}`)));
    await assertFails(deleteDoc(doc(as('admin'), `assessmentSubmissions/${v1.id}`)));
  });
  it('an enrolled account whose role was changed away from trainee can no longer submit', async () => {
    await assertSucceeds(updateDoc(doc(as('admin'), `users/${T}`), { role: 'reviewer' }));
    const s = sub('A', 'ex1', 2);
    await assertFails(putSub(T, s));
  });
  it('trainees cannot submit for someone else, when unenrolled, or with invalid targets', async () => {
    const other = sub('A', 'ex1', 2, true, 'trainee2');
    await assertFails(putSub(T, other));
    const unenrolled = sub('A', 'ex1', 1, true, 'unenrolled');
    await assertFails(putSub('unenrolled', unenrolled));
    const noExercise = sub('A', 'missing', 1);
    await assertFails(putSub(T, noExercise));
    const p2 = sub('P2', 'episode', 1); // this trainee needs only 1 pod episode
    await assertFails(putSub(T, p2));
    const badId = sub('A', 'ex1', 3);
    await assertFails(setDoc(doc(as(T), 'assessmentSubmissions/whatever'), { ...badId, id: 'whatever', submittedAt: serverTimestamp() }));
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
  it('admin-defined criteria: reviewers write exactly the keys the config lists for their slot', async () => {
    await seed(db => setDoc(doc(db, 'assessmentConfig/current'), { id: 'current', scoreKeys: {
      B: { trainer: ['mix', 'story'], engineer: ['mix'] }, P: {}, DA: {} } }));
    await assertSucceeds(put('duy', rev('B', 'episode', 'engineer', 'duy', 'trainee__B__episode__v2', { mix: 4 })));
    await assertFails(put('duy', rev('B', 'episode', 'engineer', 'duy', 'trainee__B__episode__v2', FULL))); // old keys no longer allowed
    await assertFails(put('trainer', rev('B', 'episode', 'trainer', 'trainer', 'trainee__B__episode__v2', { mix: 4 }))); // submitted needs every key
    await assertSucceeds(put('trainer', rev('B', 'episode', 'trainer', 'trainer', 'trainee__B__episode__v2', { mix: 4, story: 5 })));
    await assertFails(put('trainer', rev('B', 'episode', 'trainer', 'trainer', 'trainee__B__episode__v2', { mix: 4, story: 3.5 })));
  });
  it('Audio Description (DA): trainee submits; trainer, engineer and producer score every criterion; KSD cannot', async () => {
    const da = sub('DA', 'episode', 1);
    await assertSucceeds(putSub(T, da));
    const bad = sub('DA', 'asg1', 1); // DA is submitted against 'episode', like Episode B
    await assertFails(putSub(T, bad));
    await assertSucceeds(put('producer', rev('DA', 'episode', 'producer', 'producer', da.id, FULL)));
    await assertSucceeds(put('duy', rev('DA', 'episode', 'engineer', 'duy', da.id, FULL)));
    await assertSucceeds(put('trainer', rev('DA', 'episode', 'trainer', 'trainer', da.id, FULL)));
    await assertFails(put('ksd', rev('DA', 'episode', 'keySoundDesigner', 'ksd', da.id, FULL)));
    const q = (uid) => getDocs(query(collection(as(uid), 'assessmentSubmissions'), where('traineeId', '==', T), where('stage', '==', 'DA')));
    await assertSucceeds(q('producer'));
    await assertFails(q('ksd'));
  });
  it('full-time offer decisions are admin-only (the trainee and reviewers cannot read or write them)', async () => {
    const o = { id: T, decision: 'offered', decidedAt: '2026-10-20', decidedBy: 'admin' };
    await assertSucceeds(setDoc(doc(as('admin'), `programOutcomes/${T}`), o));
    await assertSucceeds(getDoc(doc(as('admin'), `programOutcomes/${T}`)));
    await assertFails(getDoc(doc(as(T), `programOutcomes/${T}`)));
    await assertFails(getDoc(doc(as('trainer'), `programOutcomes/${T}`)));
    await assertFails(setDoc(doc(as(T), `programOutcomes/${T}`), o));
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
  it('review feedback is capped at 10,000 characters', async () => {
    const r = rev('B', 'episode', 'engineer', 'duy', 'trainee__B__episode__v2', FULL);
    await assertFails(put('duy', { ...r, feedback: 'x'.repeat(10001) }));
    await assertSucceeds(put('duy', { ...r, feedback: 'Solid dialogue leveling.' }));
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

  // --- assignments & outline ---
  it('trainee submits against an Episode A assignment (not a B/P assignment id)', async () => {
    const s = sub('A', 'asg1', 2);
    await assertSucceeds(putSub(T, s));
    const wrong = sub('A', 'asgB', 1);
    await assertFails(putSub(T, wrong));
    const missing = sub('A', 'nope', 1);
    await assertFails(putSub(T, missing));
  });
  it('trainer grades each line of one assignment submission separately', async () => {
    await assertSucceeds(put('trainer', rev('A', 'lineWf', 'trainer', 'trainer', 'trainee__A__asg1__v1', { exercise: 5 })));
    await assertSucceeds(put('trainer', rev('A', 'lineDx', 'trainer', 'trainer', 'trainee__A__asg1__v1', { exercise: 3 })));
    // A line can't be graded against another assignment's submission.
    await assertFails(put('trainer', rev('A', 'lineWf', 'trainer', 'trainer', 'trainee__A__ex1__v1', { exercise: 5 })));
  });
  it('all lines of an assignment save in one batch (as the review queue does)', async () => {
    const db = as('trainer');
    const b = writeBatch(db);
    for (const [line, score] of [['lineWf', 5], ['lineDx', 3]]) {
      const r = rev('A', line, 'trainer', 'trainer', 'trainee__A__asg1__v1', { exercise: score });
      b.set(doc(db, `reviews/${r.id}`), { ...r, updatedAt: serverTimestamp() });
    }
    await assertSucceeds(b.commit());
  });
  it('review times are the server\'s', async () => {
    const r = rev('B', 'episode', 'engineer', 'duy', 'trainee__B__episode__v2', FULL);
    await assertFails(setDoc(doc(as('duy'), `reviews/${r.id}`), r));
  });
  it('the benchmark must be a score from 1 to 5', async () => {
    const cfg = { id: 'current', passThreshold: 3.5, stageWeights: { episodeA: 20, episodeB: 25, pod: 40, da: 15 } };
    await assertSucceeds(setDoc(doc(as('admin'), 'assessmentConfig/current'), { ...cfg, passThreshold: 4 }));
    await assertFails(setDoc(doc(as('admin'), 'assessmentConfig/current'), { ...cfg, passThreshold: 0 }));
    await assertFails(setDoc(doc(as('admin'), 'assessmentConfig/current'), { ...cfg, passThreshold: 6 }));
    await assertFails(setDoc(doc(as('admin'), 'assessmentConfig/current'), { ...cfg, passThreshold: '' }));
  });
  it('only admins arrange assignments and the outline', async () => {
    await assertSucceeds(getDoc(doc(as(T), 'assignments/asg1')));
    await assertFails(updateDoc(doc(as(T), 'assignments/asg1'), { dueDay: 7 }));
    await assertFails(setDoc(doc(as('trainer'), 'programOutline/current'), { id: 'current', weeks: [] }));
    await assertSucceeds(setDoc(doc(as('admin'), 'programOutline/current'), { id: 'current', weeks: [] }));
    await assertSucceeds(getDoc(doc(as(T), 'programOutline/current')));
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
