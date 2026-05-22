/**
 * Pointer drag controller for the page-turn gesture.
 *
 * Splits cleanly into two layers:
 *
 *  1. **Pure helpers** (named exports) — no React, no DOM:
 *     - `computeReleaseVelocity(samples)`
 *     - `classifyGesture({ delta, duration, swipeDistance, swipeTimeThreshold })`
 *     - `pruneSampleWindow(samples, now, windowMs)`
 *
 *     These are unit-tested in isolation and reused by both `useDragController`
 *     and (later) the touch path on the spread layout component.
 *
 *  2. **`useDragController` hook** — wires React `useRef` + PointerEvent
 *     handlers around the pure helpers. Returns ready-to-spread handlers
 *     `{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel }`
 *     plus a stable `isDragging()` getter.
 *
 * Design notes:
 *
 * - The rolling 60ms window pattern is the same one validated on
 *   `Scene.Globe` (see mantine-scene `SceneGlobe.tsx`): release velocity
 *   is averaged over the very last 60ms of motion so that a brief pause
 *   before lifting the finger doesn't kill the inertia.
 *
 * - `mobileScrollHoldMs` makes touch start *passive* for the first ~250ms.
 *   Vertical scroll wins by default; only horizontal-biased motion claims
 *   the gesture as a drag. Matches StPageFlip's `UI.ts` heuristic.
 *
 * - We use `setPointerCapture` so the drag continues even when the cursor
 *   leaves the book bounds (a typical case when grabbing the bottom-right
 *   corner and dragging across the spine).
 */

import { useCallback, useMemo, useRef } from 'react';
import type { Point } from './geometry';

/** One sample of the pointer's position at a given timestamp. */
export interface DragSample {
  /** Timestamp from `performance.now()` (ms). */
  t: number;
  /** Page-local X. */
  x: number;
  /** Page-local Y. */
  y: number;
}

/** Three discrete outcomes of a single gesture, decided at release time. */
export type GestureKind = 'click' | 'swipe' | 'drag';

/** Summary handed to `onRelease` callbacks. */
export interface DragSummary {
  /** What kind of gesture this turned out to be. */
  kind: GestureKind;
  /** Total time press → release (ms). */
  duration: number;
  /** Total displacement from press to release (px). */
  delta: Point;
  /** Final release point in page-local coords. */
  releasePoint: Point;
  /** Velocity at release in px/ms, averaged over the rolling window. */
  velocity: Point;
}

export interface DragControllerOptions {
  /**
   * Minimum displacement (px) before a gesture is classified as
   * `swipe` (when fast) or `drag` (when long).
   *
   * @default 30
   */
  swipeDistance?: number;

  /**
   * Max time (ms) a fast gesture may take to still count as a `swipe`.
   *
   * @default 250
   */
  swipeTimeThreshold?: number;

  /**
   * On touch input, ignore the gesture until the user has dragged
   * horizontally beyond `swipeDistance / 4`. This lets vertical scroll
   * win when the gesture begins more-vertically than horizontally — the
   * same heuristic StPageFlip uses.
   *
   * @default true
   */
  mobileScrollSupport?: boolean;

  /**
   * Rolling sample window (ms) used to estimate release velocity.
   *
   * @default 60
   */
  velocityWindowMs?: number;

  /** Called every pointermove while dragging. */
  onMove?: (point: Point) => void;

  /** Called once when a press starts (before drag/swipe classification). */
  onStart?: (point: Point) => void;

  /** Called on release with the gesture summary. */
  onRelease?: (summary: DragSummary) => void;

  /**
   * Convert raw client coordinates from the PointerEvent into the
   * page-local coordinate system the consumer wants to track. Defaults
   * to no-op (the consumer is responsible for translating).
   */
  getLocalPoint?: (clientX: number, clientY: number) => Point;
}

/**
 * Drop samples older than `now - windowMs` (keeps at least 2 entries
 * so the velocity calc never starves).
 */
export function pruneSampleWindow(
  samples: DragSample[],
  now: number,
  windowMs: number
): DragSample[] {
  if (samples.length <= 2) {
    return samples;
  }
  const cutoff = now - windowMs;
  let start = 0;
  for (let i = 0; i < samples.length - 2; i++) {
    if (samples[i].t < cutoff) {
      start = i + 1;
    } else {
      break;
    }
  }
  return start === 0 ? samples : samples.slice(start);
}

/**
 * Estimates the release velocity (px / ms per axis) as the average over
 * the rolling window. Returns `{x: 0, y: 0}` for ≤1 sample.
 *
 * Algorithm: take the first and last sample, divide displacement by the
 * elapsed time. Steadier than the last-frame delta, which is often ~0 if
 * the user paused before lifting (see Scene.Globe v2.2.1 fix).
 */
export function computeReleaseVelocity(samples: DragSample[]): Point {
  if (samples.length < 2) {
    return { x: 0, y: 0 };
  }
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = Math.max(1, last.t - first.t);
  return {
    x: (last.x - first.x) / dt,
    y: (last.y - first.y) / dt,
  };
}

/** Inputs to {@link classifyGesture} — all primitives so it's trivial to test. */
export interface ClassifyInput {
  delta: Point;
  duration: number;
  swipeDistance: number;
  swipeTimeThreshold: number;
}

/**
 * Classifies a finished gesture as `click`, `swipe`, or `drag`.
 *
 *  - **click**: hardly moved AND short duration (release within `swipeTimeThreshold`
 *    and total displacement under the swipe threshold).
 *  - **swipe**: moved at least `swipeDistance` AND released within
 *    `swipeTimeThreshold`.
 *  - **drag**: moved at least `swipeDistance` OR took longer than the swipe
 *    time. The page curl tracks the cursor in real time during a drag.
 */
