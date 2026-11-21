import { describe, expect, it } from 'vitest';
import { SOP_SEEDS, buildDiagram, seedFields } from './sopSeeds';
import { MAX_DIAGRAM, validateDraft, draftOf } from './model';

describe('SOP seeds', () => {
  it('every seed has a valid diagram within the size cap and passes validation', () => {
    for (const s of SOP_SEEDS) {
      const diagram = buildDiagram(s.nodes);
      expect(JSON.parse(diagram).elements.length).toBeGreaterThan(s.nodes.length);
      expect(diagram.length).toBeLessThan(MAX_DIAGRAM);
      expect(validateDraft('sop', draftOf({ ...seedFields(s), id: 'x' } as never))).toEqual([]);
    }
  });
});
