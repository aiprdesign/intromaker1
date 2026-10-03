/**
 * Epic screens: ten trailer-grade title moments for the epic trailer cut. Each is one cinematic
 * event built around the title: a light, a landscape, a material or a camera move.
 *
 * - Anamorphic Flare: a blue anamorphic streak sweeps the frame and leaves the title lit behind it.
 * - Monolith: a dark slab rises out of the fog on a horizon, rim-lit, the title above it.
 * - Sand Reveal: wind blows sand across the frame and the title forms where it settles.
 * - Ember Title: embers rise through heat while the title cools from white-hot to metal.
 * - Steel Title: an extruded chrome title tilts up into place over its reflection, a glint crossing it.
 * - Eclipse: the moon slides over the sun, the corona blooms at totality and the title appears.
 * - Countdown: 3, 2, 1 on heavy numerals and sweeping timer rings, then the title hits.
 * - Searchlights: premiere searchlights sweep the night sky behind the title.
 * - Rift Open: a seam of light tears open down the frame and the title glows inside it.
 * - Blade Slash: a blade of light cuts the frame diagonally and the halves slide apart on the title.
 *
 * Brightness changes are slow or local (no full-frame strobes); light uses gradients, so the
 * looks hold with glow switched off.
 */
import { background, bevel, drawLayout, dust, exitT, extrude, headline, headlineGradient, shake, subline } from "../fx";
import { clamp, ease, hashString, lerp, mixHex, range, rgba, rng, TAU } from "../math";
import { scratch } from "../scratch";
import { displayFont, drawTracked, type HeadlineLayout } from "../text";
import type { SfxCue, Skill, SkillContext } from "../types";

const bottomOf = (l: HeadlineLayout) => l.ys[l.ys.length - 1] + l.size * 0.5;
const topOf = (l: HeadlineLayout) => l.ys[0] - l.size * 0.5;
const exitOf = (sc: SkillContext) => ease.inCubic(exitT(sc, 0.5));
/** Additive light on dark stages; plain painting on light ones. */
const lightOp = (sc: SkillContext): GlobalCompositeOperation => (sc.palette.light ? "source-over" : "lighter");

/** Draw the title through a clip of any shape (the reveal edge of several screens). */
function titleFill(sc: SkillContext, layout: HeadlineLayout, top: string, bottom: string) {
  const { ctx } = sc;
  ctx.fillStyle = headlineGradient(sc, layout, top, bottom);
  drawLayout(sc, layout);
}

/* ───────────────────────── Anamorphic Flare ───────────────────────── */

