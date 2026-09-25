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
    {
      id: 'u4',
      name: 'Maya Lin',
      email: 'maya@storyco.example',
      role: 'sound_designer',
      pod: 'Neon Synthesis',
      createdAt: '2026-07-02T10:00:00Z',
    },
  ],
  // Default categories - ids match the `category` values on the seed
  // modules below, so existing module documents keep working unchanged.
  categories: [
    { id: 'Onboarding', name: 'Onboarding', order: 1, restricted: false },
    { id: 'Intermediate', name: 'Intermediate', order: 2, restricted: false },
    { id: 'Advanced', name: 'Advanced', order: 3, restricted: true },
  ],
  modules: [
    { 
      id: 'mA', order: 1, label: 'A', category: 'Onboarding', title: 'Pro Tools Set Up', description: 'Initial Pro Tools setup.',
      additionalMaterials: [
        { type: 'article', title: 'Avid Knowledge Base: Pro Tools I/O Setup', url: 'https://avid.secure.force.com/pkb/articles/en_US/How_To/Pro-Tools-I-O-Setup' },
        { type: 'video', title: 'YouTube: Pro Tools First Steps', url: 'https://youtube.com' }
      ]
    },
    { 
      id: 'mB', order: 2, label: 'B', category: 'Onboarding', title: 'Google Drive Workflow', description: 'Organizing files and collaborating via Google Drive.',
      additionalMaterials: [
        { type: 'book', title: 'The Sound Effects Bible', author: 'Ric Viers' },
        { type: 'article', title: 'Google Workspace: Best Practices for Shared Drives' }
      ]
    },
    { 
      id: 'm1', order: 3, label: '1', category: 'Intermediate', title: 'Dialogue Editing & Clean Up', description: 'Cleaning up speech tracks.',
      additionalMaterials: [
        { type: 'video', title: 'Dialogue Editing Masterclass', url: 'https://youtube.com' },
        { type: 'article', title: 'iZotope: Tips for Dialogue Clean-up' }
      ]
    },
    { 
      id: 'm2', order: 4, label: '2', category: 'Intermediate', title: 'SFX Layering', description: 'Building complex sound effects via layering.',
      additionalMaterials: [
        { type: 'video', title: 'Behind the Scenes: Designing Sci-Fi Weapons', url: 'https://youtube.com' },
        { type: 'book', title: 'Sound Design: The Expressive Power of Music, Voice and Sound Effects in Cinema', author: 'David Sonnenschein' }
      ]
    },
    { 
      id: 'm3', order: 5, label: '3', category: 'Intermediate', title: 'Balancing DX, MX, FX', description: 'Balancing dialogue, music, and effects.',
      additionalMaterials: [
        { type: 'article', title: 'The Art of the Mix: Balancing DX, MX, FX' },
        { type: 'video', title: 'Mixing a Heavy Action Scene', url: 'https://youtube.com' }
      ]
    },
    { 
      id: 'm4', 
      order: 6, 
      label: '4',
      category: 'Intermediate',
      title: 'Full Mixing Steps', 
      description: "In this module, we explore the surgical and creative uses of equalization. You'll learn to identify frequency clashes in a complex mix and use dynamic compression to control transients. Focus on the low-end definition without sacrificing punch.",
      outline: ['1. Intro to EQ', '2. Subtractive vs Additive EQ', '3. Dynamic Range Compression', '4. Parallel Processing'],
      outcomes: ['Understand the frequency spectrum', 'Apply compression effectively', 'Enhance low-end definition'],
      objectives: ['Identify problematic frequencies', 'Use a parametric EQ to shape sounds', 'Apply compression to control peaks'],
      additionalMaterials: [
        { type: 'article', title: 'Understanding Dynamic Range Compression' },
        { type: 'video', title: 'EQ Sweep Techniques', url: 'https://youtube.com' },
        { type: 'book', title: 'Mixing Secrets for the Small Studio', author: 'Mike Senior' }
      ]
    },
    { 
      id: 'm5', order: 7, label: '5', category: 'Advanced', title: 'Character Voice Design', description: 'Creating specific character voices.',
      additionalMaterials: [
        { type: 'video', title: 'Vocal Processing for Video Games', url: 'https://youtube.com' },
        { type: 'article', title: 'Pitch Shifting and Formants' }
      ]
    },
    { 
      id: 'm6', order: 8, label: '6', category: 'Advanced', title: 'Plugin Techniques for Sound Design', description: 'Using advanced plugins for creative sound design.',
      additionalMaterials: [
        { type: 'book', title: 'Electronic Music: Systems, Techniques, and Controls', author: 'Allen Strange' },
        { type: 'article', title: 'Granular Synthesis Explained' }
      ]
    },
    { 
      id: 'm7', order: 9, label: '7', category: 'Advanced', title: 'Storytelling in Audio', description: 'How to tell a compelling story through sound alone.',
      additionalMaterials: [
        { type: 'book', title: 'Audio-Vision: Sound on Screen', author: 'Michel Chion' },
        { type: 'article', title: 'Using Reverb to Create Space' }
      ]
    },
    { 
      id: 'm8', order: 10, label: '8', category: 'Advanced', title: 'Dolby Atmos Concept', description: 'Introduction to spatial audio mixing.',
      additionalMaterials: [
        { type: 'video', title: 'Dolby Atmos Renderer Tutorial', url: 'https://youtube.com' },
        { type: 'article', title: 'Object-Based Audio Mixing' }
      ]
    },
    { 
      id: 'm9', order: 11, label: '9', category: 'Advanced', title: 'Pipeline & Automation', description: 'Streamlining your audio workflow with automation.',
      additionalMaterials: [
        { type: 'article', title: 'Advanced Automation Workflows' },
        { type: 'video', title: 'VCA Groups vs Folder Tracks', url: 'https://youtube.com' }
      ]
    },
  ],
  moduleVideos: [
    { id: 'v1', moduleId: 'm4', type: 'internal', url: '#', title: 'Mastering the Frequency Spectrum' },
  ],
  // These used to hold fake demo rows (referencing user ids like 'u1'/'u2'
  // that never existed as real Firebase Auth accounts). Submissions, grades,
  // video tasks, and video-watch progress are now real Firestore-backed data
  // that accumulates from real usage - see store.tsx - so there's nothing to
  // seed here. `modules` and `moduleVideos` above are still used as the
  // one-time curriculum seed an admin's client writes into Firestore the
  // first time they sign in (see seedCurriculumIfEmpty in store.tsx).
  videoProgress: [],
};
