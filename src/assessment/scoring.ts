// Single source of truth for every assessment number the app shows.
// Pure functions over plain data (no Firestore access), so they are fully
// unit-tested (scoring.test.ts) and every screen agrees on the result.
//
// Rules implemented here:
// - New scores are 1-5. Legacy 1-4 `grades` are never read.
// - Missing data yields an explicit "awaiting" outcome, never a zero.
// - Reviewer table cell weights already include the criterion weight and
//   are applied once (never multiplied by a criterion weight again).
import {
  AssessmentConfig, AssessmentReview, AssessmentStage, AssessmentSubmission, CellWeight,
  Enrollment, Exercise, Module, ReviewerSlot,
} from '../types';
import { CRITERIA, REVIEWER_SLOTS, allowedScoreKeys } from './config';

export type AwaitingReason = 'enrollment' | 'assignment' | 'submission' | 'assessment';
export type Outcome =
  | { status: 'scored'; value: number }
  | { status: 'awaiting'; reason: AwaitingReason; missing: string[] };

const AWAITING_LABELS: Record<AwaitingReason, string> = {
  enrollment: 'Not enrolled',
  assignment: 'Awaiting assessment (reviewer not assigned)',
  submission: 'Awaiting submission',
  assessment: 'Awaiting assessment',
};

// Scores are shown and judged at 2 decimals.
export const roundScore = (v: number) => Math.round(v * 100) / 100;

export const outcomeLabel = (o: Outcome) => (o.status === 'scored' ? roundScore(o.value).toFixed(2) : AWAITING_LABELS[o.reason]);

const scored = (value: number): Outcome => ({ status: 'scored', value });
const awaiting = (reason: AwaitingReason, missing: string[]): Outcome => ({ status: 'awaiting', reason, missing });

// When several parts are missing, report the most fundamental reason
// (you can't be assessed before you've submitted) and list everything.
const REASON_PRIORITY: AwaitingReason[] = ['enrollment', 'assignment', 'submission', 'assessment'];
const mergeAwaiting = (outcomes: Outcome[]): Outcome => {
  const pending = outcomes.filter((o): o is Extract<Outcome, { status: 'awaiting' }> => o.status === 'awaiting');
  const reason = REASON_PRIORITY.find(r => pending.some(p => p.reason === r))!;
  return awaiting(reason, pending.flatMap(p => p.missing));
};

const weightedAverage = (parts: { weight: number; value: number }[]) => {
  const total = parts.reduce((sum, p) => sum + p.weight, 0);
  // Zero/unset weights fall back to an equal split rather than dividing by 0.
  if (total <= 0) return parts.reduce((sum, p) => sum + p.value, 0) / parts.length;
  return parts.reduce((sum, p) => sum + p.weight * p.value, 0) / total;
};

const slotLabel = (slot: ReviewerSlot) => REVIEWER_SLOTS.find(s => s.id === slot)?.label ?? slot;
const criterionLabel = (id: string) => CRITERIA.find(c => c.id === id)?.label ?? id;

const isValidScore = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;

// A review counts only once submitted with every key its slot must score.
export const isCompleteReview = (review: AssessmentReview | undefined): review is AssessmentReview =>
  !!review &&
  review.status === 'submitted' &&
  allowedScoreKeys(review.stage, review.reviewerSlot).every(k => isValidScore(review.scores[k]));

export const stageSubmissions = (submissions: AssessmentSubmission[], stage: AssessmentStage, target: string) =>
  submissions.filter(s => s.stage === stage && s.target === target).sort((a, b) => a.version - b.version);

// A grading line's submissions are its assignment's submissions (one
// submission can be graded for several lines). Submissions made directly
// against the exercise id (before assignments existed) still count.
export const exerciseSubmissions = (submissions: AssessmentSubmission[], exercise: Exercise) =>
  submissions
    .filter(s => s.stage === 'A' && (s.target === exercise.id || (!!exercise.assignmentId && s.target === exercise.assignmentId)))
    .sort((a, b) => a.version - b.version);

// Episode B is graded on the first submission the trainee marked complete;
// later revisions are preserved separately and don't replace it.
export const firstCompleteSubmission = (submissions: AssessmentSubmission[], stage: AssessmentStage) =>
  stageSubmissions(submissions, stage, 'episode').find(s => s.isComplete);

