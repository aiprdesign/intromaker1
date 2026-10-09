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
import { box, cylinder, gable, lathe, leaf, project, quad, render as draw3d, rgb, slab, sphere, sphereCap, torus, world, type View, type World } from "../d3";
import { clamp, ease, hexToRgb, lerp, mixHex, range, TAU } from "../math";
import { fillTextFit, subFont } from "../text";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { exitOf, itemsOr, split, stage as stageAndHeadline } from "./beats";
import { topHeadline } from "./saas";
import { pointTimes } from "./characters";
import { speechNow, type Viseme } from "../speech";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const plain = (s: string) => s.replace(/\*/g, "").trim();
type Num3 = [number, number, number];
const INK = "#1d1b26";
const sine = (k: number) => 0.5 - Math.cos(Math.PI * clamp(k)) / 2;

/* ───────────────────────── Look ───────────────────────── */

const onLight = (p: Palette): Palette => (p.light ? p : { ...p, text: INK, light: true, bg0: "#f7f5f2", bg1: "#ffffff" });

/** Materials by their 60-30-10 role in a home: walls, furnishings (with a shade each), accents. */
interface Tones {
  wall: Program[];
  support: [Program, number][];
  accent: Program[];
}

/**
 * The intro's colours as a home's 60-30-10: 60% a warm neutral with a whisper of the brand (walls,
 * siding), 30% the palette's support colour, softened for furniture (sofa, cushions, island,
 * headboard, drapes, the roof), 10% the brand accent (the door, throws, pillows, towels).
 */
function homeTones(p: Palette) {
  const accent = p.primary;
  // The support colour: the palette's own (60-30-10) when it has one, else its secondary, brought
  // to a furnishing's lightness (never near-black on a dark palette, never washed out).
  let support = p.support ? mixHex(p.support, p.secondary, 0.45) : p.secondary;
  const [r, g, b] = hexToRgb(support);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum < 0.38) support = mixHex(support, "#ffffff", 0.45 - lum);
  else if (lum > 0.8) support = mixHex(support, "#5b6270", 0.3);
  support = mixHex(support, "#8f949c", 0.18);
  return { neutral: mixHex("#efe8de", accent, 0.05), support, accent };
}

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
let measureCtx: CanvasRenderingContext2D | null = null;
/**
 * The stage's layout (where the headline ends, the safe area), measured without drawing the
 * headline: the home slides draw it over their 3D view (see frame), so a roof reaching up behind
 * it never covers it.
 */
function stage(sc: SkillContext) {
  if (!measureCtx && typeof document !== "undefined") measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return stageAndHeadline(sc);
  measureCtx.font = sc.ctx.font;
  return stageAndHeadline({ ...sc, ctx: measureCtx });
}

/** Rows the 3D view draws above its frame while `frame` runs (so a roof is never cut at the top). */
let ABOVE = 0;
function render(W: World, v: View, w: number, h: number) {
  return draw3d(W, { ...v, above: ABOVE }, w, h);
}

/**
 * The 3D view in the slide: framed below the headline (`top`), and drawn on up to the top of the
 * slide behind the headline, so a tall roof or tree carries on rather than being cut off.
 */
function frame(sc: SkillContext, top: number, draw: (w: number, h: number) => HTMLCanvasElement | null, reach = true) {
  const { ctx, w, h } = sc;
  // (Views looking down on the ground, the plan and the flyover, keep the sky behind the headline.)
  const up = reach ? Math.max(0, top) : 0;
  ABOVE = up;
  let cv: HTMLCanvasElement | null;
  try {
    cv = draw(w, h - top);
  } finally {
    ABOVE = 0;
  }
  if (cv) {
    ctx.save();
    ctx.globalAlpha *= 1 - exitOf(sc);
    ctx.drawImage(cv, 0, top - up, w, h - top + up);
    ctx.restore();
  }
  // The headline, over the view.
  topHeadline(sc);
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
  /** The shutters (the door's colour in a named style; the 30% colour in the intro's own look). */
  shutter: Program;
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
    shutter: W.mat({ color: "#7c5cff", gloss: 0.5 }),
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
  // Corner boards up the siding and a frieze band under the eaves.
  for (const [cx, cz, hh] of [[-MAIN.w / 2, fz, MAIN.h], [MAIN.w / 2, fz, MAIN.h], [-MAIN.w / 2, -fz, MAIN.h], [MAIN.w / 2 + GAR.w, gz, GAR.h], [MAIN.w / 2 + GAR.w, gz - GAR.d, GAR.h]] as const) put(W, box(gl, 0.2, hh - 0.95, 0.2), mats.trim, walls, cx, b + 0.95 + (hh - 0.95) / 2, cz, false);
  put(W, box(gl, MAIN.w + 0.1, 0.18, 0.08), mats.trim, walls, 0, b + MAIN.h - 0.1, fz + 0.03, false);
  put(W, box(gl, 0.08, 0.18, MAIN.d + 0.1), mats.trim, walls, -MAIN.w / 2 - 0.03, b + MAIN.h - 0.1, 0, false);
  put(W, box(gl, GAR.w + 0.1, 0.16, 0.08), mats.trim, walls, gx, b + GAR.h - 0.09, gz + 0.03, false);
  // A stone water table where the siding meets the stone base.
  put(W, box(gl, MAIN.w + 0.2, 0.08, MAIN.d + 0.2), mats.trim, walls, 0, b + 0.97, 0, false);
  put(W, box(gl, GAR.w + 0.2, 0.08, GAR.d + 0.2), mats.trim, walls, gx, b + 0.97, -(MAIN.d - GAR.d) / 2, false);
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
    // Colonial grilles (six over six) and a crown header over the front windows.
    if (!side) {
      for (const dx of [-ww / 6, ww / 6]) put(W, box(gl, 0.03, hh, 0.13), mats.trim, walls, x + dx, y, z, false);
      for (const dy of [hh * 0.32, -hh * 0.17]) put(W, box(gl, ww, 0.03, 0.13), mats.trim, walls, x, y + dy, z, false);
      put(W, box(gl, ww + 0.5, 0.14, 0.18), mats.trim, walls, x, y + hh / 2 + 0.2, z + 0.04, false);
      put(W, box(gl, ww + 0.36, 0.06, 0.2), mats.trim, walls, x, y + hh / 2 + 0.3, z + 0.05, false);
    }
    // Soft curtains drawn to either side, read through the glass.
    if (!side) for (const k of [-1, 1]) put(W, box(gl, ww * 0.16, hh * 0.92, 0.012), curtain, walls, x + k * ww * 0.39, y - hh * 0.02, z + 0.086, false);
    // A sill under it, and on the front, shutters either side.
    if (side) put(W, box(gl, 0.22, 0.08, ww + 0.4), mats.trim, walls, x - 0.06, y - hh / 2 - 0.16, z, false);
    else {
      put(W, box(gl, ww + 0.44, 0.08, 0.22), mats.trim, walls, x, y - hh / 2 - 0.16, z + 0.08, false);
      for (const sx of [-1, 1]) {
        put(W, box(gl, 0.38, hh + 0.2, 0.06), mats.shutter, walls, x + sx * (ww / 2 + 0.36), y, z + 0.02, false);
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
  // The front door: a panelled door in the brand's colour between glass sidelights, under a
  // transom, in a wide trimmed surround; a brass handle and kick plate.
  const brass = W.mat({ color: "#d9b45a", metal: 0.9, gloss: 0.8 });
  put(W, box(gl, 2.05, 2.95, 0.1), mats.trim, walls, 1.35, b + 1.48, fz + 0.03);
  put(W, box(gl, 1.0, 2.3, 0.12), mats.door, walls, 1.35, b + 1.15, fz + 0.05);
  for (const [py, ph] of [[b + 1.7, 0.7], [b + 0.62, 0.7]] as const) for (const px of [1.13, 1.57]) put(W, box(gl, 0.32, ph, 0.03), W.mat({ color: "#000000", alpha: 0.12, transparent: true }), walls, px, py, fz + 0.115, false);
  for (let i = 0; i < 3; i++) put(W, box(gl, 0.22, 0.2, 0.03), mats.glass, walls, 1.11 + i * 0.24, b + 2.1, fz + 0.12, false);
  put(W, box(gl, 0.07, 0.07, 0.06), brass, walls, 1.7, b + 1.1, fz + 0.13, false);
  put(W, box(gl, 0.9, 0.18, 0.02), brass, walls, 1.35, b + 0.12, fz + 0.12, false);
  for (const sx of [-1, 1]) {
    put(W, box(gl, 0.3, 2.2, 0.06), mats.glass, walls, 1.35 + sx * 0.72, b + 1.12, fz + 0.09, false);
    for (let k = 1; k < 4; k++) put(W, box(gl, 0.3, 0.025, 0.07), mats.trim, walls, 1.35 + sx * 0.72, b + k * 0.55, fz + 0.1, false);
  }
  put(W, box(gl, 1.75, 0.34, 0.06), mats.glass, walls, 1.35, b + 2.62, fz + 0.09, false);
  for (let k = 1; k < 5; k++) put(W, box(gl, 0.025, 0.34, 0.07), mats.trim, walls, 1.35 - 0.875 + k * 0.35, b + 2.62, fz + 0.1, false);
  const lamp = W.mat({ color: "#2a2c31", metal: 0.6, gloss: 0.6 });
  const lampGlass = W.mat({ color: "#ffe2a8", gloss: 0.4, emit: [0.9, 0.62, 0.3] });
  for (const lx of [0.15, 2.55, gx - 1.75, gx + 1.75]) {
    const ly = lx > 3 ? b + 2.0 : b + 1.75;
    const lz = lx > 3 ? gz + 0.1 : fz + 0.1;
    put(W, box(gl, 0.2, 0.36, 0.14), lamp, walls, lx, ly, lz, false);
    put(W, box(gl, 0.13, 0.24, 0.15), lampGlass, walls, lx, ly - 0.02, lz + 0.01, false);
  }
  // Carriage-style garage doors: vertical boards, a centre split, strap hinges and handles, the
  // windows along the top, under a small pergola on brackets.
  for (let i = 1; i < 12; i++) put(W, box(gl, 0.018, 2.3, 0.1), mats.trim, walls, gx - 1.5 + i * 0.25, b + 1.16, gz + 0.06, false);
  put(W, box(gl, 0.05, 2.35, 0.11), lamp, walls, gx, b + 1.18, gz + 0.065, false);
  for (const sx of [-1, 1]) {
    for (const hy of [0.55, 1.6]) put(W, box(gl, 0.6, 0.05, 0.03), lamp, walls, gx + sx * 1.2, b + hy, gz + 0.12, false);
    put(W, box(gl, 0.04, 0.32, 0.04), lamp, walls, gx + sx * 0.14, b + 1.15, gz + 0.13, false);
  }
  for (let i = 0; i < 4; i++) put(W, box(gl, 0.55, 0.28, 0.04), mats.glass, walls, gx - 1.05 + i * 0.7, b + 2.0, gz + 0.1, false);
  put(W, box(gl, 3.7, 0.14, 0.12), mats.trim, walls, gx, b + 2.72, gz + 0.62);
  for (let i = 0; i < 9; i++) put(W, box(gl, 0.08, 0.13, 0.75), mats.trim, walls, gx - 1.75 + i * 0.4375, b + 2.82, gz + 0.36);
  for (const sx of [-1.6, 1.6]) {
    const br = put(W, box(gl, 0.08, 0.5, 0.08), mats.trim, walls, gx + sx, b + 2.55, gz + 0.32);
    br.rotation.x = 0.8;
  }
  // A full-width front porch: a painted floor on a trimmed skirt, columns on stone piers, white
  // railings with balusters, a pale blue ceiling, a gabled entry over wide steps; rocking chairs,
  // hanging ferns, potted plants and a welcome mat.
  const porch = node(walls);
  const PW = MAIN.w + 0.3;
  const PD = 1.9;
  const pz = fz + PD / 2;
  const floorTop = 0.42;
  const porchFloor = W.mat({ color: "#8d939b", gloss: 0.35 });
  const ceiling = W.mat({ color: "#cfe5ec", gloss: 0.2 });
  put(W, box(gl, PW, floorTop, PD), porchFloor, porch, 0, floorTop / 2, pz);
  put(W, box(gl, PW + 0.06, 0.2, 0.06), mats.trim, porch, 0, floorTop - 0.12, fz + PD + 0.01);
  for (let i = 0; i < 3; i++) put(W, box(gl, 1.8, 0.14, 0.36), mats.stone, porch, 1.35, floorTop - 0.07 - i * 0.14, fz + PD + 0.18 + i * 0.36);
  const cols = [-PW / 2 + 0.15, -1.0, 0.45, 2.25, PW / 2 - 0.15];
  for (const x of cols) {
    put(W, box(gl, 0.42, 0.85, 0.42), mats.stone, porch, x, floorTop + 0.42, fz + PD - 0.2);
    put(W, box(gl, 0.48, 0.08, 0.48), mats.trim, porch, x, floorTop + 0.88, fz + PD - 0.2);
    const col = W.mesh(cylinder(gl, 0.12, 0.17, 1.95, 4), mats.trim, porch);
    col.position.set(x, floorTop + 1.9, fz + PD - 0.2);
    col.rotation.y = Math.PI / 4;
    put(W, box(gl, 0.36, 0.1, 0.36), mats.trim, porch, x, floorTop + 2.9, fz + PD - 0.2);
  }
  put(W, box(gl, PW + 0.1, 0.3, 0.3), mats.trim, porch, 0, floorTop + 3.08, fz + PD - 0.2);
  put(W, box(gl, PW, 0.04, PD), ceiling, porch, 0, floorTop + 2.92, pz, false);
  const proof = put(W, box(gl, PW + 0.5, 0.08, PD + 0.45), mats.roof, porch, 0, floorTop + 3.32, pz + 0.12);
  proof.rotation.x = 0.16;
  put(W, gable(gl, 2.6, 0.85, 0.7), mats.roof, porch, 1.35, floorTop + 3.25, fz + PD - 0.05);
  put(W, box(gl, 2.2, 0.55, 0.05), mats.trim, porch, 1.35, floorTop + 3.48, fz + PD + 0.3, false);
  // The house number on the entry gable, facing the street; a GFCI outlet on the porch wall.
  addressNumbers(W, porch, "124", 1.35, floorTop + 3.42, fz + PD + 0.34, mats.door, W.mat({ color: "#f4f1ea", gloss: 0.4 }));
  put(W, box(gl, 0.1, 0.16, 0.03), W.mat({ color: "#e9e6e0", gloss: 0.4 }), walls, 2.75, floorTop + 0.45, fz + 0.03, false);
  // Railings between the columns (not across the steps) and down the sides.
  const rail = (x0: number, x1: number, z0: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const along = x1 !== x0;
    for (const ry of [floorTop + 0.12, floorTop + 0.9]) put(W, along ? box(gl, len, 0.06, 0.08) : box(gl, 0.08, 0.06, len), mats.trim, porch, (x0 + x1) / 2, ry, (z0 + z1) / 2, false);
    const n = Math.floor(len / 0.17);
    for (let i = 1; i < n; i++) put(W, box(gl, 0.04, 0.76, 0.04), mats.trim, porch, x0 + ((x1 - x0) * i) / n, floorTop + 0.5, z0 + ((z1 - z0) * i) / n, false);
  };
  rail(cols[0] + 0.21, cols[1] - 0.21, fz + PD - 0.2, fz + PD - 0.2);
  rail(cols[1] + 0.21, cols[2] - 0.21, fz + PD - 0.2, fz + PD - 0.2);
  rail(cols[3] + 0.21, cols[4] - 0.21, fz + PD - 0.2, fz + PD - 0.2);
  for (const sx of [-1, 1]) rail(sx * (PW / 2 - 0.15), sx * (PW / 2 - 0.15), fz + 0.1, fz + PD - 0.41);
  // Two rocking chairs and a small table at the window end, a welcome mat, potted plants, ferns.
  const chairM = W.mat({ color: "#f4f2ee", gloss: 0.35 });
  for (const cx of [-2.45, -1.5]) {
    const ch = node(porch);
    ch.position.set(cx, floorTop, fz + 0.75);
    put(W, box(gl, 0.5, 0.05, 0.46), chairM, ch, 0, 0.45, 0);
    for (let i = 0; i < 4; i++) put(W, box(gl, 0.07, 0.6, 0.03), chairM, ch, -0.18 + i * 0.12, 0.8, -0.22);
    put(W, box(gl, 0.52, 0.05, 0.04), chairM, ch, 0, 1.1, -0.22);
    for (const sx of [-0.22, 0.22]) {
      put(W, box(gl, 0.04, 0.45, 0.04), chairM, ch, sx, 0.22, 0.18);
      put(W, box(gl, 0.04, 0.45, 0.04), chairM, ch, sx, 0.22, -0.2);
      const rk = W.mesh(cylinder(gl, 0.02, 0.02, 0.62, 8), chairM, ch);
      rk.position.set(sx, 0.03, 0);
      rk.rotation.x = Math.PI / 2;
      put(W, box(gl, 0.05, 0.04, 0.4), chairM, ch, sx, 0.62, 0.02);
    }
  }
  put(W, cylinder(gl, 0.2, 0.2, 0.45, 16) as ReturnType<typeof box>, chairM, porch, -1.98, floorTop + 0.23, fz + 0.85);
  put(W, box(gl, 0.9, 0.02, 0.55), W.mat({ color: "#7a5a3a", gloss: 0.1 }), porch, 1.35, floorTop + 0.01, fz + 0.45, false);
  const potM = W.mat({ color: "#2f3540", gloss: 0.5 });
  const fern = W.mat({ color: "#3f8f4e", gloss: 0.3 });
  for (const px of [0.55, 2.15]) {
    put(W, cylinder(gl, 0.2, 0.15, 0.42, 16) as ReturnType<typeof box>, potM, porch, px, floorTop + 0.21, fz + PD - 0.55);
    const sh = W.mesh(sphere(gl, 0.28, 14, 10), fern, porch);
    sh.position.set(px, floorTop + 0.62, fz + PD - 0.55);
  }
  const basket = W.mat({ color: "#8a6446", gloss: 0.2 });
  for (const hx of [-2.0, 3.0]) {
    put(W, box(gl, 0.015, 0.5, 0.015), lamp, porch, hx, floorTop + 2.65, fz + PD - 0.45, false);
    const bk = W.mesh(cylinder(gl, 0.18, 0.12, 0.18, 14), basket, porch);
    bk.position.set(hx, floorTop + 2.3, fz + PD - 0.45);
    for (const [dx, dy, r] of [[0, 0.06, 0.24], [0.12, -0.08, 0.17], [-0.12, -0.1, 0.17]] as const) {
      const f = W.mesh(sphere(gl, r, 12, 8), fern, porch);
      f.position.set(hx + dx, floorTop + 2.3 + dy, fz + PD - 0.45);
      f.scale.set(1, 0.7, 1);
    }
  }
  // Roofs: a front gable over the main block (with a vent), one over the garage, and a chimney.
  const roof = node(root);
  const r1 = put(W, gable(gl, MAIN.w + 0.8, 2.5, MAIN.d + 0.7), mats.roof, roof, 0, b + MAIN.h, 0);
  void r1;
  put(W, box(gl, MAIN.w + 0.9, 0.12, MAIN.d + 0.8), mats.trim, roof, 0, b + MAIN.h + 0.02, 0, false);
  // An octagonal attic window in the front gable, and fascia boards along both gables' edges.
  const oct = W.mesh(cylinder(gl, 0.42, 0.42, 0.08, 8), mats.trim, roof, false);
  oct.position.set(0, b + MAIN.h + 1.0, MAIN.d / 2 + 0.36);
  oct.rotation.set(Math.PI / 2, Math.PI / 8, 0);
  const octG = W.mesh(cylinder(gl, 0.32, 0.32, 0.09, 8), mats.glass, roof, false);
  octG.position.set(0, b + MAIN.h + 1.0, MAIN.d / 2 + 0.37);
  octG.rotation.set(Math.PI / 2, Math.PI / 8, 0);
  for (const [cx, cw, rise, gzF, y0] of [[0, MAIN.w + 0.8, 2.5, (MAIN.d + 0.7) / 2, b + MAIN.h], [gx, GAR.w + 0.6, 1.4, -(MAIN.d - GAR.d) / 2 + (GAR.d + 0.6) / 2, b + GAR.h]] as const) {
    const half = cw / 2;
    const ang = Math.atan2(rise, half);
    const len = Math.hypot(half, rise);
    for (const sx of [-1, 1]) {
      const fb = put(W, box(gl, len + 0.1, 0.22, 0.07), mats.trim, roof, cx + (sx * half) / 2, y0 + rise / 2, gzF + 0.04, false);
      fb.rotation.z = -sx * ang;
    }
  }
  put(W, gable(gl, GAR.w + 0.6, 1.4, GAR.d + 0.6), mats.roof, roof, gx, b + GAR.h, -(MAIN.d - GAR.d) / 2);
  put(W, box(gl, GAR.w + 0.7, 0.1, GAR.d + 0.7), mats.trim, roof, gx, b + GAR.h + 0.02, -(MAIN.d - GAR.d) / 2, false);
  // The chimney: two feet above the ridge (the 3-2-10 rule: above any roof within ten feet).
  put(W, box(gl, 0.75, 3.25, 0.75), mats.stone, roof, -2.1, b + MAIN.h + 1.525, -1.2);
  put(W, box(gl, 0.95, 0.12, 0.95), mats.trim, roof, -2.1, b + MAIN.h + 3.2, -1.2, false);
  // Two clay chimney pots.
  const clay = W.mat({ color: "#b86b4b", gloss: 0.3 });
  for (const dx of [-0.15, 0.17]) {
    const pot = W.mesh(cylinder(gl, 0.09, 0.11, 0.38, 12), clay, roof, false);
    pot.position.set(-2.1 + dx, b + MAIN.h + 3.45, -1.2);
  }
  // A louvered vent in the garage gable.
  const garFront = -(MAIN.d - GAR.d) / 2 + (GAR.d + 0.6) / 2;
  put(W, box(gl, 0.8, 0.55, 0.06), mats.trim, roof, gx, b + GAR.h + 0.45, garFront + 0.02, false);
  put(W, box(gl, 0.64, 0.4, 0.05), mats.shutter, roof, gx, b + GAR.h + 0.45, garFront + 0.03, false);
  for (let i = 0; i < 4; i++) put(W, box(gl, 0.64, 0.025, 0.07), mats.trim, roof, gx, b + GAR.h + 0.31 + i * 0.095, garFront + 0.04, false);
  // A cupola on the garage ridge with a weathervane.
  const ridgeY = b + GAR.h + 1.4;
  const cz0 = -(MAIN.d - GAR.d) / 2;
  put(W, box(gl, 0.7, 0.75, 0.7), mats.trim, roof, gx, ridgeY + 0.05, cz0);
  for (const dz of [-0.36, 0.36]) {
    put(W, box(gl, 0.42, 0.36, 0.02), mats.shutter, roof, gx, ridgeY + 0.15, cz0 + dz, false);
    for (let i = 0; i < 4; i++) put(W, box(gl, 0.42, 0.02, 0.03), mats.trim, roof, gx, ridgeY + 0.02 + i * 0.09, cz0 + dz, false);
  }
  put(W, box(gl, 0.84, 0.08, 0.84), mats.trim, roof, gx, ridgeY + 0.46, cz0, false);
  const cap = W.mesh(cylinder(gl, 0.04, 0.6, 0.45, 4), mats.roof, roof);
  cap.position.set(gx, ridgeY + 0.72, cz0);
  cap.rotation.y = Math.PI / 4;
  const vane = W.mat({ color: "#2a2c31", metal: 0.6, gloss: 0.6 });
  const rod = W.mesh(cylinder(gl, 0.015, 0.015, 0.7, 6), vane, roof, false);
  rod.position.set(gx, ridgeY + 1.25, cz0);
  W.mesh(sphere(gl, 0.05, 10, 8), W.mat({ color: "#d9b45a", metal: 0.9, gloss: 0.8 }), roof, false).position.set(gx, ridgeY + 1.05, cz0);
  put(W, box(gl, 0.6, 0.03, 0.03), vane, roof, gx, ridgeY + 1.45, cz0, false);
  put(W, box(gl, 0.16, 0.14, 0.02), vane, roof, gx - 0.26, ridgeY + 1.45, cz0, false);
  const tip = put(W, box(gl, 0.09, 0.09, 0.02), vane, roof, gx + 0.3, ridgeY + 1.45, cz0, false);
  tip.rotation.z = Math.PI / 4;
  for (const [dx, dz] of [[0.18, 0], [0, 0.18]] as const) put(W, box(gl, dx ? 0.36 : 0.02, 0.02, dz ? 0.36 : 0.02), vane, roof, gx, ridgeY + 1.3, cz0, false);
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
    s.position.set(-2.7 + i * 0.85, 0.4, fz + 2.45);
    s.scale.set(1, 0.75, 0.9);
  }
  // Flower beds along the front (mulch and blooms), a mailbox at the curb.
  const mulch = W.mat({ color: "#5a3e2b", gloss: 0.1 });
  put(W, box(gl, 3.6, 0.06, 1.0), mulch, land, -1.5, 0.03, fz + 2.55, false);
  put(W, box(gl, 0.8, 0.06, 1.0), mulch, land, 2.75, 0.03, fz + 2.55, false);
  for (const hx of [2.6, 3.0]) {
    const sh = W.mesh(sphere(gl, 0.4, 14, 10), hedge, land);
    sh.position.set(hx, 0.32, fz + 2.45);
    sh.scale.set(1, 0.8, 0.9);
  }
  // A lamp post at the corner of the beds.
  put(W, cylinder(gl, 0.05, 0.06, 2.0, 10) as ReturnType<typeof box>, W.mat({ color: "#2a2c31", metal: 0.6, gloss: 0.6 }), land, -3.75, 1.0, fz + 3.2);
  put(W, box(gl, 0.26, 0.34, 0.26), W.mat({ color: "#ffe2a8", gloss: 0.4, emit: [0.9, 0.62, 0.3] }), land, -3.75, 2.15, fz + 3.2, false);
  put(W, box(gl, 0.34, 0.06, 0.34), W.mat({ color: "#2a2c31", metal: 0.6, gloss: 0.6 }), land, -3.75, 2.35, fz + 3.2, false);
  const blooms = [W.mat({ color: "#f4f1ea", gloss: 0.3 }), W.mat({ color: "#e8a3b5", gloss: 0.3 }), W.mat({ color: "#f2c14e", gloss: 0.3 })];
  for (let i = 0; i < 9; i++) {
    const f = W.mesh(sphere(gl, 0.12, 8, 6), blooms[i % 3], land, false);
    f.position.set(-3.1 + i * 0.38, 0.75 + (i % 2) * 0.08, fz + 2.85);
  }
  put(W, box(gl, 0.1, 1.1, 0.1), mats.trim, land, 4.0, 0.55, 9.3);
  put(W, box(gl, 0.28, 0.3, 0.5), W.mat({ color: "#2a2c31", metal: 0.5, gloss: 0.6 }), land, 4.0, 1.2, 9.3);
  // Brick edging along the walk, path lights either side, urns of boxwood by the steps.
  const brick = W.mat({ color: "#a65a42", gloss: 0.2 });
  for (const sx of [-0.66, 0.66]) {
    put(W, box(gl, 0.14, 0.05, 4.6), brick, land, 1.35 + sx, 0.025, fz + 4.3, false);
    for (let z = fz + 2.1; z < fz + 6.6; z += 0.3) put(W, box(gl, 0.15, 0.052, 0.015), W.mat({ color: "#8a4835", gloss: 0.2 }), land, 1.35 + sx, 0.026, z, false);
  }
  const pathLamp = W.mat({ color: "#2a2c31", metal: 0.6, gloss: 0.6 });
  const pathGlow = W.mat({ color: "#ffe2a8", gloss: 0.4, emit: [0.9, 0.62, 0.3] });
  for (const z of [fz + 3.0, fz + 6.2]) for (const sx of [-0.95, 0.95]) {
    put(W, cylinder(gl, 0.03, 0.03, 0.42, 8) as ReturnType<typeof box>, pathLamp, land, 1.35 + sx, 0.21, z, false);
    put(W, cylinder(gl, 0.07, 0.07, 0.09, 10) as ReturnType<typeof box>, pathGlow, land, 1.35 + sx, 0.46, z, false);
    put(W, cylinder(gl, 0.03, 0.12, 0.06, 10) as ReturnType<typeof box>, pathLamp, land, 1.35 + sx, 0.53, z, false);
  }
  const urn = W.mat({ color: "#2f3540", gloss: 0.5 });
  for (const ux of [0.25, 2.45]) {
    W.mesh(lathe(gl, [[0, 0], [0.16, 0], [0.12, 0.08], [0.14, 0.2], [0.26, 0.48], [0.28, 0.54], [0, 0.54]], 20), urn, land).position.set(ux, 0, fz + PD + 0.55);
    const bw = W.mesh(sphere(gl, 0.3, 14, 10), hedge, land);
    bw.position.set(ux, 0.78, fz + PD + 0.55);
  }
  // Hydrangeas in blue and pink among the hedges.
  const hyd = [W.mat({ color: "#8fa9e0", gloss: 0.3 }), W.mat({ color: "#d9a0c8", gloss: 0.3 }), W.mat({ color: "#b8c6ef", gloss: 0.3 })];
  for (let i = 0; i < 7; i++) {
    const h0 = W.mesh(sphere(gl, 0.17, 10, 8), hyd[i % 3], land, false);
    h0.position.set(-3.0 + i * 0.47, 0.72 + (i % 2) * 0.1, fz + 2.62);
  }
  tree(W, land, -8.6, 4.2, 1.15);
  tree(W, land, -7.6, -6.5, 0.95);
  return { root, slab: slabT, frame: frameT, walls, roof, land, solar, hvac, insul, mats, rising: [mats.siding, mats.stone, mats.trim, mats.glass, mats.garage, mats.door, brass, porchFloor, ceiling, chairM, potM, fern, basket, lamp] };
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
function styleHome(H: House, a: Style, b: Style, k: number, brand: string, shutter?: string) {
  const mix3 = (x: string, y: string) => rgb(mixHex(x, y, k));
  H.mats.siding.uniforms.uColor.value = mix3(a.siding, b.siding);
  H.mats.trim.uniforms.uColor.value = mix3(a.trim, b.trim);
  H.mats.roof.uniforms.uColor.value = mix3(a.roof, b.roof);
  H.mats.stone.uniforms.uColor.value = mix3(a.stone, b.stone);
  H.mats.door.uniforms.uColor.value = mix3(a.door ?? brand, b.door ?? brand);
  H.mats.shutter.uniforms.uColor.value = shutter ? rgb(shutter) : mix3(a.door ?? brand, b.door ?? brand);
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
  const T = homeTones(sc.palette);
  // The home in the intro's 60-30-10: siding in the neutral, roof and trim in the support colour's
  // deep shade, the door in the accent.
  const own: Style = { ...STYLES[0], siding: mixHex("#f3f0e9", T.support, 0.06), roof: mixHex(T.support, "#24262c", 0.62), trim: mixHex(T.support, "#24262c", 0.45) };
  styleHome(H, own, own, 0, T.accent, mixHex(T.support, "#24262c", 0.25));
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
    // Straight on to the front of the home, a slow push in.
    const k = sine(range(t, 0, d));
    const F = fitBack(sc, top);
    const eye: Num3 = [1.6, 3.1, lerp(25, 21, k) * F + 1];
    return render(W, { ...GOLDEN, flat: !!sc.flat3d, cel: true, eye, target: [1.6, 3.1, 0], fov: 32, shadowSize: 16, shadowAt: [1.5, 0, 0], fog: [0.98, 0.89, 0.77, 0.008] }, w, h);
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
    // Facing straight across the community from the front, trucking along it.
    const cx = lerp(-24, 26, k);
    const eye: Num3 = [cx, lerp(56, 48, k) * F, lerp(72, 66, k) * F];
    const target: Num3 = [cx, 0, lerp(10, 6, k)];
    const out = render(W, { ...GOLDEN, flat: !!sc.flat3d, cel: true, eye, target, fov: 36, shadowSize: 70, shadowAt: [eye[0] + 14, 0, 18], fog: [0.98, 0.89, 0.77, 0.006] }, w, h);
    anchors = parts.spots.map((p) => project(W, p, w, h));
    return out;
  }, false);
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
    // (Once the walls are up the clip lifts, so the chimney and gables above them show in full.)
    for (const m of H.rising) m.uniforms.uClip.value = p < 0.38 ? -1 : p >= 0.62 ? 99 : clip;
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
    // Straight on to the front as the home goes up, a slow push in.
    const F = fitBack(sc, top);
    const eye: Num3 = [1.6, lerp(5.2, 3.6, kk), lerp(27, 23, kk) * F];
    return render(W, { ...GOLDEN, flat: !!sc.flat3d, cel: true, eye, target: [1.6, 2.6, 0], fov: 32, shadowSize: 16, shadowAt: [1.5, 0, 0], fog: [0.98, 0.89, 0.77, 0.006] }, w, h);
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
    // From straight above, tilting down to the front of the plan (never turning to an angle).
    const eye: Num3 = [0, lerp(23, 13, tilt) * F, lerp(0.01, 15, tilt) * F];
    const out = render(W, { ...GOLDEN, flat: !!sc.flat3d, cel: true, sun: [0.5, 0.75, 0.45], eye, target: [0, 0, 0], fov: 34, shadowSize: 10, shadowAt: [0, 0, 0] }, w, h);
    anchors = parts.rooms.map((r0) => project(W, r0.at, w, h));
    labels = parts.rooms.map((r0, i) => names[i] ?? r0.name);
    return out;
  }, false);
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
    // Straight on to the front, a little above so the roof's panels show, pushing in.
    const F = fitBack(sc, top);
    const eye: Num3 = [1, lerp(8, 6.8, k), lerp(23, 20, k) * F];
    const out = render(W, { ...GOLDEN, flat: !!sc.flat3d, cel: true, sun: [0.55, 0.6, 0.6], sunCol: [1, 0.93, 0.8], eye, target: [0, 3, 0], fov: 32, shadowSize: 16, shadowAt: [1.5, 0, 0], fog: [0.98, 0.89, 0.77, 0.006] }, w, h);
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
    const eye: Num3 = [1.6, 3.1, lerp(22, 19, k) * F];
    return render(W, { ...GOLDEN, flat: !!sc.flat3d, cel: true, eye, target: [1.6, 3.1, 0], fov: 32, shadowSize: 16, shadowAt: [1.5, 0, 0], fog: [0.98, 0.89, 0.77, 0.008] }, w, h);
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
    // Walking straight up the path toward the door.
    const eye: Num3 = [1.4, lerp(3.4, 2.7, k), lerp(32, 18, k) * F];
    const target: Num3 = [1.4, lerp(2.9, 2.4, k), lerp(0, 3, k)];
    const out = render(W, { ...GOLDEN, flat: !!sc.flat3d, cel: true, eye, target, fov: 34, shadowSize: 16, shadowAt: [1.5, 0, 4], fog: [0.98, 0.89, 0.77, 0.008] }, w, h);
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

