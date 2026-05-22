/**
 * Page-curl intersection geometry — pure math, no React, no DOM.
 *
 * Algorithm ported (with structural / naming changes) from
 * https://github.com/Nodlik/StPageFlip — `src/Flip/FlipCalculation.ts` (MIT).
 *
 * The original code uses a `class` and stateful `this` mutations; this
 * version is a set of pure functions returning data, which makes the math
 * trivially unit-testable and React-friendly (we'll call it from refs
 * inside a `requestAnimationFrame` loop without owning any state here).
 */

/** A point on the 2D page plane (origin = top-left of the flipping page). */
export interface Point {
  x: number;
  y: number;
}

/**
 * Rotated rectangle representing the flipping page after the curl is
 * applied — each corner is one of the original page's corners after being
 * rotated around the user's cursor position by `angle` radians.
 */
export interface RectPoints {
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
}

/** Axis-aligned bounding rectangle used as clipping limits for segment-vs-segment intersection. */
interface AABB {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A line segment defined by two endpoints. */
export type Segment = [Point, Point];

/**
 * Which corner the user grabbed. Page-turn is always horizontal (the spine
 * runs vertically along x = 0 of the flipping page), so the only meaningful
 * choice is whether the grabbed corner is the top one or the bottom one.
 */
export type FlipCorner = 'top' | 'bottom';

/**
 * Forward = flipping the right page from right to left (next page).
 * Back = flipping the left page from left to right (previous page).
 * The geometry is mirrored for `back`; the consumer is responsible for
 * passing a mirrored cursor and reading the returned angle's sign accordingly.
 */
export type FlipDirection = 'forward' | 'back';

/** Inputs to {@link computeFold}. */
export interface FoldInput {
  /**
   * Cursor position in page-local coordinates: (0, 0) is the top-left of
   * the flipping page; (pageWidth, pageHeight) is its bottom-right corner.
   */
  cursor: Point;
  pageWidth: number;
  pageHeight: number;
  corner: FlipCorner;
  direction: FlipDirection;
}

/** Result of one fold calculation — everything a renderer needs to draw the frame. */
export interface FoldGeometry {
  /**
   * Signed rotation angle in radians applied to the flipping page rectangle.
   * Already flipped for `direction === 'back'` so the consumer just uses it
   * verbatim in a CSS `rotate(...)` transform.
   */
  angle: number;
  /**
   * The corner position after being clamped to the spine circle (so the
   * user can't drag the corner past the spine). Coordinates are the same
   * page-local frame as {@link FoldInput.cursor}.
   */
  position: Point;
  /** The four corners of the page after rotation. */
  rect: RectPoints;
  /** Intersection of the rotating top edge with the page's top border (null when outside). */
  topIntersect: Point | null;
  /** Intersection with the page's right border. */
  sideIntersect: Point | null;
  /** Intersection with the page's bottom border. */
  bottomIntersect: Point | null;
  /** Flip progress in `[0, 100]` — 0 = page still flat, 100 = page fully turned. */
  progress: number;
}

const MIN_CORNER_DISTANCE = 1; // px — below this we treat the cursor as "at the corner" and bail

/**
 * Computes the rotation angle (always positive in this internal step; the
 * caller's `direction` sign is applied later).
 *
 * The original StPageFlip formula:
 *   `angle = 2 * acos(left / sqrt(top² + left²))`
 *
 * Geometric intuition: imagine the cursor at `(cx, cy)` and the *original*
 * (un-rotated) top-right corner at `(pageWidth, 0)`. The flipping page
 * pivots around the cursor; the rotation angle that brings the original
 * top-right onto the active corner is twice the angle of the isoceles
 * triangle (cursor, original corner, mirrored corner).
 */
function computeAngle(
  cursor: Point,
  pageWidth: number,
  pageHeight: number,
  corner: FlipCorner
): number {
  // `+ 1` matches the original — avoids a singularity when the cursor is
  // exactly on the right edge.
  const left = pageWidth - cursor.x + 1;
  const top = corner === 'bottom' ? pageHeight - cursor.y : cursor.y;

  let angle = 2 * Math.acos(left / Math.sqrt(top * top + left * left));
  if (top < 0) {
    angle = -angle;
  }

  // The page becomes degenerate (zero area) as the angle approaches π.
  const remainder = Math.PI - angle;
  if (!Number.isFinite(angle) || (remainder >= 0 && remainder < 0.003)) {
    throw new Error('mantine-book: cursor too close to the spine — fold degenerate');
  }

  return corner === 'bottom' ? -angle : angle;
}

/**
 * Rotates a single point around `pivot` by the current `angle` (radians).
 * Uses the standard 2D rotation matrix; matches the original's
 * `getRotatedPoint`.
 */
function rotatePoint(point: Point, pivot: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos + point.y * sin + pivot.x,
    y: point.y * cos - point.x * sin + pivot.y,
  };
}

