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
import { buildConeMesh } from '../../flip/coneDeformer';

const VERTEX_SRC = `#version 300 es
in vec3 aPos;      // play-zone pixels: x ∈ [0, 2W], y ∈ [0, H], z = depth px
in vec3 aNormal;
in vec2 aUv;
in float aDist;    // signed distance from the crease (px): <0 flat, >0 wrapped
uniform vec2 uResolution;  // (2W, H + 2·pad)
uniform float uDepth;      // depth range used to normalise z into clip space
out vec3 vNormal;
out vec2 vUv;
out float vDist;
void main() {
  vec2 p = aPos.xy / uResolution;          // 0..1
  vec2 clip = vec2(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0);
  // Higher z (toward the viewer) → smaller clip z → drawn in front.
  float z = clamp(-aPos.z / uDepth, -1.0, 1.0);
  gl_Position = vec4(clip, z, 1.0);
  vNormal = aNormal;
  vUv = aUv;
  vDist = aDist;
}`;

const FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec2 vUv;
in float vDist;
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform bool uHasBack;
uniform vec3 uLightDir;
uniform float uShadow;      // cast-shadow strength (0–1, = shadowOpacity)
uniform float uShadowBand;  // px over which the cast shadow fades from the crease
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
  float spec = pow(max(dot(R, V), 0.0), 80.0);  // tight glossy ridge at the roll apex
  float light = 0.58 + 0.42 * diff;
  if (!front) {
    light *= 0.82;                         // the curled-under back reads a touch darker
  }
  vec3 rgb = base.rgb * clamp(light, 0.0, 1.3) + vec3(spec * 0.6); // additive specular highlight
  // Cast shadow: a soft blob the lifted curl drops on the flat page (vDist < 0).
  // It is ZERO at the crease itself (so there's no brightness step / hard line on
  // the fold), rises just inside under the curl's overhang, then fades out — a
  // smooth bump (0 at the crease and at the band edge, peak in between).
  if (vDist < 0.0 && uShadow > 0.0) {
    float t = clamp(-vDist / uShadowBand, 0.0, 1.0);   // 0 at the crease → 1 at the band edge
    float shade = uShadow * 0.5 * (4.0 * t * (1.0 - t));
    rgb *= 1.0 - shade;
  }
  fragColor = vec4(rgb, base.a);
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
  private distBuf: WebGLBuffer;
  private frontTex: WebGLTexture;
  private backTex: WebGLTexture;
  private hasBack = false;

  private readonly cols: number;
  private readonly rows: number;
  private readonly texcoords: Float32Array;
  private readonly indices: Uint16Array;
  private readonly scaledPos: Float32Array; // play-zone px
  private readonly normals: Float32Array;
  private readonly dist: Float32Array; // signed distance from crease, per vertex

  private W = 1;
  private H = 1;
  /** Vertical headroom (px each side) so the curl can extend past the page. */
  private padY = 0;

  constructor(canvas: HTMLCanvasElement, cols = 56, rows = 40) {
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
    this.scaledPos = new Float32Array(mesh.vertexCount * 3);
    this.normals = new Float32Array(mesh.vertexCount * 3);
    this.dist = new Float32Array(mesh.vertexCount);

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

    const aDist = gl.getAttribLocation(program, 'aDist');
    this.distBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.distBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.dist.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aDist);
    gl.vertexAttribPointer(aDist, 1, gl.FLOAT, false, 0, 0);

    const idxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    this.frontTex = makeTexture(gl);
    this.backTex = makeTexture(gl);

    // No Y-flip: our mesh has v=0 at the top, matching the image's top row, so
    // flipping would render the captured face upside-down.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
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
   * Render the curl by wrapping the page around the CREASE line (cylinder model,
   * kivy/Hung). The crease — its midpoint and normal — comes straight from the
   * reflection fold, so the curl follows the drag in EVERY direction (horizontal,
   * vertical, diagonal) with the correct sign, and there is no fixed-axis spike.
   *
   * @param creaseMidX page-coord crease midpoint x (spine at x=0)
   * @param creaseMidY page-coord crease midpoint y
   * @param nx,ny      crease normal (unit), pointing toward the grabbed edge:
   *                   page points with positive distance along it are the flap
   *                   that wraps; the spine side stays flat.
   * @param radius     curl radius in px (larger = gentler wrap)
   * @param sheetLeft  page x of the sheet's spine edge: 0 at rest, −W when flipped
   * @param shadowStrength 0–1 cast-shadow opacity the curl drops on the flat page
   */
  render(
    creaseMidX: number,
    creaseMidY: number,
    nx: number,
    ny: number,
    radius: number,
    sheetLeft: number,
    shadowStrength: number
  ): void {
    const gl = this.gl;
    const { W, H, padY } = this;
    const PI = Math.PI;
    const r = Math.max(radius, 1);
    const tc = this.texcoords;
    const sp = this.scaledPos;
    const count = tc.length / 2;
    for (let i = 0; i < count; i++) {
      const px = sheetLeft + tc[i * 2] * W; // page x (spine→free edge)
      const py = tc[i * 2 + 1] * H; // page y
      const d = (px - creaseMidX) * nx + (py - creaseMidY) * ny; // signed dist from crease
      this.dist[i] = d;
      let wx = px;
      let wy = py;
      let wz = 0;
      if (d > 0) {
        const dr = d / r;
        if (dr <= PI) {
          const f = r * Math.sin(dr) - d; // wrap around the cylinder
          wx = px + nx * f;
          wy = py + ny * f;
          wz = r * (1 - Math.cos(dr));
        } else {
          const f = PI * r - 2 * d; // flat back, fully wrapped over
          wx = px + nx * f;
          wy = py + ny * f;
          wz = 2 * r;
        }
      }
      sp[i * 3] = W + wx; // play-zone x (page x + W; spine at centre)
      sp[i * 3 + 1] = padY + wy; // play-zone y (padded band)
      sp[i * 3 + 2] = wz; // depth toward the viewer
    }
    const depthScale = 2 * r;

    this.computeNormals();

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sp);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.normals);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.distBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.dist);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(gl.getUniformLocation(this.program, 'uResolution'), 2 * W, H + 2 * padY);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uDepth'), depthScale * 2);
    gl.uniform3f(gl.getUniformLocation(this.program, 'uLightDir'), -0.3, -0.4, 0.85);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uShadow'), shadowStrength);
    // The cast shadow fades over a wide band (a few × the roll height) so it
    // reads as a soft gradient under the curl rather than a defined stripe.
    gl.uniform1f(gl.getUniformLocation(this.program, 'uShadowBand'), Math.max(70, 3.0 * r));
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
    gl.deleteBuffer(this.distBuf);
    gl.deleteTexture(this.frontTex);
    gl.deleteTexture(this.backTex);
    gl.deleteProgram(this.program);
  }
}
