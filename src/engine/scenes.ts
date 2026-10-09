/**
 * Cartoon scene backgrounds for character videos, alongside the meadow: an office, a city street,
 * a construction site, a hospital, a classroom, a living room, a shop and a café. Each is a soft
 * flat illustration with the floor low in the frame (characters stand on it) and the upper middle
 * kept calm and light so headlines read on it. A little life moves on the video's own clock (a
 * clock's hand, a crane's hook, a heart monitor, clouds, steam), so it carries on across cuts.
 * Accents take the video's own colours.
 */
import { clamp, ease, mixHex, rgba, rng, TAU } from "./math";
import type { Palette, SkillContext } from "./types";

export const SCENES = ["office", "city", "construction", "hospital", "classroom", "home", "shop", "cafe", "kitchen", "bedroom", "bathroom", "house", "salon", "restaurant", "bakery", "garage", "gym", "yoga", "florist", "bookstore", "hotel", "asian", "antique", "thrift", "music", "repair", "church", "roofing", "plumbing", "lawn", "cleaning", "icecream", "law", "dental", "accounting", "electrical", "hvac", "photo", "petgroom", "tattoo", "moving", "carwash"] as const;
export type SceneBackdrop = (typeof SCENES)[number];

type C = CanvasRenderingContext2D;

/**
 * The brand: scenes are tinted with the intro's colours so they look made for it. Walls lean to a
 * pale tint of the primary colour, floors a little to the secondary, the sky a touch to the primary,
 * and the colourful details (books, products, bunting, cushions) come from the palette. Set by
 * sceneStage for the scene being drawn.
 */
let brand: Palette | undefined;
/** The slide brings its own board or sign: leave the scene's out (see sceneStage). */
let bare = false;
/** The scene being drawn is a room (set by room()), so it gets the indoor finishing light. */
let indoor = false;
const wallT = (hex: string) => (brand ? mixHex(hex, mixHex(brand.primary, "#ffffff", 0.55), 0.3) : hex);
const floorT = (hex: string) => (brand ? mixHex(hex, brand.secondary, 0.16) : hex);
const skyT = (hex: string) => (brand ? mixHex(hex, brand.primary, 0.14) : hex);
/** Bright details in the brand's colours (and lighter shades of them). */
const brandColors = (p: Palette) => [p.primary, mixHex(p.secondary, "#ffffff", 0.15), p.accent, mixHex(p.primary, "#ffffff", 0.45), mixHex(p.accent, "#ffffff", 0.4), mixHex(p.secondary, "#ffffff", 0.45)];

const box = (ctx: C, x: number, y: number, w: number, h: number, r: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};

/** A wall (soft vertical gradient) and a floor from `fy` down, with a baseboard. */
function room(ctx: C, w: number, h: number, fy: number, wall: [string, string], floor: [string, string], u: number) {
  wall = [wallT(wall[0]), wallT(wall[1])];
  floor = [floorT(floor[0]), floorT(floor[1])];
  const g = ctx.createLinearGradient(0, 0, 0, fy);
  g.addColorStop(0, wall[0]);
  g.addColorStop(1, wall[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, fy);
  const f = ctx.createLinearGradient(0, fy, 0, h);
  f.addColorStop(0, floor[0]);
  f.addColorStop(1, floor[1]);
  ctx.fillStyle = f;
  ctx.fillRect(0, fy, w, h - fy);
  ctx.fillStyle = mixHex(wall[1], "#000000", 0.08);
  ctx.fillRect(0, fy - 8 * u, w, 8 * u);
  indoor = true;
  // (A clean, flat wall: no wallpaper stripes, so the room reads crisp and modern.)
  // Soft wall-wash lights pooling down from the ceiling.
  for (const fx of [0.22, 0.78]) {
    const lg = ctx.createRadialGradient(w * fx, 0, 0, w * fx, 0, fy * 0.95);
    lg.addColorStop(0, "rgba(255,248,236,0.16)");
    lg.addColorStop(0.55, "rgba(255,248,236,0.03)");
    lg.addColorStop(1, "rgba(255,244,222,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, fy);
  }
  // Crown moulding along the ceiling line.
  ctx.fillStyle = mixHex(wall[0], "#ffffff", 0.5);
  ctx.fillRect(0, 0, w, 10 * u);
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(0, 10 * u, w, 3 * u);
  // The floor: a polished sheen under the wall, a contact shadow at the baseboard, darker toward the front.
  const sheen = ctx.createLinearGradient(0, fy, 0, fy + (h - fy) * 0.45);
  sheen.addColorStop(0, "rgba(255,255,255,0.12)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, fy, w, (h - fy) * 0.45);
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, fy, w, 4 * u);
  const front = ctx.createLinearGradient(0, fy, 0, h);
  front.addColorStop(0.4, "rgba(0,0,0,0)");
  front.addColorStop(1, "rgba(0,0,0,0.1)");
  ctx.fillStyle = front;
  ctx.fillRect(0, fy, w, h - fy);
}

/**
 * The finishing light over an indoor scene: faint sunbeams slanting in from the upper left with a
 * few motes drifting in them, and a light vignette: depth and air without haze, so the room stays
 * crisp and its props read at a glance.
 */
function finishIndoor(sc: SkillContext) {
  const { ctx, w, h, u } = sc;
  const T = sc.globalT ?? sc.t;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const x0 = w * (0.08 + i * 0.13) + Math.sin(T * 0.15 + i) * w * 0.01;
    const bw = w * (0.05 + i * 0.015);
    const g = ctx.createLinearGradient(x0, 0, x0 + w * 0.32, h);
    g.addColorStop(0, "rgba(255,236,200,0.02)");
    g.addColorStop(1, "rgba(255,236,200,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0 + bw, 0);
    ctx.lineTo(x0 + bw + w * 0.34, h);
    ctx.lineTo(x0 + w * 0.3, h);
    ctx.fill();
  }
  // Dust motes catching the light.
  const r = rng(91);
  for (let i = 0; i < 8; i++) {
    const bx = w * (0.08 + r() * 0.45);
    const by = h * r();
    const x = bx + ((T * (6 + r() * 6) * u + by * 0.3) % (w * 0.15));
    const y = (by + T * (4 + r() * 5) * u) % h;
    ctx.fillStyle = `rgba(255,245,225,${0.12 + 0.1 * Math.sin(T * 1.3 + i)})`;
    ctx.beginPath();
    ctx.arc(x, y, (1.2 + r() * 1.6) * u, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // A gentle vignette.
  const v = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  v.addColorStop(0, "rgba(30,20,10,0)");
  v.addColorStop(1, "rgba(30,20,10,0.1)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/** A window with sky (and drifting clouds) or a skyline behind it. */
function windowPane(ctx: C, x: number, y: number, w: number, h: number, u: number, T: number, skyline = false) {
  box(ctx, x - 8 * u, y - 8 * u, w + 16 * u, h + 16 * u, 10 * u, "#ffffff");
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6 * u);
  ctx.clip();
  const s = ctx.createLinearGradient(0, y, 0, y + h);
  s.addColorStop(0, skyT("#a9dcff"));
  s.addColorStop(1, skyT("#e4f4ff"));
  ctx.fillStyle = s;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = 0; i < 2; i++) {
    const cx = x + (((i * 0.55 + T * 0.012) % 1.3) - 0.15) * w;
    const cy = y + h * (0.25 + i * 0.2);
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.16, h * 0.05, 0, 0, TAU);
    ctx.ellipse(cx + w * 0.05, cy - h * 0.04, w * 0.08, h * 0.05, 0, 0, TAU);
    ctx.fill();
  }
  if (skyline) {
    const r = rng(77);
    let bx = x;
    while (bx < x + w) {
      const bw = w * (0.1 + r() * 0.12);
      const bh = h * (0.25 + r() * 0.4);
      ctx.fillStyle = r() < 0.5 ? "#b9c9e3" : "#a7bbdb";
      ctx.fillRect(bx, y + h - bh, bw - 2 * u, bh);
      bx += bw;
    }
  }
  ctx.restore();
  // Mullions.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + w / 2 - 3 * u, y, 6 * u, h);
  ctx.fillRect(x, y + h * 0.5 - 3 * u, w, 6 * u);
}

function plant(ctx: C, x: number, floorY: number, s: number, T: number, pot: string) {
  const sway = Math.sin(T * 1.3 + x) * s * 0.03;
  ctx.fillStyle = "#4caf6a";
  for (const [dx, dy, a] of [[-0.25, -0.9, -0.5], [0.22, -1.0, 0.45], [0, -1.25, 0], [-0.35, -0.6, -0.9], [0.35, -0.65, 0.9]] as const) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s + sway, floorY - s * 0.55 + dy * s * 0.6, s * 0.14, s * 0.36, a, 0, TAU);
    ctx.fill();
  }
  box(ctx, x - s * 0.28, floorY - s * 0.55, s * 0.56, s * 0.55, s * 0.08, pot);
}

function clock(ctx: C, x: number, y: number, r: number, T: number, u: number) {
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#3d4459";
  ctx.lineWidth = 4 * u;
  ctx.stroke();
  ctx.lineCap = "round";
  const a = T * 0.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.sin(a) * r * 0.7, y - Math.cos(a) * r * 0.7);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.sin(a / 12) * r * 0.45, y - Math.cos(a / 12) * r * 0.45);
  ctx.stroke();
}

function sky(ctx: C, w: number, h: number, T: number, u: number, seed: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, skyT("#a3d9ff"));
  g.addColorStop(0.6, skyT("#e2f3ff"));
  g.addColorStop(1, "#f5fbff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(seed + 5);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  for (let i = 0; i < 3; i++) {
    const cw = (160 + r() * 140) * u;
    const cy = h * (0.08 + r() * 0.18);
    const cx = ((r() * (w + cw * 2) + T * 10 * u) % (w + cw * 2)) - cw;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw * 0.5, cw * 0.15, 0, 0, TAU);
    ctx.ellipse(cx - cw * 0.15, cy - cw * 0.1, cw * 0.2, cw * 0.16, 0, 0, TAU);
    ctx.ellipse(cx + cw * 0.12, cy - cw * 0.12, cw * 0.22, cw * 0.18, 0, 0, TAU);
    ctx.fill();
  }
}

/* ───────────────────────── Scenes ───────────────────────── */

function office(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f3f5fa", "#e7ebf3"], ["#d8dde8", "#c9d0de"], u);
  const port = h > w;
  windowPane(ctx, w * 0.05, h * 0.12, port ? w * 0.36 : w * 0.22, h * 0.36, u, T, true);
  // An accent stripe in the brand's colour along the wall.
  ctx.fillStyle = rgba(palette.primary, 0.14);
  ctx.fillRect(0, fy - h * 0.14, w, h * 0.035);
  clock(ctx, w * 0.82, h * 0.18, Math.min(w, h) * 0.045, T, u);
  // A shelf with books.
  const sx = w * 0.72;
  const sy = h * 0.38;
  box(ctx, sx, sy, w * 0.2, 8 * u, 3 * u, "#b98a63");
  const books = brandColors(palette);
  for (let i = 0; i < 6; i++) box(ctx, sx + w * 0.012 + i * w * 0.022, sy - h * (0.06 + (i % 3) * 0.01), w * 0.016, h * (0.06 + (i % 3) * 0.01), 2 * u, books[i % books.length]);
  // Desks with monitors at the sides, low in the frame.
  const desk = (x: number, dw: number) => {
    box(ctx, x, fy - h * 0.13, dw, h * 0.025, 4 * u, "#c79b74");
    ctx.fillStyle = "#a57b57";
    ctx.fillRect(x + dw * 0.06, fy - h * 0.11, 6 * u, h * 0.11);
    ctx.fillRect(x + dw * 0.94 - 6 * u, fy - h * 0.11, 6 * u, h * 0.11);
    box(ctx, x + dw * 0.32, fy - h * 0.25, dw * 0.36, h * 0.11, 6 * u, "#3d4459");
    box(ctx, x + dw * 0.34, fy - h * 0.24, dw * 0.32, h * 0.09, 4 * u, mixHex(palette.primary, "#ffffff", 0.55));
    ctx.fillStyle = "#3d4459";
    ctx.fillRect(x + dw * 0.48, fy - h * 0.14, dw * 0.04, h * 0.012);
  };
  desk(w * 0.02, w * 0.2);
  desk(w * 0.78, w * 0.2);
  plant(ctx, w * 0.27, fy, h * 0.16, T, "#e8e2d8");
}

function city(sc: SkillContext) {
  const { ctx, w, h, u, palette, seed } = sc;
  const T = sc.globalT ?? sc.t;
  sky(ctx, w, h, T, u, seed);
  const ground = h * 0.78;
  // Two layers of buildings, far and near, with windows.
  const layer = (base: number, colors: string[], hMin: number, hMax: number, s: number, win: boolean) => {
    const r = rng(s);
    let x = -20 * u;
    while (x < w) {
      const bw = (70 + r() * 90) * u;
      const bh = h * (hMin + r() * (hMax - hMin));
      const col = colors[Math.floor(r() * colors.length)];
      box(ctx, x, base - bh, bw - 6 * u, bh, 6 * u, col);
      if (win) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        for (let wy = base - bh + 14 * u; wy < base - 20 * u; wy += 24 * u) for (let wx = x + 10 * u; wx < x + bw - 22 * u; wx += 20 * u) ctx.fillRect(wx, wy, 9 * u, 12 * u);
      }
      x += bw;
    }
  };
  layer(ground, ["#c5d4ec", "#b7c8e6", "#d2ddf0"].map((c) => mixHex(c, palette.primary, 0.12)), 0.22, 0.42, 11, false);
  layer(ground, ["#8fa5cc", "#9cb0d4", "#a4b6d8"].map((c) => mixHex(c, palette.primary, 0.28)).concat(mixHex(palette.secondary, "#8fa5cc", 0.45)), 0.12, 0.3, 23, true);
  // Pavement and road.
  ctx.fillStyle = "#d7dbe3";
  ctx.fillRect(0, ground, w, h * 0.06);
  ctx.fillStyle = "#5d6475";
  ctx.fillRect(0, ground + h * 0.06, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  for (let x = ((-T * 40 * u) % (90 * u)) - 90 * u; x < w; x += 90 * u) ctx.fillRect(x, ground + h * 0.13, 46 * u, 5 * u);
  // Street lamps and little trees on the pavement.
  for (let i = 0; i < 4; i++) {
    const lx = w * (0.1 + i * 0.27);
    if (i % 2 === 0) {
      ctx.fillStyle = "#4a5165";
      ctx.fillRect(lx - 3 * u, ground - h * 0.2, 6 * u, h * 0.2);
      box(ctx, lx - 14 * u, ground - h * 0.21, 28 * u, 10 * u, 5 * u, "#4a5165");
      ctx.fillStyle = "rgba(255,226,140,0.9)";
      ctx.beginPath();
      ctx.arc(lx, ground - h * 0.195, 6 * u, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = "#8a5a3b";
      ctx.fillRect(lx - 4 * u, ground - h * 0.08, 8 * u, h * 0.08);
      ctx.fillStyle = "#4caf6a";
      ctx.beginPath();
      ctx.arc(lx, ground - h * 0.11, h * 0.045, 0, TAU);
      ctx.fill();
    }
  }
}

function construction(sc: SkillContext) {
  const { ctx, w, h, u, seed } = sc;
  const T = sc.globalT ?? sc.t;
  sky(ctx, w, h, T, u, seed);
  const ground = h * 0.76;
  // A building going up: a steel frame, part clad.
  const bx = w * 0.04;
  const bw = w * (h > w ? 0.4 : 0.24);
  const bt = h * 0.26;
  ctx.fillStyle = "#d9c7a8";
  ctx.fillRect(bx, ground - (ground - bt) * 0.45, bw, (ground - bt) * 0.45);
  ctx.strokeStyle = "#7b8496";
  ctx.lineWidth = 5 * u;
  const floors = 5;
  for (let i = 0; i <= floors; i++) {
    const y = bt + ((ground - bt) * i) / floors;
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.lineTo(bx + bw, y);
    ctx.stroke();
  }
  for (let j = 0; j <= 3; j++) {
    const x = bx + (bw * j) / 3;
    ctx.beginPath();
    ctx.moveTo(x, bt);
    ctx.lineTo(x, ground);
    ctx.stroke();
  }
  // A tower crane on the right with a swaying hook.
  const cx = w * 0.84;
  const mastTop = h * 0.1;
  ctx.strokeStyle = "#f2b632";
  ctx.lineWidth = 6 * u;
  ctx.beginPath();
  ctx.moveTo(cx - 12 * u, ground);
  ctx.lineTo(cx - 12 * u, mastTop);
  ctx.moveTo(cx + 12 * u, ground);
  ctx.lineTo(cx + 12 * u, mastTop);
  for (let y = ground; y > mastTop + 20 * u; y -= 30 * u) {
    ctx.moveTo(cx - 12 * u, y);
    ctx.lineTo(cx + 12 * u, y - 30 * u);
  }
  ctx.moveTo(cx - w * 0.36, mastTop);
  ctx.lineTo(cx + w * 0.08, mastTop);
  ctx.moveTo(cx - w * 0.36, mastTop + 18 * u);
  ctx.lineTo(cx + w * 0.08, mastTop + 18 * u);
  ctx.stroke();
  box(ctx, cx - 26 * u, mastTop + 18 * u, 52 * u, 36 * u, 6 * u, "#f2b632");
  box(ctx, cx - 18 * u, mastTop + 24 * u, 22 * u, 18 * u, 3 * u, "#bfe3ff");
  const hx = cx - w * 0.26 + Math.sin(T * 0.8) * w * 0.012;
  const hy = mastTop + h * 0.26;
  ctx.strokeStyle = "#4a5165";
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.26, mastTop + 18 * u);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  box(ctx, hx - 34 * u, hy, 68 * u, 14 * u, 3 * u, sc.palette.primary);
  // Ground, a barrier and cones.
  ctx.fillStyle = "#d8bf94";
  ctx.fillRect(0, ground, w, h - ground);
  ctx.fillStyle = "#c9ad7e";
  ctx.fillRect(0, ground, w, 6 * u);
  const barX = w * 0.32;
  const barW = w * 0.2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(barX, ground - h * 0.09, barW, h * 0.03);
  ctx.clip();
  for (let x = barX - 40 * u; x < barX + barW; x += 28 * u) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(barX - 40 * u, ground - h * 0.09, barW + 80 * u, h * 0.03);
    break;
  }
  ctx.fillStyle = "#ef6b3a";
  for (let x = barX - 40 * u; x < barX + barW; x += 28 * u) {
    ctx.beginPath();
    ctx.moveTo(x, ground - h * 0.06);
    ctx.lineTo(x + 14 * u, ground - h * 0.09);
    ctx.lineTo(x + 28 * u, ground - h * 0.09);
    ctx.lineTo(x + 14 * u, ground - h * 0.06);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#7b8496";
  ctx.fillRect(barX + 6 * u, ground - h * 0.06, 5 * u, h * 0.06);
  ctx.fillRect(barX + barW - 11 * u, ground - h * 0.06, 5 * u, h * 0.06);
  for (const x of [w * 0.6, w * 0.66]) {
    ctx.fillStyle = "#ef6b3a";
    ctx.beginPath();
    ctx.moveTo(x - 16 * u, ground);
    ctx.lineTo(x, ground - 46 * u);
    ctx.lineTo(x + 16 * u, ground);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 9 * u, ground - 26 * u, 18 * u, 7 * u);
  }
}

function hospital(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#eef8f6", "#e1f1ee"], ["#d4e4e2", "#c4d8d5"], u);
  windowPane(ctx, w * 0.06, h * 0.12, h > w ? w * 0.34 : w * 0.18, h * 0.32, u, T);
  // A sign with a plus (not a red cross, which is a protected emblem).
  const px = w * (h > w ? 0.5 : 0.36);
  const py = h * 0.5;
  box(ctx, px - 30 * u, py, 60 * u, 60 * u, 12 * u, "#ffffff");
  ctx.fillStyle = "#22a39a";
  ctx.fillRect(px - 7 * u, py + 12 * u, 14 * u, 36 * u);
  ctx.fillRect(px - 18 * u, py + 23 * u, 36 * u, 14 * u);
  // A heart monitor on the wall with a moving trace.
  const mx = w * 0.66;
  const my = h * 0.16;
  const mw = w * 0.16;
  const mh = h * 0.13;
  box(ctx, mx, my, mw, mh, 8 * u, "#2d3445");
  ctx.strokeStyle = "#5ff0b2";
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const f = i / 40;
    const ph = (f * 2 + T * 0.8) % 1;
    const beat = ph > 0.45 && ph < 0.55 ? Math.sin(((ph - 0.45) / 0.1) * TAU) * mh * 0.32 : 0;
    const x = mx + 10 * u + f * (mw - 20 * u);
    const y = my + mh * 0.55 - beat;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  // A bed at the left and an IV stand; a curtain at the right.
  const bx = w * 0.04;
  const bw = w * 0.22;
  box(ctx, bx, fy - h * 0.12, bw, h * 0.05, 8 * u, "#ffffff");
  box(ctx, bx, fy - h * 0.14, bw * 0.28, h * 0.035, 8 * u, mixHex(palette.primary, "#ffffff", 0.7));
  ctx.fillStyle = "#9aa6b8";
  ctx.fillRect(bx + 6 * u, fy - h * 0.2, 6 * u, h * 0.2);
  ctx.fillRect(bx + bw - 12 * u, fy - h * 0.16, 6 * u, h * 0.16);
  ctx.fillRect(bx, fy - h * 0.075, bw, 6 * u);
  const ix = bx + bw + 30 * u;
  ctx.fillRect(ix - 2 * u, fy - h * 0.36, 4 * u, h * 0.36);
  box(ctx, ix - 12 * u, fy - h * 0.36, 24 * u, 34 * u, 8 * u, "rgba(180,220,255,0.9)");
  ctx.fillStyle = "#9aa6b8";
  ctx.fillRect(w * 0.8, h * 0.04, w * 0.2, 5 * u);
  // A privacy curtain, gathered in soft pleats, hanging from a rail at the right.
  const cx0 = w * 0.87;
  const cw = w * 0.13;
  const cb = fy - h * 0.06;
  const cloth = mixHex("#bfe6df", palette.primary, 0.12);
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(cx0, h * 0.05);
  ctx.lineTo(w, h * 0.05);
  ctx.lineTo(w, cb);
  for (let i = 6; i >= 0; i--) ctx.quadraticCurveTo(cx0 + ((i + 0.5) / 6) * cw, cb + 10 * u, cx0 + (i / 6) * cw, cb);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mixHex(cloth, "#000000", 0.08);
  for (let i = 1; i < 6; i += 2) ctx.fillRect(cx0 + (i / 6) * cw, h * 0.05, cw / 12, cb - h * 0.05);
  ctx.fillStyle = "#9aa6b8";
  ctx.fillRect(cx0 - 10 * u, h * 0.04, w - cx0 + 10 * u, 5 * u);
}