export interface TraineeData {
  config: AssessmentConfig;
  modules: Module[];
  exercises: Exercise[];
  enrollment: Enrollment | undefined;
  submissions: AssessmentSubmission[]; // this trainee's
  reviews: AssessmentReview[]; // this trainee's
}

const findReview = (d: TraineeData, stage: AssessmentStage, target: string, slot: ReviewerSlot) =>
  d.reviews.find(r => r.traineeId === d.enrollment?.traineeId && r.stage === stage && r.target === target && r.reviewerSlot === slot);

// --- Episode A ---------------------------------------------------------

export const exerciseOutcome = (d: TraineeData, exercise: Exercise, moduleTitle = ''): Outcome => {
  const name = moduleTitle ? `${moduleTitle} › ${exercise.title}` : exercise.title;
  if (!d.enrollment) return awaiting('enrollment', [name]);
  if (!d.enrollment.reviewers.trainer) return awaiting('assignment', [`Trainer (${name})`]);
  const versions = exerciseSubmissions(d.submissions, exercise);
  if (versions.length === 0) return awaiting('submission', [name]);
  const review = findReview(d, 'A', exercise.id, 'trainer');
  // The trainer picks which revision the grade applies to; it must be one
  // of this exercise's own submissions.
  if (!isCompleteReview(review) || !versions.some(v => v.id === review.submissionId)) return awaiting('assessment', [name]);
  return scored(review.scores.exercise!);
};

export const moduleOutcome = (d: TraineeData, mod: Module): Outcome => {
  const exercises = d.exercises.filter(e => e.moduleId === mod.id).sort((a, b) => a.order - b.order);
  if (exercises.length === 0) return awaiting('assessment', [`${mod.title} (no exercises set up)`]);
  const outcomes = exercises.map(e => exerciseOutcome(d, e, mod.title));
  // A module is complete only once every one of its exercises is graded.
  if (outcomes.some(o => o.status === 'awaiting')) return mergeAwaiting(outcomes);
  return scored(weightedAverage(exercises.map((e, i) => ({ weight: e.weight, value: (outcomes[i] as { value: number }).value }))));
};

export const episodeAModules = (modules: Module[]) =>
  modules.filter(m => m.program === 'episodeA').sort((a, b) => a.order - b.order);

export const episodeAOutcome = (d: TraineeData): Outcome => {
  const mods = episodeAModules(d.modules);
  if (mods.length === 0) return awaiting('assessment', ['Episode A modules not set up']);
  const outcomes = mods.map(m => moduleOutcome(d, m));
  if (outcomes.some(o => o.status === 'awaiting')) return mergeAwaiting(outcomes);
  return scored(weightedAverage(mods.map((m, i) => ({ weight: m.episodeAWeight ?? 0, value: (outcomes[i] as { value: number }).value }))));
};

// --- Episode B / Pod Trial (reviewer-table stages) ---------------------

const cellStageOutcome = (d: TraineeData, stage: 'B' | 'P1' | 'P2', cells: CellWeight[], name: string): Outcome => {
  if (!d.enrollment) return awaiting('enrollment', [name]);
  const slots = [...new Set(cells.map(c => c.slot))];
  const unassigned = slots.filter(s => !d.enrollment!.reviewers[s]);
  if (unassigned.length) return awaiting('assignment', unassigned.map(s => `${slotLabel(s)} (${name})`));

  const complete = stageSubmissions(d.submissions, stage, 'episode').filter(s => s.isComplete);
  if (complete.length === 0) return awaiting('submission', [name]);
  // Episode B: only a review of the first complete submission counts.
  // Pod Trial: a review of any complete version of that episode counts.
  const gradedVersion = (r: AssessmentReview) =>
    stage === 'B' ? r.submissionId === complete[0].id : complete.some(s => s.id === r.submissionId);

  const missing: string[] = [];
  const parts: { weight: number; value: number }[] = [];
  for (const cell of cells) {
    const review = findReview(d, stage, 'episode', cell.slot);
    const value = review?.scores[cell.criterion];
    if (review?.status === 'submitted' && gradedVersion(review) && isValidScore(value)) {
      parts.push({ weight: cell.weight, value });
    } else {
      missing.push(`${name}: ${slotLabel(cell.slot)} – ${criterionLabel(cell.criterion)}`);
    }
  }
  if (missing.length) return awaiting('assessment', missing);
  // Cell weights sum to 100 by design, so this is simply Σ weight × score;
  // dividing by the actual total keeps a misconfigured table on the 1-5 scale.
  return scored(weightedAverage(parts));
};