function anamorphicFlare(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette } = sc;
  background(sc);
  dust(sc, 70, palette.secondary, 0.08);
  const ex = exitOf(sc);
  const layout = headline(sc, { cy: h * 0.47, sizeFrac: 0.24 });
  const cy = (layout.ys[0] + layout.ys[layout.ys.length - 1]) / 2;
  // The streak's hot core crosses the frame once, then rests dimly on the title.
  const sweep = ease.inOutCubic(range(t, 0.25, 1.35));
  const coreX = lerp(-w * 0.15, w * 1.15, sweep);
  const rest = range(t, 1.35, 2.2);
  const streakA = (t < 1.35 ? 1 : 1 - 0.65 * rest) * clamp(t / 0.25) * (1 - ex);
  // Title: revealed behind the core (soft edge), lit from the streak.
  const edge = sweep >= 1 ? w * 2 : coreX;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, Math.max(0, edge), h);
  ctx.clip();
  ctx.globalAlpha = 1 - ex;
  extrude(sc, layout, { depth: 8 });
  titleFill(sc, layout, palette.text, mixHex(palette.text, palette.secondary, 0.45));
  bevel(sc, layout, 0.6);
  ctx.restore();
  // The streak: a long horizontal line of light with a soft vertical falloff.
  ctx.save();
  ctx.globalCompositeOperation = lightOp(sc);
  ctx.globalAlpha = streakA;
  const band = ctx.createLinearGradient(0, cy - 60 * u, 0, cy + 60 * u);
  band.addColorStop(0, rgba(palette.secondary, 0));
  band.addColorStop(0.5, rgba(palette.secondary, 0.35));
  band.addColorStop(1, rgba(palette.secondary, 0));
  ctx.fillStyle = band;
  ctx.fillRect(0, cy - 60 * u, w, 120 * u);
  const line = ctx.createLinearGradient(coreX - w * 0.6, 0, coreX + w * 0.6, 0);
  line.addColorStop(0, rgba(palette.secondary, 0));
  line.addColorStop(0.5, rgba("#ffffff", 0.95));
  line.addColorStop(1, rgba(palette.secondary, 0));
  ctx.fillStyle = line;
  ctx.fillRect(0, cy - 2 * u, w, 4 * u);
  // The core: a small hot bloom, and lens ghosts mirrored through the frame centre.
  const core = ctx.createRadialGradient(coreX, cy, 0, coreX, cy, 70 * u);
  core.addColorStop(0, rgba("#ffffff", 0.85));
  core.addColorStop(0.3, rgba(palette.secondary, 0.4));
  core.addColorStop(1, rgba(palette.secondary, 0));
  ctx.fillStyle = core;
  ctx.fillRect(coreX - 70 * u, cy - 70 * u, 140 * u, 140 * u);
  for (const [k, r, a] of [
    [0.6, 36, 0.16],
    [1.1, 22, 0.22],
    [1.6, 60, 0.1],
  ] as const) {
    const gx = w / 2 - (coreX - w / 2) * k;
    const gy = cy - (cy - h / 2) * k;
    ctx.strokeStyle = rgba(palette.secondary, a);
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(gx, gy, r * u, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  subline(sc, bottomOf(layout) + 52 * u, range(t, Math.min(1.6, d * 0.5), Math.min(2.2, d * 0.7)), { alpha: 1 - ex });
}

/* ───────────────────────── Monolith ───────────────────────── */

function monolith(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette } = sc;
  background(sc);
  const ex = exitOf(sc);
  const portrait = h > w;
  const horizon = h * 0.72;
  // Camera: a slow push towards the slab.
  const push = 1 + 0.06 * ease.inOutCubic(range(t, 0, d));
  ctx.save();
  ctx.translate(w / 2, horizon);
  ctx.scale(push, push);
  ctx.translate(-w / 2, -horizon);
  // Ground: a dark plane with a glow line at the horizon.
  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, mixHex(palette.bg1, palette.secondary, 0.12));
  ground.addColorStop(1, palette.bg0);
  ctx.fillStyle = ground;
  ctx.fillRect(-w, horizon, w * 3, h);
  const hg = ctx.createLinearGradient(0, horizon - 40 * u, 0, horizon + 40 * u);
  hg.addColorStop(0, rgba(palette.secondary, 0));
  hg.addColorStop(0.5, rgba(palette.secondary, 0.35));
  hg.addColorStop(1, rgba(palette.secondary, 0));
  ctx.fillStyle = hg;
  ctx.fillRect(-w, horizon - 40 * u, w * 3, 80 * u);
  // The slab rises out of the ground, slowing as it settles (a rumble at the end).
  const rise = ease.outCubic(range(t, 0.2, 2.2));
  const sw = portrait ? w * 0.26 : w * 0.11;
  const sh = h * (portrait ? 0.42 : 0.5);
  const sh2 = shake(sc, 2.2, 6, 0.5);
  const sx = w / 2 - sw / 2 + sh2.x;
  const sy = horizon - sh * rise + sh2.y;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w, -h, w * 3, horizon + h);
  ctx.clip();
  const slab = ctx.createLinearGradient(sx, 0, sx + sw, 0);
  slab.addColorStop(0, mixHex(palette.bg0, "#000000", 0.4));
  slab.addColorStop(0.5, mixHex(palette.bg1, "#000000", 0.2));
  slab.addColorStop(1, mixHex(palette.bg0, "#000000", 0.5));
  ctx.fillStyle = slab;
  ctx.fillRect(sx, sy, sw, sh);
  // Rim light on both edges and the top.
  ctx.fillStyle = rgba(palette.secondary, 0.75);
  ctx.fillRect(sx, sy, Math.max(1, 2 * u), sh);
  ctx.fillRect(sx + sw - Math.max(1, 2 * u), sy, Math.max(1, 2 * u), sh);
  ctx.fillStyle = rgba(palette.secondary, 0.45);
  ctx.fillRect(sx, sy, sw, Math.max(1, 2 * u));
  ctx.restore();
  // Fog drifts across the foot of the slab.
  for (let i = 0; i < 3; i++) {
    const fx = ((t * (20 + i * 12) * u + i * w * 0.4) % (w * 1.6)) - w * 0.3;
    const fog = ctx.createRadialGradient(fx, horizon, 0, fx, horizon, w * 0.5);
    fog.addColorStop(0, rgba(palette.text, 0.07));
    fog.addColorStop(1, rgba(palette.text, 0));
    ctx.fillStyle = fog;
    ctx.fillRect(fx - w * 0.5, horizon - h * 0.2, w, h * 0.4);
  }
  ctx.restore();
  dust(sc, 60, palette.secondary, 0.06);
  // Title above the slab, its tracking closing in as the slab settles.
  const layout = headline(sc, { cy: h * (portrait ? 0.16 : 0.15), sizeFrac: 0.16 });
  const k = ease.outCubic(range(t, 1.4, 2.6));
  ctx.save();
  ctx.globalAlpha = k * (1 - ex);
  const wide = { ...layout, tracking: layout.tracking + layout.size * 0.5 * (1 - k) };
  titleFill(sc, wide, palette.text, mixHex(palette.text, palette.secondary, 0.4));
  ctx.restore();
  subline(sc, bottomOf(layout) + 40 * u, range(t, 2.2, 2.8), { alpha: 1 - ex });
}

/* ───────────────────────── Sand Reveal ───────────────────────── */

const grainCache = new Map<string, { x: number; y: number }[]>();

/** Points inside the title as drawn by `layout`, sampled at a quarter scale (cached). */
function titleGrains(sc: SkillContext, layout: HeadlineLayout, max: number) {
  const key = `${sc.scene.text}|${sc.font}|${sc.w}x${sc.h}|${layout.size.toFixed(1)}|${max}`;
  const hit = grainCache.get(key);
  if (hit) return hit;
  const k = 0.25;
  const cw = Math.max(1, Math.round(sc.w * k));
  const ch = Math.max(1, Math.round(sc.h * k));
  const { ctx: o } = scratch("epic-grains", cw, ch);
  o.fillStyle = "#fff";
  o.font = displayFont(sc.font, layout.size * k);
  o.textAlign = "center";
  o.textBaseline = "middle";
  layout.lines.forEach((line, i) => drawTracked(o, line, cw / 2, layout.ys[i] * k, layout.tracking * k));
  const data = o.getImageData(0, 0, cw, ch).data;
  const pts: { x: number; y: number }[] = [];
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (data[(y * cw + x) * 4 + 3] > 128) pts.push({ x: x / k, y: y / k });
  const out: { x: number; y: number }[] = [];
  const stride = Math.max(1, pts.length / max);
  for (let i = 0; i < pts.length && out.length < max; i += stride) out.push(pts[Math.floor(i)]);
  if (grainCache.size > 32) grainCache.clear();
  grainCache.set(key, out);
  return out;
}

