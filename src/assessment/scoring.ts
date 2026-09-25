// Single source of truth for every assessment number the app shows.
// Pure functions over plain data (no Firestore access), so they are fully
// unit-tested (scoring.test.ts) and every screen agrees on the result.
//
// Rules implemented here:
// - Scores are 1-5.
// - Missing data yields an explicit "awaiting" outcome, never a zero.
// - Reviewer table cell weights already include the criterion weight and
//   are applied once (never multiplied by a criterion weight again).
import {
  AssessmentConfig, AssessmentReview, AssessmentStage, AssessmentSubmission, Assignment, CellWeight,
  Enrollment, Exercise, ReviewerSlot,
} from '../types';
import { CRITERIA, REVIEWER_SLOTS, allowedScoreKeys, gradesFirstComplete } from './config';

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
  assignments: Assignment[];
  exercises: Exercise[];
  enrollment: Enrollment | undefined;
  submissions: AssessmentSubmission[]; // this trainee's
  reviews: AssessmentReview[]; // this trainee's
}

const findReview = (d: TraineeData, stage: AssessmentStage, target: string, slot: ReviewerSlot) =>
  d.reviews.find(r => r.traineeId === d.enrollment?.traineeId && r.stage === stage && r.target === target && r.reviewerSlot === slot);

// --- Episode A ---------------------------------------------------------

export const exerciseOutcome = (d: TraineeData, exercise: Exercise, parentTitle = ''): Outcome => {
  const name = parentTitle ? `${parentTitle} › ${exercise.title}` : exercise.title;
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

export const episodeAAssignments = (assignments: Assignment[]) => assignments.filter(a => a.stage === 'A');

export const assignmentCriteria = (exercises: Exercise[], assignmentId: string) =>
  exercises.filter(e => e.assignmentId === assignmentId).sort((a, b) => a.order - b.order);

// An Episode A assignment's score: its criteria weighted by their shares.
// Complete only once every criterion is graded.
export const assignmentOutcome = (d: TraineeData, a: Assignment): Outcome => {
  const criteria = assignmentCriteria(d.exercises, a.id);
  if (criteria.length === 0) return awaiting('assessment', [`${a.title} (no criteria set up)`]);
  const outcomes = criteria.map(e => exerciseOutcome(d, e, a.title));
  if (outcomes.some(o => o.status === 'awaiting')) return mergeAwaiting(outcomes);
  return scored(weightedAverage(criteria.map((e, i) => ({ weight: e.weight, value: (outcomes[i] as { value: number }).value }))));
};

export const episodeAOutcome = (d: TraineeData): Outcome => {
  const asgs = episodeAAssignments(d.assignments);
  if (asgs.length === 0) return awaiting('assessment', ['Episode A assignments not set up']);
  const outcomes = asgs.map(a => assignmentOutcome(d, a));
  if (outcomes.some(o => o.status === 'awaiting')) return mergeAwaiting(outcomes);
  return scored(weightedAverage(asgs.map((a, i) => ({ weight: a.weight ?? 0, value: (outcomes[i] as { value: number }).value }))));
};

// --- Episode B / Pod Trial (reviewer-table stages) ---------------------

const cellStageOutcome = (d: TraineeData, stage: 'B' | 'P1' | 'P2' | 'DA', cells: CellWeight[], name: string): Outcome => {
  if (!d.enrollment) return awaiting('enrollment', [name]);
  const slots = [...new Set(cells.map(c => c.slot))];
  const unassigned = slots.filter(s => !d.enrollment!.reviewers[s]);
  if (unassigned.length) return awaiting('assignment', unassigned.map(s => `${slotLabel(s)} (${name})`));

  const complete = stageSubmissions(d.submissions, stage, 'episode').filter(s => s.isComplete);
  if (complete.length === 0) return awaiting('submission', [name]);
  // Episode B / DA: only a review of the first complete submission counts.
  // Pod Trial: a review of any complete version of that episode counts.
  const gradedVersion = (r: AssessmentReview) =>
    gradesFirstComplete(stage) ? r.submissionId === complete[0].id : complete.some(s => s.id === r.submissionId);

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

export const daOutcome = (d: TraineeData) => cellStageOutcome(d, 'DA', d.config.daCells, 'Audio Description');

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
  da: Outcome;
  podEpisodes: Outcome[];
  final: Outcome;
  // Only defined once the final score exists.
  meetsBenchmark?: boolean;
}

export const finalResult = (d: TraineeData): FinalResult => {
  const episodeA = episodeAOutcome(d);
  const episodeB = episodeBOutcome(d);
  const pod = podOutcome(d);
  const da = daOutcome(d);
  const required = d.enrollment?.podEpisodesRequired ?? 1;
  const podEpisodes = ([1, 2] as const).slice(0, required).map(n => podEpisodeOutcome(d, n));
  const w = d.config.stageWeights;
  // Stages weighted 0 don't count (and don't hold the final grade back).
  const stages = [
    { weight: w.episodeA, outcome: episodeA }, { weight: w.episodeB, outcome: episodeB },
    { weight: w.pod, outcome: pod }, { weight: w.da ?? 0, outcome: da },
  ].filter(st => st.weight > 0);
  const base = { episodeA, episodeB, pod, da, podEpisodes };
  if (stages.some(st => st.outcome.status === 'awaiting')) {
    return { ...base, final: mergeAwaiting(stages.map(st => st.outcome)) };
  }
  const value = weightedAverage(stages.map(st => ({ weight: st.weight, value: (st.outcome as { value: number }).value })));
  // The benchmark is judged on the score as displayed (2 decimals), so the
  // label always matches the number people see - e.g. equal 33.33/33.33/
  // 33.34 criterion weights can compute 3.4999 for what shows as 3.50.
  return { ...base, final: scored(value), meetsBenchmark: roundScore(value) >= d.config.passThreshold - 1e-9 };
};

// --- Configuration checks (shown to admins) ----------------------------

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const is100 = (n: number) => Math.abs(n - 100) < 0.01;

export interface WeightIssue { scope: string; total: number }

// Grade-formula weight groups (stages, reviewer tables) not totalling 100%.
export const weightIssues = (config: AssessmentConfig): WeightIssue[] => [
  { scope: 'Final grade stages', total: sum(Object.values(config.stageWeights)) },
  { scope: 'Episode B reviewer table', total: sum(config.episodeBCells.map(c => c.weight)) },
  { scope: 'Pod Trial reviewer table', total: sum(config.podCells.map(c => c.weight)) },
  ...((config.stageWeights.da ?? 0) > 0 ? [{ scope: 'Audio Description reviewer table', total: sum(config.daCells.map(c => c.weight)) }] : []),
].filter(g => !is100(g.total));

// n shares of 100 with 2 decimals; the last one absorbs the rounding
// (3 -> 33.33 / 33.33 / 33.34).
export const splitEvenly = (n: number): number[] => {
  if (n <= 0) return [];
  const base = Math.floor(10000 / n) / 100;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? Math.round((100 - base * (n - 1)) * 100) / 100 : base));
};

