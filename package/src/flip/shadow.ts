/**
 * Shadow geometry + gradient builder — pure math, no React, no DOM.
 *
 * Ported (with structural / naming changes) from StPageFlip's
 * `Render/CanvasRender.ts` (drawOuterShadow + drawInnerShadow) and
 * `Render/Render.ts` (setShadowData). MIT — reference only, not vendored.
 *
 * The original draws shadows directly onto an HTMLCanvas; here we emit
 * declarative specifications (`ShadowSpec`) that a SVG renderer can map
 * to inline `<linearGradient>` + `<rect>` / `<path>` elements. Keeping
 * the math in this module makes the rendering surface trivial and lets
 * us unit-test the shadow without a real DOM.
 */

import type { FlipDirection, FoldGeometry, Point } from './geometry';

/** A single stop on a linear gradient. Offsets are normalised in `[0, 1]`. */
export interface GradientStop {
  /** Position along the gradient line (0 = start, 1 = end). */
  offset: number;
  /** Per-stop alpha in `[0, 1]` (the colour itself is supplied by the consumer). */
  opacity: number;
}

/**
 * A drop / inner shadow described as a rotated rectangle filled with a
 * 1D linear gradient. The renderer translates `origin`, rotates by
 * `angle`, and fills a rect of `width × height` with a `<linearGradient>`
 * whose `stops` are listed below.
 *
 * All coordinates are page-local (origin = top-left of the book container).
 */
export interface ShadowSpec {
  /** Starting point (top-left of the unrotated shadow rectangle). */
  origin: Point;
  /** Rotation angle in radians applied around `origin`. */
  angle: number;
  /** Rectangle width in px (gradient flows along the X axis after rotation). */
  width: number;
  /** Rectangle height in px — typically `pageHeight * 2` so the shadow extends past the page edges. */
  height: number;
  /** Gradient stops, ordered by `offset` ascending. */
  stops: GradientStop[];
}

/** A pair of computed shadow specs the renderer can lay down per frame. */
export interface ShadowGeometry {
  /**
   * The soft "drop" shadow projected onto the underlying page by the
   * curl above it. Heaviest near the fold, fading away from it.
   * Equivalent to StPageFlip's "outer shadow".
   */
  drop: ShadowSpec | null;
  /**
   * The shadow painted on the back of the curling page itself — this is
   * what gives the curl its 3D feel (dark crease at the apex of the fold).
   * Equivalent to StPageFlip's "inner shadow".
   */
  inner: ShadowSpec | null;
}

/** Inputs to {@link computeShadowGeometry}. */
export interface ShadowInput {
  geo: FoldGeometry;
  pageWidth: number;
  pageHeight: number;
  /**
   * Maximum shadow opacity at the start of the flip (progress = 0).
   * Decays linearly to 0 as `progress → 100`. `[0, 1]`. Defaults to `0.5`.
   */
  maxOpacity?: number;
}

/**
 * Helper for the inner reference test — re-exported so consumers can
 * compute shadow dimensions on their own without re-deriving the formula.
 *
 * Matches StPageFlip's:
 *   `width = (pageWidth * 3 / 4) * (progress / 100)`
 *   `opacity = ((100 - progress) * maxShadowOpacity) / 100`
 *
 * `maxOpacity` is in `[0, 1]` (we don't multiply by 100 like the original
 * does internally — that's an artifact of its settings layer).
 */
export function shadowMetrics(
  progress: number,
  pageWidth: number,
  maxOpacity: number
): { width: number; opacity: number } {
  const clamped = Math.max(0, Math.min(100, progress));
  return {
    width: ((pageWidth * 3) / 4) * (clamped / 100),
    opacity: ((100 - clamped) * maxOpacity) / 100,
  };
}

/**
 * The shadow's origin point is the topmost intersection between the
 * curling page edge and the page borders. For bottom-corner flips it
 * falls back to the side intersect when the top is missing.
 *
 * Mirrors StPageFlip's `FlipCalculation.getShadowStartPoint()`.
 */
function shadowStartPoint(geo: FoldGeometry, corner: 'top' | 'bottom'): Point | null {
  if (corner === 'top') {
    return geo.topIntersect;
  }
  return geo.sideIntersect ?? geo.topIntersect;
}

/**
 * The shadow rotation angle — the angle between the page edge that
 * defines the shadow and the page's top border. Mirrors
 * `FlipCalculation.getShadowAngle()` but operates on the data we already
 * have in `FoldGeometry`.
 *
 * Returns `Math.PI - rawAngle` when the flip direction is `back`, to
 * mirror the rotation onto the left page.
 */
