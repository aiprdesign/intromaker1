/**
 * Shared WebGL layer for image skills, built on two open-source libraries:
 *
 * - OGL (Unlicense): a minimal WebGL library for textured planes, cameras and shader programs.
 * - gl-transitions (MIT): the community collection of GLSL image-to-image transitions; each is a
 *   pure function of `progress`, so any frame renders exactly (preview, seek and export match).
 *
 * One offscreen WebGL canvas renders a skill's image work at the size it's needed; the skill
 * then draws that canvas into the 2D frame (clipped, shadowed, reflected) straight away. Without
 * WebGL, `glRenderer()` returns null and skills fall back to 2D.
 */
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import type { Drawable } from "./media";

let renderer: Renderer | null | undefined;

/**
 * The shared renderer, sized to `w`×`h` (null when WebGL isn't available). `resize = false` leaves
 * its size alone for a caller that sets its own (the 3D engine renders supersampled): resizing
 * reallocates the drawing buffer, so sizing it twice a frame would cost that twice.
 */
export function glRenderer(w: number, h: number, resize = true): Renderer | null {
  if (renderer === undefined) {
    try {
      renderer = typeof document === "undefined" ? null : new Renderer({ width: w, height: h, dpr: 1, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true });
      if (renderer && !renderer.gl) renderer = null;
    } catch {
      renderer = null;
    }
  }
  if (!renderer) return null;
  if (!resize) return renderer;
  const cw = Math.max(1, Math.round(w));
  const ch = Math.max(1, Math.round(h));
  if (renderer.gl.canvas.width !== cw || renderer.gl.canvas.height !== ch) renderer.setSize(cw, ch);
  return renderer;
}

const textures = new WeakMap<object, Texture>();

/** A texture for an image, canvas or video frame (videos re-upload their current frame; canvases are static). */
export function textureOf(r: Renderer, src: Drawable | HTMLCanvasElement): Texture {
  let tex = textures.get(src);
  if (!tex) {
    const gl = r.gl;
    tex = new Texture(gl, { image: src as HTMLImageElement, minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR, anisotropy: 8 });
    textures.set(src, tex);
  } else if (src instanceof HTMLVideoElement) {
    tex.needsUpdate = true;
  }
  return tex;
}

/** Intrinsic size of an image, canvas or video. */
export function sizeOf(src: Drawable | HTMLCanvasElement) {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLCanvasElement) return { w: src.width, h: src.height };
  return { w: src.naturalWidth, h: src.naturalHeight };
}

/** UV scale/offset that makes a texture cover a frame of aspect `frameAspect` (CSS object-fit: cover). */
export function coverUv(src: Drawable | HTMLCanvasElement, frameAspect: number, align: "center" | "top" = "center"): [number, number, number, number] {
  const { w, h } = sizeOf(src);
  const a = w && h ? w / h : 1;
  let sx = 1;
  let sy = 1;
  if (a > frameAspect) sx = frameAspect / a;
  else sy = a / frameAspect;
  // Offsets in UV space; "top" keeps a screenshot's header in view (UV y is flipped).
  const ox = (1 - sx) / 2;
  const oy = align === "top" ? 1 - sy : (1 - sy) / 2;
  return [sx, sy, ox, oy];
}

/* ───────── gl-transitions ───────── */

type GlTransition = { name: string; glsl: string; defaultParams: Record<string, number | number[]>; paramsTypes: Record<string, string>; license: string; author: string };

/**
 * The transitions used for SaaS galleries: smooth, premium ones (warps, zooms, slices, flips).
 * `dark` ones draw a black reflective floor, so they're only used on dark styles.
 */
export const GALLERY_TRANSITIONS: { name: string; dark?: boolean; params?: Record<string, number | number[]> }[] = [
  { name: "crosswarp" },
  { name: "directionalwarp", params: { smoothness: 0.3, direction: [-1, 0] } },
  { name: "Directional", params: { direction: [1, 0] } },
  { name: "CrossZoom", params: { strength: 0.3 } },
  { name: "windowslice", params: { count: 12, smoothness: 0.6 } },
  { name: "GridFlip", params: { size: [5, 3], pause: 0.05, dividerWidth: 0.02, randomness: 0.2 } },
  { name: "morph", params: { strength: 0.08 } },
  { name: "LinearBlur", params: { intensity: 0.08 } },
  { name: "ripple", params: { amplitude: 60, speed: 30 } },
  { name: "squeeze", params: { colorSeparation: 0.02 } },
  { name: "cube", dark: true, params: { persp: 0.7, unzoom: 0.25, reflection: 0.25, floating: 3 } },
  { name: "swap", dark: true, params: { reflection: 0.25, perspective: 0.2, depth: 3 } },
];

