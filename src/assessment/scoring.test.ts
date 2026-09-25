import { describe, expect, it } from 'vitest';
import {
  AssessmentReview, AssessmentScore, AssessmentStage, AssessmentSubmission, CriterionId, Enrollment, ReviewerSlot,
} from '../types';
import {
  DEFAULT_ASSESSMENT_CONFIG as CONFIG, DEFAULT_ASSIGNMENTS, DEFAULT_CRITERIA, allowedScoreKeys, reviewId, scoreKeysFor, submissionId, withConfigDefaults,
} from './config';
import {
  TraineeData, assignmentOutcome, episodeAOutcome, episodeBOutcome, exerciseOutcome, finalResult, outcomeLabel,
  daOutcome, podOutcome, slotTotals, weightIssues, gradingProblems, splitEvenly, scaleShares,
} from './scoring';

// --- Fixtures: fake trainee, never live data -------------------------------

const T = 'trainee-test';
const ALL_SLOTS: ReviewerSlot[] = ['trainer', 'engineer', 'keySoundDesigner', 'producer'];
const enrollment = (overrides: Partial<Enrollment> = {}): Enrollment => ({
  id: T, traineeId: T, startDate: '2026-01-05', podEpisodesRequired: 1, createdAt: '2026-01-01',
  reviewers: { trainer: 'u-trainer', engineer: 'u-engineer', keySoundDesigner: 'u-ksd', producer: 'u-producer' },
  reviewerUids: ['u-trainer', 'u-engineer', 'u-ksd', 'u-producer'],
  ...overrides,
});

const sub = (stage: AssessmentStage, target: string, version: number, isComplete = true): AssessmentSubmission => ({
  id: submissionId(T, stage, target, version), traineeId: T, stage, target, version, isComplete,
  links: [{ label: 'Session', url: 'https://drive.google.com/test' }], submittedAt: `2026-01-0${version}`,
});

const review = (
  stage: AssessmentStage, target: string, slot: ReviewerSlot, scores: AssessmentReview['scores'],
  submission: string, status: AssessmentReview['status'] = 'submitted',
): AssessmentReview => ({
  id: reviewId(T, stage, target, slot), traineeId: T, stage, target, reviewerSlot: slot, reviewerUid: `u-${slot}`,
  submissionId: submission, scores, status, updatedAt: '2026-01-10',
});

// Every cell for a reviewer-table stage scored with the same value.
const fullTableReviews = (stage: 'B' | 'P1' | 'P2' | 'DA', score: AssessmentScore, subId: string, slots: ReviewerSlot[]) =>
  slots.map(slot => review(stage, 'episode', slot,
    Object.fromEntries(allowedScoreKeys(stage, slot).map(k => [k, score])), subId));

// The original three-stage formula (20/40/40, no Audio Description) - what
// a config saved before DA existed resolves to. Most fixtures use it.
const THREE_STAGE = withConfigDefaults({ ...CONFIG, stageWeights: { episodeA: 20, episodeB: 40, pod: 40 } as typeof CONFIG.stageWeights, daCells: undefined as never });

const data = (overrides: Partial<TraineeData> = {}): TraineeData => ({
  config: THREE_STAGE, assignments: DEFAULT_ASSIGNMENTS, exercises: DEFAULT_CRITERIA,
  enrollment: enrollment(), submissions: [], reviews: [], ...overrides,
});

// Episode A fully submitted and graded, with a per-exercise score.
// Submissions are per assignment; each grading line (exercise) gets its own review.
const gradedEpisodeA = (scoreFor: (exerciseId: string) => AssessmentScore) => {
  const assignmentIds = [...new Set(DEFAULT_CRITERIA.map(e => e.assignmentId!))];
  const submissions = assignmentIds.map(a => sub('A', a, 1));
  const reviews = DEFAULT_CRITERIA.map(e => review('A', e.id, 'trainer', { exercise: scoreFor(e.id) }, submissionId(T, 'A', e.assignmentId!, 1)));
  return { submissions, reviews };
};

// --- Episode A ---------------------------------------------------------------

