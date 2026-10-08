/**
 * Clean logo intros: flat, minimal brand reveals in the motion-design tradition (the logo stings
 * agencies make in After Effects), as a calm counterpart to the 3D set. Any logo works: the
 * imported logo (wordmarks included), the site's app icon, or the generated brand mark. Each one
 * resolves a beat after the score's drop (the drop lands mid-build), then holds with a slow
 * push-in while the name comes in.
 *
 * - logo-draw:   the logo's outline draws itself on like a pen stroke, then the logo fills in from
 *                the centre and the outline ripples away.
 * - logo-wipe:   a brand-colour bar sweeps across and pulls back to uncover the logo, which slides
 *                aside as the name slides out from behind it (a lock-up).
 * - logo-pop:    a dot pulses, bursts into a ring and the logo pops in with an overshoot, dashes
 *                and confetti shapes flying out; the name's letters pop in one by one.
 * - logo-morph:  a dot drops in and bounces, stretches into a rounded tile and the tile becomes
 *                the logo.
 * - logo-slices: horizontal slices of the logo slide in from alternate sides and lock together.
 * - logo-dots:   a grid of dots in the logo's own colours pops in a wave from the centre, then the
 *                dots merge into the solid logo.
 * - logo-type:   a caret blinks, the logo pops in beside it and the name types itself out.
 * - logo-shapes: a circle, a square and a triangle fly in, orbit one another and collapse into the
 *                logo with a ring ripple.
 *
 * Flat colour, generous space, one idea per sting: no light rays, no flashes, no shaking. Every
 * frame is a pure function of time, so preview, seek and export match.
 */
import { revealHit } from "../arrange";
import { exitT, headline, drawLayout, subline } from "../fx";
import { clamp, ease, lerp, mixHex, range, rgba, rng, TAU } from "../math";
import { saasBackground, saasFont, spring } from "../saasfx";
import { displayFont, layoutChars, subFont } from "../text";
import type { Scene, SfxCue, Skill, SkillContext, SkillId } from "../types";
import { markOf, tint, type Mark } from "./logo3d";

/* ───────────────────────── Layout ───────────────────────── */

type Lay = { m: Mark; mw: number; mh: number; cx: number; cy: number; named: boolean; nameY: number; short: number; portrait: boolean };

/** Where the mark sits: centred with room to breathe, a little high when the name goes under it. */
function lay(sc: SkillContext): Lay {
  const { w, h } = sc;
  const m = markOf(sc);
  const portrait = h > w;
  const short = Math.min(w, h);
  const named = !m.wide && !!sc.scene.text?.replace(/\*/g, "").trim();
  const box = short * (named ? 0.26 : 0.3);
  let mw = m.ar >= 1 ? Math.min(box * m.ar, w * (portrait ? 0.74 : 0.5)) : box * m.ar;
  let mh = mw / m.ar;
  if (mh > box) {
    mh = box;
    mw = mh * m.ar;
  }
  const cy = h * (named ? 0.43 : 0.5);
  return { m, mw, mh, cx: w / 2, cy, named, nameY: cy + mh / 2 + short * 0.11, short, portrait };
}

/**
 * When the logo resolves: a beat or so after the score's drop (revealHit), so the build has time to
 * read. The drop lands mid-build, on its most visible move (the dot landing, the bar covering).
 */
const landAt = (d: number, beat: number) => Math.min(d * 0.42, revealHit(d, beat) + 0.85);
const hitOf = (sc: SkillContext) => landAt(sc.d, sc.beat);
const exitOf = (sc: SkillContext) => ease.inOutCubic(exitT(sc, 0.5));
/** After landing, a slow push-in keeps the hold alive. */
const hold = (sc: SkillContext, hit: number) => 1 + 0.035 * ease.inOutCubic(range(sc.t, hit + 0.2, sc.d));

