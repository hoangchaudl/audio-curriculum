import { Module, Submission } from './types';

export interface ProgressStats {
  submitted: number;
  graded: number;
  total: number;
}

// Single source of truth for "how far along is this designer" - used by
// both their own progress card (ModuleView) and the admin roster
// (AdminDashboard), which previously disagreed (graded/total vs
// submissions/total for the same person).
export const computeProgress = (userId: string, submissions: Submission[], totalModules: number): ProgressStats => {
  const own = submissions.filter(s => s.userId === userId);
  return {
    submitted: own.length,
    graded: own.filter(s => s.status === 'graded').length,
    total: totalModules,
  };
};

// The first module (in curriculum order) a designer hasn't been graded on
// yet - i.e. what they should work on next. Falls back to the last module
// once everything is graded, so there's always something to land on. Used
// to pick a new/returning student's default module instead of a hardcoded
// id (see App.tsx).
export const getNextActionableModule = (modules: Module[], submissions: Submission[], userId: string): Module | undefined => {
  if (modules.length === 0) return undefined;
  const sorted = [...modules].sort((a, b) => a.order - b.order);
  const next = sorted.find(m => {
    const sub = submissions.find(s => s.moduleId === m.id && s.userId === userId);
    return sub?.status !== 'graded';
  });
  return next ?? sorted[sorted.length - 1];
};
