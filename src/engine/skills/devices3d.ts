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
 * - d3-desk:    a desk in your colours from above: the laptop, a phone, a tablet, a mug, a plant.
 */
import { Texture, Torus, type Program, type Transform } from "ogl";
import { cove, project, quad, render, rgb, setCrop, setScreen, slab, cylinder, sphere, box, lathe, leaf, torus, world, type View, type World } from "../d3";
import { desktopUI, mobileUI } from "../uiscreens";
import { getMedia, type Drawable } from "../media";
import { textureOf, sizeOf } from "../gl";
import { clamp, ease, hashString, lerp, mixHex, range } from "../math";
import { saasBackground, saasFont } from "../saasfx";
import { displayFont, fillTextFit, subFont } from "../text";
import { scratch } from "../scratch";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { exitOf, itemsOr, split, stage } from "./beats";
import { pointTimes } from "./characters";

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
const PHONE = { w: 0.76, h: 1.62, t: 0.08, scrW: 0.732, scrH: 1.592 };
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

const metalExtra = new Map<Program, boolean>();

/** Key rows, back to front: widths in key units (rows sum to 14.5) and their legends. */
const KEY_ROWS: { h: number; keys: [number, string][] }[] = [
  { h: 0.55, keys: [[1.5, "esc"], ...["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"].map((k) => [1, k] as [number, string]), [1, "⏻"]] },
  { h: 1, keys: [..."`1234567890-=".split("").map((k) => [1, k] as [number, string]), [1.5, "delete"]] },
  { h: 1, keys: [[1.5, "tab"], ..."QWERTYUIOP[]\\".split("").map((k) => [1, k] as [number, string])] },
  { h: 1, keys: [[1.75, "caps"], ..."ASDFGHJKL;'".split("").map((k) => [1, k] as [number, string]), [1.75, "return"]] },
  { h: 1, keys: [[2.25, "shift"], ..."ZXCVBNM,./".split("").map((k) => [1, k] as [number, string]), [2.25, "shift"]] },
  { h: 1, keys: [[1, "fn"], [1, "ctrl"], [1, "opt"], [1.25, "cmd"], [5, ""], [1.25, "cmd"], [1, "opt"], [1, "◀"], [1, "▲▼"], [1, "▶"]] },
];

/** The keyboard: individual keys with rounded caps sitting in the deck, legends printed on them, speaker grilles either side. */
function keyboard(W: World, root: Transform) {
  const { gl } = W;
  const kbW = 2.72;
  const unit = kbW / 14.5;
  const gap = unit * 0.14;
  const zBack = -0.93;
  const totalH = KEY_ROWS.reduce((a, r) => a + r.h, 0) * unit;
  const keyM = W.mat({ color: "#17181c", metal: 0.15, gloss: 0.42 });
  const capH = 0.016;
  const geos = new Map<string, ReturnType<typeof slab>>();
  // Legends and grilles are printed on a canvas laid over the deck.
  const cv = document.createElement("canvas");
  cv.width = 2048;
  cv.height = Math.round(2048 * (totalH / kbW));
  const g = cv.getContext("2d")!;
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = "rgba(235,238,245,0.82)";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const px = cv.width / kbW;
  let z = zBack;
  for (const row of KEY_ROWS) {
    const rh = row.h * unit;
    let x = -kbW / 2;
    for (const [kw, label] of row.keys) {
      const w = kw * unit;
      const key = `${(w - gap).toFixed(3)}x${(rh - gap).toFixed(3)}`;
      let geo = geos.get(key);
      if (!geo) {
        geo = slab(gl, w - gap, rh - gap, capH, Math.min(0.022, (rh - gap) * 0.25), 0.005);
        geos.set(key, geo);
      }
      const n = new (W.scene.constructor as new () => Transform)();
      n.setParent(root);
      n.rotation.x = -Math.PI / 2;
      n.position.set(x + w / 2, LAP.t + capH / 2, z + rh / 2);
      W.mesh(geo.front, keyM, n, false);
      W.mesh(geo.body, keyM, n, false);
      if (label) {
        const big = label.length === 1 || label.length === 2;
        g.font = `${big ? 600 : 500} ${Math.round(px * unit * (big ? 0.34 : 0.2))}px Inter, "Helvetica Neue", Arial, sans-serif`;
        const cx = (x + w / 2 + kbW / 2) * px;
        const cy = (z + rh / 2 - zBack) * px;
        if (big) g.fillText(label, cx, cy);
        else {
          g.textAlign = "left";
          g.fillText(label, (x + kbW / 2) * px + px * unit * 0.14, (z + rh - zBack) * px - px * unit * 0.2);
          g.textAlign = "center";
        }
      }
      x += w;
    }
    z += rh;
  }
  const tex = new Texture(gl, { image: cv, generateMipmaps: true, minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR, anisotropy: 8 });
  const legend = W.mat({ color: "#ffffff", kind: "decal" });
  legend.uniforms.tMap.value = tex;
  const lq = W.mesh(quad(gl, kbW, totalH), legend, root, false);
  lq.rotation.x = -Math.PI / 2;
  lq.position.set(0, LAP.t + capH + 0.0008, zBack + totalH / 2);
  // Speaker grilles: fine dots either side of the keys.
  const gc = document.createElement("canvas");
  gc.width = 64;
  gc.height = 512;
  const gg = gc.getContext("2d")!;
  gg.fillStyle = "rgba(20,22,28,0.85)";
  for (let yy = 6; yy < 512; yy += 12) for (let xx = 6 + ((yy / 12) % 2) * 6; xx < 64; xx += 12) {
    gg.beginPath();
    gg.arc(xx, yy, 2.4, 0, Math.PI * 2);
    gg.fill();
  }
  const gtex = new Texture(gl, { image: gc, generateMipmaps: true, minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR });
  const grille = W.mat({ color: "#ffffff", kind: "decal" });
  grille.uniforms.tMap.value = gtex;
  for (const sx of [-1, 1]) {
    const q = W.mesh(quad(gl, 0.13, totalH), grille, root, false);
    q.rotation.x = -Math.PI / 2;
    q.position.set(sx * (kbW / 2 + 0.11), LAP.t + 0.0008, zBack + totalH / 2);
  }
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
  keyboard(W, root);
  // An inset glass trackpad and a camera notch at the top of the screen.
  const pad = slab(gl, 1.0, 0.56, 0.006, 0.05, 0.003);
  const padN = group(W, root);
  padN.rotation.x = -Math.PI / 2;
  padN.position.set(0, LAP.t + 0.0015, 0.62);
  const padM = W.mat({ color: "#cfd3da", metal: 0.55, gloss: 0.88 });
  W.mesh(pad.front, padM, padN, false);
  W.mesh(pad.body, padM, padN, false);
  metalExtra.set(padM, true);
  const notch = slab(gl, 0.24, 0.05, 0.002, 0.018, 0.001);
  const nN = group(W, lid);
  nN.position.set(0, 0.04 + LAP.scrH / 2 - 0.02, LAP.lidT / 2 + 0.0045);
  W.mesh(notch.front, black, nN, false);
  return { root, hinge, screen, metal: [metal, deck, padM] };
}