function drawMark(sc: SkillContext, L: Lay, opts: { x?: number; y?: number; scale?: number; rot?: number; alpha?: number } = {}) {
  const { ctx } = sc;
  const a = opts.alpha ?? 1;
  const s = opts.scale ?? 1;
  if (a <= 0.003 || s <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(opts.x ?? L.cx, opts.y ?? L.cy);
  if (opts.rot) ctx.rotate(opts.rot);
  ctx.scale(s, s);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(L.m.src, -L.mw / 2, -L.mh / 2, L.mw, L.mh);
  ctx.restore();
}

/** The accent colours of the flat shapes: the brand's own. */
function inks(sc: SkillContext) {
  const p = sc.palette;
  const lift = (c: string) => (p.light ? c : mixHex(c, "#ffffff", 0.12));
  return [lift(p.primary), lift(p.secondary), lift(p.accent ?? mixHex(p.primary, p.secondary, 0.5))];
}

/** The name rising from behind a line under the mark, then the tagline. */
function nameRise(sc: SkillContext, L: Lay, start: number, ex: number) {
  if (!L.named) {
    subline(sc, L.cy + L.mh / 2 + L.short * 0.09, range(sc.t, start + 0.2, start + 0.9), { alpha: 1 - ex });
    return;
  }
  const { ctx, w, t, u, palette } = sc;
  const k = ease.outExpo(range(t, start, start + 0.8));
  if (k <= 0) return;
  const layout = headline(sc, { cy: L.nameY, sizeFrac: 0.09, maxLines: 1, natural: true, font: saasFont(sc), widthFrac: 0.8 });
  ctx.save();
  ctx.globalAlpha *= 1 - ex;
  ctx.beginPath();
  ctx.rect(0, L.nameY - layout.size * 0.75, w, layout.size * 1.5);
  ctx.clip();
  ctx.translate(0, (1 - k) * layout.size * 1.2);
  ctx.fillStyle = palette.text;
  drawLayout(sc, layout);
  ctx.restore();
  subline(sc, L.nameY + layout.size * 0.5 + 34 * u, range(t, start + 0.35, start + 1), { alpha: 1 - ex });
}

/** A horizontal lock-up: the mark on the left, the name on its right (when it fits). */
function lockup(sc: SkillContext, L: Lay) {
  const { ctx, w } = sc;
  const name = (sc.scene.text ?? "").replace(/\*/g, "").trim();
  const font = saasFont(sc);
  let size = L.mh * 0.56;
  ctx.font = displayFont(font, size);
  let tw = ctx.measureText(name).width;
  const gap = L.mh * 0.3;
  const room = w * (L.portrait ? 0.86 : 0.74) - L.mw - gap;
  if (tw > room) {
    size *= room / tw;
    tw = room;
  }
  const fits = L.named && size >= L.mh * 0.3;
  const total = L.mw + gap + tw;
  const mx = w / 2 - total / 2 + L.mw / 2;
  return { fits, size, tw, gap, mx, tx: mx + L.mw / 2 + gap, name, font };
}

/** The tagline under a lock-up's name, left-aligned with it. */
function lockupTagline(sc: SkillContext, L: Lay, x: number, y: number, k: number, ex: number) {
  const text = (sc.scene.subtext ?? "").toUpperCase();
  if (!text || k <= 0) return;
  const { ctx, u, palette } = sc;
  ctx.save();
  ctx.globalAlpha *= k * (1 - ex) * 0.72;
  const size = Math.min(26 * u, L.mh * 0.17);
  ctx.font = subFont(size, 600);
  ctx.letterSpacing = `${Math.round(size * 0.24)}px`;
  ctx.fillStyle = palette.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + (1 - k) * 10 * u);
  ctx.restore();
}

/* ───────────────────────── Line Draw ───────────────────────── */

const outlines = new Map<string, HTMLCanvasElement>();
/** The mark's outline as a thin line (around its edges and its holes), cached. */
function outlineOf(m: Mark, color: string) {
  const key = `${m.key}|${color}|${m.src.width}`;
  let c = outlines.get(key);
  if (!c) {
    if (outlines.size > 24) outlines.clear();
    const f = Math.min(1, 640 / Math.max(m.src.width, m.src.height));
    const w0 = Math.max(1, Math.round(m.src.width * f));
    const h0 = Math.max(1, Math.round(m.src.height * f));
    const r = Math.max(2.5, Math.max(w0, h0) * 0.009);
    const pad = Math.ceil(r + 2);
    c = document.createElement("canvas");
    c.width = w0 + pad * 2;
    c.height = h0 + pad * 2;
    const g = c.getContext("2d")!;
    const sil = tint(m, color);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      g.drawImage(sil, pad + Math.cos(a) * r, pad + Math.sin(a) * r, w0, h0);
    }
    g.globalCompositeOperation = "destination-out";
    g.drawImage(sil, pad, pad, w0, h0);
    outlines.set(key, c);
  }
  return c;
}