/**
 * Code details (after the IRC, the US model code for homes): a GFCI receptacle on a wall facing +z,
 * with its test and reset buttons, as required by kitchen counters, in bathrooms and outdoors.
 */
function outlet(W: World, x: number, y: number, z: number) {
  const { gl } = W;
  put(W, box(gl, 0.075, 0.12, 0.008), mc(W, "#f7f6f2", 0.5), W.scene, x, y, z, false);
  for (const dy of [-0.032, 0.032]) put(W, box(gl, 0.046, 0.03, 0.01), mc(W, "#e6e4de", 0.5), W.scene, x, y + dy, z + 0.002, false);
  put(W, box(gl, 0.04, 0.014, 0.012), mc(W, "#2a2c31", 0.4), W.scene, x, y, z + 0.003, false);
}

/** A combination smoke and CO alarm high on a wall facing +z (within a foot of the ceiling), its LED steady. */
function alarm(W: World, x: number, y: number, z: number) {
  const { gl } = W;
  const d = W.mesh(cylinder(gl, 0.075, 0.08, 0.035, 20), mc(W, "#f7f6f2", 0.5), W.scene, false);
  d.position.set(x, y, z + 0.018);
  d.rotation.x = Math.PI / 2;
  const r = W.mesh(torus(gl, 0.05, 0.005, Math.PI * 2, 24, 4), mc(W, "#d6d3cc", 0.4), W.scene, false);
  r.position.set(x, y, z + 0.037);
  W.mesh(sphere(gl, 0.008, 6, 4), mc(W, "#5bd16a", 0.3, "#5bd16a"), W.scene, false).position.set(x + 0.045, y + 0.02, z + 0.038);
}