function sandReveal(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, seed } = sc;
  background(sc);
  const ex = exitOf(sc);
  const layout = headline(sc, { cy: h * 0.46, sizeFrac: 0.24 });
  const grains = titleGrains(sc, layout, 3600);
  const r = rng(seed + 77);
  // A wind front sweeps left to right; each grain flies in on it and settles in place.
  const front = (x: number) => 0.3 + (x / w) * 1.3;
  // Pale sand on dark stages, deep ochre on light ones.
  const sand = palette.light ? mixHex(palette.secondary, "#7a5626", 0.7) : mixHex(palette.secondary, "#f0d3a4", 0.65);
  ctx.save();
  ctx.fillStyle = sand;
  let settledAll = true;
  for (const g of grains) {
    const jitter = r();
    const at = front(g.x) + jitter * 0.35;
    const fly = 0.55;
    const q = clamp((t - (at - fly)) / fly);
    if (q < 1) settledAll = false;
    if (q <= 0) continue;
    const e = ease.outCubic(q);
    const lift = (1 - e) * (40 + jitter * 90) * u;
    const x = lerp(g.x - w * 0.45 - jitter * w * 0.2, g.x, e);
    const y = g.y - lift * Math.sin(e * Math.PI) + (1 - e) * (r() - 0.5) * 60 * u;
    // Leaving, the wind takes the grains on to the right.
    const blow = ease.inCubic(range(t, d - 0.9 + (g.x / w) * 0.3, d - 0.1));
    ctx.globalAlpha = (0.7 + 0.3 * e) * (1 - blow * 0.9);
    ctx.fillRect(x + blow * w * (0.4 + jitter * 0.4), y - blow * 30 * u * jitter, 3.4 * u, 3.4 * u);
  }
  ctx.restore();
  // Once it has settled, the title firms up into solid type over the grains.
  const solid = ease.inOutCubic(range(t, Math.min(2.0, d * 0.5), Math.min(2.8, d * 0.7))) * (1 - ex);
  if (solid > 0 || settledAll) {
    ctx.save();
    ctx.globalAlpha = solid;
    titleFill(sc, layout, mixHex(sand, "#ffffff", 0.3), mixHex(sand, palette.bg0, 0.25));
    ctx.restore();
  }
  // Loose drift keeps blowing across the frame.
  ctx.save();
  ctx.fillStyle = sand;
  for (let i = 0; i < 90; i++) {
    const hsh = hashString(`${seed}:drift:${i}`);
    const y = ((hsh % 1000) / 1000) * h;
    const sp = 0.3 + ((hsh >>> 10) % 100) / 100;
    const x = ((t * sp * w * 0.6 + ((hsh >>> 3) % 1000) / 1000 * w) % (w * 1.2)) - w * 0.1;
    ctx.globalAlpha = 0.25 * (1 - ex);
    ctx.fillRect(x, y, 3 * u * sp, 1.2 * u);
  }
  ctx.restore();
  subline(sc, bottomOf(layout) + 52 * u, range(t, Math.min(2.8, d * 0.7), Math.min(3.3, d * 0.85)), { alpha: 1 - ex });
}

/* ───────────────────────── Ember Title ───────────────────────── */

function emberTitle(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, seed } = sc;
  background(sc, { hot: "#ff6a1a", hotAlpha: 0.18 });
  const ex = exitOf(sc);
  // Heat glow along the bottom.
  const heat = ctx.createLinearGradient(0, h * 0.6, 0, h);
  heat.addColorStop(0, rgba("#ff5a14", 0));
  heat.addColorStop(1, rgba("#ff5a14", 0.22 * (1 - ex)));
  ctx.fillStyle = heat;
  ctx.fillRect(0, h * 0.6, w, h * 0.4);
  // Embers: each rises on its own path, wavering and flickering.
  ctx.save();
  ctx.globalCompositeOperation = lightOp(sc);
  for (let i = 0; i < 140; i++) {
    const hsh = hashString(`${seed}:ember:${i}`);
    const r1 = (hsh % 1000) / 1000;
    const r2 = ((hsh >>> 10) % 1000) / 1000;
    const sp = 0.12 + r2 * 0.22;
    const q = (t * sp + r1) % 1;
    const x = r1 * w + Math.sin(t * (1 + r2 * 2) + i) * 24 * u + q * 40 * u * (r2 - 0.5);
    const y = h * (1.05 - q * 1.15);
    const flick = 0.55 + 0.45 * Math.sin(t * (9 + r2 * 7) + i * 1.7);
    const size = (1.2 + r2 * 2.6) * u;
    ctx.globalAlpha = flick * Math.sin(q * Math.PI) * 0.9 * (1 - ex);
    ctx.fillStyle = r2 > 0.6 ? "#ffd27a" : "#ff7a2a";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // Title: forged white-hot, cooling to the film's metal.
  const layout = headline(sc, { cy: h * 0.46, sizeFrac: 0.24 });
  const appear = ease.outCubic(range(t, 0.3, 1.1));
  const cool = ease.inOutCubic(range(t, 1.0, Math.min(3.2, d * 0.75)));
  const hot = mixHex("#fff4d6", "#ff8a2a", cool * 0.6);
  const top = mixHex(hot, palette.text, cool);
  const bottom = mixHex("#ff7a1a", mixHex(palette.text, palette.secondary, 0.5), cool);
  ctx.save();
  ctx.globalAlpha = appear * (1 - ex);
  ctx.translate(0, (1 - appear) * 16 * u);
  extrude(sc, layout, { depth: 10, color: mixHex("#5a1a00", palette.bg0, cool) });
  titleFill(sc, layout, top, bottom);
  bevel(sc, layout, 0.5 + 0.3 * cool);
  ctx.restore();
  subline(sc, bottomOf(layout) + 52 * u, range(t, Math.min(1.8, d * 0.5), Math.min(2.4, d * 0.65)), { alpha: 1 - ex });
}