// Scale shares so they add up to `total`, keeping their proportions
// (2 decimals; the last absorbs rounding). All zero -> an even split.
export const scaleShares = (shares: number[], total: number): number[] => {
  if (!shares.length) return [];
  const sumNow = shares.reduce((a, b) => a + b, 0);
  const out = sumNow > 0
    ? shares.map(v => Math.round((v / sumNow) * total * 100) / 100)
    : shares.map(() => Math.floor((total / shares.length) * 100) / 100);
  out[out.length - 1] = Math.round((total - out.slice(0, -1).reduce((a, b) => a + b, 0)) * 100) / 100;
  return out;
};

// Everything in the grading setup that would give wrong or stuck results,
// in plain words for the admin banner.
export const gradingProblems = (config: AssessmentConfig, assignments: Assignment[], exercises: Exercise[]): string[] => {
  const out: string[] = [];
  const pct = (n: number) => `${Math.round(n * 100) / 100}%`;
  const asgs = episodeAAssignments(assignments);
  for (const a of asgs) {
    const name = `"${a.title}"`;
    const criteria = assignmentCriteria(exercises, a.id);
    if (!criteria.length) {
      out.push(`${name} has no criteria, so no trainee can finish Episode A. Add at least one criterion to it.`);
      continue;
    }
    const total = sum(criteria.map(e => e.weight));
    if (!is100(total)) out.push(`${name}: criteria shares add up to ${pct(total)} instead of 100%.`);
    if (criteria.some(e => !e.title.trim())) out.push(`${name} has a criterion with no name, so reviewers can't tell what it's for.`);
  }
  if (asgs.length) {
    const total = sum(asgs.map(a => a.weight ?? 0));
    if (!is100(total)) out.push(`Episode A assignment weights add up to ${pct(total)} instead of 100%.`);
  }
  for (const g of weightIssues(config)) out.push(`${g.scope} add up to ${pct(g.total)} instead of 100%.`);
  return out;
};

// Each reviewer's total share of a stage (e.g. Episode B: trainer 50, engineer 50).
export const slotTotals = (cells: CellWeight[]) =>
  cells.reduce<Partial<Record<ReviewerSlot, number>>>((acc, c) => ({ ...acc, [c.slot]: (acc[c.slot] ?? 0) + c.weight }), {});
