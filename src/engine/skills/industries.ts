/**
 * Industry slides: how common kinds of business show what they do, acted out by cartoon characters
 * in a scene of their own (see scenes.ts), in the intro's colours.
 *
 * - ind-hometour: home builders and real estate. A cut-away of a home, room by room (living room
 *   with the dog, kitchen, bedroom, bathroom); the camera visits a room per point.
 * - ind-build:    home builders. A house goes up stage by stage (slab, frame, walls, roof) as the
 *   steps tick off; the new owners and their dog arrive at the end.
 * - ind-site:     construction and trades. Beams carrying the points are lowered onto a site one
 *   by one while the crew in hard hats looks on.
 * - ind-care:     health care. A caregiver goes down a clipboard checklist with a patient.
 * - ind-menu:     cafés and restaurants. A chef presents the menu board, written up line by line.
 * - ind-shop:     retail. A shopper with a bag; the points hang from the rail as shop tags.
 * - ind-lesson:   education. A teacher points along a chalkboard as the lesson is written up.
 * - ind-team:     offices and professional services. Sticky notes go up on a whiteboard.
 * - ind-route:    delivery and local services. A van drives down the street, a pin at each stop.
 *
 * Characters are generated (or your own cast), now and then a wheelchair user; headlines are dark
 * on these light scenes whatever the palette.
 */
import { clamp, ease, lerp, mixHex, range, rgba, TAU } from "../math";
import { drawDog, drawHouse, sceneStage, type SceneBackdrop } from "../scenes";
import { displayFont, fillTextFit, subFont } from "../text";
import { drawIcon, luminance, saasBackground, saasFont } from "../saasfx";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { bounceIn, drawAbstract, idle, person, waveArm, type AbsRig } from "./abstract";
import { exitOf, itemsOr, split, stage } from "./beats";
import { blinkAt, pointTimes, useToon } from "./characters";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const plain = (s: string) => s.replace(/\*/g, "").trim();
const INK = "#1f1d2b";

/** The palette on a light scene: dark text, solid (not glowing) light. */
const onLight = (p: Palette): Palette => (p.light ? p : { ...p, text: INK, light: true, bg0: "#f7f5f2", bg1: "#ffffff" });

/** Paint a scene (unless the stage is drawn elsewhere) and return the context for drawing on it. */
function scenic(sc: SkillContext, backdrop: SceneBackdrop | "sky", bare = false): SkillContext {
  const s2 = { ...sc, palette: onLight(sc.palette) };
  useToon(s2);
  if (!sc.noStage) {
    if (backdrop === "sky") skyLawn(s2);
    else sceneStage(s2, backdrop, { bare });
  }
  return s2;
}

/** A plain sky over a lawn: the stage for a house. */
function skyLawn(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mixHex("#a3d9ff", palette.primary, 0.14));
  g.addColorStop(0.7, "#eef8ff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = 0; i < 3; i++) {
    const cw = (180 + i * 50) * u;
    const cx = ((i * 0.37 * (w + cw) + T * 9 * u) % (w + cw * 2)) - cw;
    const cy = h * (0.1 + i * 0.07);
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw * 0.5, cw * 0.14, 0, 0, TAU);
    ctx.ellipse(cx + cw * 0.1, cy - cw * 0.1, cw * 0.22, cw * 0.16, 0, 0, TAU);
    ctx.fill();
  }
  const gy = h * 0.8;
  const f = ctx.createLinearGradient(0, gy, 0, h);
  f.addColorStop(0, "#8fd17a");
  f.addColorStop(1, "#6fbf62");
  ctx.fillStyle = f;
  ctx.fillRect(0, gy, w, h - gy);
}

/** A rounded label: white, or the brand's colour when `lit`. `k` (0 → 1) pops it in. */
function tag(sc: SkillContext, x: number, y: number, text: string, size: number, k: number, lit: boolean, maxW = 9999) {
  if (k <= 0) return;
  const { ctx, u, palette } = sc;
  ctx.save();
  ctx.font = subFont(size, 750);
  const tw = Math.min(ctx.measureText(text).width + size * 1.6, maxW);
  const th = size * 2;
  const s = Math.min(1, k);
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha *= clamp(k * 2);
  ctx.shadowColor = "rgba(20,10,40,0.18)";
  ctx.shadowBlur = 14 * u;
  ctx.shadowOffsetY = 4 * u;
  ctx.fillStyle = lit ? palette.primary : "#ffffff";
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -th / 2, tw, th, th / 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = lit ? "#ffffff" : INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fillTextFit(ctx, text, 0, 0, tw - size, { maxLines: 1, minScale: 0.6 });
  ctx.restore();
}

/** The point the timeline is on (−1 before the first). */
const current = (t: number, T: number[]) => T.reduce((cc, ti, i) => (t >= ti - 0.05 ? i : cc), -1);

/** Arm angle (from hanging down, out on that side) to point from a shoulder at a target. */
function aim(sx: number, sy: number, tx: number, ty: number, side: number) {
  return clamp(Math.atan2((tx - sx) * side, ty - sy), 0.35, 2.7);
}

/* ───────────────────────── Accessories ───────────────────────── */

function hardHat(ctx: CanvasRenderingContext2D, rig: AbsRig, color = "#f2b632") {
  const { x, y, r } = rig.head;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.25, r * 1.02, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = mixHex(color, "#000000", 0.12);
  ctx.beginPath();
  ctx.roundRect(x - r * 1.3, y - r * 0.32, r * 2.6, r * 0.24, r * 0.12);
  ctx.fill();
  ctx.fillRect(x - r * 0.12, y - r * 1.26, r * 0.24, r * 1.0);
  ctx.restore();
}

