/**
 * Gallery skills: the site's own images, screenshots and captured UI components, animated with
 * open-source WebGL (see ../gl.ts):
 *
 * - gallery-flow  images in sequence in a rounded frame, joined by gl-transitions (crosswarp,
 *                 directional warps, window slices, grid flips…), each with a caption.
 * - carousel-3d   the images on a curved ring (OGL planes) that turns card by card, the front
 *                 card in the spotlight with its caption and a floor reflection.
 * - tilt-wall     a perspective wall of screenshots drifting past behind the headline, the hero
 *                 look of Linear- and Vercel-style launch pages.
 *
 * Without WebGL each falls back to a 2D version, so a film always renders.
 */
import { Camera, Mesh, Plane, Program, Transform, type Renderer } from "ogl";
import { exitT } from "../fx";
import { coverUv, GALLERY_TRANSITIONS, glRenderer, loadTransitions, renderTransition, sizeOf, textureOf, transitionsReady } from "../gl";
import { clamp, hashString, lerp, mixHex, range, rgba, rng } from "../math";
import { tokens } from "../grid";
import { getImage, getMedia, type Drawable } from "../media";
import { glassCard, pill, saasBackground, sentence, blurInLayout } from "../saasfx";
import { scratch } from "../scratch";
import { subFont } from "../text";
import { studioCard } from "./product";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { topHeadline } from "./saas";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const titleOf = (item: string) => item.split(/\s+[—–]\s+/)[0].trim();
type Img = Drawable | HTMLCanvasElement;

/* ───────── Sources ───────── */

/**
 * What the gallery shows: the scene's own media, the site's images and its captured UI
 * components (cards, panels, media blocks). Falls back to generated UI mock-ups in the brand
 * palette, so the skill also works for prompt-only films and the showcase.
 */
export function gallery(sc: SkillContext, want: number, aspect = 1.6): Img[] {
  const { scene, brand, t } = sc;
  const out: Img[] = [];
  const seen = new Set<string>();
  const add = (d: Img | null | undefined, key: string, ui = false) => {
    if (!d || seen.has(key)) return;
    const { w, h } = sizeOf(d);
    if (w < 160 || h < 100) return;
    seen.add(key);
    out.push(fitted(d, key, aspect, sc.palette, ui));
  };
  // Product films show their white-background photos cut out on a studio card.
  const photo = (src: string) => {
    const img = getImage(src);
    return img && sc.product && img.naturalWidth ? studioCard(img, src, aspect, sc.palette) : img;
  };
  if (scene.media) add(scene.media.kind === "image" ? photo(scene.media.src) : getMedia(scene.media, t), scene.media.src, !!brand?.parts?.some((p) => p.src === scene.media!.src));
  for (const src of brand?.images ?? []) add(photo(src), src);
  for (const p of (brand?.parts ?? []).filter((p) => p.kind !== "button" && p.w * p.h > 120 * 90).sort((a, b) => b.w * b.h - a.w * a.h)) add(getImage(p.src), p.src, true);
  for (let i = 0; out.length < Math.max(3, Math.min(want, 3)); i++) out.push(mockShot(sc.palette, sc.seed + i, i));
  return out.slice(0, Math.max(want, 3));
}

const fits = new Map<string, HTMLCanvasElement>();
/**
 * An image far from the frame's shape (a wide UI card, a tall panel) would lose its edges to a
 * cover crop, cutting its text. Those are shown whole instead, centred on their own surface
 * colour with a margin, like a product shot. Close-enough images and videos are left as they are
 * (UI components only when nearly exact: their text runs right to the edges).
 */
