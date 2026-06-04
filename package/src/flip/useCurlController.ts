'use client';

import {
  type PointerEventHandler,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useFlipAnimator } from './animator';
import { type DragSummary, useDragController } from './drag';
import {
  clampReflectionTarget,
  computeReflectionFold,
  type Point,
  type ReflectionFold,
  shouldCompleteFold,
  turnAnchorY,
  type TurnOrigin,
  turnTargetY,
} from './geometry';

export interface FoldView {
  /** The active fold geometry (page coords), or `null` at rest. */
  fold: ReflectionFold | null;
  /** Which side the sheet rests on: `false` = right half, `true` = left half. */
  flipped: boolean;
}

export interface CurlControllerOptions {
  /** Sheet width in px (the play-zone is twice this). */
  width: number;
  /** Sheet height in px. */
  height: number;
  /** Progress (0–100) at/above which a release completes the flip. */
  threshold: number;
  /** Settle animation duration in ms. */
  flippingTime: number;
  swipeDistance?: number;
  swipeTimeThreshold?: number;
  mobileScrollSupport?: boolean;
  /** When true, the drag handlers are omitted (resting only). */
  disabled?: boolean;
  /**
   * Controlled resting side. When provided, the sheet rests on the given side
   * (`true` = left half) and external changes settle the sheet flat on the new
   * side; the internal flip still reports through `onFlip` so the owner can
   * update this value.
   */
  flipped?: boolean;
  /** Simulated grab point of a programmatic (controlled) turn. @default 'bottom' */
  turnOrigin?: TurnOrigin;
  /** The play-zone root element — used to map pointer → page-local coords. */
  rootRef: RefObject<HTMLDivElement | null>;
  onFold?: (info: { progress: number; phase: 'move' | 'settle' }) => void;
  onFlip?: (info: { flipped: boolean }) => void;
}

export interface CurlController extends FoldView {
  /** True while a fold is active (dragging or settling). */
  folding: boolean;
  /**
   * 0–100 curl amount, SIGNED toward the spine: it grows only as the grabbed
   * edge is dragged toward the spine, and is 0 when dragged away (so the WebGL
   * curl tracks the drag direction instead of any horizontal motion).
   */
  curlProgress: number;
  /** Pointer handlers to spread on the play-zone root (empty when disabled). */
  dragHandlers: {
    onPointerDown?: PointerEventHandler;
    onPointerMove?: PointerEventHandler;
    onPointerUp?: PointerEventHandler;
    onPointerCancel?: PointerEventHandler;
  };
}

/**
 * Single source of truth for a Curl's fold. Owns the grab → drag →
 * release-settle state machine, built on {@link useDragController} +
 * {@link useFlipAnimator} + the reflection-fold geometry. Both the DOM renderer
 * and (later) the WebGL renderer consume the same {@link FoldView}, so the two
 * can never diverge.
 */