describe('Episode A: assignments, criteria and weights', () => {
  it('seeds assignment weights 40/10/20/30 and criteria that total 100% each', () => {
    const epA = DEFAULT_ASSIGNMENTS.filter(a => a.stage === 'A');
    expect(epA.map(a => a.weight)).toEqual([40, 10, 20, 30]);
    for (const a of epA) {
      const total = DEFAULT_CRITERIA.filter(e => e.assignmentId === a.id).reduce((s, e) => s + e.weight, 0);
      expect(total).toBeCloseTo(100, 6);
    }
    expect(weightIssues(CONFIG)).toEqual([]);
    expect(gradingProblems(CONFIG, DEFAULT_ASSIGNMENTS, DEFAULT_CRITERIA)).toEqual([]);
  });

  it('splits shares evenly to exactly 100', () => {
    expect(splitEvenly(3)).toEqual([33.33, 33.33, 33.34]);
    expect(splitEvenly(2)).toEqual([50, 50]);
    expect(splitEvenly(1)).toEqual([100]);
    expect(splitEvenly(0)).toEqual([]);
  });

  it('scales shares to a new total, keeping proportions', () => {
    // A new 10% assignment: the others (40/10/20/30) shrink to fit 90%.
    expect(scaleShares([40, 10, 20, 30], 90)).toEqual([36, 9, 18, 27]);
    // After deleting one, the rest grow back to 100%.
    expect(scaleShares([40, 20, 30], 100)).toEqual([44.44, 22.22, 33.34]);
    expect(scaleShares([0, 0], 100)).toEqual([50, 50]);
    expect(scaleShares([], 100)).toEqual([]);
  });

  it('reports grading setup problems in plain words', () => {
    const extra = { id: 'asg_x', stage: 'A' as const, title: 'Extra', materials: [], weight: 0 };
    const skewed = DEFAULT_CRITERIA.map(e => (e.id === 'epA_m1_ex1' ? { ...e, title: '', weight: 70 } : e));
    expect(gradingProblems(CONFIG, [...DEFAULT_ASSIGNMENTS, extra], skewed)).toEqual([
      '"Week 1 assignment: dialogue session": criteria shares add up to 120% instead of 100%.',
      expect.stringContaining('has a criterion with no name'),
      expect.stringContaining('"Extra" has no criteria'),
    ]);
    const heavier = DEFAULT_ASSIGNMENTS.map(a => (a.id === 'asg_w1' ? { ...a, weight: 50 } : a));
    expect(gradingProblems(CONFIG, heavier, DEFAULT_CRITERIA)).toEqual(['Episode A assignment weights add up to 110% instead of 100%.']);
  });

  it('rolls criterion scores up by their shares into the assignment score', () => {
    const exercises = DEFAULT_CRITERIA.map(e =>
      e.assignmentId === 'asg_w2b' ? { ...e, weight: ({ epA_m3_ex2: 70, epA_m3_ex3: 30 } as Record<string, number>)[e.id] } : e);
    const scores: Record<string, AssessmentScore> = { epA_m3_ex2: 5, epA_m3_ex3: 2 };
    const d = data({ exercises, ...gradedEpisodeA(id => scores[id] ?? 4) });
    // 0.7*5 + 0.3*2 = 4.1
    expect(assignmentOutcome(d, DEFAULT_ASSIGNMENTS.find(a => a.id === 'asg_w2b')!)).toEqual({ status: 'scored', value: expect.closeTo(4.1, 10) });
  });

  it('combines assignment scores with their Episode A weights', () => {
    const byAssignment: Record<string, AssessmentScore> = { asg_w1: 5, asg_w2a: 4, asg_w2b: 3, asg_w3a: 2 };
    const d = data(gradedEpisodeA(id => byAssignment[DEFAULT_CRITERIA.find(e => e.id === id)!.assignmentId!]));
    // 0.4*5 + 0.1*4 + 0.2*3 + 0.3*2 = 3.6
    expect(episodeAOutcome(d)).toEqual({ status: 'scored', value: expect.closeTo(3.6, 10) });
  });

  it('an assignment is incomplete until every one of its criteria is graded', () => {
    const { submissions, reviews } = gradedEpisodeA(() => 4);
    const d = data({ submissions, reviews: reviews.filter(r => r.target !== 'epA_m4_ex2') });
    const music = assignmentOutcome(d, DEFAULT_ASSIGNMENTS.find(a => a.id === 'asg_w3a')!);
    expect(music).toEqual({ status: 'awaiting', reason: 'assessment', missing: ['Week 3 – 1st assignment: music editing › Music editing – part 2'] });
    expect(episodeAOutcome(d).status).toBe('awaiting');
  });

  it('uses the trainer-selected revision and keeps earlier versions', () => {
    const ex = DEFAULT_CRITERIA[0];
    const v1 = sub('A', ex.assignmentId!, 1), v2 = sub('A', ex.assignmentId!, 2);
    const d = data({ submissions: [v1, v2], reviews: [review('A', ex.id, 'trainer', { exercise: 5 }, v2.id)] });
    expect(exerciseOutcome(d, ex)).toEqual({ status: 'scored', value: 5 });
    expect(d.submissions).toHaveLength(2);
  });

  it('ignores a grade pointing at a submission for another assignment', () => {
    const a = DEFAULT_CRITERIA.find(e => e.assignmentId === 'asg_w1')!;
    const d = data({ submissions: [sub('A', 'asg_w1', 1), sub('A', 'asg_w2a', 1)], reviews: [review('A', a.id, 'trainer', { exercise: 5 }, submissionId(T, 'A', 'asg_w2a', 1))] });
    expect(exerciseOutcome(d, a)).toMatchObject({ status: 'awaiting', reason: 'assessment' });
  });

  it('one assignment submission is graded separately for each criterion', () => {
    // Week 1 is scored for Workflow and Dialogue.
    const [workflow, dialogue] = DEFAULT_CRITERIA.filter(e => e.assignmentId === 'asg_w1');
    const s = sub('A', 'asg_w1', 1);
    const d = data({ submissions: [s], reviews: [
      review('A', workflow.id, 'trainer', { exercise: 5 }, s.id),
      review('A', dialogue.id, 'trainer', { exercise: 2 }, s.id),
    ] });
    expect(exerciseOutcome(d, workflow)).toEqual({ status: 'scored', value: 5 });
    expect(exerciseOutcome(d, dialogue)).toEqual({ status: 'scored', value: 2 });
    expect(assignmentOutcome(d, DEFAULT_ASSIGNMENTS.find(a => a.id === 'asg_w1')!)).toEqual({ status: 'scored', value: 3.5 });
  });

  it('still counts submissions made directly against an exercise (before assignments)', () => {
    const ex = DEFAULT_CRITERIA[0];
    const legacy = sub('A', ex.id, 1);
    const d = data({ submissions: [legacy], reviews: [review('A', ex.id, 'trainer', { exercise: 3 }, legacy.id)] });
    expect(exerciseOutcome(d, ex)).toEqual({ status: 'scored', value: 3 });
  });

  it('draft reviews do not count', () => {
    const ex = DEFAULT_CRITERIA[0];
    const d = data({ submissions: [sub('A', ex.assignmentId!, 1)], reviews: [review('A', ex.id, 'trainer', { exercise: 4 }, submissionId(T, 'A', ex.assignmentId!, 1), 'draft')] });
    expect(exerciseOutcome(d, ex)).toMatchObject({ status: 'awaiting', reason: 'assessment' });
  });
});

