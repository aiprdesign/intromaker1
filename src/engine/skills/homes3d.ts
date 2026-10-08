/**
 * Homebuilder slides in real 3D (see d3.ts), in the manner of the big homebuilders' videos: warm
 * golden-hour light with long soft shadows, a modelled two-storey home (stone base, siding, gable
 * roofs, a covered porch, a two-car garage, lit windows, landscaping), whole communities from the
 * air, and elegant labels. The front door takes the brand's colour.
 *
 * - home-hero:    the home at golden hour; the camera arcs slowly across the front, windows glowing.
 * - home-aerial:  a drone flyover of a new community (streets, homes, a park with a pond, a pool and
 *                 clubhouse); pins rise over the places your points name.
 * - home-build3d: the home is built in front of you: slab, framing, walls and windows, roof, then
 *                 the garden, as the steps tick off.
 * - home-plan:    a floor plan seen from above; walls rise and the camera tilts into a 3D plan with
 *                 furniture, the rooms labelled.
 * - home-energy:  the home's efficient features called out one by one: solar panels, insulated walls,
 *                 double-pane windows, a high-efficiency system.
 * - home-choice:  the same home restyled per option (farmhouse, craftsman, modern, coastal…).
 * - home-journey: the camera walks up the path to the front door past a sign for each step of buying.
 * - home-walkthrough: one seamless glide through a furnished home, room to room, out to the patio.
 * - home-family:  a happy family and their dog in the living room, the camera arcing round.
 * - home-welcome: the family and dog wave from the path of the home at golden hour; the button.
 */
import { Texture, Transform, type Program } from "ogl";
import { box, cylinder, gable, project, quad, render, rgb, slab, sphere, sphereCap, world, type View, type World } from "../d3";
import { clamp, ease, lerp, mixHex, range, TAU } from "../math";
import { fillTextFit, subFont } from "../text";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { exitOf, itemsOr, split, stage } from "./beats";
import { pointTimes } from "./characters";
import { speechNow, type Viseme } from "../speech";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const plain = (s: string) => s.replace(/\*/g, "").trim();
type Num3 = [number, number, number];
const INK = "#1d1b26";
const sine = (k: number) => 0.5 - Math.cos(Math.PI * clamp(k)) / 2;

/* ───────────────────────── Look ───────────────────────── */

const onLight = (p: Palette): Palette => (p.light ? p : { ...p, text: INK, light: true, bg0: "#f7f5f2", bg1: "#ffffff" });

