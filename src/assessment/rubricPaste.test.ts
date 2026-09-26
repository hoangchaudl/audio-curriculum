import { describe, expect, it } from 'vitest';
import { parseRubricRows, tsvRows, withVietnamese } from './rubricPaste';

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

describe('Vietnamese version of a rubric', () => {
  const criteria = [
    { id: 'c1', title: 'Workflow', levels: ['a', 'b', 'c', 'd', 'e'] },
    { id: 'c2', title: 'Dialogue', levels: ['a', 'b', 'c', 'd', 'e'] },
  ];
  const vi = (titles: string[]) => ({ criteria: titles.map(t => ({ title: t, levels: ['1', '2', '3', '4', '5'], outcome: 'ILO' })), bands: ['Trượt', 'Đạt thấp', 'Đạt', 'Khá', 'Giỏi'] });
  it('attaches the Vietnamese text row by row, keeping ids and English text', () => {
    const out = withVietnamese(criteria, vi(['Quy trình làm việc', 'Lời thoại']))!;
    expect(out.map(c => [c.id, c.title, c.vi?.title])).toEqual([['c1', 'Workflow', 'Quy trình làm việc'], ['c2', 'Dialogue', 'Lời thoại']]);
    expect(out[0].vi).toEqual({ title: 'Quy trình làm việc', levels: ['1', '2', '3', '4', '5'], outcome: 'ILO' });
  });
  it('refuses a table with a different number of rows', () => {
    expect(withVietnamese(criteria, vi(['Chỉ một dòng']))).toBeNull();
  });
});