/* ───────────────────────── Steel Title ───────────────────────── */

function steelTitle(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette } = sc;
  background(sc);
  dust(sc, 50, palette.secondary, 0.06);
  const ex = exitOf(sc);
  const layout = headline(sc, { cy: h * 0.44, sizeFrac: 0.26 });
  const cy = (layout.ys[0] + layout.ys[layout.ys.length - 1]) / 2;
  const blockH = bottomOf(layout) - topOf(layout);
  // Tilts up from lying back (a rotateX read as vertical squash) and settles with a small bounce.
  const tilt = clamp(1 - Math.exp(-Math.max(0, t - 0.2) * 5) * Math.cos(Math.max(0, t - 0.2) * 6), 0, 1.03);
  const sy = lerp(0.12, 1, tilt);
  const steel = (g: CanvasGradient) => {
    // Brushed chrome: alternating light and dark bands down the letters.
    const stops: [number, string][] = [
      [0, mixHex("#ffffff", palette.secondary, 0.15)],
      [0.42, mixHex("#8f97a6", palette.bg1, 0.2)],
      [0.5, mixHex("#2a2f3a", palette.bg0, 0.3)],
      [0.58, mixHex("#c9d0dc", palette.secondary, 0.1)],
      [1, mixHex("#5d6472", palette.bg0, 0.2)],
    ];
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  };
  const drawTitle = (mirror: boolean) => {
    ctx.save();
    ctx.translate(w / 2, cy + (mirror ? blockH * 1.02 : 0));
    ctx.scale(1, sy * (mirror ? -1 : 1));
    ctx.translate(-w / 2, -cy);
    extrude(sc, layout, { depth: 14, color: mixHex("#1b1f27", palette.bg0, 0.3) });
    ctx.fillStyle = steel(ctx.createLinearGradient(0, topOf(layout), 0, bottomOf(layout)));
    drawLayout(sc, layout);
    bevel(sc, layout, 0.7);
    ctx.restore();
  };
  ctx.save();
  ctx.globalAlpha = clamp((t - 0.15) / 0.3) * (1 - ex);
  // The floor reflection, faded out downward.
  ctx.save();
  ctx.globalAlpha *= 0.22;
  drawTitle(true);
  ctx.restore();
  const fade = ctx.createLinearGradient(0, cy + blockH * 0.5, 0, cy + blockH * 1.6);
  fade.addColorStop(0, rgba(palette.bg0, 0));
  fade.addColorStop(1, rgba(palette.bg0, 1));
  ctx.fillStyle = fade;
  ctx.fillRect(0, cy + blockH * 0.5, w, blockH * 1.2);
  drawTitle(false);
  ctx.restore();
  // A glint sweeps the letters once they have settled (clipped to the type on a scratch layer).
  const p = range(t, 1.3, 2.3);
  if (p > 0 && p < 1) {
    const { canvas, ctx: m } = scratch("steel-glint", w, h);
    m.font = ctx.font;
    m.textAlign = "center";
    m.textBaseline = "middle";
    m.fillStyle = "#fff";
    layout.lines.forEach((line, i) => drawTracked(m, line, w / 2, layout.ys[i], layout.tracking));
    m.globalCompositeOperation = "source-in";
    const x = lerp(-w * 0.2, w * 1.2, p);
    const g = m.createLinearGradient(x - w * 0.08, 0, x + w * 0.08, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.75)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    m.fillStyle = g;
    m.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
  }
  subline(sc, cy + blockH * 0.5 + 60 * u, range(t, Math.min(1.8, d * 0.5), Math.min(2.4, d * 0.65)), { alpha: 1 - ex });
}

/* ───────────────────────── Eclipse ───────────────────────── */

