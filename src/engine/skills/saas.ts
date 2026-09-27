/**
 * World-class SaaS launch-video skills: the techniques used by top product videos
 * (Linear, Vercel, Stripe, Apple, Raycast, Framer): sentence-case blur reveals, rotating
 * words, cursor-driven UI zoom tours with callouts, bento feature grids, floating glass
 * widgets, pain → solution strikes, integration orbits, real testimonials, logo marquees
 * and a CTA lock-up with a clicked button.
 */
import { exitT } from "../fx";
import { clamp, ease, lerp, range, rgba, rng, TAU } from "../math";
import { getImage, getMedia, isDarkLogo } from "../media";
import {
  blurInLayout,
  borderBeam,
  clickRipple,
  drawCursor,
  drawIcon,
  eyebrow,
  glassCard,
  iconFor,
  pill,
  saasBackground,
  saasFont,
  sentence,
  spring,
  type IconKind,
} from "../saasfx";
import { displayFont, subFont } from "../text";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { parseStat } from "./worlds";
import { drawCover, mockUi } from "./media";

/* ───────── shared helpers ───────── */

/** Muted sentence-case supporting line with a soft blur-in. */
function subText(sc: SkillContext, text: string | undefined, y: number, k: number, opts: { size?: number; maxWidth?: number } = {}) {
  if (!text || k <= 0) return;
  const { ctx, w, u, palette } = sc;
  ctx.save();
  let size = opts.size ?? 34 * u;
  ctx.font = subFont(size, 500);
  const maxW = opts.maxWidth ?? w * 0.7;
  const tw = ctx.measureText(text).width;
  if (tw > maxW) {
    size *= maxW / tw;
    ctx.font = subFont(size, 500);
  }
  const e = ease.outCubic(clamp(k));
  ctx.globalAlpha = e * 0.72;
  const blur = (1 - e) * 8 * u;
  if (blur > 0.5) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.fillStyle = palette.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, y + (1 - e) * 12 * u);
  ctx.restore();
}

/** Auto-highlight the last word with the brand gradient when the copy has no *accent*. */
function accented(text: string) {
  if (text.includes("*")) return text;
  const words = text.trim().split(/\s+/);
  if (words.length < 3) return text;
  const last = words.pop()!;
  const m = last.match(/^(.*?)([.!?,]*)$/)!;
  return `${words.join(" ")} *${m[1]}*${m[2]}`;
}

function stagger(sc: SkillContext) {
  return Math.min(0.11, sc.beat / 2);
}

/** Top-of-frame headline with an optional chapter eyebrow ("How it works") above it. */
function topHeadline(sc: SkillContext) {
  const { w, h, t, d, u, scene } = sc;
  const portrait = h > w;
  const hasEb = !!scene.eyebrow;
  const cy = h * (portrait ? 0.12 : 0.12) + (hasEb ? h * 0.04 : 0);
  const layout = sentence(sc, { text: accented(scene.text), cy, sizeFrac: portrait ? 0.075 : 0.068, widthFrac: 0.84, maxLines: 2 });
  if (hasEb) eyebrow(sc, scene.eyebrow!, layout.ys[0] - layout.size * 0.62 - 26 * u, range(t, 0.05, 0.45) * (1 - range(t, d - 0.4, d)));
  blurInLayout(sc, layout, 0.1, 0.06, { exitAt: d - 0.4 });
  return layout;
}

/** Chapter eyebrow above a centred block whose first line sits at `top`. */
function chapter(sc: SkillContext, top: number, start = 0.05) {
  const { t, d, u, scene } = sc;
  if (scene.eyebrow) eyebrow(sc, scene.eyebrow, top - 40 * u, range(t, start, start + 0.4) * (1 - range(t, d - 0.4, d)));
}

function drawLogoMark(sc: SkillContext, src: string | undefined, cx: number, cy: number, box: number, alpha = 1) {
  const img = getImage(src);
  if (!img || !img.naturalWidth) return false;
  const { ctx } = sc;
  const ar = img.naturalWidth / img.naturalHeight;
  const lw = ar >= 1 ? Math.min(box * 2.2, box * ar) : box * ar;
  const lh = lw / ar;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (isDarkLogo(img)) ctx.filter = "brightness(0) invert(1)";
  ctx.drawImage(img, cx - lw / 2, cy - lh / 2, lw, lh);
  ctx.restore();
  return true;
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/* ───────────────────────── Blur Reveal ───────────────────────── */

function blurReveal(sc: SkillContext) {
  const { w, h, t, d, u, scene } = sc;
  saasBackground(sc);
  const exitAt = d - 0.45;
  const layout = sentence(sc, { text: accented(scene.text), cy: h * 0.47, sizeFrac: 0.115, widthFrac: 0.8, maxLines: h > w ? 4 : 3 });
  const top = layout.ys[0] - layout.size * 0.62;
  eyebrow(sc, scene.eyebrow ?? scene.items?.[0] ?? "", top - 44 * u, range(t, 0.05, 0.5) * (1 - range(t, exitAt, exitAt + 0.3)));
  const n = blurInLayout(sc, layout, 0.2, stagger(sc), { exitAt });
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.62;
  subText(sc, scene.subtext, bottom + 46 * u, range(t, 0.35 + n * stagger(sc), 0.95 + n * stagger(sc)) * (1 - range(t, exitAt, exitAt + 0.4)));
}

/* ───────────────────────── Word Swap ───────────────────────── */

function parseSwap(scene: Scene) {
  const text = scene.text.trim();
  if (text.includes("|")) {
    const parts = text.split("|").map((p) => p.trim());
    const firstWords = parts[0].split(/\s+/);
    const firstAlt = firstWords.pop() ?? "";
    return { prefix: firstWords.join(" "), alts: [firstAlt, ...parts.slice(1)].filter(Boolean) };
  }
  if (scene.items?.length) return { prefix: text, alts: scene.items };
  const words = text.split(/\s+/);
  const last = words.pop() ?? "";
  return { prefix: words.join(" "), alts: [last] };
}

function swapTiming(scene: Scene, beat: number) {
  const { alts } = parseSwap(scene);
  const interval = Math.max(0.55, beat * 2);
  const first = 0.35;
  const swaps = alts.slice(1).map((_, i) => first + 0.5 + interval * (i + 1) - interval / 2);
  return { interval, first, swaps };
}

function wordSwap(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc);
  const { prefix, alts } = parseSwap(scene);
  const { swaps } = swapTiming(scene, sc.beat);
  const font = saasFont(sc);
  const short = Math.min(w, h);
  // Fit "prefix + widest alternative" on one line.
  ctx.font = displayFont(font, 100);
  const trk = (s: string, size: number) => -0.045 * size * Math.max(0, s.length - 1);
  const widest = Math.max(...alts.map((a) => ctx.measureText(a).width + trk(a, 100)));
  const pw100 = prefix ? ctx.measureText(prefix).width + trk(prefix, 100) : 0;
  const space100 = prefix ? ctx.measureText(" ").width : 0;
  const size = Math.min(short * 0.14, (100 * w * 0.86) / (pw100 + space100 + widest));
  const k = size / 100;
  ctx.font = displayFont(font, size);
  ctx.textBaseline = "middle";
  const cy = h * 0.46;
  const widths = alts.map((a) => (ctx.measureText(a).width + trk(a, size)));
  let idx = 0;
  for (let i = 0; i < swaps.length; i++) if (t >= swaps[i]) idx = i + 1;
  const since = idx > 0 ? t - swaps[idx - 1] : t;
  const sp = idx > 0 ? clamp(spring(since, 11, 8)) : 1;
  const slotW = idx > 0 ? lerp(widths[idx - 1], widths[idx], sp) : widths[0];
  const total = pw100 * k + space100 * k + slotW;
  const x0 = w / 2 - total / 2;
  const intro = ease.outCubic(range(t, 0.25, 0.9));
  const ex = range(t, d - 0.45, d);

  const drawWord = (word: string, x: number, y: number) => {
    let cx = x;
    for (const ch of word) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width - 0.045 * size;
    }
  };
  ctx.save();
  ctx.globalAlpha = intro * (1 - ex);
  const blur = (1 - intro) * 12 * u + ex * 10 * u;
  if (blur > 0.5) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.textAlign = "left";
  ctx.fillStyle = palette.text;
  if (prefix) drawWord(prefix, x0, cy + (1 - intro) * 20 * u);
  // Rotating word inside a clipped slot.
  const sx = x0 + (pw100 + space100) * k;
  ctx.beginPath();
  ctx.rect(sx - size * 0.1, cy - size * 0.72, slotW + size * 0.3, size * 1.44);
  ctx.clip();
  const grad = (x: number, wd: number) => {
    const g = ctx.createLinearGradient(x, cy - size / 2, x + wd, cy + size / 2);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    return g;
  };
  if (idx > 0 && sp < 1.2) {
    const out = clamp(since / 0.35);
    ctx.save();
    ctx.globalAlpha *= 1 - out;
    ctx.fillStyle = grad(sx, widths[idx - 1]);
    drawWord(alts[idx - 1], sx, cy - out * size * 0.9);
    ctx.restore();
  }
  ctx.fillStyle = grad(sx, widths[idx]);
  ctx.shadowColor = rgba(palette.primary, 0.6);
  ctx.shadowBlur = 30 * u;
  drawWord(alts[idx], sx, cy + (1 - sp) * size * 0.9 + (1 - intro) * 20 * u);
  ctx.restore();
  // Underline sweep under the active word.
  ctx.save();
  ctx.globalAlpha = intro * (1 - ex);
  ctx.fillStyle = palette.primary;
  const uw = slotW * ease.outExpo(clamp(idx > 0 ? since / 0.6 : range(t, 0.5, 1.1)));
  ctx.fillRect(sx, cy + size * 0.62, uw, 4 * u);
  ctx.restore();
  subText(sc, scene.subtext, cy + size * 1.25, range(t, 0.8, 1.4) * (1 - ex));
}

