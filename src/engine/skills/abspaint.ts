/**
 * Shared drawing for the generated characters (abstract.ts and the other kinds in abskinds.ts):
 * the drawing-style painter (flat, soft 3D, outline, line art, paper cut), heads with hair, the
 * minimal face, tapered limbs, and the figure's ground shadow and squash.
 */
import { clamp, mixHex, TAU } from "../math";
import type { ArtStyle, CastMember } from "../types";
import type { AbsPose } from "./abstract";

export const INK = "#17131f";

export type Painter = ReturnType<typeof painter>;

/** How shapes are filled and limbs stroked in a drawing style (H: the figure's height unit). */
export function painter(ctx: CanvasRenderingContext2D, H: number, art: ArtStyle) {
  const inked = art === "outline" || art === "line";
  const inkW = Math.max(1.2, H * (art === "line" ? 0.0075 : 0.011));
  const m = ctx.getTransform();
  const px = Math.hypot(m.a, m.b);
  const paperOn = () => {
    if (art !== "paper") return;
    ctx.shadowColor = "rgba(40,24,70,0.26)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = H * 0.007 * px;
    ctx.shadowOffsetY = H * 0.011 * px;
  };
  const paperOff = () => {
    if (art === "paper") ctx.shadowColor = "transparent";
  };
  const tint = (col: string) => (art === "line" ? mixHex(col, "#ffffff", 0.8) : col);
  const inkStroke = () => {
    if (!inked) return;
    ctx.strokeStyle = INK;
    ctx.lineWidth = inkW;
    ctx.stroke();
  };
  /** Fill the current path in this style (y0..y1: the shape's extent, for soft shading). */
  const fillShape = (col: string, y0: number, y1: number, ink = true) => {
    if (art === "soft") {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, mixHex(col, "#ffffff", 0.3));
      g.addColorStop(1, mixHex(col, "#000000", 0.16));
      ctx.fillStyle = g;
    } else ctx.fillStyle = tint(col);
    paperOn();
    ctx.fill();
    paperOff();
    if (ink) inkStroke();
  };
  /** Stroke a limb (traced by `trace`) in this style: ink-edged, a plain ink line, or a coloured noodle. */
  const strokeLimb = (col: string, width: number, trace: () => void, keepColor = false) => {
    if (art === "outline") {
      ctx.strokeStyle = INK;
      ctx.lineWidth = width + inkW * 2;
      trace();
      ctx.stroke();
    }
    paperOn();
    const line = art === "line" && !keepColor;
    ctx.strokeStyle = line ? INK : col;
    ctx.lineWidth = line ? inkW * 1.15 : width;
    trace();
    ctx.stroke();
    paperOff();
  };
  return { art, inked, inkW, tint, inkStroke, fillShape, strokeLimb, paperOn, paperOff };
}

/**
 * A seated leg (a wheelchair user): the thigh runs forward from the hip at seat height and the shin
 * drops to the foot on the footrest. `thigh` is in character heights; the far leg (s = −1) sits a
 * touch behind. `bend` is the knee corner, for a quadratic from the hip to the foot.
 */
export function sitLeg(s: number, x: number, hipY: number, groundY: number, H: number, thigh: number) {
  const kx = x + thigh * H + s * H * 0.014;
  const ky = hipY + H * (s < 0 ? 0.004 : 0.012);
  return { knee: { x: kx, y: ky }, bend: { x: kx + H * 0.008, y: ky + H * 0.006 }, foot: { x: kx + H * 0.014, y: groundY } };
}

/**
 * Start a figure: its ground shadow (`r`: half its width), then squash and stretch around the feet,
 * a lean and the mirror. Pair with ctx.restore().
 */
