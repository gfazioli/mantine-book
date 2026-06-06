import { act, renderHook } from '@testing-library/react';
import {
  classifyGesture,
  computeReleaseVelocity,
  type DragControllerOptions,
  type DragSample,
  pruneSampleWindow,
  useDragController,
} from './drag';

describe('computeReleaseVelocity', () => {
  it('returns zero velocity for fewer than two samples', () => {
    expect(computeReleaseVelocity([])).toEqual({ x: 0, y: 0 });
    expect(computeReleaseVelocity([{ t: 0, x: 0, y: 0 }])).toEqual({ x: 0, y: 0 });
  });

  it('averages over the whole sample range', () => {
    const samples: DragSample[] = [
      { t: 0, x: 0, y: 0 },
      { t: 30, x: 30, y: 15 },
      { t: 60, x: 60, y: 30 },
    ];
    const v = computeReleaseVelocity(samples);
    expect(v.x).toBeCloseTo(1); // 60 px / 60 ms
    expect(v.y).toBeCloseTo(0.5); // 30 px / 60 ms
  });

  it('reports negative components for reverse motion', () => {
    const samples: DragSample[] = [
      { t: 0, x: 100, y: 100 },
      { t: 50, x: 0, y: 0 },
    ];
    const v = computeReleaseVelocity(samples);
    expect(v.x).toBeCloseTo(-2);
    expect(v.y).toBeCloseTo(-2);
  });
});

describe('pruneSampleWindow', () => {
  it('keeps samples within the window', () => {
    const now = 100;
    const samples: DragSample[] = [
      { t: 0, x: 0, y: 0 },
      { t: 50, x: 50, y: 50 },
      { t: 90, x: 90, y: 90 },
    ];
    const pruned = pruneSampleWindow(samples, now, 60);
    // 0 is out of (100 - 60 = 40), 50 + 90 stay.
    expect(pruned).toHaveLength(2);
    expect(pruned[0].t).toBe(50);
  });

  it('always keeps the last two samples', () => {
    const samples: DragSample[] = [
      { t: 0, x: 0, y: 0 },
      { t: 1, x: 1, y: 1 },
    ];
    expect(pruneSampleWindow(samples, 1000, 60)).toHaveLength(2);
  });

  it('returns the same array when nothing is dropped', () => {
    const samples: DragSample[] = [
      { t: 100, x: 0, y: 0 },
      { t: 120, x: 5, y: 5 },
      { t: 140, x: 10, y: 10 },
    ];
    expect(pruneSampleWindow(samples, 150, 60)).toEqual(samples);
  });
});

describe('classifyGesture', () => {
  const swipeDistance = 30;
  const swipeTimeThreshold = 250;

  it('returns "click" for a tap with little movement', () => {
    expect(
      classifyGesture({
        delta: { x: 2, y: 1 },
        duration: 80,
        swipeDistance,
        swipeTimeThreshold,
      })
    ).toBe('click');
  });

  it('returns "swipe" for a fast, decisive horizontal motion', () => {
    expect(
      classifyGesture({
        delta: { x: 120, y: 5 },
        duration: 180,
        swipeDistance,
        swipeTimeThreshold,
      })
    ).toBe('swipe');
  });

  it('returns "drag" for a slow but long motion', () => {
    expect(
      classifyGesture({
        delta: { x: 200, y: 50 },
        duration: 1200,
        swipeDistance,
        swipeTimeThreshold,
      })
    ).toBe('drag');
  });

  it('treats short hover-near-corner as "click"', () => {
    expect(
      classifyGesture({
        delta: { x: 1, y: -3 },
        duration: 50,
        swipeDistance,
        swipeTimeThreshold,
      })
    ).toBe('click');
  });
});

/* ------------------------------------------------------------------ */
/*  useDragController — the hook around the pure helpers               */
/* ------------------------------------------------------------------ */

