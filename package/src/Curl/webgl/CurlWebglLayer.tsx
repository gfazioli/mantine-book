'use client';

import React, { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import { CurlGlRenderer } from './glRenderer';
import { captureFaceTexture } from './snapshot';

export interface CurlWebglLayerProps {
  /** Sheet width in px (play-zone is 2×). */
  width: number;
  /** Sheet height in px. */
  height: number;
  /** True while a fold is active (dragging or settling) — shows the canvas. */
  active: boolean;
  /** Fold progress 0–100, drives the cone curl. */
  progress: number;
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
    progress,
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
      rendererRef.current.render(progress);
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
    if (renderer && active && capturedRef.current) {
      renderer.render(progress);
    }
  }, [active, progress]);

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
          top: 0,
          left: 0,
          width: width * 2,
          height,
          pointerEvents: 'none',
          display: active ? 'block' : 'none',
          zIndex: 6,
        }}
      />
    </>
  );
}
