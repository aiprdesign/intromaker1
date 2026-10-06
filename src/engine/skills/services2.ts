/**
 * Creative services slides: "what we offer", staged six more ways. Each shows one service at a
 * time, large, so the viewer always knows which one is being told. Items read
 * "Service — short description".
 *
 * - service-cube:      a big 3D cube turns a quarter turn for each service, the service on the face
 *                      that comes round; its name is told large beside it.
 * - service-bloom:     services open out like petals round the brand; the current petal stretches
 *                      out and glows, and its name is told large beside the flower.
 * - service-fan:       service cards fanned like a hand of cards; the current card lifts out, turns
 *                      upright and grows to fill the stage, then slides back.
 * - service-board:     an airport-style split-flap board: its letters flip into the service names,
 *                      the current row lights up and a ticker types its detail.
 * - service-bento:     a bento grid where the current service's tile grows into the big tile while
 *                      the others shrink and rearrange round it.
 * - service-spotlight: a dark stage with the services on plinths; a spotlight swings to each in
 *                      turn, the lit one rises and glows, and its name is told large in capitals
 *                      under the stage.
 *
 * Every frame is a pure function of time, so preview, seek and export match.
 */
import { clamp, ease, hashString, lerp, mixHex, range, rgba, TAU } from "../math";
import { drawIcon, glassCard, iconsFor, saasBackground, saasFont, spring } from "../saasfx";
import { displayFont, fillTextFit, subFont } from "../text";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { hair, itemsOr, split } from "./beats";
import { currentOf, serviceTimes, smallLabel } from "./epicprocess";
import { iconTile } from "./interactions";
import { SERVICES, frame, num, onFill, stepColor, stepFocus } from "./process";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const itemsOf = (scene: Scene) => itemsOr(scene, SERVICES, 6).map(split);
type Rect = { x: number; y: number; w: number; h: number };

/** Progress through the services: i at the i-th service's turn, easing over `lead` seconds before it. */
function servicePos(T: number[], t: number, lead = 0.5) {
  let pos = 0;
  for (let i = 1; i < T.length; i++) pos += ease.inOutCubic(range(t, T[i] - lead, T[i]));
  return pos;
}

/** The large name of the current service with its label, at `box` (see stepFocus). */
function tellService(sc: SkillContext, P: { title: string; detail: string }[], T: number[], box: { x: number; y: number; w: number; size: number; align: CanvasTextAlign; underline?: boolean }) {
  const cur = currentOf(T, sc.t, 0.05);
  if (cur < 0) return;
  smallLabel(sc, `SERVICE ${num(cur)}`, box.x, box.y - 8 * sc.u, box.align, clamp((sc.t - T[cur]) / 0.3));
  stepFocus(sc, P, T, box);
}

/** Where the large name goes: beside the visual in wide frames, under it in vertical ones. */
function sideBox(sc: SkillContext, st: ReturnType<typeof frame>, rightOf: number, cy: number, below: number) {
  const big = (st.narrow ? 60 : 70) * sc.u * st.S;
  return st.narrow
    ? { x: sc.w / 2, y: below, w: st.width, size: big, align: "center" as CanvasTextAlign }
    : { x: rightOf, y: cy - big * 0.9, w: st.left + st.width - rightOf, size: big, align: "left" as CanvasTextAlign };
}

/* ───────────────────────── Service Cube ───────────────────────── */

