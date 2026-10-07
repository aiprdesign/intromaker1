/**
 * Advanced characters: a jointed 2D rig for presenter-style explainer videos. Where the simple
 * characters (characters.ts) are a few rounded shapes, these have a skeleton (hips, spine, neck,
 * shoulders, elbows, wrists, knees, ankles) driven by joint angles, tapered limbs, real
 * proportions, and they turn from the front to a side profile, so they can walk.
 *
 * - Motion: a walk cycle (thighs and shins swing, knees bend on the swing, arms counter-swing, the
 *   body bobs), breathing, blinking, eye darts, head tilts and nods, talking mouths, waving,
 *   pointing at things, a hand on the chin, high fives.
 * - Look: a face with eye whites, irises, pupils, catch-lights and eyelids, brows that act, a nose,
 *   lips that open into talking shapes; hair styles with a moving ponytail; shirts with collars
 *   and open jackets, trousers and shoes; glasses and beards; soft illustrated shading.
 *
 * Slides:
 * - pro-walk:      a host walks in, turns to camera, waves and introduces the headline.
 * - pro-explainer: a presenter beside a floating card points at each point as it appears.
 * - pro-duo:       two characters talk: the points as an alternating conversation.
 * - pro-thinker:   a character ponders the problems (crossed out one by one), then has the idea.
 * - pro-unveil:    a character walks in holding up a sign with the headline, then presents it.
 * - pro-highfive:  two characters walk in, high-five, and turn to the call to action.
 *
 * Every frame is a pure function of time (preview, seek and export match) and nothing flashes.
 */
import { clamp, ease, lerp, mixHex, noise1, range, rgba, TAU } from "../math";
import { iconsFor, saasBackground, saasFont, spring } from "../saasfx";
import { displayFont, fillTextFit, subFont } from "../text";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { exitOf, itemsOr, split, stage } from "./beats";
import { blinkAt, fitBubble, pointTimes, pop, speech, useToon } from "./characters";
import { iconTile } from "./interactions";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const plain = (s: string) => s.replace(/\*/g, "").trim();
/** A direction from an angle measured from straight down (positive turns towards +x). */
const dir = (a: number): [number, number] => [Math.sin(a), Math.cos(a)];

/* ───────────────────────── Cast ───────────────────────── */

type HairStyle = "short" | "bob" | "long" | "bun" | "curly" | "buzz" | "ponytail";

export interface ProLook {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  iris: string;
  top: string;
  jacket?: string;
  bottom: string;
  shoe: string;
  glasses?: boolean;
  beard?: boolean;
}

const PRO_CAST: Omit<ProLook, "top" | "jacket" | "bottom" | "shoe">[] = [
  { skin: "#f0c3a0", hair: "#3a2416", hairStyle: "short", iris: "#5a3a22" },
  { skin: "#8a5a3c", hair: "#1b120d", hairStyle: "curly", iris: "#3b2416", glasses: true },
  { skin: "#e8b791", hair: "#7a3b1d", hairStyle: "long", iris: "#2f6b4f" },
  { skin: "#c88d64", hair: "#141414", hairStyle: "bun", iris: "#3a2a1c" },
  { skin: "#f6d8c2", hair: "#d4a13e", hairStyle: "ponytail", iris: "#3d6fb0" },
  { skin: "#6e4630", hair: "#0f0b09", hairStyle: "buzz", iris: "#2a1b12", beard: true },
];

export function proLook(p: Palette, i: number): ProLook {
  const c = PRO_CAST[((i % PRO_CAST.length) + PRO_CAST.length) % PRO_CAST.length];
  const tops = [p.primary, "#ff8a5c", "#2ec4b6", "#ffbe0b", "#9b5de5", "#ef476f"].map((x, k) => (k ? mixHex(x, p.primary, 0.12) : x));
  const jackets = [undefined, "#2b3048", undefined, "#5a4637", undefined, "#33405f"];
  return {
    ...c,
    top: tops[i % tops.length],
    jacket: jackets[i % jackets.length],
    bottom: p.light ? ["#2f3550", "#3b3f4a", "#24304d", "#4a3c33", "#2c3a4a", "#30303a"][i % 6] : ["#58628e", "#5f6478", "#4f5f8a", "#6d5a4d", "#4f6377", "#55556a"][i % 6],
    shoe: p.light ? "#1d1f2a" : "#2e3350",
  };
}

/* ───────────────────────── Rig ───────────────────────── */

type Hand = "open" | "fist" | "point" | "thumb";

export interface ProPose {
  /** −1 profile facing left … 0 front … 1 profile facing right. */
  facing: number;
  /** Spine lean (radians, positive leans to +x). */
  lean?: number;
  /** Extra lift of the whole body (in heights), e.g. a hop. */
  lift?: number;
  headTilt?: number;
  /** Arms: [shoulder angle, elbow bend], screen-space radians from straight down. */
  armL: [number, number];
  armR: [number, number];
  /** Legs: [hip angle, knee bend]. */
  legL?: [number, number];
  legR?: [number, number];
  handL?: Hand;
  handR?: Hand;
  /** 0 closed … 1 wide open (talking). */
  mouth?: number;
  /** −1 frown … 1 big smile. */
  smile?: number;
  blink?: number;
  lookX?: number;
  lookY?: number;
  /** −1 worried … 1 raised. */
  brows?: number;
  /** Hair swing (radians) for the ponytail. */
  sway?: number;
  /** Reach a hand to a point (inverse kinematics; "chin" for a hand on the chin), blended in by reachK. */
  reachL?: { x: number; y: number } | "chin";
  reachR?: { x: number; y: number } | "chin";
  reachK?: number;
}

export interface ProRig {
  head: { x: number; y: number; r: number };
  top: number;
  handL: { x: number; y: number };
  handR: { x: number; y: number };
  shoulderL: { x: number; y: number };
  shoulderR: { x: number; y: number };
}

/** Shadows are a cool violet (not black) and highlights a touch of white: the illustrator's palette. */
const SHADOW = "#24123f";
const shade = (c: string, k: number) => mixHex(c, SHADOW, k);
const light = (c: string, k: number) => mixHex(c, "#ffffff", k);
type P = [number, number];

/**
 * A limb through three joints (hip–knee–ankle, shoulder–elbow–wrist) as one seamless tapered
 * shape: straight sides, a rounded bend at the middle joint, round ends. One fill, so no seams.
 */
function limbPath(ctx: CanvasRenderingContext2D, p0: P, p1: P, p2: P, r0: number, r1: number, r2: number) {
  const nrm = (a: P, b: P): P => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    return [-dy / L, dx / L];
  };
  const n1 = nrm(p0, p1);
  const n2 = nrm(p1, p2);
  let bx = n1[0] + n2[0];
  let by = n1[1] + n2[1];
  const bl = Math.hypot(bx, by) || 1;
  bx /= bl;
  by /= bl;
  const cosh = Math.max(0.55, bx * n1[0] + by * n1[1]);
  const m = r1 / cosh;
  const at = (p: P, n: P, r: number, s: number): P => [p[0] + n[0] * r * s, p[1] + n[1] * r * s];
  const a2 = Math.atan2(n2[1], n2[0]);
  const a0 = Math.atan2(-n1[1], -n1[0]);
  ctx.beginPath();
  const A1 = at(p0, n1, r0, 1);
  ctx.moveTo(A1[0], A1[1]);
  const A2 = at(p1, n1, r1, 1);
  ctx.lineTo(A2[0], A2[1]);
  const A3 = at(p1, n2, r1, 1);
  ctx.quadraticCurveTo(p1[0] + bx * m, p1[1] + by * m, A3[0], A3[1]);
  const A4 = at(p2, n2, r2, 1);
  ctx.lineTo(A4[0], A4[1]);
  ctx.arc(p2[0], p2[1], r2, a2, a2 - Math.PI, true);
  const B3 = at(p1, n2, r1, -1);
  ctx.lineTo(B3[0], B3[1]);
  const B2 = at(p1, n1, r1, -1);
  ctx.quadraticCurveTo(p1[0] - bx * m, p1[1] - by * m, B2[0], B2[1]);
  const B1 = at(p0, n1, r0, -1);
  ctx.lineTo(B1[0], B1[1]);
  ctx.arc(p0[0], p0[1], r0, a0, a0 - Math.PI, true);
  ctx.closePath();
}