export function classifyGesture(input: ClassifyInput): GestureKind {
  const { delta, duration, swipeDistance, swipeTimeThreshold } = input;
  const distance = Math.sqrt(delta.x * delta.x + delta.y * delta.y);

  if (distance < swipeDistance && duration <= swipeTimeThreshold) {
    return 'click';
  }
  if (distance >= swipeDistance && duration <= swipeTimeThreshold) {
    return 'swipe';
  }
  return 'drag';
}

/** Internal mutable state held across renders by `useDragController`. */
interface DragState {
  pointerId: number;
  startTime: number;
  startPoint: Point;
  lastPoint: Point;
  samples: DragSample[];
  active: boolean;
  /** Touch-only: when true we still ignore moves until the gesture is mostly horizontal. */
  awaitingScrollDecision: boolean;
}

/** The bundle of handlers + introspection returned by the hook. */
export interface DragController {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
  /** True between a successful `pointerdown` and the matching `pointerup` / `pointercancel`. */
  isDragging: () => boolean;
}

/**
 * React hook that converts raw PointerEvents into the gesture summary
 * the book renderer needs. See the module header for the design model.
 *
 * The returned handlers are stable across renders — drop them directly
 * on the gesture surface element:
 *
 *     const drag = useDragController({ onStart, onMove, onRelease });
 *     return <div {...drag} />;
 */
export function useDragController(options: DragControllerOptions = {}): DragController {
  const {
    swipeDistance = 30,
    swipeTimeThreshold = 250,
    mobileScrollSupport = true,
    velocityWindowMs = 60,
    onMove,
    onStart,
    onRelease,
    getLocalPoint,
  } = options;

  // Stable refs so consumers don't have to memoise their callbacks.
  const optionsRef = useRef({ onMove, onStart, onRelease, getLocalPoint });
  optionsRef.current = { onMove, onStart, onRelease, getLocalPoint };

  const stateRef = useRef<DragState | null>(null);

  const toLocal = useCallback((clientX: number, clientY: number): Point => {
    const fn = optionsRef.current.getLocalPoint;
    return fn ? fn(clientX, clientY) : { x: clientX, y: clientY };
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // Reject secondary buttons (right click, middle click). Touch and pen
      // both report button=0.
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      const now = performance.now();
      const local = toLocal(event.clientX, event.clientY);
      const sample: DragSample = { t: now, x: local.x, y: local.y };

      stateRef.current = {
        pointerId: event.pointerId,
        startTime: now,
        startPoint: local,
        lastPoint: local,
        samples: [sample],
        active: true,
        awaitingScrollDecision: mobileScrollSupport && event.pointerType !== 'mouse',
      };

      // Capture the pointer so we keep receiving moves even outside the
      // element (e.g. when the user drags past the book edges).
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // setPointerCapture can throw if the pointer is already released —
        // safe to ignore.
      }

      optionsRef.current.onStart?.(local);
    },
    [mobileScrollSupport, toLocal]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const state = stateRef.current;
      if (!state || state.pointerId !== event.pointerId) {
        return;
      }

      const now = performance.now();
      const local = toLocal(event.clientX, event.clientY);
      const sample: DragSample = { t: now, x: local.x, y: local.y };

      // For touch input, wait for the gesture to bias horizontally before
      // we claim it as a drag — otherwise pure vertical scrolls hit our
      // handler. Threshold: a quarter of `swipeDistance` to feel snappy.
      if (state.awaitingScrollDecision) {
        const dx = Math.abs(local.x - state.startPoint.x);
        const dy = Math.abs(local.y - state.startPoint.y);
        if (dx < swipeDistance / 4 && dy < swipeDistance / 4) {
          // Movement still tiny — keep waiting.
          return;
        }
        if (dy > dx) {
          // Vertical-biased — release the gesture (the scroll wins).
          state.active = false;
          stateRef.current = null;
          return;
        }
        state.awaitingScrollDecision = false;
      }

      state.lastPoint = local;
      state.samples = pruneSampleWindow([...state.samples, sample], now, velocityWindowMs);

      optionsRef.current.onMove?.(local);
    },
    [swipeDistance, toLocal, velocityWindowMs]
  );

  const finishDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
      const state = stateRef.current;
      if (!state || state.pointerId !== event.pointerId) {
        return;
      }

      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Pointer capture might already be lost — ignore.
      }

      stateRef.current = null;

      if (cancelled) {
        // We still emit a release so the consumer can revert the curl.
        optionsRef.current.onRelease?.({
          kind: 'click',
          duration: performance.now() - state.startTime,
          delta: { x: 0, y: 0 },
          releasePoint: state.lastPoint,
          velocity: { x: 0, y: 0 },
        });
        return;
      }

      const now = performance.now();
      const duration = now - state.startTime;
      const delta: Point = {
        x: state.lastPoint.x - state.startPoint.x,
        y: state.lastPoint.y - state.startPoint.y,
      };
      const velocity = computeReleaseVelocity(state.samples);
      const kind = classifyGesture({
        delta,
        duration,
        swipeDistance,
        swipeTimeThreshold,
      });

      optionsRef.current.onRelease?.({
        kind,
        duration,
        delta,
        releasePoint: state.lastPoint,
        velocity,
      });
    },
    [swipeDistance, swipeTimeThreshold]
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => finishDrag(event, false),
    [finishDrag]
  );
  const onPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLElement>) => finishDrag(event, true),
    [finishDrag]
  );

  const isDragging = useCallback(() => stateRef.current?.active === true, []);

  return useMemo(
    () => ({ onPointerDown, onPointerMove, onPointerUp, onPointerCancel, isDragging }),
    [onPointerDown, onPointerMove, onPointerUp, onPointerCancel, isDragging]
  );
}
