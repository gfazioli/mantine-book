'use client';

import {
  Box,
  type BoxProps,
  createVarsResolver,
  factory,
  type Factory,
  getThemeColor,
  type MantineColor,
  type StylesApiProps,
  useProps,
  useStyles,
} from '@mantine/core';
import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import { CurlFace, type CurlFaceAlign, type CurlFaceProps } from '../CurlFace/CurlFace';
import { useFlipAnimator } from '../flip/animator';
import { type DragSummary, useDragController } from '../flip/drag';
import {
  clampReflectionTarget,
  computeFoldShadow,
  computeReflectionFold,
  type Point,
  pointsToCssPolygon,
  type ReflectionFold,
  shouldCompleteFold,
} from '../flip/geometry';
import classes from './Curl.module.css';

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export type CurlStylesNames = 'root' | 'restSheet' | 'curlSheet' | 'shadowLayer' | 'face';

export type CurlCssVariables = {
  root:
    | '--curl-page-width'
    | '--curl-page-height'
    | '--curl-page-background'
    | '--curl-reveal-background'
    | '--curl-shadow-color';
};

export interface CurlBaseProps {
  /** Sheet width in CSS px. The play-zone is twice this. @default 300 */
  width?: number;

  /** Sheet height in CSS px. @default 600 */
  height?: number;

  /** Default content alignment for both faces. @default center / center */
  align?: CurlFaceAlign;

  /** Maximum opacity of the curl shadows. @default 0.5 */
  shadowOpacity?: number;

  /** Color used for the curl shadows. @default 'dark.9' */
  shadowColor?: MantineColor | string;

  /** Background color applied to each face. @default 'white' */
  pageBackground?: MantineColor | string;

  /** Background shown in the area uncovered by the curl. @default same as pageBackground */
  revealBackground?: MantineColor | string;

  /** Disable the drag interaction entirely (resting only). @default false */
  disabled?: boolean;

  /** Duration in ms of the settle animation after release. @default 600 */
  flippingTime?: number;

  /** Progress (0–100) at/above which a release completes the flip to B. @default 50 */
  flipThreshold?: number;

  /** Distance in px a swipe must cover to trigger a flip. @default 30 */
  swipeDistance?: number;

  /** Max duration in ms for a fast gesture to still count as a swipe. @default 250 */
  swipeTimeThreshold?: number;

  /** On touch, wait for a horizontal-bias gesture before claiming the drag. @default true */
  mobileScrollSupport?: boolean;

  /** Called as the fold changes (during drag and during the settle animation). */
  onFold?: (info: { progress: number; phase: 'move' | 'settle' }) => void;

  /** Called once when a release settle finishes, with the resting state. */
  onFlip?: (info: { flipped: boolean }) => void;

  /** Faces — `<Curl.Front>` and optional `<Curl.Back>`. */
  children?: React.ReactNode;
}

export interface CurlProps extends BoxProps, CurlBaseProps, StylesApiProps<CurlFactory> {}

export type CurlFactory = Factory<{
  props: CurlProps;
  ref: HTMLDivElement;
  stylesNames: CurlStylesNames;
  vars: CurlCssVariables;
  staticComponents: {
    Front: typeof CurlFace;
    Back: typeof CurlFace;
  };
}>;

const defaultProps: Partial<CurlProps> = {
  width: 300,
  height: 600,
  shadowOpacity: 0.5,
  shadowColor: 'dark.9',
  pageBackground: 'white',
  disabled: false,
  flippingTime: 600,
  flipThreshold: 50,
  swipeDistance: 30,
  swipeTimeThreshold: 250,
  mobileScrollSupport: true,
};

const varsResolver = createVarsResolver<CurlFactory>(
  (theme, { width, height, pageBackground, revealBackground, shadowColor }) => ({
    root: {
      '--curl-page-width': `${width}px`,
      '--curl-page-height': `${height}px`,
      '--curl-page-background':
        pageBackground === undefined ? undefined : getThemeColor(pageBackground, theme),
      '--curl-reveal-background':
        revealBackground === undefined ? undefined : getThemeColor(revealBackground, theme),
      '--curl-shadow-color':
        shadowColor === undefined ? undefined : getThemeColor(shadowColor, theme),
    },
  })
);