describe('useDragController', () => {
  /** Controlled clock: performance.now() returns whatever the test sets. */
  let now = 0;
  beforeEach(() => {
    now = 1_000;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** A synthetic React pointer event for the element's onPointerDown. */
  const downEvent = (overrides: Record<string, unknown> = {}) =>
    ({
      pointerType: 'mouse',
      button: 0,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      ...overrides,
    }) as unknown as React.PointerEvent<HTMLElement>;

  /** Dispatch a synthetic window pointer event (jsdom has no PointerEvent). */
  const fireWindow = (
    type: 'pointermove' | 'pointerup' | 'pointercancel',
    props: Record<string, unknown>
  ) => {
    const event = new Event(type);
    Object.assign(event, { pointerId: 1, clientX: 0, clientY: 0, ...props });
    act(() => {
      window.dispatchEvent(event);
    });
  };

  const setup = (options: DragControllerOptions = {}) => {
    const onStart = jest.fn();
    const onMove = jest.fn();
    const onRelease = jest.fn();
    const hook = renderHook(() => useDragController({ onStart, onMove, onRelease, ...options }));
    return { hook, onStart, onMove, onRelease };
  };

  it('mouse flow: down → onStart, window moves → onMove, slow long release → "drag"', () => {
    const { hook, onStart, onMove, onRelease } = setup();
    act(() => hook.result.current.onPointerDown(downEvent({ clientX: 100, clientY: 50 })));
    expect(onStart).toHaveBeenCalledWith({ x: 100, y: 50 });
    expect(hook.result.current.isDragging()).toBe(true);

    now += 100;
    fireWindow('pointermove', { clientX: 160, clientY: 55 });
    expect(onMove).toHaveBeenCalledWith({ x: 160, y: 55 });

    now += 300; // total 400ms > swipeTimeThreshold (250) → drag, not swipe
    fireWindow('pointerup', { clientX: 160, clientY: 55 });
    expect(onRelease).toHaveBeenCalledTimes(1);
    const summary = onRelease.mock.calls[0][0];
    expect(summary.kind).toBe('drag');
    expect(summary.duration).toBe(400);
    expect(summary.delta).toEqual({ x: 60, y: 5 });
    expect(summary.releasePoint).toEqual({ x: 160, y: 55 });
    expect(hook.result.current.isDragging()).toBe(false);
  });

  it('maps client coords through getLocalPoint', () => {
    const { hook, onStart, onMove } = setup({
      getLocalPoint: (clientX, clientY) => ({ x: clientX - 300, y: clientY - 10 }),
    });
    act(() => hook.result.current.onPointerDown(downEvent({ clientX: 600, clientY: 310 })));
    expect(onStart).toHaveBeenCalledWith({ x: 300, y: 300 });
    fireWindow('pointermove', { clientX: 500, clientY: 310 });
    expect(onMove).toHaveBeenCalledWith({ x: 200, y: 300 });
  });

  it('classifies a fast decisive motion as "swipe" with the rolling-window velocity', () => {
    const { hook, onRelease } = setup();
    act(() => hook.result.current.onPointerDown(downEvent({ clientX: 200, clientY: 0 })));
    now += 25;
    fireWindow('pointermove', { clientX: 150, clientY: 0 });
    now += 25;
    fireWindow('pointermove', { clientX: 100, clientY: 0 });
    now += 10;
    fireWindow('pointerup', { clientX: 100, clientY: 0 });
    const summary = onRelease.mock.calls[0][0];
    expect(summary.kind).toBe('swipe');
    // Window samples: (t=1000, x=200) → (t=1050, x=100) ⇒ −100px / 50ms.
    expect(summary.velocity.x).toBeCloseTo(-2);
  });

  it('classifies a barely-moved quick tap as "click"', () => {
    const { hook, onRelease } = setup();
    act(() => hook.result.current.onPointerDown(downEvent({ clientX: 100, clientY: 100 })));
    now += 20;
    fireWindow('pointermove', { clientX: 104, clientY: 102 });
    now += 20;
    fireWindow('pointerup', { clientX: 104, clientY: 102 });
    expect(onRelease.mock.calls[0][0].kind).toBe('click');
  });

  it('pointercancel releases as a velocity-less click (settle back, no turn)', () => {
    const { hook, onRelease } = setup();
    act(() => hook.result.current.onPointerDown(downEvent({ clientX: 100, clientY: 0 })));
    fireWindow('pointermove', { clientX: 300, clientY: 0 });
    fireWindow('pointercancel', {});
    const summary = onRelease.mock.calls[0][0];
    expect(summary.kind).toBe('click');
    expect(summary.velocity).toEqual({ x: 0, y: 0 });
  });

  it('rejects secondary mouse buttons', () => {
    const { hook, onStart } = setup();
    act(() => hook.result.current.onPointerDown(downEvent({ button: 2 })));
    expect(onStart).not.toHaveBeenCalled();
    expect(hook.result.current.isDragging()).toBe(false);
  });

  it('ignores window events from a different pointerId', () => {
    const { hook, onMove, onRelease } = setup();
    act(() => hook.result.current.onPointerDown(downEvent({ clientX: 100, pointerId: 1 })));
    fireWindow('pointermove', { clientX: 200, pointerId: 7 });
    expect(onMove).not.toHaveBeenCalled();
    fireWindow('pointerup', { clientX: 200, pointerId: 7 });
    expect(onRelease).not.toHaveBeenCalled();
    expect(hook.result.current.isDragging()).toBe(true); // gesture 1 still alive
  });

  describe('mobileScrollSupport (touch claims only horizontal-biased gestures)', () => {
    it('stays passive under the decision threshold (swipeDistance / 4)', () => {
      const { hook, onMove } = setup(); // swipeDistance default 30 → threshold 7.5
      act(() =>
        hook.result.current.onPointerDown(
          downEvent({ pointerType: 'touch', clientX: 100, clientY: 100 })
        )
      );
      fireWindow('pointermove', { clientX: 104, clientY: 104 });
      expect(onMove).not.toHaveBeenCalled(); // still awaiting the decision
    });

    it('hands a vertical-biased gesture back to the scroller (no claim, no release)', () => {
      const { hook, onMove, onRelease } = setup();
      act(() =>
        hook.result.current.onPointerDown(
          downEvent({ pointerType: 'touch', clientX: 100, clientY: 100 })
        )
      );
      fireWindow('pointermove', { clientX: 105, clientY: 140 }); // dy 40 > dx 5
      expect(onMove).not.toHaveBeenCalled();
      expect(hook.result.current.isDragging()).toBe(false);
      fireWindow('pointerup', { clientX: 105, clientY: 140 });
      expect(onRelease).not.toHaveBeenCalled(); // scroll won — nothing to settle
    });

    it('claims a horizontal-biased gesture and tracks from there', () => {
      const { hook, onMove } = setup();
      act(() =>
        hook.result.current.onPointerDown(
          downEvent({ pointerType: 'touch', clientX: 100, clientY: 100 })
        )
      );
      fireWindow('pointermove', { clientX: 140, clientY: 105 }); // dx 40 > dy 5
      expect(onMove).toHaveBeenCalledWith({ x: 140, y: 105 });
    });

    it('mouse input never waits for the scroll decision', () => {
      const { hook, onMove } = setup();
      act(() => hook.result.current.onPointerDown(downEvent({ clientX: 100, clientY: 100 })));
      fireWindow('pointermove', { clientX: 102, clientY: 101 }); // tiny move, still tracked
      expect(onMove).toHaveBeenCalled();
    });

    it('can be disabled: touch tracks immediately', () => {
      const { hook, onMove } = setup({ mobileScrollSupport: false });
      act(() =>
        hook.result.current.onPointerDown(
          downEvent({ pointerType: 'touch', clientX: 100, clientY: 100 })
        )
      );
      fireWindow('pointermove', { clientX: 101, clientY: 130 }); // vertical — claimed anyway
      expect(onMove).toHaveBeenCalled();
    });
  });

  it('detaches the window listeners on unmount', () => {
    const { hook, onMove } = setup();
    act(() => hook.result.current.onPointerDown(downEvent({ clientX: 100 })));
    hook.unmount();
    fireWindow('pointermove', { clientX: 300 });
    expect(onMove).not.toHaveBeenCalled();
  });
});
