/**
 * Real 3D device slides (see d3.ts): modelled devices with thickness, rounded aluminium edges, glass
 * and a working hinge, lit by a soft studio sun with real shadows, filmed by a moving camera. Your
 * website or app (the slide's picture, the site's screenshot, or a stand-in) glows on the screens
 * and scrolls.
 *
 * - d3-laptop:  the lid opens as the camera swings round to the front; the screen wakes and scrolls.
 * - d3-phone:   a phone turns from its back (camera lenses, side buttons) to its screen, floating.
 * - d3-lineup:  a laptop, a tablet and a phone stand together; the camera glides across them.
 * - d3-dive:    the camera flies from a wide shot straight into the laptop's screen, landing on the page.
 * - d3-desk:    a desk scene from above: the laptop, a phone, a mug in your colour, a notebook, a plant.
 */
import { Torus, type Program, type Transform } from "ogl";
import { cove, quad, render, rgb, setScreen, slab, cylinder, sphere, box, world, type View, type World } from "../d3";
import { desktopUI, mobileUI } from "../uiscreens";
import { getMedia, type Drawable } from "../media";
import { textureOf, sizeOf } from "../gl";
import { clamp, ease, lerp, mixHex, range } from "../math";
import { saasBackground } from "../saasfx";
import { scratch } from "../scratch";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { exitOf, stage } from "./beats";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
type Num3 = [number, number, number];

const picOf = (sc: SkillContext, src?: string) => (src ? getMedia({ src, kind: "image" }, sc.t) : undefined);

/**
 * What a screen shows, picked automatically: the slide's own picture when it suits the screen, else
 * the website itself (the full page on laptops and tablets, scrolling; the site as a phone shows it
 * on phones), else a designed app screen in the video's colours with the brand's name.
 */
function shotOf(sc: SkillContext, mobile = false): Drawable | HTMLCanvasElement {
  const { scene, brand } = sc;
  const own = scene.media ? getMedia(scene.media, sc.t) : undefined;
  if (own) {
    const { w, h } = sizeOf(own);
    // A phone takes a portrait picture; a wide one goes on the laptop and the phone shows the mobile site.
    if (!mobile || h > w * 1.15) return own;
  }
  const site = mobile ? (picOf(sc, brand?.mobile) ?? picOf(sc, brand?.page?.src) ?? picOf(sc, brand?.shot)) : (picOf(sc, brand?.page?.src) ?? picOf(sc, brand?.shot));
  if (site) return site;
  if (own) return own;
  const name = (brand?.name ?? "").replace(/[*|]/g, "").trim();
  return mobile ? mobileUI(sc.palette, name, sc.seed) : desktopUI(sc.palette, name, sc.seed);
}

/* ───────────────────────── Models ───────────────────────── */

const LAP = { w: 3.2, d: 2.2, t: 0.1, lidH: 2.1, lidT: 0.06, scrW: 2.96, scrH: 1.85 };
const PHONE = { w: 0.78, h: 1.62, t: 0.085, scrW: 0.72, scrH: 1.56 };
const TAB = { w: 1.9, h: 2.6, t: 0.07, scrW: 1.78, scrH: 2.48 };

interface Laptop {
  root: Transform;
  hinge: Transform;
  screen: Program;
  metal: Program[];
}
interface Slate {
  root: Transform;
  screen: Program;
  metal: Program[];
  back?: Program;
}

function group(W: World, parent: Transform = W.scene) {
  const g = new (W.scene.constructor as new () => Transform)();
  g.setParent(parent);
  return g;
}

