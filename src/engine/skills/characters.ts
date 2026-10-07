/**
 * Character slides: friendly flat cartoon people who present the video's message. One posable
 * character (drawCharacter: head, hair, face, torso, arms and legs, all from simple shapes) is
 * staged six ways:
 *
 * - char-hello:     a mascot pops up, waves and says the headline in a speech bubble.
 * - char-presenter: a presenter beside a board points at each point as it ticks in.
 * - char-team:      a small team pops up in a row; each in turn waves and says one point.
 * - char-aha:       a worried character thinks about the problem, a light bulb comes on, and it
 *                   jumps for joy as the answer (the headline) appears.
 * - char-desk:      a character at a laptop types while updates (the points) pop up beside it,
 *                   then cheers.
 * - char-cheer:     two characters jump and cheer either side of the call to action, under
 *                   gently falling confetti.
 *
 * Characters take the palette's colours for their clothes and a varied, fixed set of skin tones
 * and hair, so a team looks like a team. Everything is a pure function of time (preview, seek and
 * export match), and nothing flashes.
 */
import { clamp, ease, hashString, lerp, mixHex, range, rgba, rng, TAU } from "../math";
import { iconsFor, saasBackground, saasFont, spring } from "../saasfx";
import { displayFont, fillTextFit, subFont } from "../text";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { exitOf, itemsOr, split, stage } from "./beats";
import { iconTile } from "./interactions";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const plain = (s: string) => s.replace(/\*/g, "").trim();

/* ───────────────────────── The character ───────────────────────── */

