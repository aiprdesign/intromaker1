/**
 * Speed animations: ten more fast-type slides in the motion-design vocabulary of promo spots.
 * They share fast type's timing (words switch every half-beat or so, the headline then holds for
 * at least ~45% of the scene) and its layout helpers, and like it they never flash the whole
 * frame: colour moves in word-sized pieces, bands and tiles.
 *
 * - Whip Pan: words whip across the frame with a directional smear, each pushing the last out.
 * - Stack Stomp: the line drops in word by word into a justified stack, squashing on impact.
 * - Speed Ticker: rows of type race past and brake; the centre row stops on the line.
 * - Cube Spin: a panel rolls like a cube, a new word on each face, the line on the last.
 * - Speed Type: the last word is typed, selected and retyped at speed until it is the right one.
 * - Bar Wipe: a brand-colour bar sweeps over each word and pulls back on the next.
 * - Crash Zoom: the camera crashes into a letter's counter and out the other side on the next word.
 * - Word Grid: a grid of the features lights up in a fast chase, then folds away for the line.
 * - Orbit Text: the features spin round the line on a ring that brakes as the line lands.
 * - Tape Rush: two tapes of type race across the frame in opposite directions around the line.
 */
import { exitT } from "../fx";
import { tokens } from "../grid";
import { clamp, ease, lerp, mixHex, range, rgba } from "../math";
import { saasBackground, saasFont, spring } from "../saasfx";
import { capShift, displayFont, fillTextFit, subFont } from "../text";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { accentWords, type Word } from "./editorial";
import {
  cycleWords,
  drawLaid,
  fastScene,
  fitWord,
  kick,
  landHeadline,
  layWords,
  splitTarget,
  streaks,
  subLine,
  switchPlan,
  textOn,
  tickOf,
} from "./fastype";

const faceOf = (sc: SkillContext) => (s: number) => displayFont(saasFont(sc), s);
const exitOf = (sc: SkillContext) => ease.inCubic(exitT(sc, 0.35));

/**
 * Position under a linear brake: full speed `v0` until `t0`, braking evenly to `v1` by `t1`,
 * then cruising at `v1`. Exact at every frame, so motion never stutters.
 */
function braked(t: number, v0: number, v1: number, t0: number, t1: number) {
  if (t <= t0) return v0 * t;
  const T = Math.max(1e-3, t1 - t0);
  const q = Math.min(t, t1) - t0;
  const during = v0 * q - ((v0 - v1) * q * q) / (2 * T);
  return v0 * t0 + during + (t > t1 ? v1 * (t - t1) : 0);
}

/** A gradient fill across a box for the brand's accent. */
function brandFill(sc: SkillContext, x: number, y: number, w: number, h: number) {
  const g = sc.ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, sc.palette.primary);
  g.addColorStop(1, sc.palette.secondary);
  return g;
}

/* ───────────────────────── Whip Pan ───────────────────────── */

