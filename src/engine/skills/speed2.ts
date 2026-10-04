/**
 * Speed animations, round two: ten more high-speed slides in the vocabulary of promo spots.
 * Same rules as fast type and the first speed set: words switch about every half-beat to beat,
 * the headline then holds for at least ~45% of the scene (switchPlan), sound cues land on the
 * switches, and nothing flashes the whole frame (colour changes stay word-, tick- and band-sized).
 *
 * - Jump Cut: each word in three hard camera jumps (wide, medium, close-up in outline).
 * - Letter Rush: letters fly in from the frame's edges and snap into the word, then burst past the camera.
 * - Stamp Rush: the features are stamped around the frame one per tick, then the line stamps in.
 * - Rally: words ping-pong between two paddles, squashing on each hit, until the line is served.
 * - Spiral In: words spiral in from the edge of the frame and out past the camera.
 * - Speed Gauge: a needle whips round a dial, a feature in the readout on each step, to the redline.
 * - Domino: letters tip over in a chain as the next word's letters stand up behind them.
 * - Slipstream: words race along an S-curve with long echo trails, the line rides it to the centre.
 * - Stretch Snap: words yank sideways into a thin streak and the next snaps in with a spring.
 * - Rack Focus: words at different depths come sharp in turn as the focus racks between them.
 */
import { exitT } from "../fx";
import { tokens } from "../grid";
import { clamp, ease, hashString, lerp, range, rgba } from "../math";
import { saasBackground, saasFont, spring } from "../saasfx";
import { capShift, displayFont } from "../text";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { accentWords } from "./editorial";
import { drawLaid, fastScene, fitWord, kick, landHeadline, layWords, streaks, subLine, switchPlan, type Laid } from "./fastype";

const faceOf = (sc: SkillContext) => (s: number) => displayFont(saasFont(sc), s);
const exitOf = (sc: SkillContext) => ease.inCubic(exitT(sc, 0.35));
const DEG = Math.PI / 180;

/** A gradient fill across a box for the brand's accent. */
function brandFill(sc: SkillContext, x: number, y: number, w: number, h: number) {
  const g = sc.ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, sc.palette.primary);
  g.addColorStop(1, sc.palette.secondary);
  return g;
}

/** The headline laid out the way landHeadline lays it, so a custom entrance can hand over to it seamlessly. */
function laidLine(sc: SkillContext, fallback: string): Laid {
  const { w, h } = sc;
  const portrait = h > w;
  const scene = fastScene(sc.scene);
  return layWords(sc, accentWords(scene.text || fallback), tokens(w, h).safe.width * 0.92, Math.min(w, h) * (portrait ? 0.19 : 0.17), portrait ? 3 : 2);
}

type Glyph = { ch: string; x: number; y: number; w: number; accent: boolean; box: { x: number; w: number } };

/** Each letter of a laid headline at the exact place drawLaid would put it (left edge, middle line). */
function glyphsOf(sc: SkillContext, laid: Laid, cx: number, cy: number): Glyph[] {
  const { ctx } = sc;
  ctx.save();
  ctx.font = laid.face(laid.size);
  ctx.letterSpacing = `${(laid.track * laid.size).toFixed(2)}px`;
  const space = ctx.measureText(" ").width;
  const top = cy - ((laid.lines.length - 1) * laid.lh) / 2;
  const out: Glyph[] = [];
  laid.lines.forEach((line, li) => {
    let x = cx - line.w / 2;
    const y = top + li * laid.lh;
    for (const wd of line.words) {
      const ww = ctx.measureText(wd.w).width;
      const chars = Array.from(wd.w);
      let prefix = "";
      for (const ch of chars) {
        const at = ctx.measureText(prefix).width;
        out.push({ ch, x: x + at, y, w: ctx.measureText(ch).width, accent: !!wd.a, box: { x, w: ww } });
        prefix += ch;
      }
      x += ww + space;
    }
  });
  ctx.restore();
  return out;
}

/** Set the laid headline's font on the context (for drawing its glyphs one by one). */
function useLaidFont(sc: SkillContext, laid: Laid) {
  sc.ctx.font = laid.face(laid.size);
  sc.ctx.letterSpacing = `${(laid.track * laid.size).toFixed(2)}px`;
  sc.ctx.textAlign = "left";
  sc.ctx.textBaseline = "middle";
}

/** One word, centred on the origin of the current transform. */
function drawWord(sc: SkillContext, text: string, size: number, opts: { color?: string | CanvasGradient; outline?: boolean; hairline?: boolean } = {}) {
  const { ctx, palette } = sc;
  ctx.font = faceOf(sc)(size);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const dy = capShift(ctx);
  if (opts.outline) {
    ctx.strokeStyle = (opts.color as string) ?? palette.text;
    ctx.lineWidth = Math.max(opts.hairline ? 1.5 : 2, size * (opts.hairline ? 0.011 : 0.022));
    ctx.lineJoin = "round";
    ctx.strokeText(text, 0, dy);
  } else {
    ctx.fillStyle = opts.color ?? palette.text;
    ctx.fillText(text, 0, dy);
  }
}

/** Seeded 0..1 values for a slot. */
const rand = (sc: SkillContext, key: string) => {
  const hsh = hashString(`${sc.seed}:${key}`);
  return [(hsh % 997) / 997, ((hsh >>> 10) % 991) / 991, ((hsh >>> 20) % 983) / 983] as const;
};

/** Cues on each switch, capped so a long list doesn't turn into a drum roll. */
function switchCues(raw: Scene, beat: number, per: number, kind: SfxCue["kind"], land: SfxCue["kind"] = "pop", max = 6): SfxCue[] {
  const P = switchPlan(fastScene(raw), beat, { per });
  return [...P.words.slice(0, max).map((_, i) => ({ t: P.start + i * P.tick, kind })), { t: P.land, kind: land }];
}

/* ───────────────────────── Jump Cut ───────────────────────── */

const JUMP_PER = 1.8;