function slate(W: World, dims: typeof PHONE, phone: boolean, parent?: Transform): Slate {
  const { gl } = W;
  const root = group(W, parent);
  const metal = W.mat({ color: "#cfd3da", metal: 0.9, gloss: 0.7 });
  const glass = W.mat({ color: "#07080b", metal: 0.1, gloss: 0.96 });
  const back = W.mat({ color: "#e4e5ea", metal: 0.25, gloss: 0.75 });
  // A current flagship: a flat titanium-like frame with tight corners, near edge-to-edge glass.
  const r = phone ? 0.115 : 0.14;
  const s0 = slab(gl, dims.w, dims.h, dims.t, r, phone ? 0.018 : 0.028);
  W.mesh(s0.front, glass, root);
  W.mesh(s0.body, metal, root);
  W.mesh(s0.back, back, root);
  const screen = W.mat({ color: "#000000", gloss: 0.9, kind: "screen" });
  const scr = W.mesh(quad(gl, dims.scrW, dims.scrH), screen, root, false);
  scr.position.z = dims.t / 2 + 0.002;
  if (phone) {
    // The Dynamic Island over the screen.
    const pill = slab(gl, 0.2, 0.058, 0.002, 0.029, 0.0005);
    const isle = group(W, root);
    isle.position.set(0, dims.scrH / 2 - 0.06, dims.t / 2 + 0.0045);
    const ink = W.mat({ color: "#010102", gloss: 0.95 });
    W.mesh(pill.front, ink, isle, false);
    W.mesh(pill.body, ink, isle, false);
    // A camera plateau on the back with three lenses, a flash and a sensor; side buttons.
    const isl = slab(gl, 0.36, 0.36, 0.022, 0.1, 0.011);
    const island = group(W, root);
    island.position.set(-dims.w / 2 + 0.24, dims.h / 2 - 0.24, -dims.t / 2 - 0.011);
    island.rotation.y = Math.PI;
    const islandMat = W.mat({ color: "#d9dbe2", metal: 0.3, gloss: 0.85 });
    W.mesh(isl.front, islandMat, island);
    W.mesh(isl.body, metal, island);
    const lensMat = W.mat({ color: "#111318", metal: 0.4, gloss: 0.98 });
    const LENSES = [
      [-0.085, 0.085],
      [-0.085, -0.085],
      [0.085, 0.0],
    ];
    for (const [lx, ly] of LENSES) {
      const lens = W.mesh(cylinder(gl, 0.056, 0.06, 0.034, 32), lensMat, island);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(lx, ly, 0.02);
    }
    const ring = W.mat({ color: "#b9bcc5", metal: 1, gloss: 0.9 });
    for (const [lx, ly] of LENSES) {
      const r2 = W.mesh(cylinder(gl, 0.068, 0.07, 0.022, 36), ring, island, false);
      r2.rotation.x = Math.PI / 2;
      r2.position.set(lx, ly, 0.012);
    }
    const flash = W.mesh(cylinder(gl, 0.018, 0.018, 0.01, 16), W.mat({ color: "#f5ead2", gloss: 0.9 }), island, false);
    flash.rotation.x = Math.PI / 2;
    flash.position.set(0.1, 0.11, 0.016);
    const lidar = W.mesh(cylinder(gl, 0.016, 0.016, 0.01, 16), lensMat, island, false);
    lidar.rotation.x = Math.PI / 2;
    lidar.position.set(0.1, -0.11, 0.016);
    for (const [y, len] of [
      [0.35, 0.22],
      [0.05, 0.14],
    ]) {
      const btn = W.mesh(box(gl, 0.02, len, 0.03), metal, root);
      btn.position.set(dims.w / 2 + 0.006, y, 0);
    }
    // The action button and a camera control button.
    const act = W.mesh(box(gl, 0.018, 0.07, 0.028), metal, root);
    act.position.set(-dims.w / 2 - 0.005, 0.48, 0);
    const camBtn = W.mesh(box(gl, 0.012, 0.12, 0.03), W.mat({ color: "#2a2c31", metal: 0.6, gloss: 0.9 }), root, false);
    camBtn.position.set(dims.w / 2 + 0.002, -0.28, 0);
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
  cove: Transform;
  candy: { node: Transform; mat: Program }[];
  /** UI panels that lift off the screen (the pop-out shot). */
  panels: { node: Transform; front: Program }[];
  /** The environments: a light studio, a dark keynote stage with neon arches, a sunlit loft. */
  stage: Transform;
  stagePlinth: Transform;
  arches: Program[];
  loft: Transform;
  loftTable: Transform;
  env: Env;
  podium: Transform;
  podiumTop: Program;
  ring: Program;
}

/** The podium's height (devices stand on it). */
const POD = 0.32;

type Env = "studio" | "stage" | "loft";

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
  // A keynote stage: a stepped round plinth under the devices, neon arches behind, light bars.
  const stage = group(W);
  const stagePlinth = group(W);
  const dark = W.mat({ color: "#121318", metal: 0.3, gloss: 0.9 });
  W.mesh(cylinder(gl, 3.4, 3.45, 0.12, 72), dark, stagePlinth).position.y = 0.06;
  W.mesh(cylinder(gl, 2.9, 2.95, 0.12, 72), dark, stagePlinth).position.y = 0.18;
  W.mesh(cylinder(gl, 2.4, 2.45, 0.08, 72), dark, stagePlinth).position.y = POD - 0.04;
  const arches: Program[] = [];
  [
    [0, -3.2, 4.6, 0.055],
    [0, -5.2, 5.6, 0.045],
    [0, -7.2, 6.6, 0.04],
  ].forEach(([x, z, r, tube], i) => {
    const m = W.mat({ color: "#7c5cff", gloss: 0.5, emit: [0.6, 0.4, 1] });
    arches.push(m);
    const a = W.mesh(new Torus(gl, { radius: r, tube, radialSegments: 12, tubularSegments: 120, arc: Math.PI }), m, stage, false);
    a.position.set(x, 0, z);
    void i;
  });
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const m = arches[k % arches.length];
      const bar = W.mesh(box(gl, 0.06, 3.2, 0.06), m, stage, false);
      bar.position.set(sx * (5.4 + k * 1.3), 1.6, -2.6 - k * 1.6);
    }
  }
  // A sunlit loft: a low oak table under the devices, a tall window of soft light, a plant, a
  // shelf of books, a rug.
  const loft = group(W);
  const loftTable = group(W);
  const oak = W.mat({ color: "#7d5a3f", gloss: 0.5 });
  const top = slab(gl, 5.6, 3.0, 0.1, 0.4, 0.04);
  const tt = group(W, loftTable);
  tt.rotation.x = -Math.PI / 2;
  tt.position.y = POD - 0.05;
  W.mesh(top.front, oak, tt);
  W.mesh(top.body, oak, tt);
  W.mesh(top.back, oak, tt);
  for (const [lx, lz] of [
    [-2.4, -1.1],
    [2.4, -1.1],
    [-2.4, 1.1],
    [2.4, 1.1],
  ]) W.mesh(cylinder(gl, 0.07, 0.05, POD - 0.1, 16), oak, loftTable).position.set(lx, (POD - 0.1) / 2, lz);
  const light = W.mat({ color: "#fffaf0", gloss: 0.2, emit: [0.9, 0.86, 0.78] });
  const frameM = W.mat({ color: "#2a2b30", metal: 0.4, gloss: 0.5 });
  const win = group(W, loft);
  win.position.set(-4.2, 3.4, -10.7);
  W.mesh(quad(gl, 4.2, 6.4), light, win, false);
  for (const [bx, by, bw, bh] of [
    [0, 0, 0.1, 6.4],
    [-2.1, 0, 0.12, 6.6],
    [2.1, 0, 0.12, 6.6],
    [0, 3.2, 4.3, 0.12],
    [0, 1.0, 4.2, 0.08],
    [0, -1.2, 4.2, 0.08],
  ]) W.mesh(box(gl, bw, bh, 0.12), frameM, win, false).position.set(bx, by, 0.05);
  const potM = W.mat({ color: "#e9e4dc", gloss: 0.3 });
  const leaf = W.mat({ color: "#4f8f55", gloss: 0.35 });
  W.mesh(cylinder(gl, 0.55, 0.42, 1.1, 32), potM, loft).position.set(5.2, 0.55, -3.2);
  for (const [lx, ly, lz, r] of [
    [5.2, 1.9, -3.2, 0.8],
    [4.7, 2.6, -3.0, 0.6],
    [5.7, 2.5, -3.4, 0.62],
    [5.1, 3.2, -3.3, 0.5],
  ]) W.mesh(sphere(gl, r, 20, 14), leaf, loft).position.set(lx, ly, lz);
  const shelf = W.mat({ color: "#3b3d44", gloss: 0.4 });
  for (const y of [1.6, 2.6, 3.6]) W.mesh(box(gl, 3.0, 0.08, 0.6), shelf, loft, false).position.set(4.6, y, -10.4);
  const books = ["#c9a27a", "#7c8696", "#e6dccb", "#8a6446", "#d9cdb8"].map((c) => W.mat({ color: c, gloss: 0.3 }));
  for (let r2 = 0; r2 < 3; r2++) for (let i = 0; i < 6; i++) W.mesh(box(gl, 0.2, 0.55 + ((i * 7 + r2) % 3) * 0.08, 0.45), books[(i + r2) % books.length], loft, false).position.set(3.4 + i * 0.32 + (r2 % 2) * 0.4, 1.64 + r2 * 1.0 + 0.3, -10.4);
  const rug = slab(gl, 9, 6, 0.03, 0.6, 0.012);
  const rg = group(W, loft);
  rg.rotation.x = -Math.PI / 2;
  rg.position.set(0, 0.016, 0.5);
  const rugM = W.mat({ color: "#d8cbb7", gloss: 0.1 });
  W.mesh(rug.front, rugM, rg, false);
  W.mesh(rug.body, rugM, rg, false);
  // Panels for the pop-out: a thin card with the picture's crop on its face.
  const panels: { node: Transform; front: Program }[] = [];
  const card = slab(gl, 1, 1, 0.03, 0.05, 0.012);
  const cardBack = W.mat({ color: "#f4f5f8", gloss: 0.5 });
  for (let i = 0; i < 4; i++) {
    const node = group(W);
    W.mesh(card.back, cardBack, node);
    W.mesh(card.body, cardBack, node);
    const front = W.mat({ color: "#000000", gloss: 0.9, kind: "screen" });
    W.mesh(quad(gl, 1, 1), front, node, false).position.z = 0.0165;
    node.visible = false;
    node.traverse((n) => void (n.visible = false));
    panels.push({ node, front });
  }
  return { lap, phone, tab, floor, floorMesh: f, wall, cove: c, candy, panels, stage, stagePlinth, arches, loft, loftTable, env: "studio", podium, podiumTop, ring };
}