function eclipse(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette } = sc;
  background(sc);
  dust(sc, 90, palette.text, 0.03);
  const ex = exitOf(sc);
  const short = Math.min(w, h);
  const R = short * 0.17;
  const cx = w / 2;
  const cy = h * 0.36;
  const total = Math.min(2.2, d * 0.55);
  // The moon slides across; totality at `total`.
  const k = ease.inOutCubic(range(t, 0.1, total));
  const mx = cx + lerp(R * 2.4, 0, k);
  const totality = ease.outCubic(range(t, total - 0.15, total + 0.6));
  const sunA = 1 - 0.85 * totality;
  ctx.save();
  ctx.globalCompositeOperation = lightOp(sc);
  // Sun glow, dimming as it is covered.
  const glowR = R * (2.2 + 1.2 * totality);
  const sg = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, glowR);
  sg.addColorStop(0, rgba(palette.secondary, 0.5 * (sunA * 0.6 + 0.4)));
  sg.addColorStop(1, rgba(palette.secondary, 0));
  ctx.fillStyle = sg;
  ctx.globalAlpha = 1 - ex;
  ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);
  ctx.fillStyle = rgba(mixHex("#fff6e0", palette.secondary, 0.25), sunA);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();
  // Corona streaks at totality.
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU + Math.sin(i * 3.7) * 0.08 + t * 0.03;
    const len = R * (0.35 + ((i * 37) % 10) / 14) * totality;
    const g = ctx.createLinearGradient(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len));
    g.addColorStop(0, rgba("#ffffff", 0.5 * totality));
    g.addColorStop(1, rgba(palette.secondary, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.2 * u;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.lineTo(cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len));
    ctx.stroke();
  }
  ctx.restore();
  // The moon (a disc of the night itself), and the diamond-ring glint just before totality.
  ctx.save();
  ctx.globalAlpha = 1 - ex * 0.5;
  ctx.fillStyle = palette.bg0;
  ctx.beginPath();
  ctx.arc(mx, cy, R * 1.01, 0, TAU);
  ctx.fill();
  ctx.restore();
  const ring = range(t, total - 0.35, total - 0.05) * (1 - range(t, total, total + 0.25));
  if (ring > 0) {
    ctx.save();
    ctx.globalCompositeOperation = lightOp(sc);
    const gx = cx - R * 0.92;
    const gy = cy - R * 0.3;
    const dg = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 0.5);
    dg.addColorStop(0, rgba("#ffffff", 0.9 * ring));
    dg.addColorStop(1, rgba("#ffffff", 0));
    ctx.fillStyle = dg;
    ctx.fillRect(gx - R * 0.5, gy - R * 0.5, R, R);
    ctx.restore();
  }
  // The title below, in the corona's light.
  const layout = headline(sc, { cy: h * 0.72, sizeFrac: 0.15 });
  ctx.save();
  ctx.globalAlpha = totality * (1 - ex);
  ctx.translate(0, (1 - totality) * 20 * u);
  titleFill(sc, layout, palette.text, mixHex(palette.text, palette.secondary, 0.5));
  ctx.restore();
  subline(sc, bottomOf(layout) + 40 * u, range(t, total + 0.4, total + 1), { alpha: 1 - ex });
}

/* ───────────────────────── Countdown ───────────────────────── */

const countStep = (beat: number) => clamp(beat, 0.45, 0.7);

function countdown(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette } = sc;
  background(sc);
  const ex = exitOf(sc);
  const short = Math.min(w, h);
  const step = countStep(sc.beat);
  const start = 0.2;
  const hit = start + step * 3;
  const cx = w / 2;
  const cy = h * 0.47;
  if (t < hit) {
    const i = Math.floor((t - start) / step);
    const n = 3 - Math.max(0, i);
    const local = t - (start + Math.max(0, i) * step);
    const q = clamp(local / step);
    const R = short * 0.3;
    // Timer rings: an outer ring sweeps round once per number; tick marks around it.
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    ctx.strokeStyle = rgba(palette.text, 0.14);
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * TAU;
      const long = k % 5 === 0;
      ctx.strokeStyle = rgba(palette.text, long ? 0.35 : 0.15);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R + 10 * u), cy + Math.sin(a) * (R + 10 * u));
      ctx.lineTo(cx + Math.cos(a) * (R + (long ? 26 : 18) * u), cy + Math.sin(a) * (R + (long ? 26 : 18) * u));
      ctx.stroke();
    }
    ctx.strokeStyle = palette.secondary;
    ctx.lineWidth = 6 * u;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * ease.inOutCubic(q));
    ctx.stroke();
    // Inner ring counter-sweeping.
    ctx.strokeStyle = rgba(palette.primary, 0.6);
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.84, Math.PI / 2, Math.PI / 2 - TAU * ease.outCubic(q), true);
    ctx.stroke();
    // The numeral: lands heavy, then drifts back.
    const land = ease.outExpo(clamp(local / 0.18));
    const s = lerp(1.35, 1, land) * (1 - 0.06 * q);
    const sh2 = shake(sc, start + Math.max(0, i) * step, 10, 0.25);
    ctx.translate(cx + sh2.x, cy + sh2.y);
    ctx.scale(s, s);
    ctx.font = displayFont(sc.font, R * 1.15);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = headlineGradient(sc, { lines: ["0"], size: R, lineHeight: R, ys: [0], tracking: 0 }, palette.text, palette.secondary);
    ctx.globalAlpha = clamp(land * 1.5) * (1 - 0.4 * q) * (1 - ex);
    ctx.fillText(String(n), 0, R * 0.04);
    ctx.restore();
    return;
  }
  // The hit: the title slams in.
  const local = t - hit;
  const k = ease.outExpo(clamp(local / 0.25));
  const layout = headline(sc, { cy, sizeFrac: 0.26 });
  const sh2 = shake(sc, hit, 18, 0.4);
  ctx.save();
  ctx.translate(w / 2 + sh2.x, cy + sh2.y);
  const s = lerp(1.6, 1, k) * (1 + 0.03 * range(t, hit, d));
  ctx.scale(s, s);
  ctx.translate(-w / 2, -cy);
  ctx.globalAlpha = clamp(k * 2) * (1 - ex);
  extrude(sc, layout, { depth: 12 });
  titleFill(sc, layout, palette.text, mixHex(palette.text, palette.secondary, 0.5));
  bevel(sc, layout, 0.6);
  ctx.restore();
  // A ring of light expands from the hit (local, not a full-frame flash).
  const rq = ease.outCubic(clamp(local / 0.7));
  ctx.save();
  ctx.globalAlpha = (1 - rq) * 0.6 * (1 - ex);
  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = 4 * u * (1 - rq) + 1;
  ctx.beginPath();
  ctx.arc(cx, cy, short * (0.2 + rq * 0.6), 0, TAU);
  ctx.stroke();
  ctx.restore();
  subline(sc, bottomOf(layout) + 52 * u, range(t, hit + 0.4, hit + 1), { alpha: 1 - ex });
}

