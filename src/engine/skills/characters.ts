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
import { displayFont, fillTextFit, fitTextLines, subFont } from "../text";
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
    if (TOON !== "comic" && TOON !== "flat") return;
    ctx.save();
    ctx.clip();
    ctx.fillStyle = `rgba(36,18,63,${TOON === "flat" ? alpha * 0.85 : alpha})`;
    if (TOON === "flat") {
      // An illustrator's shadow shape: a soft curve down the side away from the light.
      ctx.beginPath();
      ctx.moveTo(x0, -1e4);
      ctx.bezierCurveTo(x0 - (x0 - x) * 0.25, footY - H, x0 - (x0 - x) * 0.1, footY - H * 0.4, x0 + (x0 - x) * 0.2, 1e4);
      ctx.lineTo(2e4, 1e4);
      ctx.lineTo(2e4, -1e4);
      ctx.closePath();
      ctx.fill();
    } else ctx.fillRect(x0, -1e4, 2e4, 2e4);
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
      if (TOON !== "doodle") {
        // A white sneaker sole.
        ctx.fillStyle = "rgba(244,242,247,0.95)";
        ctx.beginPath();
        ctx.roundRect(fx + s * H * 0.018 - H * 0.056, fy + H * 0.006, H * 0.112, H * 0.014, H * 0.007);
        ctx.fill();
      }
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
  ctx.fillStyle = "rgba(36,18,63,0.16)";
  ctx.beginPath();
  ctx.roundRect(x - headR * 0.24, shY - headR * 0.3, headR * 0.48, headR * 0.16, headR * 0.08);
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
  cel(x + headR * 0.42, TOON === "flat" ? 0.08 : 0.12);
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
  // A highlight streak on the hair (not in the ink styles, which stay graphic).
  if (TOON === "flat" || TOON === "soft") {
    ctx.strokeStyle = rgba(mixHex(look.hair, "#ffffff", 0.45), 0.5);
    ctx.lineWidth = headR * 0.1;
    ctx.beginPath();
    ctx.arc(x - headR * 0.05, headY, headR * 0.86, Math.PI * 1.2, Math.PI * 1.42);
    ctx.stroke();
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

type Box = { x: number; y: number; w: number; h: number };
type Pt = { x: number; y: number };
type Side = "top" | "right" | "bottom" | "left";

const BUBBLE_LH = 1.12;
/** The padding inside a bubble for type of this size. */
const bubblePad = (size: number, u: number) => ({ x: Math.max(24 * u, size * 0.62), y: Math.max(16 * u, size * 0.46) });
const bubbleFont = (sc: SkillContext, size: number, display: boolean) => (display ? displayFont(saasFont(sc), size) : subFont(size, 700));
const bubbleFill = (sc: SkillContext) => (sc.palette.light ? "#ffffff" : "#f7f8fc");

/** Which side of `box` a tail towards `tip` leaves from. */
function tipSide(box: Box, tip: Pt): Side {
  if (tip.y >= box.y + box.h) return "bottom";
  if (tip.y <= box.y) return "top";
  return tip.x < box.x + box.w / 2 ? "left" : "right";
}

/**
 * A speech bubble's box, hugging its text: no wider than `maxW` and inside `area`, kept on the
 * side of `area` nearest the speaker (`tip`) so the tail stays short.
 */
export function fitBubble(sc: SkillContext, text: string, tip: Pt, size: number, o: { area: Box; maxW?: number; display?: boolean; maxLines?: number }): Box {
  const { ctx, u } = sc;
  const { area } = o;
  const pad = bubblePad(size, u);
  const maxW = Math.min(area.w, o.maxW ?? area.w);
  ctx.save();
  ctx.font = bubbleFont(sc, size, o.display ?? true);
  const fit = fitTextLines(ctx, text, maxW - pad.x * 2, { maxLines: o.maxLines ?? 3, minScale: 0.5 });
  ctx.restore();
  const bw = clamp(fit.width + pad.x * 2, Math.min(maxW, Math.max(size * 3.2, 150 * u)), maxW);
  const bh = Math.min(area.h, (fit.lines.length - 1) * fit.size * BUBBLE_LH + fit.size * 1.05 + pad.y * 2);
  const side = tipSide(area, tip);
  if (side === "top" || side === "bottom") {
    return { x: clamp(tip.x - bw / 2, area.x, area.x + area.w - bw), y: side === "bottom" ? area.y + area.h - bh : area.y, w: bw, h: bh };
  }
  return { x: side === "left" ? area.x : area.x + area.w - bw, y: clamp(tip.y - bh * 0.6, area.y, area.y + area.h - bh), w: bw, h: bh };
}

/** The outline of a bubble: its rounded box and a curved tail, as one shape (so it fills and inks cleanly). */
function bubbleGeom(box: Box, tip: Pt, u: number) {
  const { x, y, w, h } = box;
  const R = Math.min((TOON === "comic" ? 18 : TOON === "soft" ? 34 : 26) * u, h * 0.45, w * 0.25);
  const side = tipSide(box, tip);
  const n = side === "top" ? { x: 0, y: -1 } : side === "bottom" ? { x: 0, y: 1 } : side === "left" ? { x: -1, y: 0 } : { x: 1, y: 0 };
  // The direction the outline runs along this side (clockwise).
  const tg = side === "top" ? { x: 1, y: 0 } : side === "bottom" ? { x: -1, y: 0 } : side === "left" ? { x: 0, y: -1 } : { x: 0, y: 1 };
  const vertical = side === "top" || side === "bottom";
  const tw = clamp(Math.min(w, h) * 0.17, 13 * u, 26 * u);
  const along = vertical ? clamp(tip.x, x + R + tw, x + w - R - tw) : clamp(tip.y, y + R + tw, y + h - R - tw);
  const base = side === "top" ? { x: along, y } : side === "bottom" ? { x: along, y: y + h } : side === "left" ? { x, y: along } : { x: x + w, y: along };
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const dist = Math.hypot(dx, dy) || 1;
  // Point at the speaker, but always leave the box outwards (never flat along its edge)…
  let dirX = dx / dist;
  let dirY = dy / dist;
  const out = dirX * n.x + dirY * n.y;
  if (out < 0.5) {
    dirX += n.x * (0.5 - out) * 2;
    dirY += n.y * (0.5 - out) * 2;
    const m = Math.hypot(dirX, dirY) || 1;
    dirX /= m;
    dirY /= m;
  }
  // …and keep it short: a long sliver reads as a mistake, not a tail.
  const L = clamp(dist, 16 * u, Math.max(64 * u, Math.min(w, h) * 0.7));
  const end = { x: base.x + dirX * L, y: base.y + dirY * L };
  const a = { x: base.x - tg.x * tw, y: base.y - tg.y * tw };
  const b = { x: base.x + tg.x * tw, y: base.y + tg.y * tw };
  return { box, R, side, n, a, b, end, L };
}

function traceBubble(ctx: CanvasRenderingContext2D, g: ReturnType<typeof bubbleGeom>) {
  const { x, y, w, h } = g.box;
  const { R, side, n, a, b, end, L } = g;
  const tail = () => {
    ctx.lineTo(a.x, a.y);
    ctx.quadraticCurveTo(a.x + n.x * L * 0.5, a.y + n.y * L * 0.5, end.x, end.y);
    ctx.quadraticCurveTo(b.x + n.x * L * 0.28, b.y + n.y * L * 0.28, b.x, b.y);
  };
  ctx.beginPath();
  ctx.moveTo(x + R, y);
  if (side === "top") tail();
  ctx.lineTo(x + w - R, y);
  ctx.arcTo(x + w, y, x + w, y + R, R);
  if (side === "right") tail();
  ctx.lineTo(x + w, y + h - R);
  ctx.arcTo(x + w, y + h, x + w - R, y + h, R);
  if (side === "bottom") tail();
  ctx.lineTo(x + R, y + h);
  ctx.arcTo(x, y + h, x, y + h - R, R);
  if (side === "left") tail();
  ctx.lineTo(x, y + R);
  ctx.arcTo(x, y, x + R, y, R);
  ctx.closePath();
}

/** Fill (and ink, per style) the current bubble or cloud path: offset ink in comic, a soft shadow otherwise. */
function fillBalloon(sc: SkillContext, trace: () => void) {
  const { ctx, u } = sc;
  ctx.save();
  if (TOON === "comic") {
    ctx.save();
    ctx.translate(7 * u, 7 * u);
    trace();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.restore();
  } else if (TOON !== "doodle") {
    ctx.shadowColor = sc.palette.light ? "rgba(40,30,80,0.18)" : "rgba(0,0,0,0.35)";
    ctx.shadowBlur = (TOON === "soft" ? 44 : 28) * u;
    ctx.shadowOffsetY = (TOON === "soft" ? 16 : 10) * u;
  }
  trace();
  ctx.fillStyle = bubbleFill(sc);
  ctx.fill();
  ctx.shadowColor = "transparent";
  if (TOON === "comic" || TOON === "doodle") ink(ctx, 4.5 * u);
  else {
    // A hairline edge, so a white bubble still reads on a pale stage.
    ctx.lineWidth = 1.5 * u;
    ctx.strokeStyle = "rgba(30,20,60,0.08)";
    ctx.stroke();
  }
  ctx.restore();
}

/** Grow from `p` by `k` (the pop-in), around the current transform. */
function growFrom(ctx: CanvasRenderingContext2D, p: Pt, k: number) {
  ctx.translate(p.x, p.y);
  ctx.scale(k, k);
  ctx.translate(-p.x, -p.y);
}

/** A speech bubble (rounded box with a tail pointing at `tip`), drawn grown from the tail by `k`. */
export function bubble(sc: SkillContext, box: Box, tip: Pt, k: number) {
  if (k <= 0.001) return;
  const { ctx, u } = sc;
  const g = bubbleGeom(box, tip, u);
  ctx.save();
  growFrom(ctx, g.end, k);
  fillBalloon(sc, () => traceBubble(ctx, g));
  ctx.restore();
}

/** Text inside a bubble: dark on white, set in the same lines `fitBubble` measured. */
export function bubbleText(sc: SkillContext, text: string, box: Box, size: number, k: number, display = true, maxLines = 3) {
  const { ctx, u } = sc;
  if (k <= 0.01) return;
  const pad = bubblePad(size, u);
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.6 - 0.4);
  ctx.fillStyle = "#151826";
  ctx.font = bubbleFont(sc, size, display);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fillTextFit(ctx, text, box.x + box.w / 2, box.y + box.h / 2, box.w - pad.x * 2 + 1, { maxLines, lineHeight: BUBBLE_LH, minScale: 0.5 });
  ctx.restore();
}

