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
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CurlProps } from '../Curl/Curl';
// Type-only pool import inside: never pulls the WebGL renderer in this chunk.
import { CurlWebglPoolContext, type CurlWebglPoolHolder } from '../Curl/webgl/poolContext';
import {
  BookContext,
  type BookContextValue,
  type BookInheritableProps,
  INHERITABLE_PROPS,
} from './Book.context';
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

  /**
   * Total time budget in ms for a multi-page riffle (a jump of several
   * pages): each in-between turn gets `riffleDuration / steps` (never less
   * than 80ms, never more than `flippingTime`). Single-step turns always use
   * `flippingTime`. The in-between pages of a riffle always turn with the
   * flat fold — at riffle speed the curl is indistinguishable and the flat
   * path keeps long riffles smooth; the final landing page turns with the
   * book's variant. @default 1000
   */
  riffleDuration?: number;

  /**
   * Treat the book as a physical bound volume: the FIRST and LAST pages turn
   * RIGID around the spine (hard covers — flat 3D rotation, no curl; a page
   * can override with its own `hard`), and the closed book (either end) is
   * COMPACT — visually centered on the play-zone instead of sitting in one
   * half, sliding into the two-page spread as the cover opens (the slide is
   * a CSS transition, disabled under prefers-reduced-motion). @default false
   */
  withCover?: boolean;
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
  riffleDuration: 1000,
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

/** Floor (ms) for a single compressed riffle step. */
const RIFFLE_MIN_STEP = 80;

/**
 * Returns the previous reference when the new style is shallow-equal, so a
 * freshly-merged (but unchanged) styles-API object doesn't defeat the
 * per-page memo below.
 */
function useShallowStableStyle(
  style: React.CSSProperties | undefined
): React.CSSProperties | undefined {
  const ref = useRef(style);
  const prev = ref.current;
  const same =
    prev === style ||
    (!!prev &&
      !!style &&
      Object.keys(prev).length === Object.keys(style).length &&
      Object.keys(style).every(
        (key) => (prev as Record<string, unknown>)[key] === (style as Record<string, unknown>)[key]
      ));
  if (!same) {
    ref.current = style;
  }
  return same ? prev : style;
}

/* ------------------------------------------------------------------ */
/*  Memoized page wrapper                                              */
/* ------------------------------------------------------------------ */

interface BookSheetProps {
  child: React.ReactElement<CurlProps>;
  index: number;
  width: number | undefined;
  height: number | undefined;
  flipped: boolean;
  disabled: boolean;
  warm: boolean;
  raised: boolean;
  total: number;
  /** Compressed duration while this page is an in-between riffle step. */
  stepTime: number | undefined;
  /** Turn this page's riffle step with the flat fold (no WebGL pipeline). */
  stepFlat: boolean;
  /** Rigid page (hard cover): rotates flat around the spine, no curl. */
  hard: boolean;
  className: string | undefined;
  style: React.CSSProperties | undefined;
  onFoldStep: (index: number) => void;
  onFlipStep: (index: number, flipped: boolean) => void;
}

/**
 * One stacked page, memoized on primitives + referentially-stable callbacks:
 * a Book commit during a turn changes the props of only a handful of pages
 * (the in-flight step, the warm spread, their neighbours), so every other
 * Curl subtree bails out of re-rendering. On a 100-page book this is the
 * difference between a smooth riffle and re-cloning the whole stack on every
 * queue transition.
 */
