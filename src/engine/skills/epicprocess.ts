/**
 * Epic steps and services slides: the same "how it works" and "what we offer" beats as the
 * process set (process.ts), staged bigger. Each names the current step or service large, so the
 * viewer always knows which one is being told.
 *
 * Steps
 * - step-portals:     the camera flies through glowing rings, one per step, with light streaks as
 *                     it moves; the step it arrives at is named large inside its ring.
 * - light-trail:      a comet races along a sweeping path and ignites each step with a burst; the
 *                     step it reaches is named large beside its orb.
 * - step-cards:       big numbered cards flip over one by one to reveal each step, a glint
 *                     sweeping across as they land; the current card stands forward.
 * Services
 * - service-orbit:    services orbit a glowing core like planets; the current one swings to the
 *                     front, grows, and is named large beside the orbit.
 * - service-carousel: a cover-flow of service cards under spotlights glides to each service in
 *                     turn, the current card large and facing the camera.
 * - service-hex:      a honeycomb of service tiles; the current one rises in 3D under a beam of
 *                     light and is named large beside the grid.
 *
 * Every frame is a pure function of time, so preview, seek and export match.
 */
import { clamp, ease, hashString, lerp, mixHex, range, rgba, TAU } from "../math";
import { drawIcon, glassCard, iconsFor, saasBackground, saasFont, spring } from "../saasfx";
import { displayFont, fillTextFit, subFont } from "../text";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { hair, itemsOr, split } from "./beats";
import { iconTile } from "./interactions";
import { FLOW, SERVICES, frame, num, onFill, stepColor, stepFocus, stepTimes } from "./process";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
type Pt = { x: number; y: number };

/** Which step is current at time t (the last one whose turn has come), or -1 before the first. */
const currentOf = (T: number[], t: number, lead = 0) => T.reduce((c, ti, i) => (t >= ti - lead ? i : c), -1);

/** A small spaced label ("STEP 02") above the large name. */
function smallLabel(sc: SkillContext, text: string, x: number, y: number, align: CanvasTextAlign, alpha = 1) {
  const { ctx, u, palette } = sc;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = palette.primary;
  ctx.font = subFont(22 * u, 750);
  ctx.textAlign = align;
  ctx.textBaseline = "bottom";
  ctx.letterSpacing = `${3 * u}px`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Services take turns in equal slots after a short build. */
function serviceTimes(scene: Scene, n: number, start = 0.6) {
  const slot = clamp((scene.duration - start - 0.9) / Math.max(1, n), 0.8, 2);
  return Array.from({ length: n }, (_, i) => start + i * slot);
}

/** A ring of short radial ticks (a tech dial), turning slowly. */
function ticks(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, len: number, count: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const a = rot + (i * TAU) / count;
    ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len));
  }
  ctx.stroke();
}

/* ───────────────────────── Step Portals ───────────────────────── */

function portalCamera(T: number[], t: number) {
  // In step units: flies in from far away, then moves ring to ring just before each step's turn.
  let c = -1.6 + 1.6 * ease.outCubic(range(t, 0.1, T[0]));
  for (let i = 1; i < T.length; i++) c += ease.inOutCubic(range(t, T[i] - 0.42, T[i]));
  return c;
}

