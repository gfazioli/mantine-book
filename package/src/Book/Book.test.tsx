import { render } from '@mantine-tests/core';
import { act, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Book } from './Book';
import { type BookContextValue, INHERITABLE_PROPS } from './Book.context';
import { BookPage } from './BookPage';
import { faceToTurnedPages, turnedPagesToFace } from './page-index';

const threePages = [
  <Book.Page key="p1">
    <Book.Page.Front>F1</Book.Page.Front>
    <Book.Page.Back>B1</Book.Page.Back>
  </Book.Page>,
  <Book.Page key="p2">
    <Book.Page.Front>F2</Book.Page.Front>
    <Book.Page.Back>B2</Book.Page.Back>
  </Book.Page>,
  <Book.Page key="p3">
    <Book.Page.Front>F3</Book.Page.Front>
    <Book.Page.Back>B3</Book.Page.Back>
  </Book.Page>,
];

/** data-flipped per page, in order. */
function flippedStates(container: HTMLElement): boolean[] {
  const wrappers = Array.from(container.querySelectorAll<HTMLElement>('[class*="page"]'));
  return wrappers.map((wrap) => {
    const root = wrap.firstElementChild as HTMLElement;
    return root.getAttribute('data-flipped') !== null;
  });
}

describe('page-index math', () => {
  it('maps a face index to the pages turned (liberal setter)', () => {
    // 3 pages → faces 0..5. Page i: front 2i, back 2i+1.
    expect(faceToTurnedPages(0, 3)).toBe(0);
    expect(faceToTurnedPages(1, 3)).toBe(1);
    expect(faceToTurnedPages(2, 3)).toBe(1); // same spread as 1
    expect(faceToTurnedPages(3, 3)).toBe(2);
    expect(faceToTurnedPages(4, 3)).toBe(2); // same spread as 3
    expect(faceToTurnedPages(5, 3)).toBe(3);
    // clamped
    expect(faceToTurnedPages(99, 3)).toBe(3);
    expect(faceToTurnedPages(-1, 3)).toBe(0);
  });

  it('reports the first visible face in reading order', () => {
    expect(turnedPagesToFace(0)).toBe(0);
    expect(turnedPagesToFace(1)).toBe(1);
    expect(turnedPagesToFace(2)).toBe(3);
    expect(turnedPagesToFace(3)).toBe(5);
  });
});

