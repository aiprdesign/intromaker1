/**
 * Fast type: motion-design text skills that switch words quickly on the beat (half-beat ticks,
 * kept between about 4 and 9 frames at 30 fps), then land the headline with a punch.
 *
 * - Rapid Fire: the features flash one per tick, each in a new treatment, then the line slams in.
 * - Flip Switch: one word of the line flips through the features in a box, slowing to a stop.
 * - Zoom Through: words rush out of the distance and through the camera, one after another.
 * - Slice Switch: each word is cut into strips that shear out sideways as the next shears in.
 * - Style Shuffle: one word jumps between typefaces and colours every tick, then locks.
 * - Split Flap: a departures board flips letter by letter through the features to the line.
 *
 * Photosensitive-safe: nothing flashes the whole frame; colour changes stay word-sized.
 */
import { exitT, lightSweep } from "../fx";
import { tokens } from "../grid";
import { clamp, ease, hashString, lerp, mixHex, range, rgba } from "../math";
import { saasBackground, saasFont, spring } from "../saasfx";
import { capShift, displayFont, fillTextFit, subFont, trackingOf } from "../text";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { accentWords, titleOf, type Word } from "./editorial";

const FALLBACK = ["Plan", "Build", "Ship", "Grow"];

/**
 * Fast skills also take a word-swap line ("Your work, planned|built|shared"): the last
 * alternative becomes the accent word and the others the words it switches through.
 */
export function fastScene(scene: Scene): Scene {
  const group = /\S+(?:\|\S+)+/.exec(scene.text ?? "");
  if (!group) return scene;
  const alts = group[0].split("|").map((x) => x.replace(/[*,.!?]/g, "")).filter(Boolean);
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  return {
    ...scene,
    text: scene.text.replace(group[0], `*${alts[alts.length - 1]}*`),
    items: (scene.items ?? []).length >= 2 ? scene.items : alts.slice(0, -1).map(cap),
  };
}

/** How fast words switch: half a beat, kept between ~4 and ~9 frames at 30 fps. */
export const tickOf = (beat: number) => clamp(beat / 2, 0.14, 0.3);

/** The words a fast skill switches through: the items' short titles, else a stock set. */
export function cycleWords(scene: Scene, max = 6) {
  const items = (scene.items ?? []).map((x) => titleOf(x).trim()).filter((x) => x && x.length <= 22 && x.split(/\s+/).length <= 3);
  return (items.length >= 2 ? items : FALLBACK).slice(0, max);
}

/**
 * When each word lands and when the headline does. At least ~45% of the scene (and 1.2 s) is
 * left for the headline to hold, so short scenes switch through fewer words, never faster ones.
 */
export function switchPlan(scene: Scene, beat: number, opts: { start?: number; per?: number; max?: number; words?: string[] } = {}) {
  const tick = (opts.per ?? 1) * tickOf(beat);
  const start = opts.start ?? 0.2;
  const words = opts.words ?? cycleWords(scene, opts.max ?? 6);
  const room = Math.max(0, scene.duration - Math.max(1.2, scene.duration * 0.45) - start);
  const n = Math.max(1, Math.min(words.length, Math.floor(room / tick)));
  return { tick, start, words: words.slice(0, n), land: start + n * tick };
}

/** The headline split into the switching word (its *accent*, else its last word) and the rest. */
export function splitTarget(text: string) {
  const words = accentWords(text || "Built for *teams*");
  let hit = words.filter((x) => x.a);
  if (!hit.length) hit = words.slice(-1);
  const first = words.indexOf(hit[0]);
  return {
    prefix: words.slice(0, first).map((x) => x.w).join(" "),
    target: hit.map((x) => x.w).join(" "),
    suffix: words.slice(first + hit.length).map((x) => x.w).join(" "),
  };
}

/* ───────────────────────── Shared type layout ───────────────────────── */

type Line = { words: Word[]; w: number };
export type Laid = { lines: Line[]; size: number; lh: number; face: (s: number) => string; track: number };

/** Set the film's display face (with its tracking) at a size. */
function useFace(sc: SkillContext, size: number) {
  const { ctx } = sc;
  const font = saasFont(sc);
  ctx.font = displayFont(font, size);
  ctx.letterSpacing = `${(trackingOf(font) * size).toFixed(2)}px`;
}

function measureLine(sc: SkillContext, words: Word[], size: number) {
  useFace(sc, size);
  const space = sc.ctx.measureText(" ").width;
  return words.reduce((a, wd, i) => a + sc.ctx.measureText(wd.w).width + (i ? space : 0), 0);
}

/** Lay the headline in the film's face: one line if it fits big enough, else balanced lines. */
export function layWords(sc: SkillContext, words: Word[], maxW: number, maxSize: number, maxLines: number): Laid {
  const probe = 100;
  let best: { lines: Word[][]; size: number } = { lines: [words], size: 0 };
  for (let n = 1; n <= Math.min(maxLines, words.length); n++) {
    // Balanced split into n lines by character count.
    const total = words.reduce((a, x) => a + x.w.length + 1, 0);
    const lines: Word[][] = [];
    let cur: Word[] = [];
    let len = 0;
    words.forEach((wd, i) => {
      const left = words.length - i;
      if (cur.length && lines.length < n - 1 && (len + wd.w.length > total / n || left < n - lines.length)) {
        lines.push(cur);
        cur = [];
        len = 0;
      }
      cur.push(wd);
      len += wd.w.length + 1;
    });
    lines.push(cur);
    const widest = Math.max(...lines.map((l) => measureLine(sc, l, probe)));
    const size = Math.min(maxSize, (maxW / widest) * probe);
    // A line more is only worth it when the type gets clearly bigger.
    if (size > best.size * 1.15) best = { lines, size };
  }
  const size = best.size;
  const lines = best.lines.map((l) => ({ words: l, w: measureLine(sc, l, size) }));
  sc.ctx.letterSpacing = "0px";
  const font = saasFont(sc);
  return { lines, size, lh: size * 1.08, face: (s) => displayFont(font, s), track: trackingOf(font) };
}

