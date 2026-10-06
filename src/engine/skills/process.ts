/**
 * Business process and services slides: how a company works and what it offers. Each is staged
 * in the product's own palette under the scene's headline (topHeadline, through stage()), with
 * generic, claim-free sample copy. Items read "Title — short detail".
 *
 * - process-chevrons: the consulting-deck process: arrow-shaped chevrons in a row (a column in
 *                     vertical frames) work like tabs: each fills with the brand gradient and lifts
 *                     as it becomes active, and the active step's name appears large under them,
 *                     animated, with its detail, so the viewer knows which step is being told.
 * - process-cycle:    how a business works as a loop: steps sit around a ring, a glowing head runs
 *                     the ring from step to step and closes the loop, the current step in the centre.
 * - step-stairs:      a 3D staircase rises from the floor, a marker hops up it stair by stair, each
 *                     stair numbered and named, and a flag lands on the top step.
 * - services:         what a company offers: a large circle shows the current service's icon, big,
 *                     beside the list of services; the highlight moves down the list, the icon swaps
 *                     and a ring around the circle counts down each service's turn.
 *
 * Every frame is a pure function of time, so preview, seek and export match.
 */
import { clamp, ease, lerp, mixHex, range, rgba, TAU } from "../math";
import { drawIcon, glassCard, iconsFor, saasBackground, saasFont, spring } from "../saasfx";
import { displayFont, fillTextFit, subFont } from "../text";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { hair, itemsOr, split, stage } from "./beats";
import { iconTile } from "./interactions";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
/** Ink on the brand gradient. */
export const onFill = (p: Palette) => (p.light ? "#ffffff" : p.bg0);
/** The brand gradient's colour for step i of n. */
export const stepColor = (p: Palette, i: number, n: number) => mixHex(p.primary, p.secondary, n > 1 ? i / (n - 1) : 0);
export const num = (i: number) => String(i + 1).padStart(2, "0");

/** The stage under the headline, with a side margin in vertical and square frames (whose
 * title-safe area runs close to the edges). */
export function frame(sc: SkillContext) {
  const st = stage(sc);
  const inset = st.narrow ? sc.w * 0.045 : 0;
  return { ...st, left: st.left + inset, width: st.width - inset * 2 };
}

/** When each of n steps lights up: one slot each, after a short build. */
export function stepTimes(scene: Scene, n: number, start = 0.7) {
  const slot = clamp((scene.duration - start - 1.2) / Math.max(1, n), 0.55, 1.5);
  return Array.from({ length: n }, (_, i) => start + i * slot);
}

/** The step's name (and its detail under it), as a left-aligned or centred block from `y` down. */
function stepText(
  sc: SkillContext,
  item: { title: string; detail: string },
  x: number,
  y: number,
  maxW: number,
  opts: { align: CanvasTextAlign; size: number; lit: number; label?: string },
) {
  const { ctx, palette, u } = sc;
  ctx.save();
  ctx.textAlign = opts.align;
  ctx.textBaseline = "top";
  let yy = y;
  if (opts.label) {
    ctx.fillStyle = rgba(palette.primary, 0.55 + 0.45 * opts.lit);
    ctx.font = subFont(opts.size * 0.58, 750);
    ctx.fillText(opts.label, x, yy);
    yy += opts.size * 0.9;
  }
  ctx.fillStyle = rgba(palette.text, 0.42 + 0.58 * opts.lit);
  ctx.font = subFont(opts.size, 750);
  const lines = fillTextFit(ctx, item.title, x, yy, maxW, { maxLines: 2, lineHeight: 1.1, minScale: 0.62 });
  yy += lines * opts.size * 1.1 + 8 * u;
  if (item.detail && opts.lit > 0.01) {
    ctx.globalAlpha *= opts.lit;
    ctx.fillStyle = rgba(palette.text, 0.68);
    ctx.font = subFont(opts.size * 0.66, 500);
    ctx.translate(0, (1 - opts.lit) * 10 * u);
    fillTextFit(ctx, item.detail, x, yy, maxW, { maxLines: 2, lineHeight: 1.18, minScale: 0.72 });
  }
  ctx.restore();
}

/* ───────────────────────── Process Arrows ───────────────────────── */

export const FLOW = ["Discover — We learn your goals", "Plan — A roadmap that fits", "Build — Design and development", "Launch — Go live and grow"];

/** A chevron pointing right (or down); the first one in the row has a flat back. */
function chevronPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, notch: number, first: boolean, down: boolean) {
  ctx.beginPath();
  if (!down) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - notch, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w - notch, y + h);
    ctx.lineTo(x, y + h);
    if (!first) ctx.lineTo(x + notch, y + h / 2);
  } else {
    ctx.moveTo(x, y);
    if (!first) ctx.lineTo(x + w / 2, y + notch);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - notch);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h - notch);
  }
  ctx.closePath();
}

/**
 * The current step's name, large, with its detail under it: it swaps as each arrow becomes the
 * active tab (the old name slides away, the new one's words rise in one after another), so the
 * viewer always knows which step is being talked about.
 */