function logoDraw(sc: SkillContext) {
  const { ctx, t, palette } = sc;
  saasBackground(sc, { beams: 0 });
  const L = lay(sc);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const line = palette.light ? palette.primary : mixHex(palette.primary, "#ffffff", 0.35);
  const ol = outlineOf(L.m, line);
  const padX = (ol.width / Math.max(L.m.src.width, 1)) * L.mw;
  const padY = (ol.height / Math.max(L.m.src.height, 1)) * L.mh;
  // The pen: the outline revealed by a clock sweep from the top.
  const draw = ease.inOutCubic(range(t, 0.12, hit - 0.3));
  const fill = ease.outCubic(range(t, hit - 0.38, hit));
  const after = range(t, hit, hit + 0.7);
  const push = hold(sc, hit);
  ctx.save();
  ctx.globalAlpha *= 1 - ex;
  ctx.translate(L.cx, L.cy);
  ctx.scale(push, push);
  ctx.translate(-L.cx, -L.cy);
  if (draw > 0 && after < 1) {
    ctx.save();
    // After the hit the outline ripples outward and fades.
    const grow = 1 + 0.12 * ease.outCubic(after);
    ctx.globalAlpha *= 1 - ease.outCubic(after);
    ctx.translate(L.cx, L.cy);
    ctx.scale(grow, grow);
    ctx.translate(-L.cx, -L.cy);
    if (draw < 1) {
      const R = Math.hypot(padX, padY);
      ctx.beginPath();
      ctx.moveTo(L.cx, L.cy);
      ctx.arc(L.cx, L.cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * draw);
      ctx.closePath();
      ctx.clip();
    }
    if (!palette.light) {
      ctx.shadowColor = rgba(line, 0.6);
      ctx.shadowBlur = L.short * 0.012;
    }
    ctx.drawImage(ol, L.cx - padX / 2, L.cy - padY / 2, padX, padY);
    ctx.restore();
  }
  // The fill: an iris from the centre, settling with a little overshoot.
  if (fill > 0) {
    ctx.save();
    if (fill < 1) {
      ctx.beginPath();
      ctx.arc(L.cx, L.cy, Math.hypot(L.mw, L.mh) * 0.55 * fill, 0, TAU);
      ctx.clip();
    }
    const settle = t < hit ? 1 : 1 + 0.04 * Math.sin(range(t, hit, hit + 0.45) * Math.PI) * (1 - range(t, hit, hit + 0.45));
    drawMark(sc, L, { scale: settle });
    ctx.restore();
  }
  ctx.restore();
  nameRise(sc, L, hit + 0.15, ex);
}

/* ───────────────────────── Wipe Lock-up ───────────────────────── */

function logoWipe(sc: SkillContext) {
  const { ctx, t, u, palette } = sc;
  saasBackground(sc, { beams: 0 });
  const L = lay(sc);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const lk = lockup(sc, L);
  // After the hit, the mark slides aside to make room for the name (a lock-up), when it fits.
  const side = lk.fits ? ease.inOutCubic(range(t, hit + 0.25, hit + 0.95)) : 0;
  const mx = lerp(L.cx, lk.mx, side);
  const push = hold(sc, hit);
  const bar = inks(sc)[0];
  const bx = L.cx - L.mw / 2 - L.mh * 0.08;
  const bw = L.mw + L.mh * 0.16;
  const by = L.cy - L.mh / 2 - L.mh * 0.08;
  const bh = L.mh * 1.16;
  const grow = ease.inOutExpo(range(t, 0.2, hit - 0.42));
  const pull = ease.inOutExpo(range(t, hit - 0.42, hit));
  ctx.save();
  ctx.globalAlpha *= 1 - ex;
  ctx.translate(L.cx, L.cy);
  ctx.scale(push, push);
  ctx.translate(-L.cx, -L.cy);
  // The mark, uncovered where the bar has passed.
  if (pull > 0) {
    ctx.save();
    if (pull < 1) {
      ctx.beginPath();
      ctx.rect(bx - 2 * u, by - 2 * u, bw * pull + 4 * u, bh + 4 * u);
      ctx.clip();
    }
    drawMark(sc, L, { x: mx });
    ctx.restore();
  }
  // The bar: grows from the left, then pulls back to the right.
  if (grow > 0 && pull < 1) {
    const x0 = bx + bw * pull;
    const x1 = bx + bw * grow;
    ctx.fillStyle = bar;
    ctx.fillRect(x0, by, Math.max(0, x1 - x0), bh);
  }
  // The name slides out from behind the mark.
  if (lk.fits && side > 0) {
    const nk = ease.outExpo(range(t, hit + 0.45, hit + 1.25));
    const right = mx + L.mw / 2 + lk.gap * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.rect(right, L.cy - L.mh, sc.w, L.mh * 2);
    ctx.clip();
    ctx.font = displayFont(lk.font, lk.size);
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const ny = sc.scene.subtext ? L.cy - L.mh * 0.12 : L.cy;
    ctx.fillText(lk.name, lk.tx - (1 - nk) * (lk.tw + lk.gap), ny);
    ctx.restore();
    lockupTagline(sc, L, lk.tx, L.cy + L.mh * 0.3, ease.outCubic(range(t, hit + 0.95, hit + 1.5)), 0);
  }
  ctx.restore();
  if (!lk.fits) nameRise(sc, L, hit + 0.2, ex);
}

/* ───────────────────────── Pop & Burst ───────────────────────── */

