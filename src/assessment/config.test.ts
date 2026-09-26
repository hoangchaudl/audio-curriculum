import { describe, expect, it } from 'vitest';
import { parseSetting } from './config';

describe('grading settings input', () => {
  it('accepts numbers in range, rejects blank, junk and out-of-range values', () => {
    expect(parseSetting('3.5', 1, 5)).toBe(3.5);
    expect(parseSetting(' 4 ', 1, 5)).toBe(4);
    expect(parseSetting('', 1, 5)).toBeNull(); // must never become 0
    expect(parseSetting('  ', 1, 5)).toBeNull();
    expect(parseSetting('abc', 1, 5)).toBeNull();
    expect(parseSetting('0', 1, 5)).toBeNull();
    expect(parseSetting('5.1', 1, 5)).toBeNull();
    expect(parseSetting('0', 0, 100)).toBe(0); // a 0% stage weight is valid
  });
});
