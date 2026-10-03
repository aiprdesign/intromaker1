import { exitT } from "../fx";
import { tokens } from "../grid";
import { drawLucide } from "../icons";
import { clamp, ease, lerp, mixHex, range, rgba, rng } from "../math";
import { iconsFor, imageless, luminance, saasFont, spring } from "../saasfx";
import { displayFont, fillTextFit } from "../text";
import type { Scene, Skill, SkillContext } from "../types";
import {
  accentWords,
  descOf,
  drawWords,
  focusTicks,
  frameDraw,
  itemsOr,
  lineWidth,
  meta,
  posterLines,
  REEL_FALLBACK,
  reelCard,
  reelPeriod,
  rule,
  stage,
  system,
  titleOf,
  type System,
  type Word,
  wordFont,
} from "./editorial";
import { topHeadline } from "./saas";

/**
 * More of the editorial system: two more posters (a Bauhaus module grid, a split poster with a
 * monogram), two more ways through the features (a swiped card deck, a contact sheet with a moving
 * focus), two more card layouts (a ruled spec sheet, a set of live widgets) and two more kinetic
 * type moments (echoes, slot reels). Same closed system: the palette, one surface, three hairlines.
 */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** The ink that reads on the accent gradient: white on a deep accent, the stage's dark on a pale one. */
function inkOn(sc: SkillContext) {
  const { palette } = sc;
  return (luminance(palette.primary) + luminance(palette.secondary)) / 2 > 0.4 ? mixHex(palette.bg0, "#000000", 0.3) : "#ffffff";
}

/** Card entry: the outline draws, then the surface fills in behind it, then the content (lt). */
function cardIn(t: number, start: number) {
  return { line: ease.inOutCubic(range(t, start, start + 0.55)), fill: ease.outCubic(range(t, start + 0.3, start + 0.7)), lt: t - start - 0.45 };
}

function surfaceCard(sc: SkillContext, sys: System, x: number, y: number, cw: number, ch: number, k: { line: number; fill: number }, opts: { r?: number; border?: string } = {}) {
  const { ctx, u } = sc;
  const r = opts.r ?? 18 * sc.u;
  if (k.fill > 0) {
    ctx.save();
    ctx.globalAlpha *= k.fill;
    ctx.shadowColor = sc.palette.light ? "rgba(15,30,60,0.1)" : "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 30 * u;
    ctx.shadowOffsetY = 10 * u;
    ctx.fillStyle = sys.surface;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, r);
    ctx.fill();
    ctx.restore();
  }
  frameDraw(ctx, x, y, cw, ch, r, k.line, opts.border ?? sys.line1, sys.px);
}

/** Header and footer chrome shared by the posters: hairline frame, column rules, meta labels. */
function posterChrome(sc: SkillContext, sys: System, fade: number, cols: number, no: string) {
  const { ctx, w, h, t, u, palette, scene } = sc;
  const g = tokens(w, h);
  const fx = g.safe.left;
  const fy = g.safe.top;
  const fw = g.safe.width;
  const fh = g.safe.height;
  const headH = 54 * u;
  const pad = 22 * u;
  ctx.save();
  ctx.globalAlpha = fade;
  frameDraw(ctx, fx, fy, fw, fh, 0, ease.inOutCubic(range(t, 0, 0.8)), sys.line1, sys.px);
  for (let i = 1; i < cols; i++) {
    const x = Math.round(fx + (fw * i) / cols) + 0.5;
    rule(ctx, x, fy, x, fy + fh, ease.outCubic(range(t, 0.15 + i * 0.07, 0.95 + i * 0.07)), sys.line3, sys.px);
  }
  rule(ctx, fx, fy + headH, fx + fw, fy + headH, ease.outCubic(range(t, 0.25, 0.9)), sys.line2, sys.px);
  rule(ctx, fx + fw, fy + fh - headH, fx, fy + fh - headH, ease.outCubic(range(t, 0.3, 0.95)), sys.line2, sys.px);
  ctx.restore();
  const mk = range(t, 0.45, 0.9) * fade;
  meta(sc, sc.brand?.name ?? "", fx + pad, fy + headH / 2, mk);
  meta(sc, scene.eyebrow ?? "", fx + fw / 2, fy + headH / 2, mk, { align: "center" });
  meta(sc, no, fx + fw - pad, fy + headH / 2, mk, { align: "right" });
  meta(sc, sc.brand?.domain ?? "", fx + pad, fy + fh - headH / 2, mk);
  meta(sc, scene.subtext ?? "", fx + fw - pad, fy + fh - headH / 2, mk, { align: "right", color: palette.text });
  return { fx, fy, fw, fh, headH, pad };
}

/** Stacked headline lines, each rising out of its own mask on the way in and out again at the end. */
function riseLines(sc: SkillContext, lines: Word[][], size: number, x: number, firstBaseline: number, opts: { start?: number; lead?: number; clipX?: number; clipW?: number; drift?: number; align?: "left" | "center" } = {}) {
  const { ctx, w, t, d } = sc;
  const lead = opts.lead ?? size * 1.02;
  const start0 = opts.start ?? 0.35;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, i) => {
    const y = firstBaseline + i * lead;
    const start = start0 + i * 0.09;
    const inK = ease.outExpo(range(t, start, start + 0.75));
    const outK = ease.inCubic(range(t, d - 0.55 + i * 0.05, d - 0.15 + i * 0.05));
    if (inK <= 0 || outK >= 1) return;
    const drift = (i % 2 ? -1 : 1) * w * (opts.drift ?? 0.01) * ease.inOutCubic(range(t, 1.1, d));
    const lx = opts.align === "center" ? x - lineWidth(sc, line, size) / 2 : x;
    ctx.save();
    ctx.beginPath();
    ctx.rect(opts.clipX ?? 0, y - size * 0.98, opts.clipW ?? w, size * 1.26);
    ctx.clip();
    drawWords(sc, line, lx + drift, y + (1 - inK) * size * 1.1 - outK * size * 1.15, size);
    ctx.restore();
  });
  ctx.restore();
}

/* ───────────────────────── Grid Poster ───────────────────────── */

/**
 * A Bauhaus module grid: a 3×3 grid of squares draws on beside the stacked headline, and each
 * module fills with a geometric shape (disc, quarter circle, half disc, ring, diamond, stripes,
 * dots, triangle, a colour field) popping in on the beat. Holding, the quarter circles turn.
 */