function logoPop(sc: SkillContext) {
  const { ctx, t, u, palette, seed } = sc;
  saasBackground(sc, { beams: 0 });
  const L = lay(sc);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const [c0, c1, c2] = inks(sc);
  const R = Math.max(L.mw, L.mh) * 0.5;
  const push = hold(sc, hit);
  ctx.save();
  ctx.globalAlpha *= 1 - ex;
  ctx.translate(L.cx, L.cy);
  ctx.scale(push, push);
  // A dot pops in and swells with the build…
  if (t < hit) {
    const k = clamp(spring(t - 0.15, 14, 7), 0, 1.1);
    const swell = 1 + 0.5 * ease.inCubic(range(t, hit * 0.35, hit - 0.12));
    const gone = ease.inCubic(range(t, hit - 0.12, hit));
    const r = L.short * 0.035 * k * swell * (1 - gone);
    if (r > 0) {
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
    }
  }
  // …and bursts into a ring as the logo pops in.
  const ring = range(t, hit - 0.12, hit + 0.55);
  if (ring > 0 && ring < 1) {
    const e = ease.outCubic(ring);
    ctx.strokeStyle = c1;
    ctx.globalAlpha *= 1;
    ctx.lineWidth = Math.max(1, L.short * 0.012 * (1 - e));
    ctx.beginPath();
    ctx.arc(0, 0, R * (0.3 + 1.1 * e), 0, TAU);
    ctx.stroke();
  }
  // Dashes radiate out and draw off.
  const dash = range(t, hit, hit + 0.6);
  if (dash > 0 && dash < 1) {
    const n = 10;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1.5, L.short * 0.007);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - Math.PI / 2 + (Math.PI / n) * 0.5;
      const head = R * (1.05 + 0.55 * ease.outCubic(dash));
      const tail = R * (1.05 + 0.55 * ease.inCubic(dash));
      ctx.strokeStyle = i % 2 ? c0 : c2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * tail, Math.sin(a) * tail);
      ctx.lineTo(Math.cos(a) * head, Math.sin(a) * head);
      ctx.stroke();
    }
  }
  // Confetti shapes fly out and settle into a slow drift.
  const r = rng(seed ^ 0x51ab);
  for (let i = 0; i < 9; i++) {
    // (Kept off the name below: the lower half of the circle folds up.)
    let a = r() * TAU;
    if (L.named && Math.sin(a) > 0.25) a = -a;
    const dist = R * (1.5 + r() * 0.9);
    const k = ease.outCubic(range(t, hit + 0.02 * i, hit + 0.7 + 0.02 * i));
    if (k <= 0) continue;
    const drift = (t - hit) * 6 * u;
    const x = Math.cos(a) * dist * k;
    const y = Math.sin(a) * dist * k - drift;
    const s = L.short * (0.01 + r() * 0.012) * (1 - 0.25 * k);
    ctx.save();
    ctx.globalAlpha *= 0.85 * (1 - 0.4 * range(t, hit + 1.2, sc.d));
    ctx.translate(x, y);
    ctx.rotate(a + k * 2);
    ctx.fillStyle = [c0, c1, c2][i % 3];
    ctx.beginPath();
    if (i % 3 === 0) ctx.arc(0, 0, s, 0, TAU);
    else if (i % 3 === 1) ctx.rect(-s, -s, s * 2, s * 2);
    else {
      ctx.moveTo(0, -s * 1.2);
      ctx.lineTo(s * 1.1, s * 0.8);
      ctx.lineTo(-s * 1.1, s * 0.8);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }
  // The logo pops in with an overshoot.
  const pop = range(t, hit - 0.06, hit + 0.42);
  if (pop > 0) {
    const s = ease.outBack(pop, 2.2);
    drawMark(sc, L, { x: 0, y: 0, scale: s, rot: (1 - Math.min(1, s)) * -0.25 });
  }
  ctx.restore();
  // The name's letters pop in one by one.
  if (!L.named) {
    subline(sc, L.cy + L.mh / 2 + L.short * 0.09, range(t, hit + 0.4, hit + 1.1), { alpha: 1 - ex });
    return;
  }
  const layout = headline(sc, { cy: L.nameY, sizeFrac: 0.09, maxLines: 1, natural: true, font: saasFont(sc), widthFrac: 0.8 });
  const chars = layoutChars(ctx, layout.lines[0] ?? "", sc.w / 2, layout.tracking);
  ctx.save();
  ctx.globalAlpha *= 1 - ex;
  ctx.fillStyle = palette.text;
  ctx.textAlign = "center";
  chars.forEach((ch, i) => {
    const k = range(t, hit + 0.25 + i * 0.04, hit + 0.6 + i * 0.04);
    if (k <= 0) return;
    const s = ease.outBack(k, 2);
    ctx.save();
    ctx.translate(ch.x, L.nameY + layout.size * 0.35);
    ctx.scale(s, s);
    ctx.fillText(ch.char, 0, -layout.size * 0.35);
    ctx.restore();
  });
  ctx.restore();
  subline(sc, L.nameY + layout.size * 0.5 + 34 * u, range(t, hit + 0.7, hit + 1.3), { alpha: 1 - ex });
}

