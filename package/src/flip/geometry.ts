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

/**
 * Clips a convex polygon to the half-plane on the same side of the line
 * `(through, dir)` as the reference point `ref` (Sutherland–Hodgman, single
 * edge). The line is undirected; `ref` picks which half to keep.
 */
function clipToHalfPlane(poly: Point[], through: Point, dir: Point, ref: Point): Point[] {
  const normal: Point = { x: -dir.y, y: dir.x };
  const signedSide = (p: Point) => normal.x * (p.x - through.x) + normal.y * (p.y - through.y);
  const want = Math.sign(signedSide(ref)) || 1;
  const inside = (p: Point) => signedSide(p) * want >= -1e-9;

  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) {
      out.push(a);
    }
    if (ia !== ib) {
      const sa = signedSide(a);
      const sb = signedSide(b);
      const t = sa / (sa - sb);
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return out;
}

/**
 * Polygon of the part of the sheet still lying FLAT (on the spine side of
 * the fold line) — i.e. the area that should keep showing the Front face
 * while the rest of the sheet has lifted into the curl. For a single bifacial
 * sheet there is no page underneath, so the Front layer must be clipped to
 * this polygon and the lifted region left transparent.
 *
 * Implemented by clipping the page rectangle to the spine side of the crease
 * line. The crease passes through any tracked border intersection and runs at
 * `π/2 + angle/2` (verified against the two-intersection cases). This single
 * half-plane clip carves the front correctly in EVERY regime — small folds,
 * folds past the spine, and folds whose crease only grazes one border — where
 * the older edge-case branches returned the full rectangle and left the front
 * uncarved. With no border intersection the page is either fully flat (near
 * rest) or fully lifted (near complete), decided by progress.
 */
export function getFlatPartPolygon(
  geo: FoldGeometry,
  corner: FlipCorner,
  pageWidth: number,
  pageHeight: number,
  direction: FlipDirection = 'forward'
): Point[] {
  const rect: Point[] = [
    { x: 0, y: 0 },
    { x: pageWidth, y: 0 },
    { x: pageWidth, y: pageHeight },
    { x: 0, y: pageHeight },
  ];

  const intersects = [geo.topIntersect, geo.sideIntersect, geo.bottomIntersect].filter(
    (p): p is Point => p !== null
  );

  let pts: Point[];
  if (intersects.length === 0) {
    // Crease misses every border: page is fully flat (near rest) or fully
    // lifted (near complete).
    pts = geo.progress < 50 ? rect : [];
  } else {
    const theta = Math.PI / 2 + geo.angle / 2;
    const dir: Point = { x: Math.cos(theta), y: Math.sin(theta) };
    // A point that always stays flat: the spine corner opposite the grabbed
    // one. Keep the page half on that side of the crease.
    const ref: Point = corner === 'top' ? { x: 0, y: pageHeight } : { x: 0, y: 0 };
    pts = clipToHalfPlane(rect, intersects[0], dir, ref);
  }

  // For a BACK fold the resting sheet lies on the left with its hinge on the
  // right, so the flat-part polygon (computed hinge-at-x=0) is mirrored.
  if (direction === 'back') {
    return pts.map((p) => ({ x: pageWidth - p.x, y: p.y }));
  }
  return pts;
}

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/* ------------------------------------------------------------------ */
/*  Drag clamping — keep the cursor inside the corner's valid fold     */
/*  domain so the curl never degenerates, freezes, or inverts even     */
/*  when the pointer is dragged far outside the sheet.                 */
/* ------------------------------------------------------------------ */

/**
 * Limits `point` to a circle of `radius` around `center`: if it is already
 * inside, it is returned unchanged; otherwise it is projected radially onto
 * the circle. Faithful to StPageFlip's `Helper.LimitPointToCircle`.
 */
function limitPointToCircle(center: Point, radius: number, point: Point): Point {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= radius || dist === 0) {
    return point;
  }
  return { x: center.x + (dx / dist) * radius, y: center.y + (dy / dist) * radius };
}