function posterGrid(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, seed } = sc;
  const sys = system(sc);
  stage(sc, sys);
  const portrait = h > w;
  const ex = ease.inCubic(exitT(sc, 0.55));
  const fade = 1 - ex;
  const { fx, fy, fw, fh, headH, pad } = posterChrome(sc, sys, fade, portrait ? 2 : 4, "No. 02");
  const top = fy + headH;
  const bottom = fy + fh - headH;
  const innerH = bottom - top;
  const N = 3;
  const cell = portrait ? Math.min((fw - pad * 2) / N, (innerH * 0.5) / N) : Math.min((innerH - pad * 2) / N, (fw * 0.46) / N);
  const gx = portrait ? fx + (fw - cell * N) / 2 : fx + fw - pad - cell * N;
  const gy = portrait ? top + pad : top + (innerH - cell * N) / 2;
  // The module grid (tier 2).
  ctx.save();
  ctx.globalAlpha = fade;
  for (let i = 0; i <= N; i++) {
    const p = ease.inOutCubic(range(t, 0.2 + i * 0.05, 0.8 + i * 0.05));
    rule(ctx, gx + i * cell, gy, gx + i * cell, gy + cell * N, p, sys.line2, sys.px);
    rule(ctx, gx, gy + i * cell, gx + cell * N, gy + i * cell, p, sys.line2, sys.px);
  }
  ctx.restore();
  // Shapes, in a per-film order.
  const r = rng(seed + 31);
  const kinds = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => r() - 0.5);
  const turn = Math.max(0.5, sc.beat * 2);
  for (let k = 0; k < N * N; k++) {
    const cx = gx + (k % N) * cell + cell / 2;
    const cy = gy + Math.floor(k / N) * cell + cell / 2;
    const lt = t - (0.55 + k * Math.min(0.09, sc.beat / 3));
    if (lt <= 0) continue;
    const e = clamp(spring(lt, 11, 7), 0, 1.15) * fade;
    const s = cell * 0.36;
    const kind = kinds[k];
    // Quarter turns on the beat once everything has landed.
    const steps = Math.max(0, (t - 1.8) / turn);
    const rot = (Math.floor(steps) + ease.inOutCubic(clamp((steps % 1) * 3))) * (Math.PI / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(e, e);
    ctx.fillStyle = [palette.primary, palette.secondary, palette.text][k % 3];
    ctx.strokeStyle = palette.text;
    ctx.lineWidth = Math.max(1.5, 2 * u);
    switch (kind) {
      case 0:
        ctx.fillStyle = palette.primary;
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 1:
        ctx.rotate(rot);
        ctx.fillStyle = palette.secondary;
        ctx.beginPath();
        ctx.moveTo(-s, -s);
        ctx.arc(-s, -s, s * 2, 0, Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        break;
      case 2:
        ctx.rotate(-rot / 2);
        ctx.fillStyle = palette.text;
        ctx.beginPath();
        ctx.arc(0, s * 0.3, s, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        break;
      case 3:
        ctx.strokeStyle = palette.primary;
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(Math.cos(rot) * s, Math.sin(rot) * s, 5 * u, 0, Math.PI * 2);
        ctx.fillStyle = palette.primary;
        ctx.fill();
        break;
      case 4:
        ctx.rotate(Math.PI / 4 + rot / 2);
        ctx.strokeStyle = palette.secondary;
        ctx.strokeRect(-s * 0.75, -s * 0.75, s * 1.5, s * 1.5);
        break;
      case 5:
        ctx.beginPath();
        ctx.rect(-s, -s, s * 2, s * 2);
        ctx.clip();
        ctx.strokeStyle = sys.line1;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(i * s * 0.5 - s, s);
          ctx.lineTo(i * s * 0.5 + s, -s);
          ctx.stroke();
        }
        break;
      case 6:
        ctx.fillStyle = palette.text;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          ctx.beginPath();
          ctx.arc(a * s * 0.6, b * s * 0.6, 4 * u, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 7:
        ctx.rotate(rot);
        ctx.fillStyle = palette.primary;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.9, s * 0.7);
        ctx.lineTo(-s * 0.9, s * 0.7);
        ctx.closePath();
        ctx.fill();
        break;
      default:
        ctx.fillStyle = rgba(palette.primary, palette.light ? 0.14 : 0.2);
        ctx.fillRect(-cell / 2 + 1, -cell / 2 + 1, cell - 2, cell - 2);
    }
    ctx.restore();
  }
  // The headline, stacked, and the list under it.
  const items = (scene.items ?? []).filter(Boolean).slice(0, 4).map(titleOf);
  const words = accentWords(scene.text || "Form follows *function*");
  const listH = items.length ? 46 * u : 0;
  const bx = fx + pad;
  const bw = portrait ? fw - pad * 2 : gx - pad * 2 - fx;
  const btop = portrait ? gy + cell * N + pad * 1.5 : top + pad;
  const bh = bottom - pad - listH - btop;
  const fit = posterLines(sc, words, bw, bh, 4);
  const lines = fit.lines;
  // Room for the last line's descenders above the list.
  const size = Math.min(fit.size, bh / (lines.length * 1.02 + 0.2));
  riseLines(sc, lines, size, bx, btop + size * 0.86, { clipX: fx, clipW: portrait ? fw : gx - fx });
  if (items.length) {
    let x = bx;
    const y = bottom - pad - listH / 2;
    ctx.save();
    items.forEach((it, i) => {
      const k = range(t, 1.0 + i * 0.12, 1.5 + i * 0.12) * fade;
      meta(sc, pad2(i + 1), x, y, k, { color: palette.primary });
      ctx.globalAlpha = ease.outCubic(k);
      ctx.font = `600 ${Math.round(19 * u)}px Inter, sans-serif`;
      ctx.fillStyle = palette.text;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(it, x + 34 * u, y);
      x += 34 * u + ctx.measureText(it).width + 34 * u;
    });
    ctx.restore();
  }
}

/* ───────────────────────── Split Poster ───────────────────────── */

/**
 * A split poster: an accent panel wipes up with the brand's monogram rising huge inside it and its
 * name running up the edge; beside it the headline stacks, the line under it, the features as
 * outlined chips, and a ruler whose marker runs the length of the slide.
 */
function posterSplit(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  const sys = system(sc);
  stage(sc, sys);
  const portrait = h > w;
  const ex = ease.inCubic(exitT(sc, 0.55));
  const fade = 1 - ex;
  const g = tokens(w, h);
  const fx = g.safe.left;
  const fy = g.safe.top;
  const fw = g.safe.width;
  const fh = g.safe.height;
  const pad = 26 * u;
  const ink = inkOn(sc);
  // The accent panel.
  const pw = portrait ? fw : fw * 0.4;
  const ph = portrait ? fh * 0.42 : fh;
  const wipe = ease.inOutCubic(range(t, 0.05, 0.7));
  ctx.save();
  ctx.globalAlpha = fade;
  const fill = ctx.createLinearGradient(fx, fy, fx + pw, fy + ph);
  fill.addColorStop(0, palette.primary);
  fill.addColorStop(1, palette.secondary);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.rect(fx, fy + ph * (1 - wipe), pw, ph * wipe);
  ctx.fill();
  ctx.clip();
  // The monogram: the brand's initial, rising and drifting slowly up.
  const name = (sc.brand?.name ?? scene.text.replace(/\*/g, "")).trim();
  const initial = (name.match(/[A-Za-z0-9]/)?.[0] ?? "A").toUpperCase();
  const msize = Math.min(ph * 0.92, pw * 1.05);
  const rise = ease.outExpo(range(t, 0.35, 1.3));
  const drift = ease.inOutCubic(range(t, 1.3, d)) * msize * 0.04;
  ctx.font = displayFont(saasFont(sc), msize);
  ctx.fillStyle = rgba(ink, 0.92);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(initial, fx + pad * 0.8, fy + ph - pad * 0.8 + (1 - rise) * msize * 0.9 - drift);
  meta(sc, "No. 03", fx + pad, fy + pad + 6 * u, range(t, 0.6, 1.0), { color: rgba(ink, 0.8) });
  // The name up the panel's edge.
  if (name) {
    ctx.save();
    ctx.translate(fx + pw - pad, fy + ph - pad);
    ctx.rotate(-Math.PI / 2);
    meta(sc, name, 0, 0, range(t, 0.7, 1.1), { color: rgba(ink, 0.85) });
    ctx.restore();
  }
  ctx.restore();
  // The frame around the whole poster (tier 1) and the panel's edge.
  ctx.save();
  ctx.globalAlpha = fade;
  frameDraw(ctx, fx, fy, fw, fh, 0, ease.inOutCubic(range(t, 0.1, 0.9)), sys.line1, sys.px);
  ctx.restore();
  // The type side.
  const rx = portrait ? fx + pad : fx + pw + pad * 1.4;
  const rw = portrait ? fw - pad * 2 : fw - pw - pad * 2.4;
  const rtop = portrait ? fy + ph + pad : fy + pad * 1.6;
  const items = (scene.items ?? []).filter(Boolean).slice(0, 4).map(titleOf);
  const chipsH = items.length ? 44 * u : 0;
  const rulerH = 40 * u;
  const rbottom = fy + fh - pad - rulerH - chipsH - (items.length ? pad : 0);
  const subH = scene.subtext ? 70 * u : 0;
  const words = accentWords(scene.text || "Built with *intent*");
  const fit = posterLines(sc, words, rw, rbottom - rtop - subH, portrait ? 3 : 4);
  const lines = fit.lines;
  // The block (lines, then the supporting line under them) fits above the chips.
  const size = Math.min(fit.size, (rbottom - rtop - subH) / (lines.length * 1.02 + 0.2));
  const lead = size * 1.02;
  riseLines(sc, lines, size, rx, rtop + size * 0.86, { start: 0.5, clipX: rx - pad, clipW: rw + pad * 2, drift: 0.006 });
  // The supporting line.
  let y = rtop + size * 0.86 + (lines.length - 1) * lead + size * 0.6;
  if (scene.subtext) {
    const k = ease.outCubic(range(t, 0.95, 1.5)) * fade;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.font = `500 ${Math.round(Math.min(24 * u, rw / 26))}px Inter, sans-serif`;
    ctx.fillStyle = sys.muted;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    fillTextFit(ctx, scene.subtext, rx, y + (1 - k) * 10 * u, rw, { lineHeight: 1.25 });
    ctx.restore();
    y += subH;
  }
  // Chips.
  if (items.length) {
    let cx = rx;
    const cy = fy + fh - pad - rulerH - pad - chipsH / 2;
    ctx.save();
    ctx.font = `600 ${Math.round(18 * u)}px Inter, sans-serif`;
    items.forEach((it, i) => {
      const k = ease.outCubic(range(t, 1.1 + i * 0.1, 1.5 + i * 0.1)) * fade;
      const tw = ctx.measureText(it).width + 36 * u;
      if (cx + tw > rx + rw) return;
      ctx.globalAlpha = k;
      ctx.strokeStyle = i === 0 ? palette.primary : sys.line1;
      ctx.lineWidth = sys.px;
      ctx.beginPath();
      ctx.roundRect(cx, cy - chipsH / 2 + (1 - k) * 8 * u, tw, chipsH, chipsH / 2);
      ctx.stroke();
      ctx.fillStyle = palette.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(it, cx + tw / 2, cy + (1 - k) * 8 * u);
      cx += tw + 12 * u;
    });
    ctx.restore();
  }
  // The ruler: ticks every 24pt, the marker running the length of the slide.
  const ry = fy + fh - pad - rulerH / 2;
  const rk = ease.inOutCubic(range(t, 0.6, 1.3)) * fade;
  if (rk > 0) {
    ctx.save();
    ctx.globalAlpha = fade;
    rule(ctx, rx, ry, rx + rw, ry, rk, sys.line2, sys.px);
    const step = 24 * u;
    for (let i = 0, x = rx; x <= rx + rw * rk; i++, x = rx + i * step) {
      const th = (i % 5 === 0 ? 12 : 6) * u;
      rule(ctx, Math.round(x) + 0.5, ry, Math.round(x) + 0.5, ry - th, 1, sys.line2, sys.px);
    }
    const mx = rx + rw * ease.inOutCubic(range(t, 0.9, d - 0.4));
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.moveTo(mx, ry + 4 * u);
    ctx.lineTo(mx - 7 * u, ry + 16 * u);
    ctx.lineTo(mx + 7 * u, ry + 16 * u);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/* ───────────────────────── Card Stack ───────────────────────── */

/**
 * A deck of feature cards: it rises in fanned, then the top card is swiped away on each beat to
 * reveal the next, the deck stepping forward behind it. Dots and a counter track the deck.
 */
function cardStack(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene } = sc;
  const sys = system(sc);
  stage(sc, sys);
  const portrait = h > w;
  topHeadline(sc);
  const items = itemsOr(scene, 2, REEL_FALLBACK).slice(0, 6);
  const n = items.length;
  const g = tokens(w, h);
  const cw = Math.round(portrait ? w * 0.68 : Math.min(w * 0.34, h * 0.62));
  const visH = Math.round(cw * (portrait ? 0.82 : 0.62));
  const stripH = Math.round(76 * u);
  const ch = visH + stripH;
  const cy = portrait ? h * 0.53 : h * 0.585;
  const P = reelPeriod(scene);
  const t0 = 1.1;
  const kStep = Math.max(0, Math.floor((t - t0) / P));
  const frac = (t - t0 - kStep * P) / P;
  const pos = t < t0 ? 0 : Math.min(n - 1, kStep + ease.inOutCubic(range(frac, 0.7, 1)));
  const enter = ease.outExpo(range(t, 0.15, 1.1));
  const ex = ease.inCubic(exitT(sc, 0.5));
  const images = imageless(sc) ? [] : [scene.media?.src, ...(sc.brand?.images ?? [])].filter((s): s is string => !!s);
  const icons = iconsFor(items, sc);
  for (let i = n - 1; i >= Math.max(0, Math.floor(pos)); i--) {
    const rel = i - pos;
    let x = w / 2 - cw / 2;
    let y = cy - ch / 2;
    let rot = 0;
    let s = 1;
    let a = 1;
    if (rel < 0) {
      // Swiped away: off to the left with a tilt.
      const fly = ease.inCubic(-rel);
      x -= fly * w * 0.55;
      y -= fly * 30 * u;
      rot = -fly * 0.32;
      a = 1 - fly * 0.9;
    } else {
      if (rel > 3.2) continue;
      y -= rel * 36 * u;
      s = 1 - rel * 0.05;
      a = 1 - rel * 0.2;
      // The fan on the way in.
      rot = (1 - enter) * (i % 2 ? 1 : -1) * 0.08 * (1 + i * 0.4);
    }
    y += (1 - enter) * h * (0.35 + i * 0.05) + ex * h * 0.3;
    a *= (1 - ex) * range(t, 0.1 + i * 0.03, 0.4 + i * 0.03);
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x + cw / 2, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.translate(-(x + cw / 2), -y);
    reelCard(sc, sys, { x, top: y, cw, visH, stripH, index: i, title: titleOf(items[i]), icon: icons[i], img: images.length ? images[i % images.length] : undefined, on: 1 - Math.min(1, Math.abs(rel)) });
    ctx.restore();
  }
  // Dots, counter and the top card's line.
  const focus = clamp(Math.round(pos), 0, n - 1);
  const by = Math.min(cy + ch / 2 + 60 * u, h - g.safe.bottom - 10 * u);
  const fk = range(t, 0.9, 1.3) * (1 - ex);
  if (fk > 0) {
    ctx.save();
    ctx.globalAlpha = fk;
    const dw = 22 * u;
    const dx0 = w / 2 - ((n - 1) * dw) / 2;
    for (let i = 0; i < n; i++) {
      const on = 1 - clamp(Math.abs(i - pos));
      ctx.fillStyle = on > 0.01 ? palette.primary : sys.line2;
      ctx.beginPath();
      ctx.roundRect(dx0 + i * dw - (4 + on * 8) * u, by - 4 * u, (8 + on * 16) * u, 8 * u, 4 * u);
      ctx.fill();
    }
    ctx.restore();
    meta(sc, `${pad2(focus + 1)} / ${pad2(n)}`, dx0 - 24 * u, by, fk, { align: "right", color: palette.text });
    const desc = descOf(items[focus]);
    if (desc) {
      ctx.save();
      ctx.globalAlpha = fk * (1 - clamp(Math.abs(pos - focus) * 2.2));
      ctx.font = `500 ${Math.round(20 * u)}px Inter, sans-serif`;
      ctx.fillStyle = sys.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      fillTextFit(ctx, desc, w / 2, by + 40 * u, g.safe.width, { lineHeight: 1.2 });
      ctx.restore();
    }
  }
}

/* ───────────────────────── Contact Sheet ───────────────────────── */

/**
 * A contact sheet: every feature as a small framed card on one sheet, outlines first; then a focus
 * frame moves from card to card on the beat, lifting each in turn while the rest dim.
 */
function contactSheet(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  const sys = system(sc);
  stage(sc, sys);
  const portrait = h > w;
  const head = topHeadline(sc);
  const items = itemsOr(scene, 3, REEL_FALLBACK).slice(0, 6);
  const n = items.length;
  const g = tokens(w, h);
  const cols = portrait ? 2 : n <= 4 ? n : 3;
  const rows = Math.ceil(n / cols);
  const gap = 22 * u;
  const capH = 60 * u;
  const aw = g.safe.width;
  const ay = head.ys[head.ys.length - 1] + head.size * 0.9;
  const ah = h - g.safe.bottom - capH - ay;
  const stripH = Math.round(58 * u);
  let cw = (aw - gap * (cols - 1)) / cols;
  let ch = Math.min((ah - gap * (rows - 1)) / rows, cw * 0.72 + stripH);
  cw = Math.min(cw, (ch - stripH) / 0.62);
  ch = Math.min(ch, cw * 0.72 + stripH);
  const visH = ch - stripH;
  const gw = cols * cw + (cols - 1) * gap;
  const gh = rows * ch + (rows - 1) * gap;
  const gx = (w - gw) / 2;
  const gy = ay + (ah - gh) / 2;
  const at = (i: number) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const rowCount = r === rows - 1 ? n - r * cols : cols;
    const off = ((cols - rowCount) * (cw + gap)) / 2;
    return [gx + off + c * (cw + gap), gy + r * (ch + gap)] as const;
  };
  const step = Math.min(0.12, sc.beat / 2);
  const landed = 0.4 + n * step + 0.5;
  const period = Math.max(0.8, (d - landed - 0.5) / n);
  const since = Math.max(0, t - landed);
  const fi = Math.min(n - 1, Math.floor(since / period));
  const move = ease.inOutCubic(range(since - fi * period, 0, 0.35));
  const prev = Math.max(0, fi - 1);
  const ex = ease.inCubic(exitT(sc, 0.45));
  const focusOn = range(t, landed - 0.2, landed + 0.2) * (1 - ex);
  const images = imageless(sc) ? [] : [scene.media?.src, ...(sc.brand?.images ?? [])].filter((s): s is string => !!s);
  const icons = iconsFor(items, sc);
  items.forEach((it, i) => {
    const [x, y] = at(i);
    const k = cardIn(t, 0.4 + i * step);
    const lit = i === fi ? move : i === prev && fi !== prev ? 1 - move : 0;
    const dim = 1 - 0.4 * focusOn * (1 - lit);
    ctx.save();
    ctx.globalAlpha = (1 - ex) * dim;
    const s = 1 + 0.05 * lit * focusOn;
    ctx.translate(x + cw / 2, y + ch / 2 - lit * focusOn * 8 * u - ex * 16 * u);
    ctx.scale(s, s);
    ctx.translate(-(x + cw / 2), -(y + ch / 2));
    if (k.fill > 0) {
      ctx.save();
      ctx.globalAlpha *= k.fill;
      reelCard(sc, sys, { x, top: y, cw, visH, stripH, index: i, title: titleOf(it), icon: icons[i], img: images.length ? images[i % images.length] : undefined, on: Math.max(0.35, lit * focusOn), r: 14 * u });
      ctx.restore();
    }
    if (k.line < 1) frameDraw(ctx, x, y, cw, ch, 14 * u, k.line, sys.line1, sys.px);
    ctx.restore();
  });
  // The focus frame glides between cards.
  if (focusOn > 0) {
    const [x0, y0] = at(prev);
    const [x1, y1] = at(fi);
    const fx = fi === prev ? x1 : lerp(x0, x1, move);
    const fy = fi === prev ? y1 : lerp(y0, y1, move);
    focusTicks(sc, fx - 4 * u, fy - 12 * u, cw + 8 * u, ch + 8 * u, focusOn);
    // Caption: counter and the focused card's line.
    const cy = h - g.safe.bottom - capH / 2;
    meta(sc, `${pad2(fi + 1)} / ${pad2(n)}`, gx, cy, focusOn, { color: palette.text });
    const line = descOf(items[fi]) || titleOf(items[fi]);
    ctx.save();
    ctx.globalAlpha = focusOn * ease.outCubic(range(since - fi * period, 0.1, 0.45));
    ctx.font = `500 ${Math.round(21 * u)}px Inter, sans-serif`;
    ctx.fillStyle = sys.muted;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, line, gx + gw, cy, gw - 140 * u, { lineHeight: 1.15 });
    ctx.restore();
  }
}

