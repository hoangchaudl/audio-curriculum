import { describe, expect, it } from 'vitest';
import { Assignment, OutlineItem } from '../types';
import { itemDay, programProgress, sortByDay } from './outline';

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