export function fitted(img: Img, key: string, aspect: number, p: Palette, ui: boolean): Img {
  if (img instanceof HTMLVideoElement) return img;
  const { w, h } = sizeOf(img);
  if (Math.abs(Math.log(w / h / aspect)) < Math.log(ui ? 1.04 : 1.2)) return img;
  const id = `${key}@${aspect.toFixed(2)}`;
  const hit = fits.get(id);
  if (hit) return hit;
  const ch = 720;
  const cw = Math.round(ch * aspect);
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d")!;
  // The surface: the image's own corner colour (the page behind the component), else the palette's.
  let bg = p.light ? "#f4f5f9" : mixHex(p.bg1, "#000000", 0.2);
  try {
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    const pg = probe.getContext("2d", { willReadFrequently: true })!;
    pg.drawImage(img, 2, 2, 1, 1, 0, 0, 1, 1);
    const [r, gg, b, a] = pg.getImageData(0, 0, 1, 1).data;
    if (a > 200) bg = `rgb(${r},${gg},${b})`;
  } catch {
    // A cross-origin image can't be read: keep the palette colour.
  }
  g.fillStyle = bg;
  g.fillRect(0, 0, cw, ch);
  const k = Math.min((cw * 0.88) / w, (ch * 0.84) / h);
  g.imageSmoothingQuality = "high";
  g.drawImage(img, (cw - w * k) / 2, (ch - h * k) / 2, w * k, h * k);
  fits.set(id, c);
  return c;
}

const mocks = new Map<string, HTMLCanvasElement>();
/** A generated product screenshot (dashboard, table, chart) in the brand palette. */
export function mockShot(p: Palette, seed: number, i: number): HTMLCanvasElement {
  const key = `${p.primary}${p.secondary}${p.bg0}${i % 6}`;
  const hit = mocks.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 960;
  c.height = 600;
  const g = c.getContext("2d")!;
  const r = rng(hashString(key) + seed * 0);
  const light = !!p.light;
  const bg = light ? "#ffffff" : mixHex(p.bg1, "#000000", 0.2);
  const panel = light ? "#f3f4f8" : mixHex(p.bg1, "#ffffff", 0.05);
  const ink = light ? "#1b1d29" : "#e9ebf5";
  g.fillStyle = bg;
  g.fillRect(0, 0, 960, 600);
  // Sidebar + top bar.
  g.fillStyle = panel;
  g.fillRect(0, 0, 190, 600);
  g.fillRect(190, 0, 770, 58);
  g.fillStyle = rgba(ink, 0.18);
  for (let k = 0; k < 7; k++) g.fillRect(26, 90 + k * 40, 110 + r() * 30, 11);
  g.fillStyle = p.primary;
  g.fillRect(26, 90 + (i % 7) * 40 - 8, 4, 27);
  g.fillStyle = rgba(ink, 0.35);
  g.fillRect(220, 22, 180, 14);
  const kind = i % 3;
  if (kind === 0) {
    // KPI tiles + bar chart.
    for (let k = 0; k < 3; k++) {
      g.fillStyle = panel;
      g.beginPath();
      g.roundRect(220 + k * 240, 88, 220, 110, 14);
      g.fill();
      g.fillStyle = rgba(ink, 0.3);
      g.fillRect(240 + k * 240, 110, 90, 10);
      g.fillStyle = k === 1 ? p.secondary : p.primary;
      g.fillRect(240 + k * 240, 140, 120 + r() * 50, 30);
    }
    g.fillStyle = panel;
    g.beginPath();
    g.roundRect(220, 222, 700, 340, 14);
    g.fill();
    for (let k = 0; k < 14; k++) {
      const bh = 60 + r() * 220;
      g.fillStyle = k % 4 === 3 ? p.secondary : p.primary;
      g.globalAlpha = 0.85;
      g.fillRect(250 + k * 47, 540 - bh, 28, bh);
    }
    g.globalAlpha = 1;
  } else if (kind === 1) {
    // Table.
    g.fillStyle = panel;
    g.beginPath();
    g.roundRect(220, 88, 700, 480, 14);
    g.fill();
    for (let k = 0; k < 9; k++) {
      const y = 120 + k * 50;
      g.fillStyle = rgba(ink, k === 0 ? 0.45 : 0.22);
      g.fillRect(250, y, 160, 11);
      g.fillRect(450, y, 110, 11);
      g.fillStyle = k % 3 === 0 ? p.secondary : p.primary;
      g.globalAlpha = 0.8;
      g.beginPath();
      g.roundRect(620, y - 6, 70 + r() * 40, 22, 11);
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = rgba(ink, 0.1);
      g.fillRect(250, y + 26, 650, 1);
    }
  } else {
    // Area chart + cards.
    g.fillStyle = panel;
    g.beginPath();
    g.roundRect(220, 88, 460, 470, 14);
    g.fill();
    const grd = g.createLinearGradient(0, 200, 0, 540);
    grd.addColorStop(0, rgba(p.primary, 0.55));
    grd.addColorStop(1, rgba(p.primary, 0));
    g.beginPath();
    g.moveTo(240, 540);
    for (let k = 0; k <= 12; k++) g.lineTo(240 + k * 35, 480 - k * 18 - r() * 60);
    g.lineTo(660, 540);
    g.fillStyle = grd;
    g.fill();
    for (let k = 0; k < 3; k++) {
      g.fillStyle = panel;
      g.beginPath();
      g.roundRect(700, 88 + k * 160, 220, 145, 14);
      g.fill();
      g.fillStyle = k === 0 ? p.secondary : p.primary;
      g.beginPath();
      g.arc(740, 128 + k * 160, 16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rgba(ink, 0.3);
      g.fillRect(770, 122 + k * 160, 110, 10);
    }
  }
  mocks.set(key, c);
  return c;
}

export function coverDraw(ctx: CanvasRenderingContext2D, img: Img, x: number, y: number, w: number, h: number, zoom = 1) {
  const s = sizeOf(img);
  if (!s.w || !s.h) return;
  const k = Math.max(w / s.w, h / s.h) * zoom;
  const dw = s.w * k;
  const dh = s.h * k;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * 0.2, dw, dh);
}