/* ───────────────────────── Spec Sheet ───────────────────────── */

const SPEC_FALLBACK = ["Live dashboards — Your metrics, updated as they happen", "Shared reports — One link for the whole team", "Smart alerts — Know when something changes", "Team spaces — A home for your projects"];

/**
 * A ruled spec sheet: one large card whose header and row rules draw on, then each feature arrives
 * on its row (number, name, its one-line detail) and is ticked; a highlight band walks the rows.
 */
function specSheet(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene } = sc;
  const sys = system(sc);
  stage(sc, sys);
  const portrait = h > w;
  const head = topHeadline(sc);
  const items = itemsOr(scene, 3, SPEC_FALLBACK).slice(0, 5);
  const n = items.length;
  const g = tokens(w, h);
  const x = portrait ? g.safe.left : g.col(1);
  const tw = portrait ? g.safe.width : g.span(10);
  const y = head.ys[head.ys.length - 1] + head.size * 1.0;
  const th = h - g.safe.bottom - y;
  const headerH = 52 * u;
  const rowH = Math.min(portrait ? 130 * u : 118 * u, (th - headerH) / n);
  const tableH = headerH + rowH * n;
  const ty = y + (th - tableH) / 2;
  const ex = ease.inCubic(exitT(sc, 0.45));
  const k = cardIn(t, 0.3);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  ctx.translate(0, -ex * 16 * u);
  surfaceCard(sc, sys, x, ty, tw, tableH, k, { r: 20 * u });
  const pad = 28 * u;
  const cNo = x + pad;
  const cName = x + pad + 64 * u;
  // Without details, the name column takes the row.
  const details = items.some((it) => descOf(it));
  const cDesc = portrait || !details ? cName : x + tw * 0.4;
  const cTick = x + tw - pad - 16 * u;
  // Header.
  const hk = range(k.lt, 0, 0.4);
  meta(sc, "No.", cNo, ty + headerH / 2, hk);
  meta(sc, "Feature", cName, ty + headerH / 2, hk);
  if (!portrait && details) meta(sc, "Details", cDesc, ty + headerH / 2, hk);
  rule(ctx, x, Math.round(ty + headerH) + 0.5, x + tw, Math.round(ty + headerH) + 0.5, ease.outCubic(range(k.lt, 0, 0.6)), sys.line2, sys.px);
  // Rows.
  const stepT = Math.min(0.16, sc.beat / 2);
  const landed = 0.75 + n * stepT + 0.6;
  const period = Math.max(0.6, sc.beat * 2);
  const hi = t > landed ? Math.floor((t - landed) / period) % n : -1;
  const hiK = t > landed ? ease.inOutCubic(range((t - landed) % period, 0, 0.3)) : 0;
  items.forEach((it, i) => {
    const ry = ty + headerH + i * rowH;
    const lt = t - (0.75 + i * stepT);
    if (lt <= 0) return;
    if (i === hi) {
      ctx.save();
      ctx.globalAlpha *= hiK;
      ctx.fillStyle = rgba(palette.primary, palette.light ? 0.07 : 0.1);
      ctx.fillRect(x + 1, ry + 1, tw - 2, rowH - 2);
      ctx.fillStyle = palette.primary;
      ctx.fillRect(x + 1, ry + rowH * 0.2, 3 * u, rowH * 0.6);
      ctx.restore();
    }
    if (i < n - 1) rule(ctx, x + pad, Math.round(ry + rowH) + 0.5, x + tw - pad, Math.round(ry + rowH) + 0.5, ease.outCubic(range(lt, 0, 0.5)), sys.line2, sys.px);
    const e = ease.outExpo(range(lt, 0.05, 0.7));
    const [title, desc] = [titleOf(it), descOf(it)];
    meta(sc, pad2(i + 1), cNo, ry + rowH / 2, e, { color: palette.primary });
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, ry, tw, rowH);
    ctx.clip();
    const fs = Math.min(30 * u, rowH * 0.3);
    ctx.font = `650 ${Math.round(fs)}px Inter, sans-serif`;
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const nameY = portrait && desc ? ry + rowH * 0.36 : ry + rowH / 2;
    fillTextFit(ctx, title, cName, nameY + (1 - e) * rowH * 0.6, portrait || !details ? cTick - cName - 30 * u : cDesc - cName - 24 * u, { lineHeight: 1.05, minScale: 0.75 });
    if (desc) {
      ctx.font = `500 ${Math.round(fs * 0.78)}px Inter, sans-serif`;
      ctx.fillStyle = sys.muted;
      const dy = portrait ? ry + rowH * 0.68 : ry + rowH / 2;
      ctx.globalAlpha = ease.outCubic(range(lt, 0.2, 0.7));
      fillTextFit(ctx, desc, cDesc, dy + (1 - e) * rowH * 0.6, cTick - cDesc - 40 * u, { lineHeight: 1.1, minScale: 0.8 });
    }
    ctx.restore();
    // The tick.
    const tk = clamp(spring(lt - 0.35, 12, 6.5), 0, 1.15);
    if (tk > 0) {
      ctx.save();
      ctx.translate(cTick, ry + rowH / 2);
      ctx.scale(tk, tk);
      ctx.fillStyle = rgba(palette.primary, palette.light ? 0.14 : 0.2);
      ctx.beginPath();
      ctx.arc(0, 0, 15 * u, 0, Math.PI * 2);
      ctx.fill();
      drawLucide(ctx, "Check", 0, 0, 18 * u, palette.primary, { progress: ease.outCubic(range(lt, 0.4, 0.8)) });
      ctx.restore();
    }
  });
  ctx.restore();
}