/**
 * Clamp the (absolute, page-local) pointer position to a valid fold position,
 * a faithful port of StPageFlip's `FlipCalculation.checkPositionAtCenterLine`.
 *
 * The fold is driven by the ABSOLUTE pointer position (NOT a delta from the
 * corner), exactly as the reference: this is what lets a grab anywhere along
 * the edge — including mid-height — produce a clean, organic curl, because the
 * vertical component (`top`) stays meaningful as the page is swept toward the
 * spine.
 *
 * Two limits keep the curl bounded without ever degenerating:
 *  1. The pointer is limited to a circle of radius = page width around the
 *     NEAR spine corner (top → (0,0), bottom → (0,H)) — the page edge can't
 *     reach past its own length from the hinge.
 *  2. Once the rotated rectangle crosses the spine, the FAR corner is limited
 *     to a circle of radius = the page diagonal around the far spine corner,
 *     so a full turn settles cleanly instead of inverting.
 *
 * Pure and corner-symmetric.
 */
export function clampCorner(
  cursor: Point,
  pageWidth: number,
  pageHeight: number,
  corner: FlipCorner
): Point {
  const spineNear: Point = corner === 'top' ? { x: 0, y: 0 } : { x: 0, y: pageHeight };
  const spineFar: Point = corner === 'top' ? { x: 0, y: pageHeight } : { x: 0, y: 0 };

  // 1. Limit to the reach disc (radius = page width) around the near hinge.
  let result = limitPointToCircle(spineNear, pageWidth, cursor);

  // 2. Once the rotated rect crosses the spine, limit the far corner too.
  let geo: FoldGeometry | null = null;
  try {
    geo = computeFold({ cursor: result, pageWidth, pageHeight, corner, direction: 'forward' });
  } catch {
    geo = null;
  }
  if (geo) {
    const crossing = corner === 'top' ? geo.rect.bottomRight : geo.rect.topRight;
    const farCorner = corner === 'top' ? geo.rect.topLeft : geo.rect.bottomLeft;
    if (crossing.x <= 0) {
      const diagonal = Math.hypot(pageWidth, pageHeight);
      result = limitPointToCircle(spineFar, diagonal, farCorner);
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Unified reflection fold — grab ANY point on the free edge          */
/*                                                                     */
/*  A page fold is a reflection: the grabbed point `anchor` folds onto */
/*  the `target`, so the crease is the PERPENDICULAR BISECTOR of       */
/*  anchor→target and the lifted flap is the rect's anchor-side        */
/*  reflected across it. StPageFlip's corner fold is the special case  */
/*  anchor = a corner; this generalizes it to any edge point, unifying */
/*  corner + side + any drag direction into ONE path. See              */
/*  RESEARCH-page-curl.md (§3 fold/riflessione, §5 raccomandazioni).   */
/* ------------------------------------------------------------------ */

export interface ReflectionFold {
  /** Region where the Front face stays flat (spine side of the crease). */
  flatFront: Point[];
  /** The lifted region (anchor side of the crease), in page coords. */
  flap: Point[];
  /** CSS 2D matrix [a,b,c,d,e,f] reflecting page coords across the crease. */
  matrix: [number, number, number, number, number, number];
  /** 0–100: how far the fold has swept from the free edge toward the spine. */
  progress: number;
  /** Crease midpoint and direction (page coords) — for shadows later. */
  creaseMid: Point;
  creaseDir: Point;
}

/**
 * Clamp the drag target so the fold never folds the spine or degenerates.
 *
 * A spine corner C stays on the flat side of the crease ⟺ it is at least as
 * close to the target as to the anchor (|C − target| ≤ |C − anchor|). So the
 * valid region is the intersection of two discs centred on the spine corners
 * with radii = the anchor's distances to them. For a corner anchor this
 * reduces exactly to StPageFlip's two `LimitPointToCircle` clamps.
 */
export function clampReflectionTarget(
  anchor: Point,
  target: Point,
  _pageWidth: number,
  pageHeight: number
): Point {
  const spineTop: Point = { x: 0, y: 0 };
  const spineBottom: Point = { x: 0, y: pageHeight };
  const rTop = Math.hypot(anchor.x - spineTop.x, anchor.y - spineTop.y);
  const rBottom = Math.hypot(anchor.x - spineBottom.x, anchor.y - spineBottom.y);
  let t = target;
  // A few iterations settle the two-disc intersection.
  for (let i = 0; i < 3; i++) {
    t = limitPointToCircle(spineTop, rTop, t);
    t = limitPointToCircle(spineBottom, rBottom, t);
  }
  return t;
}

/** px of drag below which there is no meaningful fold (rest). */
const REFLECTION_REST_EPSILON = 2;

/**
 * Compute the reflection fold for grabbing `anchor` (a point on the free edge)
 * and dragging it to `rawTarget`. Returns `null` at rest (drag below epsilon).
 *
 * The target is clamped via {@link clampReflectionTarget}; the crease is the
 * perpendicular bisector of anchor→target; `flatFront` is the page rect on the
 * spine side; `flap` is the rect on the anchor side; and `matrix` reflects the
 * flap across the crease (det −1, so it also mirrors the back-face content).
 */
export function computeReflectionFold(
  anchor: Point,
  rawTarget: Point,
  pageWidth: number,
  pageHeight: number
): ReflectionFold | null {
  const target = clampReflectionTarget(anchor, rawTarget, pageWidth, pageHeight);
  const dx = target.x - anchor.x;
  const dy = target.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len < REFLECTION_REST_EPSILON) {
    return null;
  }
  const dragDir: Point = { x: dx / len, y: dy / len }; // crease NORMAL
  const mid: Point = { x: (anchor.x + target.x) / 2, y: (anchor.y + target.y) / 2 };
  const creaseDir: Point = { x: -dragDir.y, y: dragDir.x }; // crease runs ⟂ to the drag

  // The page spans from the spine (x = 0) to the free edge (anchor.x = ±W):
  // +W when the sheet rests in the right half, −W when it rests (flipped) in
  // the left half. Deriving the rect from the anchor makes the fold work
  // symmetrically on both sides.
  const xMin = Math.min(0, anchor.x);
  const xMax = Math.max(0, anchor.x);
  const rect: Point[] = [
    { x: xMin, y: 0 },
    { x: xMax, y: 0 },
    { x: xMax, y: pageHeight },
    { x: xMin, y: pageHeight },
  ];
  const spineRef: Point = { x: 0, y: pageHeight / 2 };
  const flatFront = clipToHalfPlane(rect, mid, creaseDir, spineRef);
  const flap = clipToHalfPlane(rect, mid, creaseDir, anchor);

  // Reflection across the crease as a CSS affine matrix:
  //   Q' = (I − 2·n·nᵀ)·Q + 2·(n·M)·n   with n = dragDir (the crease normal)
  const dm = dragDir.x * mid.x + dragDir.y * mid.y;
  const matrix: [number, number, number, number, number, number] = [
    1 - 2 * dragDir.x * dragDir.x, // a
    -2 * dragDir.x * dragDir.y, // b
    -2 * dragDir.x * dragDir.y, // c
    1 - 2 * dragDir.y * dragDir.y, // d
    2 * dm * dragDir.x, // e
    2 * dm * dragDir.y, // f
  ];

  // 0 at rest (target on the free edge), 50 at the spine, 100 at a full turn
  // onto the other half — symmetric for either side.
  const progress = Math.max(
    0,
    Math.min(100, (Math.abs(anchor.x - target.x) / (2 * pageWidth)) * 100)
  );

  return { flatFront, flap, matrix, progress, creaseMid: mid, creaseDir };
}

/* ------------------------------------------------------------------ */
/*  Shadow helpers — small functions ported from StPageFlip            */
/*  (`FlipCalculation.getShadowStartPoint / getShadowAngle / ...`)     */
/* ------------------------------------------------------------------ */

/**
 * Rotates a point around `pivot` by `angle` radians using the same matrix
 * convention as `Helper.GetRotatedPoint`: positive angle rotates the point
 * clockwise in screen space (CSS y-axis flipped).
 */
export function rotatePointAround(point: Point, pivot: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos + point.y * sin + pivot.x,
    y: point.y * cos - point.x * sin + pivot.y,
  };
}

/** Angle (radians) between two line segments. Direct port of `GetAngleBetweenTwoLine`. */
export function angleBetweenSegments(a: Segment, b: Segment): number {
  const A1 = a[0].y - a[1].y;
  const A2 = b[0].y - b[1].y;
  const B1 = a[1].x - a[0].x;
  const B2 = b[1].x - b[0].x;
  return Math.acos(
    (A1 * A2 + B1 * B2) / (Math.sqrt(A1 * A1 + B1 * B1) * Math.sqrt(A2 * A2 + B2 * B2))
  );
}

/**
 * Starting point of the curl shadow strip — the topIntersect for top-corner
 * flips, or the sideIntersect when available for bottom-corner flips.
 */
export function getShadowStartPoint(geo: FoldGeometry, corner: FlipCorner): Point | null {
  if (corner === 'top') {
    return geo.topIntersect;
  }
  return geo.sideIntersect ?? geo.topIntersect;
}

/**
 * The two-point segment representing the fold line (where the page is
 * creased). Direction-agnostic; used as input to `getShadowAngle`.
 */
export function getFoldLineSegment(geo: FoldGeometry, corner: FlipCorner): Segment | null {
  const first = getShadowStartPoint(geo, corner);
  if (!first) return null;
  const second =
    first !== geo.sideIntersect && geo.sideIntersect !== null
      ? geo.sideIntersect
      : geo.bottomIntersect;
  if (!second) return null;
  return [first, second];
}

/**
 * Rotation angle (radians) to apply to the shadow strip so it sits along
 * the fold. The result is already adjusted for direction.
 */
export function getShadowAngle(
  geo: FoldGeometry,
  corner: FlipCorner,
  direction: FlipDirection,
  pageWidth: number
): number {
  const seg = getFoldLineSegment(geo, corner);
  if (!seg) return 0;
  const a = angleBetweenSegments(seg, [
    { x: 0, y: 0 },
    { x: pageWidth, y: 0 },
  ]);
  return direction === 'forward' ? a : Math.PI - a;
}

/**
 * Converts a point in the flipping page's local frame (origin = the page's
 * own top-left) into the spread's frame (origin = top-left of the spread).
 *
 * - FORWARD flip happens on the right side: localX is added to pageWidth.
 * - BACK flip happens on the left side mirrored along the spine:
 *   localX is reflected through pageWidth.
 */
export function convertToSpread(
  localPos: Point,
  direction: FlipDirection,
  pageWidth: number
): Point {
  return {
    x: direction === 'forward' ? localPos.x + pageWidth : pageWidth - localPos.x,
    y: localPos.y,
  };
}

/**
 * Builds the polygon points consumed by the CSS `clip-path` of the
 * **flipping page** element, in the element's pre-transform coordinate
 * system. Mirrors `HTMLPage.drawSoft` from StPageFlip.
 *
 *  - For `forward`: `g = p - position`
 *  - For `back`:    `g = (-p.x + position.x, p.y - position.y)` (mirror x)
 *  - Then rotate every `g` around (0, 0) by `angle` so that the subsequent
 *    CSS `transform: translate(position) rotate(angle)` lands each point at
 *    its original spread-space `p`.
 */
export function getFlippingPageLocalPolygon(
  geo: FoldGeometry,
  corner: FlipCorner,
  direction: FlipDirection
): Point[] {
  const points = getFlippingClipPolygon(geo, corner);
  return points.map((p) => {
    const local =
      direction === 'back'
        ? { x: -p.x + geo.position.x, y: p.y - geo.position.y }
        : { x: p.x - geo.position.x, y: p.y - geo.position.y };
    return rotatePointAround(local, { x: 0, y: 0 }, geo.angle);
  });
}

/**
 * Convenience formatter — turns a list of points into a CSS `polygon(...)`
 * value with the given unit (default `px`). Designed for use as the
 * `clip-path` of the flipping/bottom pages.
 *
 * Returns `null` when there are fewer than 3 vertices (a degenerate
 * polygon). The consumer should fall back to **no clip-path** in that
 * case, which keeps the element fully visible — appropriate for the
 * "bottom" page when the curl is mid-drag and intersection geometry
 * collapses to a single border crossing.
 */
export function pointsToCssPolygon(points: Point[], unit: 'px' | '%' = 'px'): string | null {
  if (points.length < 3) {
    return null;
  }
  const parts = points.map((p) => `${p.x.toFixed(3)}${unit} ${p.y.toFixed(3)}${unit}`).join(', ');
  return `polygon(${parts})`;
}