/** A mitten hand at the wrist, pointing along `a` (radians from straight down). */
function drawHand(ctx: CanvasRenderingContext2D, wx: number, wy: number, a: number, H: number, skin: string, kind: Hand, inner: number) {
  ctx.save();
  ctx.translate(wx, wy);
  ctx.rotate(-a);
  const w = H * 0.038;
  const l = H * 0.05;
  ctx.fillStyle = skin;
  if (kind === "open") {
    ctx.beginPath();
    ctx.roundRect(-w / 2, -H * 0.004, w, l, [w * 0.35, w * 0.35, w * 0.5, w * 0.5]);
    ctx.fill();
    // Thumb, out to the inside.
    ctx.beginPath();
    ctx.ellipse(inner * w * 0.55, l * 0.32, w * 0.2, w * 0.36, inner * 0.6, 0, TAU);
    ctx.fill();
    // Finger line.
    ctx.strokeStyle = shade(skin, 0.22);
    ctx.lineWidth = H * 0.0028;
    ctx.beginPath();
    ctx.moveTo(-w * 0.1 * inner, l * 0.55);
    ctx.lineTo(-w * 0.1 * inner, l * 0.9);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.roundRect(-w * 0.55, 0, w * 1.1, w * 1.05, w * 0.42);
    ctx.fill();
    if (kind === "point") {
      ctx.beginPath();
      ctx.roundRect(-w * 0.16, w * 0.6, w * 0.32, l * 0.95, w * 0.16);
      ctx.fill();
    } else if (kind === "thumb") {
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.roundRect(-w * 0.15, -w * 0.75, w * 0.3, w * 0.75, w * 0.15);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = shade(skin, 0.22);
    ctx.lineWidth = H * 0.0028;
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, w * 0.72);
    ctx.lineTo(w * 0.3, w * 0.72);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw an advanced character with its feet on `groundY` at `x`, `H` tall (crown to sole when
 * standing). Returns its head, hands and shoulders, for bubbles, props and pointing.
 */
export function drawPro(ctx: CanvasRenderingContext2D, x: number, groundY: number, H: number, look: ProLook, pose: ProPose): ProRig {
  const f = clamp(pose.facing, -1, 1);
  const af = Math.abs(f);
  const fs = f >= 0 ? 1 : -1;
  const headR = H * 0.09;
  const thigh = H * 0.235;
  const shin = H * 0.225;
  const upper = H * 0.165;
  const fore = H * 0.145;
  const torso = H * 0.3;
  const shW = H * 0.24 * (1 - af * 0.42);
  const hipW = H * 0.17 * (1 - af * 0.42);
  const legL = pose.legL ?? [-0.04, 0];
  const legR = pose.legR ?? [0.04, 0];
  const footOf = (sx: number, [a, k]: [number, number]) => {
    const [d1x, d1y] = dir(a);
    const kx = sx + d1x * thigh;
    const ky = d1y * thigh;
    const [d2x, d2y] = dir(a + k);
    return { kx, ky, ax: kx + d2x * shin, ay: ky + d2y * shin };
  };
  const hipOff = (s: number) => s * hipW * 0.3 * (1 - af * 0.8);
  const fl = footOf(hipOff(-1), legL);
  const fr = footOf(hipOff(1), legR);
  const ankleH = H * 0.028;
  const hipY = groundY - ankleH - Math.max(fl.ay, fr.ay) - (pose.lift ?? 0) * H;
  const hipX = x;
  const lean = pose.lean ?? 0;
  const [ux, uy] = [Math.sin(lean), -Math.cos(lean)];
  const neckX = hipX + ux * torso;
  const neckY = hipY + uy * torso;
  const headX = neckX + ux * (H * 0.03 + headR) + Math.sin(pose.headTilt ?? 0) * headR * 0.2;
  const headY = neckY + uy * (H * 0.03 + headR * 0.95);
  // (Tucked just inside the torso's rounded shoulder, so the sleeve grows out of it.)
  const shoulder = (s: number) => ({ x: neckX + s * (shW * 0.5 - H * 0.012) * (1 - af * 0.75) - f * shW * 0.08, y: neckY + H * 0.05 });
  const sL = shoulder(-1);
  const sR = shoulder(1);
  const far = af > 0.3 ? (fs > 0 ? "L" : "R") : null;
  const out: ProRig = { head: { x: headX, y: headY, r: headR }, top: headY - headR * 1.22, handL: { x: 0, y: 0 }, handR: { x: 0, y: 0 }, shoulderL: sL, shoulderR: sR };
  const sleeve = look.jacket ?? look.top;

  const drawLeg = (side: "L" | "R") => {
    const s = side === "L" ? -1 : 1;
    const g = side === "L" ? fl : fr;
    const dim = far === side ? 0.16 : 0;
    const hip: P = [hipX + hipOff(s), hipY];
    const knee: P = [hipX + g.kx, hipY + g.ky];
    const ank: P = [hipX + g.ax, hipY + g.ay];
    // Trousers: one shape, with the shadow side (away from the light) a tone darker.
    ctx.fillStyle = shade(look.bottom, dim);
    limbPath(ctx, hip, knee, ank, H * 0.05, H * 0.041, H * 0.033);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = shade(look.bottom, dim + 0.18);
    ctx.fillRect(hip[0] + (af > 0.3 ? -fs : 1) * H * 0.012, hipY - H * 0.1, H * (af > 0.3 ? -fs : 1) * 0.2, H * 0.7);
    ctx.restore();
    // Sneaker: a rounded upper and a white sole (pointing the way the character faces).
    const ax = ank[0];
    const ay = ank[1];
    const toe = af > 0.3 ? fs : s * 0.15;
    const sw = af > 0.3 ? H * 0.115 : H * 0.07;
    const sx = ax - sw / 2 + toe * H * 0.03;
    ctx.fillStyle = light(look.shoe, 0.06 - dim * 0.3);
    ctx.beginPath();
    ctx.roundRect(sx, ay - H * 0.012, sw, H * 0.04, [H * 0.02, H * 0.024, H * 0.012, H * 0.012]);
    ctx.fill();
    ctx.fillStyle = shade("#f4f2f7", dim);
    ctx.beginPath();
    ctx.roundRect(sx - H * 0.002, ay + H * 0.018, sw + H * 0.004, H * 0.013, H * 0.006);
    ctx.fill();
  };

  /** Two-joint IK: the shoulder and elbow angles that put the wrist on a target, elbow out. */
  const reach = (sh: { x: number; y: number }, tx: number, ty: number, s: number): [number, number] => {
    const dx = tx - sh.x;
    const dy = ty - sh.y;
    const d = clamp(Math.hypot(dx, dy), Math.abs(upper - fore) + 1e-3, upper + fore - 1e-3);
    const base = Math.atan2(dx, dy);
    const alpha = Math.acos(clamp((upper * upper + d * d - fore * fore) / (2 * upper * d), -1, 1));
    const a = base + s * alpha;
    const ex = sh.x + Math.sin(a) * upper;
    const ey = sh.y + Math.cos(a) * upper;
    let a2 = Math.atan2(sh.x + (dx / Math.hypot(dx, dy || 1e-6)) * d - ex, sh.y + (dy / Math.hypot(dx, dy || 1e-6)) * d - ey);
    // Keep the bend continuous (no wrap-around jump between the two angles).
    while (a2 - a > Math.PI) a2 -= TAU;
    while (a2 - a < -Math.PI) a2 += TAU;
    return [a, a2 - a];
  };
  const chin = { x: headX + f * headR * 0.25 + Math.sin(pose.headTilt ?? 0) * headR, y: headY + headR * 1.08 };
  const drawArm = (side: "L" | "R") => {
    const s = side === "L" ? -1 : 1;
    const sh = side === "L" ? sL : sR;
    let [a, b] = side === "L" ? pose.armL : pose.armR;
    const target = side === "L" ? pose.reachL : pose.reachR;
    if (target) {
      const tp = target === "chin" ? chin : target;
      // The wrist sits a hand's length short of the target, so the hand lands on it.
      const [ra, rb] = reach(sh, tp.x - s * H * 0.01, tp.y + H * 0.035, s);
      const k = clamp(pose.reachK ?? 1);
      a = lerp(a, ra, k);
      b = lerp(b, rb, k);
    }
    const [d1x, d1y] = dir(a);
    const el: P = [sh.x + d1x * upper, sh.y + d1y * upper];
    const [d2x, d2y] = dir(a + b);
    const wr: P = [el[0] + d2x * fore, el[1] + d2y * fore];
    const dim = far === side ? 0.16 : 0;
    ctx.fillStyle = shade(sleeve, dim);
    limbPath(ctx, [sh.x, sh.y], el, wr, H * 0.042, H * 0.035, H * 0.029);
    ctx.fill();
    // Shadow down the back of the arm.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = shade(sleeve, dim + 0.16);
    limbPath(ctx, [sh.x + H * 0.014, sh.y + H * 0.01], [el[0] + H * 0.014, el[1]], [wr[0] + H * 0.01, wr[1]], H * 0.03, H * 0.024, H * 0.018);
    ctx.fill();
    ctx.restore();
    // Shirt cuff showing under a jacket sleeve, or a lighter cuff band.
    const cx = wr[0] - d2x * H * 0.012;
    const cy = wr[1] - d2y * H * 0.012;
    ctx.fillStyle = look.jacket ? light(look.top, 0.1) : shade(look.top, dim + 0.12);
    ctx.beginPath();
    ctx.ellipse(cx, cy, H * 0.03, H * 0.012, -(a + b), 0, TAU);
    ctx.fill();
    const hx = wr[0] + d2x * H * 0.004;
    const hy = wr[1] + d2y * H * 0.004;
    drawHand(ctx, hx, hy, a + b, H, shade(look.skin, dim), (side === "L" ? pose.handL : pose.handR) ?? "open", -s);
    return { x: wr[0] + d2x * H * 0.03, y: wr[1] + d2y * H * 0.03 };
  };

  // The torso: rounded shoulders, a waist, hips; x follows the lean.
  const top = neckY - H * 0.004;
  const bot = hipY + H * 0.026;
  const cxAt = (y: number) => lerp(neckX, hipX, clamp((y - top) / (bot - top)));
  const torsoPath = () => {
    const nw = H * 0.03;
    const L = sL.x - H * 0.03;
    const R = sR.x + H * 0.03;
    const shy = sL.y + H * 0.012;
    const wy = lerp(top, bot, 0.62);
    const wh = shW * 0.4;
    const hh = hipW * 0.56;
    ctx.beginPath();
    ctx.moveTo(neckX - nw, top);
    ctx.quadraticCurveTo(L + H * 0.006, top + H * 0.002, L, shy);
    ctx.bezierCurveTo(L - H * 0.004, shy + H * 0.1, cxAt(wy) - wh, wy - H * 0.06, cxAt(wy) - wh, wy);
    ctx.quadraticCurveTo(cxAt(wy) - wh, lerp(wy, bot, 0.6), hipX - hh, bot);
    ctx.lineTo(hipX + hh, bot);
    ctx.quadraticCurveTo(cxAt(wy) + wh, lerp(wy, bot, 0.6), cxAt(wy) + wh, wy);
    ctx.bezierCurveTo(cxAt(wy) + wh, wy - H * 0.06, R + H * 0.004, shy + H * 0.1, R, shy);
    ctx.quadraticCurveTo(R - H * 0.006, top + H * 0.002, neckX + nw, top);
    ctx.quadraticCurveTo(neckX, top + H * 0.014, neckX - nw, top);
    ctx.closePath();
  };

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Ground shadow.
  const sg = ctx.createRadialGradient(x, groundY, 0, x, groundY, H * 0.2);
  sg.addColorStop(0, "rgba(20,10,40,0.22)");
  sg.addColorStop(1, "rgba(20,10,40,0)");
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(x, groundY + H * 0.004, H * 0.2, H * 0.032, 0, 0, TAU);
  ctx.fill();

  // Hair behind the head.
  ctx.fillStyle = shade(look.hair, 0.1);
  if (look.hairStyle === "long") {
    ctx.beginPath();
    ctx.moveTo(headX - headR * 1.12 + f * headR * 0.1, headY - headR * 0.2);
    ctx.bezierCurveTo(headX - headR * 1.3, headY + headR * 1.4, headX - headR * 1.05, headY + headR * 2.3, headX - headR * 0.6, headY + headR * 2.35);
    ctx.lineTo(headX + headR * 0.6, headY + headR * 2.35);
    ctx.bezierCurveTo(headX + headR * 1.05, headY + headR * 2.3, headX + headR * 1.3, headY + headR * 1.4, headX + headR * 1.12 + f * headR * 0.1, headY - headR * 0.2);
    ctx.closePath();
    ctx.fill();
  } else if (look.hairStyle === "bob") {
    ctx.beginPath();
    ctx.roundRect(headX - headR * 1.16, headY - headR * 0.5, headR * 2.32, headR * 1.6, [headR, headR, headR * 0.5, headR * 0.5]);
    ctx.fill();
  } else if (look.hairStyle === "ponytail") {
    const sw = pose.sway ?? 0;
    const bx = headX - fs * af * headR * 0.9;
    const by = headY - headR * 0.6;
    const [tx, ty] = dir(-fs * (0.35 + af * 0.45) + sw);
    ctx.beginPath();
    ctx.moveTo(bx - headR * 0.22, by);
    ctx.bezierCurveTo(bx + tx * headR * 0.7 - headR * 0.45, by + ty * headR * 0.8, bx + tx * headR * 1.6 - headR * 0.2, by + ty * headR * 1.7, bx + tx * headR * 1.9, by + ty * headR * 2.0);
    ctx.bezierCurveTo(bx + tx * headR * 1.4 + headR * 0.3, by + ty * headR * 1.3, bx + tx * headR * 0.6 + headR * 0.4, by + ty * headR * 0.6, bx + headR * 0.22, by);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(look.top, 0.1);
    ctx.beginPath();
    ctx.arc(bx, by, headR * 0.16, 0, TAU);
    ctx.fill();
  } else if (look.hairStyle === "bun") {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.arc(headX - fs * af * headR * 0.55, headY - headR * 1.12, headR * 0.44, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = shade(look.hair, 0.25);
    ctx.lineWidth = headR * 0.05;
    ctx.beginPath();
    ctx.arc(headX - fs * af * headR * 0.55, headY - headR * 1.12, headR * 0.26, 0.6, 2.4);
    ctx.stroke();
  }

  if (far === "L") out.handL = drawArm("L");
  if (far === "R") out.handR = drawArm("R");
  if (far === "L") {
    drawLeg("L");
    drawLeg("R");
  } else {
    drawLeg("R");
    drawLeg("L");
  }

  // Shirt, with its shadow side.
  ctx.fillStyle = look.top;
  torsoPath();
  ctx.fill();
  ctx.save();
  torsoPath();
  ctx.clip();
  ctx.fillStyle = shade(look.top, 0.16);
  ctx.beginPath();
  ctx.moveTo(neckX + shW * 0.22, top - H * 0.02);
  ctx.bezierCurveTo(neckX + shW * 0.1, lerp(top, bot, 0.35), hipX + hipW * 0.12, lerp(top, bot, 0.75), hipX + hipW * 0.24, bot + H * 0.02);
  ctx.lineTo(hipX + H, bot + H * 0.02);
  ctx.lineTo(neckX + H, top - H * 0.02);
  ctx.closePath();
  ctx.fill();
  // Front view: a button placket and a chest pocket.
  if (af < 0.45 && !look.jacket) {
    const px = neckX + f * shW * 0.2;
    ctx.strokeStyle = shade(look.top, 0.28);
    ctx.lineWidth = H * 0.003;
    ctx.beginPath();
    ctx.moveTo(px, top + H * 0.016);
    ctx.lineTo(lerp(px, hipX, 0.9), bot - H * 0.03);
    ctx.stroke();
    ctx.fillStyle = light(look.top, 0.45);
    for (let k = 0; k < 3; k++) {
      const yy = lerp(top + H * 0.05, bot - H * 0.05, k / 2);
      ctx.beginPath();
      ctx.arc(lerp(px, hipX, (yy - top) / (bot - top)) + H * 0.006, yy, H * 0.004, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = shade(look.top, 0.22);
    ctx.beginPath();
    ctx.roundRect(neckX - shW * 0.32, top + H * 0.06, shW * 0.16, H * 0.04, [0, 0, H * 0.008, H * 0.008]);
    ctx.stroke();
  }
  // Open jacket: two panels with lapels; one panel in profile.
  if (look.jacket) {
    const gap = shW * 0.14 * (1 - af);
    const cx = neckX + f * shW * 0.25;
    const panel = (s: number) => {
      ctx.beginPath();
      ctx.moveTo(cx + s * gap, top - H * 0.01);
      ctx.lineTo(cx + s * gap * 0.7, bot + H * 0.02);
      ctx.lineTo(cx + s * H, bot + H * 0.02);
      ctx.lineTo(cx + s * H, top - H * 0.05);
      ctx.closePath();
    };
    for (const s of [-1, 1]) {
      if (af > 0.85 && s === -fs) continue;
      ctx.fillStyle = s > 0 ? shade(look.jacket, 0.14) : look.jacket;
      panel(s);
      ctx.fill();
      // Lapel: a lighter fold from the collar down to the chest.
      ctx.fillStyle = light(look.jacket, 0.1);
      ctx.beginPath();
      ctx.moveTo(cx + s * gap, top);
      ctx.lineTo(cx + s * (gap + shW * 0.16), top);
      ctx.lineTo(cx + s * (gap + shW * 0.08), top + torso * 0.22);
      ctx.lineTo(cx + s * gap * 0.9, top + torso * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Belt with a buckle.
  ctx.fillStyle = shade(look.bottom, 0.3);
  ctx.fillRect(hipX - H, bot - H * 0.026, H * 2, H * 0.024);
  if (af < 0.5) {
    ctx.fillStyle = "#c9b38a";
    ctx.fillRect(hipX + f * hipW * 0.3 - H * 0.012, bot - H * 0.026, H * 0.024, H * 0.024);
  }
  ctx.restore();

  // Neck (with the jaw's shadow on it) and collar points.
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.roundRect(neckX - H * 0.024 + ux * H * 0.02, neckY - H * 0.04, H * 0.048, H * 0.05, H * 0.014);
  ctx.fill();
  ctx.fillStyle = shade(look.skin, 0.2);
  ctx.beginPath();
  ctx.roundRect(neckX - H * 0.024 + ux * H * 0.02, neckY - H * 0.04, H * 0.048, H * 0.022, H * 0.01);
  ctx.fill();
  ctx.fillStyle = light(look.top, 0.25);
  for (const s of [-1, 1]) {
    if (af > 0.7 && s === -fs) continue;
    ctx.beginPath();
    ctx.moveTo(neckX + s * H * 0.006 + f * H * 0.01, neckY + H * 0.02);
    ctx.lineTo(neckX + s * H * 0.036 + f * H * 0.01, neckY - H * 0.006);
    ctx.lineTo(neckX + s * H * 0.026 + f * H * 0.01, neckY - H * 0.016);
    ctx.lineTo(neckX + s * H * 0.004 + f * H * 0.01, neckY + H * 0.004);
    ctx.closePath();
    ctx.fill();
  }

  // Head.
  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(pose.headTilt ?? 0);
  const R = headR;
  const fx = f * R * 0.42;
  // Ears.
  for (const s of [-1, 1]) {
    if (af > 0.6 && s === fs) continue;
    const ex = s * R * 0.98 * (1 - af * 0.6) - f * R * 0.15;
    ctx.fillStyle = shade(look.skin, 0.06);
    ctx.beginPath();
    ctx.ellipse(ex, R * 0.12, R * 0.17, R * 0.24, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = shade(look.skin, 0.25);
    ctx.lineWidth = R * 0.04;
    ctx.beginPath();
    ctx.arc(ex, R * 0.12, R * 0.08, -1.2 * s + (s > 0 ? 0 : Math.PI), 1.2 * s + (s > 0 ? 0 : Math.PI), s < 0);
    ctx.stroke();
  }
  // Face shape.
  const face = () => {
    ctx.beginPath();
    ctx.moveTo(-R, -R * 0.05);
    ctx.bezierCurveTo(-R, -R * 1.3, R, -R * 1.3, R, -R * 0.05);
    ctx.bezierCurveTo(R, R * 0.62 + af * R * 0.1, R * 0.45 + fx * 0.5, R * 1.1, fx * 0.6, R * 1.1);
    ctx.bezierCurveTo(-R * 0.45 + fx * 0.5, R * 1.1, -R, R * 0.62 + af * R * 0.1, -R, -R * 0.05);
    ctx.closePath();
  };
  ctx.fillStyle = look.skin;
  face();
  ctx.fill();
  if (af > 0.3) {
    ctx.beginPath();
    ctx.moveTo(fs * R * 0.86, R * 0.02);
    ctx.quadraticCurveTo(fs * R * (1.12 + 0.08 * af), R * 0.32, fs * R * 0.9, R * 0.4);
    ctx.lineTo(fs * R * 0.8, R * 0.36);
    ctx.closePath();
    ctx.fill();
  }
  // Face shadows: the side away from the light, and the hairline's shadow on the forehead.
  ctx.save();
  face();
  ctx.clip();
  ctx.fillStyle = shade(look.skin, 0.13);
  ctx.beginPath();
  ctx.moveTo(R * 0.5 + fx * 0.4, -R * 1.2);
  ctx.bezierCurveTo(R * 0.85 + fx * 0.2, -R * 0.2, R * 0.75 + fx * 0.2, R * 0.6, R * 0.2 + fx * 0.6, R * 1.2);
  ctx.lineTo(R * 2, R * 1.2);
  ctx.lineTo(R * 2, -R * 1.2);
  ctx.closePath();
  ctx.fill();
  if (look.hairStyle !== "buzz") {
    ctx.fillStyle = shade(look.skin, 0.2);
    ctx.beginPath();
    ctx.moveTo(-R * 1.1, -R * 0.3);
    ctx.quadraticCurveTo(-R * 0.6, -R * 0.36, -R * 0.15 + fx * 0.4, -R * 0.22);
    ctx.quadraticCurveTo(R * 0.4 - fx * 0.3, -R * 0.4, R * 1.1, -R * 0.15);
    ctx.lineTo(R * 1.1, -R * 1.4);
    ctx.lineTo(-R * 1.1, -R * 1.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Beard along the jaw.
  if (look.beard) {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.moveTo(-R * 0.97, R * 0.15);
    ctx.bezierCurveTo(-R * 0.92, R * 1.0, -R * 0.3 + fx * 0.5, R * 1.24, fx * 0.6, R * 1.22);
    ctx.bezierCurveTo(R * 0.3 + fx * 0.5, R * 1.24, R * 0.92, R * 1.0, R * 0.97, R * 0.15);
    ctx.lineTo(R * 0.72, R * 0.3);
    ctx.quadraticCurveTo(R * 0.5, R * 0.62, fx * 0.6 + R * 0.25, R * 0.55);
    ctx.quadraticCurveTo(fx * 0.6, R * 0.5, fx * 0.6 - R * 0.25, R * 0.55);
    ctx.quadraticCurveTo(-R * 0.5, R * 0.62, -R * 0.72, R * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  // Eyes.
  const blink = clamp(pose.blink ?? 0);
  const lx = (pose.lookX ?? 0) * R * 0.06 + f * R * 0.04;
  const ly = (pose.lookY ?? 0) * R * 0.05;
  const eyeY = R * 0.08;
  const spread = R * 0.4 * (1 - af * 0.6);
  for (const s of [-1, 1]) {
    const isFar = af > 0.25 && s !== fs;
    if (isFar && af > 0.75) continue;
    const exx = fx + s * spread;
    const sx = 1 - (isFar ? af * 0.6 : af * 0.2);
    const rx = R * 0.16 * sx;
    const ry = R * 0.15;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(exx, eyeY, rx, ry, 0, 0, TAU);
    ctx.fillStyle = "#fbfbfd";
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = look.iris;
    ctx.beginPath();
    ctx.arc(exx + lx, eyeY + ly + R * 0.015, R * 0.105, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#120e18";
    ctx.beginPath();
    ctx.arc(exx + lx, eyeY + ly + R * 0.015, R * 0.058, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(exx + lx + R * 0.04, eyeY + ly - R * 0.03, R * 0.03, 0, TAU);
    ctx.fill();
    const lid = lerp(0.24, 1.05, blink);
    ctx.fillStyle = shade(look.skin, 0.08);
    ctx.fillRect(exx - rx - 2, eyeY - ry - 2, rx * 2 + 4, ry * 2 * lid + 2);
    ctx.restore();
    // Upper lid line, thicker at the outer corner.
    ctx.strokeStyle = "#241812";
    ctx.lineWidth = R * 0.05;
    const ly2 = eyeY - ry + ry * 2 * lerp(0.24, 1.0, blink);
    ctx.beginPath();
    ctx.moveTo(exx - rx * 1.05, ly2 + R * 0.01);
    ctx.quadraticCurveTo(exx, ly2 - R * 0.035, exx + rx * 1.1 * s * s, ly2 + R * 0.005);
    ctx.stroke();
    // Brows.
    const b = pose.brows ?? 0;
    ctx.strokeStyle = shade(look.hair, 0.05);
    ctx.lineWidth = R * 0.085;
    const by = eyeY - ry - R * (0.14 + 0.06 * Math.max(0, b));
    const innerUp = b < 0 ? -b * R * 0.09 : 0;
    ctx.beginPath();
    ctx.moveTo(exx - s * rx * 1.1, by - innerUp);
    ctx.quadraticCurveTo(exx, by - R * 0.05, exx + s * rx * 1.15, by + R * 0.025);
    ctx.stroke();
  }
  // Glasses.
  if (look.glasses) {
    ctx.strokeStyle = "#1d1a22";
    ctx.lineWidth = R * 0.055;
    for (const s of [-1, 1]) {
      if (af > 0.75 && s !== fs) continue;
      ctx.beginPath();
      ctx.roundRect(fx + s * spread - R * 0.25 * (1 - af * 0.4), eyeY - R * 0.21, R * 0.5 * (1 - af * 0.4), R * 0.4, R * 0.12);
      ctx.stroke();
    }
    if (af < 0.75) {
      ctx.beginPath();
      ctx.moveTo(fx - spread + R * 0.25, eyeY - R * 0.04);
      ctx.quadraticCurveTo(fx, eyeY - R * 0.1, fx + spread - R * 0.25, eyeY - R * 0.04);
      ctx.stroke();
    }
  }
  // Nose (front): a soft shadow shape.
  if (af <= 0.3) {
    ctx.fillStyle = shade(look.skin, 0.2);
    ctx.beginPath();
    ctx.moveTo(fx + R * 0.05, R * 0.16);
    ctx.quadraticCurveTo(fx + R * 0.15, R * 0.4, fx + R * 0.02, R * 0.43);
    ctx.quadraticCurveTo(fx - R * 0.06, R * 0.44, fx - R * 0.08, R * 0.4);
    ctx.quadraticCurveTo(fx + R * 0.06, R * 0.38, fx + R * 0.05, R * 0.16);
    ctx.fill();
  }
  // Mouth.
  const open = clamp(pose.mouth ?? 0);
  const smile = clamp(pose.smile ?? 0.3, -1, 1);
  const mx = fx * 1.05 + (af > 0.3 ? fs * R * 0.12 : 0);
  const my = R * 0.64;
  const mw = R * 0.28 * (1 - af * 0.45);
  if (open > 0.06) {
    const oh = R * (0.06 + 0.22 * open);
    ctx.fillStyle = "#4e1822";
    ctx.beginPath();
    ctx.moveTo(mx - mw, my - smile * R * 0.05);
    ctx.quadraticCurveTo(mx, my - oh * 0.25, mx + mw, my - smile * R * 0.05);
    ctx.quadraticCurveTo(mx, my + oh * 1.6, mx - mw, my - smile * R * 0.05);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#f7f3ef";
    ctx.fillRect(mx - mw, my - oh, mw * 2, oh * 0.55);
    ctx.fillStyle = "#e46f7c";
    ctx.beginPath();
    ctx.ellipse(mx, my + oh * 1.05, mw * 0.55, oh * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.strokeStyle = "#6e2630";
    ctx.lineWidth = R * 0.06;
    ctx.beginPath();
    ctx.moveTo(mx - mw, my - smile * R * 0.08);
    ctx.quadraticCurveTo(mx, my + smile * R * 0.16, mx + mw, my - smile * R * 0.08);
    ctx.stroke();
    // Lower lip shadow.
    ctx.strokeStyle = shade(look.skin, 0.18);
    ctx.lineWidth = R * 0.04;
    ctx.beginPath();
    ctx.moveTo(mx - mw * 0.35, my + R * 0.12 + smile * R * 0.05);
    ctx.lineTo(mx + mw * 0.35, my + R * 0.12 + smile * R * 0.05);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(235,105,110,0.15)";
  for (const s of [-1, 1]) {
    if (af > 0.6 && s !== fs) continue;
    ctx.beginPath();
    ctx.ellipse(fx + s * R * 0.56 * (1 - af * 0.4), R * 0.42, R * 0.16, R * 0.1, 0, 0, TAU);
    ctx.fill();
  }
  // Hair on top: a full shape with volume, a swept fringe and a highlight streak.
  const hx = -f * R * 0.12;
  ctx.fillStyle = look.hair;
  if (look.hairStyle === "curly") {
    for (let k = 0; k < 13; k++) {
      const a = Math.PI * (0.92 + (k / 12) * 1.16);
      const rr = R * (0.3 + 0.06 * Math.sin(k * 2.3));
      ctx.beginPath();
      ctx.arc(hx + Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98 - R * 0.1, rr, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(hx, -R * 0.62, R * 0.95, R * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = light(look.hair, 0.2);
    for (let k = 0; k < 5; k++) {
      const a = Math.PI * (1.15 + k * 0.17);
      ctx.beginPath();
      ctx.arc(hx + Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85 - R * 0.12, R * 0.06, 0, TAU);
      ctx.fill();
    }
  } else if (look.hairStyle === "buzz") {
    ctx.globalAlpha *= 0.8;
    ctx.beginPath();
    ctx.moveTo(-R * 1.0, -R * 0.15);
    ctx.bezierCurveTo(-R * 1.06, -R * 1.34, R * 1.06, -R * 1.34, R * 1.0, -R * 0.15);
    ctx.quadraticCurveTo(R * 0.6, -R * 0.55, hx, -R * 0.58);
    ctx.quadraticCurveTo(-R * 0.6, -R * 0.55, -R * 1.0, -R * 0.15);
    ctx.fill();
    ctx.globalAlpha /= 0.8;
  } else {
    const pulledBack = look.hairStyle === "bun" || look.hairStyle === "ponytail";
    const side = look.hairStyle === "long" || look.hairStyle === "bob" ? R * 0.55 : R * 0.08;
    ctx.beginPath();
    ctx.moveTo(-R * 1.07 + hx, side);
    ctx.bezierCurveTo(-R * 1.22 + hx, -R * 1.5, R * 1.22 + hx, -R * 1.5, R * 1.07 + hx, side);
    if (pulledBack) {
      ctx.quadraticCurveTo(R * 0.9, -R * 0.5, hx, -R * 0.62);
      ctx.quadraticCurveTo(-R * 0.9, -R * 0.5, -R * 1.07 + hx, side);
    } else {
      // A swept fringe: two soft scallops falling to one side.
      ctx.quadraticCurveTo(R * 0.98, -R * 0.42, R * 0.52 + hx, -R * 0.42);
      ctx.quadraticCurveTo(R * 0.22, -R * 0.3, -R * 0.05 + hx, -R * 0.4);
      ctx.quadraticCurveTo(-R * 0.45, -R * 0.2, -R * 0.82 + hx, -R * 0.28);
      ctx.quadraticCurveTo(-R * 1.0, -R * 0.1, -R * 1.07 + hx, side);
    }
    ctx.closePath();
    ctx.fill();
    // Highlight streak along the crown.
    ctx.strokeStyle = rgba(light(look.hair, 0.4), 0.55);
    ctx.lineWidth = R * 0.1;
    ctx.beginPath();
    ctx.arc(hx - R * 0.1, -R * 0.1, R * 0.92, Math.PI * 1.18, Math.PI * 1.42);
    ctx.stroke();
    ctx.lineWidth = R * 0.05;
    ctx.beginPath();
    ctx.arc(hx - R * 0.1, -R * 0.1, R * 0.92, Math.PI * 1.48, Math.PI * 1.56);
    ctx.stroke();
  }
  ctx.restore();

  if (far !== "L") out.handL = drawArm("L");
  if (far !== "R") out.handR = drawArm("R");
  ctx.restore();
  return out;
}

/* ───────────────────────── Motion ───────────────────────── */

/** Walk cycle at phase φ (radians), facing ±1: legs, arms and the bob. */
type Limb = [number, number];
export function walkPose(phase: number, facing: number): { legL: Limb; legR: Limb; armL: Limb; armR: Limb; lift: number; sway: number; lean: number } {
  const fs = facing >= 0 ? 1 : -1;
  const leg = (p: number): [number, number] => {
    const a = fs * 0.4 * Math.sin(p);
    const k = -fs * (0.08 + 0.85 * Math.pow(Math.max(0, Math.cos(p)), 1.5));
    return [a, k];
  };
  const arm = (p: number): [number, number] => [-fs * 0.32 * Math.sin(p), fs * (0.25 + 0.15 * Math.max(0, -Math.sin(p)))];
  return {
    legL: leg(phase),
    legR: leg(phase + Math.PI),
    armL: arm(phase + Math.PI),
    armR: arm(phase),
    lift: 0.012 * Math.abs(Math.cos(phase)),
    sway: 0.25 * Math.sin(phase * 2),
    lean: fs * 0.04,
  };
}

/** Standing idle: breathing, relaxed arms, a gentle sway. */
export function idlePose(t: number, seed = 0): { armL: Limb; armR: Limb; lift: number; lean: number; sway: number } {
  const br = Math.sin(t * 1.6 + seed) * 0.5 + 0.5;
  return {
    armL: [-0.1 - br * 0.02, -0.08],
    armR: [0.1 + br * 0.02, 0.08],
    lift: br * 0.003,
    lean: Math.sin(t * 0.7 + seed) * 0.012,
    sway: Math.sin(t * 1.3 + seed) * 0.1,
  };
}

/** Eyes dart to a new spot now and then (eased), like someone thinking or listening. */
export function saccade(t: number, seed = 0) {
  const k = Math.floor(t / 1.3 + seed);
  const f = ease.inOutCubic(clamp((t / 1.3 + seed - k) / 0.12));
  const a = noise1(k * 1.7, seed + 3);
  const b = noise1((k + 1) * 1.7, seed + 3);
  return lerp(a, b, f);
}

/** A talking mouth: syllable-like openings while `on` (0..1). */
export const talking = (t: number, on: number) => on * clamp(0.15 + 0.85 * Math.abs(Math.sin(t * 11.3) * Math.sin(t * 4.1 + 1)));

/** Shoulder angle that points an arm from `sh` at a target. */
export const aimAt = (sh: { x: number; y: number }, tx: number, ty: number) => Math.atan2(tx - sh.x, ty - sh.y);

/* ───────────────────────── Slides ───────────────────────── */

/** Proportions shared by the slides: the shoulder of a character standing at (x, ground), H tall. */
const shoulderAt = (x: number, ground: number, H: number, side: number) => ({ x: x + side * H * 0.11, y: ground - H * 0.74 });

function proWalk(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.4 });
  const ex = exitOf(sc);
  const portrait = h > w;
  const H = portrait ? h * 0.48 : h * 0.72;
  const ground = portrait ? h * 0.93 : h * 0.94;
  const xEnd = portrait ? w * 0.5 : w * 0.3;
  const tArrive = 1.5;
  const walkK = ease.outCubic(clamp(t / tArrive));
  const x = lerp(-H * 0.4, xEnd, walkK);
  const walking = t < tArrive;
  const phase = (x / (H * 0.34)) * Math.PI;
  const turn = ease.inOutCubic(range(t, tArrive - 0.1, tArrive + 0.35));
  const facing = lerp(1, 0, turn);
  const wk = walkPose(phase, 1);
  const idle = idlePose(t);
  const waveK = range(t, tArrive + 0.3, tArrive + 0.6) * (1 - range(t, tArrive + 1.6, tArrive + 1.9));
  const talk = range(t, tArrive + 1.3, tArrive + 1.6);
  const pose: ProPose = {
    facing,
    legL: walking ? wk.legL : [-0.05, 0],
    legR: walking ? wk.legR : [0.05, 0],
    // Presenting: the upper arm stays near the body, the forearm comes up and forward, palm open.
    armL: walking ? wk.armL : talk > 0 ? [lerp(idle.armL[0], -0.28, talk), lerp(idle.armL[1], -1.05, talk)] : idle.armL,
    // A natural wave: the upper arm out at shoulder height, the elbow bent so the forearm stands up
    // beside the head, rocking from the elbow (never bent back the wrong way).
    armR: walking ? wk.armR : [lerp(idle.armR[0], 1.75, ease.inOutCubic(waveK)), lerp(idle.armR[1], 1.2 + Math.sin(t * 9) * 0.28, ease.inOutCubic(waveK))],
    handL: "open",
    handR: waveK > 0.3 ? "open" : undefined,
    lift: walking ? wk.lift : idle.lift,
    lean: walking ? wk.lean : idle.lean,
    sway: walking ? wk.sway : idle.sway,
    mouth: talking(t, talk) + waveK * 0.25,
    smile: 0.6,
    blink: blinkAt(t, 0.4),
    lookX: walking ? 1 : saccade(t) * 0.6 + (portrait ? 0 : 0.4),
    lookY: -0.1,
    brows: 0.4 + waveK * 0.4,
    headTilt: walking ? 0 : Math.sin(t * 1.1) * 0.04,
  };
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  drawPro(ctx, x, ground, H, proLook(palette, 0), pose);
  // The headline beside the host (above in vertical frames).
  const k = ease.outCubic(range(t, tArrive + 0.2, tArrive + 0.8));
  if (k > 0) {
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.fillStyle = palette.text;
    const size = (portrait ? 72 : 88) * u;
    ctx.font = displayFont(saasFont(sc), size);
    ctx.textAlign = portrait ? "center" : "left";
    ctx.textBaseline = "middle";
    const tx = portrait ? w / 2 : w * 0.5;
    const ty = portrait ? h * 0.2 : h * 0.4;
    const lines = fillTextFit(ctx, plain(scene.text), tx, ty + (1 - k) * 30 * u, portrait ? w * 0.86 : w * 0.44, { maxLines: 3, lineHeight: 1.06, minScale: 0.55 });
    const barY = ty + (lines * size * 1.06) / 2 + 24 * u;
    ctx.fillStyle = palette.primary;
    ctx.fillRect(portrait ? tx - 60 * u * k : tx, barY, 120 * u * k, 6 * u);
    if (scene.subtext) {
      ctx.fillStyle = rgba(palette.text, 0.75);
      ctx.font = subFont((portrait ? 30 : 34) * u, 500);
      ctx.textBaseline = "top";
      fillTextFit(ctx, plain(scene.subtext), tx, barY + 30 * u, portrait ? w * 0.86 : w * 0.44, { maxLines: 2, lineHeight: 1.25 });
    }
    ctx.restore();
  }
  ctx.restore();
}

const PRO_POINTS = ["Plan — Goals everyone can see", "Collaborate — Work together in one place", "Track — Progress at a glance", "Launch — Ship with confidence"];

function proExplainer(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.35 });
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, PRO_POINTS, 4).map(split);
  const n = P.length;
  const T = pointTimes(scene, n, 0.9);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const cur = T.reduce((c, ti, i) => (t >= ti - 0.05 ? i : c), -1);
  const card = narrow ? { x: st.left, y: st.top, w: st.width, h: room * 0.52 } : { x: st.left + st.width * 0.38, y: st.top + room * 0.04, w: st.width * 0.62, h: room * 0.92 };
  const H = narrow ? room * 0.46 : room * 1.02;
  const cx = narrow ? st.left + st.width * 0.3 : st.left + st.width * 0.17;
  const ground = st.bottom;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // The floating card, with a soft lift.
  const kc = clamp(spring(t - 0.25, 10, 7), 0, 1.04);
  const float = Math.sin(t * 1.4) * 4 * u;
  ctx.save();
  ctx.globalAlpha *= clamp(kc);
  ctx.translate(0, float + (1 - kc) * 20 * u);
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 40 * u;
  ctx.shadowOffsetY = 16 * u;
  ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.07);
  ctx.beginPath();
  ctx.roundRect(card.x, card.y, card.w, card.h, 26 * u);
  ctx.fill();
  ctx.shadowColor = "transparent";
  const pad = 30 * u * S;
  const rowH = (card.h - pad * 2) / n;
  const rows = P.map((p, i) => {
    const y = card.y + pad + rowH * (i + 0.5);
    const k = ease.outCubic(range(t, T[i] - 0.1, T[i] + 0.35));
    if (k > 0) {
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.translate((1 - k) * 26 * u, 0);
      if (i === cur) {
        ctx.fillStyle = rgba(palette.primary, palette.light ? 0.08 : 0.15);
        ctx.beginPath();
        ctx.roundRect(card.x + pad * 0.5, y - rowH * 0.42, card.w - pad, rowH * 0.84, 16 * u);
        ctx.fill();
      }
      const ts = Math.min(rowH * 0.6, 60 * u * S);
      iconTile(sc, icons[i], card.x + pad + ts / 2, y, ts);
      ctx.globalAlpha *= i === cur ? 1 : 0.7;
      ctx.fillStyle = palette.text;
      ctx.font = subFont(Math.min(rowH * 0.3, 34 * u * S), 700);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      fillTextFit(ctx, p.title, card.x + pad * 1.6 + ts, p.detail ? y - rowH * 0.12 : y, card.w - ts - pad * 2.6, { maxLines: 1, minScale: 0.6 });
      if (p.detail) {
        ctx.fillStyle = rgba(palette.text, 0.65);
        ctx.font = subFont(Math.min(rowH * 0.2, 23 * u * S), 500);
        fillTextFit(ctx, p.detail, card.x + pad * 1.6 + ts, y + rowH * 0.18, card.w - ts - pad * 2.6, { maxLines: 1, minScale: 0.7 });
      }
      ctx.restore();
    }
    return { x: card.x + pad * 0.6, y: y + float };
  });
  ctx.restore();
  // The presenter: turns slightly towards the card, points at the newest point, talks and nods.
  const sh = shoulderAt(cx, ground, H, 1);
  const target = cur >= 0 ? rows[cur] : { x: card.x, y: card.y + card.h * 0.3 };
  const pointK = cur >= 0 ? ease.outCubic(range(t, T[cur] - 0.3, T[cur])) * (1 - range(t, T[cur] + 0.9, T[cur] + 1.2) * 0.6) : 0;
  const aim = aimAt(sh, target.x, target.y);
  const idle = idlePose(t, 1);
  const nod = cur >= 0 ? Math.sin(clamp((t - T[cur]) / 0.4) * Math.PI) * 0.08 : 0;
  const enter = clamp(spring(t - 0.05, 9, 8), 0, 1.03);
  drawPro(ctx, cx - (1 - enter) * w * 0.2, ground, H, proLook(palette, 2), {
    facing: 0.28,
    armL: [lerp(idle.armL[0], -0.45, 0.5), lerp(idle.armL[1], -1.0, 0.5)],
    handL: "open",
    armR: [lerp(idle.armR[0], aim, pointK), lerp(idle.armR[1], 0, pointK)],
    handR: pointK > 0.5 ? "point" : "open",
    lift: idle.lift,
    lean: idle.lean,
    sway: idle.sway,
    mouth: talking(t, cur >= 0 ? 1 - range(t, T[n - 1] + 1.2, T[n - 1] + 1.5) : 0),
    smile: 0.5,
    blink: blinkAt(t, 1.3),
    lookX: pointK > 0.3 ? 1 : saccade(t, 2) * 0.5,
    lookY: -0.1,
    brows: 0.3 + nod * 3,
    headTilt: nod,
  });
  ctx.restore();
}

const DIALOG = ["How do you keep the team in sync?", "One shared board for everything", "And the updates?", "They come to you, in one place"];

function proDuo(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.35 });
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, DIALOG, 4, 2).map((x) => plain(split(x).title + (split(x).detail ? ` — ${split(x).detail}` : "")));
  const n = P.length;
  const T = pointTimes(scene, n, 0.8);
  const room = st.bottom - st.top;
  const cur = T.reduce((c, ti, i) => (t >= ti - 0.05 ? i : c), -1);
  const H = Math.min(room * 0.82, st.width * (narrow ? 0.62 : 0.42));
  const ground = st.bottom;
  const xs = [st.left + st.width * (narrow ? 0.25 : 0.3), st.left + st.width * (narrow ? 0.75 : 0.7)];
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const rigs: ProRig[] = [];
  [0, 1].forEach((i) => {
    const speaking = cur >= 0 && cur % 2 === i;
    const listening = cur >= 0 && !speaking;
    const enter = clamp(spring(t - 0.1 - i * 0.12, 9, 8), 0, 1.03);
    const idle = idlePose(t, i * 2);
    const nod = listening ? Math.sin(clamp((t - T[cur] - 0.3) / 0.5) * Math.PI * 2) * 0.05 : 0;
    const gest = speaking ? 0.5 + 0.5 * Math.sin(t * 2.4 + i) : 0;
    const s = i === 0 ? 1 : -1;
    rigs.push(
      drawPro(ctx, xs[i] + (1 - enter) * -s * w * 0.3, ground, H, proLook(palette, i === 0 ? 3 : 1), {
        facing: s * 0.6,
        armL: i === 1 ? [lerp(idle.armL[0], -0.6, gest), lerp(idle.armL[1], -0.9, gest)] : idle.armL,
        armR: i === 0 ? [lerp(idle.armR[0], 0.6, gest), lerp(idle.armR[1], 0.9, gest)] : idle.armR,
        handL: "open",
        handR: "open",
        lift: idle.lift,
        lean: idle.lean + s * 0.02,
        sway: idle.sway,
        mouth: talking(t + i, speaking ? 1 : 0),
        smile: listening ? 0.6 : 0.4,
        blink: blinkAt(t, i * 1.9),
        lookX: s * 0.9,
        brows: listening ? 0.5 : 0.25,
        headTilt: nod + (listening ? s * 0.04 : 0),
      }),
    );
  });
  // The current line, in a bubble above its speaker.
  if (cur >= 0) {
    const r = rigs[cur % 2];
    const k = pop(t, T[cur], T[cur + 1] !== undefined ? T[cur + 1] - 0.15 : Infinity);
    const size = 32 * u * S;
    const tip = { x: r.head.x, y: r.top - 8 * u };
    const area = { x: st.left, y: st.top, w: st.width, h: Math.max(size * 2, tip.y - 30 * u - st.top) };
    const box = fitBubble(sc, P[cur], tip, size, { area, maxW: st.width * (narrow ? 0.9 : 0.5), display: false });
    speech(sc, P[cur], box, tip, size, k, false);
  }
  ctx.restore();
}

const PROBLEMS = ["Too many tools", "Lost in email threads", "No idea what's next"];

function proThinker(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.4 });
  const ex = exitOf(sc);
  const portrait = h > w;
  const P = itemsOr(scene, PROBLEMS, 3, 1).map((x) => plain(split(x).title));
  const n = P.length;
  const tIdea = clamp(d * 0.55, 2, 3.6);
  const T = P.map((_, i) => 0.6 + (i * (tIdea - 1)) / Math.max(1, n));
  const H = portrait ? h * 0.46 : h * 0.72;
  const ground = portrait ? h * 0.93 : h * 0.94;
  const cx = portrait ? w * 0.5 : w * 0.26;
  const idea = ease.outCubic(range(t, tIdea, tIdea + 0.35));
  const idle = idlePose(t, 3);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Thinking: a hand to the chin, eyes up; the idea: a finger up, a hop and a grin.
  const hop = idea > 0 ? Math.max(0, Math.sin(clamp((t - tIdea) / 0.45) * Math.PI)) * 0.04 : 0;
  const rig = drawPro(ctx, cx, ground, H, proLook(palette, 5), {
    facing: lerp(0.15, 0, idea),
    // (Thinking: one arm across the body under the other elbow, that hand at the chin.)
    armL: [lerp(-0.2, idle.armL[0], idea), lerp(1.45, idle.armL[1], idea)],
    handL: "fist",
    armR: [2.9, -0.15],
    reachR: "chin",
    reachK: 1 - idea,
    handR: idea > 0.5 ? "point" : "fist",
    lift: idle.lift + hop,
    lean: idle.lean,
    sway: idle.sway,
    mouth: idea > 0.5 ? 0.45 : 0,
    smile: lerp(-0.3, 0.9, idea),
    blink: blinkAt(t, 2.2),
    lookX: idea > 0.5 ? 0 : 0.6 + saccade(t, 5) * 0.3,
    lookY: idea > 0.5 ? 0 : -0.9,
    brows: lerp(-0.6, 0.9, idea),
    headTilt: lerp(0.08, 0, idea),
  });
  // Thought bubbles: the problems, crossed out one by one.
  const cw = portrait ? w * 0.8 : w * 0.42;
  const rowH = (portrait ? 64 : 72) * u;
  const bx = portrait ? w / 2 - cw / 2 : w * 0.5;
  const by0 = portrait ? h * 0.1 : h * 0.18;
  P.forEach((p, i) => {
    const k = pop(t, T[i], tIdea);
    if (k <= 0) return;
    const y = by0 + i * (rowH + 18 * u);
    const box = { x: bx, y, w: cw, h: rowH };
    ctx.save();
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
    ctx.scale(k, k);
    ctx.translate(-(box.x + box.w / 2), -(box.y + box.h / 2));
    ctx.fillStyle = palette.light ? "#ffffff" : "#f3f5fb";
    ctx.shadowColor = "rgba(0,0,0,0.16)";
    ctx.shadowBlur = 20 * u;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, rowH / 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#151826";
    ctx.font = subFont(rowH * 0.38, 650);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, p, box.x + box.w / 2, box.y + box.h / 2, box.w - 60 * u, { maxLines: 1, minScale: 0.6 });
    // Struck out once it's been thought through.
    const strike = ease.inOutCubic(range(t, T[i] + 0.55, T[i] + 0.85));
    if (strike > 0) {
      ctx.strokeStyle = "#e5484d";
      ctx.lineWidth = 5 * u;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(box.x + 30 * u, box.y + box.h / 2);
      ctx.lineTo(box.x + 30 * u + (box.w - 60 * u) * strike, box.y + box.h / 2);
      ctx.stroke();
    }
    ctx.restore();
  });
  // Little thought dots rising from the head while thinking.
  const dk = 1 - idea;
  if (dk > 0.01 && !portrait) {
    ctx.fillStyle = rgba(palette.text, 0.35 * dk);
    for (let k = 0; k < 3; k++) {
      const f = (k + 1) / 4;
      ctx.beginPath();
      ctx.arc(lerp(rig.head.x + rig.head.r, bx, f), lerp(rig.top, by0 + rowH, f) - Math.sin(t * 3 + k) * 4 * u, (5 + k * 3) * u, 0, TAU);
      ctx.fill();
    }
  }
  // The idea: the headline, with a soft sparkle by the raised finger.
  if (idea > 0) {
    const hx = rig.handR.x;
    const hy = rig.handR.y - H * 0.05;
    const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, H * 0.12);
    g.addColorStop(0, rgba("#ffe27a", 0.6 * idea));
    g.addColorStop(1, rgba("#ffe27a", 0));
    ctx.fillStyle = g;
    ctx.fillRect(hx - H * 0.12, hy - H * 0.12, H * 0.24, H * 0.24);
    ctx.save();
    ctx.globalAlpha *= idea;
    ctx.fillStyle = palette.text;
    const size = (portrait ? 70 : 84) * u;
    ctx.font = displayFont(saasFont(sc), size);
    ctx.textAlign = portrait ? "center" : "left";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, plain(scene.text), portrait ? w / 2 : w * 0.5, (portrait ? h * 0.22 : h * 0.42) + (1 - idea) * 24 * u, portrait ? w * 0.86 : w * 0.44, { maxLines: 3, lineHeight: 1.06, minScale: 0.55 });
    ctx.restore();
  }
  ctx.restore();
}

function proUnveil(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, brand } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.5 });
  const ex = exitOf(sc);
  const portrait = h > w;
  // Smaller than the other hosts: the sign goes up above the head and has to stay in frame.
  const H = portrait ? h * 0.42 : h * 0.54;
  const ground = portrait ? h * 0.95 : h * 0.96;
  const xEnd = w * 0.5;
  const tArrive = 1.3;
  const walkK = ease.outCubic(clamp(t / tArrive));
  const x = lerp(-H * 0.6, xEnd, walkK);
  const walking = t < tArrive;
  const turn = ease.inOutCubic(range(t, tArrive - 0.1, tArrive + 0.3));
  const wk = walkPose((x / (H * 0.34)) * Math.PI, 1);
  const present = ease.inOutCubic(range(t, tArrive + 0.9, tArrive + 1.3));
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Holding the sign up in both hands, then one hand presents it.
  const rig = drawPro(ctx, x, ground, H, proLook(palette, 4), {
    facing: lerp(1, 0, turn),
    legL: walking ? wk.legL : [-0.05, 0],
    legR: walking ? wk.legR : [0.05, 0],
    armL: [lerp(-2.75, -2.9, turn), -0.1],
    armR: [lerp(2.75, 2.9, turn), 0.1],
    handL: "fist",
    handR: "fist",
    lift: walking ? wk.lift : 0,
    lean: walking ? wk.lean * 0.5 : 0,
    sway: walking ? wk.sway : Math.sin(t * 1.4) * 0.1,
    mouth: talking(t, range(t, tArrive + 1.3, tArrive + 1.5)),
    smile: 0.8,
    blink: blinkAt(t, 3.1),
    lookX: walking ? 1 : present > 0.5 ? 0 : -0.3,
    brows: 0.6,
  });
  // The sign, held above the head, facing the camera once the character turns.
  const sw = (portrait ? w * 0.7 : w * 0.3) * lerp(0.55, 1, turn);
  const shh = sw * 0.5;
  // Held by its bottom edge, above the head (a little lift when it's presented).
  const sx = (rig.handL.x + rig.handR.x) / 2 - sw / 2;
  const sy = Math.min(rig.handL.y, rig.handR.y, rig.top) - shh - H * 0.01;
  const signY = sy - present * H * 0.03 + Math.sin(t * 2.2) * H * 0.004;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 24 * u;
  ctx.shadowOffsetY = 10 * u;
  const g = ctx.createLinearGradient(sx, signY, sx + sw, signY + shh);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(sx, signY, sw, shh, 18 * u);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#ffffff";
  ctx.font = displayFont(saasFont(sc), shh * 0.34);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fillTextFit(ctx, plain(scene.text) || brand?.name || "Hello", sx + sw / 2, signY + shh / 2, sw - 40 * u, { maxLines: 2, lineHeight: 1.05, minScale: 0.45 });
  ctx.restore();
  if (scene.subtext) {
    const a = range(t, tArrive + 1.1, tArrive + 1.5);
    ctx.globalAlpha = (1 - ex) * a;
    ctx.fillStyle = rgba(palette.text, 0.8);
    ctx.font = subFont((portrait ? 30 : 34) * u, 500);
    ctx.textAlign = portrait ? "center" : "left";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, plain(scene.subtext), portrait ? w / 2 : x + H * 0.32, portrait ? h * 0.06 + 20 * u : ground - H * 0.45, portrait ? w * 0.86 : w * 0.3, { maxLines: 2, lineHeight: 1.25 });
  }
  ctx.restore();
}

function proHighFive(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.5 });
  const ex = exitOf(sc);
  const portrait = h > w;
  const H = portrait ? h * 0.38 : h * 0.58;
  const ground = portrait ? h * 0.94 : h * 0.95;
  const tMeet = 1.25;
  const gap = H * 0.36;
  const label = plain(scene.text) || "Get started";
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const five = range(t, tMeet - 0.15, tMeet + 0.1);
  const after = ease.inOutCubic(range(t, tMeet + 0.6, tMeet + 1.0));
  [0, 1].forEach((i) => {
    const s = i === 0 ? 1 : -1;
    const walkK = ease.outCubic(clamp(t / tMeet));
    const x = lerp(i === 0 ? -H * 0.5 : w + H * 0.5, w / 2 - s * gap, walkK);
    const walking = t < tMeet - 0.1;
    const wk = walkPose(((i === 0 ? x : w - x) / (H * 0.34)) * Math.PI, s);
    const up = ease.outBack(range(t, tMeet - 0.45, tMeet - 0.05)) * (1 - after);
    const hop = Math.max(0, Math.sin(range(t, tMeet, tMeet + 0.45) * Math.PI)) * 0.05;
    const inner = i === 0 ? "R" : "L";
    const raise: [number, number] = [s * 2.55, s * -0.25];
    const cheer = after;
    const base = idlePose(t, i);
    drawPro(ctx, x, ground, H, proLook(palette, i === 0 ? 0 : 2), {
      facing: lerp(s * 0.9, s * 0.25, after),
      legL: walking ? wk.legL : [-0.05, 0],
      legR: walking ? wk.legR : [0.05, 0],
      armL: inner === "L" ? [lerp(walking ? wk.armL[0] : base.armL[0], raise[0], up), lerp(walking ? wk.armL[1] : base.armL[1], raise[1], up)] : cheer > 0 ? [lerp(base.armL[0], -2.5, cheer), lerp(base.armL[1], -0.25, cheer)] : walking ? wk.armL : base.armL,
      armR: inner === "R" ? [lerp(walking ? wk.armR[0] : base.armR[0], raise[0], up), lerp(walking ? wk.armR[1] : base.armR[1], raise[1], up)] : cheer > 0 ? [lerp(base.armR[0], 2.5, cheer), lerp(base.armR[1], 0.25, cheer)] : walking ? wk.armR : base.armR,
      handL: "open",
      handR: "open",
      lift: (walking ? wk.lift : 0) + hop,
      lean: walking ? wk.lean : 0,
      sway: walking ? wk.sway : base.sway,
      mouth: five > 0 ? 0.5 * (1 - after) + talking(t, after) * 0.6 : 0,
      smile: 0.9,
      blink: blinkAt(t, i * 2.7),
      lookX: s * (1 - after),
      brows: 0.7,
    });
  });
  // The high five: a little burst of sparks where the hands meet.
  const bk = range(t, tMeet - 0.05, tMeet + 0.5);
  if (bk > 0 && bk < 1) {
    const cx = w / 2;
    const cy = ground - H * 1.02;
    ctx.strokeStyle = rgba("#ffd166", 1 - bk);
    ctx.lineWidth = 4 * u;
    ctx.lineCap = "round";
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      const r0 = H * 0.05 + bk * H * 0.1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * (r0 + H * 0.05), cy + Math.sin(a) * (r0 + H * 0.05));
      ctx.stroke();
    }
  }
  // Then the call to action above them.
  const kb = ease.outBack(clamp((t - tMeet - 0.5) / 0.45));
  if (kb > 0) {
    const size = (portrait ? 54 : 62) * u;
    ctx.font = displayFont(saasFont(sc), size);
    const bw = Math.min(portrait ? w * 0.84 : w * 0.5, ctx.measureText(label).width + 120 * u);
    const bh = size * 2;
    const by = portrait ? h * 0.16 : h * 0.16;
    ctx.save();
    ctx.translate(w / 2, by + bh / 2);
    ctx.scale(kb, kb);
    ctx.translate(-w / 2, -(by + bh / 2));
    const g = ctx.createLinearGradient(w / 2 - bw / 2, by, w / 2 + bw / 2, by + bh);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    ctx.shadowColor = rgba(palette.primary, 0.45);
    ctx.shadowBlur = 36 * u;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(w / 2 - bw / 2, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, label, w / 2, by + bh / 2, bw - 60 * u, { maxLines: 1, minScale: 0.5 });
    ctx.restore();
    if (scene.subtext) {
      ctx.globalAlpha = (1 - ex) * clamp(kb);
      ctx.fillStyle = rgba(palette.text, 0.8);
      ctx.font = subFont((portrait ? 30 : 32) * u, 500);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      fillTextFit(ctx, plain(scene.subtext), w / 2, by + bh + 26 * u, portrait ? w * 0.84 : w * 0.5, { maxLines: 2, lineHeight: 1.25 });
    }
  }
  ctx.restore();
}

