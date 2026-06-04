'use client';

import type { MantineColor } from '@mantine/core';
import { createContext, useContext } from 'react';
import type { CurlFaceAlign } from '../CurlFace/CurlFace';
import type { TurnOrigin } from '../flip/geometry';

/**
 * Props a `<Book>` provides as defaults to every `<Book.Page>` (the classic
 * Mantine optional-context pattern): a page may override any of them locally.
 * `variant` is part of the context too, but lives in the Book factory payload
 * (not here) to avoid colliding with Mantine's built-in `variant` typing.
 */
export interface BookInheritableProps {
  /** Default content alignment for both faces. */
  align?: CurlFaceAlign;
  /** Maximum opacity of the curl shadows. */
  shadowOpacity?: number;
  /** Color used for the curl shadows. */
  shadowColor?: MantineColor | string;
  /** Background color applied to each face. */
  pageBackground?: MantineColor | string;
  /** Background shown in the area uncovered by the curl. */
  revealBackground?: MantineColor | string;
  /** Curl radius in px for the rounded variant. */
  curlRadius?: number;
  /** Duration in ms of the settle animation after release. */
  flippingTime?: number;
  /** Progress (0–100) at/above which a release completes the turn. */
  flipThreshold?: number;
  /** Distance in px a swipe must cover to trigger a turn. */
  swipeDistance?: number;
  /** Max duration in ms for a fast gesture to still count as a swipe. */
  swipeTimeThreshold?: number;
  /** On touch, wait for a horizontal-bias gesture before claiming the drag. */
  mobileScrollSupport?: boolean;
  /**
   * Where a programmatic turn (arrows, a `page` change) pretends to grab the
   * free edge: `'bottom'` / `'top'` curl from that corner, `'middle'` folds
   * the page straight over. @default 'bottom'
   */
  turnOrigin?: TurnOrigin;
}

/** The full value a `<Book>` provides: the inheritable props plus the variant. */
export type BookContextValue = BookInheritableProps & { variant?: 'flat' | 'rounded' };

/** Optional context: `null` outside a `<Book>` (a standalone page works fine). */
export const BookContext = createContext<BookContextValue | null>(null);

export function useBookContext(): BookContextValue | null {
  return useContext(BookContext);
}
