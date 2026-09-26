import { Assignment, ProgramOutcome, ProgramOutline, VideoProgress } from '../types';
import { FinalResult, TraineeData, finalResult, roundScore } from './scoring';
import { assignmentApplies, assignmentStatus, daysLate, programDate, weekGroups } from './outline';

// Where a trainee stands in the probation program right now - one place
// for the admin's designer cards and the "falling behind" alert.
export type StandingStatus = 'upcoming' | 'on_track' | 'behind' | 'grading' | 'passed' | 'not_passed';

const DAY = 24 * 60 * 60 * 1000;

// Lesson pace: from this day of a program week (Day 4 = Thursday when the
// trainee starts on a Monday), at least this share of that week's lessons
// should be done; a finished week that stayed under it is flagged too.
export const PACE_CHECK_DAY = 4;
export const PACE_MIN_SHARE = 0.5;

export interface PaceIssue { week: number; done: number; total: number; current: boolean }

export const lessonPace = (
  outline: ProgramOutline | null, assignments: Assignment[], startDate: string | undefined,
  traineeId: string | undefined, videoProgress: VideoProgress[], now = new Date(),
): PaceIssue[] => {
  if (!startDate) return [];
  const dayIndex = Math.floor((now.getTime() - new Date(`${startDate}T00:00:00`).getTime()) / DAY);
  if (dayIndex < 0) return [];
  const currentWeek = Math.floor(dayIndex / 7) + 1;
  const dayOfWeek = (dayIndex % 7) + 1;
  return (outline?.weeks ?? []).flatMap((w, wi) => {
    const week = wi + 1;
    const due = week < currentWeek || (week === currentWeek && dayOfWeek >= PACE_CHECK_DAY);
    if (!due) return [];
    const lessons = weekGroups(w, assignments).flatMap(g => g.items).filter(it => it.kind === 'content');
    const done = lessons.filter(it => it.kind === 'content' && videoProgress.some(v => v.moduleId === it.moduleId && v.userId === traineeId)).length;
    return lessons.length && done / lessons.length < PACE_MIN_SHARE ? [{ week, done, total: lessons.length, current: week === currentWeek }] : [];
  });
};

export interface Standing {
  status: StandingStatus;
  week: number; // current program week (1-based; > totalWeeks once finished)
  totalWeeks: number;
  ended: boolean;
  overdue: { assignment: Assignment; due: Date }[];
  // Handed in after the due day (by the server's clock).
  late: { assignment: Assignment; days: number }[];
  pace: PaceIssue[];
  // Weighted average of the stages scored so far (null = nothing scored yet).
  scoreSoFar: number | null;
  result: FinalResult;
}

export const traineeStanding = (d: TraineeData, outline: ProgramOutline | null, videoProgress: VideoProgress[] = [], now = new Date()): Standing => {
  const result = finalResult(d);
  const totalWeeks = outline?.weeks.length || 4;
  const start = d.enrollment ? new Date(`${d.enrollment.startDate}T00:00:00`) : null;
  const dayIndex = start ? Math.floor((now.getTime() - start.getTime()) / DAY) : -1;
  const week = dayIndex < 0 ? 0 : Math.floor(dayIndex / 7) + 1;
  const ended = dayIndex >= totalWeeks * 7;

  // Assignments whose due day has fully passed without a submission.
  const overdue = (outline?.weeks ?? []).flatMap((w, wi) => w.items.flatMap(it => {
    if (it.kind !== 'assignment') return [];
    const a = d.assignments.find(x => x.id === it.assignmentId);
    if (!a || !assignmentApplies(a, d.enrollment)) return [];
    const due = programDate(d.enrollment?.startDate, wi + 1, a.dueDay ?? 7);
    if (!due || due.getTime() + DAY > now.getTime()) return [];
    return assignmentStatus(a, d.enrollment?.traineeId, d.submissions) === 'submitted' ? [] : [{ assignment: a, due }];
  }));

  const late = (outline?.weeks ?? []).flatMap((w, wi) => w.items.flatMap(it => {
    const a = it.kind === 'assignment' ? d.assignments.find(x => x.id === it.assignmentId) : undefined;
    const days = a && assignmentApplies(a, d.enrollment) ? daysLate(a, wi + 1, d.enrollment, d.submissions) : null;
    return a && days ? [{ assignment: a, days }] : [];
  }));

  const w = d.config.stageWeights;
  const scoredStages = [
    { weight: w.episodeA, o: result.episodeA }, { weight: w.episodeB, o: result.episodeB },
    { weight: w.pod, o: result.pod }, { weight: w.da ?? 0, o: result.da },
  ].filter(s => s.weight > 0 && s.o.status === 'scored');
  const total = scoredStages.reduce((t, s) => t + s.weight, 0);
  const scoreSoFar = total > 0 ? scoredStages.reduce((t, s) => t + s.weight * (s.o as { value: number }).value, 0) / total : null;
  const pace = lessonPace(outline, d.assignments, d.enrollment?.startDate, d.enrollment?.traineeId, videoProgress, now);
  const belowSoFar = scoreSoFar !== null && roundScore(scoreSoFar) < d.config.passThreshold - 1e-9;

  const status: StandingStatus =
    result.final.status === 'scored' ? (result.meetsBenchmark ? 'passed' : 'not_passed')
      : !start || dayIndex < 0 ? 'upcoming'
      : ended && !overdue.length ? 'grading'
      : overdue.length || pace.length || belowSoFar ? 'behind'
      : 'on_track';
  return { status, week, totalWeeks, ended, overdue, late, pace, scoreSoFar, result };
};

// Released at a checkpoint: Week 2 "Release", or Week 4 "No offer".
export const isReleasedBy = (o: ProgramOutcome | undefined) => o?.week2?.decision === 'release' || o?.decision === 'not_offered';

// Week 2 ended without a continue/release decision (and nobody released
// them, and the Week 4 decision hasn't already been made).
export const week2CheckpointDue = (s: Standing | null, o: ProgramOutcome | undefined) =>
  !!s && (s.week >= 3 || s.ended) && !o?.week2 && !o?.decision && !isReleasedBy(o);

// Why a trainee is flagged, in plain words.
export const behindReasons = (s: Standing, passThreshold: number): string[] => [
  ...s.overdue.map(o => `${o.assignment.title} is overdue (was due ${o.due.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })})`),
  ...s.pace.map(p => p.current
    ? `Week ${p.week}: only ${p.done} of ${p.total} lessons done - behind pace (half by Day ${PACE_CHECK_DAY})`
    : `Week ${p.week} ended with only ${p.done} of ${p.total} lessons done`),
  ...(s.scoreSoFar !== null && roundScore(s.scoreSoFar) < passThreshold - 1e-9 ? [`Score so far ${roundScore(s.scoreSoFar).toFixed(2)} is below the ${passThreshold} benchmark`] : []),
];
