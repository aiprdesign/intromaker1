/**
 * GPU shader backgrounds: premium animated gradients (mesh gradient, grain gradient, marbled
 * warp, smoke, neuro glow, light rays) from the open-source Paper Shaders library
 * (https://github.com/paper-design/shaders, Apache-2.0), rendered frame-exactly.
 *
 * Paper's ShaderMount drives shaders from requestAnimationFrame; video export needs the exact
 * frame at time t, so this module runs the same fragment shaders through a tiny WebGL2 runner
 * (one shared context) and returns a canvas the 2D pipeline composites like any image.
 */
import {
  getShaderColorFromString,
  getShaderNoiseTexture,
  godRaysFragmentShader,
  grainGradientFragmentShader,
  GrainGradientShapes,
  meshGradientFragmentShader,
  neuroNoiseFragmentShader,
  smokeRingFragmentShader,
  warpFragmentShader,
  WarpPatterns,
} from "@paper-design/shaders";
import { mixHex } from "./math";
import type { Palette } from "./types";

export type ShaderBg = "mesh" | "grain" | "warp" | "smoke" | "neuro" | "rays";
export const SHADER_BGS: ShaderBg[] = ["mesh", "grain", "warp", "smoke", "neuro", "rays"];

/** Paper Shaders' shared vertex shader (Apache-2.0, Paper Design); not exported by the package. */
const VERTEX = `#version 300 es
precision mediump float;

layout(location = 0) in vec4 a_position;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_imageAspectRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

out vec2 v_objectUV;
out vec2 v_objectBoxSize;
out vec2 v_responsiveUV;
out vec2 v_responsiveBoxGivenSize;
out vec2 v_patternUV;
out vec2 v_patternBoxSize;
out vec2 v_imageUV;

vec3 getBoxSize(float boxRatio, vec2 givenBoxSize) {
  vec2 box = vec2(0.);
  // fit = none
  box.x = boxRatio * min(givenBoxSize.x / boxRatio, givenBoxSize.y);
  float noFitBoxWidth = box.x;
  if (u_fit == 1.) { // fit = contain
    box.x = boxRatio * min(u_resolution.x / boxRatio, u_resolution.y);
  } else if (u_fit == 2.) { // fit = cover
    box.x = boxRatio * max(u_resolution.x / boxRatio, u_resolution.y);
  }
  box.y = box.x / boxRatio;
  return vec3(box, noFitBoxWidth);
}

void main() {
  gl_Position = a_position;

  vec2 uv = gl_Position.xy * .5;
  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * 3.14159265358979323846 / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);


  // ===================================================

  float fixedRatio = 1.;
  vec2 fixedRatioBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );

  v_objectBoxSize = getBoxSize(fixedRatio, fixedRatioBoxGivenSize).xy;
  vec2 objectWorldScale = u_resolution.xy / v_objectBoxSize;

  v_objectUV = uv;
  v_objectUV *= objectWorldScale;
  v_objectUV += boxOrigin * (objectWorldScale - 1.);
  v_objectUV += graphicOffset;
  v_objectUV /= u_scale;
  v_objectUV = graphicRotation * v_objectUV;

  // ===================================================

  v_responsiveBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  float responsiveRatio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
  vec2 responsiveBoxSize = getBoxSize(responsiveRatio, v_responsiveBoxGivenSize).xy;
  vec2 responsiveBoxScale = u_resolution.xy / responsiveBoxSize;

  #ifdef ADD_HELPERS
  v_responsiveHelperBox = uv;
  v_responsiveHelperBox *= responsiveBoxScale;
  v_responsiveHelperBox += boxOrigin * (responsiveBoxScale - 1.);
  #endif

  v_responsiveUV = uv;
  v_responsiveUV *= responsiveBoxScale;
  v_responsiveUV += boxOrigin * (responsiveBoxScale - 1.);
  v_responsiveUV += graphicOffset;
  v_responsiveUV /= u_scale;
  v_responsiveUV.x *= responsiveRatio;
  v_responsiveUV = graphicRotation * v_responsiveUV;
  v_responsiveUV.x /= responsiveRatio;

  // ===================================================

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 patternBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  patternBoxRatio = patternBoxGivenSize.x / patternBoxGivenSize.y;

  vec3 boxSizeData = getBoxSize(patternBoxRatio, patternBoxGivenSize);
  v_patternBoxSize = boxSizeData.xy;
  float patternBoxNoFitBoxWidth = boxSizeData.z;
  vec2 patternBoxScale = u_resolution.xy / v_patternBoxSize;

  v_patternUV = uv;
  v_patternUV += graphicOffset / patternBoxScale;
  v_patternUV += boxOrigin;
  v_patternUV -= boxOrigin / patternBoxScale;
  v_patternUV *= u_resolution.xy;
  v_patternUV /= u_pixelRatio;
  if (u_fit > 0.) {
    v_patternUV *= (patternBoxNoFitBoxWidth / v_patternBoxSize.x);
  }
  v_patternUV /= u_scale;
  v_patternUV = graphicRotation * v_patternUV;
  v_patternUV += boxOrigin / patternBoxScale;
  v_patternUV -= boxOrigin;
  // x100 is a default multiplier between vertex and fragmant shaders
  // we use it to avoid UV presision issues
  v_patternUV *= .01;

  // ===================================================

  vec2 imageBoxSize;
  if (u_fit == 1.) { // contain
    imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else if (u_fit == 2.) { // cover
    imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else {
    imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
  }
  imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
  vec2 imageBoxScale = u_resolution.xy / imageBoxSize;

  v_imageUV = uv;
  v_imageUV *= imageBoxScale;
  v_imageUV += boxOrigin * (imageBoxScale - 1.);
  v_imageUV += graphicOffset;
  v_imageUV /= u_scale;
  v_imageUV.x *= u_imageAspectRatio;
  v_imageUV = graphicRotation * v_imageUV;
  v_imageUV.x /= u_imageAspectRatio;

  v_imageUV += .5;
  v_imageUV.y = 1. - v_imageUV.y;
}`;

