import {
  classifyGesture,
  computeReleaseVelocity,
  pruneSampleWindow,
  type DragSample,
} from './drag';

describe('computeReleaseVelocity', () => {
  it('returns zero velocity for fewer than two samples', () => {
    expect(computeReleaseVelocity([])).toEqual({ x: 0, y: 0 });
    expect(computeReleaseVelocity([{ t: 0, x: 0, y: 0 }])).toEqual({ x: 0, y: 0 });
  });

  it('averages over the whole sample range', () => {
    const samples: DragSample[] = [
      { t: 0, x: 0, y: 0 },
      { t: 30, x: 30, y: 15 },
      { t: 60, x: 60, y: 30 },
    ];
    const v = computeReleaseVelocity(samples);
    expect(v.x).toBeCloseTo(1); // 60 px / 60 ms
    expect(v.y).toBeCloseTo(0.5); // 30 px / 60 ms
  });

  it('reports negative components for reverse motion', () => {
    const samples: DragSample[] = [
      { t: 0, x: 100, y: 100 },
      { t: 50, x: 0, y: 0 },
    ];
    const v = computeReleaseVelocity(samples);
    expect(v.x).toBeCloseTo(-2);
    expect(v.y).toBeCloseTo(-2);
  });
});

describe('pruneSampleWindow', () => {
  it('keeps samples within the window', () => {
    const now = 100;
    const samples: DragSample[] = [
      { t: 0, x: 0, y: 0 },
      { t: 50, x: 50, y: 50 },
      { t: 90, x: 90, y: 90 },
    ];
    const pruned = pruneSampleWindow(samples, now, 60);
    // 0 is out of (100 - 60 = 40), 50 + 90 stay.
    expect(pruned).toHaveLength(2);
    expect(pruned[0].t).toBe(50);
  });

  it('always keeps the last two samples', () => {
    const samples: DragSample[] = [
      { t: 0, x: 0, y: 0 },
      { t: 1, x: 1, y: 1 },
    ];
    expect(pruneSampleWindow(samples, 1000, 60)).toHaveLength(2);
  });

  it('returns the same array when nothing is dropped', () => {
    const samples: DragSample[] = [
      { t: 100, x: 0, y: 0 },
      { t: 120, x: 5, y: 5 },
      { t: 140, x: 10, y: 10 },
    ];
    expect(pruneSampleWindow(samples, 150, 60)).toEqual(samples);
  });
});

describe('classifyGesture', () => {
  const swipeDistance = 30;
  const swipeTimeThreshold = 250;

  it('returns "click" for a tap with little movement', () => {
    expect(
      classifyGesture({
        delta: { x: 2, y: 1 },
        duration: 80,
        swipeDistance,
        swipeTimeThreshold,
      })
    ).toBe('click');
  });

  it('returns "swipe" for a fast, decisive horizontal motion', () => {
    expect(
      classifyGesture({
        delta: { x: 120, y: 5 },
        duration: 180,
        swipeDistance,
        swipeTimeThreshold,
      })
    ).toBe('swipe');
  });

  it('returns "drag" for a slow but long motion', () => {
    expect(
      classifyGesture({
        delta: { x: 200, y: 50 },
        duration: 1200,
        swipeDistance,
        swipeTimeThreshold,
      })
    ).toBe('drag');
  });

  it('treats short hover-near-corner as "click"', () => {
    expect(
      classifyGesture({
        delta: { x: 1, y: -3 },
        duration: 50,
        swipeDistance,
        swipeTimeThreshold,
      })
    ).toBe('click');
  });
});
