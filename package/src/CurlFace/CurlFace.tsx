import type React from 'react';
import type { ReactNode } from 'react';

/**
 * Per-face content alignment. Resolves to flex `justify-content` /
 * `align-items` on the face wrapper. Smaller-than-page content is placed
 * according to these; larger content overflows and is clipped.
 */
export interface CurlFaceAlign {
  /** Horizontal placement of content smaller than the face. @default 'center' */
  horizontal?: 'start' | 'center' | 'end';
  /** Vertical placement of content smaller than the face. @default 'center' */
  vertical?: 'start' | 'center' | 'end';
}

export interface CurlFaceProps {
  /**
   * Content alignment for this face, overriding the `align` set on the
   * parent `<Curl>`. Defaults to center / center.
   */
  align?: CurlFaceAlign;

  /** Face contents. */
  children?: ReactNode;
}

/**
 * Declarative descriptor for one face of a `<Curl>` sheet.
 *
 * `CurlFace` is a **marker component**: it renders nothing on its own.
 * The parent `Curl` reads its props (`children`, `align`) through
 * `React.Children` and renders the content into the curl layers itself —
 * so the React node (and its event handlers) is rendered exactly once and
 * never cloned via `innerHTML`.
 *
 *     <Curl>
 *       <Curl.Front>Front side</Curl.Front>
 *       <Curl.Back>Back side</Curl.Back>
 *     </Curl>
 *
 * `Curl.Back` is optional — when omitted the back of the sheet renders as
 * a blank face filled with the page background.
 */
export function CurlFace(_props: CurlFaceProps): React.ReactElement | null {
  return null;
}

CurlFace.displayName = 'CurlFace';
