import type { CurlGlRenderer } from './glRenderer';
import { CurlWebglPool } from './pool';

function fakeRenderer() {
  return {
    resize: jest.fn(),
    clear: jest.fn(),
    setFront: jest.fn(),
    setBack: jest.fn(),
    render: jest.fn(),
    dispose: jest.fn(),
    loseContext: jest.fn(),
  } as unknown as CurlGlRenderer;
}

describe('CurlWebglPool', () => {
  it('creates the renderer lazily on the first acquire and reuses it', () => {
    const factory = jest.fn(fakeRenderer);
    const pool = new CurlWebglPool(factory);
    expect(factory).not.toHaveBeenCalled();

    const a = Symbol('a');
    const lease1 = pool.acquire(a)!;
    expect(factory).toHaveBeenCalledTimes(1);
    expect(lease1.renderer).toBeTruthy();
    expect(lease1.canvas).toBeInstanceOf(HTMLCanvasElement);

    pool.release(a);
    const lease2 = pool.acquire(a)!;
    expect(factory).toHaveBeenCalledTimes(1); // same renderer, no new context
    expect(lease2.renderer).toBe(lease1.renderer);
    expect(lease2.canvas).toBe(lease1.canvas);
  });

  it('steals the lease for a new owner (last wins) and ignores stale releases', () => {
    const pool = new CurlWebglPool(fakeRenderer);
    const a = Symbol('a');
    const b = Symbol('b');
    const leaseA = pool.acquire(a)!;
    const leaseB = pool.acquire(b)!;
    expect(leaseB.renderer).toBe(leaseA.renderer);

    // A's late release must not park B's canvas.
    const mount = document.createElement('div');
    mount.appendChild(leaseB.canvas);
    pool.release(a);
    expect(leaseB.canvas.parentElement).toBe(mount);

    pool.release(b);
    expect(leaseB.canvas.parentElement).toBeNull();
  });

  it('latches unavailability when the renderer cannot be created', () => {
    const factory = jest.fn(() => {
      throw new Error('WebGL2 not available');
    });
    const pool = new CurlWebglPool(factory as unknown as () => CurlGlRenderer);
    expect(pool.acquire(Symbol('a'))).toBeNull();
    expect(pool.acquire(Symbol('b'))).toBeNull();
    expect(factory).toHaveBeenCalledTimes(1); // latched, no retry storm
  });

  it('dispose reclaims the context and detaches the canvas', () => {
    const pool = new CurlWebglPool(fakeRenderer);
    const a = Symbol('a');
    const lease = pool.acquire(a)!;
    document.body.appendChild(lease.canvas);

    pool.dispose();
    expect(lease.renderer.loseContext).toHaveBeenCalledTimes(1);
    expect(lease.canvas.parentElement).toBeNull();
  });
});