export function stepFocus(
  sc: SkillContext,
  P: { title: string; detail: string }[],
  T: number[],
  box: { x: number; y: number; w: number; size: number; align: CanvasTextAlign },
) {
  const { ctx, t, u, palette } = sc;
  const current = T.reduce((c, ti, i) => (t >= ti ? i : c), -1);
  if (current < 0) return;
  const local = t - T[current];
  const font = displayFont(saasFont(sc), box.size);
  const draw = (i: number, kIn: number, out: number) => {
    const p = P[i];
    ctx.save();
    ctx.globalAlpha *= 1 - out;
    ctx.translate(-out * 40 * u, 0);
    ctx.font = font;
    ctx.textBaseline = "alphabetic";
    // Fit the name to the box (one line), then lay its words out so each can rise on its own.
    let size = box.size;
    while (size > box.size * 0.55 && ctx.measureText(p.title).width > box.w) {
      size *= 0.94;
      ctx.font = displayFont(saasFont(sc), size);
    }
    const words = p.title.split(/\s+/);
    const space = ctx.measureText(" ").width;
    const widths = words.map((wd) => ctx.measureText(wd).width);
    const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    let x = box.align === "center" ? box.x - total / 2 : box.x;
    const base = box.y + size * 0.8;
    ctx.textAlign = "left";
    words.forEach((wd, wi) => {
      const k = ease.outCubic(clamp((kIn - wi * 0.12) / 0.6));
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.fillStyle = palette.text;
      ctx.fillText(wd, x, base + (1 - k) * size * 0.45);
      ctx.restore();
      x += widths[wi] + space;
    });
    // An accent underline grows under the name.
    const lk = ease.outCubic(clamp((kIn - 0.25) / 0.6));
    const ux = box.align === "center" ? box.x - (total * lk) / 2 : box.x;
    const g = ctx.createLinearGradient(ux, 0, ux + total, 0);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(ux, base + size * 0.2, Math.max(1, total * lk), Math.max(3, size * 0.06), size * 0.03);
    ctx.fill();
    if (p.detail) {
      const dk = ease.outCubic(clamp((kIn - 0.35) / 0.6));
      ctx.globalAlpha *= dk;
      ctx.fillStyle = rgba(palette.text, 0.7);
      ctx.font = subFont(Math.max(box.size * 0.36, 20 * u), 500);
      ctx.textAlign = box.align;
      ctx.textBaseline = "top";
      fillTextFit(ctx, p.detail, box.x, base + size * 0.48 + (1 - dk) * 10 * u, box.w, { maxLines: 2, lineHeight: 1.2, minScale: 0.7 });
    }
    ctx.restore();
  };
  // The outgoing name leaves first, then the new one comes in, so the two never overlap.
  const out = current > 0 ? clamp(local / 0.16) : 1;
  if (out < 1) draw(current - 1, 1, ease.inCubic(out));
  draw(current, clamp((local - (current > 0 ? 0.12 : 0)) / 0.7), 0);
}