/**
 * Builds the rotated rectangle of the flipping page given the cursor and
 * the angle.
 *
 * For `corner === 'top'`, the original (un-rotated) rectangle has corners
 *   (0, 0)            (pageWidth, 0)
 *   (0, pageHeight)   (pageWidth, pageHeight)
 *
 * For `corner === 'bottom'`, we shift it up by `pageHeight` so the bottom
 * edge sits on `y = 0` and the rotation pivots around the grabbed corner
 * naturally.
 */
function getPageRect(
  cursor: Point,
  angle: number,
  pageWidth: number,
  pageHeight: number,
  corner: FlipCorner
): RectPoints {
  const base: [Point, Point, Point, Point] =
    corner === 'top'
      ? [
          { x: 0, y: 0 },
          { x: pageWidth, y: 0 },
          { x: 0, y: pageHeight },
          { x: pageWidth, y: pageHeight },
        ]
      : [
          { x: 0, y: -pageHeight },
          { x: pageWidth, y: -pageHeight },
          { x: 0, y: 0 },
          { x: pageWidth, y: 0 },
        ];

  return {
    topLeft: rotatePoint(base[0], cursor, angle),
    topRight: rotatePoint(base[1], cursor, angle),
    bottomLeft: rotatePoint(base[2], cursor, angle),
    bottomRight: rotatePoint(base[3], cursor, angle),
  };
}

/**
 * Computes the intersection point of two line segments using the
 * parametric form. Returns `null` if the segments are parallel, do not
 * cross, or the intersection lies outside `bounds` (a generous AABB
 * inflated by 1px in every direction, matching the original's behaviour).
 */
function segmentIntersection(a: Segment, b: Segment, bounds: AABB): Point | null {
  const [p1, p2] = a;
  const [p3, p4] = b;

  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < 1e-9) {
    return null; // parallel or coincident
  }

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
  const u = ((p1.x - p3.x) * (p1.y - p2.y) - (p1.y - p3.y) * (p1.x - p2.x)) / denom;

  // `t` parameterises segment `a`; `u` parameterises segment `b`. The
  // original FlipCalculation treats segment `a` (the rotating page edge)
  // as a half-line because the rotated edge can extend past its endpoints
  // before crossing the static border — so we only constrain `u ∈ [0, 1]`
  // and rely on the bounding box to clip `t`.
  if (u < 0 || u > 1) {
    return null;
  }

  const point: Point = {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };

  // Generous bound check matching `boundRect` inflated by 1px in the original.
  if (
    point.x < bounds.left ||
    point.x > bounds.left + bounds.width ||
    point.y < bounds.top ||
    point.y > bounds.top + bounds.height
  ) {
    return null;
  }

  return point;
}

/**
 * Finds the three intersection points of the rotating page with the
 * static page borders (top, right side, bottom).
 *
 * For `corner === 'top'`:
 *   - topIntersect:    rotating edge `(cursor → rect.topRight)` × static edge `(0,0)–(W,0)`
 *   - sideIntersect:   rotating edge `(cursor → rect.bottomLeft)` × static edge `(W,0)–(W,H)`
 *   - bottomIntersect: rotating edge `(rect.bottomLeft → rect.bottomRight)` × static edge `(0,H)–(W,H)`
 *
 * For `corner === 'bottom'` the same intersections are computed with
 * mirrored segments — see the original `calculateIntersectPoint`.
 *
 * Any of the three can be `null` when the rotating edge currently misses
 * that static border (e.g. early in the gesture the page hasn't reached
 * the side yet).
 */