/* ───────── Gallery Flow (gl-transitions) ───────── */

function flowTiming(scene: Scene, d: number, n: number) {
  const intro = 0.45;
  const outro = 0.45;
  const slot = (d - intro - outro) / n;
  const trans = Math.min(0.85, slot * 0.45);
  return { intro, slot, trans, n };
}

function galleryFlow(sc: SkillContext) {
  const { ctx, w, h, t, d, u, scene, palette, seed } = sc;
  const portrait = h > w;
  saasBackground(sc, { beams: 0 });
  if (scene.text) topHeadline(sc);
  if (!transitionsReady()) void loadTransitions();
  const imgs = gallery(sc, 5, portrait ? 1 / 0.72 : 1.6);
  const n = Math.min(imgs.length, portrait ? 4 : 5);
  const T = flowTiming(scene, d, n);
  const ex = exitT(sc, 0.4);
  // The frame.
  // The frame plus its caption pill (52pt, 3 grid steps below) fit above the title-safe bottom.
  const g = tokens(w, h);
  const capGap = g.space(3);
  const capH = 52 * u;
  const top0 = h * (portrait ? 0.32 : 0.3);
  let fw = portrait ? w * 0.86 : Math.min(w * 0.66, (h * 0.62 * 16) / 10);
  let fh = fw * (portrait ? 0.72 : 10 / 16);
  const room = h - g.safe.bottom - capH - capGap - (scene.text ? top0 : (h - fh) / 2);
  if (fh > room) {
    fw *= room / fh;
    fh = room;
  }
  const fx = (w - fw) / 2;
  const fy = scene.text ? top0 : (h - fh) / 2;
  const intro = 1 - Math.pow(1 - clamp(range(t, 0.05, T.intro + 0.35)), 3);
  ctx.save();
  ctx.globalAlpha = intro * (1 - ex);
  ctx.translate(w / 2, fy + fh / 2);
  const s = 0.94 + 0.06 * intro;
  ctx.scale(s, s);
  ctx.translate(-w / 2, -(fy + fh / 2));
  glassCard(sc, fx - 10 * u, fy - 10 * u, fw + 20 * u, fh + 20 * u, { r: 24 * u });
  // Which image, and which transition, at this moment.
  const local = Math.max(0, t - T.intro);
  const i = Math.min(n - 1, Math.floor(local / T.slot));
  const inSlot = local - i * T.slot;
  const tp = i < n - 1 ? range(inSlot, T.slot - T.trans, T.slot) : 0;
  const eased = tp * tp * (3 - 2 * tp);
  const pool = GALLERY_TRANSITIONS.filter((g) => !g.dark || !palette.light);
  const pick = pool[(Math.abs(seed) + i * 7) % pool.length].name;
  const r = 18 * u;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(fx, fy, fw, fh, r);
  ctx.clip();
  const bg = palette.bg0.match(/[0-9a-f]{2}/gi)?.map((x) => parseInt(x, 16) / 255) ?? [0, 0, 0];
  const gl = tp > 0 ? renderTransition(pick, imgs[i], imgs[i + 1], eased, fw, fh, { bg: [bg[0], bg[1], bg[2], 1], align: "top" }) : null;
  if (gl) ctx.drawImage(gl, fx, fy, fw, fh);
  else {
    // Between transitions: a gentle push-in that returns to 1× by the next cut (so the
    // transition starts exactly where the hold ends).
    const holdK = clamp((inSlot - (i === 0 ? 0 : 0)) / Math.max(0.01, T.slot - (i < n - 1 ? T.trans : 0)));
    coverDraw(ctx, imgs[i], fx, fy, fw, fh, 1 + 0.035 * Math.sin(Math.PI * holdK));
    if (tp > 0) {
      ctx.globalAlpha = eased;
      coverDraw(ctx, imgs[i + 1], fx, fy, fw, fh);
    }
  }
  ctx.restore();
  // Caption under the frame.
  const items = scene.items ?? [];
  const cap = items.length ? titleOf(items[Math.min(i + (tp > 0.5 ? 1 : 0), items.length - 1)] ?? "") : "";
  if (cap) {
    const ck = clamp(range(inSlot, 0, 0.35)) * (tp > 0 ? Math.abs(tp - 0.5) * 2 : 1);
    ctx.globalAlpha *= ck;
    pill(sc, cap, w / 2, fy + fh + capGap + capH / 2, { size: 26 * u, fill: rgba(palette.primary, 0.14), border: rgba(palette.primary, 0.45), color: palette.text });
  }
  ctx.restore();
  // Progress dots.
  ctx.save();
  ctx.globalAlpha = intro * (1 - ex) * 0.9;
  for (let k = 0; k < n; k++) {
    const dx = w / 2 + (k - (n - 1) / 2) * 22 * u;
    ctx.beginPath();
    ctx.roundRect(dx - (k === i ? 12 : 4) * u, fy + fh + (cap ? 88 : 40) * u, (k === i ? 24 : 8) * u, 8 * u, 4 * u);
    ctx.fillStyle = k === i ? palette.primary : rgba(palette.text, 0.25);
    ctx.fill();
  }
  ctx.restore();
}

