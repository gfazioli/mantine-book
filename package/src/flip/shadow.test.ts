import { computeFold, type FoldInput } from './geometry';
import { computeShadowGeometry, shadowMetrics, svgLinearGradientAttrs } from './shadow';

const PAGE_WIDTH = 400;
const PAGE_HEIGHT = 600;

function basicFold(overrides: Partial<FoldInput> = {}) {
  return computeFold({
    cursor: { x: 100, y: 200 },
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    corner: 'top',
    direction: 'forward',
    ...overrides,
  });
}

describe('shadowMetrics', () => {
  it('returns zero width at progress = 0', () => {
    const { width, opacity } = shadowMetrics(0, PAGE_WIDTH, 0.5);
    expect(width).toBe(0);
    expect(opacity).toBeCloseTo(0.5);
  });

  it('returns 3/4 of pageWidth at progress = 100', () => {
    const { width, opacity } = shadowMetrics(100, PAGE_WIDTH, 0.5);
    expect(width).toBeCloseTo(PAGE_WIDTH * 0.75);
    expect(opacity).toBe(0);
  });

  it('decays opacity linearly as progress grows', () => {
    const a = shadowMetrics(25, PAGE_WIDTH, 0.4).opacity;
    const b = shadowMetrics(75, PAGE_WIDTH, 0.4).opacity;
    expect(a).toBeCloseTo(0.3);
    expect(b).toBeCloseTo(0.1);
  });

  it('clamps progress outside [0, 100]', () => {
    expect(shadowMetrics(-50, PAGE_WIDTH, 0.5).width).toBe(0);
    expect(shadowMetrics(200, PAGE_WIDTH, 0.5).width).toBeCloseTo(PAGE_WIDTH * 0.75);
  });
});

describe('computeShadowGeometry', () => {
  it('returns both drop and inner specs mid-flip', () => {
    const geo = basicFold();
    const shadows = computeShadowGeometry({ geo, pageWidth: PAGE_WIDTH, pageHeight: PAGE_HEIGHT });
    expect(shadows.drop).not.toBeNull();
    expect(shadows.inner).not.toBeNull();
  });

  it('inner shadow is 3/4 the width of the drop shadow', () => {
    const geo = basicFold();
    const { drop, inner } = computeShadowGeometry({
      geo,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
    });
    expect(drop).not.toBeNull();
    expect(inner).not.toBeNull();
    expect(inner!.width).toBeCloseTo((drop!.width * 3) / 4);
  });

  it('shadow height extends past the page (≥ 2 × pageHeight)', () => {
    const geo = basicFold();
    const { drop } = computeShadowGeometry({
      geo,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
    });
    expect(drop!.height).toBeGreaterThanOrEqual(PAGE_HEIGHT * 2);
  });

  it('produces a 4-stop curve for the inner shadow (forward)', () => {
    const geo = basicFold();
    const { inner } = computeShadowGeometry({
      geo,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
    });
    expect(inner!.stops).toHaveLength(4);
    expect(inner!.stops[0].opacity).toBe(0);
  });

  it('produces a 2-stop fade for the drop shadow', () => {
    const geo = basicFold();
    const { drop } = computeShadowGeometry({
      geo,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
    });
    expect(drop!.stops).toHaveLength(2);
  });

  it('produces a non-degenerate shadow even very close to the corner (progress > 0)', () => {
    // computeFold always emits a non-zero progress for any valid cursor,
    // so the shadow layer is non-null as soon as the flip starts.
    const geo = computeFold({
      cursor: { x: PAGE_WIDTH - 2, y: 1 },
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      corner: 'top',
      direction: 'forward',
    });
    expect(geo.progress).toBeGreaterThan(0);
    const shadows = computeShadowGeometry({
      geo,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
    });
    expect(shadows.drop?.width).toBeGreaterThan(0);
  });

  it('returns nulls when maxOpacity is 0 (shadow disabled)', () => {
    const geo = basicFold();
    const shadows = computeShadowGeometry({
      geo,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      maxOpacity: 0,
    });
    expect(shadows.drop).toBeNull();
    expect(shadows.inner).toBeNull();
  });
});

describe('svgLinearGradientAttrs', () => {
  it('maps a ShadowSpec to SVG <linearGradient> attributes', () => {
    const geo = basicFold();
    const { drop } = computeShadowGeometry({
      geo,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
    });
    const attrs = svgLinearGradientAttrs(drop!);
    expect(attrs.x1).toBe(0);
    expect(attrs.y1).toBe(0);
    expect(attrs.x2).toBeCloseTo(drop!.width);
    expect(attrs.y2).toBe(0);
    expect(attrs.transform).toMatch(/^translate\(/);
    expect(attrs.transform).toMatch(/rotate\(/);
  });
});