/* ───────────────────────── UI Zoom Tour ───────────────────────── */

function tourTiming(d: number) {
  const zoomA = 0.95;
  const clickA = zoomA + 0.95;
  const zoomB = Math.max(clickA + 0.9, d * 0.5);
  const clickB = zoomB + 0.95;
  const out = Math.max(clickB + 0.7, d - 1.05);
  return { zoomA, clickA, zoomB, clickB, out };
}

function uiTour(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand, seed } = sc;
  saasBackground(sc, { beams: 3 });
  const T = tourTiming(d);
  const portrait = h > w;
  const ww = portrait ? w * 0.9 : Math.min(w * 0.74, h * 0.62 * 1.6);
  const wh = portrait ? ww * 1.15 : ww / 1.6;
  const fcx = w / 2;
  const fcy = portrait ? h * 0.57 : h * 0.585;
  const fx0 = fcx - ww / 2;
  const fy0 = fcy - wh / 2;
  const bar = 30 * u;
  const r = rng(seed);
  const hot = [
    { x: 0.26 + r() * 0.12, y: 0.32 + r() * 0.12 },
    { x: 0.62 + r() * 0.12, y: 0.55 + r() * 0.15 },
  ].map((p) => ({ x: fx0 + p.x * ww, y: fy0 + bar + p.y * (wh - bar) }));
  const Z = 1.85;

  // Camera keyframes.
  const center = { x: fcx, y: fcy };
  const kA = ease.inOutCubic(range(t, T.zoomA, T.zoomA + 0.85));
  const kB = ease.inOutCubic(range(t, T.zoomB, T.zoomB + 0.85));
  const kOut = ease.inOutCubic(range(t, T.out, T.out + 0.75));
  let focus = { x: lerp(center.x, hot[0].x, kA), y: lerp(center.y, hot[0].y, kA) };
  focus = { x: lerp(focus.x, hot[1].x, kB), y: lerp(focus.y, hot[1].y, kB) };
  focus = { x: lerp(focus.x, center.x, kOut), y: lerp(focus.y, center.y, kOut) };
  const z = 1 + (Z - 1) * kA * (1 - kOut);
  const toScreen = (p: { x: number; y: number }) => ({ x: (p.x - focus.x) * z + fcx, y: (p.y - focus.y) * z + fcy });

  const intro = clamp(spring(t - 0.1, 10, 7));
  const ex = ease.inCubic(exitT(sc, 0.4));
  ctx.save();
  ctx.globalAlpha = clamp(t / 0.3) * (1 - ex);
  ctx.translate(fcx, fcy + (1 - intro) * h * 0.12);
  ctx.scale(z * lerp(0.88, 1, intro), z * lerp(0.88, 1, intro));
  ctx.translate(-focus.x, -focus.y);
  // Browser frame.
  glassCard(sc, fx0 - 1, fy0 - 1, ww + 2, wh + 2, { r: 16 * u });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(fx0, fy0, ww, wh, 16 * u);
  ctx.clip();
  ctx.fillStyle = "#121019";
  ctx.fillRect(fx0, fy0, ww, bar);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(fx0 + 18 * u + i * 16 * u, fy0 + bar / 2, 5 * u, 0, TAU);
    ctx.fill();
  });
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(fcx - ww * 0.18, fy0 + bar * 0.2, ww * 0.36, bar * 0.6, bar * 0.3);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = subFont(11 * u, 500);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(brand?.domain ?? "app.yourproduct.com", fcx, fy0 + bar / 2);
  const media = getMedia(scene.media ?? (brand?.images[0] ? { src: brand.images[0], kind: "image" } : undefined), t);
  if (media) drawCover(ctx, media, fx0, fy0 + bar, ww, wh - bar, 1, 0.5, 0.2);
  else mockUi(sc, fx0, fy0 + bar, ww, wh - bar);
  ctx.restore();
  // Highlight rings on the clicked regions.
  hot.forEach((p, i) => {
    const click = i === 0 ? T.clickA : T.clickB;
    const k = clamp(spring(t - click, 12, 8)) * (1 - kOut * 0.6);
    if (t < click) return;
    const rw = ww * 0.24;
    const rh = (wh - bar) * 0.18;
    ctx.save();
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 2.2 * u / z;
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = 18 * u;
    ctx.globalAlpha *= clamp(k);
    ctx.beginPath();
    ctx.roundRect(p.x - (rw / 2) * k, p.y - (rh / 2) * k, rw * k, rh * k, 10 * u);
    ctx.stroke();
    ctx.fillStyle = rgba(palette.primary, 0.08);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  // Callouts + cursor in screen space.
  const labels = [scene.items?.[0] ?? scene.subtext, scene.items?.[1]];
  hot.forEach((p, i) => {
    const click = i === 0 ? T.clickA : T.clickB;
    const until = i === 0 ? T.zoomB + 0.3 : T.out + 0.2;
    const k = clamp(spring(t - click - 0.12, 12, 8)) * (1 - range(t, until, until + 0.3));
    if (!labels[i] || k <= 0) return;
    const s = toScreen(p);
    ctx.save();
    ctx.globalAlpha = clamp(k) * (1 - ex);
    const y = s.y - 70 * u - (1 - k) * 16 * u;
    pill(sc, labels[i]!, clamp(s.x + 60 * u, 240 * u, w - 240 * u), y, {
      size: 28 * u,
      fill: rgba(palette.bg0, 0.9),
      border: rgba(palette.primary, 0.7),
    });
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5 * u, 0, TAU);
    ctx.fill();
    ctx.restore();
  });
  const a = toScreen(hot[0]);
  const b = toScreen(hot[1]);
  const start = { x: w * 0.92, y: h * 1.05 };
  let cur = start;
  const toA = ease.inOutCubic(range(t, T.zoomA + 0.1, T.clickA - 0.05));
  cur = { x: lerp(start.x, a.x, toA), y: lerp(start.y, a.y, toA) };
  const toB = ease.inOutCubic(range(t, T.zoomB + 0.1, T.clickB - 0.05));
  cur = { x: lerp(cur.x, b.x, toB), y: lerp(cur.y, b.y, toB) };
  const away = ease.inCubic(range(t, T.out, T.out + 0.6));
  cur = { x: lerp(cur.x, w * 1.05, away), y: lerp(cur.y, h * 1.1, away) };
  const press = Math.max(1 - Math.abs(t - T.clickA) / 0.12, 1 - Math.abs(t - T.clickB) / 0.12, 0);
  clickRipple(sc, a.x, a.y, range(t, T.clickA, T.clickA + 0.6));
  clickRipple(sc, b.x, b.y, range(t, T.clickB, T.clickB + 0.6));
  if (t > T.zoomA) drawCursor(sc, cur.x, cur.y, press);

  // Pinned headline on a shade band.
  const band = ctx.createLinearGradient(0, 0, 0, h * 0.26);
  band.addColorStop(0, rgba(palette.bg0, 0.95));
  band.addColorStop(1, rgba(palette.bg0, 0));
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, h * 0.26);
  topHeadline(sc);
}

