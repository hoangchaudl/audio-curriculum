export type Role = 'sound_designer' | 'audio_engineer' | 'admin';

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
}

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