function whipPan(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const P = switchPlan(scene, sc.beat, { per: 1.4 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const cy = h * 0.47;
  const ex = exitOf(sc);
  const face = faceOf(sc);
  const n = P.words.length;
  const at = (i: number) => P.start + i * P.tick;
  const whip = Math.min(0.2, P.tick * 0.7);
  let motion = 0;
  for (let i = 0; i <= n; i++) {
    const enter = clamp((t - at(i)) / whip);
    const leave = i < n ? clamp((t - at(i + 1)) / (whip * 0.8)) : 0;
    if (t < at(i) || leave >= 1) continue;
    // In from the right, out to the left: one continuous camera pan.
    const x = (1 - ease.outExpo(enter)) * w * 0.9 - ease.inExpo(leave) * w * 0.95;
    const moving = Math.max(1 - ease.outCubic(enter), leave);
    motion = Math.max(motion, moving);
    if (i === n) {
      if (enter >= 1) continue;
      ctx.save();
      ctx.translate(x, 0);
      ctx.globalAlpha = clamp(enter * 3) * (1 - ex);
      const laid = layWords(sc, accentWords(scene.text || "Keep work *moving*"), safe.width * 0.92, short * (h > w ? 0.19 : 0.17), h > w ? 3 : 2);
      drawLaid(sc, laid, w / 2, cy);
      ctx.restore();
      continue;
    }
    const word = P.words[i];
    const size = fitWord(sc, word, face, safe.width * 0.86, short * 0.22);
    ctx.save();
    ctx.font = face(size);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const dy = capShift(ctx);
    ctx.translate(w / 2 + x, cy);
    ctx.scale(1 + 0.22 * moving, 1 - 0.06 * moving);
    // The smear trails to the right of the motion.
    ctx.fillStyle = i % 2 ? palette.primary : palette.text;
    for (let j = 4; j >= 1; j--) {
      if (moving < 0.05) break;
      ctx.globalAlpha = 0.16 * (1 - j / 5) * moving;
      ctx.fillText(word, j * size * 0.28 * moving, dy);
    }
    ctx.globalAlpha = 1 - ex;
    ctx.fillText(word, 0, dy);
    ctx.restore();
  }
  streaks(sc, motion * 0.7 * (1 - ex), rgba(palette.text, 0.5), { dir: "left", count: 40 });
  // Once the pan settles, the line holds where it stopped (with its punch and subline).
  if (t >= at(n) + whip) landHeadline(sc, at(n) + whip, cy, { from: 1.04 });
}

const whipSfx = (raw: Scene, beat: number): SfxCue[] => {
  const scene = fastScene(raw);
  const P = switchPlan(scene, beat, { per: 1.4 });
  return Array.from({ length: Math.min(7, P.words.length + 1) }, (_, i) => ({ t: P.start + i * P.tick, kind: "swoosh" as const }));
};

/* ───────────────────────── Stack Stomp ───────────────────────── */

/** The line's words as stack lines: short words ride with the next one ("to *ship*"). */
function stackLines(text: string) {
  const words = accentWords(text || "Built to *ship* together");
  const lines: Word[][] = [];
  let carry: Word[] = [];
  for (const wd of words) {
    carry.push(wd);
    if (wd.w.length > 3 || carry.length >= 2) {
      lines.push(carry);
      carry = [];
    }
  }
  if (carry.length) {
    if (lines.length) lines[lines.length - 1].push(...carry);
    else lines.push(carry);
  }
  return lines.slice(0, 6);
}

function stompPlan(scene: Scene, beat: number) {
  const n = stackLines(scene.text).length;
  const tick = tickOf(beat) * 1.3;
  const start = 0.15;
  return { n, tick, start, land: start + n * tick, fall: Math.min(0.14, tick * 0.6) };
}

function stackStomp(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const portrait = h > w;
  const lines = stackLines(scene.text);
  const S = stompPlan(scene, sc.beat);
  const ex = exitOf(sc);
  const face = faceOf(sc);
  // Justified: each line set to the block's width (a word too short to fill it stops at a cap).
  const blockW = Math.min(safe.width * (portrait ? 0.86 : 0.5), short * 0.95);
  const texts = lines.map((l) => l.map((x) => x.w).join(" "));
  let sizes = texts.map((s) => fitWord(sc, s, face, blockW, short * 0.3));
  const gap = short * 0.012;
  const total = sizes.reduce((a, s) => a + s * 0.86 + gap, -gap);
  const room = safe.height * 0.74;
  if (total > room) sizes = sizes.map((s) => (s * room) / total);
  const block = sizes.reduce((a, s) => a + s * 0.86 + gap, -gap);
  const top = h * 0.48 - block / 2;
  // Every landing kicks the whole stack.
  let lastLand = -1;
  for (let i = 0; i < lines.length; i++) if (t >= S.start + i * S.tick + S.fall) lastLand = S.start + i * S.tick + S.fall;
  const kk = kick(sc, t - lastLand, 6);
  ctx.save();
  ctx.translate(kk.x, kk.y);
  let y = top;
  lines.forEach((line, i) => {
    const size = sizes[i];
    const lh = size * 0.86;
    const cyL = y + lh / 2;
    y += lh + gap;
    const drop = S.start + i * S.tick;
    if (t < drop) return;
    const fall = clamp((t - drop) / S.fall);
    const dt = t - drop - S.fall;
    // Falls in accelerating, squashes on impact, springs back.
    const sq = dt > 0 ? Math.exp(-dt * 14) * Math.cos(dt * 32) * 0.22 : 0;
    const yy = cyL - (1 - ease.inCubic(fall)) * (cyL + size);
    const out = ease.inCubic(range(t, sc.d - 0.4 + i * 0.03, sc.d - 0.1 + i * 0.03));
    ctx.save();
    ctx.globalAlpha = 1 - out;
    ctx.translate(w / 2, yy - out * h * 0.4 + lh / 2);
    ctx.scale(1 + sq * 0.6, 1 - sq);
    ctx.translate(0, -lh / 2);
    ctx.font = face(size);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const dy = capShift(ctx);
    const text = texts[i];
    const tw = ctx.measureText(text).width;
    const accent = line.some((x) => x.a);
    // Every third plain line in outline, for rhythm.
    if (!accent && i % 3 === 1) {
      ctx.strokeStyle = palette.text;
      ctx.lineWidth = Math.max(2, size * 0.025);
      ctx.lineJoin = "round";
      ctx.strokeText(text, 0, dy);
    } else {
      ctx.fillStyle = accent ? brandFill(sc, -tw / 2, -size / 2, tw, size) : palette.text;
      ctx.fillText(text, 0, dy);
    }
    ctx.restore();
  });
  ctx.restore();
  subLine(sc, top + block + 36 * u, range(t, S.land + 0.2, S.land + 0.6) * (1 - ex));
}

const stompSfx = (raw: Scene, beat: number): SfxCue[] => {
  const S = stompPlan(fastScene(raw), beat);
  return Array.from({ length: S.n }, (_, i) => ({ t: S.start + i * S.tick + S.fall, kind: "pop" as const }));
};

/* ───────────────────────── Speed Ticker ───────────────────────── */

function speedTicker(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 0 });
  const portrait = h > w;
  const safe = tokens(w, h).safe;
  const ex = exitOf(sc);
  const face = faceOf(sc);
  const words = cycleWords(scene, 6);
  const land = Math.max(1.1, Math.min(sc.d * 0.5, 1.9));
  const rows = portrait ? 7 : 5;
  const rowGap = 1.18;
  const mid = Math.floor(rows / 2);
  const bandH = (h * (portrait ? 0.6 : 0.74)) / (rows * rowGap + 0.6);
  const top = h * 0.47 - (bandH * (rows * rowGap + 0.6)) / 2;
  // The centre row: the line, braking to a stop dead centre at `land`.
  const laid = layWords(sc, accentWords(scene.text || "Keep work *in motion*"), safe.width * 0.84, bandH * 1.25, 1);
  const lw = laid.lines[0].w;
  const v0 = w * 3.2;
  const stopAt = braked(land, v0, 0, 0.15, land);
  ctx.save();
  ctx.globalAlpha = clamp(t / 0.15) * (1 - ex);
  for (let r = 0; r < rows; r++) {
    const isMid = r === mid;
    const cyR = top + (r * rowGap + (r > mid ? 0.6 : r === mid ? 0.3 : 0)) * bandH + bandH / 2;
    const dir = r % 2 ? 1 : -1;
    if (isMid) {
      // A dark band lifts the line's row off the racing type around it.
      ctx.save();
      ctx.fillStyle = rgba(palette.bg0, 0.82);
      ctx.fillRect(0, cyR - bandH * 0.85, w, bandH * 1.7);
      ctx.fillStyle = rgba(palette.primary, 0.5);
      ctx.fillRect(0, cyR - bandH * 0.85, w, Math.max(1, u));
      ctx.fillRect(0, cyR + bandH * 0.85 - Math.max(1, u), w, Math.max(1, u));
      ctx.restore();
      // Copies of the line a frame-width apart; the brake leaves copy 0 centred.
      const x = braked(t, v0, 0, 0.15, land) - stopAt;
      const speed = t < land ? v0 * (1 - clamp((t - 0.15) / (land - 0.15))) : 0;
      for (const k of [-1, 0, 1]) {
        const cx = w / 2 + x + k * (lw + w);
        if (cx + lw / 2 < -w * 0.1 || cx - lw / 2 > w * 1.1) continue;
        if (speed > w * 0.3) {
          ctx.save();
          ctx.globalAlpha *= 0.25;
          drawLaid(sc, laid, cx - speed * 0.02, cyR);
          ctx.restore();
        }
        ctx.save();
        const punch = t >= land ? 1 + 0.04 * Math.exp(-(t - land) * 8) : 1;
        ctx.translate(cx, cyR);
        ctx.scale(punch, punch);
        drawLaid(sc, laid, 0, 0);
        ctx.restore();
      }
      continue;
    }
    // Other rows: the features on repeat, braking with the line, then idling dimmed.
    const v = w * (1.6 + ((r * 37) % 10) / 10);
    const pos = braked(t, v, w * 0.04, 0.15, land);
    const size = bandH * 0.55;
    ctx.font = face(size);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const dy = capShift(ctx);
    const unit = `${words.map((x) => x.toUpperCase()).join("  ·  ")}  ·  `;
    const uw = ctx.measureText(unit).width;
    const off = ((((dir * pos) % uw) + uw) % uw) - uw;
    const fade = 1 - 0.75 * ease.outCubic(range(t, land - 0.2, land + 0.4));
    const outline = r % 2 === 0;
    ctx.save();
    ctx.globalAlpha *= fade * (0.3 + 0.2 * (1 - Math.abs(r - mid) / rows));
    for (let x = off; x < w; x += uw) {
      if (outline) {
        ctx.strokeStyle = palette.text;
        ctx.lineWidth = Math.max(1, size * 0.02);
        ctx.strokeText(unit, x, cyR + dy);
      } else {
        ctx.fillStyle = r === mid - 1 || r === mid + 1 ? palette.primary : palette.text;
        ctx.fillText(unit, x, cyR + dy);
      }
    }
    ctx.restore();
  }
  ctx.restore();
  subLine(sc, top + (mid * rowGap + 0.3) * bandH + bandH * 1.5 + 24 * u, range(t, land + 0.25, land + 0.7) * (1 - ex));
}