// --- Episode B ---------------------------------------------------------------

describe('Episode B: equal reviewer weights', () => {
  it('trainer and audio engineer each carry exactly 50%', () => {
    expect(slotTotals(CONFIG.episodeBCells)).toEqual({ trainer: 50, engineer: 50 });
  });

  it('uses the exact 10/10/15/15 criterion cells for both reviewers', () => {
    for (const slot of ['trainer', 'engineer'] as const) {
      const bySlot = Object.fromEntries(CONFIG.episodeBCells.filter(c => c.slot === slot).map(c => [c.criterion, c.weight]));
      expect(bySlot).toEqual({ workflow: 10, dialogue: 10, sfx: 15, music: 15 });
    }
  });

  it('weights each reviewer equally without multiplying criterion weights again', () => {
    const s = sub('B', 'episode', 1);
    const d = data({ submissions: [s], reviews: [...fullTableReviews('B', 5, s.id, ['trainer']), ...fullTableReviews('B', 3, s.id, ['engineer'])] });
    // 0.5*5 + 0.5*3 = 4 (a double-weighted formula would give ~1.1)
    expect(episodeBOutcome(d)).toEqual({ status: 'scored', value: expect.closeTo(4, 10) });
  });

  it('grades the first complete submission, not later revisions', () => {
    const draft = sub('B', 'episode', 1, false), first = sub('B', 'episode', 2), later = sub('B', 'episode', 3);
    const onLater = data({ submissions: [draft, first, later], reviews: fullTableReviews('B', 4, later.id, ['trainer', 'engineer']) });
    expect(episodeBOutcome(onLater)).toMatchObject({ status: 'awaiting', reason: 'assessment' });
    const onFirst = data({ submissions: [draft, first, later], reviews: fullTableReviews('B', 4, first.id, ['trainer', 'engineer']) });
    expect(episodeBOutcome(onFirst)).toEqual({ status: 'scored', value: expect.closeTo(4, 10) });
  });

  it('waits for a complete submission', () => {
    const d = data({ submissions: [sub('B', 'episode', 1, false)] });
    expect(outcomeLabel(episodeBOutcome(d))).toBe('Awaiting submission');
  });
});