/* ───────────────────────── Bento Grid ───────────────────────── */

type Cell = [number, number, number, number];
const BENTO_LAND: Record<number, Cell[]> = {
  2: [[0, 0, 2, 2], [2, 0, 2, 2]],
  3: [[0, 0, 2, 2], [2, 0, 2, 1], [2, 1, 2, 1]],
  4: [[0, 0, 2, 1], [2, 0, 2, 1], [0, 1, 2, 1], [2, 1, 2, 1]],
  5: [[0, 0, 2, 1], [2, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 2, 1]],
  6: [[0, 0, 2, 1], [2, 0, 1, 1], [3, 0, 1, 2], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]],
};
const BENTO_PORT: Record<number, Cell[]> = {
  2: [[0, 0, 2, 2], [0, 2, 2, 2]],
  3: [[0, 0, 2, 2], [0, 2, 2, 1], [0, 3, 2, 1]],
  4: [[0, 0, 2, 1], [0, 1, 2, 1], [0, 2, 2, 1], [0, 3, 2, 1]],
  5: [[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1], [0, 2, 2, 1], [0, 3, 2, 1]],
  6: [[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1], [0, 2, 1, 1], [1, 2, 1, 1], [0, 3, 2, 1]],
};

function bentoItems(scene: Scene) {
  const items = (scene.items ?? []).filter(Boolean).slice(0, 6);
  return items.length >= 2 ? items : ["Feature one", "Feature two", "Feature three", "Feature four"];
}

function bentoTiming(scene: Scene, beat: number) {
  const n = bentoItems(scene).length;
  const st = Math.min(0.14, beat / 2);
  return Array.from({ length: n }, (_, i) => 0.45 + i * st);
}