/** Device finishes that suit the stage: silver on light stages, space grey on dark ones; the phone's back in a soft tint of the brand. */
function finish(sc: SkillContext, P: DeviceParts) {
  const light = !!sc.palette.light;
  const alu = rgb(light ? "#d9dce2" : "#7b808b");
  for (const m of [...P.lap.metal, ...P.phone.metal, ...P.tab.metal]) m.uniforms.uColor.value = alu;
  for (const s of [P.phone, P.tab]) if (s.back) s.back.uniforms.uColor.value = rgb(mixHex(light ? "#eceef2" : "#5d626c", sc.palette.primary, 0.22));
  P.wall.uniforms.uColor.value = rgb(envTone(sc, P.env));
  P.wall.uniforms.uGlowA.value = rgb(mixHex(sc.palette.primary, light ? "#ffffff" : "#000000", light ? 0.35 : 0.2));
  P.wall.uniforms.uGlowB.value = rgb(mixHex(sc.palette.secondary, light ? "#ffffff" : "#000000", light ? 0.35 : 0.2));
  const tints = [sc.palette.primary, sc.palette.secondary, sc.palette.accent, light ? "#e9ebf0" : "#c9ccd6", mixHex(sc.palette.primary, "#ffffff", 0.45), "#ffffff"];
  P.candy.forEach((c, i) => void (c.mat.uniforms.uColor.value = rgb(tints[i % tints.length])));
  P.podiumTop.uniforms.uColor.value = rgb(mixHex(studioTone(sc), light ? "#ffffff" : "#000000", 0.35));
  const pr = rgb(sc.palette.primary);
  P.ring.uniforms.uColor.value = pr;
  P.ring.uniforms.uEmit.value = pr.map((v) => v * 0.8);
  [sc.palette.primary, sc.palette.secondary, sc.palette.accent].forEach((c, i) => {
    const v = rgb(mixHex(c, "#ffffff", 0.15));
    P.arches[i].uniforms.uColor.value = v;
    P.arches[i].uniforms.uEmit.value = v.map((x) => x * 0.95);
  });
}

/** The environment for a slide: varied across a video's device slides, the same on every frame. */
function envFor(sc: SkillContext): Env {
  // (The dark stage suits dark palettes and the bright loft light ones, so the headline reads.)
  const pool: Env[] = sc.palette.light ? ["studio", "loft"] : ["studio", "stage"];
  return pool[(hashString(`${sc.scene.skill}:${sc.scene.text}`) + sc.seed) % pool.length];
}

/** The backdrop's colour in an environment. */
function envTone(sc: SkillContext, env: Env) {
  if (env === "stage") return mixHex("#0d0e14", sc.palette.primary, 0.1);
  if (env === "loft") return mixHex("#ece4d8", sc.palette.primary, 0.04);
  return studioTone(sc);
}

/** Show an environment's set. */
function setEnv(P: DeviceParts, env: Env) {
  P.env = env;
  const show2 = (n: Transform, on: boolean) => {
    n.visible = on;
    n.traverse((c) => void (c.visible = on));
  };
  show2(P.stage, env === "stage");
  show2(P.loft, env === "loft");
}

/** The studio's colour: a soft tint of the brand on light stages, a deep one on dark stages. */
const studioTone = (sc: SkillContext) => (sc.palette.light ? mixHex("#eceef3", sc.palette.primary, 0.07) : mixHex("#15171e", sc.palette.primary, 0.12));

/** The studio behind the headline (the same colour as the backdrop, lit from above). */
function studio(sc: SkillContext) {
  const { ctx, w, h } = sc;
  const env = envFor(sc);
  const tone = envTone(sc, env);
  const bright = env === "loft" || (env === "studio" && !!sc.palette.light);
  const g = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, Math.max(w, h) * 0.75);
  g.addColorStop(0, mixHex(tone, "#ffffff", bright ? 0.5 : 0.08));
  g.addColorStop(1, mixHex(tone, "#000000", bright ? 0.03 : 0.25));
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
  const surf = (n: Transform, v: boolean) => {
    n.visible = v;
    n.traverse((c) => void (c.visible = v));
  };
  surf(P.podium, on && P.env === "studio");
  surf(P.stagePlinth, on && P.env === "stage");
  surf(P.loftTable, on && P.env === "loft");
  P.floorMesh.position.y = on ? POD + 0.002 : 0.002;
}

/**
 * Render with depth of field: the devices (and what they stand on) pin-sharp, the backdrop, the
 * set and the floating shapes softly out of focus, like a photo taken with a fast lens.
 */