/** Draw a laid headline centred on (cx, cy); the *accent* words carry the brand gradient. */
export function drawLaid(sc: SkillContext, laid: Laid, cx: number, cy: number, opts: { color?: string } = {}) {
  const { ctx, palette } = sc;
  const { size, lh } = laid;
  ctx.save();
  ctx.font = laid.face(size);
  ctx.letterSpacing = `${(laid.track * size).toFixed(2)}px`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const dy = capShift(ctx);
  const space = ctx.measureText(" ").width;
  const top = cy - ((laid.lines.length - 1) * lh) / 2;
  laid.lines.forEach((line, li) => {
    let x = cx - line.w / 2;
    const y = top + li * lh;
    line.words.forEach((wd) => {
      const ww = ctx.measureText(wd.w).width;
      if (wd.a && !opts.color) {
        const g = ctx.createLinearGradient(x, y - size / 2, x + ww, y + size / 2);
        g.addColorStop(0, palette.primary);
        g.addColorStop(1, palette.secondary);
        ctx.fillStyle = g;
      } else ctx.fillStyle = opts.color ?? palette.text;
      ctx.fillText(wd.w, x, y + dy);
      x += ww + space;
    });
  });
  ctx.restore();
  return { top: top - size * 0.5, bottom: top + (laid.lines.length - 1) * lh + size * 0.5 };
}

/** The supporting line under the headline. */
export function subLine(sc: SkillContext, y: number, k: number) {
  const { ctx, w, u, palette, scene } = sc;
  if (!scene.subtext || k <= 0) return;
  ctx.save();
  ctx.globalAlpha *= ease.outCubic(clamp(k));
  ctx.fillStyle = rgba(palette.text, 0.7);
  ctx.font = subFont(30 * u * (sc.h > sc.w ? 1.2 : 1), 500);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  fillTextFit(ctx, scene.subtext, w / 2, y + (1 - ease.outCubic(clamp(k))) * 14 * u, tokens(sc.w, sc.h).safe.width * 0.8, { maxLines: 2 });
  ctx.restore();
}

