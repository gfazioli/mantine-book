import type React from 'react';
import type { ReactNode } from 'react';

export interface BookPageProps {
  /**
   * Render this page as a rigid cover that rotates around the spine,
   * skipping the curl deformation entirely. Useful for the first /
   * last pages and chapter dividers.
   *
   * When `showCover` is enabled on the parent `<Book>`, the first and
   * last pages are treated as hard automatically — passing this prop
   * explicitly overrides the auto-detection.
   *
   * @default false
   */
  hard?: boolean;

  /** Page contents. */
  children?: ReactNode;
}

/**
 * Declarative descriptor for a single page inside a `<Book>`.
 *
 * `BookPage` is a **marker component**: it never renders to the DOM
 * directly. The parent `Book` reads its props (`children`, `hard`)
 * through `React.Children` and is responsible for the actual layout,
 * positioning, and curl rendering.
 *
 * This keeps the curl math, the shadow overlays, and the layered
 * page stack centralised in one place, where the geometry can be
 * shared across the current page, the page underneath, and the
 * back face of the flipping page.
 *
 *     <Book>
 *       <Book.Page hard>Cover</Book.Page>
 *       <Book.Page>Hello</Book.Page>
 *       <Book.Page>World</Book.Page>
 *     </Book>
 */
export function BookPage(_props: BookPageProps): React.ReactElement | null {
  return null;
}

BookPage.displayName = 'Book.Page';