function classroom(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#fbf4e6", "#f3e8d2"], ["#d8b98f", "#c9a77a"], u);
  // A chalkboard to the left with a few chalk scribbles (a window when a slide brings its own
  // board); bunting across the top.
  const cbx = w * 0.04;
  const cbw = h > w ? w * 0.42 : w * 0.26;
  if (bare) windowPane(ctx, cbx, h * 0.14, cbw, h * 0.3, u, T);
  else {
  box(ctx, cbx - 8 * u, h * 0.14 - 8 * u, cbw + 16 * u, h * 0.32 + 16 * u, 8 * u, "#b98a63");
  box(ctx, cbx, h * 0.14, cbw, h * 0.32, 4 * u, "#3f6b55");
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 3 * u;
  ctx.font = `700 ${Math.round(h * 0.05)}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("A B C", cbx + cbw * 0.12, h * 0.25);
  ctx.fillText("1 + 2", cbx + cbw * 0.12, h * 0.36);
  }
  const colors = brandColors(palette);
  for (let i = 0; i < 14; i++) {
    const x = (i / 13) * w;
    const y = h * 0.05 + Math.sin((i / 13) * Math.PI) * h * 0.03;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(x - 14 * u, y);
    ctx.lineTo(x + 14 * u, y);
    ctx.lineTo(x, y + 26 * u);
    ctx.fill();
  }
  clock(ctx, w * 0.84, h * 0.2, Math.min(w, h) * 0.045, T, u);
  // A bookshelf at the right; little desks at the front corners.
  const sx = w * 0.76;
  box(ctx, sx, fy - h * 0.3, w * 0.18, h * 0.3, 6 * u, "#c79b74");
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 6; i++) box(ctx, sx + 10 * u + i * w * 0.026, fy - h * (0.27 - r * 0.09), w * 0.02, h * 0.07, 2 * u, colors[(i + r) % colors.length]);
  }
  for (const x of [w * 0.34, w * 0.56]) {
    box(ctx, x, fy - h * 0.1, w * 0.1, h * 0.02, 4 * u, "#e6c08f");
    ctx.fillStyle = "#9c7a55";
    ctx.fillRect(x + 6 * u, fy - h * 0.08, 5 * u, h * 0.08);
    ctx.fillRect(x + w * 0.1 - 11 * u, fy - h * 0.08, 5 * u, h * 0.08);
  }
}

function home(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, [mixHex("#fdf1e7", palette.primary, 0.05), "#f6e3d3"], ["#d9b48e", "#c99f77"], u);
  const wx = w * 0.62;
  const ww = h > w ? w * 0.32 : w * 0.2;
  windowPane(ctx, wx, h * 0.12, ww, h * 0.34, u, T);
  // Curtains.
  ctx.fillStyle = mixHex(palette.primary, "#ffffff", 0.45);
  for (const x of [wx - 26 * u, wx + ww - 4 * u]) box(ctx, x, h * 0.08, 30 * u, h * 0.44, 14 * u, ctx.fillStyle as string);
  // Picture frames, a lamp, a sofa and a rug.
  box(ctx, w * 0.12, h * 0.16, w * 0.09, h * 0.12, 4 * u, "#c79b74");
  box(ctx, w * 0.125, h * 0.17, w * 0.08, h * 0.1, 3 * u, "#bfe3ff");
  box(ctx, w * 0.24, h * 0.2, w * 0.06, h * 0.08, 4 * u, "#c79b74");
  box(ctx, w * 0.245, h * 0.21, w * 0.05, h * 0.06, 3 * u, "#ffd8a8");
  const lx = w * 0.9;
  ctx.fillStyle = "#6b5a4c";
  ctx.fillRect(lx - 3 * u, fy - h * 0.34, 6 * u, h * 0.34);
  ctx.fillStyle = "#ffe2a8";
  ctx.beginPath();
  ctx.moveTo(lx - 30 * u, fy - h * 0.33);
  ctx.lineTo(lx + 30 * u, fy - h * 0.33);
  ctx.lineTo(lx + 18 * u, fy - h * 0.42);
  ctx.lineTo(lx - 18 * u, fy - h * 0.42);
  ctx.fill();
  ctx.fillStyle = rgba(palette.secondary, 0.35);
  ctx.beginPath();
  ctx.ellipse(w * 0.5, fy + h * 0.1, w * 0.3, h * 0.05, 0, 0, TAU);
  ctx.fill();
  const sxx = w * 0.04;
  const sw = w * 0.24;
  const sofa = mixHex(palette.secondary, "#8a8fa8", 0.4);
  box(ctx, sxx, fy - h * 0.16, sw, h * 0.1, 16 * u, sofa);
  box(ctx, sxx - 10 * u, fy - h * 0.1, sw + 20 * u, h * 0.08, 14 * u, mixHex(sofa, "#000000", 0.08));
  plant(ctx, w * 0.34, fy, h * 0.14, T, "#e8e2d8");
  drawDog(ctx, w * 0.82, fy + h * 0.12, h * 0.09, T, "#d9a066", -1);
}

function shop(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#fff8f0", "#f7ebdc"], ["#e2d3bf", "#d3c1a8"], u);
  // A striped awning band across the top.
  const sw = 60 * u;
  for (let x = 0; x < w; x += sw) {
    ctx.fillStyle = Math.round(x / sw) % 2 ? "#ffffff" : palette.primary;
    ctx.fillRect(x, 0, sw, h * 0.07);
    ctx.beginPath();
    ctx.arc(x + sw / 2, h * 0.07, sw / 2, 0, Math.PI);
    ctx.fill();
  }
  // Shelves of colourful products at both sides.
  const shelves = (x: number, sw2: number) => {
    box(ctx, x, h * 0.2, sw2, fy - h * 0.2, 6 * u, "#c79b74");
    const colors = brandColors(palette);
    for (let r = 0; r < 4; r++) {
      const y = h * 0.22 + r * (fy - h * 0.24) / 4;
      box(ctx, x + 6 * u, y + (fy - h * 0.24) / 4 - 10 * u, sw2 - 12 * u, 6 * u, 2 * u, "#a57b57");
      for (let i = 0; i < 5; i++) box(ctx, x + 10 * u + i * (sw2 - 20 * u) / 5, y + 10 * u, (sw2 - 20 * u) / 5 - 6 * u, (fy - h * 0.24) / 4 - 24 * u, 4 * u, colors[(i + r * 2) % colors.length]);
    }
  };
  shelves(w * 0.03, w * 0.2);
  shelves(w * 0.77, w * 0.2);
  // Hanging lights, over the shelves (clear of the headline).
  for (const x of [w * 0.13, w * 0.87]) {
    ctx.fillStyle = "#4a5165";
    ctx.fillRect(x - 1.5 * u, h * 0.07, 3 * u, h * 0.08);
    ctx.beginPath();
    ctx.arc(x, h * 0.16, 22 * u, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "rgba(255,226,140,0.5)";
    ctx.beginPath();
    ctx.arc(x, h * 0.165, 10 * u + Math.sin(T * 2) * u, 0, TAU);
    ctx.fill();
  }
}

function cafe(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f7ede4", "#efdfd0"], ["#b88b67", "#a67a57"], u);
  // A soft brick pattern on the wall.
  ctx.fillStyle = "rgba(200,120,90,0.12)";
  for (let y = 0, row = 0; y < fy - 10 * u; y += 26 * u, row++) for (let x = (row % 2) * -30 * u; x < w; x += 60 * u) ctx.fillRect(x + 2 * u, y + 2 * u, 56 * u, 22 * u);
  // A menu board (framed prints when a slide brings its own board) and a pendant lamp.
  const mx = w * 0.06;
  if (bare) {
    box(ctx, mx, h * 0.16, w * 0.08, h * 0.12, 4 * u, "#c79b74");
    box(ctx, mx + 5 * u, h * 0.16 + 5 * u, w * 0.08 - 10 * u, h * 0.12 - 10 * u, 2 * u, mixHex(palette.primary, "#ffffff", 0.55));
    box(ctx, mx + w * 0.1, h * 0.2, w * 0.07, h * 0.09, 4 * u, "#c79b74");
    box(ctx, mx + w * 0.1 + 5 * u, h * 0.2 + 5 * u, w * 0.07 - 10 * u, h * 0.09 - 10 * u, 2 * u, mixHex(palette.accent, "#ffffff", 0.5));
  } else {
    box(ctx, mx, h * 0.14, w * 0.18, h * 0.3, 8 * u, mixHex("#3a3f4c", palette.primary, 0.18));
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (let i = 0; i < 4; i++) box(ctx, mx + 16 * u, h * (0.19 + i * 0.06), w * 0.18 - 32 * u - (i % 2) * 30 * u, 6 * u, 3 * u, "rgba(255,255,255,0.7)");
  }
  // (At the side, clear of the headline.)
  for (const x of [w * 0.93]) {
    ctx.fillStyle = "#3a3f4c";
    ctx.fillRect(x - 1.5 * u, 0, 3 * u, h * 0.12);
    ctx.beginPath();
    ctx.moveTo(x - 24 * u, h * 0.15);
    ctx.lineTo(x + 24 * u, h * 0.15);
    ctx.lineTo(x + 10 * u, h * 0.12);
    ctx.lineTo(x - 10 * u, h * 0.12);
    ctx.fill();
    ctx.fillStyle = "rgba(255,220,140,0.85)";
    ctx.beginPath();
    ctx.arc(x, h * 0.155, 7 * u, 0, Math.PI);
    ctx.fill();
  }
  // A counter with a coffee machine and a cup giving off steam.
  const cx = w * 0.72;
  const cw = w * 0.26;
  box(ctx, cx, fy - h * 0.16, cw, h * 0.16, 6 * u, "#8a5f44");
  box(ctx, cx - 6 * u, fy - h * 0.17, cw + 12 * u, h * 0.02, 4 * u, "#e9dccb");
  box(ctx, cx + cw * 0.12, fy - h * 0.3, cw * 0.3, h * 0.13, 8 * u, "#b8bec9");
  box(ctx, cx + cw * 0.17, fy - h * 0.26, cw * 0.2, h * 0.03, 4 * u, palette.primary);
  const cupX = cx + cw * 0.62;
  box(ctx, cupX, fy - h * 0.22, 30 * u, 28 * u, 6 * u, "#ffffff");
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 3 * u;
  ctx.lineCap = "round";
  for (let k = 0; k < 2; k++) {
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const f = i / 12;
      const x = cupX + 9 * u + k * 12 * u + Math.sin(f * 6 + T * 3 + k) * 4 * u;
      const y = fy - h * 0.23 - f * h * 0.08;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  plant(ctx, w * 0.3, fy, h * 0.15, T, "#d9cbb8");
}


/* ───────────────────────── Homes ───────────────────────── */

/**
 * A friendly cartoon dog, side on, standing on `groundY` and facing right (`dir` −1: left), `s`
 * tall. Its tail wags and it breathes on the video's clock; `walk` (a phase) trots its legs.
 */
export function drawDog(ctx: C, x: number, groundY: number, s: number, T: number, coat = "#d9a066", dir = 1, walk?: number) {
  const dark = mixHex(coat, "#000000", 0.28);
  const light = mixHex(coat, "#ffffff", 0.55);
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(dir, 1);
  ctx.lineCap = "round";
  ctx.fillStyle = "rgba(20,10,40,0.14)";
  ctx.beginPath();
  ctx.ellipse(0, s * 0.02, s * 0.6, s * 0.06, 0, 0, TAU);
  ctx.fill();
  const breathe = Math.sin(T * 3) * s * 0.01;
  // Legs (the far pair darker), the tail, then the body and head.
  for (const [lx, far] of [[-0.32, true], [0.3, true], [-0.24, false], [0.38, false]] as const) {
    const ph = walk === undefined ? 0 : Math.sin(walk + (lx > 0 ? 0 : Math.PI) + (far ? Math.PI : 0)) * s * 0.08;
    ctx.strokeStyle = far ? dark : coat;
    ctx.lineWidth = s * 0.11;
    ctx.beginPath();
    ctx.moveTo(lx * s, -s * 0.42);
    ctx.lineTo(lx * s + ph, -s * 0.06);
    ctx.stroke();
  }
  const wag = Math.sin(T * 9) * 0.5;
  ctx.strokeStyle = coat;
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, -s * 0.55);
  ctx.quadraticCurveTo(-s * 0.6, -s * 0.7, -s * 0.58 - Math.sin(wag) * s * 0.12, -s * 0.9 + Math.abs(wag) * s * 0.05);
  ctx.stroke();
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.52 - breathe, s * 0.46, s * 0.2 + breathe, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(s * 0.08, -s * 0.42, s * 0.26, s * 0.08, 0, 0, TAU);
  ctx.fill();
  // Head with a snout, a floppy ear, an eye and a nose; a collar in the brand's colour.
  const hx = s * 0.46;
  const hy = -s * 0.82 - breathe;
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.arc(hx, hy, s * 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(hx + s * 0.17, hy + s * 0.06, s * 0.13, s * 0.09, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(hx - s * 0.08, hy + s * 0.04, s * 0.08, s * 0.17, 0.35 + Math.sin(T * 9) * 0.06, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#1d1b26";
  ctx.beginPath();
  ctx.arc(hx + s * 0.3, hy + s * 0.03, s * 0.045, 0, TAU);
  ctx.fill();
  const blink = (T * 0.7) % 3 < 0.08;
  if (blink) ctx.fillRect(hx + s * 0.04, hy - s * 0.04, s * 0.06, s * 0.012);
  else {
    ctx.beginPath();
    ctx.arc(hx + s * 0.07, hy - s * 0.04, s * 0.03, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = brand?.primary ?? "#e0524c";
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.arc(hx - s * 0.02, hy + s * 0.02, s * 0.2, 1.7, 2.6);
  ctx.stroke();
  ctx.restore();
}

/** A kitchen: cabinets in the brand's colour, a hob with a steaming pot, a sink and a fridge. */
function kitchen(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f7f4ee", "#efe9df"], ["#cfc6b8", "#bdb3a3"], u);
  // A tiled splashback band and a window over the sink.
  const counterY = fy - h * 0.2;
  ctx.fillStyle = rgba(mixHex(palette.primary, "#ffffff", 0.7), 0.55);
  ctx.fillRect(0, counterY - h * 0.16, w, h * 0.16);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2 * u;
  for (let x = 0; x < w; x += 30 * u) {
    ctx.beginPath();
    ctx.moveTo(x, counterY - h * 0.16);
    ctx.lineTo(x, counterY);
    ctx.stroke();
  }
  for (let y = counterY - h * 0.16; y < counterY; y += 22 * u) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const port = h > w;
  windowPane(ctx, w * 0.4, h * 0.1, port ? w * 0.3 : w * 0.2, h * 0.2, u, T);
  // Upper cabinets in the brand's colour at the sides, with handles.
  const cab = mixHex(palette.primary, "#ffffff", 0.35);
  for (const [x0, cw] of [[w * 0.02, w * 0.3], [w * 0.68, w * 0.3]] as const) {
    for (let i = 0; i < 3; i++) {
      box(ctx, x0 + (i * cw) / 3 + 3 * u, h * 0.1, cw / 3 - 6 * u, h * 0.17, 6 * u, cab);
      box(ctx, x0 + (i * cw) / 3 + cw / 6 - 10 * u, h * 0.24, 20 * u, 4 * u, 2 * u, "#ffffff");
    }
  }
  // The counter run: base cabinets, a worktop, a hob with a steaming pot, a sink and a fridge.
  box(ctx, 0, counterY, w * 0.84, fy - counterY, 0, mixHex(cab, "#000000", 0.08));
  for (let x = 0; x < w * 0.84; x += w * 0.12) box(ctx, x + w * 0.05, counterY + h * 0.05, 26 * u, 5 * u, 2 * u, "#ffffff");
  box(ctx, 0, counterY - 10 * u, w * 0.86, 14 * u, 4 * u, "#f3efe8");
  const hob = w * 0.18;
  box(ctx, hob, counterY - 14 * u, w * 0.1, 6 * u, 2 * u, "#3a3f4c");
  box(ctx, hob + w * 0.015, counterY - 14 * u - h * 0.07, w * 0.07, h * 0.07, 8 * u, "#9aa3b2");
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3 * u;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const f = i / 10;
      const x = hob + w * 0.03 + k * w * 0.016 + Math.sin(f * 6 + T * 3 + k) * 4 * u;
      const y = counterY - 14 * u - h * 0.08 - f * h * 0.08;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  box(ctx, w * 0.46, counterY - 6 * u, w * 0.12, 8 * u, 3 * u, "#b8bfcc");
  ctx.fillStyle = "#9aa3b2";
  ctx.fillRect(w * 0.515, counterY - h * 0.07, 5 * u, h * 0.065);
  ctx.fillRect(w * 0.515, counterY - h * 0.07, 22 * u, 5 * u);
  const fx = w * 0.86;
  box(ctx, fx, fy - h * 0.52, w * 0.12, h * 0.52, 10 * u, "#e9edf3");
  ctx.fillStyle = "#c9d0da";
  ctx.fillRect(fx, fy - h * 0.32, w * 0.12, 3 * u);
  box(ctx, fx + 10 * u, fy - h * 0.48, 6 * u, h * 0.1, 3 * u, "#9aa3b2");
  box(ctx, fx + 10 * u, fy - h * 0.28, 6 * u, h * 0.12, 3 * u, "#9aa3b2");
  // Pendant lights and a fruit bowl.
  for (const x of [w * 0.34, w * 0.6]) {
    ctx.fillStyle = "#3a3f4c";
    ctx.fillRect(x - 1.5 * u, 0, 3 * u, h * 0.06);
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(x, h * 0.075, 18 * u, Math.PI, 0);
    ctx.fill();
  }
  box(ctx, w * 0.66, counterY - 26 * u, 46 * u, 16 * u, 8 * u, "#ffffff");
  for (const [dx, col] of [[8, "#f2b632"], [22, "#e0524c"], [36, "#7fbf5a"]] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(w * 0.66 + dx * u, counterY - 28 * u, 7 * u, 0, TAU);
    ctx.fill();
  }
}

function bedroom(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f1eef8", "#e6e1f1"], ["#d6b896", "#c7a682"], u);
  const port = h > w;
  windowPane(ctx, w * 0.06, h * 0.12, port ? w * 0.3 : w * 0.17, h * 0.3, u, T);
  // Pictures over the bed, a bed with a headboard, pillows and a blanket in the brand's colour.
  const bx = w * 0.5;
  const bw = port ? w * 0.6 : w * 0.34;
  box(ctx, bx - w * 0.08, h * 0.15, w * 0.07, h * 0.1, 4 * u, "#c79b74");
  box(ctx, bx - w * 0.075, h * 0.16, w * 0.06, h * 0.08, 3 * u, mixHex(palette.secondary, "#ffffff", 0.5));
  box(ctx, bx + w * 0.01, h * 0.15, w * 0.07, h * 0.1, 4 * u, "#c79b74");
  box(ctx, bx + w * 0.015, h * 0.16, w * 0.06, h * 0.08, 3 * u, mixHex(palette.accent, "#ffffff", 0.5));
  const hb = mixHex(palette.secondary, "#6b5a7a", 0.45);
  box(ctx, bx - bw / 2, fy - h * 0.32, bw, h * 0.2, 18 * u, hb);
  box(ctx, bx - bw / 2 - 6 * u, fy - h * 0.15, bw + 12 * u, h * 0.1, 10 * u, "#ffffff");
  box(ctx, bx - bw * 0.42, fy - h * 0.2, bw * 0.3, h * 0.06, 12 * u, "#ffffff");
  box(ctx, bx + bw * 0.12, fy - h * 0.2, bw * 0.3, h * 0.06, 12 * u, "#ffffff");
  box(ctx, bx - bw / 2 - 6 * u, fy - h * 0.14, bw + 12 * u, h * 0.09, 10 * u, palette.primary);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(bx - bw / 2 - 6 * u, fy - h * 0.12, bw + 12 * u, 5 * u);
  ctx.fillStyle = "#8a6a4c";
  ctx.fillRect(bx - bw / 2, fy - h * 0.05, 8 * u, h * 0.05);
  ctx.fillRect(bx + bw / 2 - 8 * u, fy - h * 0.05, 8 * u, h * 0.05);
  // Nightstands with a lamp that glows softly, and a plant.
  for (const s2 of [-1, 1]) {
    const nx = bx + s2 * (bw / 2 + w * 0.06);
    box(ctx, nx - w * 0.035, fy - h * 0.12, w * 0.07, h * 0.12, 6 * u, "#c79b74");
    if (s2 < 0) {
      ctx.fillStyle = "#6b5a4c";
      ctx.fillRect(nx - 2 * u, fy - h * 0.2, 4 * u, h * 0.08);
      ctx.fillStyle = "#ffe2a8";
      ctx.beginPath();
      ctx.moveTo(nx - 20 * u, fy - h * 0.19);
      ctx.lineTo(nx + 20 * u, fy - h * 0.19);
      ctx.lineTo(nx + 12 * u, fy - h * 0.25);
      ctx.lineTo(nx - 12 * u, fy - h * 0.25);
      ctx.fill();
      ctx.fillStyle = `rgba(255,226,140,${0.18 + Math.sin(T * 1.5) * 0.04})`;
      ctx.beginPath();
      ctx.arc(nx, fy - h * 0.2, 60 * u, 0, TAU);
      ctx.fill();
    } else box(ctx, nx - 14 * u, fy - h * 0.16, 28 * u, h * 0.04, 4 * u, mixHex(palette.primary, "#ffffff", 0.5));
  }
  plant(ctx, w * 0.9, fy, h * 0.16, T, "#e8e2d8");
  ctx.fillStyle = rgba(palette.secondary, 0.3);
  ctx.beginPath();
  ctx.ellipse(bx, fy + h * 0.1, bw * 0.7, h * 0.045, 0, 0, TAU);
  ctx.fill();
}

function bathroom(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#eef6f8", "#e2eef1"], ["#c9d6da", "#b7c7cc"], u);
  // Tiles on the lower wall.
  const tileTop = h * 0.4;
  ctx.fillStyle = rgba(mixHex(palette.primary, "#ffffff", 0.6), 0.5);
  ctx.fillRect(0, tileTop, w, fy - tileTop);
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2 * u;
  for (let x = 0; x < w; x += 34 * u) {
    ctx.beginPath();
    ctx.moveTo(x, tileTop);
    ctx.lineTo(x, fy);
    ctx.stroke();
  }
  for (let y = tileTop; y < fy; y += 34 * u) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // A bathtub with bubbles that drift up, and a shower head.
  const tx = w * 0.04;
  const tw = h > w ? w * 0.5 : w * 0.32;
  const ty = fy - h * 0.16;
  ctx.fillStyle = "#9aa3b2";
  ctx.fillRect(tx + tw * 0.12, h * 0.2, 5 * u, ty - h * 0.2);
  box(ctx, tx + tw * 0.12 - 14 * u, h * 0.2, 34 * u, 10 * u, 5 * u, "#9aa3b2");
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  const r = rng(31);
  for (let i = 0; i < 14; i++) {
    const bx = tx + r() * tw;
    const rise = ((T * 0.25 + r()) % 1) * h * 0.08;
    ctx.beginPath();
    ctx.arc(bx, ty - 4 * u - rise * (i % 3 === 0 ? 1 : 0.2), (6 + r() * 12) * u, 0, TAU);
    ctx.fill();
  }
  box(ctx, tx, ty, tw, h * 0.13, 18 * u, "#ffffff");
  ctx.fillStyle = "#e3e8ee";
  ctx.fillRect(tx + 10 * u, ty + h * 0.1, tw - 20 * u, 4 * u);
  ctx.fillStyle = "#c9a26b";
  ctx.fillRect(tx + 16 * u, fy - h * 0.03, 8 * u, h * 0.03);
  ctx.fillRect(tx + tw - 24 * u, fy - h * 0.03, 8 * u, h * 0.03);
  // A vanity with a sink, a round mirror, a towel in the brand's colour and a plant.
  const vx = w * 0.62;
  const vw = w * 0.2;
  box(ctx, vx, fy - h * 0.16, vw, h * 0.16, 8 * u, mixHex(palette.secondary, "#8a6a4c", 0.5));
  box(ctx, vx - 6 * u, fy - h * 0.18, vw + 12 * u, h * 0.025, 5 * u, "#ffffff");
  box(ctx, vx + vw * 0.3, fy - h * 0.2, vw * 0.4, h * 0.025, 8 * u, "#e9edf3");
  ctx.fillStyle = "#9aa3b2";
  ctx.fillRect(vx + vw / 2 - 2 * u, fy - h * 0.25, 4 * u, h * 0.05);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(vx + vw / 2, h * 0.27, Math.min(w, h) * 0.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = skyT("#d9eef7");
  ctx.beginPath();
  ctx.arc(vx + vw / 2, h * 0.27, Math.min(w, h) * 0.088, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(vx + vw / 2 - Math.min(w, h) * 0.04, h * 0.22, 6 * u, Math.min(w, h) * 0.06);
  const rx = w * 0.88;
  ctx.fillStyle = "#9aa3b2";
  ctx.fillRect(rx - 30 * u, h * 0.36, 60 * u, 4 * u);
  box(ctx, rx - 24 * u, h * 0.36, 48 * u, h * 0.16, 6 * u, palette.primary);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(rx - 24 * u, h * 0.47, 48 * u, 4 * u);
  plant(ctx, w * 0.93, fy, h * 0.13, T, "#ffffff");
}

/**
 * A custom-built home outside: two storeys with a gable roof, big windows, a front door and a
 * garage, built up to `p` (0 → 1: the slab, the frame, walls and windows, the roof and the
 * finishing touches). `W` is its width, standing on `groundY`.
 */
export function drawHouse(ctx: C, cx: number, groundY: number, W: number, p: number, T: number, pal: Palette, u: number) {
  const H = W * 0.62;
  const left = cx - W / 2;
  const body = W * 0.68;
  const gx = left + body;
  const wall = mixHex(pal.primary, "#ffffff", 0.82);
  const trim = mixHex(pal.primary, "#1d1b26", 0.35);
  const roof = mixHex(pal.primary, "#2a2633", 0.25);
  const k = (a: number, b: number) => clamp((p - a) / (b - a));
  // 1. The slab.
  const slab = k(0, 0.18);
  if (slab > 0) box(ctx, left - W * 0.02, groundY - W * 0.025, (W + W * 0.04) * slab, W * 0.025, 3 * u, "#b9b2a8");
  // 2. The frame: studs rising.
  const frame = k(0.15, 0.42);
  const walls = k(0.38, 0.66);
  const roofK = k(0.6, 0.85);
  const finish = k(0.82, 1);
  const top = groundY - H * 0.7;
  if (frame > 0 && walls < 1) {
    ctx.strokeStyle = "#c79b74";
    ctx.lineWidth = Math.max(2, W * 0.008);
    const studs = 10;
    for (let i = 0; i <= studs; i++) {
      const x = left + (body * i) / studs;
      const hh = (groundY - top) * clamp(frame * 1.4 - (i / studs) * 0.4);
      ctx.beginPath();
      ctx.moveTo(x, groundY - W * 0.025);
      ctx.lineTo(x, groundY - W * 0.025 - hh);
      ctx.stroke();
    }
    for (const yy of [top, (top + groundY) / 2]) {
      if (frame < 0.8) continue;
      ctx.beginPath();
      ctx.moveTo(left, yy);
      ctx.lineTo(left + body, yy);
      ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const x = gx + ((W - body) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x, groundY - W * 0.025);
      ctx.lineTo(x, groundY - W * 0.025 - (groundY - top) * 0.55 * frame);
      ctx.stroke();
    }
  }
  // 3. Walls and windows, cladding up from the ground.
  if (walls > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(left - W * 0.05, groundY - (groundY - top + W * 0.05) * walls, W * 1.1, (groundY - top + W * 0.05) * walls + 2);
    ctx.clip();
    box(ctx, left, top, body, groundY - top - W * 0.025, 4 * u, wall);
    const gTop = groundY - (groundY - top) * 0.55;
    box(ctx, gx, gTop, W - body, groundY - gTop - W * 0.025, 4 * u, mixHex(wall, "#000000", 0.04));
    // Garage door with panels.
    box(ctx, gx + (W - body) * 0.12, gTop + (groundY - gTop) * 0.22, (W - body) * 0.76, (groundY - gTop) * 0.7, 4 * u, "#e9edf3");
    ctx.fillStyle = "#cfd6e0";
    for (let i = 1; i < 4; i++) ctx.fillRect(gx + (W - body) * 0.12, gTop + (groundY - gTop) * (0.22 + i * 0.17), (W - body) * 0.76, 2 * u);
    // Windows (warm light inside) and the front door in the brand's colour.
    const win = (x: number, y: number, ww: number, wh: number) => {
      box(ctx, x - 4 * u, y - 4 * u, ww + 8 * u, wh + 8 * u, 4 * u, trim);
      box(ctx, x, y, ww, wh, 2 * u, mixHex("#ffe2a8", "#bfe3ff", 0.5 + Math.sin(T * 0.6 + x) * 0.1));
      ctx.fillStyle = trim;
      ctx.fillRect(x + ww / 2 - 1.5 * u, y, 3 * u, wh);
    };
    const fh = (groundY - top) / 2;
    win(left + body * 0.1, top + fh * 0.22, body * 0.3, fh * 0.52);
    win(left + body * 0.58, top + fh * 0.22, body * 0.3, fh * 0.52);
    win(left + body * 0.08, top + fh * 1.2, body * 0.4, fh * 0.55);
    box(ctx, left + body * 0.62, top + fh * 1.12, body * 0.2, fh * 0.86 - W * 0.025, 4 * u, pal.primary);
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(left + body * 0.79, top + fh * 1.6, 3.5 * u, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // 4. The roof drops into place.
  if (roofK > 0) {
    const drop = (1 - ease.outCubic(roofK)) * -W * 0.25;
    ctx.save();
    ctx.globalAlpha *= clamp(roofK * 3);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(left - W * 0.04, top + drop);
    ctx.lineTo(left + body / 2, top - H * 0.36 + drop);
    ctx.lineTo(left + body + W * 0.04, top + drop);
    ctx.closePath();
    ctx.fill();
    const gTop = groundY - (groundY - top) * 0.55;
    ctx.fillRect(gx - W * 0.01, gTop - W * 0.03 + drop, W - body + W * 0.04, W * 0.035);
    ctx.fillStyle = mixHex(roof, "#ffffff", 0.15);
    ctx.fillRect(left + body * 0.7, top - H * 0.3 + drop, body * 0.08, H * 0.18);
    ctx.restore();
  }
  // 5. Finishing touches: a path, a hedge, a tree and a light over the door.
  if (finish > 0) {
    ctx.save();
    ctx.globalAlpha *= finish;
    ctx.fillStyle = "#e6dccb";
    ctx.beginPath();
    ctx.moveTo(left + body * 0.64, groundY);
    ctx.lineTo(left + body * 0.8, groundY);
    ctx.lineTo(left + body * 0.86, groundY + W * 0.06);
    ctx.lineTo(left + body * 0.58, groundY + W * 0.06);
    ctx.fill();
    ctx.fillStyle = "#5fb36f";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(left + body * (0.05 + i * 0.1), groundY - W * 0.02, W * 0.035, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** The house outside, on a lawn under the sky, with the dog in the garden. */
function house(sc: SkillContext) {
  const { ctx, w, h, u, seed, palette } = sc;
  const T = sc.globalT ?? sc.t;
  sky(ctx, w, h, T, u, seed);
  const ground = h * 0.76;
  // Distant hills, the lawn, a fence and trees.
  ctx.fillStyle = mixHex("#bfe3b0", palette.secondary, 0.1);
  ctx.beginPath();
  ctx.ellipse(w * 0.2, ground, w * 0.4, h * 0.12, 0, Math.PI, 0);
  ctx.ellipse(w * 0.85, ground, w * 0.35, h * 0.1, 0, Math.PI, 0);
  ctx.fill();
  const lawn = ctx.createLinearGradient(0, ground, 0, h);
  lawn.addColorStop(0, "#8fd17a");
  lawn.addColorStop(1, "#6fbf62");
  ctx.fillStyle = lawn;
  ctx.fillRect(0, ground, w, h - ground);
  const port = h > w;
  const HW = port ? w * 0.7 : w * 0.36;
  const hx = port ? w * 0.5 : w * 0.3;
  drawHouse(ctx, hx, ground, HW, 1, T, palette, u);
  ctx.fillStyle = "#ffffff";
  for (let x = hx + HW * 0.55; x < w; x += 22 * u) box(ctx, x, ground - h * 0.06, 10 * u, h * 0.06, 4 * u, "#ffffff");
  ctx.fillRect(hx + HW * 0.55, ground - h * 0.045, w, 5 * u);
  for (const tx of [w * 0.06, w * 0.93]) {
    ctx.fillStyle = "#8a5a3b";
    ctx.fillRect(tx - 5 * u, ground - h * 0.14, 10 * u, h * 0.14);
    ctx.fillStyle = "#4caf6a";
    ctx.beginPath();
    ctx.arc(tx + Math.sin(T + tx) * 2 * u, ground - h * 0.2, h * 0.08, 0, TAU);
    ctx.fill();
  }
  drawDog(ctx, w * (port ? 0.78 : 0.62), ground + h * 0.08, h * 0.09, T, "#d9a066", -1);
}


/* ───────────────────────── Local businesses ───────────────────────── */

/** A pendant lamp hanging from the top at `x`, with a warm glow. */
function pendant(ctx: C, x: number, h: number, u: number, T: number, drop = 0.12) {
  ctx.fillStyle = "#3a3f4c";
  ctx.fillRect(x - 1.5 * u, 0, 3 * u, h * drop);
  ctx.beginPath();
  ctx.arc(x, h * (drop + 0.03), 22 * u, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = `rgba(255,222,140,${0.55 + Math.sin(T * 2 + x) * 0.05})`;
  ctx.beginPath();
  ctx.arc(x, h * (drop + 0.035), 10 * u, 0, TAU);
  ctx.fill();
}

/** A barber shop or hair salon: mirror stations with bulbs, a chair, a turning barber pole, products. */
function salon(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#fbf3f2", "#f2e3e1"], ["#efe9e4", "#e2dad2"], u);
  // A checkerboard floor.
  const tile = 46 * u;
  ctx.fillStyle = "rgba(40,40,52,0.16)";
  for (let y = fy, r = 0; y < h; y += tile, r++) for (let x = (r % 2) * tile; x < w; x += tile * 2) ctx.fillRect(x, y, tile, tile);
  // Mirror stations with bulbs round them, and a chair in front of the first.
  for (const x of [w * 0.03, w * 0.16]) {
    const mw = w * 0.11;
    const mh = h * 0.34;
    const my = h * 0.18;
    box(ctx, x - 6 * u, my - 6 * u, mw + 12 * u, mh + 12 * u, 14 * u, "#d8c3a5");
    const g = ctx.createLinearGradient(x, my, x + mw, my + mh);
    g.addColorStop(0, "#dff1f7");
    g.addColorStop(1, "#b8d6e2");
    box(ctx, x, my, mw, mh, 10 * u, g as unknown as string);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.moveTo(x + mw * 0.2, my);
    ctx.lineTo(x + mw * 0.45, my);
    ctx.lineTo(x + mw * 0.1, my + mh);
    ctx.lineTo(x - mw * 0.05, my + mh);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "rgba(255,236,170,0.95)";
      ctx.beginPath();
      ctx.arc(x - 3 * u, my + mh * (0.12 + i * 0.25), 6 * u, 0, TAU);
      ctx.arc(x + mw + 3 * u, my + mh * (0.12 + i * 0.25), 6 * u, 0, TAU);
      ctx.fill();
    }
    box(ctx, x - 4 * u, my + mh + 14 * u, mw + 8 * u, 10 * u, 4 * u, "#c8b49a");
  }
  // The barber chair.
  const cx = w * 0.1;
  box(ctx, cx - 8 * u, fy - h * 0.02, 16 * u, h * 0.02, 2 * u, "#9aa0ad");
  box(ctx, cx - w * 0.04, fy - h * 0.03, w * 0.08, 10 * u, 5 * u, "#8a909c");
  box(ctx, cx - w * 0.045, fy - h * 0.11, w * 0.09, h * 0.06, 10 * u, palette.primary);
  box(ctx, cx - w * 0.04, fy - h * 0.2, w * 0.08, h * 0.1, 12 * u, mixHex(palette.primary, "#000000", 0.15));
  // A barber pole with turning stripes.
  const px = w * 0.93;
  const pw = 26 * u;
  const py = h * 0.16;
  const ph = h * 0.26;
  box(ctx, px - pw / 2 - 4 * u, py - 14 * u, pw + 8 * u, 14 * u, 6 * u, "#c9ccd4");
  box(ctx, px - pw / 2 - 4 * u, py + ph, pw + 8 * u, 14 * u, 6 * u, "#c9ccd4");
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px - pw / 2, py, pw, ph, 8 * u);
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(px - pw / 2, py, pw, ph);
  const off = (T * 40 * u) % (36 * u);
  for (let y = py - 72 * u + off, i = 0; y < py + ph + 36 * u; y += 18 * u, i++) {
    ctx.fillStyle = i % 2 ? "#d7263d" : "#2b59c3";
    ctx.beginPath();
    ctx.moveTo(px - pw / 2, y);
    ctx.lineTo(px + pw / 2, y - 22 * u);
    ctx.lineTo(px + pw / 2, y - 14 * u);
    ctx.lineTo(px - pw / 2, y + 8 * u);
    ctx.fill();
  }
  ctx.restore();
  // A shelf of products in the brand's colours.
  const colors = brandColors(palette);
  box(ctx, w * 0.78, h * 0.5, w * 0.12, 8 * u, 3 * u, "#b48a66");
  for (let i = 0; i < 5; i++) box(ctx, w * 0.785 + i * w * 0.023, h * 0.5 - (26 + (i % 2) * 10) * u, w * 0.016, (26 + (i % 2) * 10) * u, 4 * u, colors[i % colors.length]);
  plant(ctx, w * 0.84, fy, h * 0.14, T, "#e8d8c8");
}

/** A restaurant dining room: panelled walls, tables laid with cloths and candles, pendant lamps, framed art. */
function restaurant(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f6ebdf", "#ead7c4"], ["#9a6b4b", "#85583b"], u);
  // Wood panelling on the lower wall.
  box(ctx, 0, fy - h * 0.2, w, h * 0.2, 0, mixHex(wallT("#c9a27e"), "#000000", 0.05));
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  for (let x = 20 * u; x < w; x += 90 * u) ctx.fillRect(x, fy - h * 0.18, 70 * u, h * 0.15);
  box(ctx, 0, fy - h * 0.205, w, 8 * u, 0, "#a87b57");
  // Framed art on the wall, at the sides.
  for (const [x, c] of [[w * 0.05, palette.primary], [w * 0.86, palette.accent]] as const) {
    box(ctx, x, h * 0.16, w * 0.09, h * 0.14, 4 * u, "#8a6142");
    box(ctx, x + 6 * u, h * 0.16 + 6 * u, w * 0.09 - 12 * u, h * 0.14 - 12 * u, 2 * u, mixHex(c, "#ffffff", 0.5));
    ctx.fillStyle = mixHex(c, "#000000", 0.1);
    ctx.beginPath();
    ctx.arc(x + w * 0.045, h * 0.25, h * 0.03, Math.PI, 0);
    ctx.fill();
  }
  // Tables with cloths, plates and a flickering candle, with pendant lamps above.
  for (const x of [w * 0.12, w * 0.88]) {
    pendant(ctx, x, h, u, T, 0.36);
    const tw = w * 0.14;
    box(ctx, x - tw / 2, fy - h * 0.15, tw, h * 0.05, 8 * u, "#ffffff");
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x - tw / 2, fy - h * 0.11);
    ctx.lineTo(x + tw / 2, fy - h * 0.11);
    ctx.lineTo(x + tw / 2 + 6 * u, fy - h * 0.05);
    ctx.lineTo(x - tw / 2 - 6 * u, fy - h * 0.05);
    ctx.fill();
    box(ctx, x - 4 * u, fy - h * 0.06, 8 * u, h * 0.06, 2 * u, "#6b4a33");
    for (const dx of [-0.28, 0.28]) {
      ctx.fillStyle = "#f2f2f2";
      ctx.beginPath();
      ctx.ellipse(x + tw * dx, fy - h * 0.152, tw * 0.13, 5 * u, 0, 0, TAU);
      ctx.fill();
    }
    box(ctx, x - 4 * u, fy - h * 0.19, 8 * u, h * 0.04, 2 * u, "#fff6e0");
    ctx.fillStyle = "rgba(255,190,90,0.95)";
    ctx.beginPath();
    ctx.ellipse(x, fy - h * 0.2 - Math.sin(T * 9 + x) * u, 4 * u, 8 * u, 0, 0, TAU);
    ctx.fill();
    // Chairs either side.
    for (const dx of [-1, 1]) {
      const chx = x + dx * (tw / 2 + 22 * u);
      box(ctx, chx - 14 * u, fy - h * 0.2, 28 * u, h * 0.13, 6 * u, mixHex(palette.secondary, "#4a3424", 0.55));
      box(ctx, chx - 18 * u, fy - h * 0.08, 36 * u, 10 * u, 4 * u, mixHex(palette.secondary, "#4a3424", 0.45));
      box(ctx, chx - 14 * u, fy - h * 0.07, 5 * u, h * 0.07, 2 * u, "#4a3424");
      box(ctx, chx + 9 * u, fy - h * 0.07, 5 * u, h * 0.07, 2 * u, "#4a3424");
    }
  }
}

/** A bakery: bread shelves with loaves, a tiled wall, a glass display case of cakes and pastries. */
function bakery(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#fff6ea", "#f6e6d0"], ["#d9c2a3", "#c9ae8b"], u);
  // White tiles behind the shelves.
  ctx.strokeStyle = "rgba(170,140,110,0.18)";
  ctx.lineWidth = 1.5 * u;
  for (let y = h * 0.14; y < fy - h * 0.02; y += 24 * u) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w * 0.26, y);
    ctx.moveTo(w * 0.74, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // Bread shelves on the left: loaves and baguettes.
  for (let r = 0; r < 3; r++) {
    const y = h * (0.26 + r * 0.14);
    box(ctx, w * 0.02, y, w * 0.22, 8 * u, 3 * u, "#a87b57");
    for (let i = 0; i < 4; i++) {
      const x = w * 0.04 + i * w * 0.05;
      ctx.fillStyle = ["#c98a4b", "#b5733a", "#d9a066", "#a8642f"][(i + r) % 4];
      ctx.beginPath();
      if ((i + r) % 3 === 0) ctx.ellipse(x + w * 0.015, y - 9 * u, w * 0.024, 9 * u, -0.2, 0, TAU);
      else ctx.ellipse(x + w * 0.015, y - 14 * u, w * 0.02, 14 * u, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,240,210,0.6)";
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.006, y - 14 * u);
      ctx.lineTo(x + w * 0.012, y - 20 * u);
      ctx.moveTo(x + w * 0.018, y - 14 * u);
      ctx.lineTo(x + w * 0.024, y - 20 * u);
      ctx.stroke();
    }
  }
  // A glass display case on the right with cakes in the brand's colours.
  const cx = w * 0.72;
  const cw = w * 0.26;
  box(ctx, cx, fy - h * 0.2, cw, h * 0.2, 8 * u, "#e9d9c4");
  box(ctx, cx + 8 * u, fy - h * 0.19, cw - 16 * u, h * 0.12, 6 * u, "rgba(220,240,250,0.85)");
  const colors = brandColors(palette);
  for (let i = 0; i < 4; i++) {
    const x = cx + 24 * u + i * (cw - 48 * u) / 4;
    box(ctx, x, fy - h * 0.12, (cw - 48 * u) / 4 - 10 * u, h * 0.045, 6 * u, colors[i % colors.length]);
    box(ctx, x, fy - h * 0.13, (cw - 48 * u) / 4 - 10 * u, h * 0.014, 4 * u, "#fff8ee");
    ctx.fillStyle = "#d7263d";
    ctx.beginPath();
    ctx.arc(x + ((cw - 48 * u) / 4 - 10 * u) / 2, fy - h * 0.138, 4 * u, 0, TAU);
    ctx.fill();
  }
  box(ctx, cx - 4 * u, fy - h * 0.21, cw + 8 * u, 10 * u, 4 * u, "#c9a27e");
  pendant(ctx, w * 0.85, h, u, T, 0.1);
  clock(ctx, w * 0.8, h * 0.28, 28 * u, T, u);
}

/** An auto repair garage: a roll-up door, a car, a tyre stack and a pegboard of tools. */
function garage(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#eef1f5", "#dde2ea"], ["#bfc4cc", "#aab0ba"], u);
  // Yellow bay lines on the floor.
  ctx.fillStyle = "rgba(245,190,40,0.8)";
  ctx.fillRect(w * 0.02, fy + h * 0.06, w * 0.3, 6 * u);
  ctx.fillRect(w * 0.68, fy + h * 0.06, w * 0.3, 6 * u);
  // A roll-up door (slats) behind the car, on the left.
  box(ctx, w * 0.02, h * 0.14, w * 0.3, fy - h * 0.14, 6 * u, "#c8cdd6");
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  for (let y = h * 0.16; y < fy; y += 18 * u) ctx.fillRect(w * 0.025, y, w * 0.29, 3 * u);
  // A car side on, in the brand's main colour.
  const cx = w * 0.17;
  const cy = fy + h * 0.02;
  const cw = w * 0.26;
  const body = palette.primary;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(cx - cw / 2, cy - h * 0.11, cw, h * 0.08, 14 * u);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - cw * 0.3, cy - h * 0.11);
  ctx.quadraticCurveTo(cx - cw * 0.18, cy - h * 0.19, cx, cy - h * 0.19);
  ctx.quadraticCurveTo(cx + cw * 0.2, cy - h * 0.19, cx + cw * 0.3, cy - h * 0.11);
  ctx.fill();
  ctx.fillStyle = "rgba(220,240,250,0.9)";
  ctx.beginPath();
  ctx.moveTo(cx - cw * 0.24, cy - h * 0.115);
  ctx.quadraticCurveTo(cx - cw * 0.14, cy - h * 0.175, cx - cw * 0.02, cy - h * 0.175);
  ctx.lineTo(cx - cw * 0.02, cy - h * 0.115);
  ctx.moveTo(cx + cw * 0.02, cy - h * 0.115);
  ctx.lineTo(cx + cw * 0.02, cy - h * 0.175);
  ctx.quadraticCurveTo(cx + cw * 0.16, cy - h * 0.175, cx + cw * 0.24, cy - h * 0.115);
  ctx.fill();
  for (const dx of [-0.3, 0.3]) {
    ctx.fillStyle = "#2b2f38";
    ctx.beginPath();
    ctx.arc(cx + cw * dx, cy - h * 0.03, h * 0.042, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#c9ccd4";
    ctx.beginPath();
    ctx.arc(cx + cw * dx, cy - h * 0.03, h * 0.018, 0, TAU);
    ctx.fill();
  }
  // A stack of tyres.
  for (let i = 0; i < 3; i++) box(ctx, w * 0.36, fy - h * (0.06 + i * 0.055), w * 0.06, h * 0.05, 14 * u, i % 2 ? "#30343e" : "#3a3f4b");
  // A pegboard of tools on the right.
  box(ctx, w * 0.74, h * 0.16, w * 0.22, h * 0.3, 6 * u, "#d8b98f");
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  for (let y = h * 0.18; y < h * 0.45; y += 16 * u) for (let x = w * 0.75; x < w * 0.95; x += 16 * u) ctx.fillRect(x, y, 3 * u, 3 * u);
  ctx.strokeStyle = "#4a5165";
  ctx.lineWidth = 6 * u;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const x = w * (0.77 + i * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, h * 0.22);
    ctx.lineTo(x, h * 0.36 - (i % 2) * h * 0.04);
    ctx.stroke();
    ctx.fillStyle = [palette.primary, "#e0a030", "#4a5165", palette.accent][i];
    ctx.beginPath();
    ctx.arc(x, h * 0.22, 9 * u, 0, TAU);
    ctx.fill();
  }
  box(ctx, w * 0.76, fy - h * 0.16, w * 0.2, h * 0.16, 6 * u, mixHex(palette.secondary, "#3a3f4c", 0.5));
  for (let i = 0; i < 3; i++) box(ctx, w * 0.77, fy - h * (0.145 - i * 0.05), w * 0.18, h * 0.035, 3 * u, mixHex(palette.secondary, "#ffffff", 0.2));
}

/** A gym: mirrors, a swinging punching bag, a dumbbell rack and kettlebells on rubber flooring. */
function gym(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#eef0f4", "#dfe3ea"], ["#4a4f5c", "#3d424e"], u);
  // A brand-coloured stripe along the wall.
  box(ctx, 0, h * 0.5, w, 12 * u, 0, palette.primary);
  // A punching bag on the left, swinging gently.
  const bx = w * 0.12;
  const sw = Math.sin(T * 1.6) * 0.05;
  ctx.save();
  ctx.translate(bx, h * 0.04);
  ctx.rotate(sw);
  ctx.strokeStyle = "#5a5f6b";
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, h * 0.18);
  ctx.stroke();
  box(ctx, -w * 0.035, h * 0.18, w * 0.07, h * 0.34, 18 * u, mixHex(palette.primary, "#000000", 0.25));
  box(ctx, -w * 0.035, h * 0.24, w * 0.07, 8 * u, 0, "rgba(255,255,255,0.35)");
  box(ctx, -w * 0.035, h * 0.44, w * 0.07, 8 * u, 0, "rgba(255,255,255,0.35)");
  ctx.restore();
  // A dumbbell rack on the right.
  box(ctx, w * 0.72, fy - h * 0.16, w * 0.25, 10 * u, 3 * u, "#2b2f38");
  box(ctx, w * 0.72, fy - h * 0.08, w * 0.25, 10 * u, 3 * u, "#2b2f38");
  box(ctx, w * 0.73, fy - h * 0.16, 8 * u, h * 0.16, 2 * u, "#2b2f38");
  box(ctx, w * 0.95, fy - h * 0.16, 8 * u, h * 0.16, 2 * u, "#2b2f38");
  for (const row of [0.16, 0.08]) for (let i = 0; i < 5; i++) {
    const x = w * (0.75 + i * 0.043);
    const r = (10 + i * 1.5) * u;
    ctx.fillStyle = "#1f2229";
    ctx.beginPath();
    ctx.arc(x, fy - h * row - r, r, 0, TAU);
    ctx.arc(x + w * 0.022, fy - h * row - r, r, 0, TAU);
    ctx.fill();
    box(ctx, x, fy - h * row - r - 3 * u, w * 0.022, 6 * u, 2 * u, "#8a909c");
  }
  // Kettlebells on the floor.
  for (let i = 0; i < 3; i++) {
    const x = w * (0.3 + i * 0.05);
    ctx.fillStyle = [palette.primary, palette.accent, "#2b2f38"][i];
    ctx.beginPath();
    ctx.arc(x, fy + h * 0.06, 16 * u, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 5 * u;
    ctx.beginPath();
    ctx.arc(x, fy + h * 0.035, 10 * u, Math.PI, 0);
    ctx.stroke();
  }
  // Wall mirrors at the sides, high up.
  for (const x of [w * 0.24, w * 0.66]) box(ctx, x, h * 0.16, w * 0.1, h * 0.28, 6 * u, "rgba(200,225,238,0.75)");
}

/** A yoga or dance studio: a wood floor, a mirror wall with a barre, a window, rolled mats and plants. */
function yoga(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f6f3fb", "#ebe5f4"], ["#e2c8a4", "#d2b28a"], u);
  // Floorboards.
  ctx.strokeStyle = "rgba(120,80,40,0.16)";
  ctx.lineWidth = 2 * u;
  for (let x = 0; x < w; x += 70 * u) {
    ctx.beginPath();
    ctx.moveTo(x, fy);
    ctx.lineTo(x - (x - w / 2) * 0.35, h);
    ctx.stroke();
  }
  // A tall window on the left.
  windowPane(ctx, w * 0.04, h * 0.14, w * 0.14, h * 0.38, u, T);
  // A mirror wall on the right with a barre.
  box(ctx, w * 0.72, h * 0.12, w * 0.26, fy - h * 0.14, 6 * u, "rgba(205,225,238,0.8)");
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.moveTo(w * 0.76, h * 0.12);
  ctx.lineTo(w * 0.82, h * 0.12);
  ctx.lineTo(w * 0.74, fy - h * 0.02);
  ctx.lineTo(w * 0.72, fy - h * 0.02);
  ctx.fill();
  box(ctx, w * 0.7, h * 0.48, w * 0.3, 8 * u, 4 * u, "#c79b74");
  for (const x of [w * 0.74, w * 0.94]) box(ctx, x, h * 0.48, 6 * u, h * 0.05, 2 * u, "#a87b57");
  // Rolled mats in a basket, in the brand's colours.
  const colors = brandColors(palette);
  box(ctx, w * 0.2, fy - h * 0.1, w * 0.08, h * 0.1, 8 * u, "#c9a87c");
  for (let i = 0; i < 4; i++) box(ctx, w * (0.205 + i * 0.018), fy - h * 0.2, w * 0.016, h * 0.12, 6 * u, colors[i % colors.length]);
  plant(ctx, w * 0.66, fy, h * 0.16, T, "#ffffff");
}

/** A flower shop: buckets of flowers swaying, hanging plants and a wrapping counter. */
function florist(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#eff8f2", "#e0efe5"], ["#d7a98a", "#c79474"], u);
  const colors = [palette.primary, mixHex(palette.secondary, "#ffffff", 0.1), palette.accent, "#ffd166", "#ff8fab", "#ffffff"];
  // Buckets of flowers at both sides, on two tiers.
  const bucket = (x: number, y: number, s: number, k: number) => {
    const sway = Math.sin(T * 1.4 + x * 0.01) * s * 0.06;
    ctx.strokeStyle = "#4caf6a";
    ctx.lineWidth = 3 * u;
    for (let i = 0; i < 5; i++) {
      const fx = x + (i - 2) * s * 0.16 + sway;
      const fyy = y - s * (0.75 + (i % 2) * 0.18);
      ctx.beginPath();
      ctx.moveTo(x + (i - 2) * s * 0.06, y);
      ctx.lineTo(fx, fyy);
      ctx.stroke();
      ctx.fillStyle = colors[(i + k) % colors.length];
      for (let p = 0; p < 5; p++) {
        ctx.beginPath();
        ctx.arc(fx + Math.cos((p / 5) * TAU) * s * 0.06, fyy + Math.sin((p / 5) * TAU) * s * 0.06, s * 0.055, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(fx, fyy, s * 0.04, 0, TAU);
      ctx.fill();
    }
    box(ctx, x - s * 0.24, y - s * 0.05, s * 0.48, s * 0.42, s * 0.06, "#9aa5b1");
    box(ctx, x - s * 0.26, y - s * 0.07, s * 0.52, s * 0.06, s * 0.03, "#b8c0ca");
  };
  const s = h * 0.2;
  box(ctx, w * 0.01, fy - h * 0.2, w * 0.27, 10 * u, 3 * u, "#b48a66");
  box(ctx, w * 0.72, fy - h * 0.2, w * 0.27, 10 * u, 3 * u, "#b48a66");
  [0.05, 0.14, 0.23].forEach((f, i) => bucket(w * f, fy - h * 0.2, s * 0.8, i));
  [0.77, 0.86, 0.95].forEach((f, i) => bucket(w * f, fy - h * 0.2, s * 0.8, i + 3));
  [0.08, 0.2].forEach((f, i) => bucket(w * f, fy + h * 0.04, s, i + 1));
  [0.82, 0.93].forEach((f, i) => bucket(w * f, fy + h * 0.04, s, i + 4));
  // Hanging plants at the top corners.
  for (const x of [w * 0.06, w * 0.94]) {
    ctx.strokeStyle = "#8a6142";
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h * 0.08);
    ctx.stroke();
    plant(ctx, x, h * 0.16, h * 0.1, T, "#e9c9a8");
  }
}

/** A bookstore: tall shelves of colourful spines at both sides, a ladder, a reading chair and a lamp. */
function bookstore(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f6efe4", "#ecdfcc"], ["#a8794f", "#93653f"], u);
  const spines = [...brandColors(palette), "#8a5a44", "#3d5a80", "#e0c27a", "#5b8c5a", "#c26a5a"];
  const shelf = (x: number, sw: number) => {
    box(ctx, x, h * 0.08, sw, fy - h * 0.08, 6 * u, "#7a5236");
    const rows = 5;
    const rh = (fy - h * 0.12) / rows;
    const r = rng(Math.round(x));
    for (let k = 0; k < rows; k++) {
      const y = h * 0.1 + k * rh;
      box(ctx, x + 6 * u, y + rh - 8 * u, sw - 12 * u, 6 * u, 2 * u, "#5c3c27");
      let bxx = x + 10 * u;
      while (bxx < x + sw - 20 * u) {
        const bw = (8 + r() * 10) * u;
        const bh = rh - (14 + r() * 18) * u;
        box(ctx, bxx, y + rh - 8 * u - bh, bw, bh, 2 * u, spines[Math.floor(r() * spines.length)]);
        bxx += bw + 2 * u;
      }
    }
  };
  shelf(w * 0.02, w * 0.22);
  shelf(w * 0.76, w * 0.22);
  // A rolling ladder against the right shelves.
  ctx.strokeStyle = "#c79b74";
  ctx.lineWidth = 6 * u;
  ctx.beginPath();
  ctx.moveTo(w * 0.79, h * 0.12);
  ctx.lineTo(w * 0.76, fy);
  ctx.moveTo(w * 0.84, h * 0.12);
  ctx.lineTo(w * 0.81, fy);
  for (let i = 1; i < 7; i++) {
    const f = i / 7;
    ctx.moveTo(w * (0.79 - 0.03 * f), h * 0.12 + f * (fy - h * 0.12));
    ctx.lineTo(w * (0.84 - 0.03 * f), h * 0.12 + f * (fy - h * 0.12));
  }
  ctx.stroke();
  // A reading chair and a floor lamp at the left.
  box(ctx, w * 0.27, fy - h * 0.16, w * 0.09, h * 0.16, 14 * u, mixHex(palette.primary, "#5a3a2a", 0.4));
  box(ctx, w * 0.26, fy - h * 0.09, w * 0.11, h * 0.07, 12 * u, mixHex(palette.primary, "#5a3a2a", 0.3));
  ctx.fillStyle = "#3a3f4c";
  ctx.fillRect(w * 0.39, fy - h * 0.32, 4 * u, h * 0.32);
  ctx.beginPath();
  ctx.moveTo(w * 0.39 - 22 * u, fy - h * 0.32);
  ctx.lineTo(w * 0.39 + 26 * u, fy - h * 0.32);
  ctx.lineTo(w * 0.39 + 14 * u, fy - h * 0.38);
  ctx.lineTo(w * 0.39 - 10 * u, fy - h * 0.38);
  ctx.fill();
  ctx.fillStyle = `rgba(255,222,140,${0.35 + Math.sin(T * 2) * 0.04})`;
  ctx.beginPath();
  ctx.moveTo(w * 0.39 - 22 * u, fy - h * 0.32);
  ctx.lineTo(w * 0.39 + 26 * u, fy - h * 0.32);
  ctx.lineTo(w * 0.39 + 60 * u, fy - h * 0.16);
  ctx.lineTo(w * 0.39 - 56 * u, fy - h * 0.16);
  ctx.fill();
}

/** A hotel or inn lobby: a marble floor, a reception desk with a bell, palms and a luggage cart. */
function hotel(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f6f0e6", "#e9dfd1"], ["#ece7df", "#d9d1c5"], u);
  // A marble sheen on the floor.
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let x = 0; x < w; x += 120 * u) ctx.fillRect(x, fy, 2 * u, h - fy);
  ctx.fillRect(0, fy + h * 0.1, w, 2 * u);
  // Wall sconces at the sides.
  for (const x of [w * 0.3, w * 0.7]) {
    box(ctx, x - 6 * u, h * 0.2, 12 * u, 26 * u, 4 * u, "#c9a227");
    ctx.fillStyle = `rgba(255,222,140,${0.4 + Math.sin(T * 2 + x) * 0.05})`;
    ctx.beginPath();
    ctx.arc(x, h * 0.2, 24 * u, 0, TAU);
    ctx.fill();
  }
  // The reception desk on the right with a bell and a key board behind.
  box(ctx, w * 0.78, h * 0.16, w * 0.18, h * 0.22, 6 * u, "#8a6142");
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    box(ctx, w * (0.795 + c * 0.04), h * (0.19 + r * 0.06), w * 0.025, h * 0.04, 3 * u, "#6b4a33");
    ctx.fillStyle = "#e0c27a";
    ctx.beginPath();
    ctx.arc(w * (0.807 + c * 0.04), h * (0.205 + r * 0.06), 3 * u, 0, TAU);
    ctx.fill();
  }
  box(ctx, w * 0.7, fy - h * 0.17, w * 0.3, h * 0.17, 8 * u, mixHex(palette.primary, "#5a3a2a", 0.55));
  box(ctx, w * 0.69, fy - h * 0.185, w * 0.32, h * 0.02, 4 * u, "#efe6d6");
  ctx.fillStyle = "#c9a227";
  ctx.beginPath();
  ctx.arc(w * 0.76, fy - h * 0.185, 12 * u, Math.PI, 0);
  ctx.fill();
  // A luggage cart on the left with suitcases in the brand's colours.
  const lx = w * 0.12;
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 4 * u;
  ctx.beginPath();
  ctx.moveTo(lx - w * 0.06, fy - h * 0.3);
  ctx.quadraticCurveTo(lx, fy - h * 0.38, lx + w * 0.06, fy - h * 0.3);
  ctx.moveTo(lx - w * 0.06, fy - h * 0.3);
  ctx.lineTo(lx - w * 0.06, fy - h * 0.02);
  ctx.moveTo(lx + w * 0.06, fy - h * 0.3);
  ctx.lineTo(lx + w * 0.06, fy - h * 0.02);
  ctx.stroke();
  box(ctx, lx - w * 0.07, fy - h * 0.03, w * 0.14, 8 * u, 3 * u, "#c9a227");
  const colors = brandColors(palette);
  box(ctx, lx - w * 0.05, fy - h * 0.13, w * 0.1, h * 0.1, 8 * u, colors[0]);
  box(ctx, lx - w * 0.04, fy - h * 0.21, w * 0.07, h * 0.08, 8 * u, colors[2]);
  for (const dx of [-0.05, 0.05]) {
    ctx.fillStyle = "#3a3f4c";
    ctx.beginPath();
    ctx.arc(lx + w * dx, fy + 4 * u, 8 * u, 0, TAU);
    ctx.fill();
  }
  plant(ctx, w * 0.3, fy, h * 0.2, T, "#c9a227");
  plant(ctx, w * 0.64, fy, h * 0.18, T, "#c9a227");
}

/** An Asian restaurant: red paper lanterns swaying, a lattice window, round tables and bamboo. */
function asian(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f7ece0", "#ecdcc8"], ["#7a3b2e", "#652f24"], u);
  // A dark wood rail and a lattice window on each side.
  box(ctx, 0, fy - h * 0.2, w, 8 * u, 0, "#5a2a20");
  for (const x of [w * 0.04, w * 0.82]) {
    const ww = w * 0.14;
    const wh = h * 0.3;
    const wy = h * 0.16;
    box(ctx, x - 6 * u, wy - 6 * u, ww + 12 * u, wh + 12 * u, 6 * u, "#5a2a20");
    box(ctx, x, wy, ww, wh, 4 * u, "rgba(255,236,200,0.9)");
    ctx.strokeStyle = "#5a2a20";
    ctx.lineWidth = 4 * u;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (ww * i) / 4, wy);
      ctx.lineTo(x + (ww * i) / 4, wy + wh);
      ctx.moveTo(x, wy + (wh * i) / 4);
      ctx.lineTo(x + ww, wy + (wh * i) / 4);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x + ww / 2, wy + wh / 2, Math.min(ww, wh) * 0.22, 0, TAU);
    ctx.stroke();
  }
  // Red paper lanterns along the top, swaying, with gold tassels and a warm glow.
  for (let i = 0; i < 7; i++) {
    const x = w * (0.06 + i * 0.148);
    if (x > w * 0.3 && x < w * 0.7 && i % 2) continue;
    const drop = h * (0.06 + (i % 3) * 0.035);
    const sw = Math.sin(T * 1.2 + i) * 0.06;
    ctx.save();
    ctx.translate(x, 0);
    ctx.rotate(sw);
    ctx.strokeStyle = "#3a2a20";
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, drop);
    ctx.stroke();
    const lw = 34 * u;
    const lh = 42 * u;
    const glow = ctx.createRadialGradient(0, drop + lh / 2, 0, 0, drop + lh / 2, lw * 1.6);
    glow.addColorStop(0, "rgba(255,120,80,0.35)");
    glow.addColorStop(1, "rgba(255,120,80,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-lw * 1.6, drop + lh / 2 - lw * 1.6, lw * 3.2, lw * 3.2);
    ctx.fillStyle = "#d62828";
    ctx.beginPath();
    ctx.ellipse(0, drop + lh / 2, lw / 2, lh / 2, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,20,20,0.45)";
    ctx.lineWidth = 1.5 * u;
    for (const k of [-0.25, 0, 0.25]) {
      ctx.beginPath();
      ctx.ellipse(0, drop + lh / 2, (lw / 2) * Math.abs(k) * 2 || 1, lh / 2, 0, 0, TAU);
      ctx.stroke();
    }
    box(ctx, -lw * 0.28, drop - 3 * u, lw * 0.56, 7 * u, 2 * u, "#f2b705");
    box(ctx, -lw * 0.28, drop + lh - 4 * u, lw * 0.56, 7 * u, 2 * u, "#f2b705");
    ctx.fillStyle = "#f2b705";
    ctx.fillRect(-1.5 * u, drop + lh + 3 * u, 3 * u, 16 * u);
    ctx.restore();
  }
  // Round tables with bowls and chopsticks at the sides.
  for (const x of [w * 0.14, w * 0.86]) {
    ctx.fillStyle = "#4a2219";
    ctx.beginPath();
    ctx.ellipse(x, fy - h * 0.1, w * 0.07, h * 0.022, 0, 0, TAU);
    ctx.fill();
    box(ctx, x - 5 * u, fy - h * 0.1, 10 * u, h * 0.1, 3 * u, "#3a1a14");
    for (const dx of [-0.03, 0.03]) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x + w * dx, fy - h * 0.115, 10 * u, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = palette.primary;
      ctx.fillRect(x + w * dx - 10 * u, fy - h * 0.118, 20 * u, 3 * u);
    }
  }
  // Bamboo in tall planters.
  for (const x of [w * 0.3, w * 0.7]) {
    ctx.strokeStyle = "#6a994e";
    ctx.lineWidth = 6 * u;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(x + k * 10 * u, fy - h * 0.08);
      ctx.lineTo(x + k * 16 * u + Math.sin(T + k) * 3 * u, fy - h * 0.42);
      ctx.stroke();
    }
    ctx.fillStyle = "#8ab17d";
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.ellipse(x + (k % 2 ? 18 : -18) * u, fy - h * (0.2 + k * 0.04), 16 * u, 5 * u, k % 2 ? 0.5 : -0.5, 0, TAU);
      ctx.fill();
    }
    box(ctx, x - 22 * u, fy - h * 0.08, 44 * u, h * 0.08, 6 * u, "#2b2d42");
  }
}

/** An antique shop: a grandfather clock, an armoire, framed pictures, a gramophone and lamps. */
function antique(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#efe3cf", "#e0cfb3"], ["#7a5236", "#6a4630"], u);
  // A gallery wall of gilt frames at both sides.
  const frames: [number, number, number, number][] = [[0.03, 0.14, 0.07, 0.1], [0.11, 0.12, 0.06, 0.14], [0.04, 0.27, 0.05, 0.07], [0.84, 0.13, 0.08, 0.11], [0.93, 0.15, 0.05, 0.07], [0.86, 0.28, 0.06, 0.08]];
  frames.forEach(([fx, fyy, fw, fh], i) => {
    box(ctx, w * fx, h * fyy, w * fw, h * fh, 3 * u, "#b8902f");
    box(ctx, w * fx + 5 * u, h * fyy + 5 * u, w * fw - 10 * u, h * fh - 10 * u, 2 * u, [mixHex(palette.primary, "#d9c9a8", 0.6), "#5f7a6a", "#8a6142", mixHex(palette.accent, "#d9c9a8", 0.6)][i % 4]);
  });
  // A grandfather clock with a swinging pendulum.
  const gx = w * 0.2;
  box(ctx, gx - w * 0.035, fy - h * 0.5, w * 0.07, h * 0.5, 6 * u, "#5c3c27");
  ctx.fillStyle = "#f3ead7";
  ctx.beginPath();
  ctx.arc(gx, fy - h * 0.42, w * 0.024, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#3a2a20";
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(gx, fy - h * 0.42);
  ctx.lineTo(gx + Math.sin(T) * w * 0.015, fy - h * 0.435);
  ctx.stroke();
  box(ctx, gx - w * 0.022, fy - h * 0.34, w * 0.044, h * 0.2, 4 * u, "rgba(240,220,170,0.25)");
  const a = Math.sin(T * 2.4) * 0.35;
  ctx.strokeStyle = "#b8902f";
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.moveTo(gx, fy - h * 0.33);
  ctx.lineTo(gx + Math.sin(a) * h * 0.14, fy - h * 0.33 + Math.cos(a) * h * 0.14);
  ctx.stroke();
  ctx.fillStyle = "#b8902f";
  ctx.beginPath();
  ctx.arc(gx + Math.sin(a) * h * 0.14, fy - h * 0.33 + Math.cos(a) * h * 0.14, 9 * u, 0, TAU);
  ctx.fill();
  // An armoire on the right with a gramophone and a lamp on the side table.
  box(ctx, w * 0.8, fy - h * 0.4, w * 0.13, h * 0.4, 6 * u, "#6b4a33");
  box(ctx, w * 0.81, fy - h * 0.37, w * 0.05, h * 0.3, 4 * u, "#7d5a3f");
  box(ctx, w * 0.87, fy - h * 0.37, w * 0.05, h * 0.3, 4 * u, "#7d5a3f");
  box(ctx, w * 0.66, fy - h * 0.12, w * 0.12, h * 0.02, 3 * u, "#5c3c27");
  box(ctx, w * 0.67, fy - h * 0.1, 6 * u, h * 0.1, 2 * u, "#5c3c27");
  box(ctx, w * 0.77 - 6 * u, fy - h * 0.1, 6 * u, h * 0.1, 2 * u, "#5c3c27");
  box(ctx, w * 0.685, fy - h * 0.16, w * 0.04, h * 0.04, 4 * u, "#3a2a20");
  ctx.fillStyle = "#b8902f";
  ctx.beginPath();
  ctx.moveTo(w * 0.705, fy - h * 0.16);
  ctx.lineTo(w * 0.69, fy - h * 0.27);
  ctx.quadraticCurveTo(w * 0.72, fy - h * 0.3, w * 0.75, fy - h * 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mixHex(palette.primary, "#e9d8b0", 0.5);
  ctx.beginPath();
  ctx.moveTo(w * 0.755, fy - h * 0.25);
  ctx.lineTo(w * 0.79, fy - h * 0.25);
  ctx.lineTo(w * 0.78, fy - h * 0.29);
  ctx.lineTo(w * 0.765, fy - h * 0.29);
  ctx.fill();
  ctx.fillStyle = "rgba(255,222,140,0.4)";
  ctx.beginPath();
  ctx.arc(w * 0.772, fy - h * 0.25, 22 * u, 0, Math.PI);
  ctx.fill();
  // A worn rug.
  ctx.fillStyle = mixHex(palette.primary, "#8a3b2e", 0.6);
  ctx.beginPath();
  ctx.ellipse(w * 0.5, fy + h * 0.1, w * 0.22, h * 0.06, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(240,210,150,0.5)";
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, fy + h * 0.1, w * 0.19, h * 0.045, 0, 0, TAU);
  ctx.stroke();
}

/** A thrift shop: clothes racks of colourful garments, a mannequin, crates of records and a hand-lettered price tag look. */
function thrift(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f2f5f0", "#e3ebe1"], ["#c9b28f", "#b89e79"], u);
  const colors = [...brandColors(palette), "#e9c46a", "#2a9d8f", "#e76f51", "#8ab17d", "#b5838d"];
  // Clothes racks with hangers and swaying garments.
  const rack = (x: number, rw: number, seed: number) => {
    const ry = h * 0.3;
    ctx.fillStyle = "#5a5f6b";
    ctx.fillRect(x, ry, rw, 5 * u);
    ctx.fillRect(x, ry, 5 * u, fy - ry);
    ctx.fillRect(x + rw - 5 * u, ry, 5 * u, fy - ry);
    const r = rng(seed);
    for (let i = 0; i < 7; i++) {
      const gx = x + 16 * u + (i * (rw - 32 * u)) / 7;
      const gw = (rw - 32 * u) / 7 + 6 * u;
      const sw = Math.sin(T * 1.1 + i + seed) * 2 * u;
      ctx.strokeStyle = "#5a5f6b";
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(gx + gw / 2, ry);
      ctx.lineTo(gx + gw / 2, ry + 10 * u);
      ctx.stroke();
      const gh = h * (0.16 + r() * 0.12);
      ctx.fillStyle = colors[Math.floor(r() * colors.length)];
      ctx.beginPath();
      ctx.moveTo(gx + sw, ry + 12 * u);
      ctx.lineTo(gx + gw + sw, ry + 12 * u);
      ctx.lineTo(gx + gw + 4 * u + sw * 1.5, ry + 12 * u + gh);
      ctx.lineTo(gx - 4 * u + sw * 1.5, ry + 12 * u + gh);
      ctx.fill();
    }
  };
  rack(w * 0.02, w * 0.24, 7);
  rack(w * 0.74, w * 0.24, 13);
  // A mannequin in a patterned dress.
  const mx = w * 0.32;
  ctx.fillStyle = "#e9dcc7";
  ctx.beginPath();
  ctx.arc(mx, fy - h * 0.42, 14 * u, 0, TAU);
  ctx.fill();
  ctx.fillStyle = palette.primary;
  ctx.beginPath();
  ctx.moveTo(mx - 20 * u, fy - h * 0.38);
  ctx.lineTo(mx + 20 * u, fy - h * 0.38);
  ctx.lineTo(mx + 38 * u, fy - h * 0.14);
  ctx.lineTo(mx - 38 * u, fy - h * 0.14);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(mx - 20 * u + (i % 3) * 20 * u, fy - h * (0.3 - Math.floor(i / 3) * 0.08), 4 * u, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "#5a5f6b";
  ctx.fillRect(mx - 2 * u, fy - h * 0.14, 4 * u, h * 0.14);
  ctx.fillRect(mx - 18 * u, fy - 4 * u, 36 * u, 4 * u);
  // Crates of records and a stack of books on the right.
  for (let i = 0; i < 2; i++) {
    const cx = w * (0.62 + i * 0.07);
    box(ctx, cx, fy - h * 0.09, w * 0.06, h * 0.09, 3 * u, "#c79b74");
    for (let k = 0; k < 5; k++) box(ctx, cx + 4 * u + k * w * 0.011, fy - h * 0.13, w * 0.009, h * 0.06, 1 * u, ["#2b2d42", colors[k % colors.length]][k % 2]);
  }
  // A hand-painted sign shape with a hanger icon (no words).
  box(ctx, w * 0.44, h * 0.08, w * 0.12, h * 0.05, 8 * u, mixHex(palette.secondary, "#ffffff", 0.3));
  ctx.strokeStyle = "#3a3f4c";
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.moveTo(w * 0.47, h * 0.115);
  ctx.lineTo(w * 0.5, h * 0.095);
  ctx.lineTo(w * 0.53, h * 0.115);
  ctx.closePath();
  ctx.stroke();
}

/** A guitar side on: body, sound hole, neck and head, in `color`, `s` tall, standing on `y`. */
function guitar(ctx: C, x: number, y: number, s: number, color: string, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.16, s * 0.15, s * 0.16, 0, 0, TAU);
  ctx.ellipse(0, -s * 0.38, s * 0.11, s * 0.12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.arc(0, -s * 0.3, s * 0.045, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#4a3424";
  ctx.fillRect(-s * 0.02, -s * 0.92, s * 0.04, s * 0.5);
  ctx.fillRect(-s * 0.035, -s * 1.0, s * 0.07, s * 0.1);
  ctx.restore();
}

/** A music shop: a wall of guitars, amps, a drum kit, vinyl crates and a neon note. */
function music(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#2f2b3a", "#26222f"], ["#5a3d2b", "#4a3223"], u);
  // Acoustic panels on the wall.
  for (let x = w * 0.02; x < w; x += w * 0.08) for (let y = h * 0.14; y < h * 0.5; y += h * 0.12) box(ctx, x, y, w * 0.07, h * 0.1, 4 * u, "rgba(255,255,255,0.035)");
  // A wall of guitars on both sides, gently swaying on their hooks.
  const colors = [palette.primary, "#d9a066", "#c1121f", palette.accent, "#2b2d42", "#e9c46a"];
  [0.04, 0.1, 0.16, 0.22].forEach((f, i) => guitar(ctx, w * f, h * 0.56, h * 0.36, colors[i % colors.length], Math.sin(T * 0.8 + i) * 0.02));
  [0.78, 0.84, 0.9, 0.96].forEach((f, i) => guitar(ctx, w * f, h * 0.56, h * 0.36, colors[(i + 2) % colors.length], Math.sin(T * 0.8 + i + 2) * 0.02));
  // Amps along the floor.
  for (const x of [w * 0.03, w * 0.15, w * 0.8]) {
    box(ctx, x, fy - h * 0.13, w * 0.1, h * 0.13, 4 * u, "#1d1b24");
    box(ctx, x + 6 * u, fy - h * 0.11, w * 0.1 - 12 * u, h * 0.08, 3 * u, "#3a3646");
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = "#c9a227";
      ctx.beginPath();
      ctx.arc(x + 14 * u + k * 12 * u, fy - h * 0.122, 3 * u, 0, TAU);
      ctx.fill();
    }
  }
  // A drum kit, centre right, low.
  const dx = w * 0.67;
  ctx.fillStyle = palette.primary;
  ctx.beginPath();
  ctx.arc(dx, fy - h * 0.07, h * 0.07, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#f3f0e8";
  ctx.beginPath();
  ctx.arc(dx, fy - h * 0.07, h * 0.05, 0, TAU);
  ctx.fill();
  ctx.fillStyle = mixHex(palette.primary, "#000000", 0.2);
  ctx.fillRect(dx - w * 0.06, fy - h * 0.17, w * 0.04, h * 0.05);
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.moveTo(dx + w * 0.03, fy);
  ctx.lineTo(dx + w * 0.05, fy - h * 0.22);
  ctx.stroke();
  ctx.fillStyle = "#e0b84a";
  ctx.beginPath();
  ctx.ellipse(dx + w * 0.05, fy - h * 0.22, w * 0.03, 5 * u, -0.15, 0, TAU);
  ctx.fill();
  // A neon note on the wall, softly pulsing.
  const pulse = 0.75 + 0.25 * Math.sin(T * 2.2);
  ctx.save();
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = 24 * u * pulse;
  ctx.strokeStyle = mixHex(palette.accent, "#ffffff", 0.3);
  ctx.lineWidth = 5 * u;
  const nx = w * 0.7;
  const ny = h * 0.2;
  ctx.beginPath();
  ctx.moveTo(nx, ny + 50 * u);
  ctx.lineTo(nx, ny);
  ctx.lineTo(nx + 44 * u, ny - 10 * u);
  ctx.lineTo(nx + 44 * u, ny + 40 * u);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(nx - 10 * u, ny + 52 * u, 11 * u, 0, TAU);
  ctx.arc(nx + 34 * u, ny + 42 * u, 11 * u, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** A phone and electronics repair shop: a workbench with a lamp, phones opened up, tools and parts drawers. */
function repair(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#eef3f7", "#dde6ee"], ["#c7ccd4", "#b5bbc5"], u);
  // A wall of phone cases and accessories on the left.
  const colors = brandColors(palette);
  box(ctx, w * 0.02, h * 0.14, w * 0.24, h * 0.4, 6 * u, "#d3d9e1");
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
    const x = w * (0.035 + c * 0.044);
    const y = h * (0.17 + r * 0.12);
    box(ctx, x, y, w * 0.032, h * 0.095, 6 * u, colors[(r * 5 + c) % colors.length]);
    box(ctx, x + w * 0.006, y + h * 0.008, w * 0.01, h * 0.018, 3 * u, "rgba(0,0,0,0.25)");
  }
  // The repair bench on the right: a mat, an opened phone, a magnifier lamp and tools.
  const bx = w * 0.66;
  box(ctx, bx, fy - h * 0.15, w * 0.32, h * 0.02, 3 * u, "#8a909c");
  box(ctx, bx + 6 * u, fy - h * 0.13, 8 * u, h * 0.13, 2 * u, "#6b717d");
  box(ctx, bx + w * 0.32 - 14 * u, fy - h * 0.13, 8 * u, h * 0.13, 2 * u, "#6b717d");
  box(ctx, bx + w * 0.02, fy - h * 0.165, w * 0.2, h * 0.016, 3 * u, mixHex(palette.primary, "#2a9d8f", 0.5));
  box(ctx, bx + w * 0.05, fy - h * 0.2, w * 0.04, h * 0.035, 5 * u, "#2b2f38");
  box(ctx, bx + w * 0.1, fy - h * 0.2, w * 0.04, h * 0.035, 5 * u, "#3a3f4b");
  ctx.fillStyle = "#7bdff2";
  ctx.fillRect(bx + w * 0.105, fy - h * 0.195, w * 0.03, h * 0.025);
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 2 * u;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(bx + w * (0.055 + k * 0.01), fy - h * 0.19);
    ctx.lineTo(bx + w * (0.06 + k * 0.01), fy - h * 0.175);
    ctx.stroke();
  }
  // The magnifier lamp, with its ring of light.
  ctx.strokeStyle = "#4a5165";
  ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.27, fy - h * 0.165);
  ctx.lineTo(bx + w * 0.26, fy - h * 0.34);
  ctx.lineTo(bx + w * 0.16, fy - h * 0.38);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,250,230,${0.65 + Math.sin(T * 3) * 0.03})`;
  ctx.beginPath();
  ctx.arc(bx + w * 0.14, fy - h * 0.36, 26 * u, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#4a5165";
  ctx.lineWidth = 6 * u;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,250,230,0.12)";
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.12, fy - h * 0.34);
  ctx.lineTo(bx + w * 0.16, fy - h * 0.34);
  ctx.lineTo(bx + w * 0.2, fy - h * 0.17);
  ctx.lineTo(bx + w * 0.06, fy - h * 0.17);
  ctx.fill();
  // Parts drawers above the bench.
  box(ctx, bx + w * 0.04, h * 0.14, w * 0.24, h * 0.18, 6 * u, "#c9ced6");
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    box(ctx, bx + w * (0.05 + c * 0.037), h * (0.155 + r * 0.055), w * 0.03, h * 0.042, 3 * u, "#eef2f6");
    box(ctx, bx + w * (0.058 + c * 0.037), h * (0.172 + r * 0.055), w * 0.014, 4 * u, 2 * u, colors[(r + c) % colors.length]);
  }
}