function jumpCut(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const P = switchPlan(scene, sc.beat, { per: JUMP_PER, max: 4 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const cy = h * 0.47;
  const face = faceOf(sc);
  const i = Math.floor((t - P.start) / P.tick);
  if (t >= P.start && i < P.words.length) {
    const local = (t - P.start - i * P.tick) / P.tick;
    // Three hard jumps per word: wide, medium, close-up (the close-up in outline, so the frame's
    // brightness hardly moves while the type fills it).
    const j = Math.min(2, Math.floor(local * 3));
    const since = (local * 3 - j) * (P.tick / 3);
    const word = P.words[i].toUpperCase();
    const base = fitWord(sc, word, face, safe.width * 0.5, short * 0.17);
    const scale = [1, 1.4, h > w ? 1.65 : 1.8][j] * (1 + 0.07 * (1 - ease.outExpo(clamp(since / 0.09))));
    // Each jump punches toward a different part of the word.
    const anchor = [0, -0.16, 0.14][j];
    ctx.font = face(base);
    const ww = ctx.measureText(word).width;
    const kk = kick(sc, since, 5);
    ctx.save();
    ctx.translate(w / 2 + kk.x - anchor * ww * (scale - 1), cy + kk.y);
    ctx.scale(scale, scale);
    // The close-up is a hairline outline at reduced strength: big on screen, light on the eye.
    if (j === 2) ctx.globalAlpha *= 0.7;
    drawWord(sc, word, base, { color: j === 2 ? (i % 2 ? palette.primary : palette.text) : i % 2 ? brandFill(sc, -ww / 2, -base / 2, ww, base) : palette.text, outline: j === 2, hairline: j === 2 });
    ctx.restore();
    // Viewfinder corners snap tighter on each jump.
    const fw = Math.min(safe.width, ww * [1.25, 1.1, 0.95][j] + 60 * u);
    const fh = base * [1.5, 1.3, 1.15][j] + 30 * u;
    const arm = 26 * u;
    ctx.save();
    ctx.strokeStyle = rgba(palette.text, 0.55);
    ctx.lineWidth = 2 * u;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = w / 2 + (sx * fw) / 2;
      const y = cy + (sy * fh) / 2;
      ctx.beginPath();
      ctx.moveTo(x, y - sy * arm);
      ctx.lineTo(x, y);
      ctx.lineTo(x - sx * arm, y);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (t >= P.land) landHeadline(sc, P.land, cy, { from: 1.45 });
}

const jumpSfx = (raw: Scene, beat: number): SfxCue[] => {
  const P = switchPlan(fastScene(raw), beat, { per: JUMP_PER, max: 4 });
  const out: SfxCue[] = [];
  P.words.forEach((_, i) => {
    for (let j = 0; j < 3; j++) out.push({ t: P.start + i * P.tick + (j * P.tick) / 3, kind: j ? "tick" : "click" });
  });
  return [...out.slice(0, 12), { t: P.land, kind: "pop" }];
};

/* ───────────────────────── Letter Rush ───────────────────────── */

const RUSH_PER = 1.7;

/** A letter's flight in from its seeded start, 0 → 1, with a little swing on the way. */
function flight(sc: SkillContext, key: string, k: number, x: number, y: number) {
  const { w, h } = sc;
  const [a, b, c] = rand(sc, key);
  const ang = a * Math.PI * 2;
  const R = Math.hypot(w, h) * (0.45 + b * 0.25);
  const sx = w / 2 + Math.cos(ang) * R;
  const sy = h / 2 + Math.sin(ang) * R;
  const e = ease.outExpo(k);
  // A quadratic curve: the control point sits off to one side of the straight path.
  const mx = (sx + x) / 2 + (sy - y) * (c - 0.5) * 0.6;
  const my = (sy + y) / 2 - (sx - x) * (c - 0.5) * 0.6;
  const q = 1 - e;
  return { x: q * q * sx + 2 * q * e * mx + e * e * x, y: q * q * sy + 2 * q * e * my + e * e * y, rot: (c - 0.5) * 3 * (1 - e), s: lerp(1.9, 1, e) };
}

function letterRush(sc: SkillContext) {
  const { ctx, w, h, t, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const P = switchPlan(scene, sc.beat, { per: RUSH_PER, max: 5 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const cy = h * 0.47;
  const face = faceOf(sc);
  const fly = Math.min(0.26, P.tick * 1.1);
  const stagger = 0.014;
  let motion = 0;
  // The features: letters fly in, hold, then burst past the camera when the next word arrives.
  for (let i = 0; i < P.words.length; i++) {
    const at = P.start + i * P.tick;
    const next = P.start + (i + 1) * P.tick;
    if (t < at || t > next + 0.16) continue;
    const word = P.words[i];
    const size = fitWord(sc, word, face, safe.width * 0.8, short * 0.2);
    ctx.save();
    ctx.font = face(size);
    ctx.letterSpacing = "0px";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const dy = capShift(ctx);
    const ww = ctx.measureText(word).width;
    const chars = Array.from(word);
    let prefix = "";
    const burst = ease.inCubic(clamp((t - next) / 0.16));
    chars.forEach((ch, k) => {
      const gx = w / 2 - ww / 2 + ctx.measureText(prefix).width;
      prefix += ch;
      const cw = ctx.measureText(ch).width;
      const p = clamp((t - at - k * stagger) / fly);
      if (p <= 0) return;
      motion = Math.max(motion, 1 - p);
      const f = flight(sc, `rush:${i}:${k}`, p, gx + cw / 2, cy);
      // Bursting: each letter flies out from the centre and grows past the camera.
      const bx = (f.x - w / 2) * (1 + burst * 1.6) + w / 2;
      const by = (f.y - h / 2) * (1 + burst * 1.6) + h / 2;
      ctx.save();
      ctx.globalAlpha = clamp(p * 4) * (1 - burst);
      ctx.translate(bx, by);
      ctx.rotate(f.rot);
      ctx.scale(f.s * (1 + burst), f.s * (1 + burst));
      ctx.fillStyle = i % 2 ? palette.primary : palette.text;
      ctx.fillText(ch, -cw / 2, dy);
      ctx.restore();
    });
    ctx.restore();
  }
  // The line: its letters rush in to the exact places the held headline uses.
  const laid = laidLine(sc, "Made to *move*");
  const glyphs = glyphsOf(sc, laid, w / 2, cy);
  const settle = P.land + fly + glyphs.length * stagger * 0.6;
  if (t >= P.land && t < settle) {
    ctx.save();
    useLaidFont(sc, laid);
    const dy = capShift(ctx);
    glyphs.forEach((g, k) => {
      const p = clamp((t - P.land - k * stagger * 0.6) / fly);
      if (p <= 0) return;
      motion = Math.max(motion, 1 - p);
      const f = flight(sc, `rushline:${k}`, p, g.x + g.w / 2, g.y);
      ctx.save();
      ctx.globalAlpha = clamp(p * 4);
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.scale(f.s, f.s);
      ctx.fillStyle = g.accent ? brandFill(sc, g.box.x - f.x, -laid.size / 2, g.box.w, laid.size) : palette.text;
      ctx.fillText(g.ch, -g.w / 2, dy);
      ctx.restore();
    });
    ctx.restore();
  }
  streaks(sc, motion * 0.6, rgba(palette.text, 0.45), { count: 36 });
  if (t >= settle) landHeadline(sc, settle - 0.24, cy, { from: 1 });
}

const rushSfx = (raw: Scene, beat: number) => switchCues(raw, beat, RUSH_PER, "swoosh", "pop", 5);

/* ───────────────────────── Stamp Rush ───────────────────────── */

const STAMP_PER = 1.3;

function stampRush(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 0 });
  const P = switchPlan(scene, sc.beat, { per: STAMP_PER, max: 6 });
  const short = Math.min(w, h);
  const portrait = h > w;
  const cy = h * 0.48;
  const ex = exitOf(sc);
  // Stamps sit round the centre, where the line will land last.
  const slots = portrait
    ? [[0.3, 0.24, -7], [0.7, 0.3, 6], [0.32, 0.72, 5], [0.68, 0.78, -6], [0.5, 0.17, -3], [0.5, 0.86, 4]]
    : [[0.24, 0.27, -7], [0.76, 0.3, 6], [0.27, 0.73, 5], [0.74, 0.71, -6], [0.5, 0.18, -3], [0.5, 0.84, 4]];
  const landed = t >= P.land;
  const recede = ease.outCubic(range(t, P.land, P.land + 0.3));
  let lastHit = -1;
  P.words.forEach((word, i) => {
    const at = P.start + i * P.tick;
    if (t < at) return;
    const hit = at + 0.07;
    if (t >= hit) lastHit = hit;
    const [fx, fy, deg] = slots[i % slots.length];
    const k = clamp((t - at) / 0.07);
    const dt = t - hit;
    // Slams down from above the paper, then a short squash.
    const s = lerp(1.9, 1, ease.inCubic(k)) * (dt > 0 ? 1 - 0.08 * Math.exp(-dt * 22) * Math.cos(dt * 40) : 1) * (1 - 0.12 * recede);
    const size = Math.min(short * 0.075, (w * 0.34) / Math.max(4, word.length * 0.62));
    const label = word.toUpperCase();
    ctx.save();
    ctx.globalAlpha = clamp(k * 2) * (1 - 0.7 * recede) * (1 - ex);
    ctx.translate(fx * w, fy * h);
    ctx.rotate(deg * DEG);
    ctx.scale(s, s);
    ctx.font = faceOf(sc)(size);
    ctx.letterSpacing = `${(size * 0.06).toFixed(1)}px`;
    const tw = ctx.measureText(label).width;
    const bw = tw + size * 1.1;
    const bh = size * 1.7;
    // The stamp: a double-ruled box in the brand colour, the word inside.
    ctx.strokeStyle = i % 2 ? palette.secondary : palette.primary;
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 8 * u);
    ctx.stroke();
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.roundRect(-bw / 2 + 7 * u, -bh / 2 + 7 * u, bw - 14 * u, bh - 14 * u, 4 * u);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.text;
    ctx.fillText(label, 0, capShift(ctx));
    ctx.restore();
  });
  const kk = kick(sc, t - (landed ? P.land + 0.07 : lastHit), landed ? 8 : 5);
  ctx.save();
  ctx.translate(kk.x, kk.y);
  if (landed) landHeadline(sc, P.land, cy, { from: 1.7, maxSize: short * (portrait ? 0.16 : 0.14), sub: false });
  ctx.restore();
  if (landed) subLine(sc, cy + short * (portrait ? 0.2 : 0.14), range(t, P.land + 0.25, P.land + 0.7) * (1 - ex));
}

const stampSfx = (raw: Scene, beat: number): SfxCue[] => {
  const P = switchPlan(fastScene(raw), beat, { per: STAMP_PER, max: 6 });
  return [...P.words.map((_, i) => ({ t: P.start + i * P.tick + 0.07, kind: "pop" as const })), { t: P.land + 0.07, kind: "strike" }];
};

/* ───────────────────────── Rally ───────────────────────── */

const RALLY_PER = 1.5;

function rally(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 0 });
  const P = switchPlan(scene, sc.beat, { per: RALLY_PER, max: 6 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const cy = h * 0.47;
  const face = faceOf(sc);
  const ex = exitOf(sc);
  // Landscape plays left–right; portrait plays top–bottom, so the words stay big on a tall frame.
  const vertical = h > w;
  // Main axis (the shot's direction) and cross axis, mapped to the frame.
  const at = (m: number, c: number) => (vertical ? { x: c, y: m } : { x: m, y: c });
  const mid = vertical ? cy : w / 2;
  const crossMid = vertical ? w / 2 : cy;
  const travel = Math.min(0.2, P.tick * 0.62);
  const out = ease.inCubic(range(t, P.land, P.land + 0.25));
  const pad = vertical ? [safe.top + 18 * u, safe.top + safe.height - 18 * u] : [safe.left + 18 * u, safe.left + safe.width - 18 * u];
  const padLen = short * (vertical ? 0.34 : 0.24);
  const lane = [-0.13, 0.11, -0.06, 0.14, -0.11, 0.07];
  const crossOf = (i: number) => crossMid + lane[i % lane.length] * (vertical ? w * 0.6 : h);
  // Word i flies to side (i % 2 ? first : second) and rests against that paddle.
  const sideOf = (i: number) => (i % 2 ? 0 : 1);
  const nowIdx = clamp(Math.floor((t - P.start) / P.tick), 0, P.words.length - 1);
  ctx.save();
  ctx.globalAlpha = (1 - out) * clamp(t / 0.2) * (1 - ex);
  // The net: a dashed line across the middle.
  ctx.strokeStyle = rgba(palette.text, 0.14);
  ctx.lineWidth = 2 * u;
  ctx.setLineDash([10 * u, 12 * u]);
  ctx.beginPath();
  const n0 = at(mid, vertical ? safe.left : safe.top);
  const n1 = at(mid, vertical ? safe.left + safe.width : safe.top + safe.height);
  ctx.moveTo(n0.x, n0.y);
  ctx.lineTo(n1.x, n1.y);
  ctx.stroke();
  ctx.setLineDash([]);
  // The paddles track the word heading their way and bulge on each hit.
  for (const side of [0, 1]) {
    let target = crossMid;
    let hitAt = -1;
    for (let i = 0; i <= nowIdx; i++)
      if (sideOf(i) === side) {
        target = crossOf(i);
        hitAt = P.start + i * P.tick + travel;
      }
    const since = t - hitAt;
    const bulge = hitAt > 0 && since >= 0 ? Math.exp(-since * 16) : 0;
    const thick = (12 + 8 * bulge) * u;
    const m = pad[side] + (side ? 1 : -1) * out * 60 * u;
    const c = at(m, target);
    const [bw, bh] = vertical ? [padLen, thick] : [thick, padLen];
    ctx.fillStyle = brandFill(sc, c.x - bw / 2, c.y - bh / 2, bw, bh);
    ctx.beginPath();
    ctx.roundRect(c.x - bw / 2, c.y - bh / 2, bw, bh, thick / 2);
    ctx.fill();
  }
  ctx.restore();
  // The words: each served from where the last one rests.
  for (let i = 0; i < P.words.length; i++) {
    const start = P.start + i * P.tick;
    const next = P.start + (i + 1) * P.tick;
    if (t < start || t > next + travel) continue;
    const word = P.words[i];
    const size = fitWord(sc, word, face, vertical ? safe.width * 0.8 : w * 0.36, short * (vertical ? 0.19 : 0.17));
    ctx.font = face(size);
    // The word's extent along the shot: its width across, its cap height up and down.
    const ext = vertical ? size * 0.75 : ctx.measureText(word).width;
    const restM = (side: number) => (side ? pad[1] - 30 * u - ext / 2 : pad[0] + 30 * u + ext / 2);
    const fromM = i ? restM(sideOf(i - 1)) : mid;
    const toM = restM(sideOf(i));
    const fromC = i ? crossOf(i - 1) : crossMid;
    const k = clamp((t - start) / travel);
    const leave = clamp((t - next) / (travel * 0.7));
    const dt = t - start - travel;
    // Squash against the paddle on the hit.
    const sq = dt > 0 ? Math.exp(-dt * 20) * 0.2 : 0;
    const dir = toM > fromM ? 1 : -1;
    const posAt = (kk: number) => {
      const e = ease.outCubic(kk);
      return at(lerp(fromM, toM, e), lerp(fromC, crossOf(i), e));
    };
    for (let g = 3; g >= 1 && k < 1; g--) {
      const pg = posAt(clamp(k - g * 0.08));
      ctx.save();
      ctx.globalAlpha = 0.14 * (1 - g / 4) * (1 - ex);
      ctx.translate(pg.x, pg.y);
      drawWord(sc, word, size, { color: palette.primary });
      ctx.restore();
    }
    const pos = posAt(k);
    const shift = dir * (ext / 2) * sq;
    ctx.save();
    ctx.globalAlpha = (1 - leave) * (1 - ex);
    ctx.translate(pos.x + (vertical ? 0 : shift), pos.y + (vertical ? shift : 0));
    if (vertical) ctx.scale(1 + sq * 0.6, 1 - sq);
    else ctx.scale(1 - sq, 1 + sq * 0.6);
    drawWord(sc, word, size, { color: i % 2 ? palette.primary : palette.text });
    ctx.restore();
  }
  // The serve: the line lands in the middle as the paddles step back.
  if (t >= P.land) landHeadline(sc, P.land, cy, { from: 1.2 });
}

const rallySfx = (raw: Scene, beat: number): SfxCue[] => {
  const P = switchPlan(fastScene(raw), beat, { per: RALLY_PER, max: 6 });
  const travel = Math.min(0.2, P.tick * 0.62);
  return [...P.words.map((_, i) => ({ t: P.start + i * P.tick + travel, kind: "tick" as const })), { t: P.land, kind: "pop" }];
};

/* ───────────────────────── Spiral In ───────────────────────── */

const SPIRAL_PER = 1.6;

function spiralIn(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 0 });
  const P = switchPlan(scene, sc.beat, { per: SPIRAL_PER, max: 5 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const cy = h * 0.47;
  const face = faceOf(sc);
  const ex = exitOf(sc);
  const R0 = Math.hypot(w, h) * 0.42;
  const dur = Math.min(0.36, P.tick * 1.1);
  // Faint spiral arms turning behind, faster while words are in flight.
  const spin = t * 1.6 - 1.2 * ease.outCubic(range(t, P.land, P.land + 1));
  ctx.save();
  ctx.strokeStyle = rgba(palette.primary, palette.light ? 0.2 : 0.16);
  ctx.lineWidth = 2 * u;
  ctx.globalAlpha = (1 - ex) * (1 - 0.6 * range(t, P.land, P.land + 0.6));
  for (let a = 0; a < 6; a++) {
    ctx.beginPath();
    for (let s = 0; s <= 40; s++) {
      const q = s / 40;
      const r = R0 * 1.1 * q;
      const th = spin + a * (Math.PI / 3) + q * 3.2;
      const px = w / 2 + Math.cos(th) * r;
      const py = cy + Math.sin(th) * r;
      if (s) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
  const at = (i: number) => P.start + i * P.tick;
  for (let i = 0; i < P.words.length; i++) {
    if (t < at(i) || t > at(i + 1) + 0.15) continue;
    const word = P.words[i];
    const size = fitWord(sc, word, face, safe.width * 0.7, short * 0.19);
    const a0 = i * 2.2 + 0.6;
    // In: along the spiral to the centre, turning upright. Out: on past the camera, still turning.
    const pose = (tt: number) => {
      const k = clamp((tt - at(i)) / dur);
      const e = ease.outCubic(k);
      const out = ease.inCubic(clamp((tt - at(i + 1)) / 0.15));
      const r = R0 * Math.pow(1 - e, 1.3);
      const th = a0 + (1 - e) * 2.6;
      return { x: w / 2 + Math.cos(th) * r, y: cy + Math.sin(th) * r, rot: -(1 - e) * 1.4 + out * 0.9, s: lerp(0.45, 1, e) * (1 + out * 1.8), a: clamp(k * 3) * (1 - out) };
    };
    for (let g = 3; g >= 0; g--) {
      const pz = pose(t - g * 0.025);
      if (pz.a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = pz.a * (g ? 0.16 * (1 - g / 4) : 1) * (1 - ex);
      ctx.translate(pz.x, pz.y);
      ctx.rotate(pz.rot);
      ctx.scale(pz.s, pz.s);
      drawWord(sc, word, size, { color: g ? palette.primary : i % 2 ? palette.primary : palette.text });
      ctx.restore();
    }
  }
  // The line comes in from the distance, out of the vortex, once the last word has passed.
  if (t >= P.land + 0.12) landHeadline(sc, P.land + 0.12, cy, { from: 0.55 });
}

const spiralSfx = (raw: Scene, beat: number) => switchCues(raw, beat, SPIRAL_PER, "swoosh", "pop", 5);

/* ───────────────────────── Speed Gauge ───────────────────────── */

const GAUGE_PER = 1.5;
const SWEEP_FROM = 150 * DEG;
const SWEEP = 240 * DEG;

/** The needle's position 0..1: a whip with overshoot to each step, the redline at the line. */
function needleAt(t: number, steps: number[], times: number[]) {
  let v = 0;
  for (let i = 0; i < times.length; i++) {
    if (t < times[i]) break;
    const prev = i ? steps[i - 1] : 0;
    v = prev + (steps[i] - prev) * spring(t - times[i], 30, 11);
  }
  return v;
}

function speedGauge(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const P = switchPlan(scene, sc.beat, { per: GAUGE_PER, max: 6 });
  const short = Math.min(w, h);
  const portrait = h > w;
  const ex = exitOf(sc);
  const n = P.words.length;
  const times = [...P.words.map((_, i) => P.start + i * P.tick), P.land];
  const steps = [...P.words.map((_, i) => (0.25 + (0.6 * i) / Math.max(1, n - 1 || 1)) * (n > 1 ? 1 : 0.6)), 1];
  const v = needleAt(t, steps, times);
  const vPrev = needleAt(t - 1 / 30, steps, times);
  // After the redline the dial steps back and up, making room for the line.
  const back = ease.inOutCubic(range(t, P.land + 0.2, P.land + 0.6));
  const R = short * (portrait ? 0.34 : 0.3) * lerp(1, 0.55, back);
  const gx = w / 2;
  const gy = lerp(h * 0.52, h * (portrait ? 0.27 : 0.25), back);
  ctx.save();
  ctx.globalAlpha = clamp(t / 0.2) * (1 - ex) * (1 - 0.35 * back);
  ctx.lineCap = "round";
  // The track and the filled arc.
  ctx.lineWidth = R * 0.07;
  ctx.strokeStyle = rgba(palette.text, 0.1);
  ctx.beginPath();
  ctx.arc(gx, gy, R, SWEEP_FROM, SWEEP_FROM + SWEEP);
  ctx.stroke();
  const grad = ctx.createLinearGradient(gx - R, gy, gx + R, gy);
  grad.addColorStop(0, palette.primary);
  grad.addColorStop(1, palette.secondary);
  ctx.strokeStyle = grad;
  if (v > 0.002) {
    ctx.beginPath();
    ctx.arc(gx, gy, R, SWEEP_FROM, SWEEP_FROM + SWEEP * clamp(v, 0, 1.04));
    ctx.stroke();
  }
  // Ticks (no numbers: a dial, not a claim). The redline is the last stretch.
  for (let k = 0; k <= 40; k++) {
    const a = SWEEP_FROM + (SWEEP * k) / 40;
    const major = k % 5 === 0;
    const red = k >= 34;
    const r1 = R * 0.84;
    const r2 = R * (major ? 0.72 : 0.78);
    ctx.strokeStyle = red ? palette.secondary : rgba(palette.text, major ? 0.6 : 0.3);
    ctx.lineWidth = (major ? 3.5 : 2) * u * lerp(1, 0.7, back);
    ctx.beginPath();
    ctx.moveTo(gx + Math.cos(a) * r1, gy + Math.sin(a) * r1);
    ctx.lineTo(gx + Math.cos(a) * r2, gy + Math.sin(a) * r2);
    ctx.stroke();
  }
  // The needle, with a short motion trail while it whips.
  const drawNeedle = (val: number, alpha: number) => {
    const a = SWEEP_FROM + SWEEP * val;
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = palette.text;
    ctx.lineWidth = R * 0.035;
    ctx.beginPath();
    ctx.moveTo(gx - Math.cos(a) * R * 0.12, gy - Math.sin(a) * R * 0.12);
    ctx.lineTo(gx + Math.cos(a) * R * 0.8, gy + Math.sin(a) * R * 0.8);
    ctx.stroke();
    ctx.globalAlpha /= alpha;
  };
  const speed = Math.abs(v - vPrev);
  if (speed > 0.004) for (let g = 1; g <= 3; g++) drawNeedle(lerp(v, vPrev, g * 0.6), 0.16 * (1 - g / 4));
  drawNeedle(v, 1);
  ctx.fillStyle = palette.text;
  ctx.beginPath();
  ctx.arc(gx, gy, R * 0.07, 0, Math.PI * 2);
  ctx.fill();
  // The readout: the current feature, switching with each step.
  const idx = Math.floor((t - P.start) / P.tick);
  if (t >= P.start && idx < n) {
    const word = P.words[idx].toUpperCase();
    const since = t - P.start - idx * P.tick;
    const size = Math.min(R * 0.2, (R * 1.3) / Math.max(3, word.length * 0.62));
    ctx.save();
    ctx.translate(gx, gy + R * 0.42 + (1 - ease.outExpo(clamp(since / 0.1))) * R * 0.1);
    ctx.font = faceOf(sc)(size);
    ctx.letterSpacing = `${(size * 0.08).toFixed(1)}px`;
    const tw = ctx.measureText(word).width;
    ctx.fillStyle = rgba(palette.bg0, 0.7);
    ctx.strokeStyle = rgba(palette.primary, 0.7);
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.roundRect(-tw / 2 - size * 0.5, -size * 0.75, tw + size, size * 1.5, 6 * u);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.text;
    ctx.fillText(word, 0, capShift(ctx));
    ctx.restore();
  }
  ctx.restore();
  if (t >= P.land) {
    const kk = kick(sc, t - P.land, 7);
    ctx.save();
    ctx.translate(kk.x, kk.y);
    landHeadline(sc, P.land + 0.2, h * (portrait ? 0.58 : 0.62), { from: 1.3, maxSize: short * (portrait ? 0.16 : 0.14) });
    ctx.restore();
  }
}

const gaugeSfx = (raw: Scene, beat: number) => switchCues(raw, beat, GAUGE_PER, "tick", "strike", 6);

/* ───────────────────────── Domino ───────────────────────── */

const DOMINO_PER = 1.8;

function domino(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const P = switchPlan(scene, sc.beat, { per: DOMINO_PER, max: 5 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const cy = h * 0.47;
  const face = faceOf(sc);
  const ex = exitOf(sc);
  const tip = Math.min(0.13, P.tick * 0.5);
  const chain = (n: number) => Math.min(0.03, (P.tick * 0.55) / Math.max(1, n));
  // The floor the dominoes stand on.
  const floorK = ease.outExpo(range(t, 0.05, 0.3)) * (1 - ex);
  const words = P.words.map((x) => x.toUpperCase());
  const sizes = words.map((wd) => fitWord(sc, wd, face, safe.width * 0.72, short * 0.21));
  const floorY = cy + Math.max(...sizes, short * 0.1) * 0.36;
  ctx.save();
  ctx.fillStyle = brandFill(sc, w * 0.2, floorY, w * 0.6, 4 * u);
  ctx.globalAlpha = floorK * (1 - range(t, P.land, P.land + 0.3));
  const fw = safe.width * 0.8 * floorK;
  ctx.fillRect(w / 2 - fw / 2, floorY + 6 * u, fw, 3 * u);
  ctx.restore();
  for (let i = 0; i < words.length; i++) {
    const up = P.start + i * P.tick;
    const down = P.start + (i + 1) * P.tick;
    if (t < up) continue;
    const word = words[i];
    const size = sizes[i];
    const chars = Array.from(word);
    const gap = chain(chars.length);
    if (t > down + chars.length * gap + tip) continue;
    ctx.save();
    ctx.font = face(size);
    ctx.letterSpacing = "0px";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const ww = ctx.measureText(word).width;
    let prefix = "";
    chars.forEach((ch, k) => {
      const x = w / 2 - ww / 2 + ctx.measureText(prefix).width;
      prefix += ch;
      const cw = ctx.measureText(ch).width;
      // Stands up from lying left (pivot: bottom-left), tips over to the right (pivot: bottom-right).
      const rise = ease.outBack(clamp((t - up - k * gap) / tip));
      const fall = ease.inCubic(clamp((t - down - k * gap) / tip));
      if (rise <= 0) return;
      ctx.save();
      ctx.globalAlpha = clamp(rise * 3) * (1 - fall) * (1 - ex);
      if (fall > 0) {
        ctx.translate(x + cw, floorY);
        ctx.rotate(fall * 90 * DEG);
        ctx.translate(-cw, 0);
      } else {
        ctx.translate(x, floorY);
        ctx.rotate(-(1 - rise) * 90 * DEG);
      }
      ctx.fillStyle = i % 2 ? palette.primary : palette.text;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }
  // The line stands up letter by letter where the held headline sits, then holds.
  const laid = laidLine(sc, "Built to *last*");
  const glyphs = glyphsOf(sc, laid, w / 2, cy);
  const gap = Math.min(0.02, 0.5 / Math.max(1, glyphs.length));
  const settle = P.land + glyphs.length * gap + tip;
  if (t >= P.land && t < settle) {
    ctx.save();
    useLaidFont(sc, laid);
    const dy = capShift(ctx);
    const base = laid.size * 0.36;
    glyphs.forEach((g, k) => {
      const rise = ease.outBack(clamp((t - P.land - k * gap) / tip));
      if (rise <= 0) return;
      ctx.save();
      ctx.globalAlpha = clamp(rise * 3);
      ctx.translate(g.x, g.y + base);
      ctx.rotate(-(1 - rise) * 90 * DEG);
      ctx.fillStyle = g.accent ? brandFill(sc, g.box.x - g.x, -laid.size, g.box.w, laid.size) : palette.text;
      ctx.fillText(g.ch, 0, dy - base);
      ctx.restore();
    });
    ctx.restore();
  }
  if (t >= settle) landHeadline(sc, settle - 0.24, cy, { from: 1 });
}

const dominoSfx = (raw: Scene, beat: number) => switchCues(raw, beat, DOMINO_PER, "click", "pop", 5);

/* ───────────────────────── Slipstream ───────────────────────── */

const SLIP_PER = 1.2;

/** A point and heading on the S-curve through the frame, s in 0..1 (0.5 = the centre). */
function slipPath(w: number, h: number, cy: number, s: number) {
  const portrait = h > w;
  const p0 = [-0.25 * w, portrait ? 0.82 * h : 0.85 * h];
  const p1 = [0.45 * w, portrait ? 1.15 * h : 1.25 * h];
  const p2 = [0.55 * w, portrait ? -0.2 * h : -0.3 * h];
  const p3 = [1.25 * w, portrait ? 0.12 * h : 0.1 * h];
  const q = 1 - s;
  const x = q ** 3 * p0[0] + 3 * q * q * s * p1[0] + 3 * q * s * s * p2[0] + s ** 3 * p3[0];
  const y = q ** 3 * p0[1] + 3 * q * q * s * p1[1] + 3 * q * s * s * p2[1] + s ** 3 * p3[1];
  const dx = 3 * q * q * (p1[0] - p0[0]) + 6 * q * s * (p2[0] - p1[0]) + 3 * s * s * (p3[0] - p2[0]);
  const dy = 3 * q * q * (p1[1] - p0[1]) + 6 * q * s * (p2[1] - p1[1]) + 3 * s * s * (p3[1] - p2[1]);
  // The curve's middle runs through the headline's centre line.
  return { x, y: y + (cy - h * 0.475), ang: Math.atan2(dy, dx) };
}

/** Fast at the edges, slower through the middle, so each word reads as it passes. */
const slipEase = (q: number) => {
  const f = 2 * q - 1;
  return 0.5 + 0.5 * (0.3 * f + 0.7 * f * f * f);
};

function slipstream(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const P = switchPlan(scene, sc.beat, { per: SLIP_PER, max: 6 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const cy = h * 0.47;
  const face = faceOf(sc);
  const ex = exitOf(sc);
  const ride = Math.max(0.5, P.tick * 2.4);
  // The path, faintly, so the stream has a shape.
  ctx.save();
  ctx.strokeStyle = rgba(palette.primary, 0.16);
  ctx.lineWidth = 2 * u;
  ctx.globalAlpha = (1 - ex) * (1 - 0.7 * range(t, P.land, P.land + 0.6)) * clamp(t / 0.2);
  ctx.beginPath();
  for (let k = 0; k <= 60; k++) {
    const pt = slipPath(w, h, cy, k / 60);
    if (k) ctx.lineTo(pt.x, pt.y);
    else ctx.moveTo(pt.x, pt.y);
  }
  ctx.stroke();
  ctx.restore();
  // Words still on the path clear off as the line rides in.
  const clear = 1 - ease.inCubic(range(t, P.land - 0.04, P.land + 0.12));
  for (let i = 0; i < P.words.length; i++) {
    const at = P.start + i * P.tick;
    if (t < at || t > at + ride || clear <= 0) continue;
    const word = P.words[i];
    const size = fitWord(sc, word, face, safe.width * 0.5, short * 0.15);
    for (let g = 5; g >= 0; g--) {
      const q = clamp((t - at - g * 0.022) / ride);
      if (q <= 0 || q >= 1) continue;
      const s = slipEase(q);
      const pt = slipPath(w, h, cy, s);
      const near = 1 - Math.abs(s - 0.5) * 2;
      ctx.save();
      ctx.globalAlpha = (g ? 0.12 * (1 - g / 6) : 1) * (1 - ex) * clear;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(clamp(pt.ang, -0.45, 0.45) * (1 - near * 0.7));
      const sz = lerp(0.65, 1.05, near);
      ctx.scale(sz, sz);
      drawWord(sc, word, size, { color: g ? palette.primary : i % 2 ? palette.primary : palette.text });
      ctx.restore();
    }
  }
  // The line rides the first half of the curve and stops dead centre.
  const laid = laidLine(sc, "Stay in the *flow*");
  const arrive = 0.34;
  const settle = P.land + arrive;
  if (t >= P.land && t < settle) {
    for (let g = 4; g >= 0; g--) {
      const k = ease.outExpo(clamp((t - P.land - g * 0.02) / arrive));
      const pt = slipPath(w, h, cy, 0.5 * k);
      ctx.save();
      ctx.globalAlpha = (g ? 0.12 * (1 - g / 5) : clamp(k * 3)) * (1 - ex);
      ctx.translate(lerp(pt.x, w / 2, k), lerp(pt.y, cy, k));
      ctx.rotate(clamp(pt.ang, -0.45, 0.45) * (1 - k));
      drawLaid(sc, laid, 0, 0);
      ctx.restore();
    }
  }
  if (t >= settle) landHeadline(sc, settle - 0.24, cy, { from: 1 });
}

const slipSfx = (raw: Scene, beat: number) => switchCues(raw, beat, SLIP_PER, "swoosh", "pop", 6);

/* ───────────────────────── Stretch Snap ───────────────────────── */

const SNAP_PER = 1.4;

function stretchSnap(sc: SkillContext) {
  const { ctx, w, h, t, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const P = switchPlan(scene, sc.beat, { per: SNAP_PER, max: 6 });
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const cy = h * 0.47;
  const face = faceOf(sc);
  const ex = exitOf(sc);
  const yank = Math.min(0.12, P.tick * 0.5);
  let motion = 0;
  let dirNow: "left" | "right" = "left";
  for (let i = 0; i < P.words.length; i++) {
    const at = P.start + i * P.tick;
    const next = at + P.tick;
    if (t < at || t > next + yank) continue;
    const word = P.words[i];
    const size = fitWord(sc, word, face, safe.width * 0.78, short * 0.21);
    // In: from a thin vertical sliver, sprung wide. Out: yanked sideways into a streak.
    const sIn = spring(t - at, 26, 9);
    const out = ease.inExpo(clamp((t - next) / yank));
    const dir = i % 2 ? 1 : -1;
    if (out > 0) {
      motion = Math.max(motion, out);
      dirNow = dir > 0 ? "right" : "left";
    }
    const sx = Math.max(0.02, sIn) * (1 + out * 2.6);
    const sy = lerp(1.5, 1, clamp(sIn)) * (1 - out * 0.82);
    ctx.save();
    ctx.globalAlpha = clamp((t - at) / 0.04) * (1 - out) * (1 - ex);
    ctx.translate(w / 2 + dir * out * w * 0.35, cy);
    ctx.scale(sx, sy);
    drawWord(sc, word, size, { color: i % 2 ? palette.primary : palette.text });
    ctx.restore();
  }
  streaks(sc, motion * 0.6 * (1 - ex), rgba(palette.text, 0.45), { dir: dirNow, count: 32 });
  // The line snaps in the same way, then holds.
  const laid = laidLine(sc, "Snap *into place*");
  const settle = P.land + 0.5;
  if (t >= P.land && t < settle) {
    const sIn = spring(t - P.land, 24, 9);
    ctx.save();
    ctx.globalAlpha = clamp((t - P.land) / 0.04) * (1 - ex);
    ctx.translate(w / 2, cy);
    ctx.scale(Math.max(0.02, sIn), lerp(1.4, 1, clamp(sIn)));
    drawLaid(sc, laid, 0, 0);
    ctx.restore();
  }
  if (t >= settle) landHeadline(sc, settle - 0.24, cy, { from: 1 });
}

const snapSfx = (raw: Scene, beat: number) => switchCues(raw, beat, SNAP_PER, "pop", "pop", 6);

/* ───────────────────────── Rack Focus ───────────────────────── */

const RACK_PER = 1.5;

function rackFocus(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  const scene = fastScene(sc.scene);
  saasBackground(sc, { beams: 1 });
  const P = switchPlan(scene, sc.beat, { per: RACK_PER, max: 5 });
  const short = Math.min(w, h);
  const portrait = h > w;
  const cy = h * 0.47;
  const face = faceOf(sc);
  const ex = exitOf(sc);
  const n = P.words.length;
  // Words set at different depths (nearer = bigger), spread round the frame.
  const spots = portrait
    ? [[0.5, 0.25, 1.05], [0.5, 0.72, 0.8], [0.5, 0.4, 0.9], [0.5, 0.58, 1.1], [0.5, 0.86, 0.75]]
    : [[0.3, 0.33, 1.05], [0.7, 0.62, 0.85], [0.36, 0.72, 0.8], [0.68, 0.3, 0.95], [0.5, 0.5, 1.1]];
  const rack = Math.min(0.12, P.tick * 0.45);
  // Focus: racks quickly to word i at its tick, then (at the line) past all of them.
  let focus = 0;
  for (let i = 1; i < n; i++) focus += ease.inOutCubic(clamp((t - P.start - i * P.tick) / rack));
  const pull = ease.inOutCubic(range(t, P.land - 0.05, P.land + 0.25));
  focus += pull * 1.6;
  // The camera drifts toward whichever word is sharp.
  const f0 = Math.min(n - 1, Math.floor(focus));
  const f1 = Math.min(n - 1, f0 + 1);
  const ff = clamp(focus - f0);
  const camX = lerp(spots[f0 % spots.length][0], spots[f1 % spots.length][0], ff);
  const camY = lerp(spots[f0 % spots.length][1], spots[f1 % spots.length][1], ff);
  ctx.save();
  ctx.translate((0.5 - camX) * w * 0.18 * (1 - pull), (0.5 - camY) * h * 0.18 * (1 - pull));
  for (let i = 0; i < n; i++) {
    const at = P.start + i * P.tick;
    if (t < at - rack) continue;
    const [fx, fy, z] = spots[i % spots.length];
    const word = P.words[i];
    const size = fitWord(sc, word, face, w * (portrait ? 0.8 : 0.42) * z, short * 0.18 * z);
    const off = Math.abs(i - focus);
    const blur = Math.min(16, off * 10) * u;
    ctx.save();
    ctx.globalAlpha = clamp((t - at + rack) / rack) * (1 - 0.6 * clamp(off)) * (1 - pull) * (1 - ex);
    if (blur > 0.4) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    ctx.translate(fx * w, fy * h);
    ctx.scale(1 + pull * 0.25, 1 + pull * 0.25);
    drawWord(sc, word, size, { color: i % 2 ? palette.primary : palette.text });
    ctx.filter = "none";
    ctx.restore();
  }
  ctx.restore();
  // Focus lands on the line, in front of them all.
  if (t >= P.land) landHeadline(sc, P.land + 0.08, cy, { from: 1.1 });
}

const rackSfx = (raw: Scene, beat: number) => switchCues(raw, beat, RACK_PER, "tick", "pop", 5);

/* ───────────────────────── Registry ───────────────────────── */

export const speedMoreSkills: Skill[] = [
  {
    id: "jump-cut",
    name: "Jump Cut",
    tagline: "Each feature in three hard camera jumps, wide, medium and a close-up in outline, inside snapping viewfinder corners, then the line punches in.",
    bestFor: "Punchy hooks: 2–4 one-word features (items) hit in jump cuts before the headline. Loud launches and promos.",
    sample: { text: "The *details* count", items: ["Plan", "Draft", "Launch"] },
    itemsHint: "2–4 one-word features",
    render: jumpCut,
    sfx: jumpSfx,
  },
  {
    id: "letter-rush",
    name: "Letter Rush",
    tagline: "Letters fly in from the edges of the frame and snap into each feature, burst past the camera on the next, and the line's letters rush into place.",
    bestFor: "Energy with craft: 3–5 short features (items) assembled letter by letter before the headline.",
    sample: { text: "Made to *move*", items: ["Plan", "Build", "Ship"] },
    itemsHint: "3–5 short features",
    render: letterRush,
    sfx: rushSfx,
  },
  {
    id: "stamp-rush",
    name: "Stamp Rush",
    tagline: "The features are stamped round the frame one per tick, each with a kick, then the line stamps down in the middle.",
    bestFor: "Workflows and checklists: 3–6 short steps or features (items) stamped before the headline.",
    sample: { text: "Signed, sealed, *shipped*", items: ["Draft", "Review", "Share", "Done"] },
    itemsHint: "3–6 short features",
    render: stampRush,
    sfx: stampSfx,
  },
  {
    id: "rally",
    name: "Rally",
    tagline: "The features ping-pong between two brand-colour paddles, squashing on each hit, until the line is served into the middle.",
    bestFor: "Back-and-forth stories (teams, chat, review, handoff): 3–6 short features (items) rallied before the headline.",
    sample: { text: "Back and forth, *together*", items: ["Ask", "Answer", "Review", "Merge"] },
    itemsHint: "3–6 short features",
    render: rally,
    sfx: rallySfx,
  },
  {
    id: "spiral-in",
    name: "Spiral In",
    tagline: "The features spiral in from the edge of the frame over turning spiral arms and fly out past the camera, then the line arrives from the distance.",
    bestFor: "Hypnotic momentum: 3–5 short features (items) pulled into the centre before the headline.",
    sample: { text: "Pulled into *focus*", items: ["Ideas", "Tasks", "Goals"] },
    itemsHint: "3–5 short features",
    render: spiralIn,
    sfx: spiralSfx,
  },
  {
    id: "speed-gauge",
    name: "Speed Gauge",
    tagline: "A needle whips round a dial step by step, a feature in the readout at each step, hits the redline, and the line lands below.",
    bestFor: "Momentum and progress stories: 3–6 short features or steps (items) on the readout. The dial has no numbers, so it makes no claims.",
    sample: { text: "Shift *up a gear*", items: ["Load", "Sync", "Search", "Deploy"] },
    itemsHint: "3–6 short features",
    render: speedGauge,
    sfx: gaugeSfx,
  },
  {
    id: "domino",
    name: "Domino",
    tagline: "Each feature's letters stand up in a chain and tip over like dominoes as the next word rises, until the line stands up and holds.",
    bestFor: "Chain reactions and workflows: 3–5 short features (items), one triggering the next, before the headline.",
    sample: { text: "One step *leads to the next*", items: ["Trigger", "Route", "Notify"] },
    itemsHint: "3–5 short features",
    render: domino,
    sfx: dominoSfx,
  },
  {
    id: "slipstream",
    name: "Slipstream",
    tagline: "The features race along an S-curve with long echo trails, slowing as they pass the middle, then the line rides in and stops dead centre.",
    bestFor: "Flow and pipelines: 3–6 short features (items) streaming through before the headline.",
    sample: { text: "Stay in the *flow*", items: ["Capture", "Sort", "Share", "Done"] },
    itemsHint: "3–6 short features",
    render: slipstream,
    sfx: slipSfx,
  },
  {
    id: "stretch-snap",
    name: "Stretch Snap",
    tagline: "Each feature is yanked sideways into a thin streak and the next snaps in on a spring, until the line snaps into place.",
    bestFor: "Playful, elastic energy: 3–6 short features (items) snapping before the headline. Consumer and creative tools.",
    sample: { text: "Snap *into place*", items: ["Drag", "Drop", "Done"] },
    itemsHint: "3–6 short features",
    render: stretchSnap,
    sfx: snapSfx,
  },
  {
    id: "rack-focus",
    name: "Rack Focus",
    tagline: "The features sit at different depths and come sharp in turn as the focus racks between them, then focus pulls to the line in front.",
    bestFor: "Clarity and focus stories: 3–5 short features (items) racked through before the headline. Cinematic but fast.",
    sample: { text: "Bring the work *into focus*", items: ["Goals", "Plans", "Results"] },
    itemsHint: "3–5 short features",
    render: rackFocus,
    sfx: rackSfx,
  },
];
