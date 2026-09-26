import { describe, expect, it } from 'vitest';
import { rubricBand, rubricText } from './ui';

describe('rubric text in English or Vietnamese', () => {
  const row = { title: 'Workflow', outcome: 'Organise a session', levels: ['a', 'b', 'c', 'd', 'e'], vi: { title: 'Quy trình', levels: ['1', '', '3', '4', '5'] } };
  it('uses the Vietnamese text when chosen, English where a part has none', () => {
    const t = rubricText(true, row);
    expect([t.title, t.outcome, t.level(1), t.level(2)]).toEqual(['Quy trình', 'Organise a session', '1', 'b']);
    expect(rubricText(false, row).title).toBe('Workflow');
  });
  it('names scores from the Vietnamese bands, then the English ones, then "Mức n"', () => {
    expect(rubricBand(true, ['Fail'], ['Trượt'], 1)).toBe('Trượt');
    expect(rubricBand(true, ['Fail', 'Pass'], ['Trượt'], 2)).toBe('Pass');
    expect(rubricBand(true, undefined, undefined, 3)).toBe('Mức 3');
    expect(rubricBand(false, undefined, ['Trượt'], 1)).toBe('Score 1');
  });
});