/** A golden-hour sky: deep blue overhead warming to a peach horizon. */
function sky(sc: SkillContext, horizon = 0.62) {
  const { ctx, w, h, palette } = sc;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mixHex("#6e9fd6", palette.primary, 0.08));
  g.addColorStop(horizon * 0.7, "#b9d2ea");
  g.addColorStop(horizon, "#fbe3c4");
  g.addColorStop(1, "#f6d7b0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // A low warm sun glow and a few soft, still clouds.
  const sun = ctx.createRadialGradient(w * 0.82, h * horizon * 0.86, 0, w * 0.82, h * horizon * 0.86, w * 0.42);
  sun.addColorStop(0, "rgba(255,236,200,0.55)");
  sun.addColorStop(1, "rgba(255,236,200,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.filter = `blur(${Math.round(w * 0.006)}px)`;
  for (const [cx, cy, s] of [[0.18, 0.16, 1], [0.46, 0.09, 0.7], [0.68, 0.22, 0.85]] as const) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (const [dx, dy, r] of [[0, 0, 0.05], [0.045, 0.012, 0.038], [-0.045, 0.014, 0.034], [0.085, 0.022, 0.026], [-0.08, 0.024, 0.022]] as const) {
      ctx.beginPath();
      ctx.ellipse(w * (cx + dx * s), h * (cy + dy * s), w * r * s, w * r * s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  // Flat (2D) views look straight on, so the lawn runs on under the horizon.
  if (sc.flat3d) {
    ctx.fillStyle = "#78ad55";
    ctx.fillRect(0, h * horizon, w, h * (1 - horizon));
  }
}

const GOLDEN: Partial<View> = {
  sun: [0.7, 0.36, 0.6],
  sunCol: [1.0, 0.86, 0.68],
  sky: [0.72, 0.8, 0.94],
  gnd: [0.5, 0.44, 0.34],
  exposure: 1.06,
  fog: [0.98, 0.89, 0.77, 0.0],
  ao: 0.28,
};

/** A clean label with a dot, popped in by `k`; the brand's colour when `lit`. */
function label(sc: SkillContext, x: number, y: number, text: string, size: number, k: number, lit: boolean) {
  if (k <= 0) return;
  const { ctx, u, palette } = sc;
  ctx.save();
  ctx.font = subFont(size, 700);
  const tw = ctx.measureText(text).width + size * 1.9;
  const th = size * 2.05;
  ctx.globalAlpha *= clamp(k * 1.8);
  // Kept inside the frame (a pin near the edge of a tall frame would cut its label off).
  const m = 12 * u;
  const cx = Math.min(sc.w - m - tw / 2, Math.max(m + tw / 2, x));
  ctx.translate(cx, y - (1 - Math.min(1, k)) * 14 * u);
  ctx.shadowColor = "rgba(20,10,30,0.22)";
  ctx.shadowBlur = 18 * u;
  ctx.shadowOffsetY = 6 * u;
  ctx.fillStyle = lit ? palette.primary : "rgba(255,255,255,0.94)";
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -th / 2, tw, th, th / 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = lit ? "#ffffff" : palette.primary;
  ctx.beginPath();
  ctx.arc(-tw / 2 + size * 0.85, 0, size * 0.22, 0, TAU);
  ctx.fill();
  ctx.fillStyle = lit ? "#ffffff" : INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  fillTextFit(ctx, text, -tw / 2 + size * 1.35, 0, tw - size * 1.6, { maxLines: 1, minScale: 0.6 });
  ctx.restore();
}

/** A map pin standing on a point, with a label over it. */
function pin(sc: SkillContext, x: number, y: number, text: string, size: number, k: number, lit: boolean) {
  if (k <= 0) return;
  const { ctx, u, palette } = sc;
  const s = Math.min(1, k);
  ctx.save();
  ctx.globalAlpha *= clamp(k * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - size * 2.4 * s);
  ctx.stroke();
  ctx.fillStyle = lit ? palette.primary : "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, size * 0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
  label(sc, x, y - size * 3.4 * s, text, size, k, lit);
}

/** Draw the 3D view under the headline. */
function frame(sc: SkillContext, top: number, draw: (w: number, h: number) => HTMLCanvasElement | null) {
  const { ctx, w, h } = sc;
  const cv = draw(w, h - top);
  if (!cv) return null;
  ctx.save();
  ctx.globalAlpha *= 1 - exitOf(sc);
  ctx.drawImage(cv, 0, top, w, h - top);
  ctx.restore();
  return cv;
}

const fitBack = (sc: SkillContext, top: number) => {
  const a = sc.w / (sc.h - top);
  return a < 1.3 ? 1.3 / a : 1;
};

/* ───────────────────────── The house ───────────────────────── */

interface Style {
  name: string;
  siding: string;
  trim: string;
  roof: string;
  door?: string;
  stone: string;
}
const STYLES: Style[] = [
  { name: "Farmhouse", siding: "#f3f0e9", trim: "#2a2c31", roof: "#30333a", stone: "#b9b1a5" },
  { name: "Craftsman", siding: "#8e9d88", trim: "#f2ede2", roof: "#4b4039", door: "#7a4a2a", stone: "#9d907f" },
  { name: "Modern", siding: "#dcd8d0", trim: "#1f2125", roof: "#26282c", stone: "#5f574e" },
  { name: "Coastal", siding: "#cddfea", trim: "#ffffff", roof: "#5b6570", door: "#2f5d7c", stone: "#cbc3b6" },
  { name: "Traditional", siding: "#e9dccb", trim: "#ffffff", roof: "#55443a", door: "#5b2b2b", stone: "#a2836b" },
];

interface HouseMats {
  siding: Program;
  trim: Program;
  roof: Program;
  door: Program;
  stone: Program;
  glass: Program;
  garage: Program;
}

interface House {
  root: Transform;
  slab: Transform;
  frame: Transform;
  walls: Transform;
  roof: Transform;
  land: Transform;
  solar: Transform;
  hvac: Transform;
  insul: Transform;
  mats: HouseMats;
  /** Materials clipped while the walls rise. */
  rising: Program[];
}

const MAIN = { w: 6.4, d: 5.6, h: 5.4, base: 0.25 };
const GAR = { w: 3.9, d: 5.4, h: 3.2 };

function put(W: World, g: ReturnType<typeof box>, m: Program, parent: Transform, x: number, y: number, z: number, cast = true) {
  const me = W.mesh(g, m, parent, cast);
  me.position.set(x, y, z);
  return me;
}

function node(parent: Transform) {
  const t = new Transform();
  t.setParent(parent);
  return t;
}

function buildHouse(W: World, parent: Transform, withFrame: boolean): House {
  const { gl } = W;
  const root = node(parent);
  const mats: HouseMats = {
    siding: W.mat({ color: STYLES[0].siding, gloss: 0.25, kind: "siding" }),
    trim: W.mat({ color: STYLES[0].trim, gloss: 0.4 }),
    roof: W.mat({ color: STYLES[0].roof, gloss: 0.3, kind: "shingle" }),
    door: W.mat({ color: "#7c5cff", gloss: 0.6 }),
    stone: W.mat({ color: STYLES[0].stone, gloss: 0.15, kind: "stone" }),
    glass: W.mat({ color: "#6f8db0", metal: 0.85, gloss: 0.97, emit: [0, 0, 0] }),
    garage: W.mat({ color: "#f4f2ee", gloss: 0.45 }),
  };
  const b = MAIN.base;
  // The slab.
  const slabT = node(root);
  put(W, box(gl, MAIN.w + GAR.w + 0.4, b, MAIN.d + 0.4), W.mat({ color: "#b7b1a8", gloss: 0.2 }), slabT, GAR.w / 2, b / 2, 0);
  // The frame: studs round the walls and plates at each floor (shown while it's built).
  const frameT = node(root);
  if (withFrame) {
    const wood = W.mat({ color: "#d9b383", gloss: 0.2 });
    const stud = box(gl, 0.1, MAIN.h, 0.14);
    const gStud = box(gl, 0.1, GAR.h, 0.14);
    const ring = (x0: number, x1: number, z0: number, z1: number, g: ReturnType<typeof box>, hh: number) => {
      for (let x = x0; x <= x1 + 0.01; x += 0.8) {
        put(W, g, wood, frameT, x, b + hh / 2, z0);
        put(W, g, wood, frameT, x, b + hh / 2, z1);
      }
      for (let z = z0 + 0.8; z < z1 - 0.01; z += 0.8) {
        put(W, g, wood, frameT, x0, b + hh / 2, z);
        put(W, g, wood, frameT, x1, b + hh / 2, z);
      }
      for (const y of hh > 4 ? [b + hh / 2, b + hh] : [b + hh]) {
        put(W, box(gl, x1 - x0, 0.12, 0.16), wood, frameT, (x0 + x1) / 2, y, z0);
        put(W, box(gl, x1 - x0, 0.12, 0.16), wood, frameT, (x0 + x1) / 2, y, z1);
        put(W, box(gl, 0.16, 0.12, z1 - z0), wood, frameT, x0, y, (z0 + z1) / 2);
        put(W, box(gl, 0.16, 0.12, z1 - z0), wood, frameT, x1, y, (z0 + z1) / 2);
      }
    };
    ring(-MAIN.w / 2, MAIN.w / 2, -MAIN.d / 2, MAIN.d / 2, stud, MAIN.h);
    ring(MAIN.w / 2, MAIN.w / 2 + GAR.w, -GAR.d / 2, GAR.d / 2, gStud, GAR.h);
  }
  // Walls: a stone base, siding, the garage wing, windows with trim, the door and porch.
  const walls = node(root);
  const fz = MAIN.d / 2;
  put(W, box(gl, MAIN.w + 0.12, 0.95, MAIN.d + 0.12), mats.stone, walls, 0, b + 0.475, 0);
  put(W, box(gl, MAIN.w, MAIN.h, MAIN.d), mats.siding, walls, 0, b + MAIN.h / 2, 0);
  const gx = MAIN.w / 2 + GAR.w / 2;
  put(W, box(gl, GAR.w + 0.12, 0.95, GAR.d + 0.12), mats.stone, walls, gx, b + 0.475, -(MAIN.d - GAR.d) / 2);
  put(W, box(gl, GAR.w, GAR.h, GAR.d), mats.siding, walls, gx, b + GAR.h / 2, -(MAIN.d - GAR.d) / 2);
  const gz = GAR.d / 2 - (MAIN.d - GAR.d) / 2;
  put(W, box(gl, 3.0, 2.35, 0.08), mats.garage, walls, gx, b + 1.18, gz + 0.04);
  for (let i = 1; i < 4; i++) put(W, box(gl, 3.0, 0.03, 0.1), mats.trim, walls, gx, b + i * 0.59, gz + 0.05, false);
  put(W, box(gl, 3.24, 0.14, 0.12), mats.trim, walls, gx, b + 2.42, gz + 0.06);
  const curtain = W.mat({ color: "#efe6d6", gloss: 0.08 });
  const win = (x: number, y: number, ww: number, hh: number, z: number, side = false) => {
    const fr = side ? box(gl, 0.1, hh + 0.24, ww + 0.24) : box(gl, ww + 0.24, hh + 0.24, 0.1);
    const gl2 = side ? box(gl, 0.12, hh, ww) : box(gl, ww, hh, 0.12);
    put(W, fr, mats.trim, walls, x, y, z);
    put(W, gl2, mats.glass, walls, x + (side ? -0.02 : 0), y, z + (side ? 0 : 0.02), false);
    const mull = side ? box(gl, 0.14, hh, 0.05) : box(gl, 0.05, hh, 0.14);
    const tran = side ? box(gl, 0.14, 0.05, ww) : box(gl, ww, 0.05, 0.14);
    put(W, mull, mats.trim, walls, x, y, z, false);
    put(W, tran, mats.trim, walls, x, y + hh * 0.1, z, false);
    // Soft curtains drawn to either side, read through the glass.
    if (!side) for (const k of [-1, 1]) put(W, box(gl, ww * 0.16, hh * 0.92, 0.012), curtain, walls, x + k * ww * 0.39, y - hh * 0.02, z + 0.086, false);
    // A sill under it, and on the front, shutters either side.
    if (side) put(W, box(gl, 0.22, 0.08, ww + 0.4), mats.trim, walls, x - 0.06, y - hh / 2 - 0.16, z, false);
    else {
      put(W, box(gl, ww + 0.44, 0.08, 0.22), mats.trim, walls, x, y - hh / 2 - 0.16, z + 0.08, false);
      for (const sx of [-1, 1]) {
        put(W, box(gl, 0.38, hh + 0.2, 0.06), mats.door, walls, x + sx * (ww / 2 + 0.36), y, z + 0.02, false);
        for (let k = -2; k <= 2; k++) put(W, box(gl, 0.3, 0.025, 0.07), mats.trim, walls, x + sx * (ww / 2 + 0.36), y + k * (hh / 5), z + 0.04, false);
      }
    }
  };
  win(-1.65, b + 4.15, 1.2, 1.5, fz + 0.03);
  win(1.55, b + 4.15, 1.2, 1.5, fz + 0.03);
  win(-1.5, b + 1.95, 1.9, 1.6, fz + 0.03);
  win(-MAIN.w / 2 - 0.03, b + 4.15, 1.1, 1.4, -1.0, true);
  win(-MAIN.w / 2 - 0.03, b + 1.95, 1.3, 1.5, 1.2, true);
  win(-MAIN.w / 2 - 0.03, b + 1.95, 1.3, 1.5, -1.3, true);
  // Front door with a transom, a covered porch on two columns, steps.
  put(W, box(gl, 1.3, 2.55, 0.1), mats.trim, walls, 1.35, b + 1.28, fz + 0.03);
  put(W, box(gl, 1.05, 2.3, 0.12), mats.door, walls, 1.35, b + 1.15, fz + 0.05);
  put(W, box(gl, 0.08, 0.08, 0.06), W.mat({ color: "#d9b45a", metal: 0.9, gloss: 0.8 }), walls, 1.7, b + 1.1, fz + 0.13, false);
  for (const [py, ph] of [
    [b + 1.65, 0.75],
    [b + 0.65, 0.75],
  ]) for (const px of [1.12, 1.58]) put(W, box(gl, 0.34, ph, 0.03), W.mat({ color: "#000000", alpha: 0.12, transparent: true }), walls, px, py, fz + 0.115, false);
  const lamp = W.mat({ color: "#2a2c31", metal: 0.6, gloss: 0.6 });
  const lampGlass = W.mat({ color: "#ffe2a8", gloss: 0.4, emit: [0.9, 0.62, 0.3] });
  for (const lx of [0.55, 2.15, gx - 1.75, gx + 1.75]) {
    const ly = lx > 3 ? b + 2.0 : b + 1.75;
    const lz = lx > 3 ? gz + 0.1 : fz + 0.1;
    put(W, box(gl, 0.2, 0.36, 0.14), lamp, walls, lx, ly, lz, false);
    put(W, box(gl, 0.13, 0.24, 0.15), lampGlass, walls, lx, ly - 0.02, lz + 0.01, false);
  }
  put(W, box(gl, 0.5, 0.18, 0.04), mats.trim, walls, 2.2, b + 2.35, fz + 0.06, false);
  // Garage door windows along the top panel.
  for (let i = 0; i < 4; i++) put(W, box(gl, 0.55, 0.28, 0.04), mats.glass, walls, gx - 1.05 + i * 0.7, b + 2.0, gz + 0.1, false);
  const porch = node(walls);
  put(W, box(gl, 2.8, 0.2, 1.6), mats.trim, porch, 1.35, b + 2.95, fz + 0.8);
  put(W, box(gl, 2.9, 0.06, 1.7), mats.roof, porch, 1.35, b + 3.08, fz + 0.8);
  for (const x of [0.15, 2.55]) {
    const col = W.mesh(cylinder(gl, 0.1, 0.12, 2.7, 20), mats.trim, porch);
    col.position.set(x, b + 1.6, fz + 1.45);
  }
  put(W, box(gl, 2.8, 0.25, 1.6), mats.stone, porch, 1.35, b - 0.02, fz + 0.8);
  put(W, box(gl, 1.6, 0.14, 0.5), mats.stone, porch, 1.35, 0.07, fz + 1.85);
  // Roofs: a front gable over the main block (with a vent), one over the garage, and a chimney.
  const roof = node(root);
  const r1 = put(W, gable(gl, MAIN.w + 0.8, 2.5, MAIN.d + 0.7), mats.roof, roof, 0, b + MAIN.h, 0);
  void r1;
  put(W, box(gl, MAIN.w + 0.9, 0.12, MAIN.d + 0.8), mats.trim, roof, 0, b + MAIN.h + 0.02, 0, false);
  put(W, box(gl, 0.6, 0.8, 0.06), mats.trim, roof, 0, b + MAIN.h + 1.1, MAIN.d / 2 + 0.36, false);
  put(W, gable(gl, GAR.w + 0.6, 1.4, GAR.d + 0.6), mats.roof, roof, gx, b + GAR.h, -(MAIN.d - GAR.d) / 2);
  put(W, box(gl, GAR.w + 0.7, 0.1, GAR.d + 0.7), mats.trim, roof, gx, b + GAR.h + 0.02, -(MAIN.d - GAR.d) / 2, false);
  put(W, box(gl, 0.75, 2.6, 0.75), mats.stone, roof, -2.1, b + MAIN.h + 1.2, -1.2);
  put(W, box(gl, 0.95, 0.12, 0.95), mats.trim, roof, -2.1, b + MAIN.h + 2.55, -1.2, false);
  // Gutters along the eaves, downspouts at the corners, a ridge cap.
  const gut = W.mat({ color: "#f1efea", metal: 0.3, gloss: 0.5 });
  for (const sx of [-1, 1]) {
    put(W, box(gl, 0.14, 0.14, MAIN.d + 0.7), gut, roof, sx * ((MAIN.w + 0.8) / 2 + 0.02), b + MAIN.h - 0.04, 0, false);
    const ds = W.mesh(cylinder(gl, 0.05, 0.05, MAIN.h, 10), gut, roof, false);
    ds.position.set(sx * (MAIN.w / 2 + 0.12), b + MAIN.h / 2, MAIN.d / 2 - 0.1);
  }
  put(W, box(gl, 0.22, 0.12, MAIN.d + 0.72), mats.roof, roof, 0, b + MAIN.h + 2.5, 0, false);
  put(W, box(gl, 0.2, 0.1, GAR.d + 0.62), mats.roof, roof, gx, b + GAR.h + 1.4, -(MAIN.d - GAR.d) / 2, false);
  // Solar panels on the garage-side slope, an outdoor unit, an insulation cut-away (shown on cue).
  const solar = node(roof);
  const slope = Math.atan(2.5 / ((MAIN.w + 0.8) / 2));
  const panel = W.mat({ color: "#1c2b4d", metal: 0.35, gloss: 0.92 });
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 3; j++) {
      const p = put(W, box(gl, 1.25, 0.06, 1.55), panel, solar, 0, 0, 0);
      const along = 0.55 + i * 1.35;
      p.position.set(along * Math.cos(slope) + 0.15, b + MAIN.h + 2.5 - along * Math.sin(slope) - 0.02 + 0.06, -1.7 + j * 1.7);
      p.rotation.z = -slope;
    }
  }
  const hvac = node(root);
  put(W, box(gl, 1.0, 0.9, 1.0), W.mat({ color: "#c8ccd3", metal: 0.5, gloss: 0.5 }), hvac, -MAIN.w / 2 - 1.0, 0.45, -1.4);
  put(W, cylinder(gl, 0.36, 0.36, 0.04, 28) as ReturnType<typeof box>, W.mat({ color: "#2b2e35", gloss: 0.4 }), hvac, -MAIN.w / 2 - 1.0, 0.92, -1.4, false);
  const insul = node(walls);
  put(W, box(gl, 0.08, 2.3, 2.2), W.mat({ color: "#2a2c31", gloss: 0.1 }), insul, -MAIN.w / 2 - 0.04, b + 3.9, 1.1, false);
  put(W, box(gl, 0.1, 2.1, 2.0), W.mat({ color: "#f3a8b8", gloss: 0.1 }), insul, -MAIN.w / 2 - 0.06, b + 3.9, 1.1, false);
  // Landscaping: driveway, walkway, hedges, two trees.
  const land = node(root);
  const concrete = W.mat({ color: "#cfcac2", gloss: 0.15 });
  put(W, box(gl, 3.4, 0.04, 9.5), concrete, land, gx, 0.02, gz + 4.75, false);
  put(W, box(gl, 1.2, 0.035, 4.6), concrete, land, 1.35, 0.018, fz + 4.3, false);
  const hedge = W.mat({ color: "#3f7d45", gloss: 0.25 });
  for (let i = 0; i < 4; i++) {
    const s = W.mesh(sphere(gl, 0.55, 16, 12), hedge, land);
    s.position.set(-2.7 + i * 0.85, 0.4, fz + 0.75);
    s.scale.set(1, 0.75, 0.9);
  }
  // Flower beds along the front (mulch and blooms), a mailbox at the curb.
  const mulch = W.mat({ color: "#5a3e2b", gloss: 0.1 });
  put(W, box(gl, 3.6, 0.06, 1.0), mulch, land, -1.5, 0.03, fz + 0.85, false);
  const blooms = [W.mat({ color: "#f4f1ea", gloss: 0.3 }), W.mat({ color: "#e8a3b5", gloss: 0.3 }), W.mat({ color: "#f2c14e", gloss: 0.3 })];
  for (let i = 0; i < 9; i++) {
    const f = W.mesh(sphere(gl, 0.12, 8, 6), blooms[i % 3], land, false);
    f.position.set(-3.1 + i * 0.38, 0.75 + (i % 2) * 0.08, fz + 1.2);
  }
  put(W, box(gl, 0.1, 1.1, 0.1), mats.trim, land, 4.0, 0.55, 9.3);
  put(W, box(gl, 0.28, 0.3, 0.5), W.mat({ color: "#2a2c31", metal: 0.5, gloss: 0.6 }), land, 4.0, 1.2, 9.3);
  tree(W, land, -8.6, 4.2, 1.15);
  tree(W, land, -7.6, -6.5, 0.95);
  return { root, slab: slabT, frame: frameT, walls, roof, land, solar, hvac, insul, mats, rising: [mats.siding, mats.stone, mats.trim, mats.glass, mats.garage, mats.door] };
}

let treeMats: { bark: Program; leaf: Program; leaf2: Program; pine: Program; pine2: Program } | undefined;
let treeGl: unknown;
function tree(W: World, parent: Transform, x: number, z: number, s: number) {
  if (!treeMats || treeGl !== W.gl) {
    treeGl = W.gl;
    treeMats = { bark: W.mat({ color: "#6b4b35", gloss: 0.2 }), leaf: W.mat({ color: "#4d8a43", gloss: 0.25 }), leaf2: W.mat({ color: "#6a9c4a", gloss: 0.25 }), pine: W.mat({ color: "#2f6b45", gloss: 0.2 }), pine2: W.mat({ color: "#3d7a4e", gloss: 0.2 }) };
  }
  const { gl } = W;
  // Roughly one tree in three is a pine: stacked cones on a short trunk.
  if (Math.abs(Math.round(x * 7 + z * 13)) % 3 === 0) {
    const t = W.mesh(cylinder(gl, 0.1 * s, 0.16 * s, 1.2 * s, 12), treeMats.bark, parent);
    t.position.set(x, 0.6 * s, z);
    for (const [y, r, hh, alt] of [[1.7, 1.25, 2.0, 0], [2.7, 0.95, 1.7, 1], [3.6, 0.65, 1.4, 0]] as const) {
      const c = W.mesh(cylinder(gl, 0, r * s, hh * s, 18), alt ? treeMats.pine2 : treeMats.pine, parent);
      c.position.set(x, y * s, z);
    }
    return;
  }
  const trunk = W.mesh(cylinder(gl, 0.14 * s, 0.2 * s, 2.4 * s, 14), treeMats.bark, parent);
  trunk.position.set(x, 1.2 * s, z);
  for (const [dx, dy, dz, r, alt] of [
    [0, 3.0, 0, 1.4, 0],
    [0.7, 2.5, 0.3, 1.0, 1],
    [-0.6, 2.6, -0.3, 1.05, 1],
    [0.1, 3.7, 0.1, 0.9, 0],
  ] as const) {
    const c = W.mesh(sphere(gl, r * s, 16, 12), alt ? treeMats.leaf2 : treeMats.leaf, parent);
    c.position.set(x + dx * s, dy * s, z + dz * s);
  }
}

/** A simple neighbouring home (body, roof, garage, windows, door) for streets and communities. */
function simpleHouse(W: World, parent: Transform, x: number, z: number, rot: number, m: { siding: Program; roof: Program; trim: Program; glass: Program; door: Program }, flip: boolean) {
  const { gl } = W;
  const g = node(parent);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const s = flip ? -1 : 1;
  put(W, box(gl, 5.6, 4.6, 6), m.siding, g, 0, 2.3, 0);
  put(W, gable(gl, 6.3, 2.0, 6.6), m.roof, g, 0, 4.6, 0);
  put(W, box(gl, 3.6, 3.0, 5.6), m.siding, g, s * 4.6, 1.5, -0.2);
  put(W, gable(gl, 4.1, 1.2, 6.0), m.roof, g, s * 4.6, 3.0, -0.2);
  put(W, box(gl, 2.8, 2.2, 0.1), m.trim, g, s * 4.6, 1.1, 2.6, false);
  for (const [wx, wy] of [
    [-1.4, 3.3],
    [1.4, 3.3],
    [-1.4, 1.4],
  ]) put(W, box(gl, 1.1, 1.2, 0.1), m.glass, g, wx, wy, 3.02, false);
  put(W, box(gl, 1.0, 2.1, 0.1), m.door, g, 1.3, 1.05, 3.02, false);
  // A driveway to the street, a walk to the door, a low hedge.
  put(W, box(gl, 3.2, 0.03, 7.5), driveMat(W), g, s * 4.6, 0.015, 6.4, false);
  put(W, box(gl, 1.0, 0.025, 7.0), driveMat(W), g, 1.3, 0.012, 6.6, false);
  for (let i = 0; i < 3; i++) {
    const hd = W.mesh(sphere(gl, 0.5, 12, 8), hedgeMat(W), g, false);
    hd.position.set(-2.2 + i * 0.9, 0.35, 3.6);
    hd.scale.set(1, 0.7, 0.9);
  }
  return g;
}

let sharedGl: unknown;
let drive: Program | undefined;
let hedgeM: Program | undefined;
const driveMat = (W: World) => {
  if (sharedGl !== W.gl) {
    sharedGl = W.gl;
    drive = undefined;
    hedgeM = undefined;
  }
  return (drive ??= W.mat({ color: "#cfcac2", gloss: 0.15 }));
};
const hedgeMat = (W: World) => {
  driveMat(W);
  return (hedgeM ??= W.mat({ color: "#3f7d45", gloss: 0.25 }));
};

let carMats: { glass: Program; tyre: Program; light: Program; paints: Program[] } | undefined;
let carGl: unknown;
/** A car: a rounded body, a glass cabin, four wheels, headlights. `paint` picks its colour. */
function car(W: World, parent: Transform, x: number, z: number, rot: number, paint: number) {
  const { gl } = W;
  if (!carMats || carGl !== W.gl) {
    carGl = W.gl;
    carMats = {
      glass: W.mat({ color: "#1e2733", metal: 0.6, gloss: 0.95 }),
      tyre: W.mat({ color: "#1b1c20", gloss: 0.2 }),
      light: W.mat({ color: "#fff6e0", gloss: 0.6, emit: [0.6, 0.55, 0.45] }),
      paints: ["#f2f3f5", "#9aa3ad", "#24262b", "#2f4a6d", "#8c2f2f"].map((c) => W.mat({ color: c, metal: 0.55, gloss: 0.85 })),
    };
  }
  const m = carMats;
  const g = node(parent);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const body = slab(gl, 1.9, 0.62, 4.3, 0.24, 0.2);
  const b = node(g);
  b.position.y = 0.62;
  const paintM = m.paints[paint % m.paints.length];
  W.mesh(body.front, paintM, b);
  W.mesh(body.back, paintM, b);
  W.mesh(body.body, paintM, b);
  const cab = slab(gl, 1.62, 0.56, 2.2, 0.22, 0.16);
  const c = node(g);
  c.position.set(0, 1.18, -0.25);
  W.mesh(cab.front, m.glass, c);
  W.mesh(cab.back, m.glass, c);
  W.mesh(cab.body, m.glass, c);
  for (const [wx, wz] of [
    [-0.86, 1.35],
    [0.86, 1.35],
    [-0.86, -1.35],
    [0.86, -1.35],
  ]) {
    const wh = W.mesh(cylinder(gl, 0.34, 0.34, 0.26, 20), m.tyre, g);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(wx, 0.34, wz);
  }
  for (const lx of [-0.62, 0.62]) put(W, box(gl, 0.36, 0.12, 0.04), m.light, g, lx, 0.72, 2.16, false);
  return g;
}

function ground(W: World) {
  const { gl } = W;
  const lawn = W.mat({ color: "#78ad55", color2: "#5f9a48", kind: "grass", gloss: 0.1 });
  const g = W.mesh(quad(gl, 400, 400), lawn, W.scene, false);
  g.rotation.x = -Math.PI / 2;
  return lawn;
}

function street(W: World, z: number, len = 200) {
  const { gl } = W;
  put(W, box(gl, len, 0.03, 7), W.mat({ color: "#4a4d54", gloss: 0.2 }), W.scene, 0, 0.015, z, false);
  put(W, box(gl, len, 0.06, 1.6), W.mat({ color: "#d4d0c8", gloss: 0.15 }), W.scene, 0, 0.03, z - 4.6, false);
  // A kerb between road and lawn, sidewalk expansion joints and the centre dashes.
  put(W, box(gl, len, 0.12, 0.22), W.mat({ color: "#bdb8ae", gloss: 0.2 }), W.scene, 0, 0.06, z - 3.6, false);
  const joint = W.mat({ color: "#b3aea4", gloss: 0.1 });
  const dash = W.mat({ color: "#f2e7c4", gloss: 0.2 });
  for (let x = -len / 2; x < len / 2; x += 1.6) put(W, box(gl, 0.03, 0.065, 1.6), joint, W.scene, x, 0.031, z - 4.6, false);
  for (let x = -len / 2; x < len / 2; x += 6) put(W, box(gl, 2.6, 0.035, 0.18), dash, W.scene, x, 0.02, z, false);
}

/* ───────────────────────── The home's world ───────────────────────── */

interface HomeParts {
  house: House;
  path: Transform;
  posts: Transform;
  postAt: Num3[];
  neighbours: Transform;
}

function homeWorld(W: World): HomeParts {
  ground(W);
  street(W, 14);
  const house = buildHouse(W, W.scene, false);
  house.solar.visible = false;
  // Neighbours either side, a little set back.
  const nb = node(W.scene);
  const m = (s: string, r: string) => ({ siding: W.mat({ color: s, gloss: 0.25 }), roof: W.mat({ color: r, gloss: 0.3 }), trim: W.mat({ color: "#f4f2ee", gloss: 0.4 }), glass: W.mat({ color: "#1b2330", metal: 0.2, gloss: 0.95 }), door: W.mat({ color: "#3b3f46", gloss: 0.5 }) });
  simpleHouse(W, nb, -15.5, -1.5, 0, m("#d9cdb8", "#4a4039"), false);
  simpleHouse(W, nb, 20, -1.5, 0, m("#c7d3d8", "#3c4149"), true);
  simpleHouse(W, nb, -4, -30, Math.PI, m("#e6e0d4", "#4a4448"), false);
  tree(W, nb, 12.5, 4, 1.2);
  // A car in the driveway; a white fence along the side garden.
  car(W, nb, MAIN.w / 2 + GAR.w / 2 + 0.2, 4.6, 0.04, 0);
  const fence = W.mat({ color: "#f6f4ef", gloss: 0.35 });
  for (let z = -6; z <= 3; z += 0.7) put(W, box(gl0(W), 0.08, 1.0, 0.12), fence, nb, -7.2, 0.5, z);
  put(W, box(gl0(W), 0.06, 0.08, 9.4), fence, nb, -7.2, 0.8, -1.4);
  put(W, box(gl0(W), 0.06, 0.08, 9.4), fence, nb, -7.2, 0.35, -1.4);
  tree(W, nb, -10, 6, 1.0);
  // The path up to the door and the signs along it (for the journey).
  const path = node(W.scene);
  const stone = W.mat({ color: "#d6cfc3", gloss: 0.2 });
  for (let i = 0; i < 7; i++) {
    const s = W.mesh(cylinder(gl0(W), 0.55, 0.55, 0.06, 28), stone, path, false);
    s.position.set(1.35 + Math.sin(i * 0.9) * 0.25, 0.04, 10.2 - i * 1.25);
  }
  const posts = node(W.scene);
  const postAt: Num3[] = [];
  const sign = W.mat({ color: "#7c5cff", gloss: 0.5 });
  const wood = W.mat({ color: "#f4f2ee", gloss: 0.3 });
  for (let i = 0; i < 4; i++) {
    const x = i % 2 ? 3.3 : -0.6;
    const z = 11.2 - i * 2.2;
    put(W, box(gl0(W), 0.1, 1.2, 0.1), wood, posts, x, 0.6, z);
    put(W, box(gl0(W), 0.75, 0.5, 0.06), sign, posts, x, 1.35, z);
    postAt.push([x, 1.7, z]);
  }
  return { house, path, posts, postAt, neighbours: nb };
}
const gl0 = (W: World) => W.gl;

/** The home in a style (colours eased from one style to the next by `k`), its door in the brand's colour unless the style has its own. */
function styleHome(H: House, a: Style, b: Style, k: number, brand: string) {
  const mix3 = (x: string, y: string) => rgb(mixHex(x, y, k));
  H.mats.siding.uniforms.uColor.value = mix3(a.siding, b.siding);
  H.mats.trim.uniforms.uColor.value = mix3(a.trim, b.trim);
  H.mats.roof.uniforms.uColor.value = mix3(a.roof, b.roof);
  H.mats.stone.uniforms.uColor.value = mix3(a.stone, b.stone);
  H.mats.door.uniforms.uColor.value = mix3(a.door ?? brand, b.door ?? brand);
}

/** Lit windows: warm light inside as the evening comes on. */
function glow(H: House, k: number) {
  H.mats.glass.uniforms.uEmit.value = [0.3 * k, 0.2 * k, 0.09 * k];
}

function setup(H: House, sc: SkillContext, parts: Partial<Record<"solar" | "hvac" | "insul", boolean>> = {}) {
  H.solar.visible = !!parts.solar;
  H.hvac.visible = !!parts.hvac;
  H.insul.visible = !!parts.insul;
  for (const n of [H.solar, H.hvac, H.insul]) n.traverse((c) => void (c.visible = n.visible));
  styleHome(H, STYLES[0], STYLES[0], 0, sc.palette.primary);
}

function fallback(sc: SkillContext, top: number) {
  const { ctx, w, h, u } = sc;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.roundRect(w * 0.2, top + 20 * u, w * 0.6, h - top - 60 * u, 18 * u);
  ctx.fill();
  ctx.restore();
}

/* ───────────────────────── Slides ───────────────────────── */

const HERO_POINTS = ["Open-concept living", "Chef-inspired kitchen", "Covered front porch"];

function homeHero(sc0: SkillContext) {
  const sc = { ...sc0, palette: onLight(sc0.palette) };
  const { t, d, u, scene, ctx } = sc;
  sky(sc);
  const st = stage(sc);
  const top = st.top - 24 * u;
  const P = (scene.items ?? []).map((x) => plain(split(x).title)).filter(Boolean).slice(0, 3);
  const cv = frame(sc, top, (w, h) => {
    const R = world("home", w, h, homeWorld);
    if (!R) return null;
    const { W, parts } = R;
    setup(parts.house, sc);
    parts.path.visible = false;
    parts.posts.visible = false;
    parts.path.traverse((n) => void (n.visible = false));
    parts.posts.traverse((n) => void (n.visible = false));
    glow(parts.house, 0.55 + range(t, 0.5, d) * 0.45);
    const k = sine(range(t, 0, d));
    const a = lerp(0.62, -0.28, k);
    const F = fitBack(sc, top);
    const r = 23 * F;
    const eye: Num3 = [1.8 + Math.sin(a) * r, lerp(3.4, 2.6, k), Math.cos(a) * r + 1];
    return render(W, { ...GOLDEN, flat: !!sc.flat3d, eye, target: [1.6, 3.1, 0], fov: 32, shadowSize: 16, shadowAt: [1.5, 0, 0], fog: [0.98, 0.89, 0.77, 0.008] }, w, h);
  });
  if (!cv) fallback(sc, top);
  // Feature captions, elegant, one after another at the lower left.
  const size = 22 * u * st.S;
  P.forEach((txt, i) => {
    const k = clamp((t - 1.2 - i * 0.6) / 0.5);
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha = k * (1 - exitOf(sc));
    const x = st.left + 10 * u;
    const y = sc.h * 0.8 + i * size * 1.9 - (P.length - 1) * size * 1.9;
    ctx.font = subFont(size, 650);
    const tw = ctx.measureText(txt).width;
    const dx = (1 - k) * 20 * u;
    // A frosted plate with a brand-coloured edge, so the words read over any part of the picture.
    ctx.shadowColor = "rgba(20,10,30,0.2)";
    ctx.shadowBlur = 16 * u;
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.beginPath();
    ctx.roundRect(x + dx, y - size * 0.95, tw + size * 1.6, size * 1.9, size * 0.5);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = sc.palette.primary;
    ctx.fillRect(x + dx, y - size * 0.95 + size * 0.4, 4 * u, size * 1.1);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, x + dx + size * 0.8, y);
    ctx.restore();
  });
}

