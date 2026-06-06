'use client';

import { CurlGlRenderer } from './glRenderer';

/** What a folding page borrows from the pool. */
export interface CurlGlLease {
  renderer: CurlGlRenderer;
  canvas: HTMLCanvasElement;
}

/**
 * One WebGL2 context for a whole Book.
 *
 * Every rounded page used to own a live context for its entire lifetime, so a
 * long book exhausted the browser's context budget (~16 in Chrome) and later
 * pages silently degraded to flat. The Book's turn queue guarantees a single
 * page folds at a time, so ONE shared renderer is enough by construction:
 * pages keep their face snapshots as plain images (CPU) and upload them to
 * the pool's two GL textures when they acquire the lease for a fold.
 *
 * The renderer and its canvas are created lazily on the first acquire (an
 * untouched book costs zero GPU contexts) and reclaimed with
 * `WEBGL_lose_context` on {@link dispose} (Book unmount).
 */
export class CurlWebglPool {
  private renderer: CurlGlRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private owner: symbol | null = null;
  private failed = false;

  constructor(
    private readonly createRenderer: (canvas: HTMLCanvasElement) => CurlGlRenderer = (canvas) =>
      new CurlGlRenderer(canvas)
  ) {}

  /**
   * Borrow the shared renderer for one folding page. Last-wins: a new owner
   * steals the lease (the queue makes overlap impossible in practice; the
   * previous holder's `release` then becomes a no-op). Returns `null` when
   * WebGL is unavailable — latched, so the caller can fall back to flat.
   */
  acquire(owner: symbol): CurlGlLease | null {
    if (this.failed) {
      return null;
    }
    if (!this.renderer) {
      const canvas = document.createElement('canvas');
      try {
        this.renderer = this.createRenderer(canvas);
      } catch {
        this.failed = true;
        return null;
      }
      this.canvas = canvas;
    }
    this.owner = owner;
    return { renderer: this.renderer, canvas: this.canvas! };
  }

  /** Return the lease. Parks the canvas out of the DOM so the previous page's
   * last frame can never flash under the next fold. No-op for stale owners. */
  release(owner: symbol): void {
    if (this.owner === owner) {
      this.owner = null;
      this.canvas?.remove();
    }
  }

  /** True teardown (Book unmount): reclaim the GPU context slot. */
  dispose(): void {
    this.renderer?.loseContext();
    this.canvas?.remove();
    this.renderer = null;
    this.canvas = null;
    this.owner = null;
  }
}
