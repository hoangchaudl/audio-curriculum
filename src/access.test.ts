import { describe, expect, it } from 'vitest';
import { reviewsOnly } from './access';

describe('reviewsOnly', () => {
  it('limits reviewers and engineers to the review queue, not trainees or admins', () => {
    expect(reviewsOnly('reviewer')).toBe(true);
    expect(reviewsOnly('audio_engineer')).toBe(true);
    expect(reviewsOnly('sound_designer')).toBe(false);
    expect(reviewsOnly('admin')).toBe(false);
    expect(reviewsOnly(undefined)).toBe(false);
  });
});