function shadowAngle(
  geo: FoldGeometry,
  corner: 'top' | 'bottom',
  direction: FlipDirection
): number {
  const start = shadowStartPoint(geo, corner);
  const fallback = geo.bottomIntersect ?? geo.topIntersect ?? geo.sideIntersect;
  const end =
    start !== geo.sideIntersect && geo.sideIntersect !== null ? geo.sideIntersect : fallback;

  if (!start || !end) {
    return 0;
  }

  // Angle of the (start → end) segment relative to the X axis.
  const angleToX = Math.atan2(end.y - start.y, end.x - start.x);

  return direction === 'forward' ? angleToX : Math.PI - angleToX;
}

/**
 * Builds the `drop` shadow stops — a simple 2-stop fade.
 * Forward: dense → transparent (the curling page leaves shadow behind it).
 * Back:    transparent → dense (mirrored for the reverse direction).
 */
function dropStops(opacity: number, direction: FlipDirection): GradientStop[] {
  if (direction === 'forward') {
    return [
      { offset: 0, opacity },
      { offset: 1, opacity: 0 },
    ];
  }
  return [
    { offset: 0, opacity: 0 },
    { offset: 1, opacity },
  ];
}

/**
 * Builds the `inner` shadow stops — a 4-stop crease curve that darkens
 * the back of the curling page. Matches the canvas gradient in
 * `drawInnerShadow` (forward branch) and its mirror (back branch).
 */
function innerStops(opacity: number, direction: FlipDirection): GradientStop[] {
  if (direction === 'forward') {
    return [
      { offset: 0, opacity: 0 },
      { offset: 0.7, opacity },
      { offset: 0.9, opacity: 0.05 },
      { offset: 1, opacity },
    ];
  }
  return [
    { offset: 0, opacity },
    { offset: 0.1, opacity: 0.05 },
    { offset: 0.3, opacity },
    { offset: 1, opacity: 0 },
  ];
}

/**
 * Computes both shadow specs from the current fold geometry. Returns
 * `{ drop: null, inner: null }` when no shadow should be drawn (e.g. the
 * cursor is exactly on the spine, or no intersection points are available).
 */
export function computeShadowGeometry(input: ShadowInput): ShadowGeometry {
  const { geo, pageWidth, pageHeight, maxOpacity = 0.5 } = input;

  // We need at least one anchor point and a finite progress; otherwise
  // bail and let the renderer skip the shadow layer entirely.
  const direction: FlipDirection = geo.angle <= 0 ? 'forward' : 'back';
  const corner: 'top' | 'bottom' = geo.angle >= 0 ? 'top' : 'bottom';
  // ↑ The `corner` derivation is a small heuristic for now — the consumer
  // will pass the actual corner from the drag controller in a follow-up
  // pass; here we use the rotation sign as a stand-in so the function
  // stays pure and self-contained for unit testing.

  const start = shadowStartPoint(geo, corner);
  if (!start) {
    return { drop: null, inner: null };
  }

  const { width, opacity } = shadowMetrics(geo.progress, pageWidth, maxOpacity);
  if (width <= 0 || opacity <= 0) {
    return { drop: null, inner: null };
  }

  // The shadow extends past the page borders so the soft edge never
  // shows a hard cut — height = 2 × pageHeight is enough in practice.
  const height = pageHeight * 2;
  const angle = shadowAngle(geo, corner, direction);

  // Origin tweak per direction: for `back`, the canvas implementation
  // translates by `-shadow.width` so the gradient flows from the spine
  // toward the user's grabbed corner. We bake that offset into `origin`.
  const origin =
    direction === 'forward'
      ? { ...start }
      : { x: start.x - width * Math.cos(angle), y: start.y - width * Math.sin(angle) };

  const drop: ShadowSpec = {
    origin,
    angle,
    width,
    height,
    stops: dropStops(opacity, direction),
  };

  // Inner shadow is narrower (3/4 of the drop width — matches StPageFlip).
  const innerWidth = (width * 3) / 4;
  const inner: ShadowSpec = {
    origin: { ...origin },
    angle,
    width: innerWidth,
    height,
    stops: innerStops(opacity, direction),
  };

  return { drop, inner };
}

/**
 * Convenience: turn a {@link ShadowSpec} into the four attributes an SVG
 * `<linearGradient>` needs (`x1` `y1` `x2` `y2`) plus a CSS `transform`
 * for the parent `<g>`. Coordinates are in user-space (px); the consumer
 * applies them verbatim.
 *
 * @example
 *   const spec = computeShadowGeometry({ … }).drop!;
 *   const svg = svgLinearGradientAttrs(spec);
 *   // <linearGradient x1={svg.x1} y1={svg.y1} x2={svg.x2} y2={svg.y2}>…</linearGradient>
 *   // wrap in <g transform={svg.transform}> for rotation + translation
 */
export function svgLinearGradientAttrs(spec: ShadowSpec): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  transform: string;
} {
  return {
    x1: 0,
    y1: 0,
    x2: spec.width,
    y2: 0,
    transform: `translate(${spec.origin.x.toFixed(3)} ${spec.origin.y.toFixed(3)}) rotate(${((spec.angle * 180) / Math.PI).toFixed(3)})`,
  };
}
