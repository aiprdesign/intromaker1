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
 */
import { Transform, type Program } from "ogl";
import { box, cylinder, gable, project, quad, render, rgb, slab, sphere, world, type View, type World } from "../d3";
import { clamp, ease, lerp, mixHex, range, TAU } from "../math";
import { fillTextFit, subFont } from "../text";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { exitOf, itemsOr, split, stage } from "./beats";
import { pointTimes } from "./characters";

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
  ctx.translate(x, y - (1 - Math.min(1, k)) * 14 * u);
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
    stone: W.mat({ color: STYLES[0].stone, gloss: 0.15 }),
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
  const win = (x: number, y: number, ww: number, hh: number, z: number, side = false) => {
    const fr = side ? box(gl, 0.1, hh + 0.24, ww + 0.24) : box(gl, ww + 0.24, hh + 0.24, 0.1);
    const gl2 = side ? box(gl, 0.12, hh, ww) : box(gl, ww, hh, 0.12);
    put(W, fr, mats.trim, walls, x, y, z);
    put(W, gl2, mats.glass, walls, x + (side ? -0.02 : 0), y, z + (side ? 0 : 0.02), false);
    const mull = side ? box(gl, 0.14, hh, 0.05) : box(gl, 0.05, hh, 0.14);
    const tran = side ? box(gl, 0.14, 0.05, ww) : box(gl, ww, 0.05, 0.14);
    put(W, mull, mats.trim, walls, x, y, z, false);
    put(W, tran, mats.trim, walls, x, y + hh * 0.1, z, false);
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

let treeMats: { bark: Program; leaf: Program; leaf2: Program } | undefined;
let treeGl: unknown;
function tree(W: World, parent: Transform, x: number, z: number, s: number) {
  if (!treeMats || treeGl !== W.gl) {
    treeGl = W.gl;
    treeMats = { bark: W.mat({ color: "#6b4b35", gloss: 0.2 }), leaf: W.mat({ color: "#4d8a43", gloss: 0.25 }), leaf2: W.mat({ color: "#6a9c4a", gloss: 0.25 }) };
  }
  const { gl } = W;
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
  for (let x = -len / 2; x < len / 2; x += 6) put(W, box(gl, 2.6, 0.035, 0.18), W.mat({ color: "#f2e7c4", gloss: 0.2 }), W.scene, x, 0.02, z, false);
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
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(x, y - size * 0.7, 3 * u, size * 1.4);
    ctx.font = subFont(size, 650);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 12 * u;
    ctx.fillText(txt, x + 16 * u + (1 - k) * 20 * u, y);
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
    const a = lerp(-0.25, -0.75, k);
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
    tagline: "The home is built in 3D in front of you: slab, framing, walls and windows, the roof, then the garden, as each step ticks off.",
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
    tagline: "The camera walks up the path to the front door at golden hour, past a sign for each step of buying a home.",
    bestFor: "The buying process, financing steps or 'how it works' for home buyers: 2–4 short steps.",
    sample: { text: "Your path *home*", items: JOURNEY_POINTS },
    itemsHint: "2–4 short steps",
    render: homeJourney,
    sfx: (scene) => pops(itemsOr(scene, JOURNEY_POINTS, 4, 2).length, 0.8)(scene),
  },
];

void slab;
