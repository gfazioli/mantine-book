import {
  clampReflectionTarget,
  computeReflectionFold,
  type Point,
  pointsToCssPolygon,
} from './geometry';

const W = 400;
const H = 600;

const SPINE_TOP: Point = { x: 0, y: 0 };
const SPINE_BOTTOM: Point = { x: 0, y: H };
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Apply a CSS matrix [a,b,c,d,e,f] to a point. */
const applyMatrix = (m: readonly number[], p: Point): Point => ({
  x: m[0] * p.x + m[2] * p.y + m[4],
  y: m[1] * p.x + m[3] * p.y + m[5],
});

const yExtent = (poly: Point[]) => {
  const ys = poly.map((p) => p.y);
  return [Math.min(...ys), Math.max(...ys)] as const;
};

describe('clampReflectionTarget', () => {
  const anchor: Point = { x: W, y: 0 };

  it('leaves an in-reach target unchanged', () => {
    const target: Point = { x: 0, y: H / 2 };
    const t = clampReflectionTarget(anchor, target, W, H);
    expect(t.x).toBeCloseTo(target.x, 3);
    expect(t.y).toBeCloseTo(target.y, 3);
  });

  it('clamps a far target within reach of BOTH spine corners (spine stays flat)', () => {
    const t = clampReflectionTarget(anchor, { x: -3000, y: -3000 }, W, H);
    expect(dist(SPINE_TOP, t)).toBeLessThanOrEqual(dist(SPINE_TOP, anchor) + 0.5);
    expect(dist(SPINE_BOTTOM, t)).toBeLessThanOrEqual(dist(SPINE_BOTTOM, anchor) + 0.5);
  });
});

describe('computeReflectionFold', () => {
  const topCorner: Point = { x: W, y: 0 };
  const midEdge: Point = { x: W, y: H / 2 };

  it('returns null at rest (no drag)', () => {
    expect(computeReflectionFold(topCorner, { x: W, y: 0 }, W, H)).toBeNull();
    expect(computeReflectionFold(midEdge, { x: W, y: H / 2 }, W, H)).toBeNull();
  });

  it('returns flatFront and flap polygons mid-fold', () => {
    const fold = computeReflectionFold(topCorner, { x: 0, y: H / 2 }, W, H);
    expect(fold).not.toBeNull();
    expect(fold!.flatFront.length).toBeGreaterThanOrEqual(3);
    expect(fold!.flap.length).toBeGreaterThanOrEqual(3);
  });

  it('the crease reflects the anchor exactly onto the target', () => {
    const target: Point = { x: 0, y: H / 2 }; // in-reach → not clamped
    const fold = computeReflectionFold(topCorner, target, W, H)!;
    const reflected = applyMatrix(fold.matrix, topCorner);
    expect(reflected.x).toBeCloseTo(target.x, 3);
    expect(reflected.y).toBeCloseTo(target.y, 3);
  });

  it('matrix is a reflection (det = −1)', () => {
    const fold = computeReflectionFold(topCorner, { x: 50, y: 250 }, W, H)!;
    const [a, b, c, d] = fold.matrix;
    expect(a * d - c * b).toBeCloseTo(-1, 6);
  });

  it('a mid-edge horizontal drag gives a full-height, near-vertical crease', () => {
    const fold = computeReflectionFold(midEdge, { x: W * 0.4, y: H / 2 }, W, H)!;
    // Crease runs ⟂ to the (horizontal) drag → nearly vertical.
    expect(Math.abs(fold.creaseDir.x)).toBeLessThan(1e-6);
    // The lifted flap spans the full page height.
    const [yMin, yMax] = yExtent(fold.flap);
    expect(yMin).toBeCloseTo(0, 3);
    expect(yMax).toBeCloseTo(H, 3);
  });

  it('progress is ~0 near rest, ~50 at the spine, ~100 at a full turn', () => {
    expect(computeReflectionFold(midEdge, { x: W - 4, y: H / 2 }, W, H)!.progress).toBeLessThan(2);
    expect(computeReflectionFold(midEdge, { x: 0, y: H / 2 }, W, H)!.progress).toBeCloseTo(50, 0);
    expect(computeReflectionFold(midEdge, { x: -W, y: H / 2 }, W, H)!.progress).toBeCloseTo(100, 0);
  });

  it('up vs down drags tilt the crease in opposite directions', () => {
    const up = computeReflectionFold(midEdge, { x: W * 0.4, y: H * 0.2 }, W, H)!;
    const down = computeReflectionFold(midEdge, { x: W * 0.4, y: H * 0.8 }, W, H)!;
    // Vertical drag tilts the crease; the two tilts are mirror-symmetric.
    expect(Math.sign(up.creaseDir.x)).not.toBe(Math.sign(down.creaseDir.x));
    expect(Math.abs(up.creaseDir.x)).toBeCloseTo(Math.abs(down.creaseDir.x), 6);
  });

  it('works on the flipped (left) side: anchor=−W folds toward the right', () => {
    const leftAnchor: Point = { x: -W, y: H / 2 };
    const fold = computeReflectionFold(leftAnchor, { x: -W * 0.4, y: H / 2 }, W, H)!;
    // The flap (anchor side) lives in the left half (x ≤ 0)…
    expect(Math.max(...fold.flap.map((p) => p.x))).toBeLessThanOrEqual(0.001);
    // …and the reflection still maps the anchor onto the target.
    const reflected = applyMatrix(fold.matrix, leftAnchor);
    expect(reflected.x).toBeCloseTo(-W * 0.4, 3);
    expect(reflected.y).toBeCloseTo(H / 2, 3);
  });
});

describe('pointsToCssPolygon', () => {
  it('formats points into a CSS polygon(...) string', () => {
    const css = pointsToCssPolygon([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]);
    expect(css).toMatch(/^polygon\(/);
    expect(css).toMatch(/0\.000px 0\.000px/);
    expect(css).toMatch(/100\.000px 0\.000px/);
    expect(css).toMatch(/50\.000px 100\.000px/);
  });

  it('supports percentage units', () => {
    const css = pointsToCssPolygon(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ],
      '%'
    );
    expect(css).toMatch(/0\.000% 0\.000%/);
  });

  it('returns null for fewer than 3 points (renderer should skip clip-path)', () => {
    expect(pointsToCssPolygon([])).toBeNull();
    expect(pointsToCssPolygon([{ x: 1, y: 1 }])).toBeNull();
    expect(
      pointsToCssPolygon([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ])
    ).toBeNull();
  });
});