function renderDof(sc: SkillContext, W: World, P: DeviceParts, v: View, w: number, h: number): HTMLCanvasElement {
  const full = render(W, v, w, h);
  if (sc.flat3d) return full;
  const out = scratch("d3-dof", w, h);
  out.ctx.clearRect(0, 0, w, h);
  const blur = Math.max(2, w * 0.0065);
  out.ctx.filter = `blur(${blur.toFixed(1)}px)`;
  out.ctx.drawImage(full, 0, 0, w, h);
  out.ctx.filter = "none";
  // The in-focus pass: only the devices, their surface and the contact shadows.
  const off: Transform[] = [P.cove, P.stage, P.loft, ...P.candy.map((c) => c.node)];
  const was = off.map((n) => n.visible);
  for (const n of off) {
    n.visible = false;
    n.traverse((c) => void (c.visible = false));
  }
  const sharp = render(W, v, w, h);
  out.ctx.drawImage(sharp, 0, 0, w, h);
  off.forEach((n, i) => {
    n.visible = was[i];
    n.traverse((c) => void (c.visible = was[i]));
  });
  studioFinish(out.ctx, w, h, !!sc.palette.light);
  return out.canvas;
}

/**
 * A studio finish over a finished 3D frame: a soft bloom from the brightest parts (screens,
 * highlights), a gentle lens vignette and a light contrast grade. Steady from frame to frame.
 */
function studioFinish(ctx: CanvasRenderingContext2D, w: number, h: number, light: boolean) {
  const s = 6;
  const bw = Math.max(1, Math.round(w / s));
  const bh = Math.max(1, Math.round(h / s));
  const b = scratch("d3-bloom", bw, bh);
  b.ctx.clearRect(0, 0, bw, bh);
  // Keep the highlights only: darken and push contrast so mid-tones fall away, then blur.
  b.ctx.filter = `brightness(${light ? 0.6 : 0.7}) contrast(4.5) blur(${Math.max(2, bw * 0.02).toFixed(1)}px)`;
  b.ctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, bw, bh);
  b.ctx.filter = "none";
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = light ? 0.1 : 0.2;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(b.canvas, 0, 0, w, h);
  ctx.restore();
  // A lens vignette, kept subtle so headlines in the corners stay clear.
  const vg = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, light ? "rgba(20,24,40,0.12)" : "rgba(0,0,6,0.32)");
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
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
    // Three-point studio lighting: a cool fill opposite the key and softbox reflections in metal and glass.
    fill: light ? [0.16, 0.17, 0.2] : (rgb(mixHex("#9aa6c4", sc.palette.primary, 0.25)).map((v) => v * 0.22) as Num3),
    studio: light ? 0.75 : 1,
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
  for (const p of P.panels) p.node.traverse((n) => void (n.visible = false));
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
      setEnv(P, envFor(sc));
      finish(sc, P);
      show(P, { lap: true });
      onPodium(P, true);
      floatCandy(P, P.env === "loft" ? [] : CANDY_LAPTOP, t);
      P.lap.root.position.set(0, POD + 0.015, 0);
      P.lap.root.rotation.y = 0;
      const open = ease.inOutCubic(range(t, 0.15, 1.7));
      P.lap.hinge.rotation.x = lerp(Math.PI / 2 - 0.02, -0.3, open);
      paint(W, P.lap.screen, shot, LAP.scrW / LAP.scrH, ease.inOutCubic(range(t, 2.1, d - 0.4)), range(t, 1.1, 1.8), 0.02);
      blobs(P, [[0, -0.1, LAP.w / 2 - 0.1, LAP.d / 2 - 0.1]]);
      const k = ease.inOutCubic(range(t, 0, d * 0.75));
      const F = fit(sc, top);
      const eye = mixShot([4.4 * F, 1.35, 4.6 * F], [-1.5 * F, 2.4, 7.0 * F], k);
      // A dark-to-light reveal: the laptop starts as a silhouette with a bright rim and the light sweeps in.
      const L = lighting(sc);
      const lit = ease.inOutCubic(range(t, 0.05, 1.4));
      return renderDof(sc, W, P, { ...L, exposure: (L.exposure ?? 1) * lerp(0.3, 1, lit), rim: (L.rim ?? [0, 0, 0]).map((v) => v * lerp(3, 1, lit)) as Num3, eye: [eye[0], eye[1] + POD, eye[2]], target: [0, lerp(0.35, 0.78, open) + POD, -0.4], fov: 30, shadowSize: 3.5, shadowAt: [0, 0.8, -0.3] }, w, h);
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
      setEnv(P, envFor(sc));
      finish(sc, P);
      show(P, { phone: true });
      onPodium(P, true);
      floatCandy(P, P.env === "loft" ? [] : CANDY_PHONE.map(([x, y, z, k]) => [x, y + POD, z, k] as [number, number, number, number]), t);
      const turn = ease.inOutCubic(range(t, 0.1, 1.9));
      const bob = Math.sin(t * 1.6) * 0.04;
      P.phone.root.position.set(0, 1.05 + POD + bob, 0);
      P.phone.root.rotation.set(lerp(0.25, 0.08, turn), lerp(Math.PI + 0.5, -0.32, turn) + Math.sin(t * 0.9) * 0.04, lerp(-0.15, 0.04, turn));
      paint(W, P.phone.screen, shot, PHONE.scrW / PHONE.scrH, ease.inOutCubic(range(t, 2.2, d - 0.4)), range(t, 1.2, 1.9), 0.075);
      blobs(P, [[0, 0, 0.18, 0.06]]);
      const F = fit(sc, top);
      return renderDof(sc, W, P, { ...lighting(sc), eye: [0.25 * F, 1.5 + POD, 5.4 * F], target: [0, 0.95 + POD, 0], fov: 26, shadowSize: 2.8, shadowAt: [0, 0.8, 0] }, w, h);
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
      setEnv(P, envFor(sc));
      finish(sc, P);
      show(P, { lap: true, phone: true, tab: true });
      onPodium(P, false);
      floatCandy(P, P.env === "loft" ? [] : CANDY_LINEUP, t);
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
      paint(W, P.phone.screen, shotOf(sc, true), PHONE.scrW / PHONE.scrH, scroll, range(t, 0.7, 1.3), 0.075);
      blobs(P, [
        [0, -0.1, LAP.w / 2 - 0.1, LAP.d / 2 - 0.1],
        [-2.75, 0.1, 0.8, 0.06],
        [2.45, 0.55, 0.3, 0.05],
      ]);
      const k = ease.inOutCubic(range(t, 0, d));
      const F = fit(sc, top);
      const eye: Num3 = [lerp(-2.2, 2.2, k), 2.3, 9.4 * F];
      return renderDof(sc, W, P, { ...lighting(sc), eye, target: [lerp(-0.5, 0.5, k), 0.95, 0], fov: 30, shadowSize: 5, shadowAt: [0, 0.8, 0] }, w, h);
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
      setEnv(P, envFor(sc));
      finish(sc, P);
      show(P, { lap: true });
      onPodium(P, true);
      floatCandy(P, P.env === "loft" ? [] : CANDY_LAPTOP, t);
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
      return renderDof(sc, W, P, { ...lighting(sc), eye, target, fov, shadowSize: 3.5, shadowAt: [0, 0.8, -0.3] }, cw, ch);
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

/* ───────────────────────── Modern launch-video shots ───────────────────────── */

/** The laptop screen's centre and axes when the lid leans back by `lean` (on the podium). */
function screenFrame(lean: number) {
  const hy = LAP.t + POD + 0.015;
  const hz = -LAP.d / 2 + 0.06;
  const cy = LAP.lidH / 2 + 0.04;
  const up: Num3 = [0, Math.cos(lean), Math.sin(lean)];
  const n: Num3 = [0, -Math.sin(lean), Math.cos(lean)];
  return { c: [0, hy + up[1] * cy, hz + up[2] * cy] as Num3, up, n };
}
const add3 = (a: Num3, ...bs: [Num3, number][]): Num3 => bs.reduce<Num3>((o, [b, k]) => [o[0] + b[0] * k, o[1] + b[1] * k, o[2] + b[2] * k], [a[0], a[1], a[2]]);

