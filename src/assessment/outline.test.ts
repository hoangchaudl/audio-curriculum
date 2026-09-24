import { describe, expect, it } from 'vitest';
import { Assignment, OutlineItem } from '../types';
import { itemDay, sortByDay } from './outline';

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