function microVisual(sc: SkillContext, kind: number, x: number, y: number, mw: number, mh: number, lt: number) {
  const { ctx, u, palette } = sc;
  const g = ctx.createLinearGradient(x, y + mh, x + mw, y);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.save();
  switch (kind % 6) {
    case 0: {
      // Bars growing.
      const n = 7;
      const bw = mw / (n * 1.6);
      for (let i = 0; i < n; i++) {
        const hh = mh * (0.25 + 0.7 * ((i * 37) % 100) / 100) * ease.outExpo(range(lt, 0.2 + i * 0.06, 1 + i * 0.06));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x + i * bw * 1.6, y + mh - hh, bw, hh, 4 * u);
        ctx.fill();
      }
      break;
    }
    case 1: {
      // Toggle flips on.
      const on = ease.outBack(range(lt, 0.7, 1.1));
      const tw = Math.min(mw * 0.5, 110 * u);
      const th = tw * 0.52;
      const tx = x + mw - tw;
      const ty = y + mh / 2 - th / 2;
      ctx.fillStyle = on > 0.5 ? g : "rgba(255,255,255,0.14)";
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, th / 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(tx + th / 2 + (tw - th) * clamp(on), ty + th / 2, th * 0.4, 0, TAU);
      ctx.fill();
      break;
    }
    case 2: {
      // Progress ring.
      const rr = Math.min(mw, mh) * 0.42;
      const cx = x + mw - rr - 4 * u;
      const cy = y + mh / 2;
      const p = 0.78 * ease.outExpo(range(lt, 0.3, 1.5));
      ctx.lineWidth = 9 * u;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + TAU * p);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = subFont(rr * 0.5, 700);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.round(p * 100)}%`, cx, cy);
      break;
    }
    case 3: {
      // Avatar stack.
      const rr = Math.min(mh * 0.32, 26 * u);
      const cols = [palette.primary, palette.secondary, palette.accent, "#f59e0b"];
      for (let i = 0; i < 4; i++) {
        const k = ease.outBack(range(lt, 0.3 + i * 0.1, 0.7 + i * 0.1));
        const cx = x + mw - rr - i * rr * 1.4;
        ctx.save();
        ctx.translate(cx, y + mh / 2);
        ctx.scale(k, k);
        ctx.fillStyle = cols[i];
        ctx.strokeStyle = sc.palette.bg0;
        ctx.lineWidth = 4 * u;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(0, -rr * 0.2, rr * 0.35, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, rr * 0.55, rr * 0.6, rr * 0.4, 0, Math.PI, 0);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 4: {
      // Sparkline drawing on.
      const p = ease.inOutCubic(range(lt, 0.2, 1.3));
      ctx.lineWidth = 4 * u;
      ctx.lineJoin = "round";
      ctx.strokeStyle = g;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = 12 * u;
      ctx.beginPath();
      const n = 24;
      for (let i = 0; i <= n * p; i++) {
        const px = x + (i / n) * mw;
        const py = y + mh * (0.85 - 0.6 * (i / n) - 0.12 * Math.sin(i * 1.3));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    }
    default: {
      // Checklist ticking.
      for (let i = 0; i < 3; i++) {
        const k = ease.outBack(range(lt, 0.3 + i * 0.2, 0.7 + i * 0.2));
        const ry = y + (i + 0.5) * (mh / 3);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.roundRect(x + mw * 0.35, ry - 6 * u, mw * 0.6, 12 * u, 6 * u);
        ctx.fill();
        ctx.save();
        ctx.translate(x + mw * 0.22, ry);
        ctx.scale(k, k);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 11 * u, 0, TAU);
        ctx.fill();
        drawIcon(ctx, "check", 0, 0, 20 * u, "#fff");
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function bento(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 2 });
  const portrait = h > w;
  const items = bentoItems(scene);
  const n = items.length;
  const cells = (portrait ? BENTO_PORT : BENTO_LAND)[n];
  const cols = portrait ? 2 : 4;
  const rows = portrait ? 4 : 2;
  topHeadline(sc);
  const gx0 = w * 0.07;
  const gy0 = h * (portrait ? 0.2 : 0.25);
  const gw = w * 0.86;
  const gh = h * (portrait ? 0.74 : 0.68);
  const gap = 16 * u;
  const cw = (gw - gap * (cols - 1)) / cols;
  const rh = (gh - gap * (rows - 1)) / rows;
  const times = bentoTiming(scene, sc.beat);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const active = Math.floor(Math.max(0, t - 1.4) / Math.max(0.5, sc.beat * 2)) % n;
  cells.forEach(([c, r, cs, rs], i) => {
    const x = gx0 + c * (cw + gap);
    const y = gy0 + r * (rh + gap);
    const bw = cs * cw + (cs - 1) * gap;
    const bh = rs * rh + (rs - 1) * gap;
    const lt = t - times[i];
    if (lt <= 0) return;
    const s = clamp(spring(lt, 11, 7), 0, 1.1);
    ctx.save();
    ctx.globalAlpha = clamp(lt / 0.25) * (1 - ex);
    ctx.translate(x + bw / 2, y + bh / 2 + (1 - Math.min(1, s)) * 36 * u - ex * 20 * u);
    const sc2 = 0.9 + 0.1 * s;
    ctx.scale(sc2, sc2);
    ctx.translate(-(x + bw / 2), -(y + bh / 2));
    const lit = i === active && t > 1.4;
    glassCard(sc, x, y, bw, bh, { r: 20 * u, tint: lit ? palette.bg1 : undefined });
    if (lit) borderBeam(sc, x, y, bw, bh, (t - 1.4) * 0.6, { r: 20 * u });
    // Icon tile.
    const it = 52 * u;
    const ig = ctx.createLinearGradient(x + 22 * u, y + 22 * u, x + 22 * u + it, y + 22 * u + it);
    ig.addColorStop(0, palette.primary);
    ig.addColorStop(1, palette.secondary);
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.roundRect(x + 22 * u, y + 22 * u, it, it, 14 * u);
    ctx.fill();
    drawIcon(ctx, iconFor(items[i], i) as IconKind, x + 22 * u + it / 2, y + 22 * u + it / 2, it * 0.52, "#fff");
    // Label.
    const fs = Math.min(30 * u, bw / 11);
    ctx.font = `700 ${Math.round(fs)}px Inter, sans-serif`;
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const words = items[i].split(" ");
    const lines: string[] = [];
    let line = "";
    for (const wd of words) {
      const next = line ? `${line} ${wd}` : wd;
      if (ctx.measureText(next).width > bw - 44 * u && line) {
        lines.push(line);
        line = wd;
      } else line = next;
    }
    lines.push(line);
    lines.slice(-2).forEach((l, li, arr) => ctx.fillText(l, x + 22 * u, y + bh - 24 * u - (arr.length - 1 - li) * fs * 1.2));
    // Micro visual in the upper-right area.
    const mx = x + bw * 0.45;
    const my = y + 22 * u;
    const mw = bw * 0.5 - 22 * u;
    const mh = Math.max(40 * u, bh - 22 * u - (lines.length > 1 ? fs * 2.6 : fs * 1.5) - 40 * u);
    microVisual(sc, i, mx, my, mw, Math.min(mh, bh * 0.55), lt);
    ctx.restore();
  });
}

/* ───────────────────────── Floating UI Cards ───────────────────────── */

function cardsTiming(beat: number) {
  const st = Math.max(0.3, beat);
  return [0.8, 0.8 + st, 0.8 + st * 2, 0.8 + st * 3];
}

function uiCards(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 2 });
  const portrait = h > w;
  topHeadline(sc);
  const ex = ease.inCubic(exitT(sc, 0.4));
  // Central product screen.
  const sw = portrait ? w * 0.78 : w * 0.5;
  const sh = sw / (portrait ? 0.9 : 1.6);
  const scx = w / 2;
  const scy = portrait ? h * 0.55 : h * 0.58;
  const k0 = clamp(spring(t - 0.2, 9, 7), 0, 1.05);
  ctx.save();
  ctx.globalAlpha = clamp(t / 0.3) * (1 - ex);
  ctx.translate(scx, scy + (1 - Math.min(1, k0)) * 60 * u);
  ctx.transform(1, 0, -0.06, 1, 0, 0);
  ctx.scale(0.92 + 0.08 * k0, 0.92 + 0.08 * k0);
  glassCard(sc, -sw / 2, -sh / 2, sw, sh, { r: 16 * u });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-sw / 2, -sh / 2, sw, sh, 16 * u);
  ctx.clip();
  const media = getMedia(scene.media ?? (brand?.images[0] ? { src: brand.images[0], kind: "image" } : undefined), t);
  if (media) drawCover(ctx, media, -sw / 2, -sh / 2, sw, sh, 1.02, 0.5, 0.25);
  else mockUi(sc, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();
  borderBeam(sc, -sw / 2, -sh / 2, sw, sh, t * 0.35, { r: 16 * u, alpha: 0.8 });
  ctx.restore();

  const times = cardsTiming(sc.beat);
  const items = scene.items ?? [];
  const stat = parseStat(items[1] ?? scene.subtext ?? "");
  const widgets = [
    { x: scx - sw * 0.72, y: scy - sh * 0.46, w: 300 * u, h: 86 * u, kind: "toast" },
    { x: scx + sw * 0.36, y: scy + sh * 0.12, w: 250 * u, h: 150 * u, kind: "metric" },
    { x: scx - sw * 0.66, y: scy + sh * 0.2, w: 220 * u, h: 130 * u, kind: "chart" },
    { x: scx + sw * 0.32, y: scy - sh * 0.56, w: 250 * u, h: 80 * u, kind: "avatars" },
  ];
  const WS = portrait ? 1.25 : 1.4;
  if (portrait) {
    widgets[0].x = w * 0.06;
    widgets[1].x = w * 0.94 - widgets[1].w;
    widgets[2].x = w * 0.06;
    widgets[3].x = w * 0.94 - widgets[3].w;
  }
  widgets.forEach((wd, i) => {
    const lt = t - times[i];
    if (lt <= 0) return;
    const s = clamp(spring(lt, 12, 7), 0, 1.1);
    const float = Math.sin(t * 1.3 + i * 1.7) * 7 * u;
    ctx.save();
    ctx.globalAlpha = clamp(lt / 0.2) * (1 - ex);
    ctx.translate(wd.x + wd.w / 2, wd.y + wd.h / 2 + float);
    ctx.scale((0.7 + 0.3 * s) * WS, (0.7 + 0.3 * s) * WS);
    ctx.translate(-wd.w / 2, -wd.h / 2);
    glassCard(sc, 0, 0, wd.w, wd.h, { r: 16 * u });
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const g = ctx.createLinearGradient(0, 0, wd.w, wd.h);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    if (wd.kind === "toast") {
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(16 * u, wd.h / 2 - 22 * u, 44 * u, 44 * u, 12 * u);
      ctx.fill();
      drawIcon(ctx, "sparkle", 38 * u, wd.h / 2, 24 * u, "#fff");
      ctx.fillStyle = palette.text;
      ctx.font = subFont(19 * u, 700);
      const title = items[0] ?? "Updated just now";
      ctx.fillText(title.length > 26 ? `${title.slice(0, 25)}…` : title, 74 * u, wd.h / 2 - 11 * u);
      ctx.fillStyle = rgba(palette.text, 0.55);
      ctx.font = subFont(15 * u, 500);
      ctx.fillText(brand?.name ? `${brand.name} · now` : "just now", 74 * u, wd.h / 2 + 14 * u);
    } else if (wd.kind === "metric") {
      const count = ease.outExpo(range(lt, 0.1, 1.4));
      const v = stat.value * count;
      const txt = `${stat.prefix}${stat.decimals ? v.toFixed(stat.decimals) : Math.round(v).toLocaleString("en-US")}${stat.suffix}`;
      ctx.fillStyle = g;
      ctx.font = `800 ${Math.round(40 * u)}px Inter, sans-serif`;
      ctx.fillText(txt, 20 * u, 50 * u);
      ctx.fillStyle = rgba(palette.text, 0.6);
      ctx.font = subFont(16 * u, 500);
      ctx.fillText((stat.label || "growth").slice(0, 24), 20 * u, 88 * u);
      microVisual(sc, 4, 20 * u, 100 * u, wd.w - 40 * u, wd.h - 112 * u, lt);
    } else if (wd.kind === "chart") {
      ctx.fillStyle = rgba(palette.text, 0.6);
      ctx.font = subFont(15 * u, 600);
      ctx.fillText(items[2] ?? "This week", 18 * u, 24 * u);
      microVisual(sc, 0, 18 * u, 42 * u, wd.w - 36 * u, wd.h - 58 * u, lt);
    } else {
      microVisual(sc, 3, 12 * u, 10 * u, 120 * u, wd.h - 20 * u, lt);
      ctx.fillStyle = palette.text;
      ctx.font = subFont(17 * u, 700);
      ctx.fillText((items[3] ?? "Your whole team").slice(0, 18), 138 * u, wd.h / 2);
    }
    ctx.restore();
  });
}

/* ───────────────────────── Pain Points ───────────────────────── */

function painTiming(scene: Scene, beat: number) {
  const n = Math.max(1, (scene.items ?? []).length);
  const step = Math.max(0.45, beat);
  const appear = Array.from({ length: n }, (_, i) => 0.2 + i * step);
  const strike = appear.map((a) => a + step * 0.9);
  const clear = strike[n - 1] + 0.45;
  return { appear, strike, clear, solve: clear + 0.2 };
}

function painStrike(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1, aurora: 0.6 });
  const items = (scene.items ?? []).slice(0, 4);
  const T = painTiming(scene, sc.beat);
  const clearK = ease.inCubic(range(t, T.clear, T.clear + 0.35));
  if (items.length && clearK < 1) {
    const size = Math.min(70 * u, (w * 0.8) / Math.max(8, Math.max(...items.map((i) => i.length)) * 0.55));
    const lh = size * 1.55;
    const top = h * 0.46 - ((items.length - 1) * lh) / 2;
    chapter(sc, top - lh * 0.4);
    ctx.save();
    ctx.font = `700 ${Math.round(size)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    items.forEach((it, i) => {
      const k = ease.outCubic(range(t, T.appear[i], T.appear[i] + 0.45));
      if (k <= 0) return;
      const sk = ease.inOutCubic(range(t, T.strike[i], T.strike[i] + 0.3));
      const y = top + i * lh - clearK * 30 * u;
      ctx.save();
      ctx.globalAlpha = k * (1 - 0.6 * sk) * (1 - clearK);
      const blur = (1 - k) * 10 * u + clearK * 12 * u;
      if (blur > 0.5) ctx.filter = `blur(${blur.toFixed(1)}px)`;
      ctx.fillStyle = palette.text;
      ctx.fillText(it, w / 2, y + (1 - k) * 16 * u);
      const tw = ctx.measureText(it).width;
      if (sk > 0) {
        ctx.globalAlpha = (1 - clearK);
        ctx.fillStyle = "#ff4d6d";
        ctx.shadowColor = "#ff4d6d";
        ctx.shadowBlur = 12 * u;
        ctx.fillRect(w / 2 - tw / 2 - 10 * u, y - 2 * u, (tw + 20 * u) * sk, 5 * u);
      }
      ctx.restore();
    });
    ctx.restore();
  }
  // The solution line.
  const solveAt = items.length ? T.solve : 0.2;
  if (t >= solveAt - 0.05) {
    const layout = sentence(sc, { text: accented(scene.text), cy: h * 0.46, sizeFrac: 0.11, widthFrac: 0.8, maxLines: 3 });
    const n = blurInLayout(sc, layout, solveAt, stagger(sc), { exitAt: d - 0.45 });
    const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.62;
    subText(sc, scene.subtext, bottom + 44 * u, range(t, solveAt + 0.3 + n * stagger(sc), solveAt + 0.9 + n * stagger(sc)) * (1 - range(t, d - 0.45, d)));
  }
}