export function beginFigure(ctx: CanvasRenderingContext2D, x: number, groundY: number, H: number, pose: AbsPose, r: number) {
  const lift = (pose.lift ?? 0) * H;
  const sq = pose.squash ?? 0;
  ctx.save();
  // Seated (in a wheelchair), the chair casts the shadow.
  if (pose.sit === undefined) {
    ctx.fillStyle = `rgba(20,10,40,${0.16 * clamp(1 - lift / (H * 0.3))})`;
    ctx.beginPath();
    ctx.ellipse(x, groundY + H * 0.008, r, H * 0.022, 0, 0, TAU);
    ctx.fill();
  }
  ctx.translate(x, groundY);
  ctx.scale(1 - sq * 0.6, 1 + sq);
  ctx.rotate(pose.lean ?? 0);
  if (pose.flip) ctx.scale(-1, 1);
  ctx.translate(-x, -groundY);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/**
 * A limb that tapers from `w0` to `w1` wide along a quadratic curve (p0 → c → p1), as a closed
 * path with round ends, ready to fill.
 */
export function taperPath(ctx: CanvasRenderingContext2D, p0: { x: number; y: number }, c: { x: number; y: number }, p1: { x: number; y: number }, w0: number, w1: number) {
  const n = 14;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x;
    const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y;
    const dx = 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p1.x - c.x);
    const dy = 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p1.y - c.y);
    const d = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * t) / 2;
    left.push([x - (dy / d) * w, y + (dx / d) * w]);
    right.push([x + (dy / d) * w, y - (dx / d) * w]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const [x, y] of left) ctx.lineTo(x, y);
  // Round end at p1, back along the other side, round end at p0.
  const a1 = Math.atan2(right[n][1] - p1.y, right[n][0] - p1.x);
  ctx.arc(p1.x, p1.y, w1 / 2, a1 + Math.PI, a1, true);
  for (let i = n; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  const a0 = Math.atan2(left[0][1] - p0.y, left[0][0] - p0.x);
  ctx.arc(p0.x, p0.y, w0 / 2, a0 + Math.PI, a0, true);
  ctx.closePath();
}

/** How high hair reaches above the head's centre, in head radii. */
export const hairTop = (c: Pick<CastMember, "hair">) => (c.hair === "spikes" || c.hair === "bun" || c.hair === "beanie" ? 1.5 : 1.15);

/** A head (circle, oval or rounded square) of radius `hr` at (x, headY), with its hair behind and on top. */
export function drawHeadHair(ctx: CanvasRenderingContext2D, P: Painter, x: number, headY: number, hr: number, c: CastMember) {
  const { fillShape } = P;
  // Hair behind the head.
  if (c.hair === "bob") {
    ctx.beginPath();
    ctx.roundRect(x - hr * 1.12, headY - hr * 0.6, hr * 2.24, hr * 1.65, [hr, hr, hr * 0.3, hr * 0.3]);
    fillShape(c.hairColor, headY - hr * 0.6, headY + hr * 1.05);
  } else if (c.hair === "afro") {
    ctx.beginPath();
    ctx.arc(x, headY - hr * 0.25, hr * 1.45, 0, TAU);
    fillShape(c.hairColor, headY - hr * 1.7, headY + hr * 1.2);
  }
  // Head.
  ctx.beginPath();
  if (c.head === "oval") ctx.ellipse(x, headY, hr * 0.86, hr * 1.06, 0, 0, TAU);
  else if (c.head === "squircle") ctx.roundRect(x - hr, headY - hr, hr * 2, hr * 2, hr * 0.7);
  else ctx.arc(x, headY, hr, 0, TAU);
  fillShape(c.skin, headY - hr, headY + hr);
  if (P.art === "soft") {
    // A soft sheen on the forehead.
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.ellipse(x - hr * 0.35, headY - hr * 0.45, hr * 0.32, hr * 0.18, -0.5, 0, TAU);
    ctx.fill();
  }
  // Hair on top.
  const hairFill = () => fillShape(c.hairColor, headY - hr * 1.6, headY);
  switch (c.hair) {
    case "cap":
    case "bob":
      ctx.beginPath();
      ctx.arc(x, headY, hr * 1.04, Math.PI * 1.05, Math.PI * 1.95);
      ctx.quadraticCurveTo(x + hr * 0.3, headY - hr * 0.3, x - hr * 0.98, headY - hr * 0.3);
      ctx.closePath();
      hairFill();
      break;
    case "bun":
      ctx.beginPath();
      ctx.arc(x, headY - hr * 1.2, hr * 0.42, 0, TAU);
      ctx.arc(x, headY, hr * 1.03, Math.PI * 1.08, Math.PI * 1.92);
      hairFill();
      break;
    case "spikes":
      ctx.beginPath();
      ctx.moveTo(x - hr, headY - hr * 0.2);
      for (let k = 0; k <= 5; k++) {
        const kx = x - hr + (k / 5) * hr * 2;
        ctx.lineTo(kx - hr * 0.2, headY - hr * (k % 2 ? 1.5 : 0.9));
        ctx.lineTo(kx, headY - hr * 0.7);
      }
      ctx.lineTo(x + hr, headY - hr * 0.2);
      ctx.arc(x, headY, hr * 1.02, Math.PI * 2 - 0.2, Math.PI + 0.2, true);
      hairFill();
      break;
    case "wave":
      ctx.beginPath();
      ctx.moveTo(x - hr * 1.05, headY);
      ctx.bezierCurveTo(x - hr * 1.3, headY - hr * 1.6, x + hr * 0.6, headY - hr * 1.7, x + hr * 1.15, headY - hr * 0.5);
      ctx.quadraticCurveTo(x + hr * 0.4, headY - hr * 0.7, x - hr * 0.2, headY - hr * 0.45);
      ctx.quadraticCurveTo(x - hr * 0.7, headY - hr * 0.3, x - hr * 1.05, headY);
      hairFill();
      break;
    case "beanie":
      ctx.beginPath();
      ctx.arc(x, headY - hr * 0.25, hr * 1.05, Math.PI, 0);
      ctx.closePath();
      fillShape(c.patternColor, headY - hr * 1.3, headY - hr * 0.25);
      ctx.beginPath();
      ctx.rect(x - hr * 1.12, headY - hr * 0.32, hr * 2.24, hr * 0.3);
      fillShape(c.patternColor, headY - hr * 0.32, headY - hr * 0.02);
      ctx.beginPath();
      ctx.arc(x, headY - hr * 1.35, hr * 0.22, 0, TAU);
      fillShape(c.patternColor, headY - hr * 1.57, headY - hr * 1.13);
      break;
    case "afro":
      break;
  }
}

