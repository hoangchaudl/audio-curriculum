import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSESSMENT_CONFIG, DEFAULT_ASSIGNMENTS, DEFAULT_CRITERIA, DEFAULT_OUTLINE } from './config';
import { behindReasons, isReleasedBy, lessonPace, traineeStanding, week2CheckpointDue } from './standing';
import { TraineeData } from './scoring';

const T = 't';
const base = (overrides: Partial<TraineeData> = {}): TraineeData => ({
  config: DEFAULT_ASSESSMENT_CONFIG, assignments: DEFAULT_ASSIGNMENTS, exercises: DEFAULT_CRITERIA,
  enrollment: { id: T, traineeId: T, startDate: '2026-09-21', podEpisodesRequired: 1, createdAt: '', reviewers: { trainer: 'u' }, reviewerUids: ['u'] },
  submissions: [], reviews: [], ...overrides,
});
const at = (iso: string) => new Date(`${iso}T12:00:00`);
const submitted = (target: string) => ({ id: `s_${target}`, traineeId: T, stage: 'A' as const, target, version: 1, isComplete: true, links: [], submittedAt: '' });

describe('late hand-ins (server submission time vs due day)', () => {
  // Week 1 assignment is due Day 5 = Fri Sep 25 (end of that day).
  const handedIn = (iso: string, extra: object = {}) => ({ ...submitted('asg_w1'), submittedAt: iso, ...extra });
  it('is on time until the end of the due day', () => {
    const s = traineeStanding(base({ submissions: [handedIn('2026-09-25T23:30:00')] }), DEFAULT_OUTLINE, [], at('2026-09-28'));
    expect(s.late).toEqual([]);
  });
  it('counts whole days late from the first version (later revisions don\'t change it)', () => {
    const subs = [handedIn('2026-09-26T09:00:00'), handedIn('2026-09-29T09:00:00', { id: 's2', version: 2 })];
    const s = traineeStanding(base({ submissions: subs }), DEFAULT_OUTLINE, [], at('2026-09-30'));
    expect(s.late.map(l => [l.assignment.id, l.days])).toEqual([['asg_w1', 1]]);
  });
  it('Episode B counts from the first complete version', () => {
    // Episode B (asg_w3b) is due Week 3 Day 4 = Thu Oct 8.
    const b = (iso: string, version: number, isComplete: boolean) =>
      ({ id: `b${version}`, traineeId: T, stage: 'B' as const, target: 'episode', version, isComplete, links: [], submittedAt: iso });
    const s = traineeStanding(base({ submissions: [b('2026-10-07T10:00:00', 1, false), b('2026-10-11T10:00:00', 2, true)] }), DEFAULT_OUTLINE, [], at('2026-10-12'));
    expect(s.late.map(l => [l.assignment.id, l.days])).toEqual([['asg_w3b', 3]]);
  });
});

describe('trainee standing', () => {
  it('is upcoming before the start date and on track early in week 1', () => {
    expect(traineeStanding(base(), DEFAULT_OUTLINE, [], at('2026-09-20')).status).toBe('upcoming');
    const s = traineeStanding(base(), DEFAULT_OUTLINE, [], at('2026-09-22'));
    expect([s.status, s.week, s.overdue.length]).toEqual(['on_track', 1, 0]);
  });

  it('flags an assignment the day after its due day passes without a submission', () => {
    // Week 1 assignment is due Day 5 = Fri Sep 25.
    expect(traineeStanding(base(), DEFAULT_OUTLINE, [], at('2026-09-25')).status).toBe('on_track');
    const late = traineeStanding(base(), DEFAULT_OUTLINE, [], at('2026-09-26'));
    expect(late.status).toBe('behind');
    expect(late.overdue.map(o => o.assignment.id)).toEqual(['asg_w1']);
    expect(behindReasons(late, 3.5)[0]).toMatch(/Week 1 assignment: dialogue session is overdue/);
    const onTime = traineeStanding(base({ submissions: [submitted('asg_w1')] }), DEFAULT_OUTLINE, [], at('2026-09-26'));
    expect(onTime.status).toBe('on_track');
  });

  it('counts the program as over after 4 weeks and waits for grades', () => {
    const allIn = ['asg_w1', 'asg_w2a', 'asg_w2b', 'asg_w3a'].map(submitted);
    const other = ['B', 'P1'].map(stage => ({ ...submitted('episode'), id: `s_${stage}`, stage: stage as 'B' | 'P1' }));
    const s = traineeStanding(base({ submissions: [...allIn, ...other] }), DEFAULT_OUTLINE, [], at('2026-10-20'));
    expect([s.ended, s.status]).toEqual([true, 'grading']);
  });
});

describe('lesson pace', () => {
  // Week 1 with 10 lessons, trainee starts Mon Sep 21.
  const outline = { id: 'current' as const, weeks: [
    { id: 'k1', title: 'Week 1', items: Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, kind: 'content' as const, moduleId: `m${i}` })) },
    { id: 'k2', title: 'Week 2', items: [] },
  ] };
  const done = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}_t`, moduleId: `m${i}`, userId: T, watchedAt: '' }));

  it('flags under half of the week\'s lessons from Thursday (Day 4), not before', () => {
    expect(lessonPace(outline, [], '2026-09-21', T, done(3), at('2026-09-23'))).toEqual([]); // Wed
    expect(lessonPace(outline, [], '2026-09-21', T, done(3), at('2026-09-24'))).toEqual([{ week: 1, done: 3, total: 10, current: true }]); // Thu
    expect(lessonPace(outline, [], '2026-09-21', T, done(5), at('2026-09-24'))).toEqual([]); // half done = fine
  });

  it('keeps flagging a finished week that stayed under half, and marks the trainee behind', () => {
    expect(lessonPace(outline, [], '2026-09-21', T, done(2), at('2026-09-29'))).toEqual([{ week: 1, done: 2, total: 10, current: false }]);
    const s = traineeStanding(base(), outline, done(3), at('2026-09-24'));
    expect(s.status).toBe('behind');
    expect(behindReasons(s, 3.5)).toContain('Week 1: only 3 of 10 lessons done - behind pace (half by Day 4)');
  });
});

describe('checkpoints (Week 2 continue/release, Week 4 offer)', () => {
  const by = { decidedAt: '', decidedBy: 'a' };
  it('a trainee is released by a Week 2 release or a Week 4 "no offer"', () => {
    expect(isReleasedBy(undefined)).toBe(false);
    expect(isReleasedBy({ id: T, week2: { decision: 'continue', ...by } })).toBe(false);
    expect(isReleasedBy({ id: T, week2: { decision: 'release', ...by } })).toBe(true);
    expect(isReleasedBy({ id: T, week2: { decision: 'continue', ...by }, decision: 'offered' })).toBe(false);
    expect(isReleasedBy({ id: T, week2: { decision: 'continue', ...by }, decision: 'not_offered' })).toBe(true);
  });
  it('the Week 2 checkpoint is due once Week 2 is over, until it is recorded', () => {
    // Started Mon Sep 21: Week 3 starts Oct 5.
    const inWeek2 = traineeStanding(base(), DEFAULT_OUTLINE, [], at('2026-10-02'));
    const inWeek3 = traineeStanding(base(), DEFAULT_OUTLINE, [], at('2026-10-05'));
    expect(week2CheckpointDue(inWeek2, undefined)).toBe(false);
    expect(week2CheckpointDue(inWeek3, undefined)).toBe(true);
    expect(week2CheckpointDue(inWeek3, { id: T, week2: { decision: 'continue', ...by } })).toBe(false);
    expect(week2CheckpointDue(null, undefined)).toBe(false);
  });
});