/* ───────────────────────── Searchlights ───────────────────────── */

function searchlights(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette } = sc;
  background(sc);
  const ex = exitOf(sc);
  // Night sky: deeper at the top.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, rgba(mixHex(palette.bg0, "#000000", 0.3), 0.7));
  sky.addColorStop(1, rgba(palette.bg0, 0));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  dust(sc, 80, palette.text, 0.02);
  // Beams from below the frame, sweeping and crossing.
  const n = 5;
  const on = ease.outCubic(range(t, 0.1, 0.9));
  ctx.save();
  ctx.globalCompositeOperation = lightOp(sc);
  for (let i = 0; i < n; i++) {
    const bx = w * (0.12 + (i / (n - 1)) * 0.76);
    const by = h * 1.05;
    const a = -Math.PI / 2 + Math.sin(t * (0.5 + i * 0.13) + i * 1.3) * 0.38 + (i - (n - 1) / 2) * 0.06;
    const len = Math.hypot(w, h) * 1.1;
    const spread = 0.055;
    const tipL = { x: bx + Math.cos(a - spread) * len, y: by + Math.sin(a - spread) * len };
    const tipR = { x: bx + Math.cos(a + spread) * len, y: by + Math.sin(a + spread) * len };
    const g = ctx.createLinearGradient(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len);
    g.addColorStop(0, rgba(mixHex(palette.secondary, "#ffffff", 0.5), (palette.light ? 0.18 : 0.32) * on));
    g.addColorStop(1, rgba(palette.secondary, 0));
    ctx.fillStyle = g;
    ctx.globalAlpha = 1 - ex;
    ctx.beginPath();
    ctx.moveTo(bx - 6 * u, by);
    ctx.lineTo(tipL.x, tipL.y);
    ctx.lineTo(tipR.x, tipR.y);
    ctx.lineTo(bx + 6 * u, by);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // The title, lit from below.
  const layout = headline(sc, { cy: h * 0.46, sizeFrac: 0.24 });
  const k = ease.outCubic(range(t, 0.5, 1.4));
  ctx.save();
  ctx.globalAlpha = k * (1 - ex);
  ctx.translate(0, (1 - k) * 20 * u);
  extrude(sc, layout, { depth: 12 });
  titleFill(sc, layout, mixHex(palette.text, palette.secondary, 0.25), palette.text);
  bevel(sc, layout, 0.7);
  ctx.restore();
  subline(sc, bottomOf(layout) + 52 * u, range(t, Math.min(1.6, d * 0.5), Math.min(2.2, d * 0.65)), { alpha: 1 - ex });
}

/* ───────────────────────── Rift Open ───────────────────────── */

