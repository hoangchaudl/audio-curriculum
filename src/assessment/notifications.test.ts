import { describe, expect, it } from 'vitest';
import { Assignment } from '../types';
import { traineeNotifications } from './notifications';
import { weekPlan } from './outline';

const assignments: Assignment[] = [
  { id: 'w1', title: 'Week 1 assignment', stage: 'A', materials: [], dueDay: 5 },
  { id: 'w2', title: 'Week 2 assignment', stage: 'A', materials: [], dueDay: 2 },
];
const modules = ['m1', 'm2', 'm3'].map((id, i) => ({ id, order: i, title: `Lesson ${id}`, description: '', category: 'x' }));
const outline = { id: 'current' as const, weeks: [
  { id: 'k1', title: 'Week 1', items: [
    { id: 'a', kind: 'content' as const, moduleId: 'm1', day: 1, hours: 2 },
    { id: 'b', kind: 'content' as const, moduleId: 'm2', day: 3 },
    { id: 'c', kind: 'content' as const, moduleId: 'm3' },
    { id: 'd', kind: 'assignment' as const, assignmentId: 'w1' },
    { id: 'e', kind: 'milestone' as const, title: 'Dialogue synced', day: 4 },
  ] },
  { id: 'k2', title: 'Week 2', items: [{ id: 'f', kind: 'assignment' as const, assignmentId: 'w2' }] },
] };
const enrollment = { id: 't', traineeId: 't', startDate: '2026-09-21', podEpisodesRequired: 1 as const, createdAt: '', reviewers: {}, reviewerUids: [] };
const at = (iso: string) => new Date(`${iso}T12:00:00`);
const watched = (m: string) => ({ id: `${m}_t`, moduleId: m, userId: 't', watchedAt: '' });

describe('week plan', () => {
  it('puts lessons on their planned day, assignments on their due day, undated lessons under any day', () => {
    const p = weekPlan(outline, assignments, modules, enrollment, 't', [watched('m1')], [], 0, at('2026-09-23'));
    expect(p.days.map(d => [d.day, d.isToday, d.items.map(i => `${i.title}:${i.status}`)])).toEqual([
      [1, false, ['Lesson m1:done']], [2, false, []], [3, true, ['Lesson m2:todo']],
      [4, false, ['Dialogue synced:todo']], [5, false, ['Week 1 assignment:todo']],
    ]);
    expect(p.days[0].items[0].hours).toBe(2);
    expect(p.anyDay.map(i => i.title)).toEqual(['Lesson m3']);
    // A planned lesson from an earlier day that isn't done shows as late.
    expect(weekPlan(outline, assignments, modules, enrollment, 't', [], [], 0, at('2026-09-23')).days[0].items[0].status).toBe('late');
  });
});

describe('trainee notifications', () => {
  it('warns about work due soon and today\'s planned lessons', () => {
    const n = traineeNotifications(outline, assignments, modules, enrollment, 't', [watched('m1')], [], undefined, at('2026-09-23'));
    expect(n.map(x => x.id)).toEqual(['due:w1', 'today:2026-09-23']);
    expect(n[0].text).toMatch(/Week 1 assignment is due in 2 days/);
    expect(n[1].text).toBe("Today's plan: 1 lesson - Lesson m2");
  });
  it('flags overdue work, pace, and published results', () => {
    const n = traineeNotifications(outline, assignments, modules, enrollment, 't', [], [], { id: 't', episodeA: true, episodeB: false, pod: false }, at('2026-09-26'));
    expect(n.map(x => x.id)).toEqual(['overdue:#/assignment/w1', 'pace:1', 'published:episodeA']);
    expect(traineeNotifications(outline, assignments, modules, undefined, 't', [], [], undefined)).toEqual([]);
  });
});
