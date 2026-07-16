import { AppState } from './types';

export const initialData: AppState = {
  currentUser: null,
  users: [
    {
      id: 'u1',
      name: 'Julian Drake',
      email: 'julian@storyco.example',
      role: 'sound_designer',
      pod: 'Neon Synthesis',
      createdAt: '2026-07-01T10:00:00Z',
    },
    {
      id: 'u2',
      name: 'Sarah Miller',
      email: 'sarah@storyco.example',
      role: 'audio_engineer',
      createdAt: '2026-06-15T09:00:00Z',
    },
    {
      id: 'u3',
      name: 'Director Admin',
      email: 'admin@storyco.example',
      role: 'admin',
      createdAt: '2026-01-01T09:00:00Z',
    },
  ],
  modules: [
    { id: 'm1', order: 1, title: 'Signal Flow', description: 'Understanding audio routing', textContent: 'Text content here...' },
    { id: 'm2', order: 2, title: 'DAW Basics', description: 'Introduction to your Digital Audio Workstation', textContent: 'Text content here...' },
    { id: 'm3', order: 3, title: 'Mic Technique', description: 'Placement and patterns', textContent: 'Text content here...' },
    { 
      id: 'm4', 
      order: 4, 
      title: 'EQ & Dynamics', 
      description: "In this module, we explore the surgical and creative uses of equalization. You'll learn to identify frequency clashes in a complex mix and use dynamic compression to control transients. Focus on the low-end definition without sacrificing punch.", 
      textContent: "In this module, we explore the surgical and creative uses of equalization. You'll learn to identify frequency clashes in a complex mix and use dynamic compression to control transients. Focus on the low-end definition without sacrificing punch.",
      outline: ['1. Intro to EQ', '2. Subtractive vs Additive EQ', '3. Dynamic Range Compression', '4. Parallel Processing'],
      rubric: '4: Excellent balance and clarity. 3: Good balance, minor masking. 2: Needs work on frequency clashes. 1: Poor balance or inappropriate use of compression.',
      outcomes: ['Understand the frequency spectrum', 'Apply compression effectively', 'Enhance low-end definition'],
      objectives: ['Identify problematic frequencies', 'Use a parametric EQ to shape sounds', 'Apply compression to control peaks'],
      homeworkLink: 'https://drive.google.com/drive/folders/homework-example-link',
      homeworkDescription: 'Download the unmixed stems from the Drive folder. Apply EQ and compression as discussed in the video. Bounce a .WAV file of your final mix and submit it.'
    },
    { id: 'm5', order: 5, title: 'Synthesis & MIDI', description: 'Creating sounds from scratch', textContent: 'Text content here...' },
    { id: 'm6', order: 6, title: 'SFX Design', description: 'Building sound effects', textContent: 'Text content here...' },
    { id: 'm7', order: 7, title: 'Foley Art', description: 'Recording real world sounds', textContent: 'Text content here...' },
    { id: 'm8', order: 8, title: 'Mixing Fundamentals', description: 'Balancing your tracks', textContent: 'Text content here...' },
    { id: 'm9', order: 9, title: 'Advanced Compression', description: 'Multiband and sidechain', textContent: 'Text content here...' },
    { id: 'm10', order: 10, title: 'Spatial Audio', description: 'Reverb, delay and panning', textContent: 'Text content here...' },
    { id: 'm11', order: 11, title: 'Dialogue Editing', description: 'Cleaning up speech', textContent: 'Text content here...' },
    { id: 'm12', order: 12, title: 'Mastering', description: 'Final polish and loudness', textContent: 'Text content here...' },
  ],
  moduleVideos: [
    { id: 'v1', moduleId: 'm4', type: 'internal', url: '#', title: 'Mastering the Frequency Spectrum' },
  ],
  submissions: [
    { id: 's1', moduleId: 'm1', userId: 'u1', driveLink: 'https://drive.google.com/...', status: 'graded', submittedAt: '2026-07-10T10:00:00Z' },
    { id: 's2', moduleId: 'm2', userId: 'u1', driveLink: 'https://drive.google.com/...', status: 'graded', submittedAt: '2026-07-12T10:00:00Z' },
    { id: 's3', moduleId: 'm3', userId: 'u1', driveLink: 'https://drive.google.com/...', status: 'graded', submittedAt: '2026-07-14T10:00:00Z' },
  ],
  grades: [
    { id: 'g1', submissionId: 's1', engineerId: 'u2', score: 4, feedback: 'Great job!', gradedAt: '2026-07-11T10:00:00Z' },
    { id: 'g2', submissionId: 's2', engineerId: 'u2', score: 4, feedback: 'Solid work.', gradedAt: '2026-07-13T10:00:00Z' },
    { id: 'g3', submissionId: 's3', engineerId: 'u2', score: 4, feedback: 'Excellent placement.', gradedAt: '2026-07-15T10:00:00Z' },
  ],
  videoTasks: [],
};
