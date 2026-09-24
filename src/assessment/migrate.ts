import { Assignment, Exercise, Module } from '../types';

// One-time move from the old per-skill grading (Episode A "skill" modules,
// each weighted in Episode A, each made of lines weighted in the skill) to
// grading on assignments. Every trainee's Episode A score stays identical:
// a line used to count  skillWeight × lineWeight / (skill's line total),
// and that same amount is now split as  assignment weight × criterion share.

const round2 = (n: number) => Math.round(n * 100) / 100;
// Undo float noise from the old 33.33/33.34 splits: 9.999 -> 10, 49.99 -> 50.
const tidy = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? Math.round(n) : round2(n));

// Shares of 100 from raw amounts, tidied, with the last absorbing rounding.
const shares = (amounts: number[]): number[] => {
  const total = amounts.reduce((a, b) => a + b, 0);
  if (total <= 0) return amounts.map((_, i, all) => (i === all.length - 1 ? round2(100 - round2(100 / all.length) * (all.length - 1)) : round2(100 / all.length)));
  const out = amounts.map(a => tidy((a / total) * 100));
  out[out.length - 1] = round2(100 - out.slice(0, -1).reduce((a, b) => a + b, 0));
  return out;
};

export interface SkillConversion {
  assignments: { id: string; title: string; weight: number }[];
  criteria: { id: string; assignmentId: string; title: string; order: number; weight: number }[];
  deleteModuleIds: string[];
}

export const legacySkills = (modules: Module[]) => modules.filter(m => m.program === 'episodeA');

export const convertSkillGrading = (modules: Module[], assignments: Assignment[], exercises: Exercise[]): SkillConversion => {
  const skills = legacySkills(modules);
  const lineTotal = (moduleId?: string) => exercises.filter(e => e.moduleId === moduleId).reduce((s, e) => s + e.weight, 0);
  const skillLines = (moduleId?: string) => exercises.filter(e => e.moduleId === moduleId).length;
  // What one line was worth in Episode A, in percent.
  const worth = (e: Exercise) => {
    const skill = skills.find(m => m.id === e.moduleId);
    if (!skill) return 0;
    const t = lineTotal(e.moduleId);
    const inSkill = t > 0 ? e.weight / t : 1 / skillLines(e.moduleId);
    return (skill.episodeAWeight ?? 0) * inSkill;
  };
  const out: SkillConversion = { assignments: [], criteria: [], deleteModuleIds: skills.map(m => m.id) };
  for (const a of assignments.filter(x => x.stage === 'A')) {
    const lines = exercises.filter(e => e.assignmentId === a.id).sort((x, y) => (x.moduleId ?? '').localeCompare(y.moduleId ?? '') || x.order - y.order);
    const amounts = lines.map(worth);
    out.assignments.push({ id: a.id, title: a.title, weight: tidy(amounts.reduce((s, v) => s + v, 0)) });
    const lineShares = lines.length ? shares(amounts) : [];
    lines.forEach((l, i) => out.criteria.push({ id: l.id, assignmentId: a.id, title: l.title, order: i + 1, weight: lineShares[i] }));
  }
  return out;
};
