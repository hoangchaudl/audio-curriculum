import { Assignment, AssessmentSubmission, Enrollment, Exercise, Module, OutlineItem, OutlineSection, OutlineWeek, ProgramOutline, VideoProgress } from '../types';
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
  exercises.filter(e => e.assignmentId === assignmentId).sort((a, b) => a.order - b.order);

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

// How many days after its due day an assignment was handed in: the first
// version for Episode A, the first complete one for Episode B / Pod / DA
// (what makes it count as submitted). null = on time, or not handed in.
export const daysLate = (a: Assignment, week: number | undefined, enrollment: Enrollment | undefined, submissions: AssessmentSubmission[]) => {
  const due = programDate(enrollment?.startDate, week, a.dueDay ?? 7);
  if (!due) return null;
  const versions = stageSubmissions(submissions.filter(s => s.traineeId === enrollment?.traineeId), a.stage, submissionTarget(a));
  const handedIn = a.stage === 'A' ? versions[0] : versions.find(v => v.isComplete);
  const DAY = 24 * 60 * 60 * 1000;
  const over = handedIn ? new Date(handedIn.submittedAt).getTime() - (due.getTime() + DAY) : NaN;
  return over > 0 ? Math.ceil(over / DAY) : null;
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

export interface ProgramProgress {
  done: number;
  total: number;
  weeks: { id: string; title: string; done: number; total: number }[];
}

// How far a trainee is through the weekly outline: content pages marked
// done (or videos watched to the end) plus assignments submitted, out of
// everything they have to do. Milestones are checkpoints, not tasks, so
// they don't count. Same numbers for the trainee and for admins.
export const programProgress = (
  outline: ProgramOutline | null, assignments: Assignment[], enrollment: Enrollment | undefined,
  traineeId: string | undefined, videoProgress: VideoProgress[], submissions: AssessmentSubmission[],
): ProgramProgress => {
  const weeks = (outline?.weeks ?? []).map(w => {
    const flags = w.items.flatMap(it => {
      if (it.kind === 'content') return [videoProgress.some(v => v.moduleId === it.moduleId && v.userId === traineeId)];
      if (it.kind === 'assignment') {
        const a = assignments.find(x => x.id === it.assignmentId);
        return a && assignmentApplies(a, enrollment) ? [assignmentStatus(a, traineeId, submissions) === 'submitted'] : [];
      }
      return [];
    });
    return { id: w.id, title: weekLabel(outline!.weeks.indexOf(w)), done: flags.filter(Boolean).length, total: flags.length };
  });
  return { weeks, done: weeks.reduce((t, w) => t + w.done, 0), total: weeks.reduce((t, w) => t + w.total, 0) };
};

// Weeks are fixed and named by position.
export const weekLabel = (index: number) => `Week ${index + 1}`;

// A week's items in the order trainees see them. Weeks that have been
// organised into sections keep the admin's manual order; older weeks are
// ordered by day.
export const weekItemsInOrder = (week: OutlineWeek, assignments: Assignment[]) =>
  week.sections ? week.items : sortByDay(week.items, assignments);

// The week as trainees see it: each section with its items, then anything
// not in a section (or in a deleted one) under `section: null`.
export const weekGroups = (week: OutlineWeek, assignments: Assignment[]): { section: OutlineSection | null; items: OutlineItem[] }[] => {
  const items = weekItemsInOrder(week, assignments);
  const sections = week.sections ?? [];
  const known = new Set(sections.map(s => s.id));
  return [
    ...sections.map(section => ({ section, items: items.filter(i => i.sectionId === section.id) })),
    { section: null, items: items.filter(i => !i.sectionId || !known.has(i.sectionId)) },
  ];
};

// Items rewritten in display order (sections first), so a week can be
// edited by position; also turns an older day-ordered week into a manual one.
export const normalizeWeek = (week: OutlineWeek, assignments: Assignment[]): OutlineWeek => ({
  ...week,
  sections: week.sections ?? [],
  items: weekGroups(week, assignments).flatMap(g => g.items),
});

export interface Step {
  kind: 'content' | 'assignment';
  title: string;
  hash: string;
  week: number;
  due?: Date; // assignments
}

// What a trainee should do now: every assignment past its due day without
// a submission, and the first unfinished item in outline order (lessons
// not done, assignments not submitted). Same order as the sidebar.
export const nextSteps = (
  outline: ProgramOutline | null, assignments: Assignment[], modules: Module[], enrollment: Enrollment | undefined,
  traineeId: string | undefined, videoProgress: VideoProgress[], submissions: AssessmentSubmission[], now = new Date(),
): { overdue: Step[]; next: Step | null } => {
  const DAY = 24 * 60 * 60 * 1000;
  const steps = (outline?.weeks ?? []).flatMap((w, wi) => weekGroups(w, assignments).flatMap(g => g.items).flatMap<{ step: Step; done: boolean; late: boolean }>(it => {
    if (it.kind === 'content') {
      const mod = modules.find(m => m.id === it.moduleId);
      if (!mod) return [];
      const done = videoProgress.some(v => v.moduleId === mod.id && v.userId === traineeId);
      return [{ step: { kind: 'content' as const, title: mod.title, hash: `#/module/${mod.id}`, week: wi + 1 }, done, late: false }];
    }
    if (it.kind === 'assignment') {
      const a = assignments.find(x => x.id === it.assignmentId);
      if (!a || !assignmentApplies(a, enrollment)) return [];
      const due = programDate(enrollment?.startDate, wi + 1, a.dueDay ?? 7) ?? undefined;
      const done = assignmentStatus(a, traineeId, submissions) === 'submitted';
      const late = !done && !!due && due.getTime() + DAY <= now.getTime();
      return [{ step: { kind: 'assignment' as const, title: a.title, hash: `#/assignment/${a.id}`, week: wi + 1, due }, done, late }];
    }
    return [];
  }));
  return { overdue: steps.filter(s => s.late).map(s => s.step), next: steps.find(s => !s.done && !s.late)?.step ?? null };
};

export interface LessonContext {
  week: number;
  section: string | null;
  lessonNumber: number; // among this week's lessons
  lessonCount: number;
  lessonsDone: number;
  prev: Step | null;
  next: Step | null;
}

// Where a lesson sits in the outline, for its page: week, section,
// "Lesson 2 of 16", and the items before and after it in sidebar order
// (lessons and assignments, across weeks).
export const lessonContext = (
  outline: ProgramOutline | null, assignments: Assignment[], modules: Module[], enrollment: Enrollment | undefined,
  traineeId: string | undefined, videoProgress: VideoProgress[], moduleId: string,
): LessonContext | null => {
  const flat = (outline?.weeks ?? []).flatMap((w, wi) => weekGroups(w, assignments).flatMap(g => g.items.flatMap<{ step: Step; moduleId: string | null; section: string | null }>(it => {
    if (it.kind === 'content') {
      const mod = modules.find(m => m.id === it.moduleId);
      return mod ? [{ step: { kind: 'content' as const, title: mod.title, hash: `#/module/${mod.id}`, week: wi + 1 }, moduleId: mod.id, section: g.section?.title ?? null }] : [];
    }
    if (it.kind === 'assignment') {
      const a = assignments.find(x => x.id === it.assignmentId);
      return a && assignmentApplies(a, enrollment)
        ? [{ step: { kind: 'assignment' as const, title: a.title, hash: `#/assignment/${a.id}`, week: wi + 1 }, moduleId: null, section: g.section?.title ?? null }]
        : [];
    }
    return [];
  })));
  const i = flat.findIndex(x => x.moduleId === moduleId);
  if (i < 0) return null;
  const here = flat[i];
  const weekLessons = flat.filter(x => x.moduleId && x.step.week === here.step.week);
  return {
    week: here.step.week,
    section: here.section,
    lessonNumber: weekLessons.findIndex(x => x.moduleId === moduleId) + 1,
    lessonCount: weekLessons.length,
    lessonsDone: weekLessons.filter(x => videoProgress.some(v => v.moduleId === x.moduleId && v.userId === traineeId)).length,
    prev: flat[i - 1]?.step ?? null,
    next: flat[i + 1]?.step ?? null,
  };
};

// Program week (1-based) and day of that week (1-7) for a date, counted
// from the start date (week 1 day 1 = start date). Before the start: week 0.
export const programDay = (startDate: string | undefined, now = new Date()): { week: number; day: number } => {
  if (!startDate) return { week: 0, day: 0 };
  const dayIndex = Math.floor((now.getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000);
  return dayIndex < 0 ? { week: 0, day: 0 } : { week: Math.floor(dayIndex / 7) + 1, day: (dayIndex % 7) + 1 };
};

// A lesson may slip one day behind its planned day before it shows as late.
export const LESSON_GRACE_DAYS = 1;

// Recommended day (1-5, Mon-Fri) for each of n lessons, in order, spread evenly.
export const spreadDays = (n: number): number[] => Array.from({ length: n }, (_, i) => Math.floor((i * 5) / n) + 1);

export type PlanStatus = 'done' | 'todo' | 'late';
export interface PlanItem { key: string; kind: 'content' | 'assignment' | 'milestone'; title: string; hash: string; status: PlanStatus; hours?: number }
export interface PlanDay { day: number; date: Date | null; isToday: boolean; items: PlanItem[] }

// One week as a day-by-day plan: lessons on their planned day, assignments
// on their due day, milestones on theirs. Lessons without a planned day go
// under `anyDay`. Weekdays always appear; the weekend only when used.
export const weekPlan = (
  outline: ProgramOutline | null, assignments: Assignment[], modules: Module[], enrollment: Enrollment | undefined,
  traineeId: string | undefined, videoProgress: VideoProgress[], submissions: AssessmentSubmission[], weekIndex: number, now = new Date(),
): { days: PlanDay[]; anyDay: PlanItem[] } => {
  const week = outline?.weeks[weekIndex];
  const start = enrollment?.startDate;
  const today = programDay(start, now);
  const isPast = (day: number, grace = 0) => weekIndex + 1 < today.week || (weekIndex + 1 === today.week && day < today.day - grace);
  const entries = week ? weekGroups(week, assignments).flatMap(g => g.items).flatMap<{ day: number | null; item: PlanItem }>(it => {
    if (it.kind === 'content') {
      const mod = modules.find(m => m.id === it.moduleId);
      if (!mod) return [];
      const done = videoProgress.some(v => v.moduleId === mod.id && v.userId === traineeId);
      const day = it.day ?? null;
      return [{ day, item: { key: it.id, kind: 'content', title: mod.title, hash: `#/module/${mod.id}`, hours: it.hours, status: done ? 'done' : day && isPast(day, LESSON_GRACE_DAYS) ? 'late' : 'todo' } }];
    }
    if (it.kind === 'assignment') {
      const a = assignments.find(x => x.id === it.assignmentId);
      if (!a || !assignmentApplies(a, enrollment)) return [];
      const day = a.dueDay ?? 7;
      const done = assignmentStatus(a, traineeId, submissions) === 'submitted';
      return [{ day, item: { key: it.id, kind: 'assignment', title: a.title, hash: `#/assignment/${a.id}`, status: done ? 'done' : isPast(day) ? 'late' : 'todo' } }];
    }
    return [{ day: it.day ?? 7, item: { key: it.id, kind: 'milestone', title: it.title, hash: '', status: isPast(it.day ?? 7) ? 'done' : 'todo' } }];
  }) : [];
  const used = new Set(entries.flatMap(e => (e.day ? [e.day] : [])));
  const days = [1, 2, 3, 4, 5, 6, 7].filter(d => d <= 5 || used.has(d)).map(d => ({
    day: d,
    date: programDate(start, weekIndex + 1, d),
    isToday: today.week === weekIndex + 1 && today.day === d,
    items: entries.filter(e => e.day === d).map(e => e.item),
  }));
  return { days, anyDay: entries.filter(e => e.day === null).map(e => e.item) };
};
