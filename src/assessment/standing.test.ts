import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSESSMENT_CONFIG, DEFAULT_ASSIGNMENTS, DEFAULT_CRITERIA, DEFAULT_OUTLINE } from './config';
import { behindReasons, traineeStanding } from './standing';
import { TraineeData } from './scoring';

const T = 't';
const base = (overrides: Partial<TraineeData> = {}): TraineeData => ({
  config: DEFAULT_ASSESSMENT_CONFIG, assignments: DEFAULT_ASSIGNMENTS, exercises: DEFAULT_CRITERIA,
  enrollment: { id: T, traineeId: T, startDate: '2026-09-21', podEpisodesRequired: 1, createdAt: '', reviewers: { trainer: 'u' }, reviewerUids: ['u'] },
  submissions: [], reviews: [], ...overrides,
});
const at = (iso: string) => new Date(`${iso}T12:00:00`);
const submitted = (target: string) => ({ id: `s_${target}`, traineeId: T, stage: 'A' as const, target, version: 1, isComplete: true, links: [], submittedAt: '' });

describe('trainee standing', () => {
  it('is upcoming before the start date and on track early in week 1', () => {
    expect(traineeStanding(base(), DEFAULT_OUTLINE, at('2026-09-20')).status).toBe('upcoming');
    const s = traineeStanding(base(), DEFAULT_OUTLINE, at('2026-09-22'));
    expect([s.status, s.week, s.overdue.length]).toEqual(['on_track', 1, 0]);
  });

  it('flags an assignment the day after its due day passes without a submission', () => {
    // Week 1 assignment is due Day 5 = Fri Sep 25.
    expect(traineeStanding(base(), DEFAULT_OUTLINE, at('2026-09-25')).status).toBe('on_track');
    const late = traineeStanding(base(), DEFAULT_OUTLINE, at('2026-09-26'));
    expect(late.status).toBe('behind');
    expect(late.overdue.map(o => o.assignment.id)).toEqual(['asg_w1']);
    expect(behindReasons(late, 3.5)[0]).toMatch(/Week 1 assignment: dialogue session is overdue/);
    const onTime = traineeStanding(base({ submissions: [submitted('asg_w1')] }), DEFAULT_OUTLINE, at('2026-09-26'));
    expect(onTime.status).toBe('on_track');
  });

  it('counts the program as over after 4 weeks and waits for grades', () => {
    const allIn = ['asg_w1', 'asg_w2a', 'asg_w2b', 'asg_w3a'].map(submitted);
    const other = ['B', 'P1'].map(stage => ({ ...submitted('episode'), id: `s_${stage}`, stage: stage as 'B' | 'P1' }));
    const s = traineeStanding(base({ submissions: [...allIn, ...other] }), DEFAULT_OUTLINE, at('2026-10-20'));
    expect([s.ended, s.status]).toEqual([true, 'grading']);
  });
});