// --- Pod Trial ---------------------------------------------------------------

describe('Pod Trial: exact cell weights', () => {
  const cell = (slot: ReviewerSlot, criterion: CriterionId) =>
    CONFIG.podCells.find(c => c.slot === slot && c.criterion === criterion)?.weight;

  it('matches the specified table cell by cell', () => {
    const expected: Record<CriterionId, Partial<Record<ReviewerSlot, number>>> = {
      workflow: { trainer: 7.5, engineer: 7.5, keySoundDesigner: 5 },
      dialogue: { trainer: 7.5, engineer: 7.5, keySoundDesigner: 5 },
      sfx: { trainer: 9, engineer: 9, keySoundDesigner: 5, producer: 7 },
      music: { trainer: 8.5, engineer: 8.5, keySoundDesigner: 5, producer: 8 },
    };
    for (const [criterion, bySlot] of Object.entries(expected) as [CriterionId, Partial<Record<ReviewerSlot, number>>][]) {
      for (const slot of ALL_SLOTS) expect(cell(slot, criterion)).toBe(bySlot[slot]);
    }
    expect(CONFIG.podCells).toHaveLength(14);
  });

  it('reviewer totals are 32.5 / 32.5 / 20 / 15', () => {
    expect(slotTotals(CONFIG.podCells)).toEqual({ trainer: 32.5, engineer: 32.5, keySoundDesigner: 20, producer: 15 });
  });

  it('producer scores only SFX and Music', () => {
    expect(allowedScoreKeys('P1', 'producer')).toEqual(['sfx', 'music']);
    expect(CONFIG.podCells.filter(c => c.slot === 'producer').map(c => c.criterion)).toEqual(['sfx', 'music']);
  });

  it('computes Σ cell weight × score across all four reviewers', () => {
    const s = sub('P1', 'episode', 1);
    const d = data({ submissions: [s], reviews: [
      ...fullTableReviews('P1', 5, s.id, ['trainer', 'engineer']), // 65% at 5
      ...fullTableReviews('P1', 3, s.id, ['keySoundDesigner']), // 20% at 3
      ...fullTableReviews('P1', 2, s.id, ['producer']), // 15% at 2
    ] });
    // 0.65*5 + 0.20*3 + 0.15*2 = 4.15
    expect(podOutcome(d)).toEqual({ status: 'scored', value: expect.closeTo(4.15, 10) });
  });
});