function riftOpen(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, seed } = sc;
  background(sc);
  const ex = exitOf(sc);
  const layout = headline(sc, { cy: h * 0.47, sizeFrac: 0.22 });
  const blockW = Math.min(w * 0.9, Math.max(...layout.lines.map((l) => sc.ctx.measureText(l).width + layout.tracking * l.length)));
  // The tear: a jagged vertical seam that splits open to the title's width.
  const open = ease.inOutCubic(range(t, 0.35, 1.6));
  // Opens to the title's width, kept to a tear in tall frames rather than the whole picture.
  const half = Math.min(blockW * 0.58 + 30 * u, w * (h > w ? 0.34 : 0.5)) * open + 2 * u;
  const r = rng(seed + 5);
  const steps = 22;
  const jag = Array.from({ length: steps + 1 }, () => (r() - 0.5) * 40 * u);
  const edge = (side: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const y = (i / steps) * h;
      // Narrower at the ends, like a tear.
      const taper = Math.sin((i / steps) * Math.PI) ** 1.4;
      pts.push([w / 2 + side * half * taper + jag[i] * (0.4 + open), y]);
    }
    return pts;
  };
  const L = edge(-1);
  const R = edge(1);
  const path = () => {
    ctx.beginPath();
    L.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    [...R].reverse().forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
  };
  // Inside the rift: deep light (never white) and the title.
  ctx.save();
  path();
  ctx.clip();
  const inside = ctx.createLinearGradient(w / 2 - half, 0, w / 2 + half, 0);
  inside.addColorStop(0, mixHex(palette.bg1, palette.primary, 0.5));
  inside.addColorStop(0.5, mixHex(palette.bg1, palette.secondary, 0.35));
  inside.addColorStop(1, mixHex(palette.bg1, palette.primary, 0.5));
  ctx.globalAlpha = 1 - ex;
  ctx.fillStyle = inside;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  ctx.save();
  // The title glows in the opening, then holds once it is wide open.
  const k = ease.outCubic(range(t, 0.8, 1.8));
  ctx.globalAlpha = k * (1 - ex);
  extrude(sc, layout, { depth: 8 });
  titleFill(sc, layout, palette.text, mixHex(palette.text, palette.secondary, 0.5));
  bevel(sc, layout, 0.6);
  ctx.restore();
  // Burning edges.
  ctx.save();
  ctx.globalCompositeOperation = lightOp(sc);
  ctx.globalAlpha = (0.9 - 0.4 * range(t, 1.8, d)) * (1 - ex);
  for (const side of [L, R]) {
    ctx.strokeStyle = rgba(mixHex(palette.secondary, "#ffffff", 0.4), 0.9);
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    side.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = rgba(palette.secondary, 0.25);
    ctx.lineWidth = 14 * u;
    ctx.stroke();
  }
  // Sparks thrown off the edges while it opens.
  const sparkA = range(t, 0.35, 0.6) * (1 - range(t, 1.4, 2.2));
  for (let i = 0; i < 60; i++) {
    const hsh = hashString(`${seed}:spark:${i}`);
    const r1 = (hsh % 1000) / 1000;
    const r2 = ((hsh >>> 10) % 1000) / 1000;
    const q = (t * (0.8 + r2) + r1) % 1;
    const side = i % 2 ? 1 : -1;
    const y0 = r1 * h;
    const x = w / 2 + side * (half + q * 120 * u * (0.5 + r2));
    const y = y0 + q * q * 80 * u;
    ctx.globalAlpha = sparkA * (1 - q) * (1 - ex);
    ctx.fillStyle = "#ffe2a8";
    ctx.fillRect(x, y, 2.2 * u, 2.2 * u);
  }
  ctx.restore();
  subline(sc, bottomOf(layout) + 52 * u, range(t, Math.min(1.9, d * 0.55), Math.min(2.5, d * 0.7)), { alpha: 1 - ex });
}

/* ───────────────────────── Blade Slash ───────────────────────── */

function bladeSlash(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette } = sc;
  const ex = exitOf(sc);
  // Behind the plate: the stage and the lit title.
  background(sc, { hot: palette.secondary, hotAlpha: 0.2 });
  const layout = headline(sc, { cy: h * 0.47, sizeFrac: 0.24 });
  const slashAt = 0.45;
  const cut = ease.inExpo(range(t, slashAt, slashAt + 0.16));
  const part = ease.outCubic(range(t, slashAt + 0.16, slashAt + 0.9));
  ctx.save();
  ctx.globalAlpha = clamp(part * 2) * (1 - ex);
  extrude(sc, layout, { depth: 12 });
  titleFill(sc, layout, palette.text, mixHex(palette.text, palette.secondary, 0.5));
  bevel(sc, layout, 0.6);
  ctx.restore();
  // The cut line runs corner to corner, a little off the diagonal.
  const ax = -w * 0.05;
  const ay = h * 0.85;
  const bx = w * 1.05;
  const by = h * 0.15;
  const nx = -(by - ay);
  const ny = bx - ax;
  const nl = Math.hypot(nx, ny);
  const off = part * Math.max(w, h) * 0.7;
  // The plate: two halves of the dark stage, sliding apart along the cut's normal.
  const halfPoly = (side: number) => {
    ctx.beginPath();
    if (side < 0) {
      ctx.moveTo(-w, -h);
      ctx.lineTo(w * 2, -h);
      ctx.lineTo(bx + (bx - ax) * 2, by + (by - ay) * 2);
      ctx.lineTo(ax - (bx - ax) * 2, ay - (by - ay) * 2);
    } else {
      ctx.moveTo(-w, h * 2);
      ctx.lineTo(w * 2, h * 2);
      ctx.lineTo(bx + (bx - ax) * 2, by + (by - ay) * 2);
      ctx.lineTo(ax - (bx - ax) * 2, ay - (by - ay) * 2);
    }
    ctx.closePath();
  };
  if (part < 1) {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate((side * nx * off) / nl, (side * ny * off) / nl);
      halfPoly(side);
      ctx.clip();
      const plate = ctx.createLinearGradient(0, 0, w, h);
      plate.addColorStop(0, mixHex(palette.bg0, "#000000", 0.25));
      plate.addColorStop(1, mixHex(palette.bg1, "#000000", 0.35));
      ctx.fillStyle = plate;
      ctx.fillRect(-w, -h, w * 3, h * 3);
      ctx.restore();
    }
  }
  // The blade of light: drawn on as it cuts, then fading as the halves part.
  const shown = cut;
  const fade = 1 - part;
  if (shown > 0 && fade > 0) {
    const ex2 = lerp(ax, bx, shown);
    const ey2 = lerp(ay, by, shown);
    ctx.save();
    ctx.globalCompositeOperation = lightOp(sc);
    ctx.globalAlpha = fade * (1 - ex);
    ctx.lineCap = "round";
    ctx.strokeStyle = rgba(palette.secondary, 0.35);
    ctx.lineWidth = 18 * u;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ex2, ey2);
    ctx.stroke();
    ctx.strokeStyle = rgba("#ffffff", 0.95);
    ctx.lineWidth = 3 * u;
    ctx.stroke();
    ctx.restore();
  }
  // The impact shakes the frame a touch (applied to the next paint via the subline offset).
  const sh2 = shake(sc, slashAt + 0.16, 10, 0.35);
  ctx.save();
  ctx.translate(sh2.x, sh2.y);
  subline(sc, bottomOf(layout) + 52 * u, range(t, Math.min(1.5, d * 0.45), Math.min(2.1, d * 0.6)), { alpha: 1 - ex });
  ctx.restore();
}