export type Toon = "flat" | "comic" | "soft" | "doodle";
/** How characters, bubbles and boards are drawn this frame (from the style's look; set per render). */
let TOON: Toon = "flat";
/** Hand-drawn "boil": the doodle ink shifts a little 8 times a second, like redrawn frames. */
let BOIL = 0;
const INK = "#1a1624";
/** Storybook ink: a warm brown, drawn as a sketchy double line. */
const SEPIA = "#4a3426";
export function useToon(sc: SkillContext) {
  TOON = sc.look?.toon ?? "flat";
  BOIL = Math.floor((sc.globalT ?? sc.t) * 8);
}
/** Ink outline for the current path (comic and doodle), after its fill. */
function ink(ctx: CanvasRenderingContext2D, width: number) {
  if (TOON !== "comic" && TOON !== "doodle") return;
  ctx.save();
  ctx.lineJoin = "round";
  if (TOON === "doodle") {
    // Two light pen passes that don't quite line up, shifting each "drawing" (boil).
    ctx.strokeStyle = SEPIA;
    ctx.lineWidth = width * 0.45;
    ctx.globalAlpha *= 0.85;
    ctx.translate(Math.sin(BOIL * 7.13) * width * 0.4, Math.cos(BOIL * 5.31) * width * 0.4);
    ctx.stroke();
    ctx.translate(Math.cos(BOIL * 3.7) * width * 0.6, Math.sin(BOIL * 4.1) * width * 0.6);
    ctx.globalAlpha *= 0.6;
    ctx.stroke();
  } else {
    ctx.strokeStyle = INK;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.restore();
}

export interface CharLook {
  skin: string;
  hair: string;
  /** 0 short, 1 long, 2 bun, 3 curly. */
  hairStyle: number;
  top: string;
  bottom: string;
  shoe: string;
}

export interface Pose {
  /** Upper-arm angles from hanging straight down (radians); positive swings the arm out and up. */
  armL: number;
  armR: number;
  /** Elbow bend: the forearm turns this much further (radians). */
  foreL?: number;
  foreR?: number;
  /** Leg swing (radians), positive outwards. */
  legL?: number;
  legR?: number;
  /** Whole-body tilt (radians). */
  lean?: number;
  mouth?: "smile" | "grin" | "open" | "frown" | "o";
  /** 0 open … 1 closed. */
  blink?: number;
  /** Eyes left (−1) to right (1). */
  look?: number;
  /** Brows: −1 worried … 1 raised and happy. */
  brows?: number;
  /** Draw the legs (false when sitting behind a desk). */
  legs?: boolean;
}

/** A fixed, varied cast: skin tones and hair. */
const CAST: Omit<CharLook, "top" | "bottom" | "shoe">[] = [
  { skin: "#f1c4a0", hair: "#2b1b14", hairStyle: 0 },
  { skin: "#8d5b3e", hair: "#17100c", hairStyle: 3 },
  { skin: "#e2a983", hair: "#6b3a1e", hairStyle: 1 },
  { skin: "#c98b62", hair: "#141414", hairStyle: 2 },
  { skin: "#f6d6bd", hair: "#c88a3a", hairStyle: 1 },
  { skin: "#a86f4c", hair: "#2a1a12", hairStyle: 0 },
];

/** Character `i` of the cast, dressed in the palette's colours. */
export function castLook(p: Palette, i: number): CharLook {
  const c = CAST[((i % CAST.length) + CAST.length) % CAST.length];
  // The first wears the brand's colour; the rest a friendly set, softened towards the palette so
  // a team looks varied but still belongs to the video.
  const friends = ["#ff8a5c", "#2ec4b6", "#ffbe0b", "#9b5de5", "#ef476f"];
  const tops = [p.primary, ...friends.map((c) => mixHex(c, p.primary, 0.15))];
  // Storybook colours are softened towards the paper, like watercolour; on a dark stage the
  // trousers and shoes are lighter so they don't vanish into the night.
  const soft = (col: string) => (TOON === "doodle" ? mixHex(col, "#f3e6cf", 0.22) : col);
  return {
    ...c,
    skin: soft(c.skin),
    top: soft(tops[i % tops.length]),
    bottom: soft(p.light ? "#3a3f57" : "#56608c"),
    shoe: p.light ? "#1f2233" : "#363d60",
  };
}

/** Blink now and then (a quick close every few seconds, offset per character). */
export const blinkAt = (t: number, seed = 0) => {
  const f = (t + seed * 0.73) % 3.1;
  return f > 2.95 ? Math.sin(((f - 2.95) / 0.15) * Math.PI) : 0;
};

/**
 * Draw a character standing with its feet at (x, footY), `H` tall. Returns where its head and
 * hands are, for speech bubbles, thought clouds and props.
 */
export function drawCharacter(ctx: CanvasRenderingContext2D, x: number, footY: number, H: number, look: CharLook, pose: Pose) {
  const headR = H * 0.165;
  const legLen = H * 0.3;
  const torsoH = H * 0.3;
  const torsoW = H * 0.27;
  const hipY = footY - legLen;
  const shY = hipY - torsoH;
  const headY = shY - headR * 0.82;
  const out = { head: { x, y: headY, r: headR }, handL: { x, y: 0 }, handR: { x, y: 0 }, top: headY - headR };
  const ow = H * 0.014;
  const outlined = TOON === "comic" || TOON === "doodle";
  /** A limb: an ink stroke under the coloured one (comic, doodle), a soft highlight on top (clay). */
  const limb = (pts: [number, number][], width: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]);
    if (outlined) {
      ctx.save();
      if (TOON === "doodle") {
        // A sketchy pen line either side of the limb.
        ctx.translate(Math.sin(BOIL * 3.7) * ow * 0.3, Math.cos(BOIL * 4.9) * ow * 0.3);
        ctx.strokeStyle = SEPIA;
        ctx.globalAlpha *= 0.85;
        ctx.lineWidth = width + ow * 0.9;
        ctx.stroke();
      } else {
        ctx.strokeStyle = INK;
        ctx.lineWidth = width + ow * 2;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    if (TOON === "soft") {
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = width * 0.32;
      ctx.stroke();
    }
  };
  /** Cel shade (comic): the right-hand part of the current path darkened with a hard edge. */
  const cel = (x0: number, alpha = 0.16) => {
    if (TOON !== "comic") return;
    ctx.save();
    ctx.clip();
    ctx.fillStyle = `rgba(20,10,40,${alpha})`;
    ctx.fillRect(x0, -1e4, 2e4, 2e4);
    ctx.restore();
  };
  ctx.save();
  // Ground shadow (not tilted with the body).
  ctx.fillStyle = TOON === "comic" ? "rgba(20,10,40,0.28)" : "rgba(0,0,0,0.16)";
  if (TOON === "soft") {
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = H * 0.04;
  }
  ctx.beginPath();
  ctx.ellipse(x, footY + H * 0.01, H * 0.17, H * 0.028, 0, 0, TAU);
  if (pose.legs !== false) ctx.fill();
  ctx.shadowBlur = 0;
  ctx.translate(x, footY);
  ctx.rotate(pose.lean ?? 0);
  ctx.translate(-x, -footY);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Legs and shoes.
  if (pose.legs !== false) {
    for (const s of [-1, 1]) {
      const a = (s < 0 ? pose.legL : pose.legR) ?? 0;
      const hx = x + s * torsoW * 0.22;
      const fx = hx + s * Math.sin(a) * legLen;
      const fy = hipY + Math.cos(a) * legLen;
      limb([[hx, hipY], [fx, fy - H * 0.02]], H * 0.085, look.bottom);
      ctx.fillStyle = look.shoe;
      ctx.beginPath();
      ctx.ellipse(fx + s * H * 0.018, fy - H * 0.012, H * 0.058, H * 0.03, 0, 0, TAU);
      ctx.fill();
      ink(ctx, ow);
    }
  }
  // Torso: a rounded body in the top's colour, lit from the upper left.
  let tg: CanvasGradient;
  if (TOON === "soft") {
    tg = ctx.createRadialGradient(x - torsoW * 0.2, shY + torsoH * 0.2, torsoW * 0.05, x, shY + torsoH * 0.5, torsoW * 0.9);
    tg.addColorStop(0, mixHex(look.top, "#ffffff", 0.35));
    tg.addColorStop(1, mixHex(look.top, "#000000", 0.18));
  } else {
    tg = ctx.createLinearGradient(x - torsoW / 2, shY, x + torsoW / 2, hipY);
    tg.addColorStop(0, mixHex(look.top, "#ffffff", TOON === "flat" ? 0.16 : 0));
    tg.addColorStop(1, mixHex(look.top, "#000000", TOON === "flat" ? 0.12 : 0));
  }
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.roundRect(x - torsoW / 2, shY - H * 0.01, torsoW, torsoH + H * 0.03, [torsoW * 0.42, torsoW * 0.42, torsoW * 0.2, torsoW * 0.2]);
  ctx.fill();
  cel(x + torsoW * 0.18);
  ink(ctx, ow);
  // Neck.
  ctx.fillStyle = mixHex(look.skin, "#000000", 0.08);
  ctx.beginPath();
  ctx.roundRect(x - headR * 0.24, shY - headR * 0.3, headR * 0.48, headR * 0.42, headR * 0.12);
  ctx.fill();
  // Arms (sleeve in the top's colour, then the hand).
  for (const s of [-1, 1]) {
    const a = s < 0 ? pose.armL : pose.armR;
    const bend = (s < 0 ? pose.foreL : pose.foreR) ?? 0;
    const sx = x + s * torsoW * 0.44;
    const sy = shY + H * 0.035;
    const up = H * 0.15;
    const fo = H * 0.14;
    const ex = sx + s * Math.sin(a) * up;
    const ey = sy + Math.cos(a) * up;
    const a2 = a + bend;
    const hx = ex + s * Math.sin(a2) * fo;
    const hy = ey + Math.cos(a2) * fo;
    limb([[sx, sy], [ex, ey], [hx, hy]], H * 0.068, mixHex(look.top, "#000000", 0.06));
    ctx.fillStyle = look.skin;
    ctx.beginPath();
    ctx.arc(hx, hy, H * 0.038, 0, TAU);
    ctx.fill();
    ink(ctx, ow * 0.8);
    if (s < 0) out.handL = { x: hx, y: hy };
    else out.handR = { x: hx, y: hy };
  }
  // Head.
  const hairBack = look.hairStyle === 1;
  if (hairBack) {
    // Long hair falls behind the shoulders.
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.roundRect(x - headR * 1.05, headY - headR * 0.3, headR * 2.1, headR * 1.75, [headR * 0.5, headR * 0.5, headR * 0.35, headR * 0.35]);
    ctx.fill();
    ink(ctx, ow);
  }
  ctx.fillStyle = look.skin;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * headR * 0.98, headY + headR * 0.08, headR * 0.2, 0, TAU);
    ctx.fill();
    ink(ctx, ow * 0.8);
  }
  const hg = ctx.createRadialGradient(x - headR * 0.35, headY - headR * 0.4, headR * 0.1, x, headY, headR * 1.05);
  hg.addColorStop(0, mixHex(look.skin, "#ffffff", TOON === "soft" ? 0.28 : TOON === "flat" ? 0.12 : 0));
  hg.addColorStop(1, TOON === "soft" ? mixHex(look.skin, "#000000", 0.12) : look.skin);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(x, headY, headR, 0, TAU);
  ctx.fill();
  cel(x + headR * 0.42, 0.12);
  ink(ctx, ow);
  if (TOON === "soft") {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.ellipse(x - headR * 0.4, headY - headR * 0.45, headR * 0.28, headR * 0.16, -0.5, 0, TAU);
    ctx.fill();
  }
  // Hair on top.
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.arc(x, headY, headR * 1.04, Math.PI * 1.02, Math.PI * 1.98);
  ctx.quadraticCurveTo(x + headR * 0.4, headY - headR * 0.35, x - headR * 0.2, headY - headR * 0.42);
  ctx.quadraticCurveTo(x - headR * 0.7, headY - headR * 0.4, x - headR * 1.03, headY - headR * 0.02);
  ctx.closePath();
  ctx.fill();
  ink(ctx, ow);
  if (look.hairStyle === 2) {
    ctx.beginPath();
    ctx.arc(x + headR * 0.1, headY - headR * 1.12, headR * 0.38, 0, TAU);
    ctx.fill();
    ink(ctx, ow);
  } else if (look.hairStyle === 3) {
    for (let k = 0; k < 7; k++) {
      const a = Math.PI * (1.05 + (k / 6) * 0.9);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * headR * 0.98, headY + Math.sin(a) * headR * 0.98, headR * 0.3, 0, TAU);
      ctx.fill();
    }
  }
  // Face.
  const lk = (pose.look ?? 0) * headR * 0.12;
  const blink = clamp(pose.blink ?? 0);
  const eyeY = headY + headR * 0.08;
  for (const s of [-1, 1]) {
    const ex = x + s * headR * 0.36 + lk;
    ctx.fillStyle = "#1c1a26";
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, headR * 0.1, headR * 0.13 * (1 - blink * 0.9), 0, 0, TAU);
    ctx.fill();
    if (blink < 0.5) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(ex + headR * 0.035, eyeY - headR * 0.045, headR * 0.035, 0, TAU);
      ctx.fill();
    }
    // Brows.
    const b = pose.brows ?? 0;
    ctx.strokeStyle = mixHex(look.hair, "#000000", 0.2);
    ctx.lineWidth = headR * 0.07;
    ctx.beginPath();
    const by = eyeY - headR * (0.27 + 0.05 * Math.max(0, b));
    ctx.moveTo(ex - headR * 0.13, by + s * b * -0.0 + (b < 0 ? -s * headR * 0.06 : 0));
    ctx.lineTo(ex + headR * 0.13, by + (b < 0 ? s * headR * 0.06 : 0));
    ctx.stroke();
    // Cheeks.
    ctx.fillStyle = "rgba(255,120,120,0.28)";
    ctx.beginPath();
    ctx.ellipse(x + s * headR * 0.58, headY + headR * 0.36, headR * 0.15, headR * 0.09, 0, 0, TAU);
    ctx.fill();
  }
  const my = headY + headR * 0.45;
  const mw = headR * 0.3;
  ctx.strokeStyle = "#3a1d1d";
  ctx.fillStyle = "#4a1f24";
  ctx.lineWidth = headR * 0.075;
  ctx.beginPath();
  switch (pose.mouth ?? "smile") {
    case "grin":
      ctx.moveTo(x - mw, my - headR * 0.04);
      ctx.quadraticCurveTo(x, my + headR * 0.42, x + mw, my - headR * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff8a8a";
      ctx.beginPath();
      ctx.ellipse(x, my + headR * 0.13, mw * 0.45, headR * 0.06, 0, 0, TAU);
      ctx.fill();
      break;
    case "open":
      ctx.ellipse(x, my + headR * 0.04, mw * 0.55, headR * 0.15, 0, 0, TAU);
      ctx.fill();
      break;
    case "o":
      ctx.arc(x, my + headR * 0.05, headR * 0.08, 0, TAU);
      ctx.fill();
      break;
    case "frown":
      ctx.moveTo(x - mw * 0.8, my + headR * 0.1);
      ctx.quadraticCurveTo(x, my - headR * 0.08, x + mw * 0.8, my + headR * 0.1);
      ctx.stroke();
      break;
    default:
      ctx.moveTo(x - mw, my - headR * 0.02);
      ctx.quadraticCurveTo(x, my + headR * 0.24, x + mw, my - headR * 0.02);
      ctx.stroke();
  }
  ctx.restore();
  return out;
}