/** A church hall: arched stained-glass windows glowing, rows of pews, a lectern and candles. */
function church(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f4eee4", "#e6dccb"], ["#9b7653", "#86633f"], u);
  // Tall arched stained-glass windows, with coloured light falling across the floor.
  const glass = [palette.primary, "#e9c46a", "#2a9d8f", palette.accent, "#e76f51", "#7b9acc"];
  for (const x of [w * 0.05, w * 0.18, w * 0.75, w * 0.88]) {
    const ww = w * 0.08;
    const wy = h * 0.14;
    const wh = h * 0.36;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, wy + wh);
    ctx.lineTo(x, wy + ww / 2);
    ctx.arc(x + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0);
    ctx.lineTo(x + ww, wy + wh);
    ctx.closePath();
    ctx.fillStyle = "#5c4a3a";
    ctx.fill();
    ctx.clip();
    for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) {
      ctx.fillStyle = mixHex(glass[(r + c + Math.round(x)) % glass.length], "#ffffff", 0.25 + 0.08 * Math.sin(T * 0.8 + r + c));
      ctx.fillRect(x + c * ww / 2 + 2 * u, wy + r * wh / 6 + 2 * u, ww / 2 - 4 * u, wh / 6 - 4 * u);
    }
    ctx.restore();
    const beam = ctx.createLinearGradient(x, wy + wh, x + ww * 1.6, fy + h * 0.2);
    beam.addColorStop(0, rgba(glass[Math.round(x) % glass.length], 0.16));
    beam.addColorStop(1, rgba(glass[Math.round(x) % glass.length], 0));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x, wy + wh);
    ctx.lineTo(x + ww, wy + wh);
    ctx.lineTo(x + ww * 2.4, fy + h * 0.2);
    ctx.lineTo(x + ww * 0.6, fy + h * 0.2);
    ctx.fill();
  }
  // Rows of pews at both sides.
  for (const side of [-1, 1]) for (let r = 0; r < 3; r++) {
    const pw = w * (0.2 + r * 0.03);
    const px = side < 0 ? w * 0.02 - r * w * 0.01 : w * 0.98 - pw + r * w * 0.01;
    const py = fy - h * 0.08 + r * h * 0.07;
    box(ctx, px, py - h * 0.08, pw, h * 0.08, 6 * u, "#7a5236");
    box(ctx, px, py - h * 0.02, pw, h * 0.03, 4 * u, "#6a4630");
  }
  // A lectern and candles, low and central.
  box(ctx, w * 0.47, fy - h * 0.16, w * 0.06, h * 0.16, 4 * u, "#7a5236");
  box(ctx, w * 0.455, fy - h * 0.18, w * 0.09, h * 0.03, 4 * u, "#8a6142");
  for (const x of [w * 0.4, w * 0.6]) {
    box(ctx, x - 5 * u, fy - h * 0.12, 10 * u, h * 0.12, 3 * u, "#f3ead7");
    ctx.fillStyle = "rgba(255,190,90,0.95)";
    ctx.beginPath();
    ctx.ellipse(x, fy - h * 0.13 - Math.sin(T * 8 + x) * u, 4 * u, 9 * u, 0, 0, TAU);
    ctx.fill();
    const gl = ctx.createRadialGradient(x, fy - h * 0.13, 0, x, fy - h * 0.13, 40 * u);
    gl.addColorStop(0, "rgba(255,200,120,0.35)");
    gl.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = gl;
    ctx.fillRect(x - 40 * u, fy - h * 0.13 - 40 * u, 80 * u, 80 * u);
  }
}