const FRAGMENTS: Record<ShaderBg, string> = {
  mesh: meshGradientFragmentShader,
  grain: grainGradientFragmentShader,
  warp: warpFragmentShader,
  smoke: smokeRingFragmentShader,
  neuro: neuroNoiseFragmentShader,
  rays: godRaysFragmentShader,
};
const NEEDS_NOISE: Record<ShaderBg, boolean> = { mesh: false, grain: true, warp: true, smoke: true, neuro: false, rays: true };

type Uniform = number | number[] | number[][];

let gl: WebGL2RenderingContext | null = null;
let glCanvas: HTMLCanvasElement | null = null;
let failed = false;
const programs = new Map<ShaderBg, { program: WebGLProgram; locs: Map<string, WebGLUniformLocation | null> }>();
let noiseImg: HTMLImageElement | null = null;
let noiseTex: WebGLTexture | null = null;
let noiseReady: Promise<void> | null = null;

/** Load the shared noise texture (call before exporting so the first frames are complete). */
export function ensureShaderAssets() {
  if (typeof window === "undefined") return Promise.resolve();
  noiseReady ??= new Promise<void>((resolve) => {
    const img = getShaderNoiseTexture();
    if (!img) return resolve();
    const done = () => {
      noiseImg = img;
      resolve();
    };
    if (img.complete && img.naturalWidth) done();
    else {
      img.onload = done;
      img.onerror = () => resolve();
    }
  });
  return noiseReady;
}

