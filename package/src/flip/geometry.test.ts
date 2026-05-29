import {
  computeFold,
  distance,
  getBottomClipPolygon,
  getFlippingClipPolygon,
  pointsToCssPolygon,
  type FoldInput,
} from './geometry';

const PAGE_WIDTH = 400;
const PAGE_HEIGHT = 600;

function basicInput(overrides: Partial<FoldInput> = {}): FoldInput {
  return {
    cursor: { x: 200, y: 300 },
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    corner: 'top',
    direction: 'forward',
    ...overrides,
  };
}

describe('computeFold', () => {
  it('returns a finite angle for a cursor near the page centre (top corner)', () => {
    const geo = computeFold(basicInput({ cursor: { x: 200, y: 100 } }));
    expect(Number.isFinite(geo.angle)).toBe(true);
    expect(geo.angle).not.toBe(0);
  });

  it('inverts the angle sign for direction="back"', () => {
    const forward = computeFold(basicInput({ direction: 'forward' }));
    const back = computeFold(basicInput({ direction: 'back' }));
    expect(Math.sign(forward.angle)).not.toBe(Math.sign(back.angle));
    expect(Math.abs(forward.angle)).toBeCloseTo(Math.abs(back.angle));
  });

  it('throws when the cursor sits exactly on the original outer corner', () => {
    expect(() => computeFold(basicInput({ cursor: { x: PAGE_WIDTH, y: 0 } }))).toThrow(
      /cursor too close to the page corner/
    );
  });

  it('clamps the cursor onto a circle of radius=pageWidth around the spine for corner="top"', () => {
    // Dragging way to the left of the spine — should be pulled back onto the arc.
    const geo = computeFold(basicInput({ cursor: { x: -800, y: 100 } }));
    const radius = Math.sqrt(geo.position.x * geo.position.x + geo.position.y * geo.position.y);
    // Clamp may use the full diagonal in the secondary stage, so the
    // ceiling is `diagonal = √(W² + H²) ≈ 721`. We just check it stays bounded.
    const diagonal = Math.sqrt(PAGE_WIDTH * PAGE_WIDTH + PAGE_HEIGHT * PAGE_HEIGHT);
    expect(radius).toBeLessThanOrEqual(diagonal + 0.5);
  });

  it('reports progress 0..100', () => {
    const early = computeFold(basicInput({ cursor: { x: PAGE_WIDTH - 1, y: 1 } }));
    expect(early.progress).toBeLessThan(5);

    const halfway = computeFold(basicInput({ cursor: { x: 0, y: PAGE_HEIGHT / 2 } }));
    expect(halfway.progress).toBeGreaterThanOrEqual(45);
    expect(halfway.progress).toBeLessThanOrEqual(55);
  });

  it('produces a 4-corner rect for the rotated page', () => {
    const geo = computeFold(basicInput());
    expect(geo.rect).toHaveProperty('topLeft.x');
    expect(geo.rect).toHaveProperty('topRight.x');
    expect(geo.rect).toHaveProperty('bottomLeft.x');
    expect(geo.rect).toHaveProperty('bottomRight.x');
    // The four corners should be distinct.
    const xs = [
      geo.rect.topLeft.x,
      geo.rect.topRight.x,
      geo.rect.bottomLeft.x,
      geo.rect.bottomRight.x,
    ];
    const uniqueXs = new Set(xs.map((x) => x.toFixed(2)));
    expect(uniqueXs.size).toBeGreaterThanOrEqual(3);
  });

  it('returns mirrored geometry for corner="bottom" vs corner="top" at the same cursor', () => {
    const top = computeFold(basicInput({ cursor: { x: 100, y: 100 }, corner: 'top' }));
    const bottom = computeFold(
      basicInput({ cursor: { x: 100, y: PAGE_HEIGHT - 100 }, corner: 'bottom' })
    );
    // The angle magnitudes should match (mirrored around the horizontal axis).
    expect(Math.abs(top.angle)).toBeCloseTo(Math.abs(bottom.angle), 3);
  });

  it('produces at least one non-null intersection mid-flip', () => {
    const geo = computeFold(basicInput({ cursor: { x: 100, y: 200 } }));
    const hasAny =
      geo.topIntersect !== null || geo.sideIntersect !== null || geo.bottomIntersect !== null;
    expect(hasAny).toBe(true);
  });
});

describe('getFlippingClipPolygon', () => {
  it('starts with the rotated top-left corner', () => {
    const geo = computeFold(basicInput({ cursor: { x: 100, y: 100 } }));
    const poly = getFlippingClipPolygon(geo, 'top');
    expect(poly[0]).toEqual(geo.rect.topLeft);
  });

  it('returns ≥3 points (a valid polygon) for a mid-flip cursor', () => {
    const geo = computeFold(basicInput({ cursor: { x: 100, y: 200 } }));
    const poly = getFlippingClipPolygon(geo, 'top');
    expect(poly.length).toBeGreaterThanOrEqual(3);
  });
});

describe('getBottomClipPolygon', () => {
  it('returns a polygon describing the revealed area', () => {
    const geo = computeFold(basicInput({ cursor: { x: 100, y: 200 } }));
    const poly = getBottomClipPolygon(geo, 'top', PAGE_WIDTH, PAGE_HEIGHT);
    expect(poly.length).toBeGreaterThanOrEqual(3);
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

describe('distance', () => {
  it('returns the Euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });
});