function serviceCube(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 0, aurora: 0.35 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOf(scene);
  const n = P.length;
  const T = serviceTimes(scene, n);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const L = narrow ? Math.min(st.width * 0.46, room * 0.28) : Math.min(room * 0.5, st.width * 0.25);
  const cx = narrow ? w / 2 : st.left + st.width * 0.27;
  const cy = (narrow ? st.top + room * 0.3 : st.top + room * 0.5) + Math.sin(t * 1.2) * 6 * u;
  const k = 0.3;
  // Turns: spins in, then a quarter turn just before each service's turn.
  const s = servicePos(T, t, 0.55) - 1 + ease.outCubic(range(t, 0.1, T[0]));
  // (Turned a little, so the next service's face peeks round the side and the cube reads as 3D.)
  const theta = -s * (Math.PI / 2) - 0.45;
  const h = L / 2;
  const r = h * Math.SQRT2;
  const topY = cy - h;
  const corner = (j: number) => {
    const ph = theta + Math.PI / 4 + (j * Math.PI) / 2;
    return { x: cx + r * Math.cos(ph), z: r * Math.sin(ph) };
  };
  const enter = clamp(spring(t - 0.05, 9, 7), 0, 1.04);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Shadow on the floor.
  ctx.save();
  ctx.fillStyle = rgba("#000000", palette.light ? 0.16 : 0.4);
  ctx.beginPath();
  ctx.ellipse(cx, cy + h + r * k + 26 * u, r * 1.05 * enter, 14 * u, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.translate(cx, cy);
  ctx.scale(enter, enter);
  ctx.translate(-cx, -cy);
  const sr = Math.round(s);
  const front = (((sr % 4) + 4) % 4);
  // The lid, seen from a little above.
  const lid = [0, 1, 2, 3].map(corner);
  ctx.beginPath();
  lid.forEach((c, j) => (j ? ctx.lineTo(c.x, topY + k * c.z) : ctx.moveTo(c.x, topY + k * c.z)));
  ctx.closePath();
  const lg = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  lg.addColorStop(0, mixHex(palette.primary, "#ffffff", 0.45));
  lg.addColorStop(1, mixHex(palette.secondary, "#ffffff", 0.3));
  ctx.fillStyle = lg;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5 * u;
  ctx.stroke();
  // The side faces turned towards the camera.
  for (let j = 0; j < 4; j++) {
    const mid = theta + Math.PI / 2 + (j * Math.PI) / 2;
    const facing = Math.sin(mid);
    if (facing <= 0.001) continue;
    // (Left corner to right corner as seen from the front.)
    const a = corner(j + 1);
    const b = corner(j);
    // Light from the upper left: the face turned left is brighter.
    const light = clamp(0.62 + 0.38 * Math.cos(mid - Math.PI / 2 - 0.5));
    ctx.save();
    ctx.transform((b.x - a.x) / L, (k * (b.z - a.z)) / L, 0, 1, a.x, topY + k * a.z);
    const c0 = stepColor(palette, j % 2, 2);
    const fg = ctx.createLinearGradient(0, 0, L, 0);
    fg.addColorStop(0, mixHex(c0, "#000000", (1 - light) * 0.7));
    fg.addColorStop(1, mixHex(mixHex(c0, palette.secondary, 0.5), "#000000", (1 - light) * 0.7 + 0.08));
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, L, L);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5 * u;
    ctx.strokeRect(0, 0, L, L);
    // Which service sits on this face: the current one, the next or the previous.
    let d = (((j - front) % 4) + 4) % 4;
    if (d === 3) d = -1;
    const si = sr + d;
    ctx.globalAlpha *= 0.35 + 0.65 * light;
    if (si >= 0 && si < n) {
      drawIcon(ctx, icons[si], L / 2, L * 0.4, L * 0.36, onFill(palette));
      ctx.fillStyle = onFill(palette);
      ctx.font = displayFont(saasFont(sc), L * 0.1);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      fillTextFit(ctx, P[si].title, L / 2, L * 0.74, L * 0.84, { maxLines: 2, lineHeight: 1.05, minScale: 0.6 });
      ctx.font = subFont(L * 0.05, 750);
      ctx.globalAlpha *= 0.75;
      ctx.fillText(`SERVICE ${num(si)}`, L / 2, L * 0.14);
    } else {
      const name = brand?.name?.trim();
      if (name && name.length <= 14) {
        ctx.fillStyle = onFill(palette);
        ctx.font = displayFont(saasFont(sc), L * 0.12);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        fillTextFit(ctx, name, L / 2, L / 2, L * 0.8, { maxLines: 1, minScale: 0.5 });
      } else drawIcon(ctx, "Layers", L / 2, L / 2, L * 0.36, onFill(palette));
    }
    // A glint sweeps across the face as it turns.
    const turning = Math.abs(s - sr);
    if (turning > 0.02) {
      const gx = (1 - (s - Math.floor(s))) * L * 1.6 - L * 0.3;
      const gl = ctx.createLinearGradient(gx - L * 0.2, 0, gx + L * 0.2, 0);
      gl.addColorStop(0, "rgba(255,255,255,0)");
      gl.addColorStop(0.5, "rgba(255,255,255,0.22)");
      gl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, L, L);
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  tellService(sc, P, T, sideBox(sc, st, cx + r + 80 * u, cy, cy + h + r * k + 90 * u));
  ctx.restore();
}

const cubeSfx = (scene: Scene): SfxCue[] => {
  const T = serviceTimes(scene, itemsOf(scene).length);
  return [at(0.1, "whoosh"), ...T.slice(1).map((ti) => at(ti - 0.5, "swoosh")), at(T[0], "pop")];
};

/* ───────────────────────── Service Bloom ───────────────────────── */

function serviceBloom(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 0, aurora: 0.35 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOf(scene);
  const n = P.length;
  const T = serviceTimes(scene, n);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const cur = currentOf(T, t, 0.05);
  const Lp = narrow ? Math.min(st.width * 0.36, room * 0.22) : Math.min(room * 0.44, st.width * 0.2);
  const fcx = narrow ? w / 2 : st.left + st.width * 0.28;
  const fcy = narrow ? st.top + room * 0.3 : st.top + room * 0.52;
  const rot = -Math.PI / 2 + Math.sin(t * 0.6) * 0.03;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Pollen: small dots drifting round the flower.
  for (let q = 0; q < 26; q++) {
    const hsh = hashString(`pollen${q}`);
    const a = ((hsh % 1000) / 1000) * TAU + t * (0.1 + (q % 5) * 0.03);
    const rr = Lp * (0.5 + ((hsh >> 10) % 100) / 80);
    ctx.fillStyle = rgba(q % 2 ? palette.primary : palette.secondary, 0.35 * clamp(t / 0.8));
    ctx.beginPath();
    ctx.arc(fcx + Math.cos(a) * rr, fcy + Math.sin(a) * rr * 0.9, (1.5 + (q % 3)) * u, 0, TAU);
    ctx.fill();
  }
  const order = P.map((_, i) => i).sort((a, b) => (a === cur ? 1 : b === cur ? -1 : a - b));
  for (const i of order) {
    const ang = rot + (i * TAU) / n;
    const grow = clamp(spring(t - 0.2 - i * 0.12, 9, 7), 0, 1.06);
    if (grow <= 0) continue;
    const active = i === cur;
    const ext = active ? 1 + 0.24 * ease.outCubic(range(t, T[i] - 0.1, T[i] + 0.35)) : 1;
    const len = Lp * grow * ext;
    const wid = Math.min(len * 0.36, Lp * Math.sin(Math.PI / Math.max(2, n)) * 0.95);
    const c0 = stepColor(palette, i, n);
    ctx.save();
    ctx.translate(fcx, fcy);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.45, -wid * 1.3, len, 0);
    ctx.quadraticCurveTo(len * 0.45, wid * 1.3, 0, 0);
    const pg = ctx.createLinearGradient(0, 0, len, 0);
    if (active) {
      pg.addColorStop(0, mixHex(c0, "#ffffff", 0.15));
      pg.addColorStop(1, mixHex(c0, palette.secondary, 0.6));
      ctx.shadowColor = rgba(palette.primary, 0.75);
      ctx.shadowBlur = 30 * u;
    } else {
      pg.addColorStop(0, rgba(c0, palette.light ? 0.35 : 0.3));
      pg.addColorStop(1, rgba(mixHex(c0, palette.secondary, 0.6), palette.light ? 0.55 : 0.5));
    }
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = active ? "rgba(255,255,255,0.6)" : rgba(c0, 0.6);
    ctx.lineWidth = 1.5 * u;
    ctx.stroke();
    // The petal's vein.
    ctx.strokeStyle = rgba(active ? "#ffffff" : c0, active ? 0.4 : 0.35);
    ctx.lineWidth = 1 * u;
    ctx.beginPath();
    ctx.moveTo(len * 0.12, 0);
    ctx.lineTo(len * 0.5, 0);
    ctx.stroke();
    ctx.restore();
    // The service's icon near the petal's tip, upright.
    const ix = fcx + Math.cos(ang) * len * 0.7;
    const iy = fcy + Math.sin(ang) * len * 0.7;
    drawIcon(ctx, icons[i], ix, iy, Math.min(wid * 1.1, 56 * u * S) * (active ? 1.15 : 1), active ? onFill(palette) : rgba(palette.text, 0.75), ease.outCubic(range(t, 0.4 + i * 0.12, 1.1 + i * 0.12)));
  }
  // The heart of the flower: the brand.
  const pulse = cur >= 0 ? 1 - range(t, T[cur], T[cur] + 0.6) : 0;
  const hr = Lp * 0.24 * clamp(spring(t - 0.05, 10, 7), 0, 1.05) * (1 + pulse * 0.06);
  ctx.save();
  ctx.shadowColor = rgba(palette.primary, 0.7);
  ctx.shadowBlur = (24 + pulse * 20) * u;
  const hg = ctx.createLinearGradient(fcx - hr, 0, fcx + hr, 0);
  hg.addColorStop(0, mixHex(palette.primary, "#ffffff", 0.35));
  hg.addColorStop(1, palette.secondary);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(fcx, fcy, hr, 0, TAU);
  ctx.fill();
  ctx.restore();
  const name = brand?.name?.trim();
  if (name && name.length <= 10) {
    ctx.fillStyle = onFill(palette);
    ctx.font = displayFont(saasFont(sc), hr * 0.5);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, name, fcx, fcy, hr * 1.7, { maxLines: 1, minScale: 0.5 });
  } else drawIcon(ctx, "Sparkles", fcx, fcy, hr, onFill(palette));
  tellService(sc, P, T, sideBox(sc, st, fcx + Lp * 1.3 + 50 * u, fcy, fcy + Lp * 1.3 + 50 * u));
  ctx.restore();
}

