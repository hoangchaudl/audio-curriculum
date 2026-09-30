import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSESSMENT_CONFIG, DEFAULT_ASSIGNMENTS, DEFAULT_CRITERIA } from './config';
import { reportRows, toCsv } from './report';

describe('batch report CSV', () => {
  it('quotes commas, quotes and newlines, and defuses formulas', () => {
    expect(toCsv([['a,b', 'say "hi"', 'x\ny', '=HYPERLINK("evil")', '-1', 3.5, null]]))
      .toBe('"a,b","say ""hi""","x\ny","\'=HYPERLINK(""evil"")",\'-1,3.5,');
  });
  it('one row per trainee under a header, with a Week 4 decision\'s frozen scores', () => {
    const designer = { id: 't', name: 'Lan', email: 'lan@story.co', role: 'sound_designer' as const, createdAt: '' };
    const data = { config: DEFAULT_ASSESSMENT_CONFIG, assignments: DEFAULT_ASSIGNMENTS, exercises: DEFAULT_CRITERIA, enrollment: undefined, submissions: [], reviews: [] };
    const outcome = { id: 't', decision: 'offered' as const, decidedAt: '2026-10-20T09:00:00Z', snapshot: {
      final: 3.9, meetsBenchmark: true, passThreshold: 3.5,
      stages: [{ key: 'episodeA' as const, weight: 20, value: 4 }, { key: 'episodeB' as const, weight: 25, value: 3.8 }, { key: 'pod' as const, weight: 40, value: 3.9 }] } };
    const [header, row] = reportRows([{ designer, status: 'Passed probation', standing: null, data, outcome, progress: null }], false);
    const col = (name: string) => row[header.indexOf(name)];
    expect(header.length).toBe(row.length);
    expect([col('Name'), col('Episode B'), col('Final (or so far)'), col('Meets benchmark'), col('Offer decision'), col('Decided on')])
      .toEqual(['Lan', '3.80', '3.90', 'Yes', 'Offered', '2026-10-20']);
    expect(header).toContain('Dialogue Import, Sync & Leveling – Pod Trial');
  });
});