function processChevrons(sc: SkillContext) {
  const { ctx, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, FLOW, 5).map(split);
  const n = P.length;
  const T = stepTimes(scene, n);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const gap = 10 * u;
  // The active tab: the step whose turn it is.
  const current = T.reduce((c, ti, i) => (t >= ti ? i : c), -1);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Geometry: a row of chevrons with small labels under them (wide frames), or a column of
  // downward chevrons with their names beside them (vertical and square frames); the current
  // step's name, large, under it all.
  let boxes: { x: number; y: number; w: number; h: number }[];
  let notch: number;
  let labelAt: (i: number) => { x: number; y: number; w: number; align: CanvasTextAlign };
  let focus: { x: number; y: number; w: number; size: number; align: CanvasTextAlign };
  const size = (narrow ? 30 : 26) * u * S;
  if (!narrow) {
    const big = Math.min(90 * u * S, room * 0.19);
    const ch = Math.min(room * 0.3, 128 * u * S);
    notch = ch * 0.34;
    const cw = (st.width + (n - 1) * (notch - gap)) / n;
    const labelH = size * 1.9;
    const focusH = big * 1.35 + big * 0.36 * 2.6;
    const total = ch + 22 * u + labelH + 40 * u + focusH;
    const y0 = st.top + Math.max(0, (room - total) * 0.5);
    boxes = P.map((_, i) => ({ x: st.left + i * (cw - notch + gap), y: y0, w: cw, h: ch }));
    labelAt = (i) => {
      const b = boxes[i];
      return { x: b.x + b.w / 2 + (i === 0 ? -notch / 4 : 0), y: b.y + b.h + 22 * u, w: Math.min(cw - notch * 0.5, 360 * u * S), align: "center" };
    };
    focus = { x: st.left + st.width / 2, y: y0 + ch + 22 * u + labelH + 40 * u, w: st.width * 0.9, size: big, align: "center" };
  } else {
    const big = Math.min(70 * u * S, st.width * 0.12);
    const focusH = big * 1.35 + big * 0.36 * 2.6;
    const cw = Math.min(st.width * 0.24, 170 * u * S);
    notch = cw * 0.24;
    const colRoom = room - focusH - 50 * u;
    const ch = Math.min(170 * u * S, (colRoom + (n - 1) * (notch - gap)) / n);
    const colH = n * ch - (n - 1) * (notch - gap);
    const total = colH + 50 * u + focusH;
    const y0 = st.top + Math.max(0, (room - total) * 0.45);
    boxes = P.map((_, i) => ({ x: st.left, y: y0 + i * (ch - notch + gap), w: cw, h: ch }));
    labelAt = (i) => {
      const b = boxes[i];
      const mid = b.y + (i === 0 ? (b.h - notch) / 2 : notch / 2 + (b.h - notch) / 2);
      return { x: b.x + cw + 28 * u, y: mid - size * 0.95, w: st.width - cw - 28 * u, align: "left" };
    };
    focus = { x: st.left, y: y0 + colH + 50 * u, w: st.width, size: big, align: "left" };
  }
  P.forEach((p, i) => {
    const b = boxes[i];
    const k = clamp(spring(t - 0.15 - i * 0.09, 11, 7), 0, 1.04);
    if (k <= 0) return;
    const lit = ease.outCubic(range(t, T[i] - 0.05, T[i] + 0.45));
    const active = i === current;
    // The active tab lifts and stays bright; finished steps keep their colour, dimmed.
    const nextT = i + 1 < n ? T[i + 1] : Infinity;
    const lift = active ? ease.outCubic(range(t, T[i], T[i] + 0.3)) : i < current ? 1 - ease.outCubic(range(t, nextT, nextT + 0.3)) : 0;
    const dim = i < current ? 0.45 * ease.outCubic(range(t, nextT, nextT + 0.3)) : 0;
    ctx.save();
    ctx.globalAlpha *= clamp(k);
    // Each chevron slides in along the flow.
    if (narrow) ctx.translate((1 - Math.min(1, k)) * -28 * u + lift * 8 * u, 0);
    else ctx.translate((1 - Math.min(1, k)) * -36 * u, -lift * 8 * u);
    const first = i === 0;
    // The track: a quiet glass chevron.
    chevronPath(ctx, b.x, b.y, b.w, b.h, notch, first, narrow);
    ctx.fillStyle = palette.light ? rgba(palette.text, 0.05) : rgba(palette.text, 0.07);
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = hair(palette, 0.16);
    ctx.stroke();
    // Its turn: the brand gradient sweeps through it along the flow.
    if (lit > 0) {
      ctx.save();
      ctx.globalAlpha *= 1 - dim;
      chevronPath(ctx, b.x, b.y, b.w, b.h, notch, first, narrow);
      ctx.clip();
      const c0 = stepColor(palette, i, n);
      const g = narrow ? ctx.createLinearGradient(0, b.y, 0, b.y + b.h) : ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
      g.addColorStop(0, c0);
      g.addColorStop(1, mixHex(c0, palette.secondary, 0.45));
      ctx.fillStyle = g;
      if (narrow) ctx.fillRect(b.x, b.y, b.w, b.h * lit);
      else ctx.fillRect(b.x, b.y, b.w * lit, b.h);
      // A soft sheen along the top edge.
      const sh = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      sh.addColorStop(0, "rgba(255,255,255,0.22)");
      sh.addColorStop(0.5, "rgba(255,255,255,0)");
      ctx.fillStyle = sh;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.restore();
      if (active) {
        ctx.save();
        ctx.shadowColor = rgba(palette.primary, 0.75);
        ctx.shadowBlur = (20 + 6 * Math.sin(t * 3)) * u;
        chevronPath(ctx, b.x, b.y, b.w, b.h, notch, first, narrow);
        ctx.strokeStyle = rgba(palette.light ? c0 : "#ffffff", 0.9);
        ctx.lineWidth = 2.5 * u;
        ctx.stroke();
        ctx.restore();
      }
    }
    // The step's icon, in the chevron's body.
    const icx = narrow ? b.x + b.w / 2 : b.x + b.w / 2 + (first ? -notch / 4 : notch / 4);
    const icy = narrow ? b.y + (first ? (b.h - notch) / 2 : notch / 2 + (b.h - notch) / 2) : b.y + b.h / 2;
    const is = Math.min(b.h, b.w) * (narrow ? 0.34 : 0.38);
    if (lit < 1) drawIcon(ctx, icons[i], icx, icy, is, rgba(palette.text, 0.42 * (1 - lit)));
    if (lit > 0) {
      ctx.save();
      ctx.globalAlpha *= lit * (1 - dim * 0.6);
      drawIcon(ctx, icons[i], icx, icy, is, onFill(palette), ease.outCubic(range(t, T[i], T[i] + 0.6)));
      ctx.restore();
    }
    ctx.restore();
    // The tab's label: its number and name (the details live in the large heading).
    const tx = labelAt(i);
    ctx.save();
    ctx.globalAlpha *= clamp(k) * (1 - ex) * (active ? 1 : current >= 0 && i < current ? 0.6 : 0.75);
    stepText(sc, { title: p.title, detail: "" }, tx.x, tx.y, tx.w, { align: tx.align, size, lit: active ? 1 : lit * 0.55, label: `STEP ${num(i)}` });
    ctx.restore();
  });
  // A marker under (or beside) the active tab glides to it and points at the large heading.
  if (current >= 0) {
    const from = boxes[Math.max(0, current - 1)];
    const to = boxes[current];
    const gk = current === 0 ? 1 : clamp(spring(t - T[current], 12, 8), 0, 1.04);
    const ms = 11 * u * S;
    ctx.save();
    ctx.globalAlpha *= clamp((t - T[0]) / 0.3);
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    if (!narrow) {
      const cx = (b: { x: number; w: number }, i: number) => b.x + b.w / 2 + (i === 0 ? -notch / 4 : 0);
      const mx = lerp(cx(from, Math.max(0, current - 1)), cx(to, current), gk);
      const my = focus.y - 18 * u;
      ctx.moveTo(mx - ms, my - ms * 0.9);
      ctx.lineTo(mx + ms, my - ms * 0.9);
      ctx.lineTo(mx, my + ms * 0.2);
    } else {
      const cy = (b: { y: number; h: number }, i: number) => b.y + (i === 0 ? (b.h - notch) / 2 : notch / 2 + (b.h - notch) / 2);
      const my = lerp(cy(from, Math.max(0, current - 1)), cy(to, current), gk);
      const mx = st.left - 4 * u;
      ctx.moveTo(mx - ms * 1.1, my - ms);
      ctx.lineTo(mx, my);
      ctx.lineTo(mx - ms * 1.1, my + ms);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // The large heading: the active step's name and what it means.
  stepFocus(sc, P, T, focus);
  ctx.restore();
}

const chevronSfx = (scene: Scene): SfxCue[] => {
  const n = itemsOr(scene, FLOW, 5).length;
  return [at(0.15, "whoosh"), ...stepTimes(scene, n).map((ti) => at(ti, "pop"))];
};

/* ───────────────────────── Process Cycle ───────────────────────── */

const CYCLE = ["Plan — Set goals together", "Build — Make it real", "Launch — Put it in front of people", "Learn — Measure and improve"];

function cycleTiming(scene: Scene, n: number) {
  const T = stepTimes(scene, n, 0.8);
  // After the last step the head runs on round to the first again: the loop closes.
  const close = T[n - 1] + 0.55;
  return { T, close };
}

function processCycle(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1, aurora: 0.25 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, CYCLE, 6, 3).map(split);
  const n = P.length;
  const { T, close } = cycleTiming(scene, n);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const nodeR = (narrow ? 34 : 38) * u * S;
  // Wide frames: the ring in the middle, names around it, the current step in its centre.
  // Vertical and square: the ring above, the current step's name and detail under it.
  const R = narrow
    ? Math.max(80 * u, Math.min(st.width * 0.34, room * 0.27))
    : Math.max(90 * u, Math.min(st.width * 0.19, room / 2 - nodeR - 46 * u * S));
  const cx = w / 2;
  // (Vertical frames centre the ring and the text under it as one block.)
  const textBlock = 40 * u * S * 4.2;
  const cy = narrow ? st.top + Math.max(0, (room - (2 * R + 2 * nodeR + 34 * u + textBlock)) * 0.45) + nodeR + R : st.top + room / 2;
  const ang = (i: number) => -Math.PI / 2 + (i * TAU) / n;
  const enter = clamp(spring(t - 0.1, 9, 7), 0, 1.04);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // The ring: a quiet track, then the lit arc up to the head.
  let f = 0;
  for (let i = 1; i < n; i++) f += ease.inOutCubic(range(t, T[i] - 0.5, T[i]));
  f += ease.inOutCubic(range(t, close - 0.5, close));
  const head = ang(0) + (f * TAU) / n;
  const looped = t >= close;
  ctx.lineCap = "round";
  ctx.lineWidth = 3 * u * S;
  ctx.strokeStyle = rgba(palette.text, 0.1);
  ctx.beginPath();
  ctx.arc(cx, cy, R * Math.min(1, enter), 0, TAU);
  ctx.stroke();
  if (t >= T[0] - 0.2) {
    const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineWidth = 5 * u * S;
    ctx.shadowColor = rgba(palette.primary, 0.6);
    ctx.shadowBlur = 14 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, R, ang(0), Math.max(ang(0) + 0.001, head));
    ctx.stroke();
    ctx.restore();
    // Arrowheads halfway between steps, lit once the head has passed them.
    for (let i = 0; i < n; i++) {
      const a = ang(i) + Math.PI / n;
      const passed = head >= a;
      const ax = cx + Math.cos(a) * R;
      const ay = cy + Math.sin(a) * R;
      const s = 9 * u * S;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.9);
      ctx.lineTo(s * 0.7, 0);
      ctx.lineTo(-s, s * 0.9);
      ctx.strokeStyle = passed ? stepColor(palette, i, n) : rgba(palette.text, 0.22);
      ctx.lineWidth = 3 * u * S;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.restore();
    }
    // The head: a bright point running the ring.
    if (!looped || t < close + 0.6) {
      const hx = cx + Math.cos(head) * R;
      const hy = cy + Math.sin(head) * R;
      const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 22 * u * S);
      glow.addColorStop(0, rgba(palette.light ? palette.primary : "#ffffff", 0.9));
      glow.addColorStop(0.35, rgba(palette.primary, 0.45));
      glow.addColorStop(1, rgba(palette.primary, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(hx, hy, 22 * u * S, 0, TAU);
      ctx.fill();
    }
  }
  // Loop closed: a soft pulse round the whole ring.
  if (looped) {
    const pk = range(t, close, close + 0.9);
    ctx.save();
    ctx.strokeStyle = rgba(palette.primary, 0.35 * (1 - pk));
    ctx.lineWidth = 3 * u * S;
    ctx.beginPath();
    ctx.arc(cx, cy, R + pk * 26 * u, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  const current = T.reduce((c, ti, i) => (t >= ti ? i : c), -1);
  // The steps on the ring.
  P.forEach((p, i) => {
    const a = ang(i);
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    const k = clamp(spring(t - 0.2 - i * 0.08, 12, 7), 0, 1.08);
    if (k <= 0) return;
    const lit = ease.outCubic(range(t, T[i] - 0.05, T[i] + 0.35));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    if (i === current && !looped) {
      const pr = range((t - T[i]) % 1.2, 0, 1.2);
      ctx.strokeStyle = rgba(palette.primary, 0.5 * (1 - pr));
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.arc(0, 0, nodeR * (1 + pr * 0.6), 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, nodeR, 0, TAU);
    ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, palette.text, 0.06);
    ctx.fill();
    ctx.strokeStyle = hair(palette, 0.18);
    ctx.lineWidth = 2 * u;
    ctx.stroke();
    if (lit > 0) {
      ctx.save();
      ctx.globalAlpha *= lit;
      const g = ctx.createLinearGradient(-nodeR, -nodeR, nodeR, nodeR);
      g.addColorStop(0, stepColor(palette, i, n));
      g.addColorStop(1, mixHex(stepColor(palette, i, n), palette.secondary, 0.5));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, nodeR, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    drawIcon(ctx, icons[i], 0, 0, nodeR * 0.95, lit > 0.5 ? onFill(palette) : rgba(palette.text, 0.55));
    ctx.restore();
    // Wide frames name each step outside its node.
    if (!narrow) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const lx = cx + c * (R + nodeR + 18 * u);
      const ly = cy + s * (R + nodeR + 18 * u);
      const align: CanvasTextAlign = c > 0.3 ? "left" : c < -0.3 ? "right" : "center";
      const maxW = align === "center" ? 300 * u * S : Math.min(300 * u * S, align === "left" ? st.left + st.width - lx : lx - st.left);
      ctx.save();
      ctx.globalAlpha *= clamp(k) * (0.45 + 0.55 * lit);
      ctx.fillStyle = palette.text;
      ctx.font = subFont(29 * u * S, 700);
      ctx.textAlign = align;
      ctx.textBaseline = s < -0.3 ? "bottom" : s > 0.3 ? "top" : "middle";
      fillTextFit(ctx, p.title, lx, ly, maxW, { maxLines: 1, minScale: 0.6 });
      ctx.restore();
    }
  });
  // The current step: its number, name and detail, swapping as the head arrives.
  if (current >= 0) {
    const local = t - T[current];
    const swap = ease.outCubic(clamp(local / 0.35));
    const out = current > 0 ? clamp(local / 0.16) : 1;
    const box = narrow
      ? { x: w / 2, y: cy + R + nodeR + 34 * u, w: st.width * 0.92, size: 40 * u * S }
      : { x: cx, y: cy - Math.min(36 * u * S, R * 0.22) * 1.5, w: R * 1.36, size: Math.min(36 * u * S, R * 0.22) };
    const draw = (i: number, a: number, dy: number) => {
      if (a <= 0.01) return;
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.translate(0, dy);
      stepText(sc, P[i], box.x, box.y, box.w, { align: "center", size: box.size, lit: 1, label: `STEP ${num(i)}` });
      ctx.restore();
    };
    if (out < 1) draw(current - 1, 1 - out, -ease.inCubic(out) * 16 * u);
    draw(current, swap * (looped ? 1 : 1), (1 - swap) * 16 * u);
  }
  ctx.restore();
}

const cycleSfx = (scene: Scene): SfxCue[] => {
  const n = itemsOr(scene, CYCLE, 6, 3).length;
  const { T, close } = cycleTiming(scene, n);
  return [at(0.2, "whoosh"), ...T.map((ti) => at(ti, "pop")), at(close, "success")];
};

/* ───────────────────────── Step Ladder ───────────────────────── */

const STAIRS = ["Start — Set up your space", "Grow — Bring in your team", "Scale — Automate routine work", "Lead — Plan what's next"];

function stepStairs(sc: SkillContext) {
  const { ctx, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, STAIRS, 5).map(split);
  const n = P.length;
  const T = stepTimes(scene, n, 0.9);
  const room = st.bottom - st.top;
  // Isometric depth: each stair's top runs back up and to the right.
  const width = st.width;
  const dx = Math.min(width * 0.06, 56 * u * S);
  const dy = -dx * 0.62;
  const bw = (width - dx) / n;
  const labelH = 30 * u * S * (narrow ? 3.4 : 3.1);
  const rise = Math.min((room - labelH + dy - 24 * u) / n, bw * (narrow ? 1.1 : 0.62));
  const total = n * rise - dy + labelH;
  const base = st.top + Math.min(room, total + Math.max(0, (room - total) * 0.5));
  const left = st.left;
  const ballR = 11 * u * S;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // A soft floor shadow under the staircase.
  const fl = ctx.createRadialGradient(left + width / 2, base, 0, left + width / 2, base, width * 0.6);
  fl.addColorStop(0, rgba("#000000", palette.light ? 0.1 : 0.3));
  fl.addColorStop(1, rgba("#000000", 0));
  ctx.save();
  ctx.translate(0, base);
  ctx.scale(1, 0.12);
  ctx.fillStyle = fl;
  ctx.beginPath();
  ctx.arc(left + width / 2, 0, width * 0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
  const tops: number[] = [];
  P.forEach((p, i) => {
    const k = clamp(spring(t - 0.15 - i * 0.12, 10, 7), 0, 1.04);
    const x = left + i * bw;
    const top = base - (i + 1) * rise * Math.max(0, k);
    tops.push(base - (i + 1) * rise);
    if (k <= 0.001) return;
    const lit = ease.outCubic(range(t, T[i] - 0.05, T[i] + 0.4));
    const c0 = stepColor(palette, i, n);
    const quiet = palette.light ? mixHex(palette.bg1, palette.text, 0.07) : mixHex(palette.bg1, palette.text, 0.1);
    const face = (lit: number, a: string, b: string) => mixHex(a, b, lit);
    // Front, top and side faces: quiet glass until the marker reaches the stair, then the brand colour.
    const front = ctx.createLinearGradient(0, top, 0, base);
    front.addColorStop(0, face(lit, quiet, c0));
    front.addColorStop(1, face(lit, mixHex(quiet, palette.bg0, 0.4), mixHex(c0, palette.bg0, palette.light ? 0.2 : 0.45)));
    ctx.fillStyle = front;
    ctx.fillRect(x, top, bw + 0.5, base - top);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + bw, top);
    ctx.lineTo(x + bw + dx, top + dy);
    ctx.lineTo(x + dx, top + dy);
    ctx.closePath();
    ctx.fillStyle = face(lit, mixHex(quiet, "#ffffff", palette.light ? 0.5 : 0.12), mixHex(c0, "#ffffff", 0.32));
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + bw, top);
    ctx.lineTo(x + bw + dx, top + dy);
    ctx.lineTo(x + bw + dx, base + dy);
    ctx.lineTo(x + bw, base);
    ctx.closePath();
    ctx.fillStyle = face(lit, mixHex(quiet, "#000000", 0.18), mixHex(c0, "#000000", 0.3));
    ctx.fill();
    // Edges.
    ctx.strokeStyle = lit > 0.5 ? "rgba(255,255,255,0.25)" : hair(palette, 0.14);
    ctx.lineWidth = 1.5 * u;
    ctx.strokeRect(x, top, bw, base - top);
    // The stair's number on its front.
    const ns = Math.min(bw * 0.26, rise * 0.5, 52 * u * S);
    ctx.save();
    ctx.fillStyle = lit > 0.5 ? onFill(palette) : rgba(palette.text, 0.35);
    ctx.font = subFont(ns, 800);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(num(i), x + bw / 2, top + Math.min(rise, base - top) / 2);
    ctx.restore();
  });
  // Names and details above the stairs, drawn over the staircase so a taller stair never covers them.
  P.forEach((p, i) => {
    const k = clamp(spring(t - 0.15 - i * 0.12, 10, 7), 0, 1.04);
    if (k <= 0.001) return;
    const lit = ease.outCubic(range(t, T[i] - 0.05, T[i] + 0.4));
    const top = base - (i + 1) * rise * Math.max(0, k);
    ctx.save();
    ctx.globalAlpha *= clamp(k);
    const size = Math.min(28 * u * S, bw * 0.18);
    const tx = left + i * bw + bw / 2 + dx * 0.25;
    const ty = top + dy - ballR * 2 - 14 * u - labelH * 0.78;
    stepText(sc, p, tx, ty, bw * 0.92, { align: "center", size, lit });
    ctx.restore();
  });
  // The marker hops up the stairs, one at each step's turn, and a flag lands on the top step.
  const spot = (i: number) => (i < 0 ? { x: left - bw * 0.35, y: base } : { x: left + i * bw + bw / 2 + dx / 2, y: tops[i] + dy / 2 });
  let mi = -1;
  for (let i = 0; i < n; i++) if (t >= T[i] - 0.4) mi = i;
  if (t >= T[0] - 0.9) {
    const from = spot(mi - 1);
    const to = spot(mi);
    const hk = mi >= 0 ? range(t, T[mi] - 0.4, T[mi]) : 0;
    const e = ease.inOutCubic(hk);
    const hop = Math.sin(hk * Math.PI) * (rise + 30 * u);
    const bx = mi >= 0 ? lerp(from.x, to.x, e) : from.x;
    const by = mi >= 0 ? lerp(from.y, to.y, e) - hop : from.y;
    const land = mi >= 0 ? range(t, T[mi], T[mi] + 0.25) : 1;
    const squash = 1 - Math.sin(land * Math.PI) * 0.25;
    ctx.save();
    ctx.globalAlpha *= clamp((t - (T[0] - 0.9)) / 0.3);
    // Landing ripple on the stair's top.
    if (mi >= 0 && land < 1) {
      ctx.strokeStyle = rgba(palette.light ? palette.primary : "#ffffff", 0.5 * (1 - land));
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.ellipse(to.x, to.y, ballR * (1.4 + land * 2.4), ballR * (0.5 + land * 0.9), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.translate(bx, by - ballR * squash);
    ctx.scale(1 / squash, squash);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, ballR * 2.6);
    glow.addColorStop(0, rgba(palette.accent, 0.55));
    glow.addColorStop(1, rgba(palette.accent, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, ballR * 2.6, 0, TAU);
    ctx.fill();
    const bg = ctx.createRadialGradient(-ballR * 0.35, -ballR * 0.35, 0, 0, 0, ballR);
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(1, palette.accent);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, ballR, 0, TAU);
    ctx.fill();
    ctx.restore();
    // The flag on the top step, once the marker is there.
    const fk = clamp(spring(t - T[n - 1] - 0.15, 12, 7), 0, 1.06);
    if (fk > 0) {
      const top = spot(n - 1);
      const fx = top.x + bw * 0.22;
      const poleH = Math.min(rise * 0.9, 70 * u * S) * Math.min(1, fk);
      ctx.save();
      ctx.strokeStyle = rgba(palette.text, 0.75);
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.moveTo(fx, top.y);
      ctx.lineTo(fx, top.y - poleH);
      ctx.stroke();
      const wave = Math.sin(t * 6) * 3 * u;
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.moveTo(fx, top.y - poleH);
      ctx.quadraticCurveTo(fx + poleH * 0.3, top.y - poleH + wave, fx + poleH * 0.55 * fk, top.y - poleH * 0.82);
      ctx.lineTo(fx, top.y - poleH * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

const stairsSfx = (scene: Scene): SfxCue[] => {
  const n = itemsOr(scene, STAIRS, 5).length;
  const T = stepTimes(scene, n, 0.9);
  return [at(0.15, "whoosh"), ...T.map((ti) => at(ti, "pop")), at(T[n - 1] + 0.2, "success")];
};

/* ───────────────────────── Services ───────────────────────── */

export const SERVICES = ["Brand strategy — Positioning, naming and voice", "Web design — Clear, modern sites", "Development — Apps built to grow with you", "Marketing — Campaigns from idea to launch"];

function servicesTiming(scene: Scene, n: number) {
  const start = 0.55;
  const slot = clamp((scene.duration - start - 0.9) / Math.max(1, n), 0.8, 2);
  return { start, slot };
}

function services(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1, aurora: 0.3 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, SERVICES, 6).map(split);
  const n = P.length;
  const { start, slot } = servicesTiming(scene, n);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const active = clamp(Math.floor((t - start) / slot), 0, n - 1);
  const local = t - start - active * slot;
  const room = st.bottom - st.top;
  // Wide frames: the circle on the left and the list on the right. Vertical and square: the
  // circle above the list.
  let Rc: number;
  let cx: number;
  let cy: number;
  let list: { x: number; y: number; w: number; h: number };
  if (!narrow) {
    Rc = Math.min(room * 0.36, st.width * 0.18);
    cx = st.left + Rc * 1.2;
    cy = st.top + room / 2;
    const lx = cx + Rc * 1.2 + 80 * u;
    const lh = Math.min(room * 0.96, n * 104 * u * S);
    list = { x: lx, y: cy - lh / 2, w: st.left + st.width - lx, h: lh };
  } else {
    Rc = Math.min(st.width * 0.26, room * 0.19);
    cx = w / 2;
    cy = st.top + Rc * 1.2 + 6 * u;
    const ly = cy + Rc * 1.2 + 40 * u;
    const lh = Math.min(st.bottom - ly, n * 112 * u * S);
    list = { x: st.left, y: ly, w: st.width, h: lh };
  }
  const rowH = list.h / n;
  const rowY = (i: number) => list.y + i * rowH + rowH / 2;
  const enter = clamp(spring(t - 0.1, 9, 7), 0, 1.05);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // The circle: a halo, a countdown ring round it and the brand-gradient disc.
  const halo = ctx.createRadialGradient(cx, cy, Rc * 0.6, cx, cy, Rc * 1.75);
  halo.addColorStop(0, rgba(palette.primary, palette.light ? 0.22 : 0.32));
  halo.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, Rc * 1.75, 0, TAU);
  ctx.fill();
  const ringR = Rc * 1.13;
  ctx.lineCap = "round";
  ctx.lineWidth = 3 * u * S;
  ctx.strokeStyle = rgba(palette.text, 0.1);
  ctx.beginPath();
  ctx.arc(cx, cy, ringR * Math.min(1, enter), 0, TAU);
  ctx.stroke();
  if (t >= start) {
    const pk = clamp(local / slot);
    const a0 = -Math.PI / 2;
    const a1 = a0 + Math.max(0.001, pk * TAU);
    const g = ctx.createLinearGradient(cx - ringR, cy - ringR, cx + ringR, cy + ringR);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineWidth = 5 * u * S;
    ctx.shadowColor = rgba(palette.primary, 0.6);
    ctx.shadowBlur = 12 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, a0, a1);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = palette.light ? palette.primary : "#ffffff";
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a1) * ringR, cy + Math.sin(a1) * ringR, 6 * u * S, 0, TAU);
    ctx.fill();
    // Each new service sends a soft pulse out from the disc.
    const pr = range(local, 0, 0.7);
    if (pr < 1) {
      ctx.strokeStyle = rgba(palette.primary, 0.45 * (1 - pr));
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.arc(cx, cy, Rc * (1 + pr * 0.45), 0, TAU);
      ctx.stroke();
    }
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(enter, enter);
  const disc = ctx.createLinearGradient(-Rc, -Rc, Rc, Rc);
  disc.addColorStop(0, palette.primary);
  disc.addColorStop(1, palette.secondary);
  ctx.fillStyle = disc;
  ctx.shadowColor = rgba(palette.primary, 0.5);
  ctx.shadowBlur = 40 * u;
  ctx.beginPath();
  ctx.arc(0, 0, Rc, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  const shine = ctx.createRadialGradient(-Rc * 0.4, -Rc * 0.45, 0, -Rc * 0.4, -Rc * 0.45, Rc * 1.2);
  shine.addColorStop(0, "rgba(255,255,255,0.32)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(0, 0, Rc, 0, TAU);
  ctx.fill();
  // A slow dashed ring inside the disc.
  ctx.save();
  ctx.rotate(t * 0.35);
  ctx.setLineDash([6 * u, 10 * u]);
  ctx.strokeStyle = rgba(onFill(palette), 0.28);
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.arc(0, 0, Rc * 0.84, 0, TAU);
  ctx.stroke();
  ctx.restore();
  // The service's icon, large: the outgoing one shrinks away as the next springs in.
  const is = Rc * 0.95;
  const inK = t < start ? 0 : clamp(spring(active === 0 ? t - start + 0.05 : local, 13, 7), 0, 1.12);
  const outK = active > 0 ? clamp(local / 0.2) : 1;
  if (outK < 1) {
    ctx.save();
    ctx.globalAlpha *= 1 - outK;
    ctx.rotate(outK * 0.5);
    ctx.scale(1 - outK * 0.5, 1 - outK * 0.5);
    drawIcon(ctx, icons[active - 1], 0, 0, is, onFill(palette));
    ctx.restore();
  }
  if (inK > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp(inK);
    ctx.rotate((1 - Math.min(1, inK)) * -0.5);
    ctx.scale(inK, inK);
    drawIcon(ctx, icons[active], 0, 0, is, onFill(palette), ease.outCubic(clamp(local / 0.6)));
    ctx.restore();
  }
  ctx.restore();
  // The list, with a highlight gliding to the current service.
  const from = rowY(Math.max(0, active - 1));
  const to = rowY(active);
  const gk = active === 0 ? 1 : clamp(spring(local, 12, 8), 0, 1.04);
  const hy = lerp(from, to, gk);
  const pad = 18 * u;
  if (t >= start - 0.1) {
    ctx.save();
    ctx.globalAlpha *= clamp((t - start + 0.1) / 0.3);
    glassCard(sc, list.x - pad, hy - rowH / 2 + 5 * u, list.w + pad, rowH - 10 * u, { r: 18 * u, tint: palette.bg1 });
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.roundRect(list.x - pad, hy - rowH / 2 + 5 * u + rowH * 0.22, 4 * u, rowH * 0.56 - 10 * u, 2 * u);
    ctx.fill();
    ctx.restore();
    // A thread from the circle to the highlighted service (wide frames).
    if (!narrow) {
      const x0 = cx + ringR;
      const x1 = list.x - pad;
      ctx.save();
      ctx.strokeStyle = rgba(palette.primary, 0.45);
      ctx.lineWidth = 2 * u;
      ctx.setLineDash([4 * u, 6 * u]);
      ctx.lineDashOffset = -t * 30 * u;
      ctx.beginPath();
      ctx.moveTo(x0, cy);
      ctx.bezierCurveTo(lerp(x0, x1, 0.5), cy, lerp(x0, x1, 0.5), hy, x1, hy);
      ctx.stroke();
      ctx.restore();
    }
  }
  const tile = Math.min(rowH * 0.5, 54 * u * S);
  const size = Math.min(34 * u * S, rowH * 0.32);
  P.forEach((p, i) => {
    const k = clamp(spring(t - 0.25 - i * 0.08, 12, 7), 0, 1.05);
    if (k <= 0) return;
    const on = i === active && t >= start;
    const dk = on ? ease.outCubic(clamp((active === 0 ? t - start : local) / 0.35)) : 0;
    const y = rowY(i);
    ctx.save();
    ctx.globalAlpha *= clamp(k) * (on ? 1 : 0.6);
    ctx.translate((1 - Math.min(1, k)) * 30 * u, 0);
    const tx = list.x + tile / 2 + 4 * u;
    if (on) iconTile(sc, icons[i], tx, y, tile);
    else {
      ctx.beginPath();
      ctx.arc(tx, y, tile / 2, 0, TAU);
      ctx.strokeStyle = hair(palette, 0.22);
      ctx.lineWidth = 2 * u;
      ctx.stroke();
      drawIcon(ctx, icons[i], tx, y, tile * 0.5, rgba(palette.text, 0.7));
    }
    const lx = tx + tile / 2 + 22 * u;
    const maxW = list.x + list.w - lx - 8 * u;
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = subFont(size, on ? 750 : 650);
    fillTextFit(ctx, p.title, lx, y - (p.detail ? dk * size * 0.62 : 0), maxW, { maxLines: 1, minScale: 0.6 });
    if (p.detail && dk > 0) {
      ctx.globalAlpha *= dk;
      ctx.fillStyle = rgba(palette.text, 0.68);
      ctx.font = subFont(size * 0.68, 500);
      fillTextFit(ctx, p.detail, lx, y + size * 0.62, maxW, { maxLines: 1, minScale: 0.7 });
    }
    ctx.restore();
  });
  ctx.restore();
}

const servicesSfx = (scene: Scene): SfxCue[] => {
  const n = itemsOr(scene, SERVICES, 6).length;
  const { start, slot } = servicesTiming(scene, n);
  return [at(0.15, "whoosh"), ...Array.from({ length: n }, (_, i) => at(start + i * slot, i ? "swoosh" : "pop"))];
};

/* ───────────────────────── Registry ───────────────────────── */

export const processSkills: Skill[] = [
  {
    id: "process-chevrons",
    name: "Process Arrows",
    tagline: "Business-process chevrons in a row fill with the brand gradient one by one, each with its icon, as the step's name and detail rise in under it.",
    bestFor: "A business process or how the company works with clients: 3–5 stages in order (items 'Stage — short detail'). Agencies, services, consulting, onboarding.",
    sample: { text: "How we *work*", items: FLOW },
    itemsHint: "3–5 stages: 'Stage — short detail'",
    render: processChevrons,
    sfx: chevronSfx,
  },
  {
    id: "process-cycle",
    name: "Process Cycle",
    tagline: "Steps sit around a ring; a glowing head runs from step to step and closes the loop, with the current step's name and detail in the centre.",
    bestFor: "A process that repeats: plan, build, launch, learn (3–6 items 'Step — short detail'). How a team or business runs, continuous improvement.",
    sample: { text: "How it *comes together*", items: CYCLE },
    itemsHint: "3–6 steps of a cycle: 'Step — short detail'",
    render: processCycle,
    sfx: cycleSfx,
  },
  {
    id: "step-stairs",
    name: "Step Ladder",
    tagline: "A 3D staircase rises from the floor; a marker hops up it stair by stair, each stair numbered and named, and a flag lands on the top step.",
    bestFor: "Stages of growth or a path to a goal: 2–5 steps that build on each other (items 'Step — short detail'). Onboarding, plans and tiers, roadmaps.",
    sample: { text: "Step by *step*", items: STAIRS },
    itemsHint: "2–5 steps that build up: 'Step — short detail'",
    render: stepStairs,
    sfx: stairsSfx,
  },
  {
    id: "services",
    name: "Services",
    tagline: "A large circle shows the current service's icon, big, beside the list of services; the highlight moves down the list and the icon swaps for each one.",
    bestFor: "What a company offers: 2–6 services (items 'Service — short description'). Agencies, studios, consultancies, local businesses and service teams.",
    sample: { text: "What we *do*", items: SERVICES },
    itemsHint: "2–6 services: 'Service — short description'",
    render: services,
    sfx: servicesSfx,
  },
];
