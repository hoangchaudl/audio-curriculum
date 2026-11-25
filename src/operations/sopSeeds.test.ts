import { describe, expect, it } from 'vitest';
import { SOP_SEEDS, seedFields } from './sopSeeds';
import { validateDraft, draftOf } from './model';

describe('SOP seeds', () => {
  it('every seed passes validation', () => {
    for (const s of SOP_SEEDS) expect(validateDraft('sop', draftOf({ ...seedFields(s), id: 'x' } as never))).toEqual([]);
  });
});