type Crop = { r: [number, number, number, number]; aspect: number };
/** Where the designed dashboard's cards sit (fractions of the screen), largest first. */
const DESK_CROPS: [number, number, number, number][] = [
  [0.194, 0.306, 0.525, 0.4],
  [0.734, 0.306, 0.235, 0.4],
  [0.194, 0.132, 0.186, 0.15],
  [0.194, 0.73, 0.775, 0.25],
];

/** The parts of the screen to lift out: the dashboard's cards, the page's own sections, or bands of the first screens. */
function cropsFor(sc: SkillContext, shot: Drawable | HTMLCanvasElement): Crop[] {
  const { w: iw, h: ih } = sizeOf(shot);
  const mk = (r: [number, number, number, number]): Crop => ({ r, aspect: (r[2] * iw) / Math.max(1, r[3] * ih) });
  if (shot instanceof HTMLCanvasElement) return DESK_CROPS.map(mk);
  const page = sc.brand?.page;
  if (page && picOf(sc, page.src) === shot) {
    const bands = page.bands.filter(([a, b]) => (b - a) * ih > 180 && (b - a) * ih < 1300).slice(0, 4);
    if (bands.length >= 2) return bands.map(([a, b]) => mk([0.03, a, 0.94, b - a]));
  }
  const win = Math.min(1, iw / 1.6 / ih);
  return [
    [0, 0, 1, win * 0.45],
    [0.04, win * 0.45, 0.45, win * 0.5],
    [0.51, win * 0.45, 0.45, win * 0.5],
    [0, Math.min(1 - win * 0.5, win), 1, Math.min(win * 0.5, 1 - win)],
  ]
    .filter((r) => r[3] > 0.02)
    .map((r) => mk(r as [number, number, number, number]));
}

/** A small pill label in screen space. */
function pill(sc: SkillContext, x: number, y: number, text: string, k: number, lit: boolean, alignLeft: boolean) {
  if (k <= 0) return;
  const { ctx, u, palette } = sc;
  const size = 20 * u * (sc.h > sc.w ? 1.3 : 1.15);
  ctx.save();
  ctx.font = subFont(size, 700);
  const tw = ctx.measureText(text).width + size * 1.8;
  const th = size * 2;
  const x0 = alignLeft ? x : x - tw;
  ctx.globalAlpha *= clamp(k * 1.6) * (1 - exitOf(sc));
  ctx.translate(0, (1 - Math.min(1, k)) * 10 * u);
  ctx.shadowColor = "rgba(15,15,30,0.25)";
  ctx.shadowBlur = 18 * u;
  ctx.shadowOffsetY = 6 * u;
  ctx.fillStyle = lit ? palette.primary : "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.roundRect(x0, y - th / 2, tw, th, th / 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = lit ? "#ffffff" : "#16182a";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  fillTextFit(ctx, text, x0 + size * 0.9, y, tw - size * 1.4, { maxLines: 1, minScale: 0.6 });
  ctx.restore();
}

/** Where each lifted panel floats (screen right, up, out from the screen), by order. */
const POP_SPOTS: Num3[] = [
  [-0.55, 0.12, 0.7],
  [1.05, 0.38, 1.05],
  [-1.15, 0.85, 1.3],
  [0.95, -0.45, 1.5],
];

function d3Popout(sc: SkillContext) {
  const { t, d, scene } = sc;
  studio(sc);
  const st = stage(sc);
  const top = st.top - 20 * sc.u;
  const shot = shotOf(sc);
  const crops = cropsFor(sc, shot).slice(0, 4);
  const labels = (scene.items ?? []).map((x) => split(x).title.replace(/\*/g, "").trim()).filter(Boolean);
  const n = crops.length;
  const T = pointTimes(scene, n, 1.0);
  let tags: { x: number; y: number; left: boolean; i: number }[] = [];
  frame(
    sc,
    top,
    (w, h) => {
      const R = world("devices", w, h, devicesWorld);
      if (!R) return null;
      const { W, parts: P } = R;
      setEnv(P, envFor(sc));
      finish(sc, P);
      show(P, { lap: true });
      onPodium(P, true);
      floatCandy(P, P.env === "loft" ? [] : CANDY_LAPTOP.slice(0, 3).map(([x, y, z, k]) => [x * 1.25, y + 0.4, z - 1.2, k] as [number, number, number, number]), t);
      const lean = -0.3;
      P.lap.root.position.set(0, POD + 0.015, 0);
      P.lap.root.rotation.y = 0;
      P.lap.hinge.rotation.x = lean;
      paint(W, P.lap.screen, shot, LAP.scrW / LAP.scrH, 0, 1, 0.02);
      blobs(P, [[0, -0.1, LAP.w / 2 - 0.1, LAP.d / 2 - 0.1]]);
      const F = screenFrame(lean);
      const right: Num3 = [1, 0, 0];
      const tex = textureOf(W.renderer, asCanvas(shot));
      tags = [];
      crops.forEach((cr, i) => {
        const p = P.panels[i];
        const k = ease.outCubic(clamp((t - T[i]) / 0.9));
        const on = t >= T[i] - 0.05;
        p.node.traverse((x) => void (x.visible = on));
        if (!on) return;
        setCrop(p.front, tex, cr.r, cr.aspect, 1, 0.045);
        // From its own place on the screen, out into the air in front of it.
        const u0 = cr.r[0] + cr.r[2] / 2 - 0.5;
        const v0 = 0.5 - clamp(cr.r[1] + cr.r[3] / 2);
        const start = add3(F.c, [right, u0 * LAP.scrW], [F.up, v0 * LAP.scrH], [F.n, 0.01]);
        const spot = POP_SPOTS[i];
        const bob = Math.sin(t * 1.3 + i * 1.9) * 0.035 * k;
        const end = add3(F.c, [right, spot[0]], [F.up, spot[1] + bob], [F.n, spot[2]]);
        const pos = mixShot(start, end, k);
        p.node.position.set(pos[0], pos[1], pos[2]);
        const w0 = cr.r[2] * LAP.scrW;
        const h0 = cr.r[3] * LAP.scrH;
        const w1 = Math.min(1.9, Math.sqrt(0.75 * cr.aspect));
        const h1 = Math.min(1.05, w1 / cr.aspect);
        const ww = lerp(w0, h1 * cr.aspect < w1 ? h1 * cr.aspect : w1, k);
        const hh = lerp(h0, h1 * cr.aspect < w1 ? h1 : w1 / cr.aspect, k);
        p.node.scale.set(ww, hh, 1);
        p.node.rotation.set(lean + (1 - k) * 0 + k * 0.04, -spot[0] * 0.14 * k, 0);
        tags.push({ i, left: spot[0] > 0, ...(() => {
          const corner = add3(pos, [right, (spot[0] > 0 ? 1 : -1) * ww * 0.5], [F.up, hh * 0.32]);
          const q = project(W, corner, w, h);
          return { x: q.x, y: q.y + top };
        })() });
      });
      const k = sine(range(t, 0, d));
      const eye: Num3 = [lerp(3.1, 1.6, k), POD + lerp(1.55, 1.9, k), lerp(5.4, 6.4, k) * fit(sc, top)];
      return renderDof(sc, W, P, { ...lighting(sc), eye, target: [0, POD + 1.15, 0.1], fov: 32, shadowSize: 4.5, shadowAt: [0, 0.9, 0] }, w, h);
    },
    () => flat(sc, shot, top),
  );
  tags.forEach((g) => {
    const txt = labels[g.i];
    if (!txt) return;
    pill(sc, g.x + (g.left ? 10 : -10) * sc.u, g.y, txt, clamp((t - T[g.i] - 0.45) / 0.4), false, g.left);
  });
}