/* ───────────────────────── Dot Morph ───────────────────────── */

function logoMorph(sc: SkillContext) {
  const { ctx, t, h } = sc;
  saasBackground(sc, { beams: 0 });
  const L = lay(sc);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const ink = inks(sc)[0];
  const r0 = L.short * 0.028;
  const push = hold(sc, hit);
  // The dot drops in from above, squashes on landing and bounces once.
  const f = hit / 1.35;
  const drop = range(t, 0.08 * f, 0.42 * f);
  const bounce = range(t, 0.42 * f, 0.68 * f);
  let y = L.cy;
  let sx = 1;
  let sy = 1;
  if (drop < 1) {
    y = lerp(-r0 * 2 - h * 0.1, L.cy, ease.inQuad(drop));
    sy = 1 + 0.35 * ease.inQuad(drop);
    sx = 1 / sy;
  } else if (bounce < 1) {
    y = L.cy - Math.sin(bounce * Math.PI) * L.short * 0.06 * (1 - bounce * 0.4);
    const squash = Math.max(0, 1 - bounce * 6);
    sx = 1 + 0.45 * squash;
    sy = 1 - 0.35 * squash;
  }
  // Then it stretches into a rounded tile the size of the logo.
  const grow = ease.outExpo(range(t, 0.68 * f, hit - 0.3 * f));
  const tw = lerp(r0 * 2 * sx, L.mw * 1.04, grow);
  const th = lerp(r0 * 2 * sy, L.mh * 1.04, ease.outExpo(range(t, 0.75 * f, hit - 0.28 * f)));
  const rad = lerp(r0 * Math.min(sx, sy), Math.min(L.mw, L.mh) * 0.24, grow);
  const swap = ease.inOutCubic(range(t, hit - 0.3 * f, hit));
  ctx.save();
  ctx.globalAlpha *= 1 - ex;
  ctx.translate(L.cx, L.cy);
  ctx.scale(push, push);
  ctx.translate(-L.cx, -L.cy);
  if (t > 0.08 * f && swap < 1) {
    ctx.save();
    ctx.globalAlpha *= 1 - swap;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.roundRect(L.cx - tw / 2, y - th / 2, tw, th, Math.min(rad, tw / 2, th / 2));
    ctx.fill();
    ctx.restore();
  }
  // The tile becomes the logo.
  if (swap > 0) drawMark(sc, L, { alpha: swap, scale: lerp(0.94, 1, ease.outBack(swap, 1.6)) });
  ctx.restore();
  nameRise(sc, L, hit + 0.12, ex);
}

/* ───────────────────────── Slice Build ───────────────────────── */

function logoSlices(sc: SkillContext) {
  const { ctx, t, w, palette } = sc;
  saasBackground(sc, { beams: 0 });
  const L = lay(sc);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const n = 7;
  const src = L.m.src;
  const push = hold(sc, hit);
  const ink = inks(sc)[0];
  ctx.save();
  ctx.globalAlpha *= 1 - ex;
  ctx.translate(L.cx, L.cy);
  ctx.scale(push, push);
  ctx.translate(-L.cx, -L.cy);
  for (let i = 0; i < n; i++) {
    const order = [3, 2, 4, 1, 5, 0, 6][i];
    const start = hit - 1.0 + order * 0.07;
    const k = range(t, start, start + 0.62);
    if (k <= 0) continue;
    const e = ease.outExpo(k);
    const dir = i % 2 ? 1 : -1;
    const off = dir * w * 0.55 * (1 - e);
    const y0 = (i / n) * L.mh;
    const sh = L.mh / n;
    const sy0 = (i / n) * src.height;
    const sh0 = src.height / n;
    const x = L.cx - L.mw / 2 + off;
    const y = L.cy - L.mh / 2 + y0;
    // A motion trail in the brand colour behind the slice while it travels.
    const speed = 1 - e;
    if (speed > 0.02) {
      const len = Math.min(w * 0.3, Math.abs(off) * 0.8);
      const tx = dir > 0 ? x + L.mw : x - len;
      const g = ctx.createLinearGradient(tx, 0, tx + len, 0);
      g.addColorStop(dir > 0 ? 0 : 1, rgba(ink, 0.55 * speed));
      g.addColorStop(dir > 0 ? 1 : 0, rgba(ink, 0));
      ctx.fillStyle = g;
      ctx.fillRect(tx, y + sh * 0.3, len, sh * 0.4);
    }
    ctx.save();
    ctx.globalAlpha *= clamp(k * 4);
    ctx.drawImage(src, 0, sy0, src.width, sh0 + 0.5, x, y, L.mw, sh + 0.6);
    ctx.restore();
  }
  // A thin rule draws out under the logo as it locks.
  const rule = ease.outExpo(range(t, hit - 0.05, hit + 0.6)) * (1 - ease.inCubic(range(t, hit + 1.4, hit + 2.2)));
  if (rule > 0) {
    const rw = L.mw * 0.9 * rule;
    ctx.fillStyle = palette.light ? ink : rgba(ink, 0.9);
    ctx.fillRect(L.cx - rw / 2, L.cy + L.mh / 2 + L.short * 0.03, rw, Math.max(1.5, L.short * 0.004));
  }
  ctx.restore();
  nameRise(sc, L, hit + 0.2, ex);
}