describe('Book', () => {
  it('renders without crashing with no pages', () => {
    const { container } = render(<Book />);
    expect(container.querySelector('[class*="root"]')).toBeTruthy();
  });

  it('exposes Page (with Front/Back) as static compound components', () => {
    expect(Book.Page).toBe(BookPage);
    // No dot in the Page displayName: the docs PropsTable composes
    // "Book.Page" from prefix + name (same convention as WindowGroup).
    expect(Book.Page.displayName).toBe('BookPage');
    expect(Book.Page.Front.displayName).toBe('Book.Page.Front');
    expect(Book.Page.Back.displayName).toBe('Book.Page.Back');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Book ref={ref}>{threePages}</Book>);
    expect(ref.current).toBeTruthy();
  });

  it('renders every page face (React-owned)', () => {
    const { getByText } = render(<Book>{threePages}</Book>);
    for (const text of ['F1', 'B1', 'F2', 'B2', 'F3', 'B3']) {
      expect(getByText(text)).toBeInTheDocument();
    }
  });

  it('renders the data-driven pages prop when no children are given', () => {
    const { getByText } = render(
      <Book
        pages={[
          { front: 'PF1', back: 'PB1' },
          { front: 'PF2', back: 'PB2' },
        ]}
      />
    );
    for (const text of ['PF1', 'PB1', 'PF2', 'PB2']) {
      expect(getByText(text)).toBeInTheDocument();
    }
  });

  it('rests every page on the right at page 0 (default)', () => {
    const { container } = render(<Book>{threePages}</Book>);
    expect(flippedStates(container)).toEqual([false, false, false]);
  });

  it('turns the pages covered by the face index (controlled)', () => {
    // face 3 = back of page 2 visible → pages 1 and 2 turned.
    const { container } = render(<Book page={3}>{threePages}</Book>);
    expect(flippedStates(container)).toEqual([true, true, false]);
  });

  it('treats both faces of a spread as the same state', () => {
    const a = render(<Book page={1}>{threePages}</Book>);
    const b = render(<Book page={2}>{threePages}</Book>);
    expect(flippedStates(a.container)).toEqual(flippedStates(b.container));
  });

  it('clamps an out-of-range page to the last face', () => {
    const { container } = render(<Book page={99}>{threePages}</Book>);
    expect(flippedStates(container)).toEqual([true, true, true]);
  });

  it('follows external page changes with an animated turn (controlled jump)', async () => {
    // flippingTime=0 → the programmatic turn completes on the next frame.
    const fastPages = [0, 1, 2].map((i) => (
      <Book.Page key={i} flippingTime={0}>
        <Book.Page.Front>F{i}</Book.Page.Front>
        <Book.Page.Back>B{i}</Book.Page.Back>
      </Book.Page>
    ));
    const { container, rerender } = render(<Book page={0}>{fastPages}</Book>);
    expect(flippedStates(container)).toEqual([false, false, false]);
    rerender(<Book page={5}>{fastPages}</Book>);
    await waitFor(() => expect(flippedStates(container)).toEqual([true, true, true]));
    rerender(<Book page={1}>{fastPages}</Book>);
    await waitFor(() => expect(flippedStates(container)).toEqual([true, false, false]));
  });

  it('serializes multi-page jumps: one page in flight at a time, in order (riffle)', async () => {
    const events: string[] = [];
    const fastPages = [0, 1, 2].map((i) => (
      <Book.Page
        key={i}
        flippingTime={0}
        onFold={() => {
          if (events[events.length - 1] !== `fold:${i}`) {
            events.push(`fold:${i}`);
          }
        }}
        onFlip={() => events.push(`flip:${i}`)}
      >
        <Book.Page.Front>F{i}</Book.Page.Front>
        <Book.Page.Back>B{i}</Book.Page.Back>
      </Book.Page>
    ));
    // Drive the jump from inside (End key): an RTL rerender would REMOUNT the
    // whole tree (fresh internal state) and bypass the queue entirely.
    const { container } = render(<Book>{fastPages}</Book>);
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    fireEvent.keyDown(root, { key: 'End' });
    await waitFor(() => expect(flippedStates(container)).toEqual([true, true, true]));
    // Every page in the path turned (riffle, not snap), strictly one after
    // the other: each page's flip completes before the next page's first fold.
    expect(events).toEqual(['fold:0', 'flip:0', 'fold:1', 'flip:1', 'fold:2', 'flip:2']);
  });

  it('queues rapid keyboard turns instead of overlapping them', async () => {
    const fastPages = [0, 1, 2].map((i) => (
      <Book.Page key={i} flippingTime={0}>
        <Book.Page.Front>F{i}</Book.Page.Front>
        <Book.Page.Back>B{i}</Book.Page.Back>
      </Book.Page>
    ));
    const { container } = render(<Book>{fastPages}</Book>);
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    // Three rapid presses before any animation can settle.
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    await waitFor(() => expect(flippedStates(container)).toEqual([true, true, true]));
  });

  it('starts from defaultPage when uncontrolled', () => {
    const { container } = render(<Book defaultPage={1}>{threePages}</Book>);
    expect(flippedStates(container)).toEqual([true, false, false]);
  });

  it('disables the pages that are not on top of either half', () => {
    const { container } = render(<Book page={1}>{threePages}</Book>);
    const wrappers = Array.from(container.querySelectorAll<HTMLElement>('[class*="page"]'));
    const roots = wrappers.map((wrap) => wrap.firstElementChild as HTMLElement);
    // face 1 → 1 page turned → page 0 (left top) and page 1 (right top)
    // interactive, page 2 buried → disabled.
    expect(roots[0].getAttribute('data-disabled')).toBeNull();
    expect(roots[1].getAttribute('data-disabled')).toBeNull();
    expect(roots[2].getAttribute('data-disabled')).not.toBeNull();
  });

  it('paints the inside-cover base on the Book root without cascading to pages', () => {
    const { container } = render(<Book revealBackground="rgb(7, 8, 9)">{threePages}</Book>);
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    expect(root.style.getPropertyValue('--curl-reveal-background')).toBe('rgb(7, 8, 9)');
    // No per-page reveal layer: the stack's natural reveal is the next page.
    expect(container.querySelector('[class*="revealLayer"]')).toBeNull();
    const pageRoots = Array.from(container.querySelectorAll<HTMLElement>('[class*="page"]')).map(
      (wrap) => wrap.firstElementChild as HTMLElement
    );
    expect(pageRoots[0].style.getPropertyValue('--curl-reveal-background')).toBe('');
  });

  it('renders the per-page reveal layer only when set on the page itself', () => {
    const { container, rerender } = render(
      <BookPage width={120} height={160}>
        <BookPage.Front>A</BookPage.Front>
      </BookPage>
    );
    expect(container.querySelector('[class*="revealLayer"]')).toBeNull();
    rerender(
      <BookPage width={120} height={160} revealBackground="rgb(1, 2, 3)">
        <BookPage.Front>A</BookPage.Front>
      </BookPage>
    );
    expect(container.querySelector('[class*="revealLayer"]')).toBeTruthy();
  });

  it('exposes book semantics and is keyboard focusable', () => {
    const { container } = render(<Book>{threePages}</Book>);
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    expect(root.getAttribute('role')).toBe('group');
    expect(root.getAttribute('aria-roledescription')).toBe('book');
    expect(root.getAttribute('tabindex')).toBe('0');
  });

  it('is not focusable when disabled', () => {
    const { container } = render(<Book disabled>{threePages}</Book>);
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    expect(root.getAttribute('tabindex')).toBe('-1');
  });

  it('turns pages with the keyboard (arrows, Home, End)', async () => {
    const fastPages = [0, 1, 2].map((i) => (
      <Book.Page key={i} flippingTime={0}>
        <Book.Page.Front>F{i}</Book.Page.Front>
        <Book.Page.Back>B{i}</Book.Page.Back>
      </Book.Page>
    ));
    const { container } = render(<Book>{fastPages}</Book>);
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;

    fireEvent.keyDown(root, { key: 'ArrowRight' });
    await waitFor(() => expect(flippedStates(container)).toEqual([true, false, false]));

    fireEvent.keyDown(root, { key: 'ArrowLeft' });
    await waitFor(() => expect(flippedStates(container)).toEqual([false, false, false]));

    fireEvent.keyDown(root, { key: 'End' });
    await waitFor(() => expect(flippedStates(container)).toEqual([true, true, true]));

    fireEvent.keyDown(root, { key: 'Home' });
    await waitFor(() => expect(flippedStates(container)).toEqual([false, false, false]));
  });

  it('ignores keys when disabled', () => {
    const onPageChange = jest.fn();
    const { container } = render(
      <Book disabled onPageChange={onPageChange}>
        {threePages}
      </Book>
    );
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('ignores keys bubbling from face content', () => {
    const onPageChange = jest.fn();
    const { getByText } = render(<Book onPageChange={onPageChange}>{threePages}</Book>);
    fireEvent.keyDown(getByText('F1'), { key: 'ArrowRight' });
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('has a default accessible name, overridable by the consumer', () => {
    const a = render(<Book>{threePages}</Book>);
    expect(
      a.container.querySelector<HTMLElement>('[class*="root"]')!.getAttribute('aria-label')
    ).toBe('Book');
    const b = render(<Book aria-label="Photo album">{threePages}</Book>);
    expect(
      b.container.querySelector<HTMLElement>('[class*="root"]')!.getAttribute('aria-label')
    ).toBe('Photo album');
    const c = render(<Book aria-labelledby="title-id">{threePages}</Book>);
    const rootC = c.container.querySelector<HTMLElement>('[class*="root"]')!;
    expect(rootC.getAttribute('aria-labelledby')).toBe('title-id');
    expect(rootC.getAttribute('aria-label')).toBeNull();
  });

  it('composes a consumer onKeyDown with the built-in keyboard navigation', async () => {
    const fastPages = [0, 1].map((i) => (
      <Book.Page key={i} flippingTime={0}>
        <Book.Page.Front>F{i}</Book.Page.Front>
        <Book.Page.Back>B{i}</Book.Page.Back>
      </Book.Page>
    ));
    const userHandler = jest.fn();
    const { container } = render(<Book onKeyDown={userHandler}>{fastPages}</Book>);
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(userHandler).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(flippedStates(container)).toEqual([true, false]));
  });

  it('lets a consumer onKeyDown opt out of the built-in turn via preventDefault', () => {
    const onPageChange = jest.fn();
    const { container } = render(
      <Book
        onPageChange={onPageChange}
        onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => event.preventDefault()}
      >
        {threePages}
      </Book>
    );
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('announces the visible pages through a polite live region', () => {
    const { container, rerender } = render(<Book page={0}>{threePages}</Book>);
    const live = () => container.querySelector<HTMLElement>('[aria-live="polite"]')!.textContent;
    expect(live()).toBe('Page 1 of 6');
    rerender(<Book page={1}>{threePages}</Book>);
    expect(live()).toBe('Pages 2–3 of 6');
    rerender(<Book page={5}>{threePages}</Book>);
    expect(live()).toBe('Page 6 of 6');
  });

  it('supports a custom pageAnnouncement formatter', () => {
    const { container } = render(
      <Book page={1} pageAnnouncement={({ from, to, total }) => `Pagine ${from}-${to} di ${total}`}>
        {threePages}
      </Book>
    );
    const live = container.querySelector<HTMLElement>('[aria-live="polite"]')!;
    expect(live.textContent).toBe('Pagine 2-3 di 6');
  });

  it('inherits Book props on pages via optional context (page override wins)', () => {
    const { container } = render(
      <Book pageBackground="rgb(1, 2, 3)">
        <Book.Page key="a">
          <Book.Page.Front>A</Book.Page.Front>
        </Book.Page>
        <Book.Page key="b" pageBackground="rgb(9, 9, 9)">
          <Book.Page.Front>B</Book.Page.Front>
        </Book.Page>
      </Book>
    );
    const roots = Array.from(container.querySelectorAll<HTMLElement>('[class*="page"]')).map(
      (wrap) => wrap.firstElementChild as HTMLElement
    );
    expect(roots[0].style.getPropertyValue('--curl-page-background')).toBe('rgb(1, 2, 3)');
    expect(roots[1].style.getPropertyValue('--curl-page-background')).toBe('rgb(9, 9, 9)');
  });
});

/* ------------------------------------------------------------------ */
/*  PR-D hardening — z-boost, queue lock, edges, drift guard            */
/* ------------------------------------------------------------------ */

describe('Book stack hardening', () => {
  const fastPages = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      <Book.Page key={i} flippingTime={0}>
        <Book.Page.Front>F{i}</Book.Page.Front>
        <Book.Page.Back>B{i}</Book.Page.Back>
      </Book.Page>
    ));

  const wrappersOf = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>('[class*="page"]'));
  const zIndexes = (container: HTMLElement) =>
    wrappersOf(container).map((wrap) => Number(wrap.style.zIndex));
  const disabledStates = (container: HTMLElement) =>
    wrappersOf(container).map(
      (wrap) => (wrap.firstElementChild as HTMLElement).getAttribute('data-disabled') !== null
    );

  it('raises the stepping page above BOTH stacks in the very commit its step starts', async () => {
    const { container } = render(<Book>{fastPages(3)}</Book>);
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    // At rest: right stack order (top page highest), nobody raised.
    expect(zIndexes(container)).toEqual([3, 2, 1]);

    fireEvent.keyDown(root, { key: 'ArrowRight' });
    // Synchronously after the keydown — BEFORE the controller's first rAF
    // tick fires onFold — the in-flight page must already be on top. (The
    // old foldingIndex-driven boost left it one frame BELOW its neighbour:
    // the start-of-turn flash.)
    expect(zIndexes(container)[0]).toBe(3 + 2);

    await waitFor(() => expect(flippedStates(container)).toEqual([true, false, false]));
    // Settled: back to the regular stack orders (left stack: index + 1).
    expect(zIndexes(container)).toEqual([1, 2, 1]);
  });

  it('raises the stepping page immediately on a BACKWARD turn too', () => {
    const { container } = render(<Book defaultPage={5}>{fastPages(3)}</Book>);
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    fireEvent.keyDown(root, { key: 'ArrowLeft' });
    // In-flight backward page = displayedTurned − 1 = page 2.
    expect(zIndexes(container)[2]).toBe(3 + 2);
  });

  it('locks every page except the in-flight one while a queue step runs', () => {
    const { container } = render(<Book>{fastPages(3)}</Book>);
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    fireEvent.keyDown(root, { key: 'End' });
    // Step on page 0 is in flight: page 1 is top-of-right but LOCKED (it is
    // not the in-flight page), page 2 is buried. Without the lock this would
    // read [false, false, true] and two pages could fold at once.
    expect(disabledStates(container)).toEqual([false, true, true]);
  });

  it('renders an empty pages array without crashing and announces nothing', () => {
    const { container } = render(<Book pages={[]} />);
    expect(wrappersOf(container)).toHaveLength(0);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent ?? '').toBe('');
  });

  it('renders a data-driven page with no back face (blank back, no crash)', () => {
    const { getByText } = render(<Book pages={[{ front: 'OnlyFront' }]} />);
    expect(getByText('OnlyFront')).toBeInTheDocument();
  });

  it('applies per-page props from the data-driven pages prop', () => {
    const { container } = render(
      <Book
        pages={[
          { front: 'F1', back: 'B1', props: { revealBackground: 'red' } },
          { front: 'F2', back: 'B2' },
        ]}
      />
    );
    // Only the page that asked for it renders the reveal layer.
    expect(container.querySelectorAll('[class*="revealLayer"]')).toHaveLength(1);
  });

  it('clamps a negative controlled page to the closed book', () => {
    const { container } = render(<Book page={-3}>{threePages}</Book>);
    expect(flippedStates(container)).toEqual([false, false, false]);
  });

  it('locks the other pages from the very grab (pointerdown), before any move', () => {
    // The grab is announced immediately (phase: 'grab'): the interaction
    // lock engages at pointerdown, NOT at the first move — so a second
    // finger (or a queue step scheduled in the down→move window) can never
    // fight the fold over the stack.
    const { container } = render(
      <Book defaultPage={2} width={300} height={600}>
        {fastPages(3)}
      </Book>
    );
    // At rest on spread 1: both top pages (0 left, 1 right) are interactive.
    expect(disabledStates(container)).toEqual([false, false, true]);
    const page1Rest = container.querySelectorAll<HTMLElement>('[class*="restSheet"]')[1];
    const mk = (type: string, x: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, {
        pointerId: 9,
        pointerType: 'mouse',
        button: 0,
        clientX: x,
        clientY: 300,
      });
      return event;
    };
    act(() => {
      page1Rest.dispatchEvent(mk('pointerdown', 580)); // grab, NO move yet
    });
    // Locked immediately: only the grabbed page stays interactive.
    expect(disabledStates(container)).toEqual([true, false, true]);
    act(() => {
      window.dispatchEvent(mk('pointerup', 580)); // click → settle back
    });
    expect(disabledStates(container)).toEqual([false, false, true]);
  });

  it('recovers when a user drag steals the fold from a pending queue step (no deadlock)', async () => {
    // Page 0 rests turned (left top), page 1 is the right top. Start a drag
    // on page 0 and BEFORE its first move (handleStart alone never reaches
    // the Book — foldingIndex is still null) queue a jump: the advance
    // schedules a step on page 1 while the pointer is down. The release then
    // lands in the DRAG branch with a FOREIGN queue step pending — without
    // the cleanup that step stayed orphaned and the book deadlocked (queue
    // blocked + every page locked).
    const { container } = render(
      <Book defaultPage={2} width={300} height={600}>
        {fastPages(3)}
      </Book>
    );
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    const page0Rest = container.querySelectorAll<HTMLElement>('[class*="restSheet"]')[0];
    const mk = (type: string, x: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, {
        pointerId: 5,
        pointerType: 'mouse',
        button: 0,
        clientX: x,
        clientY: 300,
      });
      return event;
    };
    // Page 0 is flipped: its free edge is the LEFT edge of the play-zone.
    act(() => {
      page0Rest.dispatchEvent(mk('pointerdown', 4));
    });
    fireEvent.keyDown(root, { key: 'End' }); // schedules a queue step on page 1
    act(() => {
      window.dispatchEvent(mk('pointermove', 120));
      window.dispatchEvent(mk('pointerup', 120));
    });
    // Whatever the release decided (turn or snap-back), the book must come
    // back QUIESCENT: queue drained, interaction lock released.
    await waitFor(() => {
      const wrappers = wrappersOf(container);
      const enabled = wrappers.filter(
        (wrap) => (wrap.firstElementChild as HTMLElement).getAttribute('data-disabled') === null
      );
      expect(enabled.length).toBeGreaterThan(0);
    });
    // And it must still RESPOND: a keyboard turn changes the stack (with the
    // orphaned step it stayed frozen forever).
    const before = JSON.stringify(flippedStates(container));
    const turnedCount = flippedStates(container).filter(Boolean).length;
    fireEvent.keyDown(root, { key: turnedCount === 3 ? 'ArrowLeft' : 'ArrowRight' });
    await waitFor(() => {
      expect(JSON.stringify(flippedStates(container))).not.toBe(before);
    });
  });

  it('the shared inheritable list covers every BookContextValue key (drift guard)', () => {
    type Missing = Exclude<keyof BookContextValue, (typeof INHERITABLE_PROPS)[number]>;
    // Compile-time exhaustiveness: a key added to BookContextValue but not to
    // INHERITABLE_PROPS turns the annotation below into a tuple type naming
    // the missing key, and `true` no longer typechecks.
    const exhaustive: [Missing] extends [never]
      ? true
      : ['INHERITABLE_PROPS is missing:', Missing] = true;
    expect(exhaustive).toBe(true);
    // And no duplicate entries.
    expect(new Set(INHERITABLE_PROPS).size).toBe(INHERITABLE_PROPS.length);
  });
});