/* ───────────────────────── Integration Orbit ───────────────────────── */

const ORBIT_ICONS: IconKind[] = ["chat", "chart", "cloud", "code", "globe", "shield", "users", "clock", "layers", "bolt", "sparkle", "check"];

function orbit(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { grid: true, beams: 2 });
  const portrait = h > w;
  const short = Math.min(w, h);
  const cx = w / 2;
  const cy = portrait ? h * 0.44 : h * 0.43;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const rings = [
    { r: short * 0.22, n: 6, speed: 0.18 },
    { r: short * 0.37, n: 9, speed: -0.12 },
  ];
  // Orbit guides.
  ctx.save();
  ctx.globalAlpha = (1 - ex) * clamp(t / 0.5);
  ctx.strokeStyle = rgba(palette.text, 0.08);
  ctx.lineWidth = 1.2 * u;
  rings.forEach((rg) => {
    ctx.beginPath();
    ctx.arc(cx, cy, rg.r, 0, TAU);
    ctx.stroke();
  });
  ctx.restore();
  let idx = 0;
  rings.forEach((rg, ri) => {
    for (let i = 0; i < rg.n; i++) {
      const delay = 0.35 + idx * 0.05;
      const k = clamp(spring(t - delay, 10, 7), 0, 1.1);
      if (t < delay) {
        idx++;
        continue;
      }
      const a = (i / rg.n) * TAU + t * rg.speed + ri * 0.3;
      const rr = rg.r * Math.min(1, k);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      // Connector + data pulse (inner ring only).
      if (ri === 0) {
        ctx.save();
        ctx.globalAlpha = 0.5 * (1 - ex);
        const lg = ctx.createLinearGradient(cx, cy, x, y);
        lg.addColorStop(0, rgba(palette.primary, 0.6));
        lg.addColorStop(1, rgba(palette.primary, 0.05));
        ctx.strokeStyle = lg;
        ctx.lineWidth = 1.5 * u;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.stroke();
        const p = ((t * 0.8 + i / rg.n) % 1);
        ctx.fillStyle = palette.primary;
        ctx.shadowColor = palette.primary;
        ctx.shadowBlur = 10 * u;
        ctx.beginPath();
        ctx.arc(lerp(x, cx, p), lerp(y, cy, p), 3.5 * u, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      const ts = (ri === 0 ? 96 : 80) * u;
      ctx.save();
      ctx.globalAlpha = clamp(k) * (1 - ex);
      glassCard(sc, x - ts / 2, y - ts / 2, ts, ts, { r: 16 * u });
      const hue = [palette.primary, palette.secondary, palette.accent][idx % 3];
      drawIcon(ctx, ORBIT_ICONS[idx % ORBIT_ICONS.length], x, y, ts * 0.46, hue);
      ctx.restore();
      idx++;
    }
  });
  // Centre: the brand.
  const ck = clamp(spring(t - 0.1, 9, 6), 0, 1.1);
  const cs = short * 0.13 * ck;
  ctx.save();
  ctx.globalAlpha = clamp(ck) * (1 - ex);
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, cs * 2.2);
  halo.addColorStop(0, rgba(palette.primary, 0.45));
  halo.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - cs * 2.5, cy - cs * 2.5, cs * 5, cs * 5);
  glassCard(sc, cx - cs, cy - cs, cs * 2, cs * 2, { r: 28 * u, tint: palette.bg1 });
  borderBeam(sc, cx - cs, cy - cs, cs * 2, cs * 2, t * 0.5, { r: 28 * u });
  if (!drawLogoMark(sc, brand?.logo, cx, cy, cs * 1.1)) {
    ctx.fillStyle = palette.text;
    ctx.font = `800 ${Math.round(cs)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((brand?.name ?? scene.text).slice(0, 1).toUpperCase(), cx, cy);
  }
  ctx.restore();
  const layout = sentence(sc, { text: accented(scene.text), cy: portrait ? h * 0.8 : h * 0.86, sizeFrac: 0.07, widthFrac: 0.84, maxLines: 2 });
  chapter(sc, layout.ys[0] - layout.size * 0.6, 0.5);
  blurInLayout(sc, layout, 0.6, 0.06, { exitAt: d - 0.4 });
}

/* ───────────────────────── Testimonial ───────────────────────── */

function testimonial(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1, aurora: 0.7 });
  const portrait = h > w;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const cw = portrait ? w * 0.88 : Math.min(w * 0.72, 1100 * u);
  const quote = `“${scene.text.replace(/^["“]|["”]$/g, "")}”`;
  // Quote layout (sentence case, lighter weight feel via Inter 800 at smaller size).
  const layout = sentence(sc, { text: quote, cy: h * 0.47, sizeFrac: portrait ? 0.062 : 0.055, widthFrac: (cw - 120 * u) / w, maxLines: 5 });
  const qTop = layout.ys[0] - layout.size * 0.6;
  const qBottom = layout.ys[layout.ys.length - 1] + layout.size * 0.6;
  const ch = qBottom - qTop + 280 * u;
  const cx0 = w / 2 - cw / 2;
  const cy0 = qTop - 110 * u;
  const k = clamp(spring(t - 0.1, 10, 7), 0, 1.05);
  chapter(sc, cy0 - 6 * u);
  ctx.save();
  ctx.globalAlpha = clamp(t / 0.25) * (1 - ex);
  ctx.translate(w / 2, cy0 + ch / 2 + (1 - Math.min(1, k)) * 50 * u);
  ctx.scale(0.94 + 0.06 * k, 0.94 + 0.06 * k);
  ctx.translate(-w / 2, -(cy0 + ch / 2));
  glassCard(sc, cx0, cy0, cw, ch, { r: 26 * u });
  borderBeam(sc, cx0, cy0, cw, ch, t * 0.25, { r: 26 * u, alpha: 0.7 });
  // Stars.
  for (let i = 0; i < 5; i++) {
    const sk = ease.outBack(range(t, 0.35 + i * 0.08, 0.65 + i * 0.08), 2.2);
    ctx.save();
    ctx.translate(w / 2 + (i - 2) * 34 * u, cy0 + 56 * u);
    ctx.scale(sk, sk);
    ctx.fillStyle = "#fbbf24";
    ctx.shadowColor = "rgba(251,191,36,0.6)";
    ctx.shadowBlur = 12 * u;
    star(ctx, 0, 0, 13 * u);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  blurInLayout(sc, layout, 0.6, 0.035);
  ctx.restore();
  // Author row.
  const ak = ease.outCubic(range(t, 1.2, 1.7)) * (1 - ex);
  if (ak > 0) {
    const [name, ...roleParts] = (scene.subtext ?? "").split(/\s[·—–|-]\s|,\s/);
    const role = roleParts.join(", ");
    const ay = qBottom + 84 * u;
    const ar = 38 * u;
    ctx.save();
    ctx.globalAlpha = ak;
    ctx.font = subFont(28 * u, 700);
    const nw = ctx.measureText(name || "").width;
    ctx.font = subFont(22 * u, 500);
    const rw = ctx.measureText(role).width;
    const blockW = ar * 2 + 16 * u + Math.max(nw, rw);
    const ax = w / 2 - blockW / 2 + ar;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, TAU);
    ctx.clip();
    const av = getMedia(scene.media, t);
    if (av) drawCover(ctx, av, ax - ar, ay - ar, ar * 2, ar * 2);
    else {
      const g = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
      g.addColorStop(0, palette.primary);
      g.addColorStop(1, palette.secondary);
      ctx.fillStyle = g;
      ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
      ctx.fillStyle = "#fff";
      ctx.font = subFont(ar * 0.8, 700);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((name || "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(), ax, ay + 1);
    }
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.text;
    ctx.font = subFont(28 * u, 700);
    ctx.fillText(name || "", ax + ar + 18 * u, role ? ay - 15 * u : ay);
    if (role) {
      ctx.fillStyle = rgba(palette.text, 0.6);
      ctx.font = subFont(22 * u, 500);
      ctx.fillText(role, ax + ar + 18 * u, ay + 18 * u);
    }
    ctx.restore();
  }
}

/* ───────────────────────── Trusted-by Marquee ───────────────────────── */

function marquee(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 2 });
  const layout = sentence(sc, { text: accented(scene.text), cy: h * 0.33, sizeFrac: 0.08, widthFrac: 0.84, maxLines: 2 });
  chapter(sc, layout.ys[0] - layout.size * 0.6);
  const n = blurInLayout(sc, layout, 0.15, stagger(sc), { exitAt: d - 0.4 });
  const logos = (brand?.clientLogos ?? []).map((s) => getImage(s)).filter((i): i is HTMLImageElement => !!i && i.naturalWidth > 0);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const k = ease.outCubic(range(t, 0.5, 1.1)) * (1 - ex);
  if (logos.length) {
    const lh = 46 * u;
    const gap = 90 * u;
    const rowsY = [h * 0.58, h * 0.74];
    rowsY.forEach((ry, ri) => {
      const row = ri === 0 ? logos : [...logos].reverse();
      const widths = row.map((img) => Math.min(lh * 4, lh * (img.naturalWidth / img.naturalHeight)));
      const total = widths.reduce((a, b) => a + b + gap, 0);
      const dir = ri === 0 ? -1 : 1;
      let off = (((t * 70 * u * dir) % total) + total) % total;
      ctx.save();
      ctx.globalAlpha = k * 0.8;
      for (let rep = -1; rep <= Math.ceil(w / total) + 1; rep++) {
        let x = rep * total - off;
        row.forEach((img, i) => {
          if (x + widths[i] > -50 && x < w + 50) {
            ctx.save();
            if (isDarkLogo(img)) ctx.filter = "brightness(0) invert(1)";
            ctx.drawImage(img, x, ry - (widths[i] / (img.naturalWidth / img.naturalHeight)) / 2, widths[i], widths[i] / (img.naturalWidth / img.naturalHeight));
            ctx.restore();
          }
          x += widths[i] + gap;
        });
      }
      ctx.restore();
      off = 0;
    });
    // Edge fades.
    for (const side of [0, 1]) {
      const g = ctx.createLinearGradient(side ? w : 0, 0, side ? w * 0.75 : w * 0.25, 0);
      g.addColorStop(0, rgba(palette.bg0, 1));
      g.addColorStop(1, rgba(palette.bg0, 0));
      ctx.fillStyle = g;
      ctx.fillRect(side ? w * 0.75 : 0, h * 0.48, w * 0.25, h * 0.36);
    }
  } else {
    const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.62;
    subText(sc, scene.subtext, bottom + 44 * u, range(t, 0.4 + n * stagger(sc), 1 + n * stagger(sc)) * (1 - ex));
  }
}

/* ───────────────────────── CTA Lock-up ───────────────────────── */

function ctaTiming(d: number) {
  const hover = Math.min(1.5, d * 0.4);
  const click = hover + 0.4;
  return { button: 0.75, hover, click };
}

function ctaLockup(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 3 });
  const T = ctaTiming(d);
  const ex = range(t, d - 0.5, d);
  const hasLogo = !!brand?.logo;
  // Logo mark.
  const lk = clamp(spring(t - 0.05, 9, 7), 0, 1.05);
  if (hasLogo) {
    ctx.save();
    ctx.globalAlpha = clamp(lk) * (1 - ex);
    ctx.translate(w / 2, h * 0.27);
    ctx.scale(0.85 + 0.15 * lk, 0.85 + 0.15 * lk);
    ctx.shadowColor = rgba(palette.primary, 0.8);
    ctx.shadowBlur = 40 * u;
    drawLogoMark(sc, brand?.logo, 0, 0, Math.min(w, h) * 0.11);
    ctx.restore();
  }
  const layout = sentence(sc, { text: accented(scene.text), cy: h * (hasLogo ? 0.44 : 0.4), sizeFrac: 0.1, widthFrac: 0.8, maxLines: 2 });
  blurInLayout(sc, layout, 0.2, stagger(sc), { exitAt: d - 0.5 });
  // Button.
  const label = scene.subtext || "Get started";
  const bk = clamp(spring(t - T.button, 11, 7), 0, 1.08);
  const press = Math.max(0, 1 - Math.abs(t - T.click) / 0.12);
  const released = clamp(spring(t - T.click - 0.1, 14, 9));
  const bScale = (0.8 + 0.2 * bk) * (1 - press * 0.05) * (t > T.click ? 0.97 + 0.03 * released : 1);
  const hover = ease.outCubic(range(t, T.hover, T.hover + 0.25));
  const by = layout.ys[layout.ys.length - 1] + layout.size * 0.6 + 80 * u;
  ctx.save();
  ctx.font = subFont(32 * u, 700);
  const bw = ctx.measureText(`${label}  →`).width + 84 * u;
  const bh = 82 * u;
  ctx.globalAlpha = clamp(bk * 2) * (1 - ex);
  ctx.translate(w / 2, by);
  ctx.scale(bScale, bScale);
  // Glow grows on hover, bursts on click.
  const burst = range(t, T.click, T.click + 0.6);
  ctx.shadowColor = palette.primary;
  ctx.shadowBlur = (20 + 30 * hover + (burst < 1 ? 60 * (1 - burst) : 0)) * u;
  const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Shimmer sweep across the button.
  const sx = lerp(-bw, bw, ((t - T.button) * 0.5) % 1.4);
  ctx.save();
  ctx.clip();
  const sh = ctx.createLinearGradient(sx - 60 * u, 0, sx + 60 * u, 0);
  sh.addColorStop(0, "rgba(255,255,255,0)");
  sh.addColorStop(0.5, "rgba(255,255,255,0.45)");
  sh.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.restore();
  ctx.fillStyle = "#07040f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${label}  →`, 0, 1 * u);
  ctx.restore();
  borderBeam(sc, w / 2 - bw / 2 - 6 * u, by - bh / 2 - 6 * u, bw + 12 * u, bh + 12 * u, t * 0.6, { r: bh / 2 + 6 * u, alpha: clamp(bk) * (1 - ex) });
  clickRipple(sc, w / 2 + bw * 0.1, by, range(t, T.click, T.click + 0.6), "#ffffff");
  // Domain.
  subText(sc, brand?.domain, by + bh / 2 + 50 * u, range(t, T.click + 0.2, T.click + 0.7) * (1 - ex), { size: 24 * u });
  // Cursor.
  const start = { x: w * 0.82, y: h * 1.05 };
  const target = { x: w / 2 + bw * 0.1, y: by + 4 * u };
  const k = ease.inOutCubic(range(t, T.button + 0.1, T.hover + 0.2));
  const away = ease.inCubic(range(t, T.click + 0.6, T.click + 1.3));
  if (t > T.button) {
    drawCursor(sc, lerp(lerp(start.x, target.x, k), w * 1.1, away), lerp(lerp(start.y, target.y, k), h * 1.1, away), press);
  }
}

