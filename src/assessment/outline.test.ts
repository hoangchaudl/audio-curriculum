import { describe, expect, it } from 'vitest';
import { Assignment, OutlineItem } from '../types';
import { itemDay, nextSteps, normalizeWeek, programProgress, sortByDay, weekGroups } from './outline';

const asg: Assignment[] = [{ id: 'a1', title: 'A', stage: 'A', materials: [], dueDay: 3 }, { id: 'a2', title: 'B', stage: 'A', materials: [] }];

describe('week day placement', () => {
  it('reads each item kind\'s day, with start/end-of-week fallbacks', () => {
    expect(itemDay({ id: '1', kind: 'content', moduleId: 'm' }, asg)).toBe(1);
    expect(itemDay({ id: '2', kind: 'content', moduleId: 'm', day: 4 }, asg)).toBe(4);
    expect(itemDay({ id: '3', kind: 'assignment', assignmentId: 'a1' }, asg)).toBe(3);
    expect(itemDay({ id: '4', kind: 'assignment', assignmentId: 'a2' }, asg)).toBe(7);
    expect(itemDay({ id: '5', kind: 'milestone', title: 'x' }, asg)).toBe(7);
  });
  it('orders by day and keeps saved order within a day', () => {
    const items: OutlineItem[] = [
      { id: 'end', kind: 'milestone', title: 'x', day: 5 },
      { id: 'mid', kind: 'assignment', assignmentId: 'a1' },
      { id: 'c1', kind: 'content', moduleId: 'm1', day: 3 },
      { id: 'c0', kind: 'content', moduleId: 'm0' },
    ];
    expect(sortByDay(items, asg).map(i => i.id)).toEqual(['c0', 'mid', 'c1', 'end']);
  });
});

describe('program progress', () => {
  it('counts content marked done and assignments submitted, not milestones or pod episode 2', () => {
    const assignments: Assignment[] = [
      { id: 'a1', title: 'A', stage: 'A', materials: [] },
      { id: 'p2', title: 'Pod 2', stage: 'P2', materials: [] },
    ];
    const outline = { id: 'current' as const, weeks: [
      { id: 'w1', title: 'Week 1', items: [
        { id: 'c1', kind: 'content' as const, moduleId: 'm1' },
        { id: 'c2', kind: 'content' as const, moduleId: 'm2' },
        { id: 'ms', kind: 'milestone' as const, title: 'x' },
        { id: 'i1', kind: 'assignment' as const, assignmentId: 'a1' },
      ] },
      { id: 'w2', title: 'Week 2', items: [{ id: 'i2', kind: 'assignment' as const, assignmentId: 'p2' }] },
    ] };
    const enrollment = { id: 't', traineeId: 't', startDate: '2026-01-05', podEpisodesRequired: 1 as const, createdAt: '', reviewers: {}, reviewerUids: [] };
    const watched = [{ id: 'm1_t', moduleId: 'm1', userId: 't', watchedAt: '' }, { id: 'm2_x', moduleId: 'm2', userId: 'someone-else', watchedAt: '' }];
    const subs = [{ id: 's', traineeId: 't', stage: 'A' as const, target: 'a1', version: 1, isComplete: true, links: [], submittedAt: '' }];
    const p = programProgress(outline, assignments, enrollment, 't', watched, subs);
    expect(p.weeks.map(w => [w.done, w.total])).toEqual([[2, 3], [0, 0]]);
    expect([p.done, p.total]).toEqual([2, 3]);
  });
});

describe('week sections', () => {
  const items: OutlineItem[] = [
    { id: 'asg', kind: 'assignment', assignmentId: 'a1', sectionId: 'gone' },
    { id: 'c2', kind: 'content', moduleId: 'm2', sectionId: 's2' },
    { id: 'c1', kind: 'content', moduleId: 'm1', sectionId: 's1', day: 4 },
    { id: 'c3', kind: 'content', moduleId: 'm3', sectionId: 's1', day: 1 },
  ];
  const week = { id: 'w', title: 'Week 1', sections: [{ id: 's1', title: 'Onboarding' }, { id: 's2', title: 'Dialogue' }], items };
  it('groups by section in section order, manual order inside, loose items last', () => {
    expect(weekGroups(week, asg).map(g => [g.section?.title ?? null, g.items.map(i => i.id)])).toEqual([
      ['Onboarding', ['c1', 'c3']], ['Dialogue', ['c2']], [null, ['asg']],
    ]);
    expect(normalizeWeek(week, asg).items.map(i => i.id)).toEqual(['c1', 'c3', 'c2', 'asg']);
  });
  it('older weeks without sections keep day order until organised', () => {
    const old = { id: 'w', title: 'Week 1', items: items.map(({ sectionId: _, ...i }) => i as OutlineItem) };
    expect(weekGroups(old, asg)[0].items.map(i => i.id)).toEqual(['c2', 'c3', 'asg', 'c1']);
    expect(normalizeWeek(old, asg).sections).toEqual([]);
  });
});

describe('next steps', () => {
  const assignments: Assignment[] = [
    { id: 'w1', title: 'Week 1 assignment', stage: 'A', materials: [], dueDay: 5 },
    { id: 'w2', title: 'Week 2 assignment', stage: 'A', materials: [], dueDay: 2 },
  ];
  const modules = [{ id: 'm1', order: 1, title: 'Lesson 1.1', description: '', category: 'x' }, { id: 'm2', order: 2, title: 'Lesson 1.2', description: '', category: 'x' }];
  const outline = { id: 'current' as const, weeks: [
    { id: 'k1', title: 'Week 1', items: [
      { id: 'a', kind: 'content' as const, moduleId: 'm1' }, { id: 'b', kind: 'content' as const, moduleId: 'm2' },
      { id: 'c', kind: 'assignment' as const, assignmentId: 'w1' },
    ] },
    { id: 'k2', title: 'Week 2', items: [{ id: 'd', kind: 'assignment' as const, assignmentId: 'w2' }] },
  ] };
  const enrollment = { id: 't', traineeId: 't', startDate: '2026-09-21', podEpisodesRequired: 1 as const, createdAt: '', reviewers: {}, reviewerUids: [] };
  const watched = (m: string) => ({ id: `${m}_t`, moduleId: m, userId: 't', watchedAt: '' });
  const at = (iso: string) => new Date(`${iso}T12:00:00`);

  it('points at the first unfinished item in outline order', () => {
    expect(nextSteps(outline, assignments, modules, enrollment, 't', [], [], at('2026-09-21')).next?.title).toBe('Lesson 1.1');
    const r = nextSteps(outline, assignments, modules, enrollment, 't', [watched('m1'), watched('m2')], [], at('2026-09-22'));
    expect([r.next?.kind, r.next?.title, r.next?.hash]).toEqual(['assignment', 'Week 1 assignment', '#/assignment/w1']);
    expect(r.overdue).toEqual([]);
  });

  it('lists an assignment as overdue the day after its due day and moves on', () => {
    // Week 1 assignment due Fri Sep 25.
    const r = nextSteps(outline, assignments, modules, enrollment, 't', [watched('m1'), watched('m2')], [], at('2026-09-26'));
    expect(r.overdue.map(s => s.title)).toEqual(['Week 1 assignment']);
    expect(r.next?.title).toBe('Week 2 assignment');
    const submitted = [{ id: 's', traineeId: 't', stage: 'A' as const, target: 'w1', version: 1, isComplete: true, links: [], submittedAt: '' }];
    expect(nextSteps(outline, assignments, modules, enrollment, 't', [watched('m1'), watched('m2')], submitted, at('2026-09-26')).overdue).toEqual([]);
  });
});