/** Address numbers (seven-segment style, on a plaque), as US codes ask: plain to read from the street. */
function addressNumbers(W: World, parent: Transform, digits: string, x: number, y: number, z: number, plate: Program, ink: Program) {
  const { gl } = W;
  const dw = 0.13;
  const dh = 0.22;
  const t = 0.028;
  put(W, box(gl, digits.length * (dw + 0.06) + 0.12, dh + 0.14, 0.03), plate, parent, x, y, z, false);
  // Segments a–g: top, upper right, lower right, bottom, lower left, upper left, middle.
  const SEG: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abfgcd" };
  [...digits].forEach((ch, i) => {
    const cx = x + (i - (digits.length - 1) / 2) * (dw + 0.06);
    for (const sg of SEG[ch] ?? "") {
      const horiz = "adg".includes(sg);
      const sx = sg === "b" || sg === "c" ? dw / 2 : sg === "e" || sg === "f" ? -dw / 2 : 0;
      const sy = sg === "a" ? dh / 2 : sg === "d" ? -dh / 2 : sg === "g" ? 0 : sg === "b" || sg === "f" ? dh / 4 : -dh / 4;
      put(W, horiz ? box(gl, dw, t, 0.012) : box(gl, t, dh / 2, 0.012), ink, parent, cx + sx, y + sy, z + 0.02, false);
    }
  });
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
  /** The rooms' 60-30-10 colour roles: walls (60), furnishings (30, each with its own shade), accents (10). */
  tones: Tones;
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
  const wallM = W.mat({ color: "#ece3d6", gloss: 0.2 });
  const tones: Tones = { wall: [wallM], support: [], accent: [] };
  const trim = mc(W, "#ffffff", 0.45);
  const oak = mc(W, "#a8794f", 0.45);
  const wood = mc(W, "#8a6446", 0.4);
  const white = mc(W, "#f7f6f2", 0.4);
  const stoneTop = mc(W, "#2f3237", 0.75);
  const fabric = W.mat({ color: "#8b96a6", gloss: 0.2 });
  tones.support.push([fabric, 0]);
  const linen = mc(W, "#ece6dc", 0.15);
  const glass = mc(W, "#cfe3f2", 0.9, "#cfe3f2");
  const warm = mc(W, "#fff1d6", 0.2, "#ffe4b0");
  const H = 2.8;
  const throwM = W.mat({ color: "#7c5cff", gloss: 0.15 });
  // Floors: oak through the house, a tiled kitchen and a deck outside.
  put(W, box(gl, 27.2, 0.2, 8.2), oak, W.scene, -0.4, 0.1, 0, false);
  put(W, box(gl, 8, 0.02, 8), mc(W, "#d9d3ca", 0.5), W.scene, 3, 0.21, 0, false);
  put(W, box(gl, 3.6, 0.18, 8.2), mc(W, "#a07a55", 0.3), W.scene, 14.8, 0.09, 0, false);
  for (let z = -3.9; z < 4.1; z += 0.45) put(W, box(gl, 3.6, 0.182, 0.015), mc(W, "#8a6446", 0.3), W.scene, 14.8, 0.091, z, false);
  // Walls: the back wall with windows, the front wall with the open door, half walls between rooms.
  const wall = (x0: number, z0: number, x1: number, z1: number, hh = H) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = put(W, box(gl, len, hh, 0.16), wallM, W.scene, (x0 + x1) / 2, hh / 2 + 0.2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  };
  wall(-14, -4, 13, -4);
  wall(-14, -4, -14, 2.2);
  for (const x of [-9, -1, 7]) wall(x, -4, x, -1.6);
  // Baseboards along the back wall, crown molding along its top.
  put(W, box(gl, 27, 0.14, 0.04), trim, W.scene, -0.5, 0.27, -3.9, false);
  put(W, box(gl, 27, 0.1, 0.1), trim, W.scene, -0.5, 2.95, -3.87, false);
  put(W, box(gl, 27, 0.05, 0.16), trim, W.scene, -0.5, 2.98, -3.84, false);
  // Oak planks: seams along the floor in staggered lengths.
  const seamM = mc(W, "#8f6542", 0.3);
  for (let z = -3.8, r = 0; z < 4.1; z += 0.22, r++) {
    put(W, box(gl, 27, 0.004, 0.012), seamM, W.scene, -0.5, 0.201, z, false);
    for (let x = -13.6 + (r % 3) * 0.6; x < 13; x += 1.8) put(W, box(gl, 0.012, 0.004, 0.22), seamM, W.scene, x, 0.201, z + 0.11, false);
  }
  // Board-and-batten wainscot in the foyer and the owner's suite.
  for (const [x0, x1] of [[-13.9, -9.1], [7.1, 12.9]] as const) {
    put(W, box(gl, x1 - x0, 0.06, 0.07), trim, W.scene, (x0 + x1) / 2, 0.98, -3.88, false);
    put(W, box(gl, x1 - x0, 0.04, 0.05), trim, W.scene, (x0 + x1) / 2, 0.92, -3.89, false);
    for (let x = x0 + 0.05; x <= x1; x += 0.48) put(W, box(gl, 0.07, 0.62, 0.03), trim, W.scene, x, 0.62, -3.9, false);
  }
  // The patio doors: glass panels either side of an open slider.
  wall(13, -4, 13, -2.6);
  for (const z of [-2.4, -0.8]) put(W, box(gl, 0.06, 2.4, 1.5), glass, W.scene, 13, 1.4, z, false);
  put(W, box(gl, 0.14, 0.12, 4.2), trim, W.scene, 13, 2.65, -1.3);
  // Windows on the back wall: bright panes in white frames.
  const win = (x: number, w: number, y = 1.6, hh = 1.5) => {
    put(W, box(gl, w + 0.18, hh + 0.18, 0.06), trim, W.scene, x, y, -3.9, false);
    put(W, box(gl, w, hh, 0.04), glass, W.scene, x, y, -3.86, false);
    put(W, box(gl, 0.05, hh, 0.07), trim, W.scene, x, y, -3.84, false);
    // Grilles, a stool and apron under it, a casing header over it.
    for (let k = 1; k < 3; k++) put(W, box(gl, w, 0.025, 0.065), trim, W.scene, x, y - hh / 2 + (k * hh) / 3, -3.845, false);
    for (const dx of [-w / 4, w / 4]) put(W, box(gl, 0.025, hh, 0.065), trim, W.scene, x + dx, y, -3.845, false);
    put(W, box(gl, w + 0.36, 0.05, 0.16), trim, W.scene, x, y - hh / 2 - 0.11, -3.82, false);
    put(W, box(gl, w + 0.2, 0.1, 0.04), trim, W.scene, x, y - hh / 2 - 0.2, -3.88, false);
    put(W, box(gl, w + 0.34, 0.12, 0.08), trim, W.scene, x, y + hh / 2 + 0.15, -3.86, false);
  };
  win(-6.5, 2.4);
  win(-3.5, 1.4);
  win(12.35, 0.9);
  win(7.75, 0.8);
  // The front door, open, in a white frame (it takes the brand's colour).
  put(W, box(gl, 0.2, 2.5, 0.16), trim, W.scene, -14, 1.45, 2.3);
  const doorM = W.mat({ color: "#7c5cff", gloss: 0.5 });
  tones.accent.push(doorM);
  put(W, box(gl, 0.07, 2.3, 1.0), doorM, W.scene, -13.85, 1.35, 1.65);
  tones.accent.push(throwM);
  furnish(W, { wood, oak, white, linen, fabric, stoneTop, glass, warm, throwM, tones });
  // Trees beyond the back fence.
  tree(W, W.scene, 15.5, -7.2, 1.2);
  tree(W, W.scene, 19.5, -8.5, 1.4);
  tree(W, W.scene, 23, -6.8, 1.1);
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
    tones,
    rooms: [
      // (Each room seen straight on from the front; the glide between them trucks sideways.)
      { name: "Welcoming foyer", eye: [-11.6, 1.6, 4.4], target: [-11.6, 1.15, -1.6] },
      { name: "Open living room", eye: [-5, 1.6, 4.4], target: [-5, 1.0, -1.6] },
      { name: "Chef-inspired kitchen", eye: [3, 1.7, 4.4], target: [3, 1.15, -1.6] },
      { name: "Owner's suite", eye: [10, 1.6, 4.3], target: [10, 0.95, -1.8] },
      { name: "Backyard and pool", eye: [19.2, 3.0, 5.6], target: [19.2, 0.6, -1.6] },
    ],
  };
}

/**
 * The furniture kit shared by the interiors: metals, a 30%-colour material maker (each its own
 * shade, see tintInterior), leaves and soil, and pieces placed in the scene: a box, a rounded box,
 * a cylinder, a table lamp, a potted plant and a framed print on the back wall (at z = -3.92).
 */
function kit(W: World, tones: Tones, white: Program, warm: Program) {
  const { gl } = W;
  const F = 0.2;
  const BACK = -3.92;
  const metal = mc(W, "#b9bec6", 0.85);
  const dark = mc(W, "#26262c", 0.5);
  const black = mc(W, "#141418", 0.8);
  const steel = mc(W, "#cfd3d9", 0.85);
  const brass = mc(W, "#c9a35a", 0.8);
  // Furnishings in the 30% colour, each its own shade of it (see tintInterior).
  const role = (color: string, shade: number, gloss = 0.2) => {
    const m = W.mat({ color, gloss });
    tones.support.push([m, shade]);
    return m;
  };
  const leafA = W.mat({ color: "#2f7d43", color2: "#7fc464", gloss: 0.55, kind: "leaf" });
  const leafB = W.mat({ color: "#3e9550", color2: "#9ad37a", gloss: 0.55, kind: "leaf" });
  const soil = mc(W, "#3a2a20", 0.05);
  // Pieces: a box, a rounded box (a cushion, a slab of wood), a cylinder, each placed (and turned).
  const bx = (w: number, h: number, d: number, m: Program, x: number, y: number, z: number, ry = 0, cast = true) => {
    const me = put(W, box(gl, w, h, d), m, W.scene, x, y, z, cast);
    me.rotation.y = ry;
    return me;
  };
  const rb = (w: number, h: number, d: number, r: number, m: Program, x: number, y: number, z: number, ry = 0, rx = 0, parent: Transform = W.scene) => {
    const g = node(parent);
    const sl = slab(gl, w, h, d, r, Math.min(r, d / 2, h / 2) * 0.9);
    W.mesh(sl.front, m, g);
    W.mesh(sl.back, m, g);
    W.mesh(sl.body, m, g);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    g.rotation.x = rx;
    return g;
  };
  const cy = (r0: number, r1: number, h: number, m: Program, x: number, y: number, z: number, seg = 16, parent: Transform = W.scene, cast = true) => {
    const me = W.mesh(cylinder(gl, r0, r1, h, seg), m, parent, cast);
    me.position.set(x, y, z);
    return me;
  };
  // A lamp: a turned base, a stem and a lit fabric shade.
  const lamp = (x: number, y: number, z: number, s = 1, base: Program = white) => {
    W.mesh(lathe(gl, [[0, 0], [0.09 * s, 0], [0.11 * s, 0.05 * s], [0.07 * s, 0.24 * s], [0.03 * s, 0.3 * s], [0, 0.3 * s]], 24), base, W.scene).position.set(x, y, z);
    cy(0.012 * s, 0.012 * s, 0.16 * s, brass, x, y + 0.36 * s, z, 8);
    W.mesh(lathe(gl, [[0.1 * s, 0.38 * s], [0.18 * s, 0.38 * s], [0.13 * s, 0.6 * s], [0.07 * s, 0.6 * s]], 28), warm, W.scene, false).position.set(x, y, z);
  };
  // A potted plant: a glazed pot with soil and arching leaves.
  const plant = (x: number, z: number, s = 1, pot: Program = white) => {
    W.mesh(lathe(gl, [[0, 0], [0.16 * s, 0], [0.19 * s, 0.03 * s], [0.24 * s, 0.42 * s], [0.27 * s, 0.44 * s], [0.27 * s, 0.48 * s], [0.23 * s, 0.48 * s], [0.22 * s, 0.44 * s]], 28), pot, W.scene).position.set(x, F, z);
    cy(0.225 * s, 0.225 * s, 0.02, soil, x, F + 0.43 * s, z, 20, W.scene, false);
    const g = node(W.scene);
    g.position.set(x, F + 0.43 * s, z);
    for (let i = 0; i < 9; i++) {
      const lg = node(g);
      lg.rotation.y = i * 2.39996;
      const l = W.mesh(leaf(gl, (i < 3 ? 1.0 : 0.75) * s, 0.24 * s, i < 3 ? 0.25 : 0.55, 0.3), i % 2 ? leafA : leafB, lg);
      l.rotation.x = -(i < 3 ? 0.15 : 0.5 + (i % 3) * 0.1);
    }
  };
  // A framed picture on the back wall: a thin frame, a mat and a soft abstract print.
  const art = (x: number, y: number, w: number, h: number, colors: string[]) => {
    bx(w, h, 0.04, dark, x, y, BACK + 0.02, 0, false);
    bx(w - 0.06, h - 0.06, 0.02, mc(W, "#f6f3ee", 0.2), x, y, BACK + 0.045, 0, false);
    colors.forEach((c, i) => bx((w - 0.3) / colors.length, h - 0.3 - (i % 2) * 0.12, 0.012, mc(W, c, 0.2), x - (w - 0.3) / 2 + ((i + 0.5) * (w - 0.3)) / colors.length, y - (i % 2) * 0.06, BACK + 0.058, 0, false));
  };
  return { metal, dark, black, steel, brass, role, leafA, leafB, soil, bx, rb, cy, lamp, plant, art };
}

interface FurnishMats {
  wood: Program;
  oak: Program;
  white: Program;
  linen: Program;
  fabric: Program;
  stoneTop: Program;
  glass: Program;
  warm: Program;
  throwM: Program;
  tones: Tones;
}

/**
 * The rooms' furniture, appliances and decor, modelled piece by piece: cushioned seating, a stocked
 * bookshelf, a fireplace with its mantel, a working kitchen (range, hood, sink and faucet, a
 * French-door fridge, panelled cabinets with handles, an island with stools under pendants), a
 * tufted bed with bedding, nightstands and a dresser, the foyer's console, mirror and bench, and a
 * furnished patio. The back wall's inner face is at z = -3.92; floors are at y = 0.2.
 */
