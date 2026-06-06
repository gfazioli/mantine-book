'use client';

import { createContext } from 'react';
// Type-only: erased at runtime, so importing this module (the Book does)
// never pulls the WebGL renderer into the main bundle — the pool instance is
// created by the lazily-loaded CurlWebglLayer on the first rounded fold.
import type { CurlWebglPool } from './pool';

/**
 * Mutable holder shared between a Book and its pages' WebGL layers. The Book
 * provides an empty holder; the first rounded layer that needs to draw fills
 * `pool` (lazy import path); the Book disposes it on unmount.
 */
export interface CurlWebglPoolHolder {
  pool: CurlWebglPool | null;
}

/** `null` outside a Book — a standalone page then owns a local pool-of-one. */
export const CurlWebglPoolContext = createContext<CurlWebglPoolHolder | null>(null);
