/**
 * Imperative page-flip controller — owns the curl rendering, the state
 * machine, the event handlers, and the rAF loop. React mounts it once
 * per `<Book>` and never touches the DOM it owns thereafter.
 *
 * Architecture mirrors StPageFlip (Nodlik, MIT) — we re-implement the
 * same algorithm in TypeScript with refs instead of bare DOM access,
 * and we collapse the original's class hierarchy (`PageFlip → Flip →
 * FlipCalculation → Render → HTMLRender → HTMLPage`) into one focused
 * controller. The intersection math is shared with the rest of the
 * package via `flip/geometry.ts` (pure functions, fully unit-tested).
 *
 * Why imperative? StPageFlip mutates the DOM directly inside its
 * `requestAnimationFrame` loop — typically 60 setStyle calls per
 * second across half a dozen elements. A React `useState`-driven
 * approach forces a full reconciliation per frame, which (a) costs
 * more, (b) introduces sync bugs whenever the rAF tick races a React
 * batch, and (c) is fundamentally a different model than the one
 * StPageFlip's geometry assumes. The cleanest path is to do exactly
 * what the original does and treat React only as a mount/unmount shell.
 */

import {
  computeFold,
  convertToSpread,
  type FlipCorner,
  type FlipDirection,
  type FoldGeometry,
  getBottomClipPolygon,
  getFlippingPageLocalPolygon,
  getShadowAngle,
  getShadowStartPoint,
  type Point,
  pointsToCssPolygon,
  rotatePointAround,
} from './geometry';

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export type PageFlipState = 'read' | 'fold_corner' | 'user_fold' | 'flipping';
export type LayoutMode = 'single' | 'spread';

export interface PageFlipRefs {
  /** Root `<Book>` element — defines the book's bounding rectangle. */
  container: HTMLElement;
  /** Inner box that hosts both page sides and the curl/shadow overlays. */
  viewport: HTMLElement;
  /** Left half of the current spread. Hidden when empty (e.g. closed-book cover). */
  leftPage: HTMLElement;
  /** Right half of the current spread. Hidden during a forward flip. */
  rightPage: HTMLElement;
  /** The curling sheet — clip-pathed + rotated each frame. */
  flippingPage: HTMLElement;
  /** Page being uncovered beneath the curl. */
  bottomPage: HTMLElement;
  /** Drop shadow projected onto the underlying page. */
  outerShadow: HTMLElement;
  /** Crease shadow on the back of the flipping page. */
  innerShadow: HTMLElement;
}

export interface PageMeta {
  /** True for hard cover pages (no curl, rotateY 3D). */
  hard: boolean;
  /** The HTML element holding the page's content. */
  element: HTMLElement;
}

export interface PageFlipSettings {
  width: number;
  height: number;
  showCover: boolean;
  singlePageBreakpoint: number;
  flippingTime: number;
  shadowOpacity: number;
  swipeDistance: number;
  swipeTimeThreshold: number;
  mobileScrollSupport: boolean;
  disableFlipByClick: boolean;
}

export interface PageFlipCallbacks {
  onPageChange?: (index: number) => void;
  onChangeOrientation?: (mode: LayoutMode) => void;
  onChangeState?: (state: PageFlipState) => void;
}

/* ------------------------------------------------------------------ */
/*  Controller                                                         */
/* ------------------------------------------------------------------ */

export class PageFlipController {
  private refs: PageFlipRefs;
  private pages: PageMeta[];
  private settings: PageFlipSettings;
  private callbacks: PageFlipCallbacks;

  /**
   * Current state of the flip state-machine.
   *  - `read`         — book at rest, no curl
   *  - `fold_corner`  — passive hover preview of a corner
   *  - `user_fold`    — user is actively dragging
   *  - `flipping`     — release-to-rest animation in flight
   */
  private state: PageFlipState = 'read';

  /** Index of the right page in the current spread (or single page). */
  private currentPageIndex = 0;

  /** Cached layout mode. */
  private mode: LayoutMode = 'spread';

  /** Per-frame fold state — null when not folding. */
  private foldState: {
    direction: FlipDirection;
    corner: FlipCorner;
    /** Local-frame cursor on the flipping page. */
    cursor: Point;
    /** Index of the page rendered as the curling sheet. */
    flippingPageIndex: number;
    /** Index of the page being revealed beneath. */
    bottomPageIndex: number;
  } | null = null;