function stepPortals(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 0, aurora: 0.35 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, FLOW, 5).map(split);
  const n = P.length;
  const T = stepTimes(scene, n, 0.9);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const cx = w / 2;
  const cy = st.top + room * (narrow ? 0.46 : 0.5);
  const Rt = narrow ? Math.min(st.width * 0.47, room * 0.3) : Math.min(room * 0.45, st.width * 0.3);
  const c = portalCamera(T, t);
  const speed = Math.abs(portalCamera(T, t + 0.02) - portalCamera(T, t - 0.02)) / 0.04;
  const current = currentOf(T, t, 0.05);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Light streaks while the camera moves: thin lines rushing out from the centre.
  if (speed > 0.05) {
    ctx.save();
    ctx.lineCap = "round";
    for (let k = 0; k < 64; k++) {
      const hsh = hashString(`streak${k}`);
      const a = ((hsh % 1000) / 1000) * TAU;
      const r0 = Rt * (0.35 + ((hsh >> 10) % 100) / 70);
      const len = Rt * Math.min(0.5, speed * 0.25);
      const flow = ((t * (0.6 + ((hsh >> 4) % 50) / 50) + (hsh % 97) / 97) % 1) * Rt * 0.6;
      const r = r0 + flow;
      ctx.strokeStyle = rgba(k % 3 ? palette.primary : palette.light ? palette.secondary : "#ffffff", Math.min(0.5, speed * 0.28) * clamp(1 - r / (Rt * 2.2)));
      ctx.lineWidth = (1 + (k % 3)) * u;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len));
      ctx.stroke();
    }
    ctx.restore();
  }
  // The rings, far to near. Ring i sits `i - c` steps ahead of the camera.
  const order = P.map((_, i) => i).sort((a, b) => b - c - (a - c));
  for (const i of order) {
    const d = i - c;
    if (d < -0.34 || d > 3.4) continue;
    const s = 1 / (1 + d * 0.9);
    const a = d >= 0 ? clamp(1 - d / 3.4) : clamp(1 + d / 0.34);
    const R = Rt * s;
    // Further rings sit a little off-centre, so the tunnel curves away.
    const ox = Math.sin(i * 1.7) * Rt * 0.25 * clamp(d);
    const oy = Math.cos(i * 1.3) * Rt * 0.12 * clamp(d);
    const lit = t >= T[i] - 0.1;
    const x = cx + ox;
    const y = cy + oy;
    ctx.save();
    ctx.globalAlpha *= a * (lit ? 1 : 0.55);
    const g = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    if (lit) {
      ctx.fillStyle = rgba(palette.primary, palette.light ? 0.06 : 0.08);
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.fill();
    }
    ctx.shadowColor = rgba(palette.primary, 0.7);
    ctx.shadowBlur = (lit ? 26 : 10) * u * Math.min(1.5, s);
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1.5 * u, 7 * u * S * s);
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(palette.text, 0.18);
    ctx.lineWidth = Math.max(1, 1.5 * u * s);
    ctx.beginPath();
    ctx.arc(x, y, R * 0.88, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = rgba(palette.primary, 0.55);
    ctx.lineWidth = Math.max(1, 2 * u * s);
    ticks(ctx, x, y, R * 1.06, R * 0.05, 48, t * 0.15 * (i % 2 ? 1 : -1));
    // The step's number and icon on the ring's rim, for rings ahead.
    if (d > 0.35) {
      ctx.fillStyle = palette.text;
      ctx.font = subFont(Math.max(12 * u, 30 * u * S * s), 750);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(num(i), x, y - R * 0.62);
      drawIcon(ctx, icons[i], x, y, R * 0.5, rgba(palette.text, 0.6));
    }
    ctx.restore();
  }
  // Inside the ring the camera has reached: its number, faint and huge, then the step's name.
  if (current >= 0) {
    const next = current + 1 < n ? T[current + 1] : Infinity;
    const leave = ease.inCubic(range(t, next - 0.38, next - 0.2));
    ctx.save();
    ctx.globalAlpha *= 1 - leave;
    ctx.translate(cx, cy);
    ctx.scale(1 + leave * 0.4, 1 + leave * 0.4);
    ctx.translate(-cx, -cy);
    const big = Math.min(84 * u * S, Rt * 0.26);
    ctx.font = displayFont(saasFont(sc), Rt * 0.95);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = rgba(palette.text, 0.1);
    ctx.lineWidth = 2 * u;
    ctx.strokeText(num(current), cx, cy);
    smallLabel(sc, `STEP ${num(current)}`, cx, cy - big * 0.75, "center", clamp((t - T[current]) / 0.3));
    drawIcon(ctx, icons[current], cx, cy - big * 1.55, big * 0.62, palette.primary, ease.outCubic(range(t, T[current], T[current] + 0.6)));
    stepFocus(sc, P, T, { x: cx, y: cy - big * 0.55, w: Rt * 1.55, size: big, align: "center" });
    ctx.restore();
  }
  // Progress: a dot per step under the tunnel.
  const dy = Math.min(st.bottom - 14 * u, cy + Rt + 44 * u);
  for (let i = 0; i < n; i++) {
    const on = i <= current;
    const dx = cx + (i - (n - 1) / 2) * 26 * u;
    ctx.fillStyle = on ? palette.primary : rgba(palette.text, 0.22);
    ctx.beginPath();
    ctx.arc(dx, dy, (i === current ? 6 : 4) * u, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

const portalSfx = (scene: Scene): SfxCue[] => {
  const n = itemsOr(scene, FLOW, 5).length;
  const T = stepTimes(scene, n, 0.9);
  return [at(0.1, "whoosh"), ...T.map((ti, i) => at(ti - (i ? 0.55 : 0), i ? "swoosh" : "pop"))];
};

/* ───────────────────────── Light Trail ───────────────────────── */

const TRAIL = ["Sign up — Create your space", "Connect — Bring in your tools", "Launch — Go live", "Grow — Learn and improve"];

/** Points along the trail's sweeping curve, with their running length. */
function trailPath(st: ReturnType<typeof frame>) {
  const room = st.bottom - st.top;
  const L = st.left;
  const W = st.width;
  const top = st.top;
  const pts: Pt[] = [];
  const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, s: number) => {
    const a = (1 - s) ** 3;
    const b = 3 * (1 - s) ** 2 * s;
    const c = 3 * (1 - s) * s * s;
    const d = s ** 3;
    return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
  };
  const [p0, p1, p2, p3] = st.narrow
    ? [{ x: L + W * 0.12, y: top + room * 0.04 }, { x: L + W * 1.3, y: top + room * 0.2 }, { x: L - W * 0.3, y: top + room * 0.42 }, { x: L + W * 0.88, y: top + room * 0.6 }]
    : [{ x: L, y: top + room * 0.5 }, { x: L + W * 0.36, y: top - room * 0.18 }, { x: L + W * 0.62, y: top + room * 0.78 }, { x: L + W, y: top + room * 0.08 }];
  for (let i = 0; i <= 240; i++) pts.push(cubic(p0, p1, p2, p3, i / 240));
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = len[len.length - 1];
  /** The point at fraction s (0..1) of the trail's length. */
  const atS = (s: number): Pt => {
    const target = clamp(s) * total;
    let lo = 0;
    let hi = len.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (len[mid] < target) lo = mid;
      else hi = mid;
    }
    const k = (target - len[lo]) / Math.max(1e-6, len[hi] - len[lo]);
    return { x: lerp(pts[lo].x, pts[hi].x, k), y: lerp(pts[lo].y, pts[hi].y, k) };
  };
  return { atS, total };
}