function laptop(W: World, parent?: Transform): Laptop {
  const { gl } = W;
  const root = group(W, parent);
  const metal = W.mat({ color: "#d6d9df", metal: 0.85, gloss: 0.62 });
  const deck = W.mat({ color: "#d6d9df", metal: 0.8, gloss: 0.5, kind: "keyboard" });
  const glass = W.mat({ color: "#08090c", metal: 0.1, gloss: 0.95 });
  // The base, lying flat: its front face (the keyboard deck) turned to face up.
  const base = group(W, root);
  base.rotation.x = -Math.PI / 2;
  base.position.y = LAP.t / 2;
  const b = slab(gl, LAP.w, LAP.d, LAP.t, 0.16, 0.035);
  W.mesh(b.front, deck, base);
  W.mesh(b.body, metal, base);
  W.mesh(b.back, metal, base);
  // The hinge at the back edge, and the lid on it.
  const hingeBar = W.mesh(cylinder(gl, 0.05, 0.05, LAP.w * 0.8, 24), W.mat({ color: "#2b2d33", metal: 0.6, gloss: 0.5 }), root);
  hingeBar.rotation.z = Math.PI / 2;
  hingeBar.position.set(0, LAP.t + 0.01, -LAP.d / 2 + 0.06);
  const hinge = group(W, root);
  hinge.position.set(0, LAP.t, -LAP.d / 2 + 0.06);
  const lid = group(W, hinge);
  lid.position.set(0, LAP.lidH / 2, -LAP.lidT / 2);
  const l = slab(gl, LAP.w, LAP.lidH, LAP.lidT, 0.16, 0.025);
  W.mesh(l.front, glass, lid);
  W.mesh(l.body, metal, lid);
  W.mesh(l.back, metal, lid);
  const screen = W.mat({ color: "#000000", gloss: 0.9, kind: "screen" });
  const s = W.mesh(quad(gl, LAP.scrW, LAP.scrH), screen, lid, false);
  s.position.set(0, 0.04, LAP.lidT / 2 + 0.002);
  // Details: the camera in the bezel, a polished logo on the lid, rubber feet, ports on the side.
  const black = W.mat({ color: "#050608", metal: 0.3, gloss: 0.9 });
  const cam = W.mesh(cylinder(gl, 0.018, 0.018, 0.004, 20), black, lid, false);
  cam.rotation.x = Math.PI / 2;
  cam.position.set(0, LAP.lidH / 2 - 0.045, LAP.lidT / 2 + 0.003);
  const logo = W.mesh(cylinder(gl, 0.16, 0.16, 0.004, 40), W.mat({ color: "#f2f3f6", metal: 1, gloss: 0.98 }), lid, false);
  logo.rotation.x = Math.PI / 2;
  logo.position.set(0, 0.05, -LAP.lidT / 2 - 0.002);
  const rubber = W.mat({ color: "#1c1d21", gloss: 0.2 });
  for (const [fx, fz] of [
    [-1.35, -0.85],
    [1.35, -0.85],
    [-1.35, 0.85],
    [1.35, 0.85],
  ]) {
    const foot = W.mesh(cylinder(gl, 0.09, 0.1, 0.03, 20), rubber, root, false);
    foot.position.set(fx, -0.012, fz);
  }
  for (const pz of [-0.35, -0.12]) {
    const port = W.mesh(box(gl, 0.01, 0.035, 0.12), black, root, false);
    port.position.set(-LAP.w / 2 - 0.002, LAP.t * 0.48, pz);
  }
  return { root, hinge, screen, metal: [metal, deck] };
}

function slate(W: World, dims: typeof PHONE, phone: boolean, parent?: Transform): Slate {
  const { gl } = W;
  const root = group(W, parent);
  const metal = W.mat({ color: "#cfd3da", metal: 0.9, gloss: 0.7 });
  const glass = W.mat({ color: "#07080b", metal: 0.1, gloss: 0.96 });
  const back = W.mat({ color: "#e4e5ea", metal: 0.25, gloss: 0.75 });
  const r = phone ? 0.13 : 0.14;
  const s0 = slab(gl, dims.w, dims.h, dims.t, r, phone ? 0.034 : 0.028);
  W.mesh(s0.front, glass, root);
  W.mesh(s0.body, metal, root);
  W.mesh(s0.back, back, root);
  const screen = W.mat({ color: "#000000", gloss: 0.9, kind: "screen" });
  const scr = W.mesh(quad(gl, dims.scrW, dims.scrH), screen, root, false);
  scr.position.z = dims.t / 2 + 0.002;
  if (phone) {
    // A camera island on the back with two lenses, and side buttons.
    const isl = slab(gl, 0.3, 0.3, 0.02, 0.08, 0.01);
    const island = group(W, root);
    island.position.set(-dims.w / 2 + 0.22, dims.h / 2 - 0.22, -dims.t / 2 - 0.01);
    island.rotation.y = Math.PI;
    const islandMat = W.mat({ color: "#d9dbe2", metal: 0.3, gloss: 0.85 });
    W.mesh(isl.front, islandMat, island);
    W.mesh(isl.body, metal, island);
    const lensMat = W.mat({ color: "#111318", metal: 0.4, gloss: 0.98 });
    for (const [lx, ly] of [
      [-0.065, 0.065],
      [0.065, -0.065],
    ]) {
      const lens = W.mesh(cylinder(gl, 0.05, 0.055, 0.03, 28), lensMat, island);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(lx, ly, 0.02);
    }
    const ring = W.mat({ color: "#b9bcc5", metal: 1, gloss: 0.9 });
    for (const [lx, ly] of [
      [-0.065, 0.065],
      [0.065, -0.065],
    ]) {
      const r2 = W.mesh(cylinder(gl, 0.062, 0.064, 0.02, 32), ring, island, false);
      r2.rotation.x = Math.PI / 2;
      r2.position.set(lx, ly, 0.012);
    }
    const flash = W.mesh(cylinder(gl, 0.018, 0.018, 0.01, 16), W.mat({ color: "#f5ead2", gloss: 0.9 }), island, false);
    flash.rotation.x = Math.PI / 2;
    flash.position.set(0.075, 0.075, 0.016);
    for (const [y, len] of [
      [0.35, 0.22],
      [0.05, 0.14],
    ]) {
      const btn = W.mesh(box(gl, 0.02, len, 0.03), metal, root);
      btn.position.set(dims.w / 2 + 0.006, y, 0);
    }
    const act = W.mesh(box(gl, 0.02, 0.1, 0.03), metal, root);
    act.position.set(-dims.w / 2 - 0.006, 0.45, 0);
    // Antenna bands in the frame, the speaker slot, the port and speaker holes at the bottom.
    const dark = W.mat({ color: "#2a2c31", gloss: 0.4 });
    for (const [x, y] of [
      [dims.w / 2 + 0.001, 0.62],
      [-dims.w / 2 - 0.001, -0.62],
      [dims.w / 2 + 0.001, -0.62],
      [-dims.w / 2 - 0.001, 0.62],
    ]) W.mesh(box(gl, 0.004, 0.012, dims.t * 0.9), dark, root, false).position.set(x, y, 0);
    W.mesh(box(gl, 0.09, 0.005, 0.03), dark, root, false).position.set(0, -dims.h / 2 - 0.001, 0);
    for (let i = 0; i < 5; i++) {
      for (const sx of [-1, 1]) W.mesh(cylinder(gl, 0.006, 0.006, 0.004, 10), dark, root, false).position.set(sx * (0.09 + i * 0.022), -dims.h / 2 - 0.001, 0);
    }
  } else {
    const cam = W.mesh(cylinder(gl, 0.012, 0.012, 0.004, 16), W.mat({ color: "#050608", gloss: 0.9 }), root, false);
    cam.rotation.x = Math.PI / 2;
    cam.position.set(0, dims.h / 2 - 0.03, dims.t / 2 + 0.003);
  }
  return { root, screen, metal: [metal], back };
}

