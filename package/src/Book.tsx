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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookProvider, type BookLayoutMode } from './Book.context';
import { BookPage, type BookPageProps } from './BookPage/BookPage';
import type { FlipCorner } from './flip/geometry';
import {
  type PageFlipCallbacks,
  PageFlipController,
  type PageFlipRefs,
  type PageFlipSettings,
  type PageMeta,
} from './flip/page-flip-controller';
import classes from './Book.module.css';

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export type BookStylesNames =
  | 'root'
  | 'viewport'
  | 'side'
  | 'page'
  | 'pageInner'
  | 'flippingPage'
  | 'shadowsLayer'
  | 'cover';

export type BookCssVariables = {
  root:
    | '--book-width'
    | '--book-height'
    | '--book-page-width'
    | '--book-page-height'
    | '--book-page-background'
    | '--book-shadow-color';
};

export interface BookBaseProps {
  /** Total book width in CSS px (covers spread + spine). @default 600 */
  width?: number;

  /** Book height in CSS px. @default 400 */
  height?: number;

  /**
   * Container width below which the book collapses to single-page mode.
   * Auto-detected via `ResizeObserver` on the root.
   *
   * @default 420
   */
  singlePageBreakpoint?: number;

  /** First and last pages are rendered as hard covers automatically. @default false */
  showCover?: boolean;

  /** Duration in ms of the click-to-flip auto-animation. @default 1000 */
  flippingTime?: number;

  /** Distance in px a swipe must cover to trigger a flip. @default 30 */
  swipeDistance?: number;

  /** Max duration in ms for a fast gesture to still count as a swipe. @default 250 */
  swipeTimeThreshold?: number;

  /** Background color applied to every page surface. @default 'white' */
  pageBackground?: MantineColor | string;

  /** Color used for the curl shadows. @default 'dark.9' */
  shadowColor?: MantineColor | string;

  /** Maximum opacity of the curl drop shadow. @default 0.5 */
  shadowOpacity?: number;

  /** Disable the click-on-edge → auto-flip behaviour. @default false */
  disableFlipByClick?: boolean;

  /** On touch input, wait for a horizontal-bias gesture before claiming the drag. @default true */
  mobileScrollSupport?: boolean;

  /** Index of the page to mount on (uncontrolled mode). @default 0 */
  defaultPage?: number;

  /** Controlled page index. */
  currentPage?: number;

  /** Called after a flip settles, with the new page index. */
  onPageChange?: (index: number) => void;

  /** Called once after the book mounts and the layout has been measured. */
  onInit?: (info: { totalPages: number; mode: BookLayoutMode }) => void;

  /** Called when the auto-detected layout mode changes. */
  onChangeOrientation?: (mode: BookLayoutMode) => void;

  /** Pages — must be `<Book.Page>` children. */
  children?: React.ReactNode;
}

export interface BookProps extends BoxProps, BookBaseProps, StylesApiProps<BookFactory> {}

export type BookFactory = Factory<{
  props: BookProps;
  ref: HTMLDivElement;
  stylesNames: BookStylesNames;
  vars: BookCssVariables;
  staticComponents: {
    Page: typeof BookPage;
  };
}>;

const defaultProps: Partial<BookProps> = {
  width: 600,
  height: 400,
  singlePageBreakpoint: 420,
  showCover: false,
  flippingTime: 1000,
  swipeDistance: 30,
  swipeTimeThreshold: 250,
  pageBackground: 'white',
  shadowColor: 'dark.9',
  shadowOpacity: 0.5,
  disableFlipByClick: false,
  mobileScrollSupport: true,
  defaultPage: 0,
};

const varsResolver = createVarsResolver<BookFactory>(
  (theme, { width, height, pageBackground, shadowColor }) => ({
    root: {
      '--book-width': `${width}px`,
      '--book-height': `${height}px`,
      '--book-page-width': '0px',
      '--book-page-height': '0px',
      '--book-page-background':
        pageBackground === undefined ? undefined : getThemeColor(pageBackground, theme),
      '--book-shadow-color':
        shadowColor === undefined ? undefined : getThemeColor(shadowColor, theme),
    },
  })
);

/* ------------------------------------------------------------------ */
/*  Children parsing                                                   */
/* ------------------------------------------------------------------ */