/* ───────────────────────── Dot Grid ───────────────────────── */

type Dot = { x: number; y: number; color: string; d: number };
const dotSets = new Map<string, { dots: Dot[]; cols: number; rows: number }>();
/** The mark sampled into a grid of dots in its own colours (cached); a tile shape when the pixels can't be read. */
function dotsOf(m: Mark, fallback: string) {
  const cols = Math.round(clamp(24 * Math.sqrt(m.ar), 18, 44));
  const rows = Math.max(6, Math.round(cols / m.ar));
  const key = `${m.key}|${m.src.width}|${cols}|${fallback}`;
  let set = dotSets.get(key);
  if (!set) {
    if (dotSets.size > 16) dotSets.clear();
    const dots: Dot[] = [];
    let data: Uint8ClampedArray | null = null;
    try {
      const c = document.createElement("canvas");
      c.width = cols;
      c.height = rows;
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(m.src, 0, 0, cols, rows);
      data = g.getImageData(0, 0, cols, rows).data;
    } catch {
      data = null;
    }
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const fx = (x + 0.5) / cols;
        const fy = (y + 0.5) / rows;
        let color = fallback;
        if (data) {
          const i = (y * cols + x) * 4;
          if (data[i + 3] < 110) continue;
          color = `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`;
        } else if (Math.hypot((fx - 0.5) * m.ar, fy - 0.5) > 0.5 * Math.max(1, m.ar) * 0.95) continue;
        dots.push({ x: fx, y: fy, color, d: Math.hypot((fx - 0.5) * m.ar, fy - 0.5) });
      }
    const maxD = Math.max(0.001, ...dots.map((d) => d.d));
    for (const d of dots) d.d /= maxD;
    set = { dots, cols, rows };
    dotSets.set(key, set);
  }
  return set;
}

function logoDots(sc: SkillContext) {
  const { ctx, t } = sc;
  saasBackground(sc, { beams: 0 });
  const L = lay(sc);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const set = dotsOf(L.m, inks(sc)[0]);
  const cell = L.mw / set.cols;
  const merge = ease.inOutCubic(range(t, hit - 0.3, hit + 0.08));
  const push = hold(sc, hit);
  const wave = Math.max(0.6, hit - 0.55);
  ctx.save();
  ctx.globalAlpha *= 1 - ex;
  ctx.translate(L.cx, L.cy);
  ctx.scale(push, push);
  ctx.translate(-L.cx, -L.cy);
  if (merge < 1) {
    ctx.save();
    ctx.globalAlpha *= 1 - merge;
    for (const d of set.dots) {
      const k = clamp(spring(t - 0.15 - d.d * wave * 0.75, 15, 8), 0, 1.15);
      if (k <= 0) continue;
      // The dots grow into squares as they merge.
      const r = cell * lerp(0.36, 0.56, merge) * k;
      const x = L.cx - L.mw / 2 + d.x * L.mw;
      const y = L.cy - L.mh / 2 + d.y * L.mh;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.roundRect(x - r, y - r, r * 2, r * 2, r * (1 - merge * 0.85));
      ctx.fill();
    }
    ctx.restore();
  }
  if (merge > 0) drawMark(sc, L, { alpha: merge, scale: lerp(1.02, 1, merge) });
  ctx.restore();
  nameRise(sc, L, hit + 0.15, ex);
}

/* ───────────────────────── Type Lock-up ───────────────────────── */