interface DeviceParts {
  lap: Laptop;
  phone: Slate;
  tab: Slate;
  floor: Program;
  floorMesh: Transform;
  wall: Program;
  candy: { node: Transform; mat: Program }[];
  podium: Transform;
  podiumTop: Program;
  ring: Program;
}

/** The podium's height (devices stand on it). */
const POD = 0.32;

function devicesWorld(W: World): DeviceParts {
  const { gl } = W;
  const lap = laptop(W);
  const phone = slate(W, PHONE, true);
  const tab = slate(W, TAB, false);
  const floor = W.mat({ color: "#000000", kind: "floor" });
  const f = W.mesh(quad(gl, 40, 40), floor, W.scene, false);
  f.rotation.x = -Math.PI / 2;
  // The studio: a seamless backdrop curving from floor to wall, and a round podium with a light
  // ring in the brand's colour.
  const wall = W.mat({ color: "#eef0f4", gloss: 0.18, kind: "backdrop" });
  const c = W.mesh(cove(gl, 80, 30, 6, 30), wall, W.scene, false);
  c.position.set(0, 0, -5);
  const podium = group(W);
  const podiumTop = W.mat({ color: "#f4f5f8", gloss: 0.55 });
  const ring = W.mat({ color: "#7c5cff", gloss: 0.6, emit: [0.5, 0.4, 1] });
  W.mesh(cylinder(gl, 2.7, 2.75, POD - 0.04, 72), podiumTop, podium).position.y = (POD - 0.04) / 2;
  W.mesh(cylinder(gl, 2.76, 2.76, 0.035, 72), ring, podium, false).position.y = 0.06;
  W.mesh(cylinder(gl, 2.66, 2.7, 0.04, 72), podiumTop, podium).position.y = POD - 0.02;
  // Eye candy: glossy shapes in the brand's colours that float slowly round the devices.
  const candy: { node: Transform; mat: Program }[] = [];
  const shapes = [
    sphere(gl, 0.42, 40, 28),
    new Torus(gl, { radius: 0.42, tube: 0.15, radialSegments: 28, tubularSegments: 64 }),
    slab(gl, 0.62, 0.62, 0.62, 0.16, 0.14),
    sphere(gl, 0.2, 28, 20),
    cylinder(gl, 0.16, 0.16, 0.7, 36),
    sphere(gl, 0.28, 32, 22),
  ];
  shapes.forEach((g, i) => {
    const n = group(W);
    const mat = W.mat({ color: "#ffffff", metal: i === 3 ? 0.9 : 0.12, gloss: 0.88 });
    if ("front" in g) {
      W.mesh(g.front, mat, n);
      W.mesh(g.back, mat, n);
      W.mesh(g.body, mat, n);
    } else W.mesh(g as ReturnType<typeof sphere>, mat, n);
    candy.push({ node: n, mat });
  });
  return { lap, phone, tab, floor, floorMesh: f, wall, candy, podium, podiumTop, ring };
}

