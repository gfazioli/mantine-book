import { render } from '@mantine-tests/core';
import { act, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Curl } from './Curl';

describe('Curl', () => {
  it('renders without crashing with no faces', () => {
    const { container } = render(<Curl />);
    expect(container.querySelector('[class*="root"]')).toBeTruthy();
  });

  it('exposes Front and Back as static compound children', () => {
    expect(Curl.Front).toBeDefined();
    expect(Curl.Back).toBeDefined();
    expect(Curl.Front.displayName).toBe('Curl.Front');
    expect(Curl.Back.displayName).toBe('Curl.Back');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Curl ref={ref}>
        <Curl.Front>Front</Curl.Front>
      </Curl>
    );
    expect(ref.current).toBeTruthy();
  });

  // The regression that motivated the rebuild: BOTH faces are React-owned
  // and present in the DOM (no innerHTML cloning, content rendered once).
  it('renders both Front and Back content (React-owned, not cloned)', () => {
    const { getByText } = render(
      <Curl>
        <Curl.Front>FrontText</Curl.Front>
        <Curl.Back>BackText</Curl.Back>
      </Curl>
    );
    expect(getByText('FrontText')).toBeInTheDocument();
    expect(getByText('BackText')).toBeInTheDocument();
  });

  // The other half of the regression: event handlers inside a face survive
  // (the old innerHTML clone destroyed them).
  it('keeps React event handlers alive inside a face', () => {
    const onClick = jest.fn();
    const { getByText } = render(
      <Curl>
        <Curl.Front>
          <button type="button" onClick={onClick}>
            Press
          </button>
        </Curl.Front>
      </Curl>
    );
    fireEvent.click(getByText('Press'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a blank Back when Curl.Back is omitted', () => {
    const { getByText } = render(
      <Curl>
        <Curl.Front>OnlyFront</Curl.Front>
      </Curl>
    );
    expect(getByText('OnlyFront')).toBeInTheDocument();
  });

  it('does not crash on pointer interaction', () => {
    const { container } = render(
      <Curl width={300} height={600}>
        <Curl.Front>F</Curl.Front>
        <Curl.Back>B</Curl.Back>
      </Curl>
    );
    const root = container.querySelector('[class*="root"]') as HTMLElement;
    expect(root).toBeTruthy();
    expect(() => {
      const down = new Event('pointerdown', { bubbles: true, cancelable: true });
      Object.assign(down, {
        clientX: 580,
        clientY: 40,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
      });
      const move = new Event('pointermove', { bubbles: true });
      Object.assign(move, { clientX: 400, clientY: 60, pointerId: 1, pointerType: 'mouse' });
      const up = new Event('pointerup', { bubbles: true });
      Object.assign(up, { clientX: 400, clientY: 60, pointerId: 1, pointerType: 'mouse' });
      act(() => {
        root.dispatchEvent(down);
        window.dispatchEvent(move);
        window.dispatchEvent(up);
      });
    }).not.toThrow();
  });

  it('tolerates pointer events that carry no coordinates (NaN-safe)', async () => {
    // jsdom's fireEvent pointer events DROP clientX/clientY, so page-local
    // coords compute to NaN — the engine must degrade gracefully (settle as a
    // snap-back), never throw. Kept deliberately as a degenerate-input guard.
    const onFlip = jest.fn();
    const { container } = render(
      <Curl width={300} height={600} flippingTime={0} onFlip={onFlip}>
        <Curl.Front>F</Curl.Front>
        <Curl.Back>B</Curl.Back>
      </Curl>
    );
    const root = container.querySelector('[class*="root"]') as HTMLElement;
    expect(() => {
      fireEvent.pointerDown(root, { pointerId: 1, button: 0 });
      fireEvent.pointerMove(root, { pointerId: 1 });
      fireEvent.pointerUp(root, { pointerId: 1 });
    }).not.toThrow();
    // And it really settles as a snap-back: the page never turns.
    await waitFor(() => expect(onFlip).toHaveBeenCalledWith({ flipped: false }));
    expect(onFlip).not.toHaveBeenCalledWith({ flipped: true });
    expect(root.getAttribute('data-flipped')).toBeNull();
  });

  it('does not attach drag handlers when disabled', () => {
    const { container } = render(
      <Curl disabled>
        <Curl.Front>F</Curl.Front>
      </Curl>
    );
    const root = container.querySelector('[class*="root"]') as HTMLElement;
    // No throw and stays mounted; disabled simply omits the handlers.
    expect(() =>
      fireEvent.pointerDown(root, { clientX: 580, clientY: 40, pointerId: 1, button: 0 })
    ).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Release semantics — the controller's complete / snap-back decision  */
/* ------------------------------------------------------------------ */

describe('Curl release semantics', () => {
  // jsdom rects are 0×0 at 0,0 → page-local x = clientX − W (W = 300 below).
  // NOTE: fireEvent's pointer events in jsdom do NOT carry clientX/clientY
  // (local coords become NaN and every release degrades to a snap-back), so
  // these tests dispatch synthetic native events with the props assigned.
  // Gesture timing runs on a mocked performance.now() clock (no real sleeps);
  // the settle animator is immune (flippingTime=0 → raw=1 on the first tick).
  const W = 300;
  const H = 600;

  let now = 0;
  beforeEach(() => {
    now = 1_000;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const firePointer = (
    target: EventTarget,
    type: 'pointerdown' | 'pointermove' | 'pointerup',
    props: Record<string, unknown>
  ) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 1, pointerType: 'mouse', button: 0, ...props });
    act(() => {
      target.dispatchEvent(event);
    });
  };

  const renderCurl = () => {
    const onFold = jest.fn();
    const onFlip = jest.fn();
    const utils = render(
      <Curl width={W} height={H} flippingTime={0} onFold={onFold} onFlip={onFlip}>
        <Curl.Front>F</Curl.Front>
        <Curl.Back>B</Curl.Back>
      </Curl>
    );
    const root = utils.container.querySelector('[class*="root"]') as HTMLElement;
    return { ...utils, root, onFold, onFlip };
  };

  it('completes a past-threshold drag: the page turns and reports flipped=true', async () => {
    const { root, onFold, onFlip } = renderCurl();
    // Grab the free edge (local x = W) and sweep well past the spine.
    firePointer(root, 'pointerdown', { clientX: W + W, clientY: 300 });
    firePointer(window, 'pointermove', { clientX: W + 100, clientY: 300 });
    firePointer(window, 'pointermove', { clientX: 40, clientY: 300 });
    expect(onFold).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'move', progress: expect.any(Number) })
    );
    expect(onFold.mock.calls.at(-1)![0].progress).toBeGreaterThan(50);
    firePointer(window, 'pointerup', { clientX: 40, clientY: 300 });
    await waitFor(() => expect(onFlip).toHaveBeenCalledWith({ flipped: true }));
    expect(root.getAttribute('data-flipped')).not.toBeNull();
  });

  it('snaps back a slow short drag (under the threshold, not a swipe)', async () => {
    const { root, onFold, onFlip } = renderCurl();
    firePointer(root, 'pointerdown', { clientX: W + W, clientY: 300 });
    firePointer(window, 'pointermove', { clientX: W + W - 80, clientY: 300 });
    expect(onFold.mock.calls.at(-1)![0].progress).toBeLessThan(50);
    // Slow release: the mocked clock advances past swipeTimeThreshold (250ms)
    // so the gesture is a DRAG — a fast release would be a swipe and complete.
    now += 300;
    firePointer(window, 'pointermove', { clientX: W + W - 81, clientY: 300 });
    firePointer(window, 'pointerup', { clientX: W + W - 81, clientY: 300 });
    await waitFor(() => expect(onFlip).toHaveBeenCalledWith({ flipped: false }));
    expect(root.getAttribute('data-flipped')).toBeNull();
  });

  it('completes a fast swipe toward the spine even under the threshold', async () => {
    const { root, onFold, onFlip } = renderCurl();
    firePointer(root, 'pointerdown', { clientX: W + W, clientY: 300 });
    // Short sweep (progress well under 50) but decisive toward the spine.
    firePointer(window, 'pointermove', { clientX: W + W - 100, clientY: 300 });
    expect(onFold.mock.calls.at(-1)![0].progress).toBeLessThan(50);
    firePointer(window, 'pointerup', { clientX: W + W - 100, clientY: 300 });
    await waitFor(() => expect(onFlip).toHaveBeenCalledWith({ flipped: true }));
  });

  it('a click (no real drag) settles back without turning', () => {
    const { root, onFlip } = renderCurl();
    firePointer(root, 'pointerdown', { clientX: W + W, clientY: 300 });
    firePointer(window, 'pointerup', { clientX: W + W, clientY: 300 });
    expect(onFlip).toHaveBeenCalledWith({ flipped: false });
    expect(root.getAttribute('data-flipped')).toBeNull();
  });
});

describe('Curl grabZone', () => {
  const restSheetOf = (container: HTMLElement) =>
    container.querySelector('[class*="restSheet"]') as HTMLElement;
  const rootOf = (container: HTMLElement) =>
    container.querySelector('[class*="root"]') as HTMLElement;

  it('play-zone (default): the root is the gesture surface', () => {
    const { container } = render(
      <Curl width={300} height={600}>
        <Curl.Front>F</Curl.Front>
      </Curl>
    );
    expect(rootOf(container).style.pointerEvents).not.toBe('none');
    expect(restSheetOf(container).style.pointerEvents).not.toBe('auto');
  });

  it('sheet: the root passes pointers through and the resting sheet re-enables them', () => {
    const { container } = render(
      <Curl width={300} height={600} grabZone="sheet">
        <Curl.Front>F</Curl.Front>
      </Curl>
    );
    expect(rootOf(container).style.pointerEvents).toBe('none');
    expect(restSheetOf(container).style.pointerEvents).toBe('auto');
  });

  it('sheet + disabled: the resting sheet does NOT re-enable pointers', () => {
    const { container } = render(
      <Curl width={300} height={600} grabZone="sheet" disabled>
        <Curl.Front>F</Curl.Front>
      </Curl>
    );
    expect(rootOf(container).style.pointerEvents).toBe('none');
    expect(restSheetOf(container).style.pointerEvents).not.toBe('auto');
  });

  it('sheet: a grab starting on the resting sheet drives the fold (bubbles to the root handlers)', () => {
    const onFold = jest.fn();
    const { container } = render(
      <Curl width={300} height={600} grabZone="sheet" onFold={onFold}>
        <Curl.Front>F</Curl.Front>
        <Curl.Back>B</Curl.Back>
      </Curl>
    );
    const restSheet = restSheetOf(container);
    const down = new Event('pointerdown', { bubbles: true, cancelable: true });
    Object.assign(down, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 580,
      clientY: 300,
    });
    const move = new Event('pointermove', { bubbles: true });
    Object.assign(move, { pointerId: 1, pointerType: 'mouse', clientX: 400, clientY: 300 });
    act(() => {
      restSheet.dispatchEvent(down);
      window.dispatchEvent(move);
    });
    expect(onFold).toHaveBeenCalledWith(expect.objectContaining({ phase: 'move' }));
  });
});