interface InternalPage {
  index: number;
  hard: boolean;
  content: React.ReactNode;
}

function readPages(children: React.ReactNode, showCover: boolean): InternalPage[] {
  const arr = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<
    BookPageProps
  >[];
  return arr.map((child, index) => {
    const explicit = child.props.hard;
    const auto = showCover && (index === 0 || index === arr.length - 1);
    return {
      index,
      hard: explicit ?? auto,
      content: child.props.children,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Book = factory<BookFactory>((_props) => {
  const { ref, ...restProps } = _props as typeof _props & { ref?: React.Ref<HTMLDivElement> };
  const props = useProps('Book', defaultProps, restProps);
  const {
    width,
    height,
    singlePageBreakpoint,
    showCover,
    flippingTime,
    swipeDistance,
    swipeTimeThreshold,
    pageBackground: _pb,
    shadowColor: _sc,
    shadowOpacity,
    disableFlipByClick,
    mobileScrollSupport,
    defaultPage,
    currentPage,
    onPageChange,
    onInit,
    onChangeOrientation,
    children,
    classNames,
    style,
    styles,
    unstyled,
    vars,
    className,
    mod,
    ...others
  } = props;

  /* --- Styles API ----------------------------------------------- */

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

  /* --- Refs to every DOM element the controller mutates --------- */

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const leftPageRef = useRef<HTMLDivElement | null>(null);
  const rightPageRef = useRef<HTMLDivElement | null>(null);
  const flippingPageRef = useRef<HTMLDivElement | null>(null);
  const bottomPageRef = useRef<HTMLDivElement | null>(null);
  const outerShadowRef = useRef<HTMLDivElement | null>(null);
  const innerShadowRef = useRef<HTMLDivElement | null>(null);

  /** Array of refs to the user page wrappers — filled by the ref callback below. */
  const pageElementRefs = useRef<HTMLDivElement[]>([]);

  /** Controller instance, recreated when settings change in a way the controller can't update in-place. */
  const controllerRef = useRef<PageFlipController | null>(null);

  /* --- Forward parent ref ---------------------------------------- */

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref]
  );

  /* --- Pages parsing -------------------------------------------- */

  const pages = useMemo(() => readPages(children, showCover ?? false), [children, showCover]);
  const totalPages = pages.length;

  /* --- Layout mode (mirrors the controller's detection) -------- */

  const [mode, setMode] = useState<BookLayoutMode>('spread');

  /* --- Settings object for the controller ----------------------- */

  const settings = useMemo<PageFlipSettings>(
    () => ({
      width: width ?? 600,
      height: height ?? 400,
      showCover: showCover ?? false,
      singlePageBreakpoint: singlePageBreakpoint ?? 420,
      flippingTime: flippingTime ?? 1000,
      shadowOpacity: shadowOpacity ?? 0.5,
      swipeDistance: swipeDistance ?? 30,
      swipeTimeThreshold: swipeTimeThreshold ?? 250,
      mobileScrollSupport: mobileScrollSupport ?? true,
      disableFlipByClick: disableFlipByClick ?? false,
    }),
    [
      width,
      height,
      showCover,
      singlePageBreakpoint,
      flippingTime,
      shadowOpacity,
      swipeDistance,
      swipeTimeThreshold,
      mobileScrollSupport,
      disableFlipByClick,
    ]
  );

  /* --- Stable callbacks for the controller --------------------- */

  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const onInitRef = useRef(onInit);
  onInitRef.current = onInit;
  const onChangeOrientationRef = useRef(onChangeOrientation);
  onChangeOrientationRef.current = onChangeOrientation;

  const callbacks = useMemo<PageFlipCallbacks>(
    () => ({
      onPageChange: (index) => onPageChangeRef.current?.(index),
      onChangeOrientation: (m) => {
        setMode(m);
        onChangeOrientationRef.current?.(m);
      },
    }),
    []
  );

  /* --- Mount / unmount the controller --------------------------- */

  useEffect(() => {
    if (
      !containerRef.current ||
      !viewportRef.current ||
      !leftPageRef.current ||
      !rightPageRef.current ||
      !flippingPageRef.current ||
      !bottomPageRef.current ||
      !outerShadowRef.current ||
      !innerShadowRef.current
    ) {
      return;
    }
    const refs: PageFlipRefs = {
      container: containerRef.current,
      viewport: viewportRef.current,
      leftPage: leftPageRef.current,
      rightPage: rightPageRef.current,
      flippingPage: flippingPageRef.current,
      bottomPage: bottomPageRef.current,
      outerShadow: outerShadowRef.current,
      innerShadow: innerShadowRef.current,
    };
    const pageMetas: PageMeta[] = pages.map((p, i) => ({
      hard: p.hard,
      element: pageElementRefs.current[i],
    }));
    const controller = new PageFlipController(refs, pageMetas, settings, callbacks);
    controllerRef.current = controller;
    controller.mount();
    if (defaultPage && defaultPage > 0) {
      controller.setCurrentPage(defaultPage);
    }
    onInitRef.current?.({ totalPages, mode: controller.getMode() });
    return () => {
      controller.unmount();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Sync pages / settings without remounting ----------------- */

  useEffect(() => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    const pageMetas: PageMeta[] = pages.map((p, i) => ({
      hard: p.hard,
      element: pageElementRefs.current[i],
    }));
    ctrl.setPages(pageMetas);
  }, [pages]);

  useEffect(() => {
    controllerRef.current?.setSettings(settings);
  }, [settings]);

  /* --- Controlled mode: sync currentPage ----------------------- */

  useEffect(() => {
    const ctrl = controllerRef.current;
    if (!ctrl || currentPage === undefined) return;
    if (currentPage === ctrl.getCurrentPage()) return;
    ctrl.turnToPage(currentPage);
  }, [currentPage]);

  /* --- Context value for `Book.Page` consumers ----------------- */

  const ctxValue = useMemo(
    () => ({
      getStyles,
      totalPages,
      currentPage: currentPage ?? defaultPage ?? 0,
      mode,
      pageWidth: mode === 'spread' ? (width ?? 600) / 2 : width ?? 600,
      pageHeight: height ?? 400,
      showCover: showCover ?? false,
      flipNext: (corner?: FlipCorner) => controllerRef.current?.flipNext(corner),
      flipPrev: (corner?: FlipCorner) => controllerRef.current?.flipPrev(corner),
      turnToPage: (i: number) => controllerRef.current?.turnToPage(i),
    }),
    [getStyles, totalPages, currentPage, defaultPage, mode, width, height, showCover]
  );

  /* --- Render --------------------------------------------------- */

  const pageWidthCss = mode === 'spread' ? `${(width ?? 600) / 2}px` : `${width ?? 600}px`;
  const pageHeightCss = `${height ?? 400}px`;

  return (
    <BookProvider value={ctxValue}>
      <Box
        ref={setContainerRef}
        {...getStyles('root')}
        {...others}
        mod={[{ mode }, mod]}
        __vars={{
          '--book-page-width': pageWidthCss,
          '--book-page-height': pageHeightCss,
        }}
      >
        <Box ref={viewportRef} {...getStyles('viewport')} data-mode={mode}>
          {/* User pages — hidden by default via CSS class so React
              re-renders don't fight the controller's inline mutations. */}
          {pages.map((p, i) => (
            <div
              key={i}
              ref={(el) => {
                if (el) pageElementRefs.current[i] = el;
              }}
              className={classes.hidden}
              data-page-index={i}
              data-hard={p.hard || undefined}
            >
              {p.content}
            </div>
          ))}

          {/* Slots — the controller pushes user pages into these and
              styles them per-frame. Initial state is hidden by class. */}
          <div ref={leftPageRef} data-slot="left" className={classes.hidden} />
          <div ref={rightPageRef} data-slot="right" className={classes.hidden} />
          <div ref={flippingPageRef} data-slot="flipping" className={classes.hidden} />
          <div ref={bottomPageRef} data-slot="bottom" className={classes.hidden} />
          <div ref={outerShadowRef} data-slot="outer-shadow" className={classes.hidden} />
          <div ref={innerShadowRef} data-slot="inner-shadow" className={classes.hidden} />
        </Box>
      </Box>
    </BookProvider>
  );
});

Book.classes = classes;
Book.displayName = 'Book';
Book.Page = BookPage;