/** The landed headline: it punches in from a touch larger with a short smear, then holds. */
export function landHeadline(
  sc: SkillContext,
  at: number,
  cy: number,
  opts: { maxW?: number; maxSize?: number; maxLines?: number; from?: number; sub?: boolean } = {},
) {
  const { ctx, w, h, t, u } = sc;
  const scene = fastScene(sc.scene);
  if (t < at) return null;
  const portrait = h > w;
  const safe = tokens(w, h).safe;
  const laid = layWords(
    sc,
    accentWords(scene.text || "Ship it *together*"),
    opts.maxW ?? safe.width * 0.92,
    opts.maxSize ?? Math.min(w, h) * (portrait ? 0.19 : 0.17),
    opts.maxLines ?? (portrait ? 3 : 2),
  );
  const k = ease.outExpo(clamp((t - at) / 0.24));
  const ex = ease.inCubic(exitT(sc, 0.35));
  // It punches down from a touch larger (or, with `from` < 1, arrives from the distance).
  const s = lerp(opts.from ?? 1.28, 1, k) * (1 + 0.1 * ex) * (1 + 0.025 * smoothHold(t - at));
  ctx.save();
  ctx.translate(w / 2, cy);
  ctx.scale(s, s);
  ctx.translate(-w / 2, -cy);
  if (k < 1) {
    // Smear: two faint copies trailing the punch.
    ctx.save();
    ctx.globalAlpha = 0.16 * (1 - k);
    for (const g of [1.06, 1.12]) {
      ctx.save();
      ctx.translate(w / 2, cy);
      ctx.scale(g, g);
      ctx.translate(-w / 2, -cy);
      drawLaid(sc, laid, w / 2, cy);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.globalAlpha = clamp(k * 1.8) * (1 - ex);
  // Leaving, the line rushes forward and out of focus.
  if (ex > 0.02) ctx.filter = `blur(${(ex * 12 * u).toFixed(1)}px)`;
  const box = drawLaid(sc, laid, w / 2, cy);
  ctx.filter = "none";
  ctx.restore();
  if (opts.sub !== false) subLine(sc, box.bottom + 40 * u, range(t, at + 0.25, at + 0.7) * (1 - ex));
  return box;
}

/** A slow drift after landing (0 → 1 over a few seconds), so the held line keeps living. */
export const smoothHold = (dt: number) => 1 - Math.exp(-Math.max(0, dt) * 0.5);

/** Story-style progress dashes at the foot of the frame: one per word, plus the headline. */
export function dashes(sc: SkillContext, n: number, lit: number, alpha: number) {
  const { ctx, w, h, u, palette } = sc;
  if (alpha <= 0) return;
  const safe = tokens(w, h).safe;
  const dw = 34 * u;
  const gap = 8 * u;
  const total = n * dw + (n - 1) * gap;
  const y = safe.top + safe.height - 6 * u;
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i <= lit ? palette.primary : rgba(palette.text, 0.18);
    ctx.beginPath();
    ctx.roundRect(w / 2 - total / 2 + i * (dw + gap), y, dw, 4 * u, 2 * u);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Speed streaks rushing out from the centre (or sideways, for whips): each streak keeps its own
 * lane and travels smoothly frame to frame, so the motion reads as speed rather than flicker.
 */
export function streaks(sc: SkillContext, intensity: number, color: string, opts: { dir?: "radial" | "left" | "right"; count?: number } = {}) {
  if (intensity <= 0.01) return;
  const { ctx, w, h, t, u, seed } = sc;
  const n = opts.count ?? 56;
  const R = Math.hypot(w, h) / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const hsh = hashString(`${seed}:streak:${i}`);
    const r1 = (hsh % 997) / 997;
    const r2 = ((hsh >>> 10) % 991) / 991;
    const speed = 0.9 + r2 * 1.4;
    const q = (t * speed + r1) % 1;
    ctx.globalAlpha = intensity * (0.25 + 0.55 * r2) * Math.sin(q * Math.PI);
    ctx.lineWidth = (1 + r1 * 2.2) * u;
    ctx.beginPath();
    if (opts.dir === "left" || opts.dir === "right") {
      const y = r1 * h;
      const len = (0.08 + r2 * 0.22) * w;
      const x = opts.dir === "left" ? w * (1.1 - q * 1.4) : w * (-0.1 + q * 1.4);
      ctx.moveTo(x, y);
      ctx.lineTo(x + (opts.dir === "left" ? len : -len), y);
    } else {
      const a = r1 * Math.PI * 2;
      const r0 = R * (0.18 + q * 0.9);
      const len = R * (0.04 + q * 0.22);
      ctx.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0);
      ctx.lineTo(w / 2 + Math.cos(a) * (r0 + len), h / 2 + Math.sin(a) * (r0 + len));
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** A small camera kick on each switch, settling within a few frames. */
export function kick(sc: SkillContext, since: number, amount = 5) {
  if (since < 0 || since > 0.18) return { x: 0, y: 0 };
  const k = (1 - since / 0.18) ** 2 * amount * sc.u;
  return { x: Math.sin(since * 110) * k, y: Math.cos(since * 83) * k };
}

/** A single word's size: as big as allowed while fitting the width. */
export function fitWord(sc: SkillContext, word: string, face: (s: number) => string, maxW: number, maxSize: number) {
  sc.ctx.font = face(100);
  sc.ctx.letterSpacing = "0px";
  return Math.min(maxSize, (maxW / Math.max(1, sc.ctx.measureText(word).width)) * 100);
}

export const textOn = (sc: SkillContext) => (sc.palette.light ? "#ffffff" : sc.palette.bg0);

/* ───────────────────────── Rapid Fire ───────────────────────── */

function rapidFire(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const P = switchPlan(scene, sc.beat);
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const cy = h * 0.47;
  const ex = ease.inCubic(exitT(sc, 0.35));
  const i = Math.floor((t - P.start) / P.tick);
  dashes(sc, P.words.length + 1, t >= P.land ? P.words.length : i, clamp((t - 0.05) / 0.2) * (1 - ex));
  if (t >= P.start && t < P.land) {
    const word = P.words[i];
    const local = t - (P.start + i * P.tick);
    // Four treatments in turn: solid, outline, boxed, italic serif.
    const kind = i % 4;
    const face = kind === 3 ? (s: number) => `italic 400 ${Math.round(s * 1.1)}px "Instrument Serif", Georgia, serif` : (s: number) => displayFont(saasFont(sc), s);
    const size = fitWord(sc, word, face, safe.width * (kind === 2 ? 0.78 : 0.88), short * 0.24);
    const pk = ease.outExpo(clamp(local / (P.tick * 0.55)));
    const dir = i % 2 ? 1 : -1;
    ctx.save();
    const kk = kick(sc, local);
    ctx.translate(w / 2 + kk.x, cy + kk.y);
    ctx.scale(lerp(1.22, 1, pk), lerp(1.22, 1, pk));
    ctx.rotate(dir * 0.025 * (1 - pk));
    ctx.font = face(size);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const dy = capShift(ctx);
    const tw = ctx.measureText(word).width;
    if (kind === 2) {
      // Boxed: a word-sized accent block (never the whole frame) with the word knocked out.
      const pad = size * 0.22;
      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      ctx.roundRect(-tw / 2 - pad, -size * 0.62, tw + pad * 2, size * 1.24, size * 0.14);
      ctx.fill();
    }
    // Smear: the word's last position trails it for a frame or two.
    if (pk < 1) {
      ctx.globalAlpha = 0.2 * (1 - pk);
      ctx.fillStyle = kind === 2 ? textOn(sc) : palette.primary;
      for (const k of [1, 2]) ctx.fillText(word, -dir * k * size * 0.1 * (1 - pk), dy);
      ctx.globalAlpha = 1;
    }
    if (kind === 1) {
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = Math.max(2, size * 0.03);
      ctx.lineJoin = "round";
      ctx.strokeText(word, 0, dy);
    } else {
      ctx.fillStyle = kind === 2 ? textOn(sc) : kind === 3 ? palette.secondary : palette.text;
      ctx.fillText(word, 0, dy);
    }
    ctx.restore();
  }
  const box = landHeadline(sc, P.land, cy);
  if (box) {
    // An underline draws out under the landed line.
    const k = ease.outExpo(range(t, P.land + 0.1, P.land + 0.55)) * (1 - ex);
    const bw = Math.min(safe.width * 0.5, 320 * u) * k;
    ctx.fillStyle = palette.primary;
    ctx.fillRect(w / 2 - bw / 2, box.bottom + 14 * u, bw, 5 * u);
  }
}

const rapidSfx = (raw: Scene, beat: number): SfxCue[] => {
  const scene = fastScene(raw);
  const P = switchPlan(scene, beat);
  return [...P.words.slice(0, 8).map((_, i) => ({ t: P.start + i * P.tick, kind: "tick" as const })), { t: P.land, kind: "whoosh" }];
};

/* ───────────────────────── Flip Switch ───────────────────────── */

/** The flip schedule: each flip a little slower than the last, like a board winding down. */
function flipPlan(scene: Scene, beat: number) {
  const { target } = splitTarget(scene.text);
  const pool = cycleWords(scene, 6).filter((x) => x.toLowerCase() !== target.toLowerCase());
  const tick = tickOf(beat);
  const start = 0.45;
  const room = Math.max(0.6, scene.duration - Math.max(1.2, scene.duration * 0.45) - start);
  let words = pool;
  const span = (n: number) => Array.from({ length: n }, (_, k) => tick * (1 + 0.16 * k)).reduce((a, b) => a + b, 0);
  while (words.length > 1 && span(words.length) > room) words = words.slice(1);
  const times: number[] = [];
  let at = start;
  for (let k = 0; k < words.length; k++) {
    times.push(at);
    at += tick * (1 + 0.16 * k);
  }
  return { list: [...words, target], times: [...times, at], land: at };
}

function flipSwitch(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const portrait = h > w;
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const { prefix, suffix } = splitTarget(scene.text);
  const F = flipPlan(scene, sc.beat);
  const ex = ease.inCubic(exitT(sc, 0.35));
  const face = (s: number) => displayFont(saasFont(sc), s);
  // One size for the line; the box holds the widest word it will show.
  ctx.font = face(100);
  ctx.letterSpacing = "0px";
  const wOf = (s: string) => ctx.measureText(s).width / 100;
  const widest = Math.max(...F.list.map(wOf));
  const prefixW = prefix ? wOf(prefix) : 0;
  const suffixW = suffix ? wOf(suffix) : 0;
  const padX = 0.32;
  const gap = 0.28;
  const inlineW = prefixW + (prefix ? gap : 0) + widest + padX * 2 + (suffix ? gap + suffixW : 0);
  let size = Math.min(short * (portrait ? 0.15 : 0.14), (safe.width * 0.92) / inlineW);
  // Stacked when inline would make the type too small.
  const stacked = !!(prefix || suffix) && size < short * 0.09;
  if (stacked) size = Math.min(short * (portrait ? 0.17 : 0.14), (safe.width * 0.92) / Math.max(prefixW, suffixW, widest + padX * 2));
  const cy = h * 0.47;
  const boxH = size * 1.36;
  // Which word shows, and how far through its flip the box is.
  let idx = 0;
  for (let k = 0; k < F.times.length; k++) if (t >= F.times[k]) idx = k;
  const flipDur = Math.min(0.16, tickOf(sc.beat) * 0.8);
  const since = t - F.times[idx];
  const flipping = idx > 0 && since < flipDur;
  const p = flipping ? since / flipDur : 1;
  const cur = F.list[idx];
  const prev = F.list[Math.max(0, idx - 1)];
  const landed = t >= F.land;
  // Box width eases from the last word's width to this one's.
  const ws = clamp(spring(since, 16, 9), 0, 1.06);
  const bwNow = (lerp(wOf(prev), wOf(cur), idx > 0 ? ws : 1) + padX * 2) * size;
  const prefixPx = prefixW * size;
  const suffixPx = suffixW * size;
  const gapPx = gap * size;
  let bx: number;
  let by: number;
  let px = 0;
  let py = 0;
  let sx = 0;
  let sy = 0;
  if (stacked) {
    bx = w / 2 - bwNow / 2;
    by = cy - boxH / 2;
    px = w / 2 - prefixPx / 2;
    py = by - size * 0.78;
    sx = w / 2 - suffixPx / 2;
    sy = by + boxH + size * 0.78;
  } else {
    const total = (prefix ? prefixPx + gapPx : 0) + bwNow + (suffix ? gapPx + suffixPx : 0);
    px = w / 2 - total / 2;
    bx = px + (prefix ? prefixPx + gapPx : 0);
    by = cy - boxH / 2;
    py = cy;
    sx = bx + bwNow + gapPx;
    sy = cy;
  }
  const intro = ease.outExpo(range(t, 0.05, 0.45));
  ctx.save();
  ctx.globalAlpha = intro * (1 - ex);
  ctx.translate(0, (1 - intro) * 24 * u);
  ctx.font = face(size);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const dy = capShift(ctx);
  ctx.fillStyle = palette.text;
  if (prefix) ctx.fillText(prefix, px, py + dy);
  if (suffix) ctx.fillText(suffix, sx, sy + dy);
  // The box: quiet while flipping, lit in the brand colour once it lands.
  const lit = landed ? ease.outCubic(range(t, F.land, F.land + 0.25)) : 0;
  ctx.beginPath();
  ctx.roundRect(bx, by, bwNow, boxH, size * 0.2);
  ctx.fillStyle = mixHex(palette.bg1, palette.primary, 0.1 + 0.12 * lit);
  ctx.fill();
  ctx.strokeStyle = lit > 0 ? rgba(palette.primary, 0.4 + 0.5 * lit) : rgba(palette.text, 0.16);
  ctx.lineWidth = Math.max(1, (1.5 + 1.5 * lit) * u);
  ctx.stroke();
  // Landing: one glint crosses the box.
  if (landed) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx, by, bwNow, boxH, size * 0.2);
    ctx.clip();
    lightSweep(ctx, bx, by, bwNow, boxH, range(t, F.land + 0.05, F.land + 0.65), { alpha: palette.light ? 0.35 : 0.22, width: 0.35 });
    ctx.restore();
  }
  // Hinge line across the middle, like a flap card.
  ctx.fillStyle = rgba(palette.bg0, 0.35);
  ctx.fillRect(bx + 2 * u, cy - Math.max(1, u) / 2, bwNow - 4 * u, Math.max(1, u));
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bwNow, boxH);
  ctx.clip();
  // The word flips about the hinge: the old word folds away, the new one unfolds.
  const word = flipping && p < 0.5 ? prev : cur;
  const fold = flipping ? Math.abs(Math.cos(p * Math.PI)) : 1;
  ctx.translate(w / 2, cy);
  ctx.translate(bx + bwNow / 2 - w / 2, 0);
  ctx.scale(1, Math.max(0.02, fold));
  ctx.textAlign = "center";
  if (landed) {
    const ww = ctx.measureText(word).width;
    const g = ctx.createLinearGradient(-ww / 2, -size / 2, ww / 2, size / 2);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    ctx.fillStyle = g;
  } else ctx.fillStyle = rgba(palette.text, 0.6 + 0.4 * fold);
  // Centred on its ink, so the word sits dead centre in the box.
  const m = ctx.measureText(word);
  ctx.fillText(word, (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2, dy);
  ctx.restore();
  ctx.restore();
  subLine(sc, (stacked && suffix ? sy : by + boxH) + size * (stacked && suffix ? 0.6 : 0) + 40 * u, range(t, F.land + 0.2, F.land + 0.7) * (1 - ex));
}

const flipSfx = (raw: Scene, beat: number): SfxCue[] => {
  const scene = fastScene(raw);
  const F = flipPlan(scene, beat);
  return [{ t: 0.1, kind: "swoosh" }, ...F.times.slice(1, -1).map((x) => ({ t: x, kind: "tick" as const })), { t: F.land, kind: "pop" }];
};

/* ───────────────────────── Zoom Through ───────────────────────── */

function zoomThrough(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 0 });
  const P = switchPlan(scene, sc.beat, { per: 1.3, start: 0.3 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const cy = h * 0.47;
  const ex = ease.inCubic(exitT(sc, 0.35));
  // Streaks rush outward while the words fly, and calm once the line lands.
  streaks(sc, 0.55 * clamp(t / 0.3) * (1 - clamp((t - P.land) / 0.5)) * (1 - ex), rgba(palette.primary, 0.8));
  const face = (s: number) => displayFont(saasFont(sc), s);
  // Each word arrives out of the distance over one tick, holds the focus, then passes the camera.
  const drawn: { s: number; a: number; blur: number; word: string }[] = [];
  P.words.forEach((word, i) => {
    const focus = P.start + i * P.tick;
    const born = focus - P.tick;
    const gone = focus + P.tick * 0.95;
    if (t < born || t > gone) return;
    let s: number;
    let a: number;
    let blur = 0;
    if (t < focus) {
      const q = clamp((t - born) / P.tick);
      s = 1 / (1 + 7 * (1 - ease.inQuad(q)));
      a = q;
    } else {
      const q = clamp((t - focus) / (gone - focus));
      s = 1 / Math.max(0.12, 1 - 0.86 * ease.inCubic(q));
      a = 1 - Math.pow(q, 1.4);
      blur = q * 14 * u;
    }
    drawn.push({ s, a, blur, word });
  });
  drawn.sort((x, y) => x.s - y.s);
  for (const d of drawn) {
    const size = fitWord(sc, d.word, face, safe.width * 0.84, short * 0.22);
    ctx.save();
    ctx.globalAlpha = d.a * (1 - ex);
    if (d.blur > 0.6) ctx.filter = `blur(${d.blur.toFixed(1)}px)`;
    ctx.translate(w / 2, cy);
    ctx.scale(d.s, d.s);
    ctx.font = face(size);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = d.s < 0.6 ? mixHex(palette.text, palette.primary, 0.5) : palette.text;
    ctx.fillText(d.word, 0, capShift(ctx));
    ctx.restore();
  }
  // The headline flies in last and stops at the focus.
  if (t >= P.land - P.tick) {
    const q = clamp((t - (P.land - P.tick)) / P.tick);
    const s = t < P.land ? 1 / (1 + 7 * (1 - ease.inQuad(q))) : 1;
    if (t < P.land) {
      ctx.save();
      ctx.globalAlpha = q;
      ctx.translate(w / 2, cy);
      ctx.scale(s, s);
      ctx.translate(-w / 2, -cy);
      const laid = layWords(sc, accentWords(scene.text || "Your work, *in one place*"), safe.width * 0.92, short * (h > w ? 0.19 : 0.17), h > w ? 3 : 2);
      drawLaid(sc, laid, w / 2, cy);
      ctx.restore();
    } else landHeadline(sc, P.land, cy);
  }
}

const zoomSfx = (raw: Scene, beat: number): SfxCue[] => {
  const scene = fastScene(raw);
  const P = switchPlan(scene, beat, { per: 1.3, start: 0.3 });
  return [...P.words.slice(0, 6).map((_, i) => ({ t: Math.max(0, P.start + i * P.tick - 0.08), kind: "whoosh" as const })), { t: P.land, kind: "pop" }];
};

/* ───────────────────────── Slice Switch ───────────────────────── */

function sliceSwitch(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const P = switchPlan(scene, sc.beat, { per: 1.5 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const portrait = h > w;
  const cy = h * 0.47;
  const ex = ease.inCubic(exitT(sc, 0.35));
  const face = (s: number) => displayFont(saasFont(sc), s);
  const laid = layWords(sc, accentWords(scene.text || "Work in *one flow*"), safe.width * 0.92, short * (portrait ? 0.19 : 0.17), portrait ? 3 : 2);
  const finalH = laid.lines.length * laid.lh;
  // Frame i shows word i (the last frame is the headline); frames switch at these times.
  const n = P.words.length + 1;
  const at = (i: number) => P.start + i * P.tick;
  const drawFrame = (i: number) => {
    if (i < P.words.length) {
      const size = fitWord(sc, P.words[i], face, safe.width * 0.86, short * 0.22);
      ctx.font = face(size);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = i % 2 ? palette.primary : palette.text;
      ctx.fillText(P.words[i], w / 2, cy + capShift(ctx));
    } else drawLaid(sc, laid, w / 2, cy);
  };
  const band = Math.max(finalH, short * 0.26) * 1.1;
  const strips = 7;
  const sh = band / strips;
  const y0 = cy - band / 2;
  const td = Math.min(0.26, P.tick * 0.8);
  let cur = 0;
  for (let i = 1; i < n; i++) if (t >= at(i)) cur = i;
  const since = t - at(cur);
  const switching = cur > 0 && since < td + strips * td * 0.06;
  ctx.save();
  ctx.globalAlpha = clamp((t - 0.05) / 0.15) * (1 - ex);
  for (let j = 0; j < strips; j++) {
    const dir = j % 2 ? 1 : -1;
    const local = switching ? clamp((since - j * td * 0.06) / (td * 0.7)) : 1;
    const sy = y0 + j * sh;
    const pieces: [number, number][] = [];
    if (switching && local < 1) pieces.push([cur - 1, dir * ease.inCubic(local) * w * 0.4]);
    pieces.push([cur, switching ? -dir * (1 - ease.outCubic(local)) * w * 0.4 : 0]);
    for (const [fi, dx] of pieces) {
      ctx.save();
      // Outgoing strips fade as they shear away; incoming ones firm up as they arrive.
      if (switching) ctx.globalAlpha *= fi === cur ? 0.35 + 0.65 * ease.outCubic(local) : 1 - ease.inQuad(local);
      ctx.beginPath();
      ctx.rect(0, sy - 0.5, w, sh + 1);
      ctx.clip();
      // A faint trail behind each moving strip reads as motion blur.
      if (Math.abs(dx) > 4 * u) {
        ctx.save();
        ctx.globalAlpha *= 0.22;
        ctx.translate(dx * 0.8, 0);
        drawFrame(fi);
        ctx.restore();
      }
      ctx.translate(dx, 0);
      drawFrame(fi);
      ctx.restore();
    }
    // A thin brand-coloured cut runs along each seam while the strips shear.
    if (switching && local > 0 && local < 1 && j > 0) {
      ctx.fillStyle = rgba(palette.primary, 0.85 * Math.sin(local * Math.PI));
      const len = w * 0.4;
      ctx.fillRect(w / 2 - len / 2 + dir * (local - 0.5) * w * 0.5, sy - 1.5 * u, len, 3 * u);
    }
  }
  ctx.restore();
  if (t >= P.land) {
    const bottom = cy + finalH / 2;
    subLine(sc, bottom + 40 * u, range(t, P.land + 0.3, P.land + 0.8) * (1 - ex));
  }
}

const sliceSfx = (raw: Scene, beat: number): SfxCue[] => {
  const scene = fastScene(raw);
  const P = switchPlan(scene, beat, { per: 1.5 });
  return [{ t: 0.1, kind: "swoosh" }, ...P.words.slice(1, 7).map((_, i) => ({ t: P.start + (i + 1) * P.tick, kind: "swoosh" as const })), { t: P.land, kind: "pop" }];
};

/* ───────────────────────── Style Shuffle ───────────────────────── */

/** Faces the word jumps between (every one is loaded by ensureFonts); scale evens their sizes out. */
const SHUFFLE_FACES: ((s: number) => string)[] = [
  (s) => `italic 800 ${Math.round(s)}px "Playfair Display", Georgia, serif`,
  (s) => `800 ${Math.round(s * 0.86)}px "JetBrains Mono", monospace`,
  (s) => `400 ${Math.round(s * 1.2)}px "Bebas Neue", Impact, sans-serif`,
  (s) => `italic 400 ${Math.round(s * 1.15)}px "Instrument Serif", Georgia, serif`,
  (s) => `400 ${Math.round(s * 1.1)}px "Anton", Impact, sans-serif`,
  (s) => `600 ${Math.round(s)}px "Jost", sans-serif`,
  (s) => `800 ${Math.round(s)}px "Manrope", sans-serif`,
];

function shufflePlan(scene: Scene, beat: number) {
  const tick = tickOf(beat);
  const start = 0.35;
  const room = Math.max(0, scene.duration - Math.max(1.2, scene.duration * 0.45) - start);
  const n = clamp(Math.floor(room / tick), 3, 10);
  return { tick, start, n, land: start + n * tick };
}

function styleShuffle(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const portrait = h > w;
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const { prefix, target, suffix } = splitTarget(scene.text || "Made to *stand out*");
  const S = shufflePlan(scene, sc.beat);
  const ex = ease.inCubic(exitT(sc, 0.35));
  const cy = h * 0.5;
  const base = Math.min(short * (portrait ? 0.2 : 0.17), safe.width * 0.2);
  // The quiet part of the line sits above (prefix) and below (suffix) in the film's face.
  const sideSize = Math.min(base * 0.42, fitWord(sc, prefix || suffix || "x", (s) => displayFont(saasFont(sc), s), safe.width * 0.8, base * 0.42));
  const intro = ease.outExpo(range(t, 0.05, 0.4));
  ctx.save();
  ctx.globalAlpha = intro * (1 - ex);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = displayFont(saasFont(sc), sideSize);
  ctx.fillStyle = rgba(palette.text, 0.85);
  const gapY = base * 0.78 + sideSize * 0.5;
  if (prefix) ctx.fillText(prefix, w / 2, cy - gapY + capShift(ctx));
  if (suffix) ctx.fillText(suffix, w / 2, cy + gapY + capShift(ctx));
  ctx.restore();
  const landed = t >= S.land;
  const i = clamp(Math.floor((t - S.start) / S.tick), 0, S.n - 1);
  const local = landed ? t - S.land : t - (S.start + i * S.tick);
  const face = landed ? (s: number) => displayFont(saasFont(sc), s) : SHUFFLE_FACES[(i + (hashString(target) % 7)) % SHUFFLE_FACES.length];
  const size = fitWord(sc, target, face, safe.width * 0.86, base);
  const pk = ease.outExpo(clamp(local / (landed ? 0.22 : S.tick * 0.6)));
  const look = landed ? -1 : i % 5;
  ctx.save();
  ctx.globalAlpha = clamp((t - S.start + 0.05) / 0.1) * (1 - ex);
  const kk = landed ? { x: 0, y: 0 } : kick(sc, local, 4);
  ctx.translate(w / 2 + kk.x, cy + kk.y);
  const s = lerp(landed ? 1.2 : 1.08, 1, pk) * (1 + 0.03 * smoothHold(t - S.land) * (landed ? 1 : 0));
  ctx.scale(s, s);
  if (!landed) ctx.rotate((i % 2 ? 1 : -1) * 0.03 * (1 - pk));
  ctx.font = face(size);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const dy = capShift(ctx);
  const tw = ctx.measureText(target).width;
  if (look === 3) {
    const pad = size * 0.2;
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.roundRect(-tw / 2 - pad, -size * 0.6, tw + pad * 2, size * 1.2, size * 0.12);
    ctx.fill();
  }
  if (look === 2) {
    ctx.strokeStyle = palette.secondary;
    ctx.lineWidth = Math.max(2, size * 0.028);
    ctx.lineJoin = "round";
    ctx.strokeText(target, 0, dy);
  } else {
    if (landed) {
      const g = ctx.createLinearGradient(-tw / 2, -size / 2, tw / 2, size / 2);
      g.addColorStop(0, palette.primary);
      g.addColorStop(1, palette.secondary);
      ctx.fillStyle = g;
    } else ctx.fillStyle = look === 1 ? palette.primary : look === 3 ? textOn(sc) : look === 4 ? palette.accent : palette.text;
    ctx.fillText(target, 0, dy);
  }
  ctx.restore();
  if (landed) {
    // Lock: corner brackets snap in around the word in its final face.
    const k = ease.outExpo(range(t, S.land, S.land + 0.3)) * (1 - ex);
    const pad = size * 0.28 + (1 - k) * 30 * u;
    const bx = w / 2 - tw / 2 - pad;
    const by = cy - size * 0.62 - pad * 0.5;
    const bw = tw + pad * 2;
    const bh = size * 1.24 + pad;
    const arm = Math.min(bw, bh) * 0.18;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = Math.max(2, 3 * u);
    ctx.lineCap = "round";
    for (const [x, y, sx, sy] of [
      [bx, by, 1, 1],
      [bx + bw, by, -1, 1],
      [bx, by + bh, 1, -1],
      [bx + bw, by + bh, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * arm);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * arm, y);
      ctx.stroke();
    }
    ctx.restore();
    subLine(sc, (suffix ? cy + gapY + sideSize * 0.6 : by + bh) + 36 * u, range(t, S.land + 0.25, S.land + 0.7) * (1 - ex));
  }
}

const shuffleSfx = (raw: Scene, beat: number): SfxCue[] => {
  const scene = fastScene(raw);
  const S = shufflePlan(scene, beat);
  return [...Array.from({ length: Math.min(10, S.n) }, (_, i) => ({ t: S.start + i * S.tick, kind: "tick" as const })), { t: S.land, kind: "shimmer" }];
};

/* ───────────────────────── Split Flap ───────────────────────── */

const FLAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Board pages: up to two features, then the headline; each page as rows of capitals. */
function flapPages(scene: Scene, beat: number, portrait: boolean) {
  const wrapRows = (text: string, cols: number) => {
    const rows: string[] = [];
    let cur = "";
    for (const wd of text.toUpperCase().replace(/\*/g, "").split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${wd}` : wd;
      if (next.length > cols && cur) {
        rows.push(cur);
        cur = wd;
      } else cur = next;
    }
    if (cur) rows.push(cur);
    return rows;
  };
  // The board widens (smaller tiles) until the longest word fits a row and the line fits three
  // rows (four in vertical), so no word is ever cut off.
  const headText = scene.text || "Next stop: *launch*";
  const longest = Math.max(...[headText, ...cycleWords(scene, 2)].flatMap((x) => x.replace(/\*/g, "").split(/\s+/)).map((x) => x.length));
  const cap = portrait ? 14 : 24;
  const maxRows = portrait ? 4 : 3;
  let cols = Math.min(cap, Math.max(portrait ? 9 : 12, longest));
  while (wrapRows(headText, cols).length > maxRows && cols < cap) cols++;
  const rowsOf = (text: string) => wrapRows(text, cols).map((r) => r.slice(0, cols)).slice(0, maxRows);
  const tick = tickOf(beat);
  const settle = (rows: string[]) => 0.35 + Math.max(...rows.map((r) => r.length)) * 0.035 + rows.length * 0.06;
  const head = rowsOf(scene.text || "Next stop: *launch*");
  const feats = cycleWords(scene, 2).map((x) => rowsOf(x));
  const hold = Math.max(0.35, tick * 2);
  const pages: { rows: string[]; at: number }[] = [];
  let at = 0.25;
  const budget = scene.duration - Math.max(1.4, scene.duration * 0.42);
  for (const f of feats) {
    if (at + settle(f) + hold + settle(head) > budget + 0.4) break;
    pages.push({ rows: f, at });
    at += settle(f) + hold;
  }
  pages.push({ rows: head, at });
  return { pages, land: at + settle(head), mark: [...pages.map((p) => p.at)] };
}

function splitFlap(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, seed } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 0 });
  const portrait = h > w;
  const safe = tokens(w, h).safe;
  const { pages, land } = flapPages(scene, sc.beat, portrait);
  const ex = ease.inCubic(exitT(sc, 0.35));
  const accents = new Set(accentWords(scene.text || "").filter((x) => x.a).map((x) => x.w.toUpperCase()));
  const rows = Math.max(...pages.map((p) => p.rows.length));
  const cols = Math.max(...pages.flatMap((p) => p.rows.map((r) => r.length)));
  const gap = 8 * u * (portrait ? 0.9 : 1);
  // 88% of the safe width, so the board keeps clear of the edges under the camera push-in.
  const tw = Math.min((safe.width * 0.88 - gap * (cols - 1)) / cols, Math.min(w, h) * (portrait ? 0.12 : 0.11));
  const th = tw * 1.4;
  const boardW = cols * tw + (cols - 1) * gap;
  const boardH = rows * th + (rows - 1) * gap * 1.6;
  const x0 = w / 2 - boardW / 2;
  const y0 = h * 0.47 - boardH / 2;
  // The character each tile shows on a page (rows centred on the board).
  const charAt = (p: number, r: number, c: number) => {
    const rowsP = pages[p].rows;
    const ro = Math.floor((rows - rowsP.length) / 2);
    const row = rowsP[r - ro];
    if (row === undefined) return " ";
    const co = Math.floor((cols - row.length) / 2);
    return row[c - co] ?? " ";
  };
  // Words in the accent turn the brand colour on the final page.
  const accentCell = (r: number, c: number) => {
    const p = pages.length - 1;
    const rowsP = pages[p].rows;
    const ro = Math.floor((rows - rowsP.length) / 2);
    const row = rowsP[r - ro];
    if (!row) return false;
    const co = Math.floor((cols - row.length) / 2);
    const i = c - co;
    if (i < 0 || i >= row.length || row[i] === " ") return false;
    const start = row.lastIndexOf(" ", i) + 1;
    const end = row.indexOf(" ", i);
    return accents.has(row.slice(start, end < 0 ? undefined : end).replace(/[^\w-]/g, ""));
  };
  const face = `400 ${Math.round(th * 0.78)}px "Bebas Neue", "Anton", Impact, sans-serif`;
  const step = 0.05;
  const tileTop = palette.light ? mixHex(palette.bg1, "#000000", 0.78) : mixHex(palette.bg1, "#ffffff", 0.16);
  const tileBot = palette.light ? mixHex(palette.bg1, "#000000", 0.84) : mixHex(palette.bg1, "#ffffff", 0.1);
  const ink = palette.light ? "#ffffff" : palette.text;
  ctx.save();
  ctx.globalAlpha = clamp(t / 0.25) * (1 - ex);
  ctx.font = face;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const dy = capShift(ctx);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * (tw + gap);
      const y = y0 + r * (th + gap * 1.6);
      // Which page this tile is on, and whether it is still flipping towards it.
      let p = 0;
      for (let k = 0; k < pages.length; k++) if (t >= pages[k].at) p = k;
      const target = charAt(p, r, c);
      const from = p > 0 ? charAt(p - 1, r, c) : " ";
      const jitter = ((hashString(`${seed}:${r}:${c}`) % 100) / 100) * 0.12;
      const settleAt = pages[p].at + 0.12 + c * 0.035 + r * 0.06 + jitter;
      const changes = target !== from;
      const flips = changes && t < settleAt && t >= pages[p].at;
      let shown = target;
      let prevC = target;
      let f = 1;
      if (flips) {
        const n = Math.floor((t - pages[p].at) / step);
        const pick = (k: number) => (k < 0 ? from : FLAP[(hashString(`${r}:${c}:${p}`) + k * 7) % FLAP.length]);
        shown = pick(n);
        prevC = pick(n - 1);
        f = ((t - pages[p].at) % step) / step;
      } else if (t < pages[0].at + 0.12) shown = " ";
      // Tile halves.
      ctx.fillStyle = tileTop;
      ctx.beginPath();
      ctx.roundRect(x, y, tw, th / 2, [tw * 0.1, tw * 0.1, 0, 0]);
      ctx.fill();
      ctx.fillStyle = tileBot;
      ctx.beginPath();
      ctx.roundRect(x, y + th / 2, tw, th / 2, [0, 0, tw * 0.1, tw * 0.1]);
      ctx.fill();
      const color = !flips && p === pages.length - 1 && accentCell(r, c) ? palette.primary : ink;
      const half = (ch: string, top: boolean, scaleY = 1, flap = false) => {
        if (ch === " " && !flap) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, top ? y : y + th / 2, tw, th / 2);
        ctx.clip();
        ctx.translate(x + tw / 2, y + th / 2);
        ctx.scale(1, scaleY);
        if (flap) {
          // The flap is a card of its own: its face, then shade as it turns away from the light.
          ctx.fillStyle = top ? tileTop : tileBot;
          ctx.fillRect(-tw / 2, top ? -th / 2 : 0, tw, th / 2);
        }
        ctx.fillStyle = color;
        if (ch !== " ") ctx.fillText(ch, 0, dy);
        if (flap) {
          ctx.fillStyle = rgba("#000000", 0.55 * (1 - Math.abs(scaleY)));
          ctx.fillRect(-tw / 2, top ? -th / 2 : 0, tw, th / 2);
        }
        ctx.restore();
      };
      if (flips) {
        // Under the flap: the new letter's top half, the old letter's bottom half.
        half(shown, true);
        half(prevC, false);
        // The flap: the old top half folding down, then the new bottom half landing.
        if (f < 0.5) half(prevC, true, Math.cos(f * Math.PI), true);
        else half(shown, false, -Math.cos(f * Math.PI), true);
      } else {
        half(shown, true);
        half(shown, false);
      }
      // Hinge.
      ctx.fillStyle = rgba("#000000", 0.45);
      ctx.fillRect(x, y + th / 2 - Math.max(1, u) / 2, tw, Math.max(1, u));
    }
  }
  ctx.restore();
  subLine(sc, y0 + boardH + 44 * u, range(t, land + 0.2, land + 0.7) * (1 - ex));
}

const flapSfx = (raw: Scene, beat: number): SfxCue[] => {
  const scene = fastScene(raw);
  const { pages, land } = flapPages(scene, beat, false);
  const out: SfxCue[] = [];
  for (const p of pages) for (let k = 0; k < 4; k++) out.push({ t: p.at + 0.05 + k * 0.1, kind: "tick" });
  out.push({ t: land, kind: "click" });
  return out;
};

/* ───────────────────────── Registry ───────────────────────── */

export const fastTypeSkills: Skill[] = [
  {
    id: "rapid-fire",
    name: "Rapid Fire",
    tagline: "The features flash one per half-beat in changing treatments (solid, outline, boxed, italic), then the line punches in.",
    bestFor: "A high-energy positioning moment: 3–6 one- or two-word features (items) fired off before the headline (2–6 words) lands.",
    sample: { text: "Ship it *together*", items: ["Plan", "Build", "Test", "Launch"] },
    itemsHint: "3–6 one- or two-word features",
    render: rapidFire,
    sfx: rapidSfx,
  },
  {
    id: "flip-switch",
    name: "Flip Switch",
    tagline: "One word of the line flips through the features in its box like a flap card, slowing down until it lands on the real one.",
    bestFor: "Lines that complete with one word: 'Built for *teams*' with items as the other words it flips through (audiences, uses, outcomes).",
    sample: { text: "Built for *teams*", items: ["Founders", "Designers", "Engineers", "Marketers"] },
    itemsHint: "3–5 short features or audiences it flips through",
    render: flipSwitch,
    sfx: flipSfx,
  },
  {
    id: "zoom-through",
    name: "Zoom Through",
    tagline: "Words rush out of the distance, hold the focus for a tick and fly through the camera, until the line arrives and stays.",
    bestFor: "Momentum and range: 3–6 short features (items) zooming past before the headline. Great as a hook.",
    sample: { text: "Your work, *in one place*", items: ["Docs", "Tasks", "Chat", "Goals"] },
    itemsHint: "3–6 short features",
    render: zoomThrough,
    sfx: zoomSfx,
  },
  {
    id: "slice-switch",
    name: "Slice Switch",
    tagline: "A word is cut into strips that shear out sideways as the next word shears in, with a brand-coloured cut along the seams.",
    bestFor: "Switching quickly between 3–5 short features (items) before the headline lands. Bold, editorial energy.",
    sample: { text: "Work in *one flow*", items: ["Plan", "Track", "Review", "Ship"] },
    itemsHint: "3–5 short features",
    render: sliceSwitch,
    sfx: sliceSfx,
  },
  {
    id: "style-shuffle",
    name: "Style Shuffle",
    tagline: "The accent word jumps between typefaces and treatments on the half-beat, then locks into the video's own face inside snapping brackets.",
    bestFor: "A short line with one key word (*accent*) that deserves a moment: 'Made to *stand out*'. No items needed.",
    sample: { text: "Made to *stand out*" },
    render: styleShuffle,
    sfx: shuffleSfx,
  },
  {
    id: "split-flap",
    name: "Split Flap",
    tagline: "A departures board flips letter by letter through one or two features, then settles on the line, the accent word in the brand colour.",
    bestFor: "Launches, travel, 'what's next' moments. Headline of 2–4 short words; items = up to 2 one-word features shown first.",
    sample: { text: "Next stop: *launch*", items: ["Plan", "Build"] },
    itemsHint: "Up to 2 one-word features",
    render: splitFlap,
    sfx: flapSfx,
  },
];
