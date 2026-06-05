import { render } from '@mantine-tests/core';
import { fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Book } from './Book';
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