/* ───────────────────────── Website Scroll ───────────────────────── */

function scrollTiming(d: number) {
  return { first: 0.9, second: Math.max(2.2, d * 0.5) };
}

function siteScroll(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 2 });
  const portrait = h > w;
  topHeadline(sc);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const ww = portrait ? w * 0.88 : w * 0.7;
  const top = h * (scene.eyebrow ? 0.28 : 0.25);
  const wh = Math.min(h * 0.7, h - top - 24 * u);
  const x0 = w / 2 - ww / 2;
  const bar = 34 * u;
  // Tilted in from below, settling flat (a faux 3D rotateX).
  const k = clamp(spring(t - 0.05, 8, 6), 0, 1.04);
  const tilt = (1 - Math.min(1, k)) * 0.35;
  ctx.save();
  ctx.globalAlpha = clamp(t / 0.3) * (1 - ex);
  ctx.translate(w / 2, top + wh / 2 + (1 - Math.min(1, k)) * h * 0.2 + Math.sin(t * 1.1) * 4 * u);
  ctx.transform(1, 0, 0, 1 - tilt * 0.5, 0, 0);
  ctx.scale(0.92 + 0.08 * Math.min(1, k), 0.92 + 0.08 * Math.min(1, k));
  ctx.translate(-w / 2, -(top + wh / 2));
  glassCard(sc, x0 - 1, top - 1, ww + 2, wh + 2, { r: 16 * u });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, top, ww, wh, 16 * u);
  ctx.clip();
  ctx.fillStyle = "#121019";
  ctx.fillRect(x0, top, ww, bar);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x0 + 20 * u + i * 18 * u, top + bar / 2, 5.5 * u, 0, TAU);
    ctx.fill();
  });
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(w / 2 - ww * 0.2, top + bar * 0.2, ww * 0.4, bar * 0.6, bar * 0.3);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = subFont(13 * u, 500);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(brand?.domain ?? "yourproduct.com", w / 2, top + bar / 2);
  // Smoothly scroll the real full-page screenshot, with pauses to read.
  const vx = x0;
  const vy = top + bar;
  const vw = ww;
  const vh = wh - bar;
  const img = getMedia(scene.media, t);
  const T = scrollTiming(d);
  const p1 = ease.inOutCubic(range(t, T.first, T.first + 1.1)) * 0.4;
  const p2 = ease.inOutCubic(range(t, T.second, T.second + 1.2)) * 0.45;
  const p = p1 + p2;
  if (img) {
    const iw = "naturalWidth" in img ? img.naturalWidth : img.videoWidth;
    const ih = "naturalHeight" in img ? img.naturalHeight : img.videoHeight;
    const sc2 = vw / iw;
    const maxScroll = Math.max(0, ih * sc2 - vh);
    const sy = (p * maxScroll) / sc2;
    ctx.drawImage(img, 0, sy, iw, Math.min(ih - sy, vh / sc2), vx, vy, vw, Math.min(vh, (ih - sy) * sc2));
    // Scrollbar.
    const thumbH = Math.max(40 * u, (vh * vh) / (ih * sc2));
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.roundRect(vx + vw - 10 * u, vy + 6 * u + (vh - thumbH - 12 * u) * (maxScroll ? (p * maxScroll) / maxScroll : 0), 5 * u, thumbH, 3 * u);
    ctx.fill();
  } else mockUi(sc, vx, vy, vw, vh);
  // Soft fade at the bottom edge of the viewport.
  const fade = ctx.createLinearGradient(0, vy + vh * 0.8, 0, vy + vh);
  fade.addColorStop(0, rgba(palette.bg0, 0));
  fade.addColorStop(1, rgba(palette.bg0, 0.55));
  ctx.fillStyle = fade;
  ctx.fillRect(vx, vy + vh * 0.8, vw, vh * 0.2);
  ctx.restore();
  borderBeam(sc, x0, top, ww, wh, t * 0.3, { r: 16 * u, alpha: 0.7 });
  ctx.restore();
  // Cursor exploring the page.
  if (t > 0.5) {
    const cx = w / 2 + ww * (0.12 + 0.1 * Math.sin(t * 0.9));
    const cy = top + wh * (0.45 + 0.12 * Math.sin(t * 0.7 + 1));
    ctx.save();
    ctx.globalAlpha = clamp((t - 0.5) / 0.3) * (1 - ex);
    drawCursor(sc, cx, cy);
    ctx.restore();
  }
}