/** Device finishes that suit the stage: silver on light stages, space grey on dark ones; the phone's back in a soft tint of the brand. */
function finish(sc: SkillContext, P: DeviceParts) {
  const light = !!sc.palette.light;
  const alu = rgb(light ? "#d9dce2" : "#7b808b");
  for (const m of [...P.lap.metal, ...P.phone.metal, ...P.tab.metal]) m.uniforms.uColor.value = alu;
  for (const s of [P.phone, P.tab]) if (s.back) s.back.uniforms.uColor.value = rgb(mixHex(light ? "#eceef2" : "#5d626c", sc.palette.primary, 0.22));
  P.wall.uniforms.uColor.value = rgb(studioTone(sc));
  P.wall.uniforms.uGlowA.value = rgb(mixHex(sc.palette.primary, light ? "#ffffff" : "#000000", light ? 0.35 : 0.2));
  P.wall.uniforms.uGlowB.value = rgb(mixHex(sc.palette.secondary, light ? "#ffffff" : "#000000", light ? 0.35 : 0.2));
  const tints = [sc.palette.primary, sc.palette.secondary, sc.palette.accent, light ? "#e9ebf0" : "#c9ccd6", mixHex(sc.palette.primary, "#ffffff", 0.45), "#ffffff"];
  P.candy.forEach((c, i) => void (c.mat.uniforms.uColor.value = rgb(tints[i % tints.length])));
  P.podiumTop.uniforms.uColor.value = rgb(mixHex(studioTone(sc), light ? "#ffffff" : "#000000", 0.35));
  const pr = rgb(sc.palette.primary);
  P.ring.uniforms.uColor.value = pr;
  P.ring.uniforms.uEmit.value = pr.map((v) => v * 0.8);
}

/** The studio's colour: a soft tint of the brand on light stages, a deep one on dark stages. */
const studioTone = (sc: SkillContext) => (sc.palette.light ? mixHex("#eceef3", sc.palette.primary, 0.07) : mixHex("#15171e", sc.palette.primary, 0.12));

/** The studio behind the headline (the same colour as the backdrop, lit from above). */
function studio(sc: SkillContext) {
  const { ctx, w, h } = sc;
  const tone = studioTone(sc);
  const g = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, Math.max(w, h) * 0.75);
  g.addColorStop(0, mixHex(tone, "#ffffff", sc.palette.light ? 0.5 : 0.08));
  g.addColorStop(1, mixHex(tone, "#000000", sc.palette.light ? 0.03 : 0.25));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Float the eye candy: each shape at its spot in `layout` ([x, y, z, scale]), bobbing and turning
 * slowly on the slide's clock; it rises into place at the start. Shapes past the layout hide.
 */
function floatCandy(P: DeviceParts, layout: [number, number, number, number][], t: number) {
  P.candy.forEach((c, i) => {
    const L = layout[i];
    const on = !!L;
    c.node.visible = on;
    c.node.traverse((n) => void (n.visible = on));
    if (!L) return;
    const rise = ease.outCubic(range(t, 0.1 + i * 0.08, 1.1 + i * 0.08));
    c.node.position.set(L[0], L[1] + Math.sin(t * 0.9 + i * 1.7) * 0.12 - (1 - rise) * 1.2, L[2]);
    const k = L[3] * Math.max(0.001, rise);
    c.node.scale.set(k, k, k);
    c.node.rotation.set(t * 0.25 + i, t * 0.35 + i * 2, i % 2 ? t * 0.2 : 0);
  });
}
const CANDY_LAPTOP: [number, number, number, number][] = [
  [-2.9, 2.5, -1.2, 1],
  [3.0, 2.1, -0.9, 1],
  [2.6, 0.75, 1.3, 0.8],
  [-2.3, 1.0, 1.4, 1],
  [-3.4, 1.4, 0.3, 0.9],
  [3.5, 3.0, -1.8, 0.9],
];
const CANDY_PHONE: [number, number, number, number][] = [
  [-1.25, 2.1, -0.5, 0.75],
  [1.3, 1.7, -0.4, 0.75],
  [1.0, 0.75, 0.7, 0.6],
  [-0.95, 0.9, 0.8, 0.9],
  [-1.6, 1.3, -1.0, 0.7],
  [1.65, 2.5, -1.1, 0.6],
];
const CANDY_LINEUP: [number, number, number, number][] = [
  [-4.6, 2.9, -1.6, 1],
  [4.4, 2.6, -1.4, 1],
  [0.6, 3.4, -2.2, 0.8],
  [-1.6, 3.1, -1.8, 1],
];

/** Stand the devices on the podium (or on the studio floor). */
function onPodium(P: DeviceParts, on: boolean) {
  P.podium.visible = on;
  P.podium.traverse((n) => void (n.visible = on));
  P.floorMesh.position.y = on ? POD + 0.002 : 0.002;
}

function lighting(sc: SkillContext): Partial<View> {
  const light = !!sc.palette.light;
  return {
    sun: [-0.45, 0.9, 0.55],
    sunCol: [1, 0.98, 0.95],
    sky: light ? [0.92, 0.93, 0.97] : rgb(mixHex("#c7cbd6", sc.palette.primary, 0.15)),
    gnd: light ? [0.55, 0.53, 0.52] : [0.25, 0.25, 0.3],
    exposure: light ? 1.0 : 1.08,
    flat: !!sc.flat3d,
    rim: rgb(mixHex(sc.palette.primary, "#ffffff", 0.3)).map((v) => v * (light ? 0.22 : 0.5)) as Num3,
    // A light sweep crosses the glass once the screen is on, now and then.
    sheen: ((sc.t - 1.6) % 4.5) * 0.9 - 0.3,
  };
}