const tickerSfx = (): SfxCue[] => [
  { t: 0.1, kind: "whoosh" },
  { t: 1.2, kind: "click" },
];

/* ───────────────────────── Cube Spin ───────────────────────── */

function cubeSpin(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const P = switchPlan(scene, sc.beat, { per: 1.5, start: 0.35 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const portrait = h > w;
  const cy = h * 0.47;
  const ex = exitOf(sc);
  const face = faceOf(sc);
  const laid = layWords(sc, accentWords(scene.text || "Ideas *in motion*"), safe.width * 0.8, short * (portrait ? 0.17 : 0.16), portrait ? 3 : 2);
  const sizes = P.words.map((x) => fitWord(sc, x, face, safe.width * 0.72, short * 0.19));
  ctx.font = face(100);
  ctx.letterSpacing = "0px";
  const widths = P.words.map((x, i) => (ctx.measureText(x).width / 100) * sizes[i]);
  const headW = Math.max(...laid.lines.map((l) => l.w));
  const headH = laid.lines.length * laid.lh;
  // One panel for every face: as wide as the widest word, as tall as the tallest.
  const padX = short * 0.05;
  const PW = Math.max(headW, ...widths) + padX * 2;
  const PH = Math.max(headH, ...sizes.map((s) => s * 1.2)) + short * 0.06;
  const roll = Math.min(0.24, P.tick * 0.75);
  const n = P.words.length;
  let cur = 0;
  for (let i = 1; i <= n; i++) if (t >= P.start + i * P.tick) cur = i;
  const since = t - (P.start + cur * P.tick);
  const rolling = cur > 0 && since < roll;
  const q = rolling ? ease.inOutCubic(since / roll) : 1;
  const th = q * (Math.PI / 2);
  const intro = ease.outExpo(range(t, 0.05, 0.4));
  const drawFace = (i: number, cyF: number, hScale: number, depth: number) => {
    if (hScale <= 0.01) return;
    ctx.save();
    ctx.translate(w / 2, cyF);
    // Nearer faces read a touch wider (perspective) and lit; turning faces darken.
    ctx.scale(0.9 + 0.1 * depth, hScale);
    ctx.beginPath();
    ctx.roundRect(-PW / 2, -PH / 2, PW, PH, short * 0.03);
    ctx.fillStyle = mixHex(palette.bg1, palette.primary, i === n ? 0.16 : 0.08);
    ctx.fill();
    ctx.strokeStyle = rgba(i === n ? palette.primary : palette.text, i === n ? 0.6 : 0.18);
    ctx.lineWidth = Math.max(1, 1.5 * u);
    ctx.stroke();
    if (i === n) drawLaid(sc, laid, 0, 0);
    else {
      ctx.font = face(sizes[i]);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = i % 2 ? palette.primary : palette.text;
      ctx.fillText(P.words[i], 0, capShift(ctx));
    }
    ctx.fillStyle = rgba("#000000", 0.5 * (1 - depth));
    ctx.beginPath();
    ctx.roundRect(-PW / 2, -PH / 2, PW, PH, short * 0.03);
    ctx.fill();
    ctx.restore();
  };
  ctx.save();
  ctx.globalAlpha = intro * (1 - ex);
  ctx.translate(0, (1 - intro) * 30 * u);
  if (rolling) {
    // Rolling up: the front face tips away over the top while the next rises from below.
    drawFace(cur - 1, cy - (PH / 2) * Math.sin(th), Math.cos(th), Math.cos(th));
    drawFace(cur, cy + (PH / 2) * Math.cos(th), Math.sin(th), Math.sin(th));
  } else drawFace(cur, cy, 1, 1);
  ctx.restore();
  if (cur === n && !rolling) subLine(sc, cy + PH / 2 + 32 * u, range(t, P.land + roll + 0.1, P.land + roll + 0.5) * (1 - ex));
}

const cubeSfx = (raw: Scene, beat: number): SfxCue[] => {
  const P = switchPlan(fastScene(raw), beat, { per: 1.5, start: 0.35 });
  return [{ t: 0.1, kind: "swoosh" }, ...P.words.map((_, i) => ({ t: P.start + (i + 1) * P.tick, kind: "tick" as const }))];
};

/* ───────────────────────── Speed Type ───────────────────────── */

/** The typing script: each word typed, held, selected, then typed over; the last one stays. */
function typePlan(scene: Scene, beat: number) {
  const { target } = splitTarget(scene.text || "Built for *makers*");
  const pool = cycleWords(scene, 4).filter((x) => x.toLowerCase() !== target.toLowerCase());
  const tick = tickOf(beat);
  const cps = 0.032;
  const hold = tick * 1.3;
  const sel = 0.12;
  const budget = scene.duration - Math.max(1.3, scene.duration * 0.45);
  const steps: { word: string; start: number; typed: number; select: number; end: number }[] = [];
  let at = 0.4;
  const len = (wd: string) => wd.length * cps;
  for (const wd of pool) {
    if (at + len(wd) + hold + sel + len(target) > budget) break;
    steps.push({ word: wd, start: at, typed: at + len(wd), select: at + len(wd) + hold, end: at + len(wd) + hold + sel });
    at += len(wd) + hold + sel;
  }
  steps.push({ word: target, start: at, typed: at + len(target), select: Infinity, end: Infinity });
  return { steps, land: at + len(target), cps };
}

function speedType(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const portrait = h > w;
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const { prefix, suffix } = splitTarget(scene.text || "Built for *makers*");
  const T = typePlan(scene, sc.beat);
  const ex = exitOf(sc);
  const face = faceOf(sc);
  ctx.font = face(100);
  ctx.letterSpacing = "0px";
  const wOf = (s: string) => ctx.measureText(s).width / 100;
  const widest = Math.max(...T.steps.map((s) => wOf(s.word)));
  const prefixW = prefix ? wOf(prefix) + wOf(" ") : 0;
  const suffixW = suffix ? wOf(" ") + wOf(suffix) : 0;
  let size = Math.min(short * 0.16, (safe.width * 0.9) / (prefixW + widest + suffixW + 0.1));
  // Tall frames stack sooner: the line reads bigger on two lines than squeezed onto one.
  const stacked = !!(prefix || suffix) && size < short * (portrait ? 0.13 : 0.09);
  if (stacked) size = Math.min(short * (portrait ? 0.18 : 0.14), (safe.width * 0.9) / Math.max(prefixW, widest + 0.1, suffixW));
  const cy = h * 0.47;
  const step = [...T.steps].reverse().find((s) => t >= s.start) ?? T.steps[0];
  const shown = t < step.start ? "" : step.word.slice(0, Math.max(0, Math.floor((t - step.start) / T.cps) + 1));
  const typing = t >= step.start && t < step.typed;
  const selected = t >= step.select && t < step.end;
  const landed = t >= T.land;
  ctx.font = face(size);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const dy = capShift(ctx);
  // Left-aligned from where the widest word would centre, so the line never jitters while typing.
  // One line: placed so the finished line is centred (longer words on the way may run right,
  // within the safe area). Stacked: the typed word centres on its own line as it grows.
  const targetW = wOf(T.steps[T.steps.length - 1].word);
  const x0 = Math.min(w / 2 - ((prefixW + targetW + suffixW) * size) / 2, safe.right - (prefixW + widest) * size);
  const shownW = ctx.measureText(shown).width;
  const wordX = stacked ? w / 2 - shownW / 2 : x0 + prefixW * size;
  const wordY = stacked && prefix ? cy + size * 0.6 : cy;
  const intro = ease.outExpo(range(t, 0.05, 0.4));
  ctx.save();
  ctx.globalAlpha = intro * (1 - ex);
  ctx.fillStyle = palette.text;
  if (prefix) {
    if (stacked) {
      ctx.textAlign = "center";
      ctx.fillText(prefix, w / 2, cy - size * 0.6 + dy);
      ctx.textAlign = "left";
    } else ctx.fillText(`${prefix} `, x0, cy + dy);
  }
  const sw = ctx.measureText(shown).width;
  if (selected) {
    ctx.fillStyle = rgba(palette.primary, 0.4);
    ctx.fillRect(wordX - size * 0.04, wordY - size * 0.62, sw + size * 0.08, size * 1.24);
  }
  if (landed) ctx.fillStyle = brandFill(sc, wordX, wordY - size / 2, sw, size);
  else ctx.fillStyle = palette.text;
  ctx.fillText(shown, wordX, wordY + dy);
  if (suffix && landed) {
    ctx.fillStyle = palette.text;
    if (stacked) {
      ctx.textAlign = "center";
      ctx.fillText(suffix, w / 2, wordY + size * 1.2 + dy);
    } else ctx.fillText(` ${suffix}`, wordX + sw, cy + dy);
  }
  // Caret: solid while typing, blinking at rest, gone a beat after the line lands.
  const blink = typing || selected || Math.floor(t * 2.4) % 2 === 0;
  const caretGone = landed && t > T.land + 1.2;
  if (blink && !caretGone) {
    ctx.fillStyle = palette.primary;
    ctx.fillRect(wordX + sw + size * 0.05, wordY - size * 0.5, Math.max(2, size * 0.07), size);
  }
  ctx.restore();
  subLine(sc, wordY + size * (stacked && suffix ? 1.8 : 0.7) + 30 * u, range(t, T.land + 0.25, T.land + 0.7) * (1 - ex));
}

const typeSfx = (raw: Scene, beat: number): SfxCue[] => {
  const T = typePlan(fastScene(raw), beat);
  const out: SfxCue[] = [];
  for (const s of T.steps) {
    for (let i = 0; i < s.word.length && out.length < 24; i += 2) out.push({ t: s.start + i * T.cps, kind: "key" });
    if (isFinite(s.select)) out.push({ t: s.select, kind: "click" });
  }
  return out;
};

/* ───────────────────────── Bar Wipe ───────────────────────── */

function barWipe(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const P = switchPlan(scene, sc.beat, { per: 1.5, start: 0.15 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const portrait = h > w;
  const cy = h * 0.47;
  const ex = exitOf(sc);
  const face = faceOf(sc);
  const laid = layWords(sc, accentWords(scene.text || "Cut to *the point*"), safe.width * 0.9, short * (portrait ? 0.18 : 0.16), portrait ? 3 : 2);
  const n = P.words.length;
  const box = (i: number) => {
    if (i >= n) {
      const bw = Math.max(...laid.lines.map((l) => l.w));
      const bh = laid.lines.length * laid.lh;
      return { x: w / 2 - bw / 2, y: cy - bh / 2, w: bw, h: bh };
    }
    const size = fitWord(sc, P.words[i], face, safe.width * 0.86, short * 0.22);
    ctx.font = face(size);
    ctx.letterSpacing = "0px";
    const bw = ctx.measureText(P.words[i]).width;
    return { x: w / 2 - bw / 2, y: cy - size * 0.62, w: bw, h: size * 1.24, size };
  };
  const drawFrame = (i: number) => {
    if (i >= n) return drawLaid(sc, laid, w / 2, cy);
    const b = box(i);
    ctx.font = face(b.size ?? 100);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.text;
    ctx.fillText(P.words[i], w / 2, cy + capShift(ctx));
  };
  const wipe = Math.min(0.28, P.tick * 0.85);
  // Frame i is wiped on at P.start + i * tick (frame 0 is wiped on from nothing).
  let cur = -1;
  for (let i = 0; i <= n; i++) if (t >= P.start + i * P.tick) cur = i;
  if (cur < 0) return;
  const since = t - (P.start + cur * P.tick);
  const q = clamp(since / wipe);
  const dir = cur % 2 ? -1 : 1;
  const a = cur > 0 ? box(cur - 1) : box(cur);
  const b = box(cur);
  const pad = short * 0.03;
  const x0 = Math.min(a.x, b.x) - pad;
  const x1 = Math.max(a.x + a.w, b.x + b.w) + pad;
  const y0 = Math.min(a.y, b.y) - pad * 0.5;
  const y1 = Math.max(a.y + a.h, b.y + b.h) + pad * 0.5;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // First half: the bar covers the old word; second half: it pulls away off the new one.
  const covering = q < 0.5;
  if (q < 1 && covering && cur > 0) drawFrame(cur - 1);
  if (!covering || q >= 1) drawFrame(cur);
  if (q < 1) {
    const e = covering ? ease.inOutCubic(q * 2) : ease.inOutCubic((q - 0.5) * 2);
    const span = x1 - x0;
    let bx: number;
    let bw: number;
    if (covering) {
      bw = span * e;
      bx = dir > 0 ? x0 : x1 - bw;
    } else {
      bw = span * (1 - e);
      bx = dir > 0 ? x1 - bw : x0;
    }
    // On light stages the bar is a lighter tint, so its pass reads as colour rather than a flash.
    const bar = cur % 2 ? palette.secondary : palette.primary;
    ctx.fillStyle = palette.light ? mixHex(bar, palette.bg0, 0.45) : bar;
    ctx.fillRect(bx, y0, bw, y1 - y0);
  }
  // Landed: the bar's last pass leaves a rule under the line.
  if (cur === n && q >= 1) {
    const k = ease.outExpo(range(since, wipe, wipe + 0.4));
    const rw = (x1 - x0) * 0.4 * k;
    ctx.fillStyle = palette.primary;
    ctx.fillRect(w / 2 - rw / 2, b.y + b.h + 10 * u, rw, 5 * u);
  }
  ctx.restore();
  if (cur === n) subLine(sc, b.y + b.h + 40 * u, range(t, P.land + wipe, P.land + wipe + 0.5) * (1 - ex));
}

const barSfx = (raw: Scene, beat: number): SfxCue[] => {
  const P = switchPlan(fastScene(raw), beat, { per: 1.5, start: 0.15 });
  return Array.from({ length: Math.min(7, P.words.length + 1) }, (_, i) => ({ t: P.start + i * P.tick, kind: "swoosh" as const }));
};

/* ───────────────────────── Crash Zoom ───────────────────────── */

/** Where to crash into a word: the hollow of a round letter (o, O, 0, D…), else a gap between letters. */
function zoomAnchor(ctx: CanvasRenderingContext2D, word: string, size: number) {
  const prefer = "oO0QDdbpqaeg";
  let idx = -1;
  for (const ch of prefer) {
    idx = word.indexOf(ch);
    if (idx >= 0) break;
  }
  const total = ctx.measureText(word).width;
  if (idx < 0) {
    const mid = Math.max(1, Math.floor(word.length / 2));
    return { x: ctx.measureText(word.slice(0, mid)).width - total / 2 - size * 0.01, y: 0 };
  }
  const before = ctx.measureText(word.slice(0, idx)).width;
  const cw = ctx.measureText(word[idx]).width;
  const lower = word[idx] === word[idx].toLowerCase() && !/[0-9]/.test(word[idx]);
  return { x: before + cw / 2 - total / 2, y: lower ? size * 0.1 : 0 };
}

function crashZoom(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 0 });
  const P = switchPlan(scene, sc.beat, { per: 1.6, start: 0.25 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const cy = h * 0.47;
  const ex = exitOf(sc);
  const face = faceOf(sc);
  const n = P.words.length;
  const zoom = Math.min(0.22, P.tick * 0.6);
  let rush = 0;
  for (let i = 0; i < n; i++) {
    const on = P.start + i * P.tick;
    const off = P.start + (i + 1) * P.tick;
    if (t < on || t > off) continue;
    const word = P.words[i];
    const size = fitWord(sc, word, face, safe.width * 0.8, short * 0.24);
    const arrive = ease.outExpo(clamp((t - on) / 0.14));
    const q = clamp((t - (off - zoom)) / zoom);
    rush = Math.max(rush, q);
    ctx.save();
    ctx.font = face(size);
    ctx.letterSpacing = "0px";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const dy = capShift(ctx);
    const an = zoomAnchor(ctx, word, size);
    // Arrives from the distance, then the camera crashes through the letter's hollow.
    const s = lerp(0.55, 1, arrive) * Math.pow(12, ease.inExpo(q));
    // The word dissolves as it grows past the frame, so its strokes never sweep the whole picture
    // (most of all dark type on a light stage).
    ctx.globalAlpha = clamp(arrive * 2) * (1 - ease.inOutCubic(range(q, palette.light ? 0.15 : 0.3, palette.light ? 0.6 : 0.85))) * (1 - ex);
    if (q > 0.05) ctx.filter = `blur(${(q * 10 * u).toFixed(1)}px)`;
    ctx.translate(w / 2 + an.x, cy + an.y);
    ctx.scale(s, s);
    ctx.translate(-an.x, -an.y);
    ctx.fillStyle = i % 2 ? palette.primary : palette.text;
    ctx.fillText(word, 0, dy);
    ctx.restore();
  }
  streaks(sc, rush * 0.8 * (1 - ex), rgba(palette.primary, 0.8));
  landHeadline(sc, P.land, cy, { from: 0.55 });
}

const crashSfx = (raw: Scene, beat: number): SfxCue[] => {
  const P = switchPlan(fastScene(raw), beat, { per: 1.6, start: 0.25 });
  const zoom = Math.min(0.22, P.tick * 0.6);
  return [...P.words.map((_, i) => ({ t: Math.max(0, P.start + (i + 1) * P.tick - zoom), kind: "whoosh" as const })), { t: P.land, kind: "pop" }];
};

/* ───────────────────────── Word Grid ───────────────────────── */

function gridPlan(scene: Scene, beat: number, cells: number) {
  const tick = tickOf(beat) * 0.8;
  const start = 0.55;
  const budget = scene.duration - Math.max(1.3, scene.duration * 0.45);
  const steps = clamp(Math.floor((budget - start) / tick), 3, Math.round(cells * 1.5));
  return { tick, start, steps, land: start + steps * tick + 0.15 };
}

function wordGrid(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 0 });
  const portrait = h > w;
  const square = !portrait && w / h < 1.2;
  const safe = tokens(w, h).safe;
  const ex = exitOf(sc);
  const cols = portrait ? 2 : square ? 3 : 4;
  const rows = portrait ? 5 : 3;
  const N = cols * rows;
  const G = gridPlan(scene, sc.beat, N);
  const words = cycleWords(scene, 6);
  const gap = 12 * u;
  const cw = (safe.width * 0.92 - gap * (cols - 1)) / cols;
  const ch = Math.min(cw * (portrait ? 0.52 : 0.56), (safe.height * 0.74 - gap * (rows - 1)) / rows);
  const gw = cols * cw + (cols - 1) * gap;
  const gh = rows * ch + (rows - 1) * gap;
  const x0 = w / 2 - gw / 2;
  const y0 = h * 0.48 - gh / 2;
  // Snake order for the chase: left to right, then back.
  const order: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) order.push(r * cols + (r % 2 ? cols - 1 - c : c));
  const step = Math.floor((t - G.start) / G.tick);
  const fold = ease.inCubic(range(t, G.land - 0.1, G.land + 0.25));
  for (let k = 0; k < N; k++) {
    const r = Math.floor(k / cols);
    const c = k % cols;
    const pop = clamp(spring(t - 0.1 - (r + c) * 0.04, 14, 8), 0, 1.06);
    if (pop <= 0 || fold >= 1) continue;
    const x = x0 + c * (cw + gap);
    const y = y0 + r * (ch + gap);
    // Heat: how recently the chase passed this cell (lit, then cooling over two steps).
    let heat = 0;
    if (step >= 0 && t < G.land) {
      for (let s = Math.max(0, step - 2); s <= step; s++) if (order[s % N] === k) heat = Math.max(heat, 1 - (step - s) * 0.4);
    }
    const lit = heat >= 1;
    // Folding away: every cell slides to the centre and shrinks.
    const fx = lerp(x + cw / 2, w / 2, fold);
    const fy = lerp(y + ch / 2, h * 0.48, fold);
    const s = pop * (1 - fold) * (lit ? 1.04 : 1);
    ctx.save();
    ctx.globalAlpha = (1 - ex) * (1 - fold * 0.5);
    ctx.translate(fx, fy);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.roundRect(-cw / 2, -ch / 2, cw, ch, Math.min(16 * u, ch * 0.2));
    ctx.fillStyle = heat > 0 ? mixHex(mixHex(palette.bg1, "#ffffff", 0.05), palette.primary, heat) : mixHex(palette.bg1, "#ffffff", palette.light ? 0 : 0.05);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.text, heat > 0 ? 0 : 0.12);
    ctx.lineWidth = Math.max(1, u);
    ctx.stroke();
    ctx.fillStyle = lit ? textOn(sc) : rgba(palette.text, 0.75 + 0.25 * heat);
    ctx.font = subFont(Math.min(ch * 0.36, cw * 0.15), 700);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, words[k % words.length], 0, 0, cw - 24 * u, { maxLines: 1, minScale: 0.7 });
    ctx.restore();
  }
  landHeadline(sc, G.land, h * 0.47);
}

