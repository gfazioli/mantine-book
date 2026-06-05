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
  useProps,
  useStyles,
} from '@mantine/core';
import { useUncontrolled } from '@mantine/hooks';
import React, { useState } from 'react';
import type { CurlProps } from '../Curl/Curl';
import { BookContext, type BookContextValue, type BookInheritableProps } from './Book.context';
import { BookPage, type BookPageProps } from './BookPage';
import { faceToTurnedPages, turnedPagesToFace } from './page-index';
import classes from './Book.module.css';

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export type BookStylesNames = 'root' | 'page';

export type BookCssVariables = {
  root: '--curl-page-width' | '--curl-page-height' | '--curl-reveal-background';
};

/** One page in the data-driven `pages` prop: front/back content + optional
 * per-page overrides (same props as `<Book.Page>`). */
export interface BookPageData {
  front: React.ReactNode;
  back?: React.ReactNode;
  props?: Omit<BookPageProps, 'children'>;
}

export interface BookBaseProps extends BookInheritableProps {
  /**
   * Index of the current face: page `i` has its front at `2i` and its back at
   * `2i + 1`, so `0` shows the closed book and `1` shows the first page
   * turned. Indices on the same spread are equivalent as a setter;
   * `onPageChange` always reports the first visible face in reading order.
   */
  page?: number;

  /** Initial face index for the uncontrolled state. @default 0 */
  defaultPage?: number;

  /** Called when a completed turn (forward or backward) changes the page. */
  onPageChange?: (page: number) => void;

  /** Page width in CSS px. The book play-zone is twice this. @default 300 */
  width?: number;

  /** Page height in CSS px. @default 600 */
  height?: number;

  /** Disable the drag interaction on every page. @default false */
  disabled?: boolean;

  /**
   * Inside-cover background, painted under the whole page stack: visible
   * where no page rests (the left half before the first turn, the right half
   * after the last) and in the area the first/last page uncovers while it
   * turns. For a layer under a SINGLE page use `revealBackground` on that
   * `Book.Page` instead.
   */
  revealBackground?: MantineColor | string;

  /** Data-driven pages — used when no `<Book.Page>` children are given. */
  pages?: BookPageData[];

  /** The pages — `<Book.Page>` children, first page on top. */
  children?: React.ReactNode;
}

export interface BookProps extends BoxProps, BookBaseProps, StylesApiProps<BookFactory> {}

export type BookFactory = Factory<{
  props: BookProps;
  ref: HTMLDivElement;
  stylesNames: BookStylesNames;
  vars: BookCssVariables;
  /**
   * Default curl renderer for every page (inherited via context; a page can
   * override it). Lives in the factory payload — NOT in BookBaseProps — to
   * avoid colliding with Mantine's built-in `variant` (TS2320).
   */
  variant: 'flat' | 'rounded';
  staticComponents: {
    Page: typeof BookPage;
  };
}>;

const defaultProps: Partial<BookProps> = {
  defaultPage: 0,
  width: 300,
  height: 600,
  disabled: false,
};

const varsResolver = createVarsResolver<BookFactory>(
  (theme, { width, height, revealBackground }) => ({
    root: {
      '--curl-page-width': `${width}px`,
      '--curl-page-height': `${height}px`,
      '--curl-reveal-background':
        revealBackground === undefined ? undefined : getThemeColor(revealBackground, theme),
    },
  })
);