let library: Map<string, GlTransition> | null = null;
let loading: Promise<void> | null = null;

/** Load the transition shaders (a separate chunk, fetched only when a film uses them). */
export function loadTransitions(): Promise<void> {
  loading ??= import("gl-transitions")
    .then((m) => {
      const all = ((m as { default?: GlTransition[] }).default ?? (m as unknown as GlTransition[])) as GlTransition[];
      library = new Map(all.filter((t) => GALLERY_TRANSITIONS.some((g) => g.name === t.name)).map((t) => [t.name, t]));
    })
    .catch(() => {
      library = new Map();
    });
  return loading;
}
export const transitionsReady = () => !!library;

const VERT = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

const programs = new Map<string, { program: Program; mesh: Mesh } | null>();

function transitionMesh(r: Renderer, name: string) {
  const key = `${name}`;
  if (programs.has(key)) return programs.get(key)!;
  const t = library?.get(name);
  if (!t) {
    programs.set(key, null);
    return null;
  }
  const spec = GALLERY_TRANSITIONS.find((g) => g.name === name);
  // Every gl-transition reads its two images through getFromColor / getToColor and receives
  // progress + ratio; here each image is also cover-fitted to the frame.
  const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform vec4 uFromUv;
uniform vec4 uToUv;
uniform float progress;
uniform float ratio;
vec4 getFromColor(vec2 uv) { return texture2D(uFrom, uv * uFromUv.xy + uFromUv.zw); }
vec4 getToColor(vec2 uv) { return texture2D(uTo, uv * uToUv.xy + uToUv.zw); }
${t.glsl}
void main() { gl_FragColor = transition(vUv); }`;
  const uniforms: Record<string, { value: unknown }> = {
    uFrom: { value: null },
    uTo: { value: null },
    uFromUv: { value: [1, 1, 0, 0] },
    uToUv: { value: [1, 1, 0, 0] },
    progress: { value: 0 },
    ratio: { value: 1 },
  };
  for (const [k, v] of Object.entries({ ...t.defaultParams, ...(spec?.params ?? {}) })) uniforms[k] = { value: v };
  try {
    const program = new Program(r.gl, { vertex: VERT, fragment: frag, uniforms, transparent: true, depthTest: false, depthWrite: false });
    const mesh = new Mesh(r.gl, { geometry: new Triangle(r.gl), program });
    const out = { program, mesh };
    programs.set(key, out);
    return out;
  } catch {
    programs.set(key, null);
    return null;
  }
}

/**
 * Render one gl-transition between two images at `progress` into the shared canvas (w×h), and
 * return that canvas (null when WebGL or the transition isn't available: callers crossfade).
 */
export function renderTransition(name: string, from: Drawable | HTMLCanvasElement, to: Drawable | HTMLCanvasElement, progress: number, w: number, h: number, opts: { bg?: [number, number, number, number]; align?: "center" | "top" } = {}): HTMLCanvasElement | null {
  if (!library) return null;
  const r = glRenderer(w, h);
  if (!r) return null;
  const m = transitionMesh(r, name);
  if (!m) return null;
  const u = m.program.uniforms as Record<string, { value: unknown }>;
  u.uFrom.value = textureOf(r, from);
  u.uTo.value = textureOf(r, to);
  u.uFromUv.value = coverUv(from, w / h, opts.align);
  u.uToUv.value = coverUv(to, w / h, opts.align);
  u.progress.value = Math.min(1, Math.max(0, progress));
  u.ratio.value = w / h;
  if (u.bgcolor && opts.bg) u.bgcolor.value = opts.bg;
  r.render({ scene: m.mesh });
  return r.gl.canvas as HTMLCanvasElement;
}

/* ───────── Liquid: gooey text and liquid scene transitions ───────── */

/** Textures for canvases that change every frame (re-uploaded on each use). */
const live = new Map<string, Texture>();
function liveTexture(r: Renderer, key: string, src: HTMLCanvasElement) {
  let tex = live.get(key);
  if (!tex || tex.gl !== r.gl) {
    const gl = r.gl;
    tex = new Texture(gl, { image: src, generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    live.set(key, tex);
  } else {
    tex.image = src;
    tex.needsUpdate = true;
  }
  return tex;
}

const liquidPrograms = new Map<string, { program: Program; mesh: Mesh } | null>();
function fullscreen(r: Renderer, key: string, frag: string, uniforms: Record<string, { value: unknown }>) {
  if (liquidPrograms.has(key)) return liquidPrograms.get(key)!;
  try {
    const program = new Program(r.gl, { vertex: VERT, fragment: frag, uniforms, transparent: true, depthTest: false, depthWrite: false });
    const out = { program, mesh: new Mesh(r.gl, { geometry: new Triangle(r.gl), program }) };
    liquidPrograms.set(key, out);
    return out;
  } catch {
    liquidPrograms.set(key, null);
    return null;
  }
}

/**
 * Liquid type: the headline pours in left to right. Each letter drops into place as a gooey blob
 * (its blurred alpha re-thresholded, so neighbouring letters merge like fluid), catches a glossy
 * highlight while it moves, and snaps into crisp type as it settles. On exit it melts downwards.
 */
const LIQUID_TEXT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uPx;
uniform float uT;
uniform float uSpread;
uniform float uDur;
uniform float uExit;
uniform float uDrop;
uniform float uGoo;
vec4 tap(vec2 p) {
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return vec4(0.0);
  vec4 c = texture2D(uTex, p);
  return vec4(c.rgb * c.a, c.a);
}
void main() {
  float order = vUv.x * 0.8 + (1.0 - vUv.y) * 0.2;
  float k = clamp((uT - order * uSpread) / uDur, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - k, 2.0);
  float inv = 1.0 - e;
  float ex = uExit;
  vec2 p = vUv;
  p.x += sin(vUv.y * 22.0 + uT * 16.0) * 0.006 * (inv + ex);
  p.y -= inv * inv * uDrop;
  p.y += ex * ex * uDrop * 0.8;
  float r = inv * uGoo + ex * uGoo * 1.3;
  vec4 acc = tap(p) * 2.0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 2.39996;
    float rr = sqrt((float(i) + 0.5) / 12.0) * r;
    acc += tap(p + vec2(cos(a), sin(a)) * rr * uPx);
  }
  acc /= 14.0;
  vec4 crisp = tap(p);
  float settle = smoothstep(0.82, 1.0, e) * (1.0 - smoothstep(0.0, 0.3, ex));
  float gooA = smoothstep(0.28, 0.55, acc.a);
  float alpha = mix(gooA, crisp.a, settle);
  vec3 col = acc.a > 0.001 ? acc.rgb / acc.a : vec3(0.0);
  if (crisp.a > 0.001) col = mix(col, crisp.rgb / crisp.a, settle);
  // Glossy highlight on the moving liquid's upper-left edges.
  float d = max(1.5, r * 0.6);
  float gx = tap(p + vec2(uPx.x * d, 0.0)).a - tap(p - vec2(uPx.x * d, 0.0)).a;
  float gy = tap(p + vec2(0.0, uPx.y * d)).a - tap(p - vec2(0.0, uPx.y * d)).a;
  vec2 n = vec2(gx, gy);
  float spec = length(n) > 0.02 ? clamp(dot(normalize(n), normalize(vec2(0.6, -0.8))), 0.0, 1.0) : 0.0;
  col += pow(spec, 2.0) * 0.45 * (1.0 - settle);
  alpha *= smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.55, 1.0, ex));
  gl_FragColor = vec4(col * alpha, alpha);
}`;

/** Render liquid text from `src` (the finished headline on a transparent canvas); null without WebGL. */
export function liquidText(src: HTMLCanvasElement, o: { t: number; spread: number; dur: number; exit: number; drop: number; goo: number }): HTMLCanvasElement | null {
  const r = glRenderer(src.width, src.height);
  if (!r) return null;
  const m = fullscreen(r, "liquid-text", LIQUID_TEXT, {
    uTex: { value: null }, uPx: { value: [1, 1] }, uT: { value: 0 }, uSpread: { value: 0.4 }, uDur: { value: 0.5 },
    uExit: { value: 0 }, uDrop: { value: 0.3 }, uGoo: { value: 8 },
  });
  if (!m) return null;
  const u = m.program.uniforms as Record<string, { value: unknown }>;
  u.uTex.value = liveTexture(r, "liquid-text", src);
  u.uPx.value = [1 / src.width, 1 / src.height];
  u.uT.value = o.t;
  u.uSpread.value = o.spread;
  u.uDur.value = o.dur;
  u.uExit.value = o.exit;
  u.uDrop.value = o.drop;
  u.uGoo.value = o.goo;
  r.render({ scene: m.mesh });
  return r.gl.canvas as HTMLCanvasElement;
}

/**
 * Liquid scene transition: the incoming shot rises in behind a wavy liquid front, with blobs
 * racing ahead of it that merge into the surface (smooth-min metaballs), a refracting meniscus
 * and a bright rim. A pure function of progress, so preview and export match.
 */
const LIQUID_WIPE = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uP;
uniform float uRatio;
uniform float uSeed;
uniform vec2 uDir;
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0;
  return mix(mix(hash(n), hash(n + 1.0), f.x), mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
void main() {
  vec2 uv = vUv;
  vec2 perp = vec2(-uDir.y, uDir.x);
  float s = dot(uv - 0.5, uDir) / (abs(uDir.x) + abs(uDir.y)) + 0.5;
  float across = dot(uv - 0.5, perp) + 0.5;
  float P = uP * 1.4 - 0.2;
  float wave = (noise(vec2(across * 5.0 + uSeed, uP * 3.0)) - 0.5) * 0.16 + sin(across * 11.0 + uP * 9.0 + uSeed) * 0.02;
  float d = s - (P + wave);
  float grow = smoothstep(0.0, 0.25, uP) * (1.0 - smoothstep(0.75, 1.0, uP));
  for (int i = 0; i < 7; i++) {
    float fi = float(i) + uSeed * 0.13;
    float bx = hash(fi * 7.13 + 1.7);
    float lead = 0.05 + 0.22 * hash(fi * 3.71 + 4.1);
    float by = P + lead * (0.6 + 0.4 * sin(uP * 6.0 + fi));
    float br = (0.025 + 0.05 * hash(fi * 1.93 + 2.2)) * grow;
    vec2 c = 0.5 + uDir * (by - 0.5) + perp * (bx - 0.5);
    vec2 q = uv - c;
    q.x *= uRatio;
    d = smin(d, length(q) - br, 0.07);
  }
  float m = 1.0 - smoothstep(-0.003, 0.003, d);
  float edge = exp(-abs(d) * 28.0);
  vec2 off = uDir * edge * 0.03 + (vec2(noise(uv * 9.0 + uP * 4.0), noise(uv * 9.0 + 7.0 - uP * 4.0)) - 0.5) * edge * 0.03;
  vec3 A = texture2D(uA, clamp(uv + off, 0.0, 1.0)).rgb;
  vec3 B = texture2D(uB, clamp(uv - off * 0.6, 0.0, 1.0)).rgb;
  vec3 col = mix(A, B, m);
  col += exp(-abs(d) * 140.0) * 0.4 + edge * 0.05;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Composite a liquid transition from shot `a` to shot `b` at progress 0..1; null without WebGL. */
export function liquidWipe(a: HTMLCanvasElement, b: HTMLCanvasElement, progress: number, seed: number): HTMLCanvasElement | null {
  const r = glRenderer(a.width, a.height);
  if (!r) return null;
  const m = fullscreen(r, "liquid-wipe", LIQUID_WIPE, { uA: { value: null }, uB: { value: null }, uP: { value: 0 }, uRatio: { value: 1 }, uSeed: { value: 0 }, uDir: { value: [0, 1] } });
  if (!m) return null;
  const dirs: [number, number][] = [[0, 1], [1, 0], [0.7071, 0.7071], [-0.7071, 0.7071]];
  const u = m.program.uniforms as Record<string, { value: unknown }>;
  u.uA.value = liveTexture(r, "liquid-a", a);
  u.uB.value = liveTexture(r, "liquid-b", b);
  u.uP.value = Math.min(1, Math.max(0, progress));
  u.uRatio.value = a.width / a.height;
  u.uSeed.value = seed % 97;
  u.uDir.value = dirs[seed % dirs.length];
  r.render({ scene: m.mesh });
  return r.gl.canvas as HTMLCanvasElement;
}