describe('Pod Trial: one vs two required episodes', () => {
  const ep = (stage: 'P1' | 'P2', score: AssessmentScore) => {
    const s = sub(stage, 'episode', 1);
    return { submissions: [s], reviews: fullTableReviews(stage, score, s.id, ALL_SLOTS) };
  };

  it('one required episode uses that episode alone', () => {
    const p1 = ep('P1', 4);
    expect(podOutcome(data({ ...p1 }))).toEqual({ status: 'scored', value: expect.closeTo(4, 10) });
  });

  it('two required episodes are averaged', () => {
    const p1 = ep('P1', 5), p2 = ep('P2', 3);
    const d = data({ enrollment: enrollment({ podEpisodesRequired: 2 }), submissions: [...p1.submissions, ...p2.submissions], reviews: [...p1.reviews, ...p2.reviews] });
    expect(podOutcome(d)).toEqual({ status: 'scored', value: expect.closeTo(4, 10) });
  });

  it('with two required, waits until both are fully scored', () => {
    const p1 = ep('P1', 5);
    const d = data({ enrollment: enrollment({ podEpisodesRequired: 2 }), ...p1 });
    expect(podOutcome(d)).toMatchObject({ status: 'awaiting', reason: 'submission', missing: ['Pod episode 2'] });
  });

  it('a second episode is ignored when only one is required', () => {
    const p1 = ep('P1', 4), p2 = ep('P2', 1);
    const d = data({ submissions: [...p1.submissions, ...p2.submissions], reviews: [...p1.reviews, ...p2.reviews] });
    expect(podOutcome(d)).toEqual({ status: 'scored', value: expect.closeTo(4, 10) });
  });
});

// --- Missing data & final ----------------------------------------------------

describe('Missing reviews and assignments', () => {
  it('reports "Awaiting submission", never zero, when nothing is submitted', () => {
    const r = finalResult(data());
    expect(r.final.status).toBe('awaiting');
    expect(outcomeLabel(r.final)).toBe('Awaiting submission');
    expect(r.meetsBenchmark).toBeUndefined();
  });

  it('reports unassigned reviewers before anything else', () => {
    const d = data({ enrollment: enrollment({ reviewers: { trainer: 'u-trainer' }, reviewerUids: ['u-trainer'] }) });
    expect(episodeBOutcome(d)).toEqual({ status: 'awaiting', reason: 'assignment', missing: ['Audio Engineer (Episode B)'] });
    expect(outcomeLabel(episodeBOutcome(d))).toBe('Awaiting assessment (reviewer not assigned)');
  });

  it('lists each missing reviewer cell', () => {
    const s = sub('B', 'episode', 1);
    const d = data({ submissions: [s], reviews: fullTableReviews('B', 4, s.id, ['trainer']) });
    const o = episodeBOutcome(d);
    expect(o).toMatchObject({ status: 'awaiting', reason: 'assessment' });
    expect(o.status === 'awaiting' && o.missing).toHaveLength(4);
  });

  it('a partially scored review (missing a criterion) does not count', () => {
    const s = sub('B', 'episode', 1);
    const partial = review('B', 'episode', 'engineer', { workflow: 4, dialogue: 4, sfx: 4 }, s.id);
    const d = data({ submissions: [s], reviews: [...fullTableReviews('B', 4, s.id, ['trainer']), partial] });
    expect(episodeBOutcome(d)).toMatchObject({ status: 'awaiting', missing: ['Episode B: Audio Engineer – Music Editing'] });
  });

  it('not enrolled is reported as such', () => {
    expect(outcomeLabel(episodeAOutcome(data({ enrollment: undefined })))).toBe('Not enrolled');
  });
});

