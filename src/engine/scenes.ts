/**
 * Cartoon scene backgrounds for character videos, alongside the meadow: an office, a city street,
 * a construction site, a hospital, a classroom, a living room, a shop and a café. Each is a soft
 * flat illustration with the floor low in the frame (characters stand on it) and the upper middle
 * kept calm and light so headlines read on it. A little life moves on the video's own clock (a
 * clock's hand, a crane's hook, a heart monitor, clouds, steam), so it carries on across cuts.
 * Accents take the video's own colours.
 */
import { mixHex, rgba, rng, TAU } from "./math";
import type { Palette, SkillContext } from "./types";

export const SCENES = ["office", "city", "construction", "hospital", "classroom", "home", "shop", "cafe"] as const;
export type SceneBackdrop = (typeof SCENES)[number];

type C = CanvasRenderingContext2D;

/**
 * The brand: scenes are tinted with the intro's colours so they look made for it. Walls lean to a
 * pale tint of the primary colour, floors a little to the secondary, the sky a touch to the primary,
 * and the colourful details (books, products, bunting, cushions) come from the palette. Set by
 * sceneStage for the scene being drawn.
 */
let brand: Palette | undefined;
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
  const px = w * 0.5;
  const py = h * 0.08;
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
  // A chalkboard to the left with a few chalk scribbles; bunting across the top.
  const cbx = w * 0.04;
  const cbw = h > w ? w * 0.42 : w * 0.26;
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
  // Hanging lights.
  for (const x of [w * 0.38, w * 0.62]) {
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
  // A menu board and pendant lamps.
  const mx = w * 0.06;
  box(ctx, mx, h * 0.14, w * 0.18, h * 0.3, 8 * u, mixHex("#3a3f4c", palette.primary, 0.18));
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  for (let i = 0; i < 4; i++) box(ctx, mx + 16 * u, h * (0.19 + i * 0.06), w * 0.18 - 32 * u - (i % 2) * 30 * u, 6 * u, 3 * u, "rgba(255,255,255,0.7)");
  for (const x of [w * 0.4, w * 0.6, w * 0.8]) {
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

const DRAW: Record<SceneBackdrop, (sc: SkillContext) => void> = { office, city, construction, hospital, classroom, home, shop, cafe };

/** Draw a cartoon scene background, if `backdrop` is one. Returns whether it drew. */
export function sceneStage(sc: SkillContext, backdrop: string | undefined) {
  const f = DRAW[backdrop as SceneBackdrop];
  if (!f) return false;
  sc.ctx.save();
  brand = sc.palette;
  f(sc);
  brand = undefined;
  sc.ctx.restore();
  return true;
}
