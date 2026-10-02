import { exitT } from "../fx";
import { tokens } from "../grid";
import { drawLucide } from "../icons";
import { clamp, ease, lerp, mixHex, range, rgba, rng } from "../math";
import { getImage, drawLogo, logoMaxWidth } from "../media";
import { brandGlyph, iconsFor, drawIcon, imageless, luminance, saasFont, spring } from "../saasfx";
import { autoAccent, displayFont } from "../text";
import type { Scene, Skill, SkillContext } from "../types";
import { drawCover } from "./media";
import { topHeadline } from "./saas";

/**
 * Editorial system slides: interface-designer motion built from one closed system, so a poster,
 * a carousel, a chart card and a type marquee all read as one brand. One surface, three tiers of
 * hairline (frame, divider, grid), the palette's own colours and nothing else; motion is built
 * the way a designer builds a layout: the hairlines draw first, surfaces fill in behind them,
 * then type rises out of its line masks.
 */

/* ───────────────────────── The system ───────────────────────── */

export interface System {
  /** The one card surface. */
  surface: string;
  /** Hairlines: 1 frames, 2 dividers and rules, 3 the background grid. */
  line1: string;
  line2: string;
  line3: string;
  /** Secondary text. */
  muted: string;
  /** 1px at any resolution. */
  px: number;
}

export function system(sc: SkillContext): System {
  const { palette, u } = sc;
  const light = !!palette.light;
  return {
    surface: light ? mixHex(palette.bg1, "#ffffff", 0.55) : mixHex(mixHex(palette.bg0, palette.bg1, 0.65), palette.text, 0.025),
    line1: rgba(palette.text, light ? 0.3 : 0.34),
    line2: rgba(palette.text, light ? 0.15 : 0.16),
    line3: rgba(palette.text, light ? 0.06 : 0.065),
    muted: rgba(palette.text, 0.58),
    px: Math.max(1, 1.1 * u),
  };
}

/** Flat stage with a faint dot grid on the 64pt rhythm (no glow: the type and lines carry it). */
export function stage(sc: SkillContext, sys: System) {
  if (sc.noStage) return;
  const { ctx, w, h, u, palette } = sc;
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, Math.max(w, h) * 0.9);
  g.addColorStop(0, rgba(palette.bg1, 0.9));
  g.addColorStop(1, rgba(palette.bg1, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const step = 64 * u;
  ctx.fillStyle = sys.line3;
  const r = Math.max(1, 1.4 * u);
  for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) ctx.fillRect(x - r / 2, y - r / 2, r, r);
}

export const MONO = (size: number, weight = 500) => `${weight} ${Math.round(size)}px "JetBrains Mono", ui-monospace, monospace`;

/** A small tracked mono label (the system's meta type). */
export function meta(sc: SkillContext, text: string, x: number, y: number, k: number, opts: { align?: CanvasTextAlign; color?: string; size?: number } = {}) {
  if (k <= 0 || !text) return;
  const { ctx, u } = sc;
  ctx.save();
  ctx.globalAlpha *= clamp(k);
  ctx.font = MONO(opts.size ?? 17 * u);
  ctx.letterSpacing = `${(opts.size ?? 17 * u) * 0.12}px`;
  ctx.fillStyle = opts.color ?? system(sc).muted;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), x, y + (1 - ease.outCubic(clamp(k))) * 8 * u);
  ctx.restore();
}