function furnish(W: World, M: FurnishMats) {
  const { gl } = W;
  const F = 0.2;
  const BACK = -3.92;
  const { metal, dark, black, steel, brass, role, leafA, leafB, soil, bx, rb, cy, lamp, plant, art } = kit(W, M.tones, M.white, M.warm);
  const cushion = role("#a3adbb", 0.22, 0.15);
  const navy = role("#3d4f6b", -0.25);
  const islandM = role("#5b6b7c", -0.3, 0.35);
  const islandPanel = role("#6a7a8c", -0.18, 0.35);
  const headM = role("#9a8f86", 0.12, 0.15);
  const rugA = mc(W, "#cdb89a", 0.08);
  const rugB = mc(W, "#efe6d6", 0.08);
  // Curtains: soft folds hanging either side of a window, on a rod.
  const drape = role("#9fb3b8", 0.38, 0.15);
  const curtains = (x: number, w: number, top = 2.6) => {
    cy(0.015, 0.015, w + 1.0, brass, x, top, BACK + 0.12, 8).rotation.z = Math.PI / 2;
    for (const sd of [-1, 1])
      for (let i = 0; i < 5; i++) cy(0.06, 0.07, top - F - 0.05, drape, x + sd * (w / 2 + 0.12 + i * 0.09), F + (top - F) / 2, BACK + 0.14 + (i % 2) * 0.04, 10);
  };

  /* Foyer: a staircase with a newel post, balusters and a handrail; a console with drawers, a round
     mirror, a lamp and a bowl; a runner; a bench with shoes; coat hooks. */
  // The stairs rise along the back wall to code (IRC R311.7): fourteen 7½" risers on 10" treads with
  // nosings, a handrail 35" above the nosings, balusters close enough that a 4⅜" sphere can't pass.
  const RISE = 0.19;
  const RUN = 0.255;
  const N = 14;
  const X0 = -10.52;
  for (let i = 0; i < N; i++) {
    const hh = (i + 1) * RISE;
    const sx = X0 - i * RUN;
    bx(RUN, hh, 1.0, M.white, sx, F + hh / 2, -3.42);
    bx(RUN + 0.03, 0.03, 1.03, M.oak, sx - 0.015, F + hh + 0.015, -3.42);
  }
  const slopeK = RISE / RUN;
  // The nosing line at a point along the run, and the rail 0.9 above it.
  const nose = (x: number) => F + RISE + (X0 + RUN / 2 - x) * slopeK;
  for (let i = 0; i < N; i++) {
    const sx = X0 - i * RUN;
    for (const dx of [-0.085, 0, 0.085]) {
      const top = nose(sx + dx) + 0.9;
      const base = F + (i + 1) * RISE + 0.03;
      cy(0.014, 0.014, top - base, M.white, sx + dx, (top + base) / 2, -2.98, 8);
    }
  }
  const stairAng = Math.atan(slopeK);
  const runLen = Math.hypot(N * RUN, N * RISE);
  const midX = X0 - ((N - 1) * RUN) / 2;
  const skirt = bx(runLen + 0.1, 0.22, 0.04, M.white, midX, nose(midX) - 0.1, -2.9, 0);
  skirt.rotation.z = -stairAng;
  const handrail = bx(runLen + 0.1, 0.06, 0.08, M.wood, midX, nose(midX) + 0.92, -2.98, 0);
  handrail.rotation.z = -stairAng;
  // The newel post at the foot: a panelled post with a cap and a ball.
  bx(0.16, 1.15, 0.16, M.white, X0 + 0.2, F + 0.575, -2.98);
  bx(0.22, 0.06, 0.22, M.wood, X0 + 0.2, F + 1.18, -2.98);
  W.mesh(sphere(gl, 0.07, 12, 8), M.wood, W.scene).position.set(X0 + 0.2, F + 1.27, -2.98);
  // Panel moulding on the side of the stairs.
  for (let i = 0; i < 4; i++) {
    const px = X0 - 0.5 - i * 0.82;
    const ph = Math.max(0.2, (nose(px + 0.3) - F) * 0.72);
    bx(0.6, ph, 0.02, mc(W, "#e9e6e0", 0.4), px, F + 0.12 + ph / 2, -2.91, 0, false);
    bx(0.54, ph - 0.06, 0.022, M.white, px, F + 0.12 + ph / 2, -2.905, 0, false);
  }
  rb(0.9, 0.05, 0.42, 0.03, M.wood, -9.75, F + 0.82, -3.66);
  for (const sx of [-0.4, 0.4]) for (const sz of [-0.16, 0.16]) bx(0.05, 0.8, 0.05, M.wood, -9.75 + sx, F + 0.4, -3.66 + sz);
  bx(0.8, 0.03, 0.34, M.wood, -9.75, F + 0.2, -3.66);
  for (const dx of [-0.2, 0.2]) {
    bx(0.36, 0.16, 0.02, mc(W, "#9a7253", 0.4), -9.75 + dx, F + 0.7, -3.44);
    cy(0.018, 0.018, 0.03, brass, -9.75 + dx, F + 0.7, -3.42, 10).rotation.x = Math.PI / 2;
  }
  const mirror = W.mesh(torus(gl, 0.42, 0.03, Math.PI * 2, 40, 10), brass, W.scene);
  mirror.position.set(-9.75, 1.85, BACK + 0.04);
  cy(0.41, 0.41, 0.01, mc(W, "#d8e2ea", 0.95), -9.75, 1.85, BACK + 0.03, 32).rotation.x = Math.PI / 2;
  lamp(-10.0, F + 0.845, -3.66, 0.9);
  W.mesh(lathe(gl, [[0, 0], [0.1, 0], [0.16, 0.06], [0.15, 0.065], [0.09, 0.012], [0, 0.012]], 24), mc(W, "#2f6f73", 0.7), W.scene).position.set(-9.5, F + 0.845, -3.62);
  bx(1.4, 0.02, 3.4, mc(W, "#b86b4b", 0.1), -11.5, F + 0.01, -0.8, 0, false);
  bx(1.1, 0.025, 3.1, mc(W, "#d9a17e", 0.1), -11.5, F + 0.012, -0.8, 0, false);
  // The bench under the coat hooks, with a cushion and a pair of shoes beneath.
  rb(0.42, 0.05, 1.3, 0.03, M.wood, -13.6, F + 0.45, 0.6);
  rb(0.4, 0.08, 1.26, 0.04, navy, -13.6, F + 0.51, 0.6);
  for (const dz of [-0.55, 0.55]) bx(0.36, 0.43, 0.04, M.wood, -13.6, F + 0.22, 0.6 + dz);
  for (const [dz, c] of [[0.2, "#2b2a30"], [0.42, "#b0573a"]] as const) {
    rb(0.11, 0.07, 0.26, 0.04, mc(W, c, 0.4), -13.62, F + 0.04, 0.6 + dz);
    rb(0.11, 0.07, 0.26, 0.04, mc(W, c, 0.4), -13.48, F + 0.04, 0.6 + dz);
  }
  for (const dz of [0.2, 0.6, 1.0]) {
    cy(0.02, 0.02, 0.12, brass, -13.86, 1.75, dz, 8).rotation.z = Math.PI / 2;
    cy(0.03, 0.03, 0.02, brass, -13.8, 1.75, dz, 8).rotation.z = Math.PI / 2;
  }
  rb(0.12, 0.85, 0.5, 0.05, mc(W, "#6f8a6e", 0.2), -13.82, 1.35, 0.2);
  rb(0.1, 0.7, 0.42, 0.05, mc(W, "#c9a35a", 0.2), -13.82, 1.42, 0.6);
  // An umbrella stand and a pendant light.
  W.mesh(lathe(gl, [[0, 0], [0.13, 0], [0.13, 0.5], [0.11, 0.5], [0.11, 0.02], [0, 0.02]], 20), dark, W.scene).position.set(-13.55, F, -1.0);
  cy(0.012, 0.012, 0.9, mc(W, "#1f5f8b", 0.4), -13.52, F + 0.5, -1.0, 6).rotation.z = 0.12;
  cy(0.006, 0.006, 0.9, dark, -11.5, 2.65, -1.4, 6, W.scene, false);
  W.mesh(lathe(gl, [[0, 0.3], [0.08, 0.28], [0.22, 0.12], [0.26, 0], [0.24, 0], [0.2, 0.1], [0, 0.26]], 28), dark, W.scene, false).position.set(-11.5, 1.9, -1.4);
  W.mesh(sphere(gl, 0.07, 12, 8), M.warm, W.scene, false).position.set(-11.5, 1.95, -1.4);
  plant(-9.5, -1.4, 1.2);

  /* Living room: a rug, a cushioned sofa and armchair, a coffee table set for the day, a fireplace
     with its mantel and the TV, a stocked bookshelf, curtains, art, lamps and plants. */
  rb(4.6, 0.025, 3.4, 0.08, rugA, -5, F + 0.012, -1.6);
  rb(4.2, 0.03, 3.0, 0.06, rugB, -5, F + 0.016, -1.6);
  for (const dz of [-1.25, 1.25]) bx(4.0, 0.034, 0.05, mc(W, "#7c8aa0", 0.1), -5, F + 0.017, -1.6 + dz, 0, false);
  // The sofa: a frame on tapered legs, three seat and three back cushions, rolled arms, pillows.
  const sofaZ = -3.0;
  rb(3.3, 0.3, 1.05, 0.08, M.fabric, -5, F + 0.27, sofaZ);
  for (const sx of [-1.5, 1.5]) for (const sz of [-0.4, 0.4]) cy(0.035, 0.025, 0.12, M.wood, -5 + sx, F + 0.06, sofaZ + sz, 10);
  rb(3.3, 0.62, 0.2, 0.08, M.fabric, -5, F + 0.62, sofaZ - 0.44);
  for (const sx of [-1.58, 1.58]) rb(0.2, 0.42, 1.05, 0.09, M.fabric, -5 + sx, F + 0.5, sofaZ);
  for (let i = 0; i < 3; i++) {
    rb(0.98, 0.16, 0.86, 0.07, cushion, -5 + (i - 1) * 1.0, F + 0.5, sofaZ + 0.05);
    rb(0.96, 0.5, 0.2, 0.09, cushion, -5 + (i - 1) * 1.0, F + 0.83, sofaZ - 0.3, 0, -0.14);
  }
  for (const [x, m, r] of [[-6.15, M.linen, 0.25], [-5.75, M.throwM, -0.15], [-3.9, M.linen, -0.25]] as const) rb(0.44, 0.42, 0.14, 0.12, m, x, F + 0.82, sofaZ - 0.12, r, -0.2);
  rb(0.6, 0.04, 0.95, 0.02, M.throwM, -3.42, F + 0.73, sofaZ, 0, 0);
  rb(0.04, 0.38, 0.95, 0.02, M.throwM, -3.12, F + 0.55, sofaZ, 0, 0);
  // The coffee table: an oak top on four legs, a shelf of books below, a vase, a tray and a mug.
  rb(1.5, 0.06, 0.8, 0.05, M.oak, -5, F + 0.42, -1.4);
  bx(1.36, 0.03, 0.66, M.oak, -5, F + 0.16, -1.4);
  for (const sx of [-0.68, 0.68]) for (const sz of [-0.33, 0.33]) cy(0.03, 0.022, 0.4, M.wood, -5 + sx, F + 0.2, -1.4 + sz, 10);
  ["#3d4f6b", "#c9a35a", "#b0573a"].forEach((c, i) => rb(0.42 - i * 0.04, 0.05, 0.3 - i * 0.02, 0.01, mc(W, c, 0.3), -5.3, F + 0.2 + i * 0.05, -1.4, i * 0.15));
  ["#efe6d6", "#7c8aa0"].forEach((c, i) => rb(0.36 - i * 0.05, 0.04, 0.26, 0.01, mc(W, c, 0.3), -5.35, F + 0.47 + i * 0.04, -1.35, -0.2 + i * 0.3));
  W.mesh(lathe(gl, [[0, 0], [0.05, 0], [0.08, 0.06], [0.07, 0.16], [0.035, 0.24], [0.04, 0.28], [0.03, 0.28]], 20), mc(W, "#2f6f73", 0.75), W.scene).position.set(-4.65, F + 0.45, -1.48);
  for (const [dx, dz, c] of [[0, 0, "#f2c14e"], [0.05, 0.03, "#ffffff"], [-0.05, 0.02, "#e8889a"]] as const) {
    cy(0.006, 0.006, 0.22, mc(W, "#4f8a4a", 0.3), -4.65 + dx, F + 0.82, -1.48 + dz, 6, W.scene, false);
    W.mesh(sphere(gl, 0.045, 10, 8), mc(W, c, 0.3), W.scene).position.set(-4.65 + dx, F + 0.94, -1.48 + dz);
  }
  rb(0.5, 0.03, 0.3, 0.04, mc(W, "#2b2a30", 0.6), -5.0, F + 0.465, -1.25);
  W.mesh(lathe(gl, [[0, 0], [0.045, 0], [0.05, 0.1], [0.044, 0.1], [0.04, 0.008], [0, 0.008]], 18), M.white, W.scene).position.set(-5.1, F + 0.48, -1.25);
  // The armchair, turned toward the room: frame, seat and back cushions, arms, legs.
  const chair = node(W.scene);
  chair.position.set(-7.6, 0, -1.2);
  chair.rotation.y = 0.55;
  rb(0.95, 0.28, 0.9, 0.07, M.fabric, 0, F + 0.26, 0, 0, 0, chair);
  rb(0.95, 0.6, 0.18, 0.07, M.fabric, 0, F + 0.6, -0.38, 0, -0.12, chair);
  for (const sx of [-0.45, 0.45]) rb(0.14, 0.36, 0.9, 0.07, M.fabric, sx, F + 0.48, 0, 0, 0, chair);
  rb(0.74, 0.14, 0.76, 0.06, cushion, 0, F + 0.46, 0.04, 0, 0, chair);
  for (const sx of [-0.4, 0.4]) for (const sz of [-0.36, 0.36]) cy(0.03, 0.022, 0.12, M.wood, sx, F + 0.06, sz, 10, chair);
  // The fireplace: a stone surround, the firebox with logs and a glow, the mantel and its things.
  bx(2.1, 1.25, 0.32, mc(W, "#d8d2c8", 0.3), -1.9, F + 0.62, -3.76);
  bx(1.0, 0.62, 0.06, black, -1.9, F + 0.42, -3.58, 0, false);
  for (const [dx, ry] of [[-0.12, 0.2], [0.12, -0.2]] as const) cy(0.06, 0.06, 0.6, mc(W, "#6b4a33", 0.3), -1.9 + dx, F + 0.2, -3.55, 10).rotation.set(0, ry, Math.PI / 2);
  // Flames: tapered tongues, orange round a yellow heart.
  for (const [dx, s] of [[-0.16, 0.8], [0.02, 1.15], [0.18, 0.7]] as const) {
    W.mesh(lathe(gl, [[0, 0], [0.07 * s, 0.03 * s], [0.06 * s, 0.12 * s], [0.025 * s, 0.24 * s], [0, 0.3 * s]], 14), mc(W, "#ff8a3a", 0.2, "#ff6a1a"), W.scene, false).position.set(-1.9 + dx, F + 0.22, -3.56);
    W.mesh(lathe(gl, [[0, 0], [0.04 * s, 0.02 * s], [0.035 * s, 0.08 * s], [0.012 * s, 0.16 * s], [0, 0.2 * s]], 12), mc(W, "#ffd85a", 0.2, "#ffc23a"), W.scene, false).position.set(-1.9 + dx, F + 0.22, -3.5);
  }
  rb(2.4, 0.09, 0.42, 0.03, M.wood, -1.9, F + 1.3, -3.72);
  for (const [dx, hh] of [[-1.0, 0.22], [-0.86, 0.16]] as const) {
    cy(0.035, 0.035, hh, M.white, -1.9 + dx, F + 1.35 + hh / 2, -3.66, 12);
    W.mesh(sphere(gl, 0.015, 8, 6), mc(W, "#ffd27a", 0.2, "#ffb347"), W.scene, false).position.set(-1.9 + dx, F + 1.36 + hh, -3.66);
  }
  bx(0.24, 0.3, 0.03, dark, -1.0, F + 1.5, -3.78, 0.15);
  bx(0.19, 0.24, 0.01, mc(W, "#c7d6e2", 0.4), -0.995, F + 1.5, -3.76, 0.15, false);
  // The TV above the mantel: a thin black frame and a screen.
  rb(1.6, 0.92, 0.05, 0.02, black, -1.9, 2.15, BACK + 0.03);
  bx(1.52, 0.84, 0.01, mc(W, "#1f3150", 0.6, "#0e1830"), -1.9, 2.15, BACK + 0.06, 0, false);
  // The bookshelf: open shelves stocked with books (some leaning), a vase and a box.
  const shX = -8.45;
  // (An open unit: back, sides and top, so the books show.)
  bx(1.0, 2.1, 0.03, M.white, shX, F + 1.05, -3.895);
  for (const sx of [-0.485, 0.485]) bx(0.03, 2.1, 0.36, M.white, shX + sx, F + 1.05, -3.73);
  bx(1.0, 0.04, 0.36, M.white, shX, F + 2.1, -3.73);
  for (let i = 0; i < 5; i++) bx(0.94, 0.03, 0.33, M.oak, shX, F + 0.08 + i * 0.47, -3.71);
  const bookC = ["#3d4f6b", "#b0573a", "#c9a35a", "#2f6f73", "#efe6d6", "#7c8aa0", "#8a3b4a", "#4f8a4a"];
  for (let row = 0; row < 4; row++) {
    let x = shX - 0.42;
    let n = 0;
    while (x < shX + (row % 2 ? 0.05 : 0.38)) {
      const bw = 0.045 + ((row * 7 + n * 3) % 4) * 0.012;
      const bh = 0.28 + ((row * 5 + n * 11) % 5) * 0.025;
      bx(bw, bh, 0.24, mc(W, bookC[(row * 3 + n) % bookC.length], 0.35), x + bw / 2, F + 0.1 + row * 0.47 + bh / 2, -3.72, 0, false);
      x += bw + 0.005;
      n++;
    }
    if (row % 2) W.mesh(lathe(gl, [[0, 0], [0.06, 0], [0.09, 0.1], [0.05, 0.2], [0.04, 0.22], [0, 0.22]], 18), mc(W, ["#2f6f73", "#c9a35a"][row % 2 ? 0 : 1], 0.7), W.scene).position.set(shX + 0.28, F + 0.1 + row * 0.47, -3.7);
    else rb(0.2, 0.14, 0.2, 0.02, mc(W, "#d9c2a0", 0.2), shX + 0.32, F + 0.17 + row * 0.47, -3.7);
  }
  // The floor lamp: a weighted base, a brass pole and a lit drum shade.
  cy(0.18, 0.2, 0.03, dark, -8.45, F + 0.015, -2.4, 24);
  cy(0.016, 0.016, 1.55, brass, -8.45, F + 0.8, -2.4, 8);
  W.mesh(lathe(gl, [[0.2, 1.55], [0.26, 1.55], [0.24, 1.9], [0.18, 1.9]], 28), M.warm, W.scene, false).position.set(-8.45, F, -2.4);
  // A side table with a lamp by the sofa.
  cy(0.24, 0.24, 0.03, M.oak, -2.95, F + 0.55, -3.25, 24);
  cy(0.02, 0.02, 0.54, brass, -2.95, F + 0.28, -3.25, 8);
  cy(0.15, 0.17, 0.02, brass, -2.95, F + 0.01, -3.25, 20);
  lamp(-2.95, F + 0.565, -3.25, 0.85, mc(W, "#2f6f73", 0.7));
  curtains(-6.5, 2.4);
  curtains(-3.5, 1.4);
  art(-4.75, 1.85, 0.7, 0.9, ["#c9a35a", "#7c8aa0", "#e8889a"]);
  plant(-8.4, -0.15, 1.0, mc(W, "#d9c2a0", 0.3));

  /* Kitchen: panelled base cabinets with drawers and handles, a range with its oven and burners
     under a hood, a sink and faucet, a tiled backsplash, wall cabinets with under-lights, a
     French-door fridge, and an island with stools under pendants; things out on the counters. */
  const run0 = -0.25;
  const run1 = 5.55;
  const runC = (run0 + run1) / 2;
  const runW = run1 - run0;
  bx(runW, 0.08, 0.56, black, runC, F + 0.04, -3.66, 0, false);
  bx(runW, 0.82, 0.6, M.white, runC, F + 0.49, -3.62);
  rb(runW + 0.08, 0.05, 0.68, 0.02, M.stoneTop, runC, F + 0.925, -3.58);
  const front = mc(W, "#fbfaf7", 0.45);
  const stoveX = 2.6;
  const sinkX = 0.85;
  const doors = Math.round(runW / 0.58);
  for (let i = 0; i < doors; i++) {
    const x = run0 + (i + 0.5) * (runW / doors);
    if (Math.abs(x - stoveX) < 0.4) continue;
    const dw = runW / doors - 0.04;
    bx(dw, 0.52, 0.02, front, x, F + 0.38, -3.31, 0, false);
    bx(dw - 0.08, 0.44, 0.01, mc(W, "#f1efe9", 0.4), x, F + 0.38, -3.295, 0, false);
    bx(dw, 0.16, 0.02, front, x, F + 0.76, -3.31, 0, false);
    bx(0.16, 0.02, 0.025, metal, x, F + 0.76, -3.29, 0, false);
    bx(0.02, 0.16, 0.025, metal, x + (i % 2 ? -1 : 1) * (dw / 2 - 0.06), F + 0.5, -3.29, 0, false);
  }
  // The range: a steel front with an oven window and a bar handle, knobs, a black cooktop.
  bx(0.76, 0.86, 0.04, steel, stoveX, F + 0.47, -3.3);
  bx(0.56, 0.3, 0.012, black, stoveX, F + 0.4, -3.275, 0, false);
  cy(0.014, 0.014, 0.6, metal, stoveX, F + 0.66, -3.25, 8).rotation.z = Math.PI / 2;
  for (let i = 0; i < 4; i++) cy(0.025, 0.025, 0.03, black, stoveX - 0.27 + i * 0.18, F + 0.82, -3.27, 12).rotation.x = Math.PI / 2;
  bx(0.74, 0.012, 0.56, black, stoveX, F + 0.955, -3.6, 0, false);
  for (const [dx, dz, r] of [[-0.18, -0.12, 0.09], [0.18, -0.12, 0.07], [-0.18, 0.12, 0.07], [0.18, 0.12, 0.09]] as const) W.mesh(torus(gl, r, 0.008, Math.PI * 2, 24, 6), mc(W, "#3a3a42", 0.6), W.scene, false).position.set(stoveX + dx, F + 0.963, -3.6 + dz);
  for (const m of W.scene.children.slice(-4)) m.rotation.x = Math.PI / 2;
  // The hood: a steel canopy and its chimney.
  const hood = W.mesh(cylinder(gl, 0.3, 0.55, 0.32, 4), steel, W.scene);
  hood.position.set(stoveX, 2.05, -3.6);
  hood.rotation.y = Math.PI / 4;
  hood.scale.set(1, 1, 0.75);
  bx(0.34, 0.7, 0.3, steel, stoveX, 2.55, -3.75);
  // The sink: a steel basin set in the stone, and a gooseneck faucet.
  bx(0.7, 0.012, 0.42, mc(W, "#9aa3ad", 0.85), sinkX, F + 0.952, -3.56, 0, false);
  bx(0.62, 0.006, 0.34, mc(W, "#6d757f", 0.7), sinkX, F + 0.955, -3.56, 0, false);
  cy(0.02, 0.025, 0.3, metal, sinkX, F + 1.1, -3.82, 10);
  const spout = W.mesh(torus(gl, 0.1, 0.016, Math.PI, 20, 8), metal, W.scene);
  spout.position.set(sinkX, F + 1.25, -3.72);
  spout.rotation.set(0, Math.PI / 2, Math.PI / 2);
  cy(0.012, 0.012, 0.08, metal, sinkX + 0.09, F + 1.0, -3.82, 8);
  // The backsplash: tiles in courses with grout lines.
  bx(runW, 0.62, 0.02, mc(W, "#e3eaee", 0.6), runC, F + 1.26, BACK + 0.02, 0, false);
  for (let r = 1; r < 4; r++) bx(runW, 0.008, 0.006, mc(W, "#c9d2d8", 0.3), runC, F + 0.95 + r * 0.155, BACK + 0.034, 0, false);
  for (let r = 0; r < 4; r++) for (let x = run0 + (r % 2 ? 0.15 : 0.3); x < run1; x += 0.3) bx(0.008, 0.155, 0.006, mc(W, "#c9d2d8", 0.3), x, F + 1.03 + r * 0.155, BACK + 0.034, 0, false);
  // GFCI receptacles along the counter (no point on it more than 2 ft from one), clear of the range.
  for (const ox of [run0 + 0.3, sinkX + 0.55, stoveX - 0.62, stoveX + 0.62, stoveX + 1.6, run1 - 0.35]) outlet(W, ox, F + 1.08, BACK + 0.032);
  // Wall cabinets either side of the hood, with door panels, handles and under-cabinet lights.
  for (const [x0, x1] of [[run0, stoveX - 0.45], [stoveX + 0.45, run1]] as const) {
    const cx = (x0 + x1) / 2;
    const cw = x1 - x0;
    bx(cw, 0.72, 0.36, M.white, cx, 2.25, -3.74);
    bx(cw - 0.06, 0.02, 0.02, M.warm, cx, 1.88, -3.6, 0, false);
    const n = Math.max(1, Math.round(cw / 0.55));
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * (cw / n);
      bx(cw / n - 0.04, 0.66, 0.02, front, x, 2.25, -3.55, 0, false);
      bx(0.02, 0.14, 0.025, metal, x + (i % 2 ? -1 : 1) * (cw / n / 2 - 0.06), 2.0, -3.53, 0, false);
    }
  }
  // The fridge: French doors with long handles, the freezer drawer, the water dispenser.
  bx(0.96, 2.2, 0.72, steel, 6.1, F + 1.1, -3.55);
  bx(0.012, 1.3, 0.01, dark, 6.1, F + 1.55, -3.185, 0, false);
  bx(0.96, 0.012, 0.01, dark, 6.1, F + 0.88, -3.185, 0, false);
  for (const sx of [-0.04, 0.04]) cy(0.014, 0.014, 0.9, metal, 6.1 + sx, F + 1.5, -3.15, 8);
  cy(0.014, 0.014, 0.5, metal, 6.1, F + 0.78, -3.15, 8).rotation.z = Math.PI / 2;
  bx(0.2, 0.3, 0.012, mc(W, "#3a3a42", 0.6), 5.85, F + 1.35, -3.18, 0, false);
  // On the counter: a kettle, a cutting board with bread, a crock of spoons, a herb pot, a mixer.
  W.mesh(lathe(gl, [[0, 0], [0.1, 0], [0.12, 0.08], [0.11, 0.18], [0.06, 0.24], [0.02, 0.26], [0, 0.26]], 22), mc(W, "#d9534f", 0.6), W.scene).position.set(1.7, F + 0.95, -3.62);
  const kh = W.mesh(torus(gl, 0.07, 0.012, Math.PI, 14, 6), dark, W.scene);
  kh.position.set(1.7, F + 1.2, -3.62);
  kh.rotation.z = Math.PI / 2;
  rb(0.42, 0.025, 0.28, 0.03, M.oak, 3.7, F + 0.965, -3.55, 0.15);
  rb(0.22, 0.09, 0.12, 0.05, mc(W, "#d9a15a", 0.3), 3.7, F + 1.02, -3.55, 0.1);
  W.mesh(lathe(gl, [[0, 0], [0.07, 0], [0.075, 0.16], [0.065, 0.16], [0.06, 0.01], [0, 0.01]], 18), M.white, W.scene).position.set(4.3, F + 0.95, -3.7);
  for (const [dx, rz] of [[-0.02, 0.15], [0.02, -0.12], [0, 0.02]] as const) cy(0.008, 0.008, 0.3, M.wood, 4.3 + dx, F + 1.18, -3.7, 6).rotation.z = rz;
  plant(4.9, -3.7, 0.45, mc(W, "#c96f4a", 0.4));
  // The island: panelled sides, a waterfall stone top, a fruit bowl; stools with backs and footrings.
  bx(3.0, 0.86, 1.1, islandM, 3, F + 0.45, -0.9);
  for (let i = 0; i < 3; i++) {
    bx(0.9, 0.66, 0.02, islandPanel, 2 + i, F + 0.45, -0.34, 0, false);
    bx(0.8, 0.56, 0.012, islandM, 2 + i, F + 0.45, -0.325, 0, false);
  }
  rb(3.15, 0.07, 1.25, 0.02, M.stoneTop, 3, F + 0.91, -0.9);
  for (const sx of [-1.54, 1.54]) bx(0.07, 0.9, 1.25, M.stoneTop, 3 + sx, F + 0.45, -0.9);
  W.mesh(lathe(gl, [[0, 0], [0.08, 0], [0.18, 0.08], [0.2, 0.1], [0.185, 0.1], [0.16, 0.075], [0, 0.012]], 26), mc(W, "#efe6d6", 0.5), W.scene).position.set(2.6, F + 0.945, -0.95);
  for (const [dx, dz, c, r] of [[0, 0, "#e9a23b", 0.07], [0.09, 0.03, "#d9534f", 0.065], [-0.08, 0.04, "#7ab648", 0.065], [0.02, -0.08, "#f2c14e", 0.06]] as const)
    W.mesh(sphere(gl, r, 12, 10), mc(W, c, 0.5), W.scene).position.set(2.6 + dx, F + 1.04, -0.95 + dz);
  for (const x of [2, 3, 4]) {
    const st = node(W.scene);
    st.position.set(x, 0, 0.05);
    W.mesh(lathe(gl, [[0, 0], [0.19, 0], [0.2, 0.03], [0.18, 0.06], [0, 0.06]], 22), M.oak, st).position.set(0, F + 0.68, 0);
    rb(0.34, 0.2, 0.04, 0.05, M.oak, 0, F + 0.9, 0.18, 0, 0.12, st);
    for (const [sx, sz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]] as const) {
      const lg = cy(0.015, 0.015, 0.7, dark, sx, F + 0.34, sz, 8, st);
      lg.rotation.set(sz * 0.25, 0, -sx * 0.25);
    }
    const ring = W.mesh(torus(gl, 0.17, 0.01, Math.PI * 2, 24, 6), dark, st);
    ring.position.set(0, F + 0.24, 0);
    ring.rotation.x = Math.PI / 2;
    // The pendant above: a cord, a dome shade and its bulb.
    cy(0.006, 0.006, 0.75, dark, x, 2.62, -0.9, 6, W.scene, false);
    W.mesh(lathe(gl, [[0, 0.24], [0.05, 0.23], [0.17, 0.1], [0.19, 0], [0.17, 0], [0.15, 0.08], [0, 0.2]], 26), dark, W.scene, false).position.set(x, 2.0, -0.9);
    W.mesh(sphere(gl, 0.06, 12, 8), M.warm, W.scene, false).position.set(x, 2.02, -0.9);
  }

  /* Owner's suite: a tufted headboard, a bed with a duvet, pillows and a throw, nightstands with
     drawers and lamps, a dresser with a mirror, a bench, a rug, art, curtains and a plant. */
  const bedX = 10;
  rb(2.5, 1.35, 0.16, 0.08, headM, bedX, F + 0.95, -3.82);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) W.mesh(sphere(gl, 0.025, 8, 6), mc(W, "#7e746c", 0.3), W.scene, false).position.set(bedX - 1.0 + c * 0.4 + (r % 2) * 0.2, F + 0.72 + r * 0.3, -3.73);
  rb(2.2, 0.28, 2.3, 0.05, M.wood, bedX, F + 0.24, -2.72);
  for (const sx of [-1.02, 1.02]) for (const sz of [-1.08, 1.08]) cy(0.04, 0.03, 0.12, M.wood, bedX + sx, F + 0.05, -2.72 + sz, 10);
  rb(2.04, 0.24, 2.18, 0.06, M.white, bedX, F + 0.5, -2.74);
  rb(2.16, 0.12, 1.6, 0.06, M.linen, bedX, F + 0.66, -2.36);
  rb(2.16, 0.08, 0.32, 0.04, M.white, bedX, F + 0.69, -3.08);
  rb(2.18, 0.07, 0.55, 0.04, M.throwM, bedX, F + 0.74, -1.92);
  for (const sx of [-0.5, 0.5]) {
    rb(0.8, 0.42, 0.16, 0.12, M.white, bedX + sx, F + 0.9, -3.6, 0, -0.32);
    rb(0.7, 0.34, 0.14, 0.11, M.linen, bedX + sx, F + 0.84, -3.42, 0, -0.32);
  }
  rb(0.42, 0.3, 0.12, 0.1, M.throwM, bedX, F + 0.82, -3.28, 0, -0.32);
  for (const x of [8.35, 11.65]) {
    rb(0.6, 0.56, 0.46, 0.03, M.wood, x, F + 0.32, -3.62);
    for (const dy of [0.2, 0.42]) {
      bx(0.52, 0.18, 0.02, mc(W, "#9a7253", 0.4), x, F + dy, -3.385, 0, false);
      W.mesh(sphere(gl, 0.022, 10, 8), brass, W.scene).position.set(x, F + dy, -3.365);
    }
    for (const sx of [-0.24, 0.24]) cy(0.02, 0.02, 0.08, M.wood, x + sx, F + 0.04, -3.62, 8);
    lamp(x, F + 0.6, -3.66, 1.0);
  }
  ["#3d4f6b", "#c9a35a"].forEach((c, i) => rb(0.2, 0.035, 0.15, 0.01, mc(W, c, 0.3), 11.5, F + 0.62 + i * 0.035, -3.5, i * 0.25));
  rb(0.1, 0.07, 0.05, 0.02, dark, 8.18, F + 0.635, -3.5);
  // The bench at the foot of the bed, the rug under it.
  rb(1.5, 0.12, 0.45, 0.05, mc(W, "#c9b79c", 0.15), bedX, F + 0.44, -1.1);
  for (const sx of [-0.66, 0.66]) for (const sz of [-0.16, 0.16]) cy(0.025, 0.02, 0.38, M.wood, bedX + sx, F + 0.19, -1.1 + sz, 8);
  rb(3.2, 0.025, 2.4, 0.08, mc(W, "#cdbfae", 0.1), bedX, F + 0.012, -1.7);
  rb(2.9, 0.03, 2.1, 0.06, mc(W, "#e6dccd", 0.1), bedX, F + 0.016, -1.7);
  // The dresser against the side wall, with drawers, knobs, a mirror, a tray and a vase.
  const dr = node(W.scene);
  dr.position.set(7.32, 0, -2.75);
  dr.rotation.y = Math.PI / 2;
  rb(1.3, 0.85, 0.48, 0.03, M.wood, 0, F + 0.48, 0, 0, 0, dr);
  for (let r = 0; r < 3; r++)
    for (const c of [-0.32, 0.32]) {
      bx(0.6, 0.24, 0.02, mc(W, "#9a7253", 0.4), c, F + 0.24 + r * 0.27, 0.25, 0, false).setParent(dr);
      W.mesh(sphere(gl, 0.02, 10, 8), brass, dr).position.set(c, F + 0.24 + r * 0.27, 0.27);
    }
  const mr = W.mesh(lathe(gl, [[0, 0], [0.4, 0], [0.4, 0.02], [0, 0.02]], 32), brass, dr);
  mr.position.set(0, F + 1.4, -0.2);
  mr.rotation.x = Math.PI / 2;
  mr.scale.set(1, 1, 1.35);
  W.mesh(lathe(gl, [[0, 0], [0.37, 0], [0.37, 0.01], [0, 0.01]], 32), mc(W, "#d8e2ea", 0.95), dr).position.set(0, F + 1.4, -0.175);
  W.mesh(lathe(gl, [[0, 0], [0.05, 0], [0.07, 0.08], [0.04, 0.2], [0.03, 0.22], [0, 0.22]], 18), mc(W, "#e8889a", 0.6), dr).position.set(0.4, F + 0.905, 0.02);
  rb(0.36, 0.02, 0.22, 0.03, brass, -0.3, F + 0.915, 0.04, 0, 0, dr);
  art(bedX, 2.3, 1.6, 0.55, ["#c9a35a", "#7c8aa0", "#e6dccd", "#2f6f73"]);
  // Smoke and CO alarms: in the bedroom, outside it, in the foyer.
  alarm(W, 8.8, 2.78, BACK);
  alarm(W, -2.0, 2.78, BACK);
  alarm(W, -9.75, 2.75, BACK);
  // A brass chandelier over the foot of the bed: a ring of candle arms on a chain.
  cy(0.008, 0.008, 0.5, brass, bedX, 2.75, -1.9, 6, W.scene, false);
  W.mesh(torus(gl, 0.32, 0.018, Math.PI * 2, 32, 6), brass, W.scene, false).position.set(bedX, 2.32, -1.9);
  W.scene.children[W.scene.children.length - 1].rotation.x = Math.PI / 2;
  W.mesh(sphere(gl, 0.06, 12, 8), brass, W.scene, false).position.set(bedX, 2.36, -1.9);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const cx2 = bedX + Math.cos(a) * 0.32;
    const cz2 = -1.9 + Math.sin(a) * 0.32;
    cy(0.035, 0.03, 0.04, brass, cx2, 2.35, cz2, 10, W.scene, false);
    cy(0.016, 0.016, 0.12, M.white, cx2, 2.43, cz2, 8, W.scene, false);
    W.mesh(sphere(gl, 0.025, 8, 6), M.warm, W.scene, false).position.set(cx2, 2.51, cz2);
  }
  curtains(12.35, 0.9);
  curtains(7.75, 0.8);
  plant(12.55, -1.1, 1.0, mc(W, "#d9c2a0", 0.3));

  /* Out back, neatly laid out: the deck by the house with a dining set under an umbrella and
     planters; steps down to a stone-paved pool deck with a rectangular pool (coping, steps,
     ripples), three loungers in a row along its edge with towels and side tables, a pool umbrella;
     a slatted fence with a clipped hedge along the back, trees beyond, string lights overhead. */
  const stone = mc(W, "#e7e1d6", 0.25);
  const joint = mc(W, "#cfc6b8", 0.2);
  const water = mc(W, "#4fb8d8", 0.85);
  const waterHi = mc(W, "#8fdcef", 0.85);
  const tileBand = mc(W, "#2f86a8", 0.5);
  const hedge = mc(W, "#3f7d3f", 0.25);
  const slat = mc(W, "#8a6446", 0.3);
  const towel = M.throwM;
  // The paved pool deck (light stone in a grid of joints) beside the wood deck.
  bx(7.6, 0.06, 7.6, stone, 20.2, 0.17, -1.0, 0, false);
  for (let x = 16.6; x < 24; x += 0.9) bx(0.02, 0.062, 7.6, joint, x, 0.172, -1.0, 0, false);
  for (let z = -4.6; z < 2.8; z += 0.9) bx(7.6, 0.062, 0.02, joint, 20.2, 0.172, z, 0, false);
  // The pool: coping round a basin of water, a tiled waterline, corner steps and a few ripples.
  const px = 20.2;
  const pz = -2.0;
  const pw = 5.0;
  const pd = 2.8;
  for (const [x, z, w, d] of [[px, pz - pd / 2 - 0.18, pw + 0.72, 0.36], [px, pz + pd / 2 + 0.18, pw + 0.72, 0.36], [px - pw / 2 - 0.18, pz, 0.36, pd], [px + pw / 2 + 0.18, pz, 0.36, pd]] as const) rb(w, 0.08, d, 0.04, M.white, x, 0.23, z);
  // (The water sits just above the paving, inside the coping, so it reads from the deck.)
  bx(pw + 0.04, 0.012, pd + 0.04, tileBand, px, 0.206, pz, 0, false);
  bx(pw - 0.16, 0.014, pd - 0.16, water, px, 0.209, pz, 0, false);
  for (let i = 0; i < 3; i++) bx(0.8 - i * 0.22, 0.014, 0.5 + i * 0.36, waterHi, px - pw / 2 + 0.45 + i * 0.1, 0.212 + i * 0.002, pz + pd / 2 - 0.33 - i * 0.18, 0, false);
  for (const [dx, dz, w] of [[-0.9, -0.5, 0.9], [0.6, 0.3, 1.2], [1.6, -0.7, 0.7], [-0.2, 0.9, 0.8]] as const) rb(w, 0.01, 0.05, 0.02, waterHi, px + dx, 0.222, pz + dz);
  // The ladder at the far end: two steel rails.
  for (const dz of [-0.25, 0.25]) {
    const r = W.mesh(torus(gl, 0.18, 0.018, Math.PI, 16, 6), steel, W.scene);
    r.position.set(px + pw / 2 - 0.05, 0.36, pz + dz);
    r.rotation.y = Math.PI / 2;
  }
  // Three loungers in a row along the near edge, facing the water, a towel on each, side tables between.
  const loungeZ = pz + pd / 2 + 1.35;
  [px - 1.6, px, px + 1.6].forEach((x, i) => {
    const ln = node(W.scene);
    ln.position.set(x, 0.2, loungeZ);
    ln.rotation.y = Math.PI;
    rb(0.7, 0.08, 1.8, 0.03, M.wood, 0, 0.26, 0, 0, 0, ln);
    rb(0.64, 0.09, 1.25, 0.05, M.white, 0, 0.34, 0.24, 0, 0, ln);
    rb(0.64, 0.5, 0.09, 0.04, M.white, 0, 0.5, -0.66, 0, -0.95, ln);
    rb(0.5, 0.025, 0.7, 0.02, i === 1 ? mc(W, "#f2c14e", 0.2) : towel, 0, 0.395, 0.3, 0, 0, ln);
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.8, 0.8]) cy(0.025, 0.025, 0.22, M.wood, sx, 0.11, sz, 8, ln);
  });
  for (const x of [px - 0.8, px + 0.8]) {
    cy(0.2, 0.2, 0.03, M.wood, x, 0.62, loungeZ + 0.3, 20);
    cy(0.022, 0.022, 0.4, M.wood, x, 0.42, loungeZ + 0.3, 8);
    W.mesh(lathe(gl, [[0, 0], [0.045, 0], [0.05, 0.12], [0, 0.12]], 14), mc(W, "#ff8a6a", 0.5), W.scene).position.set(x, 0.635, loungeZ + 0.3);
  }
  // The pool umbrella at the end of the row.
  const ux = px + 2.85;
  cy(0.25, 0.28, 0.06, dark, ux, 0.23, loungeZ, 20);
  cy(0.02, 0.02, 2.1, dark, ux, 1.25, loungeZ, 8);
  W.mesh(lathe(gl, [[0, 0.42], [0.2, 0.36], [1.25, 0], [1.25, -0.03], [0.2, 0.33], [0, 0.39]], 32), mc(W, "#f4efe6", 0.2), W.scene).position.set(ux, 2.0, loungeZ);
  // The wood deck by the house: a dining table for four under an umbrella, planters at its corners.
  const tx = 14.75;
  const tz = -1.4;
  cy(0.55, 0.55, 0.04, M.wood, tx, 0.92, tz, 28);
  cy(0.04, 0.04, 0.72, dark, tx, 0.56, tz, 10);
  cy(0.3, 0.32, 0.03, dark, tx, 0.215, tz, 20);
  cy(0.02, 0.02, 1.9, dark, tx, 1.85, tz, 8);
  W.mesh(lathe(gl, [[0, 0.42], [0.2, 0.36], [1.15, 0], [1.15, -0.03], [0.2, 0.33], [0, 0.39]], 32), mc(W, "#e9dcc6", 0.2), W.scene).position.set(tx, 2.35, tz);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const ch = node(W.scene);
    ch.position.set(tx + Math.cos(a) * 0.82, 0, tz + Math.sin(a) * 0.82);
    ch.rotation.y = -a - Math.PI / 2;
    rb(0.48, 0.05, 0.46, 0.03, M.wood, 0, 0.62, 0, 0, 0, ch);
    rb(0.48, 0.48, 0.05, 0.03, M.wood, 0, 0.9, -0.22, 0, -0.1, ch);
    for (const [sx, sz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]] as const) cy(0.02, 0.02, 0.42, dark, sx, 0.4, sz, 8, ch);
  }
  for (const [x, z] of [[13.6, -3.4], [15.9, -3.4], [13.6, 2.6], [15.9, 2.6]] as const) plant(x, z, 0.85, mc(W, "#5b6b7c", 0.4));
  // Two steps down from the deck to the pool deck.
  for (let i = 0; i < 2; i++) bx(0.3, 0.09, 6.0, M.wood, 16.5 + i * 0.3, 0.17 - i * 0.07, -1.0);
  // The back boundary: a slatted fence on posts, a clipped hedge in front, planters at the corners.
  for (let x = 13.2; x <= 24.7; x += 1.15) bx(0.12, 1.7, 0.12, slat, x, 0.85, -5.1);
  for (let r = 0; r < 6; r++) bx(11.5, 0.18, 0.04, slat, 18.95, 0.3 + r * 0.24, -5.06, 0, false);
  // The pool barrier (to the US pool code): a glass fence 4 ft high round the pool deck, the house
  // side included, with a self-closing, self-latching gate that opens out from the pool, its
  // latch high on the pool side.
  const gfence = W.mat({ color: "#dff0f7", alpha: 0.3, transparent: true, gloss: 0.9 });
  const fenceH = 1.25;
  const glassRun = (x0: number, z0: number, x1: number, z1: number, gap?: [number, number]) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 1.2));
    for (let i = 0; i < n; i++) {
      const a = i / n;
      const b2 = (i + 1) / n;
      const ca = (a + b2) / 2;
      if (gap && ca > gap[0] && ca < gap[1]) continue;
      const cx = x0 + (x1 - x0) * ca;
      const cz = z0 + (z1 - z0) * ca;
      const pn = bx(len / n - 0.05, fenceH, 0.025, gfence, cx, 0.2 + fenceH / 2 + 0.05, cz, -Math.atan2(z1 - z0, x1 - x0), false);
      void pn;
      for (const e of [a + 0.08 / len, b2 - 0.08 / len]) bx(0.05, 0.12, 0.08, steel, x0 + (x1 - x0) * e, 0.26, z0 + (z1 - z0) * e, 0, false);
    }
  };
  glassRun(17.0, -4.95, 17.0, 3.0, [0.62, 0.74]);
  glassRun(17.0, 3.0, 24.6, 3.0);
  glassRun(24.6, -4.95, 24.6, 3.0);
  // The gate (between the deck steps and the loungers): a glass leaf on spring hinges, a latch box.
  const gateZ0 = -4.95 + 7.95 * 0.62;
  const gateZ1 = -4.95 + 7.95 * 0.74;
  bx(0.025, fenceH - 0.05, gateZ1 - gateZ0 - 0.06, gfence, 17.0, 0.2 + fenceH / 2 + 0.07, (gateZ0 + gateZ1) / 2, 0, false);
  for (const gy of [0.45, 1.25]) bx(0.06, 0.1, 0.06, steel, 17.0, gy, gateZ0 + 0.04, 0, false);
  bx(0.07, 0.14, 0.07, steel, 17.06, 0.2 + fenceH - 0.08, gateZ1 - 0.05, 0, false);
  for (let x = 13.6; x < 24; x += 1.05) rb(1.0, 0.7, 0.6, 0.28, hedge, x, 0.55, -4.65);
  for (let z = -4.4; z < 2.6; z += 1.05) rb(0.6, 0.7, 1.0, 0.28, hedge, 24.2, 0.55, z);
  plant(23.4, 2.2, 1.1, mc(W, "#5b6b7c", 0.4));
  plant(17.2, -4.0, 0.8, mc(W, "#c96f4a", 0.4));
  // String lights over the deck.
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    W.mesh(sphere(gl, 0.05, 8, 6), M.warm, W.scene, false).position.set(13.2 + k * 3.2, 2.75 - Math.sin(k * Math.PI) * 0.35, -3.6 + k * 6.0);
  }
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