/* ───────────────────────── Shared props ───────────────────────── */

/** A speech bubble (rounded box with a tail pointing at `tip`), drawn grown from the tail by `k`. */
export function bubble(sc: SkillContext, box: { x: number; y: number; w: number; h: number }, tip: { x: number; y: number }, k: number) {
  const { ctx, u, palette } = sc;
  if (k <= 0.001) return;
  const fill = palette.light ? "#ffffff" : "#f7f8fc";
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.scale(k, k);
  ctx.translate(-tip.x, -tip.y);
  const outlined = TOON === "comic" || TOON === "doodle";
  if (TOON === "comic") {
    // Comic: a hard offset shadow instead of a soft one.
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(box.x + 8 * u, box.y + 8 * u, box.w, box.h, Math.min(20 * u, box.h / 2));
    ctx.fill();
  } else if (!outlined) {
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = (TOON === "soft" ? 40 : 24) * u;
    ctx.shadowOffsetY = (TOON === "soft" ? 14 : 8) * u;
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, Math.min((TOON === "comic" ? 20 : 28) * u, box.h / 2));
  ctx.fill();
  ink(ctx, 4 * u);
  // Tail: from the box's nearest edge towards the tip.
  const cx = clamp(tip.x, box.x + box.h * 0.4, box.x + box.w - box.h * 0.4);
  const below = tip.y > box.y + box.h;
  const ey = below ? box.y + box.h - 2 * u : box.y + 2 * u;
  const tw = Math.min(26 * u, box.w * 0.12);
  ctx.beginPath();
  ctx.moveTo(cx - tw, ey);
  ctx.quadraticCurveTo(lerp(cx, tip.x, 0.5), lerp(ey, tip.y, 0.4), tip.x, tip.y);
  ctx.quadraticCurveTo(lerp(cx, tip.x, 0.3), lerp(ey, tip.y, 0.6), cx + tw, ey);
  if (outlined) {
    // The tail's two sides in ink (not its base, which joins the box).
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - tw, ey);
    ctx.quadraticCurveTo(lerp(cx, tip.x, 0.5), lerp(ey, tip.y, 0.4), tip.x, tip.y);
    ctx.quadraticCurveTo(lerp(cx, tip.x, 0.3), lerp(ey, tip.y, 0.6), cx + tw, ey);
    ink(ctx, 4 * u);
    // Cover the box's outline where the tail meets it.
    ctx.fillStyle = fill;
    ctx.fillRect(cx - tw + 3 * u, below ? ey - 6 * u : ey, tw * 2 - 6 * u, 6 * u);
    ctx.restore();
  } else {
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Text inside a bubble: dark on white, fitted to its box. */
export function bubbleText(sc: SkillContext, text: string, box: { x: number; y: number; w: number; h: number }, size: number, k: number, display = true) {
  const { ctx, u } = sc;
  if (k <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.4 - 0.3);
  ctx.fillStyle = "#151826";
  ctx.font = display ? displayFont(saasFont(sc), size) : subFont(size, 700);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fillTextFit(ctx, text, box.x + box.w / 2, box.y + box.h / 2, box.w - 40 * u, { maxLines: 3, lineHeight: 1.12, minScale: 0.5 });
  ctx.restore();
}

/** Ease a speech bubble in (overshoot) and out. */
export const pop = (t: number, t0: number, t1 = Infinity) => (t < t0 ? 0 : ease.outBack(clamp((t - t0) / 0.35))) * (1 - ease.inCubic(clamp((t - t1) / 0.25)));

/** A soft wave: the arm up and the forearm rocking. */
const wave = (t: number, k: number) => ({ arm: lerp(0.2, 2.55, k), fore: k * (0.35 + 0.35 * Math.sin(t * 10)) });

/* ───────────────────────── Hello ───────────────────────── */

function charHello(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.5 });
  const ex = exitOf(sc);
  const portrait = h > w;
  const H = portrait ? h * 0.42 : h * 0.66;
  const cx = portrait ? w * 0.5 : w * 0.3;
  const floor = portrait ? h * 0.9 : h * 0.92;
  const rise = clamp(spring(t - 0.1, 9, 7), 0, 1.06);
  const bob = Math.sin(t * 2.6) * H * 0.008;
  const footY = floor + (1 - rise) * H * 1.1 + bob;
  const wk = range(t, 0.55, 0.9) * (1 - range(t, 2.6, 3.0));
  const wv = wave(t, ease.inOutCubic(wk));
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const ch = drawCharacter(ctx, cx, footY, H, castLook(palette, 0), {
    armL: 0.25,
    armR: wv.arm,
    foreR: wv.fore,
    mouth: wk > 0.2 ? "grin" : "smile",
    blink: blinkAt(t),
    look: portrait ? 0 : 0.6,
    brows: 0.6,
    lean: Math.sin(t * 1.4) * 0.015,
  });
  // The headline in a speech bubble, beside the head (above it in vertical frames).
  const text = plain(scene.text) || "Hello!";
  const bw = portrait ? w * 0.84 : w * 0.46;
  const bh = portrait ? h * 0.2 : h * 0.34;
  const box = portrait ? { x: (w - bw) / 2, y: h * 0.12, w: bw, h: bh } : { x: w * 0.47, y: h * 0.16, w: bw, h: bh };
  const tip = portrait ? { x: cx + ch.head.r * 0.2, y: ch.top - ch.head.r * 0.35 } : { x: cx + ch.head.r * 1.25, y: ch.head.y - ch.head.r * 0.2 };
  const k = pop(t, 0.75);
  bubble(sc, box, tip, k);
  bubbleText(sc, text, box, (portrait ? 64 : 72) * u, k);
  if (scene.subtext) {
    const a = range(t, 1.2, 1.6);
    ctx.globalAlpha = (1 - ex) * a;
    ctx.fillStyle = rgba(palette.text, 0.8);
    ctx.font = subFont((portrait ? 30 : 32) * u, 500);
    ctx.textAlign = portrait ? "center" : "left";
    ctx.textBaseline = "top";
    fillTextFit(ctx, plain(scene.subtext), portrait ? w / 2 : box.x + 8 * u, box.y + box.h + 28 * u + (1 - a) * 10 * u, bw - 16 * u, { maxLines: 2, lineHeight: 1.25 });
  }
  ctx.restore();
}

