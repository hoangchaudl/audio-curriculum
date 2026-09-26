import { AssessmentConfig, AssessmentStage, Assignment, CellGroup, CellWeight, CriterionId, Exercise, ProgramOutline, ReviewerSlot, StageCriterion } from '../types';

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
  stageWeights: { episodeA: 20, episodeB: 25, pod: 40, da: 15 },
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
  // Audio Description: trainer, audio engineer and producer, each criterion
  // a quarter, split equally between the three (admins adjust it).
  daCells: cells([
    ['workflow', { trainer: 8.33, engineer: 8.33, producer: 8.34 }],
    ['dialogue', { trainer: 8.33, engineer: 8.33, producer: 8.34 }],
    ['sfx', { trainer: 8.33, engineer: 8.33, producer: 8.34 }],
    ['music', { trainer: 8.33, engineer: 8.33, producer: 8.34 }],
  ]),
};

// Configs saved before a field existed get its default; DA starts at 0%
// (left out of the final grade) until an admin gives it a weight.
export const withConfigDefaults = (saved: Partial<AssessmentConfig>): AssessmentConfig => ({
  ...DEFAULT_ASSESSMENT_CONFIG,
  ...saved,
  stageWeights: { ...DEFAULT_ASSESSMENT_CONFIG.stageWeights, da: 0, ...saved.stageWeights },
  daCells: saved.daCells ?? DEFAULT_ASSESSMENT_CONFIG.daCells,
} as AssessmentConfig);

// The reviewer table that grades a stage (Episode A has none).
export const stageCells = (config: AssessmentConfig, stage: AssessmentStage): CellWeight[] =>
  stage === 'B' ? config.episodeBCells : stage === 'DA' ? config.daCells : stage === 'A' ? [] : config.podCells;

export const cellGroup = (stage: AssessmentStage): CellGroup => (stage === 'B' ? 'episodeB' : stage === 'DA' ? 'da' : 'pod');
export const CELLS_KEY: Record<CellGroup, 'episodeBCells' | 'podCells' | 'daCells'> = { episodeB: 'episodeBCells', pod: 'podCells', da: 'daCells' };

// A reviewer-table stage's criteria: the admin's list, or the default four.
export const stageCriteria = (config: AssessmentConfig, stage: AssessmentStage): StageCriterion[] =>
  stage === 'A' ? [] : config.criteria?.[cellGroup(stage)] ?? CRITERIA.map(c => ({ id: c.id, title: c.label }));

// Which keys each reviewer scores, per stage: the criteria they have a
// cell for. Saved on the config so firestore.rules can check reviews.
export const scoreKeysFor = (config: AssessmentConfig): NonNullable<AssessmentConfig['scoreKeys']> => {
  const bySlot = (stage: AssessmentStage) => Object.fromEntries(STAGE_SLOTS[stage].map(slot => [slot, allowedScoreKeys(stage, slot, config)]));
  return { B: bySlot('B'), P: bySlot('P1'), DA: bySlot('DA') };
};

// A number typed into a grading setting, or null when the field is blank,
// not a number, or out of range (the field then goes back to the saved
// value - a blank benchmark must never save as 0 and pass everyone).
export const parseSetting = (text: string, min: number, max: number): number | null => {
  const n = Number(text);
  return text.trim() !== '' && Number.isFinite(n) && n >= min && n <= max ? n : null;
};

// Single-submission stages: only the first version marked complete is graded.
export const gradesFirstComplete = (stage: AssessmentStage) => stage === 'B' || stage === 'DA';

// Which reviewer slots take part in each stage, and which score keys each
// may write. Mirrors firestore.rules (allowedSlot / allowedKeys).
export const STAGE_SLOTS: Record<AssessmentStage, ReviewerSlot[]> = {
  A: ['trainer'],
  B: ['trainer', 'engineer'],
  P1: ['trainer', 'engineer', 'keySoundDesigner', 'producer'],
  P2: ['trainer', 'engineer', 'keySoundDesigner', 'producer'],
  DA: ['trainer', 'engineer', 'producer'],
};

// A reviewer scores the stage's criteria they have a table cell for, in
// criteria order (e.g. the Pod Trial producer: SFX and Music).
export const allowedScoreKeys = (stage: AssessmentStage, slot: ReviewerSlot, config: AssessmentConfig = DEFAULT_ASSESSMENT_CONFIG): CriterionId[] => {
  if (stage === 'A') return ['exercise'];
  const cells = stageCells(config, stage);
  return stageCriteria(config, stage).map(c => c.id).filter(id => cells.some(c => c.slot === slot && c.criterion === id));
};

export type PublicationKey = 'episodeA' | 'episodeB' | 'pod' | 'da';
export const publicationKey = (stage: AssessmentStage): PublicationKey =>
  stage === 'A' ? 'episodeA' : stage === 'B' ? 'episodeB' : stage === 'DA' ? 'da' : 'pod';