describe('Final grade', () => {
  const complete = (a: AssessmentScore, b: AssessmentScore, p: AssessmentScore) => {
    const epA = gradedEpisodeA(() => a);
    const sb = sub('B', 'episode', 1), sp = sub('P1', 'episode', 1);
    return data({
      submissions: [...epA.submissions, sb, sp],
      reviews: [...epA.reviews, ...fullTableReviews('B', b, sb.id, ['trainer', 'engineer']), ...fullTableReviews('P1', p, sp.id, ALL_SLOTS)],
    });
  };

  it('is A×0.20 + B×0.40 + Pod×0.40', () => {
    const r = finalResult(complete(5, 3, 4));
    // 0.2*5 + 0.4*3 + 0.4*4 = 3.8
    expect(r.final).toEqual({ status: 'scored', value: expect.closeTo(3.8, 10) });
    expect(r.meetsBenchmark).toBe(true);
  });

  it('meets the benchmark at exactly 3.5 and not below', () => {
    // Episode A = 0.2*5 + 0.2*5 + 0.3*2 + 0.3*3 = 3.5
    const byModule: Record<string, AssessmentScore> = { epA_m1: 5, epA_m2: 5, epA_m3: 2, epA_m4: 3 };
    const epA = gradedEpisodeA(id => byModule[id.split('_ex')[0]]);
    const sb = sub('B', 'episode', 1), sp = sub('P1', 'episode', 1);
    const build = (b: AssessmentScore) => data({
      submissions: [...epA.submissions, sb, sp],
      reviews: [...epA.reviews, ...fullTableReviews('B', b, sb.id, ['trainer', 'engineer']), ...fullTableReviews('P1', 4, sp.id, ALL_SLOTS)],
    });
    // 0.2*3.5 + 0.4*3 + 0.4*4 = 3.5 exactly → meets the benchmark
    const atThreshold = finalResult(build(3));
    expect(atThreshold.final).toEqual({ status: 'scored', value: expect.closeTo(3.5, 10) });
    expect(atThreshold.meetsBenchmark).toBe(true);
    // 0.2*3.5 + 0.4*2 + 0.4*4 = 3.1 → below
    expect(finalResult(build(2)).meetsBenchmark).toBe(false);
  });

  it('judges the benchmark on the displayed 2-decimal score (33.33% weights)', () => {
    // One Episode A assignment with criteria 33.33/33.33/33.34 scored 5/4/3 computes 3.9999, shown as 4.00.
    const only = { ...DEFAULT_ASSIGNMENTS[0], weight: 100 };
    const assignments = [only, ...DEFAULT_ASSIGNMENTS.filter(a => a.stage !== 'A')];
    const exercises = [['c1', 33.33], ['c2', 33.33], ['c3', 33.34]].map(([id, weight], i) => ({ id: id as string, assignmentId: only.id, title: id as string, order: i + 1, weight: weight as number }));
    const scores: Record<string, AssessmentScore> = { c1: 5, c2: 4, c3: 3 };
    const s1 = sub('A', only.id, 1);
    const epA = { submissions: [s1], reviews: exercises.map(e => review('A', e.id, 'trainer', { exercise: scores[e.id] }, s1.id)) };
    const d = data({ assignments, exercises, ...epA });
    const asgScore = assignmentOutcome(d, only);
    expect(asgScore.status === 'scored' && asgScore.value).toBeLessThan(4);
    expect(outcomeLabel(asgScore)).toBe('4.00');
    // A final that computes just under the benchmark but displays at it passes.
    const sb = sub('B', 'episode', 1), sp = sub('P1', 'episode', 1);
    const r = finalResult(data({
      assignments, exercises,
      config: { ...THREE_STAGE, passThreshold: 3.2 },
      submissions: [...epA.submissions, sb, sp],
      reviews: [...epA.reviews, ...fullTableReviews('B', 3, sb.id, ['trainer', 'engineer']), ...fullTableReviews('P1', 3, sp.id, ALL_SLOTS)],
    }));
    // 0.2*3.99997 + 0.4*3 + 0.4*3 = 3.199994 → displayed 3.20 → meets a 3.20 benchmark
    expect(r.final.status === 'scored' && r.final.value).toBeLessThan(3.2);
    expect(outcomeLabel(r.final)).toBe('3.20');
    expect(r.meetsBenchmark).toBe(true);
  });

  it('stays awaiting while any stage is missing', () => {
    const d = complete(5, 5, 5);
    const withoutPod = { ...d, reviews: d.reviews.filter(r => r.stage !== 'P1') };
    expect(finalResult(withoutPod).final).toMatchObject({ status: 'awaiting', reason: 'assessment' });
  });
});

// --- Audio Description (DA) ----------------------------------------------------