const sine = (k: number) => 0.5 - Math.cos(Math.PI * clamp(k)) / 2;

function d3Macro(sc: SkillContext) {
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
      setEnv(P, envFor(sc));
      finish(sc, P);
      show(P, { lap: true });
      onPodium(P, true);
      floatCandy(P, P.env === "loft" ? [] : CANDY_LAPTOP, t);
      P.lap.root.position.set(0, POD + 0.015, 0);
      P.lap.root.rotation.y = 0;
      P.lap.hinge.rotation.x = -0.3;
      paint(W, P.lap.screen, shot, LAP.scrW / LAP.scrH, ease.inOutCubic(range(t, d * 0.55, d - 0.3)), 1, 0.02);
      blobs(P, [[0, -0.1, LAP.w / 2 - 0.1, LAP.d / 2 - 0.1]]);
      // A slow glide along the keyboard and the edge, close enough to see the keys, then the pull back to the reveal.
      const glide = sine(range(t, 0, d * 0.62));
      const back = sine(range(t, d * 0.5, d - 0.25));
      const F = fit(sc, top);
      const g0: Num3 = mixShot([-2.0, POD + 0.34, 1.35], [1.25, POD + 0.62, 1.55], glide);
      const g1: Num3 = mixShot([-1.15, POD + 0.12, 0.45], [0.55, POD + 0.62, -0.2], glide);
      const eye = mixShot(g0, [1.9 * F, POD + 1.75, 6.3 * F], back);
      const target = mixShot(g1, [0, POD + 0.82, -0.3], back);
      return renderDof(sc, W, P, { ...lighting(sc), eye, target, fov: lerp(26, 30, back), shadowSize: 3.5, shadowAt: [0, 0.8, -0.3] }, w, h);
    },
    () => flat(sc, shot, top),
  );
}

/** Words of a headline with *accent* marks, for drawing word by word. */
function words(text: string) {
  const out: { w: string; accent: boolean }[] = [];
  let accent = false;
  for (const part of text.split(/(\*)/)) {
    if (part === "*") {
      accent = !accent;
      continue;
    }
    for (const w of part.split(/\s+/).filter(Boolean)) out.push({ w, accent });
  }
  return out;
}

function d3Split(sc: SkillContext) {
  const { ctx, t, d, w, h, u, palette, scene } = sc;
  studio(sc);
  const narrow = h > w * 0.85;
  if (narrow) {
    // Vertical frames have no room beside the device: the usual layout (an app's on the phone).
    return sc.app && !scene.media ? d3Phone(sc) : d3Laptop(sc);
  }
  const phone = (!!sc.brand?.mobile || !!sc.app) && !scene.media;
  const shot = shotOf(sc, phone);
  // The device on the right, turning slowly towards the words.
  frame(
    sc,
    0,
    (cw, ch) => {
      const R = world("devices", cw, ch, devicesWorld);
      if (!R) return null;
      const { W, parts: P } = R;
      setEnv(P, envFor(sc));
      finish(sc, P);
      show(P, phone ? { phone: true } : { lap: true });
      onPodium(P, true);
      // (The shapes stay on the device's side, clear of the words.)
      floatCandy(P, P.env === "loft" ? [] : [
        [2.4, 2.3, -1.0, 0.8],
        [2.9, 1.0, 0.9, 0.7],
        [1.3, 3.0, -1.8, 0.7],
      ], t);
      const turn = sine(range(t, 0, d));
      if (phone) {
        P.phone.root.position.set(0, POD + 1.05 + Math.sin(t * 1.4) * 0.03, 0);
        P.phone.root.rotation.set(0.06, lerp(-0.62, -0.32, turn), 0.03);
        paint(W, P.phone.screen, shot, PHONE.scrW / PHONE.scrH, ease.inOutCubic(range(t, 1.2, d - 0.4)), range(t, 0.2, 0.8), 0.075);
        blobs(P, [[0, 0, 0.18, 0.06]]);
      } else {
        P.lap.root.position.set(0, POD + 0.015, 0);
        P.lap.root.rotation.y = lerp(-0.55, -0.3, turn);
        P.lap.hinge.rotation.x = lerp(Math.PI / 2 - 0.02, -0.3, ease.inOutCubic(range(t, 0.1, 1.4)));
        paint(W, P.lap.screen, shot, LAP.scrW / LAP.scrH, ease.inOutCubic(range(t, 1.8, d - 0.4)), range(t, 0.8, 1.4), 0.02);
        blobs(P, [[0, -0.1, LAP.w / 2 - 0.1, LAP.d / 2 - 0.1]]);
      }
      // Framed so the device sits in the right half of the frame.
      const eye: Num3 = phone ? [-1.45, POD + 1.35, 4.6] : [-2.5, POD + 2.0, 8.4];
      const target: Num3 = phone ? [-1.1, POD + 1.05, 0] : [-1.75, POD + 0.8, -0.2];
      return renderDof(sc, W, P, { ...lighting(sc), eye, target, fov: phone ? 28 : 31, shadowSize: 4, shadowAt: [0, 0.8, 0] }, cw, ch);
    },
    () => flat(sc, shot, 0),
  );
  // The words on the left: a big headline (accent words in the brand's colour), a line under it, and checked points.
  const x0 = w * 0.075;
  const colW = w * 0.4;
  const size = Math.min(h * 0.085, w * 0.05);
  ctx.save();
  ctx.globalAlpha = 1 - exitOf(sc);
  ctx.font = displayFont(saasFont(sc), size);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const ws = words(scene.text || "Your product");
  const lines: { w: string; accent: boolean }[][] = [[]];
  let lw = 0;
  const space = ctx.measureText(" ").width;
  for (const wd of ws) {
    const ww = ctx.measureText(wd.w).width;
    if (lw > 0 && lw + space + ww > colW) {
      lines.push([]);
      lw = 0;
    }
    lines[lines.length - 1].push(wd);
    lw += (lw > 0 ? space : 0) + ww;
  }
  const sub = scene.subtext?.replace(/\*/g, "");
  const pts = itemsOr(scene, [], 3, 1).map((x) => split(x).title.replace(/\*/g, "").trim()).filter(Boolean);
  const lh = size * 1.08;
  const blockH = lines.length * lh + (sub ? size * 1.2 : 0) + pts.length * size * 0.95;
  let y = h / 2 - blockH / 2 + size * 0.85;
  lines.forEach((ln, i) => {
    const k = ease.outCubic(clamp((t - 0.25 - i * 0.12) / 0.6));
    let x = x0;
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.translate(0, (1 - k) * size * 0.5);
    for (const wd of ln) {
      ctx.fillStyle = wd.accent ? palette.primary : palette.text;
      ctx.fillText(wd.w, x, y);
      x += ctx.measureText(wd.w).width + space;
    }
    ctx.restore();
    y += lh;
  });
  if (sub) {
    const k = ease.outCubic(clamp((t - 0.6) / 0.6));
    ctx.globalAlpha = (1 - exitOf(sc)) * k * 0.82;
    ctx.fillStyle = palette.text;
    ctx.font = subFont(size * 0.36, 500);
    fillTextFit(ctx, sub, x0, y + size * 0.1, colW, { maxLines: 2, lineHeight: 1.3, minScale: 0.7 });
    y += size * 1.2;
  }
  pts.forEach((pt, i) => {
    const k = ease.outCubic(clamp((t - 0.9 - i * 0.25) / 0.5));
    if (k <= 0) return;
    ctx.globalAlpha = (1 - exitOf(sc)) * k;
    const cy = y + i * size * 0.95;
    const r = size * 0.2;
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.arc(x0 + r, cy - r * 0.9, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.5, r * 0.28);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0 + r * 0.55, cy - r * 0.95);
    ctx.lineTo(x0 + r * 0.9, cy - r * 0.6);
    ctx.lineTo(x0 + r * 1.5, cy - r * 1.3);
    ctx.stroke();
    ctx.fillStyle = palette.text;
    ctx.font = subFont(size * 0.38, 600);
    ctx.fillText(pt, x0 + r * 2.8, cy - r * 0.55 + size * 0.12);
  });
  ctx.restore();
  void u;
}