/** The floor's soft contact shadows, from footprints [x, z, half-width, half-depth]. */
function blobs(P: DeviceParts, list: [number, number, number, number][]) {
  const v = new Array(24).fill(0);
  list.slice(0, 6).forEach((b, i) => v.splice(i * 4, 4, ...b));
  P.floor.uniforms.uBlob.value = v;
}

function show(P: DeviceParts, which: { lap?: boolean; phone?: boolean; tab?: boolean }) {
  P.lap.root.visible = !!which.lap;
  P.phone.root.visible = !!which.phone;
  P.tab.root.visible = !!which.tab;
  for (const r of [P.lap.root, P.phone.root, P.tab.root]) r.traverse((n) => void (n.visible = r.visible));
}

/** Put the picture on a screen. */
const copies = new WeakMap<object, HTMLCanvasElement>();
/** Images go to the GPU as a canvas copy, so they upload the same way (and the right way up) as drawn screens. */
function asCanvas(src: Drawable | HTMLCanvasElement): Drawable | HTMLCanvasElement {
  if (!(src instanceof HTMLImageElement) || !src.naturalWidth) return src;
  let c = copies.get(src);
  if (!c) {
    c = document.createElement("canvas");
    // (Kept within common GPU texture limits.)
    const k = Math.min(1, 8192 / Math.max(src.naturalWidth, src.naturalHeight));
    c.width = Math.round(src.naturalWidth * k);
    c.height = Math.round(src.naturalHeight * k);
    c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
    copies.set(src, c);
  }
  return c;
}

function paint(W: World, p: Program, shot0: Drawable | HTMLCanvasElement, aspect: number, scroll: number, glow: number, radius: number) {
  const shot = asCanvas(shot0);
  const tex = textureOf(W.renderer, shot);
  const { w, h } = sizeOf(shot);
  setScreen(p, tex, w, h, aspect, scroll, glow, radius);
}

/** Draw the 3D view into the slide under the headline (or a flat fallback without WebGL). */
function frame(sc: SkillContext, top: number, draw: (w: number, h: number) => HTMLCanvasElement | null, fallback: () => void) {
  const { ctx, w, h } = sc;
  const rh = h - top;
  const cv = draw(w, rh);
  ctx.save();
  ctx.globalAlpha *= 1 - exitOf(sc);
  if (cv) {
    // The render's top edge melts into the studio behind the headline.
    const L = scratch("d3-fade", w, rh);
    L.ctx.clearRect(0, 0, w, rh);
    L.ctx.globalCompositeOperation = "source-over";
    L.ctx.drawImage(cv, 0, 0, w, rh);
    L.ctx.globalCompositeOperation = "destination-in";
    const g = L.ctx.createLinearGradient(0, 0, 0, rh * 0.22);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,1)");
    L.ctx.fillStyle = g;
    L.ctx.fillRect(0, 0, w, rh);
    L.ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(L.canvas, 0, top, w, rh);
  } else fallback();
  ctx.restore();
}

function flat(sc: SkillContext, shot: Drawable | HTMLCanvasElement, top: number) {
  const { ctx, w, h, u } = sc;
  const bw = Math.min(w * 0.6, (h - top) * 1.4);
  const bh = bw / 1.6;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(w / 2 - bw / 2, top + (h - top - bh) / 2, bw, bh, 14 * u);
  ctx.clip();
  ctx.drawImage(shot as CanvasImageSource, w / 2 - bw / 2, top + (h - top - bh) / 2, bw, bh);
  ctx.restore();
}

/** Look the camera from `eye` at `target`, eased between two shots. */
const mixShot = (a: Num3, b: Num3, k: number): Num3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
/** The frame is taller on vertical videos: pull back so the subject fits. */
const fit = (sc: SkillContext, top: number) => {
  const a = sc.w / (sc.h - top);
  return a < 1.2 ? 1.2 / a : 1;
};

/* ───────────────────────── Slides ───────────────────────── */

function d3Laptop(sc: SkillContext) {
  const { t, d } = sc;
  studio(sc);
  const st = stage(sc);
  const top = st.top - 20 * sc.u;
  const shot = shotOf(sc);
  frame(
    sc,
    top,
    (w, h) => {
      const R = world("devices", w, h, devicesWorld);
      if (!R) return null;
      const { W, parts: P } = R;
      finish(sc, P);
      show(P, { lap: true });
      onPodium(P, true);
      floatCandy(P, CANDY_LAPTOP, t);
      P.lap.root.position.set(0, POD + 0.015, 0);
      P.lap.root.rotation.y = 0;
      const open = ease.inOutCubic(range(t, 0.15, 1.7));
      P.lap.hinge.rotation.x = lerp(Math.PI / 2 - 0.02, -0.3, open);
      paint(W, P.lap.screen, shot, LAP.scrW / LAP.scrH, ease.inOutCubic(range(t, 2.1, d - 0.4)), range(t, 1.1, 1.8), 0.02);
      blobs(P, [[0, -0.1, LAP.w / 2 - 0.1, LAP.d / 2 - 0.1]]);
      const k = ease.inOutCubic(range(t, 0, d * 0.75));
      const F = fit(sc, top);
      const eye = mixShot([4.4 * F, 1.35, 4.6 * F], [-1.5 * F, 2.4, 7.0 * F], k);
      return render(W, { ...lighting(sc), eye: [eye[0], eye[1] + POD, eye[2]], target: [0, lerp(0.35, 0.78, open) + POD, -0.4], fov: 30, shadowSize: 3.5, shadowAt: [0, 0.8, -0.3] }, w, h);
    },
    () => flat(sc, shot, top),
  );
}

