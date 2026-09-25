import { describe, expect, it } from 'vitest';
import { clipAction, clipFields, clipLabel, clipProblem, formatClipTime, parseClipTime } from './videoClip';

describe('video clips', () => {
  it('stops at the clip end (even when dragged past) and jumps back before the start', () => {
    expect(clipAction(70, 0, 70)).toBe('finish');
    expect(clipAction(300, 0, 70)).toBe('finish');
    expect(clipAction(35, 0, 70)).toBeNull();
    expect(clipAction(10, 60, 90)).toBe('toStart');
    expect(clipAction(59.5, 60, 90)).toBeNull();
    expect(clipAction(500)).toBeNull();
  });

  it('parses and formats times', () => {
    expect(parseClipTime('12:30')).toBe(750);
    expect(parseClipTime('1:02:03')).toBe(3723);
    expect(parseClipTime('90')).toBe(90);
    expect(parseClipTime(' ')).toBeUndefined();
    expect(parseClipTime('12m')).toBeNaN();
    expect(formatClipTime(750)).toBe('12:30');
    expect(formatClipTime(3723)).toBe('1:02:03');
  });
  it('validates, stores only set keys, and labels the clip for admins', () => {
    expect(clipProblem(750, 600)).toBe('End must be after start');
    expect(clipProblem(NaN, undefined)).toMatch(/minutes:seconds/);
    expect(clipProblem(750, 1080)).toBeNull();
    expect(clipFields(undefined, 1080)).toEqual({ end: 1080 });
    expect(clipLabel(750, 1080)).toBe('Watch 12:30 – 18:00 (5 min 30 s)');
    expect(clipLabel()).toBeNull();
  });
});