/** The minimal face: eyes (dots, lines or ovals), glasses, cheeks, nose and mouth, on a head of radius `hr`. */
export function drawFace(ctx: CanvasRenderingContext2D, x: number, headY: number, hr: number, c: CastMember, pose: AbsPose) {
  const lk = (pose.look ?? 0) * hr * 0.15;
  const ey = headY + hr * 0.08;
  const blink = clamp(pose.blink ?? 0);
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, hr * 0.1);
  for (const s of [-1, 1]) {
    const ex = x + s * hr * 0.38 + lk;
    if (c.eyes === "lines" || blink > 0.6) {
      ctx.beginPath();
      ctx.moveTo(ex - hr * 0.12, ey);
      ctx.lineTo(ex + hr * 0.12, ey);
      ctx.stroke();
    } else if (c.eyes === "ovals") {
      ctx.beginPath();
      ctx.ellipse(ex, ey, hr * 0.09, hr * 0.15 * (1 - blink), 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(ex, ey, hr * 0.1 * (1 - blink * 0.8), 0, TAU);
      ctx.fill();
    }
  }
  if (c.glasses) {
    ctx.lineWidth = Math.max(1.2, hr * 0.07);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + s * hr * 0.38 + lk, ey, hr * 0.24, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - hr * 0.14 + lk, ey);
    ctx.lineTo(x + hr * 0.14 + lk, ey);
    ctx.stroke();
  }
  if (c.cheeks) {
    ctx.fillStyle = "rgba(255,110,120,0.32)";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + s * hr * 0.58 + lk, headY + hr * 0.42, hr * 0.15, hr * 0.09, 0, 0, TAU);
      ctx.fill();
    }
  }
  if (c.nose) {
    ctx.strokeStyle = mixHex(c.skin, "#000000", 0.3);
    ctx.lineWidth = Math.max(1.2, hr * 0.07);
    ctx.beginPath();
    ctx.moveTo(x + lk * 1.2, headY + hr * 0.18);
    ctx.quadraticCurveTo(x + lk * 1.2 + hr * 0.1, headY + hr * 0.32, x + lk * 1.2 - hr * 0.02, headY + hr * 0.36);
    ctx.stroke();
  }
  drawMouth(ctx, x + lk, headY + hr * 0.55, hr, pose.mouth ?? "smile");
}

/** A simple mouth centred at (x, my) for a head of radius `hr`. */
export function drawMouth(ctx: CanvasRenderingContext2D, x: number, my: number, hr: number, mouth: NonNullable<AbsPose["mouth"]>) {
  ctx.fillStyle = "#3a1220";
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, hr * 0.09);
  ctx.beginPath();
  switch (mouth) {
    case "open":
      ctx.moveTo(x - hr * 0.26, my - hr * 0.04);
      ctx.quadraticCurveTo(x, my + hr * 0.42, x + hr * 0.26, my - hr * 0.04);
      ctx.closePath();
      ctx.fill();
      break;
    case "o":
      ctx.arc(x, my + hr * 0.04, hr * 0.1, 0, TAU);
      ctx.fill();
      break;
    case "flat":
      ctx.moveTo(x - hr * 0.16, my + hr * 0.04);
      ctx.lineTo(x + hr * 0.16, my + hr * 0.04);
      ctx.stroke();
      break;
    default:
      ctx.moveTo(x - hr * 0.24, my - hr * 0.02);
      ctx.quadraticCurveTo(x, my + hr * 0.24, x + hr * 0.24, my - hr * 0.02);
      ctx.stroke();
  }
}
