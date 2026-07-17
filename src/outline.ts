// Outline lines are admin-entered text where lessons may be written as
// "**Lesson 1:** Title" or "1. Title", and their sub-topics as "- item"
// lines. Group each lesson with the sub-topics that follow it.
export const groupOutline = (outline: string[]): { title: string; items: string[] }[] => {
  const groups: { title: string; items: string[] }[] = [];
  for (const raw of outline) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-•]/.test(line) && groups.length > 0) {
      groups[groups.length - 1].items.push(line.replace(/^[-•]\s*/, ''));
    } else {
      const title = line
        .replace(/^[-•]\s*/, '')
        .replace(/^\*\*.*?\*\*:?\s*/, '')
        .replace(/^\d+\.\s*/, '');
      groups.push({ title, items: [] });
    }
  }
  return groups;
};