/** Outdoors: the sky, soft hills and a lawn from `ground` down. */
function yard(ctx: C, w: number, h: number, T: number, u: number, seed: number, ground: number, pal: Palette) {
  sky(ctx, w, h, T, u, seed);
  ctx.fillStyle = mixHex("#bfe3b0", pal.secondary, 0.1);
  ctx.beginPath();
  ctx.ellipse(w * 0.2, ground, w * 0.4, h * 0.12, 0, Math.PI, 0);
  ctx.ellipse(w * 0.85, ground, w * 0.35, h * 0.1, 0, Math.PI, 0);
  ctx.fill();
  const lawn = ctx.createLinearGradient(0, ground, 0, h);
  lawn.addColorStop(0, "#8fd17a");
  lawn.addColorStop(1, "#6fbf62");
  ctx.fillStyle = lawn;
  ctx.fillRect(0, ground, w, h - ground);
}

/** A roofing job: a house half re-roofed (fresh shingles meeting old), a ladder, shingle bundles and a safety cone. */
function roofing(sc: SkillContext) {
  const { ctx, w, h, u, seed, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const ground = h * 0.76;
  yard(ctx, w, h, T, u, seed, ground, palette);
  const port = h > w;
  const HW = port ? w * 0.7 : w * 0.4;
  const hx = port ? w * 0.5 : w * 0.28;
  drawHouse(ctx, hx, ground, HW, 1, T, palette, u);
  // Fresh shingle rows over part of the roof, in the brand's dark tone, laid course by course.
  const roofTop = ground - HW * 0.95;
  const roofBase = ground - HW * 0.52;
  const done = 0.55 + 0.1 * Math.sin(T * 0.3);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(hx - HW * 0.58, roofBase);
  ctx.lineTo(hx, roofTop);
  ctx.lineTo(hx + HW * 0.58, roofBase);
  ctx.closePath();
  ctx.clip();
  const sh = mixHex(palette.primary, "#2b2f38", 0.6);
  for (let y = roofBase, r = 0; y > roofTop; y -= 12 * u, r++) {
    for (let x = hx - HW * 0.6 + (r % 2) * 10 * u; x < hx - HW * 0.6 + HW * 1.2 * done; x += 20 * u) box(ctx, x, y - 11 * u, 19 * u, 11 * u, 2 * u, r % 2 ? sh : mixHex(sh, "#000000", 0.12));
  }
  ctx.restore();
  // A ladder against the eaves.
  const lx = hx + HW * 0.52;
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.moveTo(lx, ground);
  ctx.lineTo(lx - HW * 0.06, roofBase - 10 * u);
  ctx.moveTo(lx + 22 * u, ground);
  ctx.lineTo(lx + 22 * u - HW * 0.06, roofBase - 10 * u);
  for (let i = 1; i < 8; i++) {
    const f = i / 8;
    const y = ground - f * (ground - roofBase + 10 * u);
    ctx.moveTo(lx - HW * 0.06 * f, y);
    ctx.lineTo(lx + 22 * u - HW * 0.06 * f, y);
  }
  ctx.stroke();
  // Shingle bundles on a pallet and a cone.
  const bx = port ? w * 0.1 : w * 0.66;
  box(ctx, bx, ground - 8 * u, w * 0.12, 8 * u, 2 * u, "#a87b57");
  for (let i = 0; i < 4; i++) box(ctx, bx + 4 * u, ground - 8 * u - (i + 1) * 14 * u, w * 0.12 - 8 * u, 12 * u, 3 * u, i % 2 ? sh : mixHex(sh, "#ffffff", 0.15));
  ctx.fillStyle = "#f77f00";
  ctx.beginPath();
  ctx.moveTo(w * 0.9, ground - h * 0.08);
  ctx.lineTo(w * 0.87, ground);
  ctx.lineTo(w * 0.93, ground);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(w * 0.884, ground - h * 0.05, w * 0.032, 5 * u);
}

/** A plumber's job: a bathroom wall, the cabinet open under the sink showing pipes, a toolbox and a wrench. */
function plumbing(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#eef6f8", "#dcebef"], ["#d8dde3", "#c7cdd5"], u);
  // Tiles on the wall.
  ctx.strokeStyle = "rgba(120,150,170,0.18)";
  ctx.lineWidth = 1.5 * u;
  for (let y = h * 0.12; y < fy; y += 34 * u) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let x = 0; x < w; x += 34 * u) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.12);
    ctx.lineTo(x, fy);
    ctx.stroke();
  }
  // The vanity on the left with its doors open, the trap and pipes inside, a basin and tap on top.
  const vx = w * 0.04;
  const vw = w * 0.26;
  box(ctx, vx, fy - h * 0.24, vw, h * 0.24, 6 * u, "#f3ead7");
  box(ctx, vx + 10 * u, fy - h * 0.21, vw - 20 * u, h * 0.19, 4 * u, "#3a3f4c");
  ctx.strokeStyle = "#c9ced6";
  ctx.lineWidth = 9 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(vx + vw * 0.5, fy - h * 0.21);
  ctx.lineTo(vx + vw * 0.5, fy - h * 0.13);
  ctx.quadraticCurveTo(vx + vw * 0.5, fy - h * 0.08, vx + vw * 0.6, fy - h * 0.08);
  ctx.quadraticCurveTo(vx + vw * 0.7, fy - h * 0.08, vx + vw * 0.7, fy - h * 0.13);
  ctx.lineTo(vx + vw * 0.86, fy - h * 0.13);
  ctx.stroke();
  // A drip, now and then.
  const drip = (T * 0.8) % 1;
  ctx.fillStyle = "rgba(90,170,230,0.85)";
  ctx.beginPath();
  ctx.ellipse(vx + vw * 0.6, fy - h * 0.06 + drip * h * 0.04, 4 * u, 6 * u, 0, 0, TAU);
  ctx.fill();
  box(ctx, vx - 6 * u, fy - h * 0.26, vw + 12 * u, h * 0.025, 4 * u, "#ffffff");
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(vx + vw * 0.5, fy - h * 0.26, vw * 0.3, h * 0.03, 0, Math.PI, 0);
  ctx.fill();
  box(ctx, vx + vw * 0.47, fy - h * 0.34, 12 * u, h * 0.08, 4 * u, "#b8bec9");
  box(ctx, vx + vw * 0.47, fy - h * 0.34, vw * 0.12, 10 * u, 4 * u, "#b8bec9");
  // A mirror above.
  box(ctx, vx + vw * 0.15, h * 0.12, vw * 0.7, h * 0.22, 10 * u, "rgba(200,225,238,0.85)");
  // A toolbox in the brand's colour and a wrench on the floor, on the right.
  const tx = w * 0.72;
  box(ctx, tx, fy - h * 0.1, w * 0.16, h * 0.1, 6 * u, palette.primary);
  box(ctx, tx, fy - h * 0.1, w * 0.16, h * 0.025, 4 * u, mixHex(palette.primary, "#000000", 0.2));
  ctx.strokeStyle = "#3a3f4c";
  ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.arc(tx + w * 0.08, fy - h * 0.1, w * 0.03, Math.PI, 0);
  ctx.stroke();
  ctx.save();
  ctx.translate(w * 0.62, fy + h * 0.06);
  ctx.rotate(-0.3);
  box(ctx, -w * 0.06, -5 * u, w * 0.12, 10 * u, 4 * u, "#9aa0ad");
  ctx.fillStyle = "#9aa0ad";
  ctx.beginPath();
  ctx.arc(w * 0.06, 0, 13 * u, 0.6, TAU - 0.6);
  ctx.fill();
  ctx.restore();
  // A coiled hose on the wall at the right.
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 6 * u;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.ellipse(w * 0.92, h * 0.3, (30 + k * 8) * u, (24 + k * 6) * u, 0, 0, TAU);
    ctx.stroke();
  }
}

