/**
 * The diorama's engine: the day's real ground as a paper model, in WebGL.
 *
 * Loaded on demand (Diorama.tsx imports this module dynamically), so three.js
 * ships in this chunk only and is fetched only when DIORAMA is chosen.
 *
 * What it draws, and where each thing comes from:
 *   ground   — the committed heightmaps (public/control-room/terrain/), decoded
 *              here byte for byte (16-bit PNG, the meta's own formula), one mesh
 *              per frame displaced in the vertex shader, relief × the scenario's
 *              stated exaggeration. Shading is a cartographer's: north-west
 *              hillshade printed as paper tone and ink hachure, contour lines
 *              at the stated interval, an index contour every fifth.
 *   water    — cells at or below 0 m (within one vertical quantum) connected to
 *              the frame's edge through such cells: open water the tiles carry.
 *              Enclosed land below sea level stays land (README, "The diorama").
 *              Drawn flat at 0 m with the board's paper-sea hatch.
 *   zones    — the scenario's diorama anchors: each zone's named places, their
 *              hull widened by radius_km, as a signed distance field draped on
 *              the ground and stroked/hatched in the board's own state
 *              vocabulary (quiet · watch dashed · signal heavy · impact in the
 *              hazard's pattern · warned solid). State comes only from the
 *              controller (deriveBoard): this file never decides one.
 *   marks    — the slips' pictograms as paper chits on stems, the origin ✳ on a
 *              taller one (one instanced draw call), and your call's dispatch
 *              arcs from the desk to each zone you warned.
 *
 * Nothing here simulates the hazard: no fire, no water rising, no particles.
 */
import * as THREE from 'three';
import type { DioramaSpec, Scenario } from './types';
import type { Phase, Rect, Stamp, StageIntent, Tray } from './viewport';
import type { ZoneState } from './hazards';

/* ── Ground data ─────────────────────────────────────────────────────────── */

export type GroundMeta = {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  widthPx: number;
  heightPx: number;
  minElev: number;
  maxElev: number;
  metresPerPixelX: number;
  metresPerPixelY: number;
  verticalQuantumM: number;
  source: { publisher: string; dataset: string; url: string; license: string; licenseUrl: string; retrieved: string };
};

/** A 16-bit greyscale PNG, decoded without the browser's image path (which
 *  would drop it to 8 bits): chunks, zlib via DecompressionStream, unfilter. */
