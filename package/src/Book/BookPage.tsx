'use client';

import { filterProps } from '@mantine/core';
import React from 'react';
import { Curl, type CurlProps, makeFaceMarker } from '../Curl/Curl';
import type { CurlFace } from '../CurlFace/CurlFace';
import { type BookContextValue, useBookContext } from './Book.context';

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * One page of a `<Book>` — the physical entity that turns: it always has two
 * sides, declared as `<Book.Page.Front>` and `<Book.Page.Back>`. Every visual
 * and gesture prop is optional here: when omitted it is inherited from the
 * owning `<Book>` (optional context), and a local value wins over the Book's.
 */
export interface BookPageProps extends CurlProps {
  /** Curl renderer for this page; overrides the Book's `variant`. */
  variant?: 'flat' | 'rounded';
}

const INHERITABLE: (keyof BookContextValue)[] = [
  'variant',
  'align',
  'shadowOpacity',
  'shadowColor',
  'pageBackground',
  'revealBackground',
  'curlRadius',
  'flippingTime',
  'flipThreshold',
  'swipeDistance',
  'swipeTimeThreshold',
  'mobileScrollSupport',
  'turnOrigin',
];

type BookPageComponent = ((
  props: BookPageProps & { ref?: React.Ref<HTMLDivElement> }
) => React.ReactElement) & {
  displayName?: string;
  Front: typeof CurlFace;
  Back: typeof CurlFace;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const BookPage: BookPageComponent = (_props) => {
  const { ref, ...props } = _props;
  const ctx = useBookContext();

  // Book defaults → overridden by the page's own defined props. filterProps
  // drops undefined entries so an unset local prop never masks the context.
  const inherited: Partial<BookContextValue> = {};
  if (ctx) {
    for (const key of INHERITABLE) {
      if (ctx[key] !== undefined) {
        (inherited as Record<string, unknown>)[key] = ctx[key];
      }
    }
  }

  return <Curl ref={ref} {...inherited} {...filterProps(props as Record<string, unknown>)} />;
};

// No dot: the docs PropsTable composes the display title as
// `componentPrefix + '.' + name.replace(prefix, '')` — 'BookPage' renders as
// "Book.Page" (same convention as WindowGroup in mantine-window).
BookPage.displayName = 'BookPage';
BookPage.Front = makeFaceMarker('front', 'Book.Page.Front');
BookPage.Back = makeFaceMarker('back', 'Book.Page.Back');
