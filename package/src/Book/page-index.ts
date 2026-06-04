/**
 * Page (face) index math for the Book.
 *
 * Page `i` has its front at face `2i` and its back at face `2i + 1`. With
 * `s` pages turned, the visible spread is faces `2s − 1` (left) and `2s`
 * (right). Kept in its own module (no React) so the docgen on Book.tsx sees
 * only the component, and so the helpers stay unit-testable in isolation.
 */

/** Pages turned for a requested face index (liberal setter). */
export function faceToTurnedPages(face: number, totalPages: number): number {
  const maxFace = Math.max(0, totalPages * 2 - 1);
  const clamped = Math.max(0, Math.min(face, maxFace));
  return Math.min(totalPages, Math.ceil(clamped / 2));
}

/** Canonical reported face for a number of turned pages: the first visible
 * face in reading order (`0` with nothing turned, `2s − 1` afterwards). */
export function turnedPagesToFace(turned: number): number {
  return Math.max(0, 2 * turned - 1);
}