export const reviewId = (traineeId: string, stage: AssessmentStage, target: string, slot: ReviewerSlot) =>
  `${traineeId}__${stage}__${target}__${slot}`;

export const submissionId = (traineeId: string, stage: AssessmentStage, target: string, version: number) =>
  `${traineeId}__${stage}__${target}__v${version}`;

// --- One-time program setup (created by an admin's "Set up assessment
// program" action, never automatically). Titles are placeholders to rename.
// Seed program, following the 4-week schedule. Episode A weights match what
// the old per-skill setup (skills 20/20/30/30) worked out to per assignment.
export const DEFAULT_ASSIGNMENTS: Assignment[] = [
  { id: 'asg_w1', stage: 'A', title: 'Week 1 assignment: dialogue session', dueDay: 5, weight: 40, materials: [],
    instructions: 'Session with video + dialogue synced and fully leveled. Due by the end of the week.' },
  { id: 'asg_w2a', stage: 'A', title: 'Week 2 – 1st assignment: ambience', dueDay: 2, weight: 10, materials: [],
    instructions: 'Your first single ambience editing session. Due Tuesday.' },
  { id: 'asg_w2b', stage: 'A', title: 'Week 2 – 2nd assignment: SFX + backgrounds', dueDay: 4, weight: 20, materials: [],
    instructions: 'Second session with SFX + backgrounds, built in the same session as your Week 1 submission. Due Thursday.' },
  { id: 'asg_w3a', stage: 'A', title: 'Week 3 – 1st assignment: music editing', dueDay: 1, weight: 30, materials: [],
    instructions: 'Submit the music editing session - the same session as your Week 1 and Week 2 Thursday submissions. Due Monday.' },
  { id: 'asg_w3b', stage: 'B', title: 'Week 3 – 2nd assignment: full independent episode', dueDay: 4, materials: [],
    instructions: 'One full episode completed independently (Episode B, the final episode test). Due Thursday.' },
  { id: 'asg_w4a', stage: 'P1', title: 'Pod Trial – episode 1', dueDay: 5, materials: [] },
  { id: 'asg_w4b', stage: 'P2', title: 'Pod Trial – episode 2', dueDay: 5, materials: [] },
];

const criterion = (id: string, assignmentId: string, title: string, order: number, weight: number): Exercise =>
  ({ id, assignmentId, title, order, weight });

// Criteria (one 1-5 score each) per Episode A assignment. Ids are the
// original placeholders so anything already created against them stays valid.
export const DEFAULT_CRITERIA: Exercise[] = [
  criterion('epA_m1_ex1', 'asg_w1', 'Workflow & session organization', 1, 50),
  criterion('epA_m2_ex1', 'asg_w1', 'Dialogue sync & leveling', 2, 50),
  criterion('epA_m3_ex1', 'asg_w2a', 'Ambience editing', 1, 100),
  criterion('epA_m3_ex2', 'asg_w2b', 'SFX', 1, 50),
  criterion('epA_m3_ex3', 'asg_w2b', 'Backgrounds', 2, 50),
  criterion('epA_m4_ex1', 'asg_w3a', 'Music editing – part 1', 1, 50),
  criterion('epA_m4_ex2', 'asg_w3a', 'Music editing – part 2', 2, 50),
];

const item = {
  assignment: (assignmentId: string) => ({ id: `oi_${assignmentId}`, kind: 'assignment' as const, assignmentId }),
};

// Default outline: the assignments on their due days. Admins add lesson
// content and milestones to any day.
// The program's standard goal for each of the 4 weeks.
export const DEFAULT_WEEK_GOALS = [
  'Explain the episode lifecycle, verify workstation and asset access, and deliver an organized Pro Tools session with correctly imported video and fully synced, leveled dialogue.',
  'Build continuous ambience, edit story-appropriate SFX, and select and begin editing music that supports the creative brief.',
  'Independently complete a full episode with dialogue, ambience, SFX and music, and adapt one episode’s pacing for clear, engaging audio-only listening.',
  'Complete and revise two pod episodes of 2–3 minutes each, communicate effectively, and deliver organized handoffs under a designated key sound designer’s QC.',
];

export const DEFAULT_OUTLINE: ProgramOutline = {
  id: 'current',
  weeks: [
    { id: 'wk1', title: 'Week 1', goal: DEFAULT_WEEK_GOALS[0], items: [item.assignment('asg_w1')] },
    { id: 'wk2', title: 'Week 2', goal: DEFAULT_WEEK_GOALS[1], items: [item.assignment('asg_w2a'), item.assignment('asg_w2b')] },
    { id: 'wk3', title: 'Week 3', goal: DEFAULT_WEEK_GOALS[2], items: [item.assignment('asg_w3a'), item.assignment('asg_w3b')] },
    { id: 'wk4', title: 'Week 4', goal: DEFAULT_WEEK_GOALS[3], items: [item.assignment('asg_w4a'), item.assignment('asg_w4b')] },
  ],
};
