export type Role = 'sound_designer' | 'audio_engineer' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  pod?: string;
  avatarBase64?: string;
  createdAt: string;
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
  category?: string;
  title: string;
  description: string;
  textContent: string;
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
  modules: Module[];
  moduleVideos: ModuleVideo[];
  submissions: Submission[];
  grades: Grade[];
  videoTasks: VideoTask[];
  videoProgress: VideoProgress[];
}