/* ───────────────────────── Presenter ───────────────────────── */

const POINTS = ["Plan — Set goals in minutes", "Share — Keep everyone in the loop", "Track — See progress at a glance", "Celebrate — Ship and say thanks"];

export function pointTimes(scene: Scene, n: number, start = 0.8) {
  const slot = clamp((scene.duration - start - 1) / Math.max(1, n), 0.6, 1.6);
  return Array.from({ length: n }, (_, i) => start + i * slot);
}

function charPresenter(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.35 });
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, POINTS, 4).map(split);
  const n = P.length;
  const T = pointTimes(scene, n);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const room = st.bottom - st.top;
  const cur = T.reduce((c, ti, i) => (t >= ti - 0.05 ? i : c), -1);
  // The board: right of the presenter (beside in widescreen, above in vertical frames).
  const board = narrow
    ? { x: st.left, y: st.top, w: st.width, h: room * 0.56 }
    : { x: st.left + st.width * 0.36, y: st.top, w: st.width * 0.64, h: room };
  const H = narrow ? room * 0.42 : room * 0.95;
  const cx = narrow ? st.left + st.width * 0.28 : st.left + st.width * 0.15;
  const footY = st.bottom;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const kb = clamp(spring(t - 0.2, 10, 7), 0, 1.04);
  ctx.save();
  ctx.globalAlpha *= clamp(kb);
  ctx.translate(board.x + board.w / 2, board.y + board.h / 2);
  ctx.scale(0.94 + 0.06 * kb, 0.94 + 0.06 * kb);
  ctx.translate(-(board.x + board.w / 2), -(board.y + board.h / 2));
  ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.06);
  ctx.strokeStyle = rgba(palette.primary, 0.35);
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.roundRect(board.x, board.y, board.w, board.h, 24 * u);
  ctx.fill();
  if (TOON === "comic" || TOON === "doodle") ink(ctx, 4 * u);
  else ctx.stroke();
  const pad = 28 * u * S;
  const rowH = (board.h - pad * 2) / n;
  const rows = P.map((p, i) => {
    const y = board.y + pad + rowH * i + rowH / 2;
    const k = ease.outCubic(range(t, T[i] - 0.1, T[i] + 0.35));
    if (k > 0) {
      const lit = i === cur ? 1 : 0.6;
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.translate((1 - k) * 30 * u, 0);
      if (i === cur) {
        ctx.fillStyle = rgba(palette.primary, palette.light ? 0.08 : 0.14);
        ctx.beginPath();
        ctx.roundRect(board.x + pad * 0.5, y - rowH * 0.42, board.w - pad, rowH * 0.84, 14 * u);
        ctx.fill();
      }
      const ts = Math.min(rowH * 0.6, 58 * u * S);
      iconTile(sc, icons[i], board.x + pad + ts / 2, y, ts);
      ctx.globalAlpha *= 0.55 + 0.45 * lit;
      ctx.fillStyle = palette.text;
      ctx.font = subFont(Math.min(rowH * 0.3, 34 * u * S), 700);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      fillTextFit(ctx, p.title, board.x + pad * 1.6 + ts, p.detail ? y - rowH * 0.12 : y, board.w - ts - pad * 2.6, { maxLines: 1, minScale: 0.6 });
      if (p.detail) {
        ctx.fillStyle = rgba(palette.text, 0.65);
        ctx.font = subFont(Math.min(rowH * 0.2, 22 * u * S), 500);
        fillTextFit(ctx, p.detail, board.x + pad * 1.6 + ts, y + rowH * 0.18, board.w - ts - pad * 2.6, { maxLines: 1, minScale: 0.7 });
      }
      ctx.restore();
    }
    return { x: board.x + pad, y };
  });
  ctx.restore();
  // The presenter steps in and points at the current row.
  const enter = clamp(spring(t - 0.05, 9, 8), 0, 1.03);
  const px = cx - (1 - enter) * w * 0.25;
  const target = cur >= 0 ? rows[cur] : { x: board.x, y: board.y + board.h * 0.3 };
  const shX = px + H * 0.27 * 0.44;
  const shY = footY - H * 0.6 + H * 0.035;
  const aim = Math.atan2(target.x - shX, target.y - shY);
  const pointK = cur >= 0 ? ease.outCubic(range(t, T[cur] - 0.35, T[cur])) : 0;
  const prevAim = cur > 0 ? Math.atan2(rows[cur - 1].x - shX, rows[cur - 1].y - shY) : 0.35;
  const armR = lerp(cur > 0 ? prevAim : 0.35, aim, pointK);
  drawCharacter(ctx, px, footY + Math.abs(Math.sin(t * 2.4)) * -H * 0.006, H, castLook(palette, 2), {
    armL: 0.18,
    foreL: 0.5,
    armR: clamp(armR, 0.1, 2.9),
    foreR: -0.05,
    mouth: cur >= 0 && (t - T[cur]) % 1 < 0.45 ? "open" : "smile",
    blink: blinkAt(t, 1),
    look: 0.8,
    brows: 0.3,
    legL: enter < 1 ? Math.sin(t * 14) * 0.18 * (1 - enter) : 0.04,
    legR: enter < 1 ? -Math.sin(t * 14) * 0.18 * (1 - enter) : 0.04,
  });
  ctx.restore();
}

