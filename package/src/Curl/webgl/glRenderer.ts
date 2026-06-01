/**
 * Curl WebGL2 renderer — draws the cone-deformed page as a lit, textured mesh.
 *
 * Pure rendering: it owns a WebGL2 context on a <canvas>, a tessellated unit
 * page mesh, and the front/back textures. Each frame it runs the cone deformer
 * ({@link deformConeMesh}) in JS, applies the rigid spine rotation, scales the
 * unit result into play-zone pixels, recomputes smooth normals, uploads, and
 * draws. The flat-fold DOM renderer remains the fallback; this is the opt-in
 * `variant="rounded"` path. No React, no DOM measurement here.
 */
import { buildConeMesh, coneParams, deformConeMesh } from '../../flip/coneDeformer';

const VERTEX_SRC = `#version 300 es
in vec3 aPos;      // play-zone pixels: x ∈ [0, 2W], y ∈ [0, H], z = depth px
in vec3 aNormal;
in vec2 aUv;
uniform vec2 uResolution;  // (2W, H)
uniform float uDepth;      // depth range used to normalise z into clip space
out vec3 vNormal;
out vec2 vUv;
void main() {
  vec2 p = aPos.xy / uResolution;          // 0..1
  vec2 clip = vec2(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0);
  // Higher z (toward the viewer) → smaller clip z → drawn in front.
  float z = clamp(-aPos.z / uDepth, -1.0, 1.0);
  gl_Position = vec4(clip, z, 1.0);
  vNormal = aNormal;
  vUv = aUv;
}`;

const FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec2 vUv;
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform bool uHasBack;
uniform vec3 uLightDir;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vNormal);
  // Pick the face by which way the surface actually faces the viewer (robust
  // through the 3D deform + rotation, unlike gl_FrontFacing/winding): the part
  // still facing us shows the front; the wrapped-over part (facing away) shows
  // the back, mirrored so it reads correctly.
  bool front = N.z >= 0.0;
  vec3 Nl = front ? N : -N;                // lighting normal always toward viewer
  vec4 base;
  if (front) {
    base = texture(uFront, vUv);
  } else {
    base = uHasBack ? texture(uBack, vec2(1.0 - vUv.x, vUv.y)) : vec4(1.0, 1.0, 1.0, 1.0);
  }
  vec3 L = normalize(uLightDir);
  vec3 V = vec3(0.0, 0.0, 1.0);            // orthographic view, looking at +z
  float diff = max(dot(Nl, L), 0.0);
  vec3 R = reflect(-L, Nl);
  float spec = pow(max(dot(R, V), 0.0), 48.0);
  float light = 0.62 + 0.42 * diff + 0.30 * spec;
  fragColor = vec4(base.rgb * clamp(light, 0.0, 1.5), base.a);
}`;

type TexImageSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Curl WebGL shader compile failed: ${log}`);
  }
  return sh;
}

function makeTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // 1×1 white placeholder until a real face is uploaded.
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255, 255])
  );
  return tex;
}