function computeIntersections(
  cursor: Point,
  rect: RectPoints,
  pageWidth: number,
  pageHeight: number,
  corner: FlipCorner
): { top: Point | null; side: Point | null; bottom: Point | null } {
  const bounds: AABB = {
    left: -1,
    top: -1,
    width: pageWidth + 2,
    height: pageHeight + 2,
  };

  const topBorder: Segment = [
    { x: 0, y: 0 },
    { x: pageWidth, y: 0 },
  ];
  const sideBorder: Segment = [
    { x: pageWidth, y: 0 },
    { x: pageWidth, y: pageHeight },
  ];
  const bottomBorder: Segment = [
    { x: 0, y: pageHeight },
    { x: pageWidth, y: pageHeight },
  ];

  if (corner === 'top') {
    return {
      top: segmentIntersection([cursor, rect.topRight], topBorder, bounds),
      side: segmentIntersection([cursor, rect.bottomLeft], sideBorder, bounds),
      bottom: segmentIntersection([rect.bottomLeft, rect.bottomRight], bottomBorder, bounds),
    };
  }

  return {
    top: segmentIntersection([rect.topLeft, rect.topRight], topBorder, bounds),
    side: segmentIntersection([cursor, rect.topLeft], sideBorder, bounds),
    bottom: segmentIntersection([rect.bottomLeft, rect.bottomRight], bottomBorder, bounds),
  };
}

/**
 * Limits the cursor to a circle centred on `circleCenter` with radius
 * `radius`. If the cursor is inside, it is returned untouched; otherwise
 * the closest point on the circle's circumference is returned. This is
 * used to prevent the user from dragging a corner past the spine.
 */
function limitToCircle(circleCenter: Point, radius: number, point: Point): Point {
  const dx = point.x - circleCenter.x;
  const dy = point.y - circleCenter.y;
  const distSq = dx * dx + dy * dy;
  if (distSq <= radius * radius) {
    return point;
  }
  const dist = Math.sqrt(distSq);
  return {
    x: circleCenter.x + (dx / dist) * radius,
    y: circleCenter.y + (dy / dist) * radius,
  };
}

/**
 * Clamps the cursor so the flipping page never breaches the spine. Mirrors
 * the original `checkPositionAtCenterLine`: first clamp to a circle of
 * radius `pageWidth` centred on the spine corner, then re-check via the
 * full page diagonal once the geometry has been updated.
 */
function clampCursorToCenterLine(
  cursor: Point,
  pageWidth: number,
  pageHeight: number,
  corner: FlipCorner,
  // Recursion-free: we pass the rect updater as a callback to avoid a
  // double calculation when no clamp is needed.
  rebuildRect: (clamped: Point) => RectPoints
): { cursor: Point; rect: RectPoints } {
  const spineTop: Point = { x: 0, y: 0 };
  const spineBottom: Point = { x: 0, y: pageHeight };
  const [primary, secondary] = corner === 'top' ? [spineTop, spineBottom] : [spineBottom, spineTop];

  let result = limitToCircle(primary, pageWidth, cursor);
  let rect = rebuildRect(result);

  const diagonal = Math.sqrt(pageWidth * pageWidth + pageHeight * pageHeight);

  // If the rotated rect has already crossed the spine line (its outer
  // corner has negative x), pull the inner corner back onto a larger circle.
  const outerCorner = corner === 'top' ? rect.bottomRight : rect.topRight;
  const innerCorner = corner === 'top' ? rect.topLeft : rect.bottomLeft;
  if (outerCorner.x <= 0) {
    const pulled = limitToCircle(secondary, diagonal, innerCorner);
    if (pulled.x !== result.x || pulled.y !== result.y) {
      result = pulled;
      rect = rebuildRect(result);
    }
  }

  return { cursor: result, rect };
}

/**
 * Runs the full fold calculation. Throws when the cursor is degenerate
 * (too close to the original right-edge corner) — callers should treat
 * that as "no fold this frame" and skip the draw.
 */
