// 'reviewer' is for assessment-only accounts (producers, key sound
// designers) who score assigned trainees but are not trainees themselves.
export type Role = 'sound_designer' | 'audio_engineer' | 'admin' | 'reviewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  pod?: string;
  avatarBase64?: string;
  createdAt: string;
  // Saved per account so the choice follows the user to every device.
  // Unset means "follow the OS setting".
  theme?: 'light' | 'dark';
  // Ids of restricted categories an admin has opened up for this user.
  // Only admins can change this (see firestore.rules).
  unlockedCategories?: string[];
}

// Admin-managed grouping for modules (shown as sidebar sections). A
// restricted category is hidden from sound designers unless an admin has
// unlocked it for them; engineers and admins always see every category.
export interface Category {
  id: string;
  name: string;
  order: number;
  restricted: boolean;
}

export interface Resource {
  type: 'video' | 'article' | 'book';
  title: string;
  url?: string;
  author?: string;
}

// One gradeable sub-skill of a module's rubric. `levels` holds the
// descriptor for scores 1 through 4 (levels[0] = what a 1 looks like).
// `scoreLabel` is the descriptor column's header and can differ between
// criteria in the same module (e.g. "What it looks like in the session"
// vs "What it looks like on playback").
export interface RubricCriterion {
  id: string;
  title: string;
  scoreLabel?: string;
  levels: [string, string, string, string];
}

export interface Module {
  id: string;
  order: number;
  label?: string;
  // Category id. Seeded categories use their name as id ('Onboarding', ...).
  category?: string;
  // Mirrors the category's `restricted` flag. Denormalized onto the module
  // so firestore.rules can check it per-document (see store.tsx reconcile).
  restricted?: boolean;
  title: string;
  description: string;
  outline?: string[];
  rubric?: string;
  rubricNote?: string;
  rubricCriteria?: RubricCriterion[];
  outcomes?: string[];
  objectives?: string[];
  homeworkLink?: string;
  homeworkDescription?: string;
  additionalMaterials?: Resource[];
  // --- Assessment program (new 4-week program) ---
  // Set on the Episode A modules only; legacy modules leave these unset.
  program?: 'episodeA';
  // This module's share of Episode A, in percent (the four sum to 100).
  episodeAWeight?: number;
  // Mixed-media content shown instead of (or alongside) a video. A module
  // never requires a video.
  contentBlocks?: ContentBlock[];
}

// Admin-authored module content. Weeks/days are relative to the trainee's
// enrollment start date (week 1 day 1 = startDate).
export type ContentBlock =
  | { id: string; type: 'richText'; markdown: string }
  | { id: string; type: 'schedule'; title?: string; items: { week: number; day?: number; task: string; hours?: number }[] }
  | { id: string; type: 'milestone'; title: string; week: number; day?: number; description?: string }
  | { id: string; type: 'expectation'; text: string }
  | { id: string; type: 'video'; url: string; title?: string };

export interface ModuleVideo {
  id: string;
  moduleId: string;
  type: 'internal' | 'external';
  url: string;
  title: string;
  // Copied from the owning module so the same read rule can lock videos.
  category?: string;
  restricted?: boolean;
}

export interface Submission {
  id: string;
  moduleId: string;
  userId: string;
  driveLink: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded';
  submittedAt?: string;
}

// Legacy 1-4 grade (original homework flow). Kept as-is and shown as
// "Legacy (1-4)"; never used by the 1-5 assessment calculations.
export type LegacyGrade = Grade;

export interface Grade {
  id: string;
  submissionId: string;
  engineerId: string;
  score: 1 | 2 | 3 | 4;
  feedback: string;
  gradedAt: string;
  // Per-sub-skill scores when the module was graded against structured
  // rubricCriteria; `score` above is then the lowest of these.
  criterionScores?: { criterionId: string; score: 1 | 2 | 3 | 4 }[];
}

export interface VideoTask {
  id: string;
  moduleId: string;
  engineerId: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignedAt: string;
  videoUrl?: string;
}

// Records that a designer watched a module's video through to the end -
// used to anchor that module's homework deadline (see ModuleView).
export interface VideoProgress {
  id: string;
  moduleId: string;
  userId: string;
  watchedAt: string;
}

// ===== Assessment program (1-5 scale) =====

