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

export const SCENES = ["office", "city", "construction", "hospital", "classroom", "home", "shop", "cafe", "kitchen", "bedroom", "bathroom", "house", "salon", "restaurant", "bakery", "garage", "gym", "yoga", "florist", "bookstore", "hotel"] as const;
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
  // A soft wallpaper texture: faint vertical stripes.
  for (let x = 0, i = 0; x < w; x += 34 * u, i++) {
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.022)";
    ctx.fillRect(x, 0, 34 * u, fy - 8 * u);
  }
  // Warm wall-wash lights pooling down from the ceiling.
  for (const fx of [0.22, 0.78]) {
    const lg = ctx.createRadialGradient(w * fx, 0, 0, w * fx, 0, fy * 0.95);
    lg.addColorStop(0, "rgba(255,244,222,0.3)");
    lg.addColorStop(0.55, "rgba(255,244,222,0.06)");
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
  sheen.addColorStop(0, "rgba(255,255,255,0.2)");
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
 * The finishing light over an indoor scene: slow sunbeams slanting in from the upper left with dust
 * motes drifting in them, and a gentle vignette, so the room has depth and air.
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
    g.addColorStop(0, "rgba(255,236,200,0.035)");
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
  for (let i = 0; i < 16; i++) {
    const bx = w * (0.08 + r() * 0.45);
    const by = h * r();
    const x = bx + ((T * (6 + r() * 6) * u + by * 0.3) % (w * 0.15));
    const y = (by + T * (4 + r() * 5) * u) % h;
    ctx.fillStyle = `rgba(255,245,225,${0.18 + 0.15 * Math.sin(T * 1.3 + i)})`;
    ctx.beginPath();
    ctx.arc(x, y, (1.2 + r() * 1.6) * u, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // A gentle vignette.
  const v = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  v.addColorStop(0, "rgba(30,20,10,0)");
  v.addColorStop(1, "rgba(30,20,10,0.2)");
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

const DRAW: Record<SceneBackdrop, (sc: SkillContext) => void> = { office, city, construction, hospital, classroom, home, shop, cafe, kitchen, bedroom, bathroom, house, salon, restaurant, bakery, garage, gym, yoga, florist, bookstore, hotel };

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