const gridSfx = (raw: Scene, beat: number): SfxCue[] => {
  const G = gridPlan(fastScene(raw), beat, 12);
  return [...Array.from({ length: Math.min(10, G.steps) }, (_, i) => ({ t: G.start + i * G.tick, kind: "tick" as const })), { t: G.land - 0.1, kind: "whoosh" }];
};

/* ───────────────────────── Orbit Text ───────────────────────── */

function orbitText(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 0 });
  const portrait = h > w;
  const short = Math.min(w, h);
  const ex = exitOf(sc);
  const cx = w / 2;
  const cy = h * 0.47;
  const R = portrait ? w * 0.4 : short * 0.38;
  const words = cycleWords(scene, 6);
  const land = Math.max(1.1, Math.min(sc.d * 0.5, 1.8));
  const intro = ease.outExpo(range(t, 0.05, 0.5));
  const ring = (radius: number, text: string, size: number, omega0: number, dir: number, alpha: number, color: string) => {
    ctx.save();
    ctx.font = subFont(size, 700);
    ctx.letterSpacing = `${(size * 0.18).toFixed(1)}px`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const unitW = ctx.measureText(text).width;
    const reps = Math.max(1, Math.floor((Math.PI * 2 * radius) / unitW));
    const full = text.repeat(reps);
    const chars = [...full];
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0);
    // Even spacing round the whole ring, whatever the text's length.
    const k = (Math.PI * 2 * radius) / total;
    const phi = dir * braked(t, omega0, 0.18, 0.1, land);
    const omega = t < land ? omega0 * (1 - clamp((t - 0.1) / (land - 0.1))) + 0.18 : 0.18;
    for (const ghost of omega > 1.5 ? [0.02, 0] : [0]) {
      ctx.globalAlpha = alpha * (ghost ? 0.3 : 1) * intro * (1 - ex);
      ctx.fillStyle = color;
      let a = phi - dir * ghost * omega - Math.PI / 2;
      for (let i = 0; i < chars.length; i++) {
        const cwid = widths[i] * k;
        const mid = a + cwid / 2 / radius;
        ctx.save();
        ctx.translate(cx + Math.cos(mid) * radius, cy + Math.sin(mid) * radius);
        ctx.rotate(mid + Math.PI / 2);
        ctx.fillText(chars[i], 0, 0);
        ctx.restore();
        a += cwid / radius;
      }
    }
    ctx.restore();
  };
  const unit = `${words.map((x) => x.toUpperCase()).join("  •  ")}  •  `;
  ring(R, unit, R * 0.1, 7, 1, 0.9, palette.text);
  ring(R * 0.8, unit, R * 0.07, 9, -1, 0.45, palette.primary);
  // A faint guide circle between the rings.
  ctx.save();
  ctx.globalAlpha = 0.12 * intro * (1 - ex);
  ctx.strokeStyle = palette.text;
  ctx.lineWidth = Math.max(1, u);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  landHeadline(sc, land, cy, { maxW: R * 1.3, maxSize: short * 0.13, maxLines: 3, sub: false });
  subLine(sc, cy + R + 36 * u, range(t, land + 0.3, land + 0.8) * (1 - ex));
}

