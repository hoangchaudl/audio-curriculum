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
  // Notification ids this user has read (see assessment/notifications.ts).
  readNotifications?: string[];
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
  outcomes?: string[];
  objectives?: string[];
  additionalMaterials?: Resource[];
  // --- Legacy "skill" modules (before grading moved onto assignments) ---
  // Only read by convertSkillGrading (assessment/migrate.ts), which turns
  // them into assignment weights and deletes them.
  program?: 'episodeA';
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
  // start/end: optional clip of a YouTube video, in seconds (see videoClip.ts).
  | { id: string; type: 'video'; url: string; title?: string; start?: number; end?: number };

export interface ModuleVideo {
  id: string;
  moduleId: string;
  type: 'internal' | 'external';
  url: string;
  title: string;
  // Optional clip of a YouTube video, in seconds (see videoClip.ts).
  start?: number;
  end?: number;
  // Copied from the owning module so the same read rule can lock videos.
  category?: string;
  restricted?: boolean;
}

// A trainee finished a lesson: watched its video(s) to the end or marked
// it done (see ContentPageView). Drives program progress.
export interface VideoProgress {
  id: string;
  moduleId: string;
  userId: string;
  watchedAt: string;
}

// ===== Assessment program (1-5 scale) =====

export type AssessmentScore = 1 | 2 | 3 | 4 | 5;
// Reviewer-table criteria ids. The defaults are 'workflow' | 'dialogue' |
// 'sfx' | 'music'; admins add their own per stage (StageCriterion).
export type CriterionId = string;

// One criterion of a reviewer-table stage (Episode B, Pod Trial, DA):
// its name and what each score 1-5 means (levels[0] = score 1).
export interface StageCriterion {
  id: CriterionId;
  title: string;
  levels?: string[];
}
export type CellGroup = 'episodeB' | 'pod' | 'da';
export type ReviewerSlot = 'trainer' | 'engineer' | 'keySoundDesigner' | 'producer';
// A = Episode A (graded per exercise), B = Episode B final test,
// P1/P2 = first/second Pod Trial episode.
// DA = Audio Description: one submission, reviewer-table graded (like B).
export type AssessmentStage = 'A' | 'B' | 'P1' | 'P2' | 'DA';

// One criterion of an Episode A assignment: a 1-5 score its trainer gives
// (e.g. Week 1 is scored for Workflow AND Dialogue). `weight` is its share
// of the assignment, in percent. Stored in the `exercises` collection.
export interface Exercise {
  id: string;
  // Legacy skill module it belonged to; unused since grading moved onto
  // assignments.
  moduleId?: string;
  title: string;
  instructions?: string;
  order: number;
  weight: number;
  // The assignment it scores. Unset = legacy exercise that isn't graded.
  assignmentId?: string;
  // Rubric: what each score means for this criterion - levels[0] describes
  // a 1, levels[4] a 5. Unset/empty = no description for that score.
  levels?: string[];
}

// Something trainees submit, placed on a day of the program outline.
// Episode A assignments are scored on their criteria (`exercises`) and
// weighted within Episode A; B/P1/P2 are the Episode B test and the Pod
// Trial episodes, scored with the reviewer tables in AssessmentConfig.
export interface Assignment {
  id: string;
  title: string;
  stage: AssessmentStage;
  instructions?: string;
  materials: { label: string; url: string }[];
  // Day of the program week it's due (1 = first day of that week).
  dueDay?: number;
  // Episode A only: this assignment's share of Episode A, in percent.
  weight?: number;
}

// sectionId: the week section it's grouped under (unset = after the sections).
export type OutlineItem = (
  // day: the planned day for a lesson (1-7; unset = any day that week); hours: estimated time.
  | { id: string; kind: 'content'; moduleId: string; day?: number; hours?: number }
  | { id: string; kind: 'assignment'; assignmentId: string }
  | { id: string; kind: 'milestone'; title: string; day?: number; description?: string }
) & { sectionId?: string };

// Named group of items inside a week (e.g. "StoryCo General Onboarding").
export interface OutlineSection {
  id: string;
  title: string;
}

export interface OutlineWeek {
  id: string;
  // Legacy: weeks are shown as "Week N" by position; titles are no longer edited.
  title: string;
  // Once set, `items` is in the admin's manual order (sections first, in
  // this order). Unset = older outline, ordered by day.
  sections?: OutlineSection[];
  // What the trainee should achieve this week (shown on My Program).
  goal?: string;
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
  // A stage weighted 0 is left out of the final grade entirely.
  stageWeights: { episodeA: number; episodeB: number; pod: number; da: number };
  passThreshold: number;
  episodeBCells: CellWeight[];
  podCells: CellWeight[];
  daCells: CellWeight[];
  // Admin-authored briefs, schedules and milestones for the non-module
  // stages (Episode B final test, Pod Trial).
  stageContent?: { episodeB?: ContentBlock[]; pod?: ContentBlock[]; da?: ContentBlock[] };
  // Each reviewer-table stage's criteria, in order. Unset = the default four.
  criteria?: Partial<Record<CellGroup, StageCriterion[]>>;
  // Derived from the tables on every save (see scoreKeysFor): which score
  // keys each reviewer writes per stage. firestore.rules reads it.
  scoreKeys?: Record<'B' | 'P' | 'DA', Partial<Record<ReviewerSlot, string[]>>>;
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

// An admin's invitation for an email address that hasn't signed up yet
// (doc id = lowercased email). Signing up with that email gives the invited
// role; a trainee invite also enrolls them with these settings.
export interface Invite {
  id: string;
  email: string;
  role: 'sound_designer' | 'reviewer' | 'audio_engineer';
  // Trainee invites only:
  startDate?: string;
  podEpisodesRequired?: 1 | 2;
  reviewers?: Partial<Record<ReviewerSlot, string>>;
  reviewerUids?: string[];
  createdAt: string;
  createdBy: string;
}

// The coordinator's end-of-probation decision for a trainee. Admin-only
// (never readable by the trainee or their reviewers).
export interface ProgramOutcome {
  id: string; // trainee uid
  decision: 'offered' | 'not_offered';
  decidedAt: string;
  decidedBy: string;
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
  da?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  categories: Category[];
  modules: Module[];
  moduleVideos: ModuleVideo[];
  videoProgress: VideoProgress[];
}