const bloomSfx = (scene: Scene): SfxCue[] => {
  const T = serviceTimes(scene, itemsOf(scene).length);
  return [at(0.2, "shimmer"), ...T.map((ti) => at(ti, "pop"))];
};

/* ───────────────────────── Card Fan ───────────────────────── */

function serviceFan(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1, aurora: 0.25 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOf(scene);
  const n = P.length;
  const T = serviceTimes(scene, n);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const cw = narrow ? Math.min(st.width * 0.3, 230 * u * S) : Math.min(st.width * 0.15, 250 * u * S);
  const chh = cw * 1.4;
  const px = w / 2;
  const py = st.bottom + chh * 0.55;
  const R = chh * 1.25;
  const spread = Math.min(0.24, 1.1 / Math.max(2, n));
  const fx = w / 2;
  const fy = st.top + room * (narrow ? 0.36 : 0.42);
  const big = Math.min(2.6, (room * 0.74) / chh, (st.width * 0.8) / cw);
  const lift = (i: number) => {
    const up = ease.inOutCubic(range(t, T[i] - 0.2, T[i] + 0.35));
    const down = i + 1 < n ? ease.inOutCubic(range(t, T[i + 1] - 0.45, T[i + 1] - 0.05)) : 0;
    return up * (1 - down);
  };
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const order = P.map((_, i) => ({ i, l: lift(i) })).sort((a, b) => a.l - b.l || a.i - b.i);
  for (const { i, l } of order) {
    const deal = clamp(spring(t - 0.15 - i * 0.07, 10, 7), 0, 1.04);
    if (deal <= 0) continue;
    const ang = (i - (n - 1) / 2) * spread;
    const bx = px + Math.sin(ang) * R;
    const by = py - Math.cos(ang) * R + (1 - Math.min(1, deal)) * room * 0.4;
    const e = ease.inOutCubic(l);
    const x = lerp(bx, fx, e) + Math.sin(l * Math.PI) * cw * 0.15 * Math.sign(ang || 1);
    const y = lerp(by, fy, e);
    const sca = lerp(1, big, e);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lerp(ang, 0, e));
    ctx.scale(sca, sca);
    const x0 = -cw / 2;
    const y0 = -chh / 2;
    ctx.shadowColor = l > 0.3 ? rgba(palette.primary, 0.5) : "rgba(0,0,0,0.35)";
    ctx.shadowBlur = (l > 0.3 ? 30 : 14) * u;
    ctx.shadowOffsetY = 4 * u;
    ctx.beginPath();
    ctx.roundRect(x0, y0, cw, chh, 14 * u);
    ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, palette.text, 0.08);
    ctx.fill();
    ctx.shadowColor = "transparent";
    const bd = ctx.createLinearGradient(x0, 0, x0 + cw, 0);
    bd.addColorStop(0, rgba(palette.primary, 0.4 + 0.5 * l));
    bd.addColorStop(1, rgba(palette.secondary, 0.3 + 0.5 * l));
    ctx.strokeStyle = bd;
    ctx.lineWidth = 1.5 * u;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    const hd = ctx.createLinearGradient(x0, 0, x0 + cw, 0);
    hd.addColorStop(0, stepColor(palette, i, n));
    hd.addColorStop(1, mixHex(stepColor(palette, i, n), palette.secondary, 0.5));
    ctx.fillStyle = hd;
    ctx.fillRect(x0, y0, cw, chh * 0.34);
    ctx.restore();
    drawIcon(ctx, icons[i], 0, y0 + chh * 0.17, cw * 0.36, onFill(palette));
    ctx.fillStyle = palette.primary;
    ctx.font = subFont(cw * 0.06, 750);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`SERVICE ${num(i)}`, 0, y0 + chh * 0.43);
    ctx.fillStyle = palette.text;
    ctx.font = displayFont(saasFont(sc), cw * 0.12);
    ctx.textBaseline = "top";
    const tl = fillTextFit(ctx, P[i].title, 0, y0 + chh * 0.5, cw * 0.86, { maxLines: 2, lineHeight: 1.05, minScale: 0.6 });
    if (P[i].detail && l > 0.4) {
      ctx.globalAlpha *= clamp((l - 0.4) / 0.4);
      ctx.fillStyle = rgba(palette.text, 0.7);
      ctx.font = subFont(cw * 0.065, 500);
      fillTextFit(ctx, P[i].detail, 0, y0 + chh * 0.53 + tl * cw * 0.12 * 1.05, cw * 0.84, { maxLines: 3, lineHeight: 1.2, minScale: 0.7 });
    }
    ctx.restore();
  }
  ctx.restore();
}