export function useCurlController(options: CurlControllerOptions): CurlController {
  const {
    width: W,
    height: H,
    threshold,
    flippingTime,
    swipeDistance,
    swipeTimeThreshold,
    mobileScrollSupport,
    disabled,
    flipped: flippedProp,
    turnOrigin = 'bottom',
    rootRef,
    onFold,
    onFlip,
  } = options;

  const [view, setView] = useState<FoldView & { curlProgress: number }>({
    fold: null,
    flipped: flippedProp ?? false,
    curlProgress: 0,
  });

  const flippedRef = useRef(flippedProp ?? false);
  const foldRef = useRef<ReflectionFold | null>(null);
  // The grabbed point on the free edge (fold anchor) and the last clamped
  // target — the release settle animates the target from here.
  const anchorRef = useRef<Point>({ x: W, y: 0 });
  const lastTargetRef = useRef<Point | null>(null);
  const animator = useFlipAnimator();

  const setBoth = useCallback((f: ReflectionFold | null, flip: boolean, curlProgress = 0) => {
    foldRef.current = f;
    flippedRef.current = flip;
    setView({ fold: f, flipped: flip, curlProgress });
  }, []);

  // Controlled resting side: when the owner changes `flipped` (arrows, a
  // Group jumping to a page), run the SAME settle animation as a completed
  // drag — a simulated grab on the current free edge (at `turnOrigin`) swept
  // across to the opposite edge. Corner grabs arc toward the page middle so
  // the crease tilts like a real corner curl; a middle grab folds straight
  // over. The initial value never animates (the ref starts in sync).
  useEffect(() => {
    if (flippedProp === undefined || flippedProp === flippedRef.current) {
      return;
    }
    animator.stop();
    const wasFlipped = flippedRef.current;
    const anchor: Point = { x: wasFlipped ? -W : W, y: turnAnchorY(turnOrigin, H) };
    anchorRef.current = anchor;
    const toX = -anchor.x;
    animator.start({
      duration: flippingTime,
      onProgress: (eased) => {
        const raw: Point = {
          x: anchor.x + (toX - anchor.x) * eased,
          y: turnTargetY(turnOrigin, eased, H),
        };
        const t = clampReflectionTarget(anchor, raw, W, H);
        const f = computeReflectionFold(anchor, t, W, H);
        setBoth(f, wasFlipped, signedCurl(anchor, t));
        if (f) {
          onFoldRef.current?.({ progress: f.progress, phase: 'settle' });
        }
      },
      onComplete: () => {
        setBoth(null, flippedProp);
        onFlipRef.current?.({ flipped: flippedProp });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flippedProp]);

  // Curl amount signed toward the spine: positive only as the grabbed edge moves
  // toward x=0, clamped to 0 when moving away (so the curl follows the drag).
  const signedCurl = useCallback(
    (anchor: Point, target: Point): number => {
      const toward = (anchor.x - target.x) * (anchor.x < 0 ? -1 : 1);
      return Math.max(0, Math.min(100, (toward / (2 * W)) * 100));
    },
    [W]
  );

  // Keep the latest callbacks in refs so the handlers below stay stable.
  const onFoldRef = useRef(onFold);
  onFoldRef.current = onFold;
  const onFlipRef = useRef(onFlip);
  onFlipRef.current = onFlip;

  // Page-local coords: x = 0 is the spine (centre seam of the 2W play-zone),
  // x = W is the free right edge; y ∈ [0, H]. The sheet rests in the right half.
  const getLocalPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = rootRef.current?.getBoundingClientRect();
      const left = rect?.left ?? 0;
      const top = rect?.top ?? 0;
      return { x: clientX - left - W, y: clientY - top };
    },
    [W, rootRef]
  );

  const handleStart = useCallback(
    (local: Point) => {
      animator.stop();
      // Anchor = the grabbed point, snapped to the CURRENT free edge: the right
      // edge (x = +W) at rest, or the left edge (x = −W) once flipped (the sheet
      // then rests in the left half). ANY point along that edge is valid.
      anchorRef.current = { x: flippedRef.current ? -W : W, y: Math.max(0, Math.min(H, local.y)) };
      lastTargetRef.current = null;
      // Start flat; the first move creates the fold (no pop on grab).
      setBoth(null, flippedRef.current);
    },
    [W, H, animator, setBoth]
  );

  const handleMove = useCallback(
    (local: Point) => {
      const anchor = anchorRef.current;
      const target = clampReflectionTarget(anchor, local, W, H);
      lastTargetRef.current = target;
      const f = computeReflectionFold(anchor, target, W, H);
      setBoth(f, flippedRef.current, signedCurl(anchor, target));
      if (f) {
        onFoldRef.current?.({ progress: f.progress, phase: 'move' });
      }
    },
    [W, H, setBoth, signedCurl]
  );

  const handleRelease = useCallback(
    (summary: DragSummary) => {
      const current = foldRef.current;
      const wasFlipped = flippedRef.current;
      const anchor = anchorRef.current;
      const from = lastTargetRef.current;

      // A click (no real drag) just settles back to the current rest state.
      if (summary.kind === 'click' || !current || !from) {
        setBoth(null, wasFlipped);
        onFlipRef.current?.({ flipped: wasFlipped });
        return;
      }

      // Complete when dragged past the threshold, or on a fast swipe toward the
      // spine (side-aware — see shouldCompleteFold). Complete → sweep to the
      // OPPOSITE edge (full turn onto the other half); snap-back → return to the
      // anchor edge (rest, no fold).
      const complete = shouldCompleteFold(
        current.progress,
        threshold,
        summary.kind === 'swipe',
        summary.velocity.x,
        anchor.x
      );
      const to: Point = complete ? { x: -anchor.x, y: anchor.y } : { x: anchor.x, y: anchor.y };

      animator.start({
        duration: flippingTime,
        onProgress: (eased) => {
          const t: Point = {
            x: from.x + (to.x - from.x) * eased,
            y: from.y + (to.y - from.y) * eased,
          };
          const f = computeReflectionFold(anchor, t, W, H);
          setBoth(f, wasFlipped, signedCurl(anchor, t));
          if (f) {
            onFoldRef.current?.({ progress: f.progress, phase: 'settle' });
          }
        },
        onComplete: () => {
          // A completed fold toggles the resting side; otherwise snap back.
          const nowFlipped = complete ? !wasFlipped : wasFlipped;
          setBoth(null, nowFlipped);
          onFlipRef.current?.({ flipped: nowFlipped });
        },
      });
    },
    [W, H, threshold, flippingTime, animator, setBoth, signedCurl]
  );

  const drag = useDragController({
    swipeDistance,
    swipeTimeThreshold,
    mobileScrollSupport,
    getLocalPoint,
    onStart: handleStart,
    onMove: handleMove,
    onRelease: handleRelease,
  });

  const dragHandlers = disabled
    ? {}
    : {
        onPointerDown: drag.onPointerDown,
        onPointerMove: drag.onPointerMove,
        onPointerUp: drag.onPointerUp,
        onPointerCancel: drag.onPointerCancel,
      };

  return {
    fold: view.fold,
    flipped: view.flipped,
    folding: view.fold !== null,
    curlProgress: view.curlProgress,
    dragHandlers,
  };
}
