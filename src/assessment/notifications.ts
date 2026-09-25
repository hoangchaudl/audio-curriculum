import { Assignment, AssessmentSubmission, Enrollment, Module, ProgramOutline, Publication, VideoProgress } from '../types';
import { assignmentApplies, assignmentStatus, nextSteps, programDate, programDay, weekGroups } from './outline';
import { lessonPace } from './standing';

// A trainee's notifications, worked out from their program data (nothing is
// stored except which ids they've read - users.readNotifications). Ids are
// stable, so a notification stays read until its situation changes.
export interface Notice {
  id: string;
  tone: 'red' | 'orange' | 'blue' | 'green';
  category: 'deadlines' | 'lessons' | 'results';
  icon: string;
  text: string;
  hash: string;
}

const DAY = 86400000;
// YYYY-MM-DD in the user's own timezone (toISOString would shift it to UTC).
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const when = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const STAGE_NAMES: Record<string, string> = { episodeA: 'Episode A', episodeB: 'Episode B', da: 'Audio Description', pod: 'Pod Trial' };

export const traineeNotifications = (
  outline: ProgramOutline | null, assignments: Assignment[], modules: Module[], enrollment: Enrollment | undefined,
  traineeId: string | undefined, videoProgress: VideoProgress[], submissions: AssessmentSubmission[],
  publication: Publication | undefined, now = new Date(),
): Notice[] => {
  if (!enrollment) return [];
  const out: Notice[] = [];
  const { overdue } = nextSteps(outline, assignments, modules, enrollment, traineeId, videoProgress, submissions, now);
  for (const o of overdue) out.push({ id: `overdue:${o.hash}`, tone: 'red', category: 'deadlines', icon: '⚠', text: `${o.title} is overdue${o.due ? ` (was due ${when(o.due)})` : ''}`, hash: o.hash });

  // Due today or in the next 2 days, not yet submitted.
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  (outline?.weeks ?? []).forEach((w, wi) => w.items.forEach(it => {
    if (it.kind !== 'assignment') return;
    const a = assignments.find(x => x.id === it.assignmentId);
    if (!a || !assignmentApplies(a, enrollment) || assignmentStatus(a, traineeId, submissions) === 'submitted') return;
    const due = programDate(enrollment.startDate, wi + 1, a.dueDay ?? 7);
    if (!due) return;
    const days = Math.round((due.getTime() - midnight.getTime()) / DAY);
    if (days < 0 || days > 2) return;
    out.push({ id: `due:${a.id}`, tone: 'orange', category: 'deadlines', icon: '📝', text: `${a.title} is due ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`} (${when(due)})`, hash: `#/assignment/${a.id}` });
  }));

  for (const p of lessonPace(outline, assignments, enrollment.startDate, traineeId, videoProgress, now)) {
    out.push({ id: `pace:${p.week}`, tone: 'orange', category: 'lessons', icon: '📖', text: p.current ? `Week ${p.week}: ${p.done} of ${p.total} lessons done - you're behind pace` : `Week ${p.week} still has ${p.total - p.done} lessons to finish`, hash: '#/program/today' });
  }

  // Lessons planned for today and not done yet.
  const today = programDay(enrollment.startDate, now);
  const week = outline?.weeks[today.week - 1];
  if (week) {
    const planned = weekGroups(week, assignments).flatMap(g => g.items).flatMap(it =>
      it.kind === 'content' && it.day === today.day && !videoProgress.some(v => v.moduleId === it.moduleId && v.userId === traineeId)
        ? [modules.find(m => m.id === it.moduleId)?.title].filter((t): t is string => !!t) : []);
    if (planned.length) {
      out.push({ id: `today:${localDate(midnight)}`, tone: 'blue', category: 'lessons', icon: '📅', text: `Today's plan: ${planned.length} lesson${planned.length === 1 ? '' : 's'} - ${planned.join(', ')}`, hash: '#/program/today' });
    }
  }

  for (const key of ['episodeA', 'episodeB', 'da', 'pod'] as const) {
    if (publication?.[key]) out.push({ id: `published:${key}`, tone: 'green', category: 'results', icon: '✅', text: `${STAGE_NAMES[key]} results are published - see your score and feedback`, hash: '#/program/grades' });
  }
  return out;
};
