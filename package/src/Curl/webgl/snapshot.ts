'use client';

/**
 * Capture a live DOM node into an <img> usable as a WebGL texture.
 *
 * Uses html-to-image's SVG <foreignObject> serialization — the only DOM→image
 * form that is origin-clean and therefore uploadable via `texImage2D` without
 * tainting the GL context (verified: foreignObject data-URI → WebGL2, no taint).
 * `html-to-image` is imported lazily so it never enters the SSR / initial
 * bundle; only the opt-in `variant="rounded"` path ever loads it.
 *
 * Returns `null` if capture fails (a cross-origin image taints the snapshot, or
 * html-to-image throws) — the caller then falls back to the DOM renderer.
 */
export async function captureFaceTexture(
  node: HTMLElement,
  pixelRatio: number
): Promise<HTMLImageElement | null> {
  try {
    const { toPng } = await import('html-to-image');
    // skipFonts: html-to-image otherwise reads every stylesheet's cssRules to
    // inline @font-face, which throws a SecurityError on cross-origin sheets
    // (Google Fonts / CDN). We don't need embedded web fonts for the snapshot.
    const dataUrl = await toPng(node, { pixelRatio, skipFonts: true });
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Curl snapshot image failed to load'));
      img.src = dataUrl;
    });
    return img;
  } catch {
    return null;
  }
}