/* ───────────────────────── How It Works ───────────────────────── */

function stepsTiming(scene: Scene, beat: number) {
  const n = Math.max(2, Math.min(4, (scene.items ?? []).length || 3));
  const step = Math.max(0.6, beat * 2);
  return Array.from({ length: n }, (_, i) => 0.6 + i * step);
}

function steps(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 2 });
  const portrait = h > w;
  topHeadline(sc);
  const items = (scene.items ?? []).filter(Boolean).slice(0, 4);
  const labels = items.length >= 2 ? items : ["Connect", "Customize", "Launch"];
  const times = stepsTiming({ ...scene, items: labels }, sc.beat);
  const n = labels.length;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const R = 40 * u;
  const pts = labels.map((_, i) =>
    portrait
      ? { x: w * 0.17, y: h * 0.3 + (i * h * 0.6) / Math.max(1, n - 1) * (n > 1 ? 0.95 : 0) }
      : { x: w * 0.14 + (i * w * 0.72) / Math.max(1, n - 1), y: h * 0.47 },
  );
  const g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[n - 1].x, pts[n - 1].y);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.save();
  ctx.globalAlpha = (1 - ex) * clamp(t / 0.4);
  // Track + progress fill.
  ctx.lineCap = "round";
  ctx.lineWidth = 4 * u;
  ctx.strokeStyle = rgba(palette.text, 0.12);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
  ctx.stroke();
  let prog = 0;
  for (let i = 1; i < n; i++) prog += ease.inOutCubic(range(t, times[i - 1] + 0.2, times[i]));
  const segF = prog / Math.max(1, n - 1);
  ctx.strokeStyle = g;
  ctx.shadowColor = palette.primary;
  ctx.shadowBlur = 16 * u;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(lerp(pts[0].x, pts[n - 1].x, segF), lerp(pts[0].y, pts[n - 1].y, segF));
  ctx.stroke();
  ctx.restore();
  labels.forEach((label, i) => {
    const lt = t - times[i];
    const on = clamp(spring(lt, 12, 7), 0, 1.15);
    const p = pts[i];
    const colW = portrait ? w * 0.66 : (w * 0.72) / Math.max(1, n - 1) * 0.9;
    ctx.save();
    ctx.globalAlpha = (1 - ex) * clamp(0.35 + clamp(lt / 0.3) * 0.65);
    // Card with the step title.
    const cw = Math.min(colW, 380 * u);
    const ch = 130 * u;
    const cx = portrait ? p.x + R + 24 * u : p.x - cw / 2;
    const cy = portrait ? p.y - ch / 2 : p.y + R + 26 * u;
    const ck = lt > 0 ? Math.min(1, on) : 0;
    ctx.save();
    ctx.globalAlpha *= 0.5 + 0.5 * ck;
    ctx.translate(0, (1 - ck) * 18 * u);
    glassCard(sc, cx, cy, cw, ch, { r: 18 * u, tint: lt > 0 ? palette.bg1 : undefined });
    if (lt > 0 && lt < 2.2) borderBeam(sc, cx, cy, cw, ch, lt * 0.5, { r: 18 * u, alpha: 1 - clamp((lt - 1.6) / 0.6) });
    ctx.fillStyle = palette.text;
    ctx.font = `700 ${Math.round(Math.min(30 * u, cw / 10))}px Inter, sans-serif`;
    ctx.textAlign = portrait ? "left" : "center";
    ctx.textBaseline = "middle";
    const words = label.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const wd of words) {
      const next = line ? `${line} ${wd}` : wd;
      if (ctx.measureText(next).width > cw - 40 * u && line) {
        lines.push(line);
        line = wd;
      } else line = next;
    }
    lines.push(line);
    const lh = Math.min(30 * u, cw / 10) * 1.25;
    lines.slice(0, 2).forEach((l, li, arr) =>
      ctx.fillText(l, portrait ? cx + 24 * u : cx + cw / 2, cy + ch / 2 + (li - (arr.length - 1) / 2) * lh),
    );
    ctx.restore();
    // Numbered node.
    ctx.translate(p.x, p.y);
    const sk = lt > 0 ? on : 0.85;
    ctx.scale(sk, sk);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    if (lt > 0) {
      ctx.fillStyle = g;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = 30 * u;
    } else ctx.fillStyle = palette.bg1;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(palette.text, lt > 0 ? 0.6 : 0.2);
    ctx.lineWidth = 2 * u;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${Math.round(R * 0.9)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), 0, 2 * u);
    ctx.restore();
  });
}

