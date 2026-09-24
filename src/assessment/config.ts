import { AssessmentConfig, AssessmentStage, Category, CellWeight, CriterionId, Exercise, Module, ReviewerSlot } from '../types';

export const CRITERIA: { id: CriterionId; label: string }[] = [
  { id: 'workflow', label: 'Workflow, Session Organization & Handoff' },
  { id: 'dialogue', label: 'Dialogue Import, Sync & Leveling' },
  { id: 'sfx', label: 'SFX & Ambience' },
  { id: 'music', label: 'Music Editing' },
];

export const REVIEWER_SLOTS: { id: ReviewerSlot; label: string }[] = [
  { id: 'trainer', label: 'Trainer' },
  { id: 'engineer', label: 'Audio Engineer' },
  { id: 'keySoundDesigner', label: 'Key Sound Designer' },
  { id: 'producer', label: 'Producer' },
];

// 1-5 scale used by every new assessment score.
export const SCORE_LABELS_5: Record<number, string> = {
  1: 'Not Ready',
  2: 'Developing',
  3: 'Functional',
  4: 'Production Ready',
  5: 'Strong',
};

const cells = (rows: [CriterionId, Partial<Record<ReviewerSlot, number>>][]): CellWeight[] =>
  rows.flatMap(([criterion, bySlot]) =>
    (Object.entries(bySlot) as [ReviewerSlot, number][]).map(([slot, weight]) => ({ slot, criterion, weight })),
  );

// The program's grading weights, in percent. Seeded into
// assessmentConfig/current; admins can adjust them there.
export const DEFAULT_ASSESSMENT_CONFIG: AssessmentConfig = {
  id: 'current',
  stageWeights: { episodeA: 20, episodeB: 40, pod: 40 },
  passThreshold: 3.5,
  // Episode B: trainer and audio engineer weigh equally (50% each).
  episodeBCells: cells([
    ['workflow', { trainer: 10, engineer: 10 }],
    ['dialogue', { trainer: 10, engineer: 10 }],
    ['sfx', { trainer: 15, engineer: 15 }],
    ['music', { trainer: 15, engineer: 15 }],
  ]),
  // Pod Trial: the producer scores only SFX and Music.
  podCells: cells([
    ['workflow', { trainer: 7.5, engineer: 7.5, keySoundDesigner: 5 }],
    ['dialogue', { trainer: 7.5, engineer: 7.5, keySoundDesigner: 5 }],
    ['sfx', { trainer: 9, engineer: 9, keySoundDesigner: 5, producer: 7 }],
    ['music', { trainer: 8.5, engineer: 8.5, keySoundDesigner: 5, producer: 8 }],
  ]),
};

// Which reviewer slots take part in each stage, and which score keys each
// may write. Mirrors firestore.rules (allowedSlot / allowedKeys).
export const STAGE_SLOTS: Record<AssessmentStage, ReviewerSlot[]> = {
  A: ['trainer'],
  B: ['trainer', 'engineer'],
  P1: ['trainer', 'engineer', 'keySoundDesigner', 'producer'],
  P2: ['trainer', 'engineer', 'keySoundDesigner', 'producer'],
};

export const allowedScoreKeys = (stage: AssessmentStage, slot: ReviewerSlot): (CriterionId | 'exercise')[] => {
  if (stage === 'A') return ['exercise'];
  if ((stage === 'P1' || stage === 'P2') && slot === 'producer') return ['sfx', 'music'];
  return CRITERIA.map(c => c.id);
};

export const publicationKey = (stage: AssessmentStage): 'episodeA' | 'episodeB' | 'pod' =>
  stage === 'A' ? 'episodeA' : stage === 'B' ? 'episodeB' : 'pod';

export const reviewId = (traineeId: string, stage: AssessmentStage, target: string, slot: ReviewerSlot) =>
  `${traineeId}__${stage}__${target}__${slot}`;

export const submissionId = (traineeId: string, stage: AssessmentStage, target: string, version: number) =>
  `${traineeId}__${stage}__${target}__v${version}`;

// --- One-time program setup (created by an admin's "Set up assessment
// program" action, never automatically). Exercise titles are placeholders
// for admins to rename; weights start equal within each module.
export const EPISODE_A_CATEGORY: Category = { id: 'episodeA', name: 'Episode A (Weeks 1-2)', order: 0, restricted: false };

const moduleSeed = (id: string, order: number, title: string, weight: number): Module => ({
  id, order, label: String(order), category: EPISODE_A_CATEGORY.id, title, description: '',
  program: 'episodeA', episodeAWeight: weight, contentBlocks: [],
});

export const EPISODE_A_MODULES: Module[] = [
  moduleSeed('epA_m1', 1, 'Workflow, Setup & Session Organization', 20),
  moduleSeed('epA_m2', 2, 'Dialogue Import, Sync & Leveling', 20),
  moduleSeed('epA_m3', 3, 'SFX & Ambience', 30),
  moduleSeed('epA_m4', 4, 'Music Editing', 30),
];

const exerciseSeeds = (moduleId: string, count: number): Exercise[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${moduleId}_ex${i + 1}`,
    moduleId,
    title: `Exercise ${i + 1}`,
    order: i + 1,
    // Equal split that still sums to exactly 100 (e.g. 33.33/33.33/33.34).
    weight: i < count - 1 ? Math.floor(10000 / count) / 100 : Math.round((100 - (count - 1) * Math.floor(10000 / count) / 100) * 100) / 100,
  }));

export const EPISODE_A_EXERCISES: Exercise[] = [
  ...exerciseSeeds('epA_m1', 1),
  ...exerciseSeeds('epA_m2', 1),
  ...exerciseSeeds('epA_m3', 3),
  ...exerciseSeeds('epA_m4', 2),
];
