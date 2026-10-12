import { describe, expect, it } from 'vitest';
import { parseQuizCsv, quizSummary } from './quizCsv';
import { Module, ProgramOutline } from '../types';

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

  it('summarises a trainee\'s quiz results in outline order, including quizzes not taken', () => {
    const quiz = (id: string) => ({ id, type: 'quiz' as const, title: '', questions: [] });
    const modules: Module[] = [
      { id: 'q1', order: 1, title: 'Quiz 1', description: '', quiz: true, contentBlocks: [quiz('b1')] },
      { id: 'l1', order: 2, title: 'Lesson', description: '', contentBlocks: [quiz('b2')] },
      { id: 'q2', order: 3, title: 'Quiz 2', description: '', quiz: true, contentBlocks: [quiz('b3')] },
    ];
    const outline = { id: 'current', weeks: [{ id: 'w1', title: 'Week 1', items: [
      { id: 'i1', kind: 'content', moduleId: 'q2' }, { id: 'i2', kind: 'content', moduleId: 'l1' }, { id: 'i3', kind: 'content', moduleId: 'q1' },
    ] }] } as ProgramOutline;
    const at = (n: number) => `2026-01-0${n}T00:00:00Z`;
    const attempts = [
      { id: 'a', traineeId: 't', moduleId: 'q1', blockId: 'b1', score: 8, total: 10, at: at(1) },
      { id: 'b', traineeId: 't', moduleId: 'q1', blockId: 'b1', score: 5, total: 10, at: at(2) },
      { id: 'c', traineeId: 'other', moduleId: 'q2', blockId: 'b3', score: 1, total: 1, at: at(1) },
    ];
    expect(quizSummary(outline, modules, attempts, 't')).toEqual([
      { key: 'q2|b3', moduleId: 'q2', blockId: 'b3', title: 'Quiz 2', attempts: 0, best: undefined, last: undefined },
      { key: 'q1|b1', moduleId: 'q1', blockId: 'b1', title: 'Quiz 1', attempts: 2, best: { score: 8, total: 10 }, last: { score: 5, total: 10 } },
    ]);
  });
});
