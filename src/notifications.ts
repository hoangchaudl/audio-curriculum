const KEY_PREFIX = 'audio-academy:seen-grades:';

// Tracks which graded modules a designer has already opened, purely
// client-side (localStorage) - lets the sidebar surface "you have unseen
// feedback" without a new Firestore field or write path. Best-effort: a
// failed read/write just means the badge may reappear, never crashes.
const readSeen = (userId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

export const markGradeSeen = (userId: string, moduleId: string): void => {
  const seen = readSeen(userId);
  if (seen.has(moduleId)) return;
  seen.add(moduleId);
  try {
    localStorage.setItem(KEY_PREFIX + userId, JSON.stringify([...seen]));
  } catch {
    // Best-effort only.
  }
};

export const isGradeSeen = (userId: string, moduleId: string): boolean => readSeen(userId).has(moduleId);

export const countUnseenGrades = (userId: string, gradedModuleIds: string[]): number => {
  const seen = readSeen(userId);
  return gradedModuleIds.filter(id => !seen.has(id)).length;
};
