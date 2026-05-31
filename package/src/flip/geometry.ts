/**
 * Page-curl geometry — pure math, no React, no DOM.
 *
 * A page fold is a REFLECTION: the grabbed point on the free edge (`anchor`)
 * folds onto the pointer (`target`), so the crease is the perpendicular
 * bisector of anchor→target and the lifted flap is the page rectangle's
 * anchor-side reflected across that crease. This single model covers a grab
 * at ANY point of the edge — corner, mid-height, anywhere — and a drag in ANY
 * direction. (StPageFlip's corner fold is the special case anchor = a corner;
 * see RESEARCH-page-curl.md for the derivation and the iBooks/cone background.)
 */

/** A point on the 2D page plane. The spine is at x = 0; the free edge at x = ±W. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Limits `point` to a circle of `radius` around `center`: returned unchanged
 * if already inside, otherwise projected radially onto the circle.
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

/**
 * Convenience formatter — turns a list of points into a CSS `polygon(...)`
 * value with the given unit (default `px`), for use as a `clip-path`.
 *
 * Returns `null` for fewer than 3 vertices (degenerate); the consumer should
 * then fall back to no clip-path (keeps the element fully visible).
 */
export function pointsToCssPolygon(points: Point[], unit: 'px' | '%' = 'px'): string | null {
  if (points.length < 3) {
    return null;
  }
  const parts = points.map((p) => `${p.x.toFixed(3)}${unit} ${p.y.toFixed(3)}${unit}`).join(', ');
  return `polygon(${parts})`;
}
