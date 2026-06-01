import { buildConeMesh, CONE_APEX_SCALE, coneParams, deformConeMesh } from './coneDeformer';

/** Deform a single (u, v) vertex and return its [x, y, z]. */
const deform1 = (u: number, v: number, theta: number, apex: number): [number, number, number] => {
  const pos = new Float32Array(3);
  deformConeMesh(pos, new Float32Array([u, v]), theta, apex);
  return [pos[0], pos[1], pos[2]];
};

describe('coneParams', () => {
  it('is flat at progress 0', () => {
    const p = coneParams(0);
    expect(p.theta).toBe(0);
    expect(Math.abs(p.apex)).toBe(0);
    expect(p.rotation).toBe(0);
  });

  it('is fully wrapped at progress 100', () => {
    const p = coneParams(100);
    expect(p.theta).toBeCloseTo(Math.PI / 2, 6);
    expect(p.apex).toBeCloseTo(-CONE_APEX_SCALE, 6);
    expect(p.rotation).toBeCloseTo(Math.PI, 6);
  });

  it('is monotonic and halfway at progress 50', () => {
    const p = coneParams(50);
    expect(p.theta).toBeCloseTo(Math.PI / 4, 6);
    expect(p.apex).toBeCloseTo(-CONE_APEX_SCALE / 2, 6);
  });

  it('clamps progress outside 0–100', () => {
    expect(coneParams(-20).theta).toBe(0);
    expect(coneParams(140).theta).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe('deformConeMesh', () => {
  it('lays the page flat (z = 0, v centred) below the min angle', () => {
    const tex = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const pos = new Float32Array(12);
    deformConeMesh(pos, tex, 0, 0);
    // (u, v) -> (u, v - 0.5, 0)
    expect(Array.from(pos)).toEqual([0, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0, 0, 0.5, 0]);
  });

  it('keeps the spine edge (u = 0) on the axis: x = 0, z = 0', () => {
    const [x, , z] = deform1(0, 0.5, Math.PI / 4, -CONE_APEX_SCALE);
    expect(x).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('bulges toward the viewer (z ≥ 0) across the whole mesh mid-curl', () => {
    const { texcoords } = buildConeMesh(8, 8);
    const pos = new Float32Array((texcoords.length / 2) * 3);
    deformConeMesh(pos, texcoords, Math.PI / 4, -CONE_APEX_SCALE);
    for (let i = 0; i < pos.length / 3; i++) {
      expect(pos[i * 3 + 2]).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it('flattens again at a full wrap (theta = π/2 → z = 0)', () => {
    const { texcoords } = buildConeMesh(6, 6);
    const pos = new Float32Array((texcoords.length / 2) * 3);
    deformConeMesh(pos, texcoords, Math.PI / 2, -CONE_APEX_SCALE);
    for (let i = 0; i < pos.length / 3; i++) {
      expect(pos[i * 3 + 2]).toBeCloseTo(0, 5);
    }
  });

  it('matches the Hong cone formula for a known vertex (port correctness)', () => {
    // u=0.5, v=0.5, theta=π/4, apex=-15 — hand-computed from the Hong equations.
    const [x, y, z] = deform1(0.5, 0.5, Math.PI / 4, -15);
    expect(x).toBeCloseTo(0.4999, 3);
    expect(y).toBeCloseTo(0, 3);
    expect(z).toBeCloseTo(0.00806, 4);
  });
});

describe('buildConeMesh', () => {
  it('builds a (cols+1)×(rows+1) grid with a matching index buffer', () => {
    const { texcoords, indices, vertexCount } = buildConeMesh(4, 3);
    expect(vertexCount).toBe(5 * 4);
    expect(texcoords.length).toBe(vertexCount * 2);
    expect(indices.length).toBe(4 * 3 * 6);
  });

  it('spans the unit square (corners at 0,0 and 1,1)', () => {
    const { texcoords } = buildConeMesh(4, 4);
    expect(texcoords[0]).toBe(0);
    expect(texcoords[1]).toBe(0);
    expect(texcoords[texcoords.length - 2]).toBe(1);
    expect(texcoords[texcoords.length - 1]).toBe(1);
  });

  it('every index references a valid vertex', () => {
    const { indices, vertexCount } = buildConeMesh(5, 5);
    for (const idx of indices) {
      expect(idx).toBeLessThan(vertexCount);
    }
  });
});