/* ───────── Shared 3D card program (OGL) ───────── */

const CARD_VERT = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const CARD_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tMap;
uniform vec4 uUv;
uniform vec2 uSize;
uniform float uRadius;
uniform float uShade;
uniform float uAlpha;
uniform vec3 uEdge;
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = sdRound(p, uSize * 0.5, uRadius);
  float aa = uSize.x * 0.004;
  float mask = 1.0 - smoothstep(-aa, aa, d);
  vec3 c = texture2D(tMap, vUv * uUv.xy + uUv.zw).rgb * uShade;
  float edge = 1.0 - smoothstep(0.0, aa * 3.0, abs(d + aa * 2.0));
  c = mix(c, uEdge, edge * 0.45);
  float a = mask * uAlpha;
  gl_FragColor = vec4(c * a, a);
}`;

type Card = { mesh: Mesh; program: Program };
type Stage3D = { key: string; scene: Transform; camera: Camera; cards: Card[] };
const stages = new Map<string, Stage3D>();

function stage3D(r: Renderer, name: string, count: number, cardW: number, cardH: number, aspect: number): Stage3D {
  const key = `${name}:${count}:${cardW.toFixed(3)}:${cardH.toFixed(3)}`;
  let st = stages.get(name);
  if (!st || st.key !== key) {
    const gl = r.gl;
    const scene = new Transform();
    const camera = new Camera(gl, { fov: 30, near: 0.1, far: 100, aspect });
    const geometry = new Plane(gl, { width: cardW, height: cardH });
    const cards: Card[] = [];
    for (let i = 0; i < count; i++) {
      const program = new Program(gl, {
        vertex: CARD_VERT,
        fragment: CARD_FRAG,
        transparent: true,
        cullFace: false,
        uniforms: { tMap: { value: null }, uUv: { value: [1, 1, 0, 0] }, uSize: { value: [cardW, cardH] }, uRadius: { value: Math.min(cardW, cardH) * 0.06 }, uShade: { value: 1 }, uAlpha: { value: 1 }, uEdge: { value: [1, 1, 1] } },
      });
      const mesh = new Mesh(gl, { geometry, program });
      mesh.setParent(scene);
      cards.push({ mesh, program });
    }
    st = { key, scene, camera, cards };
    stages.set(name, st);
  }
  st.camera.perspective({ aspect });
  return st;
}

const hex3 = (hex: string) => (hex.match(/[0-9a-f]{2}/gi) ?? ["ff", "ff", "ff"]).slice(0, 3).map((x) => parseInt(x, 16) / 255);

/* ───────── 3D Carousel (OGL) ───────── */

function carouselTiming(d: number, n: number) {
  const first = 0.9;
  const step = Math.max(0.7, (d - first - 0.8) / Math.max(1, n - 1));
  return { first, step, turn: Math.min(0.65, step * 0.6) };
}

function carousel3D(sc: SkillContext) {
  const { ctx, w, h, t, d, u, scene, palette } = sc;
  const portrait = h > w;
  saasBackground(sc, { beams: 0 });
  if (scene.text) topHeadline(sc);
  const imgs = gallery(sc, 6);
  const n = Math.max(6, imgs.length);
  const shown = Math.min(imgs.length, 5);
  const T = carouselTiming(d, shown);
  const ex = exitT(sc, 0.4);
  const intro = 1 - Math.pow(1 - clamp(range(t, 0.05, 0.9)), 3);
  // Which card faces front: steps with an eased turn between them.
  let pos = 0;
  for (let k = 1; k < shown; k++) {
    const k0 = T.first + (k - 1) * T.step + (T.step - T.turn);
    const e = clamp(range(t, k0, k0 + T.turn));
    pos += e * e * (3 - 2 * e);
  }
  const front = Math.round(pos);
  // The 3D region: below the headline.
  const top = scene.text ? h * (portrait ? 0.26 : 0.24) : 0;
  const gw = w;
  const gh = h - top;
  const r = glRenderer(gw, gh);
  const cardW = 1.6;
  const cardH = 1.0;
  const st = r ? stage3D(r, "carousel", n, cardW, cardH, gw / gh) : null;
  if (r && st) {
    // A tight ring, camera close: the front card fills about half the stage, its neighbours in view.
    const R = 2.2;
    const stepA = (Math.PI * 2) / n;
    const camZ = R + (portrait ? 4.3 : 1.55) + (1 - intro) * 0.8;
    st.camera.position.set(0, 0.38, camZ);
    // Half the visible width at a given depth (vertical fov 30°): cards whose edge would pass the
    // frame's side fade out, so a turning card never shows cut off.
    const halfW = (z: number) => Math.tan((15 * Math.PI) / 180) * (camZ - z) * (gw / gh);
    st.camera.lookAt([0, 0.02, 0]);
    const edge = hex3(palette.primary);
    st.cards.forEach((c, i) => {
      const img = imgs[i % imgs.length];
      const a = (i - pos) * stepA;
      c.mesh.position.set(Math.sin(a) * R, 0, Math.cos(a) * R - R);
      c.mesh.rotation.y = a;
      c.mesh.scale.set(1, 1, 1);
      const facing = Math.cos(a);
      const u2 = c.program.uniforms as Record<string, { value: unknown }>;
      u2.tMap.value = textureOf(r, img);
      u2.uUv.value = coverUv(img, cardW / cardH, "top");
      u2.uShade.value = 0.35 + 0.65 * Math.max(0, facing) ** 1.5;
      const x = Math.sin(a) * R;
      const z = Math.cos(a) * R - R;
      const outer = Math.abs(x) + (cardW / 2) * Math.abs(Math.cos(a));
      const inFrame = 1 - clamp((outer - halfW(z) * 0.86) / (halfW(z) * 0.12));
      u2.uAlpha.value = clamp((facing + 0.35) / 0.5) * intro * inFrame;
      u2.uEdge.value = Math.round(pos) % n === i % n ? edge : [1, 1, 1];
    });
    r.render({ scene: st.scene, camera: st.camera });
    const src = r.gl.canvas as HTMLCanvasElement;
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    // Floor reflection first, fading out.
    const refl = scratch("carousel-refl", Math.ceil(gw), Math.ceil(gh));
    refl.ctx.save();
    refl.ctx.translate(0, gh);
    refl.ctx.scale(1, -1);
    refl.ctx.drawImage(src, 0, -gh * 0.62, gw, gh);
    refl.ctx.restore();
    refl.ctx.globalCompositeOperation = "destination-in";
    const fade = refl.ctx.createLinearGradient(0, gh * 0.62, 0, gh);
    fade.addColorStop(0, "rgba(0,0,0,0.28)");
    fade.addColorStop(0.35, "rgba(0,0,0,0)");
    refl.ctx.fillStyle = fade;
    refl.ctx.fillRect(0, 0, gw, gh);
    refl.ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(refl.canvas, 0, top);
    ctx.drawImage(src, 0, top, gw, gh);
    ctx.restore();
  } else {
    // 2D fallback: the front card, flanked by its neighbours.
    const cw = w * (portrait ? 0.7 : 0.46);
    const ch = cw * 0.62;
    const cy = top + gh * 0.42;
    for (const off of [-1, 1, 0]) {
      const img = imgs[(front + off + imgs.length) % imgs.length];
      const k = off === 0 ? 1 : 0.72;
      ctx.save();
      ctx.globalAlpha = (off === 0 ? 1 : 0.5) * intro * (1 - ex);
      ctx.beginPath();
      ctx.roundRect(w / 2 + off * cw * 0.72 - (cw * k) / 2, cy - (ch * k) / 2, cw * k, ch * k, 18 * u);
      ctx.clip();
      coverDraw(ctx, img, w / 2 + off * cw * 0.72 - (cw * k) / 2, cy - (ch * k) / 2, cw * k, ch * k);
      ctx.restore();
    }
  }
  // Caption for the card in front.
  const items = scene.items ?? [];
  const cap = items.length ? titleOf(items[front % items.length] ?? "") : "";
  if (cap) {
    const settle = 1 - Math.abs(pos - front) * 2;
    ctx.save();
    ctx.globalAlpha = clamp(settle) * intro * (1 - ex);
    pill(sc, cap, w / 2, top + gh * (portrait ? 0.76 : 0.84), { size: 26 * u, fill: rgba(palette.primary, 0.14), border: rgba(palette.primary, 0.45), color: palette.text });
    ctx.restore();
  }
}

/* ───────── Tilted Wall (OGL) ───────── */

function tiltWall(sc: SkillContext) {
  const { ctx, w, h, t, d, u, scene, palette } = sc;
  const portrait = h > w;
  saasBackground(sc, { beams: 0, aurora: 0.3 });
  const imgs = gallery(sc, 8);
  const cols = portrait ? 4 : 6;
  const rows = portrait ? 7 : 5;
  const ex = exitT(sc, 0.4);
  const intro = 1 - Math.pow(1 - clamp(range(t, 0.0, 1.1)), 3);
  const cardW = 1.6;
  const cardH = 1.0;
  const gap = 0.14;
  const r = glRenderer(w, h);
  const st = r ? stage3D(r, "wall", cols * rows, cardW, cardH, w / h) : null;
  if (r && st) {
    // The wall: tilted back and turned, drifting diagonally; rows scroll at slightly different speeds.
    st.scene.rotation.set(-0.95, 0, portrait ? 0.5 : 0.62);
    st.scene.position.set(0, portrait ? -0.3 : -0.1, 0);
    st.camera.position.set(0, 0, (portrait ? 11.5 : 8.2) - intro * 0.8);
    st.camera.lookAt([0, 0, 0]);
    const drift = t * 0.35;
    const spanY = rows * (cardH + gap);
    st.cards.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const img = imgs[(i * 5 + row) % imgs.length];
      let y = (row - (rows - 1) / 2) * (cardH + gap) + drift * (1 + (col % 2) * 0.25);
      y = ((((y + spanY / 2) % spanY) + spanY) % spanY) - spanY / 2;
      c.mesh.position.set((col - (cols - 1) / 2) * (cardW + gap), y, 0);
      c.mesh.rotation.set(0, 0, 0);
      const u2 = c.program.uniforms as Record<string, { value: unknown }>;
      u2.tMap.value = textureOf(r, img);
      u2.uUv.value = coverUv(img, cardW / cardH, "top");
      // Cards near the wall's ends fade, so the loop never shows a seam.
      const endFade = clamp((spanY / 2 - Math.abs(y)) / (cardH * 1.2));
      u2.uShade.value = 0.78;
      u2.uAlpha.value = endFade * clamp(intro * 1.4 - (col + row) * 0.04);
      u2.uEdge.value = [1, 1, 1];
    });
    r.render({ scene: st.scene, camera: st.camera });
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    ctx.drawImage(r.gl.canvas as HTMLCanvasElement, 0, 0, w, h);
    ctx.restore();
  } else {
    // 2D fallback: a straight grid drifting upwards.
    const cw = w / 4.4;
    const ch = cw * 0.62;
    ctx.save();
    ctx.globalAlpha = 0.8 * intro * (1 - ex);
    for (let row = -1; row < 6; row++) {
      for (let col = 0; col < 5; col++) {
        const x = col * (cw + 16 * u) - cw * 0.3;
        const y = row * (ch + 16 * u) - ((t * 40 * u) % (ch + 16 * u));
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, cw, ch, 12 * u);
        ctx.clip();
        coverDraw(ctx, imgs[(row * 5 + col + 100) % imgs.length], x, y, cw, ch);
        ctx.restore();
      }
    }
    ctx.restore();
  }
  // Vignette into the stage, then the headline on a soft scrim.
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, rgba(palette.bg0, 0));
  vg.addColorStop(1, rgba(palette.bg0, 0.92));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  if (scene.text) {
    const scrim = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.55);
    scrim.addColorStop(0, rgba(palette.bg0, 0.78));
    scrim.addColorStop(1, rgba(palette.bg0, 0));
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);
    const layout = sentence(sc, { cy: h / 2, sizeFrac: portrait ? 0.1 : 0.095, widthFrac: 0.8, maxLines: 2 });
    blurInLayout(sc, layout, 0.45, 0.07, { exitAt: d - 0.4 });
    if (scene.subtext) {
      ctx.save();
      ctx.globalAlpha = range(t, 1.0, 1.5) * (1 - ex);
      ctx.font = subFont((portrait ? 32 : 28) * u, 500);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = mixHex(palette.text, palette.bg1, 0.2);
      ctx.fillText(scene.subtext, w / 2, layout.ys[layout.ys.length - 1] + layout.size * 0.62 + 40 * u);
      ctx.restore();
    }
  }
}

export const gallerySkills: Skill[] = [
  {
    id: "gallery-flow",
    name: "Gallery Flow",
    tagline: "The product's images in a rounded frame, joined by GPU transitions (warps, zooms, window slices, grid flips) with captions.",
    bestFor: "Showing 3–5 real product images, screenshots or UI components in sequence. Headline = what they show; items = one caption per image.",
    sample: { text: "See it *in action*", items: ["Dashboards", "Reports", "Automations", "Team spaces"] },
    itemsHint: "One caption per image",
    render: galleryFlow,
    sfx: (scene) => {
      const T = flowTiming(scene, scene.duration, 4);
      return Array.from({ length: 3 }, (_, k) => at(T.intro + (k + 1) * T.slot - T.trans * 0.6, "whoosh"));
    },
  },
  {
    id: "carousel-3d",
    name: "3D Carousel",
    tagline: "The images on a curved 3D ring that turns card by card, the front card spotlit with its caption and a floor reflection.",
    bestFor: "A premium product gallery: 4–6 screenshots, templates or examples. Headline = the range ('Templates for *every team*'); items = captions.",
    sample: { text: "Templates for *your team*", items: ["Roadmap", "Sprint board", "Launch plan", "Weekly report", "OKRs"] },
    itemsHint: "One caption per card",
    render: carousel3D,
    sfx: (scene) => {
      const T = carouselTiming(scene.duration, 5);
      return Array.from({ length: 4 }, (_, k) => at(T.first + k * T.step + (T.step - T.turn), "swoosh"));
    },
  },
  {
    id: "tilt-wall",
    name: "Tilted Wall",
    tagline: "A perspective wall of the product's screenshots drifts past behind the headline: the Linear / Vercel hero look.",
    bestFor: "A big statement over the whole product: the hook, the reveal line or the closing promise. Headline = 3–7 words; uses the site's images and captured UI.",
    sample: { text: "Your team's work, *in one place*", subtext: "Plan, build and launch together" },
    render: tiltWall,
    sfx: () => [at(0.3, "shimmer")],
  },
];