async function decodePng16(buf: ArrayBuffer): Promise<{ w: number; h: number; data: Uint16Array }> {
  const b = new Uint8Array(buf);
  const dv = new DataView(buf);
  let p = 8;
  let w = 0;
  let h = 0;
  const idat: Uint8Array[] = [];
  while (p < b.length) {
    const len = dv.getUint32(p);
    const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    if (type === 'IHDR') {
      w = dv.getUint32(p + 8);
      h = dv.getUint32(p + 12);
      if (b[p + 16] !== 16 || b[p + 17] !== 0) throw new Error('terrain PNG is not 16-bit greyscale');
    } else if (type === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  if (typeof DecompressionStream === 'undefined') throw new Error('no DecompressionStream');
  const raw = new Uint8Array(await new Response(new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const stride = w * 2;
  const out = new Uint16Array(w * h);
  let prev = new Uint8Array(stride);
  let o = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[o++];
    const line = raw.slice(o, o + stride);
    o += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= 2 ? line[i - 2] : 0;
      const up = prev[i];
      const c = i >= 2 ? prev[i - 2] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const pp = a + up - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - up);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      line[i] = v & 255;
    }
    for (let x = 0; x < w; x++) out[y * w + x] = (line[2 * x] << 8) | line[2 * x + 1];
    prev = line;
  }
  return { w, h, data: out };
}

type Frame = {
  meta: GroundMeta;
  w: number;
  h: number;
  elev: Float32Array;
  water: Uint8Array;
  /** world-space rectangle, km: x0 (west) … x1, z0 (north) … z1 */
  x0: number; x1: number; z0: number; z1: number;
};

/** Open water: at or below 0 m and reached from the frame's edge through such cells. */
function waterMask(elev: Float32Array, w: number, h: number, q: number) {
  const water = new Uint8Array(w * h);
  const lim = 1.5 * q;
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (water[i] || elev[i] > lim) continue;
    water[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  return water;
}

/** Each water cell's distance to the nearest land cell, km (two-pass chamfer):
 *  the engraver's waterlines run parallel to the coast at fixed offsets. */
function coastDistance(water: Uint8Array, w: number, h: number, mx: number, my: number) {
  const d = new Float32Array(w * h);
  const BIG = 1e9;
  for (let i = 0; i < d.length; i++) d[i] = water[i] ? BIG : 0;
  const dd = Math.hypot(mx, my);
  const pass = (y: number, x: number, dy: number, dx: number, c: number) => {
    const yy = y + dy;
    const xx = x + dx;
    if (yy < 0 || yy >= h || xx < 0 || xx >= w) return;
    const v = d[yy * w + xx] + c;
    if (v < d[y * w + x]) d[y * w + x] = v;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!water[y * w + x]) continue;
    pass(y, x, 0, -1, mx); pass(y, x, -1, 0, my); pass(y, x, -1, -1, dd); pass(y, x, -1, 1, dd);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    if (!water[y * w + x]) continue;
    pass(y, x, 0, 1, mx); pass(y, x, 1, 0, my); pass(y, x, 1, 1, dd); pass(y, x, 1, -1, dd);
  }
  for (let i = 0; i < d.length; i++) d[i] = Math.min(d[i], 60000) / 1000;
  return d;
}

/* ── Zones as distance fields ────────────────────────────────────────────── */

type V2 = [number, number];
function hull(pts: V2[]): V2[] {
  if (pts.length < 3) return pts;
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: V2, a: V2, b: V2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: V2[] = [];
  const hi: V2[] = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of s.reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
function segDist(p: V2, a: V2, b: V2) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
/** Signed distance (km) to a convex hull: negative inside. */
function sdHull(p: V2, h: V2[]) {
  if (h.length === 1) return Math.hypot(p[0] - h[0][0], p[1] - h[0][1]);
  let d = Infinity;
  let inside = h.length >= 3;
  for (let i = 0; i < h.length; i++) {
    const a = h[i];
    const b = h[(i + 1) % h.length];
    d = Math.min(d, segDist(p, a, b));
    if (h.length >= 3 && (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) < 0) inside = false;
  }
  return inside ? -d : d;
}

/* ── Shaders ─────────────────────────────────────────────────────────────── */

const MAXZ = 8;

const GROUND_VERT = /* glsl */ `
uniform sampler2D uH;
uniform float uScale;
uniform float uBase;
attribute vec2 aT;
attribute float aSide;
varying vec2 vT;
varying vec3 vW;
varying float vSide;
varying float vTop;
void main() {
  vT = aT;
  vec4 h = texture2D(uH, aT);
  float e = h.g > 0.5 ? 0.0 : h.r;
  vec3 p = vec3(position.x, e * uScale, position.z);
  if (aSide > 1.5) p.y = -uBase;
  vSide = aSide > 0.5 ? 1.0 : 0.0;
  vTop = aSide > 1.5 ? 0.0 : 1.0;
  vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const GROUND_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uH;
uniform sampler2D uZ0;
uniform sampler2D uZ1;
uniform vec2 uTexel;
uniform vec2 uMpp;
uniform float uSlope;
uniform float uContour;
uniform float uRipple;
uniform float uTime;
uniform float uRM;
uniform float uFire;
uniform vec3 cPaper;
uniform vec3 cPaperLit;
uniform vec3 cPaperDeep;
uniform vec3 cInk;
uniform vec3 cInkSoft;
uniform vec3 cRule;
uniform vec3 cEmber;
uniform int uZN;
uniform float uZState[${MAXZ}];
uniform float uZWarn[${MAXZ}];
uniform float uZSpot[${MAXZ}];
uniform float uZPrev[${MAXZ}];
uniform float uZPulse[${MAXZ}];
uniform float uZSweep[${MAXZ}];
uniform float uZRad[${MAXZ}];
uniform vec2 uZAnchor[${MAXZ}];
varying vec2 vT;
varying vec3 vW;
varying float vSide;
varying float vTop;

float aaLine(float c, float w) {
  float fw = max(fwidth(c), 1e-6);
  float d = abs(fract(c + 0.5) - 0.5) / fw;
  return (1.0 - smoothstep(w * 0.5 - 0.5, w * 0.5 + 0.5, d)) * (1.0 - smoothstep(0.22, 0.45, fw));
}
// Lines a fixed number of pixels apart at any zoom: two power-of-two
// spacings blended, so the hatch neither swims nor fills in.
float lodLines(float c, float px, float w) {
  float f = max(fwidth(c), 1e-7);
  float L = log2(f * px);
  float s0 = exp2(floor(L));
  float t = fract(L);
  return mix(aaLine(c / s0, w), aaLine(c / (2.0 * s0), w), t);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float eAt(vec2 t) { vec4 h = texture2D(uH, t); return h.g > 0.5 ? 0.0 : h.r; }
float zd(vec4 a, vec4 b, int k) {
  if (k == 0) return a.x; if (k == 1) return a.y; if (k == 2) return a.z; if (k == 3) return a.w;
  if (k == 4) return b.x; if (k == 5) return b.y; if (k == 6) return b.z; return b.w;
}
float pattern(vec2 q) {
  if (uFire > 0.5) {
    q.x += 0.5 * floor(q.y);
    vec2 c = fract(q) - 0.5;
    float d = abs(c.y + abs(c.x) * 1.3 - 0.14) / max(fwidth(q.y), 1e-6);
    return (1.0 - smoothstep(0.6, 1.5, d)) * step(abs(c.x), 0.3);
  }
  float v = q.y + 0.17 * sin(q.x * 6.2832);
  float d = abs(fract(v + 0.5) - 0.5) / max(fwidth(v), 1e-6);
  return 1.0 - smoothstep(0.6, 1.5, d);
}

void main() {
  vec4 h = texture2D(uH, vT);
  float elev = h.r;
  float wm = h.g;
  vec3 col;
  if (vSide > 0.5) {
    // The model's cut edge: card stock, the terrain's profile inked along its top.
    vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
    float lit = clamp(dot(n, normalize(vec3(-1.0, 1.2, -1.0))) * 0.5 + 0.5, 0.0, 1.0);
    col = mix(cRule, cPaperDeep, lit);
    col = mix(col, cInkSoft, lodLines(vW.y, 6.0, 0.8) * 0.16);
    float top = 1.0 - smoothstep(1.0, 2.2, (1.0 - vTop) / max(fwidth(vTop), 1e-6));
    col = mix(col, cInk, top);
    gl_FragColor = vec4(col, 1.0);
    return;
  }
  bool water = wm > 0.5;
  if (water) {
    // The board's paper sea: lit stock, a fine level hatch, faint soundings.
    // The board's paper sea, engraved: waterlines along the coast, then a
    // fine level hatch further out, and faint soundings where the tiles have them.
    float cd = h.b;
    col = mix(cPaperLit, cPaper, 0.25);
    col = mix(col, cInkSoft, lodLines(vW.z, 5.0, 0.7) * 0.26);
    float ripple = aaLine(cd / uRipple, 1.1) * step(uRipple * 0.5, cd) * (1.0 - smoothstep(uRipple * 2.5, uRipple * 4.5, cd));
    col = mix(col, cInk, ripple * 0.55);
    if (elev < -1.0) col = mix(col, cInkSoft, aaLine(-elev / (uContour * 2.0), 0.8) * 0.14);
  } else {
    // A cartographer's north-west light: tone and hachure, never a gradient.
    vec2 g = vec2(eAt(vT + vec2(uTexel.x, 0.0)) - eAt(vT - vec2(uTexel.x, 0.0)),
                  eAt(vT + vec2(0.0, uTexel.y)) - eAt(vT - vec2(0.0, uTexel.y)));
    g = g / (2.0 * uMpp) * uSlope;
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 L = normalize(vec3(-1.0, 1.25, -1.0));
    float lit = dot(n, L);
    float flat0 = L.y;
    float sh = clamp((flat0 - lit) / flat0 * 1.7, 0.0, 1.0);
    float hi = clamp((lit - flat0) / (1.0 - flat0) * 1.5, 0.0, 1.0);
    col = mix(cPaper, cPaperLit, hi * 0.85);
    col = mix(col, cPaperDeep, smoothstep(0.0, 0.55, sh) * 0.95);
    float h1 = lodLines(dot(vW.xz, vec2(0.7071, 0.7071)), 5.0, mix(0.6, 1.25, sh)) * smoothstep(0.22, 0.5, sh);
    float h2 = lodLines(dot(vW.xz, vec2(0.7071, -0.7071)), 6.0, 0.9) * smoothstep(0.62, 0.9, sh);
    col = mix(col, cInkSoft, clamp(h1 + h2, 0.0, 1.0) * 0.38);
    // No 0 m contour on land: the coast is the water mask's line, and on
    // ground that sits at sea level a 0 m line would only trace the noise.
    float off0 = smoothstep(uContour * 0.4, uContour * 0.6, abs(elev));
    float c1 = aaLine(elev / uContour, 1.0) * off0;
    float c5 = aaLine(elev / (uContour * 5.0), 1.9) * off0;
    col = mix(col, cInkSoft, max(c1 * 0.42, c5 * 0.75));
  }
  // The coast: one hard ink line where the water mask turns.
  float coast = 1.0 - smoothstep(0.6, 1.6, abs(wm - 0.5) / max(fwidth(wm), 1e-5));
  col = mix(col, cInk, coast * 0.85);

  // Zones, draped: the board's state vocabulary, by stroke and pattern.
  vec4 za = texture2D(uZ0, vT);
  vec4 zb = texture2D(uZ1, vT);
  vec2 o = (dFdx(vT) - dFdy(vT)) * 4.0;
  for (int k = 0; k < ${MAXZ}; k++) {
    if (k >= uZN) break;
    float d = zd(za, zb, k);
    float fw = max(fwidth(d), 1e-6);
    float px = d / fw;
    // Far outside a quiet drape: nothing to draw (most of the model, most frames).
    if (px > 7.0 && uZPrev[k] < 0.5 && uZPulse[k] < 0.01) continue;
    float st = uZState[k];
    float warn = uZWarn[k];
    float pulse = uZPulse[k];
    vec2 r = vW.xz - uZAnchor[k];
    float rr = length(r);
    float rad = uZRad[k];
    vec3 ec = st > 2.5 ? cEmber : cInk;
    if (!water && d < 0.0) {
      if (st > 2.5) {
        float sw = uZSweep[k];
        float reveal = sw < 0.0 ? 1.0 : 1.0 - smoothstep(sw - rad * 0.15, sw, rr);
        vec2 q = vW.xz / max(rad * 0.22, 0.05);
        float dense = smoothstep(0.25, 0.5, max(fwidth(q.x), fwidth(q.y)));
        col = mix(col, cEmber, mix(pattern(q) * 0.62, 0.22, dense) * reveal);
        if (sw >= 0.0) col = mix(col, cEmber, (1.0 - smoothstep(0.0, 2.5, abs(rr - sw) / max(fwidth(rr), 1e-6))) * 0.9);
      } else if (st > 1.5) {
        col = mix(col, cInk, 0.07);
      }
      col = mix(col, ec, pulse * 0.16);
    }
    float width = st < 0.5 ? 1.3 : st < 1.5 ? 2.2 : st < 2.5 ? 2.8 : 3.2;
    width = mix(width, 4.2, warn) + uZSpot[k] * 1.4 + pulse * 3.5;
    float edge = 1.0 - smoothstep(width * 0.5 - 0.6, width * 0.5 + 0.6, abs(px));
    if (st > 0.5 && st < 1.5 && warn < 0.5) edge *= step(0.4, fract(atan(r.y, r.x) * rr / max(rad * 0.5, 0.05)));
    float ea = st < 0.5 ? 0.4 : 0.95;
    if (uRM < 0.5 && st > 1.5) ea *= 0.8 + 0.2 * cos(uTime * 6.2832 / 2.4);
    col = mix(col, ec, edge * ea);
    // Reduced motion: the zone on the stage is struck twice, out of register.
    if (uRM > 0.5 && uZSpot[k] > 0.5) {
      float d2 = zd(texture2D(uZ0, vT - o), texture2D(uZ1, vT - o), k);
      float e2 = 1.0 - smoothstep(width * 0.5 - 0.6, width * 0.5 + 0.6, abs(d2 / max(fwidth(d2), 1e-6)));
      col = mix(col, ec, e2 * 0.55);
    }
    if (uZPrev[k] > 0.5) {
      float pe = 1.0 - smoothstep(1.1, 2.3, abs(px));
      pe *= step(0.55, fract(atan(r.y, r.x) * rr / max(rad * 0.16, 0.02)));
      col = mix(col, cEmber, pe);
    }
  }
  // Paper stock: a still grain, printed, not animated.
  col += (hash(floor(gl_FragCoord.xy)) - 0.5) * 0.03;
  gl_FragColor = vec4(col, 1.0);
}`;

const MARK_VERT = /* glsl */ `
uniform vec2 uView;
uniform float uDpr;
uniform float uTime;
attribute vec3 iPos;
attribute vec4 iUv;
attribute vec4 iP;
attribute float iBorn;
varying vec2 vL;
varying vec4 vUv;
varying vec3 vP;
void main() {
  vec4 c = projectionMatrix * viewMatrix * vec4(iPos, 1.0);
  float t = iBorn < 0.0 ? 1.0 : clamp((uTime - iBorn) / 0.35, 0.0, 1.0);
  float pop = iBorn < 0.0 ? 1.0 : mix(1.8, 1.0, 1.0 - pow(1.0 - t, 3.0));
  float chit = iP.y * pop;
  float tall = iP.y + iP.z;
  vec2 px = vec2(position.x * chit + iP.x, position.y * (iP.z + chit)) * uDpr;
  c.xy += px * 2.0 / uView * c.w;
  gl_Position = c;
  vL = vec2(position.x + 0.5, position.y * (iP.z + chit));
  vUv = iUv;
  vP = vec3(chit, iP.z, iP.w * (iBorn < 0.0 ? 1.0 : smoothstep(0.0, 0.6, t)));
}`;

const MARK_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uAtlas;
uniform vec3 cInk;
varying vec2 vL;
varying vec4 vUv;
varying vec3 vP;
void main() {
  float chit = vP.x;
  float stem = vP.y;
  float a = vP.z;
  if (a <= 0.001) discard;
  if (vL.y < stem) {
    // The stem, and the pin where it meets the ground.
    float x = abs(vL.x - 0.5) * chit;
    float line = 1.0 - smoothstep(0.7, 1.4, x);
    float pin = 1.0 - smoothstep(2.4, 3.4, length(vec2(x, vL.y - 3.0)));
    float m = max(line, pin);
    if (m < 0.01) discard;
    gl_FragColor = vec4(cInk, m * a);
    return;
  }
  vec2 uv = vec2(vL.x, (vL.y - stem) / chit);
  vec4 t = texture2D(uAtlas, vUv.xy + uv * vUv.zw);
  if (t.a < 0.01) discard;
  gl_FragColor = vec4(t.rgb, t.a * a);
}`;

const FLAT_VERT = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FLAT_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uAlpha;
void main() { gl_FragColor = vec4(uColor, uAlpha); }`;
const SHADOW_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 d = max(abs(vUv - 0.5) - 0.42, 0.0);
  float a = 1.0 - smoothstep(0.0, 0.08, length(d));
  gl_FragColor = vec4(uColor, a * 0.16);
}`;
const SHADOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/* ── The engine ──────────────────────────────────────────────────────────── */

export type Palette = Record<'paper' | 'paperLit' | 'paperDeep' | 'ink' | 'inkSoft' | 'rule' | 'ember', [number, number, number]>;

/** What the controller hands the engine on every render (it diffs). */
export type EngineState = {
  phase: Phase;
  cursor: number;
  rm: boolean;
  playing: boolean;
  zoneStates: Record<string, ZoneState>;
  warned: string[];
  warnedNow: string[];
  spot: string[];
  preview: string[];
  /** zones whose state this slip changed, and the slip's key (a new key = a new beat) */
  fresh: string[];
  freshOrigins: string[];
  beatKey: string;
  origins: string[];
  stamps: Stamp[];
  intent: StageIntent;
  safe: Rect | null;
  tray: Tray | null;
  phone: boolean;
};

export type Engine = {
  update: (s: EngineState) => void;
  /** Raise the ground from the paper over `ms` (0: at once). */
  rise: (ms: number) => void;
  /** The impact beat: sweep this zone's drape (null: no zone). */
  impact: (zone: string | null) => void;
  nudge: (what: 'left' | 'right' | 'in' | 'out' | 'reset') => void;
  relabel: () => void;
  /** Ground point under a lon/lat, for the labels. */
  dispose: () => void;
  frames: GroundMeta[];
  fps: () => number;
};

export type EngineOpts = {
  host: HTMLElement;
  labels: HTMLElement;
  scenario: Scenario;
  palette: Palette;
  /** glyph key → SVG markup, rasterized here into the chit atlas */
  glyphs: Map<string, string>;
  onLost: () => void;
};

const ease = (t: number) => {
  // The house arrival curve, cubic-bezier(0.2, 0.8, 0.2, 1), solved for y at x = t.
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let u = t;
  for (let i = 0; i < 20; i++) {
    u = (lo + hi) / 2;
    const x = 3 * u * (1 - u) * (1 - u) * 0.2 + 3 * u * u * (1 - u) * 0.2 + u * u * u;
    if (x < t) lo = u; else hi = u;
  }
  return 3 * u * (1 - u) * (1 - u) * 0.8 + 3 * u * u * (1 - u) * 1 + u * u * u;
};
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const STATE_N: Record<ZoneState, number> = { quiet: 0, watch: 1, signal: 2, impact: 3 };

type Cam = { tx: number; ty: number; tz: number; dist: number; az: number; pitch: number };
const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({
  tx: a.tx + (b.tx - a.tx) * t, ty: a.ty + (b.ty - a.ty) * t, tz: a.tz + (b.tz - a.tz) * t,
  dist: Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * t),
  az: a.az + (b.az - a.az) * t, pitch: a.pitch + (b.pitch - a.pitch) * t,
});

export async function createEngine(o: EngineOpts): Promise<Engine> {
  const { scenario, palette } = o;
  const spec = scenario.diorama as DioramaSpec;
  const exag = spec.exaggeration;

  // ── Fetch and decode the frames ─────────────────────────────────────────
  const loaded = await Promise.all(spec.frames.map(async (id) => {
    const [mr, pr] = await Promise.all([fetch(`/control-room/terrain/${id}.json`), fetch(`/control-room/terrain/${id}.png`)]);
    if (!mr.ok || !pr.ok) throw new Error(`terrain ${id} did not load`);
    const meta = (await mr.json()) as GroundMeta;
    const img = await decodePng16(await pr.arrayBuffer());
    if (img.w !== meta.widthPx || img.h !== meta.heightPx) throw new Error(`terrain ${id} size does not match its meta`);
    const elev = new Float32Array(img.w * img.h);
    const k = (meta.maxElev - meta.minElev) / 65535;
    for (let i = 0; i < elev.length; i++) elev[i] = meta.minElev + img.data[i] * k;
    return { meta, w: img.w, h: img.h, elev, water: waterMask(elev, img.w, img.h, meta.verticalQuantumM) };
  }));

  // One flat projection for the whole table, km from the frames' centre.
  const west = Math.min(...loaded.map((f) => f.meta.bbox[0]));
  const east = Math.max(...loaded.map((f) => f.meta.bbox[2]));
  const south = Math.min(...loaded.map((f) => f.meta.bbox[1]));
  const north = Math.max(...loaded.map((f) => f.meta.bbox[3]));
  const lon0 = (west + east) / 2;
  const lat0 = (south + north) / 2;
  const KX = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const KZ = 110.574;
  const toW = (lon: number, lat: number): V2 => [(lon - lon0) * KX, -(lat - lat0) * KZ];
  const frames: Frame[] = loaded.map((f) => {
    const [x0, z0] = toW(f.meta.bbox[0], f.meta.bbox[3]);
    const [x1, z1] = toW(f.meta.bbox[2], f.meta.bbox[1]);
    return { ...f, x0, x1, z0, z1 };
  });
  const span = Math.max(...frames.map((f) => f.x1), 0) - Math.min(...frames.map((f) => f.x0));
  const spanZ = Math.max(...frames.map((f) => f.z1)) - Math.min(...frames.map((f) => f.z0));
  const tableR = Math.hypot(span, spanZ) / 2;
  const base = Math.max(span, spanZ) * 0.018;

  // ── Zones: the anchors, and which are draped ────────────────────────────
  const zoneIds = scenario.scoring.at_risk_zones.map((z) => z.id).filter((z) => spec.zones[z]);
  const zones = zoneIds.map((id, k) => {
    const e = spec.zones[id];
    const pts = e.places.map((p) => toW(p.lon, p.lat));
    const a = e.places.find((p) => p.name === e.anchor) ?? e.places[0];
    let anchor = toW(a.lon, a.lat);
    if (e.beyond_frame) {
      // Point to it from the table's edge, along the true bearing.
      const f = frames[0];
      const cx = (f.x0 + f.x1) / 2;
      const cz = (f.z0 + f.z1) / 2;
      const dx = anchor[0] - cx;
      const dz = anchor[1] - cz;
      const t = Math.min(Math.abs((dx > 0 ? f.x1 - cx : f.x0 - cx) / (dx || 1e-9)), Math.abs((dz > 0 ? f.z1 - cz : f.z0 - cz) / (dz || 1e-9))) * 0.94;
      anchor = [cx + dx * t, cz + dz * t];
    }
    return { id, k, beyond: !!e.beyond_frame, radius: e.radius_km, hull: hull(pts), anchor };
  });
  const draped = zones.filter((z) => !z.beyond);
  if (draped.length > MAXZ) throw new Error('too many zones for the drape');
  /** How far each drape reaches from its anchor (the sweep's full radius). */
  const reach = draped.map((z) => z.radius + Math.max(0, ...z.hull.map((p) => Math.hypot(p[0] - z.anchor[0], p[1] - z.anchor[1]))));

  // ── Renderer, scene, camera ─────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.className = 'cr-dio-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  // No MSAA: every line is antialiased in the shader, and MSAA was the
  // single largest cost on a software rasterizer. Quality steps down (pixel
  // ratio, then the lighter grid) if frames run long; it never steps up.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // colours below are the tokens' own sRGB values
  renderer.setClearColor(0x000000, 0);
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2);
  let pr = dpr;
  renderer.setPixelRatio(pr);
  o.host.prepend(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, tableR * 20);

  const v3 = (c: [number, number, number]) => new THREE.Vector3(c[0], c[1], c[2]);
  const shared = {
    cPaper: { value: v3(palette.paper) }, cPaperLit: { value: v3(palette.paperLit) }, cPaperDeep: { value: v3(palette.paperDeep) },
    cInk: { value: v3(palette.ink) }, cInkSoft: { value: v3(palette.inkSoft) }, cRule: { value: v3(palette.rule) }, cEmber: { value: v3(palette.ember) },
    uTime: { value: 0 }, uRM: { value: 0 },
    uZN: { value: draped.length },
    uZState: { value: new Array(MAXZ).fill(0) }, uZWarn: { value: new Array(MAXZ).fill(0) },
    uZSpot: { value: new Array(MAXZ).fill(0) }, uZPrev: { value: new Array(MAXZ).fill(0) },
    uZPulse: { value: new Array(MAXZ).fill(0) }, uZSweep: { value: new Array(MAXZ).fill(-1) },
    uZRad: { value: new Array(MAXZ).fill(1) },
    uZAnchor: { value: Array.from({ length: MAXZ }, () => new THREE.Vector2()) },
    uFire: { value: /fire|bushfire|wildland/i.test(scenario.hazard) ? 1 : 0 },
    uScale: { value: 0 }, uSlope: { value: 0 }, uBase: { value: base },
  };
  draped.forEach((z, i) => {
    shared.uZRad.value[i] = z.radius;
    shared.uZAnchor.value[i].set(z.anchor[0], z.anchor[1]);
  });

  const disposables: { dispose: () => void }[] = [];
  const lods: { mesh: THREE.Mesh; lo: THREE.BufferGeometry }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };

  for (const f of frames) {
    const { w, h } = f;
    // Height + water, half float (filterable in WebGL2).
    const hd = new Uint16Array(w * h * 4);
    const zd0 = new Uint16Array(w * h * 4);
    const zd1 = new Uint16Array(w * h * 4);
    const toH = THREE.DataUtils.toHalfFloat;
    const coast = coastDistance(f.water, w, h, f.meta.metresPerPixelX, f.meta.metresPerPixelY);
    const big = toH(999);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const c = j * w + i;
        hd[c * 4] = toH(f.elev[c]);
        hd[c * 4 + 1] = toH(f.water[c]);
        hd[c * 4 + 2] = toH(coast[c]);
        hd[c * 4 + 3] = toH(1);
        const p: V2 = [f.x0 + ((i + 0.5) / w) * (f.x1 - f.x0), f.z0 + ((j + 0.5) / h) * (f.z1 - f.z0)];
        for (let k = 0; k < 8; k++) {
          const z = draped[k];
          const v = z ? toH(Math.min(900, sdHull(p, z.hull) - z.radius)) : big;
          if (k < 4) zd0[c * 4 + k] = v; else zd1[c * 4 + k - 4] = v;
        }
      }
    }
    const mk = (d: Uint16Array) => {
      const t = keep(new THREE.DataTexture(d, w, h, THREE.RGBAFormat, THREE.HalfFloatType));
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
      return t;
    };
    const tH = mk(hd);
    const tZ0 = mk(zd0);
    const tZ1 = mk(zd1);

    // One mesh per level of detail: the surface grid (at most 192 cells on
    // the long edge, 96 for the lighter tier) and its cut edges. The shading
    // samples the full-resolution texture whichever grid carries it.
    const build = (maxSeg: number) => {
      const sx = Math.min(maxSeg, w - 1);
      const sz = Math.min(maxSeg, Math.round((sx * (h - 1)) / (w - 1)));
      const pos: number[] = [];
      const at: number[] = [];
      const side: number[] = [];
      const idx: number[] = [];
      const vert = (u: number, v: number, s: number) => {
        // the grid's corners sit on the first and last texel centres
        pos.push(f.x0 + u * (f.x1 - f.x0), 0, f.z0 + v * (f.z1 - f.z0));
        at.push(0.5 / w + u * (1 - 1 / w), 0.5 / h + v * (1 - 1 / h));
        side.push(s);
        return pos.length / 3 - 1;
      };
      for (let j = 0; j <= sz; j++) for (let i = 0; i <= sx; i++) vert(i / sx, j / sz, 0);
      for (let j = 0; j < sz; j++) {
        for (let i = 0; i < sx; i++) {
          const a = j * (sx + 1) + i;
          idx.push(a, a + sx + 1, a + 1, a + 1, a + sx + 1, a + sx + 2);
        }
      }
      const edge = (pts: [number, number][]) => {
        let prev: [number, number] | null = null;
        for (const [u, v] of pts) {
          const t = vert(u, v, 1);
          const bt = vert(u, v, 2);
          if (prev) idx.push(prev[0], prev[1], t, t, prev[1], bt);
          prev = [t, bt];
        }
      };
      const run = (n: number, fn: (k: number) => [number, number]) => Array.from({ length: n + 1 }, (_, k) => fn(k / n));
      edge(run(sx, (u) => [u, 1])); // south (front)
      edge(run(sz, (v) => [1, 1 - v])); // east
      edge(run(sx, (u) => [1 - u, 0])); // north
      edge(run(sz, (v) => [0, v])); // west
      const g = keep(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aT', new THREE.Float32BufferAttribute(at, 2));
      g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
      g.setIndex(idx);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3((f.x0 + f.x1) / 2, 0, (f.z0 + f.z1) / 2), tableR * 2);
      return g;
    };
    const geo = build(192);
    const geoLo = build(96);
    const mat = keep(new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      uniforms: {
        ...shared,
        uH: { value: tH }, uZ0: { value: tZ0 }, uZ1: { value: tZ1 },
        uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
        uMpp: { value: new THREE.Vector2(f.meta.metresPerPixelX, f.meta.metresPerPixelY) },
        uContour: { value: spec.contour_m },
        uRipple: { value: Math.max(0.12, tableR * 0.011) },
      },
      side: THREE.DoubleSide,
    }));
    const mesh = new THREE.Mesh(geo, mat);
    lods.push({ mesh, lo: geoLo });
    scene.add(mesh);

    // A soft contact shadow on the table, off the light (to the south-east).
    const sg = keep(new THREE.PlaneGeometry((f.x1 - f.x0) * 1.12, (f.z1 - f.z0) * 1.12));
    sg.rotateX(-Math.PI / 2);
    const sm = keep(new THREE.ShaderMaterial({ vertexShader: SHADOW_VERT, fragmentShader: SHADOW_FRAG, uniforms: { uColor: shared.cInk }, transparent: true, depthWrite: false }));
    const shadow = new THREE.Mesh(sg, sm);
    shadow.position.set((f.x0 + f.x1) / 2 + base * 1.4, -base - 0.002, (f.z0 + f.z1) / 2 + base * 1.4);
    shadow.renderOrder = -1;
    scene.add(shadow);
  }

  // ── Heights on the CPU, for marks, labels and the camera ────────────────
  let rise = 0;
  const elevAt = (x: number, z: number) => {
    for (const f of frames) {
      if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue;
      const fx = clamp(((x - f.x0) / (f.x1 - f.x0)) * f.w - 0.5, 0, f.w - 1);
      const fy = clamp(((z - f.z0) / (f.z1 - f.z0)) * f.h - 0.5, 0, f.h - 1);
      const i = Math.floor(fx);
      const j = Math.floor(fy);
      const i1 = Math.min(i + 1, f.w - 1);
      const j1 = Math.min(j + 1, f.h - 1);
      const e = (a: number, b: number) => (f.water[b * f.w + a] ? 0 : f.elev[b * f.w + a]);
      const tx = fx - i;
      const ty = fy - j;
      return (e(i, j) * (1 - tx) + e(i1, j) * tx) * (1 - ty) + (e(i, j1) * (1 - tx) + e(i1, j1) * tx) * ty;
    }
    return 0;
  };
  const yAt = (x: number, z: number) => (elevAt(x, z) / 1000) * exag * rise;

  // ── Marks: chits on stems, the origin ✳, one instanced draw call ────────
  const CELL = 96;
  const atlasN = 10;
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = CELL * atlasN;
  atlasCanvas.height = CELL * atlasN;
  const ctx = atlasCanvas.getContext('2d')!;
  const hex = (c: [number, number, number]) => `rgb(${c.map((x) => Math.round(x * 255)).join(',')})`;
  const cells = new Map<string, number>();
  const drawCell = async (key: string, svg: string | null, n: number) => {
    const x = (n % atlasN) * CELL;
    const y = Math.floor(n / atlasN) * CELL;
    if (key === 'star') {
      ctx.save();
      ctx.translate(x + CELL / 2, y + CELL / 2);
      ctx.lineCap = 'round';
      const star = () => {
        ctx.beginPath();
        const r = 26;
        const d = r * 0.7;
        ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
        ctx.moveTo(-d, -d); ctx.lineTo(d, d); ctx.moveTo(-d, d); ctx.lineTo(d, -d);
        ctx.stroke();
      };
      ctx.strokeStyle = hex(palette.paper); ctx.lineWidth = 14; star();
      ctx.strokeStyle = hex(palette.ink); ctx.lineWidth = 6; star();
      ctx.restore();
      return;
    }
    // A paper chit: ink rule, an offset ink shadow (the board's box-shadow).
    ctx.fillStyle = hex(palette.ink);
    ctx.fillRect(x + 10, y + 10, 80, 80);
    ctx.fillStyle = hex(palette.paper);
    ctx.fillRect(x + 4, y + 4, 80, 80);
    ctx.strokeStyle = hex(palette.ink);
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 6, y + 6, 76, 76);
    if (!svg) return;
    const src = svg.replace(/currentColor/g, hex(palette.ink));
    const img = new Image();
    img.decoding = 'async';
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`;
    try { await img.decode(); ctx.drawImage(img, x + 18, y + 18, 52, 52); } catch { /* a glyph that will not rasterize leaves a plain chit */ }
  };
  let nCell = 0;
  await drawCell('star', null, nCell);
  cells.set('star', nCell++);
  for (const [key, svg] of Array.from(o.glyphs.entries())) {
    if (nCell >= atlasN * atlasN) break;
    await drawCell(key, svg, nCell);
    cells.set(key, nCell++);
  }
  const atlas = keep(new THREE.CanvasTexture(atlasCanvas));
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.anisotropy = 4;
  const cellUv = (key: string) => {
    const n = cells.get(key) ?? cells.get('star')!;
    const s = CELL / atlasCanvas.width;
    return [(n % atlasN) * s, 1 - (Math.floor(n / atlasN) + 1) * s, s, s];
  };
  const MAXM = 48;
  const quad = new THREE.InstancedBufferGeometry();
  keep(quad);
  quad.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(MAXM * 3), 3);
  const iUv = new THREE.InstancedBufferAttribute(new Float32Array(MAXM * 4), 4);
  const iP = new THREE.InstancedBufferAttribute(new Float32Array(MAXM * 4), 4);
  const iBorn = new THREE.InstancedBufferAttribute(new Float32Array(MAXM), 1);
  [iPos, iUv, iP, iBorn].forEach((a) => a.setUsage(THREE.DynamicDrawUsage));
  quad.setAttribute('iPos', iPos);
  quad.setAttribute('iUv', iUv);
  quad.setAttribute('iP', iP);
  quad.setAttribute('iBorn', iBorn);
  quad.instanceCount = 0;
  const markMat = keep(new THREE.ShaderMaterial({
    vertexShader: MARK_VERT, fragmentShader: MARK_FRAG,
    uniforms: { uView: { value: new THREE.Vector2(1, 1) }, uDpr: { value: dpr }, uTime: shared.uTime, uAtlas: { value: atlas }, cInk: shared.cInk },
    transparent: true, depthTest: false, depthWrite: false,
  }));
  const marks = new THREE.Mesh(quad, markMat);
  marks.frustumCulled = false;
  marks.renderOrder = 10;
  scene.add(marks);
  type Mark = { x: number; z: number; key: string; off: number; chit: number; stem: number; alpha: number; born: number };
  let markList: Mark[] = [];
  const iUvByKey = new Map<string, number[]>();

  // ── Dispatch arcs (built when a call lands) ─────────────────────────────
  const arcs = new THREE.Group();
  scene.add(arcs);
  type Arc = { mesh: THREE.Mesh; ring: THREE.Mesh; count: number; start: number; ringAt: number };
  let arcList: Arc[] = [];
  const arcMat = keep(new THREE.ShaderMaterial({ vertexShader: FLAT_VERT, fragmentShader: FLAT_FRAG, uniforms: { uColor: shared.cInk, uAlpha: { value: 0.92 } }, transparent: true, depthTest: false }));
  const ringMat = keep(new THREE.ShaderMaterial({ vertexShader: FLAT_VERT, fragmentShader: FLAT_FRAG, uniforms: { uColor: shared.cInk, uAlpha: { value: 1 } }, transparent: true, depthTest: false, side: THREE.DoubleSide }));
  const clearArcs = () => {
    for (const a of arcList) { a.mesh.geometry.dispose(); a.ring.geometry.dispose(); arcs.remove(a.mesh); arcs.remove(a.ring); }
    arcList = [];
  };

  // ── Camera rig ──────────────────────────────────────────────────────────
  const view = { w: 1, h: 1 };
  let safe: Rect | null = null;
  const BASE_AZ = -0.32;
  let cur: Cam = { tx: 0, ty: 0, tz: 0, dist: tableR * 4, az: BASE_AZ + 0.9, pitch: 1.2 };
  let tween: { from: Cam; to: Cam; t0: number; ms: number } | null = null;
  let home: Cam = cur;
  let wideDist = tableR * 3;
  const fovY = (camera.fov * Math.PI) / 180;
  // Fit a shot by looking through it: project the points' padded footprint
  // (at full relief) and scale the distance until it fills the safe area.
  const probe = new THREE.PerspectiveCamera(camera.fov, 1, 0.01, tableR * 40);
  const pv0 = new THREE.Vector3();
  const frameFor = (pts: V2[], pad: number, pitch: number, az: number, minR: number): Cam => {
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    let ring: V2[] = [];
    for (const p of pts) for (let k = 0; k < 8; k++) ring.push([p[0] + Math.cos((k * Math.PI) / 4) * pad, p[1] + Math.sin((k * Math.PI) / 4) * pad]);
    const R = Math.max(...ring.map((p) => Math.hypot(p[0] - cx, p[1] - cz)));
    if (R < minR) ring = Array.from({ length: 16 }, (_, k) => [cx + Math.cos((k * Math.PI) / 8) * minR, cz + Math.sin((k * Math.PI) / 8) * minR] as V2);
    const full = (x: number, z: number) => (elevAt(x, z) / 1000) * exag;
    const sx0 = safe ? safe.x : 0;
    const sy0 = safe ? safe.y : 0;
    const sw = safe ? safe.w : view.w;
    const sh = safe ? safe.h : view.h;
    probe.aspect = view.w / view.h;
    probe.setViewOffset(view.w, view.h, view.w / 2 - (sx0 + sw / 2), view.h / 2 - (sy0 + sh / 2), view.w, view.h);
    const cam: Cam = { tx: cx, ty: full(cx, cz) * 0.5, tz: cz, dist: Math.max(R, 0.1) * 4, az, pitch };
    for (let it = 0; it < 4; it++) {
      const p = clamp(cam.pitch, 0.3, 1.42);
      probe.position.set(cam.tx + cam.dist * Math.cos(p) * Math.sin(az), cam.ty + cam.dist * Math.sin(p), cam.tz + cam.dist * Math.cos(p) * Math.cos(az));
      probe.lookAt(cam.tx, cam.ty, cam.tz);
      probe.updateMatrixWorld();
      let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
      for (const q of ring) {
        pv0.set(q[0], full(q[0], q[1]), q[1]).project(probe);
        const px = (pv0.x * 0.5 + 0.5) * view.w;
        const py = (-pv0.y * 0.5 + 0.5) * view.h;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      const k = Math.max((x1 - x0) / (sw * 0.9), (y1 - y0) / (sh * 0.84));
      if (!Number.isFinite(k) || k <= 0) break;
      cam.dist *= it < 3 ? Math.pow(k, 0.9) : k;
    }
    return cam;
  };
  const corners: V2[] = frames.flatMap((f) => [[f.x0, f.z0], [f.x1, f.z0], [f.x0, f.z1], [f.x1, f.z1]] as V2[]);
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const zonePts = (ids: string[]) => ids.flatMap((id) => {
    const z = zoneById.get(id);
    if (!z) return [];
    return z.beyond ? [z.anchor] : z.hull.map((p) => p);
  });
  const zonePad = (ids: string[]) => Math.max(0.2, ...ids.map((id) => (zoneById.get(id)?.radius ?? 0) * 1.25));
  const minR = tableR * 0.09;
  const shotFor = (intent: StageIntent, phone: boolean): { cam: Cam; ms: number } => {
    const wide = frameFor(corners, 0, 0.92, BASE_AZ, 0);
    wideDist = wide.dist;
    const pitchFor = phone ? 0.08 : 0;
    switch (intent.shot) {
      case 'establish': return { cam: { ...wide, pitch: 0.86 + pitchFor }, ms: 3400 };
      case 'end': return { cam: { ...wide, pitch: 1.28, dist: wide.dist * 1.08, az: BASE_AZ + 0.12 }, ms: 2400 };
      case 'wide': return { cam: wide, ms: 1000 };
      case 'call': {
        const ids = intent.zones.length ? intent.zones : zoneIds;
        return { cam: frameFor(zonePts(ids), zonePad(ids) * 1.2, 1.08 + pitchFor, BASE_AZ, minR * 1.6), ms: 1100 };
      }
      case 'record': {
        const ids = intent.zones.length ? intent.zones : zoneIds;
        return { cam: frameFor(zonePts(ids), zonePad(ids) * 1.3, 0.98 + pitchFor, BASE_AZ, minR * 1.4), ms: 1000 };
      }
      case 'origin': return { cam: frameFor(zonePts(intent.zones), zonePad(intent.zones), 0.7 + pitchFor, BASE_AZ, minR), ms: 1150 };
      default: return { cam: frameFor(zonePts(intent.zones), zonePad(intent.zones), 0.78 + pitchFor, BASE_AZ, minR), ms: 1000 };
    }
  };
  const travelTo = (to: Cam, ms: number, now: number, rmode: boolean) => {
    home = to;
    if (rmode) { cur = to; tween = null; return; }
    // 800–1200 ms by how far the table moves under the lens (longer shots keep their own).
    const moved = Math.hypot(to.tx - cur.tx, to.tz - cur.tz) / tableR + Math.abs(Math.log(to.dist / cur.dist));
    const d = ms > 1200 ? ms : clamp(800 + moved * 500, 800, Math.max(800, Math.min(1200, ms + 200)));
    tween = { from: cur, to, t0: now, ms: d };
  };
  const applyCam = (c: Cam) => {
    const p = clamp(c.pitch, 0.3, 1.42);
    const x = c.tx + c.dist * Math.cos(p) * Math.sin(c.az);
    const z = c.tz + c.dist * Math.cos(p) * Math.cos(c.az);
    let y = c.ty + c.dist * Math.sin(p);
    // Never underground: hold the lens above the model wherever it is.
    y = Math.max(y, yAt(x, z) + base * 2);
    camera.position.set(x, y, z);
    camera.lookAt(c.tx, c.ty, c.tz);
  };

  // ── Labels: DOM, placed from the model each frame ───────────────────────
  type Lab = { el: HTMLElement; x: number; z: number; lift: number; ground: boolean; w: number; h: number; zone: boolean };
  let labs: Lab[] = [];
  const relabel = () => {
    labs = Array.from(o.labels.querySelectorAll<HTMLElement>('[data-lon]')).map((el) => {
      const lon = Number(el.dataset.lon);
      const lat = Number(el.dataset.lat);
      const zone = el.dataset.zone ? zoneById.get(el.dataset.zone) : null;
      const [x, z] = zone ? zone.anchor : toW(lon, lat);
      const body = el.firstElementChild as HTMLElement | null;
      const isZone = el.classList.contains('cr-dio-zone');
      return { el, x, z, lift: Number(el.dataset.lift ?? 0), ground: el.dataset.ground === '0', w: isZone ? body?.offsetWidth ?? 0 : 0, h: isZone ? body?.offsetHeight ?? 0 : 0, zone: isZone };
    });
  };
  relabel();
  const pv = new THREE.Vector3();
  const placed: [number, number, number, number][] = [];
  const placeLabels = () => {
    placed.length = 0;
    for (const l of labs) {
      pv.set(l.x, l.ground ? 0 : yAt(l.x, l.z), l.z).project(camera);
      const vis = pv.z < 1 && Math.abs(pv.x) < 1.15 && Math.abs(pv.y) < 1.15;
      const sx = (pv.x * 0.5 + 0.5) * view.w;
      let sy = (-pv.y * 0.5 + 0.5) * view.h - l.lift;
      if (l.zone && vis && l.w) {
        // Two zones' names never print over each other: the later one steps down.
        const x0 = sx - l.w / 2 - 4;
        const x1 = sx + l.w / 2 + 4;
        for (let pass = 0; pass < 4; pass++) {
          const hit = placed.find(([a, b, c, d]) => x0 < b && x1 > a && sy < d && sy + l.h + 4 > c);
          if (!hit) break;
          sy = hit[3] + 2;
        }
        placed.push([x0, x1, sy, sy + l.h + 4]);
      }
      l.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
      l.el.style.visibility = vis ? '' : 'hidden';
    }
  };

  // ── Interaction: drag to turn, wheel/pinch to lean, clamped ─────────────
  let user = false;
  let driftAz = 0;
  let driftAmp = 0;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch0 = 0;
  const onDown = (e: PointerEvent) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) { lean(pinch0 / d); pinch0 = d; }
      return;
    }
    if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
    grab();
    cur = { ...cur, az: cur.az - dx * 0.006, pitch: e.pointerType === 'touch' ? cur.pitch : clamp(cur.pitch + dy * 0.005, 0.3, 1.42) };
  };
  const onUp = (e: PointerEvent) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; };
  const grab = () => {
    if (tween) { cur = lerpCam(tween.from, tween.to, ease((performance.now() - tween.t0) / tween.ms)); tween = null; }
    if (!user) cur = { ...cur, az: cur.az + driftAz };
    user = true;
  };
  const lean = (k: number) => {
    grab();
    cur = { ...cur, dist: clamp(cur.dist * k, wideDist * 0.12, wideDist * 1.7) };
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    lean(Math.exp(clamp(e.deltaY, -120, 120) * 0.0018));
  };
  o.host.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  o.host.addEventListener('wheel', onWheel, { passive: false });

  // ── State from the controller ───────────────────────────────────────────
  let st: EngineState | null = null;
  let intentRef: StageIntent | null = null;
  let beatKey = '';
  let rmode = false;
  const now = () => performance.now() / 1000;
  const pulseAt = new Array(MAXZ).fill(-99);
  const sweepAt = new Array(MAXZ).fill(-99);
  const warnAt = new Array(MAXZ).fill(-99);
  let lastWarnKey = '';
  let travelMs = 0;
  let riseFrom = 0;
  let riseTo = 1;
  let riseT0 = 0;
  let riseMs = 0;

  const rebuildMarks = (s: EngineState, t: number, fresh: boolean) => {
    const phone = s.phone;
    const chit = phone ? 30 : 42;
    const gap = phone ? 34 : 48;
    const next: Mark[] = [];
    const old = new Map(markList.map((m) => [m.key, m]));
    for (const m of s.stamps) {
      const z = zoneById.get(m.z);
      if (!z) continue;
      const key = `s:${m.key}`;
      const was = old.get(key);
      const born = s.rm ? -1 : m.state === 'active' && fresh ? t + (travelMs / 1000) * 0.55 : was?.born ?? -1;
      next.push({
        x: z.anchor[0], z: z.anchor[1], key, off: (m.k - (m.n - 1) / 2) * gap, chit, stem: phone ? 22 : 30,
        alpha: s.phase === 'record' ? 0 : m.state === 'active' ? 1 : 0.5, born,
      });
      iUvByKey.set(key, cellUv(m.glyph));
    }
    for (const id of s.origins) {
      const z = zoneById.get(id);
      if (!z) continue;
      const key = `o:${id}`;
      const born = s.rm ? -1 : s.freshOrigins.includes(id) && fresh ? t + (travelMs / 1000) * 0.4 : old.get(key)?.born ?? -1;
      next.push({ x: z.anchor[0], z: z.anchor[1], key, off: 0, chit: phone ? 30 : 40, stem: phone ? 62 : 84, alpha: 1, born });
      iUvByKey.set(key, cellUv('star'));
    }
    markList = next.slice(0, MAXM);
    quad.instanceCount = markList.length;
    markList.forEach((m, i) => {
      const uv = iUvByKey.get(m.key)!;
      iUv.setXYZW(i, uv[0], uv[1], uv[2], uv[3]);
      iP.setXYZW(i, m.off, m.chit, m.stem, m.alpha);
      iBorn.setX(i, m.born);
    });
    iUv.needsUpdate = true;
    iP.needsUpdate = true;
    iBorn.needsUpdate = true;
    placeMarks();
  };
  const placeMarks = () => {
    markList.forEach((m, i) => iPos.setXYZ(i, m.x, yAt(m.x, m.z), m.z));
    iPos.needsUpdate = true;
  };

  /** The desk, on the ground: where the tray's inner edge meets the model
   *  under the record shot's lens (the order leaves the desk from there). */
  const deskPoint = (s: EngineState, cam: Cam): V2 => {
    const saved = camera.position.clone();
    const savedQ = camera.quaternion.clone();
    applyCam(cam);
    camera.updateMatrixWorld();
    const sx = s.tray && s.safe ? (s.tray.side === 'left' ? s.tray.edge + 8 : s.safe.x + s.safe.w * 0.18) : view.w * 0.1;
    const sy = s.tray && s.safe ? (s.tray.side === 'left' ? s.safe.y + s.safe.h * 0.5 : s.tray.edge + 8) : view.h * 0.5;
    const ndc = new THREE.Vector2((sx / view.w) * 2 - 1, -(sy / view.h) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    const ok = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit);
    camera.position.copy(saved);
    camera.quaternion.copy(savedQ);
    if (!ok) return [cam.tx - cam.dist * 0.4, cam.tz];
    return [hit.x, hit.z];
  };

  const buildArcs = (s: EngineState, t: number) => {
    clearArcs();
    if (s.phase !== 'record' || !s.warnedNow.length) return;
    const cam = home;
    const [dx, dz] = deskPoint(s, cam);
    const r = cam.dist * 0.0016;
    s.warnedNow.forEach((id, i) => {
      const z = zoneById.get(id);
      if (!z) return;
      const a = new THREE.Vector3(dx, 0, dz);
      const b = new THREE.Vector3(z.anchor[0], yAt(z.anchor[0], z.anchor[1]), z.anchor[1]);
      const mid = a.clone().lerp(b, 0.5);
      mid.y += Math.max(a.distanceTo(b) * 0.32, cam.dist * 0.08);
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const geo = new THREE.TubeGeometry(curve, 64, r, 6, false);
      const mesh = new THREE.Mesh(geo, arcMat);
      mesh.renderOrder = 8;
      mesh.frustumCulled = false;
      const rg = new THREE.RingGeometry(r * 3.2, r * 5, 40);
      rg.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(rg, ringMat);
      ring.position.copy(b).add(new THREE.Vector3(0, base * 0.2, 0));
      ring.renderOrder = 9;
      const count = geo.index!.count;
      const start = s.rm ? -1 : t + travelMs / 1000 + i * 0.12;
      if (!s.rm) { geo.setDrawRange(0, 0); ring.scale.setScalar(0.001); }
      arcs.add(mesh, ring);
      arcList.push({ mesh, ring, count, start, ringAt: start + 0.48 });
    });
  };

  const update = (s: EngineState) => {
    const t = now();
    const prev = st;
    st = s;
    rmode = s.rm;
    shared.uRM.value = s.rm ? 1 : 0;
    safe = s.safe;
    applyViewOffset();
    // Zone states and the marks the controller derived.
    draped.forEach((z, i) => {
      const was = shared.uZState.value[i];
      const now0 = STATE_N[s.zoneStates[z.id] ?? 'quiet'];
      shared.uZState.value[i] = now0;
      shared.uZSpot.value[i] = s.spot.includes(z.id) ? 1 : 0;
      shared.uZPrev.value[i] = s.preview.includes(z.id) ? 1 : 0;
      if (now0 < was) { pulseAt[i] = -99; sweepAt[i] = -99; }
    });
    const newBeat = s.beatKey !== beatKey;
    beatKey = s.beatKey;
    // A new intent: a new camera move (and the user's own view lets go).
    if (s.intent !== intentRef || !prev || prev.phone !== s.phone) {
      const firstShot = !intentRef;
      intentRef = s.intent;
      const shot = shotFor(s.intent, s.phone);
      if (firstShot && s.intent.shot === 'establish' && !s.rm) {
        cur = { ...shot.cam, dist: shot.cam.dist * 1.75, pitch: 1.25, az: BASE_AZ + 0.95 };
      } else if (firstShot && !s.rm) {
        cur = { ...shot.cam, dist: shot.cam.dist * 1.4, pitch: Math.min(1.3, shot.cam.pitch + 0.25) };
      }
      user = false;
      travelTo(shot.cam, shot.ms, performance.now(), s.rm);
      travelMs = s.rm ? 0 : tween?.ms ?? 0;
    }
    if (newBeat && !s.rm) {
      draped.forEach((z, i) => {
        if (!s.fresh.includes(z.id)) return;
        const at0 = t + (travelMs / 1000) * 0.55;
        pulseAt[i] = at0;
        if ((s.zoneStates[z.id] ?? 'quiet') === 'impact') sweepAt[i] = at0;
      });
    }
    // Your call: the warned zones ink in once the lens has framed them.
    const warnKey = `${s.phase}:${s.cursor}:${s.warnedNow.join(',')}`;
    draped.forEach((z, i) => {
      const warned = s.warned.includes(z.id);
      if (!warned) { warnAt[i] = -99; shared.uZWarn.value[i] = 0; return; }
      const fresh = s.phase === 'record' && s.warnedNow.includes(z.id);
      if (fresh && warnKey !== lastWarnKey) warnAt[i] = s.rm ? -99 : t + travelMs / 1000 + 0.52;
      else if (!fresh && warnAt[i] > t) warnAt[i] = -99;
    });
    if (warnKey !== lastWarnKey) {
      lastWarnKey = warnKey;
      buildArcs(s, t);
    }
    rebuildMarks(s, t, newBeat);
    wake();
  };

  const applyViewOffset = () => {
    const sx = safe ? safe.x + safe.w / 2 : view.w / 2;
    const sy = safe ? safe.y + safe.h / 2 : view.h / 2;
    camera.setViewOffset(view.w, view.h, view.w / 2 - sx, view.h / 2 - sy, view.w, view.h);
  };
  const resize = () => {
    const r = o.host.getBoundingClientRect();
    view.w = Math.max(1, r.width);
    view.h = Math.max(1, r.height);
    renderer.setSize(view.w, view.h, false);
    camera.aspect = view.w / view.h;
    camera.updateProjectionMatrix();
    applyViewOffset();
    markMat.uniforms.uView.value.set(view.w * pr, view.h * pr);
    if (intentRef && st) {
      // Re-fit the current shot to the new shape, without a move.
      const shot = shotFor(intentRef, st.phone);
      home = shot.cam;
      if (!user && !tween) cur = shot.cam;
      else if (tween) tween.to = shot.cam;
    }
    wake();
  };

  // ── The loop: only while visible on screen and in a visible tab ─────────
  let raf = 0;
  let onScreen = true;
  let fpsEma = 0;
  let lastT = 0;
  let fpsShown = 0;
  let frameMs = 0;
  let nFrames = 0;
  let tier = 0;
  // Dev/test hook: hold full quality (for reference captures on a software rasterizer).
  const pinned = (() => { try { return localStorage.getItem('cr-dio-quality') === 'full'; } catch { return false; } })();
  const stepDown = () => {
    tier += 1;
    nFrames = 0;
    frameMs = 0;
    if (tier === 2) for (const l of lods) l.mesh.geometry = l.lo;
    else pr = Math.max(0.6, pr * 0.72);
    renderer.setPixelRatio(pr);
    renderer.setSize(view.w, view.h, false);
    markMat.uniforms.uView.value.set(view.w * pr, view.h * pr);
    markMat.uniforms.uDpr.value = pr;
    o.host.dataset.tier = String(tier);
  };
  const tick = (ms: number) => {
    raf = 0;
    if (!onScreen || document.hidden) return;
    const dt = lastT ? Math.min(0.1, (ms - lastT) / 1000) : 0.016;
    if (lastT) {
      frameMs = frameMs ? frameMs * 0.94 + dt * 1000 * 0.06 : dt * 1000;
      fpsEma = 1000 / frameMs;
      if (++nFrames > 40 && frameMs > 26 && tier < 3 && !pinned) stepDown();
    }
    lastT = ms;
    const t = ms / 1000;
    shared.uTime.value = t;
    // The ground rises from the paper.
    if (riseMs > 0) {
      const k = clamp((ms - riseT0) / riseMs, 0, 1);
      rise = riseFrom + (riseTo - riseFrom) * smooth(k);
      if (k >= 1) riseMs = 0;
    }
    shared.uScale.value = (exag / 1000) * rise;
    shared.uSlope.value = exag * rise;
    // The camera: travel, the user's hand, the idle drift.
    if (tween) {
      const k = (ms - tween.t0) / tween.ms;
      cur = lerpCam(tween.from, tween.to, ease(k));
      if (k >= 1) { cur = tween.to; tween = null; }
    }
    const idle = !!st && !rmode && !user && !tween && st.playing && st.phase !== 'record';
    driftAmp += ((idle ? 1 : 0) - driftAmp) * Math.min(1, dt * 0.6);
    driftAz = Math.sin(t * ((2 * Math.PI) / 26)) * 0.07 * driftAmp;
    applyCam(user ? cur : { ...cur, az: cur.az + driftAz });
    // Zone animation scalars.
    draped.forEach((_, i) => {
      const pk = t - pulseAt[i];
      shared.uZPulse.value[i] = pk >= 0 && pk < 1.4 ? Math.exp(-pk * 3.2) * smooth(pk / 0.08) : 0;
      // The impact sweep: hidden until it starts, then wiped out from the anchor.
      const sk = t - sweepAt[i];
      shared.uZSweep.value[i] = sk < 0 ? 0.0001 : sk < 1.1 ? ease(sk) * reach[i] * 1.15 : -1;
      if (st && st.warned.includes(draped[i].id)) {
        const wk = t - warnAt[i];
        shared.uZWarn.value[i] = warnAt[i] < 0 ? 1 : clamp(wk / 0.35, 0, 1);
      }
    });
    // Arcs draw out, then the landing ring is stamped.
    for (const a of arcList) {
      if (a.start < 0) continue;
      const k = clamp((t - a.start) / 0.52, 0, 1);
      a.mesh.geometry.setDrawRange(0, Math.floor((ease(k) * a.count) / 6) * 6);
      const rk = clamp((t - a.ringAt) / 0.24, 0, 1);
      a.ring.scale.setScalar(rk <= 0 ? 0.001 : 1 + (1 - rk) * 0.8);
    }
    if (riseMs > 0 || rise < 1) placeMarks();
    renderer.render(scene, camera);
    placeLabels();
    if (ms - fpsShown > 500) { fpsShown = ms; o.host.dataset.fps = fpsEma.toFixed(1); o.labels.dataset.near = cur.dist < wideDist * 0.55 ? '1' : '0'; }
    raf = requestAnimationFrame(tick);
  };
  const wake = () => { if (!raf && onScreen && !document.hidden) { lastT = 0; raf = requestAnimationFrame(tick); } };
  const ro = new ResizeObserver(resize);
  ro.observe(o.host);
  resize();
  const io = new IntersectionObserver((es) => { onScreen = es.some((e) => e.isIntersecting); if (onScreen) wake(); });
  io.observe(o.host);
  const onVis = () => wake();
  document.addEventListener('visibilitychange', onVis);
  const onLost = (e: Event) => { e.preventDefault(); o.onLost(); };
  canvas.addEventListener('webglcontextlost', onLost);
  // Compile now, so the first camera move does not stall on it.
  renderer.compile(scene, camera);

  const engine: Engine = {
    frames: frames.map((f) => f.meta),
    fps: () => fpsEma,
    update,
    relabel,
    rise: (ms) => {
      riseFrom = rise;
      riseTo = 1;
      if (ms <= 0) { rise = 1; riseMs = 0; } else { riseT0 = performance.now(); riseMs = ms; }
      wake();
    },
    impact: (zone) => {
      const i = draped.findIndex((z) => z.id === zone);
      const t = now();
      if (i >= 0 && !rmode) { sweepAt[i] = t + 0.25; pulseAt[i] = t + 0.25; }
      wake();
    },
    nudge: (what) => {
      if (what === 'reset') {
        user = false;
        travelTo(home, 900, performance.now(), rmode);
        wake();
        return;
      }
      grab();
      if (what === 'left') cur = { ...cur, az: cur.az + 0.35 };
      if (what === 'right') cur = { ...cur, az: cur.az - 0.35 };
      if (what === 'in') cur = { ...cur, dist: clamp(cur.dist / 1.3, wideDist * 0.12, wideDist * 1.7) };
      if (what === 'out') cur = { ...cur, dist: clamp(cur.dist * 1.3, wideDist * 0.12, wideDist * 1.7) };
      wake();
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      o.host.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      o.host.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('webglcontextlost', onLost);
      clearArcs();
      scene.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
  wake();
  return engine;
}
