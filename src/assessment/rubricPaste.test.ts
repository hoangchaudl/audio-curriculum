import { describe, expect, it } from 'vitest';
import { parseRubricRows, tsvRows } from './rubricPaste';

const HEADER = ['Assessment Criteria', 'Module ILOs', 'Weighting', 'Fail (<50)', 'Low Pass (50-59)', 'High Pass (55+)', 'Merit (60+)', 'Distinction (70+)'];

describe('pasted rubric tables', () => {
  it('reads criterion, ILO, weighting, five descriptions and the band names', () => {
    const r = parseRubricRows([
      HEADER,
      ['Professional Context', 'Critically evaluate...', '30%', 'Inappropriate', 'Basic', 'Functional', 'Good', 'Highly appropriate'],
      ['Technical', 'Demonstrate foley...', '30%', 'Ineffective', 'Basic use', 'Some artefacts', 'Effective', 'Imperceptible'],
    ]);
    expect(r?.bands).toEqual(HEADER.slice(-5));
    expect(r?.criteria).toEqual([
      { title: 'Professional Context', outcome: 'Critically evaluate...', weight: 30, levels: ['Inappropriate', 'Basic', 'Functional', 'Good', 'Highly appropriate'] },
      { title: 'Technical', outcome: 'Demonstrate foley...', weight: 30, levels: ['Ineffective', 'Basic use', 'Some artefacts', 'Effective', 'Imperceptible'] },
    ]);
  });
  it('works without ILO / weighting columns or a header', () => {
    expect(parseRubricRows([['Mix', 'a', 'b', 'c', 'd', 'e']])).toEqual({ criteria: [{ title: 'Mix', levels: ['a', 'b', 'c', 'd', 'e'] }] });
    expect(parseRubricRows([['just', 'two']])).toBeNull();
  });
  it('splits spreadsheet text, keeping line breaks inside quoted cells', () => {
    expect(tsvRows('A\t"line 1\nline 2"\tC\r\nD\tE\tF\n')).toEqual([['A', 'line 1\nline 2', 'C'], ['D', 'E', 'F']]);
  });
});
