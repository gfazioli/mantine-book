'use client';

/**
 * Capture a live DOM node into an <img> usable as a WebGL texture.
 *
 * Uses snapdom — it renders element backgrounds, shadows and pseudo-elements
 * more faithfully than html-to-image, and emits an origin-clean data-URL image,
 * so the result uploads via `texImage2D` without tainting the GL context.
 * Imported lazily so it never enters the SSR / initial bundle; only the opt-in
 * `variant="rounded"` path loads it.
 *
 * `embedFonts: false` skips non-icon web-font inlining (which would read
 * cross-origin stylesheet cssRules and throw); text falls back to a system font
 * in the snapshot, which is fine for a page mid-curl.
 *
 * Returns `null` if capture fails — the caller then falls back to the DOM curl.
 */
export async function captureFaceTexture(
  node: HTMLElement,
  pixelRatio: number,
  backgroundColor?: string
): Promise<HTMLImageElement | null> {
  try {
    const { snapdom } = await import('@zumer/snapdom');
    const img = await snapdom.toPng(node, {
      dpr: pixelRatio,
      backgroundColor,
      embedFonts: false,
    });
    if (!img.complete) {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Curl snapshot image failed to load'));
      });
    }
    return img;
  } catch {
    return null;
  }
}
