import { QuizQuestion } from '../types';
import { tsvRows } from './rubricPaste';

// Quiz questions from CSV (e.g. written by an AI with QUIZ_AI_PROMPT), one
// question per row: question, option A-D (blank if fewer), answer, explanation.
// answer = letter(s): "B", or "A;C" for pick-all-that-apply. A header row is
// skipped. Comma, semicolon (Excel in Vietnamese) or tab separated.

export const QUIZ_AI_PROMPT = `Write a multiple-choice quiz about the lesson below as CSV.
Columns, with this header row exactly:
question,option_a,option_b,option_c,option_d,answer,explanation
- 2 to 4 options per question; leave unused option columns empty.
- answer = the letter of the correct option (e.g. B). If several are correct, join them with ; (e.g. A;C).
- explanation = one short sentence on why the answer is right.
- Wrap any cell containing a comma in double quotes.
- Output only the CSV, no other text.

Lesson:
`;

const pickSep = (text: string) => {
  const first = text.split(/\r?\n/, 1)[0];
  return [',', ';', '\t'].map(sep => ({ sep, n: first.split(sep).length })).sort((a, b) => b.n - a.n)[0].sep;
};

export const parseQuizCsv = (text: string): { questions: QuizQuestion[]; errors: string[] } => {
  const body = text.trim().replace(/^```\w*\n?|```$/g, '').trim(); // AIs often wrap CSV in a code fence
  const rows = tsvRows(body, pickSep(body));
  const questions: QuizQuestion[] = [];
  const errors: string[] = [];
  rows.forEach((raw, i) => {
    const r = raw.map(c => c.trim());
    if (i === 0 && /question|câu hỏi/i.test(r[0])) return;
    const row = `Row ${i + 1}`;
    const [q, a, b, c, d, answer = '', explain = ''] = r;
    const options = [a, b, c, d].map(o => o ?? '');
    const letters = answer.toUpperCase().match(/[A-D]/g) ?? [];
    const correct = [...new Set(letters.map(l => l.charCodeAt(0) - 65))].sort();
    if (!q) return errors.push(`${row}: no question`);
    if (options.filter(Boolean).length < 2) return errors.push(`${row}: needs at least 2 options`);
    if (!correct.length || correct.some(k => !options[k])) return errors.push(`${row}: answer "${answer}" doesn't match a filled option`);
    // Drop blank options, re-pointing the answers at the remaining ones.
    const kept = options.flatMap((o, k) => (o ? [k] : []));
    questions.push({ q, options: kept.map(k => options[k]), correct: correct.map(k => kept.indexOf(k)), ...(explain ? { explain } : {}) });
  });
  return { questions, errors };
};
