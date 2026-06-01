'use client';

import React, { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import type { ReflectionFold } from '../../flip/geometry';
import { CurlGlRenderer } from './glRenderer';
import { captureFaceTexture } from './snapshot';

/**
 * Drive the renderer from a fold: the crease (midpoint + direction) becomes the
 * wrap axis, so the curl follows the drag in any direction. `n` is the crease
 * normal pointing toward the grabbed edge (= −dragDir = (−creaseDir.y, creaseDir.x)).
 */
function renderFold(
  renderer: CurlGlRenderer,
  fold: ReflectionFold | null,
  flipped: boolean,
  width: number,
  maxRadius: number
): void {
  if (!fold) {
    return;
  }
  const nx = -fold.creaseDir.y;
  const ny = fold.creaseDir.x;
  const sheetLeft = flipped ? -width : 0;
  // Adaptive radius: full (rounded) at the start of the peel, shrinking toward
  // ~0 as the fold completes. Wrapping a cylinder shortens the curl by ~π·r, so
  // a constant radius can't reach the spine and snaps to the flat DOM face on
  // release; shrinking r flattens the curl as it turns over, so it reaches like
  // the flat fold and the WebGL→DOM handoff is seamless (r→0 == the flat fold).
  const r = Math.max(2, maxRadius * (1 - fold.progress / 100));
  renderer.render(fold.creaseMid.x, fold.creaseMid.y, nx, ny, r, sheetLeft);
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
  /** Page background painted behind each captured face. */
  pageBackground?: string;
  /** Front / back face content — rendered off-screen only as snapshot sources. */
  frontContent: ReactNode;
  backContent: ReactNode;
  /** Called when WebGL is unavailable or a snapshot taints — caller falls back. */
  onUnavailable?: () => void;
}

/**
 * The opt-in WebGL "rounded" curl layer. Keeps the live faces as off-screen DOM
 * (interactive at rest in the parent), snapshots them to textures, and draws the
 * cone-deformed page on a <canvas> overlaying the play-zone while folding.
 * Client-only; the parent lazy-mounts it so SSR / flat-mode users pay nothing.
 */
export function CurlWebglLayer(props: CurlWebglLayerProps) {
  const {
    width,
    height,
    active,
    fold,
    flipped,
    curlRadius,
    pageBackground,
    frontContent,
    backContent,
    onUnavailable,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frontRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<CurlGlRenderer | null>(null);
  const capturedRef = useRef(false);
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;
  // Latest fold/flipped for the mount effect's first draw.
  const foldRef = useRef(fold);
  foldRef.current = fold;
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;
  const curlRadiusRef = useRef(curlRadius);
  curlRadiusRef.current = curlRadius;

  const hasBack = backContent != null;

  // Create the renderer + capture the faces once, on mount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    let renderer: CurlGlRenderer | null = null;
    try {
      renderer = new CurlGlRenderer(canvas);
    } catch {
      onUnavailableRef.current?.();
      return;
    }
    rendererRef.current = renderer;
    const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    renderer.resize(width, height, dpr);

    let cancelled = false;
    (async () => {
      // Resolve the page background (the CSS var) so the texture's opaque base
      // matches the sheet colour instead of defaulting to white.
      const bg = frontRef.current
        ? getComputedStyle(frontRef.current).backgroundColor || '#ffffff'
        : '#ffffff';
      const front = frontRef.current ? await captureFaceTexture(frontRef.current, dpr, bg) : null;
      if (cancelled || !rendererRef.current) {
        return;
      }
      if (!front) {
        onUnavailableRef.current?.();
        return;
      }
      rendererRef.current.setFront(front);
      if (hasBack && backRef.current) {
        const back = await captureFaceTexture(backRef.current, dpr, bg);
        if (!cancelled && rendererRef.current && back) {
          rendererRef.current.setBack(back);
        }
      }
      capturedRef.current = true;
      renderFold(
        rendererRef.current,
        foldRef.current,
        flippedRef.current,
        width,
        curlRadiusRef.current
      );
    })();

    return () => {
      cancelled = true;
      renderer?.dispose();
      rendererRef.current = null;
      capturedRef.current = false;
    };
    // Re-create only when the sheet size changes; content re-capture is TODO(P4).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, hasBack]);

  // Draw each frame while folding.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (renderer && active && capturedRef.current && fold) {
      renderFold(renderer, fold, flipped, width, curlRadius);
    }
  }, [active, fold, flipped, width, curlRadius]);

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
      {/* Off-screen snapshot sources (live React content, never on the GPU). */}
      <div ref={frontRef} style={captureStyle} aria-hidden="true">
        {frontContent}
      </div>
      {hasBack && (
        <div ref={backRef} style={captureStyle} aria-hidden="true">
          {backContent}
        </div>
      )}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          // Vertical headroom (matches CurlGlRenderer.PAD_RATIO) so the lifted
          // curl can extend above/below the page without being clipped.
          top: -Math.round(height * 0.18),
          left: 0,
          width: width * 2,
          height: height + 2 * Math.round(height * 0.18),
          pointerEvents: 'none',
          display: active ? 'block' : 'none',
          zIndex: 6,
        }}
      />
    </>
  );
}