/* ───────────────────────── Team ───────────────────────── */

const TEAM = ["Friendly support", "Simple setup", "Works on any device", "Made for teams"];

function charTeam(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.35 });
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, TEAM, narrow ? 3 : 4, 2).map((x) => split(x).title);
  const n = P.length;
  const T = pointTimes(scene, n, 1.0);
  const room = st.bottom - st.top;
  const cur = T.reduce((c, ti, i) => (t >= ti - 0.05 ? i : c), -1);
  const H = Math.min(room * 0.62, (st.width / n) * 1.6);
  const footY = st.bottom;
  const gapX = st.width / n;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const heads: { x: number; y: number; r: number; top: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x = st.left + gapX * (i + 0.5);
    const k = clamp(spring(t - 0.15 - i * 0.12, 10, 7), 0, 1.06);
    if (k <= 0) continue;
    const talking = i === cur;
    const wk = talking ? range(t, T[i] - 0.1, T[i] + 0.25) * (1 - range(t, (T[i + 1] ?? Infinity) - 0.3, T[i + 1] ?? Infinity)) : 0;
    const wv = wave(t + i, ease.inOutCubic(wk));
    const hop = talking ? Math.max(0, Math.sin(clamp((t - T[i]) / 0.35) * Math.PI)) * H * 0.05 : 0;
    const side = i < n / 2 ? -1 : 1;
    ctx.save();
    ctx.globalAlpha *= clamp(k * 1.5);
    const c = drawCharacter(ctx, x, footY + (1 - Math.min(1, k)) * H * 0.3 - hop, H * (0.92 + 0.08 * Math.min(1, k)), castLook(palette, i + 1), {
      armL: side > 0 ? wv.arm : 0.22,
      foreL: side > 0 ? wv.fore : 0.15,
      armR: side < 0 ? wv.arm : 0.22,
      foreR: side < 0 ? wv.fore : 0.15,
      mouth: talking ? "grin" : "smile",
      blink: blinkAt(t, i * 1.7),
      look: cur >= 0 && !talking ? Math.sign(gapX * (cur - i)) * 0.8 : 0,
      brows: talking ? 0.7 : 0.2,
    });
    ctx.restore();
    heads.push({ ...c.head, top: c.top });
  }
  // The one speaking says its point.
  if (cur >= 0 && heads[cur]) {
    const hd = heads[cur];
    const k = pop(t, T[cur], T[cur + 1] !== undefined ? T[cur + 1] - 0.2 : Infinity);
    const size = 34 * u * S;
    ctx.font = displayFont(saasFont(sc), size);
    const bw = Math.min(st.width * (narrow ? 0.9 : 0.5), Math.max(220 * u, ctx.measureText(P[cur]).width + 64 * u));
    const bh = size * 2.4;
    const bx = clamp(hd.x - bw / 2, st.left, st.left + st.width - bw);
    const by = Math.max(st.top, hd.top - bh - 44 * u);
    const box = { x: bx, y: by, w: bw, h: bh };
    bubble(sc, box, { x: hd.x + hd.r * 0.3, y: hd.top - 6 * u }, k);
    bubbleText(sc, P[cur], box, size, k);
  }
  ctx.restore();
}

/* ───────────────────────── Aha ───────────────────────── */

