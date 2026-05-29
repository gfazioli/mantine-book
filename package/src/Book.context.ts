import { createSafeContext, type GetStylesApi } from '@mantine/core';
import type { BookFactory } from './Book';
import type { FlipCorner } from './flip/geometry';

/** Detected layout mode — set by the `ResizeObserver` on the root container. */
export type BookLayoutMode = 'single' | 'spread';

export interface BookContextValue {
  /** Style getter from `useStyles` so sub-components share the Styles API. */
  getStyles: GetStylesApi<BookFactory>;

  /** Page count, derived from the number of `<Book.Page>` children. */
  totalPages: number;

  /** Index of the currently visible page (left page in spread mode). */
  currentPage: number;

  /** Active layout mode. */
  mode: BookLayoutMode;

  /**
   * Width of a single page in CSS pixels. Already resolved against
   * `width` prop and current layout mode (in spread mode this is
   * half the book width).
   */
  pageWidth: number;

  /** Height of a single page in CSS pixels. */
  pageHeight: number;

  /** Whether the parent rendered with `showCover` — affects hard-page auto-detection. */
  showCover: boolean;

  /** Imperatively flip to the next page (no-op when already at the end). */
  flipNext: (corner?: FlipCorner) => void;

  /** Imperatively flip to the previous page (no-op when already at the start). */
  flipPrev: (corner?: FlipCorner) => void;

  /** Imperatively jump to an arbitrary page index. Animates like a swipe. */
  turnToPage: (index: number) => void;
}

export const [BookProvider, useBookContext] = createSafeContext<BookContextValue>(
  'Book component was not found in tree'
);