const orbitSfx = (): SfxCue[] => [
  { t: 0.1, kind: "whoosh" },
  { t: 1.2, kind: "shimmer" },
];

/* ───────────────────────── Tape Rush ───────────────────────── */

function tapeRush(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 0 });
  const portrait = h > w;
  const short = Math.min(w, h);
  const ex = exitOf(sc);
  const P = switchPlan(scene, sc.beat, { start: 0.45 });
  const words = cycleWords(scene, 6);
  const land = P.land;
  const tapeH = short * (portrait ? 0.09 : 0.11);
  const tapes = [
    { y: h * (portrait ? 0.28 : 0.24), angle: -0.1, color: palette.primary, dir: -1, v: w * 2.6 },
    { y: h * (portrait ? 0.68 : 0.72), angle: 0.08, color: palette.secondary, dir: 1, v: w * 2.2 },
  ];
  const unit = `${words.map((x) => x.toUpperCase()).join("  ✦  ")}  ✦  `;
  tapes.forEach((tp, i) => {
    // Each tape snaps in from off-frame, races, then brakes to a crawl as the line lands.
    const enter = ease.outExpo(range(t, 0.05 + i * 0.08, 0.45 + i * 0.08));
    const len = Math.hypot(w, h) * 1.3;
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    ctx.translate(w / 2 + tp.dir * (1 - enter) * w * 1.2, tp.y);
    ctx.rotate(tp.angle);
    ctx.fillStyle = tp.color;
    ctx.fillRect(-len / 2, -tapeH / 2, len, tapeH);
    ctx.fillStyle = rgba("#000000", 0.18);
    ctx.fillRect(-len / 2, -tapeH / 2, len, Math.max(1, 2 * u));
    ctx.fillRect(-len / 2, tapeH / 2 - Math.max(1, 2 * u), len, Math.max(1, 2 * u));
    ctx.beginPath();
    ctx.rect(-len / 2, -tapeH / 2, len, tapeH);
    ctx.clip();
    const size = tapeH * 0.52;
    ctx.font = subFont(size, 800);
    ctx.letterSpacing = `${(size * 0.12).toFixed(1)}px`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const dy = capShift(ctx);
    const uw = ctx.measureText(unit).width;
    const pos = braked(t, tp.v, w * 0.08, 0.2, land + 0.2);
    const off = ((((tp.dir * pos) % uw) + uw) % uw) - uw - len / 2;
    ctx.fillStyle = textOn(sc);
    for (let x = off; x < len / 2; x += uw) ctx.fillText(unit, x, dy);
    ctx.restore();
  });
  // Between the tapes: the features punch in one per tick, then the line lands.
  const cy = h * 0.47;
  if (t >= P.start && t < land) {
    const i = Math.floor((t - P.start) / P.tick);
    const local = t - (P.start + i * P.tick);
    const size = fitWord(sc, P.words[i], faceOf(sc), tokens(w, h).safe.width * 0.8, short * 0.18);
    const pk = ease.outExpo(clamp(local / (P.tick * 0.5)));
    ctx.save();
    ctx.translate(w / 2, cy);
    ctx.scale(lerp(1.2, 1, pk), lerp(1.2, 1, pk));
    ctx.font = faceOf(sc)(size);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.text;
    ctx.globalAlpha = 1 - ex;
    ctx.fillText(P.words[i], 0, capShift(ctx));
    ctx.restore();
  }
  landHeadline(sc, land, cy, { maxSize: short * (portrait ? 0.15 : 0.13), sub: !portrait });
  if (portrait) subLine(sc, cy + short * 0.22, range(t, land + 0.25, land + 0.7) * (1 - ex));
}