/** Lawn care: freshly mown stripes, a mower, trimmed hedges, flower beds and a white fence. */
function lawn(sc: SkillContext) {
  const { ctx, w, h, u, seed, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const ground = h * 0.62;
  yard(ctx, w, h, T, u, seed, ground, palette);
  // Mower stripes across the lawn, in perspective.
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.08)" : "rgba(0,60,0,0.06)";
    ctx.beginPath();
    ctx.moveTo(w * (i / 12), ground);
    ctx.lineTo(w * ((i + 1) / 12), ground);
    ctx.lineTo(w * ((i + 1) / 12) + (w * ((i + 1) / 12) - w / 2) * 0.6, h);
    ctx.lineTo(w * (i / 12) + (w * (i / 12) - w / 2) * 0.6, h);
    ctx.fill();
  }
  // A white fence along the back.
  ctx.fillStyle = "#ffffff";
  for (let x = 0; x < w; x += 24 * u) box(ctx, x, ground - h * 0.08, 12 * u, h * 0.08, 5 * u, "#ffffff");
  ctx.fillRect(0, ground - h * 0.06, w, 5 * u);
  // Clipped hedges and a flower bed at both sides.
  const colors = [palette.primary, "#ffd166", "#ff8fab", palette.accent, "#ffffff"];
  for (const [x, wd] of [[w * 0.0, w * 0.22], [w * 0.78, w * 0.22]] as const) {
    box(ctx, x, ground - h * 0.12, wd, h * 0.12, 22 * u, "#3f8f4e");
    box(ctx, x + 6 * u, ground - h * 0.115, wd - 12 * u, h * 0.03, 12 * u, "rgba(255,255,255,0.12)");
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(x + 14 * u + i * (wd - 28 * u) / 8, ground + h * 0.02 + Math.sin(T * 1.4 + i) * 1.5 * u, 7 * u, 0, TAU);
      ctx.fill();
    }
  }
  // The mower, crossing slowly.
  const mx = w * 0.3 + ((T * 30 * u) % (w * 0.4));
  const my = ground + h * 0.18;
  box(ctx, mx - 40 * u, my - 26 * u, 80 * u, 30 * u, 8 * u, palette.primary);
  box(ctx, mx - 30 * u, my - 38 * u, 50 * u, 14 * u, 6 * u, mixHex(palette.primary, "#000000", 0.2));
  ctx.strokeStyle = "#3a3f4c";
  ctx.lineWidth = 4 * u;
  ctx.beginPath();
  ctx.moveTo(mx - 36 * u, my - 22 * u);
  ctx.lineTo(mx - 80 * u, my - 80 * u);
  ctx.lineTo(mx - 100 * u, my - 80 * u);
  ctx.stroke();
  for (const dx of [-28, 28]) {
    ctx.fillStyle = "#2b2f38";
    ctx.beginPath();
    ctx.arc(mx + dx * u, my + 6 * u, 10 * u, 0, TAU);
    ctx.fill();
  }
  // A tree at the side.
  ctx.fillStyle = "#8a5a3b";
  ctx.fillRect(w * 0.92 - 6 * u, ground - h * 0.3, 12 * u, h * 0.2);
  ctx.fillStyle = "#4caf6a";
  ctx.beginPath();
  ctx.arc(w * 0.92 + Math.sin(T) * 2 * u, ground - h * 0.34, h * 0.1, 0, TAU);
  ctx.fill();
}