const BookSheet = memo(function BookSheet(props: BookSheetProps) {
  const {
    child,
    index,
    width,
    height,
    flipped,
    disabled,
    warm,
    raised,
    total,
    stepTime,
    stepFlat,
    hard,
    className,
    style,
    onFoldStep,
    onFlipStep,
  } = props;

  const childOnFold = child.props.onFold;
  const childOnFlip = child.props.onFlip;

  const overrides: Partial<CurlProps> = {
    width,
    height,
    flipped,
    grabZone: 'sheet',
    disabled,
    warmSnapshots: warm,
    hard,
    onFold: (info) => {
      onFoldStep(index);
      childOnFold?.(info);
    },
    onFlip: (info) => {
      onFlipStep(index, info.flipped);
      childOnFlip?.(info);
    },
  };
  if (stepTime !== undefined) {
    overrides.flippingTime = stepTime;
  }
  if (stepFlat) {
    overrides.variant = 'flat';
  }

  // Resting stacks: on the right the NEXT pages sit underneath in order; on
  // the left the most recently turned page stays on top. The in-flight page
  // (queue step or live drag) is raised above everything while it sweeps —
  // from the very first commit of its step (zIndex from queueStep, NOT from
  // foldingIndex, which onFold only sets on the first rAF tick: waiting for
  // it painted one frame with the page beneath on top — the start-of-turn
  // flash).
  const zIndex = raised ? total + 2 : flipped ? index + 1 : total - index;

  return (
    <div className={className} style={{ ...style, zIndex }}>
      {React.cloneElement(child, overrides)}
    </div>
  );
});

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
    riffleDuration,
    withCover,
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
  for (const key of INHERITABLE_PROPS) {
    if (ctxSource[key] !== undefined) {
      (ctxValue as Record<string, unknown>)[key] = ctxSource[key];
    }
  }

  /* --- Pages (children win over the data-driven prop) ------------- */

  // Memoized so the page ELEMENTS are referentially stable across Book
  // commits — Children.toArray (and the data-page map) mint new elements on
  // every call, which would defeat the per-page BookSheet memo and every
  // useMemo inside Curl.
  const sheets = useMemo(() => {
    const childPages = React.Children.toArray(children).filter(
      React.isValidElement
    ) as React.ReactElement<CurlProps>[];
    if (childPages.length > 0 || !pages) {
      return childPages;
    }
    return pages.map((data, index) => (
      <BookPage key={index} {...data.props}>
        <BookPage.Front>{data.front}</BookPage.Front>
        <BookPage.Back>{data.back}</BookPage.Back>
      </BookPage>
    )) as React.ReactElement<CurlProps>[];
  }, [children, pages]);
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

  /* --- Shared WebGL pool (rounded variant) --------------------------- */

  // One WebGL context for the whole book: the holder is provided empty and
  // the first rounded fold fills it (lazy chunk); the turn queue guarantees a
  // single page draws at a time. Reclaim the GPU slot on unmount.
  const poolHolderRef = useRef<CurlWebglPoolHolder>({ pool: null });
  useEffect(() => {
    const poolHolder = poolHolderRef.current;
    return () => {
      poolHolder.pool?.dispose();
      poolHolder.pool = null;
    };
  }, []);

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
  // Layout effect: the next step is scheduled BEFORE the browser paints the
  // settle commit, so a riffle doesn't pause a dead frame at every step
  // boundary. Self-limiting (gated on queueStep/foldingIndex being null), so
  // it can never loop synchronously.
  useLayoutEffect(() => {
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
    // so the whole run lands within ~riffleDuration ms.
    setStepTime(
      steps > 1
        ? Math.max(RIFFLE_MIN_STEP, Math.min(flippingTime ?? 600, (riffleDuration ?? 1000) / steps))
        : undefined
    );
    setQueueStep({ index, forward });
  }, [turned, displayedTurned, foldingIndex, queueStep, total, flippingTime, riffleDuration]);

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

  // Stable per-page callbacks (read live state through refs) so BookSheet's
  // memo holds: the inline closures the map used to mint on every commit
  // forced all N pages to re-render on each queue transition.
  const queueStepRef = useRef(queueStep);
  queueStepRef.current = queueStep;
  const setFaceRef = useRef(setFace);
  setFaceRef.current = setFace;

  const handleFoldStep = useCallback((index: number) => {
    setFoldingIndex(index);
  }, []);

  const handleFlipStep = useCallback((index: number, nowFlipped: boolean) => {
    setFoldingIndex(null);
    const newTurned = nowFlipped ? index + 1 : index;
    if (queueStepRef.current?.index === index) {
      // Queue step settled: record progress and let the advance effect start
      // the next step. The face already points at the target, so no setFace.
      setDisplayedTurned(newTurned);
      setQueueStep(null);
    } else {
      // User drag settled (turn or snap-back): this IS the new target —
      // report it. If a queue step was pending (a drag can steal the fold
      // mid-riffle: handleStart kills the step's settle animation, so its
      // onFlip never fires), DROP it — otherwise the orphaned step blocks
      // the advance effect forever and the book deadlocks. The advance
      // re-syncs from the fresh displayed/target state on the next pass.
      setQueueStep(null);
      setStepTime(undefined);
      setDisplayedTurned(newTurned);
      setFaceRef.current(turnedPagesToFace(newTurned));
    }
  }, []);

  // While a multi-page riffle is still far from landing, warm snapshot
  // capture stays suspended (its steps all turn flat — see the map below).
  // It resumes when ≤2 turns remain, so the LANDING page captures its
  // textures during the second-to-last step and the final rounded turn
  // starts ready.
  const riffleWarmHold =
    queueStep !== null && stepTime !== undefined && Math.abs(turned - displayedTurned) > 2;

  const pageStyles = getStyles('page');
  const stablePageStyle = useShallowStableStyle(pageStyles.style);

  // withCover: a CLOSED book (either end) is compact — the single visible
  // page is centered on the play-zone instead of sitting in one half. The
  // root slides by half a page as the cover opens/closes (CSS transition on
  // transform, see Book.module.css; follows `turned`, the TARGET, so a
  // programmatic turn slides in sync with the cover flip).
  const coverShift =
    withCover === true && total > 0
      ? turned === 0
        ? -(width ?? 0) / 2
        : turned === total
          ? (width ?? 0) / 2
          : 0
      : 0;

  return (
    <BookContext.Provider value={ctxValue}>
      <CurlWebglPoolContext.Provider value={poolHolderRef.current}>
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
          {...getStyles('root', {
            style: withCover === true ? { transform: `translateX(${coverShift}px)` } : undefined,
          })}
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
            // The in-between steps of a multi-page riffle (compressed
            // stepTime) always turn with the FLAT fold: at riffle speed the
            // curl is indistinguishable and the flat path needs no snapshots,
            // so long riffles stay smooth. Only the final landing page
            // (natural duration, stepTime undefined) turns with the book's
            // variant — and the warm window above made sure its textures are
            // ready.
            const isStep = queueStep?.index === index;
            return (
              <BookSheet
                key={child.key ?? index}
                child={child}
                index={index}
                width={width}
                height={height}
                flipped={flipped}
                disabled={child.props.disabled || !interactive}
                // Only the two top-of-stack pages keep their WebGL snapshots
                // warm (a buried page never folds without surfacing first),
                // so a big book pays for one warm spread, not one per page.
                warm={
                  !riffleWarmHold && (index === effectiveTurned || index === effectiveTurned - 1)
                }
                raised={inFlight === index}
                total={total}
                stepTime={isStep ? stepTime : undefined}
                stepFlat={isStep && stepTime !== undefined}
                // withCover: first and last pages are rigid covers; an
                // explicit per-page `hard` always wins.
                hard={
                  child.props.hard ?? (withCover === true && (index === 0 || index === total - 1))
                }
                className={pageStyles.className}
                style={stablePageStyle}
                onFoldStep={handleFoldStep}
                onFlipStep={handleFlipStep}
              />
            );
          })}
        </Box>
      </CurlWebglPoolContext.Provider>
    </BookContext.Provider>
  );
});

Book.classes = classes;
Book.displayName = 'Book';
Book.Page = BookPage;