function chefHat(ctx: CanvasRenderingContext2D, rig: AbsRig) {
  const { x, y, r } = rig.head;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(20,10,40,0.12)";
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.roundRect(x - r * 0.75, y - r * 1.35, r * 1.5, r * 0.6, r * 0.1);
  ctx.arc(x - r * 0.45, y - r * 1.5, r * 0.45, 0, TAU);
  ctx.arc(x + r * 0.45, y - r * 1.5, r * 0.45, 0, TAU);
  ctx.arc(x, y - r * 1.75, r * 0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function stethoscope(ctx: CanvasRenderingContext2D, rig: AbsRig) {
  const { x, y, r } = rig.head;
  ctx.save();
  ctx.strokeStyle = "#5b6475";
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.6, y + r * 1.0);
  ctx.quadraticCurveTo(x - r * 0.5, y + r * 2.1, x + r * 0.1, y + r * 2.2);
  ctx.moveTo(x + r * 0.6, y + r * 1.0);
  ctx.quadraticCurveTo(x + r * 0.55, y + r * 1.7, x + r * 0.1, y + r * 2.2);
  ctx.stroke();
  ctx.fillStyle = "#b8bfcc";
  ctx.beginPath();
  ctx.arc(x + r * 0.1, y + r * 2.3, r * 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function shoppingBag(ctx: CanvasRenderingContext2D, hand: { x: number; y: number }, s: number, color: string) {
  ctx.save();
  ctx.strokeStyle = mixHex(color, "#000000", 0.3);
  ctx.lineWidth = s * 0.06;
  ctx.beginPath();
  ctx.arc(hand.x, hand.y + s * 0.18, s * 0.14, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(hand.x - s * 0.28, hand.y + s * 0.16, s * 0.56, s * 0.6, s * 0.06);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(hand.x, hand.y + s * 0.46, s * 0.1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ───────────────────────── Home Tour ───────────────────────── */

type Room = "home" | "kitchen" | "bedroom" | "bathroom";
const ROOM_WORDS: [Room, RegExp][] = [
  ["kitchen", /kitchen|cook|chef|pantry|dining|island/i],
  ["bedroom", /bed|sleep|suite|nursery|kids'? room/i],
  ["bathroom", /bath|shower|spa|ensuite|en-suite|powder/i],
  ["home", /living|family|lounge|great room|den|open[- ]plan|fireplace/i],
];
const HOME_POINTS = ["Bright living room", "Open-plan kitchen", "Calm bedroom", "Spa-style bathroom"];

/** Which room each point shows: the one it names, else the next free one. */
function roomsFor(points: string[]): Room[] {
  const free: Room[] = ["home", "kitchen", "bedroom", "bathroom"];
  const named = points.map((p) => ROOM_WORDS.find(([, re]) => re.test(p))?.[0]);
  const used = new Set(named.filter(Boolean));
  const rest = free.filter((r) => !used.has(r));
  return named.map((r) => r ?? rest.shift() ?? "home");
}

/** A full scene drawn into a rectangle (scaled to fit its height, cropped to its width). */
function sceneIn(sc: SkillContext, backdrop: SceneBackdrop, x: number, y: number, rw: number, rh: number) {
  const { ctx, h } = sc;
  const k = rh / h;
  const vw = rw / k;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.rect(0, 0, vw, h);
  ctx.clip();
  sceneStage({ ...sc, w: vw, h, u: sc.u }, backdrop);
  ctx.restore();
}

function homeTour(sc0: SkillContext) {
  const sc = scenic(sc0, "sky");
  const { ctx, w, h, t, u, palette, scene, seed } = sc;
  const T0 = sc.globalT ?? t;
  const st = stage(sc);
  const { S, ex } = st;
  const P = itemsOr(scene, HOME_POINTS, 4, 1).map((x) => plain(split(x).title));
  const rooms = roomsFor(P);
  const n = P.length;
  const T = pointTimes(scene, n, 1.0);
  const cur = current(t, T);
  // The cut-away: a roof over two floors of two rooms each, standing on the lawn.
  const ground = Math.min(st.bottom, h * 0.86);
  const room = ground - st.top;
  const roofH = room * 0.2;
  const fh = (room - roofH - 10 * u) / 2;
  const houseW = Math.min(st.width * 0.98, fh * 2 * 1.45);
  const rw = houseW / 2;
  const hx = w / 2 - houseW / 2;
  const floorY = [ground - fh, ground - fh * 2 - 8 * u];
  const slots: Record<Room, { x: number; y: number }> = {
    home: { x: hx, y: floorY[0] },
    kitchen: { x: hx + rw, y: floorY[0] },
    bedroom: { x: hx, y: floorY[1] },
    bathroom: { x: hx + rw, y: floorY[1] },
  };
  // The camera: wide, then into the room of each point, then back out for the last beat.
  const wide = { cx: w / 2, cy: (st.top + ground) / 2, z: 1 };
  const viewH = h - st.top;
  const camOf = (i: number) => {
    const s0 = slots[rooms[i]];
    const z = Math.min((w * 0.86) / rw, (viewH * 0.82) / fh, 2.6);
    return { cx: s0.x + rw / 2, cy: s0.y + fh / 2, z };
  };
  let cam = wide;
  if (cur >= 0) {
    const from = cur === 0 ? wide : camOf(cur - 1);
    const e = ease.inOutCubic(clamp((t - T[cur]) / 0.8));
    const to = camOf(cur);
    cam = { cx: lerp(from.cx, to.cx, e), cy: lerp(from.cy, to.cy, e), z: lerp(from.z, to.z, e) };
    const back = ease.inOutCubic(clamp((t - T[n - 1] - 1.5) / 0.9));
    cam = { cx: lerp(cam.cx, wide.cx, back), cy: lerp(cam.cy, wide.cy, back), z: lerp(cam.z, 1, back) };
  }
  const rise = clamp(bounceIn(t, 0.15).k);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  ctx.beginPath();
  ctx.rect(0, st.top - 16 * u, w, h);
  ctx.clip();
  ctx.translate(w / 2, wide.cy);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-cam.cx, -cam.cy);
  ctx.translate(0, (1 - rise) * h * 0.3);
  // The shell: rooms, walls and floor slabs, the roof with a chimney.
  const trim = mixHex(palette.primary, INK, 0.45);
  for (const r of ["home", "kitchen", "bedroom", "bathroom"] as Room[]) {
    const s0 = slots[r];
    sceneIn(sc, r, s0.x, s0.y, rw, fh);
  }
  if (rooms.length) {
    // People at home: someone waving in the living room with the dog, someone cooking.
    const H = fh * 0.62;
    const lv = slots.home;
    const c1 = person(sc, 0, seed * 7 + 11);
    const id = idle(t, 0);
    drawAbstract(ctx, lv.x + rw * 0.36, lv.y + fh * 0.92, H, c1, { armL: id.armL, armR: waveArm(t, clamp((t - 0.6) / 0.4)), lift: id.lift, mouth: "smile", blink: blinkAt(t, 1) });
    const kt = slots.kitchen;
    const c2 = person(sc, 1, seed * 7 + 29);
    drawAbstract(ctx, kt.x + rw * 0.32, kt.y + fh * 0.92, H, c2, { armL: 0.3, armR: 1.4 + Math.sin(t * 4) * 0.15, mouth: "open", blink: blinkAt(t, 2), look: 0.6 });
  }
  ctx.strokeStyle = trim;
  ctx.lineWidth = 10 * u;
  ctx.lineJoin = "round";
  ctx.strokeRect(hx, floorY[1], houseW, ground - floorY[1]);
  ctx.beginPath();
  ctx.moveTo(hx + rw, floorY[1]);
  ctx.lineTo(hx + rw, ground);
  ctx.moveTo(hx, floorY[0] - 4 * u);
  ctx.lineTo(hx + houseW, floorY[0] - 4 * u);
  ctx.stroke();
  ctx.fillStyle = mixHex(palette.primary, "#2a2633", 0.25);
  ctx.beginPath();
  ctx.moveTo(hx - 24 * u, floorY[1] - 4 * u);
  ctx.lineTo(w / 2, floorY[1] - roofH);
  ctx.lineTo(hx + houseW + 24 * u, floorY[1] - 4 * u);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(hx + houseW * 0.72, floorY[1] - roofH * 0.9, houseW * 0.06, roofH * 0.5);
  ctx.fillStyle = "#b9b2a8";
  ctx.fillRect(hx - 16 * u, ground, houseW + 32 * u, 10 * u);
  ctx.restore();
  // Labels on the rooms, on screen (they stay readable as the camera moves).
  const size = 26 * u * S;
  P.forEach((label, i) => {
    const s0 = slots[rooms[i]];
    const k = clamp(bounceIn(t, T[i] + 0.35).k);
    const sx = w / 2 + (s0.x + rw / 2 - cam.cx) * cam.z;
    const sy = wide.cy + (s0.y + fh * 0.12 - cam.cy) * cam.z + (1 - rise) * h * 0.3;
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    tag(sc, sx, Math.max(st.top + size, sy), label, size * (i === cur ? 1.15 : 0.9), k, i === cur, rw * cam.z * 0.9);
    ctx.restore();
  });
}

/* ───────────────────────── Home Build ───────────────────────── */

const BUILD_POINTS = ["Design", "Foundation", "Framing", "Move in"];

function homeBuild(sc0: SkillContext) {
  const sc = scenic(sc0, "sky");
  const { ctx, w, h, t, u, palette, scene, seed } = sc;
  const T0 = sc.globalT ?? t;
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, BUILD_POINTS, 5, 2).map((x) => plain(split(x).title));
  const n = P.length;
  const T = pointTimes(scene, n, 0.8);
  const cur = current(t, T);
  // Progress: each step moves the build on; it eases between steps.
  const step = (i: number) => (i < 0 ? 0 : (i + 1) / n);
  const p = cur < 0 ? 0 : lerp(step(cur - 1), step(cur), ease.inOutCubic(clamp((t - T[cur]) / 0.9)));
  const ground = Math.min(st.bottom, h * 0.84);
  const room = ground - st.top;
  const listW = narrow ? 0 : st.width * 0.3;
  const houseW = Math.min((st.width - listW) * 0.86, room * 1.5);
  const cx = narrow ? w / 2 : st.left + (st.width - listW) / 2;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  drawHouse(ctx, cx, ground, houseW, p, T0, palette, u);
  // The crew in hard hats while it's going up; the new owners and their dog at the end.
  const H = room * 0.52;
  const done = clamp((p - 0.97) / 0.03) * clamp((t - T[n - 1] - 0.6) / 0.4);
  [-1, 1].forEach((side, i) => {
    const x = cx + side * houseW * 0.62;
    const c = person(sc, i + 2, seed * 13 + i * 31);
    const id = idle(t, i);
    const rig = drawAbstract(ctx, x, ground + 6 * u, H, c, { armL: side > 0 ? id.armL : 1.2 + Math.sin(t * 3 + i) * 0.2, armR: side < 0 ? id.armR : done > 0 ? waveArm(t, done) : 1.2 + Math.sin(t * 3) * 0.2, lift: id.lift, mouth: done > 0 ? "open" : "smile", blink: blinkAt(t, i + 3), flip: side > 0 });
    hardHat(ctx, rig, i ? palette.accent : "#f2b632");
  });
  if (done > 0) {
    ctx.globalAlpha = (1 - ex) * done;
    const fx = cx - houseW * 0.06;
    const k = clamp(bounceIn(t, T[n - 1] + 0.6).k);
    drawAbstract(ctx, fx - H * 0.18, ground + 8 * u + (1 - k) * H * 0.3, H * 0.9, person(sc, 0, seed * 13 + 77), { armL: 0.3, armR: waveArm(t, k), mouth: "open", blink: blinkAt(t, 5) });
    drawAbstract(ctx, fx + H * 0.18, ground + 8 * u + (1 - k) * H * 0.3, H * 0.86, person(sc, 1, seed * 13 + 91), { armL: waveArm(t + 0.3, k), armR: 0.3, mouth: "smile", blink: blinkAt(t, 6) });
    drawDog(ctx, fx + H * 0.5, ground + 10 * u, H * 0.22, T0, "#d9a066", -1);
  }
  ctx.restore();
  // The steps: a checklist beside the house (a row of chips on narrow frames).
  const size = 24 * u * S;
  P.forEach((label, i) => {
    const k = clamp(bounceIn(t, T[i] - 0.2).k);
    const lit = i === cur;
    const doneI = i < cur || (i === cur && t > T[i] + 0.8);
    const x = narrow ? st.left + (st.width * (i + 0.5)) / n : st.left + st.width - listW / 2;
    const y = narrow ? st.top + size * 1.2 : st.top + room * 0.12 + i * size * 2.6;
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    tag(sc, x, y, (doneI ? "✓ " : "") + label, size, k, lit, narrow ? st.width / n - 8 * u : listW);
    ctx.restore();
  });
}

/* ───────────────────────── Job Site ───────────────────────── */

const SITE_POINTS = ["Planning", "Groundwork", "Structure", "Handover"];

function jobSite(sc0: SkillContext) {
  const sc = scenic(sc0, "construction");
  const { ctx, w, h, t, u, palette, scene, seed } = sc;
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, SITE_POINTS, 4, 2).map((x) => plain(split(x).title));
  const n = P.length;
  const T = pointTimes(scene, n, 0.8);
  const cur = current(t, T);
  const ground = h * 0.76;
  const bw = Math.min(st.width * (narrow ? 0.8 : 0.42), 560 * u * S);
  const bh = Math.min(64 * u * S, (ground - st.top) / (n + 1.6));
  const bx = narrow ? w / 2 : st.left + st.width * 0.62;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Beams lowered on cables, stacking from the ground up; the newest swings gently as it lands.
  P.forEach((label, i) => {
    const k = clamp((t - T[i] + 0.6) / 0.9);
    if (k <= 0) return;
    const land = ground - (i + 1) * (bh + 8 * u);
    const y = lerp(st.top - bh * 2, land, ease.outCubic(k));
    const sway = (1 - k) * Math.sin(t * 5) * 10 * u;
    if (k < 1) {
      ctx.strokeStyle = "#4a5165";
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(bx + sway, 0);
      ctx.lineTo(bx - bw * 0.35 + sway, y);
      ctx.moveTo(bx + sway, 0);
      ctx.lineTo(bx + bw * 0.35 + sway, y);
      ctx.stroke();
    }
    const lit = i === cur;
    ctx.fillStyle = lit ? palette.primary : "#e07a3c";
    ctx.shadowColor = "rgba(20,10,40,0.2)";
    ctx.shadowBlur = 10 * u;
    ctx.beginPath();
    ctx.roundRect(bx - bw / 2 + sway, y, bw, bh, 6 * u);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    for (let j = 0; j < 6; j++) {
      ctx.beginPath();
      ctx.arc(bx - bw / 2 + sway + bw * (0.06 + j * 0.176), y + bh / 2, bh * 0.1, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = subFont(26 * u * S, 800);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, label, bx + sway, y + bh / 2, bw * 0.8, { maxLines: 1, minScale: 0.6 });
  });
  // The crew, in hard hats, pointing at the newest beam.
  const H = Math.min((ground - st.top) * 0.55, st.width * 0.2);
  const crew = narrow ? [w * 0.18, w * 0.82] : [st.left + st.width * 0.1, st.left + st.width * 0.27];
  crew.forEach((x, i) => {
    const c = person(sc, i, seed * 19 + i * 23);
    const b = bounceIn(t, 0.1 + i * 0.15);
    const id = idle(t, i);
    const target = cur >= 0 ? { x: bx, y: ground - (cur + 1) * (bh + 8 * u) + bh / 2 } : { x: bx, y: ground - H };
    const right = target.x > x;
    const arm = aim(x, ground - H * 0.62, target.x, target.y, right ? 1 : -1);
    const rig = drawAbstract(ctx, x, h * 0.92 + (1 - Math.min(1, b.k)) * H * 0.4, H, c, { armL: right ? id.armL : arm, armR: right ? arm : id.armR, lift: id.lift, squash: b.squash, mouth: "smile", blink: blinkAt(t, i + 1), look: right ? 0.7 : -0.7 });
    hardHat(ctx, rig, i ? palette.accent : "#f2b632");
  });
  ctx.restore();
}

/* ───────────────────────── Boards (care, menu, lesson, team, shop) ───────────────────────── */

type BoardKind = "clipboard" | "menu" | "chalk" | "sticky" | "tags";
interface BoardSpec {
  backdrop: SceneBackdrop;
  board: BoardKind;
  hat?: (ctx: CanvasRenderingContext2D, rig: AbsRig) => void;
  /** A second character: the patient, a student, a colleague or a shopper. */
  second?: "seated" | "standing";
  fallback: string[];
}

/** The board's frame; returns where each line of text goes. */
function drawBoard(sc: SkillContext, kind: BoardKind, x: number, y: number, bw: number, bh: number, n: number) {
  const { ctx, u, palette } = sc;
  ctx.save();
  ctx.shadowColor = "rgba(20,10,40,0.18)";
  ctx.shadowBlur = 18 * u;
  ctx.shadowOffsetY = 6 * u;
  let pad = 28 * u;
  let top = y + pad;
  if (kind === "clipboard") {
    ctx.fillStyle = "#c79b74";
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 14 * u);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x + 14 * u, y + 26 * u, bw - 28 * u, bh - 40 * u, 6 * u);
    ctx.fill();
    ctx.fillStyle = "#9aa3b2";
    ctx.beginPath();
    ctx.roundRect(x + bw / 2 - 50 * u, y - 10 * u, 100 * u, 40 * u, 10 * u);
    ctx.fill();
    ctx.fillStyle = mixHex(palette.primary, "#ffffff", 0.2);
    ctx.fillRect(x + 14 * u, y + 30 * u, bw - 28 * u, 10 * u);
    pad = 46 * u;
    top = y + 60 * u;
  } else if (kind === "menu") {
    ctx.fillStyle = mixHex("#2f3440", palette.primary, 0.15);
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 12 * u);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#c79b74";
    ctx.lineWidth = 10 * u;
    ctx.stroke();
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.roundRect(x + bw * 0.25, y - 18 * u, bw * 0.5, 40 * u, 20 * u);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = subFont(20 * u, 800);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("MENU", x + bw / 2, y + 2 * u);
    top = y + 46 * u;
  } else if (kind === "chalk") {
    ctx.fillStyle = "#b98a63";
    ctx.beginPath();
    ctx.roundRect(x - 10 * u, y - 10 * u, bw + 20 * u, bh + 20 * u, 10 * u);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#3f6b55";
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 4 * u);
    ctx.fill();
    ctx.fillStyle = "#b98a63";
    ctx.fillRect(x + bw * 0.1, y + bh + 4 * u, bw * 0.8, 8 * u);
  } else if (kind === "sticky") {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 10 * u);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#c9d0da";
    ctx.lineWidth = 8 * u;
    ctx.stroke();
    ctx.fillStyle = "#9aa3b2";
    ctx.fillRect(x + bw * 0.3, y + bh + 4 * u, bw * 0.4, 8 * u);
  } else {
    // A rail with hooks for the tags.
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#8a6a4c";
    ctx.beginPath();
    ctx.roundRect(x, y, bw, 12 * u, 6 * u);
    ctx.fill();
    top = y + 40 * u;
  }
  ctx.restore();
  const lineH = (bh - (top - y) - pad * 0.6) / Math.max(n, 1);
  return { top, lineH, pad };
}

