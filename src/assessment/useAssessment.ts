// Live Firestore data + actions for the assessment program. Each role
// subscribes only to queries firestore.rules allows (rules aren't filters:
// an over-broad query is rejected outright):
//   - admins (coordinators): every assessment collection;
//   - trainees: their own enrollment, submissions and publication state,
//     plus their reviews for stages that have been published;
//   - reviewers: enrollments they're assigned to, those trainees'
//     submissions for the stages their slot reviews, and their own reviews.
import { useEffect, useMemo, useState } from 'react';
import {
  DocumentData, DocumentReference, Query, Timestamp, collection, deleteField, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where,
  writeBatch, deleteDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  AssessmentConfig, AssessmentReview, AssessmentStage, AssessmentSubmission, Assignment, Enrollment, Exercise,
  Invite, Module, ModuleVideo, ProgramOutcome, ProgramOutline, Publication, ReviewerSlot, ScoreSnapshot, User,
} from '../types';
import { convertSkillGrading } from './migrate';
import { isReleasedBy } from './standing';
import { notifySyncError } from '../components/assessment/ui';
import {
  DEFAULT_ASSESSMENT_CONFIG, DEFAULT_ASSIGNMENTS, DEFAULT_CRITERIA, DEFAULT_OUTLINE, scoreKeysFor,
  STAGE_SLOTS, PublicationKey, publicationKey, withConfigDefaults,
  reviewId, submissionId,
} from './config';

const STAGES: AssessmentStage[] = ['A', 'B', 'P1', 'P2', 'DA'];

// Times the server stamps (submittedAt, updatedAt) arrive as Timestamps -
// or, for a write still in flight, as the local estimate. The app works
// with ISO strings (older documents store them that way), so convert.
const withIsoTimes = <T,>(data: DocumentData): T =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v instanceof Timestamp ? v.toDate().toISOString() : v])) as T;
const rowOf = <T,>(snap: { data: (o: { serverTimestamps: 'estimate' }) => DocumentData | undefined }) =>
  withIsoTimes<T>(snap.data({ serverTimestamps: 'estimate' }) ?? {});

