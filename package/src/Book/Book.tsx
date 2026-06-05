'use client';

import {
  Box,
  type BoxProps,
  createVarsResolver,
  type ElementProps,
  factory,
  type Factory,
  getThemeColor,
  type MantineColor,
  type StylesApiProps,
  useProps,
  useStyles,
  VisuallyHidden,
} from '@mantine/core';
import { useUncontrolled } from '@mantine/hooks';
import React, { useEffect, useState } from 'react';
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

  /**
   * Builds the screen-reader announcement emitted (politely) after every
   * page change. Receives the 1-based visible page range and the total page
   * count. @default "Page X of N" / "Pages X–Y of N"
   */
  pageAnnouncement?: (info: { from: number; to: number; total: number }) => string;
}

export interface BookProps
  extends BoxProps, BookBaseProps, StylesApiProps<BookFactory>, ElementProps<'div'> {}

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

/** Total time budget (ms) for a multi-page riffle catch-up. */
const RIFFLE_BUDGET = 1000;
/** Floor (ms) for a single compressed riffle step. */
const RIFFLE_MIN_STEP = 80;

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
    pageAnnouncement,
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

  /* --- Turn queue (one page in flight at a time) --------------------- */

  // The `page` state is the TARGET; `displayedTurned` is what is visually
  // settled. They are reconciled ONE page-turn at a time: only the boundary
  // page's `flipped` prop changes, the queue waits for its onFlip, then
  // advances. This is the invariant that keeps rapid inputs sane (no two
  // pages animating at once fighting over the z-boost) and that lets a
  // single WebGL context serve the whole book. Initialized to the initial
  // target so the mount state never animates.
  const [displayedState, setDisplayedTurned] = useState<number>(() =>
    faceToTurnedPages(typeof page === 'number' ? page : (defaultPage ?? 0), total)
  );
  const [queueStep, setQueueStep] = useState<{ index: number; forward: boolean } | null>(null);
  // Per-step duration override for multi-page jumps: the riffle compresses
  // each turn so the whole catch-up fits the budget.
  const [stepTime, setStepTime] = useState<number | undefined>(undefined);

  const displayedTurned = Math.min(displayedState, total);
  const effectiveTurned =
    queueStep === null
      ? displayedTurned
      : queueStep.forward
        ? Math.min(displayedTurned + 1, total)
        : Math.max(displayedTurned - 1, 0);

  // Advance the queue: start the next step when nothing is in flight.
  useEffect(() => {
    // If the page count shrank mid-flight and the stepping page no longer
    // exists, its onFlip can never fire — clear the stale step so the
    // reconciliation cannot deadlock.
    if (queueStep !== null && queueStep.index >= total) {
      setQueueStep(null);
      setStepTime(undefined);
      setFoldingIndex((current) => (current !== null && current >= total ? null : current));
      setDisplayedTurned((current) => Math.min(current, total));
      return;
    }
    if (queueStep !== null || foldingIndex !== null || total === 0) {
      return;
    }
    if (displayedTurned === turned) {
      return;
    }
    const steps = Math.abs(turned - displayedTurned);
    const forward = turned > displayedTurned;
    const index = forward ? displayedTurned : displayedTurned - 1;
    // Accelerated riffle on multi-page jumps: compress the per-page duration
    // so the whole run lands within ~RIFFLE_BUDGET ms.
    setStepTime(
      steps > 1
        ? Math.max(RIFFLE_MIN_STEP, Math.min(flippingTime ?? 600, RIFFLE_BUDGET / steps))
        : undefined
    );
    setQueueStep({ index, forward });
  }, [turned, displayedTurned, foldingIndex, queueStep, total, flippingTime]);

  /* --- Keyboard navigation ----------------------------------------- */

  // The book root is focusable; arrows turn the current page (animated, via
  // the same controlled-flip path as external navigation), Home/End jump to
  // the covers. Keys are handled only when the root itself has focus, so
  // interactive content inside a face keeps its own keyboard behavior.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || total === 0 || event.target !== event.currentTarget) {
      return;
    }
    let next: number | null = null;
    if (event.key === 'ArrowRight') {
      next = turned < total ? turnedPagesToFace(turned + 1) : null;
    } else if (event.key === 'ArrowLeft') {
      next = turned > 0 ? turnedPagesToFace(turned - 1) : null;
    } else if (event.key === 'Home') {
      next = turned > 0 ? 0 : null;
    } else if (event.key === 'End') {
      next = turned < total ? turnedPagesToFace(total) : null;
    }
    if (next !== null) {
      event.preventDefault();
      setFace(next);
    }
  };

  /* --- Screen-reader announcement ----------------------------------- */

  // 1-based visible page range: only page 1 at rest, the open spread while
  // reading, only the last page once fully turned.
  const fromPage = turned === 0 ? 1 : 2 * turned;
  const toPage = turned === total ? 2 * total : turned === 0 ? 1 : 2 * turned + 1;
  const totalPages = total * 2;
  const announcement =
    total === 0
      ? null
      : (pageAnnouncement?.({ from: fromPage, to: toPage, total: totalPages }) ??
        (fromPage === toPage
          ? `Page ${fromPage} of ${totalPages}`
          : `Pages ${fromPage}–${toPage} of ${totalPages}`));

  /* --- Render ------------------------------------------------------ */

  // The consumer's handler and labelling must COMPOSE with (not silently
  // replace) the built-in keyboard navigation and accessible name: a
  // role="group" needs a name, and a user onKeyDown spread over ours would
  // kill the arrow-key turns. The user handler runs first and can opt out
  // with event.preventDefault().
  const {
    onKeyDown: userOnKeyDown,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    'aria-roledescription': ariaRoledescription = 'book',
    role = 'group',
    tabIndex,
    ...rest
  } = others;

  return (
    <BookContext.Provider value={ctxValue}>
      <Box
        ref={ref}
        role={role}
        aria-roledescription={ariaRoledescription}
        aria-label={ariaLabelledby ? ariaLabel : (ariaLabel ?? 'Book')}
        aria-labelledby={ariaLabelledby}
        tabIndex={tabIndex ?? (disabled ? -1 : 0)}
        onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
          userOnKeyDown?.(event);
          if (!event.defaultPrevented) {
            handleKeyDown(event);
          }
        }}
        {...getStyles('root')}
        {...rest}
        mod={[{ disabled }, mod]}
      >
        <VisuallyHidden aria-live="polite" aria-atomic="true">
          {announcement}
        </VisuallyHidden>
        {sheets.map((child, index) => {
          const flipped = index < effectiveTurned;
          // While a fold is in flight (a user drag or a queue step), only that
          // page stays interactive — a second simultaneous fold would fight it
          // over the z-boost and break the one-page-in-flight invariant.
          const inFlight = queueStep?.index ?? foldingIndex;
          // Only the top of each half reacts to the pointer: `effectiveTurned`
          // (right, turns forward) and `effectiveTurned - 1` (left, turns back).
          const interactive =
            !disabled &&
            (index === effectiveTurned || index === effectiveTurned - 1) &&
            (inFlight === null || inFlight === index);
          // Resting stacks: on the right the NEXT pages sit underneath in
          // order; on the left the most recently turned page stays on top. A
          // folding page is raised above everything while it sweeps across.
          const zIndex = foldingIndex === index ? total + 2 : flipped ? index + 1 : total - index;

          const childOnFold = child.props.onFold;
          const childOnFlip = child.props.onFlip;

          const overrides: Partial<CurlProps> = {
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
              const newTurned = info.flipped ? index + 1 : index;
              if (queueStep?.index === index) {
                // Queue step settled: record progress and let the advance
                // effect start the next step. The face already points at the
                // target, so no setFace here.
                setDisplayedTurned(newTurned);
                setQueueStep(null);
              } else {
                // User drag settled (turn or snap-back): this IS the new
                // target — report it.
                setDisplayedTurned(newTurned);
                setFace(turnedPagesToFace(newTurned));
              }
              childOnFlip?.(info);
            },
          };
          // Compressed duration while this page is a multi-page riffle step.
          if (queueStep?.index === index && stepTime !== undefined) {
            overrides.flippingTime = stepTime;
          }

          return (
            <div key={child.key ?? index} {...getStyles('page', { style: { zIndex } })}>
              {React.cloneElement(child, overrides)}
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
