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
  DocumentReference, Query, collection, doc, getDoc, onSnapshot, query, setDoc, where, writeBatch, deleteDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  AssessmentConfig, AssessmentReview, AssessmentStage, AssessmentSubmission, Assignment, Enrollment, Exercise,
  Module, ModuleVideo, ProgramOutline, Publication, ReviewerSlot, User,
} from '../types';
import { convertSkillGrading } from './migrate';
import {
  DEFAULT_ASSESSMENT_CONFIG, DEFAULT_ASSIGNMENTS, DEFAULT_CRITERIA, DEFAULT_OUTLINE,
  STAGE_SLOTS, PublicationKey, publicationKey, withConfigDefaults,
  reviewId, submissionId,
} from './config';

const STAGES: AssessmentStage[] = ['A', 'B', 'P1', 'P2', 'DA'];

// Subscribes to several queries/docs and merges their rows by id. `key`
// must change whenever the set of sources should change.
const useLive = <T extends { id: string }>(key: string | null, build: () => (Query | DocumentReference)[]) => {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    if (key === null) { setRows([]); return; }
    const sources = build();
    const results: Map<string, T>[] = sources.map(() => new Map());
    const publish = () => {
      const merged = new Map<string, T>();
      results.forEach(r => r.forEach((v, k) => merged.set(k, v)));
      setRows([...merged.values()]);
    };
    const unsubs = sources.map((src, i) => {
      const onError = (err: unknown) => console.error('Assessment sync error', err);
      if (src instanceof DocumentReference) {
        return onSnapshot(src, snap => {
          results[i] = snap.exists() ? new Map([[snap.id, snap.data() as T]]) : new Map();
          publish();
        }, onError);
      }
      return onSnapshot(src, snap => {
        results[i] = new Map(snap.docs.map(d => [d.id, d.data() as T]));
        publish();
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
  const outlineRows = useLive<ProgramOutline>(ready ? 'outline' : null, () => [doc(db, 'programOutline', 'current')]);
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
      const row: AssessmentSubmission = {
        id, traineeId: uid, stage, target, version, links, isComplete, submittedAt: new Date().toISOString(),
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
  const saveReview = async (
    traineeId: string, stage: AssessmentStage, target: string, slot: ReviewerSlot, submissionIdToGrade: string,
    scores: AssessmentReview['scores'], status: AssessmentReview['status'], feedback?: string,
  ) => {
    if (!authUid) return;
    const id = reviewId(traineeId, stage, target, slot);
    const row: AssessmentReview = {
      id, traineeId, stage, target, reviewerSlot: slot, reviewerUid: uid, submissionId: submissionIdToGrade,
      scores, status, updatedAt: new Date().toISOString(), ...(feedback?.trim() ? { feedback: feedback.trim() } : {}),
    };
    await setDoc(doc(db, 'reviews', id), row);
  };

  // --- admin / coordinator ---

  const upsertEnrollment = async (
    traineeId: string, fields: Pick<Enrollment, 'startDate' | 'reviewers' | 'podEpisodesRequired'>,
  ) => {
    if (!isAdmin) return;
    const reviewers = Object.fromEntries(Object.entries(fields.reviewers).filter(([, v]) => !!v)) as Enrollment['reviewers'];
    const existing = allEnrollments.find(e => e.id === traineeId);
    const row: Enrollment = {
      id: traineeId, traineeId, startDate: fields.startDate, podEpisodesRequired: fields.podEpisodesRequired, reviewers,
      reviewerUids: [...new Set(Object.values(reviewers))] as string[],
      createdAt: existing?.createdAt ?? new Date().toISOString(),
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
    await setDoc(doc(db, 'assessmentConfig', 'current'), { ...config, ...updates, id: 'current' });
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
    enrollments, assessmentSubmissions: submissions, assessmentReviews: reviews, publications,
    submitAssessmentVersion, saveReview, upsertEnrollment, setPublication, upsertExercise, deleteExercise,
    updateAssessmentConfig, setupAssessmentProgram, updateAssignment, convertToAssignmentGrading, saveOutline, saveAssignment, deleteAssignment,
  };
};

export type AssessmentApi = ReturnType<typeof useAssessment>;