function charAha(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.4 });
  const ex = exitOf(sc);
  const portrait = h > w;
  const problem = plain(scene.items?.[0] ?? scene.subtext ?? "") || "Too many tools, too little time";
  const answer = plain(scene.text) || "There's a better way";
  const tAha = clamp(d * 0.42, 1.4, 2.6);
  const aha = range(t, tAha, tAha + 0.4);
  const H = portrait ? h * 0.4 : h * 0.62;
  const cx = portrait ? w * 0.5 : w * 0.27;
  const floor = portrait ? h * 0.9 : h * 0.92;
  // After the idea: a happy jump (twice), arms up.
  const jt = t - tAha - 0.15;
  const jump = jt > 0 && jt < 1.1 ? Math.abs(Math.sin((jt / 0.55) * Math.PI)) * H * 0.09 * (1 - jt / 1.4) : 0;
  const joy = ease.outCubic(range(t, tAha, tAha + 0.35));
  const enter = clamp(spring(t - 0.05, 9, 8), 0, 1.04);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const ch = drawCharacter(ctx, cx, floor + (1 - enter) * H - jump, H, castLook(palette, 3), {
    armL: lerp(0.5, 2.5, joy),
    foreL: lerp(1.6, 0.3, joy),
    armR: lerp(0.15, 2.5, joy),
    foreR: lerp(0.1, 0.3, joy),
    mouth: joy > 0.3 ? "grin" : t > 0.6 ? "frown" : "o",
    blink: blinkAt(t, 2),
    look: joy > 0.3 ? 0 : -0.5,
    brows: lerp(-1, 0.8, joy),
    legL: jump > 0 ? 0.12 : 0.03,
    legR: jump > 0 ? 0.12 : 0.03,
  });
  // The thought cloud with the problem, before the idea.
  const cloudK = pop(t, 0.5, tAha - 0.05);
  if (cloudK > 0) {
    const cw = portrait ? w * 0.78 : w * 0.4;
    const chh = portrait ? h * 0.15 : h * 0.24;
    const ccx = portrait ? w / 2 : cx + w * 0.3;
    const ccy = portrait ? ch.top - chh * 0.9 : ch.head.y - h * 0.18;
    ctx.save();
    ctx.translate(ccx, ccy);
    ctx.scale(cloudK, cloudK);
    ctx.translate(-ccx, -ccy);
    ctx.fillStyle = palette.light ? "#ffffff" : "#f2f4fa";
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 20 * u;
    const puffs = 9;
    ctx.beginPath();
    ctx.roundRect(ccx - cw / 2, ccy - chh / 2, cw, chh, chh / 2);
    for (let k = 0; k < puffs; k++) {
      const a = (k / puffs) * TAU;
      const r = chh * (0.32 + 0.06 * Math.sin(k * 2.1));
      ctx.moveTo(ccx + Math.cos(a) * cw * 0.45 + r, ccy + Math.sin(a) * chh * 0.48);
      ctx.arc(ccx + Math.cos(a) * cw * 0.45, ccy + Math.sin(a) * chh * 0.48, r, 0, TAU);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    // Thought dots down to the head.
    for (let k = 0; k < 3; k++) {
      const f = (k + 1) / 4;
      ctx.beginPath();
      ctx.arc(lerp(ccx - (portrait ? 0 : cw * 0.3), ch.head.x + ch.head.r * 0.6, f), lerp(ccy + chh * 0.6, ch.top, f), chh * (0.1 - k * 0.025), 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    bubbleText(sc, problem, { x: ccx - cw / 2, y: ccy - chh / 2, w: cw, h: chh }, (portrait ? 34 : 36) * u, 1, false);
    ctx.restore();
    // Question marks bob around the head.
    for (let k = 0; k < 2; k++) {
      ctx.save();
      ctx.globalAlpha *= cloudK * 0.8;
      ctx.fillStyle = palette.primary;
      ctx.font = displayFont(saasFont(sc), ch.head.r * 0.8);
      ctx.textAlign = "center";
      ctx.fillText("?", ch.head.x + (k ? 1 : -1) * ch.head.r * 1.5, ch.head.y - ch.head.r * (0.6 + 0.15 * Math.sin(t * 4 + k * 2)));
      ctx.restore();
    }
  }
  // The light bulb: pops above the head and glows softly.
  const bk = pop(t, tAha, tAha + 1.5);
  if (bk > 0) {
    const bx = ch.head.x;
    // Above the hair (a bun sits on top of the head).
    const by = ch.top - ch.head.r * 1.75;
    const br = ch.head.r * 0.55 * bk;
    ctx.save();
    const glow = ctx.createRadialGradient(bx, by, 0, bx, by, br * 3.2);
    glow.addColorStop(0, "rgba(255,226,120,0.55)");
    glow.addColorStop(1, "rgba(255,226,120,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(bx - br * 3.2, by - br * 3.2, br * 6.4, br * 6.4);
    ctx.strokeStyle = "rgba(255,214,90,0.9)";
    ctx.lineWidth = 3 * u;
    ctx.lineCap = "round";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + 0.2;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a) * br * 1.4, by + Math.sin(a) * br * 1.4);
      ctx.lineTo(bx + Math.cos(a) * br * 1.9, by + Math.sin(a) * br * 1.9);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffe27a";
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#9aa0b4";
    ctx.beginPath();
    ctx.roundRect(bx - br * 0.45, by + br * 0.8, br * 0.9, br * 0.55, br * 0.12);
    ctx.fill();
    ctx.restore();
  }
  // The answer: the headline, after the idea.
  const ak = ease.outCubic(range(t, tAha + 0.2, tAha + 0.7));
  if (ak > 0) {
    ctx.save();
    ctx.globalAlpha *= ak;
    ctx.fillStyle = palette.text;
    const size = (portrait ? 64 : 76) * u;
    ctx.font = displayFont(saasFont(sc), size);
    ctx.textAlign = portrait ? "center" : "left";
    ctx.textBaseline = "middle";
    const tx = portrait ? w / 2 : w * 0.5;
    const ty = portrait ? h * 0.2 : h * 0.42;
    const lines = fillTextFit(ctx, answer, tx, ty + (1 - ak) * 24 * u, portrait ? w * 0.84 : w * 0.42, { maxLines: 3, lineHeight: 1.08, minScale: 0.55 });
    // An accent bar under it.
    ctx.fillStyle = palette.primary;
    const barW = 120 * u * ak;
    const barY = ty + (lines * size * 1.08) / 2 + 22 * u;
    ctx.fillRect(portrait ? tx - barW / 2 : tx, barY, barW, 6 * u);
    ctx.restore();
  }
  ctx.restore();
}

/* ───────────────────────── Desk ───────────────────────── */

const UPDATES = ["Project created", "Teammates invited", "First task done", "Report ready"];

function charDesk(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene, brand } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.35 });
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, UPDATES, 4).map((x) => split(x).title);
  const n = P.length;
  const T = pointTimes(scene, n, 0.9);
  const icons = iconsFor(P, sc);
  const room = st.bottom - st.top;
  const done = t > T[n - 1] + 0.6;
  // Desk and character on the left (bottom in vertical frames); the updates stack beside them.
  const H = narrow ? room * 0.5 : room * 0.95;
  const cx = narrow ? w / 2 : st.left + st.width * 0.24;
  const deskY = st.bottom - H * 0.28;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const typing = !done && t > 0.5;
  const cheer = ease.outCubic(range(t, T[n - 1] + 0.6, T[n - 1] + 1.0));
  drawCharacter(ctx, cx, deskY + H * 0.3, H, castLook(palette, 4), {
    armL: lerp(0.55 + (typing ? Math.sin(t * 22) * 0.06 : 0), 2.6, cheer),
    foreL: lerp(-0.9, 0.2, cheer),
    armR: lerp(0.55 + (typing ? Math.sin(t * 22 + 1.7) * 0.06 : 0), 2.6, cheer),
    foreR: lerp(-0.9, 0.2, cheer),
    mouth: cheer > 0.3 ? "grin" : "smile",
    blink: blinkAt(t, 3),
    look: cheer > 0.3 ? 0 : 0,
    brows: lerp(0.1, 0.8, cheer),
    legs: false,
  });
  // Desk top and front.
  const dw = H * 1.25;
  ctx.fillStyle = mixHex(palette.bg1, palette.light ? "#000000" : "#ffffff", 0.12);
  ctx.beginPath();
  ctx.roundRect(cx - dw / 2, deskY, dw, H * 0.05, 8 * u);
  ctx.fill();
  ink(ctx, 4 * u);
  ctx.fillStyle = mixHex(palette.bg1, palette.light ? "#000000" : "#ffffff", 0.06);
  ctx.beginPath();
  ctx.roundRect(cx - dw * 0.46, deskY + H * 0.05, dw * 0.92, H * 0.24, [0, 0, 10 * u, 10 * u]);
  ctx.fill();
  // The laptop's lid (its back to us), with the brand's initial on it.
  const lw = H * 0.42;
  const lh = H * 0.27;
  const lg = ctx.createLinearGradient(cx - lw / 2, deskY - lh, cx + lw / 2, deskY);
  lg.addColorStop(0, "#d9dde8");
  lg.addColorStop(1, "#aeb4c4");
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.roundRect(cx - lw / 2, deskY - lh, lw, lh, 10 * u);
  ctx.fill();
  ink(ctx, 4 * u);
  ctx.fillStyle = palette.primary;
  ctx.font = displayFont(saasFont(sc), lh * 0.42);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((brand?.name?.trim()[0] ?? "★").toUpperCase(), cx, deskY - lh / 2);
  // The updates pop up one by one.
  const cardW = narrow ? st.width : st.width * 0.48;
  const cardH = Math.min(78 * u * S, (narrow ? room * 0.42 : room) / (n + 0.6));
  const gx = narrow ? st.left : st.left + st.width * 0.52;
  const gy0 = narrow ? st.top : st.top + (room - (cardH + 14 * u) * n) / 2;
  P.forEach((p, i) => {
    const k = clamp(spring(t - T[i], 12, 7), 0, 1.05);
    if (k <= 0) return;
    const y = gy0 + i * (cardH + 14 * u);
    ctx.save();
    ctx.globalAlpha *= clamp(k);
    ctx.translate(gx + cardW / 2, y + cardH / 2);
    ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
    ctx.translate(-(gx + cardW / 2), -(y + cardH / 2));
    ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.07);
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 18 * u;
    ctx.beginPath();
    ctx.roundRect(gx, y, cardW, cardH, 16 * u);
    ctx.fill();
    ctx.shadowBlur = 0;
    ink(ctx, 3 * u);
    const ts = cardH * 0.56;
    iconTile(sc, icons[i], gx + 18 * u + ts / 2, y + cardH / 2, ts);
    ctx.fillStyle = palette.text;
    ctx.font = subFont(Math.min(cardH * 0.3, 28 * u * S), 650);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, p, gx + 34 * u + ts, y + cardH / 2, cardW - ts - 90 * u, { maxLines: 1, minScale: 0.6 });
    // A check on the right.
    const ck = ease.outCubic(range(t, T[i] + 0.2, T[i] + 0.45));
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 4 * u;
    ctx.lineCap = "round";
    const kx = gx + cardW - 34 * u;
    const ky = y + cardH / 2;
    ctx.beginPath();
    ctx.moveTo(kx - 10 * u, ky);
    ctx.lineTo(kx - 10 * u + 7 * u * Math.min(1, ck * 2), ky + 7 * u * Math.min(1, ck * 2));
    if (ck > 0.5) ctx.lineTo(kx - 3 * u + 13 * u * (ck - 0.5) * 2, ky + 7 * u - 14 * u * (ck - 0.5) * 2);
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();
}