/* ───────────────────────── Widget Set ───────────────────────── */

const WIDGET_FALLBACK = ["Auto sync", "Weekly report", "Shared with team", "Release plan"];

/**
 * Four small live widgets built from the same parts: a switch that flips on, a ring that fills
 * and ticks, a row of teammates, and a timeline whose bars grow under a moving "now" line. Each
 * is labelled with a feature; the spotlight moves between them on the beat. No numbers shown.
 */
function widgetSet(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, seed } = sc;
  const sys = system(sc);
  stage(sc, sys);
  const portrait = h > w;
  const head = topHeadline(sc);
  const items = itemsOr(scene, 2, WIDGET_FALLBACK).slice(0, 4).map(titleOf);
  const n = items.length;
  const g = tokens(w, h);
  const gap = 22 * u;
  const cols = portrait ? 2 : n;
  const rows = Math.ceil(n / cols);
  const ay = head.ys[head.ys.length - 1] + head.size * 1.0;
  const ah = h - g.safe.bottom - ay;
  let ww = Math.min((g.safe.width - gap * (cols - 1)) / cols, 420 * u);
  let wh = ww * 1.0;
  if (rows * wh + (rows - 1) * gap > ah) {
    wh = (ah - (rows - 1) * gap) / rows;
    ww = Math.min(ww, wh * 1.15);
  }
  const gw = cols * ww + (cols - 1) * gap;
  const gx = (w - gw) / 2;
  const gy = ay + (ah - (rows * wh + (rows - 1) * gap)) / 2;
  const ex = ease.inCubic(exitT(sc, 0.45));
  const landed = 0.4 + n * 0.15 + 1.2;
  const period = Math.max(0.6, sc.beat * 2);
  const spot = t > landed ? Math.floor((t - landed) / period) % n : -1;
  const pad = 22 * u;
  items.forEach((label, i) => {
    const x = gx + (i % cols) * (ww + gap);
    const y = gy + Math.floor(i / cols) * (wh + gap);
    const k = cardIn(t, 0.4 + i * 0.15);
    const lit = i === spot ? ease.outCubic(range((t - landed) % period, 0, 0.25)) * (1 - ease.inCubic(range((t - landed) % period, period - 0.2, period))) : 0;
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    ctx.translate(0, -lit * 6 * u - ex * 16 * u);
    surfaceCard(sc, sys, x, y, ww, wh, k, { border: lit > 0.3 ? rgba(palette.primary, 0.7) : sys.line1 });
    const lt = k.lt;
    if (lt > 0) {
      meta(sc, pad2(i + 1), x + pad, y + pad + 6 * u, range(lt, 0, 0.3), { color: palette.primary });
      // The label.
      ctx.save();
      ctx.globalAlpha *= ease.outCubic(range(lt, 0.1, 0.5));
      ctx.font = `650 ${Math.round(Math.min(22 * u, ww / 11))}px Inter, sans-serif`;
      ctx.fillStyle = palette.text;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      fillTextFit(ctx, label, x + pad, y + wh - pad, ww - pad * 2, { lineHeight: 1.1 });
      ctx.restore();
      // The widget itself, centred in the card's upper area.
      const cx = x + ww / 2;
      const cy = y + wh * 0.46;
      const S = Math.min(ww, wh) * 0.32;
      ctx.save();
      ctx.globalAlpha *= ease.outCubic(range(lt, 0, 0.3));
      switch (i % 4) {
        case 0: {
          // Switch: flips on, with a ripple.
          const on = clamp(spring(lt - 0.6, 12, 7), 0, 1.08);
          const tw2 = S * 1.5;
          const th2 = S * 0.8;
          ctx.fillStyle = on > 0.5 ? palette.primary : sys.line2;
          ctx.beginPath();
          ctx.roundRect(cx - tw2 / 2, cy - th2 / 2, tw2, th2, th2 / 2);
          ctx.fill();
          const kx = lerp(cx - tw2 / 2 + th2 / 2, cx + tw2 / 2 - th2 / 2, on);
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(0,0,0,0.3)";
          ctx.shadowBlur = 8 * u;
          ctx.beginPath();
          ctx.arc(kx, cy, th2 * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowColor = "transparent";
          const rp = range(lt, 0.6, 1.3);
          if (rp > 0 && rp < 1) {
            ctx.strokeStyle = rgba(palette.primary, 0.6 * (1 - rp));
            ctx.lineWidth = 2 * u;
            const gr = rp * 18 * u;
            ctx.beginPath();
            ctx.roundRect(cx - tw2 / 2 - gr, cy - th2 / 2 - gr, tw2 + gr * 2, th2 + gr * 2, th2 / 2 + gr);
            ctx.stroke();
          }
          break;
        }
        case 1: {
          // Ring: fills, then ticks.
          const p = ease.inOutCubic(range(lt, 0.3, 1.5));
          ctx.lineWidth = Math.max(4, S * 0.16);
          ctx.lineCap = "round";
          ctx.strokeStyle = sys.line2;
          ctx.beginPath();
          ctx.arc(cx, cy, S * 0.7, 0, Math.PI * 2);
          ctx.stroke();
          if (p > 0) {
            ctx.strokeStyle = palette.primary;
            ctx.beginPath();
            ctx.arc(cx, cy, S * 0.7, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
            ctx.stroke();
          }
          const ck = clamp(spring(lt - 1.5, 12, 6.5), 0, 1.15);
          if (ck > 0) drawLucide(ctx, "Check", cx, cy, S * 0.7 * ck, palette.primary, { progress: ck });
          break;
        }
        case 2: {
          // Teammates: discs pop in overlapping, then an invite.
          const r = S * 0.3;
          const count = 4;
          const x0 = cx - (count * r * 1.45) / 2;
          for (let j = 0; j <= count; j++) {
            const pk = clamp(spring(lt - 0.25 - j * 0.12, 12, 6.5), 0, 1.15);
            if (pk <= 0) continue;
            const px = x0 + j * r * 1.45;
            ctx.save();
            ctx.translate(px, cy);
            ctx.scale(pk, pk);
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            if (j === count) {
              ctx.fillStyle = sys.surface;
              ctx.fill();
              ctx.strokeStyle = sys.line1;
              ctx.lineWidth = sys.px * 1.4;
              ctx.stroke();
              drawLucide(ctx, "UserPlus", 0, 0, r * 0.95, palette.text);
            } else {
              const hue = rng(seed + j * 13)();
              const gg = ctx.createLinearGradient(-r, -r, r, r);
              gg.addColorStop(0, mixHex(palette.primary, palette.secondary, hue));
              gg.addColorStop(1, mixHex(palette.secondary, palette.bg1, 0.3 + hue * 0.3));
              ctx.fillStyle = gg;
              ctx.fill();
              ctx.strokeStyle = sys.surface;
              ctx.lineWidth = 3 * u;
              ctx.stroke();
              drawLucide(ctx, "Users", 0, 0, r * 0.9, rgba("#ffffff", 0.9));
            }
            ctx.restore();
          }
          break;
        }
        default: {
          // Timeline: bars grow, a "now" line sweeps.
          const bw = S * 2.4;
          const x0 = cx - bw / 2;
          const bars = [[0, 0.45], [0.25, 0.8], [0.55, 1]] as const;
          bars.forEach(([a, b], j) => {
            const gk = ease.outExpo(range(lt, 0.2 + j * 0.15, 0.9 + j * 0.15));
            const by = cy - S * 0.55 + j * S * 0.55;
            ctx.fillStyle = sys.line3;
            ctx.beginPath();
            ctx.roundRect(x0, by - S * 0.13, bw, S * 0.26, S * 0.13);
            ctx.fill();
            ctx.fillStyle = j === 1 ? palette.primary : mixHex(palette.secondary, palette.text, 0.2);
            ctx.beginPath();
            ctx.roundRect(x0 + bw * a, by - S * 0.13, Math.max(0.01, bw * (b - a) * gk), S * 0.26, S * 0.13);
            ctx.fill();
          });
          const nx = x0 + bw * (0.2 + 0.6 * ease.inOutCubic(range(lt, 0.8, 3.5)));
          rule(ctx, Math.round(nx) + 0.5, cy - S * 0.9, Math.round(nx) + 0.5, cy + S * 0.9, range(lt, 0.6, 0.9), palette.primary, Math.max(1.5, 1.6 * u));
        }
      }
      ctx.restore();
    }
    ctx.restore();
  });
}

/* ───────────────────────── Type Echo ───────────────────────── */

/**
 * The line and its echoes, on a loop: outlined copies of the line run as endless marquees above
 * and below it (each row sliding the other way), and the whole stack scrolls upward without end,
 * fading as it nears the filled line, which holds still in the middle. The echoes open out from
 * the line at the start and fold back into it before it rises out.
 */
function typeEcho(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  const sys = system(sc);
  stage(sc, sys);
  const portrait = h > w;
  const words = accentWords(scene.text || "Built to *last*");
  const { lines, size } = posterLines(sc, words, w * 0.86, h * (portrait ? 0.3 : 0.26), portrait ? 3 : words.length <= 5 ? 1 : 2);
  const lead = size * 1.0;
  const blockH = lines.length * lead;
  const top = h / 2 - blockH / 2;
  // The echo rows: the whole line on one row, smaller when the main line wraps.
  const flat = lines.flat();
  const es = size * (lines.length > 1 ? 0.5 : 0.62);
  const sep = es * 0.9;
  const rowW = lineWidth(sc, flat, es) + sep;
  const stepY = es * 1.08;
  const spread = ease.outExpo(range(t, 0.45, 1.5));
  const fold = ease.inCubic(range(t, d - 0.9, d - 0.45));
  const open = spread * (1 - fold);
  // Endless motion: the stack climbs, each row slides; both run on film time, so they never stop.
  const T = sc.globalT ?? t;
  const climb = T * es * 0.32;
  const base = Math.floor(climb / stepY);
  const frac = climb - base * stepY;
  const reach = Math.ceil(h / 2 / stepY) + 2;
  const clear = blockH / 2 + es * 0.15;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = Math.max(1, 1.4 * u);
  for (let k = -reach; k <= reach; k++) {
    const id = k + base;
    const cy = h / 2 + (k * stepY - frac) * open;
    const off = Math.abs(cy - h / 2);
    // Rows give way around the filled line, and fade towards the edges.
    const nearK = clamp((off - clear) / (stepY * 0.6));
    const farK = 1 - 0.75 * clamp(off / (h * 0.6));
    const a = nearK * farK * range(t, 0.4, 0.8) * (1 - fold);
    if (a <= 0.01) continue;
    const dir = id % 2 === 0 ? 1 : -1;
    const speed = w * (0.03 + 0.012 * (((id % 3) + 3) % 3));
    const shift = (((T * speed * dir + id * rowW * 0.37) % rowW) + rowW) % rowW;
    const close = off < clear + stepY * 1.2;
    // Rows alternate: outlined (the nearest in the accent), then a soft fill.
    const filled = ((id % 3) + 3) % 3 === 2;
    ctx.globalAlpha = a * (filled ? 1 : 0.9);
    for (let x = shift - rowW; x < w; x += rowW) {
      if (filled) {
        ctx.save();
        ctx.globalAlpha *= palette.light ? 0.12 : 0.1;
        const fill = palette.text;
        let cx = x;
        flat.forEach((wd, i) => {
          if (i) cx += es * 0.24;
          ctx.font = wordFont(sc, wd, es);
          ctx.fillStyle = fill;
          ctx.fillText(wd.w, cx, cy + es * 0.34);
          cx += ctx.measureText(wd.w).width;
        });
        ctx.restore();
      } else drawWords(sc, flat, x, cy + es * 0.34, es, close ? rgba(palette.primary, 0.95) : sys.line1);
    }
  }
  ctx.restore();
  // The line itself, still in the middle, rising in and out of its mask.
  riseLines(sc, lines, size, w / 2, top + size * 0.82, { start: 0.1, lead, align: "center", drift: 0 });
  meta(sc, scene.eyebrow ?? "", w / 2, tokens(w, h).safe.top + 10 * u, range(t, 0.9, 1.3) * (1 - fold), { align: "center", color: palette.primary });
  meta(sc, scene.subtext ?? "", w / 2, top + blockH + 40 * u, range(t, 1.1, 1.5) * (1 - fold), { align: "center" });
}

/* ───────────────────────── Type Slots ───────────────────────── */

/**
 * The line on slot reels: each word sits in its own hairline box and spins through the film's
 * other words before landing on its own, left to right, the box flashing the accent as it locks.
 */
function typeSlots(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  const sys = system(sc);
  stage(sc, sys);
  const portrait = h > w;
  const words = accentWords(scene.text || "Plan, build and *ship*");
  const { lines, size } = posterLines(sc, words, w * (portrait ? 0.78 : 0.8), h * (portrait ? 0.34 : 0.36), portrait ? 4 : 2);
  const boxPadX = size * 0.16;
  const boxH = size * 1.22;
  const lead = boxH + size * 0.16;
  const blockH = lines.length * lead - size * 0.16;
  const top = h / 2 - blockH / 2;
  const pool = [...(scene.items ?? []).map(titleOf).flatMap((x) => x.split(/\s+/)), ...words.map((x) => x.w)].filter((x) => x.length > 1);
  let wi = 0;
  const ex = ease.inCubic(exitT(sc, 0.5));
  const gapW = size * 0.24 + boxPadX * 2;
  lines.forEach((line, li) => {
    const widths = line.map((wd) => {
      ctx.font = wordFont(sc, wd, size);
      return ctx.measureText(wd.w).width;
    });
    const total = widths.reduce((a, b) => a + b, 0) + gapW * (line.length - 1);
    let x = w / 2 - total / 2;
    const by = top + li * lead;
    line.forEach((wd, j) => {
      const idx = wi++;
      const bw = widths[j] + boxPadX * 2;
      const bx = x - boxPadX;
      x += widths[j] + gapW;
      const land = 0.8 + idx * Math.min(0.22, sc.beat * 0.5);
      // The box draws on, then flashes on landing.
      const bk = ease.inOutCubic(range(t, 0.1 + idx * 0.05, 0.6 + idx * 0.05)) * (1 - ex);
      const flash = range(t, land, land + 0.08) * (1 - range(t, land + 0.15, land + 0.6));
      ctx.save();
      ctx.globalAlpha = 1 - ex;
      frameDraw(ctx, bx, by, bw, boxH, 10 * u, bk, flash > 0 ? palette.primary : sys.line2, flash > 0 ? Math.max(2, 2 * u) : sys.px);
      ctx.beginPath();
      ctx.rect(bx, by, bw, boxH);
      ctx.clip();
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const base = by + boxH / 2 + size * 0.34;
      if (t < land) {
        // Spinning: decoys scroll down through the box, slowing as it nears its stop.
        const left = land - t;
        const roll = left * 9 + left * left * 6;
        const k = Math.floor(roll);
        const frac = roll - k;
        for (const o of [0, 1]) {
          const decoy = pool.length ? pool[((k + o + idx * 3) * 7919) % pool.length] : wd.w;
          ctx.font = displayFont(saasFont(sc), size);
          ctx.fillStyle = rgba(palette.text, 0.35);
          ctx.globalAlpha = (1 - ex) * range(t, 0.15, 0.4);
          ctx.fillText(decoy, bx + boxPadX, base + (frac - o) * boxH, bw - boxPadX * 2);
        }
      } else {
        // Landed: a small overshoot, then it holds; leaving, it rolls up and out.
        const s = spring(t - land, 14, 8);
        const out = ease.inCubic(range(t, d - 0.6 + idx * 0.04, d - 0.2 + idx * 0.04));
        ctx.globalAlpha = 1;
        drawWords(sc, [wd], bx + boxPadX, base + (1 - s) * boxH * 0.6 - out * boxH, size);
      }
      ctx.restore();
    });
  });
  meta(sc, scene.eyebrow ?? "", w / 2, top - 36 * u, range(t, 0.4, 0.8) * (1 - ex), { align: "center", color: palette.primary });
  meta(sc, scene.subtext ?? "", w / 2, top + blockH + 44 * u, range(t, 1.4, 1.8) * (1 - ex), { align: "center" });
}

/* ───────────────────────── Registry ───────────────────────── */

const slotsSfx = (scene: Scene, beat: number) => {
  const n = Math.min(8, accentWords(scene.text || "Plan, build and *ship*").length);
  return [{ t: 0.1, kind: "whoosh" as const }, ...Array.from({ length: n }, (_, i) => ({ t: 0.8 + i * Math.min(0.22, beat * 0.5), kind: "tick" as const }))];
};

export const editorialMoreSkills: Skill[] = [
  {
    id: "poster-grid",
    name: "Grid Poster",
    tagline: "A Bauhaus module grid draws on beside the stacked headline; each square fills with a shape on the beat, then the quarter circles turn.",
    bestFor: "A bold statement as a geometric poster (3–8 words). Items = up to 4 short features listed under it.",
    sample: { text: "Form follows *function*", subtext: "", items: ["Plan", "Build", "Ship"] },
    itemsHint: "Up to 4 short features for the list",
    render: posterGrid,
    sfx: () => [
      { t: 0.1, kind: "swoosh" },
      { t: 0.55, kind: "pop" },
      { t: 1.8, kind: "tick" },
    ],
  },
  {
    id: "poster-split",
    name: "Split Poster",
    tagline: "An accent panel wipes up with the brand's monogram rising huge inside; beside it the headline stacks over feature chips and a running ruler.",
    bestFor: "A brand statement with a line under it (subtext) and up to 4 feature chips (items). Strong after the reveal.",
    sample: { text: "Built with *intent*", subtext: "Details, considered.", items: ["Fast", "Private", "Simple"] },
    itemsHint: "Up to 4 short features as chips",
    render: posterSplit,
    sfx: () => [
      { t: 0.05, kind: "whoosh" },
      { t: 0.5, kind: "swoosh" },
      { t: 1.1, kind: "pop" },
    ],
  },
  {
    id: "card-stack",
    name: "Card Stack",
    tagline: "A fanned deck of feature cards rises in; the top card is swiped away on the beat to reveal the next, with dots and a counter.",
    bestFor: "Going through 3–6 features one at a time (items as 'Title — one line'); uses the brand's photos when there are any.",
    sample: { text: "One feature *at a time*", items: REEL_FALLBACK },
    itemsHint: "Feature title — one line, per card",
    render: cardStack,
    sfx: (scene) => {
      const n = itemsOr(scene, 2, REEL_FALLBACK).slice(0, 6).length;
      const P = reelPeriod(scene);
      return [{ t: 0.15, kind: "whoosh" as const }, ...Array.from({ length: n - 1 }, (_, i) => ({ t: 1.1 + (i + 1) * P - P * 0.25, kind: "swoosh" as const }))];
    },
  },
  {
    id: "contact-sheet",
    name: "Contact Sheet",
    tagline: "Every feature as a framed card on one sheet, outlines first; a focus frame then moves card to card on the beat, lifting each in turn.",
    bestFor: "Showing 3–6 features (or product shots) at once, then each in turn (items as 'Title — one line').",
    sample: { text: "The whole *picture*", items: [...REEL_FALLBACK, "Share — One link for your team", "Grow — Built to scale with you"] },
    itemsHint: "Feature title — one line, per card",
    render: contactSheet,
    sfx: (scene, beat) => {
      const n = itemsOr(scene, 3, REEL_FALLBACK).slice(0, 6).length;
      return Array.from({ length: n }, (_, i) => ({ t: 0.4 + i * Math.min(0.12, beat / 2), kind: "tick" as const }));
    },
  },
  {
    id: "spec-sheet",
    name: "Spec Sheet",
    tagline: "A ruled spec sheet: the rules draw on, each feature lands on its row with its detail and a tick, and a highlight walks the rows.",
    bestFor: "Listing 3–5 features with a one-line detail each (items as 'Title — detail'). Calm and precise.",
    sample: { text: "What's *included*", items: SPEC_FALLBACK },
    itemsHint: "Feature title — detail, per row",
    render: specSheet,
    sfx: (scene, beat) => {
      const n = itemsOr(scene, 3, SPEC_FALLBACK).slice(0, 5).length;
      return Array.from({ length: n }, (_, i) => ({ t: 0.75 + i * Math.min(0.16, beat / 2) + 0.35, kind: "tick" as const }));
    },
  },
  {
    id: "widget-set",
    name: "Widget Set",
    tagline: "Four live widgets from the same parts: a switch flips on, a ring fills and ticks, teammates pop in, a timeline grows under a moving now-line.",
    bestFor: "Showing 2–4 features as small live controls (items = short feature names). No numbers are shown.",
    sample: { text: "Small things, *done right*", items: WIDGET_FALLBACK },
    itemsHint: "2–4 short feature names",
    render: widgetSet,
    sfx: () => [
      { t: 0.4, kind: "tick" },
      { t: 0.55, kind: "tick" },
      { t: 0.7, kind: "tick" },
      { t: 0.85, kind: "tick" },
      { t: 1.45, kind: "click" },
      { t: 2.3, kind: "success" },
    ],
  },
  {
    id: "type-echo",
    name: "Type Echo",
    tagline: "The line holds still while outlined echoes of it run as endless marquees above and below, sliding in turn, the stack scrolling upward on a loop.",
    bestFor: "A short, confident line (2–6 words) that should land hard: a positioning line or the moment before the call to action.",
    sample: { text: "Built to *last*", subtext: "" },
    render: typeEcho,
    sfx: () => [
      { t: 0.1, kind: "whoosh" },
      { t: 0.55, kind: "shimmer" },
    ],
  },
  {
    id: "type-slots",
    name: "Type Slots",
    tagline: "Each word of the line spins on its own slot reel through the film's other words and locks into place, left to right.",
    bestFor: "A line of 2–6 words with energy; the features (items) are the words the reels spin through.",
    sample: { text: "Plan, build and *ship*", items: ["Design", "Review", "Launch", "Grow"] },
    itemsHint: "Short features the reels spin through",
    render: typeSlots,
    sfx: slotsSfx,
  },
];