// Subscribes to several queries/docs and merges their rows by id. `key`
// must change whenever the set of sources should change.
// `loaded` turns true once every source has answered at least once.
type LiveRows<T> = T[] & { loaded?: boolean };
const useLive = <T extends { id: string }>(key: string | null, build: () => (Query | DocumentReference)[]): LiveRows<T> => {
  const [rows, setRows] = useState<LiveRows<T>>([]);
  useEffect(() => {
    if (key === null) { setRows([]); return; }
    const sources = build();
    const results: Map<string, T>[] = sources.map(() => new Map());
    const answered = new Set<number>();
    const publish = (i: number) => {
      answered.add(i);
      const merged = new Map<string, T>();
      results.forEach(r => r.forEach((v, k) => merged.set(k, v)));
      setRows(Object.assign([...merged.values()], { loaded: answered.size === sources.length }));
    };
    const unsubs = sources.map((src, i) => {
      const onError = (err: unknown) => { console.error('Assessment sync error', err); notifySyncError(); };
      if (src instanceof DocumentReference) {
        return onSnapshot(src, snap => {
          results[i] = snap.exists() ? new Map([[snap.id, rowOf<T>(snap)]]) : new Map();
          publish(i);
        }, onError);
      }
      return onSnapshot(src, snap => {
        results[i] = new Map(snap.docs.map(d => [d.id, rowOf<T>(d)]));
        publish(i);
      }, onError);
    });
    return () => unsubs.forEach(u => u());
    // `key` fully describes the sources; `build` is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rows;
};

const slotsHeldBy = (enrollment: Enrollment, uid: string) =>
  (Object.entries(enrollment.reviewers) as [ReviewerSlot, string][]).filter(([, holder]) => holder === uid).map(([slot]) => slot);

// Stages a set of slots may review (e.g. a producer only reviews Pod Trial).
const stagesForSlots = (slots: ReviewerSlot[]) => STAGES.filter(stage => STAGE_SLOTS[stage].some(s => slots.includes(s)));

export const useAssessment = (authUid: string | null, currentUser: User | null) => {
  const role = currentUser?.role;
  const isAdmin = role === 'admin';
  const ready = !!authUid && !!role;
  const uid = authUid ?? '';

  const exercises = useLive<Exercise>(ready ? 'exercises' : null, () => [collection(db, 'exercises')]);
  const configRows = useLive<AssessmentConfig>(ready ? 'config' : null, () => [doc(db, 'assessmentConfig', 'current')]);
  // Falls back to the built-in weights until an admin has set the program up.
  const config = configRows[0] ? withConfigDefaults(configRows[0]) : DEFAULT_ASSESSMENT_CONFIG;
  const configSaved = configRows.length > 0;

  const assignments = useLive<Assignment>(ready ? 'assignments' : null, () => [collection(db, 'assignments')]);
  // Released trainees don't get the weekly outline (firestore.rules).
  const released = role === 'sound_designer' && currentUser?.status === 'released';
  const outlineRows = useLive<ProgramOutline>(ready && !released ? 'outline' : null, () => [doc(db, 'programOutline', 'current')]);
  const programOutline = outlineRows[0] ?? null;

  // --- enrollments ---
  const allEnrollments = useLive<Enrollment>(ready && isAdmin ? 'enr:all' : null, () => [collection(db, 'enrollments')]);
  const ownEnrollment = useLive<Enrollment>(ready && !isAdmin ? `enr:own:${uid}` : null, () => [doc(db, 'enrollments', uid)]);
  const assignedEnrollments = useLive<Enrollment>(ready && !isAdmin ? `enr:assigned:${uid}` : null,
    () => [query(collection(db, 'enrollments'), where('reviewerUids', 'array-contains', uid))]);
  const enrollments = isAdmin ? allEnrollments : [...ownEnrollment, ...assignedEnrollments.filter(e => e.id !== uid)];

  // What this (non-admin) reviewer may read: [traineeId, stage] pairs.
  const reviewScope = useMemo(
    () => assignedEnrollments.flatMap(e => stagesForSlots(slotsHeldBy(e, uid)).map(stage => [e.traineeId, stage] as const)),
    [assignedEnrollments, uid],
  );
  const reviewScopeKey = reviewScope.map(p => p.join(':')).sort().join('|');

  // --- invites (admins only) ---
  const invites = useLive<Invite>(ready && isAdmin ? 'invites' : null, () => [collection(db, 'invites')]);

  // --- end-of-probation decisions (admins only) ---
  const programOutcomes = useLive<ProgramOutcome>(ready && isAdmin ? 'outcomes' : null, () => [collection(db, 'programOutcomes')]);

  // --- publications ---
  const allPublications = useLive<Publication>(ready && isAdmin ? 'pub:all' : null, () => [collection(db, 'publications')]);
  const pubTrainees = [...new Set<string>([uid, ...assignedEnrollments.map(e => e.traineeId)])].sort();
  const scopedPublications = useLive<Publication>(
    ready && !isAdmin ? `pub:${pubTrainees.join(',')}` : null,
    () => pubTrainees.map(t => doc(db, 'publications', t)),
  );
  const publications = isAdmin ? allPublications : scopedPublications;
  const ownPublication = publications.find(p => p.id === uid);

  // --- submissions ---
  const allSubmissions = useLive<AssessmentSubmission>(ready && isAdmin ? 'sub:all' : null, () => [collection(db, 'assessmentSubmissions')]);
  const scopedSubmissions = useLive<AssessmentSubmission>(ready && !isAdmin ? `sub:${uid}:${reviewScopeKey}` : null, () => [
    query(collection(db, 'assessmentSubmissions'), where('traineeId', '==', uid)),
    ...reviewScope.map(([traineeId, stage]) =>
      query(collection(db, 'assessmentSubmissions'), where('traineeId', '==', traineeId), where('stage', '==', stage))),
  ]);
  const submissions = isAdmin ? allSubmissions : scopedSubmissions;

  // --- reviews ---
  const publishedStages = STAGES.filter(s => ownPublication?.[publicationKey(s)]);
  const allReviews = useLive<AssessmentReview>(ready && isAdmin ? 'rev:all' : null, () => [collection(db, 'reviews')]);
  const scopedReviews = useLive<AssessmentReview>(ready && !isAdmin ? `rev:${uid}:${publishedStages.join(',')}` : null, () => [
    query(collection(db, 'reviews'), where('reviewerUid', '==', uid)),
    ...publishedStages.map(stage =>
      query(collection(db, 'reviews'), where('traineeId', '==', uid), where('stage', '==', stage))),
  ]);
  const reviews = isAdmin ? allReviews : scopedReviews;

  // --- actions -----------------------------------------------------------

  // Trainee: add a new version; earlier versions are never touched.
  const submitAssessmentVersion = async (
    stage: AssessmentStage, target: string, links: AssessmentSubmission['links'], isComplete: boolean, note?: string,
  ) => {
    if (!authUid) return;
    const existing = submissions.filter(s => s.traineeId === uid && s.stage === stage && s.target === target);
    let version = Math.max(0, ...existing.map(s => s.version)) + 1;
    // A version created elsewhere (another tab) makes our write an update,
    // which the rules deny - retry with the next number a couple of times.
    for (let attempt = 0; attempt < 3; attempt++, version++) {
      const id = submissionId(uid, stage, target, version);
      if ((await getDoc(doc(db, 'assessmentSubmissions', id)).catch(() => null))?.exists()) continue;
      // submittedAt: the server's clock (firestore.rules require it).
      const row = {
        id, traineeId: uid, stage, target, version, links, isComplete, submittedAt: serverTimestamp(),
        ...(note?.trim() ? { note: note.trim() } : {}),
      };
      try {
        await setDoc(doc(db, 'assessmentSubmissions', id), row);
        return;
      } catch (err) {
        if (attempt === 2) throw err;
      }
    }
  };

  // Reviewer: create or revise their review (allowed until published).
  // One review per target; an Episode A assignment passes one per grading
  // line, and they save together or not at all.
  const saveReview = async (
    traineeId: string, stage: AssessmentStage, targets: { target: string; scores: AssessmentReview['scores'] }[],
    slot: ReviewerSlot, submissionIdToGrade: string, status: AssessmentReview['status'], feedback?: string,
  ) => {
    if (!authUid) return;
    const batch = writeBatch(db);
    for (const { target, scores } of targets) {
      const id = reviewId(traineeId, stage, target, slot);
      batch.set(doc(db, 'reviews', id), {
        id, traineeId, stage, target, reviewerSlot: slot, reviewerUid: uid, submissionId: submissionIdToGrade,
        scores, status, updatedAt: serverTimestamp(), ...(feedback?.trim() ? { feedback: feedback.trim() } : {}),
      });
    }
    await batch.commit();
  };

  // --- admin / coordinator ---

  const upsertEnrollment = async (
    traineeId: string, fields: Pick<Enrollment, 'startDate' | 'reviewers' | 'podEpisodesRequired' | 'batch'>,
  ) => {
    if (!isAdmin) return;
    const reviewers = Object.fromEntries(Object.entries(fields.reviewers).filter(([, v]) => !!v)) as Enrollment['reviewers'];
    const existing = allEnrollments.find(e => e.id === traineeId);
    const row: Enrollment = {
      id: traineeId, traineeId, startDate: fields.startDate, podEpisodesRequired: fields.podEpisodesRequired, reviewers,
      reviewerUids: [...new Set(Object.values(reviewers))] as string[],
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      ...(fields.batch?.trim() ? { batch: fields.batch.trim() } : {}),
    };
    await setDoc(doc(db, 'enrollments', traineeId), row);
  };

  const setPublication = async (traineeId: string, key: PublicationKey, published: boolean) => {
    if (!isAdmin) return;
    const current = allPublications.find(p => p.id === traineeId) ?? { id: traineeId, episodeA: false, episodeB: false, pod: false, da: false };
    await setDoc(doc(db, 'publications', traineeId), { ...current, [key]: published, updatedAt: new Date().toISOString(), updatedBy: uid });
  };

  const upsertExercise = async (exercise: Exercise) => {
    if (!isAdmin) return;
    await setDoc(doc(db, 'exercises', exercise.id), exercise);
  };

  const deleteExercise = async (exerciseId: string) => {
    if (!isAdmin) return;
    await deleteDoc(doc(db, 'exercises', exerciseId));
  };

  const updateAssessmentConfig = async (updates: Partial<Omit<AssessmentConfig, 'id'>>) => {
    if (!isAdmin) return;
    const next = { ...config, ...updates, id: 'current' as const };
    await setDoc(doc(db, 'assessmentConfig', 'current'), { ...next, scoreKeys: scoreKeysFor(next) });
  };

  // One-time setup, run explicitly by an admin (never automatically):
  // creates the Episode A category and modules, the weights config, the
  // default assignments, their grading lines (exercises) and the weekly
  // outline. Idempotent and non-destructive: existing documents are kept.
  // Placeholder exercises from the first version of setup (same ids) are
  // just linked to their assignment - and renamed only if they still have
  // their default "Exercise N" title - so anything graded against them
  // stays valid.
  const setupAssessmentProgram = async () => {
    if (!isAdmin) return;
    const batch = writeBatch(db);
    const missing = async (path: string, id: string) => !(await getDoc(doc(db, path, id))).exists();
    for (const a of DEFAULT_ASSIGNMENTS) {
      if (await missing('assignments', a.id)) batch.set(doc(db, 'assignments', a.id), a);
    }
    for (const e of DEFAULT_CRITERIA) {
      const existing = exercises.find(x => x.id === e.id);
      if (!existing) {
        if (await missing('exercises', e.id)) batch.set(doc(db, 'exercises', e.id), e);
      } else if (!existing.assignmentId) {
        batch.update(doc(db, 'exercises', e.id), {
          assignmentId: e.assignmentId,
          ...(/^Exercise \d+$/.test(existing.title) ? { title: e.title } : {}),
        });
      }
    }
    if (!configSaved) batch.set(doc(db, 'assessmentConfig', 'current'), DEFAULT_ASSESSMENT_CONFIG);
    if (!programOutline) batch.set(doc(db, 'programOutline', 'current'), DEFAULT_OUTLINE);
    await batch.commit();
  };

  const saveOutline = async (outline: ProgramOutline) => {
    if (!isAdmin) return;
    await setDoc(doc(db, 'programOutline', 'current'), { ...outline, id: 'current' });
  };

  // Saves an assignment and replaces its Episode A grading lines in one
  // batch. Lines removed here are deleted; submissions and reviews are
  // never touched.
  const saveAssignment = async (assignment: Assignment, lines: Exercise[]) => {
    if (!isAdmin) return;
    const batch = writeBatch(db);
    const clean = Object.fromEntries(Object.entries(assignment).filter(([, v]) => v !== undefined));
    batch.set(doc(db, 'assignments', assignment.id), clean);
    const keep = new Set(lines.map(l => l.id));
    exercises.filter(e => e.assignmentId === assignment.id && !keep.has(e.id)).forEach(e => batch.delete(doc(db, 'exercises', e.id)));
    if (assignment.stage === 'A') lines.forEach(l => batch.set(doc(db, 'exercises', l.id), { ...l, assignmentId: assignment.id }));
    await batch.commit();
  };

  // Removes an assignment (and its grading lines) and takes it out of the
  // outline. Trainee submissions/reviews for it are preserved.
  const deleteAssignment = async (assignmentId: string) => {
    if (!isAdmin) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'assignments', assignmentId));
    exercises.filter(e => e.assignmentId === assignmentId).forEach(e => batch.delete(doc(db, 'exercises', e.id)));
    if (programOutline) {
      batch.set(doc(db, 'programOutline', 'current'), {
        ...programOutline,
        weeks: programOutline.weeks.map(w => ({ ...w, items: w.items.filter(i => !(i.kind === 'assignment' && i.assignmentId === assignmentId)) })),
      });
    }
    await batch.commit();
  };

  // Invite an email that hasn't signed up yet; trainee invites carry the
  // enrollment settings (see firestore.rules enrollmentMatchesInvite).
  const createInvite = async (fields: Omit<Invite, 'id' | 'createdAt' | 'createdBy' | 'reviewerUids'>) => {
    if (!isAdmin) return;
    const id = fields.email.trim().toLowerCase();
    const reviewers = fields.reviewers ? Object.fromEntries(Object.entries(fields.reviewers).filter(([, v]) => !!v)) as Enrollment['reviewers'] : undefined;
    const row: Invite = {
      ...fields, id, email: id,
      ...(fields.role === 'sound_designer' ? { reviewers: reviewers ?? {}, reviewerUids: [...new Set(Object.values(reviewers ?? {}))] as string[] } : {}),
      createdAt: new Date().toISOString(), createdBy: uid,
    };
    await setDoc(doc(db, 'invites', id), Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)));
  };
  const deleteInvite = async (id: string) => { if (isAdmin) await deleteDoc(doc(db, 'invites', id)); };

  // Record (or clear, with null) a checkpoint decision: Week 2 continue /
  // release, or the Week 4 full-time offer. A release (or no offer) closes
  // the trainee's lessons via users/{uid}.status; clearing it reopens them.
  // Decision and status are written together, so they never disagree.
  const saveCheckpoint = async (traineeId: string, fields: Partial<ProgramOutcome>, next: ProgramOutcome) => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'programOutcomes', traineeId), { id: traineeId, ...fields }, { merge: true });
    batch.update(doc(db, 'users', traineeId), { status: isReleasedBy(next) ? 'released' : 'active' });
    await batch.commit();
  };
  const current = (traineeId: string): ProgramOutcome => programOutcomes.find(o => o.id === traineeId) ?? { id: traineeId };
  const setWeek2Checkpoint = async (traineeId: string, decision: 'continue' | 'release' | null, note?: string) => {
    if (!isAdmin) return;
    const week2 = decision ? { decision, decidedAt: new Date().toISOString(), decidedBy: uid, ...(note?.trim() ? { note: note.trim() } : {}) } : undefined;
    await saveCheckpoint(traineeId, { week2: week2 ?? (deleteField() as never) }, { ...current(traineeId), week2 });
  };
  // `snapshot`: the scores the decision is based on, frozen with it.
  const setProgramOutcome = async (traineeId: string, decision: 'offered' | 'not_offered' | null, note?: string, snapshot?: ScoreSnapshot) => {
    if (!isAdmin) return;
    const fields = decision
      ? { decision, decidedAt: new Date().toISOString(), decidedBy: uid, note: note?.trim() ? note.trim() : deleteField(), snapshot: snapshot ?? deleteField() }
      : { decision: deleteField(), decidedAt: deleteField(), decidedBy: deleteField(), note: deleteField(), snapshot: deleteField() };
    await saveCheckpoint(traineeId, fields as Partial<ProgramOutcome>, { ...current(traineeId), decision: decision ?? undefined });
  };

  const updateAssignment = async (assignmentId: string, updates: Partial<Assignment>) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, 'assignments', assignmentId), updates);
  };

  // One-time move off the old Episode A "skill" modules (see migrate.ts):
  // writes the equivalent assignment weights and criterion shares, then
  // deletes the skill modules, their videos, their outline rows and the
  // Episode A category if nothing else is in it. One batch: all or nothing.
  const convertToAssignmentGrading = async (modules: Module[], moduleVideos: ModuleVideo[]) => {
    if (!isAdmin) return;
    const c = convertSkillGrading(modules, assignments, exercises);
    const gone = new Set(c.deleteModuleIds);
    const batch = writeBatch(db);
    c.assignments.forEach(a => batch.update(doc(db, 'assignments', a.id), { weight: a.weight }));
    c.criteria.forEach(e => batch.update(doc(db, 'exercises', e.id), { weight: e.weight, order: e.order }));
    c.deleteModuleIds.forEach(id => batch.delete(doc(db, 'modules', id)));
    moduleVideos.filter(v => gone.has(v.moduleId)).forEach(v => batch.delete(doc(db, 'moduleVideos', v.id)));
    if (programOutline) {
      batch.set(doc(db, 'programOutline', 'current'), {
        ...programOutline,
        weeks: programOutline.weeks.map(w => ({ ...w, items: w.items.filter(i => !(i.kind === 'content' && gone.has(i.moduleId))) })),
      });
    }
    if (!modules.some(m => m.category === 'episodeA' && !gone.has(m.id))) batch.delete(doc(db, 'categories', 'episodeA'));
    await batch.commit();
  };

  return {
    exercises, assignments, programOutline, assessmentConfig: config, assessmentConfigSaved: configSaved,
    enrollments, ownEnrollmentLoaded: isAdmin || !!ownEnrollment.loaded, assessmentSubmissions: submissions, assessmentReviews: reviews, publications, programOutcomes, setProgramOutcome, setWeek2Checkpoint,
    invites, createInvite, deleteInvite,
    submitAssessmentVersion, saveReview, upsertEnrollment, setPublication, upsertExercise, deleteExercise,
    updateAssessmentConfig, setupAssessmentProgram, updateAssignment, convertToAssignmentGrading, saveOutline, saveAssignment, deleteAssignment,
  };
};

export type AssessmentApi = ReturnType<typeof useAssessment>;