const INHERITABLE: (keyof BookContextValue)[] = [
  'variant',
  'align',
  'shadowOpacity',
  'shadowColor',
  'pageBackground',
  'curlRadius',
  'flippingTime',
  'flipThreshold',
  'swipeDistance',
  'swipeTimeThreshold',
  'mobileScrollSupport',
  'turnOrigin',
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * A multi-page book built from `<Book.Page>` pages (or the data-driven
 * `pages` prop). Page `i` rests turned (left half) once the reader is past
 * it. Only the top page of each half is interactive: dragging the right half
 * turns the current page forward, dragging the left half turns the previous
 * one back. The page being dragged is raised above the whole stack, and the
 * page beneath shows through the curl. Visual and gesture props set on the
 * Book are inherited by every page via optional context.
 */
export const Book = factory<BookFactory>((_props) => {
  const { ref, ...restProps } = _props as typeof _props & { ref?: React.Ref<HTMLDivElement> };
  const props = useProps('Book', defaultProps, restProps);
  const {
    page,
    defaultPage,
    onPageChange,
    width,
    height,
    disabled,
    pages,
    children,
    classNames,
    style,
    styles,
    unstyled,
    vars,
    className,
    mod,
    // inheritable (forwarded to pages via context)
    variant,
    align,
    shadowOpacity,
    shadowColor,
    pageBackground,
    revealBackground,
    curlRadius,
    flippingTime,
    flipThreshold,
    swipeDistance,
    swipeTimeThreshold,
    turnOrigin,
    mobileScrollSupport,
    ...others
  } = props;

  const getStyles = useStyles<BookFactory>({
    name: 'Book',
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

  /* --- Inheritable context --------------------------------------- */

  const ctxSource: BookContextValue = {
    // Mantine widens the factory `variant` to string; the payload constrains it.
    variant: variant as BookContextValue['variant'],
    align,
    shadowOpacity,
    shadowColor,
    pageBackground,
    curlRadius,
    flippingTime,
    flipThreshold,
    swipeDistance,
    swipeTimeThreshold,
    mobileScrollSupport,
    turnOrigin,
  };
  const ctxValue: BookContextValue = {};
  for (const key of INHERITABLE) {
    if (ctxSource[key] !== undefined) {
      (ctxValue as Record<string, unknown>)[key] = ctxSource[key];
    }
  }

  /* --- Pages (children win over the data-driven prop) ------------- */

  const childPages = React.Children.toArray(children).filter(
    React.isValidElement
  ) as React.ReactElement<CurlProps>[];

  const dataPages =
    childPages.length === 0 && pages
      ? pages.map((data, index) => (
          <BookPage key={index} {...data.props}>
            <BookPage.Front>{data.front}</BookPage.Front>
            <BookPage.Back>{data.back}</BookPage.Back>
          </BookPage>
        ))
      : null;

  const sheets = (dataPages ?? childPages) as React.ReactElement<CurlProps>[];
  const total = sheets.length;

  /* --- Page state (face indices ↔ turned pages) ------------------- */

  const [face, setFace] = useUncontrolled({
    value: page,
    defaultValue: defaultPage ?? 0,
    finalValue: 0,
    onChange: onPageChange,
  });
  const turned = faceToTurnedPages(face, total);

  // While a page folds it must sweep ABOVE both stacks; track which one.
  const [foldingIndex, setFoldingIndex] = useState<number | null>(null);

  /* --- Render ------------------------------------------------------ */

  return (
    <BookContext.Provider value={ctxValue}>
      <Box ref={ref} {...getStyles('root')} {...others} mod={[{ disabled }, mod]}>
        {sheets.map((child, index) => {
          const flipped = index < turned;
          // Only the top of each half reacts to the pointer: `turned` (right,
          // turns forward) and `turned - 1` (left, turns back).
          const interactive = !disabled && (index === turned || index === turned - 1);
          // Resting stacks: on the right the NEXT pages sit underneath in
          // order; on the left the most recently turned page stays on top. A
          // folding page is raised above everything while it sweeps across.
          const zIndex = foldingIndex === index ? total + 2 : flipped ? index + 1 : total - index;

          const childOnFold = child.props.onFold;
          const childOnFlip = child.props.onFlip;

          return (
            <div key={child.key ?? index} {...getStyles('page', { style: { zIndex } })}>
              {React.cloneElement(child, {
                width,
                height,
                flipped,
                grabZone: 'sheet',
                disabled: child.props.disabled || !interactive,
                onFold: (info) => {
                  setFoldingIndex(index);
                  childOnFold?.(info);
                },
                onFlip: (info) => {
                  setFoldingIndex(null);
                  setFace(turnedPagesToFace(info.flipped ? index + 1 : index));
                  childOnFlip?.(info);
                },
              })}
            </div>
          );
        })}
      </Box>
    </BookContext.Provider>
  );
});

Book.classes = classes;
Book.displayName = 'Book';
Book.Page = BookPage;
