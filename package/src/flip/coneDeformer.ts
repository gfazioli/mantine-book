/**
 * Cone page-curl deformer — the Hong et al. "Deforming Pages of Electronic
 * Books" cone model, ported from prideout/pageturn (Apache-2.0). Pure math: it
 * maps a flat unit page mesh (texcoords u, v ∈ [0, 1]) onto the curled 3D cone
 * surface and writes the `positions`. No WebGL, no DOM.
 *
 * STATUS: only {@link buildConeMesh} (the static grid) is used by the
 * shipping renderer. The deform path ({@link deformConeMesh} / {@link coneParams})
 * is NOT wired — glRenderer.ts uses a crease-aligned CYLINDER wrap instead.
 * This module is kept (and unit-tested) as a possible future asymmetric
 * "dog-ear" model.
 *
 * The cone apex sits far down −v, so curvature grows with distance from the
 * binding: the page wraps tightest near the spine and the far corner peels up —
 * the asymmetric "dog-ear" iBooks look. Unlike prideout's canned t-animation,
 * our curl is DRAG-driven, so {@link coneParams} maps our 0–100 fold progress
 * straight to (theta, apex, rotation); the release easing is done upstream by
 * useFlipAnimator.
 */

/** Apex offset scale (prideout's −15 for a unit page: the apex sits far down −v). */
export const CONE_APEX_SCALE = 15;

/** Below this curl angle β = α/sin(θ) blows up, so the page is treated as flat. */
const MIN_THETA = 1e-3;

export interface ConeParams {
  /** Cone half-angle: 0 = flat, π/2 = fully wrapped to the other side. */
  theta: number;
  /** Cone apex position along −v (negative; further = gentler curl). */
  apex: number;
  /** Rigid rotation (radians) applied to the whole page after deforming. */
  rotation: number;
}

/**
 * Map fold progress (0–100) to cone parameters. progress 0 → flat, 100 → a full
 * turn onto the other side. Linear in the deformation amount — the settle
 * easing is applied upstream (the animator feeds an already-eased progress).
 */
export function coneParams(progress: number): ConeParams {
  const deformation = Math.max(0, Math.min(1, progress / 100));
  return {
    theta: deformation * (Math.PI / 2),
    apex: -CONE_APEX_SCALE * deformation,
    rotation: Math.PI * deformation,
  };
}

/**
 * Deform a flat unit page mesh into the cone surface, in place. Verbatim Hong
 * cone math (per vertex): (u, v) maps onto a cone of half-angle `theta` whose
 * apex is at (0, apex). At `theta ≤ MIN_THETA` the page is flat (z = 0). The
 * `−0.5` on y centres the unit page on its v axis (prideout's convention).
 *
 * @param positions Float32Array of 3·N floats (xyz per vertex) — written here.
 * @param texcoords Float32Array of 2·N floats (uv per vertex) — read here.
 */
export function deformConeMesh(
  positions: Float32Array,
  texcoords: Float32Array,
  theta: number,
  apex: number
): void {
  const count = texcoords.length / 2;
  if (theta <= MIN_THETA) {
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = texcoords[i * 2 + 0];
      positions[i * 3 + 1] = texcoords[i * 2 + 1] - 0.5;
      positions[i * 3 + 2] = 0;
    }
    return;
  }
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  for (let i = 0; i < count; i++) {
    const u = texcoords[i * 2 + 0];
    const v = texcoords[i * 2 + 1];
    const r = Math.sqrt(u * u + (v - apex) * (v - apex));
    const d = r * sinT;
    const alpha = Math.asin(u / r);
    const beta = alpha / sinT;
    positions[i * 3 + 0] = d * Math.sin(beta);
    positions[i * 3 + 1] = r + apex - d * (1 - Math.cos(beta)) * sinT - 0.5;
    positions[i * 3 + 2] = d * (1 - Math.cos(beta)) * cosT;
  }
}

/**
 * Build the flat unit page mesh used by {@link deformConeMesh}: a
 * (cols+1)×(rows+1) grid of texcoords (u, v ∈ [0, 1]) plus the matching
 * triangle index buffer. Returns typed arrays sized for the WebGL renderer.
 */
export function buildConeMesh(
  cols: number,
  rows: number
): { texcoords: Float32Array; indices: Uint16Array; vertexCount: number } {
  const vw = cols + 1;
  const vh = rows + 1;
  const vertexCount = vw * vh;
  const texcoords = new Float32Array(vertexCount * 2);
  for (let y = 0; y < vh; y++) {
    for (let x = 0; x < vw; x++) {
      const i = y * vw + x;
      texcoords[i * 2 + 0] = x / cols;
      texcoords[i * 2 + 1] = y / rows;
    }
  }
  const indices = new Uint16Array(cols * rows * 6);
  let k = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const a = y * vw + x;
      const b = a + 1;
      const c = a + vw;
      const d = c + 1;
      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = d;
      indices[k++] = c;
    }
  }
  return { texcoords, indices, vertexCount };
}