/* ───────────────────────── More rooms ───────────────────────── */

interface MoreRooms {
  /** The rooms' 60-30-10 colour roles (see tintInterior). */
  tones: Tones;
  rooms: { name: string; eye: Num3; target: Num3 }[];
}

/**
 * More of the home in a second line of cut-away rooms: a farmhouse kitchen, the family room, a
 * spa-style bathroom, then downstairs a basement game room and a home theater. The back wall's
 * inner face is at z = -3.92; floors are at y = 0.2.
 */
function moreRoomsWorld(W: World): MoreRooms {
  const { gl } = W;
  ground(W);
  const H = 2.8;
  const F = 0.2;
  const BACK = -3.92;
  const wallM = W.mat({ color: "#ece3d6", gloss: 0.2 });
  const tones: Tones = { wall: [wallM], support: [], accent: [] };
  const white = mc(W, "#f7f6f2", 0.4);
  const warm = mc(W, "#fff1d6", 0.2, "#ffe4b0");
  const { metal, dark, black, brass, role, bx, rb, cy, lamp, plant, art } = kit(W, tones, white, warm);
  // Accents in the 10% colour.
  const accent = (color: string, gloss = 0.3, kind?: "felt") => {
    const m = W.mat({ color, gloss, ...(kind ? { kind } : {}) });
    tones.accent.push(m);
    return m;
  };
  const trim = mc(W, "#ffffff", 0.45);
  const oak = mc(W, "#a8794f", 0.45);
  const wood = mc(W, "#8a6446", 0.4);
  const walnut = mc(W, "#5e4130", 0.45);
  const glass = mc(W, "#cfe3f2", 0.9, "#cfe3f2");
  const clear = W.mat({ color: "#dff0f7", alpha: 0.3, transparent: true, gloss: 0.9 });
  const ceramic = W.mat({ color: "#fbfaf7", gloss: 0.75, kind: "ceramic" });
  const quartz = mc(W, "#f1efea", 0.7);
  const grout = mc(W, "#d3cdc3", 0.2);
  const glow = (c: string) => mc(W, c, 0.2, c);
  // A tiled floor: a slab with grout lines both ways.
  const tiles = (x0: number, x1: number, m: Program, step: number) => {
    put(W, box(gl, x1 - x0, 0.02, 8), m, W.scene, (x0 + x1) / 2, F + 0.01, 0, false);
    for (let x = x0 + step; x < x1 - 0.01; x += step) bx(0.012, 0.022, 8, grout, x, F + 0.011, 0, 0, false);
    for (let z = -4 + step; z < 4; z += step) bx(x1 - x0, 0.022, 0.012, grout, (x0 + x1) / 2, F + 0.011, z, 0, false);
  };
  // Floors: oak through the house, tile in the kitchen and bath, a basement floor and the theater's carpet.
  put(W, box(gl, 34.4, 0.2, 8.2), oak, W.scene, 3, 0.1, 0, false);
  tiles(-14, -7, mc(W, "#e3ddd3", 0.5), 0.6);
  tiles(0, 6, mc(W, "#ebe8e3", 0.6), 0.5);
  put(W, box(gl, 7, 0.02, 8), mc(W, "#8c847b", 0.35), W.scene, 9.5, F + 0.01, 0, false);
  for (let z = -3.8; z < 4; z += 0.4) bx(7, 0.022, 0.012, mc(W, "#756d65", 0.3), 9.5, F + 0.011, z, 0, false);
  const carpet = role("#3a3346", -0.6, 0.05);
  put(W, box(gl, 7, 0.03, 8), carpet, W.scene, 16.5, F + 0.015, 0, false);
  // Walls: the back wall, the end walls and half walls between the rooms, baseboards.
  const wall = (x0: number, z0: number, x1: number, z1: number, hh = H) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = put(W, box(gl, len, hh, 0.16), wallM, W.scene, (x0 + x1) / 2, hh / 2 + 0.2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  };
  wall(-14, -4, 20, -4);
  wall(-14, -4, -14, 2.2);
  wall(20, -4, 20, 2.2);
  for (const x of [-7, 0]) wall(x, -4, x, -1.6);
  // (Full walls round the basement rooms: downstairs is its own space.)
  for (const x of [6, 13]) wall(x, -4, x, 2.2);
  bx(27, 0.14, 0.04, trim, -0.5, F + 0.07, -3.9, 0, false);
  // Crown molding upstairs, oak plank seams in the family room.
  bx(20, 0.1, 0.1, trim, -4, 2.95, -3.87, 0, false);
  bx(20, 0.05, 0.16, trim, -4, 2.98, -3.84, 0, false);
  for (let z = -3.8, r = 0; z < 4.1; z += 0.22, r++) {
    bx(7, 0.004, 0.012, mc(W, "#8f6542", 0.3), -3.5, F + 0.001, z, 0, false);
    for (let x = -6.6 + (r % 3) * 0.6; x < 0; x += 1.8) bx(0.012, 0.004, 0.22, mc(W, "#8f6542", 0.3), x, F + 0.001, z + 0.11, 0, false);
  }
  const win = (x: number, w: number, y = 1.75, hh = 1.2) => {
    bx(w + 0.18, hh + 0.18, 0.06, trim, x, y, -3.9, 0, false);
    bx(w, hh, 0.04, glass, x, y, -3.86, 0, false);
    bx(0.05, hh, 0.07, trim, x, y, -3.84, 0, false);
    bx(w, 0.05, 0.07, trim, x, y, -3.84, 0, false);
  };

  /* Farmhouse kitchen: shaker base cabinets with a farmhouse sink under the window, a range under a
     plaster hood, open shelves of dishes, a panelled fridge, and an island with stools under lanterns. */
  const KX = -10.5;
  const cab = role("#7d8c99", -0.08, 0.35);
  const cabPanel = role("#8d9ba7", 0.04, 0.35);
  const islandM = role("#4f5d6b", -0.35, 0.35);
  bx(5.36, 0.1, 0.56, dark, KX - 0.2, F + 0.05, BACK + 0.28, 0, false);
  bx(5.4, 0.8, 0.62, cab, KX - 0.2, F + 0.5, BACK + 0.31);
  rb(5.5, 0.05, 0.68, 0.015, quartz, KX - 0.2, F + 0.925, BACK + 0.34);
  for (const x of [-13.15, -11.85, -11.3, -9.75, -9.2, -8.5]) {
    bx(0.46, 0.15, 0.02, cabPanel, x, F + 0.78, BACK + 0.63, 0, false);
    bx(0.46, 0.52, 0.02, cabPanel, x, F + 0.39, BACK + 0.63, 0, false);
    bx(0.34, 0.4, 0.015, cab, x, F + 0.39, BACK + 0.645, 0, false);
    bx(0.16, 0.02, 0.02, brass, x, F + 0.78, BACK + 0.66, 0, false);
    cy(0.016, 0.016, 0.03, brass, x + 0.17, F + 0.56, BACK + 0.66, 8).rotation.x = Math.PI / 2;
  }
  // The farmhouse sink (an apron front), a bridge faucet, and the window over it with a valance.
  bx(0.86, 0.3, 0.68, ceramic, KX, F + 0.78, BACK + 0.35);
  bx(0.74, 0.02, 0.5, grout, KX, F + 0.935, BACK + 0.35, 0, false);
  cy(0.02, 0.025, 0.3, brass, KX, F + 1.1, BACK + 0.08, 10);
  const spout = W.mesh(torus(gl, 0.1, 0.016, Math.PI, 20, 8), brass, W.scene);
  spout.position.set(KX, F + 1.25, BACK + 0.18);
  spout.rotation.set(0, Math.PI / 2, Math.PI / 2);
  for (const sx of [-0.14, 0.14]) cy(0.025, 0.025, 0.06, brass, KX + sx, F + 1.0, BACK + 0.08, 10);
  win(KX, 1.2);
  rb(1.5, 0.26, 0.08, 0.04, accent("#7c5cff", 0.15), KX, 2.42, BACK + 0.12);
  // Subway tile between the counter and the shelves, full height behind the range.
  bx(5.4, 0.36, 0.02, white, KX - 0.2, F + 1.13, BACK + 0.01, 0, false);
  for (let i = 1; i < 4; i++) bx(5.4, 0.008, 0.024, grout, KX - 0.2, F + 0.95 + i * 0.09, BACK + 0.012, 0, false);
  bx(1.0, 0.9, 0.02, white, -12.6, F + 1.75, BACK + 0.01, 0, false);
  for (let i = 1; i < 10; i++) bx(1.0, 0.008, 0.024, grout, -12.6, F + 1.3 + i * 0.09, BACK + 0.012, 0, false);
  // The range: a steel front, an oven window and bar handle, knobs, a black cooktop with grates.
  bx(0.92, 0.92, 0.68, metal, -12.6, F + 0.46, BACK + 0.34);
  bx(0.7, 0.36, 0.02, black, -12.6, F + 0.4, BACK + 0.69, 0, false);
  cy(0.016, 0.016, 0.72, metal, -12.6, F + 0.68, BACK + 0.74, 8).rotation.z = Math.PI / 2;
  for (let i = 0; i < 5; i++) cy(0.03, 0.03, 0.04, black, -12.92 + i * 0.16, F + 0.83, BACK + 0.7, 12).rotation.x = Math.PI / 2;
  bx(0.9, 0.03, 0.62, black, -12.6, F + 0.935, BACK + 0.34, 0, false);
  for (const gx of [-12.82, -12.38]) for (const gz of [BACK + 0.18, BACK + 0.5]) W.mesh(torus(gl, 0.09, 0.012, Math.PI * 2, 18, 6), dark, W.scene, false).position.set(gx, F + 0.955, gz);
  // The plaster hood: a tapered canopy on a wood band, its chimney to the top of the wall.
  const hood = W.mesh(cylinder(gl, 0.3, 0.66, 0.62, 4), white, W.scene);
  hood.position.set(-12.6, F + 2.06, BACK + 0.2);
  hood.rotation.y = Math.PI / 4;
  hood.scale.set(1, 1, 0.75);
  bx(1.0, 0.08, 0.52, walnut, -12.6, F + 1.77, BACK + 0.26);
  bx(0.44, 0.3, 0.32, white, -12.6, F + 2.5, BACK + 0.16);
  // Open shelves on brackets, set with plates, bowls and jars.
  for (const sy of [1.7, 2.12]) {
    rb(1.4, 0.05, 0.28, 0.012, walnut, -8.75, sy, BACK + 0.14);
    for (const sx of [-0.55, 0.55]) bx(0.03, 0.14, 0.2, black, -8.75 + sx, sy - 0.09, BACK + 0.11, 0, false);
  }
  for (let i = 0; i < 5; i++) cy(0.11, 0.11, 0.015, ceramic, -9.3 + i * 0.07, 1.83, BACK + 0.12, 24).rotation.x = Math.PI / 2 - 0.12;
  for (let i = 0; i < 3; i++) W.mesh(lathe(gl, [[0, 0], [0.05, 0], [0.11, 0.06], [0.1, 0.065], [0.045, 0.008], [0, 0.008]], 20), ceramic, W.scene).position.set(-8.6, 1.73 + i * 0.05, BACK + 0.14);
  ["#c9a35a", "#b0573a", "#6f8a6e"].forEach((c, i) => {
    cy(0.07, 0.07, 0.2, clear, -9.25 + i * 0.22, 2.25, BACK + 0.14, 16);
    cy(0.06, 0.06, 0.12, mc(W, c, 0.3), -9.25 + i * 0.22, 2.21, BACK + 0.14, 14);
    cy(0.072, 0.072, 0.03, walnut, -9.25 + i * 0.22, 2.36, BACK + 0.14, 16);
  });
  for (let i = 0; i < 4; i++) cy(0.1, 0.1, 0.015, ceramic, -8.55 + i * 0.06, 2.25, BACK + 0.12, 24).rotation.x = Math.PI / 2 - 0.12;
  // A cookbook shelf over the counter, and herbs on the sill.
  rb(0.7, 0.04, 0.24, 0.01, walnut, -11.6, 1.75, BACK + 0.12);
  ["#3d4f6b", "#b0573a", "#efe6d6", "#6f8a6e", "#c9a35a"].forEach((c, i) => bx(0.06, 0.24 - (i % 2) * 0.04, 0.18, mc(W, c, 0.3), -11.82 + i * 0.08, 1.89 - (i % 2) * 0.02, BACK + 0.12));
  for (const dx of [-0.35, 0, 0.35]) {
    cy(0.06, 0.05, 0.1, mc(W, "#b86b4b", 0.3), KX + dx, F + 1.0, BACK + 0.14, 14);
    W.mesh(sphere(gl, 0.08, 10, 8), mc(W, "#4f8a4a", 0.3), W.scene).position.set(KX + dx, F + 1.1, BACK + 0.14);
  }
  // The panelled fridge column with long brass pulls.
  bx(0.82, 2.2, 0.66, cab, -7.5, F + 1.1, BACK + 0.33);
  for (const [py, ph] of [[F + 1.55, 1.2], [F + 0.45, 0.8]] as const) {
    bx(0.74, ph, 0.02, cabPanel, -7.5, py, BACK + 0.67, 0, false);
    cy(0.012, 0.012, ph * 0.6, brass, -7.2, py, BACK + 0.71, 8);
  }
  // A striped runner by the sink.
  rb(2.6, 0.02, 0.62, 0.03, mc(W, "#d9cbb4", 0.1), KX, F + 0.012, -2.6);
  for (const dz of [-0.2, 0.2]) bx(2.5, 0.024, 0.06, accent("#7c5cff", 0.1), KX, F + 0.014, -2.6 + dz, 0, false);
  // The island: shiplap sides, a quartz top on turned corner posts, a bowl of lemons, flowers, stools.
  bx(2.1, 0.82, 0.84, islandM, KX, F + 0.47, -1.4);
  for (let i = 1; i < 6; i++) bx(2.12, 0.012, 0.86, dark, KX, F + 0.06 + i * 0.14, -1.4, 0, false);
  for (const sx of [-1.08, 1.08]) for (const sz of [-0.45, 0.45]) W.mesh(lathe(gl, [[0, 0], [0.06, 0], [0.06, 0.08], [0.04, 0.14], [0.05, 0.4], [0.035, 0.62], [0.05, 0.86], [0, 0.86]], 14), islandM, W.scene).position.set(KX + sx, F, -1.4 + sz);
  rb(2.4, 0.06, 1.04, 0.02, quartz, KX, F + 0.9, -1.4);
  W.mesh(lathe(gl, [[0, 0], [0.08, 0], [0.17, 0.08], [0.16, 0.085], [0.07, 0.01], [0, 0.01]], 22), walnut, W.scene).position.set(KX - 0.5, F + 0.93, -1.45);
  for (const [dx, dz] of [[0, 0], [0.07, 0.04], [-0.06, 0.05], [0.02, -0.07]] as const) W.mesh(sphere(gl, 0.05, 10, 8), mc(W, "#f2d14e", 0.4), W.scene).position.set(KX - 0.5 + dx, F + 1.0, -1.45 + dz);
  W.mesh(lathe(gl, [[0, 0], [0.05, 0], [0.07, 0.08], [0.04, 0.2], [0.05, 0.24], [0.04, 0.24]], 18), ceramic, W.scene).position.set(KX + 0.55, F + 0.93, -1.5);
  for (const [dx, c] of [[0, "#ffffff"], [0.05, "#e8a3b5"], [-0.05, "#f2c14e"]] as const) {
    cy(0.005, 0.005, 0.2, mc(W, "#4f8a4a", 0.3), KX + 0.55 + dx, F + 1.25, -1.5, 6, W.scene, false);
    W.mesh(sphere(gl, 0.05, 10, 8), mc(W, c, 0.3), W.scene).position.set(KX + 0.55 + dx, F + 1.36, -1.5);
  }
  for (const sx of [-0.7, 0, 0.7]) {
    const st = node(W.scene);
    st.position.set(KX + sx, F, -0.62);
    cy(0.19, 0.19, 0.06, walnut, 0, 0.66, 0, 20, st);
    for (const [lx, lz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]] as const) cy(0.018, 0.018, 0.64, black, lx, 0.32, lz, 8, st);
    W.mesh(torus(gl, 0.16, 0.012, Math.PI * 2, 20, 6), black, st).position.set(0, 0.24, 0);
    st.children[st.children.length - 1].rotation.x = Math.PI / 2;
    for (const lx of [-0.13, 0.13]) cy(0.014, 0.014, 0.36, black, lx, 0.86, 0.15, 8, st);
    rb(0.3, 0.1, 0.03, 0.02, walnut, 0, 1.02, 0.15, 0, 0, st);
  }
  // Two lanterns over the island: a cord, a black cage round a warm glass.
  for (const sx of [-0.6, 0.6]) {
    cy(0.006, 0.006, 0.7, dark, KX + sx, 2.65, -1.4, 6, W.scene, false);
    cy(0.1, 0.1, 0.36, warm, KX + sx, 2.1, -1.4, 14, W.scene, false);
    for (let i = 0; i < 4; i++) bx(0.016, 0.4, 0.016, black, KX + sx + Math.cos(i * 1.5708 + 0.785) * 0.13, 2.1, -1.4 + Math.sin(i * 1.5708 + 0.785) * 0.13, 0, false);
    cy(0.06, 0.16, 0.06, black, KX + sx, 2.31, -1.4, 4, W.scene, false).rotation.y = Math.PI / 4;
    cy(0.14, 0.14, 0.03, black, KX + sx, 1.9, -1.4, 4, W.scene, false).rotation.y = Math.PI / 4;
  }
  plant(-13.55, -3.3, 1.0);

  /* Family room: a white built-in media wall (the TV between bookshelves), an L-shaped sectional
     facing it, a tufted ottoman with a board game, a reading chair, a floor lamp, toys in a basket. */
  const FX = -3.5;
  const sofaM = role("#8b96a6", 0, 0.15);
  const cushion = role("#a3adbb", 0.22, 0.15);
  const ottoM = role("#5b6b7c", -0.3, 0.2);
  rb(4.6, 0.025, 3.4, 0.08, mc(W, "#cdb89a", 0.08), FX, F + 0.012, -1.3);
  rb(4.2, 0.03, 3.0, 0.06, mc(W, "#efe6d6", 0.08), FX, F + 0.016, -1.3);
  // The built-in: base cabinets, towers of shelves either side, the TV and soundbar.
  bx(4.4, 0.62, 0.46, white, FX, F + 0.31, BACK + 0.23);
  for (let i = 0; i < 6; i++) {
    bx(0.66, 0.46, 0.02, trim, FX - 1.85 + i * 0.74, F + 0.31, BACK + 0.47, 0, false);
    cy(0.015, 0.015, 0.03, brass, FX - 1.6 + i * 0.74, F + 0.42, BACK + 0.49, 8).rotation.x = Math.PI / 2;
  }
  rb(4.5, 0.05, 0.5, 0.01, oak, FX, F + 0.645, BACK + 0.25);
  for (const tx of [FX - 1.75, FX + 1.75]) {
    bx(0.9, 1.9, 0.04, white, tx, F + 1.62, BACK + 0.02, 0, false);
    for (const sx of [-0.44, 0.44]) bx(0.04, 1.9, 0.34, white, tx + sx, F + 1.62, BACK + 0.17);
    for (let k = 0; k < 4; k++) {
      const sy = F + 0.67 + k * 0.5;
      bx(0.88, 0.04, 0.34, white, tx, sy, BACK + 0.17);
      if (k === 3) continue;
      const cols = ["#3d4f6b", "#c9a35a", "#b0573a", "#efe6d6", "#6f8a6e", "#7c8aa0", "#2b2a30"];
      const n = 4 + ((k + (tx > FX ? 1 : 0)) % 3);
      for (let j = 0; j < n; j++) bx(0.07, 0.3 - ((j * 7 + k) % 3) * 0.04, 0.24, mc(W, cols[(j + k * 2) % cols.length], 0.3), tx - 0.36 + j * 0.08, sy + 0.17 - ((j * 7 + k) % 3) * 0.02, BACK + 0.17);
      W.mesh(lathe(gl, [[0, 0], [0.05, 0], [0.08, 0.08], [0.05, 0.2], [0.04, 0.22]], 18), k % 2 ? ceramic : mc(W, "#2f6f73", 0.7), W.scene).position.set(tx + 0.24, sy + 0.02, BACK + 0.17);
    }
  }
  bx(2.3, 1.36, 0.06, black, FX, F + 1.62, BACK + 0.05);
  // On the TV: a sunny landscape (bright, steady).
  bx(2.16, 0.7, 0.02, glow("#9fd3f2"), FX, F + 1.92, BACK + 0.09, 0, false);
  bx(2.16, 0.52, 0.02, glow("#7fc464"), FX, F + 1.21, BACK + 0.09, 0, false);
  put(W, gable(gl, 1.2, 0.4, 0.01), glow("#5aa25a"), W.scene, FX - 0.5, F + 1.47, BACK + 0.1, false);
  put(W, gable(gl, 1.4, 0.32, 0.01), glow("#4c9150"), W.scene, FX + 0.45, F + 1.47, BACK + 0.1, false);
  cy(0.12, 0.12, 0.01, glow("#fff1c1"), FX + 0.6, F + 2.06, BACK + 0.1, 20, W.scene, false).rotation.x = Math.PI / 2;
  rb(1.4, 0.08, 0.1, 0.03, dark, FX, F + 0.72, BACK + 0.3);
  // The sectional, its back to us: a long sofa and a chaise reaching toward the TV.
  const SZ = -0.2;
  rb(3.0, 0.3, 0.95, 0.07, sofaM, FX + 0.2, F + 0.27, SZ);
  rb(3.0, 0.62, 0.22, 0.08, sofaM, FX + 0.2, F + 0.6, SZ + 0.4);
  rb(0.22, 0.42, 0.95, 0.08, sofaM, FX + 1.75, F + 0.5, SZ);
  rb(0.95, 0.3, 1.7, 0.07, sofaM, FX - 1.3, F + 0.27, SZ - 0.38);
  rb(0.22, 0.42, 1.95, 0.08, sofaM, FX - 1.85, F + 0.5, SZ - 0.25);
  for (let i = 0; i < 3; i++) {
    rb(0.82, 0.14, 0.76, 0.06, cushion, FX - 0.25 + i * 0.84, F + 0.49, SZ - 0.05);
    rb(0.8, 0.5, 0.2, 0.08, cushion, FX - 0.25 + i * 0.84, F + 0.8, SZ + 0.24, 0, 0.12);
  }
  rb(0.82, 0.14, 1.5, 0.06, cushion, FX - 1.3, F + 0.49, SZ - 0.42);
  for (const [x, m, r] of [[FX - 1.5, white, 0.3], [FX + 1.4, accent("#7c5cff", 0.15), -0.25]] as const) rb(0.42, 0.4, 0.13, 0.11, m, x, F + 0.86, SZ + 0.12, r, 0.2);
  rb(0.04, 0.5, 0.9, 0.02, accent("#7c5cff", 0.15), FX + 1.88, F + 0.55, SZ);
  // The tufted ottoman: a board game, two cups and a bowl of popcorn.
  cy(0.55, 0.55, 0.38, ottoM, FX + 0.3, F + 0.21, -1.5, 32);
  for (let i = 0; i < 8; i++) W.mesh(sphere(gl, 0.02, 6, 4), dark, W.scene, false).position.set(FX + 0.3 + Math.cos(i * 0.785) * 0.3, F + 0.405, -1.5 + Math.sin(i * 0.785) * 0.3);
  bx(0.42, 0.015, 0.42, mc(W, "#efe6d6", 0.3), FX + 0.2, F + 0.41, -1.55, 0.3, false);
  for (let i = 0; i < 4; i++) bx(0.08, 0.02, 0.08, mc(W, ["#b0573a", "#3d4f6b", "#f2c14e", "#6f8a6e"][i], 0.4), FX + 0.12 + (i % 2) * 0.16, F + 0.425, -1.62 + Math.floor(i / 2) * 0.16, 0.3, false);
  W.mesh(lathe(gl, [[0, 0], [0.06, 0], [0.13, 0.08], [0.12, 0.085], [0.05, 0.01], [0, 0.01]], 20), accent("#7c5cff", 0.5), W.scene).position.set(FX + 0.6, F + 0.4, -1.3);
  for (let i = 0; i < 9; i++) W.mesh(sphere(gl, 0.025, 6, 4), mc(W, "#fff4d6", 0.2), W.scene, false).position.set(FX + 0.6 + Math.cos(i * 2.4) * 0.06 * (i % 3), F + 0.47 + (i % 2) * 0.02, -1.3 + Math.sin(i * 2.4) * 0.06 * (i % 3));
  for (const dx of [-0.05, 0.12]) W.mesh(lathe(gl, [[0, 0], [0.035, 0], [0.04, 0.1], [0.035, 0.1], [0.03, 0.008], [0, 0.008]], 14), ceramic, W.scene).position.set(FX - 0.05 + dx, F + 0.4, -1.25);
  // A reading chair turned toward the room, a floor lamp and side table, a basket of toys.
  const chair = node(W.scene);
  chair.position.set(FX + 2.2, 0, -2.3);
  chair.rotation.y = -0.6;
  rb(0.85, 0.28, 0.85, 0.07, ottoM, 0, F + 0.26, 0, 0, 0, chair);
  rb(0.85, 0.65, 0.18, 0.07, ottoM, 0, F + 0.62, -0.36, 0, -0.12, chair);
  for (const sx of [-0.4, 0.4]) rb(0.13, 0.34, 0.85, 0.06, ottoM, sx, F + 0.47, 0, 0, 0, chair);
  rb(0.66, 0.13, 0.7, 0.06, cushion, 0, F + 0.45, 0.04, 0, 0, chair);
  for (const sx of [-0.36, 0.36]) for (const sz of [-0.36, 0.36]) cy(0.025, 0.02, 0.12, wood, sx, F + 0.06, sz, 8, chair);
  W.mesh(lathe(gl, [[0, 0], [0.16, 0], [0.16, 0.03], [0, 0.03]], 20), dark, W.scene).position.set(FX - 2.35, F, 0.4);
  cy(0.014, 0.014, 1.4, brass, FX - 2.35, F + 0.72, 0.4, 8);
  W.mesh(lathe(gl, [[0.17, 1.38], [0.22, 1.38], [0.22, 1.68], [0.17, 1.68]], 28), warm, W.scene, false).position.set(FX - 2.35, F, 0.4);
  cy(0.22, 0.22, 0.03, oak, FX + 2.1, F + 0.55, -0.4, 20);
  cy(0.025, 0.025, 0.54, walnut, FX + 2.1, F + 0.27, -0.4, 8);
  lamp(FX + 2.1, F + 0.565, -0.4, 0.75);
  W.mesh(lathe(gl, [[0, 0], [0.18, 0], [0.22, 0.3], [0.2, 0.3], [0.16, 0.02], [0, 0.02]], 20), mc(W, "#c9a879", 0.2), W.scene).position.set(FX - 2.1, F, -2.9);
  for (let i = 0; i < 5; i++) bx(0.1, 0.1, 0.1, mc(W, ["#e05a47", "#3d8fd1", "#f2c14e", "#5bb36a", "#7c5cff"][i], 0.4), FX - 2.15 + (i % 3) * 0.06, F + 0.34 + Math.floor(i / 3) * 0.08, -2.92 + (i % 2) * 0.05, i * 0.4);
  for (let i = 0; i < 3; i++) bx(0.12, 0.12, 0.12, mc(W, ["#3d8fd1", "#f2c14e", "#e05a47"][i], 0.4), FX - 1.35, F + 0.08 + i * 0.12, -2.4, i * 0.3);
  art(FX - 1.75, 2.62, 0.7, 0.36, ["#c9a35a", "#7c8aa0"]);
  art(FX + 1.75, 2.62, 0.7, 0.36, ["#b0573a", "#efe6d6"]);
  plant(-6.4, -3.35, 1.1);

  /* Spa bathroom: tile wainscot, a double vanity with vessel sinks, arched mirrors and sconces, a
     freestanding tub with a floor-mounted filler, a glass shower with a rain head, a towel ladder. */
  const BX = 3;
  const vanity = role("#5f7180", -0.2, 0.35);
  const vanityPanel = role("#6f8191", -0.08, 0.35);
  const showerTile = role("#8fb0b8", 0.2, 0.6);
  bx(5.84, 1.2, 0.02, white, BX, F + 0.6, BACK + 0.01, 0, false);
  for (let i = 1; i < 10; i++) bx(5.84, 0.008, 0.024, grout, BX, F + i * 0.12, BACK + 0.012, 0, false);
  bx(5.86, 0.05, 0.05, trim, BX, F + 1.22, BACK + 0.03, 0, false);
  // The vanity on brass feet: doors and drawers with pulls, a quartz top, two vessel sinks, faucets.
  const VX = BX - 1.1;
  bx(2.6, 0.72, 0.56, vanity, VX, F + 0.5, BACK + 0.28);
  for (const sx of [-1.25, 1.25]) for (const sz of [0.05, 0.5]) cy(0.025, 0.02, 0.14, brass, VX + sx, F + 0.07, BACK + sz, 8);
  for (const dx of [-0.95, -0.42, 0.42, 0.95]) {
    bx(0.48, 0.56, 0.02, vanityPanel, VX + dx, F + 0.48, BACK + 0.57, 0, false);
    bx(0.36, 0.44, 0.015, vanity, VX + dx, F + 0.48, BACK + 0.585, 0, false);
    // (The pulls sit by the meeting edges of each pair of doors.)
    const toward = Math.abs(dx) > 0.6 ? -Math.sign(dx) : Math.sign(dx);
    cy(0.01, 0.01, 0.18, brass, VX + dx + toward * 0.17, F + 0.5, BACK + 0.6, 8);
  }
  for (let k = 0; k < 3; k++) {
    bx(0.3, 0.16, 0.02, vanityPanel, VX, F + 0.29 + k * 0.18, BACK + 0.57, 0, false);
    bx(0.12, 0.02, 0.02, brass, VX, F + 0.29 + k * 0.18, BACK + 0.59, 0, false);
  }
  rb(2.7, 0.05, 0.6, 0.015, quartz, VX, F + 0.885, BACK + 0.3);
  for (const sx of [-0.65, 0.65]) {
    W.mesh(lathe(gl, [[0, 0], [0.1, 0], [0.2, 0.06], [0.22, 0.14], [0.2, 0.14], [0.18, 0.07], [0.09, 0.02], [0, 0.02]], 28), ceramic, W.scene).position.set(VX + sx, F + 0.91, BACK + 0.3);
    cy(0.02, 0.02, 0.24, brass, VX + sx, F + 1.18, BACK + 0.13, 10).rotation.x = Math.PI / 2;
    cy(0.015, 0.015, 0.06, brass, VX + sx, F + 1.15, BACK + 0.24, 8);
    // An arched mirror in a brass frame, a sconce beside it.
    rb(0.78, 1.08, 0.03, 0.38, brass, VX + sx, F + 1.86, BACK + 0.03);
    rb(0.7, 1.0, 0.03, 0.34, mc(W, "#d8e2ea", 0.95), VX + sx, F + 1.86, BACK + 0.05);
  }
  for (const sx of [-1.25, 0, 1.25]) {
    cy(0.05, 0.05, 0.02, brass, VX + sx, F + 1.95, BACK + 0.03, 14).rotation.x = Math.PI / 2;
    cy(0.012, 0.012, 0.12, brass, VX + sx, F + 1.95, BACK + 0.1, 8).rotation.x = Math.PI / 2;
    W.mesh(lathe(gl, [[0.04, 0], [0.07, 0.03], [0.07, 0.16], [0.04, 0.19]], 16), warm, W.scene, false).position.set(VX + sx, F + 1.88, BACK + 0.17);
  }
  // On the vanity: a soap pump, a tray with rolled towels, a bud vase.
  cy(0.035, 0.035, 0.12, ceramic, VX - 0.25, F + 0.97, BACK + 0.2, 14);
  cy(0.008, 0.008, 0.06, brass, VX - 0.25, F + 1.06, BACK + 0.2, 6);
  rb(0.36, 0.02, 0.18, 0.02, walnut, VX + 0.1, F + 0.92, BACK + 0.24);
  for (const dx of [-0.08, 0.08]) cy(0.05, 0.05, 0.16, white, VX + 0.1 + dx, F + 0.98, BACK + 0.24, 14).rotation.z = Math.PI / 2;
  // The shower: tiled in the 30% colour, a glass screen and door, a rain head, a niche of bottles.
  const SX = 4.8;
  bx(2.1, 2.3, 0.02, showerTile, SX, F + 1.15, BACK + 0.025, 0, false);
  for (let i = 1; i < 10; i++) bx(0.008, 2.3, 0.03, grout, SX - 1.05 + i * 0.21, F + 1.15, BACK + 0.03, 0, false);
  for (let i = 1; i < 6; i++) bx(2.1, 0.008, 0.03, grout, SX, F + i * 0.38, BACK + 0.03, 0, false);
  bx(2.1, 0.04, 1.3, showerTile, SX, F + 0.02, BACK + 0.65, 0, false);
  bx(2.1, 0.08, 0.06, quartz, SX, F + 0.04, BACK + 1.3, 0, false);
  bx(0.03, 2.05, 1.3, clear, SX - 1.05, F + 1.08, BACK + 0.65, 0, false);
  bx(1.2, 2.05, 0.03, clear, SX - 0.42, F + 1.08, BACK + 1.31, 0, false);
  bx(0.03, 0.03, 1.3, brass, SX - 1.05, F + 2.11, BACK + 0.65, 0, false);
  bx(2.1, 0.03, 0.03, brass, SX, F + 2.11, BACK + 1.31, 0, false);
  cy(0.012, 0.012, 0.36, brass, SX - 0.2, F + 1.1, BACK + 1.35, 8);
  cy(0.015, 0.015, 0.4, brass, SX + 0.3, F + 2.12, BACK + 0.22, 8).rotation.x = Math.PI / 2;
  cy(0.16, 0.16, 0.025, brass, SX + 0.3, F + 2.1, BACK + 0.42, 24);
  cy(0.04, 0.04, 0.04, brass, SX + 0.3, F + 1.1, BACK + 0.05, 14).rotation.x = Math.PI / 2;
  bx(0.6, 0.32, 0.02, mc(W, "#5e7d85", 0.4), SX + 0.55, F + 1.3, BACK + 0.04, 0, false);
  ["#efe6d6", "#c9a35a", "#2f6f73"].forEach((c, i) => cy(0.04, 0.04, 0.2 - i * 0.02, mc(W, c, 0.6), SX + 0.38 + i * 0.16, F + 1.25 - i * 0.01, BACK + 0.08, 12));
  // The freestanding tub on brass feet, water in it, a filler beside it, a mat in front.
  const TX = BX + 1.6;
  rb(1.75, 0.62, 0.86, 0.3, ceramic, TX, F + 0.4, -1.45);
  rb(1.55, 0.04, 0.66, 0.02, mc(W, "#bfe3ec", 0.9), TX, F + 0.66, -1.45);
  for (const sx of [-0.65, 0.65]) for (const sz of [-0.3, 0.3]) W.mesh(sphere(gl, 0.05, 10, 8), brass, W.scene).position.set(TX + sx, F + 0.05, -1.45 + sz);
  cy(0.02, 0.025, 1.0, brass, TX + 1.1, F + 0.5, -1.45, 10);
  const filler = W.mesh(torus(gl, 0.12, 0.016, Math.PI, 20, 8), brass, W.scene);
  filler.position.set(TX + 0.98, F + 1.0, -1.45);
  for (const dz of [-0.06, 0.06]) cy(0.02, 0.02, 0.04, brass, TX + 1.1, F + 0.82, -1.45 + dz, 8).rotation.x = Math.PI / 2;
  rb(1.1, 0.02, 0.6, 0.06, accent("#7c5cff", 0.1), TX, F + 0.012, -0.55);
  // A towel ladder against the wall, towels on it; a plant.
  const lad = node(W.scene);
  lad.position.set(BX + 0.55, F, BACK + 0.25);
  lad.rotation.x = -0.14;
  for (const sx of [-0.2, 0.2]) cy(0.02, 0.02, 1.7, walnut, sx, 0.85, 0, 8, lad);
  for (let i = 0; i < 5; i++) cy(0.012, 0.012, 0.4, walnut, 0, 0.35 + i * 0.3, 0, 8, lad).rotation.z = Math.PI / 2;
  rb(0.32, 0.5, 0.05, 0.02, white, 0, 1.1, 0.04, 0, 0, lad);
  rb(0.3, 0.4, 0.05, 0.02, accent("#7c5cff", 0.15), 0, 0.55, 0.04, 0, 0, lad);
  plant(BX - 2.5, -1.2, 0.9);

  /* Basement game room: stairs coming down, a pool table under a billiard light, a dartboard and
     cue rack, a glowing sign, a bar with bottles and stools, an arcade cabinet, egress windows. */
  const GX = 9.5;
  const felt = accent("#2f7d55", 0.1, "felt");
  // The stairs down from the main floor, to code: 7½" risers on 10" treads, a handrail 35" up,
  // balusters under 4⅜" apart.
  const BR = 0.19;
  const BT = 0.255;
  const BX0 = 9.55;
  for (let i = 0; i < 14; i++) {
    const h = (i + 1) * BR;
    bx(BT, h, 1.0, white, BX0 - i * BT, F + h / 2, BACK + 0.5);
    bx(BT + 0.03, 0.03, 1.03, oak, BX0 - i * BT - 0.015, F + h + 0.015, BACK + 0.5);
    for (const dx of [-0.085, 0, 0.085]) {
      const top = F + BR + (BX0 + BT / 2 - (BX0 - i * BT + dx)) * (BR / BT) + 0.9;
      const base = F + h + 0.03;
      bx(0.025, top - base, 0.025, black, BX0 - i * BT + dx, (top + base) / 2, BACK + 1.0, 0, false);
    }
  }
  const bMid = BX0 - 6.5 * BT;
  const rl = bx(Math.hypot(14 * BT, 14 * BR) + 0.1, 0.06, 0.07, walnut, bMid, F + BR + (BX0 + BT / 2 - bMid) * (BR / BT) + 0.92, BACK + 1.0, 0);
  rl.rotation.z = -Math.atan(BR / BT);
  // The egress window (IRC R310): a clear opening over 5.7 sq ft, its sill under 44" off the floor,
  // a window well outside with its ladder.
  const EW = GX + 1.75;
  bx(1.06, 1.16, 0.06, trim, EW, F + 1.05 + 0.5, -3.9, 0, false);
  bx(0.9, 1.0, 0.04, glass, EW, F + 1.05 + 0.5, -3.86, 0, false);
  bx(0.04, 1.0, 0.07, trim, EW, F + 1.05 + 0.5, -3.84, 0, false);
  bx(1.2, 0.05, 0.14, trim, EW, F + 1.0, -3.82, 0, false);
  cy(0.02, 0.02, 0.05, brass, EW + 0.3, F + 1.12, -3.8, 8).rotation.x = Math.PI / 2;
  // The pool table: a walnut apron on turned legs, cushioned rails, felt, pockets, the balls racked.
  const PX = GX - 0.1;
  const PZ = -1.45;
  bx(2.4, 0.24, 1.3, walnut, PX, F + 0.68, PZ);
  for (const sx of [-1.05, 1.05]) for (const sz of [-0.5, 0.5]) W.mesh(lathe(gl, [[0, 0], [0.09, 0], [0.09, 0.06], [0.06, 0.12], [0.08, 0.3], [0.05, 0.5], [0.07, 0.58], [0, 0.58]], 14), walnut, W.scene).position.set(PX + sx, F, PZ + sz);
  bx(2.26, 0.04, 1.16, felt, PX, F + 0.81, PZ, 0, false);
  for (const sz of [-0.62, 0.62]) rb(2.5, 0.08, 0.14, 0.03, walnut, PX, F + 0.84, PZ + sz);
  for (const sx of [-1.19, 1.19]) rb(0.14, 0.08, 1.38, 0.03, walnut, PX + sx, F + 0.84, PZ);
  for (const sx of [-1.12, 0, 1.12]) for (const sz of [-0.55, 0.55]) cy(0.055, 0.055, 0.02, black, PX + sx, F + 0.84, PZ + sz, 14, W.scene, false);
  const ballC = ["#f2c14e", "#2f5fb3", "#d6453a", "#6a3d9a", "#e8822f", "#2f8a4e", "#8a2f2f", "#141418", "#f2c14e", "#2f5fb3"];
  let bi = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c <= r; c++) W.mesh(sphere(gl, 0.04, 12, 8), mc(W, ballC[bi++ % ballC.length], 0.8), W.scene).position.set(PX + 0.45 + r * 0.07, F + 0.87, PZ + (c - r / 2) * 0.082);
  W.mesh(sphere(gl, 0.04, 12, 8), mc(W, "#fbfaf7", 0.8), W.scene).position.set(PX - 0.55, F + 0.87, PZ);
  const cue = cy(0.008, 0.016, 1.4, oak, PX - 0.1, F + 0.88, PZ + 0.25, 8);
  cue.rotation.set(0, 0.3, Math.PI / 2);
  // The billiard light: a bar with three shades over the table.
  for (const sx of [-0.7, 0.7]) cy(0.005, 0.005, 0.7, dark, PX + sx, 2.65, PZ, 6, W.scene, false);
  bx(1.8, 0.04, 0.06, black, PX, 2.3, PZ, 0, false);
  for (const sx of [-0.6, 0, 0.6]) {
    W.mesh(lathe(gl, [[0, 0.22], [0.05, 0.21], [0.2, 0.05], [0.22, 0], [0.2, 0], [0.18, 0.04], [0, 0.18]], 24), felt, W.scene, false).position.set(PX + sx, 2.05, PZ);
    W.mesh(sphere(gl, 0.06, 10, 8), warm, W.scene, false).position.set(PX + sx, 2.1, PZ);
  }
  // The dartboard (rings round the bull) and a cue rack.
  const DX = GX + 1.0;
  [[0.26, "#141418"], [0.22, "#2f8a4e"], [0.2, "#f3ead6"], [0.14, "#d6453a"], [0.12, "#f3ead6"], [0.04, "#2f8a4e"], [0.018, "#d6453a"]].forEach(([r, c], i) => {
    cy(r as number, r as number, 0.03, mc(W, c as string, 0.2), DX, 1.75, BACK + 0.03 + i * 0.004, 32, W.scene, false).rotation.x = Math.PI / 2;
  });
  for (const [dx, dy] of [[0.05, 0.03], [-0.08, -0.06]] as const) {
    cy(0.006, 0.006, 0.12, black, DX + dx, 1.75 + dy, BACK + 0.1, 6, W.scene, false).rotation.x = Math.PI / 2;
    cy(0.02, 0.0, 0.04, accent("#7c5cff", 0.3), DX + dx, 1.75 + dy, BACK + 0.17, 4, W.scene, false).rotation.x = -Math.PI / 2;
  }
  bx(0.5, 1.3, 0.04, walnut, GX + 0.38, F + 1.25, BACK + 0.02);
  for (let i = 0; i < 4; i++) cy(0.009, 0.015, 1.2, i % 2 ? oak : walnut, GX + 0.2 + i * 0.12, F + 1.23, BACK + 0.08, 8);
  // The bar along the wall: a counter, shelves of bottles and glasses, a glowing fridge, stools.
  const RX = GX + 2.82;
  bx(1.16, 1.0, 0.55, walnut, RX, F + 0.5, BACK + 0.28);
  for (let i = 0; i < 3; i++) bx(0.012, 0.86, 0.02, dark, RX - 0.38 + i * 0.38, F + 0.5, BACK + 0.565, 0, false);
  rb(1.24, 0.06, 0.62, 0.015, quartz, RX, F + 1.03, BACK + 0.3);
  bx(0.4, 0.56, 0.02, glow("#fff1d6"), RX + 0.3, F + 0.38, BACK + 0.57, 0, false);
  outlet(W, RX - 0.4, F + 1.2, BACK + 0.01);
  for (const sy of [1.65, 2.05]) {
    rb(1.1, 0.04, 0.26, 0.01, walnut, RX, sy, BACK + 0.13);
    for (let i = 0; i < 5; i++) {
      const c = ["#3f7d45", "#8a5a2a", "#cfe3f2", "#6a2f3a", "#c9a35a", "#2f5d7c", "#e8e2d8"][(i + (sy > 1.8 ? 3 : 0)) % 7];
      W.mesh(lathe(gl, [[0, 0], [0.045, 0], [0.045, 0.16], [0.02, 0.22], [0.015, 0.3], [0, 0.3]], 14), mc(W, c, 0.85), W.scene).position.set(RX - 0.44 + i * 0.22, sy + 0.02, BACK + 0.13);
    }
  }
  W.mesh(torus(gl, 0.22, 0.022, Math.PI * 2, 40, 8), glow("#ffb4d9"), W.scene, false).position.set(RX, 2.55, BACK + 0.05);
  W.mesh(sphere(gl, 0.08, 14, 10), glow("#fff1c1"), W.scene, false).position.set(RX, 2.55, BACK + 0.05);
  for (const sx of [-0.32, 0.32]) {
    const st = node(W.scene);
    st.position.set(RX + sx, F, BACK + 1.0);
    cy(0.18, 0.18, 0.08, accent("#7c5cff", 0.4), 0, 0.78, 0, 20, st);
    cy(0.03, 0.03, 0.76, metal, 0, 0.38, 0, 10, st);
    cy(0.2, 0.2, 0.03, metal, 0, 0.015, 0, 20, st);
    W.mesh(torus(gl, 0.15, 0.012, Math.PI * 2, 20, 6), metal, st).position.set(0, 0.32, 0);
    st.children[st.children.length - 1].rotation.x = Math.PI / 2;
  }
  // The arcade cabinet, angled to the room: a glowing screen and marquee, a stick and buttons.
  const arc = node(W.scene);
  arc.position.set(6.9, F, -1.6);
  arc.rotation.y = 0.45;
  const arcM = role("#2c2a3a", -0.6, 0.4);
  put(W, box(gl, 0.72, 1.8, 0.7), arcM, arc, 0, 0.9, 0);
  const scr = put(W, box(gl, 0.56, 0.46, 0.02), glow("#7fd0ff"), arc, 0, 1.3, 0.3, false);
  scr.rotation.x = -0.25;
  put(W, box(gl, 0.6, 0.18, 0.02), glow("#ffd36b"), arc, 0, 1.68, 0.36, false);
  const pnl = put(W, box(gl, 0.72, 0.05, 0.34), dark, arc, 0, 0.98, 0.42);
  pnl.rotation.x = 0.3;
  cy(0.012, 0.012, 0.1, black, -0.18, 1.06, 0.44, 8, arc);
  W.mesh(sphere(gl, 0.035, 10, 8), mc(W, "#d6453a", 0.6), arc).position.set(-0.18, 1.12, 0.44);
  for (let i = 0; i < 4; i++) cy(0.025, 0.025, 0.02, mc(W, ["#f2c14e", "#3d8fd1", "#5bb36a", "#e05a47"][i], 0.6), 0.02 + (i % 2) * 0.09, 1.02 + Math.floor(i / 2) * 0.03, 0.4 + Math.floor(i / 2) * 0.08, 12, arc);
  for (const sx of [-0.37, 0.37]) put(W, box(gl, 0.02, 1.4, 0.5), accent("#7c5cff", 0.4), arc, sx, 0.9, 0.05, false);

  /* Home theater: dark walls with fabric panels, a big screen with a sunset landscape, speakers,
     two rows of recliners (the back row on a lit riser), sconces, a popcorn cart. */
  const TH = 16.5;
  const thWall = role("#2c2a3a", -0.62, 0.15);
  const panel = role("#3d3a52", -0.45, 0.1);
  const leather = role("#4a3a3a", -0.3, 0.45);
  const seam = role("#3a2e2e", -0.5, 0.4);
  bx(6.84, H, 0.02, thWall, TH, F + H / 2, BACK + 0.01, 0, false);
  for (const x of [13.09, 19.91]) bx(0.02, H, 2.4, thWall, x, F + H / 2, -2.8, 0, false);
  for (const x of [13.5, 14.0, 19.0, 19.5]) {
    rb(0.44, 1.3, 0.06, 0.04, panel, x, F + 1.65, BACK + 0.05);
  }
  // The screen: a black frame round a bright, steady sunset over the mountains.
  const SCZ = BACK + 0.08;
  bx(4.6, 2.2, 0.06, black, TH, F + 1.75, BACK + 0.04);
  bx(4.4, 0.9, 0.02, glow("#9fc9ef"), TH, F + 2.3, SCZ, 0, false);
  bx(4.4, 0.6, 0.02, glow("#f7c59f"), TH, F + 1.55, SCZ, 0, false);
  bx(4.4, 0.5, 0.02, glow("#5a8a6a"), TH, F + 0.9, SCZ, 0, false);
  cy(0.28, 0.28, 0.01, glow("#fff1c1"), TH + 0.8, F + 1.9, SCZ + 0.005, 28, W.scene, false).rotation.x = Math.PI / 2;
  put(W, gable(gl, 2.4, 0.75, 0.01), glow("#6b7fa8"), W.scene, TH - 0.9, F + 1.15, SCZ + 0.01, false);
  put(W, gable(gl, 2.0, 0.55, 0.01), glow("#55699a"), W.scene, TH + 1.1, F + 1.15, SCZ + 0.01, false);
  put(W, gable(gl, 4.0, 0.2, 0.01), glow("#4c7d5e"), W.scene, TH, F + 1.15, SCZ + 0.015, false);
  // Tower speakers either side and a centre speaker under the screen.
  for (const sx of [-2.75, 2.75]) {
    bx(0.36, 1.2, 0.36, black, TH + sx, F + 0.6, BACK + 0.4);
    for (const [dy, r] of [[0.95, 0.06], [0.7, 0.12], [0.35, 0.12]] as const) cy(r, r, 0.02, dark, TH + sx, F + dy, BACK + 0.59, 20, W.scene, false).rotation.x = Math.PI / 2;
  }
  bx(1.0, 0.18, 0.3, black, TH, F + 0.5, BACK + 0.3);
  for (const sx of [-2.6, 2.6]) {
    W.mesh(lathe(gl, [[0.03, 0], [0.12, 0.04], [0.12, 0.2], [0.03, 0.24]], 16), warm, W.scene, false).position.set(TH + sx, F + 2.25, BACK + 0.1);
  }
  // The riser for the back row, its edge lit with step lights.
  bx(6.8, 0.36, 1.6, carpet, TH, F + 0.18, 0.15);
  bx(6.8, 0.04, 0.04, dark, TH, F + 0.35, -0.65, 0, false);
  for (let i = 0; i < 8; i++) bx(0.12, 0.04, 0.02, glow("#ffd9a0"), TH - 3.0 + i * 0.86, F + 0.1, -0.66, 0, false);
  // Recliners: a seat, a high back with a headrest, padded arms with cup holders (backs to us).
  const recliners = (z: number, y: number) => {
    for (let i = 0; i < 4; i++) {
      const x = TH - 1.5 + i * 1.0;
      rb(0.8, 0.42, 0.85, 0.08, leather, x, y + 0.21, z);
      rb(0.7, 0.78, 0.24, 0.16, leather, x, y + 0.62, z + 0.36, 0, 0.12);
      rb(0.5, 0.2, 0.1, 0.08, seam, x, y + 0.9, z + 0.5, 0, 0.12);
    }
    for (let i = 0; i < 5; i++) {
      const x = TH - 2.0 + i * 1.0;
      rb(0.2, 0.52, 0.9, 0.07, seam, x, y + 0.26, z + 0.02);
      cy(0.045, 0.045, 0.02, black, x, y + 0.525, z - 0.25, 12, W.scene, false);
    }
  };
  recliners(-1.65, F);
  recliners(0.05, F + 0.36);
  // The popcorn cart.
  const pc = node(W.scene);
  pc.position.set(19.35, F, -1.9);
  const red = mc(W, "#c8372d", 0.5);
  put(W, box(gl, 0.5, 0.7, 0.4), red, pc, 0, 0.35, 0);
  put(W, box(gl, 0.46, 0.46, 0.36), warm, pc, 0, 0.95, 0, false);
  for (const [sx, sz] of [[-0.24, -0.19], [0.24, -0.19], [-0.24, 0.19], [0.24, 0.19]] as const) put(W, box(gl, 0.03, 0.48, 0.03), red, pc, sx, 0.95, sz, false);
  put(W, box(gl, 0.54, 0.08, 0.44), red, pc, 0, 1.22, 0);
  put(W, gable(gl, 0.54, 0.14, 0.44), red, pc, 0, 1.26, 0);
  for (let i = 0; i < 14; i++) {
    const p = W.mesh(sphere(gl, 0.035, 6, 4), mc(W, "#fff4d6", 0.2), pc, false);
    p.position.set(-0.15 + (i % 5) * 0.075, 0.76 + Math.floor(i / 5) * 0.05, -0.08 + (i % 3) * 0.08);
  }
  for (const sx of [-0.18, 0.18]) cy(0.06, 0.06, 0.03, black, sx, 0.05, 0.22, 12, pc).rotation.z = Math.PI / 2;

  // Code details: GFCI receptacles on the kitchen counter and by the vanity, a bath exhaust fan,
  // smoke and CO alarms on both floors.
  for (const ox of [-13.2, -11.9, -11.25, -9.7, -8.6]) outlet(W, ox, F + 1.13, BACK + 0.022);
  for (const ox of [VX - 1.15, VX + 1.15]) outlet(W, ox, F + 1.06, BACK + 0.022);
  bx(0.3, 0.3, 0.02, white, BX + 0.3, 2.62, BACK + 0.01, 0, false);
  for (let i = 0; i < 5; i++) bx(0.24, 0.015, 0.025, grout, BX + 0.3, 2.52 + i * 0.05, BACK + 0.022, 0, false);
  alarm(W, FX + 0.0, 2.78, BACK + 0.02);
  alarm(W, GX + 0.4, 2.78, BACK);
  alarm(W, 19.25, 2.8, BACK + 0.02);
  return {
    tones,
    rooms: [
      // (Each room seen straight on from the front, the theater from a little higher, over the seats.)
      { name: "Farmhouse kitchen", eye: [KX, 1.7, 4.4], target: [KX, 1.15, -1.6] },
      { name: "Family room", eye: [FX, 1.6, 4.4], target: [FX, 1.05, -1.6] },
      { name: "Spa bathroom", eye: [BX, 1.65, 4.3], target: [BX, 1.1, -1.8] },
      { name: "Basement game room", eye: [GX, 1.75, 4.4], target: [GX, 1.1, -1.6] },
      { name: "Home theater", eye: [TH, 2.9, 4.8], target: [TH, 1.3, -1.6] },
    ],
  };
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