const tapeSfx = (raw: Scene, beat: number): SfxCue[] => {
  const P = switchPlan(fastScene(raw), beat, { start: 0.45 });
  return [{ t: 0.05, kind: "whoosh" }, ...P.words.slice(0, 6).map((_, i) => ({ t: P.start + i * P.tick, kind: "tick" as const })), { t: P.land, kind: "pop" }];
};

/* ───────────────────────── Registry ───────────────────────── */

export const speedSkills: Skill[] = [
  {
    id: "whip-pan",
    name: "Whip Pan",
    tagline: "Words whip across the frame with a directional smear, one pushing the last out, until the line pans in and holds.",
    bestFor: "Momentum: 3–6 short features (items) whipping past before the headline. Great straight after the reveal.",
    sample: { text: "Keep work *moving*", items: ["Plan", "Build", "Ship", "Grow"] },
    itemsHint: "3–6 short features",
    render: whipPan,
    sfx: whipSfx,
  },
  {
    id: "stack-stomp",
    name: "Stack Stomp",
    tagline: "The line drops in word by word into a tight justified stack, the words squashing on impact and kicking the stack.",
    bestFor: "A punchy line of 3–6 words set as a poster stack ('Built to *ship* together'). No items needed.",
    sample: { text: "Built to *ship* together" },
    render: stackStomp,
    sfx: stompSfx,
  },
  {
    id: "speed-ticker",
    name: "Speed Ticker",
    tagline: "Rows of type race past in opposite directions and brake together; the centre row stops dead on the line.",
    bestFor: "Range and speed: 3–6 short features (items) on the racing rows, the headline in the middle. Bold opener.",
    sample: { text: "Keep work *in motion*", items: ["Plan", "Build", "Review", "Ship"] },
    itemsHint: "3–6 short features",
    render: speedTicker,
    sfx: tickerSfx,
  },
  {
    id: "cube-spin",
    name: "Cube Spin",
    tagline: "A panel rolls like a cube on the tick, a new feature on the next face, until the line arrives on the last face.",
    bestFor: "Switching through 3–5 short features (items) before the headline, with a tactile 3D roll.",
    sample: { text: "Ideas *in motion*", items: ["Sketch", "Prototype", "Launch"] },
    itemsHint: "3–5 short features",
    render: cubeSpin,
    sfx: cubeSfx,
  },
  {
    id: "speed-type",
    name: "Speed Type",
    tagline: "The last word of the line is typed at speed, selected and typed over, until it is the right word and the caret rests.",
    bestFor: "Lines that complete with one word: 'Built for *makers*' with items as the words it types first (features or audiences).",
    sample: { text: "Built for *makers*", items: ["Teams", "Startups", "Agencies"] },
    itemsHint: "2–4 short features or audiences it types first",
    render: speedType,
    sfx: typeSfx,
  },
  {
    id: "bar-wipe",
    name: "Bar Wipe",
    tagline: "A brand-colour bar sweeps over a word and pulls back on the next, alternating direction, then leaves a rule under the line.",
    bestFor: "Clean, fast switching through 3–5 short features (items) before the headline. Editorial and corporate friendly.",
    sample: { text: "Cut to *the point*", items: ["Clear", "Calm", "Focused"] },
    itemsHint: "3–5 short features",
    render: barWipe,
    sfx: barSfx,
  },
  {
    id: "crash-zoom",
    name: "Crash Zoom",
    tagline: "A word arrives from the distance, then the camera crashes through a letter's hollow straight into the next word.",
    bestFor: "High-energy hooks: 3–5 short features (items) zoomed through before the headline lands.",
    sample: { text: "Zoom *into the work*", items: ["Docs", "Boards", "Goals"] },
    itemsHint: "3–5 short features",
    render: crashZoom,
    sfx: crashSfx,
  },
  {
    id: "word-grid",
    name: "Word Grid",
    tagline: "A grid of the features lights up in a fast snake chase, then folds into the centre as the line punches in.",
    bestFor: "Breadth: 4–6 short features (items) filling a grid before the headline. Feature-rich products.",
    sample: { text: "Your tools, *one place*", items: ["Docs", "Tasks", "Chat", "Goals", "Wikis", "Forms"] },
    itemsHint: "4–6 short features",
    render: wordGrid,
    sfx: gridSfx,
  },
  {
    id: "orbit-text",
    name: "Orbit Text",
    tagline: "The features spin round the headline on two counter-rotating rings that brake as the line lands in the middle.",
    bestFor: "A short headline (2–5 words) circled by 3–6 short features (items). Platform and ecosystem stories.",
    sample: { text: "Around *your work*", items: ["Plan", "Track", "Share", "Review"] },
    itemsHint: "3–6 short features",
    render: orbitText,
    sfx: orbitSfx,
  },
  {
    id: "tape-rush",
    name: "Tape Rush",
    tagline: "Two tapes of type snap across the frame and race in opposite directions while the features punch in between, then the line lands.",
    bestFor: "Loud launches and drops: 3–6 short features (items) on the tapes, the headline between them.",
    sample: { text: "Now *live*", items: ["New", "Simple", "Shared", "Yours"] },
    itemsHint: "3–6 short features",
    render: tapeRush,
    sfx: tapeSfx,
  },
];