/* ───────────────────────── Registry ───────────────────────── */

const cue = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });

export const epicSkills: Skill[] = [
  {
    id: "anamorphic-flare",
    name: "Anamorphic Flare",
    tagline: "A blue anamorphic streak sweeps the frame with lens ghosts in tow and leaves the title lit in its wake.",
    bestFor: "Sleek tech and sci-fi title moments, reveals and outros. 1–3 words.",
    sample: { text: "NEXT GEN", subtext: "Coming soon" },
    render: anamorphicFlare,
    sfx: () => [cue(0.25, "whoosh"), cue(1.3, "shimmer")],
  },
  {
    id: "monolith",
    name: "Monolith",
    tagline: "A dark slab rises out of the fog on a glowing horizon, rim-lit, as the title's letters close in above it.",
    bestFor: "Big, mysterious openers and sci-fi or space titles. 1–3 words.",
    sample: { text: "ORIGIN", subtext: "The beginning" },
    render: monolith,
    sfx: () => [cue(0.2, "whoosh"), cue(2.2, "strike")],
  },
  {
    id: "sand-reveal",
    name: "Sand Reveal",
    tagline: "Wind blows a front of sand across the frame and the title forms where the grains settle, then firms into solid type.",
    bestFor: "Desert, adventure, fantasy and history epics; also slow, grand brand titles. 1–2 words.",
    sample: { text: "DUNES", subtext: "A new world" },
    render: sandReveal,
    sfx: () => [cue(0.3, "whoosh"), cue(2.4, "shimmer")],
  },
  {
    id: "ember-title",
    name: "Ember Title",
    tagline: "Embers rise through the heat while the title, forged white-hot, cools into the film's metal.",
    bestFor: "Fantasy, war, games and anything forged or fiery. 1–3 words.",
    sample: { text: "FORGED", subtext: "In fire" },
    render: emberTitle,
    sfx: () => [cue(0.3, "whoosh"), cue(1.0, "shimmer")],
  },
  {
    id: "steel-title",
    name: "Steel Title",
    tagline: "An extruded chrome title tilts up into place over its own floor reflection, and a glint runs across the steel.",
    bestFor: "Blockbuster product and game titles, automotive, hardware, 80s chrome. 1–2 words.",
    sample: { text: "TITAN", subtext: "Built to last" },
    render: steelTitle,
    sfx: () => [cue(0.2, "whoosh"), cue(0.7, "strike"), cue(1.3, "shimmer")],
  },
  {
    id: "eclipse",
    name: "Eclipse",
    tagline: "The moon slides over the sun, a diamond ring flashes at the edge, the corona blooms and the title appears below.",
    bestFor: "Space, science, astronomy and dramatic once-in-a-lifetime moments. 1–3 words.",
    sample: { text: "TOTALITY", subtext: "One moment" },
    render: eclipse,
    sfx: () => [cue(0.1, "whoosh"), cue(2.1, "shimmer")],
  },
  {
    id: "countdown",
    name: "Countdown",
    tagline: "3, 2, 1 land heavy on sweeping timer rings with a kick apiece, then the title slams in on a ring of light.",
    bestFor: "Launch days, drops, events and premieres. Title of 1–3 words.",
    sample: { text: "LAUNCH DAY", subtext: "Live now" },
    render: countdown,
    sfx: (_s, beat) => {
      const step = countStep(beat);
      return [cue(0.2, "tick"), cue(0.2 + step, "tick"), cue(0.2 + step * 2, "tick"), cue(0.2 + step * 3, "strike")];
    },
  },
  {
    id: "searchlights",
    name: "Searchlights",
    tagline: "Premiere searchlights sweep and cross the night sky behind the title, lit from below.",
    bestFor: "Premieres, openings, awards and big announcements. 1–3 words.",
    sample: { text: "PREMIERE", subtext: "Opening night" },
    render: searchlights,
    sfx: () => [cue(0.1, "whoosh"), cue(0.6, "shimmer")],
  },
  {
    id: "rift-open",
    name: "Rift Open",
    tagline: "A burning seam tears open down the frame, sparks flying, and the title glows inside the rift.",
    bestFor: "Fantasy, sci-fi, gaming and 'a new world' reveals. 1–2 words.",
    sample: { text: "BEYOND", subtext: "Step through" },
    render: riftOpen,
    sfx: () => [cue(0.35, "whoosh"), cue(0.9, "shimmer")],
  },
  {
    id: "blade-slash",
    name: "Blade Slash",
    tagline: "A blade of light cuts the frame corner to corner and the two halves slide apart on the title.",
    bestFor: "Action, martial arts, games and hard-hitting launches. 1–3 words.",
    sample: { text: "UNLEASHED", subtext: "Season one" },
    render: bladeSlash,
    sfx: () => [cue(0.4, "swoosh"), cue(0.61, "strike")],
  },
];