/** A cleaning job: a bright room sparkling, a mop and bucket, spray bottles, a caddy and rising bubbles. */
function cleaning(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f4fbfb", "#e4f3f2"], ["#e8e1d6", "#d9d0c2"], u);
  windowPane(ctx, w * 0.05, h * 0.14, w * 0.16, h * 0.32, u, T);
  // A wet-floor shine under the mop.
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(w * 0.3, fy + h * 0.12, w * 0.14, h * 0.035, 0, 0, TAU);
  ctx.fill();
  // The bucket and a mop leaning on it.
  box(ctx, w * 0.22, fy + h * 0.02, w * 0.08, h * 0.1, 8 * u, palette.primary);
  box(ctx, w * 0.215, fy + h * 0.02, w * 0.09, h * 0.015, 4 * u, mixHex(palette.primary, "#ffffff", 0.3));
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.moveTo(w * 0.33, fy + h * 0.1);
  ctx.lineTo(w * 0.38, fy - h * 0.3);
  ctx.stroke();
  ctx.fillStyle = "#e9ecef";
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(w * 0.33 + (i - 2.5) * 5 * u, fy + h * 0.115, 4 * u, 12 * u, (i - 2.5) * 0.15, 0, TAU);
    ctx.fill();
  }
  // A caddy of spray bottles on a side table, right.
  const tx = w * 0.72;
  box(ctx, tx, fy - h * 0.14, w * 0.22, h * 0.02, 3 * u, "#c79b74");
  box(ctx, tx + 8 * u, fy - h * 0.12, 6 * u, h * 0.12, 2 * u, "#a87b57");
  box(ctx, tx + w * 0.22 - 14 * u, fy - h * 0.12, 6 * u, h * 0.12, 2 * u, "#a87b57");
  const colors = [palette.primary, palette.accent, "#7bdff2", "#ffd166"];
  for (let i = 0; i < 4; i++) {
    const bx = tx + 20 * u + i * w * 0.045;
    box(ctx, bx, fy - h * 0.24, w * 0.03, h * 0.1, 6 * u, colors[i]);
    box(ctx, bx + w * 0.005, fy - h * 0.27, w * 0.02, h * 0.03, 3 * u, "#ffffff");
    box(ctx, bx + w * 0.02, fy - h * 0.265, w * 0.018, 6 * u, 2 * u, "#ffffff");
  }
  // Bubbles drifting up, and sparkles twinkling on clean surfaces.
  const r = rng(77);
  for (let i = 0; i < 14; i++) {
    const bx = w * (0.08 + r() * 0.84);
    if (bx > w * 0.36 && bx < w * 0.64) continue;
    const y = fy - ((T * (20 + r() * 25) * u + r() * h) % (fy * 0.9));
    const rad = (6 + r() * 10) * u;
    ctx.strokeStyle = "rgba(120,190,230,0.55)";
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.arc(bx + Math.sin(T + i) * 6 * u, y, rad, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.arc(bx + Math.sin(T + i) * 6 * u - rad * 0.35, y - rad * 0.35, rad * 0.22, 0, TAU);
    ctx.fill();
  }
  for (const [sx, sy, k] of [[0.13, 0.2, 0], [0.8, 0.5, 1.3], [0.24, 0.66, 2.1], [0.9, 0.62, 3]] as const) {
    const a = 0.5 + 0.5 * Math.sin(T * 2.2 + k);
    const sz = (8 + 6 * a) * u;
    ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * a})`;
    ctx.beginPath();
    ctx.moveTo(w * sx, h * sy - sz);
    ctx.lineTo(w * sx + sz * 0.25, h * sy - sz * 0.25);
    ctx.lineTo(w * sx + sz, h * sy);
    ctx.lineTo(w * sx + sz * 0.25, h * sy + sz * 0.25);
    ctx.lineTo(w * sx, h * sy + sz);
    ctx.lineTo(w * sx - sz * 0.25, h * sy + sz * 0.25);
    ctx.lineTo(w * sx - sz, h * sy);
    ctx.lineTo(w * sx - sz * 0.25, h * sy - sz * 0.25);
    ctx.fill();
  }
}

/** An ice cream parlour: pastel stripes, a freezer case of colourful tubs, a big cone sign and stools. */
function icecream(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#fff4f7", "#ffe8ef"], ["#f2e6da", "#e6d6c6"], u);
  // Pastel candy stripes on the wall.
  const stripe = [mixHex(palette.primary, "#ffffff", 0.82), "rgba(255,255,255,0)"];
  for (let x = 0, i = 0; x < w; x += 40 * u, i++) {
    ctx.fillStyle = stripe[i % 2];
    ctx.fillRect(x, 14 * u, 40 * u, fy - h * 0.22);
  }
  box(ctx, 0, fy - h * 0.22, w, 8 * u, 0, mixHex(palette.primary, "#ffffff", 0.5));
  // A big cone sign on the left, gently bobbing.
  const cx = w * 0.12;
  const cy = h * 0.28 + Math.sin(T * 1.3) * 4 * u;
  ctx.fillStyle = "#e0b26b";
  ctx.beginPath();
  ctx.moveTo(cx - 34 * u, cy);
  ctx.lineTo(cx + 34 * u, cy);
  ctx.lineTo(cx, cy + 100 * u);
  ctx.fill();
  ctx.strokeStyle = "rgba(150,100,40,0.5)";
  ctx.lineWidth = 2 * u;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(cx + k * 14 * u, cy);
    ctx.lineTo(cx + k * 4 * u, cy + 70 * u);
    ctx.stroke();
  }
  for (const [dx, dy, c] of [[-16, -10, "#ff8fab"], [16, -10, "#7bdff2"], [0, -34, palette.primary]] as const) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(cx + dx * u, cy + dy * u, 28 * u, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "#d62828";
  ctx.beginPath();
  ctx.arc(cx, cy - 62 * u, 8 * u, 0, TAU);
  ctx.fill();
  // The freezer case on the right: tubs of flavours under the glass.
  const fx = w * 0.64;
  const fw = w * 0.34;
  box(ctx, fx, fy - h * 0.22, fw, h * 0.22, 8 * u, "#ffffff");
  box(ctx, fx + 8 * u, fy - h * 0.21, fw - 16 * u, h * 0.1, 6 * u, "rgba(220,240,250,0.9)");
  const flavours = ["#fff3d6", "#ff8fab", "#7bdff2", "#8b5a3c", "#b9f3c4", palette.primary, "#ffd166", "#c8a2ff"];
  for (let i = 0; i < 8; i++) {
    const tx = fx + 14 * u + (i % 4) * (fw - 28 * u) / 4;
    const ty = fy - h * 0.2 + Math.floor(i / 4) * h * 0.045;
    box(ctx, tx, ty, (fw - 28 * u) / 4 - 8 * u, h * 0.035, 6 * u, flavours[i]);
  }
  box(ctx, fx - 4 * u, fy - h * 0.23, fw + 8 * u, 10 * u, 4 * u, mixHex(palette.primary, "#ffffff", 0.3));
  // Stools at a little counter on the left.
  for (const x of [w * 0.22, w * 0.3]) {
    ctx.fillStyle = "#b8bec9";
    ctx.fillRect(x - 3 * u, fy - h * 0.1, 6 * u, h * 0.1);
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.ellipse(x, fy - h * 0.1, 22 * u, 8 * u, 0, 0, TAU);
    ctx.fill();
  }
}

/* ───────────────────────── Professional services ───────────────────────── */

/** A framed certificate: a gold frame, cream paper, a few text lines and a seal in the brand's colour. */
function certificate(ctx: C, x: number, y: number, fw: number, fh: number, u: number, seal: string) {
  box(ctx, x, y, fw, fh, 4 * u, "#c9a227");
  box(ctx, x + 6 * u, y + 6 * u, fw - 12 * u, fh - 12 * u, 2 * u, "#fbf8f1");
  ctx.fillStyle = "rgba(60,50,40,0.22)";
  for (let i = 0; i < 3; i++) ctx.fillRect(x + fw * 0.2, y + fh * (0.3 + i * 0.16), fw * (i === 0 ? 0.6 : 0.45), 3 * u);
  ctx.fillStyle = seal;
  ctx.beginPath();
  ctx.arc(x + fw * 0.76, y + fh * 0.72, Math.min(fw, fh) * 0.11, 0, TAU);
  ctx.fill();
}

/** A tall bookcase of bound volumes with gilt bands. */
function lawShelf(ctx: C, x: number, top: number, sw: number, fy: number, u: number, pal: Palette) {
  box(ctx, x, top, sw, fy - top, 4 * u, "#5c3a24");
  box(ctx, x + 8 * u, top + 8 * u, sw - 16 * u, fy - top - 16 * u, 2 * u, "#3e2616");
  const spines = ["#7b1e1e", "#1f3b5c", "#24513a", "#5a2a4a", mixHex(pal.primary, "#1a1a1a", 0.35)];
  const rows = 5;
  const rh = (fy - top - 16 * u) / rows;
  const r = rng(Math.round(x));
  for (let row = 0; row < rows; row++) {
    const base = top + 8 * u + rh * (row + 1);
    box(ctx, x + 8 * u, base - 6 * u, sw - 16 * u, 6 * u, 1 * u, "#6e4528");
    let bx = x + 12 * u;
    while (bx < x + sw - 22 * u) {
      const bw = (9 + r() * 7) * u;
      const bh = rh * (0.62 + r() * 0.24);
      const c = spines[Math.floor(r() * spines.length)];
      box(ctx, bx, base - 6 * u - bh, bw, bh, 1.5 * u, c);
      ctx.fillStyle = "#d4af37";
      ctx.fillRect(bx + 1.5 * u, base - 6 * u - bh * 0.84, bw - 3 * u, 2 * u);
      ctx.fillRect(bx + 1.5 * u, base - 6 * u - bh * 0.2, bw - 3 * u, 2 * u);
      bx += bw + 2 * u;
    }
  }
}

/** A law office: wood panelling, shelves of bound law books, framed certificates, a desk with a banker's lamp and the scales of justice. */
function law(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f3eee7", "#e8dfd3"], ["#8a6248", "#6f4c36"], u);
  // Wainscot panels along the lower wall.
  const wy = fy - h * 0.2;
  box(ctx, 0, wy, w, h * 0.2, 0, "#8b5e3c");
  for (let x = 0; x < w; x += w * 0.1) box(ctx, x + 8 * u, wy + 12 * u, w * 0.1 - 16 * u, h * 0.2 - 24 * u, 3 * u, "#96693f");
  box(ctx, 0, wy - 6 * u, w, 9 * u, 2 * u, "#6e4528");
  lawShelf(ctx, w * 0.02, h * 0.1, w * 0.16, fy, u, palette);
  lawShelf(ctx, w * 0.82, h * 0.1, w * 0.16, fy, u, palette);
  certificate(ctx, w * 0.22, h * 0.15, w * 0.09, h * 0.13, u, palette.primary);
  certificate(ctx, w * 0.69, h * 0.15, w * 0.09, h * 0.13, u, palette.primary);
  // The desk and its green banker's lamp, on the left.
  const dx = w * 0.2;
  const dw = w * 0.24;
  box(ctx, dx, fy - h * 0.13, dw, h * 0.13, 4 * u, "#5c3a24");
  box(ctx, dx - 6 * u, fy - h * 0.145, dw + 12 * u, h * 0.025, 4 * u, "#7a4d2e");
  box(ctx, dx + dw * 0.1, fy - h * 0.105, dw * 0.35, h * 0.09, 3 * u, "#6b4329");
  box(ctx, dx + dw * 0.55, fy - h * 0.105, dw * 0.35, h * 0.09, 3 * u, "#6b4329");
  const lx = dx + dw * 0.22;
  box(ctx, lx - 3 * u, fy - h * 0.23, 6 * u, h * 0.085, 2 * u, "#c9a227");
  ctx.fillStyle = "#1f6b4a";
  ctx.beginPath();
  ctx.ellipse(lx, fy - h * 0.23, 34 * u, 14 * u, 0, Math.PI, 0);
  ctx.fill();
  const glow = ctx.createRadialGradient(lx, fy - h * 0.22, 0, lx, fy - h * 0.22, 70 * u);
  glow.addColorStop(0, "rgba(255,236,170,0.4)");
  glow.addColorStop(1, "rgba(255,236,170,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(lx - 70 * u, fy - h * 0.22, 140 * u, 70 * u);
  // A stack of files on the desk.
  for (let i = 0; i < 3; i++) box(ctx, dx + dw * 0.55 + i * 2 * u, fy - h * 0.16 - i * 7 * u, dw * 0.3, 6 * u, 1 * u, ["#f2ede0", "#e2d6bd", "#f7f2e6"][i]);
  // The scales of justice on a pedestal, on the right, swaying gently.
  const px = w * 0.7;
  box(ctx, px - w * 0.04, fy - h * 0.12, w * 0.08, h * 0.12, 3 * u, "#e9e1d3");
  box(ctx, px - w * 0.05, fy - h * 0.13, w * 0.1, h * 0.015, 3 * u, "#d6cbb7");
  const gold = "#c9a227";
  const top = fy - h * 0.34;
  box(ctx, px - 3 * u, top, 6 * u, h * 0.21, 2 * u, gold);
  const tilt = Math.sin(T * 0.6) * 0.06;
  const arm = w * 0.055;
  ctx.save();
  ctx.translate(px, top + 8 * u);
  ctx.rotate(tilt);
  box(ctx, -arm, -3 * u, arm * 2, 6 * u, 3 * u, gold);
  ctx.restore();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2 * u;
  for (const side of [-1, 1]) {
    const ex = px + side * arm * Math.cos(tilt);
    const ey = top + 8 * u + side * arm * Math.sin(tilt);
    const pan = ey + h * 0.07;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 18 * u, pan);
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + 18 * u, pan);
    ctx.stroke();
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.ellipse(ex, pan, 24 * u, 8 * u, 0, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(px, top, 7 * u, 0, TAU);
  ctx.fill();
}

/** A tooth, for the dental poster. */
function tooth(ctx: C, cx: number, cy: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy - s * 0.25);
  ctx.bezierCurveTo(cx - s * 0.55, cy - s * 0.65, cx - s * 0.1, cy - s * 0.6, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.1, cy - s * 0.6, cx + s * 0.55, cy - s * 0.65, cx + s * 0.5, cy - s * 0.25);
  ctx.bezierCurveTo(cx + s * 0.45, cy + s * 0.1, cx + s * 0.35, cy + s * 0.6, cx + s * 0.22, cy + s * 0.6);
  ctx.bezierCurveTo(cx + s * 0.1, cy + s * 0.6, cx + s * 0.08, cy + s * 0.15, cx, cy + s * 0.15);
  ctx.bezierCurveTo(cx - s * 0.08, cy + s * 0.15, cx - s * 0.1, cy + s * 0.6, cx - s * 0.22, cy + s * 0.6);
  ctx.bezierCurveTo(cx - s * 0.35, cy + s * 0.6, cx - s * 0.45, cy + s * 0.1, cx - s * 0.5, cy - s * 0.25);
  ctx.fill();
}

/** A dental surgery: a mint room, the reclined chair under its lamp, a tray of instruments, cabinets and a tooth poster. */
function dental(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#eef8f6", "#dbefea"], ["#e3e8ea", "#cfd6da"], u);
  // Cabinets and a counter with a basin on the right.
  const cx0 = w * 0.68;
  const cw = w * 0.3;
  box(ctx, cx0, h * 0.12, cw, h * 0.14, 6 * u, "#ffffff");
  for (let i = 0; i < 3; i++) box(ctx, cx0 + cw * (0.15 + i * 0.33), h * 0.24, cw * 0.06, 4 * u, 2 * u, "#b8c4ca");
  box(ctx, cx0, fy - h * 0.16, cw, h * 0.16, 6 * u, "#ffffff");
  box(ctx, cx0 - 6 * u, fy - h * 0.175, cw + 12 * u, h * 0.025, 4 * u, mixHex(palette.primary, "#ffffff", 0.55));
  for (let i = 0; i < 3; i++) box(ctx, cx0 + cw * (0.06 + i * 0.32), fy - h * 0.13, cw * 0.27, h * 0.11, 4 * u, "#f2f6f7");
  box(ctx, cx0 + cw * 0.6, fy - h * 0.23, 8 * u, h * 0.055, 3 * u, "#b8c4ca");
  // A poster with a big tooth.
  box(ctx, w * 0.06, h * 0.12, w * 0.12, h * 0.2, 6 * u, "#ffffff");
  box(ctx, w * 0.07, h * 0.13, w * 0.1, h * 0.18, 4 * u, mixHex(palette.primary, "#ffffff", 0.8));
  tooth(ctx, w * 0.12, h * 0.215, Math.min(w, h) * 0.1, "#ffffff");
  // The chair: base, seat, a reclined back and a headrest, in the brand's colour.
  const chair = mixHex(palette.primary, "#ffffff", 0.12);
  const bx = w * 0.3;
  box(ctx, bx - w * 0.03, fy - h * 0.12, w * 0.06, h * 0.12, 6 * u, "#cfd8dc");
  box(ctx, bx - w * 0.05, fy - 10 * u, w * 0.1, 10 * u, 4 * u, "#b8c4ca");
  box(ctx, bx - w * 0.02, fy - h * 0.16, w * 0.16, h * 0.05, 14 * u, chair);
  ctx.save();
  ctx.translate(bx - w * 0.01, fy - h * 0.14);
  ctx.rotate(-2.55);
  box(ctx, 0, -h * 0.025, w * 0.13, h * 0.05, 14 * u, chair);
  box(ctx, w * 0.125, -h * 0.02, w * 0.035, h * 0.04, 10 * u, mixHex(chair, "#000000", 0.12));
  ctx.restore();
  box(ctx, bx + w * 0.12, fy - h * 0.19, w * 0.06, h * 0.035, 10 * u, chair);
  // The lamp on its arm from the ceiling, its light steady and soft.
  const lx = w * 0.27;
  const ly = h * 0.36;
  ctx.strokeStyle = "#b8c4ca";
  ctx.lineWidth = 7 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(lx + w * 0.08, 10 * u);
  ctx.lineTo(lx + w * 0.08, h * 0.2);
  ctx.lineTo(lx, ly - 14 * u);
  ctx.stroke();
  box(ctx, lx - 34 * u, ly - 16 * u, 68 * u, 26 * u, 12 * u, "#e9eef0");
  const lg = ctx.createRadialGradient(lx, ly + 10 * u, 0, lx, ly + 10 * u, h * 0.2);
  lg.addColorStop(0, `rgba(255,255,240,${0.42 + 0.04 * Math.sin(T * 0.8)})`);
  lg.addColorStop(1, "rgba(255,255,240,0)");
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(lx - 30 * u, ly + 8 * u);
  ctx.lineTo(lx + 30 * u, ly + 8 * u);
  ctx.lineTo(lx + w * 0.08, fy - h * 0.16);
  ctx.lineTo(lx - w * 0.08, fy - h * 0.16);
  ctx.fill();
  // The instrument tray on its arm.
  const tx = w * 0.5;
  ctx.strokeStyle = "#b8c4ca";
  ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.moveTo(tx, fy);
  ctx.lineTo(tx, fy - h * 0.2);
  ctx.stroke();
  box(ctx, tx - w * 0.05, fy - h * 0.215, w * 0.1, 12 * u, 4 * u, "#e9eef0");
  ctx.strokeStyle = "#8a979e";
  ctx.lineWidth = 2.5 * u;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(tx - w * 0.035 + i * w * 0.022, fy - h * 0.21);
    ctx.lineTo(tx - w * 0.03 + i * w * 0.022, fy - h * 0.205);
    ctx.lineTo(tx - w * 0.02 + i * w * 0.022, fy - h * 0.205);
    ctx.stroke();
  }
  plant(ctx, w * 0.62, fy, h * 0.13, T, "#ffffff");
}

/** A small bar chart in a frame (no numbers), in the brand's colours. */
function chartFrame(ctx: C, x: number, y: number, fw: number, fh: number, u: number, T: number, pal: Palette) {
  box(ctx, x, y, fw, fh, 8 * u, "#ffffff");
  ctx.strokeStyle = "rgba(60,70,90,0.18)";
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(x + fw * 0.1, y + fh * 0.85);
  ctx.lineTo(x + fw * 0.9, y + fh * 0.85);
  ctx.stroke();
  const hs = [0.3, 0.45, 0.4, 0.6, 0.72];
  const cols = [mixHex(pal.primary, "#ffffff", 0.45), pal.primary];
  hs.forEach((v, i) => {
    const bh = fh * 0.65 * v * (0.96 + 0.04 * Math.sin(T * 0.7 + i));
    box(ctx, x + fw * (0.14 + i * 0.15), y + fh * 0.85 - bh, fw * 0.1, bh, 3 * u, cols[i === hs.length - 1 ? 1 : 0]);
  });
}

/** An accounting office: a window, a framed bar chart, a wall calendar, a desk with a monitor, a calculator and stacked files, and a filing cabinet. */
function accounting(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f4f5f8", "#e7eaf0"], ["#cdd2da", "#bcc2cc"], u);
  windowPane(ctx, w * 0.05, h * 0.12, w * 0.18, h * 0.3, u, T, true);
  chartFrame(ctx, w * 0.74, h * 0.12, w * 0.16, h * 0.17, u, T, palette);
  // A wall calendar with a ringed day (beside the window, clear of the headline).
  const kx = w * 0.25;
  box(ctx, kx, h * 0.13, w * 0.08, h * 0.12, 4 * u, "#ffffff");
  box(ctx, kx, h * 0.13, w * 0.08, h * 0.028, 4 * u, palette.primary);
  ctx.fillStyle = "rgba(60,70,90,0.25)";
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.fillRect(kx + w * (0.008 + c * 0.018), h * (0.17 + r * 0.025), w * 0.01, h * 0.012);
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2.5 * u;
  ctx.beginPath();
  ctx.arc(kx + w * 0.049, h * 0.201, 9 * u, 0, TAU);
  ctx.stroke();
  // The desk with a monitor, a calculator, a pen cup and stacks of files.
  const dx = w * 0.56;
  const dw = w * 0.3;
  box(ctx, dx, fy - h * 0.13, dw, h * 0.025, 4 * u, "#c79b74");
  ctx.fillStyle = "#a57b57";
  ctx.fillRect(dx + dw * 0.05, fy - h * 0.11, 6 * u, h * 0.11);
  ctx.fillRect(dx + dw * 0.95 - 6 * u, fy - h * 0.11, 6 * u, h * 0.11);
  box(ctx, dx + dw * 0.08, fy - h * 0.26, dw * 0.36, h * 0.12, 6 * u, "#3d4459");
  box(ctx, dx + dw * 0.1, fy - h * 0.25, dw * 0.32, h * 0.1, 4 * u, mixHex(palette.primary, "#ffffff", 0.6));
  ctx.fillStyle = mixHex(palette.primary, "#ffffff", 0.2);
  for (let i = 0; i < 4; i++) ctx.fillRect(dx + dw * (0.13 + i * 0.07), fy - h * (0.165 + i * 0.012), dw * 0.045, h * (0.01 + i * 0.012));
  ctx.fillStyle = "#3d4459";
  ctx.fillRect(dx + dw * 0.24, fy - h * 0.14, dw * 0.04, h * 0.012);
  // Calculator.
  const cx = dx + dw * 0.5;
  box(ctx, cx, fy - h * 0.175, dw * 0.13, h * 0.045, 4 * u, "#4a5163");
  box(ctx, cx + 4 * u, fy - h * 0.17, dw * 0.13 - 8 * u, h * 0.012, 2 * u, "#c8e6c9");
  ctx.fillStyle = "#e1e4ea";
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) ctx.fillRect(cx + 5 * u + c * dw * 0.03, fy - h * (0.151 - r * 0.012), dw * 0.02, h * 0.007);
  // Files.
  for (let i = 0; i < 4; i++) box(ctx, dx + dw * 0.7 + (i % 2) * 3 * u, fy - h * 0.14 - i * 7 * u, dw * 0.24, 6 * u, 1 * u, ["#f2ede0", palette.primary, "#e2d6bd", mixHex(palette.secondary, "#ffffff", 0.3)][i]);
  // The filing cabinet on the left of the desk.
  const fx = w * 0.32;
  box(ctx, fx, fy - h * 0.24, w * 0.09, h * 0.24, 4 * u, "#9aa3b2");
  for (let i = 0; i < 3; i++) {
    box(ctx, fx + 6 * u, fy - h * 0.235 + i * h * 0.078, w * 0.09 - 12 * u, h * 0.07, 3 * u, "#aeb6c4");
    box(ctx, fx + w * 0.035, fy - h * 0.2 + i * h * 0.078, w * 0.02, 5 * u, 2 * u, "#6b7486");
  }
  plant(ctx, w * 0.27, fy, h * 0.15, T, "#e8e2d8");
}

/** An electrician's job: an open breaker panel, conduit runs, warm bulbs hanging steady, a step ladder, a cable reel and a hard hat. */
function electrical(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f2f1ec", "#e3e1d9"], ["#cfcac0", "#bbb5a8"], u);
  // The breaker panel, door open, rows of switches with brand-coloured labels.
  const px = w * 0.06;
  const py = h * 0.18;
  const pw = w * 0.14;
  const ph = h * 0.34;
  box(ctx, px, py, pw, ph, 6 * u, "#a9b0ba");
  box(ctx, px + 8 * u, py + 8 * u, pw - 16 * u, ph - 16 * u, 4 * u, "#3a3f4c");
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 2; c++) {
      const bx = px + 16 * u + c * (pw - 32 * u) * 0.52;
      const by = py + 18 * u + r * (ph - 36 * u) / 6;
      box(ctx, bx, by, (pw - 32 * u) * 0.46, (ph - 36 * u) / 6 - 6 * u, 2 * u, "#e1e4ea");
      box(ctx, bx + 4 * u, by + 4 * u, 8 * u, (ph - 36 * u) / 6 - 14 * u, 1 * u, r % 3 === 0 ? palette.primary : "#6b7486");
    }
  ctx.save();
  ctx.translate(px + pw, py);
  ctx.transform(1, 0.12, 0, 1, 0, 0);
  box(ctx, 0, 0, pw * 0.35, ph, 4 * u, "#c3c9d1");
  ctx.restore();
  // Conduit from the panel up and across the wall, with junction boxes.
  ctx.strokeStyle = "#b8bec9";
  ctx.lineWidth = 8 * u;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(px + pw * 0.5, py);
  ctx.lineTo(px + pw * 0.5, h * 0.08);
  ctx.lineTo(w * 0.94, h * 0.08);
  ctx.moveTo(w * 0.8, h * 0.08);
  ctx.lineTo(w * 0.8, fy - h * 0.2);
  ctx.stroke();
  box(ctx, w * 0.8 - 16 * u, fy - h * 0.2, 32 * u, 40 * u, 4 * u, "#ffffff");
  ctx.fillStyle = "#3a3f4c";
  ctx.fillRect(w * 0.8 - 6 * u, fy - h * 0.2 + 10 * u, 3 * u, 8 * u);
  ctx.fillRect(w * 0.8 + 3 * u, fy - h * 0.2 + 10 * u, 3 * u, 8 * u);
  // Bulbs hanging from the run, glowing warm and steady.
  for (const [bx, drop] of [[0.36, 0.14], [0.5, 0.1], [0.64, 0.16]] as const) {
    const x = w * bx;
    const y = h * (0.08 + drop);
    ctx.strokeStyle = "#3a3f4c";
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.08);
    ctx.lineTo(x, y - 12 * u);
    ctx.stroke();
    const g = ctx.createRadialGradient(x, y, 0, x, y, 60 * u);
    g.addColorStop(0, `rgba(255,214,120,${0.38 + 0.04 * Math.sin(T * 0.7 + bx * 9)})`);
    g.addColorStop(1, "rgba(255,214,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 60 * u, y - 60 * u, 120 * u, 120 * u);
    box(ctx, x - 6 * u, y - 16 * u, 12 * u, 8 * u, 2 * u, "#8a8f99");
    ctx.fillStyle = "#ffe7a3";
    ctx.beginPath();
    ctx.arc(x, y, 11 * u, 0, TAU);
    ctx.fill();
  }
  // A step ladder in the brand's colour.
  const lx = w * 0.66;
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 7 * u;
  ctx.beginPath();
  ctx.moveTo(lx, fy);
  ctx.lineTo(lx + w * 0.04, fy - h * 0.3);
  ctx.lineTo(lx + w * 0.08, fy);
  ctx.stroke();
  ctx.lineWidth = 5 * u;
  for (let i = 1; i < 4; i++) {
    const f = i / 4;
    ctx.beginPath();
    ctx.moveTo(lx + w * 0.04 * f, fy - h * 0.3 * f);
    ctx.lineTo(lx + w * 0.08 - w * 0.04 * f + w * 0.01, fy - h * 0.3 * f);
    ctx.stroke();
  }
  // A cable reel and a hard hat on the floor.
  const rx = w * 0.3;
  ctx.fillStyle = "#a87b57";
  ctx.beginPath();
  ctx.arc(rx, fy - h * 0.07, h * 0.07, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 4 * u;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.arc(rx, fy - h * 0.07, h * 0.02 + k * 5 * u, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = "#f2c230";
  ctx.beginPath();
  ctx.ellipse(w * 0.9, fy - 6 * u, w * 0.04, h * 0.05, 0, Math.PI, 0);
  ctx.fill();
  box(ctx, w * 0.85, fy - 8 * u, w * 0.1, 8 * u, 4 * u, "#e0ae1c");
}

/** Heating and cooling: a wall unit breathing cool air, a thermostat, a floor vent, a window, and a heat-pump cabinet with its fan turning. */
function hvac(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#eef3f8", "#dfe7f0"], ["#d9c3a5", "#c6ab88"], u);
  windowPane(ctx, w * 0.05, h * 0.14, w * 0.2, h * 0.3, u, T);
  // The wall unit high on the right, with soft air lines drifting down.
  const ax = w * 0.62;
  const aw = w * 0.3;
  box(ctx, ax, h * 0.1, aw, h * 0.1, 18 * u, "#ffffff");
  box(ctx, ax + aw * 0.06, h * 0.17, aw * 0.88, 6 * u, 3 * u, "#d6dde5");
  ctx.fillStyle = palette.primary;
  ctx.beginPath();
  ctx.arc(ax + aw * 0.9, h * 0.13, 4 * u, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(100,170,230,0.7)";
  ctx.lineWidth = 4 * u;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const ph = (T * 0.25 + i * 0.25) % 1;
    const x0 = ax + aw * (0.15 + i * 0.2);
    const y0 = h * 0.2 + ph * h * 0.16;
    ctx.globalAlpha = 1 - ph;
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const y = y0 + k * h * 0.006;
      const x = x0 + Math.sin(k * 0.5 + T * 2 + i) * h * 0.01;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // The thermostat: a round dial with a ring in the brand's colour.
  const tx = w * 0.32;
  const ty = h * 0.3;
  const ts = h * 0.065;
  box(ctx, tx - ts, ty - ts, ts * 2, ts * 2, ts * 0.4, "#ffffff");
  ctx.strokeStyle = "#e1e6ec";
  ctx.lineWidth = ts * 0.16;
  ctx.beginPath();
  ctx.arc(tx, ty, ts * 0.62, Math.PI * 0.75, Math.PI * 2.25);
  ctx.stroke();
  ctx.strokeStyle = palette.primary;
  ctx.beginPath();
  ctx.arc(tx, ty, ts * 0.62, Math.PI * 0.75, Math.PI * (1.7 + 0.04 * Math.sin(T * 0.4)));
  ctx.stroke();
  ctx.fillStyle = "#3a3f4c";
  ctx.beginPath();
  ctx.arc(tx, ty, ts * 0.14, 0, TAU);
  ctx.fill();
  // A floor vent.
  box(ctx, w * 0.36, fy + h * 0.03, w * 0.1, h * 0.03, 3 * u, "#d6dde5");
  ctx.fillStyle = "#9aa3b2";
  for (let i = 0; i < 6; i++) ctx.fillRect(w * 0.365 + i * w * 0.015, fy + h * 0.035, w * 0.008, h * 0.02);
  // The heat-pump cabinet with its fan turning slowly.
  const hx = w * 0.7;
  const hw = w * 0.22;
  box(ctx, hx, fy - h * 0.22, hw, h * 0.22, 8 * u, "#e9edf2");
  box(ctx, hx, fy - h * 0.22, hw, h * 0.03, 8 * u, mixHex(palette.primary, "#ffffff", 0.3));
  const fx = hx + hw * 0.4;
  const fyy = fy - h * 0.1;
  const r = h * 0.075;
  ctx.fillStyle = "#3a3f4c";
  ctx.beginPath();
  ctx.arc(fx, fyy, r, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(fx, fyy);
  ctx.rotate(T * 1.2);
  ctx.fillStyle = "#b8bec9";
  for (let k = 0; k < 4; k++) {
    ctx.rotate(TAU / 4);
    ctx.beginPath();
    ctx.ellipse(r * 0.45, 0, r * 0.42, r * 0.16, 0.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2 * u;
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath();
    ctx.arc(fx, fyy, r * (k / 3), 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) box(ctx, hx + hw * 0.72, fy - h * 0.17 + i * h * 0.03, hw * 0.2, 4 * u, 2 * u, "#c3c9d1");
  plant(ctx, w * 0.5, fy, h * 0.13, T, "#ffffff");
}

/** A photo studio: a seamless paper backdrop in the brand's tint, two softboxes on stands, a camera on a tripod and a gold reflector. */
function photo(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.76;
  room(ctx, w, h, fy, ["#e8e6ee", "#d9d6e1"], ["#cbc7d3", "#b9b4c3"], u);
  // The paper sweep: down the wall and curving out across the floor.
  const sx = w * 0.27;
  const sw = w * 0.46;
  const paper = mixHex(palette.primary, "#ffffff", 0.72);
  const pg = ctx.createLinearGradient(0, h * 0.08, 0, h * 0.95);
  pg.addColorStop(0, mixHex(paper, "#000000", 0.06));
  pg.addColorStop(0.7, paper);
  pg.addColorStop(1, mixHex(paper, "#ffffff", 0.3));
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.moveTo(sx, h * 0.08);
  ctx.lineTo(sx + sw, h * 0.08);
  ctx.lineTo(sx + sw, fy - h * 0.04);
  ctx.quadraticCurveTo(sx + sw, fy + h * 0.06, sx + sw + w * 0.02, h * 0.95);
  ctx.lineTo(sx - w * 0.02, h * 0.95);
  ctx.quadraticCurveTo(sx, fy + h * 0.06, sx, fy - h * 0.04);
  ctx.closePath();
  ctx.fill();
  box(ctx, sx - 14 * u, h * 0.06, sw + 28 * u, 20 * u, 10 * u, "#3a3f4c");
  // Softboxes on stands, aimed at the sweep, glowing softly.
  const softbox = (x: number, dir: number) => {
    ctx.strokeStyle = "#3a3f4c";
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.moveTo(x, fy - h * 0.38);
    ctx.lineTo(x, fy - h * 0.03);
    ctx.moveTo(x, fy - h * 0.03);
    ctx.lineTo(x - 26 * u, fy + h * 0.02);
    ctx.moveTo(x, fy - h * 0.03);
    ctx.lineTo(x + 26 * u, fy + h * 0.02);
    ctx.moveTo(x, fy - h * 0.03);
    ctx.lineTo(x, fy + h * 0.03);
    ctx.stroke();
    ctx.save();
    ctx.translate(x, fy - h * 0.42);
    ctx.scale(dir, 1);
    ctx.fillStyle = "#2f333d";
    ctx.beginPath();
    ctx.moveTo(-w * 0.015, -h * 0.03);
    ctx.lineTo(w * 0.045, -h * 0.09);
    ctx.lineTo(w * 0.045, h * 0.09);
    ctx.lineTo(-w * 0.015, h * 0.03);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,250,${0.92 + 0.04 * Math.sin(T * 0.6)})`;
    ctx.fillRect(w * 0.04, -h * 0.085, 8 * u, h * 0.17);
    ctx.restore();
  };
  softbox(w * 0.13, 1);
  softbox(w * 0.87, -1);
  // The camera on its tripod, front right.
  const cx = w * 0.78;
  const cy = fy - h * 0.2;
  ctx.strokeStyle = "#3a3f4c";
  ctx.lineWidth = 4 * u;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 14 * u);
  ctx.lineTo(cx - 34 * u, fy + h * 0.06);
  ctx.moveTo(cx, cy + 14 * u);
  ctx.lineTo(cx + 30 * u, fy + h * 0.06);
  ctx.moveTo(cx, cy + 14 * u);
  ctx.lineTo(cx + 4 * u, fy + h * 0.08);
  ctx.stroke();
  box(ctx, cx - 34 * u, cy - 22 * u, 68 * u, 40 * u, 8 * u, "#2f333d");
  box(ctx, cx - 18 * u, cy - 30 * u, 22 * u, 10 * u, 3 * u, "#2f333d");
  ctx.fillStyle = "#4a5163";
  ctx.beginPath();
  ctx.arc(cx - 34 * u, cy - 2 * u, 16 * u, 0, TAU);
  ctx.fill();
  ctx.fillStyle = mixHex(palette.primary, "#ffffff", 0.3);
  ctx.beginPath();
  ctx.arc(cx - 36 * u, cy - 2 * u, 8 * u, 0, TAU);
  ctx.fill();
  // A gold reflector leaning on the left.
  ctx.fillStyle = "#e3b84a";
  ctx.beginPath();
  ctx.ellipse(w * 0.22, fy - h * 0.04, w * 0.035, h * 0.07, -0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#c79a2c";
  ctx.lineWidth = 3 * u;
  ctx.stroke();
}