/* ------------------------------------------------------------------ */
/*  Children parsing                                                   */
/* ------------------------------------------------------------------ */

interface ParsedFaces {
  front: { content: React.ReactNode; align?: CurlFaceAlign } | null;
  back: { content: React.ReactNode; align?: CurlFaceAlign } | null;
}

function parseFaces(children: React.ReactNode): ParsedFaces {
  const result: ParsedFaces = { front: null, back: null };
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }
    const props = child.props as CurlFaceProps;
    const name = (child.type as { displayName?: string })?.displayName;
    const slot = (child.type as { __curlSlot?: 'front' | 'back' })?.__curlSlot;
    const face = { content: props.children, align: props.align };
    if (slot === 'front' || name === 'Curl.Front') {
      result.front = face;
    } else if (slot === 'back' || name === 'Curl.Back') {
      result.back = face;
    }
  });
  return result;
}

/** Maps an align spec to flex justify/align CSS values. */
function alignToFlex(align?: CurlFaceAlign): { justifyContent: string; alignItems: string } {
  const map = { start: 'flex-start', center: 'center', end: 'flex-end' } as const;
  return {
    justifyContent: map[align?.horizontal ?? 'center'],
    alignItems: map[align?.vertical ?? 'center'],
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Curl = factory<CurlFactory>((_props) => {
  const { ref, ...restProps } = _props as typeof _props & { ref?: React.Ref<HTMLDivElement> };
  const props = useProps('Curl', defaultProps, restProps);
  const {
    width,
    height,
    align,
    shadowOpacity,
    shadowColor: _sc,
    pageBackground: _pb,
    revealBackground: _rb,
    disabled,
    flippingTime,
    flipThreshold,
    swipeDistance,
    swipeTimeThreshold,
    mobileScrollSupport,
    onFold,
    onFlip,
    children,
    classNames,
    style,
    styles,
    unstyled,
    vars,
    className,
    mod,
    ...others
  } = props;

  const W = width ?? 300;
  const H = height ?? 600;
  const threshold = flipThreshold ?? 50;

  // Unique SVG gradient id per instance (multiple Curls / a future Book must
  // not share `url(#id)` defs). useId() contains ':' which is invalid in a CSS
  // url() reference, so strip it.
  const shadowGradientId = `curl-shadow-${useId().replace(/:/g, '')}`;

  // Unique gradient ids per instance (multiple Curls / a future Book must
  // not share SVG defs ids).

  const getStyles = useStyles<CurlFactory>({
    name: 'Curl',
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
  });

  /* --- Faces (parsed once per children change) ------------------ */

  const faces = useMemo(() => parseFaces(children), [children]);
  const frontFlex = useMemo(() => alignToFlex(faces.front?.align ?? align), [faces.front, align]);
  const backFlex = useMemo(() => alignToFlex(faces.back?.align ?? align), [faces.back, align]);

  /* --- Fold state ----------------------------------------------- */

  // Unified REFLECTION fold: the grabbed point on the free edge folds onto the
  // pointer; the crease is the perpendicular bisector of grab→pointer and the
  // lifted flap is reflected across it. ONE path covers every grab point and
  // every drag direction (corner, mid-edge, up/down) — no corners/zones/modes.
  // See RESEARCH-page-curl.md. `flipped` only swaps which face rests vs lifts.
  const [view, setView] = useState<{ fold: ReflectionFold | null; flipped: boolean }>({
    fold: null,
    flipped: false,
  });
  const fold = view.fold;
  const flipped = view.flipped;

  const flippedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const foldRef = useRef<ReflectionFold | null>(null);
  // The grabbed point on the free edge (fold anchor) and the last clamped
  // target — the release settle animates the target from here.
  const anchorRef = useRef<Point>({ x: W, y: 0 });
  const lastTargetRef = useRef<Point | null>(null);
  const animator = useFlipAnimator();

  const setBoth = useCallback((f: ReflectionFold | null, flip: boolean) => {
    foldRef.current = f;
    flippedRef.current = flip;
    setView({ fold: f, flipped: flip });
  }, []);

  const onFoldRef = useRef(onFold);
  onFoldRef.current = onFold;
  const onFlipRef = useRef(onFlip);
  onFlipRef.current = onFlip;

  /* --- Forward parent ref --------------------------------------- */

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref]
  );

  /* --- Pointer → page-local mapping ----------------------------- */

  // Page-local coords: x = 0 is the spine (centre seam of the 2W play-zone),
  // x = W is the free right edge; y ∈ [0, H]. The sheet rests in the right half.
  const getLocalPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = rootRef.current?.getBoundingClientRect();
      const left = rect?.left ?? 0;
      const top = rect?.top ?? 0;
      return { x: clientX - left - W, y: clientY - top };
    },
    [W]
  );

  /* --- Drag wiring ---------------------------------------------- */

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
      setBoth(f, flippedRef.current);
      if (f) {
        onFoldRef.current?.({ progress: f.progress, phase: 'move' });
      }
    },
    [W, H, setBoth]
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
        duration: flippingTime ?? 600,
        onProgress: (eased) => {
          const t: Point = {
            x: from.x + (to.x - from.x) * eased,
            y: from.y + (to.y - from.y) * eased,
          };
          const f = computeReflectionFold(anchor, t, W, H);
          setBoth(f, wasFlipped);
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
    [W, H, threshold, flippingTime, animator, setBoth]
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

  /* --- Face content (rendered once, React-owned) ---------------- */

  // No per-face mirror: the reflection matrix (det −1) mirrors the lifted flap
  // automatically; the resting face is flat and unmirrored.
  const frontNode = <div {...getStyles('face', { style: frontFlex })}>{faces.front?.content}</div>;
  const backNode = <div {...getStyles('face', { style: backFlex })}>{faces.back?.content}</div>;

  // The face lying flat at rest, and the one shown on the lifting flap.
  const restFaceNode = flipped ? backNode : frontNode;
  const liftFaceNode = flipped ? frontNode : backNode;

  /* --- Derived per-frame geometry ------------------------------- */

  const folding = fold !== null;

  // The resting sheet (and the fold layers) sit on the current side: the right
  // half at rest, the left half once flipped. Geometry from `computeReflectionFold`
  // is in PAGE coords (spine at x = 0); a layer placed on the left half has its
  // local origin at page x = −W, so we shift page coords by `off` into local.
  const restLeft = flipped ? 0 : W;
  const off = flipped ? W : 0;
  const shift = (poly: Point[]): Point[] => poly.map((p) => ({ x: p.x + off, y: p.y }));
  const flatClip = fold ? pointsToCssPolygon(shift(fold.flatFront), 'px') : null;
  const flapClip = fold ? pointsToCssPolygon(shift(fold.flap), 'px') : null;
  const flapMatrix = fold
    ? (() => {
        const [a, b, c, d, e, f] = fold.matrix;
        // Conjugate the page-space reflection by the local-origin x-shift.
        const el = e + off * (1 - a);
        const fl = f - b * off;
        return `matrix(${[a, b, c, d, el, fl].map((n) => n.toFixed(5)).join(', ')})`;
      })()
    : undefined;
  const curlVisible = folding && flapClip !== null;

  /* --- Shadows -------------------------------------------------- */

  // Two contributions, both derived from the crease (creaseMid + creaseDir):
  //  • shadingPolygon — the reflected flap, painted with a gradient that is dark
  //    at the crease and fades to nothing at the free edge (the back face reads
  //    darkest where it curves away). Drawn in an SVG overlay (z-index above the
  //    flap) spanning the FULL play-zone, so page coords map as playzoneX = x+W.
  //  • cast drop-shadow — a soft halo around the lifted flap (filter on curlSheet).
  const shadowOp = shadowOpacity ?? 0;
  const shadow = fold && shadowOp > 0 ? computeFoldShadow(fold, W) : null;
  const shadowPoints = shadow
    ? shadow.flapPolygon.map((p) => `${(p.x + W).toFixed(2)},${p.y.toFixed(2)}`).join(' ')
    : '';
  const castShadow = shadow
    ? `drop-shadow(0 1px ${(5 + 15 * shadow.strength).toFixed(1)}px ` +
      `color-mix(in srgb, var(--curl-shadow-color) ${(shadowOp * shadow.strength * 55).toFixed(1)}%, transparent))`
    : undefined;

  /* --- Render --------------------------------------------------- */

  return (
    <Box
      ref={setRootRef}
      {...getStyles('root')}
      {...others}
      {...dragHandlers}
      mod={[{ folding, flipped, disabled }, mod]}
    >
      {/* Resting face (Front in the right half; Back in the left half once
          flipped). Full when idle; clipped to the still-flat (spine-side)
          region while folding so the lifted area shows the background. */}
      <div
        {...getStyles('restSheet', {
          style: {
            left: restLeft,
            ...(folding && flatClip ? { clipPath: flatClip, WebkitClipPath: flatClip } : null),
          },
        })}
      >
        {restFaceNode}
      </div>

      {/* The lifting flap (the opposite face), clipped to the flap region and
          reflected across the crease (the det −1 matrix also mirrors it to show
          the back). Sits on the resting side; overflow stays visible so the
          reflected flap can sweep across the spine to the other half. */}
      <div
        {...getStyles('curlSheet', {
          style: curlVisible
            ? {
                left: restLeft,
                transformOrigin: '0 0',
                transform: flapMatrix,
                clipPath: flapClip!,
                WebkitClipPath: flapClip!,
                filter: castShadow,
              }
            : { display: 'none' },
        })}
      >
        {/* Pre-mirror the flap content so the det−1 reflection matrix composes
            to a PROPER rotation: the back face reads correctly (just rotated
            with the flap) instead of appearing mirror-reversed. */}
        <div style={{ width: '100%', height: '100%', transform: 'scaleX(-1)' }}>{liftFaceNode}</div>
      </div>

      {/* Curl shading: a gradient over the reflected flap (dark at the crease →
          transparent at the free edge), painted in an SVG overlay that spans the
          whole play-zone (so page coords map as x + W). The cast halo is the
          curlSheet's drop-shadow filter above. */}
      {shadow && curlVisible && shadowPoints && (
        <svg {...getStyles('shadowLayer')} width={W * 2} height={H} aria-hidden="true">
          <defs>
            <linearGradient
              id={shadowGradientId}
              gradientUnits="userSpaceOnUse"
              x1={shadow.gradient.x1 + W}
              y1={shadow.gradient.y1}
              x2={shadow.gradient.x2 + W}
              y2={shadow.gradient.y2}
            >
              <stop
                offset="0"
                stopColor="var(--curl-shadow-color)"
                stopOpacity={shadowOp * shadow.strength}
              />
              <stop offset="1" stopColor="var(--curl-shadow-color)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon points={shadowPoints} fill={`url(#${shadowGradientId})`} />
        </svg>
      )}
    </Box>
  );
});

Curl.classes = classes;
Curl.displayName = 'Curl';

/**
 * Two distinct marker components (each its own function object so the
 * `__curlSlot` tag and `displayName` don't collide). Both render nothing —
 * `Curl` reads their props via `React.Children`. Typed as `CurlFace` so the
 * factory's `staticComponents` signature is satisfied.
 */
function makeFaceMarker(slot: 'front' | 'back', name: string): typeof CurlFace {
  const Marker = (_props: CurlFaceProps): null => null;
  Marker.displayName = name;
  (Marker as typeof Marker & { __curlSlot: 'front' | 'back' }).__curlSlot = slot;
  return Marker as unknown as typeof CurlFace;
}

Curl.Front = makeFaceMarker('front', 'Curl.Front');
Curl.Back = makeFaceMarker('back', 'Curl.Back');