/* Community */

interface CommunityParts {
  spots: Num3[];
}

function communityWorld(W: World): CommunityParts {
  const { gl } = W;
  ground(W);
  // Streets: a main road and a side street.
  put(W, box(gl, 160, 0.03, 7), W.mat({ color: "#4c4f56", gloss: 0.2 }), W.scene, 0, 0.015, 0, false);
  put(W, box(gl, 7, 0.031, 90), W.mat({ color: "#4c4f56", gloss: 0.2 }), W.scene, 12, 0.016, 40, false);
  const walk = W.mat({ color: "#d6d1c8", gloss: 0.15 });
  for (const z of [-4.6, 4.6]) put(W, box(gl, 160, 0.05, 1.5), walk, W.scene, 0, 0.025, z, false);
  const sidings = ["#efe9df", "#d9cdb8", "#c9d6dc", "#e6dccb", "#b9c3b0", "#f2efe8"].map((c) => W.mat({ color: c, gloss: 0.25 }));
  const roofs = ["#3a3d44", "#4b4039", "#5a6069", "#2f3237"].map((c) => W.mat({ color: c, gloss: 0.3 }));
  const trim = W.mat({ color: "#f4f2ee", gloss: 0.4 });
  const glass = W.mat({ color: "#1b2330", metal: 0.2, gloss: 0.95, emit: [0.25, 0.17, 0.08] });
  const doors = ["#7c5cff", "#3b3f46", "#7a4a2a", "#2f5d7c"].map((c) => W.mat({ color: c, gloss: 0.5 }));
  let n = 0;
  const lot = (x: number, z: number, rot: number) => {
    const m = { siding: sidings[n % sidings.length], roof: roofs[(n * 3) % roofs.length], trim, glass, door: doors[(n * 7) % doors.length] };
    simpleHouse(W, W.scene, x, z, rot, m, n % 2 === 1);
    n++;
  };
  for (let x = -66; x <= 66; x += 12) {
    if (Math.abs(x - 12) < 8) continue;
    lot(x, -14, 0);
    if (x < -20 || x > 30) lot(x, 14, Math.PI);
  }
  for (let z = 22; z <= 70; z += 12) {
    lot(26, z, -Math.PI / 2);
    lot(-2, z, Math.PI / 2);
  }
  // Cars in some driveways and along the street, trees in the back gardens.
  let ci = 0;
  for (let x = -66; x <= 66; x += 12) {
    if (Math.abs(x - 12) < 8) continue;
    if (ci % 3 !== 2) car(W, W.scene, x + (ci % 2 ? -4.6 : 4.6), -6.8 + 1.4, Math.PI, ci + 1);
    ci++;
    tree(W, W.scene, x + 3, -24, 0.8 + (ci % 3) * 0.12);
  }
  car(W, W.scene, -8, 2.0, Math.PI / 2, 3);
  car(W, W.scene, 26, -2.0, -Math.PI / 2, 0);
  // Street trees.
  for (let x = -70; x <= 70; x += 12) {
    tree(W, W.scene, x + 6, -6.8, 0.9);
    if (x < -24 || x > 34) tree(W, W.scene, x + 6, 6.8, 0.9);
  }
  // A park with a pond and trees, a clubhouse with a pool.
  const park: Num3 = [-30, 0, 26];
  const pond = W.mesh(cylinder(gl, 6, 6, 0.06, 48), W.mat({ color: "#5d9cc4", metal: 0.3, gloss: 0.95 }), W.scene, false);
  pond.position.set(park[0], 0.04, park[2]);
  pond.scale.set(1.4, 1, 1);
  const trail = W.mat({ color: "#d8c9a8", gloss: 0.1 });
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    const s = W.mesh(box(gl, 1.4, 0.03, 0.9), trail, W.scene, false);
    s.position.set(park[0] + Math.cos(a) * 11.5, 0.02, park[2] + Math.sin(a) * 8.5);
    s.rotation.y = -a;
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3;
    tree(W, W.scene, park[0] + Math.cos(a) * 15, park[2] + Math.sin(a) * 12, 1.0 + (i % 3) * 0.15);
  }
  const club: Num3 = [40, 0, 24];
  put(W, box(gl, 16, 5, 9), W.mat({ color: "#ebe4d6", gloss: 0.25 }), W.scene, club[0], 2.5, club[2]);
  put(W, box(gl, 17, 0.4, 10), W.mat({ color: "#3a3d44", gloss: 0.3 }), W.scene, club[0], 5.2, club[2]);
  put(W, box(gl, 14, 3, 0.1), W.mat({ color: "#1b2330", metal: 0.2, gloss: 0.95, emit: [0.3, 0.2, 0.1] }), W.scene, club[0], 2.2, club[2] - 4.56, false);
  put(W, box(gl, 18, 0.08, 9), W.mat({ color: "#e2dbcf", gloss: 0.2 }), W.scene, club[0], 0.04, club[2] - 10, false);
  put(W, box(gl, 12, 0.1, 5), W.mat({ color: "#45b3d6", metal: 0.2, gloss: 0.98 }), W.scene, club[0], 0.07, club[2] - 10, false);
  return { spots: [[-18, 6, -14], park, [club[0], 3, club[2] - 6], [park[0] + 11.5, 0.5, park[2] - 5]] };
}