describe('Audio Description stage', () => {
  const DA_SLOTS: ReviewerSlot[] = ['trainer', 'engineer', 'producer'];
  const everything = (a: AssessmentScore, b: AssessmentScore, p: AssessmentScore, da?: AssessmentScore) => {
    const epA = gradedEpisodeA(() => a);
    const sb = sub('B', 'episode', 1), sp = sub('P1', 'episode', 1), sd = sub('DA', 'episode', 1);
    return data({
      config: CONFIG,
      submissions: [...epA.submissions, sb, sp, sd],
      reviews: [...epA.reviews, ...fullTableReviews('B', b, sb.id, ['trainer', 'engineer']), ...fullTableReviews('P1', p, sp.id, ALL_SLOTS),
        ...(da ? fullTableReviews('DA', da, sd.id, DA_SLOTS) : [])],
    });
  };

  it('new programs weigh A 20 · B 25 · Pod 40 · DA 15, and the producer scores every DA criterion', () => {
    expect(CONFIG.stageWeights).toEqual({ episodeA: 20, episodeB: 25, pod: 40, da: 15 });
    expect(slotTotals(CONFIG.daCells)).toEqual({ trainer: expect.closeTo(33.32, 2), engineer: expect.closeTo(33.32, 2), producer: expect.closeTo(33.36, 2) });
    expect(allowedScoreKeys('DA', 'producer')).toEqual(['workflow', 'dialogue', 'sfx', 'music']);
    expect(weightIssues(CONFIG)).toEqual([]);
  });

  it('adds DA into the final grade', () => {
    const r = finalResult(everything(5, 3, 4, 2));
    // 0.2*5 + 0.25*3 + 0.4*4 + 0.15*2 = 3.65
    expect(r.da).toEqual({ status: 'scored', value: expect.closeTo(2, 10) });
    expect(r.final).toEqual({ status: 'scored', value: expect.closeTo(3.65, 10) });
  });

  it('holds the final grade until DA is scored', () => {
    const r = finalResult(everything(5, 3, 4));
    expect(daOutcome(everything(5, 3, 4)).status).toBe('awaiting');
    expect(r.final.status).toBe('awaiting');
  });

  it('a stage weighted 0 is left out (configs saved before DA existed)', () => {
    expect(THREE_STAGE.stageWeights.da).toBe(0);
    const r = finalResult({ ...everything(5, 3, 4), config: THREE_STAGE });
    // DA unscored but weighted 0: 0.2*5 + 0.4*3 + 0.4*4 = 3.8
    expect(r.final).toEqual({ status: 'scored', value: expect.closeTo(3.8, 10) });
  });
});

describe('admin-defined reviewer-table criteria', () => {
  // Episode B with two custom criteria: the engineer scores only "Mix".
  const custom = {
    ...THREE_STAGE,
    criteria: { episodeB: [{ id: 'mix', title: 'Mix', levels: ['Clipping', '', '', '', 'Broadcast ready'] }, { id: 'story', title: 'Storytelling' }] },
    episodeBCells: [{ slot: 'trainer' as const, criterion: 'mix', weight: 30 }, { slot: 'trainer' as const, criterion: 'story', weight: 40 }, { slot: 'engineer' as const, criterion: 'mix', weight: 30 }],
  };
  it('each reviewer scores the criteria they have a cell for, and the rules get the same keys', () => {
    expect(allowedScoreKeys('B', 'trainer', custom)).toEqual(['mix', 'story']);
    expect(allowedScoreKeys('B', 'engineer', custom)).toEqual(['mix']);
    expect(scoreKeysFor(custom).B).toEqual({ trainer: ['mix', 'story'], engineer: ['mix'] });
    expect(scoreKeysFor(CONFIG).P.producer).toEqual(['sfx', 'music']);
  });
  it('grades the stage from the custom cells', () => {
    const sb = sub('B', 'episode', 1);
    const d = data({ config: custom, submissions: [sb], reviews: [
      review('B', 'episode', 'trainer', { mix: 5, story: 2 }, sb.id), review('B', 'episode', 'engineer', { mix: 4 }, sb.id)] });
    // (30*5 + 40*2 + 30*4) / 100 = 3.5
    expect(episodeBOutcome(d)).toEqual({ status: 'scored', value: expect.closeTo(3.5, 10) });
    const missing = data({ config: custom, submissions: [sb], reviews: [review('B', 'episode', 'trainer', { mix: 5, story: 2 }, sb.id)] });
    expect(episodeBOutcome(missing)).toMatchObject({ status: 'awaiting', missing: ['Episode B: Audio Engineer – Mix'] });
  });
});
