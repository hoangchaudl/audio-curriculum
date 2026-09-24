import { describe, expect, it } from 'vitest';
import { Exercise, Module } from '../types';
import { DEFAULT_ASSESSMENT_CONFIG, DEFAULT_ASSIGNMENTS } from './config';
import { convertSkillGrading } from './migrate';
import { episodeAOutcome } from './scoring';

// The old per-skill setup, as it was seeded (fake data only).
const skill = (id: string, order: number, weight: number): Module =>
  ({ id, order, title: id, description: '', category: 'episodeA', program: 'episodeA', episodeAWeight: weight });
const OLD_SKILLS = [skill('epA_m1', 1, 20), skill('epA_m2', 2, 20), skill('epA_m3', 3, 30), skill('epA_m4', 4, 30)];
const line = (id: string, moduleId: string, assignmentId: string, order: number, weight: number): Exercise =>
  ({ id, moduleId, assignmentId, title: id, order, weight });
const OLD_LINES = [
  line('epA_m1_ex1', 'epA_m1', 'asg_w1', 1, 100),
  line('epA_m2_ex1', 'epA_m2', 'asg_w1', 1, 100),
  line('epA_m3_ex1', 'epA_m3', 'asg_w2a', 1, 33.33),
  line('epA_m3_ex2', 'epA_m3', 'asg_w2b', 2, 33.33),
  line('epA_m3_ex3', 'epA_m3', 'asg_w2b', 3, 33.34),
  line('epA_m4_ex1', 'epA_m4', 'asg_w3a', 1, 50),
  line('epA_m4_ex2', 'epA_m4', 'asg_w3a', 2, 50),
];
const ASSIGNMENTS_BEFORE = DEFAULT_ASSIGNMENTS.map(({ weight: _, ...a }) => a);

describe('convertSkillGrading', () => {
  it('turns the 20/20/30/30 skills into assignment weights 40/10/20/30', () => {
    // A leftover skill with no lines (like the nameless "6") is just deleted.
    const stray = skill('epA_m6', 6, 20);
    const c = convertSkillGrading([...OLD_SKILLS, stray], ASSIGNMENTS_BEFORE, OLD_LINES);
    expect(c.assignments.map(a => [a.id, a.weight])).toEqual([['asg_w1', 40], ['asg_w2a', 10], ['asg_w2b', 20], ['asg_w3a', 30]]);
    const shareOf = (id: string) => c.criteria.find(x => x.id === id)!.weight;
    expect([shareOf('epA_m1_ex1'), shareOf('epA_m2_ex1')]).toEqual([50, 50]);
    expect(shareOf('epA_m3_ex1')).toBe(100);
    expect([shareOf('epA_m3_ex2'), shareOf('epA_m3_ex3')]).toEqual([50, 50]);
    expect([shareOf('epA_m4_ex1'), shareOf('epA_m4_ex2')]).toEqual([50, 50]);
    expect(c.deleteModuleIds).toEqual(['epA_m1', 'epA_m2', 'epA_m3', 'epA_m4', 'epA_m6']);
  });

  it('keeps Episode A scores the same as the old skill formula', () => {
    // Uneven custom weights to prove the maths, not just the defaults.
    const skills = [skill('epA_m1', 1, 10), skill('epA_m2', 2, 25), skill('epA_m3', 3, 40), skill('epA_m4', 4, 25)];
    const lines = OLD_LINES.map(l => (l.id === 'epA_m3_ex1' ? { ...l, weight: 60 } : l.id === 'epA_m3_ex2' ? { ...l, weight: 25 } : l.id === 'epA_m3_ex3' ? { ...l, weight: 15 } : l));
    const score: Record<string, 1 | 2 | 3 | 4 | 5> = { epA_m1_ex1: 5, epA_m2_ex1: 2, epA_m3_ex1: 4, epA_m3_ex2: 3, epA_m3_ex3: 1, epA_m4_ex1: 5, epA_m4_ex2: 4 };
    // Old: Σ skillWeight × (Σ lineWeight × score / Σ lineWeight) / 100
    const old = skills.reduce((acc, m) => {
      const ls = lines.filter(l => l.moduleId === m.id);
      const t = ls.reduce((s, l) => s + l.weight, 0);
      return acc + (m.episodeAWeight! / 100) * ls.reduce((s, l) => s + l.weight * score[l.id], 0) / t;
    }, 0);

    const c = convertSkillGrading(skills, ASSIGNMENTS_BEFORE, lines);
    const assignments = ASSIGNMENTS_BEFORE.map(a => ({ ...a, weight: c.assignments.find(x => x.id === a.id)?.weight }));
    const exercises = lines.map(l => ({ ...l, weight: c.criteria.find(x => x.id === l.id)!.weight }));
    const T = 't';
    const subs = [...new Set(lines.map(l => l.assignmentId!))].map(a => ({ id: `s_${a}`, traineeId: T, stage: 'A' as const, target: a, version: 1, isComplete: true, links: [], submittedAt: '2026-01-01' }));
    const reviews = lines.map(l => ({ id: `r_${l.id}`, traineeId: T, stage: 'A' as const, target: l.id, reviewerSlot: 'trainer' as const, reviewerUid: 'u', submissionId: `s_${l.assignmentId}`, scores: { exercise: score[l.id] }, status: 'submitted' as const, updatedAt: '2026-01-02' }));
    const now = episodeAOutcome({
      config: DEFAULT_ASSESSMENT_CONFIG, assignments, exercises, submissions: subs, reviews,
      enrollment: { id: T, traineeId: T, startDate: '2026-01-05', podEpisodesRequired: 1, createdAt: '2026-01-01', reviewers: { trainer: 'u' }, reviewerUids: ['u'] },
    });
    expect(now.status).toBe('scored');
    expect(now.status === 'scored' && now.value).toBeCloseTo(old, 2);
  });
});