const AREA_POINTS = ["Model homes", "Community park", "Pool and clubhouse", "Walking trails"];

function homeAerial(sc0: SkillContext) {
  const sc = { ...sc0, palette: onLight(sc0.palette) };
  const { t, d, u, scene } = sc;
  sky(sc, 0.42);
  const st = stage(sc);
  const top = st.top - 24 * u;
  const P = itemsOr(scene, AREA_POINTS, 4, 1).map((x) => plain(split(x).title));
  const T = pointTimes(scene, P.length, 1.0);
  let anchors: { x: number; y: number; front: boolean }[] = [];
  const cv = frame(sc, top, (w, h) => {
    const R = world("community", w, h, communityWorld);
    if (!R) return null;
    const { W, parts } = R;
    const k = sine(range(t, 0, d));
    const F = fitBack(sc, top);
    const eye: Num3 = [lerp(-58, 22, k), lerp(58, 46, k) * F, lerp(74, 66, k) * F];
    const target: Num3 = [lerp(-22, 26, k), 0, lerp(10, 6, k)];
    const out = render(W, { ...GOLDEN, flat: !!sc.flat3d, eye, target, fov: 36, shadowSize: 70, shadowAt: [eye[0] + 14, 0, 18], fog: [0.98, 0.89, 0.77, 0.006] }, w, h);
    anchors = parts.spots.map((p) => project(W, p, w, h));
    return out;
  });
  if (!cv) fallback(sc, top);
  const size = 22 * u * st.S;
  const cur = T.reduce((cc, ti, i) => (t >= ti - 0.05 ? i : cc), -1);
  sc.ctx.save();
  sc.ctx.globalAlpha = 1 - exitOf(sc);
  P.forEach((txt, i) => {
    const a = anchors[i];
    if (!a || !a.front) return;
    const k = clamp(range(t, T[i], T[i] + 0.45) * 1.1);
    pin(sc, a.x, a.y + top, txt, size, k, i === cur);
  });
  sc.ctx.restore();
}

/* Build */

interface BuildParts {
  house: House;
}

function buildWorld(W: World): BuildParts {
  ground(W);
  street(W, 14);
  return { house: buildHouse(W, W.scene, true) };
}

const BUILD_POINTS = ["Foundation", "Framing", "Walls and windows", "Roof", "Move-in ready"];

function homeBuild3d(sc0: SkillContext) {
  const sc = { ...sc0, palette: onLight(sc0.palette) };
  const { t, d, u, scene, ctx } = sc;
  sky(sc);
  const st = stage(sc);
  const top = st.top - 24 * u;
  const P = itemsOr(scene, BUILD_POINTS, 5, 2).map((x) => plain(split(x).title));
  const n = P.length;
  const T = pointTimes(scene, n, 0.7);
  const cur = T.reduce((cc, ti, i) => (t >= ti - 0.05 ? i : cc), -1);
  const p = cur < 0 ? 0.02 : lerp(cur / n, (cur + 1) / n, ease.inOutCubic(clamp((t - T[cur]) / 0.9)));
  const cv = frame(sc, top, (w, h) => {
    const R = world("homebuild", w, h, buildWorld);
    if (!R) return null;
    const { W, parts } = R;
    const H = parts.house;
    setup(H, sc);
    const b = MAIN.base;
    const k = (a: number, z: number) => clamp((p - a) / (z - a));
    H.slab.scale.y = Math.max(0.001, k(0, 0.15));
    H.frame.visible = p > 0.12 && p < 0.72;
    H.frame.traverse((c) => void (c.visible = H.frame.visible));
    H.frame.scale.y = Math.max(0.001, ease.outCubic(k(0.12, 0.38)));
    const clip = b + (MAIN.h + 0.2) * ease.inOutCubic(k(0.38, 0.62));
    for (const m of H.rising) m.uniforms.uClip.value = p < 0.38 ? -1 : clip;
    const roofK = ease.outCubic(k(0.6, 0.8));
    H.roof.visible = roofK > 0;
    H.roof.traverse((c) => void (c.visible = H.roof.visible));
    H.solar.traverse((c) => void (c.visible = false));
    H.roof.position.y = (1 - roofK) * 6;
    const landK = ease.outBack(k(0.8, 1));
    H.land.visible = landK > 0.01;
    H.land.traverse((c) => void (c.visible = H.land.visible));
    H.land.scale.set(1, Math.max(0.01, landK), 1);
    glow(H, k(0.85, 1) * 0.8);
    const kk = range(t, 0, d);
    const a = lerp(0.75, 0.2, kk);
    const F = fitBack(sc, top);
    const r = 24 * F;
    const eye: Num3 = [1.8 + Math.sin(a) * r, lerp(9, 6, kk), Math.cos(a) * r];
    return render(W, { ...GOLDEN, flat: !!sc.flat3d, eye, target: [1.6, 2.4, 0], fov: 32, shadowSize: 16, shadowAt: [1.5, 0, 0], fog: [0.98, 0.89, 0.77, 0.006] }, w, h);
  });
  if (!cv) fallback(sc, top);
  // The steps, as a checklist at the right (a row on narrow frames).
  const size = 22 * u * st.S;
  ctx.save();
  ctx.globalAlpha = 1 - exitOf(sc);
  P.forEach((txt, i) => {
    const kIn = clamp(range(t, T[i] - 0.25, T[i] + 0.2));
    const done = i < cur || (i === cur && t > T[i] + 0.9);
    const x = st.narrow ? st.left + (st.width * (i + 0.5)) / n : st.left + st.width - 150 * u * st.S;
    const y = st.narrow ? sc.h * 0.9 : st.top + 40 * u + i * size * 2.5;
    label(sc, x, y, (done ? "✓ " : "") + txt, size * (st.narrow ? 0.8 : 1), kIn, i === cur);
  });
  ctx.restore();
}

/* Floor plan */

interface PlanParts {
  walls: Transform;
  furniture: Transform;
  rooms: { name: string; at: Num3 }[];
}

function planWorld(W: World): PlanParts {
  const { gl } = W;
  ground(W);
  const floorM = (c: string) => W.mat({ color: c, gloss: 0.35 });
  const rooms: { name: string; at: Num3; x0: number; x1: number; z0: number; z1: number; c: string }[] = [
    { name: "Great room", at: [-3, 0, 1.8], x0: -6, x1: 0, z0: -1, z1: 4.5, c: "#c9a27a" },
    { name: "Kitchen", at: [3, 0, 2.2], x0: 0, x1: 6, z0: 0, z1: 4.5, c: "#e9e5de" },
    { name: "Owner's suite", at: [-3.5, 0, -2.8], x0: -6, x1: -1, z0: -4.5, z1: -1, c: "#d9d3e2" },
    { name: "Bath", at: [0.5, 0, -2.3], x0: -1, x1: 2, z0: -4.5, z1: 0, c: "#cfdbe0" },
    { name: "Dining", at: [4, 0, -2.3], x0: 2, x1: 6, z0: -4.5, z1: 0, c: "#c49b72" },
  ];
  put(W, box(gl, 12.6, 0.2, 9.6), W.mat({ color: "#b7b1a8", gloss: 0.2 }), W.scene, 0, 0.1, 0, false);
  for (const r of rooms) put(W, box(gl, r.x1 - r.x0 - 0.02, 0.04, r.z1 - r.z0 - 0.02), floorM(r.c), W.scene, (r.x0 + r.x1) / 2, 0.22, (r.z0 + r.z1) / 2, false);
  const walls = node(W.scene);
  const wallM = W.mat({ color: "#f4f1ea", gloss: 0.25 });
  const H = 2.6;
  const wall = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = put(W, box(gl, len, H, 0.15), wallM, walls, (x0 + x1) / 2, H / 2 + 0.24, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  };
  // Exterior (with a gap for the front door) and partitions with doorways.
  wall(-6, -4.5, 6, -4.5);
  wall(-6, -4.5, -6, 4.5);
  wall(6, -4.5, 6, 4.5);
  wall(-6, 4.5, 0.6, 4.5);
  wall(1.8, 4.5, 6, 4.5);
  wall(-6, -1, -3.8, -1);
  wall(-2.8, -1, -1, -1);
  wall(-1, -4.5, -1, -2.2);
  wall(-1, -1.2, -1, -1);
  wall(2, -4.5, 2, -1.6);
  wall(-1, 0, 0.4, 0);
  // Furniture: a bed, a sofa and rug, a kitchen island and counters, a dining table, a tub.
  const furniture = node(W.scene);
  const fab = W.mat({ color: "#7c8696", gloss: 0.3 });
  const white = W.mat({ color: "#f7f6f2", gloss: 0.4 });
  const woodM = W.mat({ color: "#8a6446", gloss: 0.4 });
  const stoneTop = W.mat({ color: "#2f3237", gloss: 0.7 });
  put(W, box(gl, 2.0, 0.5, 2.3), white, furniture, -4.2, 0.5, -2.9);
  put(W, box(gl, 2.1, 0.9, 0.12), woodM, furniture, -4.2, 0.7, -4.3);
  put(W, box(gl, 1.9, 0.12, 1.2), fab, furniture, -4.2, 0.8, -2.3);
  put(W, box(gl, 2.8, 0.6, 0.9), fab, furniture, -3.0, 0.55, 3.4);
  put(W, box(gl, 2.8, 0.5, 0.25), fab, furniture, -3.0, 0.8, 3.85);
  put(W, box(gl, 2.4, 0.02, 1.6), W.mat({ color: "#e5d9c6", gloss: 0.1 }), furniture, -3.0, 0.25, 1.9, false);
  put(W, box(gl, 1.2, 0.4, 0.7), woodM, furniture, -3.0, 0.45, 1.9);
  put(W, box(gl, 2.4, 0.9, 1.0), white, furniture, 3.0, 0.7, 2.2);
  put(W, box(gl, 2.5, 0.06, 1.1), stoneTop, furniture, 3.0, 1.18, 2.2);
  put(W, box(gl, 5.4, 0.9, 0.7), white, furniture, 3.0, 0.7, 0.45);
  put(W, box(gl, 5.5, 0.06, 0.75), stoneTop, furniture, 3.0, 1.18, 0.45);
  put(W, box(gl, 2.0, 0.75, 1.1), woodM, furniture, 4.0, 0.62, -2.4);
  for (const [cx, cz] of [
    [3.3, -3.3],
    [4.7, -3.3],
    [3.3, -1.5],
    [4.7, -1.5],
  ]) put(W, box(gl, 0.45, 0.5, 0.45), fab, furniture, cx, 0.5, cz);
  put(W, box(gl, 1.6, 0.55, 0.8), white, furniture, 0.5, 0.52, -3.9);
  put(W, box(gl, 0.9, 0.8, 0.5), woodM, furniture, 1.35, 0.62, -1.6);
  return { walls, furniture, rooms: rooms.map((r) => ({ name: r.name, at: [r.at[0], 1.3, r.at[2]] as Num3 })) };
}

function homePlan(sc0: SkillContext) {
  const sc = { ...sc0, palette: onLight(sc0.palette) };
  const { t, d, u, scene } = sc;
  sky(sc, 0.5);
  const st = stage(sc);
  const top = st.top - 24 * u;
  // Items label the rooms only when they name rooms (a list of features keeps the plan's own names).
  const ROOMY = /\b(room|kitchen|suite|bed|bath|dining|living|office|den|loft|study|pantry|laundry|garage|porch|patio|nook|flex|media|foyer|closet|primary|owner)\b/i;
  const names = (scene.items ?? []).map((x) => plain(split(x).title)).filter((x) => ROOMY.test(x)).slice(0, 5);
  let anchors: { x: number; y: number; front: boolean }[] = [];
  let labels: string[] = [];
  const cv = frame(sc, top, (w, h) => {
    const R = world("plan", w, h, planWorld);
    if (!R) return null;
    const { W, parts } = R;
    const rise = ease.inOutCubic(range(t, 0.5, 1.8));
    parts.walls.scale.y = Math.max(0.001, rise);
    parts.furniture.scale.y = Math.max(0.001, ease.outBack(range(t, 1.3, 2.2)));
    const tilt = ease.inOutCubic(range(t, 0.3, Math.min(d - 0.5, 3.2)));
    const F = fitBack(sc, top);
    const spin = range(t, 2.5, d) * 0.35;
    const r = lerp(0.01, 15, tilt) * F;
    const eye: Num3 = [Math.sin(0.5 + spin) * r, lerp(23, 13, tilt) * F, Math.cos(0.5 + spin) * r];
    const out = render(W, { ...GOLDEN, flat: !!sc.flat3d, sun: [0.5, 0.75, 0.45], eye, target: [0, 0, 0], fov: 34, shadowSize: 10, shadowAt: [0, 0, 0] }, w, h);
    anchors = parts.rooms.map((r0) => project(W, r0.at, w, h));
    labels = parts.rooms.map((r0, i) => names[i] ?? r0.name);
    return out;
  });
  if (!cv) fallback(sc, top);
  const size = 20 * u * st.S;
  sc.ctx.save();
  sc.ctx.globalAlpha = 1 - exitOf(sc);
  labels.forEach((txt, i) => {
    const a = anchors[i];
    if (!a?.front) return;
    label(sc, a.x, a.y + top, txt, size, clamp(range(t, 1.6 + i * 0.25, 2.0 + i * 0.25)), false);
  });
  sc.ctx.restore();
}

/* Energy */

const ENERGY_POINTS = ["Solar-ready roof", "Sealed, insulated walls", "Double-pane windows", "High-efficiency system"];

