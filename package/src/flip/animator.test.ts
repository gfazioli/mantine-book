import { easeInOutCubic, easeOutCubic, linear } from './animator';

describe('linear easing', () => {
  it('returns t unchanged', () => {
    expect(linear(0)).toBe(0);
    expect(linear(0.5)).toBe(0.5);
    expect(linear(1)).toBe(1);
  });
});

describe('easeOutCubic easing', () => {
  it('maps boundaries correctly', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('decelerates near the end (eased > raw beyond the start)', () => {
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.25);
    expect(easeOutCubic(0.75)).toBeGreaterThan(0.75);
  });
});

describe('easeInOutCubic easing', () => {
  it('maps boundaries correctly', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it('is symmetric around t = 0.5', () => {
    const a = easeInOutCubic(0.3);
    const b = easeInOutCubic(0.7);
    // Symmetric S-curve: f(0.3) + f(0.7) ≈ 1
    expect(a + b).toBeCloseTo(1, 3);
  });

  it('crosses 0.5 exactly at t = 0.5', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
});
