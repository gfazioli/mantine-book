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
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { CurlFace, type CurlFaceAlign, type CurlFaceProps } from '../CurlFace/CurlFace';
import { useFlipAnimator } from '../flip/animator';
import { type DragSummary, useDragController } from '../flip/drag';
import {
  clampCorner,
  computeFold,
  convertToSpread,
  type FlipCorner,
  type FoldGeometry,
  getFlatPartPolygon,
  getFlippingPageLocalPolygon,
  type Point,
  pointsToCssPolygon,
} from '../flip/geometry';
import classes from './Curl.module.css';

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export type CurlStylesNames =
  | 'root'
  | 'restSheet'
  | 'bottomFace'
  | 'curlSheet'
  | 'shadowLayer'
  | 'face';

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
  onFold?: (info: { progress: number; corner: FlipCorner; phase: 'move' | 'settle' }) => void;

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
  flipThreshold: 40,
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

  // Single combined state so a fold-clear and a flipped-toggle apply in ONE
  // render — otherwise the in-between render (fold cleared, flipped not yet
  // updated) flashes the resting Front for a frame.
  //
  // The fold math runs NATIVELY for the grabbed corner ('top' | 'bottom') —
  // computeFold/getFlippingPageLocalPolygon/getFlatPartPolygon are all given
  // the real corner. Only the BACK direction (after a flip) is realised with a
  // CSS scaleX(-1) mirror of the whole group; the bottom corner is NOT a
  // mirror, it is the geometry's own bottom solution.
  const [view, setView] = useState<{
    fold: FoldGeometry | null;
    flipped: boolean;
    corner: FlipCorner;
  }>({ fold: null, flipped: false, corner: 'top' });
  const fold = view.fold;
  const flipped = view.flipped;
  const activeCorner = view.corner;

  const flippedRef = useRef(false);
  const cornerRef = useRef<FlipCorner>('top');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const foldRef = useRef<FoldGeometry | null>(null);
  // Last clamped pointer position fed to computeFold — the release settle
  // animates FROM here so it starts exactly where the drag left off.
  const lastCursorRef = useRef<Point | null>(null);
  const animator = useFlipAnimator();

  // Atomic setter: keeps refs and state in sync in a single update.
  const setBoth = useCallback((g: FoldGeometry | null, f: boolean, c: FlipCorner) => {
    foldRef.current = g;
    flippedRef.current = f;
    cornerRef.current = c;
    setView({ fold: g, flipped: f, corner: c });
  }, []);

  const setFoldBoth = useCallback(
    (g: FoldGeometry | null) => setBoth(g, flippedRef.current, cornerRef.current),
    [setBoth]
  );

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

  /* --- Pointer → sheet-local mapping ---------------------------- */

  const getLocalPoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = rootRef.current?.getBoundingClientRect();
      const left = rect?.left ?? 0;
      const top = rect?.top ?? 0;
      const bx = clientX - left;
      // The hinge is the centre seam (play-zone x = W). For a FORWARD fold the
      // sheet is on the right (local x = bx - W); for a BACK fold it's on the
      // left, mirrored about the hinge (local x = W - bx). Either way the
      // active corner travels local-x W → 0 as it nears the hinge.
      return flippedRef.current ? { x: W - bx, y: clientY - top } : { x: bx - W, y: clientY - top };
    },
    [W]
  );

  const computeFor = useCallback(
    (cursor: Point): FoldGeometry | null => {
      // Clamp the dragged corner into the corner's valid fold domain so the
      // curl follows the pointer everywhere, SATURATES at its limits, and never
      // breaks/freezes/inverts — no matter how far the pointer roams. The same
      // single clamp covers the live drag and the release settle.
      const clamped = clampCorner(cursor, W, H, cornerRef.current);
      lastCursorRef.current = clamped;
      try {
        return computeFold({
          cursor: clamped,
          pageWidth: W,
          pageHeight: H,
          corner: cornerRef.current,
          direction: 'forward',
        });
      } catch {
        return null;
      }
    },
    [W, H]
  );

  /* --- Drag wiring ---------------------------------------------- */

  // StPageFlip / iBooks model: the fold is driven by the ABSOLUTE pointer
  // position in page-local coords (what `getLocalPoint` returns), NOT a delta
  // from the grabbed corner. This is what lets a grab anywhere along the edge
  // — corner OR mid-height — produce a clean, organic curl: the vertical
  // component stays meaningful as the page is swept toward the spine.

  const handleStart = useCallback(
    (local: Point) => {
      animator.stop();
      // Active corner = the half the grab lands in (StPageFlip's rule).
      const corner: FlipCorner = local.y >= H / 2 ? 'bottom' : 'top';
      lastCursorRef.current = null;
      // The grab itself sits on the edge (x ≈ W), a degenerate 180° fold, so
      // stay flat until the first move sweeps the pointer inward.
      setBoth(null, flippedRef.current, corner);
    },
    [H, animator, setBoth]
  );

  const handleMove = useCallback(
    (local: Point) => {
      const g = computeFor(local);
      if (g) {
        setFoldBoth(g);
        onFoldRef.current?.({
          progress: g.progress,
          corner: cornerRef.current,
          phase: 'move',
        });
      }
    },
    [computeFor, setFoldBoth]
  );

  const handleRelease = useCallback(
    (summary: DragSummary) => {
      const current = foldRef.current;
      const wasFlipped = flippedRef.current;
      const corner = cornerRef.current;

      // A click (no real drag) just settles back to the current rest state.
      if (summary.kind === 'click' || !current || !lastCursorRef.current) {
        setFoldBoth(null);
        onFlipRef.current?.({ flipped: wasFlipped });
        return;
      }

      // Complete when dragged past the threshold, or on a fast swipe toward
      // the spine (logical-x decreasing) even if the curl didn't reach it.
      const swipedForward = summary.kind === 'swipe' && summary.velocity.x < 0;
      const complete = current.progress >= threshold || swipedForward;

      // Settle from where the drag left off to the StPageFlip rest targets:
      // a completed turn lands flat past the spine at (−W, restY); a snap-back
      // returns flat to rest at (W, restY). clampCorner (inside computeFor)
      // keeps every intermediate frame valid.
      const restY = corner === 'bottom' ? H : 0;
      const from: Point = { ...lastCursorRef.current };
      const to: Point = complete ? { x: -W, y: restY } : { x: W, y: restY };

      animator.start({
        duration: flippingTime ?? 600,
        onProgress: (eased) => {
          const cursor: Point = {
            x: from.x + (to.x - from.x) * eased,
            y: from.y + (to.y - from.y) * eased,
          };
          const g = computeFor(cursor);
          if (g) {
            setFoldBoth(g);
            onFoldRef.current?.({ progress: g.progress, corner, phase: 'settle' });
          }
        },
        onComplete: () => {
          // A completed fold toggles the resting side; otherwise snap back.
          const nowFlipped = complete ? !wasFlipped : wasFlipped;
          setBoth(null, nowFlipped, corner);
          onFlipRef.current?.({ flipped: nowFlipped });
        },
      });
    },
    [H, W, threshold, flippingTime, animator, computeFor, setFoldBoth, setBoth]
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

  // Only the BACK direction mirrors the group (scaleX(-1)); counter-mirror the
  // face contents on the same axis so text/images stay upright and readable.
  // The bottom corner needs no mirror — it is rendered with native geometry.
  const faceMirror = flipped ? { transform: 'scaleX(-1)' } : undefined;
  const frontNode = (
    <div {...getStyles('face', { style: { ...frontFlex, ...faceMirror } })}>
      {faces.front?.content}
    </div>
  );
  const backNode = (
    <div {...getStyles('face', { style: { ...backFlex, ...faceMirror } })}>
      {faces.back?.content}
    </div>
  );

  /* --- Derived per-frame geometry ------------------------------- */

  const folding = fold !== null;

  // The face lying flat at rest, and the one shown on the lifting flap.
  // Geometry is computed NATIVELY for the active corner; only the back
  // direction is realised by mirroring the group (see render).
  const restFaceNode = flipped ? backNode : frontNode;
  const liftFaceNode = flipped ? frontNode : backNode;

  let curlClip: string | null = null;
  let curlTransform: string | undefined;
  let flatClip: string | null = null;

  if (fold) {
    const localPoly = getFlippingPageLocalPolygon(fold, activeCorner, 'forward');
    curlClip = pointsToCssPolygon(localPoly, 'px');
    const globalPos = convertToSpread(fold.position, 'forward', W);
    curlTransform = `translate3d(${globalPos.x.toFixed(3)}px, ${globalPos.y.toFixed(3)}px, 0) rotate(${fold.angle.toFixed(5)}rad)`;
    // Resting face keeps only the still-flat region; the lifted area is left
    // transparent (single sheet — nothing underneath).
    flatClip = pointsToCssPolygon(getFlatPartPolygon(fold, activeCorner, W, H, 'forward'), 'px');
  }

  const curlVisible = folding && curlClip !== null;

  /* --- Render --------------------------------------------------- */

  return (
    <Box
      ref={setRootRef}
      {...getStyles('root')}
      {...others}
      {...dragHandlers}
      mod={[{ folding, flipped, corner: activeCorner, disabled }, mod]}
    >
      {/* Mirror wrapper: the curl geometry is native per corner. Only the BACK
          direction (after a flip) mirrors the group with scaleX(-1); the bottom
          corner is rendered directly from its own geometry. */}
      <div className={classes.mirror} style={flipped ? { transform: 'scaleX(-1)' } : undefined}>
        {/* Resting face (Front at rest, Back once flipped). Full when idle;
            clipped to the still-flat region while folding so the lifted area
            shows through to the background (single sheet — nothing under it). */}
        <div
          {...getStyles('restSheet', {
            style:
              folding && flatClip ? { clipPath: flatClip, WebkitClipPath: flatClip } : undefined,
          })}
        >
          {restFaceNode}
        </div>

        {/* The lifting flap (the opposite face). Always mounted (hidden at rest)
            so content + handlers persist and aren't re-created each fold. */}
        <div
          {...getStyles('curlSheet', {
            style: curlVisible
              ? { transform: curlTransform, clipPath: curlClip!, WebkitClipPath: curlClip! }
              : { display: 'none' },
          })}
        >
          {/* The bottom-corner flap's local clip polygon lives in y ∈ [-H, 0]
              (above the box origin), so its face content must be lifted by one
              page height to sit under the clip. The top corner needs no shift
              (its polygon is in y ∈ [0, H]). */}
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: activeCorner === 'bottom' ? 'translateY(-100%)' : undefined,
            }}
          >
            {liftFaceNode}
          </div>
        </div>
      </div>

      {/* TODO(shadows): the curl shadows (crease + drop) are temporarily
          disabled. The StPageFlip shadow port smeared a black band past the
          sheet; they'll be reintroduced once the base curl geometry is
          validated. `shadowLayer` stylesName + shadow.ts stay in place. */}
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