function homeEnergy(sc0: SkillContext) {
  const sc = { ...sc0, palette: onLight(sc0.palette) };
  const { t, d, u, scene } = sc;
  sky(sc);
  const st = stage(sc);
  const top = st.top - 24 * u;
  const P = itemsOr(scene, ENERGY_POINTS, 4, 2).map((x) => plain(split(x).title));
  const T = pointTimes(scene, P.length, 0.9);
  const cur = T.reduce((cc, ti, i) => (t >= ti - 0.05 ? i : cc), -1);
  const spots: Num3[] = [
    [1.9, MAIN.base + MAIN.h + 1.4, 0],
    [-MAIN.w / 2 - 0.1, MAIN.base + 3.9, 1.1],
    [-1.5, MAIN.base + 1.95, MAIN.d / 2 + 0.1],
    [-MAIN.w / 2 - 1.0, 1.0, -1.4],
  ];
  let anchors: { x: number; y: number; front: boolean }[] = [];
  const cv = frame(sc, top, (w, h) => {
    const R = world("home", w, h, homeWorld);
    if (!R) return null;
    const { W, parts } = R;
    const H = parts.house;
    setup(H, sc, { solar: true, hvac: true, insul: true });
    for (const n of [parts.path, parts.posts]) n.traverse((c) => void (c.visible = false));
    glow(H, 0.3);
    const k = sine(range(t, 0, d));
    const a = lerp(-0.15, -0.5, k);
    const F = fitBack(sc, top);
    const r = 22 * F;
    const eye: Num3 = [1 + Math.sin(a) * r, lerp(9.5, 7.5, k), Math.cos(a) * r];
    const out = render(W, { ...GOLDEN, flat: !!sc.flat3d, sun: [0.55, 0.6, 0.6], sunCol: [1, 0.93, 0.8], eye, target: [0, 3, 0], fov: 32, shadowSize: 16, shadowAt: [1.5, 0, 0], fog: [0.98, 0.89, 0.77, 0.006] }, w, h);
    anchors = spots.map((p) => project(W, p, w, h));
    return out;
  });
  if (!cv) fallback(sc, top);
  const size = 21 * u * st.S;
  sc.ctx.save();
  sc.ctx.globalAlpha = 1 - exitOf(sc);
  P.forEach((txt, i) => {
    const a = anchors[i];
    if (!a?.front) return;
    pin(sc, a.x, a.y + top, txt, size, clamp(range(t, T[i], T[i] + 0.45) * 1.1), i === cur);
  });
  sc.ctx.restore();
}

/* Choice */

function homeChoice(sc0: SkillContext) {
  const sc = { ...sc0, palette: onLight(sc0.palette) };
  const { t, d, u, scene, ctx } = sc;
  sky(sc);
  const st = stage(sc);
  const top = st.top - 24 * u;
  const named = (scene.items ?? []).map((x) => plain(split(x).title)).filter(Boolean).slice(0, 4);
  const opts = (named.length >= 2 ? named : STYLES.slice(0, 4).map((s) => s.name)).map((name, i) => ({ name, style: STYLES.find((s) => s.name.toLowerCase() === name.toLowerCase()) ?? STYLES[i % STYLES.length] }));
  const n = opts.length;
  const T = pointTimes(scene, n, 0.6);
  const cur = Math.max(0, T.reduce((cc, ti, i) => (t >= ti - 0.05 ? i : cc), 0));
  const mixK = cur > 0 ? ease.inOutCubic(clamp((t - T[cur]) / 0.7)) : 1;
  const cv = frame(sc, top, (w, h) => {
    const R = world("home", w, h, homeWorld);
    if (!R) return null;
    const { W, parts } = R;
    const H = parts.house;
    setup(H, sc);
    for (const n2 of [parts.path, parts.posts]) n2.traverse((c) => void (c.visible = false));
    styleHome(H, opts[Math.max(0, cur - 1)].style, opts[cur].style, mixK, sc.palette.primary);
    glow(H, 0.45);
    const k = range(t, 0, d);
    const F = fitBack(sc, top);
    const eye: Num3 = [lerp(9, 6, k) * F, lerp(3.2, 3.6, k), lerp(19, 16, k) * F];
    return render(W, { ...GOLDEN, flat: !!sc.flat3d, eye, target: [1.6, 3, 0], fov: 32, shadowSize: 16, shadowAt: [1.5, 0, 0], fog: [0.98, 0.89, 0.77, 0.008] }, w, h);
  });
  if (!cv) fallback(sc, top);
  // The options as swatch chips along the bottom.
  const size = 20 * u * st.S;
  const chipW = Math.min(st.width / n - 12 * u, 260 * u * st.S);
  ctx.save();
  ctx.globalAlpha = 1 - exitOf(sc);
  opts.forEach((o, i) => {
    const x = sc.w / 2 + (i - (n - 1) / 2) * (chipW + 12 * u);
    const y = sc.h * 0.9;
    const lit = i === cur;
    const k = clamp(range(t, 0.2 + i * 0.12, 0.6 + i * 0.12));
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.shadowColor = "rgba(20,10,30,0.2)";
    ctx.shadowBlur = 14 * u;
    ctx.fillStyle = lit ? "#ffffff" : "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.roundRect(x - chipW / 2, y - size * 1.2, chipW, size * 2.4, size * 1.2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    if (lit) {
      ctx.strokeStyle = sc.palette.primary;
      ctx.lineWidth = 3 * u;
      ctx.stroke();
    }
    [o.style.siding, o.style.roof, o.style.door ?? sc.palette.primary].forEach((c, j) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x - chipW / 2 + size * (1.1 + j * 0.75), y, size * 0.42, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.fillStyle = INK;
    ctx.font = subFont(size, lit ? 750 : 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, o.name, x - chipW / 2 + size * 3.3, y, chipW - size * 3.8, { maxLines: 1, minScale: 0.6 });
    ctx.restore();
  });
  ctx.restore();
}

/* Journey */

const JOURNEY_POINTS = ["Find your home", "Choose your plan", "Personalize it", "Move in"];

function homeJourney(sc0: SkillContext) {
  const sc = { ...sc0, palette: onLight(sc0.palette) };
  const { t, d, u, scene } = sc;
  sky(sc);
  const st = stage(sc);
  const top = st.top - 24 * u;
  const P = itemsOr(scene, JOURNEY_POINTS, 4, 2).map((x) => plain(split(x).title));
  const T = pointTimes(scene, P.length, 0.8);
  const cur = T.reduce((cc, ti, i) => (t >= ti - 0.05 ? i : cc), -1);
  let anchors: { x: number; y: number; front: boolean }[] = [];
  const cv = frame(sc, top, (w, h) => {
    const R = world("home", w, h, homeWorld);
    if (!R) return null;
    const { W, parts } = R;
    const H = parts.house;
    setup(H, sc);
    parts.path.traverse((c) => void (c.visible = true));
    parts.posts.traverse((c, ) => void (c.visible = true));
    let i = 0;
    parts.posts.traverse((c) => {
      const m = c as unknown as { program?: Program };
      if (m.program && i++ % 2 === 1) m.program.uniforms.uColor.value = rgb(sc.palette.primary);
    });
    glow(H, 0.5 + range(t, 0, d) * 0.4);
    const k = ease.inOutCubic(range(t, 0.2, d));
    const F = fitBack(sc, top);
    const eye: Num3 = [lerp(5, 2.4, k), lerp(4.2, 3.0, k), lerp(32, 18, k) * F];
    const target: Num3 = [1.4, lerp(2.6, 2.0, k), lerp(0, 3, k)];
    const out = render(W, { ...GOLDEN, flat: !!sc.flat3d, eye, target, fov: 34, shadowSize: 16, shadowAt: [1.5, 0, 4], fog: [0.98, 0.89, 0.77, 0.008] }, w, h);
    anchors = parts.postAt.map((p) => project(W, p, w, h));
    return out;
  });
  if (!cv) fallback(sc, top);
  const size = 21 * u * st.S;
  sc.ctx.save();
  sc.ctx.globalAlpha = 1 - exitOf(sc);
  P.forEach((txt, i) => {
    const a = anchors[i];
    if (!a?.front || a.y < 0) return;
    label(sc, a.x, a.y + top - size * 1.6, txt, size, clamp(range(t, T[i], T[i] + 0.4) * 1.1), i === cur);
  });
  sc.ctx.restore();
}

/* ───────────────────────── Registry ───────────────────────── */

/* ───────────────────────── People and a dog ───────────────────────── */

/** One material per colour and finish, per world (people and props share them). */
const matsByWorld = new WeakMap<World, Map<string, Program>>();
function mc(W: World, color: string, gloss = 0.3, emit?: string) {
  let m = matsByWorld.get(W);
  if (!m) matsByWorld.set(W, (m = new Map()));
  const key = `${color}|${gloss}|${emit ?? ""}`;
  let p = m.get(key);
  if (!p) m.set(key, (p = W.mat({ color, gloss, ...(emit ? { emit } : {}) })));
  return p;
}

/** How a face looks: its mood (blinks come on their own). */
type Mood = "smile" | "happy" | "joy" | "laugh" | "surprised";

interface Person3 {
  root: Transform;
  armL: Transform;
  armR: Transform;
  hipL: Transform;
  hipR: Transform;
  kneeL: Transform;
  kneeR: Transform;
  head: Transform;
  elbowL: Transform;
  elbowR: Transform;
  torso: Transform;
  h: number;
  /** The printed face (its picture changes with the mood). */
  face: Program;
  mood: Mood;
  W: World;
  /** Speaks the story: lip-syncs to the voice-over. */
  talks?: boolean;
}
interface PersonLook {
  h: number;
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  style: "short" | "long" | "bun" | "curly";
  shoes?: string;
  child?: boolean;
  mood?: Mood;
  /** A dress (a soft flared skirt to the knee) instead of trousers. */
  dress?: boolean;
  /** Hair tied back in a ponytail. */
  ponytail?: boolean;
}

/**
 * A face, drawn flat for printing on a head: dark oval eyes with a catch-light, soft brows, rosy
 * cheeks and a mouth, in the mood asked for (or blinking). The square spans the face's front.
 */