function d3Phone(sc: SkillContext) {
  const { t, d } = sc;
  studio(sc);
  const st = stage(sc);
  const top = st.top - 20 * sc.u;
  const shot = shotOf(sc, true);
  frame(
    sc,
    top,
    (w, h) => {
      const R = world("devices", w, h, devicesWorld);
      if (!R) return null;
      const { W, parts: P } = R;
      finish(sc, P);
      show(P, { phone: true });
      onPodium(P, true);
      floatCandy(P, CANDY_PHONE.map(([x, y, z, k]) => [x, y + POD, z, k] as [number, number, number, number]), t);
      const turn = ease.inOutCubic(range(t, 0.1, 1.9));
      const bob = Math.sin(t * 1.6) * 0.04;
      P.phone.root.position.set(0, 1.05 + POD + bob, 0);
      P.phone.root.rotation.set(lerp(0.25, 0.08, turn), lerp(Math.PI + 0.5, -0.32, turn) + Math.sin(t * 0.9) * 0.04, lerp(-0.15, 0.04, turn));
      paint(W, P.phone.screen, shot, PHONE.scrW / PHONE.scrH, ease.inOutCubic(range(t, 2.2, d - 0.4)), range(t, 1.2, 1.9), 0.11);
      blobs(P, [[0, 0, 0.18, 0.06]]);
      const F = fit(sc, top);
      return render(W, { ...lighting(sc), eye: [0.25 * F, 1.5 + POD, 5.4 * F], target: [0, 0.95 + POD, 0], fov: 26, shadowSize: 2.8, shadowAt: [0, 0.8, 0] }, w, h);
    },
    () => flat(sc, shot, top),
  );
}

function d3Lineup(sc: SkillContext) {
  const { t, d } = sc;
  studio(sc);
  const st = stage(sc);
  const top = st.top - 20 * sc.u;
  const shot = shotOf(sc);
  frame(
    sc,
    top,
    (w, h) => {
      const R = world("devices", w, h, devicesWorld);
      if (!R) return null;
      const { W, parts: P } = R;
      finish(sc, P);
      show(P, { lap: true, phone: true, tab: true });
      onPodium(P, false);
      floatCandy(P, CANDY_LINEUP, t);
      P.lap.root.position.set(0, 0, 0);
      P.lap.root.rotation.y = 0;
      P.lap.hinge.rotation.x = -0.3;
      const rise = (k0: number) => ease.outCubic(range(t, k0, k0 + 0.8));
      P.tab.root.position.set(-2.75, TAB.h / 2 * Math.cos(0.14) - (1 - rise(0.35)) * 0.4, 0.15);
      P.tab.root.rotation.set(-0.14, 0.38, 0);
      P.phone.root.position.set(2.45, PHONE.h / 2 * Math.cos(0.12) - (1 - rise(0.55)) * 0.3, 0.55);
      P.phone.root.rotation.set(-0.12, -0.42, 0);
      const scroll = ease.inOutCubic(range(t, 1.4, d - 0.4));
      paint(W, P.lap.screen, shot, LAP.scrW / LAP.scrH, scroll, range(t, 0.2, 0.8), 0.02);
      paint(W, P.tab.screen, shot, TAB.scrW / TAB.scrH, scroll, range(t, 0.5, 1.1), 0.06);
      paint(W, P.phone.screen, shotOf(sc, true), PHONE.scrW / PHONE.scrH, scroll, range(t, 0.7, 1.3), 0.11);
      blobs(P, [
        [0, -0.1, LAP.w / 2 - 0.1, LAP.d / 2 - 0.1],
        [-2.75, 0.1, 0.8, 0.06],
        [2.45, 0.55, 0.3, 0.05],
      ]);
      const k = ease.inOutCubic(range(t, 0, d));
      const F = fit(sc, top);
      const eye: Num3 = [lerp(-2.2, 2.2, k), 2.3, 9.4 * F];
      return render(W, { ...lighting(sc), eye, target: [lerp(-0.5, 0.5, k), 0.95, 0], fov: 30, shadowSize: 5, shadowAt: [0, 0.8, 0] }, w, h);
    },
    () => flat(sc, shot, top),
  );
}