function logoType(sc: SkillContext) {
  const { ctx, t, u, palette } = sc;
  saasBackground(sc, { beams: 0 });
  const L = lay(sc);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const lk = lockup(sc, L);
  const ink = inks(sc)[0];
  const push = hold(sc, hit);
  ctx.save();
  ctx.globalAlpha *= 1 - ex;
  ctx.translate(sc.w / 2, L.cy);
  ctx.scale(push, push);
  ctx.translate(-sc.w / 2, -L.cy);
  if (lk.fits) {
    // The caret waits where the name will go; the logo pops in beside it; the name types out.
    const pop = range(t, hit - 0.5, hit);
    if (pop > 0) drawMark(sc, L, { x: lk.mx, scale: ease.outBack(pop, 1.8) });
    const chars = [...lk.name];
    const per = Math.min(0.08, 0.9 / Math.max(1, chars.length));
    const typed = clamp(Math.floor((t - hit - 0.1) / per) + 1, 0, chars.length);
    ctx.font = displayFont(lk.font, lk.size);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const ny = sc.scene.subtext ? L.cy - L.mh * 0.12 : L.cy;
    const shown = chars.slice(0, typed).join("");
    ctx.fillStyle = palette.text;
    ctx.fillText(shown, lk.tx, ny);
    const cx = lk.tx + ctx.measureText(shown).width + lk.size * 0.06;
    const typing = typed > 0 && typed < chars.length;
    const done = t - (hit + 0.1 + chars.length * per);
    // The caret: steady while typing, a slow blink while waiting (never a flash).
    const blink = typing ? 1 : 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 0.9);
    const fade = done > 0 ? 1 - ease.inCubic(range(done, 0.8, 1.3)) : 1;
    const caretK = clamp((t - 0.15) / 0.2) * fade;
    if (caretK > 0) {
      ctx.fillStyle = ink;
      ctx.globalAlpha *= caretK * blink;
      ctx.fillRect(cx, ny - lk.size * 0.42, Math.max(2, lk.size * 0.07), lk.size * 0.84);
    }
    ctx.restore();
    lockupTagline(sc, L, lk.tx, L.cy + L.mh * 0.3, ease.outCubic(range(done, 0.1, 0.6)), ex);
    return;
  }
  // A wordmark (or no room for a lock-up): the logo typed on left to right behind a caret.
  const k = ease.inOutCubic(range(t, hit - 0.8, hit));
  const x0 = L.cx - L.mw / 2;
  if (k > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - 4 * u, L.cy - L.mh, L.mw * k + 4 * u, L.mh * 2);
    ctx.clip();
    drawMark(sc, L);
    ctx.restore();
  }
  const caret = 1 - ease.inCubic(range(t, hit + 0.4, hit + 0.9));
  if (caret > 0 && t > 0.15) {
    ctx.fillStyle = ink;
    ctx.globalAlpha *= caret * (k > 0 && k < 1 ? 1 : 0.5 + 0.5 * Math.cos(t * Math.PI * 1.8));
    ctx.fillRect(x0 + L.mw * k + 6 * u, L.cy - L.mh * 0.48, Math.max(2, L.mh * 0.06), L.mh * 0.96);
  }
  ctx.restore();
  nameRise(sc, L, hit + 0.2, ex);
}

/* ───────────────────────── Shape Assemble ───────────────────────── */

