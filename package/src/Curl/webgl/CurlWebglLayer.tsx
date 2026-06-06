'use client';

import React, {
  type CSSProperties,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import type { ReflectionFold } from '../../flip/geometry';
import { CurlGlRenderer } from './glRenderer';
import { type CurlGlLease, CurlWebglPool } from './pool';
import { CurlWebglPoolContext, type CurlWebglPoolHolder } from './poolContext';
import { captureFaceTexture } from './snapshot';

const DEFAULT_SHADOW_RGB: [number, number, number] = [0.1, 0.1, 0.12];

/** Parse any CSS color string to [r, g, b] in 0–1 via a throwaway 1×1 canvas. */
function cssColorToRgb(color: string | undefined): [number, number, number] {
  if (!color || typeof document === 'undefined') {
    return DEFAULT_SHADOW_RGB;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return DEFAULT_SHADOW_RGB;
  }
  ctx.fillStyle = '#1a1b1e';
  ctx.fillStyle = color; // an invalid color leaves the fallback fillStyle
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

/** Last stretch of the turn over which the curl radius dives to ~0. */
const RADIUS_TAIL = 0.18;

/**
 * Drive the renderer from a fold: the crease (midpoint + direction) becomes the
 * wrap axis, so the curl follows the drag in any direction. `n` is the crease
 * normal pointing toward the grabbed edge (= −dragDir = (−creaseDir.y, creaseDir.x)).
 * Returns whether a frame was actually drawn (false while the fold is null).
 */
function renderFold(
  renderer: CurlGlRenderer,
  fold: ReflectionFold | null,
  flipped: boolean,
  width: number,
  maxRadius: number,
  shadowOpacity: number,
  shadowColor: readonly [number, number, number]
): boolean {
  if (!fold) {
    return false;
  }
  const nx = -fold.creaseDir.y;
  const ny = fold.creaseDir.x;
  const sheetLeft = flipped ? -width : 0;
  // Adaptive radius: full (rounded) at the start of the peel, shrinking as the
  // fold completes. Wrapping a cylinder lifts the page by 2r and shortens the
  // curl by ~π·r, so any residual radius at the end shows as a visible snap
  // when the DOM resting face takes over. Linear early (the full rounded
  // look), then a quadratic dive to ~0 over the last stretch: the wrap
  // CONVERGES to the exact flat reflection (r→0 == the flat fold, sub-pixel
  // lift) before the handoff, so the page "lands" with no settle jump.
  const t = fold.progress / 100;
  const shape = t < 1 - RADIUS_TAIL ? 1 - t : ((1 - t) * (1 - t)) / RADIUS_TAIL;
  const r = Math.max(0.05, maxRadius * shape);
  renderer.render(
    fold.creaseMid.x,
    fold.creaseMid.y,
    nx,
    ny,
    r,
    sheetLeft,
    shadowOpacity,
    shadowColor
  );
  return true;
}

export interface CurlWebglLayerProps {
  /** Sheet width in px (play-zone is 2×). */
  width: number;
  /** Sheet height in px. */
  height: number;
  /** True while a fold is active (dragging or settling) — shows the canvas. */
  active: boolean;
  /** The active reflection fold (crease + geometry) that drives the curl. */
  fold: ReflectionFold | null;
  /** Which side the sheet rests on (false = right, true = left). */
  flipped: boolean;
  /** Curl radius in px (smaller = tighter wrap / turns sooner). */
  curlRadius: number;
  /** Self-shadow strength (0–1) shading the curl as it curves away. */
  shadowOpacity: number;
  /** Resolved CSS color the self-shadow tints toward (= shadowColor). */
  shadowColor?: string;
  /** Page background painted behind each captured face. */
  pageBackground?: string;
  /** Front / back face content — rendered off-screen only as snapshot sources. */
  frontContent: ReactNode;
  backContent: ReactNode;
  /**
   * Keep the face snapshots warm: capture eagerly at rest so a fold starts
   * with its textures ready. The Book enables this only on the two
   * top-of-stack pages (the only ones a pointer can grab — and, during a
   * riffle, the page about to step), so a 100-page book pays for 2 snapshots,
   * not 200. A cold page captures on demand when its fold starts; until that
   * frame lands the parent keeps the flat fold visible. @default true
   */
  warm?: boolean;
  /** Called when WebGL is unavailable or a snapshot taints — caller falls back. */
  onUnavailable?: () => void;
  /**
   * Reports whether the canvas holds a drawn frame for the CURRENT fold. The
   * parent keeps the DOM resting sheet visible until `true`, so the page
   * beneath never flashes through in the gap before the first WebGL frame.
   */
  onReadyChange?: (ready: boolean) => void;
}

/**
 * The opt-in WebGL "rounded" curl layer. Keeps the live faces as off-screen DOM
 * (interactive at rest in the parent) and snapshots them to plain images. The
 * GPU side is a SHARED pool ({@link CurlWebglPool}): inside a Book every page
 * borrows the same renderer/canvas while it folds (one context per book, not
 * per page); a standalone page owns a local pool-of-one. The canvas element is
 * adopted into this layer's positioned mount while the fold is active and
 * parked on release. Client-only; the parent lazy-mounts it so SSR / flat-mode
 * users pay nothing.
 */
export function CurlWebglLayer(props: CurlWebglLayerProps) {
  const {
    width,
    height,
    active,
    fold,
    flipped,
    curlRadius,
    shadowOpacity,
    shadowColor,
    pageBackground,
    frontContent,
    backContent,
    onUnavailable,
    onReadyChange,
    warm = true,
  } = props;

  const shadowColorRgb = useMemo(() => cssColorToRgb(shadowColor), [shadowColor]);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const frontRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);

  // Pool: the Book's shared holder, or a local pool-of-one when standalone.
  const ctxHolder = useContext(CurlWebglPoolContext);
  const localHolderRef = useRef<CurlWebglPoolHolder>({ pool: null });
  const holder = ctxHolder ?? localHolderRef.current;
  const holderRef = useRef(holder);
  holderRef.current = holder;

  // This layer's identity as a lease owner, and the live lease while folding.
  const ownerRef = useRef<symbol>(Symbol('curl-page'));
  const leaseRef = useRef<CurlGlLease | null>(null);
  // CPU-side face snapshots — captured while warm (or on demand when the
  // fold starts), uploaded on acquire.
  const imagesRef = useRef<{ front: HTMLImageElement | null; back: HTMLImageElement | null }>({
    front: null,
    back: null,
  });
  const uploadedRef = useRef(false);
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;
  const onReadyChangeRef = useRef(onReadyChange);
  onReadyChangeRef.current = onReadyChange;
  // Latest fold/flipped for the async/acquire first draw.
  const foldRef = useRef(fold);
  foldRef.current = fold;
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;
  const curlRadiusRef = useRef(curlRadius);
  curlRadiusRef.current = curlRadius;
  const shadowOpacityRef = useRef(shadowOpacity);
  shadowOpacityRef.current = shadowOpacity;
  const shadowColorRgbRef = useRef(shadowColorRgb);
  shadowColorRgbRef.current = shadowColorRgb;

  const hasBack = backContent != null;
  const hasBackRef = useRef(hasBack);
  hasBackRef.current = hasBack;

  // Snapshot validity: the key encodes everything a capture depends on. The
  // cached images are drawable only while their key matches the CURRENT one —
  // on a mismatch (e.g. `flipped` swapped which face rests) nothing draws and
  // the parent keeps the flat fold visible until the fresh capture lands.
  const captureKey = `${width}x${height}|${hasBack}|${flipped}`;
  const cachedKeyRef = useRef<string | null>(null);
  const currentKeyRef = useRef(captureKey);
  currentKeyRef.current = captureKey;

  // Upload the cached face images to the leased renderer and draw the current
  // fold — shared by the acquire effect (images already cached) and the
  // capture effect (capture finishing while the lease is held).
  const uploadAndDraw = () => {
    const lease = leaseRef.current;
    const images = imagesRef.current;
    if (!lease || !images.front || cachedKeyRef.current !== currentKeyRef.current) {
      return;
    }
    lease.renderer.setFront(images.front);
    lease.renderer.setBack(hasBackRef.current ? images.back : null);
    uploadedRef.current = true;
    const drew = renderFold(
      lease.renderer,
      foldRef.current,
      flippedRef.current,
      width,
      curlRadiusRef.current,
      shadowOpacityRef.current,
      shadowColorRgbRef.current
    );
    // Report ready ONLY once a frame for this fold is really on the canvas —
    // on a programmatic turn the fold itself arrives on the first rAF tick,
    // AFTER the acquire, and reporting early would blank the resting sheet
    // while the canvas is still empty (the page beneath flashed through).
    if (drew) {
      onReadyChangeRef.current?.(true);
    }
  };
  const uploadAndDrawRef = useRef(uploadAndDraw);
  uploadAndDrawRef.current = uploadAndDraw;

  // Lease lifecycle — borrow the shared renderer while the fold is active,
  // adopt its canvas into this layer's mount, release (and park) on settle.
  // Layout effect: acquire + texture upload + FIRST DRAW run before the
  // browser paints the commit that hides the DOM resting sheet, so there is
  // no gap frame where the page beneath shows through.
  useLayoutEffect(() => {
    if (!active) {
      return;
    }
    const holder = holderRef.current;
    const mount = mountRef.current;
    if (!mount) {
      return;
    }
    holder.pool ??= new CurlWebglPool();
    const owner = ownerRef.current;
    const lease = holder.pool.acquire(owner);
    if (!lease) {
      onUnavailableRef.current?.();
      return;
    }
    leaseRef.current = lease;
    const { canvas } = lease;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    mount.appendChild(canvas);
    const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    lease.renderer.resize(width, height, dpr);
    // The pooled canvas still holds the previous page's last frame.
    lease.renderer.clear();
    uploadAndDrawRef.current();

    return () => {
      leaseRef.current = null;
      uploadedRef.current = false;
      onReadyChangeRef.current?.(false);
      holder.pool?.release(owner);
    };
  }, [active, width, height]);

  // A standalone page owns its local pool: reclaim the context on unmount.
  // (Inside a Book the holder comes from context and the Book disposes it.)
  useEffect(() => {
    const localHolder = localHolderRef.current;
    return () => {
      if (!ctxHolder) {
        localHolder.pool?.dispose();
        localHolder.pool = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capture the faces into plain images, keyed on everything the snapshot
  // depends on (size, back presence, which side rests/lifts) — including the
  // post-settle `flipped` swap, so the snapshots are ready before the next
  // (backward) drag. Runs only while WARM (top-of-stack) or once the fold
  // actually starts (`active`): buried pages skip the snapshot work entirely,
  // so a 100-page book pays for one warm spread, not 200 captures. A capture
  // landing while the lease is held uploads and draws immediately.
  useEffect(() => {
    if ((!warm && !active) || cachedKeyRef.current === captureKey) {
      return;
    }
    const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    let cancelled = false;
    (async () => {
      // Resolve the page background (the CSS var) so the snapshot's opaque base
      // matches the sheet colour instead of defaulting to white.
      const bg = frontRef.current
        ? getComputedStyle(frontRef.current).backgroundColor || '#ffffff'
        : '#ffffff';
      const front = frontRef.current ? await captureFaceTexture(frontRef.current, dpr, bg) : null;
      if (cancelled) {
        return;
      }
      if (!front) {
        onUnavailableRef.current?.();
        return;
      }
      let back: HTMLImageElement | null = null;
      if (hasBack && backRef.current) {
        back = await captureFaceTexture(backRef.current, dpr, bg);
        if (cancelled) {
          return;
        }
        if (!back) {
          onUnavailableRef.current?.();
          return;
        }
      }
      imagesRef.current = { front, back };
      cachedKeyRef.current = captureKey;
      uploadAndDrawRef.current();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureKey, warm, active]);

  // Evict the cached snapshots once the page goes COLD (not warm, not
  // folding): without this, paging through a big book would accumulate two
  // decoded bitmaps per VISITED page — memory scaling with pages visited
  // instead of with the warm spread. A cold page that surfaces again
  // recaptures eagerly (warm) or on demand as its fold starts.
  useEffect(() => {
    if (!warm && !active) {
      imagesRef.current = { front: null, back: null };
      cachedKeyRef.current = null;
    }
  }, [warm, active]);

  // Draw each frame while folding (lease held + textures uploaded). This is
  // also where `ready` usually turns on: the first fold of a programmatic
  // turn lands here on the first rAF tick, right after the acquire drew
  // nothing (fold was still null) and kept the resting sheet visible.
  useEffect(() => {
    const lease = leaseRef.current;
    if (lease && active && uploadedRef.current && fold) {
      const drew = renderFold(
        lease.renderer,
        fold,
        flipped,
        width,
        curlRadius,
        shadowOpacity,
        shadowColorRgb
      );
      if (drew) {
        onReadyChangeRef.current?.(true);
      }
    }
  }, [active, fold, flipped, width, curlRadius, shadowOpacity, shadowColorRgb]);

  const captureStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: -99999,
    width,
    height,
    overflow: 'hidden',
    background: pageBackground ?? 'var(--curl-page-background, white)',
    pointerEvents: 'none',
  };

  return (
    <>
      {/* Off-screen snapshot sources (live React content, never on the GPU).
          Mounted only while the page is warm or folding — a buried page in a
          big book doesn't duplicate its faces into the DOM. */}
      {(warm || active) && (
        <>
          <div ref={frontRef} style={captureStyle} aria-hidden="true">
            {frontContent}
          </div>
          {hasBack && (
            <div ref={backRef} style={captureStyle} aria-hidden="true">
              {backContent}
            </div>
          )}
        </>
      )}
      {/* Positioned mount the SHARED canvas is adopted into while folding. */}
      <div
        ref={mountRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          // Vertical headroom (single source of truth: CurlGlRenderer.PAD_RATIO)
          // so the lifted curl can extend above/below the page unclipped.
          top: -Math.round(height * CurlGlRenderer.PAD_RATIO),
          left: 0,
          width: width * 2,
          height: height + 2 * Math.round(height * CurlGlRenderer.PAD_RATIO),
          pointerEvents: 'none',
          display: active ? 'block' : 'none',
          zIndex: 6,
        }}
      />
    </>
  );
}