  /** rAF id for the in-flight animation (release lerp or click-to-flip). */
  private rafId: number | null = null;

  /** Pointer event tracking — null when not dragging. */
  private activePointer: number | null = null;

  /** Resize observer cleanup. */
  private resizeObs: ResizeObserver | null = null;

  /* -------------------------------------------------------------- */
  /*  Lifecycle                                                      */
  /* -------------------------------------------------------------- */

  constructor(
    refs: PageFlipRefs,
    pages: PageMeta[],
    settings: PageFlipSettings,
    callbacks: PageFlipCallbacks = {}
  ) {
    this.refs = refs;
    this.pages = pages;
    this.settings = settings;
    this.callbacks = callbacks;
  }

  mount(): void {
    this.computeLayout();
    this.drawStatic();
    this.attachEvents();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => {
        const prev = this.mode;
        this.computeLayout();
        if (prev !== this.mode) {
          this.callbacks.onChangeOrientation?.(this.mode);
        }
        this.drawStatic();
      });
      this.resizeObs.observe(this.refs.container);
    }
  }

  unmount(): void {
    this.detachEvents();
    this.cancelRaf();
    this.resizeObs?.disconnect();
    this.resizeObs = null;
  }

  /** Replace the set of pages (e.g. children changed). */
  setPages(pages: PageMeta[]): void {
    this.pages = pages;
    // Clamp current index in case the count shrank.
    this.currentPageIndex = Math.max(0, Math.min(pages.length - 1, this.currentPageIndex));
    this.drawStatic();
  }

  /** Replace the settings (e.g. width/height/flippingTime changed). */
  setSettings(settings: PageFlipSettings): void {
    this.settings = settings;
    this.computeLayout();
    this.drawStatic();
  }

  /* -------------------------------------------------------------- */
  /*  Public API                                                     */
  /* -------------------------------------------------------------- */

  getCurrentPage(): number {
    return this.currentPageIndex;
  }

  getMode(): LayoutMode {
    return this.mode;
  }

  /** Animated flip toward the next page. Corner is derived from the click. */
  flipNext(corner: FlipCorner = 'top'): void {
    const target = this.targetForward();
    if (target === this.currentPageIndex) return;
    this.startAutoFlip('forward', corner, target);
  }

  flipPrev(corner: FlipCorner = 'top'): void {
    const target = this.targetBack();
    if (target === this.currentPageIndex) return;
    this.startAutoFlip('back', corner, target);
  }

  /** Animated jump to an arbitrary page index. */
  turnToPage(index: number): void {
    const clamped = Math.max(0, Math.min(this.pages.length - 1, index));
    if (clamped === this.currentPageIndex) return;
    if (clamped > this.currentPageIndex) {
      this.startAutoFlip('forward', 'top', clamped);
    } else {
      this.startAutoFlip('back', 'top', clamped);
    }
  }

  /** Instantly snap to a page without animation (e.g. on init). */
  setCurrentPage(index: number): void {
    this.currentPageIndex = Math.max(0, Math.min(this.pages.length - 1, index));
    this.cancelRaf();
    this.foldState = null;
    this.setState('read');
    this.drawStatic();
  }

  /* -------------------------------------------------------------- */
  /*  Layout                                                         */
  /* -------------------------------------------------------------- */

  private computeLayout(): void {
    const rect = this.refs.container.getBoundingClientRect();
    const containerWidth = rect.width || this.settings.width;
    this.mode = containerWidth < this.settings.singlePageBreakpoint ? 'single' : 'spread';
  }

  private get pageWidth(): number {
    return this.mode === 'spread' ? this.settings.width / 2 : this.settings.width;
  }

  private get pageHeight(): number {
    return this.settings.height;
  }

  /** The half-width origin of the right side in spread mode (0 in single). */
  private get spineX(): number {
    return this.mode === 'spread' ? this.pageWidth : 0;
  }

  /* -------------------------------------------------------------- */
  /*  Spread model                                                   */
  /* -------------------------------------------------------------- */

  /**
   * Build the list of spreads from the linear page list. With `showCover`
   * the first page sits alone (closed-book look) and the last page is
   * also alone (back cover) if it would otherwise complete a pair.
   * Mirrors `PageCollection.createSpreadOfPages` from StPageFlip.
   *
   *   showCover = true   →   [[0], [1, 2], [3, 4], …, [N-1]?]
   *   showCover = false  →   [[0, 1], [2, 3], …]
   */
  private buildSpreads(): number[][] {
    const result: number[][] = [];
    const n = this.pages.length;
    if (n === 0) return result;
    if (this.settings.showCover) {
      result.push([0]);
      let i = 1;
      while (i < n) {
        if (i + 1 < n) {
          // Last spread is the back cover alone — only when the
          // remaining inner pages pair up cleanly. If there's an odd
          // number of inner pages, the back cover sits alone.
          if (i + 2 === n) {
            result.push([i, i + 1]);
            i += 2;
          } else {
            result.push([i, i + 1]);
            i += 2;
          }
        } else {
          result.push([i]);
          i += 1;
        }
      }
    } else {
      for (let i = 0; i < n; i += 2) {
        if (i + 1 < n) {
          result.push([i, i + 1]);
        } else {
          result.push([i]);
        }
      }
    }
    return result;
  }

  /** Find the spread index that contains the given page index. */
  private spreadIndexForPage(pageIndex: number): number {
    const spreads = this.buildSpreads();
    for (let i = 0; i < spreads.length; i++) {
      if (spreads[i].includes(pageIndex)) return i;
    }
    return 0;
  }

  /** The pages making up the spread the user is currently on. */
  private currentSpread(): number[] {
    const spreads = this.buildSpreads();
    const idx = this.spreadIndexForPage(this.currentPageIndex);
    return spreads[idx] ?? [this.currentPageIndex];
  }

  /** Returns the spread `delta` away from the current one (clamped). */
  private spreadRelativeBy(delta: number): number[] | null {
    const spreads = this.buildSpreads();
    const idx = this.spreadIndexForPage(this.currentPageIndex);
    const target = idx + delta;
    if (target < 0 || target >= spreads.length) return null;
    return spreads[target];
  }

  /**
   * Page that ends up rendered on the curling sheet — the front of the
   * physical leaf that's being turned.
   *
   *  - forward: the *right* page of the current spread (it's leaving)
   *  - back:    the *left*  page of the current spread (it's leaving)
   */
  private flippingPageIdxFor(direction: FlipDirection): number {
    const cs = this.currentSpread();
    if (cs.length === 0) return this.currentPageIndex;
    return direction === 'forward' ? cs[cs.length - 1] : cs[0];
  }

  /**
   * Page revealed beneath the curl — the page that will take the
   * uncovered slot once the flip finishes.
   *
   *  - forward: the *right* page of the next spread
   *  - back:    the *left*  page of the previous spread
   */
  private bottomPageIdxFor(direction: FlipDirection): number {
    const target = this.spreadRelativeBy(direction === 'forward' ? 1 : -1);
    if (!target || target.length === 0) {
      return this.currentPageIndex;
    }
    return direction === 'forward' ? target[target.length - 1] : target[0];
  }

  /** The new currentPageIndex after committing a flip in `direction`. */
  private commitTargetFor(direction: FlipDirection): number {
    const target = this.spreadRelativeBy(direction === 'forward' ? 1 : -1);
    if (!target || target.length === 0) return this.currentPageIndex;
    // currentPageIndex represents the *right-most* page of the spread —
    // the natural "current page" the reader is on.
    return target[target.length - 1];
  }

  private targetForward(): number {
    return this.commitTargetFor('forward');
  }

  private targetBack(): number {
    return this.commitTargetFor('back');
  }

  /** Whether a flip in the given direction is possible from the current spread. */
  private canFlip(direction: FlipDirection): boolean {
    return this.spreadRelativeBy(direction === 'forward' ? 1 : -1) !== null;
  }

  /* -------------------------------------------------------------- */
  /*  Rendering — DOM mutations                                      */
  /* -------------------------------------------------------------- */

  /** Render the resting state: visible spread pages, hidden curl layers. */
  private drawStatic(): void {
    const { leftPage, rightPage, flippingPage, bottomPage, outerShadow, innerShadow } = this.refs;

    // Reset overlays.
    flippingPage.style.cssText = 'display: none';
    bottomPage.style.cssText = 'display: none';
    outerShadow.style.cssText = 'display: none';
    innerShadow.style.cssText = 'display: none';

    // Hide all user pages, then mount the spread's pages into the slots.
    for (const p of this.pages) {
      p.element.style.display = 'none';
    }

    const cs = this.currentSpread();
    const rightIdx = cs.length > 0 ? cs[cs.length - 1] : -1;
    const leftIdx = cs.length > 1 && this.mode === 'spread' ? cs[0] : -1;

    // Right slot — always rendered if the spread has at least one page.
    if (rightIdx >= 0 && rightIdx < this.pages.length) {
      this.mountPageInSlot(this.pages[rightIdx].element, rightPage);
      rightPage.style.cssText = this.slotCss('right');
    } else {
      rightPage.style.cssText = 'display: none';
    }

    // Left slot — present only for two-page spreads in spread mode (cover
    // and back cover spreads contain a single page).
    if (leftIdx >= 0 && leftIdx < this.pages.length) {
      this.mountPageInSlot(this.pages[leftIdx].element, leftPage);
      leftPage.style.cssText = this.slotCss('left');
    } else {
      leftPage.style.cssText = 'display: none';
    }
  }

  /**
   * Copies the content of `pageEl` into `slot` (clearing any previous
   * content first). We deliberately **clone** rather than re-parent
   * because the page elements are owned by React — moving them between
   * containers causes virtual-DOM/real-DOM divergence and React can
   * end up wiping out the controller's positioning on the next render.
   *
   * The trade-off is that event handlers attached to deep children are
   * not cloned, which is fine for static page bodies (text, images, JSX
   * markup). If a consumer needs interactive widgets inside a page they
   * can attach them on the page element itself (the controller never
   * touches it directly).
   */
  private mountPageInSlot(pageEl: HTMLElement, slot: HTMLElement): void {
    // Compare current content key — only re-clone when the source page
    // changes (cheap fast path for per-frame redraws).
    const key = pageEl.getAttribute('data-page-index') ?? '';
    if (slot.getAttribute('data-mounted-page') === key) {
      return;
    }
    // Use innerHTML to preserve text nodes — `children` only enumerates
    // element children, which would drop plain-string page content like
    // `<Book.Page>Cover</Book.Page>`.
    slot.innerHTML = pageEl.innerHTML;
    slot.setAttribute('data-mounted-page', key);
  }

  /** CSS for the left/right spread slot. */
  private slotCss(side: 'left' | 'right'): string {
    return [
      'display: block',
      'position: absolute',
      'top: 0',
      side === 'left' ? `left: 0` : `left: ${this.spineX}px`,
      `width: ${this.pageWidth}px`,
      `height: ${this.pageHeight}px`,
      'overflow: hidden',
      'background: var(--book-page-background, white)',
      'box-sizing: border-box',
      'padding: 28px',
      'color: var(--mantine-color-text, #111)',
      'font-size: 1.5rem',
      'font-weight: 500',
      'line-height: 1.4',
      'z-index: 1',
    ].join('; ');
  }

  /**
   * Render a frame mid-fold. Mirrors `HTMLRender.drawFrame` from
   * StPageFlip — positions the flipping page, the bottom page (revealed
   * underneath), and the two shadow strips based on `this.foldState`.
   */
  private drawFrame(): void {
    if (!this.foldState) {
      this.drawStatic();
      return;
    }

    const { direction, corner, cursor, flippingPageIndex, bottomPageIndex } = this.foldState;
    const { pageWidth, pageHeight } = this;

    // Compute the fold geometry — bail and reset if cursor is degenerate.
    let geo: FoldGeometry;
    try {
      geo = computeFold({ cursor, pageWidth, pageHeight, corner, direction });
    } catch {
      // Cursor too close to the corner: just reset to static.
      this.drawStatic();
      return;
    }

    // 1) Hide the static slot the curl is lifting from — but ONLY during
    //    an active drag or running animation. The passive `fold_corner`
    //    hover keeps both sides visible so the book stays whole behind
    //    the tiny preview curl.
    const hideStaticSide = this.state === 'user_fold' || this.state === 'flipping';
    if (hideStaticSide) {
      if (direction === 'forward') {
        this.refs.rightPage.style.display = 'none';
      } else {
        this.refs.leftPage.style.display = 'none';
      }
    }

    // 2) Bottom page (revealed). Position at the freshly-uncovered slot.
    //    The clip-path is applied in the bottomPage's **element-local**
    //    coordinate system. For FORWARD the bottomPage sits at left=spineX
    //    so its element-local x = spread.x - spineX = page-local x. For
    //    BACK it sits at left=0 and is mirrored around the spine, so
    //    element-local x = pageWidth - page-local x. `convertToSpread`
    //    gives exactly that mapping for the BACK case but **not** for
    //    FORWARD — there we must use the page-local points as-is.
    //
    //    NOTE: during a passive hover hint (`fold_corner`) we skip the
    //    bottom layer entirely — the user shouldn't see the next page
    //    rendered over the current spread, only the tiny corner curl.
    const showBottomLayer = hideStaticSide;
    const bottomPage = this.pages[bottomPageIndex];
    if (showBottomLayer && bottomPage) {
      const bottomSlotLeft = direction === 'forward' ? this.spineX : 0;
      this.mountPageInSlot(bottomPage.element, this.refs.bottomPage);
      const bottomPoly = getBottomClipPolygon(geo, corner, pageWidth, pageHeight);
      const bottomPolyLocal =
        direction === 'forward'
          ? bottomPoly
          : bottomPoly.map((p) => convertToSpread(p, direction, pageWidth));
      const bottomClipCss = pointsToCssPolygon(bottomPolyLocal, 'px');
      this.refs.bottomPage.style.cssText = [
        'display: block',
        'position: absolute',
        'top: 0',
        `left: ${bottomSlotLeft}px`,
        `width: ${pageWidth}px`,
        `height: ${pageHeight}px`,
        'overflow: hidden',
        'background: var(--book-page-background, white)',
        'box-sizing: border-box',
        'padding: 28px',
        'color: var(--mantine-color-text, #111)',
        'font-size: 1.5rem',
        'font-weight: 500',
        'line-height: 1.4',
        'z-index: 3',
        bottomClipCss ? `clip-path: ${bottomClipCss}` : '',
        bottomClipCss ? `-webkit-clip-path: ${bottomClipCss}` : '',
      ]
        .filter(Boolean)
        .join('; ');
    } else {
      this.refs.bottomPage.style.cssText = 'display: none';
    }

    // 3) Flipping page — the curling sheet.
    const flippingPage = this.pages[flippingPageIndex];
    if (!flippingPage) {
      this.refs.flippingPage.style.cssText = 'display: none';
      return;
    }
    const localPoly = getFlippingPageLocalPolygon(geo, corner, direction);
    const frontClip = pointsToCssPolygon(localPoly, 'px');
    if (!frontClip) {
      this.refs.flippingPage.style.cssText = 'display: none';
    } else {
      const globalPos = convertToSpread(geo.position, direction, pageWidth);
      const angleRad = geo.angle;
      this.mountPageInSlot(flippingPage.element, this.refs.flippingPage);
      this.refs.flippingPage.style.cssText = [
        'display: block',
        'position: absolute',
        'left: 0',
        'top: 0',
        `width: ${pageWidth}px`,
        `height: ${pageHeight}px`,
        'background: var(--book-page-background, white)',
        'box-sizing: border-box',
        'padding: 28px',
        'color: var(--mantine-color-text, #111)',
        'font-size: 1.5rem',
        'font-weight: 500',
        'line-height: 1.4',
        'box-shadow: 0 3px 14px rgba(0, 0, 0, 0.18)',
        'transform-origin: 0 0',
        `transform: translate3d(${globalPos.x}px, ${globalPos.y}px, 0) rotate(${angleRad}rad)`,
        `clip-path: ${frontClip}`,
        `-webkit-clip-path: ${frontClip}`,
        'z-index: 5',
      ].join('; ');
    }

    // 4) Shadows — also skipped during a hover hint preview.
    if (showBottomLayer) {
      this.drawShadows(geo, corner, direction);
    } else {
      this.refs.outerShadow.style.cssText = 'display: none';
      this.refs.innerShadow.style.cssText = 'display: none';
    }
  }

  private drawShadows(geo: FoldGeometry, corner: FlipCorner, direction: FlipDirection): void {
    const { pageWidth, pageHeight } = this;
    const shadowStart = getShadowStartPoint(geo, corner);

    // Width/opacity formulas from StPageFlip — width grows with progress,
    // opacity decays. `maxOpacity` is the user-configurable ceiling.
    const progress = Math.max(0, Math.min(100, geo.progress));
    const rawShadowWidth = ((pageWidth * 3) / 4) * (progress / 100);
    const opacity = ((100 - progress) * this.settings.shadowOpacity) / 100;

    if (!shadowStart || rawShadowWidth <= 0 || opacity <= 0) {
      this.refs.outerShadow.style.cssText = 'display: none';
      this.refs.innerShadow.style.cssText = 'display: none';
      return;
    }

    const shadowAngle = getShadowAngle(geo, corner, direction, pageWidth) + (3 * Math.PI) / 2;
    const globalShadow = convertToSpread(shadowStart, direction, pageWidth);
    const fwd = direction === 'forward';
    const rgba = (a: number) => `rgba(0, 0, 0, ${Math.max(0, Math.min(1, a)).toFixed(4)})`;

    // --- Outer drop shadow --------------------------------------
    {
      const shadowTranslate = fwd ? 0 : rawShadowWidth;
      const tx = globalShadow.x - shadowTranslate;
      const ty = globalShadow.y - 100;
      const clip: Point[] = [
        geo.rect.topLeft,
        geo.rect.topRight,
        geo.rect.bottomRight,
        geo.rect.bottomLeft,
      ];
      const poly = clip.map((p) => {
        const local =
          direction === 'back'
            ? { x: -p.x + shadowStart.x, y: p.y - shadowStart.y }
            : { x: p.x - shadowStart.x, y: p.y - shadowStart.y };
        return rotatePointAround(local, { x: shadowTranslate, y: 100 }, shadowAngle);
      });
      const clipPath = pointsToCssPolygon(poly, 'px');
      const gradient = `linear-gradient(${fwd ? 'to right' : 'to left'}, ${rgba(opacity)}, ${rgba(0)})`;
      this.refs.outerShadow.style.cssText = [
        'display: block',
        'position: absolute',
        'left: 0',
        'top: 0',
        `width: ${rawShadowWidth}px`,
        `height: ${pageHeight * 2}px`,
        'pointer-events: none',
        `background: ${gradient}`,
        `transform-origin: ${shadowTranslate}px 100px`,
        `transform: translate3d(${tx}px, ${ty}px, 0) rotate(${shadowAngle}rad)`,
        clipPath ? `clip-path: ${clipPath}` : '',
        clipPath ? `-webkit-clip-path: ${clipPath}` : '',
        'z-index: 10',
      ]
        .filter(Boolean)
        .join('; ');
    }

    // --- Inner crease shadow ------------------------------------
    {
      const innerWidth = (rawShadowWidth * 3) / 4;
      const shadowTranslate = fwd ? innerWidth : 0;
      const tx = globalShadow.x - shadowTranslate;
      const ty = globalShadow.y - 100;
      const clip: Point[] = [
        geo.rect.topLeft,
        geo.rect.topRight,
        geo.rect.bottomRight,
        geo.rect.bottomLeft,
      ];
      const poly = clip.map((p) => {
        const local =
          direction === 'back'
            ? { x: -p.x + shadowStart.x, y: p.y - shadowStart.y }
            : { x: p.x - shadowStart.x, y: p.y - shadowStart.y };
        return rotatePointAround(local, { x: shadowTranslate, y: 100 }, shadowAngle);
      });
      const clipPath = pointsToCssPolygon(poly, 'px');
      const gradient = `linear-gradient(${fwd ? 'to left' : 'to right'}, ${rgba(opacity)} 5%, ${rgba(0.05)} 15%, ${rgba(opacity)} 35%, ${rgba(0)} 100%)`;
      this.refs.innerShadow.style.cssText = [
        'display: block',
        'position: absolute',
        'left: 0',
        'top: 0',
        `width: ${innerWidth}px`,
        `height: ${pageHeight * 2}px`,
        'pointer-events: none',
        `background: ${gradient}`,
        `transform-origin: ${shadowTranslate}px 100px`,
        `transform: translate3d(${tx}px, ${ty}px, 0) rotate(${shadowAngle}rad)`,
        clipPath ? `clip-path: ${clipPath}` : '',
        clipPath ? `-webkit-clip-path: ${clipPath}` : '',
        'z-index: 10',
      ]
        .filter(Boolean)
        .join('; ');
    }
  }

  /* -------------------------------------------------------------- */
  /*  Event handling                                                 */
  /* -------------------------------------------------------------- */

  private attachEvents(): void {
    this.refs.viewport.addEventListener('pointerdown', this.onPointerDown);
    this.refs.viewport.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointermove', this.onWindowPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  private detachEvents(): void {
    this.refs.viewport.removeEventListener('pointerdown', this.onPointerDown);
    this.refs.viewport.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointermove', this.onWindowPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.state === 'flipping') return;

    const bookPos = this.toBookPos(e.clientX, e.clientY);
    const onCorner = this.isPointOnCorners(bookPos);

    if (!onCorner) {
      // Side click — defer to a click-to-flip.
      if (this.settings.disableFlipByClick) return;
      const rect = this.refs.viewport.getBoundingClientRect();
      const corner: FlipCorner = bookPos.y < rect.height / 2 ? 'top' : 'bottom';
      if (bookPos.x < rect.width / 2) {
        this.flipPrev(corner);
      } else {
        this.flipNext(corner);
      }
      return;
    }

    const direction = this.getDirection(bookPos);
    // Bail out if a flip in that direction isn't possible — we're at the
    // start of the book trying to go back, or at the end trying forward.
    if (!this.canFlip(direction)) return;

    // Start a user fold.
    this.activePointer = e.pointerId;
    try {
      this.refs.viewport.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const corner = this.getCorner(bookPos);
    this.beginFold(direction, corner, bookPos);
    e.preventDefault();
  };

  private onPointerMove = (e: PointerEvent): void => {
    // Only the corner-hint preview is handled from the viewport — drag
    // moves come through `onWindowPointerMove` so they keep firing when
    // the pointer leaves the book bounds.
    if (e.pointerType !== 'mouse') return;
    if (this.state === 'flipping') return;
    if (this.state === 'user_fold') return; // window handler will pick it up

    const bookPos = this.toBookPos(e.clientX, e.clientY);
    const onCorner = this.isPointOnCorners(bookPos);

    if (onCorner) {
      this.refs.viewport.style.cursor = 'grab';
      this.showCornerHint(bookPos);
    } else if (this.state === 'fold_corner') {
      this.refs.viewport.style.cursor = '';
      this.endFoldKeepCurrentPage();
    } else {
      this.refs.viewport.style.cursor = '';
    }
  };

  private onWindowPointerMove = (e: PointerEvent): void => {
    if (this.state !== 'user_fold') return;
    if (this.activePointer !== null && e.pointerId !== this.activePointer) return;
    const bookPos = this.toBookPos(e.clientX, e.clientY);
    if (!this.foldState) return;
    this.foldState.cursor = this.toPagePos(bookPos, this.foldState.direction);
    this.drawFrame();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.activePointer === null) return;
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    try {
      this.refs.viewport.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.refs.viewport.style.cursor = '';
    if (this.state === 'user_fold') {
      this.stopMove();
    }
  };

  /* -------------------------------------------------------------- */
  /*  Coordinate helpers                                             */
  /* -------------------------------------------------------------- */

  private toBookPos(clientX: number, clientY: number): Point {
    const rect = this.refs.viewport.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private toPagePos(bookPos: Point, direction: FlipDirection): Point {
    return {
      x: direction === 'forward' ? bookPos.x - this.pageWidth : this.pageWidth - bookPos.x,
      y: bookPos.y,
    };
  }

  private isPointOnCorners(bookPos: Point): boolean {
    const rect = this.refs.viewport.getBoundingClientRect();
    const op = Math.sqrt(rect.width * rect.width + rect.height * rect.height) / 5;
    return (
      bookPos.x > 0 &&
      bookPos.y > 0 &&
      bookPos.x < rect.width &&
      bookPos.y < rect.height &&
      (bookPos.x < op || bookPos.x > rect.width - op) &&
      (bookPos.y < op || bookPos.y > rect.height - op)
    );
  }

  private getDirection(bookPos: Point): FlipDirection {
    const rect = this.refs.viewport.getBoundingClientRect();
    return bookPos.x < rect.width / 2 ? 'back' : 'forward';
  }

  private getCorner(bookPos: Point): FlipCorner {
    const rect = this.refs.viewport.getBoundingClientRect();
    return bookPos.y < rect.height / 2 ? 'top' : 'bottom';
  }

  /* -------------------------------------------------------------- */
  /*  Fold lifecycle                                                 */
  /* -------------------------------------------------------------- */

  private beginFold(direction: FlipDirection, corner: FlipCorner, bookPos: Point): void {
    this.cancelRaf();
    const flippingPageIndex = this.flippingPageIdxFor(direction);
    const bottomPageIndex = this.bottomPageIdxFor(direction);
    this.foldState = {
      direction,
      corner,
      cursor: this.toPagePos(bookPos, direction),
      flippingPageIndex,
      bottomPageIndex,
    };
    this.setState('user_fold');
    this.drawFrame();
  }

  /** Tiny static curl shown when the mouse hovers a corner without clicking. */
  private showCornerHint(bookPos: Point): void {
    const direction = this.getDirection(bookPos);
    const corner = this.getCorner(bookPos);
    const flippingPageIndex = this.flippingPageIdxFor(direction);
    const bottomPageIndex = this.bottomPageIdxFor(direction);
    this.foldState = {
      direction,
      corner,
      cursor: {
        x: this.pageWidth - 50,
        y: corner === 'bottom' ? this.pageHeight - 50 : 50,
      },
      flippingPageIndex,
      bottomPageIndex,
    };
    this.setState('fold_corner');
    this.drawFrame();
  }

  /**
   * Reset to the resting state without committing a page change. Called
   * when the corner hint dismisses or a drag bounces back.
   */
  private endFoldKeepCurrentPage(): void {
    this.foldState = null;
    this.setState('read');
    this.drawStatic();
  }

  /**
   * Release-handler — decide whether to complete the flip or snap back,
   * then animate the rest of the cursor lerp.
   */
  private stopMove(): void {
    if (!this.foldState) return;
    const { direction, corner, cursor } = this.foldState;
    const topMargin = this.pageHeight / 10;
    const yDest = corner === 'bottom' ? this.pageHeight : 0;

    if (cursor.x <= 0) {
      // Past the spine — complete the flip.
      const target =
        direction === 'forward' ? this.targetForward() : this.targetBack();
      this.animateCursorTo(
        cursor,
        { x: -this.pageWidth, y: yDest },
        () => this.commitPageChange(target)
      );
    } else {
      // Snap back to the resting corner.
      const yStart = corner === 'bottom' ? this.pageHeight - topMargin : topMargin;
      this.animateCursorTo(
        cursor,
        { x: this.pageWidth - topMargin, y: yStart },
        () => this.endFoldKeepCurrentPage()
      );
    }
  }

  /* -------------------------------------------------------------- */
  /*  Click-to-flip and release animations                          */
  /* -------------------------------------------------------------- */

  private startAutoFlip(direction: FlipDirection, corner: FlipCorner, target: number): void {
    this.cancelRaf();
    const topMargin = this.pageHeight / 10;
    const yStart = corner === 'bottom' ? this.pageHeight - topMargin : topMargin;
    const yDest = corner === 'bottom' ? this.pageHeight : 0;
    const start: Point = { x: this.pageWidth - topMargin, y: yStart };
    const dest: Point = { x: -this.pageWidth, y: yDest };
    const flippingPageIndex = this.flippingPageIdxFor(direction);
    const bottomPageIndex = this.bottomPageIdxFor(direction);

    this.foldState = {
      direction,
      corner,
      cursor: start,
      flippingPageIndex,
      bottomPageIndex,
    };
    this.setState('flipping');
    this.animateCursorTo(start, dest, () => this.commitPageChange(target));
  }

  /**
   * Lerps `this.foldState.cursor` from `start` to `dest` over
   * `flippingTime` ms, redrawing each frame. `onComplete` runs after the
   * last frame.
   */
  private animateCursorTo(start: Point, dest: Point, onComplete: () => void): void {
    const startTs = performance.now();
    const duration = this.settings.flippingTime;

    const tick = () => {
      if (!this.foldState) return;
      const elapsed = performance.now() - startTs;
      const t = Math.min(1, duration === 0 ? 1 : elapsed / duration);
      this.foldState.cursor = {
        x: start.x + (dest.x - start.x) * t,
        y: start.y + (dest.y - start.y) * t,
      };
      this.drawFrame();
      if (t >= 1) {
        this.rafId = null;
        onComplete();
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private cancelRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Commit a page change after a flip completes. */
  private commitPageChange(target: number): void {
    this.currentPageIndex = target;
    this.foldState = null;
    this.setState('read');
    this.drawStatic();
    this.callbacks.onPageChange?.(target);
  }

  /* -------------------------------------------------------------- */
  /*  State transitions                                              */
  /* -------------------------------------------------------------- */

  private setState(next: PageFlipState): void {
    if (this.state === next) return;
    this.state = next;
    this.callbacks.onChangeState?.(next);
  }
}