function logoShapes(sc: SkillContext) {
  const { ctx, t, w, h, palette } = sc;
  saasBackground(sc, { beams: 0 });
  const L = lay(sc);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const cols = inks(sc);
  const R = Math.max(L.mw, L.mh) * 0.5;
  const s0 = L.short * 0.075;
  const push = hold(sc, hit);
  const from = [
    { x: -w * 0.65, y: -h * 0.1 },
    { x: w * 0.65, y: -h * 0.45 },
    { x: w * 0.1, y: h * 0.7 },
  ];
  ctx.save();
  ctx.globalAlpha *= 1 - ex;
  ctx.translate(L.cx, L.cy);
  ctx.scale(push, push);
  if (t < hit) {
    for (let i = 0; i < 3; i++) {
      // Fly in to a triangle round the centre, orbit inwards, then collapse.
      const f = hit / 1.35;
      const fly = ease.outExpo(range(t, (0.05 + i * 0.08) * f, (0.6 + i * 0.08) * f));
      if (fly <= 0) continue;
      const orbit = ease.inOutCubic(range(t, 0.62 * f, hit - 0.12));
      const ang = -Math.PI / 2 + (i / 3) * TAU + orbit * Math.PI * 1.3;
      const rr = R * 0.75 * (1 - orbit * 0.9);
      const hx = Math.cos(ang) * rr;
      const hy = Math.sin(ang) * rr;
      const x = lerp(from[i].x, hx, fly);
      const y = lerp(from[i].y, hy, fly);
      const shrink = 1 - ease.inCubic(range(t, hit - 0.2, hit));
      const s = s0 * (1 - 0.35 * orbit) * shrink;
      if (s <= 0.5) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((1 - fly) * (i % 2 ? 2.4 : -2.4) + orbit * 1.5);
      ctx.fillStyle = cols[i];
      ctx.globalAlpha *= palette.light ? 0.95 : 0.92;
      ctx.beginPath();
      if (i === 0) ctx.arc(0, 0, s, 0, TAU);
      else if (i === 1) ctx.roundRect(-s, -s, s * 2, s * 2, s * 0.25);
      else {
        ctx.moveTo(0, -s * 1.15);
        ctx.lineTo(s * 1.1, s * 0.8);
        ctx.lineTo(-s * 1.1, s * 0.8);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }
  }
  // The ripple and the logo popping out of the collapse.
  const ripple = range(t, hit - 0.04, hit + 0.7);
  if (ripple > 0 && ripple < 1) {
    const e = ease.outCubic(ripple);
    ctx.strokeStyle = cols[0];
    ctx.lineWidth = Math.max(1, L.short * 0.008 * (1 - e));
    ctx.beginPath();
    ctx.arc(0, 0, R * (0.4 + 1.0 * e), 0, TAU);
    ctx.stroke();
  }
  const pop = range(t, hit - 0.05, hit + 0.4);
  if (pop > 0) drawMark(sc, L, { x: 0, y: 0, scale: ease.outBack(pop, 1.9) });
  ctx.restore();
  nameRise(sc, L, hit + 0.18, ex);
}

/* ───────────────────────── Registry ───────────────────────── */

const cleanSfx = (raw: Scene, beat: number): SfxCue[] => {
  const hit = landAt(raw.duration, beat);
  return [
    { t: 0.05, kind: "whoosh" },
    { t: hit, kind: "pop" },
    { t: hit + 0.4, kind: "shimmer" },
  ];
};
const typeSfx = (raw: Scene, beat: number): SfxCue[] => {
  const hit = landAt(raw.duration, beat);
  const name = (raw.text ?? "").replace(/\*/g, "").trim();
  const per = Math.min(0.08, 0.9 / Math.max(1, name.length));
  const keys = Array.from({ length: Math.min(name.length, 10) }, (_, i) => ({ t: hit + 0.1 + i * per * Math.max(1, name.length / 10), kind: "click" as const }));
  return [{ t: hit, kind: "pop" }, ...keys];
};

const BEST = "The brand reveal, clean and flat: the logo (or app icon, or a generated mark) landing on the drop, with the name. Headline = brand name (left off for a wordmark logo). Light, minimal and editorial styles.";
const SAMPLE = { text: "ACME", subtext: "Build something new" };

export const logoCleanSkills: Skill[] = [
  { id: "logo-draw", name: "Line Draw", tagline: "The logo's outline draws itself on like a pen stroke, then the logo fills in from the centre on the drop and the outline ripples away.", bestFor: BEST, sample: SAMPLE, render: logoDraw, sfx: cleanSfx },
  { id: "logo-wipe", name: "Wipe Lock-up", tagline: "A brand-colour bar sweeps across and pulls back to uncover the logo, which slides aside as the name slides out from behind it.", bestFor: BEST, sample: SAMPLE, render: logoWipe, sfx: cleanSfx },
  { id: "logo-pop", name: "Pop & Burst", tagline: "A dot swells, bursts into a ring and the logo pops in with an overshoot, dashes and confetti shapes flying out; the name's letters pop in one by one.", bestFor: BEST, sample: SAMPLE, render: logoPop, sfx: cleanSfx },
  { id: "logo-morph", name: "Dot Morph", tagline: "A dot drops in and bounces, stretches into a rounded tile in the brand colour, and the tile becomes the logo.", bestFor: BEST, sample: SAMPLE, render: logoMorph, sfx: cleanSfx },
  { id: "logo-slices", name: "Slice Build", tagline: "Horizontal slices of the logo slide in from alternate sides with brand-colour trails and lock together over a thin rule.", bestFor: BEST, sample: SAMPLE, render: logoSlices, sfx: cleanSfx },
  { id: "logo-dots", name: "Dot Grid", tagline: "A grid of dots in the logo's own colours pops in a wave from the centre, then the dots merge into the solid logo.", bestFor: BEST, sample: SAMPLE, render: logoDots, sfx: cleanSfx },
  { id: "logo-type", name: "Type Lock-up", tagline: "A caret blinks, the logo pops in beside it and the name types itself out next to it, the tagline settling underneath.", bestFor: BEST, sample: SAMPLE, render: logoType, sfx: typeSfx },
  { id: "logo-shapes", name: "Shape Assemble", tagline: "A circle, a square and a triangle in the brand colours fly in, orbit one another and collapse into the logo with a ring ripple.", bestFor: BEST, sample: SAMPLE, render: logoShapes, sfx: cleanSfx },
];

export const LOGO_CLEAN_IDS = new Set<SkillId>(logoCleanSkills.map((s) => s.id));
