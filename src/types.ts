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

export interface Module {
  id: string;
  order: number;
  title: string;
  description: string;
  textContent: string;
  outline?: string[];
  rubric?: string;
  outcomes?: string[];
  objectives?: string[];
  homeworkLink?: string;
  homeworkDescription?: string;
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
}

export interface VideoTask {
  id: string;
  moduleId: string;
  engineerId: string;
  status: 'not_started' | 'in_progress' | 'uploaded';
  videoUrl?: string;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  modules: Module[];
  moduleVideos: ModuleVideo[];
  submissions: Submission[];
  grades: Grade[];
  videoTasks: VideoTask[];
}