const fanSfx = (scene: Scene): SfxCue[] => {
  const T = serviceTimes(scene, itemsOf(scene).length);
  return [at(0.15, "swoosh"), ...T.map((ti) => at(ti - 0.15, "swoosh"))];
};

/* ───────────────────────── Departure Board ───────────────────────── */

const FLAPS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&-";

function serviceBoard(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 0, aurora: 0.25 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOf(scene);
  const n = P.length;
  const T = serviceTimes(scene, n);
  const room = st.bottom - st.top;
  const cur = currentOf(T, t, 0.05);
  const bw = st.width * (narrow ? 1 : 0.94);
  const rowH = Math.min((room * 0.8) / (n + 1.6), 96 * u * S);
  const statusW = rowH * 1.9;
  // The flaps shrink to fit the longest name (up to 18 letters) across the board.
  const longest = Math.min(18, Math.max(6, ...P.map((p) => p.title.length)));
  const avail = bw - rowH * 1.2 - statusW;
  const cellW = Math.min(rowH * 0.5, avail / (longest * 1.1));
  const gapC = cellW * 0.1;
  const maxChars = Math.max(longest, Math.min(18, Math.floor(avail / (cellW + gapC))));
  const bh = rowH * (n + 1.6);
  const bx = w / 2 - bw / 2;
  const by = st.top + Math.max(0, (room - bh) * 0.45);
  const mono = displayFont("mono", Math.min(rowH * 0.5, cellW * 1.05));
  ctx.save();
  ctx.globalAlpha = (1 - ex) * clamp(t / 0.3);
  // The board: a dark panel with a fine frame (a board stays dark in any palette).
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 30 * u;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 18 * u);
  const panel = ctx.createLinearGradient(0, by, 0, by + bh);
  panel.addColorStop(0, "#1a1d27");
  panel.addColorStop(1, "#0d0f15");
  ctx.fillStyle = panel;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(palette.primary, 0.35);
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 18 * u);
  ctx.stroke();
  // Header.
  const accent = mixHex(palette.primary, "#ffffff", 0.25);
  ctx.fillStyle = accent;
  ctx.font = subFont(rowH * 0.28, 750);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.letterSpacing = `${3 * u}px`;
  ctx.fillText("SERVICES", bx + rowH * 0.6, by + rowH * 0.5);
  ctx.textAlign = "right";
  ctx.fillText("NOW", bx + bw - rowH * 0.6, by + rowH * 0.5);
  ctx.letterSpacing = "0px";
  // The highlight glides to the current row.
  const pos = servicePos(T, t, 0.35);
  const rowY = (i: number) => by + rowH * (1 + i);
  if (cur >= 0) {
    const hy = rowY(pos);
    const hg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    hg.addColorStop(0, rgba(palette.primary, 0.32));
    hg.addColorStop(1, rgba(palette.primary, 0.04));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.roundRect(bx + rowH * 0.25, hy + rowH * 0.06, bw - rowH * 0.5, rowH * 0.88, 10 * u);
    ctx.fill();
    ctx.fillStyle = palette.primary;
    ctx.fillRect(bx + rowH * 0.25, hy + rowH * 0.2, 4 * u, rowH * 0.6);
  }
  P.forEach((p, i) => {
    const y = rowY(i);
    const name = p.title.toUpperCase().replace(/[^A-Z0-9&\- ]/g, "").slice(0, maxChars);
    const active = i === cur;
    for (let c = 0; c < maxChars; c++) {
      const cx0 = bx + rowH * 0.6 + c * (cellW + gapC);
      const settle = 0.35 + i * 0.16 + c * 0.04;
      const ch = name[c] ?? " ";
      // Each flap cycles through letters until it settles on its own.
      const flipping = t < settle;
      const shown = flipping ? FLAPS[(hashString(`${i}-${c}`) + Math.floor(t * 18)) % FLAPS.length] : ch;
      ctx.fillStyle = active ? "#2a2f3d" : "#20242f";
      ctx.beginPath();
      ctx.roundRect(cx0, y + rowH * 0.12, cellW, rowH * 0.76, 5 * u);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(cx0, y + rowH * 0.12, cellW, rowH * 0.38);
      if (shown.trim() && t > 0.2 + i * 0.16) {
        ctx.save();
        // A flap mid-turn is squashed for a moment.
        const sq = flipping ? 0.7 + 0.3 * Math.abs(Math.cos(t * 18 * Math.PI)) : 1;
        ctx.translate(cx0 + cellW / 2, y + rowH * 0.5);
        ctx.scale(1, sq);
        ctx.fillStyle = active ? "#ffffff" : rgba("#d5d9e2", flipping ? 0.7 : cur >= 0 ? 0.7 : 0.9);
        ctx.font = mono;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(shown, 0, rowH * 0.02);
        ctx.restore();
      }
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(cx0, y + rowH * 0.5 - 0.75 * u, cellW, 1.5 * u);
    }
    // Status: a pill on the current row.
    if (active) {
      const k = ease.outCubic(range(t, T[i], T[i] + 0.3));
      const pw = statusW * 0.75;
      const pxx = bx + bw - rowH * 0.6 - pw;
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.fillStyle = palette.primary;
      ctx.shadowColor = rgba(palette.primary, 0.7);
      ctx.shadowBlur = 16 * u;
      ctx.beginPath();
      ctx.roundRect(pxx, y + rowH * 0.25, pw, rowH * 0.5, rowH * 0.25);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = onFill(palette);
      ctx.font = subFont(rowH * 0.24, 800);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("NOW", pxx + pw / 2, y + rowH * 0.5);
      ctx.restore();
    }
  });
  // A ticker along the bottom types the current service's detail.
  if (cur >= 0 && P[cur].detail) {
    const tk = range(t, T[cur] + 0.1, T[cur] + 0.1 + P[cur].detail.length * 0.03);
    const text = P[cur].detail.slice(0, Math.ceil(P[cur].detail.length * tk));
    ctx.fillStyle = accent;
    ctx.font = subFont(rowH * 0.3, 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const ty = by + bh - rowH * 0.3;
    fillTextFit(ctx, `→ ${text}${tk < 1 && Math.floor(t * 4) % 2 ? "▍" : ""}`, bx + rowH * 0.6, ty, bw - rowH * 1.2, { maxLines: 1, minScale: 0.6 });
  }
  ctx.restore();
}