/* The floating screen wall */

interface WallParts {
  slates: { node: Transform; screen: Program; wide: boolean; base: Num3 }[];
  frameM: Program;
}

function wallWorld(W: World): WallParts {
  const { gl } = W;
  const frameM = W.mat({ color: "#1a1c22", metal: 0.6, gloss: 0.8 });
  const glassM = W.mat({ color: "#07080b", gloss: 0.95 });
  const wideG = slab(gl, 1.7, 1.08, 0.05, 0.07, 0.02);
  const tallG = slab(gl, 0.62, 1.3, 0.05, 0.09, 0.02);
  const slates: WallParts["slates"] = [];
  const layout: [number, number, boolean][] = [
    [-4.2, 0.9, true], [-2.3, 1.1, false], [-0.6, 0.85, true], [1.3, 1.15, false], [3.0, 0.9, true], [4.9, 1.1, false],
    [-3.3, -0.5, false], [-1.5, -0.45, true], [0.45, -0.55, false], [2.2, -0.45, true], [4.1, -0.5, false],
  ];
  for (const [x, y, wide] of layout) {
    const node = new (W.scene.constructor as new () => Transform)();
    node.setParent(W.scene);
    const g = wide ? wideG : tallG;
    W.mesh(g.front, glassM, node, false);
    W.mesh(g.body, frameM, node, false);
    W.mesh(g.back, frameM, node, false);
    const screen = W.mat({ color: "#000000", gloss: 0.9, kind: "screen" });
    const q = W.mesh(quad(gl, wide ? 1.62 : 0.57, wide ? 1.0 : 1.24), screen, node, false);
    q.position.z = 0.027;
    const z = -0.09 * x * x;
    node.position.set(x, y, z);
    node.rotation.y = -x * 0.09;
    slates.push({ node, screen, wide, base: [x, y, z] });
  }
  return { slates, frameM };
}

function d3Wall(sc: SkillContext) {
  const { t, d, palette } = sc;
  studio(sc);
  const st = stage(sc);
  const top = st.top - 20 * sc.u;
  const desk = shotOf(sc);
  const mob = shotOf(sc, true);
  const name = (sc.brand?.name ?? "").replace(/[*|]/g, "").trim();
  const extraD = desktopUI(palette, name, sc.seed + 1);
  const extraM = mobileUI(palette, name, sc.seed + 1);
  frame(
    sc,
    top,
    (w, h) => {
      const R = world("wall", w, h, wallWorld);
      if (!R) return null;
      const { W, parts } = R;
      parts.frameM.uniforms.uColor.value = rgb(palette.light ? "#d6d9df" : "#2a2c33");
      parts.slates.forEach((s, i) => {
        const pic = s.wide ? (i % 3 === 1 ? extraD : desk) : i % 2 ? extraM : mob;
        paint(W, s.screen, pic, s.wide ? 1.62 : 0.57 / 1.24, ((i * 0.37) % 1) * 0.6 + range(t, 0.5, d) * 0.25, range(t, 0.15 + i * 0.06, 0.6 + i * 0.06), s.wide ? 0.03 : 0.08);
        const rise = ease.outCubic(range(t, 0.05 + i * 0.05, 0.9 + i * 0.05));
        s.node.position.set(s.base[0], s.base[1] + Math.sin(t * 0.9 + i * 1.3) * 0.05 - (1 - rise) * 0.6, s.base[2] - (1 - rise) * 1.5);
      });
      const k = sine(range(t, 0, d));
      const F = fit(sc, top);
      const tone = rgb(envTone(sc, "studio"));
      return render(W, { ...lighting(sc), eye: [lerp(-1.8, 1.8, k), 0.5, lerp(6.6, 5.9, k) * F], target: [lerp(-0.6, 0.6, k), 0.3, -1], fov: 34, shadowSize: 6, fog: [tone[0], tone[1], tone[2], 0.045] }, w, h);
    },
    () => flat(sc, desk, top),
  );
}

interface DeskParts {
  lap: Laptop;
  phone: Slate;
  tab: Slate;
  mug: Program;
  coaster: Program;
  pot: Program;
  top: Program;
  mat: Program;
}

function deskWorld(W: World): DeskParts {
  const { gl } = W;
  // The desk top (in the video's colours, see d3Desk): thick, with softly rounded corners and
  // edges, big enough to fill the frame; a felt desk mat under the laptop.
  const top = slab(gl, 9, 5, 0.2, 0.34, 0.08);
  const desk = group(W);
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -0.1;
  const surface = W.mat({ color: "#9c7350", gloss: 0.38 });
  W.mesh(top.front, surface, desk, false);
  W.mesh(top.body, surface, desk, false);
  const pad = slab(gl, 4.4, 2.9, 0.035, 0.22, 0.016);
  const matG = group(W);
  matG.rotation.set(-Math.PI / 2, 0, 0.18);
  matG.position.set(-0.25, 0.0, -0.05);
  const mat = W.mat({ color: "#2b2f38", gloss: 0.12 });
  W.mesh(pad.front, mat, matG, false);
  W.mesh(pad.body, mat, matG, false);
  const lap = laptop(W);
  lap.root.position.set(-0.3, 0.02, -0.2);
  lap.root.rotation.y = 0.18;
  lap.hinge.rotation.x = -0.32;
  const phone = slate(W, PHONE, true);
  phone.root.rotation.set(-Math.PI / 2, 0, -0.35);
  phone.root.position.set(2.3, PHONE.t / 2, 0.85);
  // A tablet lying on the desk with a stylus beside it (it shows the product too).
  const tab = slate(W, TAB, false);
  tab.root.rotation.set(-Math.PI / 2, 0, 0.28);
  tab.root.scale.set(0.66, 0.66, 0.66);
  tab.root.position.set(-2.95, (TAB.t / 2) * 0.66, 0.75);
  const penMat = W.mat({ color: "#f2f3f6", gloss: 0.7 });
  const pen = W.mesh(cylinder(gl, 0.028, 0.028, 1.05, 20), penMat);
  pen.rotation.set(0, 0.4, Math.PI / 2);
  pen.position.set(-2.15, 0.03, 1.25);
  const nib = W.mesh(cylinder(gl, 0.004, 0.028, 0.09, 20), W.mat({ color: "#c9ccd3", metal: 0.6, gloss: 0.8 }));
  nib.rotation.set(0, 0.4, Math.PI / 2);
  nib.position.set(-2.15 - Math.cos(0.4) * 0.57, 0.03, 1.25 + Math.sin(0.4) * 0.57);
  // A ceramic mug on a coaster: real walls with a rounded lip, coffee inside, a looped handle.
  const coasterM = W.mat({ color: "#c9a27a", gloss: 0.15 });
  const coaster = W.mesh(lathe(gl, [[0, 0], [0.37, 0], [0.4, 0.015], [0.4, 0.03], [0.37, 0.045], [0, 0.045]], 48), coasterM);
  coaster.position.set(2.55, 0, -0.7);
  const mug = W.mat({ color: "#7c5cff", gloss: 0.78 });
  const cup = W.mesh(
    lathe(gl, [[0, 0.045], [0.2, 0.045], [0.225, 0.07], [0.24, 0.16], [0.25, 0.5], [0.252, 0.555], [0.245, 0.575], [0.232, 0.575], [0.224, 0.555], [0.215, 0.18], [0.19, 0.1], [0, 0.1]], 56),
    mug,
  );
  cup.position.set(2.55, 0, -0.7);
  const handle = W.mesh(torus(gl, 0.13, 0.034, Math.PI * 1.25, 32, 14), mug);
  handle.position.set(2.55 + 0.25, 0.32, -0.7);
  handle.scale.set(0.9, 1.15, 1);
  const coffee = W.mesh(cylinder(gl, 0.22, 0.22, 0.01, 48), W.mat({ color: "#5b3a26", gloss: 0.85 }), W.scene, false);
  coffee.position.set(2.55, 0.47, -0.7);
  const crema = W.mesh(cylinder(gl, 0.15, 0.15, 0.012, 40), W.mat({ color: "#a8754d", gloss: 0.6 }), W.scene, false);
  crema.position.set(2.53, 0.472, -0.69);
  // A potted plant: a glazed pot with a rolled rim, dark soil, and arching leaves in two greens.
  const potM = W.mat({ color: "#e8e2d8", gloss: 0.55 });
  const pot = W.mesh(lathe(gl, [[0, 0], [0.24, 0], [0.27, 0.03], [0.33, 0.5], [0.37, 0.52], [0.38, 0.57], [0.36, 0.6], [0.32, 0.6], [0.31, 0.56]], 48), potM);
  pot.position.set(-3.1, 0, -1.2);
  const soil = W.mesh(cylinder(gl, 0.315, 0.315, 0.02, 40), W.mat({ color: "#3a2a20", gloss: 0.05 }), W.scene, false);
  soil.position.set(-3.1, 0.54, -1.2);
  const greens = [W.mat({ color: "#3f8f4e", gloss: 0.55 }), W.mat({ color: "#5fae5a", gloss: 0.55 }), W.mat({ color: "#2f7a45", gloss: 0.5 })];
  const plant = group(W);
  plant.position.set(-3.1, 0.54, -1.2);
  const N = 11;
  for (let i = 0; i < N; i++) {
    const inner = i < 4;
    const len = inner ? 0.95 + (i % 2) * 0.18 : 0.72 + ((i * 37) % 5) * 0.06;
    const g = group(W, plant);
    g.rotation.y = i * 2.39996;
    const l = W.mesh(leaf(gl, len, inner ? 0.26 : 0.3, inner ? 0.25 : 0.55, 0.3), greens[i % 3], g);
    l.rotation.x = -(inner ? 0.12 + (i % 2) * 0.1 : 0.42 + ((i * 13) % 4) * 0.08);
    l.position.set(0, 0, 0);
  }
  return { lap, phone, tab, mug, coaster: coasterM, pot: potM, top: surface, mat };
}