export const episodeBOutcome = (d: TraineeData) => cellStageOutcome(d, 'B', d.config.episodeBCells, 'Episode B');

export const podEpisodeOutcome = (d: TraineeData, episode: 1 | 2) =>
  cellStageOutcome(d, episode === 1 ? 'P1' : 'P2', d.config.podCells, `Pod episode ${episode}`);

// One or two required episodes; with two, the Pod Trial waits for both to
// be fully scored and then averages them.
export const podOutcome = (d: TraineeData): Outcome => {
  const required = d.enrollment?.podEpisodesRequired ?? 1;
  const episodes = ([1, 2] as const).slice(0, required).map(n => podEpisodeOutcome(d, n));
  if (episodes.some(o => o.status === 'awaiting')) return mergeAwaiting(episodes);
  return scored(episodes.reduce((sum, o) => sum + (o as { value: number }).value, 0) / episodes.length);
};

// --- Final -------------------------------------------------------------

export interface FinalResult {
  episodeA: Outcome;
  episodeB: Outcome;
  pod: Outcome;
  podEpisodes: Outcome[];
  final: Outcome;
  // Only defined once the final score exists.
  meetsBenchmark?: boolean;
}

export const finalResult = (d: TraineeData): FinalResult => {
  const episodeA = episodeAOutcome(d);
  const episodeB = episodeBOutcome(d);
  const pod = podOutcome(d);
  const required = d.enrollment?.podEpisodesRequired ?? 1;
  const podEpisodes = ([1, 2] as const).slice(0, required).map(n => podEpisodeOutcome(d, n));
  const stages = [episodeA, episodeB, pod];
  if (stages.some(o => o.status === 'awaiting')) {
    return { episodeA, episodeB, pod, podEpisodes, final: mergeAwaiting(stages) };
  }
  const w = d.config.stageWeights;
  const value = weightedAverage([
    { weight: w.episodeA, value: (episodeA as { value: number }).value },
    { weight: w.episodeB, value: (episodeB as { value: number }).value },
    { weight: w.pod, value: (pod as { value: number }).value },
  ]);
  // The benchmark is judged on the score as displayed (2 decimals), so the
  // label always matches the number people see - e.g. equal 33.33/33.33/
  // 33.34 exercise weights can compute 3.4999 for what shows as 3.50.
  return { episodeA, episodeB, pod, podEpisodes, final: scored(value), meetsBenchmark: roundScore(value) >= d.config.passThreshold - 1e-9 };
};

// --- Configuration checks (shown to admins) ----------------------------

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const is100 = (n: number) => Math.abs(n - 100) < 0.01;

export interface WeightIssue { scope: string; total: number }

// Every weight group that should total 100% but doesn't.
export const weightIssues = (config: AssessmentConfig, modules: Module[], exercises: Exercise[]): WeightIssue[] => {
  const groups: WeightIssue[] = [
    { scope: 'Final grade stages', total: sum(Object.values(config.stageWeights)) },
    { scope: 'Episode B reviewer table', total: sum(config.episodeBCells.map(c => c.weight)) },
    { scope: 'Pod Trial reviewer table', total: sum(config.podCells.map(c => c.weight)) },
  ];
  const mods = episodeAModules(modules);
  if (mods.length) groups.push({ scope: 'Episode A modules', total: sum(mods.map(m => m.episodeAWeight ?? 0)) });
  for (const m of mods) {
    const ex = exercises.filter(e => e.moduleId === m.id);
    if (ex.length) groups.push({ scope: `${m.title} exercises`, total: sum(ex.map(e => e.weight)) });
  }
  return groups.filter(g => !is100(g.total));
};

// Each reviewer's total share of a stage (e.g. Episode B: trainer 50, engineer 50).
export const slotTotals = (cells: CellWeight[]) =>
  cells.reduce<Partial<Record<ReviewerSlot, number>>>((acc, c) => ({ ...acc, [c.slot]: (acc[c.slot] ?? 0) + c.weight }), {});