/** The business scenes a board suits: a menu in a restaurant or bakery, shop tags in a salon or florist… */
const BOARD_SCENES: Record<BoardKind, SceneBackdrop[]> = {
  menu: ["cafe", "restaurant", "bakery", "asian", "icecream"],
  tags: ["shop", "salon", "florist", "bookstore", "hotel", "garage", "antique", "thrift", "music", "repair", "plumbing", "lawn", "cleaning", "electrical", "hvac", "photo", "petgroom", "tattoo", "carwash", "usedcars", "showroom", "farm", "art", "optical"],
  chalk: ["classroom", "gym", "yoga", "dance", "music"],
  clipboard: ["hospital", "dental", "doctor"],
  sticky: ["office", "church", "law", "accounting", "insurance", "realty", "foodbank"],
};

function boardSlide(sc0: SkillContext, B: BoardSpec) {
  // (In the intro's own setting when the board suits it: a menu board in the bakery.)
  const own = sc0.setting as SceneBackdrop | undefined;
  const sc = scenic(sc0, own && BOARD_SCENES[B.board].includes(own) ? own : B.backdrop, true);
  const { ctx, w, h, t, u, palette, scene, seed } = sc;
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, B.fallback, 4, 2).map((x) => plain(split(x).title));
  const n = P.length;
  const T = pointTimes(scene, n, 0.8);
  const cur = current(t, T);
  const floor = Math.min(h * 0.94, st.bottom + h * 0.04);
  const room = st.bottom - st.top;
  // The board: on the right on wide frames, above the characters on narrow ones.
  const bw = narrow ? st.width * 0.9 : Math.min(st.width * 0.48, 640 * u * S);
  const bh = narrow ? room * 0.5 : Math.min(room * 0.86, bw * 0.8);
  const bx = narrow ? w / 2 - bw / 2 : st.left + st.width - bw;
  const by = narrow ? st.top : st.top + (room - bh) * 0.35;
  const pop = clamp(bounceIn(t, 0.2).k);
  ctx.save();
  ctx.globalAlpha = (1 - ex) * clamp(pop * 2);
  const g = drawBoard(sc, B.board, bx, by + (1 - pop) * 30 * u, bw, bh, n);
  const size = Math.min(g.lineH * 0.42, 34 * u * S);
  const linePos: { x: number; y: number }[] = [];
  P.forEach((label, i) => {
    const y = g.top + g.lineH * (i + 0.5) + (1 - pop) * 30 * u;
    const k = clamp((t - T[i] + 0.15) / 0.5);
    const lit = i === cur;
    if (B.board === "sticky" || B.board === "tags") {
      const cols = [palette.primary, palette.accent, mixHex(palette.secondary, "#ffffff", 0.2), mixHex(palette.primary, "#ffffff", 0.4)];
      const nx = B.board === "tags" ? bx + (bw * (i + 0.5)) / n : bx + bw * (i % 2 ? 0.66 : 0.34);
      const ny = B.board === "tags" ? by + 60 * u + (bh - 60 * u) * 0.35 : by + bh * (0.25 + Math.floor(i / 2) * 0.42);
      // (Sticky notes sit side by side without covering each other's words.)
      const nw = B.board === "tags" ? Math.min(bw / n - 14 * u, 220 * u * S) : bw * 0.34;
      const nh = B.board === "tags" ? nw * 0.75 : bh * 0.34;
      linePos.push({ x: nx, y: ny });
      if (k <= 0) return;
      const s = ease.outBack(k);
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate((i % 2 ? 1 : -1) * 0.04 + (B.board === "tags" ? Math.sin(t * 2 + i) * 0.04 : 0));
      ctx.scale(s, s);
      if (B.board === "tags") {
        ctx.strokeStyle = "#8a6a4c";
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.moveTo(0, -(ny - by) + 6 * u);
        ctx.lineTo(0, -nh / 2);
        ctx.stroke();
      }
      ctx.shadowColor = "rgba(20,10,40,0.18)";
      ctx.shadowBlur = 10 * u;
      ctx.shadowOffsetY = 4 * u;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.roundRect(-nw / 2, -nh / 2, nw, nh, B.board === "tags" ? 12 * u : 4 * u);
      ctx.fill();
      ctx.shadowColor = "transparent";
      if (B.board === "tags") {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, -nh / 2 + 14 * u, 6 * u, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = subFont(Math.min(30 * u * S, nh * 0.26), 800);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      fillTextFit(ctx, label, 0, B.board === "tags" ? 8 * u : 0, nw * 0.84, { maxLines: 2, lineHeight: 1.1, minScale: 0.55 });
      if (lit) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4 * u;
        ctx.strokeRect(-nw / 2 + 6 * u, -nh / 2 + 6 * u, nw - 12 * u, nh - 12 * u);
      }
      ctx.restore();
      return;
    }
    // Written lines: a mark, then the words written on from the left.
    const x0 = bx + g.pad;
    linePos.push({ x: x0 + bw * 0.3, y });
    if (k <= 0) return;
    const chalk = B.board === "chalk" || B.board === "menu";
    const col = chalk ? "rgba(255,255,255,0.92)" : INK;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - 4 * u, y - size, (bw - g.pad * 2 + 8 * u) * ease.outCubic(k), size * 2);
    ctx.clip();
    if (B.board === "clipboard") {
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = 3 * u;
      ctx.strokeRect(x0, y - size * 0.45, size * 0.9, size * 0.9);
      if (i < cur || (lit && t > T[i] + 0.5)) {
        ctx.strokeStyle = "#22a39a";
        ctx.lineWidth = 4 * u;
        ctx.beginPath();
        ctx.moveTo(x0 + size * 0.15, y);
        ctx.lineTo(x0 + size * 0.4, y + size * 0.25);
        ctx.lineTo(x0 + size * 0.85, y - size * 0.35);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = B.board === "menu" ? palette.accent : col;
      ctx.beginPath();
      if (B.board === "menu") ctx.arc(x0 + size * 0.4, y, size * 0.2, 0, TAU);
      else ctx.arc(x0 + size * 0.4, y, size * 0.14, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = lit && !chalk ? palette.primary : col;
    ctx.font = subFont(size, lit ? 800 : 700);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, label, x0 + size * 1.4, y, bw - g.pad * 2 - size * 1.6, { maxLines: 1, minScale: 0.6 });
    if (B.board === "menu") {
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.setLineDash([2 * u, 6 * u]);
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(x0 + size * 1.4, y + size * 0.75);
      ctx.lineTo(bx + bw - g.pad, y + size * 0.75);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
  ctx.restore();
  // The host points at the line being written; a second character keeps them company.
  const H = narrow ? Math.min(h - (by + bh) - 40 * u, w * 0.4) : Math.min(room * 1.05, st.width * 0.34);
  const hostX = narrow ? w * 0.36 : bx - Math.min(st.width * 0.16, H * 0.55);
  const target = cur >= 0 && linePos[cur] ? linePos[cur] : { x: bx + bw * 0.3, y: by + bh * 0.3 };
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const b = bounceIn(t, 0.05);
  const id = idle(t, 0);
  const host = person(sc, 0, seed * 29 + 7);
  const point = aim(hostX, floor - H * 0.62, target.x, target.y, 1);
  const rig = drawAbstract(ctx, hostX, floor + (1 - Math.min(1, b.k)) * H * 0.4, H, host, { armL: id.armL, armR: cur >= 0 ? point : waveArm(t, clamp((t - 0.3) / 0.4)), curlR: -0.1, lift: id.lift, squash: b.squash, mouth: cur >= 0 && (t - T[cur]) % 1 < 0.5 ? "open" : "smile", blink: blinkAt(t, 1), look: 0.7 });
  B.hat?.(ctx, rig);
  if (B.second) {
    const x2 = narrow ? w * 0.72 : Math.max(st.left + H * 0.25, hostX - H * 0.75);
    const b2 = bounceIn(t, 0.25);
    const id2 = idle(t, 1);
    const c2 = person(sc, 1, seed * 29 + 41);
    const rig2 = drawAbstract(ctx, x2, floor + (1 - Math.min(1, b2.k)) * H * 0.4, H * (B.second === "seated" ? 0.92 : 0.86), B.second === "seated" ? { ...c2, wheelchair: c2.kind !== "blob" ? c2.wheelchair || seed % 3 === 0 : false } : c2, { armL: id2.armL, armR: id2.armR, lift: id2.lift, squash: b2.squash, mouth: "smile", blink: blinkAt(t, 2), look: 0.8 });
    if (B.board === "tags") shoppingBag(ctx, rig2.handR, H * 0.32, palette.primary);
  }
  ctx.restore();
}

const careSlide = (sc: SkillContext) => boardSlide(sc, { backdrop: "hospital", board: "clipboard", hat: stethoscope, second: "seated", fallback: ["Book a visit", "Meet your team", "Follow-up notes"] });
const menuSlide = (sc: SkillContext) => boardSlide(sc, { backdrop: "cafe", board: "menu", hat: chefHat, fallback: ["Morning coffee", "Fresh pastries", "Lunch bowls"] });
const lessonSlide = (sc: SkillContext) => boardSlide(sc, { backdrop: "classroom", board: "chalk", second: "standing", fallback: ["Read", "Practise", "Share"] });
const teamSlide = (sc: SkillContext) => boardSlide(sc, { backdrop: "office", board: "sticky", second: "standing", fallback: ["Ideas", "Tasks", "Reviews", "Launch"] });
const shopSlide = (sc: SkillContext) => boardSlide(sc, { backdrop: "shop", board: "tags", second: "standing", fallback: ["Gifts", "Home goods", "Seasonal picks"] });

/* ───────────────────────── Delivery Route ───────────────────────── */

const ROUTE_POINTS = ["Picked up", "On the road", "Delivered"];

function deliveryRoute(sc0: SkillContext) {
  const sc = scenic(sc0, "city");
  const { ctx, w, h, t, u, palette, scene } = sc;
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, ROUTE_POINTS, 4, 2).map((x) => plain(split(x).title));
  const n = P.length;
  const T = pointTimes(scene, n, 1.0);
  const cur = current(t, T);
  const road = h * 0.9;
  const stops = P.map((_, i) => st.left + (st.width * (i + 0.5)) / n);
  // The van drives to each stop, pausing there; before the first it rolls in from the left.
  const vanAt = (tt: number) => {
    if (tt < T[0]) return lerp(-w * 0.2, stops[0], ease.outCubic(clamp((tt - (T[0] - 1)) / 1)));
    let i = 0;
    while (i < n - 1 && tt >= T[i + 1]) i++;
    if (i >= n - 1) return stops[n - 1] + Math.max(0, tt - T[n - 1] - 1.2) * w * 0.15;
    const leave = T[i] + 0.35;
    return lerp(stops[i], stops[i + 1], ease.inOutCubic(clamp((tt - leave) / (T[i + 1] - leave))));
  };
  const vx = vanAt(t);
  const moving = Math.abs(vanAt(t + 0.05) - vx) > 0.5 * u;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Pins pop up over the stops as the van reaches them.
  const size = 24 * u * S;
  P.forEach((label, i) => {
    const k = clamp(bounceIn(t, T[i] + 0.05).k);
    if (k <= 0) return;
    const px = stops[i];
    const py = road - h * (narrow ? 0.2 : 0.24);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(k, k);
    ctx.fillStyle = i === cur ? palette.primary : mixHex(palette.primary, "#ffffff", 0.35);
    ctx.beginPath();
    ctx.arc(0, -size * 1.2, size * 0.9, Math.PI * 0.85, Math.PI * 0.15);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, -size * 1.25, size * 0.35, 0, TAU);
    ctx.fill();
    ctx.restore();
    tag(sc, px, py - size * 3.4, label, size, k, i === cur, st.width / n - 10 * u);
  });
  // The van in the brand's colour, wheels turning while it moves.
  const vw = Math.min(w * 0.2, 260 * u * S);
  const vh = vw * 0.5;
  const bob = moving ? Math.sin(t * 20) * 1.5 * u : 0;
  const body = palette.primary;
  ctx.translate(vx, road - vw * 0.09 + bob);
  ctx.fillStyle = "rgba(20,10,40,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, vw * 0.09 - bob, vw * 0.55, vw * 0.04, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-vw / 2, -vh, vw * 0.68, vh, 10 * u);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(vw * 0.18, -vh * 0.75);
  ctx.lineTo(vw * 0.36, -vh * 0.75);
  ctx.quadraticCurveTo(vw * 0.5, -vh * 0.4, vw * 0.5, -vh * 0.25);
  ctx.lineTo(vw * 0.5, 0);
  ctx.lineTo(vw * 0.18, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#cfe9ff";
  ctx.beginPath();
  ctx.moveTo(vw * 0.24, -vh * 0.68);
  ctx.lineTo(vw * 0.35, -vh * 0.68);
  ctx.quadraticCurveTo(vw * 0.44, -vh * 0.45, vw * 0.45, -vh * 0.4);
  ctx.lineTo(vw * 0.24, -vh * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(-vw * 0.44, -vh * 0.55, vw * 0.54, vh * 0.12);
  ctx.fillStyle = mixHex(body, "#000000", 0.25);
  ctx.fillRect(-vw / 2, -vh * 0.12, vw, vh * 0.12);
  for (const wx of [-vw * 0.3, vw * 0.3]) {
    ctx.fillStyle = "#26282f";
    ctx.beginPath();
    ctx.arc(wx, 0, vh * 0.22, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#b8bfcc";
    ctx.lineWidth = 2 * u;
    const a = moving ? (vx / (vh * 0.22)) % TAU : 0;
    ctx.beginPath();
    for (let j = 0; j < 3; j++) {
      ctx.moveTo(wx, 0);
      ctx.lineTo(wx + Math.cos(a + (j * TAU) / 3) * vh * 0.15, Math.sin(a + (j * TAU) / 3) * vh * 0.15);
    }
    ctx.stroke();
  }
  ctx.restore();
  void rgba;
}


/* ───────────────────────── About us ───────────────────────── */

const ABOUT_POINTS = ["Based in your town", "Friendly local team", "Open six days a week"];

/**
 * About us: a picture of the business's own place (its bakery, barber shop, gym…) in a frame
 * beside a few lines about it: the name small (no big logo), the headline, a short paragraph and
 * a few facts with ticks. A "Based in …" point becomes a pinned caption on the picture.
 */
function aboutUs(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 0 });
  const tall = h > w * 1.2;
  const wide = w > h * 1.3;
  const S = tall ? 1.45 : wide ? 1 : 1.12;
  const out = 1 - ease.inCubic(range(t, d - 0.45, d));
  const points = itemsOr(scene, ABOUT_POINTS, 4, 1).map((x) => plain(split(x).title));
  const place = points.find((x) => /^based in\b|^in the heart of\b|^serving\b/i.test(x));
  const facts = points.filter((x) => x !== place).slice(0, 3);
  // The picture: the right half of a wide frame, the top of a tall or square one.
  const fw = wide ? w * 0.4 : w * 0.84;
  const fh = wide ? h * 0.66 : h * (tall ? 0.42 : 0.4);
  const fx = wide ? w * 0.54 : (w - fw) / 2;
  const fy = wide ? (h - fh) / 2 : h * 0.07;
  const pk = ease.outCubic(range(t, 0.1, 0.8));
  const r = 26 * u * S;
  ctx.save();
  ctx.globalAlpha = pk * out;
  ctx.translate(0, (1 - pk) * 36 * u);
  ctx.shadowColor = "rgba(10,10,30,0.3)";
  ctx.shadowBlur = 44 * u;
  ctx.shadowOffsetY = 16 * u;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(fx - 10 * u, fy - 10 * u, fw + 20 * u, fh + 20 * u, r + 8 * u);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.beginPath();
  ctx.roundRect(fx, fy, fw, fh, r);
  ctx.clip();
  // (A slow push into the picture while the slide holds.)
  const push = 1.04 + 0.04 * range(t, 0, d);
  ctx.translate(fx + fw / 2, fy + fh / 2);
  ctx.scale(push, push);
  ctx.translate(-(fx + fw / 2), -(fy + fh / 2));
  const own = sc.setting as SceneBackdrop | undefined;
  const pal = palette.light ? palette : { ...palette, text: INK, light: true };
  sceneIn({ ...sc, palette: pal }, own && own !== "house" ? own : "shop", fx, fy, fw, fh);
  ctx.restore();
  // The pinned place caption on the picture.
  if (place) {
    const ck = ease.outBack(range(t, 0.7, 1.1));
    const cs = 19 * u * S;
    ctx.save();
    ctx.globalAlpha = clamp(ck) * out;
    ctx.font = subFont(cs, 700);
    const cw = ctx.measureText(place).width + cs * 3;
    const cx = fx + 18 * u;
    const cy = fy + fh - cs * 2.4 - 14 * u;
    ctx.translate(cx, cy + cs);
    ctx.scale(0.8 + 0.2 * ck, 0.8 + 0.2 * ck);
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.beginPath();
    ctx.roundRect(0, -cs, cw, cs * 2, cs);
    ctx.fill();
    drawIcon(ctx, "MapPin", cs * 1.1, 0, cs * 1.05, palette.primary);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(place, cs * 2, 1 * u);
    ctx.restore();
  }
  // The business's own icon (a cone, a wrench, scissors…) badged on the picture's corner.
  const lead = sc.motifs?.[0];
  if (lead) {
    const bk = ease.outBack(range(t, 0.55, 0.95));
    const bs = 34 * u * S;
    ctx.save();
    ctx.globalAlpha = clamp(bk) * out;
    ctx.translate(fx + fw - bs * 0.95 - 8 * u, fy + bs * 0.95 + 8 * u);
    ctx.scale(0.7 + 0.3 * bk, 0.7 + 0.3 * bk);
    ctx.shadowColor = "rgba(10,10,30,0.25)";
    ctx.shadowBlur = 18 * u;
    ctx.shadowOffsetY = 6 * u;
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.arc(0, 0, bs, 0, TAU);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3 * u;
    ctx.stroke();
    drawIcon(ctx, lead, 0, 0, bs * 1.05, luminance(palette.primary) > 0.6 ? INK : "#ffffff");
    ctx.restore();
  }
  // The words: beside the picture in a wide frame, under it otherwise.
  const tx = wide ? w * 0.07 : fx;
  const tw = wide ? w * 0.42 : fw;
  let y = wide ? h * 0.2 : fy + fh + h * (tall ? 0.05 : 0.045);
  const T2 = wide ? 1.3 : 1;
  const line = (delay: number) => ease.outCubic(range(t, delay, delay + 0.6));
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  // The name, small: a brand-coloured dot and the name in capitals.
  const nk = line(0.25);
  const ns = 18 * u * S * T2;
  ctx.globalAlpha = nk * out;
  ctx.fillStyle = palette.primary;
  ctx.beginPath();
  ctx.roundRect(tx, y + ns * 0.1, ns * 0.9, ns * 0.9, ns * 0.25);
  ctx.fill();
  ctx.font = subFont(ns, 700);
  ctx.fillStyle = rgba(palette.text, 0.72);
  const name = (brand?.name ?? "").toUpperCase();
  if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${(ns * 0.14).toFixed(1)}px`;
  ctx.fillText(name, tx + ns * 1.5, y);
  if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";
  y += ns * 2.2;
  // The headline, with a short rule under it.
  const hk = line(0.4);
  const hs = (wide ? 84 : 58) * u * S;
  ctx.globalAlpha = hk * out;
  ctx.font = displayFont(saasFont(sc), hs);
  ctx.fillStyle = palette.text;
  const hn = fillTextFit(ctx, plain(scene.text || "About us"), tx, y + (1 - hk) * 14 * u, tw, { maxLines: 2, lineHeight: 1.08, minScale: 0.6 });
  y += hs * 1.08 * hn + hs * 0.25;
  ctx.fillStyle = palette.primary;
  ctx.fillRect(tx, y, 64 * u * S * hk, 5 * u * S);
  y += 26 * u * S;
  // The paragraph.
  const about = plain(scene.subtext || "");
  if (about) {
    const pk2 = line(0.6);
    const ps = 25 * u * S * T2;
    ctx.globalAlpha = pk2 * out;
    ctx.font = subFont(ps, 500);
    ctx.fillStyle = rgba(palette.text, 0.8);
    const pn = fillTextFit(ctx, about, tx, y + (1 - pk2) * 12 * u, tw, { maxLines: tall ? 5 : 4, lineHeight: 1.45, minScale: 0.75 });
    y += ps * 1.45 * pn + ps * 0.9;
  }
  // The facts, with ticks, one after another.
  const fs = 22 * u * S * T2;
  facts.forEach((f, i) => {
    const fk = ease.outBack(range(t, 0.9 + i * 0.18, 1.3 + i * 0.18));
    if (fk <= 0) return;
    ctx.globalAlpha = clamp(fk) * out;
    ctx.fillStyle = mixHex(palette.primary, palette.light ? "#ffffff" : palette.bg0, 0.82);
    ctx.beginPath();
    ctx.arc(tx + fs * 0.6, y + fs * 0.6, fs * 0.6, 0, TAU);
    ctx.fill();
    drawIcon(ctx, "Check", tx + fs * 0.6, y + fs * 0.6, fs * 0.75, palette.primary);
    ctx.font = subFont(fs, 600);
    ctx.fillStyle = palette.text;
    ctx.fillText(f, tx + fs * 1.6 + (1 - clamp(fk)) * 10 * u, y + fs * 0.08);
    y += fs * 1.75;
  });
  ctx.restore();
}

/* ───────────────────────── Registry ───────────────────────── */

const pops = (n: number, start = 0.8) => (scene: Scene) => pointTimes(scene, n, start).map((ti) => at(ti, "pop"));

export const industrySkills: Skill[] = [
  {
    id: "ind-about",
    name: "About Us",
    tagline: "The business's own place in a framed picture (its shop, salon, kitchen or studio) beside its name in small capitals, a headline, a short paragraph and a few ticked facts; a 'Based in …' point pins to the picture.",
    bestFor: "Local businesses and services: who they are in a few lines (the text under the headline), with 1–3 short facts; no big logo.",
    sample: { text: "About *us*", subtext: "A neighbourhood bakery baking by hand from early in the morning, for the people who live and work around the corner.", items: ABOUT_POINTS },
    itemsHint: "1–3 short facts (a 'Based in …' point pins to the picture)",
    render: aboutUs,
    sfx: (scene) => [at(0.1, "whoosh"), ...pointTimes(scene, 3, 0.9).map((ti) => at(ti, "pop"))],
  },
  {
    id: "ind-hometour",
    name: "Home Tour",
    tagline: "A cut-away of a home: the camera visits a room per point (living room with the dog, kitchen, bedroom, bathroom), then pulls back.",
    bestFor: "Home builders, real estate, interior design and rentals: 1–4 rooms or spaces to show (kitchen, bedroom, bathroom, living room).",
    sample: { text: "Step *inside*", items: HOME_POINTS },
    itemsHint: "1–4 rooms (kitchen, bedroom, bathroom, living room)",
    render: homeTour,
    sfx: (scene) => pointTimes(scene, itemsOr(scene, HOME_POINTS, 4, 1).length, 1.0).map((ti) => at(ti, "whoosh")),
  },
  {
    id: "ind-build",
    name: "Home Build",
    tagline: "A house goes up stage by stage (slab, frame, walls, roof) as the steps tick off; the new owners and their dog arrive at the end.",
    bestFor: "Home builders, renovation and custom homes: 2–5 short steps from plans to move-in.",
    sample: { text: "From plans to *keys*", items: BUILD_POINTS },
    itemsHint: "2–5 short steps",
    render: homeBuild,
    sfx: (scene) => pops(itemsOr(scene, BUILD_POINTS, 5, 2).length)(scene),
  },
  {
    id: "ind-site",
    name: "Job Site",
    tagline: "Beams carrying your points are lowered onto a construction site one by one while the crew in hard hats points them out.",
    bestFor: "Construction, trades, engineering and contractors: 2–4 short stages or services.",
    sample: { text: "Built with *care*", items: SITE_POINTS },
    itemsHint: "2–4 short stages",
    render: jobSite,
    sfx: (scene) => pops(itemsOr(scene, SITE_POINTS, 4, 2).length)(scene),
  },
  {
    id: "ind-care",
    name: "Care Visit",
    tagline: "In a clinic room a caregiver goes down a clipboard checklist with a patient, ticking off the points.",
    bestFor: "Health care, clinics, dental, therapy and care services: 2–4 short steps of a visit (no health claims).",
    sample: { text: "Your visit, *step by step*", items: ["Book a visit", "Meet your team", "Follow-up notes"] },
    itemsHint: "2–4 short steps",
    render: careSlide,
    sfx: pops(3),
  },
  {
    id: "ind-menu",
    name: "Menu Board",
    tagline: "In a café a chef presents the menu board as it's written up line by line.",
    bestFor: "Cafés, restaurants, bakeries and food trucks: 2–4 dishes or offers.",
    sample: { text: "Fresh on the *menu*", items: ["Morning coffee", "Fresh pastries", "Lunch bowls"] },
    itemsHint: "2–4 dishes or offers",
    render: menuSlide,
    sfx: pops(3),
  },
  {
    id: "ind-shop",
    name: "Shop Tags",
    tagline: "In a shop the points hang from a rail as swinging tags while a shopper with a bag looks on.",
    bestFor: "Retail, boutiques and online stores: 2–4 product ranges or reasons to visit.",
    sample: { text: "New in *store*", items: ["Gifts", "Home goods", "Seasonal picks"] },
    itemsHint: "2–4 ranges or reasons",
    render: shopSlide,
    sfx: pops(3),
  },
  {
    id: "ind-lesson",
    name: "Lesson Board",
    tagline: "In a classroom a teacher points along the chalkboard as the lesson is written up, a student beside them.",
    bestFor: "Schools, tutoring, courses and training: 2–4 short steps or topics.",
    sample: { text: "Today's *lesson*", items: ["Read", "Practise", "Share"] },
    itemsHint: "2–4 steps or topics",
    render: lessonSlide,
    sfx: pops(3),
  },
  {
    id: "ind-team",
    name: "Team Board",
    tagline: "In an office sticky notes go up on a whiteboard one by one while a colleague points them out.",
    bestFor: "Offices, agencies, consulting and B2B services: 2–4 short ideas, services or steps.",
    sample: { text: "Plan it *together*", items: ["Ideas", "Tasks", "Reviews", "Launch"] },
    itemsHint: "2–4 short notes",
    render: teamSlide,
    sfx: pops(4),
  },
  {
    id: "ind-route",
    name: "Delivery Route",
    tagline: "A van in your colours drives down a city street, stopping at pins for the points.",
    bestFor: "Delivery, logistics, moving, local services and travel: 2–4 stops or steps.",
    sample: { text: "On the *way*", items: ROUTE_POINTS },
    itemsHint: "2–4 stops or steps",
    render: deliveryRoute,
    sfx: (scene) => pointTimes(scene, itemsOr(scene, ROUTE_POINTS, 4, 2).length, 1.0).map((ti) => at(ti, "pop")),
  },
];