export type AssessmentScore = 1 | 2 | 3 | 4 | 5;
export type CriterionId = 'workflow' | 'dialogue' | 'sfx' | 'music';
export type ReviewerSlot = 'trainer' | 'engineer' | 'keySoundDesigner' | 'producer';
// A = Episode A (graded per exercise), B = Episode B final test,
// P1/P2 = first/second Pod Trial episode.
export type AssessmentStage = 'A' | 'B' | 'P1' | 'P2';

// One exercise inside an Episode A module - a module has any number.
// `weight` is the exercise's share of its module, in percent.
export interface Exercise {
  id: string;
  moduleId: string;
  title: string;
  instructions?: string;
  order: number;
  weight: number;
  // The assignment trainees submit for this grading line. One assignment
  // can carry several lines (e.g. Week 1 is graded for Workflow AND
  // Dialogue - one score each). Unset = legacy: submitted per exercise.
  assignmentId?: string;
}

// Something trainees submit, placed in a week of the program outline.
// Episode A assignments are graded through their linked exercises (one
// score per module line); B/P1/P2 assignments are the Episode B test and
// the Pod Trial episodes.
export interface Assignment {
  id: string;
  title: string;
  stage: AssessmentStage;
  instructions?: string;
  materials: { label: string; url: string }[];
  // Day of the program week it's due (1 = first day of that week).
  dueDay?: number;
}

export type OutlineItem =
  | { id: string; kind: 'content'; moduleId: string; day?: number }
  | { id: string; kind: 'assignment'; assignmentId: string }
  | { id: string; kind: 'milestone'; title: string; day?: number; description?: string };

export interface OutlineWeek {
  id: string;
  title: string;
  items: OutlineItem[];
}

// Admin-arranged week-by-week program (sidebar order + weekly milestones).
export interface ProgramOutline {
  id: 'current';
  weeks: OutlineWeek[];
}

// One cell of a reviewer table: this reviewer's score on this criterion is
// worth `weight` percent of the stage. Cell weights already include the
// criterion weight - they are never multiplied again.
export interface CellWeight {
  slot: ReviewerSlot;
  criterion: CriterionId;
  weight: number;
}

export interface AssessmentConfig {
  id: 'current';
  // Percent of the final grade.
  stageWeights: { episodeA: number; episodeB: number; pod: number };
  passThreshold: number;
  episodeBCells: CellWeight[];
  podCells: CellWeight[];
  // Admin-authored briefs, schedules and milestones for the non-module
  // stages (Episode B final test, Pod Trial).
  stageContent?: { episodeB?: ContentBlock[]; pod?: ContentBlock[] };
}

// One per trainee; doc id = trainee uid. Reviewer slots hold real account
// ids assigned by an admin (never inferred from names/emails).
export interface Enrollment {
  id: string;
  traineeId: string;
  startDate: string; // YYYY-MM-DD
  reviewers: Partial<Record<ReviewerSlot, string>>;
  // Same uids as `reviewers`, as a list so reviewers can query their
  // assigned trainees (firestore.rules checks it matches).
  reviewerUids: string[];
  podEpisodesRequired: 1 | 2;
  createdAt: string;
}

// Append-only: every revision is a new document; firestore.rules forbid
// updating or deleting one. Id = `${traineeId}__${stage}__${target}__v${version}`.
export interface AssessmentSubmission {
  id: string;
  traineeId: string;
  stage: AssessmentStage;
  // Episode A exercise id, or 'episode' for B/P1/P2.
  target: string;
  version: number;
  links: { label: string; url: string }[];
  note?: string;
  // Trainee's "this is my complete submission" flag (Episode B grades the
  // first complete one).
  isComplete: boolean;
  submittedAt: string;
}

// One reviewer's scores for one target. Id =
// `${traineeId}__${stage}__${target}__${reviewerSlot}`. Episode A uses the
// key 'exercise'; B/P use criterion ids.
export interface AssessmentReview {
  id: string;
  traineeId: string;
  stage: AssessmentStage;
  target: string;
  reviewerSlot: ReviewerSlot;
  reviewerUid: string;
  submissionId: string;
  scores: Partial<Record<CriterionId | 'exercise', AssessmentScore>>;
  feedback?: string;
  status: 'draft' | 'submitted';
  updatedAt: string;
}

// Doc id = trainee uid. Trainees see a stage's scores only once published.
export interface Publication {
  id: string;
  episodeA: boolean;
  episodeB: boolean;
  pod: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  categories: Category[];
  modules: Module[];
  moduleVideos: ModuleVideo[];
  submissions: Submission[];
  grades: Grade[];
  videoTasks: VideoTask[];
  videoProgress: VideoProgress[];
}
