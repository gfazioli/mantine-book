import {
  clampReflectionTarget,
  computeFoldShadow,
  computeReflectionFold,
  type Point,
  pointsToCssPolygon,
  shouldCompleteFold,
  turnAnchorY,
  turnTargetY,
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

  // Regression: at a full turn the crease passes through the spine (mid.x = 0).
  // A spine-midpoint reference used to sit exactly on the crease, so both layers
  // kept the same half and flatFront/flap became the SAME full-page polygon.
  it('does not collapse flatFront and flap onto the same half at a full turn', () => {
    const fold = computeReflectionFold(midEdge, { x: -W, y: H / 2 }, W, H)!;
    // The whole sheet is lifted → flap is the full page…
    expect(fold.flap.length).toBeGreaterThanOrEqual(4);
    // …and the flat region must NOT be that same polygon.
    expect(JSON.stringify(fold.flatFront)).not.toBe(JSON.stringify(fold.flap));
  });
});

describe('shouldCompleteFold', () => {
  const W = 400;

  it('completes past the threshold regardless of the swipe', () => {
    expect(shouldCompleteFold(60, 40, false, 0, W)).toBe(true);
    expect(shouldCompleteFold(20, 40, false, 0, W)).toBe(false);
  });

  // Regression: a fast swipe toward the spine must complete on BOTH sides.
  it('completes a fast swipe toward the spine — side-aware', () => {
    // Resting on the right (anchorX > 0): a leftward swipe (vx < 0) completes;
    // a rightward swipe (away from the spine) does not.
    expect(shouldCompleteFold(5, 40, true, -1, W)).toBe(true);
    expect(shouldCompleteFold(5, 40, true, 1, W)).toBe(false);
    // Flipped to the left (anchorX < 0): a RIGHTWARD swipe (vx > 0) completes;
    // a leftward swipe (away from the spine) does not.
    expect(shouldCompleteFold(5, 40, true, 1, -W)).toBe(true);
    expect(shouldCompleteFold(5, 40, true, -1, -W)).toBe(false);
  });

  it('ignores the velocity when the gesture is not a swipe', () => {
    expect(shouldCompleteFold(5, 40, false, -1, W)).toBe(false);
  });
});

describe('computeFoldShadow', () => {
  const midEdge: Point = { x: W, y: H / 2 };
  const shadowAt = (px: number) =>
    computeFoldShadow(computeReflectionFold(midEdge, { x: px, y: H / 2 }, W, H)!, W);

  it('returns a reflected flap polygon and a crease-anchored gradient', () => {
    const sh = shadowAt(0); // dragged to the spine
    expect(sh.flapPolygon.length).toBeGreaterThanOrEqual(3);
    // The gradient starts AT the crease midpoint…
    const fold = computeReflectionFold(midEdge, { x: 0, y: H / 2 }, W, H)!;
    expect(sh.gradient.x1).toBeCloseTo(fold.creaseMid.x, 3);
    expect(sh.gradient.y1).toBeCloseTo(fold.creaseMid.y, 3);
    // …and extends a non-degenerate distance into the flap.
    expect(
      Math.hypot(sh.gradient.x2 - sh.gradient.x1, sh.gradient.y2 - sh.gradient.y1)
    ).toBeGreaterThan(1);
  });

  it('strength peaks mid-fold and vanishes at rest and at a full turn', () => {
    expect(shadowAt(W - 4).strength).toBeLessThan(0.1); // near rest
    expect(shadowAt(0).strength).toBeGreaterThan(0.9); // at the spine (~50%)
    expect(shadowAt(-W).strength).toBeLessThan(0.1); // full turn
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

describe('turnOrigin math (programmatic turns)', () => {
  it('anchors the simulated grab on the requested edge point', () => {
    expect(turnAnchorY('top', H)).toBe(0);
    expect(turnAnchorY('middle', H)).toBe(H / 2);
    expect(turnAnchorY('bottom', H)).toBe(H);
  });

  it('starts and lands the target exactly on the anchor edge (no pop)', () => {
    for (const origin of ['top', 'middle', 'bottom'] as const) {
      expect(turnTargetY(origin, 0, H)).toBe(turnAnchorY(origin, H));
      expect(turnTargetY(origin, 1, H)).toBeCloseTo(turnAnchorY(origin, H), 10);
    }
  });

  it('corner grabs arc to the page middle at half-turn; a middle grab stays straight', () => {
    expect(turnTargetY('top', 0.5, H)).toBeCloseTo(H / 2);
    expect(turnTargetY('bottom', 0.5, H)).toBeCloseTo(H / 2);
    for (const t of [0, 0.2, 0.5, 0.8, 1]) {
      expect(turnTargetY('middle', t, H)).toBe(H / 2);
    }
  });

  it('top and bottom arcs are mirror images: their Ys always sum to H', () => {
    for (const t of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
      expect(turnTargetY('top', t, H) + turnTargetY('bottom', t, H)).toBeCloseTo(H, 10);
    }
  });

  it('the arc is monotone toward the middle and never overshoots it', () => {
    let prev = turnTargetY('bottom', 0, H);
    for (const t of [0.1, 0.2, 0.3, 0.4, 0.5]) {
      const y = turnTargetY('bottom', t, H);
      expect(y).toBeLessThanOrEqual(prev); // descending toward H/2
      expect(y).toBeGreaterThanOrEqual(H / 2); // never past the middle
      prev = y;
    }
  });

  it('clamps an out-of-range eased value instead of arcing past the edge', () => {
    expect(turnTargetY('bottom', -0.5, H)).toBe(H); // sin(0) is exact
    expect(turnTargetY('bottom', 1.5, H)).toBeCloseTo(H, 10); // sin(π) ~ 1e-16
    expect(turnTargetY('top', 2, H)).toBeCloseTo(0, 10);
  });
});
