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

/** The shared renderer, sized to `w`×`h` (null when WebGL isn't available). */
export function glRenderer(w: number, h: number): Renderer | null {
  if (renderer === undefined) {
    try {
      renderer = typeof document === "undefined" ? null : new Renderer({ width: w, height: h, dpr: 1, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true });
      if (renderer && !renderer.gl) renderer = null;
    } catch {
      renderer = null;
    }
  }
  if (!renderer) return null;
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