function lightTrail(sc: SkillContext) {
  const { ctx, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 0, aurora: 0.3 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, TRAIL, 5).map(split);
  const n = P.length;
  const T = stepTimes(scene, n, 0.9);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const { atS } = trailPath(st);
  const nodeS = P.map((_, i) => 0.1 + (0.8 * i) / Math.max(1, n - 1));
  // The comet: to the first step, then from step to step just before each one's turn.
  let s = nodeS[0] * ease.inOutCubic(range(t, 0.3, T[0]));
  for (let i = 1; i < n; i++) s += (nodeS[i] - nodeS[i - 1]) * ease.inOutCubic(range(t, T[i] - 0.6, T[i]));
  s += (1 - nodeS[n - 1]) * ease.inOutCubic(range(t, T[n - 1] + 0.5, T[n - 1] + 1.4));
  const current = currentOf(T, t, 0.02);
  const nr = (narrow ? 30 : 34) * u * S;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // The track, then the lit trail behind the comet.
  const reveal = ease.outCubic(range(t, 0.05, 0.6));
  ctx.strokeStyle = rgba(palette.text, 0.1);
  ctx.lineWidth = 3 * u * S;
  ctx.beginPath();
  for (let k = 0; k <= 120; k++) {
    const p = atS((k / 120) * reveal);
    if (k) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.stroke();
  if (s > 0.001) {
    const a = atS(0);
    const b = atS(s);
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, rgba(palette.primary, 0.5));
    g.addColorStop(1, palette.secondary);
    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineWidth = 5 * u * S;
    ctx.shadowColor = rgba(palette.primary, 0.7);
    ctx.shadowBlur = 16 * u;
    ctx.beginPath();
    const steps = Math.max(2, Math.ceil(s * 160));
    for (let k = 0; k <= steps; k++) {
      const p = atS((k / steps) * s);
      if (k) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }
  // The nodes: quiet orbs that ignite with a burst and sparks when the comet arrives.
  P.forEach((p, i) => {
    const pos = atS(nodeS[i]);
    const k = clamp(spring(t - 0.3 - i * 0.1, 12, 7), 0, 1.06);
    if (k <= 0) return;
    const lit = ease.outCubic(range(t, T[i] - 0.05, T[i] + 0.3));
    const burst = range(t, T[i], T[i] + 0.7);
    ctx.save();
    if (burst > 0 && burst < 1) {
      ctx.strokeStyle = rgba(palette.primary, 0.55 * (1 - burst));
      ctx.lineWidth = 3 * u * (1 - burst) + 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nr * (1 + burst * 2.4), 0, TAU);
      ctx.stroke();
      for (let q = 0; q < 10; q++) {
        const ang = (q / 10) * TAU + i;
        const dist = nr * (1.2 + ease.outCubic(burst) * 2.2);
        ctx.fillStyle = rgba(q % 2 ? palette.secondary : palette.primary, 0.8 * (1 - burst));
        ctx.beginPath();
        ctx.arc(pos.x + Math.cos(ang) * dist, pos.y + Math.sin(ang) * dist, 3 * u * (1 - burst * 0.5), 0, TAU);
        ctx.fill();
      }
    }
    ctx.translate(pos.x, pos.y);
    const pop = i === current ? 1 + 0.18 * ease.outCubic(range(t, T[i], T[i] + 0.3)) : 1;
    ctx.scale(k * pop, k * pop);
    ctx.beginPath();
    ctx.arc(0, 0, nr, 0, TAU);
    ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, palette.text, 0.06);
    ctx.fill();
    ctx.strokeStyle = hair(palette, 0.2);
    ctx.lineWidth = 2 * u;
    ctx.stroke();
    if (lit > 0) {
      ctx.save();
      ctx.globalAlpha *= lit;
      ctx.shadowColor = rgba(palette.primary, 0.8);
      ctx.shadowBlur = 22 * u;
      const og = ctx.createLinearGradient(-nr, -nr, nr, nr);
      og.addColorStop(0, stepColor(palette, i, n));
      og.addColorStop(1, mixHex(stepColor(palette, i, n), palette.secondary, 0.5));
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(0, 0, nr, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    drawIcon(ctx, icons[i], 0, 0, nr * 0.95, lit > 0.5 ? onFill(palette) : rgba(palette.text, 0.55));
    ctx.restore();
    // Its name: small beside the orb, or large for the current step.
    const above = !narrow;
    const lx = narrow ? pos.x + nr + 20 * u : pos.x;
    const ly = narrow ? pos.y : pos.y - nr - 16 * u;
    if (i !== current) {
      ctx.save();
      ctx.globalAlpha *= clamp(k) * (i < current ? 0.55 : 0.4);
      ctx.fillStyle = palette.text;
      ctx.font = subFont(26 * u * S, 700);
      ctx.textAlign = narrow ? "left" : "center";
      ctx.textBaseline = narrow ? "middle" : above ? "bottom" : "top";
      fillTextFit(ctx, p.title, lx, ly, narrow ? st.left + st.width - lx : st.width / n, { maxLines: 1, minScale: 0.6 });
      ctx.restore();
    }
  });
  // The current step, large, next to its orb.
  if (current >= 0) {
    const pos = atS(nodeS[current]);
    // (A clear band under the trail, following the step across.)
    const big = (narrow ? 60 : 70) * u * S;
    const room = st.bottom - st.top;
    const box = narrow
      ? { x: st.left + st.width / 2, y: st.top + room * 0.72, w: st.width, size: big, align: "center" as CanvasTextAlign }
      : { x: clamp(pos.x, st.left + st.width * 0.22, st.left + st.width * 0.78), y: st.top + room * 0.7, w: st.width * 0.44, size: big, align: "center" as CanvasTextAlign };
    smallLabel(sc, `STEP ${num(current)}`, box.x, box.y - 6 * u, box.align, clamp((t - T[current]) / 0.3));
    stepFocus(sc, P, T, box);
  }
  // The comet: a bright head with a tapering tail.
  if (t > 0.3 && s < 0.999) {
    for (let q = 14; q >= 0; q--) {
      const p = atS(Math.max(0, s - q * 0.006));
      const f = 1 - q / 15;
      ctx.fillStyle = rgba(q ? palette.primary : palette.light ? palette.primary : "#ffffff", 0.08 + 0.6 * f * f);
      ctx.beginPath();
      ctx.arc(p.x, p.y, (2 + 7 * f) * u * S, 0, TAU);
      ctx.fill();
    }
    const head = atS(s);
    const glow = ctx.createLinearGradient(head.x - 30 * u, head.y, head.x + 30 * u, head.y);
    glow.addColorStop(0, rgba(palette.primary, 0));
    glow.addColorStop(0.5, rgba(palette.light ? palette.primary : "#ffffff", 0.9));
    glow.addColorStop(1, rgba(palette.secondary, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(head.x, head.y, 30 * u * S, 9 * u * S, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

const trailSfx = (scene: Scene): SfxCue[] => {
  const n = itemsOr(scene, TRAIL, 5).length;
  const T = stepTimes(scene, n, 0.9);
  return [at(0.3, "whoosh"), ...T.map((ti) => at(ti, "pop"))];
};

/* ───────────────────────── Flip Cards ───────────────────────── */

const CARDS = ["Plan — Set your goals", "Create — Build it together", "Share — Put it out there"];

function stepCards(sc: SkillContext) {
  const { ctx, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1, aurora: 0.25 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, CARDS, 4).map(split);
  const n = P.length;
  const T = stepTimes(scene, n, 0.8);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const current = currentOf(T, t, 0.05);
  // Cards in a row (wide frames), or two columns (vertical and square).
  const cols = narrow ? Math.min(2, n) : n;
  const rows = Math.ceil(n / cols);
  const gap = 26 * u * S;
  const cw = Math.min((st.width - gap * (cols - 1)) / cols, 360 * u * S);
  const chh = Math.min((room - gap * (rows - 1)) / rows * 0.94, cw * 1.32);
  const gridW = cols * cw + (cols - 1) * gap;
  const gridH = rows * chh + (rows - 1) * gap;
  const x0 = st.left + (st.width - gridW) / 2;
  const y0 = st.top + Math.max(0, (room - gridH) / 2);
  const r = 22 * u;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Back to front: earlier cards first, the current one last (it stands forward).
  const order = P.map((_, i) => i).sort((a, b) => (a === current ? 1 : b === current ? -1 : a - b));
  for (const i of order) {
    const p = P[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ccx = x0 + col * (cw + gap) + cw / 2;
    const ccy = y0 + row * (chh + gap) + chh / 2;
    const k = clamp(spring(t - 0.15 - i * 0.1, 10, 7), 0, 1.04);
    if (k <= 0) continue;
    const theta = Math.PI * ease.inOutCubic(range(t, T[i] - 0.4, T[i] + 0.15));
    const face = theta > Math.PI / 2;
    const sx = Math.max(0.02, Math.abs(Math.cos(theta)));
    const active = i === current;
    const pop = active ? 1 + 0.06 * ease.outCubic(range(t, T[i], T[i] + 0.35)) : 1;
    // Soft shadow on the floor.
    ctx.save();
    ctx.globalAlpha *= clamp(k) * 0.5;
    ctx.fillStyle = rgba("#000000", palette.light ? 0.18 : 0.4);
    ctx.beginPath();
    ctx.ellipse(ccx, ccy + chh / 2 + 10 * u, cw * 0.42 * sx * pop, 10 * u, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= clamp(k);
    ctx.translate(ccx, ccy + (1 - Math.min(1, k)) * 60 * u - (active ? 10 * u * (pop - 1) / 0.06 : 0));
    // A flip about the vertical axis: squeezed across, with a slight shear for perspective.
    ctx.transform(sx * pop, Math.sin(theta) * 0.12 * (face ? -1 : 1), 0, pop, 0, 0);
    const x = -cw / 2;
    const y = -chh / 2;
    if (active && face) {
      ctx.shadowColor = rgba(palette.primary, 0.6);
      ctx.shadowBlur = 36 * u;
    }
    ctx.beginPath();
    ctx.roundRect(x, y, cw, chh, r);
    if (!face) {
      // The back: deep glass in the brand colours, the step's number large.
      const bg = ctx.createLinearGradient(x, y, x + cw, y + chh);
      bg.addColorStop(0, mixHex(palette.bg1, palette.primary, palette.light ? 0.35 : 0.25));
      bg.addColorStop(1, mixHex(palette.bg0, palette.secondary, palette.light ? 0.3 : 0.18));
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.shadowBlur = 0;
      const bd = ctx.createLinearGradient(x, y, x + cw, y + chh);
      bd.addColorStop(0, rgba(palette.primary, 0.9));
      bd.addColorStop(1, rgba(palette.secondary, 0.5));
      ctx.strokeStyle = bd;
      ctx.lineWidth = 2 * u;
      ctx.stroke();
      // Fine diagonal lines.
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = rgba(palette.light ? "#ffffff" : palette.text, 0.06);
      ctx.lineWidth = 1 * u;
      for (let q = -chh; q < cw; q += 14 * u) {
        ctx.beginPath();
        ctx.moveTo(x + q, y);
        ctx.lineTo(x + q + chh, y + chh);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = palette.light ? "#ffffff" : palette.text;
      ctx.font = displayFont(saasFont(sc), Math.min(cw * 0.5, chh * 0.42));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(num(i), 0, 0);
      ctx.font = subFont(20 * u * S, 750);
      ctx.fillStyle = rgba(palette.light ? "#ffffff" : palette.text, 0.7);
      ctx.fillText("STEP", 0, -chh * 0.3);
    } else {
      // The face: the step's icon, name and detail on a bright card.
      ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, palette.text, 0.07);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = active ? rgba(palette.primary, 0.9) : hair(palette, 0.16);
      ctx.lineWidth = (active ? 2.5 : 1.5) * u;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      const bar = ctx.createLinearGradient(x, 0, x + cw, 0);
      bar.addColorStop(0, palette.primary);
      bar.addColorStop(1, palette.secondary);
      ctx.fillStyle = bar;
      ctx.fillRect(x, y, cw, 8 * u);
      // A glint sweeps across as the card lands.
      const gk = range(t, T[i] + 0.05, T[i] + 0.6);
      if (gk > 0 && gk < 1) {
        const gx = x - cw * 0.5 + gk * cw * 2;
        const gl = ctx.createLinearGradient(gx - cw * 0.25, 0, gx + cw * 0.25, 0);
        gl.addColorStop(0, "rgba(255,255,255,0)");
        gl.addColorStop(0.5, `rgba(255,255,255,${palette.light ? 0.5 : 0.18})`);
        gl.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gl;
        ctx.fillRect(x, y, cw, chh);
      }
      ctx.restore();
      const tile = Math.min(cw * 0.34, chh * 0.26);
      const ty = y + chh * 0.3;
      const fs = Math.min(cw * 0.16, 58 * u * S);
      iconTile(sc, icons[i], 0, ty, tile, ease.outCubic(range(t, T[i], T[i] + 0.6)));
      smallLabel(sc, `STEP ${num(i)}`, 0, ty + tile * 0.5 + 44 * u, "center");
      ctx.fillStyle = palette.text;
      ctx.font = displayFont(saasFont(sc), fs);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const tl = fillTextFit(ctx, p.title, 0, ty + tile * 0.5 + 54 * u, cw * 0.86, { maxLines: 2, lineHeight: 1.05, minScale: 0.6 });
      if (p.detail) {
        ctx.fillStyle = rgba(palette.text, 0.7);
        ctx.font = subFont(Math.min(cw * 0.075, 27 * u * S), 500);
        fillTextFit(ctx, p.detail, 0, ty + tile * 0.5 + 68 * u + tl * fs * 1.05, cw * 0.84, { maxLines: 3, lineHeight: 1.2, minScale: 0.7 });
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

const cardsSfx = (scene: Scene): SfxCue[] => {
  const n = itemsOr(scene, CARDS, 4).length;
  const T = stepTimes(scene, n, 0.8);
  return [at(0.15, "whoosh"), ...T.map((ti) => at(ti - 0.1, "swoosh"))];
};

/* ───────────────────────── Service Orbit ───────────────────────── */

function serviceOrbit(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 0, aurora: 0.35 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, SERVICES, 6).map(split);
  const n = P.length;
  const T = serviceTimes(scene, n);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const current = currentOf(T, t, 0.05);
  const ocx = narrow ? w / 2 : st.left + st.width * 0.3;
  const ocy = narrow ? st.top + room * 0.32 : st.top + room * 0.52;
  const Rx = narrow ? Math.min(st.width * 0.46, room * 0.34) : Math.min(st.width * 0.3, room * 0.78);
  const Ry = Rx * (narrow ? 0.62 : 0.42);
  const Rc = Math.min(Ry * 0.72, Rx * 0.3);
  const D = TAU / n;
  // The orbit turns so that each service in turn reaches the front.
  let phi = Math.PI / 2;
  for (let i = 1; i < n; i++) phi -= D * ease.inOutCubic(range(t, T[i] - 0.5, T[i]));
  const enter = clamp(spring(t - 0.1, 9, 7), 0, 1.04);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const g = ctx.createLinearGradient(ocx - Rx, ocy, ocx + Rx, ocy);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  const orbit = (front: boolean) => {
    ctx.save();
    ctx.strokeStyle = g;
    ctx.globalAlpha *= front ? 0.9 : 0.35;
    ctx.lineWidth = (front ? 3 : 2) * u * S;
    ctx.beginPath();
    ctx.ellipse(ocx, ocy, Rx * enter, Ry * enter, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
    ctx.stroke();
    ctx.globalAlpha *= 0.4;
    ctx.lineWidth = 1 * u;
    ctx.beginPath();
    ctx.ellipse(ocx, ocy, Rx * 1.18 * enter, Ry * 1.18 * enter, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
    ctx.stroke();
    ctx.restore();
  };
  const planets = P.map((p, i) => {
    const a = phi + i * D;
    return { i, x: ocx + Math.cos(a) * Rx * enter, y: ocy + Math.sin(a) * Ry * enter, z: Math.sin(a) };
  });
  const drawPlanet = (pl: (typeof planets)[number]) => {
    const { i, x, y, z } = pl;
    const active = i === current;
    const k = clamp(spring(t - 0.3 - i * 0.08, 12, 7), 0, 1.06);
    if (k <= 0) return;
    const grow = active ? ease.outCubic(range(t, T[i] - 0.2, T[i] + 0.3)) : 0;
    const pr = (24 + 16 * (z + 1)) * u * S * (1 + grow * 0.55) * k;
    ctx.save();
    ctx.globalAlpha *= 0.45 + 0.55 * (z + 1) / 2;
    if (active) {
      ctx.shadowColor = rgba(palette.primary, 0.8);
      ctx.shadowBlur = 30 * u;
    }
    const pg = ctx.createLinearGradient(x - pr, y - pr, x + pr, y + pr);
    if (active) {
      pg.addColorStop(0, mixHex(palette.primary, "#ffffff", 0.25));
      pg.addColorStop(1, palette.secondary);
    } else {
      pg.addColorStop(0, palette.light ? "#ffffff" : mixHex(palette.bg1, palette.text, 0.12));
      pg.addColorStop(1, palette.light ? mixHex("#ffffff", palette.primary, 0.12) : mixHex(palette.bg0, palette.text, 0.04));
    }
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(x, y, pr, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = active ? "rgba(255,255,255,0.7)" : hair(palette, 0.2);
    ctx.lineWidth = 1.5 * u;
    ctx.stroke();
    drawIcon(ctx, icons[i], x, y, pr * 0.95, active ? onFill(palette) : rgba(palette.text, 0.7));
    ctx.restore();
  };
  // Back half of the orbit and the planets behind the core, the core, then the front.
  orbit(false);
  planets.filter((p) => p.z < 0).sort((a, b) => a.z - b.z).forEach(drawPlanet);
  // The core: a glowing sphere with slow light rays, pulsing as each service arrives.
  const pulse = current >= 0 ? 1 - range(t, T[current], T[current] + 0.6) : 0;
  ctx.save();
  ctx.translate(ocx, ocy);
  ctx.rotate(t * 0.12);
  for (let q = 0; q < 12; q++) {
    ctx.rotate(TAU / 12);
    const rg = ctx.createLinearGradient(0, 0, Rc * 2.6, 0);
    rg.addColorStop(0, rgba(palette.primary, 0.22));
    rg.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Rc * 2.6, -Rc * 0.14);
    ctx.lineTo(Rc * 2.6, Rc * 0.14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.shadowColor = rgba(palette.primary, 0.8);
  ctx.shadowBlur = (40 + pulse * 30) * u;
  const cg = ctx.createRadialGradient(ocx - Rc * 0.35, ocy - Rc * 0.4, Rc * 0.1, ocx, ocy, Rc);
  cg.addColorStop(0, mixHex(palette.primary, "#ffffff", 0.45));
  cg.addColorStop(0.6, palette.primary);
  cg.addColorStop(1, palette.secondary);
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(ocx, ocy, Rc * enter * (1 + pulse * 0.06), 0, TAU);
  ctx.fill();
  ctx.restore();
  const name = brand?.name?.trim();
  if (name && name.length <= 12) {
    ctx.fillStyle = onFill(palette);
    ctx.font = displayFont(saasFont(sc), Rc * 0.42);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, name, ocx, ocy, Rc * 1.6, { maxLines: 1, minScale: 0.5 });
  } else drawIcon(ctx, "Layers", ocx, ocy, Rc * 0.9, onFill(palette));
  orbit(true);
  planets.filter((p) => p.z >= 0).sort((a, b) => a.z - b.z).forEach(drawPlanet);
  // The current service, large, beside the orbit (under it in vertical frames).
  if (current >= 0) {
    const big = (narrow ? 60 : 70) * u * S;
    const box = narrow
      ? { x: w / 2, y: ocy + Ry + 150 * u * S, w: st.width, size: big, align: "center" as CanvasTextAlign }
      : { x: ocx + Rx + 70 * u, y: ocy - big * 0.9, w: st.left + st.width - (ocx + Rx + 70 * u), size: big, align: "left" as CanvasTextAlign };
    smallLabel(sc, `SERVICE ${num(current)}`, box.x, box.y - 8 * u, box.align, clamp((t - T[current]) / 0.3));
    stepFocus(sc, P, T, box);
  }
  ctx.restore();
}

const orbitSfx = (scene: Scene): SfxCue[] => {
  const n = itemsOr(scene, SERVICES, 6).length;
  const T = serviceTimes(scene, n);
  return [at(0.1, "whoosh"), ...T.map((ti, i) => at(ti - (i ? 0.45 : 0), i ? "swoosh" : "pop"))];
};

/* ───────────────────────── Service Carousel ───────────────────────── */

function serviceCarousel(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 0, aurora: 0.3 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, SERVICES, 6).map(split);
  const n = P.length;
  const T = serviceTimes(scene, n);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  let pos = 0;
  for (let i = 1; i < n; i++) pos += ease.inOutCubic(range(t, T[i] - 0.5, T[i]));
  const current = Math.round(pos);
  const cw = narrow ? Math.min(st.width * 0.64, 520 * u * S) : Math.min(st.width * 0.34, 470 * u * S);
  const chh = Math.min(room * 0.8, cw * 1.12);
  const cx = w / 2;
  const cy = st.top + room * 0.48;
  const enter = clamp(spring(t - 0.1, 9, 7), 0, 1.04);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Spotlights from above onto the centre card.
  for (const side of [-1, 1]) {
    const sx = cx + side * cw * 0.9;
    const sg = ctx.createLinearGradient(0, st.top - 40 * u, 0, cy + chh * 0.5);
    sg.addColorStop(0, rgba(palette.light ? palette.primary : "#ffffff", palette.light ? 0.1 : 0.07));
    sg.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(sx - 8 * u, st.top - 40 * u);
    ctx.lineTo(sx + 8 * u, st.top - 40 * u);
    ctx.lineTo(cx + side * cw * 0.05, cy + chh * 0.5);
    ctx.lineTo(cx - side * cw * 0.45, cy + chh * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  // A pool of light on the floor under the centre card.
  const floor = ctx.createLinearGradient(cx - cw, 0, cx + cw, 0);
  floor.addColorStop(0, rgba(palette.primary, 0));
  floor.addColorStop(0.5, rgba(palette.primary, palette.light ? 0.18 : 0.3));
  floor.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.ellipse(cx, cy + chh / 2 + 16 * u, cw * 0.8, 18 * u, 0, 0, TAU);
  ctx.fill();
  const cards = P.map((_, i) => ({ i, p: i - pos })).filter((c) => Math.abs(c.p) < (narrow ? 1.9 : 2.6)).sort((a, b) => Math.abs(b.p) - Math.abs(a.p));
  for (const { i, p } of cards) {
    const ap = Math.abs(p);
    const side = Math.sign(p);
    const near = narrow ? 0.6 : 0.8;
    const far = narrow ? 0.16 : 0.42;
    const x = cx + side * (ap <= 1 ? ap * cw * near : cw * near + (ap - 1) * cw * far);
    const sc0 = (1 - Math.min(ap, 2) * 0.17) * enter;
    const squeeze = 1 - Math.min(ap, 1) * (narrow ? 0.45 : 0.28);
    const k = clamp(spring(t - 0.15 - i * 0.06, 11, 7), 0, 1.04);
    if (k <= 0) continue;
    ctx.save();
    ctx.globalAlpha *= clamp(k) * (1 - Math.min(ap, 2) * 0.32);
    ctx.translate(x, cy);
    // Turned towards the centre: squeezed across, sheared as if in perspective.
    ctx.transform(squeeze * sc0, -clamp(p, -1, 1) * 0.1 * sc0, 0, sc0, 0, 0);
    const x0 = -cw / 2;
    const y0 = -chh / 2;
    const focus = 1 - Math.min(1, ap);
    if (focus > 0.5) {
      ctx.shadowColor = rgba(palette.primary, 0.55 * focus);
      ctx.shadowBlur = 40 * u;
    }
    glassCard(sc, x0, y0, cw, chh, { r: 26 * u, tint: palette.bg1 });
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.roundRect(x0, y0, cw, chh, 26 * u);
    const bd = ctx.createLinearGradient(x0, y0, x0 + cw, y0);
    bd.addColorStop(0, rgba(palette.primary, 0.3 + 0.6 * focus));
    bd.addColorStop(1, rgba(palette.secondary, 0.2 + 0.5 * focus));
    ctx.strokeStyle = bd;
    ctx.lineWidth = (1.5 + 1.5 * focus) * u;
    ctx.stroke();
    // Darker on the side turned away.
    if (ap > 0.05) {
      ctx.save();
      ctx.clip();
      const sh = ctx.createLinearGradient(x0, 0, x0 + cw, 0);
      sh.addColorStop(side > 0 ? 0 : 1, "rgba(0,0,0,0)");
      sh.addColorStop(side > 0 ? 1 : 0, `rgba(0,0,0,${0.35 * Math.min(1, ap)})`);
      ctx.fillStyle = sh;
      ctx.fillRect(x0, y0, cw, chh);
      ctx.restore();
    }
    const tile = Math.min(cw * 0.3, chh * 0.26);
    iconTile(sc, icons[i], 0, y0 + chh * 0.3, tile);
    smallLabel(sc, `SERVICE ${num(i)}`, 0, y0 + chh * 0.3 + tile * 0.5 + 42 * u, "center", 0.5 + 0.5 * focus);
    ctx.fillStyle = palette.text;
    const ts = Math.min(cw * 0.12, 52 * u * S);
    ctx.font = displayFont(saasFont(sc), ts);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const tl = fillTextFit(ctx, P[i].title, 0, y0 + chh * 0.3 + tile * 0.5 + 52 * u, cw * 0.86, { maxLines: 2, lineHeight: 1.05, minScale: 0.6 });
    if (P[i].detail) {
      ctx.globalAlpha *= 0.4 + 0.6 * focus;
      ctx.fillStyle = rgba(palette.text, 0.7);
      ctx.font = subFont(Math.min(cw * 0.055, 24 * u * S), 500);
      fillTextFit(ctx, P[i].detail, 0, y0 + chh * 0.3 + tile * 0.5 + 64 * u + tl * ts * 1.05, cw * 0.82, { maxLines: 2, lineHeight: 1.2, minScale: 0.7 });
    }
    ctx.restore();
  }
  // Which one of how many: a dot per service.
  const dy = Math.min(st.bottom - 12 * u, cy + chh / 2 + 46 * u);
  for (let i = 0; i < n; i++) {
    const on = i === current;
    ctx.fillStyle = on ? palette.primary : rgba(palette.text, 0.22);
    ctx.beginPath();
    ctx.roundRect(cx + (i - (n - 1) / 2) * 24 * u - (on ? 12 : 4) * u, dy - 4 * u, (on ? 24 : 8) * u, 8 * u, 4 * u);
    ctx.fill();
  }
  ctx.restore();
}

const carouselSfx = (scene: Scene): SfxCue[] => {
  const n = itemsOr(scene, SERVICES, 6).length;
  const T = serviceTimes(scene, n);
  return [at(0.1, "whoosh"), ...T.slice(1).map((ti) => at(ti - 0.45, "swoosh"))];
};

/* ───────────────────────── Hex Grid ───────────────────────── */

/** Axial hex coordinates spiralling out from the centre. */
const SPIRAL: [number, number][] = [
  [0, 0], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
  [2, -1], [2, 0], [1, 1], [0, 2], [-1, 2], [-2, 2], [-2, 1], [-2, 0], [-1, -1], [0, -2], [1, -2], [2, -2],
];

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * TAU) / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (k) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function serviceHex(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 0, aurora: 0.3 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, SERVICES, 6).map(split);
  const n = P.length;
  const T = serviceTimes(scene, n);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const current = currentOf(T, t, 0.05);
  const hcx = narrow ? w / 2 : st.left + st.width * 0.28;
  const hcy = narrow ? st.top + room * 0.36 : st.top + room * 0.5;
  const R = narrow ? Math.min(st.width * 0.14, room * 0.09) : Math.min(room * 0.2, st.width * 0.09);
  const gapF = 1.08;
  const raw = (q: number, r: number) => ({ x: R * gapF * Math.sqrt(3) * (q + r / 2), y: R * gapF * 1.5 * r });
  // Centre the service cells (not the spiral's first cell) on the grid's spot.
  const used = SPIRAL.slice(0, n).map(([q, r]) => raw(q, r));
  const mx = (Math.min(...used.map((p) => p.x)) + Math.max(...used.map((p) => p.x))) / 2;
  const my = (Math.min(...used.map((p) => p.y)) + Math.max(...used.map((p) => p.y))) / 2;
  const cell = (q: number, r: number) => {
    const p = raw(q, r);
    return { x: hcx + p.x - mx, y: hcy + p.y - my };
  };
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Filler cells: faint outlines with a shimmer rolling across them.
  for (let j = n; j < SPIRAL.length; j++) {
    const [q, r] = SPIRAL[j];
    const c = cell(q, r);
    const k = clamp(spring(t - 0.1 - j * 0.03, 12, 7), 0, 1.04);
    if (k <= 0) continue;
    const shimmer = 0.5 + 0.5 * Math.sin(t * 2 - (c.x + c.y) / (R * 3));
    ctx.save();
    ctx.globalAlpha *= clamp(k) * (0.25 + 0.2 * shimmer);
    ctx.strokeStyle = rgba(palette.primary, 0.6);
    ctx.lineWidth = 1.5 * u;
    hexPath(ctx, c.x, c.y, R * 0.92 * k);
    ctx.stroke();
    ctx.restore();
  }
  // A beam of light rising behind the current tile.
  if (current >= 0) {
    const [q, r] = SPIRAL[current];
    const c = cell(q, r);
    const bk = ease.outCubic(range(t, T[current], T[current] + 0.5));
    const bg = ctx.createLinearGradient(0, c.y, 0, c.y - room * 0.7);
    bg.addColorStop(0, rgba(palette.primary, 0.3 * bk));
    bg.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(c.x - R * 0.8, c.y);
    ctx.lineTo(c.x + R * 0.8, c.y);
    ctx.lineTo(c.x + R * 0.4, c.y - room * 0.7);
    ctx.lineTo(c.x - R * 0.4, c.y - room * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  // The service tiles; the current one rises in 3D and glows.
  const order = P.map((_, i) => i).sort((a, b) => (a === current ? 1 : b === current ? -1 : a - b));
  for (const i of order) {
    const [q, r] = SPIRAL[i];
    const c = cell(q, r);
    const k = clamp(spring(t - 0.2 - i * 0.08, 12, 7), 0, 1.06);
    if (k <= 0) continue;
    const active = i === current;
    const rise = active ? ease.outCubic(range(t, T[i] - 0.1, T[i] + 0.35)) : 0;
    const visited = current >= 0 && i < current;
    const rr = R * 0.92 * k * (1 + rise * 0.14);
    const lift = rise * 16 * u * S;
    ctx.save();
    // The tile's 3D side, below it while it is raised.
    if (rise > 0) {
      for (let d = Math.round(lift / u); d >= 0; d -= 2) {
        ctx.fillStyle = mixHex(palette.secondary, "#000000", 0.35 + 0.2 * (d / Math.max(1, lift / u)));
        hexPath(ctx, c.x, c.y - lift + d * u, rr);
        ctx.fill();
      }
      ctx.shadowColor = rgba(palette.primary, 0.8);
      ctx.shadowBlur = 34 * u;
    }
    hexPath(ctx, c.x, c.y - lift, rr);
    if (active) {
      const hg = ctx.createLinearGradient(c.x - rr, 0, c.x + rr, 0);
      hg.addColorStop(0, mixHex(palette.primary, "#ffffff", 0.2));
      hg.addColorStop(1, palette.secondary);
      ctx.fillStyle = hg;
    } else ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, palette.text, 0.07);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = active ? "rgba(255,255,255,0.65)" : visited ? rgba(palette.primary, 0.7) : hair(palette, 0.2);
    ctx.lineWidth = (active ? 2 : 1.5) * u;
    ctx.stroke();
    drawIcon(ctx, icons[i], c.x, c.y - lift, rr * 0.8, active ? onFill(palette) : visited ? palette.primary : rgba(palette.text, 0.65));
    ctx.restore();
  }
  // The current service, large, beside the grid (under it in vertical frames).
  if (current >= 0) {
    const big = (narrow ? 60 : 70) * u * S;
    const right = hcx + R * gapF * Math.sqrt(3) * 1.9;
    const box = narrow
      ? { x: w / 2, y: hcy + (Math.max(...used.map((p) => p.y)) - my) + R + 80 * u, w: st.width, size: big, align: "center" as CanvasTextAlign }
      : { x: right + 40 * u, y: hcy - big * 0.9, w: st.left + st.width - right - 40 * u, size: big, align: "left" as CanvasTextAlign };
    smallLabel(sc, `SERVICE ${num(current)}`, box.x, box.y - 8 * u, box.align, clamp((t - T[current]) / 0.3));
    stepFocus(sc, P, T, box);
  }
  ctx.restore();
}

const hexSfx = (scene: Scene): SfxCue[] => {
  const n = itemsOr(scene, SERVICES, 6).length;
  const T = serviceTimes(scene, n);
  return [at(0.1, "shimmer"), ...T.map((ti) => at(ti, "pop"))];
};

/* ───────────────────────── Registry ───────────────────────── */

export const epicProcessSkills: Skill[] = [
  {
    id: "step-portals",
    name: "Step Portals",
    tagline: "The camera flies through glowing rings, one per step, with light streaks as it moves; each step is named large inside its ring as the camera arrives.",
    bestFor: "An epic how-it-works or process: 3–5 steps ('Step — short detail'). Launch and trailer-like videos, bold styles.",
    sample: { text: "From idea to *launch*", items: FLOW },
    itemsHint: "3–5 steps: 'Step — short detail'",
    render: stepPortals,
    sfx: portalSfx,
  },
  {
    id: "light-trail",
    name: "Light Trail",
    tagline: "A comet races along a sweeping path and ignites each step with a burst of light; the step it reaches is named large beside its orb.",
    bestFor: "A journey or onboarding path: 3–5 steps ('Step — short detail'). Energetic launch videos.",
    sample: { text: "Your path to *launch*", items: TRAIL },
    itemsHint: "3–5 steps: 'Step — short detail'",
    render: lightTrail,
    sfx: trailSfx,
  },
  {
    id: "step-cards",
    name: "Flip Cards",
    tagline: "Big numbered cards flip over one by one to reveal each step's icon, name and detail, a glint sweeping across as they land; the current card stands forward.",
    bestFor: "A short process or plan: 2–4 steps ('Step — short detail'). Clear, tactile how-it-works.",
    sample: { text: "Getting *started*", items: CARDS },
    itemsHint: "2–4 steps: 'Step — short detail'",
    render: stepCards,
    sfx: cardsSfx,
  },
  {
    id: "service-orbit",
    name: "Service Orbit",
    tagline: "Services orbit a glowing core like planets; the current one swings to the front, grows and is named large beside the orbit.",
    bestFor: "What a company offers, staged big: 3–6 services ('Service — short description'). Agencies, studios, platforms with several products.",
    sample: { text: "What we *offer*", items: SERVICES },
    itemsHint: "3–6 services: 'Service — short description'",
    render: serviceOrbit,
    sfx: orbitSfx,
  },
  {
    id: "service-carousel",
    name: "Service Carousel",
    tagline: "A 3D cover-flow of service cards under spotlights glides to each service in turn, the current card large and facing the camera.",
    bestFor: "Services or products to browse: 2–6 ('Service — short description'). Agencies, studios, product lines.",
    sample: { text: "Our *services*", items: SERVICES },
    itemsHint: "2–6 services: 'Service — short description'",
    render: serviceCarousel,
    sfx: carouselSfx,
  },
  {
    id: "service-hex",
    name: "Hex Grid",
    tagline: "A honeycomb of service tiles; the current one rises in 3D under a beam of light and is named large beside the grid.",
    bestFor: "Services or capabilities with a tech feel: 2–6 ('Service — short description'). Platforms, IT and consulting.",
    sample: { text: "How we *help*", items: SERVICES },
    itemsHint: "2–6 services: 'Service — short description'",
    render: serviceHex,
    sfx: hexSfx,
  },
];
