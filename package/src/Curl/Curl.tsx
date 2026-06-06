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
  useMantineTheme,
  useProps,
  useStyles,
} from '@mantine/core';
import React, { lazy, Suspense, useCallback, useId, useMemo, useRef, useState } from 'react';
import { CurlFace, type CurlFaceAlign, type CurlFaceProps } from '../CurlFace/CurlFace';
import {
  computeFoldShadow,
  type Point,
  pointsToCssPolygon,
  type TurnOrigin,
} from '../flip/geometry';
import { useCurlController } from '../flip/useCurlController';
import classes from './Curl.module.css';

// Lazy so the WebGL renderer + html-to-image never enter the SSR / initial
// bundle — only loaded when a `variant="rounded"` curl actually mounts.
const CurlWebglLayer = lazy(() =>
  import('./webgl/CurlWebglLayer').then((m) => ({ default: m.CurlWebglLayer }))
);

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export type CurlStylesNames =
  | 'root'
  | 'restSheet'
  | 'curlSheet'
  | 'shadowLayer'
  | 'revealLayer'
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
  /** Page width in CSS px. The play-zone is twice this. @default 300 */
  width?: number;

  /** Page height in CSS px. @default 600 */
  height?: number;

  /** Default content alignment for both faces. @default center / center */
  align?: CurlFaceAlign;

  /** Maximum opacity of the curl shadows. @default 0.5 */
  shadowOpacity?: number;

  /** Color used for the curl shadows. @default 'dark.9' */
  shadowColor?: MantineColor | string;

  /** Background color applied to each face. @default 'white' */
  pageBackground?: MantineColor | string;

  /**
   * Layer painted under this page, shown through the area the curl uncovers.
   * When unset no layer is rendered and the uncovered region shows whatever
   * sits beneath (the next page in a Book, or the Book's inside cover).
   */
  revealBackground?: MantineColor | string;

  /**
   * Curl radius in px for `variant="rounded"` — smaller wraps tighter and turns
   * the page sooner; larger is a gentler, looser curl. @default ~0.32 × width
   */
  curlRadius?: number;

  /** Disable the drag interaction entirely (resting only). @default false */
  disabled?: boolean;

  /**
   * `variant="rounded"` only: keep the face snapshots (the WebGL textures)
   * captured eagerly at rest, so a fold starts with its textures ready. The
   * Book sets this on the two top-of-stack pages and clears it on buried
   * ones — a big book pays for one warm spread instead of a snapshot per
   * page. When `false` the capture runs on demand as the fold starts (the
   * flat fold shows until the first WebGL frame lands). @default true
   */
  warmSnapshots?: boolean;

  /**
   * Controlled resting side: `false` rests in the right half, `true` in the
   * left half (turned). When set, external changes run an animated turn onto
   * the new side; use together with `onFlip` to own the state (the Book does
   * this for each page).
   */
  flipped?: boolean;

  /**
   * Pointer surface used to start a fold. `'play-zone'` (default) grabs from
   * anywhere in the 2×W play-zone; `'sheet'` only from the resting page
   * itself — inside a Book this is what routes the right half to the current
   * page and the left half to the previously turned one.
   * @default 'play-zone'
   */
  grabZone?: 'play-zone' | 'sheet';

  /**
   * Where a programmatic (controlled) turn pretends to grab the free edge:
   * `'bottom'` / `'top'` curl from that corner with a diagonal crease,
   * `'middle'` folds the page straight over. Only affects turns driven by the
   * `flipped` / `page` state — a real drag always follows the pointer.
   * @default 'bottom'
   */
  turnOrigin?: TurnOrigin;

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

  /** Faces — Book.Page.Front and the optional Book.Page.Back. */
  children?: React.ReactNode;
}

export interface CurlProps extends BoxProps, CurlBaseProps, StylesApiProps<CurlFactory> {}

export type CurlFactory = Factory<{
  props: CurlProps;
  ref: HTMLDivElement;
  stylesNames: CurlStylesNames;
  vars: CurlCssVariables;
  /**
   * Curl renderer. `'flat'` is the DOM reflection fold (default, fully
   * interactive at rest, the universal fallback); `'rounded'` is the true 3D
   * WebGL curl — a crease-aligned cylinder wrap (the faces are a static
   * snapshot during the curl, live at rest).
   */
  variant: 'flat' | 'rounded';
  staticComponents: {
    Front: typeof CurlFace;
    Back: typeof CurlFace;
  };
}>;