function context() {
  if (gl || failed || typeof document === "undefined") return gl;
  glCanvas = document.createElement("canvas");
  gl = glCanvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
  if (!gl) {
    failed = true;
    return null;
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return gl;
}

function compile(g: WebGL2RenderingContext, type: number, src: string) {
  const s = g.createShader(type)!;
  g.shaderSource(s, src);
  g.compileShader(s);
  if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
    console.warn("[shaderbg] compile failed:", g.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function program(kind: ShaderBg) {
  const g = context();
  if (!g) return null;
  const hit = programs.get(kind);
  if (hit) return hit;
  const vs = compile(g, g.VERTEX_SHADER, VERTEX);
  const fs = compile(g, g.FRAGMENT_SHADER, FRAGMENTS[kind]);
  if (!vs || !fs) return null;
  const p = g.createProgram()!;
  g.attachShader(p, vs);
  g.attachShader(p, fs);
  g.bindAttribLocation(p, 0, "a_position");
  g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) {
    console.warn("[shaderbg] link failed:", g.getProgramInfoLog(p));
    return null;
  }
  const entry = { program: p, locs: new Map<string, WebGLUniformLocation | null>() };
  programs.set(kind, entry);
  return entry;
}

function setUniform(g: WebGL2RenderingContext, entry: NonNullable<ReturnType<typeof program>>, name: string, v: Uniform) {
  if (!entry.locs.has(name)) entry.locs.set(name, g.getUniformLocation(entry.program, name));
  const loc = entry.locs.get(name);
  if (!loc) return;
  if (typeof v === "number") g.uniform1f(loc, v);
  else if (Array.isArray(v[0])) g.uniform4fv(loc, (v as number[][]).flat());
  else if ((v as number[]).length === 4) g.uniform4fv(loc, v as number[]);
  else if ((v as number[]).length === 2) g.uniform2fv(loc, v as number[]);
}

const rgba = (hex: string, a = 1) => {
  const c = getShaderColorFromString(hex) as number[];
  return [c[0], c[1], c[2], a];
};

/** Colour sets tuned so text stays legible: deep on dark stages, airy on light ones. */
function colours(kind: ShaderBg, p: Palette) {
  const light = !!p.light;
  const tone = (c: string, amt: number) => mixHex(p.bg0, c, amt);
  if (p.support) {
    // 60-30-10: colour spots in proportion: 6 dominant tones, 3 supporting, 1 accent.
    const D = [p.bg0, tone(p.support, 0.25), p.bg0, tone(p.support, 0.12), p.bg0, tone(p.support, 0.35)];
    const S = [p.support, tone(p.support, 0.7), mixHex(p.support, p.text, light ? 0.06 : 0.1)];
    const A = [tone(p.primary, light ? 0.55 : 0.8)];
    if (kind === "mesh" || kind === "warp") return [...D.slice(0, 3), S[0], D[3], S[1], D[4], A[0], D[5], S[2]];
    // Ring / ray / grain shapes paint on a dominant back colour: supporting colour + a touch of accent.
    return [S[0], S[1], A[0]];
  }
  const k = light ? 0.42 : 0.62;
  const set = [tone(p.primary, k), tone(p.secondary, k * 0.9), tone(p.accent, k * 0.75), light ? p.bg1 : tone(p.bg1, 0.9)];
  if (kind === "mesh") return [p.bg0, ...set];
  return set;
}

/** Per-shader look, from calm to dramatic. */
function uniformsFor(kind: ShaderBg, p: Palette, seed: number): Record<string, Uniform> {
  const cols = colours(kind, p).map((c) => rgba(c));
  const back = rgba(p.bg0);
  const base = { u_fit: 2, u_scale: 1, u_rotation: 0, u_offsetX: 0, u_offsetY: 0, u_originX: 0.5, u_originY: 0.5, u_worldWidth: 0, u_worldHeight: 0 };
  switch (kind) {
    case "mesh":
      return { ...base, u_fit: 0, u_scale: 0.7, u_colors: cols, u_colorsCount: cols.length, u_distortion: 0.8, u_swirl: 0.15, u_grainMixer: 0, u_grainOverlay: 0 };
    case "grain":
      return {
        ...base,
        u_colorBack: back,
        u_colors: cols.slice(0, 3),
        u_colorsCount: 3,
        u_softness: 0.85,
        u_intensity: 0.22,
        u_noise: 0.28,
        u_shape: [GrainGradientShapes.corners, GrainGradientShapes.wave, GrainGradientShapes.blob][seed % 3],
      };
    case "warp":
      return {
        ...base,
        u_fit: 0,
        u_scale: 1.2,
        u_colors: p.support ? cols : [rgba(p.bg0), ...cols.slice(0, 3)],
        u_colorsCount: p.support ? cols.length : 4,
        u_proportion: 0.42,
        u_softness: 1,
        u_shape: WarpPatterns.edge,
        u_shapeScale: 0.15,
        u_distortion: 0.3,
        u_swirl: 0.75,
        u_swirlIterations: 8,
      };
    case "smoke":
      return {
        ...base,
        u_scale: 1.25,
        u_colorBack: back,
        u_colors: cols.slice(0, 3),
        u_colorsCount: 3,
        u_noiseScale: 3,
        u_thickness: 0.65,
        u_radius: 0.32,
        u_innerShape: 0.7,
        u_noiseIterations: 8,
      };
    case "neuro":
      return {
        ...base,
        u_fit: 0,
        u_scale: 1.4,
        u_colorFront: rgba(mixHex(p.bg0, p.primary, p.support ? 0.48 : 0.8)),
        u_colorMid: rgba(p.support ?? mixHex(p.bg0, p.secondary, 0.45)),
        u_colorBack: back,
        u_brightness: 0.05,
        u_contrast: 0.3,
      };
    case "rays":
      return {
        ...base,
        u_offsetY: -0.55,
        u_colorBack: back,
        u_colorBloom: rgba(p.support ? mixHex(p.bg0, p.support, 0.8) : mixHex(p.bg0, p.primary, 0.5)),
        u_colors: cols.slice(0, 3),
        u_colorsCount: 3,
        u_spotty: 0.3,
        u_midSize: 0.2,
        u_midIntensity: 0.4,
        u_density: 0.3,
        u_intensity: 0.8,
        u_bloom: 0.4,
      };
  }
}

/**
 * Render a shader background for time t at (about) half resolution; the 2D canvas upscales it
 * smoothly. Returns null if WebGL2 is unavailable (callers fall back to 2D gradients).
 */
export function renderShaderBg(kind: ShaderBg, palette: Palette, w: number, h: number, t: number, seed = 0, speed = 1) {
  const entry = program(kind);
  const g = gl;
  if (!entry || !g || !glCanvas) return null;
  if (NEEDS_NOISE[kind] && !noiseImg) {
    void ensureShaderAssets();
    return null;
  }
  // Smooth fields upscale invisibly; grainy / fine-line shaders keep more resolution.
  const scale = Math.min(1, (kind === "grain" || kind === "neuro" ? 900 : 640) / Math.max(w, h));
  const rw = Math.max(2, Math.round(w * scale));
  const rh = Math.max(2, Math.round(h * scale));
  if (glCanvas.width !== rw || glCanvas.height !== rh) {
    glCanvas.width = rw;
    glCanvas.height = rh;
  }
  g.viewport(0, 0, rw, rh);
  g.useProgram(entry.program);
  if (NEEDS_NOISE[kind] && noiseImg) {
    if (!noiseTex) {
      noiseTex = g.createTexture();
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, noiseTex);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, noiseImg);
    }
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, noiseTex);
    const loc = g.getUniformLocation(entry.program, "u_noiseTexture");
    if (loc) g.uniform1i(loc, 0);
  }
  // Pattern size is tied to the frame (not device pixels) so preview and export match.
  const pixelRatio = Math.min(rw, rh) / 720;
  const all: Record<string, Uniform> = {
    ...uniformsFor(kind, palette, seed),
    u_time: t * speed + (seed % 97) * 3.1,
    u_resolution: [rw, rh],
    u_pixelRatio: pixelRatio,
    u_imageAspectRatio: 1,
  };
  for (const [name, v] of Object.entries(all)) setUniform(g, entry, name, v);
  g.drawArrays(g.TRIANGLES, 0, 6);
  return glCanvas;
}