export function computeFold(input: FoldInput): FoldGeometry {
  const { cursor, pageWidth, pageHeight, corner, direction } = input;

  if (
    Math.abs(cursor.x - pageWidth) < MIN_CORNER_DISTANCE &&
    Math.abs(cursor.y) < MIN_CORNER_DISTANCE
  ) {
    throw new Error('mantine-book: cursor too close to the page corner');
  }

  // Step 1 — angle (sign included for the corner).
  const rawAngle = computeAngle(cursor, pageWidth, pageHeight, corner);

  // Step 2 — initial rect.
  const buildRect = (c: Point) => getPageRect(c, rawAngle, pageWidth, pageHeight, corner);
  let rect = buildRect(cursor);

  // Step 3 — clamp the cursor to the spine arc; rebuild the rect if it moved.
  const clamped = clampCursorToCenterLine(cursor, pageWidth, pageHeight, corner, buildRect);
  rect = clamped.rect;
  const finalCursor = clamped.cursor;

  // Step 4 — intersections with the static page borders.
  const intersections = computeIntersections(finalCursor, rect, pageWidth, pageHeight, corner);

  // Step 5 — progress + direction-aware final angle.
  const progress = Math.abs(((finalCursor.x - pageWidth) / (2 * pageWidth)) * 100);
  const finalAngle = direction === 'forward' ? -rawAngle : rawAngle;

  return {
    angle: finalAngle,
    position: finalCursor,
    rect,
    topIntersect: intersections.top,
    sideIntersect: intersections.side,
    bottomIntersect: intersections.bottom,
    progress,
  };
}

/**
 * Builds the clipping polygon for the flipping page (the page that's
 * currently being curled). Returns a list of points in screen-page space;
 * the consumer formats it into a CSS `polygon(...)` string with the
 * pixel unit suffix.
 *
 * Order matches the original `getFlippingClipArea`:
 * `topLeft → topIntersect → (sideIntersect?) → bottomIntersect → (bottomLeft?)`.
 */
export function getFlippingClipPolygon(geo: FoldGeometry, corner: FlipCorner): Point[] {
  const result: Point[] = [];
  let clipBottom = false;

  result.push(geo.rect.topLeft);
  if (geo.topIntersect) {
    result.push(geo.topIntersect);
  }

  if (geo.sideIntersect === null) {
    clipBottom = true;
  } else {
    result.push(geo.sideIntersect);
    if (geo.bottomIntersect === null) {
      clipBottom = false;
    }
  }

  if (geo.bottomIntersect) {
    result.push(geo.bottomIntersect);
  }

  if (clipBottom || corner === 'bottom') {
    result.push(geo.rect.bottomLeft);
  }

  return result;
}

/**
 * Builds the clipping polygon for the page that sits *under* the flipping
 * page — i.e. the new page being revealed. Mirrors `getBottomClipArea`.
 */
export function getBottomClipPolygon(
  geo: FoldGeometry,
  corner: FlipCorner,
  pageWidth: number,
  pageHeight: number
): Point[] {
  const result: Point[] = [];

  if (geo.topIntersect) {
    result.push(geo.topIntersect);
  }

  if (corner === 'top') {
    result.push({ x: pageWidth, y: 0 });
  } else {
    if (geo.topIntersect !== null) {
      result.push({ x: pageWidth, y: 0 });
    }
    result.push({ x: pageWidth, y: pageHeight });
  }

  if (geo.sideIntersect !== null) {
    if (geo.topIntersect && distance(geo.sideIntersect, geo.topIntersect) >= 10) {
      result.push(geo.sideIntersect);
    }
  } else if (corner === 'top') {
    result.push({ x: pageWidth, y: pageHeight });
  }

  if (geo.bottomIntersect) {
    result.push(geo.bottomIntersect);
  }
  if (geo.topIntersect) {
    result.push(geo.topIntersect);
  }

  return result;
}

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convenience formatter — turns a list of points into a CSS `polygon(...)`
 * value with the given unit (default `px`). Designed for use as the
 * `clip-path` of the flipping/bottom pages.
 */
export function pointsToCssPolygon(points: Point[], unit: 'px' | '%' = 'px'): string {
  if (points.length < 3) {
    // A polygon needs at least 3 vertices; return an empty clip-path
    // hint that hides the element rather than throwing.
    return 'polygon(0 0, 0 0, 0 0)';
  }
  const parts = points.map((p) => `${p.x.toFixed(3)}${unit} ${p.y.toFixed(3)}${unit}`).join(', ');
  return `polygon(${parts})`;
}