const defaultProps: Partial<CurlProps> = {
  width: 300,
  height: 600,
  variant: 'flat',
  shadowOpacity: 0.5,
  shadowColor: 'dark.9',
  pageBackground: 'white',
  disabled: false,
  grabZone: 'play-zone',
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
    variant,
    shadowOpacity,
    shadowColor,
    pageBackground: _pb,
    revealBackground,
    curlRadius,
    disabled,
    warmSnapshots,
    flipped: flippedProp,
    grabZone,
    turnOrigin,
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

  // `rounded` opts into the WebGL cone curl; on any WebGL/snapshot failure we
  // latch back to the flat DOM fold for the rest of the session.
  const [webglFailed, setWebglFailed] = useState(false);
  const rounded = variant === 'rounded' && !webglFailed;

  // Unique SVG gradient id per instance (multiple Curls / a future Book must
  // not share `url(#id)` defs). useId() contains ':' which is invalid in a CSS
  // url() reference, so strip it.
  const shadowGradientId = `curl-shadow-${useId().replace(/:/g, '')}`;

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

  /* --- Fold controller (single source of truth) ----------------- */

  const rootRef = useRef<HTMLDivElement | null>(null);

  // Owns the grab → drag → release-settle state machine (reflection fold). The
  // DOM renderer below and the future WebGL renderer both consume this one
  // FoldView, so they can never diverge. `flipped` only swaps which face
  // rests vs lifts; see RESEARCH-page-curl.md for the model.
  const { fold, flipped, folding, dragHandlers } = useCurlController({
    width: W,
    height: H,
    threshold,
    flippingTime: flippingTime ?? 600,
    swipeDistance,
    swipeTimeThreshold,
    mobileScrollSupport,
    disabled,
    flipped: flippedProp,
    turnOrigin,
    rootRef,
    onFold,
    onFlip,
  });

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

  /* --- Face content (rendered once, React-owned) ---------------- */

  // No per-face mirror: the reflection matrix (det −1) mirrors the lifted flap
  // automatically; the resting face is flat and unmirrored.
  // dragstart is prevented so a grab on an image starts the page-turn instead
  // of the browser's native image drag (the CSS -webkit-user-drag handles
  // WebKit; this covers Firefox).
  const preventNativeDrag = useCallback((event: React.DragEvent) => event.preventDefault(), []);
  const frontNode = (
    <div {...getStyles('face', { style: frontFlex })} onDragStart={preventNativeDrag}>
      {faces.front?.content}
    </div>
  );
  const backNode = (
    <div {...getStyles('face', { style: backFlex })} onDragStart={preventNativeDrag}>
      {faces.back?.content}
    </div>
  );

  // The face lying flat at rest, and the one shown on the lifting flap.
  const restFaceNode = flipped ? backNode : frontNode;
  const liftFaceNode = flipped ? frontNode : backNode;

  /* --- Derived per-frame geometry ------------------------------- */

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

  // In rounded mode the WebGL cone replaces the DOM flap while folding.
  const webglActive = rounded && folding;
  // True once the shared canvas holds a frame for the CURRENT fold: the DOM
  // resting sheet stays visible (flat clipped fold) until then, so the page
  // beneath never flashes through before the first WebGL frame.
  const [webglReady, setWebglReady] = useState(false);
  // Until that frame lands, the DOM reflection flap stands in for the WebGL
  // curl (always in flat mode): a rounded fold whose snapshots are still
  // capturing shows the genuine flat fold — flap included — instead of half a
  // page retreating with nothing lifting.
  const flatFoldVisible = !rounded || (webglActive && !webglReady);
  // Curl radius for the WebGL wrap; default lets a full drag turn the page.
  const radius = curlRadius ?? Math.round(W * 0.32);
  // Resolved shadow color (a CSS string) for the WebGL self-shadow tint — the
  // flat path uses the `--curl-shadow-color` CSS var instead.
  const theme = useMantineTheme();
  const resolvedShadowColor = getThemeColor(shadowColor ?? 'dark.9', theme);

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

  // grabZone="sheet": the play-zone root lets pointers pass through (so the
  // other half can belong to a sibling sheet in a Group); only the resting
  // sheet itself starts a fold — its pointerdown bubbles to the root handlers.
  const sheetGrab = grabZone === 'sheet';

  return (
    <Box
      ref={setRootRef}
      {...getStyles('root', { style: sheetGrab ? { pointerEvents: 'none' } : undefined })}
      {...others}
      {...dragHandlers}
      mod={[{ folding, flipped, disabled }, mod]}
    >
      {/* Reveal layer: what the curl uncovers UNDER this page. Painted only
          when `revealBackground` is set — sits beneath the resting sheet on
          the same half, so it shows through the clipped region while folding.
          (Inside a Book the natural reveal is the next page in the stack; the
          Book-level inside-cover base lives on the Book root instead.) */}
      {revealBackground !== undefined && (
        <div {...getStyles('revealLayer', { style: { left: restLeft } })} aria-hidden="true" />
      )}

      {/* Resting face (Front in the right half; Back in the left half once
          flipped). Full when idle; clipped to the still-flat (spine-side)
          region while folding so the lifted area shows the background. */}
      <div
        {...getStyles('restSheet', {
          style: {
            left: restLeft,
            // Re-enable pointers on the resting half when the root is a
            // pass-through surface (grabZone="sheet").
            ...(sheetGrab && !disabled ? { pointerEvents: 'auto' } : null),
            // While the WebGL curl is drawing it shows the whole page itself;
            // until its first frame lands, keep the flat clipped fold visible.
            ...(webglActive && webglReady
              ? { display: 'none' }
              : folding && flatClip
                ? { clipPath: flatClip, WebkitClipPath: flatClip }
                : null),
          },
        })}
      >
        {restFaceNode}
      </div>

      {/* The lifting flap (the opposite face), clipped to the flap region and
          reflected across the crease (the det −1 matrix also mirrors it to show
          the back). Sits on the resting side; overflow stays visible so the
          reflected flap can sweep across the spine to the other half. In
          rounded mode the WebGL curl draws the lifting page instead — but the
          DOM flap still stands in until the first WebGL frame is ready. */}
      {flatFoldVisible && (
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
          <div style={{ width: '100%', height: '100%', transform: 'scaleX(-1)' }}>
            {liftFaceNode}
          </div>
        </div>
      )}

      {/* Curl shading: a gradient over the reflected flap (dark at the crease →
          transparent at the free edge), painted in an SVG overlay that spans the
          whole play-zone (so page coords map as x + W). The cast halo is the
          curlSheet's drop-shadow filter above. Follows the DOM flap (flat mode,
          or the rounded stand-in before the first WebGL frame) — WebGL lights
          its own curl. */}
      {flatFoldVisible && shadow && curlVisible && shadowPoints && (
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

      {/* WebGL cone curl (opt-in `variant="rounded"`). Lazy + client-only; the
          live faces stay mounted as the restSheet above (interactive at rest)
          and are snapshotted to textures during the curl. Falls back to the flat
          DOM fold if WebGL is unavailable or a snapshot taints. */}
      {rounded && (
        <Suspense fallback={null}>
          <CurlWebglLayer
            width={W}
            height={H}
            active={webglActive}
            fold={fold}
            flipped={flipped}
            curlRadius={radius}
            shadowOpacity={shadowOp}
            shadowColor={resolvedShadowColor}
            frontContent={restFaceNode}
            backContent={liftFaceNode}
            warm={warmSnapshots}
            onUnavailable={() => setWebglFailed(true)}
            onReadyChange={setWebglReady}
          />
        </Suspense>
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
 * factory's `staticComponents` signature is satisfied. Exported so `Book.Page`
 * can mint its own `Front`/`Back` markers with proper display names.
 */
export function makeFaceMarker(slot: 'front' | 'back', name: string): typeof CurlFace {
  const Marker = (_props: CurlFaceProps): null => null;
  Marker.displayName = name;
  (Marker as typeof Marker & { __curlSlot: 'front' | 'back' }).__curlSlot = slot;
  return Marker as unknown as typeof CurlFace;
}

Curl.Front = makeFaceMarker('front', 'Curl.Front');
Curl.Back = makeFaceMarker('back', 'Curl.Back');