/* ------------------------------------------------------------------ */
/*  Reveal layer — side-awareness                                       */
/* ------------------------------------------------------------------ */

describe('Curl reveal layer', () => {
  const revealOf = (container: HTMLElement) =>
    container.querySelector('[class*="revealLayer"]') as HTMLElement | null;

  it('rests under the RIGHT half before the turn (left = W)', () => {
    const { container } = render(
      <Curl width={300} height={600} revealBackground="red">
        <Curl.Front>F</Curl.Front>
      </Curl>
    );
    expect(revealOf(container)!.style.left).toBe('300px');
  });

  it('follows the sheet to the LEFT half once flipped (left = 0)', () => {
    const { container } = render(
      <Curl width={300} height={600} revealBackground="red" flipped>
        <Curl.Front>F</Curl.Front>
        <Curl.Back>B</Curl.Back>
      </Curl>
    );
    expect(revealOf(container)!.style.left).toBe('0px');
  });

  it('is not rendered at all when revealBackground is unset', () => {
    const { container } = render(
      <Curl width={300} height={600}>
        <Curl.Front>F</Curl.Front>
      </Curl>
    );
    expect(revealOf(container)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Hard (rigid) page — the cover renderer                              */
/* ------------------------------------------------------------------ */

describe('Curl hard (rigid page)', () => {
  const W = 300;

  const firePointer = (
    target: EventTarget,
    type: 'pointerdown' | 'pointermove' | 'pointerup',
    props: Record<string, unknown>
  ) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 1, pointerType: 'mouse', button: 0, ...props });
    act(() => {
      target.dispatchEvent(event);
    });
  };

  const renderHard = () => {
    const onFlip = jest.fn();
    const utils = render(
      <Curl width={W} height={600} hard flippingTime={0} onFlip={onFlip}>
        <Curl.Front>CoverFront</Curl.Front>
        <Curl.Back>CoverBack</Curl.Back>
      </Curl>
    );
    const root = utils.container.querySelector('[class*="root"]') as HTMLElement;
    return { ...utils, root, onFlip };
  };

  it('marks the root and renders NO hard sheet at rest', () => {
    const { container, root } = renderHard();
    expect(root.getAttribute('data-hard')).not.toBeNull();
    expect(container.querySelector('[class*="hardSheet"]')).toBeNull();
  });

  it('replaces the fold with a rigid rotation while dragging (no flap, no clip)', () => {
    const { container, root } = renderHard();
    firePointer(root, 'pointerdown', { clientX: W + W, clientY: 300 });
    firePointer(window, 'pointermove', { clientX: W + 150, clientY: 300 });
    const hardSheet = container.querySelector('[class*="hardSheet"]') as HTMLElement;
    expect(hardSheet).toBeTruthy();
    expect(hardSheet.style.transform).toMatch(/rotateY\(/);
    // The soft-fold layers must not render for a rigid page.
    expect(container.querySelector('[class*="curlSheet"]')).toBeNull();
    // The resting sheet is hidden — the rotating sheet IS the page.
    const restSheet = container.querySelector('[class*="restSheet"]') as HTMLElement;
    expect(restSheet.style.display).toBe('none');
  });

  it('tracks the drag: edge at the spine reads 90°, landed reads 180°', () => {
    const { container, root } = renderHard();
    firePointer(root, 'pointerdown', { clientX: W + W, clientY: 300 });
    // Target at the spine (local x = 0) → θ = acos(0) = 90° (negative: the
    // free edge lifts TOWARD the viewer as it sweeps over the spine).
    firePointer(window, 'pointermove', { clientX: W, clientY: 300 });
    const hardSheet = () => container.querySelector('[class*="hardSheet"]') as HTMLElement;
    expect(hardSheet().style.transform).toContain('rotateY(-90');
    // Target at the far edge (local x = −W) → θ = acos(−1) = 180°.
    firePointer(window, 'pointermove', { clientX: 0, clientY: 300 });
    expect(hardSheet().style.transform).toContain('rotateY(-180');
  });

  it('completes and snaps back through the same controller as a soft page', async () => {
    const { container, root, onFlip } = renderHard();
    // Complete: sweep past the vertical.
    firePointer(root, 'pointerdown', { clientX: W + W, clientY: 300 });
    firePointer(window, 'pointermove', { clientX: 40, clientY: 300 });
    firePointer(window, 'pointerup', { clientX: 40, clientY: 300 });
    await waitFor(() => expect(onFlip).toHaveBeenCalledWith({ flipped: true }));
    // At rest on the left: hard sheet unmounted again, restSheet visible.
    expect(container.querySelector('[class*="hardSheet"]')).toBeNull();
  });

  it('never mounts the WebGL layer for a rigid page, even in rounded books', () => {
    // A hard cover inside a rounded book must stay pure DOM: no lazy WebGL
    // chunk, no warm snapshot machinery (the layer used to mount inactive
    // and still pay the captures for top-of-stack covers).
    const { container } = render(
      <Curl width={300} height={600} variant="rounded" hard warmSnapshots>
        <Curl.Front>F</Curl.Front>
        <Curl.Back>B</Curl.Back>
      </Curl>
    );
    // The layer's positioned canvas mount is its DOM fingerprint.
    expect(container.querySelector('[aria-hidden="true"][style*="z-index: 6"]')).toBeNull();
  });

  it('renders both faces inside the rotating sheet (back pre-rotated)', () => {
    const { container, root } = renderHard();
    firePointer(root, 'pointerdown', { clientX: W + W, clientY: 300 });
    firePointer(window, 'pointermove', { clientX: W + 100, clientY: 300 });
    const hardSheet = container.querySelector('[class*="hardSheet"]') as HTMLElement;
    expect(hardSheet).toBeTruthy();
    // Both faces live INSIDE the rotating sheet (visibility is backface
    // culling, not mounting) — the back wrapper carries the pre-rotation.
    expect(hardSheet.textContent).toContain('CoverFront');
    expect(hardSheet.textContent).toContain('CoverBack');
    expect(hardSheet.querySelector('[class*="hardFaceBack"]')).toBeTruthy();
  });
});