function d3Dive(sc: SkillContext) {
  const { ctx, t, d, w, h } = sc;
  studio(sc);
  const st = stage(sc);
  // The headline gives way as the camera dives; the page ends full frame.
  const dive = ease.inOutCubic(range(t, 0.9, d - 1.1));
  const top = lerp(st.top - 20 * sc.u, 0, dive);
  const shot = shotOf(sc);
  const land = range(t, d - 1.3, d - 0.9);
  frame(
    sc,
    top,
    (cw, ch) => {
      const R = world("devices", cw, ch, devicesWorld);
      if (!R) return null;
      const { W, parts: P } = R;
      finish(sc, P);
      show(P, { lap: true });
      onPodium(P, true);
      floatCandy(P, CANDY_LAPTOP, t);
      P.lap.root.position.set(0, POD + 0.015, 0);
      P.lap.root.rotation.y = 0;
      const lean = -0.3;
      P.lap.hinge.rotation.x = lean;
      paint(W, P.lap.screen, shot, LAP.scrW / LAP.scrH, 0, 1, 0.02);
      blobs(P, [[0, -0.1, LAP.w / 2 - 0.1, LAP.d / 2 - 0.1]]);
      // The screen's centre and facing, from the hinge.
      const hy = LAP.t + POD + 0.015;
      const hz = -LAP.d / 2 + 0.06;
      const cy = LAP.lidH / 2 + 0.04;
      const sc0: Num3 = [0, hy + Math.cos(lean) * cy + Math.sin(-lean) * 0, hz - Math.sin(-lean) * cy + LAP.lidT / 2];
      const nrm: Num3 = [0, Math.sin(-lean), Math.cos(lean)];
      const fov = 30;
      const aspect = cw / ch;
      const fitH = Math.max(LAP.scrH, LAP.scrW / aspect) / 2;
      const dist = fitH / Math.tan(((fov / 2) * Math.PI) / 180) * 1.0;
      const near: Num3 = [sc0[0] + nrm[0] * dist, sc0[1] + nrm[1] * dist, sc0[2] + nrm[2] * dist];
      const F = fit(sc, st.top);
      const eye = mixShot([3.6 * F, 2.6 + POD, 6.8 * F], near, dive);
      const target = mixShot([0, 0.9 + POD, -0.4], sc0, dive);
      return render(W, { ...lighting(sc), eye, target, fov, shadowSize: 3.5, shadowAt: [0, 0.8, -0.3] }, cw, ch);
    },
    () => flat(sc, shot, st.top),
  );
  if (land > 0) {
    // Land on the page itself, crisp and full frame.
    const { w: iw, h: ih } = sizeOf(shot);
    const s = Math.max(w / (iw || w), h / (ih || h));
    ctx.save();
    ctx.globalAlpha = land * (1 - exitOf(sc));
    ctx.drawImage(shot as CanvasImageSource, (w - iw * s) / 2, 0, iw * s, ih * s);
    ctx.restore();
  }
}

interface DeskParts {
  lap: Laptop;
  phone: Slate;
  mug: Program;
  plantPot: Program;
}

function deskWorld(W: World): DeskParts {
  const { gl } = W;
  // The desk top (wood), big enough to fill the frame.
  const top = slab(gl, 9, 5, 0.16, 0.12, 0.04);
  const desk = group(W);
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -0.08;
  const wood = W.mat({ color: "#9c7350", gloss: 0.42 });
  W.mesh(top.front, wood, desk, false);
  W.mesh(top.body, wood, desk, false);
  const lap = laptop(W);
  lap.root.position.set(-0.3, 0, -0.2);
  lap.root.rotation.y = 0.18;
  lap.hinge.rotation.x = -0.32;
  const phone = slate(W, PHONE, true);
  phone.root.rotation.set(-Math.PI / 2, 0, -0.35);
  phone.root.position.set(2.3, PHONE.t / 2, 0.85);
  // A mug with a handle, a notebook with a pen, a potted plant.
  const mug = W.mat({ color: "#7c5cff", gloss: 0.7 });
  const m = W.mesh(cylinder(gl, 0.24, 0.22, 0.52, 40), mug);
  m.position.set(2.55, 0.26, -0.7);
  const handle = W.mesh(cylinder(gl, 0.05, 0.05, 0.28, 16), mug);
  handle.position.set(2.82, 0.28, -0.7);
  const coffee = W.mesh(cylinder(gl, 0.21, 0.21, 0.01, 32), W.mat({ color: "#4a2f22", gloss: 0.8 }), W.scene, false);
  coffee.position.set(2.55, 0.5, -0.7);
  const book = slab(gl, 1.3, 1.7, 0.08, 0.05, 0.02);
  const nb = group(W);
  nb.rotation.set(-Math.PI / 2, 0, 0.25);
  nb.position.set(-2.9, 0.04, 0.7);
  const cover = W.mat({ color: "#2f3440", gloss: 0.3 });
  W.mesh(book.front, cover, nb);
  W.mesh(book.body, W.mat({ color: "#f3efe6", gloss: 0.2 }), nb);
  const pen = W.mesh(cylinder(gl, 0.03, 0.03, 1.1, 16), W.mat({ color: "#e9edf3", metal: 0.6, gloss: 0.8 }));
  pen.rotation.set(0, 0, Math.PI / 2);
  pen.position.set(-2.2, 0.04, 1.2);
  pen.rotation.y = 0.4;
  const plantPot = W.mat({ color: "#e8e2d8", gloss: 0.3 });
  const pot = W.mesh(cylinder(gl, 0.32, 0.25, 0.55, 32), plantPot);
  pot.position.set(-3.1, 0.27, -1.2);
  const leaf = W.mat({ color: "#4f9e5c", gloss: 0.35 });
  for (const [x, y, z, r] of [
    [-3.1, 0.85, -1.2, 0.36],
    [-3.3, 0.7, -1.05, 0.26],
    [-2.9, 0.72, -1.3, 0.28],
    [-3.05, 1.08, -1.25, 0.22],
  ]) {
    const s = W.mesh(sphere(gl, r, 20, 14), leaf);
    s.position.set(x, y, z);
    s.scale.set(1, 0.85, 1);
  }
  return { lap, phone, mug, plantPot };
}

