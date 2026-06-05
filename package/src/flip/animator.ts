/**
 * `requestAnimationFrame`-driven lerp animator for click-to-flip page
 * turns. Pure-by-default: easing functions are named exports and unit
 * tested without a DOM; the React hook (`useFlipAnimator`) is a thin
 * wrapper that owns a single rAF loop and cancels cleanly on unmount.
 *
 * The book is **quiescent at rest** — there's no perpetual rAF loop
 * (unlike `Scene.Globe`'s auto-rotate). Animation kicks in only when
 * the consumer calls `start({...})` from `onRelease` or from a
 * programmatic `flipNext()` call.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

/** Easing function signature — input in `[0, 1]`, output in `[0, 1]`. */
export type Easing = (t: number) => number;

/** Constant-rate easing — useful for very short flips. */
export const linear: Easing = (t) => t;

/** Cubic ease-out — `t === 0` → 0, `t === 1` → 1, gentle landing. Default for click-to-flip. */
export const easeOutCubic: Easing = (t) => 1 - (1 - t) ** 3;

/** Cubic ease-in-out — symmetric S-curve. */
export const easeInOutCubic: Easing = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Inputs to a single `start(...)` invocation. */
export interface AnimateOptions {
  /**
   * Animation length in ms. If `0` the animation completes synchronously
   * on the next frame (still passes through `onProgress(1, 1)`).
   *
   * @default 1000
   */
  duration?: number;

  /**
   * Easing function applied to raw `t = elapsed / duration`. Result is
   * passed to `onProgress` as the first argument.
   *
   * @default easeOutCubic
   */
  easing?: Easing;

  /**
   * Called on every animation frame with both the eased value and the
   * raw linear `t`. Use either depending on what you're driving.
   */
  onProgress: (eased: number, t: number) => void;

  /** Called once when the animation reaches `t === 1`. */
  onComplete?: () => void;
}

/** Object returned by `useFlipAnimator`. All methods are referentially stable. */
export interface FlipAnimator {
  /**
   * Starts a new animation. If a previous animation is still running,
   * it is cancelled first — only one animation can be active at a time.
   *
   * Returns a `stop` function for the caller's convenience, in addition
   * to the controller-level `stop()`.
   */
  start: (options: AnimateOptions) => () => void;

  /** Cancels the running animation (no-op when none is active). */
  stop: () => void;

  /** True while the rAF loop is scheduled. */
  isActive: () => boolean;
}

/**
 * Single-loop rAF animator. Internally there is at most **one** scheduled
 * frame at any time — calling `start()` while an animation is running
 * cancels the old one and seamlessly takes over.
 */
export function useFlipAnimator(): FlipAnimator {
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    activeRef.current = false;
  }, []);

  // Always cancel on unmount.
  useEffect(() => () => cancel(), [cancel]);

  const start = useCallback(
    (options: AnimateOptions) => {
      cancel();

      // Honor prefers-reduced-motion (WCAG 2.3.3): collapse the animation to
      // an instant settle — onProgress(1) and onComplete still fire, so the
      // flip semantics (and the Book's page state) are unchanged. A live drag
      // is exempt by construction: it tracks the pointer, not this animator.
      // Read fresh on every start so runtime OS changes are respected.
      const reduceMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const duration = reduceMotion ? 0 : Math.max(0, options.duration ?? 1000);
      const easing = options.easing ?? easeOutCubic;
      const startTs = performance.now();
      activeRef.current = true;

      // Handle duration === 0 synchronously on the very next frame to
      // keep semantics consistent (onProgress + onComplete both fire).
      const tick = () => {
        if (!activeRef.current) {
          return;
        }
        const elapsed = performance.now() - startTs;
        const raw = duration === 0 ? 1 : Math.min(1, elapsed / duration);
        const eased = easing(raw);
        options.onProgress(eased, raw);

        if (raw >= 1) {
          activeRef.current = false;
          rafRef.current = null;
          options.onComplete?.();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
      return cancel;
    },
    [cancel]
  );

  const isActive = useCallback(() => activeRef.current, []);

  // Memoise so consumers can safely use the returned object as a
  // `useEffect` / `useCallback` dependency without re-firing every render.
  return useMemo(() => ({ start, stop: cancel, isActive }), [start, cancel, isActive]);
}