function d3Desk(sc: SkillContext) {
  const { t, d, palette } = sc;
  const tabShot = desktopUI(palette, (sc.brand?.name ?? "").replace(/[*|]/g, "").trim(), sc.seed + 2);
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
      // The desk is a surface in the video's own colours (a soft tint on light styles, a deep
      // brand tone on dark ones), the mug and notebook in its other colours, so they stand out.
      const deskHex = light ? mixHex(palette.primary, "#ffffff", 0.72) : mixHex(palette.primary, palette.bg1, 0.66);
      P.top.uniforms.uColor.value = rgb(deskHex);
      P.mat.uniforms.uColor.value = rgb(light ? mixHex(palette.primary, "#ffffff", 0.45) : mixHex(palette.primary, "#05060a", 0.72));
      // The mug in whichever of the video's colours (or white glaze) stands out most from the desk.
      const far = (hex: string) => rgb(hex).reduce((a, v, i) => a + (v - rgb(deskHex)[i]) ** 2, 0);
      P.mug.uniforms.uColor.value = rgb([palette.accent, palette.secondary, "#f3f1ec"].reduce((a, b) => (far(b) > far(a) * 1.15 ? b : a)));
      P.coaster.uniforms.uColor.value = rgb(light ? "#d9c3a5" : "#b08a64");
      P.pot.uniforms.uColor.value = rgb(mixHex(palette.secondary, "#f4f1ec", light ? 0.75 : 0.6));
      for (const m of P.tab.metal) m.uniforms.uColor.value = rgb(light ? "#d9dce2" : "#8a8f99");
      paint(W, P.tab.screen, tabShot, TAB.scrW / TAB.scrH, ease.inOutCubic(range(t, 1.4, d - 0.4)), range(t, 0.3, 0.9), 0.04);
      paint(W, P.lap.screen, shot, LAP.scrW / LAP.scrH, ease.inOutCubic(range(t, 1.2, d - 0.4)), range(t, 0.1, 0.7), 0.02);
      paint(W, P.phone.screen, shotOf(sc, true), PHONE.scrW / PHONE.scrH, ease.inOutCubic(range(t, 1.6, d - 0.4)), range(t, 0.4, 1.0), 0.075);
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
    bestFor: "Multi-device moments: the same product on laptop, tablet and phone; a short headline. Uses the site's desktop and mobile screenshots automatically.",
    sample: { text: "On your *screens*" },
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
    id: "d3-popout",
    name: "3D UI Pop-out",
    tagline: "The product's cards and sections lift off a 3D laptop's screen and float in front of it in depth with their labels, like a launch film.",
    bestFor: "Showing 2–4 features or parts of the product at once; uses the site's own sections (or a designed dashboard) automatically.",
    sample: { text: "Your work in *one place*", items: ["Live progress", "Team focus", "Quick stats", "Recent work"] },
    itemsHint: "0–4 short labels for the lifted parts",
    render: d3Popout,
    sfx: (scene: Scene) => pointTimes(scene, 4, 1.0).map((ti) => at(ti, "swoosh")),
  },
  {
    id: "d3-macro",
    name: "3D Macro Glide",
    tagline: "An extreme close-up glides along the laptop's keys and edge with a shallow focus, then pulls back to reveal the screen.",
    bestFor: "A premium, crafted moment before or after a reveal; a short headline.",
    sample: { text: "Crafted to the *detail*" },
    render: d3Macro,
    sfx: () => [at(0.2, "whoosh")],
  },
  {
    id: "d3-split",
    name: "3D Split Hero",
    tagline: "A big headline with a line and checked points on the left; a 3D laptop (or the phone, for mobile sites) turns slowly on the right.",
    bestFor: "A hero or 'meet the product' beat with a headline, an optional line and up to 3 short points.",
    sample: { text: "Plan, ship and *celebrate*", subtext: "One workspace for your team", items: ["Plans in minutes", "Live progress", "Easy hand-offs"] },
    itemsHint: "0–3 short points",
    render: d3Split,
    sfx: () => [at(0.25, "whoosh"), at(0.9, "pop")],
  },
  {
    id: "d3-wall",
    name: "3D Screen Wall",
    tagline: "A curved wall of floating screens (desktop and phone) shows the product from many angles as the camera drifts across it.",
    bestFor: "Multi-device or 'made for your screens' moments; a short headline.",
    sample: { text: "Made for your *screens*" },
    render: d3Wall,
    sfx: () => [at(0.1, "shimmer")],
  },
  {
    id: "d3-desk",
    name: "3D Desk",
    tagline: "A real 3D desk in your colours from above: the laptop with your site, a phone with your app, a tablet, a mug of coffee and a potted plant, the camera circling slowly.",
    bestFor: "Work, productivity and 'your day' stories: a short headline.",
    sample: SAMPLE,
    render: d3Desk,
    sfx: () => [at(0.2, "whoosh")],
  },
];