/** A speech bubble with its text, the two growing together from the tail. */
export function speech(sc: SkillContext, text: string, box: Box, tip: Pt, size: number, k: number, display = true) {
  if (k <= 0.001) return;
  const { ctx, u } = sc;
  const g = bubbleGeom(box, tip, u);
  ctx.save();
  growFrom(ctx, g.end, k);
  fillBalloon(sc, () => traceBubble(ctx, g));
  bubbleText(sc, text, box, size, 1, display);
  ctx.restore();
}

/**
 * A thought cloud around `text`, centred on `c` (no wider than `maxW`), with three shrinking dots
 * trailing down to `head`. Puffs are spaced evenly round an ellipse sized to the text.
 */
export function thoughtCloud(sc: SkillContext, text: string, c: Pt, maxW: number, size: number, head: Pt, k: number, display = false) {
  if (k <= 0.001) return;
  const { ctx, u } = sc;
  const pad = bubblePad(size, u);
  ctx.save();
  ctx.font = bubbleFont(sc, size, display);
  const fit = fitTextLines(ctx, text, maxW * 0.74 - pad.x * 2, { maxLines: 3, minScale: 0.55 });
  ctx.restore();
  const tw = Math.max(fit.width, size * 3);
  const th = (fit.lines.length - 1) * fit.size * BUBBLE_LH + fit.size * 1.05;
  const rx = tw / 2 + pad.x * 1.35;
  const ry = th / 2 + pad.y * 1.7;
  const pr = clamp(ry * 0.5, 16 * u, 70 * u);
  const per = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const nP = clamp(Math.round(per / (pr * 1.25)), 8, 18);
  const puffs: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < nP; i++) {
    const a = (i / nP) * TAU + 0.2;
    puffs.push({ x: c.x + Math.cos(a) * rx, y: c.y + Math.sin(a) * ry, r: pr * (1 + 0.14 * Math.sin(i * 2.7)) });
  }
  // The dots: from the cloud's edge towards the head, getting smaller.
  const hx = head.x - c.x;
  const hy = head.y - c.y;
  const e = 1 / Math.hypot(hx / rx, hy / ry);
  const p0 = { x: c.x + hx * e, y: c.y + hy * e };
  const hd = Math.hypot(head.x - p0.x, head.y - p0.y) || 1;
  const ux = (head.x - p0.x) / hd;
  const uy = (head.y - p0.y) / hd;
  const dots = [0.5, 0.36, 0.25].map((s, i) => {
    const f = pr * 0.9 + (hd - pr * 0.9) * [0.18, 0.55, 0.88][i];
    return { x: p0.x + ux * f, y: p0.y + uy * f, r: Math.max(pr * s, (10 - i * 2.5) * u) };
  });
  const trace = () => {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU);
    for (const p of [...puffs, ...dots]) {
      ctx.moveTo(p.x + p.r, p.y);
      ctx.arc(p.x, p.y, p.r, 0, TAU);
    }
  };
  ctx.save();
  growFrom(ctx, c, k);
  if (TOON === "comic" || TOON === "doodle") {
    // Ink the union's outer edge: a wide stroke under the fill leaves just the outside half showing.
    ctx.save();
    if (TOON === "comic") {
      ctx.save();
      ctx.translate(7 * u, 7 * u);
      trace();
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.restore();
    }
    trace();
    ctx.lineWidth = (TOON === "comic" ? 9 : 4.5) * u;
    ctx.strokeStyle = TOON === "comic" ? INK : rgba(SEPIA, 0.85);
    ctx.stroke();
    ctx.fillStyle = bubbleFill(sc);
    ctx.fill();
    ctx.restore();
  } else fillBalloon(sc, trace);
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.6 - 0.4);
  ctx.fillStyle = "#151826";
  ctx.font = fit.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fillTextFit(ctx, fit.lines.join(" "), c.x, c.y, tw + 1, { maxLines: 3, lineHeight: BUBBLE_LH, minScale: 0.55 });
  ctx.restore();
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
  const bw = portrait ? w * 0.84 : w * 0.44;
  const size = (portrait ? 64 : 72) * u;
  // Beside the mouth (on the side away from the waving hand), or above the head when vertical.
  const area = portrait ? { x: (w - bw) / 2, y: h * 0.1, w: bw, h: Math.max(h * 0.12, ch.top - h * 0.1 - 40 * u) } : { x: w * 0.47, y: h * 0.12, w: bw, h: h * 0.5 };
  const tip = portrait ? { x: cx + ch.head.r * 0.2, y: ch.top - 10 * u } : { x: cx + ch.head.r * 1.12, y: ch.head.y + ch.head.r * 0.3 };
  const box = fitBubble(sc, text, tip, size, { area });
  const k = pop(t, 0.75);
  speech(sc, text, box, tip, size, k);
  if (scene.subtext) {
    const a = range(t, 1.2, 1.6);
    ctx.globalAlpha = (1 - ex) * a;
    ctx.fillStyle = rgba(palette.text, 0.8);
    ctx.font = subFont((portrait ? 30 : 32) * u, 500);
    ctx.textAlign = portrait ? "center" : "left";
    // Under the bubble; above it in vertical frames, where the head is just below.
    ctx.textBaseline = portrait ? "bottom" : "top";
    const sy = portrait ? box.y - 24 * u : box.y + box.h + 28 * u;
    fillTextFit(ctx, plain(scene.subtext), portrait ? w / 2 : box.x + 8 * u, sy + (1 - a) * 10 * u, bw - 16 * u, { maxLines: 2, lineHeight: 1.25 });
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
    const tip = { x: hd.x + hd.r * 0.3, y: hd.top - 6 * u };
    const area = { x: st.left, y: st.top, w: st.width, h: Math.max(size * 2, tip.y - 30 * u - st.top) };
    const box = fitBubble(sc, P[cur], tip, size, { area, maxW: st.width * (narrow ? 0.9 : 0.46) });
    speech(sc, P[cur], box, tip, size, k);
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
    const cw = portrait ? w * 0.8 : w * 0.46;
    const size = (portrait ? 36 : 38) * u;
    const c = portrait ? { x: w / 2, y: Math.max(h * 0.16, ch.top - h * 0.17) } : { x: cx + w * 0.33, y: ch.head.y - h * 0.2 };
    thoughtCloud(sc, problem, c, cw, size, { x: ch.head.x + ch.head.r * (portrait ? 0 : 0.7), y: ch.top - ch.head.r * 0.15 }, cloudK);
    // Question marks bob around the head.
    for (let k = 0; k < 2; k++) {
      ctx.save();
      ctx.globalAlpha *= cloudK * 0.8;
      ctx.fillStyle = palette.primary;
      ctx.font = displayFont(saasFont(sc), ch.head.r * 0.8);
      ctx.textAlign = "center";
      // On the side away from the cloud's dots.
      ctx.fillText("?", ch.head.x - ch.head.r * (k ? 1.05 : 1.6), ch.head.y - ch.head.r * ((k ? 1.45 : 0.55) + 0.15 * Math.sin(t * 4 + k * 2)));
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