function drawFace(mood: Mood, blink: boolean, talk?: { shape: Viseme; level: number }) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const ink = "#2a2230";
  g.lineCap = "round";
  g.lineJoin = "round";
  // Cheeks.
  for (const sd of [-1, 1]) {
    const cg = g.createRadialGradient(128 + sd * 86, 160, 0, 128 + sd * 86, 160, 26);
    cg.addColorStop(0, "rgba(240,120,120,0.55)");
    cg.addColorStop(1, "rgba(240,120,120,0)");
    g.fillStyle = cg;
    g.fillRect(128 + sd * 86 - 30, 130, 60, 60);
  }
  // Eyes.
  const eyeY = 112;
  for (const sd of [-1, 1]) {
    const x = 128 + sd * 52;
    g.strokeStyle = ink;
    g.fillStyle = ink;
    if (blink) {
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(x - 13, eyeY + 2);
      g.quadraticCurveTo(x, eyeY + 8, x + 13, eyeY + 2);
      g.stroke();
    } else if (mood === "joy" || mood === "laugh") {
      // Happy closed eyes: little upturned arcs.
      g.lineWidth = 9.5;
      g.beginPath();
      g.moveTo(x - 18, eyeY + 7);
      g.quadraticCurveTo(x, eyeY - 16, x + 18, eyeY + 7);
      g.stroke();
    } else {
      const rx = mood === "surprised" ? 17 : 15;
      const ry = mood === "surprised" ? 23 : 19.5;
      g.beginPath();
      g.ellipse(x, eyeY, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(x - rx * 0.32, eyeY - ry * 0.38, rx * 0.36, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(x + rx * 0.3, eyeY + ry * 0.3, rx * 0.15, 0, Math.PI * 2);
      g.fill();
    }
    // Brows: relaxed, raised when surprised or overjoyed.
    const by = mood === "surprised" ? 64 : mood === "joy" || mood === "laugh" ? 72 : 78;
    g.strokeStyle = "#3a2a26";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(x - 16, by + 4);
    g.quadraticCurveTo(x, by - (mood === "smile" ? 4 : 8), x + 16, by + 4 - sd * 2);
    g.stroke();
  }
  // Mouth.
  const my = 182;
  if (talk) {
    // Speaking: the shape of the sound being said, opening with the voice (levels 1–3).
    const lv = talk.level / 3;
    g.fillStyle = "#6a2430";
    g.beginPath();
    if (talk.shape === "m" || talk.shape === "rest") {
      g.strokeStyle = "#7a2e35";
      g.lineWidth = 8;
      g.moveTo(128 - 24, my - 6);
      g.quadraticCurveTo(128, my + 6, 128 + 24, my - 6);
      g.stroke();
    } else if (talk.shape === "o") {
      g.ellipse(128, my, 11 + lv * 5, 10 + lv * 16, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      const w = talk.shape === "e" ? 34 : 28;
      const hh = talk.shape === "e" ? 6 + lv * 16 : 9 + lv * 30;
      g.moveTo(128 - w, my - 10);
      g.quadraticCurveTo(128, my - 15, 128 + w, my - 10);
      g.quadraticCurveTo(128 + w * 0.85, my - 10 + hh, 128, my - 10 + hh * 1.05);
      g.quadraticCurveTo(128 - w * 0.85, my - 10 + hh, 128 - w, my - 10);
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = "#ffffff";
      g.fillRect(128 - w, my - 18, w * 2, 8);
      if (hh > 18) {
        g.fillStyle = "#e8737a";
        g.beginPath();
        g.ellipse(128, my - 10 + hh, w * 0.5, hh * 0.35, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  } else if (mood === "smile") {
    g.strokeStyle = "#7a2e35";
    g.lineWidth = 8.5;
    g.beginPath();
    g.arc(128, my - 22, 28, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
  } else if (mood === "surprised") {
    g.fillStyle = "#6a2430";
    g.beginPath();
    g.ellipse(128, my, 11, 14, 0, 0, Math.PI * 2);
    g.fill();
  } else {
    // An open smile (bigger when laughing), with a tongue.
    const w = mood === "laugh" ? 40 : mood === "joy" ? 35 : 30;
    const hh = mood === "laugh" ? 34 : mood === "joy" ? 27 : 21;
    g.fillStyle = "#6a2430";
    g.beginPath();
    g.moveTo(128 - w, my - 10);
    g.quadraticCurveTo(128, my - 16, 128 + w, my - 10);
    g.quadraticCurveTo(128 + w * 0.8, my - 10 + hh * 1.3, 128, my - 10 + hh * 1.3);
    g.quadraticCurveTo(128 - w * 0.8, my - 10 + hh * 1.3, 128 - w, my - 10);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = "#ffffff";
    g.fillRect(128 - w, my - 18, w * 2, 9);
    g.fillStyle = "#e8737a";
    g.beginPath();
    g.ellipse(128, my - 10 + hh * 1.25, w * 0.5, hh * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  return c;
}

/** The faces' pictures, one per mood and blink, per world. */
const facesByWorld = new WeakMap<World, Map<string, Texture>>();
function faceTex(W: World, mood: Mood, blink: boolean, talk?: { shape: Viseme; level: number }) {
  let m = facesByWorld.get(W);
  if (!m) facesByWorld.set(W, (m = new Map()));
  const key = `${mood}|${blink}|${talk ? talk.shape + talk.level : ""}`;
  let tx = m.get(key);
  if (!tx) {
    const gl = W.gl;
    m.set(key, (tx = new Texture(gl, { image: drawFace(mood, blink, talk), generateMipmaps: true, minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR })));
  }
  return tx;
}

/** Set a person's expression: their mood, with a natural blink now and then. */
function express(P: Person3, t: number, phase: number, mood: Mood = P.mood) {
  const blink = mood !== "joy" && mood !== "laugh" && (t + phase * 1.37) % 3.4 < 0.12;
  // Laughing comes in bursts: the mouth opens and closes.
  const m: Mood = mood === "laugh" ? (Math.sin(t * 11 + phase) > -0.2 ? "laugh" : "joy") : mood;
  // A speaker of the story lip-syncs to the voice-over while it plays.
  const sp = P.talks ? speechNow() : null;
  const talk = sp ? { shape: sp.open < 0.08 ? ("m" as Viseme) : sp.shape, level: Math.max(1, Math.min(3, Math.round(sp.open * 3))) } : undefined;
  P.face.uniforms.tMap.value = faceTex(P.W, m === "joy" && talk ? "happy" : m, blink, talk);
}

/** A rounded limb: a tapered tube from the node down `len`, with round ends (a capsule). */
function limb(W: World, parent: Transform, r0: number, r1: number, len: number, m: Program) {
  const { gl } = W;
  W.mesh(cylinder(gl, r0, r1, len, 16), m, parent).position.y = -len / 2;
  W.mesh(sphere(gl, r0, 14, 10), m, parent);
  W.mesh(sphere(gl, r1, 14, 10), m, parent).position.y = -len;
}

/**
 * A friendly abstract person in 3D (faces +z), like a polished toy: a soft bean of a body, chunky
 * rounded limbs with elbows and knees, mitten hands, sneakers with white soles, a collar, styled
 * hair and a big round head with a printed, expressive face.
 */
function person3d(W: World, parent: Transform, L: PersonLook): Person3 {
  const { gl } = W;
  const h = L.h;
  const root = node(parent);
  const legLen = h * (L.child ? 0.36 : 0.43);
  const thigh = legLen * 0.5;
  const shin = legLen * 0.5;
  const torsoH = h * (L.child ? 0.29 : 0.31);
  const torsoR = h * (L.child ? 0.13 : 0.115);
  const headR = h * (L.child ? 0.12 : 0.088);
  const r = h * (L.child ? 0.05 : 0.046);
  const shirt = mc(W, L.shirt, 0.3);
  const shirtLight = mc(W, mixHex(L.shirt, "#ffffff", 0.35), 0.3);
  const pants = mc(W, L.pants, 0.25);
  const skin = mc(W, L.skin, 0.38);
  const hair = mc(W, L.hair, 0.5);
  const shoes = mc(W, L.shoes ?? "#33313a", 0.55);
  const sole = mc(W, "#f4f2ee", 0.3);
  const legs = [-1, 1].map((sd) => {
    const hip = node(root);
    hip.position.set(sd * torsoR * 0.44, legLen, 0);
    limb(W, hip, r * 1.12, r * 0.98, thigh, L.dress ? skin : pants);
    const knee = node(hip);
    knee.position.y = -thigh;
    limb(W, knee, r * 0.98, r * 0.86, shin - r * 0.5, L.dress ? skin : pants);
    // A sneaker: a rounded upper on a white sole.
    const shoe = W.mesh(sphere(gl, r * 1.3, 16, 12), shoes, knee);
    shoe.position.set(0, -shin + r * 0.45, r * 0.7);
    shoe.scale.set(1, 0.68, 1.6);
    const so = W.mesh(cylinder(gl, r * 1.2, r * 1.25, r * 0.3, 18), sole, knee);
    so.position.set(0, -shin + r * 0.08, r * 0.7);
    so.scale.set(1, 1, 1.55);
    return { hip, knee };
  });
  // The body: a soft bean (breathing gently), the hips in the trousers' colour or a flared dress.
  const torso = node(root);
  torso.position.y = legLen;
  if (L.dress) {
    const skirt = W.mesh(cylinder(gl, torsoR * 0.92, torsoR * 1.45, thigh * 1.25, 24), shirt, torso);
    skirt.position.y = -thigh * 0.5;
  } else {
    const hips = W.mesh(sphere(gl, torsoR * 0.98, 22, 14), pants, torso);
    hips.position.y = torsoR * 0.1;
    hips.scale.set(1, 0.6, 0.86);
  }
  const bean = W.mesh(sphere(gl, torsoR, 28, 20), shirt, torso);
  bean.position.y = torsoH * 0.52;
  bean.scale.set(1, (torsoH * 0.56) / torsoR, 0.84);
  // A collar and the neck.
  const collar = W.mesh(cylinder(gl, torsoR * 0.42, torsoR * 0.5, torsoR * 0.14, 20), shirtLight, torso);
  collar.position.y = torsoH * 1.02;
  W.mesh(cylinder(gl, headR * 0.34, headR * 0.38, headR * 0.5, 14), skin, torso).position.y = torsoH * 1.08;
  // The head: big and round, with ears, hair and a printed face.
  const head = node(torso);
  head.position.y = torsoH + headR * 1.12;
  W.mesh(sphere(gl, headR, 30, 22), skin, head);
  for (const sd of [-1, 1]) {
    const ear = W.mesh(sphere(gl, headR * 0.2, 12, 8), skin, head);
    ear.position.set(sd * headR * 0.97, -headR * 0.06, 0);
    ear.scale.set(0.55, 1, 0.8);
  }
  const cap = W.mesh(sphere(gl, headR * 1.06, 26, 18), hair, head);
  cap.position.set(0, headR * 0.24, -headR * 0.12);
  cap.scale.set(1.03, 0.8, 1.02);
  if (L.style === "short") {
    // A side-swept fringe.
    const fr = W.mesh(sphere(gl, headR * 0.5, 16, 12), hair, head);
    fr.position.set(-headR * 0.32, headR * 0.62, headR * 0.55);
    fr.scale.set(1.4, 0.55, 0.8);
  }
  if (L.style === "long") {
    const back = W.mesh(sphere(gl, headR * 1.02, 22, 16), hair, head);
    back.position.set(0, -headR * 0.3, -headR * 0.3);
    back.scale.set(1.04, 1.3, 0.72);
    for (const sd of [-1, 1]) {
      const lock = W.mesh(sphere(gl, headR * 0.42, 14, 10), hair, head);
      lock.position.set(sd * headR * 0.86, -headR * 0.42, headR * 0.05);
      lock.scale.set(0.55, 1.5, 0.7);
    }
  }
  if (L.ponytail)
    [0.42, 0.34, 0.26].forEach((rr, i) => W.mesh(sphere(gl, headR * rr, 14, 10), hair, head).position.set(0, headR * (0.45 - i * 0.42), -headR * (1.02 + i * 0.12)));
  if (L.style === "bun") W.mesh(sphere(gl, headR * 0.42, 14, 10), hair, head).position.set(0, headR * 0.98, -headR * 0.5);
  if (L.style === "curly") {
    // Curls: a cluster of little balls over the top.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const ring = i % 2 ? 0.62 : 0.92;
      const c = W.mesh(sphere(gl, headR * 0.34, 12, 9), hair, head);
      c.position.set(Math.cos(a) * headR * ring, headR * (0.55 + (i % 3) * 0.12), Math.sin(a) * headR * ring - headR * 0.12);
    }
  }
  const face = W.mat({ color: "#ffffff", kind: "decal" });
  W.mesh(sphereCap(gl, headR * 1.006, headR * 0.74), face, head, false);
  // Arms: a sleeve to the elbow, then the forearm and a mitten hand with a thumb.
  const armLen = h * (L.child ? 0.3 : 0.33);
  const upper = armLen * 0.48;
  const fore = armLen * 0.52;
  const arms = [-1, 1].map((sd) => {
    const sh = node(torso);
    sh.position.set(sd * torsoR * 0.98, torsoH * 0.9, 0);
    limb(W, sh, r * 1.0, r * 0.9, upper, shirt);
    const el = node(sh);
    el.position.y = -upper;
    limb(W, el, r * 0.82, r * 0.74, fore - r, skin);
    const hand = W.mesh(sphere(gl, r * 1.12, 14, 10), skin, el);
    hand.position.y = -fore;
    hand.scale.set(0.9, 1.1, 0.75);
    W.mesh(sphere(gl, r * 0.42, 10, 8), skin, el).position.set(-sd * r * 0.2, -fore + r * 0.35, r * 0.75);
    sh.rotation.z = sd * 0.1;
    el.rotation.x = -0.18;
    return { sh, el };
  });
  const P: Person3 = { root, armL: arms[0].sh, armR: arms[1].sh, elbowL: arms[0].el, elbowR: arms[1].el, hipL: legs[0].hip, hipR: legs[1].hip, kneeL: legs[0].knee, kneeR: legs[1].knee, head, torso, h, face, mood: L.mood ?? "happy", W };
  express(P, 0, 0);
  return P;
}

/** Sit a person down on a seat `seatY` high. */
function sitDown(P: Person3, seatY: number) {
  const legLen = P.hipL.position.y;
  P.root.position.y = seatY - legLen + P.h * 0.02;
  for (const hip of [P.hipL, P.hipR]) hip.rotation.x = -Math.PI / 2;
  for (const knee of [P.kneeL, P.kneeR]) knee.rotation.x = Math.PI / 2;
}

/**
 * A happy idle: breathing, a little weight shift and nod, arms relaxed with soft elbows, a blink
 * now and then; `wave` raises the right arm and waves from the elbow, overjoyed. `mood` sets the
 * face (the person's own by default).
 */
function happy(P: Person3, t: number, phase: number, wave = 0, mood?: Mood) {
  const breathe = Math.sin(t * 2.1 + phase);
  P.torso.scale.set(1 + breathe * 0.008, 1 + breathe * 0.012, 1 + breathe * 0.008);
  P.torso.rotation.z = Math.sin(t * 0.8 + phase) * 0.03;
  P.head.rotation.z = Math.sin(t * 1.6 + phase) * 0.07;
  P.head.rotation.y = Math.sin(t * 0.9 + phase) * 0.16;
  P.head.rotation.x = -0.04 + Math.sin(t * 1.25 + phase) * 0.05;
  P.armL.rotation.z = -0.12 - Math.sin(t * 1.3 + phase) * 0.05;
  P.elbowL.rotation.x = -0.2 - Math.sin(t * 1.1 + phase) * 0.06;
  // The wave: the arm up and out, the forearm swinging side to side from the elbow.
  P.armR.rotation.z = lerp(0.12 + Math.sin(t * 1.3 + phase) * 0.05, 2.55, wave);
  P.elbowR.rotation.x = lerp(-0.2, -0.05, wave);
  P.elbowR.rotation.z = lerp(0, 0.45 + Math.sin(t * 9 + phase) * 0.5, wave);
  express(P, t, phase, mood ?? (wave > 0.5 ? "joy" : P.mood));
  // A speaker nods a little with the emphasis of the voice.
  const sp = P.talks ? speechNow() : null;
  if (sp) P.head.rotation.x -= sp.open * 0.07;
}

interface Dog3 {
  root: Transform;
  tail: Transform;
  head: Transform;
}

/** A happy dog in 3D (faces +x): a smooth body, droopy ears, a shiny nose, tongue out, a fluffy tail that wags. */
function dog3d(W: World, parent: Transform, coat: string, ears: string, collar: string): Dog3 {
  const { gl } = W;
  const root = node(parent);
  const fur = mc(W, coat, 0.32);
  const fur2 = mc(W, ears, 0.3);
  const belly = mc(W, mixHex(coat, "#ffffff", 0.45), 0.3);
  const dark = mc(W, "#1f1a18", 0.85);
  // The body: one smooth bean from chest to rump, a lighter chest.
  const body = W.mesh(sphere(gl, 0.27, 24, 16), fur, root);
  body.position.set(-0.02, 0.45, 0);
  body.scale.set(1.45, 0.86, 0.8);
  const chest = W.mesh(sphere(gl, 0.17, 18, 12), belly, root);
  chest.position.set(0.26, 0.44, 0);
  chest.scale.set(0.8, 1.1, 0.95);
  const neck = W.mesh(cylinder(gl, 0.125, 0.125, 0.05, 20), mc(W, collar, 0.5), root);
  neck.position.set(0.33, 0.62, 0);
  neck.rotation.z = -0.9;
  W.mesh(sphere(gl, 0.03, 10, 8), mc(W, "#f2c14e", 0.8), root).position.set(0.42, 0.55, 0);
  const head = node(root);
  head.position.set(0.42, 0.75, 0);
  const skull = W.mesh(sphere(gl, 0.165, 22, 16), fur, head);
  skull.scale.set(1, 0.95, 0.95);
  const snout = W.mesh(sphere(gl, 0.095, 16, 12), belly, head);
  snout.position.set(0.14, -0.05, 0);
  snout.scale.set(1.35, 0.78, 0.95);
  W.mesh(sphere(gl, 0.04, 12, 10), dark, head).position.set(0.265, -0.015, 0);
  for (const sd of [-1, 1]) {
    W.mesh(sphere(gl, 0.032, 12, 10), dark, head).position.set(0.11, 0.05, sd * 0.085);
    W.mesh(sphere(gl, 0.01, 6, 4), mc(W, "#ffffff", 0.6), head).position.set(0.137, 0.066, sd * 0.09);
    // Droopy ears hanging by the cheeks.
    const ear = W.mesh(sphere(gl, 0.085, 14, 10), fur2, head);
    ear.position.set(-0.03, -0.06, sd * 0.155);
    ear.scale.set(0.6, 1.45, 0.32);
    ear.rotation.x = sd * 0.18;
  }
  const tongue = W.mesh(sphere(gl, 0.04, 10, 8), mc(W, "#e8737a", 0.5), head);
  tongue.position.set(0.17, -0.12, 0);
  tongue.scale.set(0.9, 0.35, 0.8);
  for (const [x, z] of [
    [0.22, 0.11],
    [0.22, -0.11],
    [-0.24, 0.11],
    [-0.24, -0.11],
  ]) {
    const leg = node(root);
    leg.position.set(x, 0.36, z);
    limb(W, leg, 0.06, 0.05, 0.3, fur);
    const paw = W.mesh(sphere(gl, 0.06, 12, 8), belly, leg);
    paw.position.set(0.02, -0.32, 0);
    paw.scale.set(1.25, 0.6, 1);
  }
  const tail = node(root);
  tail.position.set(-0.4, 0.55, 0);
  [0.05, 0.045, 0.04, 0.034].forEach((rr, i) => W.mesh(sphere(gl, rr, 10, 8), i === 3 ? belly : fur, tail).position.set(-0.04 - i * 0.05, 0.05 + i * 0.07, 0));
  return { root, tail, head };
}

/** The dog's happy loop: a wagging tail, a tilting head and little hops. */
function wag(D: Dog3, t: number, hop = 0) {
  D.tail.rotation.y = Math.sin(t * 16) * 0.65;
  D.head.rotation.z = Math.sin(t * 2.2) * 0.12;
  D.head.rotation.x = Math.sin(t * 1.4) * 0.1;
  D.root.position.y = Math.abs(Math.sin(t * 5)) * 0.12 * hop;
}

/** The family: two parents and a child, in warm, varied clothes. */
const FAMILY: PersonLook[] = [
  { h: 1.82, shirt: "#5d7fa3", pants: "#2f3440", skin: "#c88e68", hair: "#2a1d16", style: "short", mood: "smile" },
  { h: 1.7, shirt: "#c4574d", pants: "#3f4a5a", skin: "#f0c8a8", hair: "#7a4a2a", style: "short", ponytail: true, dress: true },
  { h: 1.12, shirt: "#f2c14e", pants: "#4a6fa5", skin: "#e0aa82", hair: "#3b2417", style: "curly", child: true, mood: "laugh" },
];

/* ───────────────────────── Inside the home ───────────────────────── */

interface InteriorParts {
  family: Person3[];
  dog: Dog3;
  throw: Program;
  rooms: { name: string; eye: Num3; target: Num3 }[];
}

/**
 * A furnished home laid out in a line, cut away like a film set (no ceiling or front wall) so the
 * camera glides from room to room: the foyer, the living room (the family and the dog), the
 * kitchen, the owner's suite and out to the patio.
 */
function interiorWorld(W: World): InteriorParts {
  const { gl } = W;
  ground(W);
  const wallM = mc(W, "#ece3d6", 0.2);
  const trim = mc(W, "#ffffff", 0.45);
  const oak = mc(W, "#a8794f", 0.45);
  const wood = mc(W, "#8a6446", 0.4);
  const white = mc(W, "#f7f6f2", 0.4);
  const stoneTop = mc(W, "#2f3237", 0.75);
  const fabric = mc(W, "#8b96a6", 0.2);
  const linen = mc(W, "#ece6dc", 0.15);
  const glass = mc(W, "#cfe3f2", 0.9, "#cfe3f2");
  const warm = mc(W, "#fff1d6", 0.2, "#ffe4b0");
  const green = mc(W, "#4f8a4a", 0.3);
  const green2 = mc(W, "#6a9c4a", 0.3);
  const H = 2.8;
  // Floors: oak through the house, a tiled kitchen and a deck outside.
  put(W, box(gl, 27.2, 0.2, 8.2), oak, W.scene, -0.4, 0.1, 0, false);
  put(W, box(gl, 8, 0.02, 8), mc(W, "#d9d3ca", 0.5), W.scene, 3, 0.21, 0, false);
  put(W, box(gl, 6.4, 0.18, 8.2), mc(W, "#a07a55", 0.3), W.scene, 16.2, 0.09, 0, false);
  // Walls: the back wall with windows, the front wall with the open door, half walls between rooms.
  const wall = (x0: number, z0: number, x1: number, z1: number, hh = H) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = put(W, box(gl, len, hh, 0.16), wallM, W.scene, (x0 + x1) / 2, hh / 2 + 0.2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  };
  wall(-14, -4, 13, -4);
  wall(-14, -4, -14, 2.2);
  for (const x of [-9, -1, 7]) wall(x, -4, x, -1.6);
  // Baseboards along the back wall.
  put(W, box(gl, 27, 0.14, 0.04), trim, W.scene, -0.5, 0.27, -3.9, false);
  // The patio doors: glass panels either side of an open slider.
  wall(13, -4, 13, -2.6);
  for (const z of [-2.4, -0.8]) put(W, box(gl, 0.06, 2.4, 1.5), glass, W.scene, 13, 1.4, z, false);
  put(W, box(gl, 0.14, 0.12, 4.2), trim, W.scene, 13, 2.65, -1.3);
  // Windows on the back wall: bright panes in white frames.
  const win = (x: number, w: number, y = 1.6, hh = 1.5) => {
    put(W, box(gl, w + 0.18, hh + 0.18, 0.06), trim, W.scene, x, y, -3.9, false);
    put(W, box(gl, w, hh, 0.04), glass, W.scene, x, y, -3.86, false);
    put(W, box(gl, 0.05, hh, 0.07), trim, W.scene, x, y, -3.84, false);
  };
  win(-6.5, 2.4);
  win(-3.5, 1.4);
  win(10, 1.8);
  // The front door, open, in a white frame (it takes the brand's colour).
  put(W, box(gl, 0.2, 2.5, 0.16), trim, W.scene, -14, 1.45, 2.3);
  put(W, box(gl, 0.07, 2.3, 1.0), mc(W, "#7c5cff", 0.5), W.scene, -13.85, 1.35, 1.65);
  // Foyer: a console with a lamp and a mirror, a runner rug, a tall plant.
  put(W, box(gl, 1.4, 0.8, 0.4), wood, W.scene, -11.5, 0.6, -3.6);
  put(W, box(gl, 0.9, 1.1, 0.05), mc(W, "#d8e2ea", 0.95), W.scene, -11.5, 1.85, -3.88, false);
  put(W, box(gl, 1.4, 0.02, 3.4), mc(W, "#b86b4b", 0.1), W.scene, -11.5, 0.22, -0.8, false);
  const plant = (x: number, z: number, s = 1) => {
    W.mesh(cylinder(gl, 0.22 * s, 0.17 * s, 0.4 * s, 16), white, W.scene).position.set(x, 0.4 * s, z);
    for (const [dx, dy, dz, rr] of [
      [0, 0.85, 0, 0.32],
      [0.15, 1.1, 0.08, 0.24],
      [-0.12, 1.15, -0.06, 0.22],
    ] as const)
      W.mesh(sphere(gl, rr * s, 14, 10), dy > 1 ? green2 : green, W.scene).position.set(x + dx * s, dy * s + 0.2, z + dz * s);
  };
  plant(-9.6, -3.4, 1.15);
  // Living room: a sofa and armchair on a rug, a coffee table, a fireplace with a TV, a floor lamp.
  put(W, box(gl, 4.4, 0.02, 3.2), mc(W, "#e5d9c6", 0.1), W.scene, -5, 0.22, -1.6, false);
  put(W, box(gl, 3.2, 0.45, 1.0), fabric, W.scene, -5, 0.45, -3.0);
  put(W, box(gl, 3.2, 0.6, 0.25), fabric, W.scene, -5, 0.9, -3.42);
  for (const sd of [-1, 1]) put(W, box(gl, 0.25, 0.55, 1.0), fabric, W.scene, -5 + sd * 1.6, 0.62, -3.0);
  const throwM = W.mat({ color: "#7c5cff", gloss: 0.15 });
  put(W, box(gl, 0.7, 0.05, 0.9), throwM, W.scene, -3.9, 0.7, -2.95);
  for (const x of [-6.1, -4.0]) {
    const pl = put(W, box(gl, 0.5, 0.4, 0.14), linen, W.scene, x, 0.95, -3.2);
    pl.rotation.x = -0.25;
  }
  put(W, box(gl, 1.4, 0.38, 0.75), wood, W.scene, -5, 0.4, -1.4);
  W.mesh(cylinder(gl, 0.12, 0.09, 0.14, 14), white, W.scene).position.set(-4.6, 0.66, -1.4);
  put(W, box(gl, 1.0, 0.45, 0.95), fabric, W.scene, -7.6, 0.45, -1.2);
  put(W, box(gl, 0.22, 0.55, 0.95), fabric, W.scene, -8.0, 0.8, -1.2);
  W.mesh(cylinder(gl, 0.02, 0.02, 1.6, 8), mc(W, "#2b2a30", 0.6), W.scene).position.set(-8.3, 1.0, -2.6);
  W.mesh(cylinder(gl, 0.22, 0.28, 0.32, 18), warm, W.scene).position.set(-8.3, 1.85, -2.6);
  put(W, box(gl, 2.0, 1.1, 0.3), mc(W, "#d8d2c8", 0.3), W.scene, -1.9, 0.75, -3.75);
  put(W, box(gl, 0.9, 0.5, 0.05), mc(W, "#2a1a14", 0.3, "#ff9a4a"), W.scene, -1.9, 0.62, -3.58, false);
  put(W, box(gl, 1.6, 0.9, 0.06), mc(W, "#121418", 0.9), W.scene, -1.9, 1.95, -3.88, false);
  plant(-8.3, -0.2, 0.9);
  // Kitchen: base and wall cabinets with a stone top, a tall fridge, an island with stools under pendants.
  put(W, box(gl, 6.6, 0.9, 0.65), white, W.scene, 3.2, 0.65, -3.55);
  put(W, box(gl, 6.7, 0.06, 0.7), stoneTop, W.scene, 3.2, 1.13, -3.53);
  put(W, box(gl, 5.2, 0.7, 0.4), white, W.scene, 2.5, 2.25, -3.75);
  put(W, box(gl, 0.95, 2.2, 0.7), mc(W, "#c9ccd1", 0.8), W.scene, 6.1, 1.3, -3.5);
  for (let i = 0; i < 6; i++) put(W, box(gl, 0.02, 0.6, 0.02), mc(W, "#b9bcc2", 0.8), W.scene, 0.3 + i * 0.95, 0.8, -3.21, false);
  put(W, box(gl, 3.0, 0.9, 1.1), mc(W, "#5b6b7c", 0.35), W.scene, 3, 0.65, -0.9);
  put(W, box(gl, 3.15, 0.07, 1.25), stoneTop, W.scene, 3, 1.14, -0.9);
  for (const x of [2, 3, 4]) {
    W.mesh(cylinder(gl, 0.2, 0.2, 0.06, 16), wood, W.scene).position.set(x, 0.9, 0.0);
    W.mesh(cylinder(gl, 0.025, 0.025, 0.7, 8), mc(W, "#2b2a30", 0.6), W.scene).position.set(x, 0.55, 0.0);
    W.mesh(cylinder(gl, 0.01, 0.01, 0.9, 6), mc(W, "#2b2a30", 0.6), W.scene, false).position.set(x, 2.55, -0.9);
    W.mesh(sphere(gl, 0.17, 16, 12), warm, W.scene, false).position.set(x, 2.05, -0.9);
  }
  for (const [x, c] of [
    [2.6, "#e9a23b"],
    [2.75, "#d9534f"],
    [2.5, "#7ab648"],
  ] as const)
    W.mesh(sphere(gl, 0.07, 10, 8), mc(W, c, 0.5), W.scene).position.set(x, 1.24, -0.95);
  // Owner's suite: a bed with pillows and a soft throw, nightstands with lit lamps, a bench.
  put(W, box(gl, 2.3, 1.3, 0.12), mc(W, "#9a8f86", 0.2), W.scene, 10, 0.95, -3.9);
  put(W, box(gl, 2.1, 0.32, 2.3), wood, W.scene, 10, 0.36, -2.75);
  put(W, box(gl, 2.0, 0.26, 2.2), white, W.scene, 10, 0.64, -2.75);
  put(W, box(gl, 2.06, 0.08, 1.5), linen, W.scene, 10, 0.8, -2.35);
  put(W, box(gl, 2.08, 0.06, 0.55), throwM, W.scene, 10, 0.86, -1.95);
  for (const x of [9.5, 10.5]) {
    const pl = put(W, box(gl, 0.75, 0.35, 0.16), linen, W.scene, x, 0.95, -3.55);
    pl.rotation.x = -0.3;
  }
  for (const x of [8.4, 11.6]) {
    put(W, box(gl, 0.55, 0.55, 0.45), wood, W.scene, x, 0.48, -3.6);
    W.mesh(cylinder(gl, 0.14, 0.18, 0.26, 14), warm, W.scene).position.set(x, 1.05, -3.6);
  }
  put(W, box(gl, 1.4, 0.45, 0.45), linen, W.scene, 10, 0.42, -1.1);
  put(W, box(gl, 3.0, 0.02, 2.2), mc(W, "#cdbfae", 0.1), W.scene, 10, 0.22, -1.6, false);
  // The patio: lounge chairs, planters, string lights over the deck, the garden beyond.
  for (const z of [-2.8, -1.4]) {
    const c = put(W, box(gl, 0.75, 0.25, 1.7), white, W.scene, 16.5, 0.45, z);
    c.rotation.y = 0.3;
    const b = put(W, box(gl, 0.75, 0.7, 0.1), white, W.scene, 16.2, 0.75, z - 0.85);
    b.rotation.x = -0.6;
  }
  W.mesh(cylinder(gl, 0.35, 0.35, 0.05, 20), wood, W.scene).position.set(17.6, 0.6, -2.1);
  W.mesh(cylinder(gl, 0.04, 0.04, 0.42, 8), wood, W.scene).position.set(17.6, 0.38, -2.1);
  plant(18.6, -3.4, 1.1);
  plant(14, -3.4, 0.9);
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    W.mesh(sphere(gl, 0.05, 8, 6), warm, W.scene, false).position.set(13.3 + k * 5.6, 2.7 - Math.sin(k * Math.PI) * 0.45, -3.6 + k * 1.2);
  }
  tree(W, W.scene, 21, -6, 1.1);
  tree(W, W.scene, 17, -9, 1.3);
  // The family at home: dad on the sofa, mum beside it, their child on the rug with the dog.
  const family = FAMILY.map((L) => person3d(W, W.scene, L));
  family[1].talks = true;
  sitDown(family[0], 0.68);
  family[0].root.position.set(-5.6, family[0].root.position.y, -2.95);
  family[1].root.position.set(-3.2, 0.2, -2.2);
  family[1].root.rotation.y = -0.35;
  family[2].root.position.set(-5.0, 0.2, -0.4);
  family[2].root.rotation.y = 0.4;
  const dog = dog3d(W, W.scene, "#c98f4f", "#7a4f2a", "#7c5cff");
  dog.root.position.set(-4.0, 0.2, -0.2);
  dog.root.rotation.y = Math.PI * 0.85;
  return {
    family,
    dog,
    throw: throwM,
    rooms: [
      { name: "Welcoming foyer", eye: [-15.4, 1.75, 3.7], target: [-11.2, 1.2, -1.6] },
      { name: "Open living room", eye: [-6.2, 1.7, 3.5], target: [-5, 0.95, -1.6] },
      { name: "Chef-inspired kitchen", eye: [2.2, 1.85, 3.4], target: [3.2, 1.1, -1.6] },
      { name: "Owner's suite", eye: [9.2, 1.7, 3.3], target: [10.2, 0.85, -1.8] },
      { name: "Backyard patio", eye: [14.6, 1.75, 3.0], target: [17, 0.95, -1.6] },
    ],
  };
}

/** A Catmull-Rom point through `pts` at `s` (0 → pts.length - 1). */
function spline(pts: Num3[], s: number): Num3 {
  const n = pts.length - 1;
  const i = Math.min(n - 1, Math.max(0, Math.floor(s)));
  const f = clamp(s - i);
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n, i + 2)];
  const out: Num3 = [0, 0, 0];
  for (let k = 0; k < 3; k++)
    out[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f * f + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f * f * f);
  return out;
}

/** The interior's light: soft daylight from above the cut-away, warm lamps. */
const INDOOR: Partial<View> = { sun: [0.18, 1, 0.4], sunCol: [1, 0.92, 0.8], sky: [0.86, 0.84, 0.82], gnd: [0.55, 0.48, 0.42], exposure: 0.98, ao: 0.25 };

/** A warm backdrop behind the cut-away rooms (above the walls). */
function indoorBack(sc: SkillContext) {
  const { ctx, w, h, palette } = sc;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mixHex("#f4ece2", palette.primary, 0.06));
  g.addColorStop(1, "#e9dccb");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** The brand's colour on the soft furnishings and the front door. */
function tintInterior(P: InteriorParts, sc: SkillContext) {
  P.throw.uniforms.uColor.value = rgb(mixHex(sc.palette.primary, "#ffffff", 0.15));
}

/** A frosted caption plate at the lower left, sliding in by `k`. */
function caption(sc: SkillContext, txt: string, y: number, size: number, k: number) {
  if (k <= 0) return;
  const { ctx, u } = sc;
  const st = stage(sc);
  ctx.save();
  ctx.globalAlpha *= clamp(k) * (1 - exitOf(sc));
  ctx.font = subFont(size, 650);
  const tw = ctx.measureText(txt).width;
  const x = st.left + 10 * u + (1 - clamp(k)) * 20 * u;
  ctx.shadowColor = "rgba(20,10,30,0.2)";
  ctx.shadowBlur = 16 * u;
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.beginPath();
  ctx.roundRect(x, y - size * 0.95, tw + size * 1.6, size * 1.9, size * 0.5);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = sc.palette.primary;
  ctx.fillRect(x, y - size * 0.95 + size * 0.4, 4 * u, size * 1.1);
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(txt, x + size * 0.8, y);
  ctx.restore();
}

const ROOM_WORDS = /\b(room|kitchen|suite|bed|bath|dining|living|office|den|loft|study|pantry|laundry|garage|porch|patio|foyer|entry|closet|primary|owner|backyard|yard|garden|deck|nook|flex|media)\b/i;

function homeWalkthrough(sc0: SkillContext) {
  const sc = { ...sc0, palette: onLight(sc0.palette) };
  const { t, d, u, scene } = sc;
  indoorBack(sc);
  const st = stage(sc);
  const top = st.top - 24 * u;
  // Your room names when the points name rooms; the home's own otherwise.
  const own = (scene.items ?? []).map((x) => plain(split(x).title)).filter((x) => ROOM_WORDS.test(x));
  let names: string[] = [];
  // One continuous glide, slowing (never stopping) at each room; a short slide visits fewer rooms.
  const n = d >= 8 ? 5 : d >= 6 ? 4 : 3;
  const k = range(t, 0.2, d - 0.3);
  const seg = k * (n - 1);
  const i0 = Math.floor(seg);
  const s = Math.min(n - 1, i0 + sine(seg - i0) * 0.72 + (seg - i0) * 0.28);
  const cv = frame(sc, top, (w, h) => {
    const R = world("interior", w, h, interiorWorld);
    if (!R) return null;
    const { W, parts } = R;
    tintInterior(parts, sc);
    names = parts.rooms.map((r, i) => own[i] ?? r.name);
    parts.family.forEach((P, i) => happy(P, t, i * 1.7, i === 1 ? clamp((t - 1.0) / 0.4) : 0));
    wag(parts.dog, t, 1);
    const F = fitBack(sc, top);
    const eye = spline(parts.rooms.slice(0, n).map((r) => r.eye), s);
    const target = spline(parts.rooms.slice(0, n).map((r) => r.target), s);
    const back: Num3 = [eye[0], eye[1] + (F - 1) * 0.8, eye[2] + (F - 1) * 3];
    return render(W, { ...INDOOR, flat: !!sc.flat3d, eye: back, target, fov: 46, shadowSize: 9, shadowAt: [eye[0] + 1, 0, -1.5] }, w, h);
  });
  if (!cv) fallback(sc, top);
  // The room's name as the camera arrives.
  const room = Math.round(s);
  const kk = 1 - Math.abs(s - room) * 2.2;
  const size = 23 * u * st.S;
  if (names[room]) caption(sc, names[room], sc.h * 0.86, size, kk);
}

function homeFamily(sc0: SkillContext) {
  const sc = { ...sc0, palette: onLight(sc0.palette) };
  const { t, d, u, scene } = sc;
  indoorBack(sc);
  const st = stage(sc);
  const top = st.top - 24 * u;
  const cv = frame(sc, top, (w, h) => {
    const R = world("interior", w, h, interiorWorld);
    if (!R) return null;
    const { W, parts } = R;
    tintInterior(parts, sc);
    parts.family.forEach((P, i) => happy(P, t, i * 1.7, i === 2 ? 0.5 + 0.5 * Math.sin(t * 1.1) : i === 1 ? clamp((t - 1.4) / 0.4) * (1 - clamp((t - 3.2) / 0.4)) : 0));
    wag(parts.dog, t, 1);
    // A slow arc around the living room at sitting height, pushing in a little.
    const k = sine(range(t, 0, d));
    const F = fitBack(sc, top);
    const a = lerp(-0.35, 0.3, k);
    const r = lerp(5.6, 4.6, k) * F;
    const eye: Num3 = [-4.8 + Math.sin(a) * r, lerp(1.6, 1.35, k), -1.6 + Math.cos(a) * r];
    return render(W, { ...INDOOR, flat: !!sc.flat3d, eye, target: [-4.8, 0.85, -1.9], fov: 38, shadowSize: 6, shadowAt: [-5, 0, -1.8] }, w, h);
  });
  if (!cv) fallback(sc, top);
  const line = plain(scene.subtext ?? "");
  if (line) caption(sc, line, sc.h * 0.86, 23 * u * st.S, clamp((t - 1.1) / 0.5));
}

/** The family and the dog on the front path, the house aglow: the welcome home. */
function welcomeWorld(W: World) {
  const parts = homeWorld(W);
  const fam = node(W.scene);
  const family = FAMILY.map((L) => person3d(W, fam, L));
  // At the door, dad says the welcome (in his own voice).
  family[0].talks = true;
  const xs = [0.55, 1.9, 1.25];
  family.forEach((P, i) => P.root.position.set(xs[i], 0.05, i === 2 ? 6.9 : 6.3));
  const dog = dog3d(W, fam, "#c98f4f", "#7a4f2a", "#7c5cff");
  dog.root.position.set(2.7, 0.05, 6.9);
  dog.root.rotation.y = -Math.PI / 2 + 0.5;
  return { ...parts, family, dog };
}

function homeWelcome(sc0: SkillContext) {
  const sc = { ...sc0, palette: onLight(sc0.palette) };
  const { t, d, u, scene, ctx, palette } = sc;
  sky(sc);
  const st = stage(sc);
  const top = st.top - 24 * u;
  const cv = frame(sc, top, (w, h) => {
    const R = world("welcome", w, h, welcomeWorld);
    if (!R) return null;
    const { W, parts } = R;
    setup(parts.house, sc);
    for (const nn of [parts.path, parts.posts]) nn.traverse((c) => void (c.visible = nn === parts.path));
    glow(parts.house, 0.85);
    parts.family.forEach((P, i) => happy(P, t, i * 1.3, clamp((t - 0.6 - i * 0.25) / 0.4)));
    wag(parts.dog, t, 1);
    const k = sine(range(t, 0, d));
    const F = fitBack(sc, top);
    const eye: Num3 = [lerp(3.4, 1.8, k), lerp(2.0, 1.7, k), lerp(15.5, 11.5, k) * F];
    return render(W, { ...GOLDEN, flat: !!sc.flat3d, eye, target: [1.4, 2.4, 3.5], fov: 34, shadowSize: 12, shadowAt: [1.4, 0, 4], fog: [0.98, 0.89, 0.77, 0.006] }, w, h);
  });
  if (!cv) fallback(sc, top);
  // The call to action: a button in the brand's colour.
  const label0 = plain(scene.subtext ?? "") || "Find your home";
  const kb = clamp(range(t, 1.2, 1.7));
  if (kb > 0) {
    const size = 26 * u * st.S;
    ctx.save();
    ctx.globalAlpha = kb * (1 - exitOf(sc));
    ctx.font = subFont(size, 750);
    const tw = ctx.measureText(label0).width + size * 2.4;
    const th = size * 2.3;
    // Under the headline, over the sky, clear of the family on the path.
    const x = sc.w / 2;
    const y = top + size * 1.3 + (1 - kb) * 16 * u;
    ctx.shadowColor = "rgba(20,10,30,0.28)";
    ctx.shadowBlur = 22 * u;
    ctx.shadowOffsetY = 8 * u;
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.roundRect(x - tw / 2, y - th / 2, tw, th, th / 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label0, x, y + 1);
    ctx.restore();
  }
}

const pops = (n: number, start: number) => (scene: Scene) => pointTimes(scene, n, start).map((ti) => at(ti, "pop"));

export const homes3dSkills: Skill[] = [
  {
    id: "home-hero",
    name: "Home at Golden Hour",
    tagline: "A modelled two-storey home in real 3D at golden hour: long soft shadows, lit windows, the camera arcing slowly across the front; your features as elegant captions.",
    bestFor: "Homebuilders, real estate and property: an opener or a home's reveal; a headline and up to 3 short features.",
    sample: { text: "Welcome *home*", items: HERO_POINTS },
    itemsHint: "0–3 short features",
    render: homeHero,
    sfx: () => [at(0.2, "whoosh")],
  },
  {
    id: "home-aerial",
    name: "Community Flyover",
    tagline: "A drone flyover of a new community in 3D (streets of homes, a park with a pond, a pool and clubhouse); pins rise over the places you name.",
    bestFor: "New communities, neighbourhoods and amenities: 1–4 places or amenities.",
    sample: { text: "A place to *belong*", items: AREA_POINTS },
    itemsHint: "1–4 places or amenities",
    render: homeAerial,
    sfx: (scene) => pops(itemsOr(scene, AREA_POINTS, 4, 1).length, 1.0)(scene),
  },
  {
    id: "home-build3d",
    name: "Home Build 3D",
    tagline: "The home is built in 3D in front of you: slab, framing, walls and windows, the roof, then the garden, as the steps tick off.",
    bestFor: "Homebuilders and construction: 2–5 steps of the build.",
    sample: { text: "Built from the *ground up*", items: BUILD_POINTS },
    itemsHint: "2–5 build steps",
    render: homeBuild3d,
    sfx: (scene) => pops(itemsOr(scene, BUILD_POINTS, 5, 2).length, 0.7)(scene),
  },
  {
    id: "home-plan",
    name: "Floor Plan 3D",
    tagline: "A floor plan from above: the walls rise and the camera tilts into a furnished 3D plan with the rooms labelled.",
    bestFor: "Home plans, floor plans and layouts: up to 5 room names (great room, kitchen, owner's suite…).",
    sample: { text: "Room to *live*" },
    itemsHint: "0–5 room names",
    render: homePlan,
    sfx: () => [at(0.5, "whoosh"), at(1.4, "pop")],
  },
  {
    id: "home-energy",
    name: "Efficient Home",
    tagline: "The home's efficient features called out in 3D one by one: solar panels on the roof, an insulated wall cut-away, double-pane windows, the outdoor unit.",
    bestFor: "Energy-efficient and sustainable homes: 2–4 features (no savings figures).",
    sample: { text: "Built *smarter*", items: ENERGY_POINTS },
    itemsHint: "2–4 features",
    render: homeEnergy,
    sfx: (scene) => pops(itemsOr(scene, ENERGY_POINTS, 4, 2).length, 0.9)(scene),
  },
  {
    id: "home-choice",
    name: "Design Choices",
    tagline: "The same 3D home restyled per option (farmhouse, craftsman, modern, coastal, traditional): siding, roof, stone and door change as the swatches below light up.",
    bestFor: "Personalisation, elevations and design studios: 2–4 style names.",
    sample: { text: "Make it *yours*", items: ["Farmhouse", "Craftsman", "Modern", "Coastal"] },
    itemsHint: "2–4 style names",
    render: homeChoice,
    sfx: (scene) => pops((scene.items?.length ?? 0) >= 2 ? Math.min(4, scene.items!.length) : 4, 0.6)(scene),
  },
  {
    id: "home-journey",
    name: "Path Home",
    tagline: "The camera walks up the path to the front door at golden hour, past signs for the steps of buying a home.",
    bestFor: "The buying process, financing steps or 'how it works' for home buyers: 2–4 short steps.",
    sample: { text: "Your path *home*", items: JOURNEY_POINTS },
    itemsHint: "2–4 short steps",
    render: homeJourney,
    sfx: (scene) => pops(itemsOr(scene, JOURNEY_POINTS, 4, 2).length, 0.8)(scene),
  },
  {
    id: "home-walkthrough",
    name: "Room to Room",
    tagline: "One seamless 3D glide through a furnished home: the foyer, the living room (a happy family and their dog), the kitchen, the owner's suite and out to the patio, the rooms named as you arrive.",
    bestFor: "Model homes, home tours and listings: up to 5 room names (else the home's own).",
    sample: { text: "Step *inside*", items: ["Welcoming foyer", "Open living room", "Chef-inspired kitchen", "Owner's suite", "Backyard patio"] },
    itemsHint: "0–5 room names",
    render: homeWalkthrough,
    sfx: () => [at(0.2, "whoosh")],
  },
  {
    id: "home-family",
    name: "Life at Home",
    tagline: "A happy family in their 3D living room: a parent on the sofa, another waving, their child playing with a tail-wagging dog, as the camera arcs slowly round.",
    bestFor: "The feeling of home for homebuilders and real estate: a headline and an optional caption.",
    sample: { text: "Made for *real life*", subtext: "Room to grow, together" },
    render: homeFamily,
    sfx: () => [at(0.3, "whoosh")],
  },
  {
    id: "home-welcome",
    name: "Welcome Home",
    tagline: "The family and their dog wave from the path of their new home at golden hour, the windows aglow, as the camera eases in and your button appears.",
    bestFor: "The end card for homebuilders and real estate: a headline and the button's words.",
    sample: { text: "Find your *home*", subtext: "Book a tour" },
    render: homeWelcome,
    sfx: () => [at(0.2, "whoosh"), at(1.25, "pop")],
  },
];

void slab;