/** A hairline drawn on from its start: p 0..1. */
export function rule(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, p: number, color: string, width: number) {
  if (p <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(lerp(x0, x1, clamp(p)), lerp(y0, y1, clamp(p)));
  ctx.stroke();
  ctx.restore();
}

/** A rounded frame whose outline draws itself around from the top-left: p 0..1. */
export function frameDraw(ctx: CanvasRenderingContext2D, x: number, y: number, fw: number, fh: number, r: number, p: number, color: string, width: number) {
  if (p <= 0) return;
  const len = 2 * (fw + fh);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (p < 1) ctx.setLineDash([len * p, len]);
  ctx.beginPath();
  ctx.roundRect(x, y, fw, fh, r);
  ctx.stroke();
  ctx.restore();
}

/** Copy as words, each knowing whether it sits in the *accent*. */
export function accentWords(text: string) {
  const out: { w: string; a: boolean }[] = [];
  let on = false;
  for (const raw of autoAccent(text).split(/\s+/).filter(Boolean)) {
    if (raw.startsWith("*")) on = true;
    const a = on;
    if (/\*[^\w]*$/.test(raw) && (raw.match(/\*/g)?.length ?? 0) >= (raw.startsWith("*") ? 2 : 1)) on = false;
    const word = raw.replace(/\*/g, "");
    if (word) out.push({ w: word, a });
  }
  return out;
}

export const titleOf = (item: string) => item.split(/\s+[—–]\s+/)[0];
export const descOf = (item: string) => item.split(/\s+[—–]\s+/)[1] ?? "";

export function itemsOr(scene: Scene, min: number, fallback: string[]) {
  const items = (scene.items ?? []).filter(Boolean);
  return items.length >= min ? items : fallback;
}

/* ───────────────────────── Kinetic Poster ───────────────────────── */

export type Word = { w: string; a: boolean };

/** The face for a word: the film's display face, with the accent set in an italic serif for contrast. */
export function wordFont(sc: SkillContext, word: Word, size: number) {
  return word.a ? `italic 400 ${Math.round(size * 1.08)}px "Instrument Serif", Georgia, serif` : displayFont(saasFont(sc), size);
}

export function lineWidth(sc: SkillContext, line: Word[], size: number) {
  const { ctx } = sc;
  let wsum = 0;
  line.forEach((wd, i) => {
    ctx.font = wordFont(sc, wd, size);
    wsum += ctx.measureText(wd.w).width + (i ? size * 0.24 : 0);
  });
  return wsum;
}

/** Stack the words like a poster: a few balanced lines, set as big as the block allows. */
export function posterLines(sc: SkillContext, words: Word[], maxW: number, maxH: number, maxLines: number) {
  const chars = words.reduce((a, w) => a + w.w.length, 0) + words.length - 1;
  const n = Math.max(1, Math.min(maxLines, words.length, words.length <= 3 ? words.length : Math.round(chars / 9)));
  const per = chars / n;
  const lines: Word[][] = [];
  let cur: Word[] = [];
  let len = 0;
  words.forEach((wd, i) => {
    const left = words.length - i;
    const linesLeft = n - lines.length;
    if (cur.length && (len + wd.w.length > per * 1.15 || left < linesLeft) && lines.length < n - 1) {
      lines.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(wd);
    len += wd.w.length + 1;
  });
  if (cur.length) lines.push(cur);
  const probe = 100;
  const widest = Math.max(...lines.map((l) => lineWidth(sc, l, probe)));
  const size = Math.min((maxW / widest) * probe, maxH / (lines.length * 0.98), sc.u * 260);
  return { lines, size };
}

export function drawWords(sc: SkillContext, line: Word[], x: number, y: number, size: number, stroke?: string) {
  const { ctx, palette } = sc;
  let cx = x;
  line.forEach((wd, i) => {
    if (i) cx += size * 0.24;
    ctx.font = wordFont(sc, wd, size);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.strokeText(wd.w, cx, y);
    } else {
      ctx.fillStyle = wd.a ? palette.primary : palette.text;
      ctx.fillText(wd.w, cx, y);
    }
    cx += ctx.measureText(wd.w).width;
  });
}

/**
 * A Swiss poster that builds itself: the hairline frame and column rules draw on, the headline
 * rises line by line out of its masks in huge stacked type (the accent in an italic serif), an
 * accent disc lands in the free corner, and meta labels and the list fill the margins. Holding,
 * the lines drift against each other; leaving, they rise back out of their masks.
 */
function typePoster(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  const sys = system(sc);
  stage(sc, sys);
  const portrait = h > w;
  const g = tokens(w, h);
  const fx = g.safe.left;
  const fy = g.safe.top;
  const fw = g.safe.width;
  const fh = g.safe.height;
  const ex = ease.inCubic(exitT(sc, 0.55));
  const fade = 1 - ex;
  // Frame (tier 1), column rules (tier 3), header and footer rules (tier 2).
  ctx.save();
  ctx.globalAlpha = fade;
  frameDraw(ctx, fx, fy, fw, fh, 0, ease.inOutCubic(range(t, 0, 0.8)), sys.line1, sys.px);
  const cols = portrait ? 2 : 4;
  for (let i = 1; i < cols; i++) {
    const x = Math.round(fx + (fw * i) / cols) + 0.5;
    rule(ctx, x, fy, x, fy + fh, ease.outCubic(range(t, 0.15 + i * 0.07, 0.95 + i * 0.07)), sys.line3, sys.px);
  }
  const headH = 54 * u;
  rule(ctx, fx, fy + headH, fx + fw, fy + headH, ease.outCubic(range(t, 0.25, 0.9)), sys.line2, sys.px);
  rule(ctx, fx + fw, fy + fh - headH, fx, fy + fh - headH, ease.outCubic(range(t, 0.3, 0.95)), sys.line2, sys.px);
  ctx.restore();
  // Meta labels in the header and footer.
  const brand = sc.brand?.name ?? "";
  const mk = range(t, 0.45, 0.9) * fade;
  const pad = 22 * u;
  meta(sc, brand, fx + pad, fy + headH / 2, mk);
  meta(sc, scene.eyebrow ?? "", fx + fw / 2, fy + headH / 2, mk, { align: "center" });
  meta(sc, "No. 01", fx + fw - pad, fy + headH / 2, mk, { align: "right" });
  meta(sc, sc.brand?.domain ?? "", fx + pad, fy + fh - headH / 2, mk);
  meta(sc, scene.subtext ?? "", fx + fw - pad, fy + fh - headH / 2, mk, { align: "right", color: palette.text });

  // The accent disc, in the free top-right of the poster, with a slowly turning tick ring.
  const items = (scene.items ?? []).filter(Boolean).slice(0, 4);
  const listW = portrait || !items.length ? 0 : fw / cols;
  const discR = Math.min(fw, fh) * (portrait ? 0.16 : 0.13);
  const dcx = fx + fw - pad - discR - (listW ? listW * 0.1 : 0);
  const dcy = fy + headH + pad + discR + 8 * u;
  const dk = clamp(spring(t - 0.55, 10, 6.5), 0, 1.12) * fade;
  if (dk > 0) {
    ctx.save();
    const disc = ctx.createLinearGradient(dcx - discR, dcy - discR, dcx + discR, dcy + discR);
    disc.addColorStop(0, palette.primary);
    disc.addColorStop(1, palette.secondary);
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(dcx, dcy, discR * dk, 0, Math.PI * 2);
    ctx.fill();
    // Tick ring.
    ctx.strokeStyle = sys.line2;
    ctx.lineWidth = sys.px;
    const rot = (sc.globalT ?? t) * 0.25;
    for (let i = 0; i < 60; i++) {
      const a = rot + (i / 60) * Math.PI * 2;
      const r0 = discR * 1.16;
      const r1 = r0 + (i % 5 === 0 ? 12 : 6) * u;
      const show = range(t, 0.7 + i * 0.006, 0.9 + i * 0.006);
      if (show <= 0) continue;
      ctx.globalAlpha = show * fade;
      ctx.beginPath();
      ctx.moveTo(dcx + Math.cos(a) * r0, dcy + Math.sin(a) * r0);
      ctx.lineTo(dcx + Math.cos(a) * r1, dcy + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // The list column (landscape): numbered, ruled rows wiping in under the disc.
  if (listW && items.length) {
    const lx = fx + fw - listW;
    let ly = dcy + discR * 1.16 + 48 * u;
    const rowH = 46 * u;
    items.forEach((it, i) => {
      const k = range(t, 0.95 + i * 0.12, 1.5 + i * 0.12) * fade;
      if (k <= 0) return;
      rule(ctx, lx + pad, ly + rowH, lx + listW - pad, ly + rowH, ease.outCubic(k), sys.line2, sys.px);
      meta(sc, String(i + 1).padStart(2, "0"), lx + pad, ly + rowH / 2, k, { color: palette.primary });
      ctx.save();
      ctx.globalAlpha = ease.outCubic(k) * fade;
      ctx.font = `600 ${Math.round(19 * u)}px Inter, sans-serif`;
      ctx.fillStyle = palette.text;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(titleOf(it), lx + pad + 44 * u, ly + rowH / 2 + (1 - ease.outCubic(k)) * 10 * u, listW - pad * 2 - 44 * u);
      ctx.restore();
      ly += rowH;
    });
  }

  // The headline: stacked lines bottom-left, each rising out of its own mask.
  const words = accentWords(scene.text || "Make it move");
  const blockW = fw - pad * 2 - listW;
  const blockTop = portrait ? dcy + discR * 1.35 : fy + headH + pad;
  const blockH = fy + fh - headH - pad - blockTop;
  const { lines, size } = posterLines(sc, words, blockW, blockH, portrait ? 5 : 4);
  const lead = size * 1.02;
  const baseBottom = fy + fh - headH - pad - size * 0.22;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, i) => {
    const y = baseBottom - (lines.length - 1 - i) * lead;
    const start = 0.35 + i * 0.09;
    const inK = ease.outExpo(range(t, start, start + 0.75));
    const outK = ease.inCubic(range(t, d - 0.55 + i * 0.05, d - 0.15 + i * 0.05));
    if (inK <= 0 || outK >= 1) return;
    const drift = (i % 2 ? -1 : 1) * w * 0.012 * ease.inOutCubic(range(t, 1.1, d));
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx, y - size * 0.98, fw, size * 1.24);
    ctx.clip();
    drawWords(sc, line, fx + pad + drift, y + (1 - inK) * size * 1.1 - outK * size * 1.15, size);
    ctx.restore();
  });
  ctx.restore();
}

/* ───────────────────────── Showreel ───────────────────────── */

export const REEL_FALLBACK = ["Plan — Map the work in one place", "Build — Ship it together", "Review — Comments where the work is", "Launch — Go live in a click"];

/** The pause on each card, fitted to the scene. */
export function reelPeriod(scene: Scene) {
  const n = itemsOr(scene, 2, REEL_FALLBACK).slice(0, 6).length;
  return Math.max(0.9, (scene.duration - 1.7) / n);
}

/** One framed card of the reel family: a photo (or the feature's icon on a gridded field) over a strip with its index and title. `on` 0..1 is how much it's in focus. */
export function reelCard(
  sc: SkillContext,
  sys: System,
  o: { x: number; top: number; cw: number; visH: number; stripH: number; index: number; title: string; icon: string; img?: string; on: number; r?: number },
) {
  const { ctx, u, palette } = sc;
  const { x, top, cw, visH, stripH, on } = o;
  const ch = visH + stripH;
  const r = o.r ?? 18 * u;
  ctx.save();
  ctx.shadowColor = palette.light ? "rgba(15,30,60,0.12)" : "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 40 * u;
  ctx.shadowOffsetY = 16 * u;
  ctx.fillStyle = sys.surface;
  ctx.beginPath();
  ctx.roundRect(x, top, cw, ch, r);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save();
  const vx = x + 8 * u;
  const vy = top + 8 * u;
  const vw = cw - 16 * u;
  const vh = visH - 8 * u;
  ctx.beginPath();
  ctx.roundRect(vx, vy, vw, vh, r * 0.6);
  ctx.clip();
  const img = o.img ? getImage(o.img) : null;
  if (img?.naturalWidth) {
    drawCover(ctx, img, vx, vy, vw, vh, 1.06 - 0.06 * on, 0.5, 0.3);
  } else {
    const field = ctx.createLinearGradient(vx, vy, vx + vw, vy + vh);
    field.addColorStop(0, rgba(palette.primary, palette.light ? 0.16 : 0.3));
    field.addColorStop(1, rgba(palette.secondary, palette.light ? 0.08 : 0.14));
    ctx.fillStyle = palette.bg0;
    ctx.fillRect(vx, vy, vw, vh);
    ctx.fillStyle = field;
    ctx.fillRect(vx, vy, vw, vh);
    // Inner grid (tier 3) and the icon, large, centred.
    ctx.strokeStyle = sys.line3;
    ctx.lineWidth = sys.px;
    const step = 40 * u;
    ctx.beginPath();
    for (let gx = vx + step; gx < vx + vw; gx += step) {
      ctx.moveTo(gx, vy);
      ctx.lineTo(gx, vy + vh);
    }
    for (let gy = vy + step; gy < vy + vh; gy += step) {
      ctx.moveTo(vx, gy);
      ctx.lineTo(vx + vw, gy);
    }
    ctx.stroke();
    drawIcon(ctx, o.icon, vx + vw / 2, vy + vh / 2 - on * 4 * u, Math.min(vw, vh) * (0.3 + 0.04 * on), palette.text, 0.35 + 0.65 * on);
  }
  ctx.restore();
  ctx.strokeStyle = on > 0.5 ? sys.line1 : sys.line2;
  ctx.lineWidth = sys.px;
  ctx.beginPath();
  ctx.roundRect(x, top, cw, ch, r);
  ctx.stroke();
  // The strip: index and title.
  const sy = top + visH + stripH / 2;
  meta(sc, String(o.index + 1).padStart(2, "0"), x + 22 * u, sy, 1, { color: palette.primary, size: Math.min(17 * u, cw / 16) });
  ctx.font = `650 ${Math.round(Math.min(26 * u, cw / 14))}px Inter, sans-serif`;
  ctx.fillStyle = palette.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(o.title, x + Math.min(66 * u, cw * 0.2), sy, cw - Math.min(66 * u, cw * 0.2) - 22 * u);
  ctx.restore();
}

/** Four corner marks just outside a box: the system's focus indicator. */
export function focusTicks(sc: SkillContext, x: number, top: number, cw: number, ch: number, k: number) {
  if (k <= 0) return;
  const { ctx, u, palette } = sc;
  ctx.save();
  ctx.strokeStyle = palette.primary;
  ctx.globalAlpha *= k;
  ctx.lineWidth = Math.max(1.5, 2 * u);
  const o = 12 * u;
  const L = 18 * u;
  for (const [cx2, cy2, sx, sy2] of [[x - o, top - o, 1, 1], [x + cw + o, top - o, -1, 1], [x - o, top + ch + o, 1, -1], [x + cw + o, top + ch + o, -1, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(cx2, cy2 + sy2 * L);
    ctx.lineTo(cx2, cy2);
    ctx.lineTo(cx2 + sx * L, cy2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A showreel carousel: framed cards glide in from the right and snap to centre one by one, the
 * card in focus framed with corner ticks while its neighbours step back. A counter and a
 * progress hairline run underneath, the focused card's line beside them.
 */
function showreel(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene } = sc;
  const sys = system(sc);
  stage(sc, sys);
  const portrait = h > w;
  topHeadline(sc);
  const items = itemsOr(scene, 2, REEL_FALLBACK).slice(0, 6);
  const n = items.length;
  const g = tokens(w, h);
  const cw = Math.round(portrait ? w * 0.72 : Math.min(w * 0.4, h * 0.74));
  const visH = Math.round(cw * (portrait ? 0.8 : 0.58));
  const stripH = Math.round(76 * u);
  const ch = visH + stripH;
  const gap = 36 * u;
  const cy = portrait ? h * 0.52 : h * 0.57;
  const top = cy - ch / 2;
  // Position along the track: enters from the right, steps on each period, leaves to the left.
  const P = reelPeriod(scene);
  const t0 = 1.0;
  const kStep = Math.max(0, Math.floor((t - t0) / P));
  const frac = (t - t0 - kStep * P) / P;
  let pos = t < t0 ? 0 : Math.min(n - 1, kStep + ease.inOutCubic(range(frac, 0.72, 1)));
  pos -= (1 - ease.outExpo(range(t, 0.15, 1.2))) * 2.6;
  const ex = ease.inCubic(exitT(sc, 0.5));
  pos += ex * 1.6;
  const focus = clamp(Math.round(pos), 0, n - 1);
  const images = imageless(sc) ? [] : [scene.media?.src, ...(sc.brand?.images ?? [])].filter((s): s is string => !!s);
  const icons = iconsFor(items, sc);
  const order = items.map((_, i) => i).sort((a, b) => Math.abs(b - pos) - Math.abs(a - pos));
  for (const i of order) {
    const dist = Math.abs(i - pos);
    if (dist > 2.6) continue;
    const x = w / 2 + (i - pos) * (cw + gap) - cw / 2;
    const s = 1 - 0.12 * Math.min(1, dist);
    const a = (1 - 0.5 * Math.min(1, dist)) * (1 - range(dist, 1.8, 2.6)) * (1 - ex);
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x + cw / 2, cy);
    ctx.scale(s, s);
    ctx.translate(-(x + cw / 2), -cy);
    reelCard(sc, sys, { x, top, cw, visH, stripH, index: i, title: titleOf(items[i]), icon: icons[i], img: images.length ? images[i % images.length] : undefined, on: 1 - Math.min(1, dist) });
    ctx.restore();
    // Focus ticks: four corner marks just outside the focused card.
    focusTicks(sc, x, top, cw, ch, (1 - Math.min(1, dist * 2.5)) * (1 - ex) * range(t, 0.9, 1.3));
  }
  // The counter, the progress hairline and the focused card's line.
  const by = Math.min(top + ch + 64 * u, h - g.safe.bottom - 10 * u);
  const fk = range(t, 0.8, 1.3) * (1 - ex);
  if (fk > 0) {
    const x0 = g.safe.left + (portrait ? 0 : g.span(2));
    const x1 = g.safe.right - (portrait ? 0 : g.span(2));
    meta(sc, `${String(focus + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`, x0, by, fk, { color: palette.text });
    const lx0 = x0 + 120 * u;
    const lx1 = portrait ? x1 : lerp(lx0, x1, 0.42);
    ctx.save();
    ctx.globalAlpha = fk;
    rule(ctx, lx0, by, lx1, by, 1, sys.line2, sys.px);
    rule(ctx, lx0, by, lx1, by, clamp((pos + 1) / n), palette.primary, Math.max(2, 2 * u));
    ctx.restore();
    const desc = descOf(items[focus]);
    if (!portrait && desc) {
      const swap = Math.abs(pos - focus);
      ctx.save();
      ctx.globalAlpha = fk * (1 - clamp(swap * 2.2));
      ctx.font = `500 ${Math.round(20 * u)}px Inter, sans-serif`;
      ctx.fillStyle = sys.muted;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(desc, x1, by, x1 - lx1 - 40 * u);
      ctx.restore();
    }
  }
}

/* ───────────────────────── Card System ───────────────────────── */

const SYSTEM_FALLBACK = ["Live dashboards", "Shared reports", "Smart alerts", "Team spaces"];

/**
 * Four cards built from the same parts: a poster tile in the accent colour carrying the lead
 * feature in big type, a chart card whose hairline grid lays out before the line draws across it,
 * a ruled checklist and a brand card. Each card's outline draws first, its surface fills in
 * behind, then its content arrives. The chart has no numbers: it shows motion, not a claim.
 */
function cardSystem(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, seed } = sc;
  const sys = system(sc);
  stage(sc, sys);
  const portrait = h > w;
  const head = topHeadline(sc);
  const items = itemsOr(scene, 3, SYSTEM_FALLBACK).slice(0, 5).map(titleOf);
  const g = tokens(w, h);
  const gap = 18 * u;
  const gx = g.safe.left;
  const gy = Math.max(head.ys[head.ys.length - 1] + head.size * 0.9, h * (portrait ? 0.22 : 0.28));
  const gw = g.safe.width;
  const gh = h - g.safe.bottom - gy;
  const r = 18 * u;
  const ex = ease.inCubic(exitT(sc, 0.45));
  // Layout: poster tile | chart over (list, brand).
  type Box = [number, number, number, number];
  let A: Box, B: Box, C: Box, D: Box;
  if (portrait) {
    const hA = gh * 0.3;
    const hB = gh * 0.32;
    A = [gx, gy, gw, hA];
    B = [gx, gy + hA + gap, gw, hB];
    const y3 = gy + hA + hB + gap * 2;
    const h3 = gh - hA - hB - gap * 2;
    C = [gx, y3, (gw - gap) * 0.6, h3];
    D = [gx + (gw - gap) * 0.6 + gap, y3, (gw - gap) * 0.4, h3];
  } else {
    const wA = gw * 0.36;
    const xR = gx + wA + gap;
    const wR = gw - wA - gap;
    const hB = (gh - gap) * 0.56;
    A = [gx, gy, wA, gh];
    B = [xR, gy, wR, hB];
    C = [xR, gy + hB + gap, (wR - gap) * 0.58, gh - hB - gap];
    D = [xR + (wR - gap) * 0.58 + gap, gy + hB + gap, (wR - gap) * 0.42, gh - hB - gap];
  }
  const starts = [0.35, 0.5, 0.65, 0.8];
  const cardIn = (i: number) => ({ line: ease.inOutCubic(range(t, starts[i], starts[i] + 0.55)), fill: ease.outCubic(range(t, starts[i] + 0.3, starts[i] + 0.7)), lt: t - starts[i] - 0.45 });
  const card = (b: Box, i: number, accent = false) => {
    const k = cardIn(i);
    const [x, y, bw, bh] = b;
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    ctx.translate(0, -ex * 16 * u * (1 + i * 0.3));
    if (k.fill > 0) {
      ctx.save();
      ctx.globalAlpha *= k.fill;
      if (accent) {
        const fill = ctx.createLinearGradient(x, y, x + bw, y + bh);
        fill.addColorStop(0, palette.primary);
        fill.addColorStop(1, palette.secondary);
        ctx.fillStyle = fill;
      } else ctx.fillStyle = sys.surface;
      ctx.beginPath();
      ctx.roundRect(x, y, bw, bh, r);
      ctx.fill();
      ctx.restore();
    }
    frameDraw(ctx, x, y, bw, bh, r, k.line, accent ? rgba("#ffffff", 0.35) : sys.line1, sys.px);
    ctx.restore();
    return k;
  };
  const pad = 24 * u;
  // Ink on the accent tile: white on a deep accent, the stage's dark on a pale one.
  const paleAccent = (luminance(palette.primary) + luminance(palette.secondary)) / 2 > 0.4;
  const inkOnAccent = paleAccent ? mixHex(palette.bg0, "#000000", 0.3) : "#ffffff";
  const onAccent = inkOnAccent;

  // A — the poster tile: lead feature in big type, index and arrow.
  {
    const k = card(A, 0, true);
    const [x, y, bw, bh] = A;
    const ck = range(k.lt, 0, 0.5) * (1 - ex);
    if (ck > 0) {
      meta(sc, "01 — Feature", x + pad, y + pad + 8 * u, ck, { color: rgba(inkOnAccent, 0.8) });
      ctx.save();
      ctx.globalAlpha = ck;
      drawLucide(ctx, "ArrowUp", x + bw - pad - 12 * u, y + pad + 8 * u, 26 * u, inkOnAccent, { progress: ck });
      ctx.restore();
      // Big type, stacked, bottom-left, rising from a mask.
      const words = items[0].split(/\s+/).map((wd) => ({ w: wd, a: false }));
      const fit = posterLines(sc, words, bw - pad * 2, bh * 0.55, 3);
      const lines = fit.lines;
      const size = Math.min(fit.size, bh * (portrait ? 0.3 : 0.17));
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, bw, bh);
      ctx.clip();
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      lines.forEach((line, i) => {
        const ly = y + bh - pad - (lines.length - 1 - i) * size * 0.98 - size * 0.12;
        const kk = ease.outExpo(range(k.lt, 0.05 + i * 0.08, 0.75 + i * 0.08));
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, ly - size, bw, size * 1.25);
        ctx.clip();
        ctx.font = displayFont(saasFont(sc), size);
        ctx.fillStyle = inkOnAccent;
        ctx.globalAlpha = 1 - ex;
        ctx.fillText(line.map((l) => l.w).join(" "), x + pad, ly + (1 - kk) * size * 1.1);
        ctx.restore();
      });
      ctx.restore();
      // A slow orbiting ring motif in the free space.
      ctx.save();
      ctx.globalAlpha = ck * 0.5;
      ctx.strokeStyle = rgba(onAccent, 0.35);
      ctx.lineWidth = sys.px;
      const rr = Math.min(bw, bh) * 0.24;
      const ocx = x + bw * 0.62;
      const ocy = y + bh * 0.34;
      ctx.beginPath();
      ctx.arc(ocx, ocy, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ocx, ocy, rr * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      const a = (sc.globalT ?? t) * 0.9;
      ctx.fillStyle = inkOnAccent;
      ctx.globalAlpha = ck;
      ctx.beginPath();
      ctx.arc(ocx + Math.cos(a) * rr, ocy + Math.sin(a) * rr, 5 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // B — the chart: grid lays out, the line draws, a crosshair reads along it.
  {
    const k = card(B, 1);
    const [x, y, bw, bh] = B;
    const ck = range(k.lt, 0, 0.4) * (1 - ex);
    if (ck > 0) {
      meta(sc, items[1] ?? "Activity", x + pad, y + pad + 8 * u, ck, { color: palette.text });
      // "Live" with a breathing dot.
      const breathe = 0.5 + 0.5 * Math.sin((sc.globalT ?? t) * 4);
      ctx.save();
      ctx.globalAlpha = ck;
      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      ctx.arc(x + bw - pad - 74 * u, y + pad + 8 * u, (4 + breathe * 1.5) * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      meta(sc, "Live", x + bw - pad, y + pad + 8 * u, ck, { align: "right" });
      const px0 = x + pad;
      const px1 = x + bw - pad;
      const py0 = y + pad + 44 * u;
      const py1 = y + bh - pad - 22 * u;
      // Grid: 4 rows (tier 3), ticks along the base (tier 2).
      ctx.save();
      ctx.globalAlpha = 1 - ex;
      for (let i = 0; i <= 3; i++) {
        const gyy = Math.round(lerp(py0, py1, i / 3)) + 0.5;
        rule(ctx, px0, gyy, px1, gyy, ease.outCubic(range(k.lt, 0.05 + i * 0.05, 0.6 + i * 0.05)), i === 3 ? sys.line2 : sys.line3, sys.px);
      }
      const ticks = 12;
      for (let i = 0; i <= ticks; i++) {
        const tx = Math.round(lerp(px0, px1, i / ticks)) + 0.5;
        const tk = range(k.lt, 0.3 + i * 0.02, 0.5 + i * 0.02);
        rule(ctx, tx, py1, tx, py1 + (i % 3 === 0 ? 10 : 5) * u, tk, sys.line2, sys.px);
      }
      // The series: a rising, wandering line (deterministic per film).
      const rnd = rng(seed + 77);
      const N = 28;
      const vals: number[] = [];
      let v = 0.18;
      for (let i = 0; i < N; i++) {
        v = clamp(v + (rnd() - 0.38) * 0.12 + 0.012, 0.08, 0.95);
        vals.push(v);
      }
      const pt = (i: number) => [lerp(px0, px1, i / (N - 1)), lerp(py1, py0, vals[i])] as const;
      const draw = ease.inOutCubic(range(k.lt, 0.35, 1.5));
      const last = draw * (N - 1);
      const path = new Path2D();
      for (let i = 0; i <= Math.floor(last); i++) {
        const [px, py] = pt(i);
        if (i === 0) path.moveTo(px, py);
        else path.lineTo(px, py);
      }
      const li = Math.floor(last);
      if (li < N - 1) {
        const [ax, ay] = pt(li);
        const [bx, by2] = pt(li + 1);
        path.lineTo(lerp(ax, bx, last - li), lerp(ay, by2, last - li));
      }
      const headX = lerp(px0, px1, draw);
      if (draw > 0) {
        const area = new Path2D(path);
        area.lineTo(headX, py1);
        area.lineTo(px0, py1);
        area.closePath();
        const fillG = ctx.createLinearGradient(0, py0, 0, py1);
        fillG.addColorStop(0, rgba(palette.primary, palette.light ? 0.18 : 0.28));
        fillG.addColorStop(1, rgba(palette.primary, 0));
        ctx.fillStyle = fillG;
        ctx.fill(area);
        ctx.strokeStyle = palette.primary;
        ctx.lineWidth = Math.max(2, 2.6 * u);
        ctx.lineJoin = "round";
        ctx.stroke(path);
      }
      // Crosshair: once drawn, it reads back along the line.
      const rk = range(k.lt, 1.6, 2.0);
      if (rk > 0) {
        const f = 0.55 + 0.35 * Math.sin((t - starts[1] - 2.05) * 0.9);
        const fi = f * (N - 1);
        const i0 = Math.floor(fi);
        const [ax, ay] = pt(i0);
        const [bx, by2] = pt(Math.min(N - 1, i0 + 1));
        const cx = lerp(ax, bx, fi - i0);
        const cyy = lerp(ay, by2, fi - i0);
        ctx.globalAlpha = rk * (1 - ex);
        rule(ctx, Math.round(cx) + 0.5, py0, Math.round(cx) + 0.5, py1, 1, sys.line1, sys.px);
        ctx.fillStyle = palette.bg0;
        ctx.strokeStyle = palette.primary;
        ctx.lineWidth = 2.5 * u;
        ctx.beginPath();
        ctx.arc(cx, cyy, 7 * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Tooltip with the feature's name.
        const label = items[2] ?? items[0];
        ctx.font = `600 ${Math.round(17 * u)}px Inter, sans-serif`;
        const tw = ctx.measureText(label).width + 28 * u;
        const tx = clamp(cx - tw / 2, px0, px1 - tw);
        const ty = Math.max(py0 - 6 * u, cyy - 58 * u);
        ctx.fillStyle = palette.text;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, 34 * u, 8 * u);
        ctx.fill();
        ctx.fillStyle = palette.bg0;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, tx + 14 * u, ty + 17 * u);
      }
      ctx.restore();
    }
  }

  // C — the checklist: ruled rows tick on one after another, the focus moving down them.
  {
    const k = card(C, 2);
    const [x, y, bw, bh] = C;
    const list = items.slice(0, Math.min(4, items.length));
    const rowH = Math.min(54 * u, (bh - pad * 2) / list.length);
    const y0 = y + (bh - rowH * list.length) / 2;
    const focus = Math.floor(Math.max(0, k.lt - 1) / Math.max(0.6, sc.beat * 2)) % list.length;
    list.forEach((it, i) => {
      const rk = range(k.lt, 0.05 + i * 0.12, 0.5 + i * 0.12) * (1 - ex);
      if (rk <= 0) return;
      const ry = y0 + i * rowH;
      const lit = k.lt > 1 && i === focus;
      ctx.save();
      ctx.globalAlpha = rk;
      if (lit) {
        ctx.fillStyle = rgba(palette.primary, palette.light ? 0.08 : 0.12);
        ctx.beginPath();
        ctx.roundRect(x + 8 * u, ry + 4 * u, bw - 16 * u, rowH - 8 * u, 10 * u);
        ctx.fill();
      }
      if (i < list.length - 1) rule(ctx, x + pad, Math.round(ry + rowH) + 0.5, x + bw - pad, Math.round(ry + rowH) + 0.5, ease.outCubic(rk), sys.line2, sys.px);
      const ck2 = ease.outCubic(range(k.lt, 0.3 + i * 0.15, 0.8 + i * 0.15));
      ctx.strokeStyle = ck2 > 0.5 ? palette.primary : sys.line1;
      ctx.lineWidth = sys.px * 1.4;
      ctx.beginPath();
      ctx.arc(x + pad + 12 * u, ry + rowH / 2, 12 * u, 0, Math.PI * 2);
      ctx.stroke();
      if (ck2 > 0) drawLucide(ctx, "Check", x + pad + 12 * u, ry + rowH / 2, 16 * u, palette.primary, { progress: ck2 });
      ctx.font = `${lit ? 650 : 500} ${Math.round(Math.min(20 * u, rowH * 0.4))}px Inter, sans-serif`;
      ctx.fillStyle = lit ? palette.text : rgba(palette.text, 0.8);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(it, x + pad + 36 * u + (1 - rk) * 10 * u, ry + rowH / 2, bw - pad * 2 - 40 * u);
      ctx.restore();
    });
  }

  // D — the brand card: the logo (or the product's mark), its name and address.
  {
    const k = card(D, 3);
    const [x, y, bw, bh] = D;
    const ck = ease.outCubic(range(k.lt, 0.05, 0.6)) * (1 - ex);
    if (ck > 0) {
      const logo = getImage(sc.brand?.logo);
      const mcx = x + bw / 2;
      const mcy = y + bh * 0.42;
      const box = Math.min(bw, bh) * 0.3;
      if (logo?.naturalWidth) {
        const ar = logo.naturalWidth / logo.naturalHeight;
        const lw = Math.min(bw - pad * 2, box * Math.max(1, ar), logoMaxWidth(ctx, logo));
        const lh = lw / ar;
        ctx.save();
        ctx.globalAlpha = ck;
        drawLogo(ctx, logo, !!palette.light, mcx - lw / 2, mcy - lh / 2 + (1 - ck) * 10 * u, lw, lh);
        ctx.restore();
      } else brandGlyph(sc, mcx, mcy, box, ck, 0.4);
      const name = sc.brand?.name ?? "";
      if (name) {
        ctx.save();
        ctx.globalAlpha = ck;
        ctx.font = `700 ${Math.round(Math.min(24 * u, bw / 9))}px Inter, sans-serif`;
        ctx.fillStyle = palette.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(name, mcx, y + bh * 0.76, bw - pad * 2);
        ctx.restore();
      }
      meta(sc, sc.brand?.domain ?? "", mcx, y + bh * 0.76 + 30 * u, ck, { align: "center", size: 14 * u });
    }
  }
}

/* ───────────────────────── Kinetic Rows ───────────────────────── */

/**
 * Full-width bands of big type between hairlines, sliding in opposite directions like a
 * designer's marquee (filled and outlined in turn). The middle band carries the line itself: it
 * decelerates into place, holds, and the bands accelerate away at the end.
 */
function kineticRows(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  const sys = system(sc);
  stage(sc, sys);
  const portrait = h > w;
  const R = portrait ? 7 : 5;
  const mid = Math.floor(R / 2);
  const weights = Array.from({ length: R }, (_, i) => (i === mid ? (portrait ? 2.4 : 1.9) : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const unit = h / total;
  const words = accentWords(scene.text || "Make it move");
  const fromItems = (scene.items ?? []).map(titleOf).filter(Boolean);
  const pool = fromItems.length >= 2 ? fromItems : words.map((x) => x.w);
  const ex = exitT(sc, 0.55);
  const fly = ease.inCubic(ex);
  let y = 0;
  for (let i = 0; i < R; i++) {
    const rh = weights[i] * unit;
    const ry = y;
    y += rh;
    // Dividers (tier 2) draw across from alternating sides.
    if (i > 0) {
      const dir = i % 2 ? 1 : -1;
      const p = ease.inOutCubic(range(t, 0.05 + i * 0.05, 0.75 + i * 0.05));
      const yy = Math.round(ry) + 0.5;
      ctx.save();
      ctx.globalAlpha = 1 - fly;
      if (dir > 0) rule(ctx, 0, yy, w, yy, p, sys.line2, sys.px);
      else rule(ctx, w, yy, 0, yy, p, sys.line2, sys.px);
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, ry, w, rh);
    ctx.clip();
    if (i === mid) {
      // The line itself, fitted to the band, gliding in and settling.
      const { lines, size } = posterLines(sc, words, w * 0.88, rh * 0.8, 1);
      const line = lines.flat();
      const lw = lineWidth(sc, line, size);
      const settle = ease.outExpo(range(t, 0.3, 1.5));
      const hold = ease.inOutCubic(range(t, 1.5, d)) * w * 0.015;
      const x = (w - lw) / 2 + (1 - settle) * w * 0.8 - hold - fly * w * 1.2;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      drawWords(sc, line, x, ry + rh / 2 + size * 0.36, size);
      meta(sc, scene.eyebrow ?? "", g0(sc), ry + 22 * u, range(t, 1.0, 1.4) * (1 - fly), { color: palette.primary });
    } else {
      // A marquee band: the features (or the line's words) around and around.
      const size = rh * 0.66;
      const font = displayFont(saasFont(sc), size);
      ctx.font = font;
      const sep = "  ·  ";
      const offset = (i * 2) % pool.length;
      const seq = [...pool.slice(offset), ...pool.slice(0, offset)].join(sep) + sep;
      const segW = ctx.measureText(seq).width;
      if (segW > 0) {
        const dir = i % 2 ? -1 : 1;
        const speed = w * (0.035 + 0.01 * (i % 3));
        const burst = (1 - ease.outCubic(range(t, 0, 1.4))) * w * 0.5;
        const travel = (t * speed + burst + fly * w * 1.4 * (1 + i * 0.1)) * dir;
        let x0 = ((travel % segW) + segW) % segW - segW;
        const outline = i % 2 === 1;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.globalAlpha = range(t, 0.1 + Math.abs(i - mid) * 0.08, 0.6 + Math.abs(i - mid) * 0.08) * (1 - fly);
        const by = ry + rh / 2 + size * 0.36;
        while (x0 < w) {
          if (outline) {
            ctx.strokeStyle = sys.line1;
            ctx.lineWidth = Math.max(1, 1.3 * u);
            ctx.strokeText(seq, x0, by);
          } else {
            ctx.fillStyle = rgba(palette.text, palette.light ? 0.14 : 0.12);
            ctx.fillText(seq, x0, by);
          }
          x0 += segW;
        }
      }
    }
    ctx.restore();
  }
}

const g0 = (sc: SkillContext) => tokens(sc.w, sc.h).safe.left;

/* ───────────────────────── Registry ───────────────────────── */

export const editorialSkills: Skill[] = [
  {
    id: "type-poster",
    name: "Kinetic Poster",
    tagline: "A Swiss poster builds itself: hairline frame and column rules draw on, huge stacked type rises out of its masks, an accent disc lands.",
    bestFor: "A bold statement or positioning line set as a poster (3–8 words, the *accent* in italic serif). Items = up to 4 short list entries for the side column; subtext = a footer note.",
    sample: { text: "Design that *moves*", subtext: "Made with IntroMaker", items: ["Motion", "Type", "Systems"] },
    itemsHint: "Up to 4 short features for the list column",
    render: typePoster,
    sfx: () => [
      { t: 0.05, kind: "swoosh" },
      { t: 0.4, kind: "whoosh" },
      { t: 0.6, kind: "pop" },
    ],
  },
  {
    id: "showreel",
    name: "Showreel",
    tagline: "Framed cards glide in and snap to centre one by one, corner ticks on the card in focus, a counter and progress hairline beneath.",
    bestFor: "Walking through 3–6 features or use cases one at a time (items as 'Title — one line'); uses the brand's photos when there are any.",
    sample: { text: "Features in *one reel*", items: REEL_FALLBACK },
    itemsHint: "Feature title — one line, per card",
    render: showreel,
    sfx: (scene, beat) => {
      const n = itemsOr(scene, 2, REEL_FALLBACK).slice(0, 6).length;
      const P = reelPeriod(scene);
      void beat;
      return [{ t: 0.15, kind: "whoosh" as const }, ...Array.from({ length: n - 1 }, (_, i) => ({ t: 1.0 + (i + 1) * P - P * 0.2, kind: "swoosh" as const }))];
    },
  },
  {
    id: "card-system",
    name: "Card System",
    tagline: "A poster tile, a live chart card, a checklist and a brand card, built from the same hairlines and surface: outlines draw, surfaces fill, content arrives.",
    bestFor: "Showing a product as one coherent system: 3–5 short feature names (the first leads the poster tile, the second titles the chart). No numbers are shown.",
    sample: { text: "One system, *many surfaces*", items: SYSTEM_FALLBACK },
    itemsHint: "3–5 short feature names",
    render: cardSystem,
    sfx: () => [
      { t: 0.35, kind: "tick" },
      { t: 0.5, kind: "tick" },
      { t: 0.65, kind: "tick" },
      { t: 0.8, kind: "tick" },
      { t: 1.2, kind: "shimmer" },
    ],
  },
  {
    id: "type-rows",
    name: "Kinetic Rows",
    tagline: "Bands of big type slide in opposite directions between hairlines; the middle band carries the line and settles into place.",
    bestFor: "A positioning line with energy (2–6 words) over a marquee of the features (items). Good between the reveal and the product, or before the call to action.",
    sample: { text: "Built to *move*", items: ["Plan", "Design", "Ship", "Grow"] },
    itemsHint: "Short features for the marquee bands",
    render: kineticRows,
    sfx: () => [
      { t: 0.05, kind: "whoosh" },
      { t: 1.1, kind: "strike" },
    ],
  },
];
