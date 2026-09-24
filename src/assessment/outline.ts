import { Assignment, AssessmentSubmission, Enrollment, Exercise, OutlineItem, ProgramOutline } from '../types';
import { stageSubmissions } from './scoring';

// Where an assignment sits in the outline (1-based week number).
export const assignmentWeek = (outline: ProgramOutline | null, assignmentId: string) => {
  const i = outline?.weeks.findIndex(w => w.items.some(it => it.kind === 'assignment' && it.assignmentId === assignmentId)) ?? -1;
  return i >= 0 ? i + 1 : undefined;
};

// Calendar date for (week, day) counted from the trainee's start date
// (week 1 day 1 = start date).
export const programDate = (startDate: string | undefined, week: number | undefined, day: number | undefined) => {
  if (!startDate || !week) return null;
  const d = new Date(`${startDate}T00:00:00`);
  d.setDate(d.getDate() + (week - 1) * 7 + ((day ?? 1) - 1));
  return d;
};

export const dueLabel = (startDate: string | undefined, week: number | undefined, day: number | undefined) => {
  const d = programDate(startDate, week, day);
  if (d) return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return day ? `Day ${day}` : '';
};

// Pod episode 2 only exists for trainees who need two pod episodes.
export const assignmentApplies = (a: Assignment, enrollment: Enrollment | undefined) =>
  a.stage !== 'P2' || (enrollment?.podEpisodesRequired ?? 1) === 2;

export const assignmentLines = (exercises: Exercise[], assignmentId: string) =>
  exercises.filter(e => e.assignmentId === assignmentId).sort((a, b) => a.moduleId.localeCompare(b.moduleId) || a.order - b.order);

// Where an assignment's submissions live: Episode A assignments are
// submitted against the assignment id; Episode B / Pod against 'episode'.
export const submissionTarget = (a: Assignment) => (a.stage === 'A' ? a.id : 'episode');

export type AssignmentStatus = 'not-submitted' | 'draft' | 'submitted';

export const assignmentStatus = (a: Assignment, traineeId: string | undefined, submissions: AssessmentSubmission[]): AssignmentStatus => {
  const versions = stageSubmissions(submissions.filter(s => s.traineeId === traineeId), a.stage, submissionTarget(a));
  if (!versions.length) return 'not-submitted';
  // Episode B / Pod need a version the trainee marked complete.
  if (a.stage !== 'A' && !versions.some(v => v.isComplete)) return 'draft';
  return 'submitted';
};

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Which day of its week (1-7) an outline item sits on. An assignment's day
// is its due day, so there's one source of truth; items without a day fall
// back to the start (content) or end (assignments, milestones) of the week.
export const itemDay = (it: OutlineItem, assignments: Assignment[]): number => {
  if (it.kind === 'content') return it.day ?? 1;
  if (it.kind === 'milestone') return it.day ?? 7;
  return assignments.find(a => a.id === it.assignmentId)?.dueDay ?? 7;
};

// A week's items in day order; items on the same day keep their saved order.
export const sortByDay = (items: OutlineItem[], assignments: Assignment[]) =>
  [...items].sort((a, b) => itemDay(a, assignments) - itemDay(b, assignments));