/* ───────── registry ───────── */

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });

export const saasSkills: Skill[] = [
  {
    id: "blur-reveal",
    name: "Blur Reveal",
    tagline: "Apple-style sentence reveal: words rise and un-blur one by one, key word in gradient.",
    bestFor: "Hooks, value propositions and big statements in sentence case (3–9 words). Wrap the key word in *asterisks*.",
    sample: { text: "The fastest way to *ship* your product.", subtext: "Built for modern teams", items: ["Introducing"] },
    itemsHint: "Eyebrow label, e.g. Introducing",
    render: blurReveal,
    sfx: () => [at(0.15, "shimmer")],
  },
  {
    id: "word-swap",
    name: "Word Swap",
    tagline: "A sentence with a rotating gradient word that springs through alternatives.",
    bestFor: "Positioning lines like 'Ship faster|smarter|together' (use | between the alternatives).",
    sample: { text: "Ship faster|smarter|together", subtext: "One workspace for your whole team" },
    render: wordSwap,
    sfx: (scene, beat) => swapTiming(scene, beat).swaps.map((s) => at(s, "tick")),
  },
  {
    id: "ui-tour",
    name: "UI Zoom Tour",
    tagline: "The camera dives into your product; a cursor clicks features and callouts pop.",
    bestFor: "Product demos over a real screenshot/video. Headline = what the product does; items = 2 feature callouts.",
    sample: { text: "See *everything* in one place", items: ["Live pipeline", "One-click reports"] },
    itemsHint: "2 callouts, e.g. Live pipeline, One-click reports",
    render: uiTour,
    sfx: (scene) => {
      const T = tourTiming(scene.duration);
      return [at(T.zoomA, "whoosh"), at(T.clickA, "click"), at(T.clickA + 0.12, "pop"), at(T.zoomB, "whoosh"), at(T.clickB, "click"), at(T.clickB + 0.12, "pop"), at(T.out, "swoosh")];
    },
  },
  {
    id: "bento",
    name: "Bento Grid",
    tagline: "Feature cards spring into a bento grid, each with an icon and a live micro-animation.",
    bestFor: "Feature overviews. Headline = section title; items = 3–6 short feature names.",
    sample: { text: "Everything your team *needs*", items: ["Lightning-fast search", "Real-time analytics", "Team spaces", "Enterprise security", "AI assistant", "200+ integrations"] },
    itemsHint: "3–6 features, comma separated",
    render: bento,
    sfx: (scene, beat) => bentoTiming(scene, beat).map((s) => at(s, "pop")),
  },
  {
    id: "ui-cards",
    name: "Floating UI",
    tagline: "Your product floats centre stage as glass widgets (toast, metric, chart, team) pop around it.",
    bestFor: "Showing the product alive. items = [notification text, a stat like '12,000+ teams', chart label, team label].",
    sample: { text: "Your pipeline, *alive*", items: ["Deal closed: Acme Inc", "128% revenue growth", "This week", "Sales team"] },
    itemsHint: "notification, stat, chart label, team label",
    render: uiCards,
    sfx: (_scene, beat) => cardsTiming(beat).map((s) => at(s, "pop")),
  },
  {
    id: "pain-strike",
    name: "Pain → Solution",
    tagline: "The old way's pain points get struck through, then the better way blurs in.",
    bestFor: "Problem/solution hooks. items = 2–4 pains ('Endless spreadsheets'); headline = the fix ('There's a *better* way').",
    sample: { text: "There's a *better* way.", items: ["Endless spreadsheets", "Missed follow-ups", "Guesswork forecasts"] },
    itemsHint: "2–4 pain points, comma separated",
    render: painStrike,
    sfx: (scene, beat) => {
      const T = painTiming(scene, beat);
      return [...((scene.items ?? []).length ? T.strike.map((s) => at(s, "strike")) : []), at((scene.items ?? []).length ? T.solve : 0.2, "shimmer")];
    },
  },
  {
    id: "integrations",
    name: "Integration Orbit",
    tagline: "App tiles orbit your logo with data pulses flowing into the core.",
    bestFor: "Integrations, ecosystems, 'works with your stack'. Headline like 'Connects to *300+* tools'.",
    sample: { text: "Connects to your *entire* stack" },
    render: orbit,
    sfx: () => [at(0.1, "pop"), at(0.45, "pop"), at(0.8, "pop")],
  },
  {
    id: "testimonial",
    name: "Testimonial",
    tagline: "A real customer quote on a glass card with star rating, avatar, name and role.",
    bestFor: "Social proof from a REAL quote only. Headline = the quote; subtext = 'Name · Role, Company'.",
    sample: { text: "We closed our biggest quarter ever within weeks of switching.", subtext: "Jordan Lee · VP Sales, Northwind" },
    render: testimonial,
    sfx: () => [at(0.1, "pop"), ...[0, 1, 2, 3, 4].map((i) => at(0.4 + i * 0.08, "tick"))],
  },
  {
    id: "logo-marquee",
    name: "Trusted By",
    tagline: "Customer logos stream past in two marquee rows under your social-proof line.",
    bestFor: "'Trusted by 12,000+ teams' moments. Uses the customer logos imported from the website.",
    sample: { text: "Trusted by *12,000+* teams", subtext: "From startups to the Fortune 500" },
    render: marquee,
    sfx: () => [at(0.15, "swoosh")],
  },
  {
    id: "site-scroll",
    name: "Website Scroll",
    tagline: "Your real website scrolls smoothly inside a floating browser while a cursor explores.",
    bestFor: "Showing the actual site right after the brand reveal. Uses the full-page screenshot from live capture.",
    sample: { text: "Meet your new *workspace*" },
    render: siteScroll,
    sfx: (scene) => {
      const T = scrollTiming(scene.duration);
      return [at(0.05, "swoosh"), at(T.first, "swoosh"), at(T.second, "swoosh")];
    },
  },
  {
    id: "steps",
    name: "How It Works",
    tagline: "Numbered steps light up in sequence along a glowing progress line.",
    bestFor: "'How it works' / onboarding flows. items = 2–4 short step titles.",
    sample: { text: "Up and running in *minutes*", items: ["Connect your data", "Invite your team", "Close more deals"] },
    itemsHint: "2–4 steps, comma separated",
    render: steps,
    sfx: (scene, beat) => stepsTiming(scene, beat).map((s) => at(s, "pop")),
  },
  {
    id: "cta",
    name: "CTA Lock-up",
    tagline: "Logo, closing line and a glowing button that the cursor clicks — with your URL.",
    bestFor: "The final scene. Headline = closing line; subtext = button label ('Start free trial').",
    sample: { text: "Start building *today*", subtext: "Start free trial" },
    render: ctaLockup,
    sfx: (scene) => {
      const T = ctaTiming(scene.duration);
      return [at(T.button, "pop"), at(T.click, "click"), at(T.click + 0.05, "shimmer")];
    },
  },
];
