import { Assignment, ProgramOutline } from '../types';
import { FinalResult, TraineeData, finalResult, roundScore } from './scoring';
import { assignmentApplies, assignmentStatus, programDate } from './outline';

// Where a trainee stands in the probation program right now - one place
// for the admin's designer cards and the "falling behind" alert.
export type StandingStatus = 'upcoming' | 'on_track' | 'behind' | 'grading' | 'passed' | 'not_passed';

export interface Standing {
  status: StandingStatus;
  week: number; // current program week (1-based; > totalWeeks once finished)
  totalWeeks: number;
  ended: boolean;
  overdue: { assignment: Assignment; due: Date }[];
  // Weighted average of the stages scored so far (null = nothing scored yet).
  scoreSoFar: number | null;
  result: FinalResult;
}

const DAY = 24 * 60 * 60 * 1000;

export const traineeStanding = (d: TraineeData, outline: ProgramOutline | null, now = new Date()): Standing => {
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

  const w = d.config.stageWeights;
  const scoredStages = [
    { weight: w.episodeA, o: result.episodeA }, { weight: w.episodeB, o: result.episodeB },
    { weight: w.pod, o: result.pod }, { weight: w.da ?? 0, o: result.da },
  ].filter(s => s.weight > 0 && s.o.status === 'scored');
  const total = scoredStages.reduce((t, s) => t + s.weight, 0);
  const scoreSoFar = total > 0 ? scoredStages.reduce((t, s) => t + s.weight * (s.o as { value: number }).value, 0) / total : null;
  const belowSoFar = scoreSoFar !== null && roundScore(scoreSoFar) < d.config.passThreshold - 1e-9;

  const status: StandingStatus =
    result.final.status === 'scored' ? (result.meetsBenchmark ? 'passed' : 'not_passed')
      : !start || dayIndex < 0 ? 'upcoming'
      : ended && !overdue.length ? 'grading'
      : overdue.length || belowSoFar ? 'behind'
      : 'on_track';
  return { status, week, totalWeeks, ended, overdue, scoreSoFar, result };
};

// Why a trainee is flagged, in plain words.
export const behindReasons = (s: Standing, passThreshold: number): string[] => [
  ...s.overdue.map(o => `${o.assignment.title} is overdue (was due ${o.due.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })})`),
  ...(s.scoreSoFar !== null && roundScore(s.scoreSoFar) < passThreshold - 1e-9 ? [`Score so far ${roundScore(s.scoreSoFar).toFixed(2)} is below the ${passThreshold} benchmark`] : []),
];