/* ───────────────────────── Registry ───────────────────────── */

export const charProSkills: Skill[] = [
  {
    id: "pro-walk",
    name: "Walk-in Host",
    tagline: "A host walks in with a real walk cycle, turns to camera, waves and introduces your headline.",
    bestFor: "A warm, human opener for explainers and brand intros. A short headline (3–8 words) and an optional line under it.",
    sample: { text: "Meet your new *team hub*", subtext: "Here's how it works" },
    render: proWalk,
    sfx: () => [at(0.2, "whoosh"), at(1.9, "pop")],
  },
  {
    id: "pro-explainer",
    name: "Explainer",
    tagline: "A presenter beside a floating card points at each point as it appears, talking and nodding.",
    bestFor: "Explaining 3–4 features or steps like a narrated explainer ('Point — short detail').",
    sample: { text: "Here's how it *works*", items: PRO_POINTS },
    itemsHint: "3–4 points: 'Point — short detail'",
    render: proExplainer,
    sfx: (scene: Scene) => pointTimes(scene, itemsOr(scene, PRO_POINTS, 4).length, 0.9).map((ti) => at(ti, "pop")),
  },
  {
    id: "pro-duo",
    name: "Conversation",
    tagline: "Two characters talk: your lines as an alternating conversation in speech bubbles, the listener nodding along.",
    bestFor: "A question-and-answer, a customer and a helper, or a before/after chat: 2–4 short lines that alternate.",
    sample: { text: "Sound *familiar*?", items: DIALOG },
    itemsHint: "2–4 lines, alternating speakers",
    render: proDuo,
    sfx: (scene: Scene) => pointTimes(scene, itemsOr(scene, DIALOG, 4, 2).length, 0.8).map((ti) => at(ti, "pop")),
  },
  {
    id: "pro-thinker",
    name: "Problem Solver",
    tagline: "A character ponders, hand on chin, as the problems appear and get crossed out, then has the idea: your headline.",
    bestFor: "Problem → solution: 1–3 short problems as the list, the answer as the headline.",
    sample: { text: "There's a *simpler way*", items: PROBLEMS },
    itemsHint: "1–3 short problems",
    render: proThinker,
    sfx: (scene: Scene) => {
      const tIdea = clamp(scene.duration * 0.55, 2, 3.6);
      return [at(0.6, "pop"), at(tIdea, "shimmer"), at(tIdea + 0.15, "success")];
    },
  },
  {
    id: "pro-unveil",
    name: "Hold-up Sign",
    tagline: "A character walks in holding up a sign with your headline, turns to camera and presents it.",
    bestFor: "Announcing a name, an offer or a launch: a short headline (1–5 words) on the sign, an optional line beside it.",
    sample: { text: "We're *live*!", subtext: "Come and take a look" },
    render: proUnveil,
    sfx: () => [at(0.2, "whoosh"), at(1.6, "pop")],
  },
  {
    id: "pro-highfive",
    name: "High Five",
    tagline: "Two characters walk in, high-five in the middle, then cheer as your call-to-action button pops up.",
    bestFor: "A joyful, human end card: the action as the headline, an optional line under it.",
    sample: { text: "Start *together*", subtext: "Bring your whole team" },
    render: proHighFive,
    sfx: () => [at(0.2, "whoosh"), at(1.22, "pop"), at(1.8, "success")],
  },
];