describe('page-index roundtrip', () => {
  it('face → turned → first-visible-face is a stable fixed point for every face', () => {
    for (const total of [1, 2, 3, 5]) {
      for (let face = -2; face <= 2 * total + 2; face++) {
        const turned = faceToTurnedPages(face, total);
        expect(turned).toBeGreaterThanOrEqual(0);
        expect(turned).toBeLessThanOrEqual(total);
        const reported = turnedPagesToFace(turned);
        expect(reported).toBe(Math.max(0, 2 * turned - 1));
        // The reported face maps back to the same turned count (fixed point):
        // onPageChange → controlled page round-trips with no drift.
        expect(faceToTurnedPages(reported, total)).toBe(turned);
      }
      // Liberal setter: both faces of a spread are the same state.
      for (let spread = 1; spread <= total; spread++) {
        expect(faceToTurnedPages(2 * spread - 1, total)).toBe(faceToTurnedPages(2 * spread, total));
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  withCover — hard covers + the compact closed book                   */
/* ------------------------------------------------------------------ */

describe('Book withCover', () => {
  const fastPages = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      <Book.Page key={i} flippingTime={0}>
        <Book.Page.Front>F{i}</Book.Page.Front>
        <Book.Page.Back>B{i}</Book.Page.Back>
      </Book.Page>
    ));

  const hardStates = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>('[class*="page"]')).map(
      (wrap) => (wrap.firstElementChild as HTMLElement).getAttribute('data-hard') !== null
    );

  it('marks the first and last pages as rigid covers', () => {
    const { container } = render(<Book withCover>{fastPages(4)}</Book>);
    expect(hardStates(container)).toEqual([true, false, false, true]);
  });

  it('does not mark any page without withCover', () => {
    const { container } = render(<Book>{fastPages(3)}</Book>);
    expect(hardStates(container)).toEqual([false, false, false]);
  });

  it('lets an explicit per-page hard override win over withCover', () => {
    const pages = [
      <Book.Page key="0" hard={false}>
        <Book.Page.Front>F0</Book.Page.Front>
      </Book.Page>,
      <Book.Page key="1" hard>
        <Book.Page.Front>F1</Book.Page.Front>
      </Book.Page>,
      <Book.Page key="2">
        <Book.Page.Front>F2</Book.Page.Front>
      </Book.Page>,
    ];
    const { container } = render(<Book withCover>{pages}</Book>);
    // Page 0 opted OUT of the cover; page 1 opted IN despite being inner.
    expect(hardStates(container)).toEqual([false, true, true]);
  });

  it('centers the closed book and slides into the spread (compact mode)', async () => {
    const { container } = render(
      <Book withCover width={300} height={400}>
        {fastPages(2)}
      </Book>
    );
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    // Closed at the front: shifted half a page left (cover centered).
    expect(root.style.transform).toBe('translateX(-150px)');
    // Open spread: no shift.
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    await waitFor(() => expect(root.style.transform).toBe('translateX(0px)'));
    // Closed at the back: shifted half a page right.
    fireEvent.keyDown(root, { key: 'End' });
    await waitFor(() => expect(root.style.transform).toBe('translateX(150px)'));
  });

  it('applies no shift without withCover', () => {
    const { container } = render(<Book width={300}>{fastPages(2)}</Book>);
    const root = container.querySelector<HTMLElement>('[class*="root"]')!;
    expect(root.style.transform).toBe('');
  });
});