/** A pet groomer's: a raised tub with a dog in a cloud of bubbles, a shower head, rolled towels on a shelf and a dryer on a stand. */
function petgroom(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#f2f8fb", "#e2edf4"], ["#e4e9ec", "#d0d8dc"], u);
  // Small tiles behind the tub.
  ctx.strokeStyle = "rgba(120,150,170,0.16)";
  ctx.lineWidth = 1.5 * u;
  const tx0 = w * 0.08;
  const tw = w * 0.4;
  for (let y = h * 0.22; y < fy; y += 28 * u) {
    ctx.beginPath();
    ctx.moveTo(tx0, y);
    ctx.lineTo(tx0 + tw, y);
    ctx.stroke();
  }
  for (let x = tx0; x <= tx0 + tw; x += 28 * u) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.22);
    ctx.lineTo(x, fy);
    ctx.stroke();
  }
  // A paw print decal.
  ctx.fillStyle = rgba(palette.primary, 0.35);
  const pp = (x: number, y: number, s: number) => {
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.42, s * 0.36, 0, 0, TAU);
    ctx.fill();
    for (const [dx, dy] of [[-0.45, -0.55], [-0.15, -0.8], [0.15, -0.8], [0.45, -0.55]] as const) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, s * 0.16, 0, TAU);
      ctx.fill();
    }
  };
  pp(w * 0.6, h * 0.22, h * 0.05);
  // The tub: the dog sits in it, the front panel hides its legs.
  const bx = w * 0.12;
  const bw = w * 0.32;
  const rim = fy - h * 0.2;
  const ds = Math.min(w, h) * 0.22;
  drawDog(ctx, bx + bw * 0.5, rim + ds * 0.32, ds, T, "#e3b27a", 1);
  box(ctx, bx, rim, bw, h * 0.12, 8 * u, "#c3cbd3");
  box(ctx, bx - 6 * u, rim - 6 * u, bw + 12 * u, 12 * u, 6 * u, "#dde3e8");
  ctx.fillStyle = "#9aa3ad";
  ctx.fillRect(bx + bw * 0.1, rim + h * 0.12, 8 * u, fy - rim - h * 0.12);
  ctx.fillRect(bx + bw * 0.9 - 8 * u, rim + h * 0.12, 8 * u, fy - rim - h * 0.12);
  // Bubbles drifting up.
  const r = rng(77);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 2 * u;
  for (let i = 0; i < 12; i++) {
    const ph = (T * (0.12 + r() * 0.1) + r()) % 1;
    const x = bx + bw * (0.1 + r() * 0.8) + Math.sin(T + i) * 6 * u;
    const y = rim - ph * h * 0.3;
    ctx.globalAlpha = 1 - ph;
    ctx.beginPath();
    ctx.arc(x, y, (5 + r() * 9) * u, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // The shower head on its hose.
  ctx.strokeStyle = "#9aa3ad";
  ctx.lineWidth = 6 * u;
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.85, rim);
  ctx.quadraticCurveTo(bx + bw * 1.0, h * 0.3, bx + bw * 0.8, h * 0.26);
  ctx.stroke();
  box(ctx, bx + bw * 0.72, h * 0.24, 30 * u, 14 * u, 6 * u, "#b8bec9");
  // Shelf of rolled towels in the brand's colours, and a dryer on a stand.
  const sx = w * 0.62;
  box(ctx, sx, h * 0.46, w * 0.22, 8 * u, 3 * u, "#c79b74");
  const tcol = brandColors(palette);
  const tr = h * 0.03;
  const rolls: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [0.5, 1], [1.5, 1], [2.5, 1]];
  rolls.forEach(([cx, row], i) => {
    const x = sx + tr * 1.2 + cx * tr * 2.05;
    const y = h * 0.46 - tr - row * tr * 1.8;
    ctx.fillStyle = tcol[i % tcol.length];
    ctx.beginPath();
    ctx.arc(x, y, tr, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(x, y, tr * 0.55, 0, TAU);
    ctx.arc(x, y, tr * 0.2, 0, TAU);
    ctx.stroke();
  });
  const dx = w * 0.82;
  ctx.strokeStyle = "#6b7486";
  ctx.lineWidth = 6 * u;
  ctx.beginPath();
  ctx.moveTo(dx, fy);
  ctx.lineTo(dx, fy - h * 0.26);
  ctx.stroke();
  box(ctx, dx - 40 * u, fy - 8 * u, 80 * u, 8 * u, 4 * u, "#6b7486");
  box(ctx, dx - 20 * u, fy - h * 0.3, 60 * u, h * 0.06, 12 * u, palette.primary);
  ctx.strokeStyle = "rgba(160,190,210,0.6)";
  ctx.lineWidth = 3 * u;
  for (let i = 0; i < 3; i++) {
    const ph = (T * 0.8 + i / 3) % 1;
    ctx.globalAlpha = 1 - ph;
    ctx.beginPath();
    ctx.moveTo(dx - 26 * u - ph * 40 * u, fy - h * 0.29 + i * 8 * u);
    ctx.lineTo(dx - 46 * u - ph * 40 * u, fy - h * 0.29 + i * 8 * u);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** A tattoo studio: framed flash designs on the wall, a padded bench, a rolling stool, a lamp on its arm and a steady neon heart. */
function tattoo(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const fy = h * 0.74;
  room(ctx, w, h, fy, ["#ece7e1", "#ddd5cc"], ["#55555e", "#3e3e46"], u);
  // Flash: two grids of framed designs, left and right of the middle.
  const designs = (x: number, y: number, s: number, k: number) => {
    const ink = "#24242b";
    const red = "#c0392b";
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = ink;
    if (k === 0) {
      ctx.fillStyle = red;
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.3);
      ctx.bezierCurveTo(x - s * 0.5, y - s * 0.05, x - s * 0.25, y - s * 0.45, x, y - s * 0.15);
      ctx.bezierCurveTo(x + s * 0.25, y - s * 0.45, x + s * 0.5, y - s * 0.05, x, y + s * 0.3);
      ctx.fill();
      ctx.stroke();
    } else if (k === 1) {
      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? s * 0.16 : s * 0.38;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (k === 2) {
      ctx.beginPath();
      ctx.arc(x, y - s * 0.05, s * 0.3, Math.PI * 0.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(x + s * 0.12, y - s * 0.1, s * 0.05, 0, TAU);
      ctx.fill();
    } else if (k === 3) {
      ctx.fillStyle = mixHex(palette.secondary, "#ffffff", 0.2);
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.38);
      ctx.lineTo(x + s * 0.3, y);
      ctx.lineTo(x, y + s * 0.38);
      ctx.lineTo(x - s * 0.3, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (k === 4) {
      ctx.fillStyle = "#f2c230";
      ctx.beginPath();
      ctx.arc(x, y, s * 0.3, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(x - s * 0.12, y, s * 0.24, Math.PI * 1.5, Math.PI * 0.5, true);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = red;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.22, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#3c8d4f";
      ctx.beginPath();
      ctx.ellipse(x - s * 0.22, y + s * 0.25, s * 0.14, s * 0.06, -0.5, 0, TAU);
      ctx.ellipse(x + s * 0.22, y + s * 0.25, s * 0.14, s * 0.06, 0.5, 0, TAU);
      ctx.fill();
    }
  };
  const fs = Math.min(w, h) * 0.09;
  for (const [gx, start] of [[0.04, 0], [0.74, 3]] as const)
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 3; c++) {
        const x = w * gx + c * (fs + 10 * u);
        const y = h * 0.1 + r * (fs + 12 * u);
        box(ctx, x, y, fs, fs, 3 * u, "#2f2f36");
        box(ctx, x + 4 * u, y + 4 * u, fs - 8 * u, fs - 8 * u, 2 * u, "#fbf6ec");
        designs(x + fs / 2, y + fs / 2, fs * 0.8, (start + r * 3 + c) % 6);
      }
  // A neon heart, glowing steady (no flicker).
  const nx = w * 0.14;
  const ny = h * 0.5;
  ctx.save();
  ctx.shadowColor = palette.primary;
  ctx.shadowBlur = 18 * u;
  ctx.strokeStyle = mixHex(palette.primary, "#ffffff", 0.35);
  ctx.lineWidth = 5 * u;
  const s = h * 0.07;
  ctx.beginPath();
  ctx.moveTo(nx, ny + s * 0.6);
  ctx.bezierCurveTo(nx - s * 1.1, ny - s * 0.1, nx - s * 0.5, ny - s * 0.9, nx, ny - s * 0.3);
  ctx.bezierCurveTo(nx + s * 0.5, ny - s * 0.9, nx + s * 1.1, ny - s * 0.1, nx, ny + s * 0.6);
  ctx.stroke();
  ctx.restore();
  // The bench: a padded top on a chrome base, the headrest tilted up.
  const bx = w * 0.58;
  const bw = w * 0.3;
  box(ctx, bx + bw * 0.4, fy - h * 0.12, bw * 0.12, h * 0.12, 4 * u, "#b8bec9");
  box(ctx, bx + bw * 0.2, fy - 10 * u, bw * 0.55, 10 * u, 4 * u, "#9aa3ad");
  box(ctx, bx, fy - h * 0.16, bw, h * 0.05, 12 * u, "#24242b");
  ctx.save();
  ctx.translate(bx + 10 * u, fy - h * 0.14);
  ctx.rotate(-0.35);
  box(ctx, -bw * 0.22, -h * 0.025, bw * 0.24, h * 0.045, 12 * u, "#24242b");
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(bx + 14 * u, fy - h * 0.155, bw - 28 * u, 4 * u);
  // A rolling stool and the lamp.
  const sx = w * 0.4;
  box(ctx, sx - 30 * u, fy - h * 0.1, 60 * u, 16 * u, 8 * u, "#24242b");
  box(ctx, sx - 3 * u, fy - h * 0.09, 6 * u, h * 0.08, 2 * u, "#b8bec9");
  for (const d of [-1, 1]) {
    ctx.strokeStyle = "#9aa3ad";
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.moveTo(sx, fy - 8 * u);
    ctx.lineTo(sx + d * 26 * u, fy - 2 * u);
    ctx.stroke();
  }
  const lx = w * 0.93;
  ctx.strokeStyle = "#3a3f4c";
  ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.moveTo(lx, fy);
  ctx.lineTo(lx, fy - h * 0.34);
  ctx.lineTo(lx - w * 0.08, fy - h * 0.3);
  ctx.stroke();
  box(ctx, lx - w * 0.1, fy - h * 0.31, w * 0.04, h * 0.035, 8 * u, "#3a3f4c");
  const lg = ctx.createRadialGradient(lx - w * 0.08, fy - h * 0.27, 0, lx - w * 0.08, fy - h * 0.27, h * 0.16);
  lg.addColorStop(0, "rgba(255,246,220,0.35)");
  lg.addColorStop(1, "rgba(255,246,220,0)");
  ctx.fillStyle = lg;
  ctx.fillRect(lx - w * 0.08 - h * 0.16, fy - h * 0.27, h * 0.32, h * 0.16);
}

/** Moving day: a house, a box truck in the brand's colour with its ramp down, stacked boxes and a hand truck. */
function moving(sc: SkillContext) {
  const { ctx, w, h, u, seed, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const ground = h * 0.74;
  sky(ctx, w, h, T, u, seed);
  // Lawn, sidewalk and road.
  ctx.fillStyle = mixHex("#9fd58a", palette.secondary, 0.08);
  ctx.fillRect(0, ground - h * 0.02, w, h * 0.04);
  box(ctx, 0, ground + h * 0.02, w, h * 0.05, 0, "#d8d4cc");
  box(ctx, 0, ground + h * 0.07, w, h, 0, "#5b6170");
  ctx.fillStyle = "#f2f2f2";
  for (let x = 0; x < w; x += 90 * u) ctx.fillRect(x, ground + h * 0.15, 46 * u, 6 * u);
  const port = h > w;
  drawHouse(ctx, port ? w * 0.3 : w * 0.18, ground, port ? w * 0.5 : w * 0.28, 1, T, palette, u);
  // The truck: cab in the brand's colour, a white box with a brand stripe, the ramp down from the back.
  const tx = w * 0.5;
  const tw = w * 0.36;
  const tb = ground + h * 0.14;
  const th = h * 0.3;
  box(ctx, tx, tb - th, tw * 0.72, th - h * 0.04, 8 * u, "#ffffff");
  box(ctx, tx, tb - th + th * 0.45, tw * 0.72, th * 0.12, 0, palette.primary);
  box(ctx, tx + tw * 0.72 + 4 * u, tb - th * 0.62, tw * 0.26, th * 0.58 - h * 0.04, 10 * u, palette.primary);
  box(ctx, tx + tw * 0.8, tb - th * 0.56, tw * 0.15, th * 0.2, 6 * u, "#cfe8f7");
  for (const wx of [tx + tw * 0.15, tx + tw * 0.55, tx + tw * 0.86]) {
    ctx.fillStyle = "#2b2f38";
    ctx.beginPath();
    ctx.arc(wx, tb - h * 0.035, h * 0.04, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#b8bec9";
    ctx.beginPath();
    ctx.arc(wx, tb - h * 0.035, h * 0.016, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "#9aa3ad";
  ctx.beginPath();
  ctx.moveTo(tx, tb - h * 0.06);
  ctx.lineTo(tx - w * 0.1, tb + h * 0.02);
  ctx.lineTo(tx - w * 0.1, tb + h * 0.03);
  ctx.lineTo(tx, tb - h * 0.045);
  ctx.fill();
  // Boxes, stacked, with tape.
  const cardboard = (x: number, y: number, bw: number, bh: number) => {
    box(ctx, x, y - bh, bw, bh, 3 * u, "#d9a86c");
    ctx.fillStyle = "#c48f50";
    ctx.fillRect(x, y - bh, bw, bh * 0.12);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(x + bw * 0.44, y - bh, bw * 0.12, bh * 0.45);
  };
  const by = ground + h * 0.06;
  cardboard(w * 0.88, by, w * 0.08, h * 0.08);
  cardboard(w * 0.89, by - h * 0.08, w * 0.06, h * 0.06);
  // A hand truck with a box, leaning, at the foot of the ramp.
  const hx = w * 0.36;
  ctx.strokeStyle = "#3a3f4c";
  ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.moveTo(hx, by);
  ctx.lineTo(hx + w * 0.03, by - h * 0.2);
  ctx.stroke();
  cardboard(hx + 4 * u, by - 4 * u, w * 0.06, h * 0.08);
  ctx.fillStyle = "#2b2f38";
  ctx.beginPath();
  ctx.arc(hx + 4 * u, by, 10 * u, 0, TAU);
  ctx.fill();
}

/** A car wash: a bay with an arch in the brand's colour, two spinning brushes, a car under foam and water spraying down. */
function carwash(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const fy = h * 0.76;
  room(ctx, w, h, fy, ["#eaf4fb", "#d6e6f3"], ["#a3acb6", "#858e99"], u);
  // A wet sheen on the floor.
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(w * (0.2 + i * 0.2), fy + h * (0.06 + (i % 2) * 0.05), w * 0.08, h * 0.012, 0, 0, TAU);
    ctx.fill();
  }
  // The arch.
  const ax = w * 0.18;
  const aw = w * 0.64;
  // (Low enough that a headline at the top reads clear of it.)
  const top = h * 0.25;
  box(ctx, ax, top, aw, h * 0.06, 8 * u, palette.primary);
  box(ctx, ax, top, w * 0.04, fy - top, 6 * u, palette.primary);
  box(ctx, ax + aw - w * 0.04, top, w * 0.04, fy - top, 6 * u, palette.primary);
  // Water spraying down from the arch.
  ctx.strokeStyle = "rgba(90,170,230,0.55)";
  ctx.lineWidth = 3 * u;
  for (let i = 0; i < 14; i++) {
    const x = ax + w * 0.06 + (i * (aw - w * 0.12)) / 13;
    const off = ((T * 160 * u + i * 37 * u) % (34 * u));
    for (let y = top + h * 0.07 + off; y < top + h * 0.26; y += 34 * u) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 14 * u);
      ctx.stroke();
    }
  }
  // Two brushes turning: their strips slide past.
  const brush = (x: number) => {
    const bw = w * 0.06;
    const bt = top + h * 0.1;
    const bh = fy - bt - h * 0.02;
    box(ctx, x - bw / 2, bt, bw, bh, bw / 2, "#4f8fd9");
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, bt, bw, bh, bw / 2);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    const step = bw * 0.4;
    const off = (T * bw * 0.8) % step;
    for (let sx = x - bw / 2 - step + off; sx < x + bw / 2; sx += step) ctx.fillRect(sx, bt, step * 0.35, bh);
    ctx.restore();
    box(ctx, x - 5 * u, top + h * 0.06, 10 * u, h * 0.04, 2 * u, "#3a3f4c");
  };
  brush(ax + w * 0.1);
  brush(ax + aw - w * 0.1);
  // The car, side on, low in the frame.
  const cx = w * 0.5;
  const cy = fy - h * 0.02;
  const cw = w * 0.3;
  const body = mixHex(palette.secondary, "#3a4a6a", 0.4);
  box(ctx, cx - cw / 2, cy - h * 0.12, cw, h * 0.08, 14 * u, body);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - cw * 0.3, cy - h * 0.12);
  ctx.lineTo(cx - cw * 0.18, cy - h * 0.2);
  ctx.lineTo(cx + cw * 0.18, cy - h * 0.2);
  ctx.lineTo(cx + cw * 0.32, cy - h * 0.12);
  ctx.fill();
  ctx.fillStyle = "#cfe8f7";
  ctx.beginPath();
  ctx.moveTo(cx - cw * 0.25, cy - h * 0.125);
  ctx.lineTo(cx - cw * 0.16, cy - h * 0.185);
  ctx.lineTo(cx - cw * 0.01, cy - h * 0.185);
  ctx.lineTo(cx - cw * 0.01, cy - h * 0.125);
  ctx.moveTo(cx + cw * 0.02, cy - h * 0.125);
  ctx.lineTo(cx + cw * 0.02, cy - h * 0.185);
  ctx.lineTo(cx + cw * 0.16, cy - h * 0.185);
  ctx.lineTo(cx + cw * 0.27, cy - h * 0.125);
  ctx.fill();
  for (const wx of [cx - cw * 0.3, cx + cw * 0.3]) {
    ctx.fillStyle = "#2b2f38";
    ctx.beginPath();
    ctx.arc(wx, cy - h * 0.035, h * 0.04, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#b8bec9";
    ctx.beginPath();
    ctx.arc(wx, cy - h * 0.035, h * 0.016, 0, TAU);
    ctx.fill();
  }
  // Foam on the roof and bonnet.
  const r = rng(41);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  for (let i = 0; i < 18; i++) {
    const x = cx - cw * 0.42 + r() * cw * 0.84;
    const onRoof = Math.abs(x - cx) < cw * 0.18;
    const y = (onRoof ? cy - h * 0.2 : cy - h * 0.12) + Math.sin(T * 1.5 + i) * 1.5 * u;
    ctx.beginPath();
    ctx.arc(x, y, (8 + r() * 10) * u, 0, TAU);
    ctx.fill();
  }
}

const DRAW: Record<SceneBackdrop, (sc: SkillContext) => void> = { office, city, construction, hospital, classroom, home, shop, cafe, kitchen, bedroom, bathroom, house, salon, restaurant, bakery, garage, gym, yoga, florist, bookstore, hotel, asian, antique, thrift, music, repair, church, roofing, plumbing, lawn, cleaning, icecream, law, dental, accounting, electrical, hvac, photo, petgroom, tattoo, moving, carwash };

/** Draw a cartoon scene background, if `backdrop` is one. Returns whether it drew. */
export function sceneStage(sc: SkillContext, backdrop: string | undefined, opts: { bare?: boolean } = {}) {
  const f = DRAW[backdrop as SceneBackdrop];
  if (!f) return false;
  sc.ctx.save();
  brand = sc.palette;
  bare = !!opts.bare;
  indoor = false;
  f(sc);
  if (indoor) finishIndoor(sc);
  indoor = false;
  bare = false;
  brand = undefined;
  sc.ctx.restore();
  return true;
}