const boardSfx = (scene: Scene): SfxCue[] => {
  const n = itemsOf(scene).length;
  const T = serviceTimes(scene, n);
  return [...Array.from({ length: n }, (_, i) => at(0.35 + i * 0.16, "key")), ...T.map((ti) => at(ti, "tick"))];
};

/* ───────────────────────── Bento Focus ───────────────────────── */

function serviceBento(sc: SkillContext) {
  const { ctx, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1, aurora: 0.25 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOf(scene);
  const n = P.length;
  const T = serviceTimes(scene, n);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const gap = 18 * u * S;
  const W = st.width;
  const H = narrow ? room * 0.94 : Math.min(room * 0.92, W * 0.56);
  const L = st.left;
  const top = st.top + (room - H) / 2;
  /** Every tile's place when service `s` holds the big tile. */
  const layout = (s: number): Rect[] => {
    const others = P.map((_, i) => i).filter((i) => i !== s);
    const rects: Rect[] = new Array(n);
    if (!narrow) {
      const bigW = W * 0.58;
      rects[s] = { x: L, y: top, w: bigW, h: H };
      const cols = others.length > 3 ? 2 : 1;
      const rows = Math.ceil(others.length / cols);
      const cw = (W - bigW - gap - gap * (cols - 1)) / cols;
      const rh = (H - gap * (rows - 1)) / rows;
      others.forEach((i, k) => {
        rects[i] = { x: L + bigW + gap + (k % cols) * (cw + gap), y: top + Math.floor(k / cols) * (rh + gap), w: cw, h: rh };
      });
    } else {
      const bigH = H * 0.56;
      rects[s] = { x: L, y: top, w: W, h: bigH };
      const cols = 2;
      const rows = Math.max(1, Math.ceil(others.length / cols));
      const cw = (W - gap) / cols;
      const rh = (H - bigH - gap - gap * (rows - 1)) / rows;
      others.forEach((i, k) => {
        rects[i] = { x: L + (k % cols) * (cw + gap), y: top + bigH + gap + Math.floor(k / cols) * (rh + gap), w: cw, h: rh };
      });
    }
    return rects;
  };
  const pos = servicePos(T, t, 0.55);
  const s0 = Math.min(n - 1, Math.floor(pos));
  const f = pos - s0;
  const A = layout(s0);
  const B = s0 + 1 < n ? layout(s0 + 1) : A;
  const rects = A.map((a, i) => ({ x: lerp(a.x, B[i].x, f), y: lerp(a.y, B[i].y, f), w: lerp(a.w, B[i].w, f), h: lerp(a.h, B[i].h, f) }));
  const bigArea = layout(0)[0].w * layout(0)[0].h;
  const smallArea = n > 1 ? layout(0)[1].w * layout(0)[1].h : bigArea * 0.5;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const order = rects.map((r, i) => ({ i, a: r.w * r.h })).sort((a, b) => a.a - b.a);
  for (const { i, a } of order) {
    const r = rects[i];
    const k = clamp(spring(t - 0.15 - i * 0.08, 11, 7), 0, 1.04);
    if (k <= 0) continue;
    const b = clamp((a - smallArea) / Math.max(1, bigArea - smallArea));
    ctx.save();
    ctx.globalAlpha *= clamp(k);
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(0.9 + 0.1 * Math.min(1, k), 0.9 + 0.1 * Math.min(1, k));
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    if (b > 0.5) {
      ctx.shadowColor = rgba(palette.primary, 0.4 * b);
      ctx.shadowBlur = 30 * u;
    }
    glassCard(sc, r.x, r.y, r.w, r.h, { r: 22 * u, tint: palette.bg1 });
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 22 * u);
    const bd = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    bd.addColorStop(0, rgba(palette.primary, 0.2 + 0.7 * b));
    bd.addColorStop(1, rgba(palette.secondary, 0.15 + 0.5 * b));
    ctx.strokeStyle = bd;
    ctx.lineWidth = (1.5 + b) * u;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    // The big tile glows in the corner.
    if (b > 0.05) {
      const gl = ctx.createLinearGradient(r.x + r.w, r.y, r.x + r.w * 0.4, r.y + r.h * 0.6);
      gl.addColorStop(0, rgba(palette.primary, 0.28 * b));
      gl.addColorStop(1, rgba(palette.primary, 0));
      ctx.fillStyle = gl;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    // Small: icon and name in a row.
    if (b < 1) {
      ctx.save();
      ctx.globalAlpha *= 1 - b;
      const ts = Math.min(r.h * 0.42, 56 * u * S);
      iconTile(sc, icons[i], r.x + 20 * u + ts / 2, r.y + r.h / 2, ts);
      ctx.fillStyle = palette.text;
      ctx.font = subFont(Math.min(r.h * 0.22, 30 * u * S), 700);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      fillTextFit(ctx, P[i].title, r.x + 36 * u + ts, r.y + r.h / 2, r.w - ts - 52 * u, { maxLines: 2, lineHeight: 1.1, minScale: 0.6 });
      ctx.restore();
    }
    // Big: a large icon, the label, the name and its detail.
    if (b > 0) {
      ctx.save();
      ctx.globalAlpha *= b;
      const pad = Math.min(r.w, r.h) * 0.1;
      const ts = Math.min(r.h * 0.26, 120 * u * S);
      iconTile(sc, icons[i], r.x + pad + ts / 2, r.y + pad + ts / 2, ts);
      smallLabel(sc, `SERVICE ${num(i)}`, r.x + pad, r.y + r.h * 0.56, "left");
      ctx.fillStyle = palette.text;
      const fs = Math.min(r.w * 0.1, r.h * 0.13, 86 * u * S);
      ctx.font = displayFont(saasFont(sc), fs);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const tl = fillTextFit(ctx, P[i].title, r.x + pad, r.y + r.h * 0.58, r.w - pad * 2, { maxLines: 2, lineHeight: 1.05, minScale: 0.6 });
      if (P[i].detail) {
        ctx.fillStyle = rgba(palette.text, 0.7);
        ctx.font = subFont(Math.min(fs * 0.4, 28 * u * S), 500);
        fillTextFit(ctx, P[i].detail, r.x + pad, r.y + r.h * 0.6 + tl * fs * 1.05, r.w - pad * 2, { maxLines: 2, lineHeight: 1.2, minScale: 0.7 });
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  }
  ctx.restore();
}

const bentoSfx = (scene: Scene): SfxCue[] => {
  const T = serviceTimes(scene, itemsOf(scene).length);
  return [at(0.15, "pop"), ...T.slice(1).map((ti) => at(ti - 0.5, "swoosh"))];
};

/* ───────────────────────── Spotlight ───────────────────────── */

function serviceSpotlight(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 0, aurora: 0.2 });
  const st = frame(sc);
  const { S, narrow, ex } = st;
  const P = itemsOf(scene);
  const n = P.length;
  const T = serviceTimes(scene, n);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const cur = currentOf(T, t, 0.05);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // The stage dims under the headline, so the light reads.
  const veil = ctx.createLinearGradient(0, st.top - 20 * u, 0, h);
  veil.addColorStop(0, rgba("#000000", 0));
  veil.addColorStop(0.25, rgba("#000000", palette.light ? 0.1 : 0.35));
  veil.addColorStop(1, rgba("#000000", palette.light ? 0.14 : 0.45));
  ctx.fillStyle = veil;
  ctx.fillRect(0, st.top - 20 * u, w, h);
  // The stage sits in the upper part, so the lit service's name can be told large under it.
  const shelfY = st.top + room * (narrow ? 0.44 : 0.5);
  const cols = n;
  const gapW = st.width / cols;
  const tile = Math.min(gapW * 0.6, room * (narrow ? 0.13 : 0.18), 150 * u * S);
  const nameSize = Math.min(22 * u * S, gapW * 0.12);
  const xs = P.map((_, i) => st.left + gapW * (i + 0.5));
  // The spotlight swings from service to service with a little overshoot, like a hand-pulled light,
  // setting off as the name changes so the lit card and the name below always match.
  let pos = 0;
  for (let i = 1; i < n; i++) pos += clamp(spring(t - (T[i] - 0.12), 9, 6), 0, 1.06);
  const enter = ease.outCubic(range(t, 0.2, T[0]));
  const tx = lerp(xs[0] - gapW * 0.8, lerp(xs[Math.floor(clamp(pos, 0, n - 1))], xs[Math.min(n - 1, Math.floor(clamp(pos, 0, n - 1)) + 1)], clamp(pos, 0, n - 1) - Math.floor(clamp(pos, 0, n - 1))), enter);
  const srcX = w / 2;
  const srcY = st.top - room * 0.25;
  const poolW = tile * 1.1;
  // The beam: a cone from the light down to a pool on the shelf.
  ctx.save();
  ctx.globalAlpha *= enter;
  const beam = ctx.createLinearGradient(0, srcY, 0, shelfY);
  beam.addColorStop(0, rgba(palette.light ? palette.primary : "#ffffff", palette.light ? 0.2 : 0.22));
  beam.addColorStop(1, rgba(palette.primary, palette.light ? 0.12 : 0.1));
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(srcX - 12 * u, srcY);
  ctx.lineTo(srcX + 12 * u, srcY);
  ctx.lineTo(tx + poolW, shelfY);
  ctx.lineTo(tx - poolW, shelfY);
  ctx.closePath();
  ctx.fill();
  const pool = ctx.createLinearGradient(tx - poolW, 0, tx + poolW, 0);
  pool.addColorStop(0, rgba(palette.primary, 0));
  pool.addColorStop(0.5, rgba(palette.light ? palette.primary : "#ffffff", 0.35));
  pool.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(tx, shelfY + 6 * u, poolW, 14 * u, 0, 0, TAU);
  ctx.fill();
  // Dust drifting in the light.
  for (let q = 0; q < 18; q++) {
    const hsh = hashString(`dust${q}`);
    const fy = ((hsh % 1000) / 1000 + t * 0.05 * (1 + (q % 3))) % 1;
    const yy = lerp(srcY, shelfY, fy);
    const half = lerp(12 * u, poolW, fy);
    const xx = lerp(srcX, tx, fy) + (((hsh >> 8) % 200) / 100 - 1) * half * 0.8;
    ctx.fillStyle = rgba(palette.light ? palette.primary : "#ffffff", 0.35);
    ctx.beginPath();
    ctx.arc(xx, yy, (1 + (q % 2)) * u, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // The shelf and the plinths with the services on them.
  ctx.fillStyle = rgba(palette.text, 0.12);
  ctx.fillRect(st.left, shelfY + 16 * u, st.width, 2 * u);
  P.forEach((p, i) => {
    const x = xs[i];
    const k = clamp(spring(t - 0.15 - i * 0.08, 11, 7), 0, 1.05);
    if (k <= 0) return;
    const lit = clamp(1 - Math.abs(tx - x) / (gapW * 0.6));
    const rise = lit * 14 * u * S;
    ctx.save();
    ctx.globalAlpha *= clamp(k) * (0.35 + 0.65 * lit);
    // Plinth.
    const pw = tile * 1.05;
    const ph = tile * 0.42;
    ctx.fillStyle = mixHex(palette.bg1, palette.text, palette.light ? 0.12 : 0.1);
    ctx.beginPath();
    ctx.roundRect(x - pw / 2, shelfY - ph + 16 * u, pw, ph, 8 * u);
    ctx.fill();
    ctx.fillStyle = mixHex(palette.bg1, palette.text, palette.light ? 0.06 : 0.18);
    ctx.beginPath();
    ctx.ellipse(x, shelfY - ph + 16 * u, pw / 2, ph * 0.22, 0, 0, TAU);
    ctx.fill();
    // The service: a glossy tile that rises and glows in the light.
    const ty = shelfY - ph + 16 * u - tile * 0.62 - rise;
    if (lit > 0.3) {
      ctx.shadowColor = rgba(palette.primary, 0.8 * lit);
      ctx.shadowBlur = 36 * u * lit;
    }
    if (lit > 0.5) iconTile(sc, icons[i], x, ty, tile * (0.9 + 0.1 * lit));
    else {
      ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, palette.text, 0.1);
      ctx.beginPath();
      ctx.roundRect(x - tile * 0.45, ty - tile * 0.45, tile * 0.9, tile * 0.9, tile * 0.24);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = hair(palette, 0.2);
      ctx.lineWidth = 1.5 * u;
      ctx.stroke();
      drawIcon(ctx, icons[i], x, ty, tile * 0.5, rgba(palette.text, 0.7));
    }
    ctx.restore();
    // Its name, small, on the plinth.
    ctx.save();
    ctx.globalAlpha *= clamp(k) * (0.45 + 0.55 * lit);
    ctx.fillStyle = palette.text;
    ctx.font = subFont(nameSize, 700);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    fillTextFit(ctx, p.title, x, shelfY + 30 * u, gapW * 0.92, { maxLines: 2, lineHeight: 1.1, minScale: 0.6 });
    ctx.restore();
  });
  // The lit service's name, large and in capitals, under the stage.
  if (cur >= 0) {
    const big = (narrow ? 60 : 76) * u * S;
    const caps = P.map((p) => ({ ...p, title: p.title.toUpperCase() }));
    tellService(sc, caps, T, { x: w / 2, y: shelfY + 30 * u + nameSize * 2.2 + 44 * u * S, w: st.width * (narrow ? 1 : 0.86), size: big, align: "center", underline: false });
  }
  ctx.restore();
}

const spotlightSfx = (scene: Scene): SfxCue[] => {
  const T = serviceTimes(scene, itemsOf(scene).length);
  return [at(0.2, "whoosh"), ...T.map((ti, i) => at(ti - (i ? 0.1 : 0), "swoosh"))];
};

/* ───────────────────────── Registry ───────────────────────── */

export const creativeServiceSkills: Skill[] = [
  {
    id: "service-cube",
    name: "Service Cube",
    tagline: "A big 3D cube turns a quarter turn for each service, the service on the face that comes round; its name is told large beside it.",
    bestFor: "What a company offers, with a bold 3D move: 2–6 services ('Service — short description').",
    sample: { text: "What we *offer*", items: SERVICES },
    itemsHint: "2–6 services: 'Service — short description'",
    render: serviceCube,
    sfx: cubeSfx,
  },
  {
    id: "service-bloom",
    name: "Service Bloom",
    tagline: "Services open out like petals round the brand; the current petal stretches out and glows, and its name is told large beside the flower.",
    bestFor: "Services that grow from one core: 3–6 ('Service — short description'). Creative studios, wellness, education, community.",
    sample: { text: "Grown from *one idea*", items: SERVICES },
    itemsHint: "3–6 services: 'Service — short description'",
    render: serviceBloom,
    sfx: bloomSfx,
  },
  {
    id: "service-fan",
    name: "Card Fan",
    tagline: "Service cards fanned like a hand of cards; the current card lifts out, turns upright and grows to fill the stage, then slides back.",
    bestFor: "Services or packages to pick from: 2–6 ('Service — short description'). Agencies, offers, plans.",
    sample: { text: "Pick your *service*", items: SERVICES },
    itemsHint: "2–6 services: 'Service — short description'",
    render: serviceFan,
    sfx: fanSfx,
  },
  {
    id: "service-board",
    name: "Departure Board",
    tagline: "An airport-style split-flap board: its letters flip into the service names, the current row lights up with a NOW tag and a ticker types its detail.",
    bestFor: "A retro, playful list of services: 2–6 short names ('Service — short description'). Travel, events, agencies, creative brands.",
    sample: { text: "Now *boarding*", items: SERVICES },
    itemsHint: "2–6 short services: 'Service — short description'",
    render: serviceBoard,
    sfx: boardSfx,
  },
  {
    id: "service-bento",
    name: "Bento Focus",
    tagline: "A bento grid where the current service's tile grows into the big tile, with a large icon, its name and detail, while the others shrink and rearrange round it.",
    bestFor: "Services or product areas with a modern SaaS look: 3–6 ('Service — short description').",
    sample: { text: "One team, *many talents*", items: SERVICES },
    itemsHint: "3–6 services: 'Service — short description'",
    render: serviceBento,
    sfx: bentoSfx,
  },
  {
    id: "service-spotlight",
    name: "Service Spotlight",
    tagline: "A dark stage with the services on plinths; a spotlight swings to each in turn, the lit one rises and glows, and its name is told large in capitals under the stage.",
    bestFor: "A theatrical reveal of services: 2–5 ('Service — short description'). Agencies, studios, events, premium brands.",
    sample: { text: "In the *spotlight*", items: SERVICES.slice(0, 4) },
    itemsHint: "2–5 services: 'Service — short description'",
    render: serviceSpotlight,
    sfx: spotlightSfx,
  },
];
