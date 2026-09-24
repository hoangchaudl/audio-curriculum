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
  AssessmentConfig, AssessmentReview, AssessmentStage, AssessmentSubmission, Enrollment, Exercise, Publication,
  ReviewerSlot, User,
} from '../types';
import {
  DEFAULT_ASSESSMENT_CONFIG, EPISODE_A_CATEGORY, EPISODE_A_EXERCISES, EPISODE_A_MODULES, STAGE_SLOTS, publicationKey,
  reviewId, submissionId,
} from './config';

const STAGES: AssessmentStage[] = ['A', 'B', 'P1', 'P2'];

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
  const config = configRows[0] ?? DEFAULT_ASSESSMENT_CONFIG;
  const configSaved = configRows.length > 0;

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

  const setPublication = async (traineeId: string, key: 'episodeA' | 'episodeB' | 'pod', published: boolean) => {
    if (!isAdmin) return;
    const current = allPublications.find(p => p.id === traineeId) ?? { id: traineeId, episodeA: false, episodeB: false, pod: false };
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
  // creates the Episode A category, its four modules and their exercises,
  // and the weights config. Anything that already exists is left alone, so
  // running it twice is harmless and existing content is never overwritten.
  const setupAssessmentProgram = async () => {
    if (!isAdmin) return;
    const batch = writeBatch(db);
    const missing = async (path: string, id: string) => !(await getDoc(doc(db, path, id))).exists();
    if (await missing('categories', EPISODE_A_CATEGORY.id)) batch.set(doc(db, 'categories', EPISODE_A_CATEGORY.id), EPISODE_A_CATEGORY);
    for (const m of EPISODE_A_MODULES) {
      if (await missing('modules', m.id)) batch.set(doc(db, 'modules', m.id), { ...m, restricted: false });
    }
    for (const e of EPISODE_A_EXERCISES) {
      if (!exercises.some(x => x.moduleId === e.moduleId) && await missing('exercises', e.id)) batch.set(doc(db, 'exercises', e.id), e);
    }
    if (!configSaved) batch.set(doc(db, 'assessmentConfig', 'current'), DEFAULT_ASSESSMENT_CONFIG);
    await batch.commit();
  };

  const setModuleWeight = async (moduleId: string, episodeAWeight: number) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, 'modules', moduleId), { episodeAWeight });
  };

  return {
    exercises, assessmentConfig: config, assessmentConfigSaved: configSaved,
    enrollments, assessmentSubmissions: submissions, assessmentReviews: reviews, publications,
    submitAssessmentVersion, saveReview, upsertEnrollment, setPublication, upsertExercise, deleteExercise,
    updateAssessmentConfig, setupAssessmentProgram, setModuleWeight,
  };
};

export type AssessmentApi = ReturnType<typeof useAssessment>;
