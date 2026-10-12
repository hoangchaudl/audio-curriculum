import { describe, expect, it } from 'vitest';
import { parseQuizCsv } from './quizCsv';

describe('quiz CSV import', () => {
  it('reads AI-style CSV with a header, quoted commas, blank options and multi answers', () => {
    const csv = [
      'question,option_a,option_b,option_c,option_d,answer,explanation',
      '"What does a high-pass filter cut?",Highs,Lows,"Mids, mostly",,B,"It removes frequencies below the cutoff."',
      'Pick the dynamics tools,Compressor,Reverb,Limiter,EQ,A;C,',
    ].join('\n');
    expect(parseQuizCsv(csv)).toEqual({
      errors: [],
      questions: [
        { q: 'What does a high-pass filter cut?', options: ['Highs', 'Lows', 'Mids, mostly'], correct: [1], explain: 'It removes frequencies below the cutoff.' },
        { q: 'Pick the dynamics tools', options: ['Compressor', 'Reverb', 'Limiter', 'EQ'], correct: [0, 2] },
      ],
    });
  });

  it('handles semicolon CSV, code fences, and re-points answers past blank options', () => {
    const { questions } = parseQuizCsv('```csv\nQ1;Yes;;No;;C;\n```');
    expect(questions).toEqual([{ q: 'Q1', options: ['Yes', 'No'], correct: [1] }]);
  });

  it('skips bad rows and says why', () => {
    const { questions, errors } = parseQuizCsv('Q1,Only one,,,,A,\nQ2,Yes,No,,,D,\nQ3,Yes,No,,,,');
    expect(questions).toEqual([]);
    expect(errors).toEqual([
      'Row 1: needs at least 2 options',
      'Row 2: answer "D" doesn\'t match a filled option',
      'Row 3: answer "" doesn\'t match a filled option',
    ]);
  });
});