/* ───────────────────────── Cheer ───────────────────────── */

function charCheer(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, seed } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.5 });
  const portrait = h > w;
  const label = plain(scene.text) || "Get started";
  // Confetti: gentle, falling, in the palette's colours (no flashing).
  const r = rng(hashString(`confetti${seed}`));
  const cols = [palette.primary, palette.secondary, palette.accent, "#ffd166", "#ffffff"];
  const conf = ease.outCubic(range(t, 0.5, 1.2));
  for (let k = 0; k < 70; k++) {
    const x0 = r() * w;
    const sp = 0.08 + r() * 0.12;
    const ph = r();
    const y = (((ph + (t - 0.5) * sp) % 1) + 1) % 1;
    const sway = Math.sin(t * (1 + r() * 2) + k) * 14 * u;
    const sz = (6 + r() * 8) * u;
    const rot = t * (1 + r() * 3) + k;
    ctx.save();
    ctx.globalAlpha = conf * 0.85;
    ctx.translate(x0 + sway, y * h * 1.1 - h * 0.05);
    ctx.rotate(rot);
    ctx.fillStyle = cols[k % cols.length];
    ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2);
    ctx.restore();
  }
  const ex = exitOf(sc);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // The call to action: a big button with the headline, the subtext under it.
  const size = (portrait ? 56 : 64) * u;
  ctx.font = displayFont(saasFont(sc), size);
  const bw = Math.min(portrait ? w * 0.84 : w * 0.5, ctx.measureText(label).width + 120 * u);
  const bh = size * 2;
  const bx = w / 2 - bw / 2;
  const by = portrait ? h * 0.28 : h * 0.34;
  const kb = ease.outBack(clamp((t - 0.2) / 0.45));
  ctx.save();
  ctx.translate(w / 2, by + bh / 2);
  ctx.scale(kb, kb);
  ctx.translate(-w / 2, -(by + bh / 2));
  const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.shadowColor = rgba(palette.primary, 0.5);
  ctx.shadowBlur = 40 * u;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ink(ctx, 5 * u);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fillTextFit(ctx, label, w / 2, by + bh / 2, bw - 60 * u, { maxLines: 1, minScale: 0.5 });
  ctx.restore();
  if (scene.subtext) {
    const a = range(t, 0.7, 1.1);
    ctx.globalAlpha = (1 - ex) * a;
    ctx.fillStyle = rgba(palette.text, 0.8);
    ctx.font = subFont((portrait ? 30 : 32) * u, 500);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    fillTextFit(ctx, plain(scene.subtext), w / 2, by + bh + 30 * u, portrait ? w * 0.84 : w * 0.5, { maxLines: 2, lineHeight: 1.25 });
    ctx.globalAlpha = 1 - ex;
  }
  // Two characters cheer either side, jumping in turn.
  const H = portrait ? h * 0.3 : h * 0.5;
  const floor = portrait ? h * 0.92 : h * 0.94;
  [0, 1].forEach((i) => {
    const x = portrait ? w * (i ? 0.74 : 0.26) : w * (i ? 0.84 : 0.16);
    const enter = clamp(spring(t - 0.3 - i * 0.15, 9, 7), 0, 1.05);
    const ph = t * 3.2 + i * Math.PI;
    const jump = Math.max(0, Math.sin(ph)) * H * 0.07 * clamp(t - 0.8);
    const up = 0.5 + 0.5 * Math.sin(ph);
    drawCharacter(ctx, x, floor + (1 - enter) * H * 1.1 - jump, H, castLook(palette, i ? 5 : 1), {
      armL: 2.3 + up * 0.35,
      foreL: 0.25,
      armR: 2.3 + up * 0.35,
      foreR: 0.25,
      mouth: "grin",
      blink: blinkAt(t, i * 2.3),
      look: i ? -0.6 : 0.6,
      brows: 0.9,
      legL: jump > 0 ? 0.15 : 0.04,
      legR: jump > 0 ? 0.15 : 0.04,
      lean: (i ? -1 : 1) * 0.04,
    });
  });
  ctx.restore();
}