export class CurlGlRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private posBuf: WebGLBuffer;
  private normBuf: WebGLBuffer;
  private frontTex: WebGLTexture;
  private backTex: WebGLTexture;
  private hasBack = false;

  private readonly cols: number;
  private readonly rows: number;
  private readonly texcoords: Float32Array;
  private readonly indices: Uint16Array;
  private readonly unitPos: Float32Array; // cone deformer output (unit space)
  private readonly scaledPos: Float32Array; // play-zone px
  private readonly normals: Float32Array;

  private W = 1;
  private H = 1;
  /** Vertical headroom (px each side) so the curl can extend past the page. */
  private padY = 0;

  constructor(canvas: HTMLCanvasElement, cols = 40, rows = 26) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });
    if (!gl) {
      throw new Error('WebGL2 not available');
    }
    this.gl = gl;
    this.cols = cols;
    this.rows = rows;

    const mesh = buildConeMesh(cols, rows);
    this.texcoords = mesh.texcoords;
    this.indices = mesh.indices;
    this.unitPos = new Float32Array(mesh.vertexCount * 3);
    this.scaledPos = new Float32Array(mesh.vertexCount * 3);
    this.normals = new Float32Array(mesh.vertexCount * 3);

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Curl WebGL link failed: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    const aPos = gl.getAttribLocation(program, 'aPos');
    const aNormal = gl.getAttribLocation(program, 'aNormal');
    const aUv = gl.getAttribLocation(program, 'aUv');

    this.posBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.scaledPos.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

    this.normBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.normals.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);

    const uvBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.texcoords, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

    const idxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    this.frontTex = makeTexture(gl);
    this.backTex = makeTexture(gl);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** Vertical headroom as a fraction of the sheet height (each side). */
  static readonly PAD_RATIO = 0.18;

  /** Size the drawing buffer to the play-zone (2W × (H + 2·pad)) at the given DPR. */
  resize(sheetWidth: number, sheetHeight: number, dpr: number): void {
    this.W = sheetWidth;
    this.H = sheetHeight;
    this.padY = Math.round(sheetHeight * CurlGlRenderer.PAD_RATIO);
    const canvas = this.gl.canvas as HTMLCanvasElement;
    canvas.width = Math.round(2 * sheetWidth * dpr);
    canvas.height = Math.round((sheetHeight + 2 * this.padY) * dpr);
    this.gl.viewport(0, 0, canvas.width, canvas.height);
  }

  private upload(tex: WebGLTexture, source: TexImageSource): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  setFront(source: TexImageSource): void {
    this.upload(this.frontTex, source);
  }

  setBack(source: TexImageSource | null): void {
    this.hasBack = source !== null;
    if (source) {
      this.upload(this.backTex, source);
    }
  }

  /** Recompute per-vertex smooth normals from the scaled positions. */
  private computeNormals(): void {
    const pos = this.scaledPos;
    const idx = this.indices;
    const n = this.normals;
    n.fill(0);
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3;
      const b = idx[i + 1] * 3;
      const c = idx[i + 2] * 3;
      const ux = pos[b] - pos[a];
      const uy = pos[b + 1] - pos[a + 1];
      const uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a];
      const vy = pos[c + 1] - pos[a + 1];
      const vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      n[a] += nx;
      n[a + 1] += ny;
      n[a + 2] += nz;
      n[b] += nx;
      n[b + 1] += ny;
      n[b + 2] += nz;
      n[c] += nx;
      n[c + 1] += ny;
      n[c + 2] += nz;
    }
    for (let i = 0; i < n.length; i += 3) {
      const len = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
      n[i] /= len;
      n[i + 1] /= len;
      n[i + 2] /= len;
    }
  }

  /**
   * Render the cone curl at `progress` (0–100). v1 curls horizontally (the
   * right edge toward the spine); orientation to an arbitrary crease comes in a
   * follow-up. The sheet occupies the right half of the 2W play-zone at rest.
   */
  render(progress: number): void {
    const gl = this.gl;
    const { W, H, padY } = this;
    const { theta: rawTheta, apex, rotation } = coneParams(progress);
    // Gentler wrap: the full π/2 cone hugs the virtual cylinder too tightly.
    const theta = rawTheta * 0.6;

    deformConeMesh(this.unitPos, this.texcoords, theta, apex);

    // Rigid rotation about the spine (the u=0 / x=0 edge), in the x–z plane,
    // turning the page from the right half (+x) toward the left (−x), then scale
    // the unit result into play-zone pixels (spine at x = W).
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const depthScale = W * 0.9;
    const up = this.unitPos;
    const sp = this.scaledPos;
    for (let i = 0; i < up.length; i += 3) {
      const x = up[i];
      const y = up[i + 1];
      const z = up[i + 2];
      const rx = x * cosR + z * sinR;
      const rz = -x * sinR + z * cosR;
      sp[i] = W + rx * W; // play-zone x (0..2W)
      sp[i + 1] = padY + H / 2 + y * H; // play-zone y, offset into the padded band
      sp[i + 2] = rz * depthScale;
    }

    this.computeNormals();

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sp);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.normals);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(gl.getUniformLocation(this.program, 'uResolution'), 2 * W, H + 2 * padY);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uDepth'), depthScale * 2);
    gl.uniform3f(gl.getUniformLocation(this.program, 'uLightDir'), -0.3, -0.4, 0.85);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uHasBack'), this.hasBack ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.frontTex);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uFront'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.backTex);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uBack'), 1);

    gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    // Intentionally do NOT call WEBGL_lose_context here: React StrictMode mounts
    // effects twice in dev, and losing the context on the first cleanup leaves
    // the immediate remount with a dead context. Drop GL objects and let the
    // context be GC'd when the canvas is removed.
    const gl = this.gl;
    gl.bindVertexArray(null);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.posBuf);
    gl.deleteBuffer(this.normBuf);
    gl.deleteTexture(this.frontTex);
    gl.deleteTexture(this.backTex);
    gl.deleteProgram(this.program);
  }
}