/** The rooms in the intro's 60-30-10 colours (see homeTones). */
function tintInterior(P: { tones: Tones }, sc: SkillContext) {
  const T = homeTones(sc.palette);
  for (const m of P.tones.wall) m.uniforms.uColor.value = rgb(T.neutral);
  for (const [m, shade] of P.tones.support) m.uniforms.uColor.value = rgb(shade >= 0 ? mixHex(T.support, "#ffffff", shade) : mixHex(T.support, "#1d1b26", -shade));
  for (const m of P.tones.accent) m.uniforms.uColor.value = rgb(T.accent);
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

const ROOM_WORDS = /\b(room|kitchen|suite|bed|bath|bathroom|dining|living|office|den|loft|study|pantry|laundry|garage|porch|patio|foyer|entry|closet|primary|owner|backyard|yard|garden|deck|nook|flex|media|basement|theater|theatre|cinema|bar|gym|bonus)\b/i;
/** Room names that point to the second line of rooms (bath, family room, basement, game room, theater) or the first. */
const MORE_WORDS = /\b(bath|bathroom|family|basement|game|games|theater|theatre|cinema|media|rec|bar|bonus)\b/i;
const MAIN_WORDS = /\b(foyer|entry|living|great|owner|primary|suite|bed|bedroom|backyard|yard|pool|patio|deck|dining)\b/i;

function homeWalkthrough(sc0: SkillContext) {
  // Your room names choose the line of rooms: the second when they mostly name its rooms.
  const own = (sc0.scene.items ?? []).map((x) => plain(split(x).title)).filter((x) => ROOM_WORDS.test(x));
  const hits = (re: RegExp) => own.filter((x) => re.test(x)).length;
  glide(sc0, hits(MORE_WORDS) > hits(MAIN_WORDS));
}

function homeRooms(sc0: SkillContext) {
  glide(sc0, true);
}

/**
 * One continuous glide through a line of rooms, slowing (never stopping) at each, the room named
 * as the camera arrives: the first line (foyer, living room with the family, kitchen, suite, pool)
 * or the second (farmhouse kitchen, family room, bath, basement game room, home theater).
 */
function glide(sc0: SkillContext, more: boolean) {
  const sc = { ...sc0, palette: onLight(sc0.palette) };
  const { t, d, u, scene } = sc;
  indoorBack(sc);
  const st = stage(sc);
  const top = st.top - 24 * u;
  // Your room names when the points name rooms; the home's own otherwise.
  const own = (scene.items ?? []).map((x) => plain(split(x).title)).filter((x) => ROOM_WORDS.test(x));
  let names: string[] = [];
  // A short slide visits fewer rooms.
  const n = d >= 8 ? 5 : d >= 6 ? 4 : 3;
  const k = range(t, 0.2, d - 0.3);
  const seg = k * (n - 1);
  const i0 = Math.floor(seg);
  const s = Math.min(n - 1, i0 + sine(seg - i0) * 0.72 + (seg - i0) * 0.28);
  const cv = frame(sc, top, (w, h) => {
    let W: World;
    let rooms: { name: string; eye: Num3; target: Num3 }[];
    if (more) {
      const R = world("more-rooms", w, h, moreRoomsWorld);
      if (!R) return null;
      W = R.W;
      rooms = R.parts.rooms;
      tintInterior(R.parts, sc);
    } else {
      const R = world("interior", w, h, interiorWorld);
      if (!R) return null;
      const { parts } = R;
      W = R.W;
      rooms = parts.rooms;
      tintInterior(parts, sc);
      parts.family.forEach((P, i) => happy(P, t, i * 1.7, i === 1 ? clamp((t - 1.0) / 0.4) : 0));
      wag(parts.dog, t, 1);
    }
    names = rooms.map((r, i) => own[i] ?? r.name);
    const F = fitBack(sc, top);
    const eye = spline(rooms.slice(0, n).map((r) => r.eye), s);
    const target = spline(rooms.slice(0, n).map((r) => r.target), s);
    const back: Num3 = [eye[0], eye[1] + (F - 1) * 0.8, eye[2] + (F - 1) * 3];
    return render(W, { ...INDOOR, flat: !!sc.flat3d, cel: true, eye: back, target, fov: 46, shadowSize: 9, shadowAt: [eye[0] + 1, 0, -1.5] }, w, h);
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
    // Straight on to the living room at sitting height, pushing in a little.
    const k = sine(range(t, 0, d));
    const F = fitBack(sc, top);
    const eye: Num3 = [-4.9, lerp(1.6, 1.4, k), -1.6 + lerp(6.2, 5.0, k) * F];
    return render(W, { ...INDOOR, flat: !!sc.flat3d, cel: true, eye, target: [-4.9, 0.95, -1.9], fov: 38, shadowSize: 6, shadowAt: [-5, 0, -1.8] }, w, h);
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
    const eye: Num3 = [1.4, lerp(2.0, 1.75, k), lerp(15.5, 11.5, k) * F];
    return render(W, { ...GOLDEN, flat: !!sc.flat3d, cel: true, eye, target: [1.4, 2.4, 3.5], fov: 34, shadowSize: 12, shadowAt: [1.4, 0, 4], fog: [0.98, 0.89, 0.77, 0.006] }, w, h);
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
    sample: { text: "Step *inside*", items: ["Welcoming foyer", "Open living room", "Chef-inspired kitchen", "Owner's suite", "Backyard and pool"] },
    itemsHint: "0–5 room names",
    render: homeWalkthrough,
    sfx: () => [at(0.2, "whoosh")],
  },
  {
    id: "home-rooms",
    name: "More Rooms",
    tagline: "A second seamless 3D glide through more of the home: a farmhouse kitchen, the family room, a spa-style bathroom, then down to a basement game room and a home theater, the rooms named as you arrive.",
    bestFor: "Model homes and listings with bonus spaces (bath, family room, basement, game room, theater): up to 5 room names (else the home's own).",
    sample: { text: "Room for *more*", items: ["Farmhouse kitchen", "Family room", "Spa bathroom", "Basement game room", "Home theater"] },
    itemsHint: "0–5 room names",
    render: homeRooms,
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