function d3Desk(sc: SkillContext) {
  const { t, d, palette } = sc;
  saasBackground(sc, { beams: 0.6 });
  const st = stage(sc);
  const top = st.top - 20 * sc.u;
  const shot = shotOf(sc);
  frame(
    sc,
    top,
    (w, h) => {
      const R = world("desk", w, h, deskWorld);
      if (!R) return null;
      const { W, parts: P } = R;
      const light = !!palette.light;
      for (const m of [...P.lap.metal, ...P.phone.metal]) m.uniforms.uColor.value = rgb(light ? "#d9dce2" : "#8a8f99");
      if (P.phone.back) P.phone.back.uniforms.uColor.value = rgb(mixHex("#eceef2", palette.primary, 0.25));
      P.mug.uniforms.uColor.value = rgb(palette.primary);
      paint(W, P.lap.screen, shot, LAP.scrW / LAP.scrH, ease.inOutCubic(range(t, 1.2, d - 0.4)), range(t, 0.1, 0.7), 0.02);
      paint(W, P.phone.screen, shotOf(sc, true), PHONE.scrW / PHONE.scrH, ease.inOutCubic(range(t, 1.6, d - 0.4)), range(t, 0.4, 1.0), 0.11);
      const k = ease.inOutCubic(range(t, 0, d));
      const a = lerp(0.55, -0.35, k);
      const F = fit(sc, top);
      const r = 8.6 * F;
      const eye: Num3 = [Math.sin(a) * r, lerp(5.6, 4.6, k) * F, Math.cos(a) * r];
      return render(W, { ...lighting(sc), sun: [-0.5, 0.85, 0.35], sunCol: [1, 0.95, 0.86], eye, target: [0, 0.35, 0], fov: 30, shadowSize: 5.5, shadowAt: [0, 0, 0] }, w, h);
    },
    () => flat(sc, shot, top),
  );
}

/* ───────────────────────── Registry ───────────────────────── */

const SAMPLE = { text: "See it in *3D*" };

export const devices3dSkills: Skill[] = [
  {
    id: "d3-laptop",
    name: "3D Laptop",
    tagline: "A real 3D laptop: the lid opens on its hinge as the camera swings round to the front, the screen wakes and your site scrolls.",
    bestFor: "Introducing a website or web app with a premium, product-film feel; a short headline. Shows the site's own screenshot automatically (the full page, scrolling).",
    sample: { text: "Meet your new *workspace*" },
    render: d3Laptop,
    sfx: () => [at(0.2, "whoosh"), at(1.6, "click")],
  },
  {
    id: "d3-phone",
    name: "3D Phone",
    tagline: "A real 3D phone turns from its back (camera lenses, buttons) to its screen, floating over its shadow, your app scrolling.",
    bestFor: "Mobile apps and mobile sites: a short headline. Shows the site as a phone displays it automatically (or the slide's portrait picture).",
    sample: { text: "In your *pocket*" },
    render: d3Phone,
    sfx: () => [at(0.1, "whoosh"), at(1.8, "pop")],
  },
  {
    id: "d3-lineup",
    name: "3D Device Lineup",
    tagline: "A laptop, a tablet and a phone stand together in real 3D, screens lit with your product, as the camera glides across them.",
    bestFor: "'Works everywhere' moments: the same product on laptop, tablet and phone; a short headline. Uses the site's desktop and mobile screenshots automatically.",
    sample: { text: "On every *screen*" },
    render: d3Lineup,
    sfx: () => [at(0.35, "pop"), at(0.55, "pop"), at(0.75, "pop")],
  },
  {
    id: "d3-dive",
    name: "3D Screen Dive",
    tagline: "The camera flies from a wide shot of a 3D laptop straight into its screen, landing full frame on your page.",
    bestFor: "A transition into a product tour or a screenshot slide; a short headline.",
    sample: { text: "Step *in*" },
    render: d3Dive,
    sfx: (scene: Scene) => [at(0.9, "whoosh"), at(Math.max(1.5, scene.duration - 1.1), "swoosh")],
  },
  {
    id: "d3-desk",
    name: "3D Desk",
    tagline: "A real 3D desk from above: the laptop with your site, a phone with your app, a mug in your colour, a notebook and a plant, the camera circling slowly.",
    bestFor: "Work, productivity and 'your day' stories: a short headline.",
    sample: SAMPLE,
    render: d3Desk,
    sfx: () => [at(0.2, "whoosh")],
  },
];