/* ───────────────────────── Registry ───────────────────────── */

const helloSfx = (): SfxCue[] => [at(0.15, "whoosh"), at(0.75, "pop")];
const listSfx = (start: number) => (scene: Scene) => pointTimes(scene, itemsOr(scene, POINTS, 4).length, start).map((ti) => at(ti, "pop"));

export const characterSkills: Skill[] = [
  {
    id: "char-hello",
    name: "Hello Mascot",
    tagline: "A friendly cartoon character pops up, waves and says your headline in a speech bubble.",
    bestFor: "A warm, playful opener or hello: kids, education, community, consumer apps and friendly brands. A short line (2–6 words).",
    sample: { text: "Hi, meet *Pebble*!", subtext: "Your friendly study buddy" },
    render: charHello,
    sfx: helloSfx,
  },
  {
    id: "char-presenter",
    name: "Presenter",
    tagline: "A cartoon presenter beside a board points at each point as it ticks in.",
    bestFor: "Explaining 3–4 features or benefits in a friendly, human way ('Point — short detail').",
    sample: { text: "Here's how it *works*", items: POINTS },
    itemsHint: "3–4 points: 'Point — short detail'",
    render: charPresenter,
    sfx: listSfx(0.8),
  },
  {
    id: "char-team",
    name: "Team Hello",
    tagline: "A small cartoon team pops up in a row; each in turn waves and says one point in a speech bubble.",
    bestFor: "Team, community, support or 'why people like it' beats: 2–4 short points (2–4 words each).",
    sample: { text: "Made for *people*", items: TEAM },
    itemsHint: "2–4 short points",
    render: charTeam,
    sfx: (scene: Scene) => pointTimes(scene, itemsOr(scene, TEAM, 4, 2).length, 1.0).map((ti) => at(ti, "pop")),
  },
  {
    id: "char-aha",
    name: "Aha Moment",
    tagline: "A worried character thinks about the problem, a light bulb comes on, and it jumps for joy as your answer appears.",
    bestFor: "Problem → solution with a smile: the problem as the first list item (or subtext), the answer as the headline.",
    sample: { text: "Meet your new *study plan*", items: ["Too much to revise, too little time"] },
    itemsHint: "The problem, in one line",
    render: charAha,
    sfx: (scene: Scene) => {
      const tAha = clamp(scene.duration * 0.42, 1.4, 2.6);
      return [at(0.5, "pop"), at(tAha, "shimmer"), at(tAha + 0.2, "success")];
    },
  },
  {
    id: "char-desk",
    name: "At the Desk",
    tagline: "A cartoon character types at a laptop while updates pop up beside it, then cheers when they're done.",
    bestFor: "Showing work getting done or a simple workflow: 3–4 short updates ('Report ready').",
    sample: { text: "Your day, *sorted*", items: UPDATES },
    itemsHint: "3–4 short updates",
    render: charDesk,
    sfx: (scene: Scene) => [...pointTimes(scene, itemsOr(scene, UPDATES, 4).length, 0.9).map((ti) => at(ti, "pop")), at(scene.duration - 1.2, "success")],
  },
  {
    id: "char-cheer",
    name: "Cheer CTA",
    tagline: "Two cartoon characters jump and cheer either side of your call-to-action button, under gently falling confetti.",
    bestFor: "A joyful end card: the action as the headline ('Join the club'), an optional line under it.",
    sample: { text: "Join the *club*", subtext: "Come and say hello" },
    render: charCheer,
    sfx: () => [at(0.2, "pop"), at(0.5, "success")],
  },
];
