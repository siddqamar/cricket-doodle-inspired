import { describe, expect, it } from 'vitest';
import {
  clamp,
  dist,
  easeInOutQuad,
  easeOutCubic,
  lerp,
  smoothstep,
} from './math';

describe('clamp', () => {
  it('returns value inside range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps below min', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('clamps above max', () => {
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('lerp', () => {
  it('returns start at t=0', () => {
    expect(lerp(2, 8, 0)).toBe(2);
  });

  it('returns end at t=1', () => {
    expect(lerp(2, 8, 1)).toBe(8);
  });

  it('interpolates midpoint', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe('easing', () => {
  it('easeOutCubic is 0 at 0 and 1 at 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('easeInOutQuad is symmetric at ends', () => {
    expect(easeInOutQuad(0)).toBe(0);
    expect(easeInOutQuad(1)).toBe(1);
    expect(easeInOutQuad(0.5)).toBeCloseTo(0.5, 5);
  });
});

describe('dist', () => {
  it('computes Euclidean distance', () => {
    expect(dist(0, 0, 3, 4)).toBe(5);
  });
});

describe('smoothstep', () => {
  it('is 0 below edge0 and 1 above edge1', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it('is 0.5 at midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 5);
  });
});
