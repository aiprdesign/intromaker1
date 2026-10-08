/**
 * More kinds of generated character, drawn from the same design (CastMember) and posed by the same
 * AbsPose as the abstract people, so every abstract slide, placard and wave works with each:
 *
 * - memphis: the "Corporate Memphis" trend: a tiny head, long bendy tapered limbs, big hands and
 *   feet, often a playful skin colour.
 * - blob:    a trendy one-shape mascot (head and body in one: pill, gumdrop, pear, ghost, round or
 *   block) with big eyes, stubby legs, little arms and a sprout, tuft or antenna on top.
 * - stick:   a stick figure: line limbs with knees and elbows, a round head, and one accent (a scarf,
 *   bow tie, T-shirt or dress) in the video's colours.
 * - classic: a traditional rubber-hose cartoon: a pear-shaped body with shorts and buttons, smooth
 *   noodle limbs, white gloves, pie-cut eyes, a button nose and big shoes.
 *
 * The body shape, pattern, hair and face options mean the closest thing in each kind (see the
 * designer, which hides the ones a kind doesn't use).
 */
import { clamp, lerp, mixHex, TAU } from "../math";
import type { CastMember } from "../types";
import type { AbsPose, AbsRig } from "./abstract";
import { beginFigure, drawFace, drawHeadHair, drawMouth, hairTop, INK, painter, sitLeg, taperPath, type Painter } from "./abspaint";

type Pt = { x: number; y: number };

/** Hands as seen from outside (a mirrored figure swaps them). */
const hands = (x: number, flip: boolean | undefined, l: Pt, r: Pt) => (flip ? { handL: { x: 2 * x - r.x, y: r.y }, handR: { x: 2 * x - l.x, y: l.y } } : { handL: l, handR: r });

/** A leg's foot position and lift for a walk phase (undefined: standing). */
function stride(walk: number | undefined, s: number, len: number) {
  if (walk === undefined) return { swing: 0, raise: 0 };
  const ph = walk + (s > 0 ? Math.PI : 0);
  return { swing: Math.sin(ph) * len * 0.45, raise: Math.max(0, Math.cos(ph)) * len * 0.18 };
}

/** Stripes, dots or a two-tone split, clipped to the current body path (`trace` redraws it). */
function pattern(ctx: CanvasRenderingContext2D, P: Painter, c: CastMember, trace: () => void, x: number, top: number, w: number, h: number) {
  if (c.pattern === "none") return;
  ctx.save();
  trace();
  ctx.clip();
  ctx.fillStyle = P.tint(c.patternColor);
  if (c.pattern === "stripes") {
    const step = h / 5;
    for (let k = 1; k < 5; k += 2) ctx.fillRect(x - w, top + k * step, w * 2, step * 0.55);
  } else if (c.pattern === "dots") {
    const step = w / 4;
    for (let yy = top + step * 0.6; yy < top + h; yy += step)
      for (let xx = x - w / 2 + step * 0.5 + ((Math.round((yy - top) / step) % 2) * step) / 2; xx < x + w / 2; xx += step) {
        ctx.beginPath();
        ctx.arc(xx, yy, step * 0.16, 0, TAU);
        ctx.fill();
      }
  } else ctx.fillRect(x - w, top + h * 0.55, w * 2, h);
  ctx.restore();
}

/** A soft shade down one side of the current body path (not in the soft or line-art styles). */
function sideShade(ctx: CanvasRenderingContext2D, P: Painter, trace: () => void, x: number, w: number, H: number) {
  if (P.art === "soft" || P.art === "line") return;
  ctx.save();
  trace();
  ctx.clip();
  ctx.fillStyle = "rgba(36,18,63,0.1)";
  ctx.fillRect(x + w * 0.18, -H * 10, w, H * 20);
  ctx.restore();
}

/* ───────────────────────── Corporate Memphis ───────────────────────── */

export function drawMemphis(ctx: CanvasRenderingContext2D, x: number, groundY: number, H: number, c: CastMember, pose: AbsPose): AbsRig {
  const P = painter(ctx, H, c.art ?? "flat");
  const lift = (pose.lift ?? 0) * H;
  const legLen = c.legLen * 1.2 * H;
  const bw = c.bodyW * 0.95 * H;
  const bh = c.bodyH * 0.9 * H;
  const hr = c.headR * 0.55 * H;
  const hipY = groundY - legLen - lift;
  const top = hipY - bh;
  const headY = top - Math.max(c.neck * H, H * 0.014) - hr * 0.85;
  beginFigure(ctx, x, groundY, H, pose, bw * 0.62);
  // Thick tapered trousers and long flat feet.
  for (const s of [-1, 1]) {
    const hx = x + s * bw * 0.2;
    if (pose.sit !== undefined) {
      const L = sitLeg(s, x, hipY, groundY, H, pose.sit);
      taperPath(ctx, { x: hx, y: hipY - H * 0.02 }, L.bend, { x: L.foot.x, y: L.foot.y - H * 0.03 }, H * 0.085, H * 0.048);
      P.fillShape(c.legColor, hipY, L.foot.y);
      ctx.beginPath();
      ctx.ellipse(L.foot.x + H * 0.032, L.foot.y - H * 0.018, H * 0.068, H * 0.024, 0, 0, TAU);
      P.fillShape(c.shoe, L.foot.y - H * 0.04, L.foot.y);
      continue;
    }
    const { swing, raise } = stride(pose.walk, s, legLen);
    const fx = hx + swing;
    const fy = groundY - raise - lift;
    taperPath(ctx, { x: hx, y: hipY - H * 0.02 }, { x: lerp(hx, fx, 0.5) + s * H * 0.012, y: lerp(hipY, fy, 0.5) - raise * 0.3 }, { x: fx, y: fy - H * 0.03 }, H * 0.085, H * 0.048);
    P.fillShape(c.legColor, hipY, fy);
    ctx.beginPath();
    ctx.ellipse(fx + H * 0.032, fy - H * 0.018, H * 0.068, H * 0.024, 0, 0, TAU);
    P.fillShape(c.shoe, fy - H * 0.04, fy);
  }
  // The top: a soft trapezoid with round shoulders.
  const torso = () => {
    const r = bw * 0.24;
    ctx.beginPath();
    ctx.moveTo(x - bw / 2, top + r);
    ctx.quadraticCurveTo(x - bw / 2, top, x - bw / 2 + r, top);
    ctx.lineTo(x + bw / 2 - r, top);
    ctx.quadraticCurveTo(x + bw / 2, top, x + bw / 2, top + r);
    ctx.lineTo(x + bw * 0.38, hipY + H * 0.01);
    ctx.lineTo(x - bw * 0.38, hipY + H * 0.01);
    ctx.closePath();
  };
  // Neck.
  ctx.beginPath();
  ctx.roundRect(x - hr * 0.32, headY, hr * 0.64, top - headY + H * 0.01, hr * 0.2);
  P.fillShape(c.skin, headY, top);
  torso();
  P.fillShape(c.bodyColor, top, hipY, false);
  pattern(ctx, P, c, torso, x, top, bw, bh);
  sideShade(ctx, P, torso, x, bw, H);
  if (P.inked) {
    torso();
    P.inkStroke();
  }
  drawHeadHair(ctx, P, x, headY, hr, c);
  drawFace(ctx, x, headY, hr, { ...c, glasses: c.glasses, nose: false }, pose);
  // Long bendy arms with big hands, over the top.
  const armLen = H * 0.36;
  const arm = (s: number): Pt => {
    const a = s < 0 ? pose.armL : pose.armR;
    const curl = (s < 0 ? pose.curlL : pose.curlR) ?? 0.3;
    // From inside the shoulder (not the torso's rounded corner), so there's no notch.
    const sx = x + s * bw * 0.34;
    const sy = top + H * 0.045;
    const ex = sx + s * Math.sin(a) * armLen;
    const ey = sy + Math.cos(a) * armLen;
    const mx = (sx + ex) / 2 + s * Math.cos(a) * armLen * 0.3 * curl;
    const my = (sy + ey) / 2 - Math.sin(a) * armLen * 0.3 * curl;
    taperPath(ctx, { x: sx, y: sy }, { x: mx, y: my }, { x: ex, y: ey }, H * 0.062, H * 0.034);
    P.fillShape(c.armColor, Math.min(sy, ey), Math.max(sy, ey));
    ctx.beginPath();
    ctx.ellipse(ex, ey, H * 0.04, H * 0.034, a * s, 0, TAU);
    P.fillShape(c.skin, ey - H * 0.04, ey + H * 0.04);
    return { x: ex, y: ey };
  };
  const l = arm(-1);
  const r = arm(1);
  ctx.restore();
  return { head: { x, y: headY, r: hr }, top: headY - hr * hairTop(c), ...hands(x, pose.flip, l, r) };
}

/* ───────────────────────── Blob ───────────────────────── */

export function drawBlob(ctx: CanvasRenderingContext2D, x: number, groundY: number, H: number, c: CastMember, pose: AbsPose): AbsRig {
  const P = painter(ctx, H, c.art ?? "flat");
  const lift = (pose.lift ?? 0) * H;
  const bw = c.bodyW * 1.55 * H;
  const bh = (c.bodyH * 1.25 + c.headR * 1.6) * H;
  const legLen = c.legLen * 0.32 * H;
  const bottom = groundY - legLen - lift;
  const topY = bottom - bh;
  beginFigure(ctx, x, groundY, H, pose, bw * 0.5);
  // Stubby legs and round feet.
  for (const s of [-1, 1]) {
    const hx = x + s * bw * 0.18;
    const { swing, raise } = stride(pose.walk, s, legLen * 1.6);
    const fx = hx + swing * 0.6;
    const fy = groundY - raise - lift;
    P.strokeLimb(c.legColor, H * 0.045, () => {
      ctx.beginPath();
      ctx.moveTo(hx, bottom - H * 0.03);
      ctx.lineTo(fx, fy - H * 0.02);
    });
    ctx.beginPath();
    ctx.ellipse(fx + s * H * 0.008, fy - H * 0.016, H * 0.04, H * 0.022, 0, 0, TAU);
    P.fillShape(c.shoe, fy - H * 0.04, fy);
  }
  const body = () => {
    ctx.beginPath();
    switch (c.body) {
      case "round":
        ctx.ellipse(x, topY + bh / 2, bw / 2, bh / 2, 0, 0, TAU);
        break;
      case "arch":
        ctx.moveTo(x - bw / 2, bottom);
        ctx.lineTo(x - bw / 2, topY + bw / 2);
        ctx.arc(x, topY + bw / 2, bw / 2, Math.PI, 0);
        ctx.lineTo(x + bw / 2, bottom);
        // A wavy ghost hem.
        for (let k = 1; k <= 4; k++) ctx.quadraticCurveTo(x + bw / 2 - (bw * (k - 0.5)) / 4, bottom + H * (k % 2 ? 0.018 : -0.018), x + bw / 2 - (bw * k) / 4, bottom);
        ctx.closePath();
        break;
      case "bell":
        ctx.moveTo(x, topY);
        ctx.bezierCurveTo(x + bw * 0.42, topY, x + bw * 0.3, topY + bh * 0.45, x + bw / 2, bottom - bh * 0.2);
        ctx.quadraticCurveTo(x + bw / 2, bottom, x, bottom);
        ctx.quadraticCurveTo(x - bw / 2, bottom, x - bw / 2, bottom - bh * 0.2);
        ctx.bezierCurveTo(x - bw * 0.3, topY + bh * 0.45, x - bw * 0.42, topY, x, topY);
        break;
      case "triangle":
        ctx.moveTo(x, topY);
        ctx.quadraticCurveTo(x + bw * 0.24, topY, x + bw * 0.5, bottom - bh * 0.12);
        ctx.quadraticCurveTo(x + bw * 0.53, bottom, x + bw * 0.38, bottom);
        ctx.lineTo(x - bw * 0.38, bottom);
        ctx.quadraticCurveTo(x - bw * 0.53, bottom, x - bw * 0.5, bottom - bh * 0.12);
        ctx.quadraticCurveTo(x - bw * 0.24, topY, x, topY);
        break;
      case "block":
        ctx.roundRect(x - bw / 2, topY, bw, bh, bw * 0.28);
        break;
      default:
        ctx.roundRect(x - bw / 2, topY, bw, bh, bw / 2);
    }
  };
  // Little arms out of the sides.
  const armY = bottom - bh * 0.38;
  const arm = (s: number): Pt => {
    const a = s < 0 ? pose.armL : pose.armR;
    const curl = (s < 0 ? pose.curlL : pose.curlR) ?? 0.3;
    const sx = x + s * bw * 0.44;
    const len = H * 0.13;
    const ex = sx + s * Math.sin(a) * len;
    const ey = armY + Math.cos(a) * len;
    P.strokeLimb(c.armColor, H * 0.03, () => {
      ctx.beginPath();
      ctx.moveTo(sx, armY);
      ctx.quadraticCurveTo((sx + ex) / 2 + s * Math.cos(a) * len * 0.3 * curl, (armY + ey) / 2 - Math.sin(a) * len * 0.3 * curl, ex, ey);
    });
    ctx.beginPath();
    ctx.arc(ex, ey, H * 0.022, 0, TAU);
    P.fillShape(c.armColor, ey - H * 0.022, ey + H * 0.022);
    return { x: ex, y: ey };
  };
  const l = arm(-1);
  const r = arm(1);
  body();
  P.fillShape(c.bodyColor, topY, bottom, false);
  if (c.pattern === "half") {
    // A belly patch.
    ctx.save();
    body();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(x, bottom - bh * 0.22, bw * 0.3, bh * 0.25, 0, 0, TAU);
    ctx.fillStyle = P.tint(c.patternColor);
    ctx.fill();
    ctx.restore();
  } else pattern(ctx, P, c, body, x, topY + bh * 0.55, bw, bh * 0.45);
  sideShade(ctx, P, body, x, bw, H);
  if (P.inked) {
    body();
    P.inkStroke();
  }
  // The topper.
  const tx = x;
  const ty = topY + (c.body === "triangle" || c.body === "bell" ? H * 0.004 : H * 0.012);
  const s = bw * 0.5;
  switch (c.hair) {
    case "cap":
      // A tuft.
      P.strokeLimb(c.hairColor, H * 0.016, () => {
        ctx.beginPath();
        for (const k of [-1, 0, 1]) {
          ctx.moveTo(tx + k * s * 0.08, ty + H * 0.01);
          ctx.quadraticCurveTo(tx + k * s * 0.22, ty - s * 0.2, tx + k * s * 0.3, ty - s * 0.16);
        }
      }, true);
      break;
    case "bun":
      // An antenna.
      P.strokeLimb(c.hairColor, H * 0.012, () => {
        ctx.beginPath();
        ctx.moveTo(tx, ty + H * 0.01);
        ctx.quadraticCurveTo(tx + s * 0.1, ty - s * 0.2, tx + s * 0.05, ty - s * 0.32);
      }, true);
      ctx.beginPath();
      ctx.arc(tx + s * 0.05, ty - s * 0.36, s * 0.09, 0, TAU);
      P.fillShape(c.hairColor, ty - s * 0.45, ty - s * 0.27);
      break;
    case "spikes":
      ctx.beginPath();
      for (const k of [-1, 0, 1]) {
        ctx.moveTo(tx + k * s * 0.3 - s * 0.12, ty + s * 0.12);
        ctx.lineTo(tx + k * s * 0.3, ty - s * (k ? 0.18 : 0.26));
        ctx.lineTo(tx + k * s * 0.3 + s * 0.12, ty + s * 0.12);
      }
      P.fillShape(c.hairColor, ty - s * 0.26, ty + s * 0.12);
      break;
    case "wave":
    case "bob": {
      // A sprout: two leaves on a stem.
      P.strokeLimb(mixHex(c.hairColor, "#000000", 0.2), H * 0.01, () => {
        ctx.beginPath();
        ctx.moveTo(tx, ty + H * 0.01);
        ctx.lineTo(tx, ty - s * 0.16);
      }, true);
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(tx + k * s * 0.13, ty - s * 0.22, s * 0.15, s * 0.07, k * -0.5, 0, TAU);
        P.fillShape(c.hairColor, ty - s * 0.3, ty - s * 0.14);
      }
      break;
    }
    case "afro":
      ctx.beginPath();
      for (const k of [-2, -1, 0, 1, 2]) {
        ctx.moveTo(tx + k * s * 0.22 + s * 0.2, ty + s * 0.05);
        ctx.arc(tx + k * s * 0.22, ty + s * 0.05 - (2 - Math.abs(k)) * s * 0.05, s * 0.2, 0, TAU);
      }
      P.fillShape(c.hairColor, ty - s * 0.3, ty + s * 0.2);
      break;
    case "beanie":
      ctx.beginPath();
      ctx.arc(tx, ty + s * 0.3, s * 0.62, Math.PI * 1.12, Math.PI * 1.88);
      ctx.closePath();
      P.fillShape(c.patternColor, ty - s * 0.3, ty + s * 0.1);
      ctx.beginPath();
      ctx.arc(tx, ty - s * 0.38, s * 0.12, 0, TAU);
      P.fillShape(c.patternColor, ty - s * 0.5, ty - s * 0.26);
      break;
  }
  // Big eyes.
  const eyeY = topY + bh * 0.34;
  const er = clamp(bw * 0.1, H * 0.02, H * 0.06);
  const sp = bw * 0.19;
  const lk = (pose.look ?? 0) * er * 0.35;
  const blink = clamp(pose.blink ?? 0);
  for (const k of [-1, 1]) {
    const ex = x + k * sp;
    if (c.eyes === "lines" || blink > 0.6) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, er * 0.3);
      ctx.beginPath();
      ctx.arc(ex + lk, eyeY + er * 0.2, er * 0.6, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else if (c.eyes === "ovals") {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(ex + lk, eyeY, er * 0.5, er * 0.75 * (1 - blink), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex + lk - er * 0.15, eyeY - er * 0.3, er * 0.16, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, er, er * 1.12 * (1 - blink * 0.9), 0, 0, TAU);
      ctx.fill();
      if (P.inked) P.inkStroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + lk * 1.4, eyeY + er * 0.12, er * 0.55 * (1 - blink * 0.9), 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex + lk * 1.4 - er * 0.2, eyeY - er * 0.12, er * 0.17, 0, TAU);
      ctx.fill();
    }
    if (c.glasses) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.2, er * 0.18);
      ctx.beginPath();
      ctx.arc(ex, eyeY, er * 1.4, 0, TAU);
      ctx.stroke();
    }
    if (c.cheeks) {
      ctx.fillStyle = "rgba(255,110,120,0.35)";
      ctx.beginPath();
      ctx.ellipse(ex + k * er * 0.9, eyeY + er * 1.6, er * 0.5, er * 0.3, 0, 0, TAU);
      ctx.fill();
    }
  }
  if (c.glasses) {
    ctx.beginPath();
    ctx.moveTo(x - sp + er * 1.4, eyeY);
    ctx.lineTo(x + sp - er * 1.4, eyeY);
    ctx.stroke();
  }
  drawMouth(ctx, x + lk, eyeY + er * 2.1, er * 1.9, pose.mouth ?? "smile");
  ctx.restore();
  const headR = bw * 0.42;
  return { head: { x, y: eyeY, r: headR }, top: topY - (c.hair === "none" ? 0 : s * 0.4), ...hands(x, pose.flip, l, r) };
}

/* ───────────────────────── Stick figure ───────────────────────── */

export function drawStick(ctx: CanvasRenderingContext2D, x: number, groundY: number, H: number, c: CastMember, pose: AbsPose): AbsRig {
  // A true stick figure: one line colour, a round head with a simple line face, no hair, clothes or fills.
  const P = painter(ctx, H, c.art ?? "flat");
  const lift = (pose.lift ?? 0) * H;
  const lw = Math.max(2, H * 0.02);
  const legLen = c.legLen * 1.0 * H;
  const bodyLen = c.bodyH * 0.85 * H;
  const hr = c.headR * 1.15 * H;
  const hipY = groundY - legLen - lift;
  const neckY = hipY - bodyLen;
  const headY = neckY - hr - lw * 0.5;
  const lc = c.legColor;
  beginFigure(ctx, x, groundY, H, pose, H * 0.08);
  const line = (trace: () => void) => P.strokeLimb(lc, lw, trace, true);
  // Legs with knees.
  for (const s of [-1, 1]) {
    if (pose.sit !== undefined) {
      const L = sitLeg(s, x, hipY, groundY, H, pose.sit);
      line(() => {
        ctx.beginPath();
        ctx.moveTo(x, hipY);
        ctx.lineTo(L.knee.x, L.knee.y);
        ctx.lineTo(L.foot.x, L.foot.y - lw * 0.5);
      });
      continue;
    }
    const { swing, raise } = stride(pose.walk, s, legLen);
    const fx = x + s * H * 0.06 + swing;
    const fy = groundY - raise - lift;
    const kx = lerp(x, fx, 0.5) + (pose.walk !== undefined ? H * 0.025 + raise * 0.4 : s * H * 0.01);
    const ky = lerp(hipY, fy, 0.5) - raise * 0.25;
    line(() => {
      ctx.beginPath();
      ctx.moveTo(x, hipY);
      ctx.lineTo(kx, ky);
      ctx.lineTo(fx, fy - lw * 0.5);
    });
  }
  // The spine.
  line(() => {
    ctx.beginPath();
    ctx.moveTo(x, neckY);
    ctx.lineTo(x, hipY);
  });
  // Arms with elbows.
  const shY = neckY + bodyLen * 0.16;
  const armLen = H * 0.27;
  const arm = (s: number): Pt => {
    const a = s < 0 ? pose.armL : pose.armR;
    const curl = (s < 0 ? pose.curlL : pose.curlR) ?? 0.3;
    // A raised arm keeps its upper half out to the side (the forearm does the reaching), so it
    // never crosses the big head.
    const ua = a > 1.8 ? 1.8 : a;
    const fa = a > 1.8 ? a + (a - 1.8) * 0.6 : a;
    const elx = x + s * Math.sin(ua) * armLen * 0.52 + (a > 1.8 ? 0 : s * Math.cos(a) * armLen * 0.12 * curl);
    const ely = shY + Math.cos(ua) * armLen * 0.52 - (a > 1.8 ? 0 : Math.sin(a) * armLen * 0.12 * curl);
    const ex = elx + s * Math.sin(fa) * armLen * 0.48;
    const ey = ely + Math.cos(fa) * armLen * 0.48;
    line(() => {
      ctx.beginPath();
      ctx.moveTo(x, shY);
      ctx.lineTo(elx, ely);
      ctx.lineTo(ex, ey);
    });
    return { x: ex, y: ey };
  };
  const l = arm(-1);
  const r = arm(1);
  // The head: an empty circle with a line-drawn face (dot eyes that blink and look, a mouth that
  // smiles, talks, frowns or gasps), all in the same line colour.
  line(() => {
    ctx.beginPath();
    ctx.arc(x, headY, hr, 0, TAU);
  });
  const lk = (pose.look ?? 0) * hr * 0.18;
  const blink = clamp(pose.blink ?? 0);
  const ey = headY - hr * 0.08;
  ctx.fillStyle = lc;
  ctx.strokeStyle = lc;
  ctx.lineCap = "round";
  ctx.lineWidth = lw * 0.75;
  for (const k of [-1, 1]) {
    const ex = x + k * hr * 0.34 + lk;
    if (blink > 0.6) {
      ctx.beginPath();
      ctx.moveTo(ex - hr * 0.1, ey);
      ctx.lineTo(ex + hr * 0.1, ey);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(ex, ey, hr * 0.085, hr * 0.11 * (1 - blink), 0, 0, TAU);
      ctx.fill();
    }
  }
  const my = headY + hr * 0.38;
  const mx = x + lk;
  ctx.beginPath();
  switch (pose.mouth ?? "smile") {
    case "open":
      ctx.moveTo(mx - hr * 0.28, my - hr * 0.04);
      ctx.quadraticCurveTo(mx, my + hr * 0.4, mx + hr * 0.28, my - hr * 0.04);
      ctx.closePath();
      ctx.fill();
      break;
    case "o":
      ctx.arc(mx, my + hr * 0.04, hr * 0.09, 0, TAU);
      ctx.stroke();
      break;
    case "flat":
      ctx.moveTo(mx - hr * 0.18, my + hr * 0.04);
      ctx.lineTo(mx + hr * 0.18, my + hr * 0.04);
      ctx.stroke();
      break;
    default:
      ctx.moveTo(mx - hr * 0.26, my - hr * 0.02);
      ctx.quadraticCurveTo(mx, my + hr * 0.26, mx + hr * 0.26, my - hr * 0.02);
      ctx.stroke();
  }
  ctx.restore();
  return { head: { x, y: headY, r: hr }, top: headY - hr - lw, ...hands(x, pose.flip, l, r) };
}

/* ───────────────────────── Classic rubber hose ───────────────────────── */

export function drawClassic(ctx: CanvasRenderingContext2D, x: number, groundY: number, H: number, c: CastMember, pose: AbsPose): AbsRig {
  const P = painter(ctx, H, c.art ?? "flat");
  const lift = (pose.lift ?? 0) * H;
  const hr = c.headR * 1.25 * H;
  const bw = c.bodyW * 0.95 * H;
  const bh = c.bodyH * 0.8 * H;
  const legLen = c.legLen * 0.85 * H;
  const hipY = groundY - legLen - lift;
  const top = hipY - bh;
  const headY = top - hr * 0.72;
  const hose = "#1d1b26";
  const lw = H * 0.024;
  beginFigure(ctx, x, groundY, H, pose, bw * 0.6);
  // Rubber-hose legs and big shoes.
  for (const s of [-1, 1]) {
    const hx = x + s * bw * 0.2;
    const L = pose.sit !== undefined ? sitLeg(s, x, hipY, groundY, H, pose.sit) : undefined;
    const { swing, raise } = stride(L ? undefined : pose.walk, s, legLen);
    const fx = L ? L.foot.x : hx + swing + s * H * 0.01;
    const fy = groundY - raise - lift;
    const toe = L ? 1 : s;
    P.strokeLimb(hose, lw, () => {
      ctx.beginPath();
      ctx.moveTo(hx, hipY - H * 0.01);
      if (L) ctx.quadraticCurveTo(L.bend.x, L.bend.y, fx, fy - H * 0.03);
      else ctx.quadraticCurveTo(lerp(hx, fx, 0.5) + s * H * 0.035, lerp(hipY, fy, 0.5), fx, fy - H * 0.03);
    }, true);
    ctx.beginPath();
    ctx.ellipse(fx + toe * H * 0.03, fy - H * 0.026, H * 0.072, H * 0.034, toe * -0.08, 0, TAU);
    P.fillShape(c.shoe, fy - H * 0.06, fy);
    if (!P.inked) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(fx + toe * H * 0.045, fy - H * 0.04, H * 0.022, H * 0.009, toe * -0.2, 0, TAU);
      ctx.fill();
    }
  }
  // A pear-shaped body: shirt above, shorts with two buttons below.
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(x - bw * 0.3, top);
    ctx.quadraticCurveTo(x, top - bw * 0.1, x + bw * 0.3, top);
    ctx.bezierCurveTo(x + bw * 0.55, top + bh * 0.4, x + bw * 0.6, hipY - bh * 0.05, x + bw * 0.4, hipY);
    ctx.quadraticCurveTo(x, hipY + bh * 0.14, x - bw * 0.4, hipY);
    ctx.bezierCurveTo(x - bw * 0.6, hipY - bh * 0.05, x - bw * 0.55, top + bh * 0.4, x - bw * 0.3, top);
  };
  body();
  P.fillShape(c.bodyColor, top, hipY, false);
  const shortsY = hipY - bh * 0.42;
  ctx.save();
  body();
  ctx.clip();
  ctx.fillStyle = P.tint(c.patternColor);
  ctx.fillRect(x - bw, shortsY, bw * 2, bh);
  ctx.restore();
  if (P.inked) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = P.inkW;
    ctx.beginPath();
    ctx.moveTo(x - bw * 0.52, shortsY);
    ctx.lineTo(x + bw * 0.52, shortsY);
    ctx.stroke();
  }
  sideShade(ctx, P, body, x, bw, H);
  if (P.inked) {
    body();
    P.inkStroke();
  }
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * bw * 0.16, shortsY + bh * 0.13, bw * 0.06, bw * 0.08, 0, 0, TAU);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, H * 0.004);
    ctx.stroke();
  }
  // Rubber-hose arms with white gloves.
  const shY = top + bh * 0.2;
  const armLen = H * 0.27;
  const arm = (s: number): Pt => {
    const a = s < 0 ? pose.armL : pose.armR;
    const curl = (s < 0 ? pose.curlL : pose.curlR) ?? 0.3;
    const sx = x + s * bw * 0.36;
    const ex = sx + s * Math.sin(a) * armLen;
    const ey = shY + Math.cos(a) * armLen;
    P.strokeLimb(hose, lw * 0.92, () => {
      ctx.beginPath();
      ctx.moveTo(sx, shY);
      ctx.quadraticCurveTo((sx + ex) / 2 + s * Math.cos(a) * armLen * 0.35 * (curl + 0.3), (shY + ey) / 2 - Math.sin(a) * armLen * 0.35 * (curl + 0.3), ex, ey);
    }, true);
    // The glove: a cuff and a puffy mitten with finger lines.
    const gx = ex + s * Math.sin(a) * H * 0.03;
    const gy = ey + Math.cos(a) * H * 0.03;
    ctx.beginPath();
    ctx.ellipse(ex, ey, H * 0.024, H * 0.016, a * s + Math.PI / 2, 0, TAU);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, H * 0.005);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(gx, gy, H * 0.042, 0, TAU);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (const k of [-1, 1]) {
      ctx.moveTo(gx + k * H * 0.011, gy - H * 0.004);
      ctx.lineTo(gx + k * H * 0.011 + s * Math.sin(a) * H * 0.022, gy - H * 0.004 + Math.cos(a) * H * 0.022);
    }
    ctx.stroke();
    return { x: gx, y: gy };
  };
  const l = arm(-1);
  const r = arm(1);
  // Head and hair, then the classic face: pie-cut eyes, a button nose, a wide smile.
  drawHeadHair(ctx, P, x, headY, hr, c);
  const lk = (pose.look ?? 0) * hr * 0.12;
  const blink = clamp(pose.blink ?? 0);
  const eyeY = headY - hr * 0.05;
  for (const s of [-1, 1]) {
    const ex = x + s * hr * 0.24 + lk;
    if (c.eyes === "lines" || blink > 0.6) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, hr * 0.07);
      ctx.beginPath();
      ctx.arc(ex, eyeY + hr * 0.05, hr * 0.12, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      continue;
    }
    const rx = hr * 0.12;
    const ry = hr * 0.24 * (1 - blink);
    if (c.eyes === "ovals") {
      // Eye whites around the pupils.
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, rx * 1.6, ry * 1.25, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, hr * 0.04);
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(ex + lk * 0.5, eyeY + (c.eyes === "ovals" ? ry * 0.15 : 0), rx, ry, 0, 0, TAU);
    ctx.fill();
    // The pie cut.
    ctx.fillStyle = c.eyes === "ovals" ? "#ffffff" : c.skin;
    ctx.beginPath();
    ctx.moveTo(ex + lk * 0.5 + rx * 0.1, eyeY - ry * 0.15);
    ctx.lineTo(ex + lk * 0.5 + rx * 1.2, eyeY - ry * 0.65);
    ctx.lineTo(ex + lk * 0.5 + rx * 1.2, eyeY - ry * 0.05);
    ctx.closePath();
    ctx.fill();
  }
  if (c.glasses) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.2, hr * 0.05);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + s * hr * 0.24 + lk, eyeY, hr * 0.26, 0, TAU);
      ctx.stroke();
    }
  }
  if (c.cheeks) {
    ctx.fillStyle = "rgba(255,110,120,0.32)";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + s * hr * 0.55 + lk, headY + hr * 0.38, hr * 0.14, hr * 0.09, 0, 0, TAU);
      ctx.fill();
    }
  }
  const ny = headY + hr * 0.24;
  ctx.fillStyle = c.nose ? INK : mixHex(c.skin, "#000000", 0.18);
  ctx.beginPath();
  ctx.ellipse(x + lk * 1.3, ny, hr * (c.nose ? 0.13 : 0.08), hr * (c.nose ? 0.09 : 0.06), 0, 0, TAU);
  ctx.fill();
  const my = headY + hr * 0.42;
  const mouth = pose.mouth ?? "smile";
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, hr * 0.06);
  if (mouth === "open") {
    ctx.beginPath();
    ctx.moveTo(x - hr * 0.38 + lk, my - hr * 0.04);
    ctx.quadraticCurveTo(x + lk, my + hr * 0.55, x + hr * 0.38 + lk, my - hr * 0.04);
    ctx.quadraticCurveTo(x + lk, my + hr * 0.08, x - hr * 0.38 + lk, my - hr * 0.04);
    ctx.fillStyle = "#3a1220";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff7a8a";
    ctx.beginPath();
    ctx.ellipse(x + lk, my + hr * 0.26, hr * 0.14, hr * 0.07, 0, 0, TAU);
    ctx.fill();
  } else if (mouth === "smile") {
    ctx.beginPath();
    ctx.moveTo(x - hr * 0.42 + lk, my - hr * 0.06);
    ctx.quadraticCurveTo(x + lk, my + hr * 0.36, x + hr * 0.42 + lk, my - hr * 0.06);
    ctx.stroke();
    // Smile creases.
    ctx.lineWidth = Math.max(1, hr * 0.04);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * hr * 0.38 + lk, my - hr * 0.13);
      ctx.lineTo(x + s * hr * 0.46 + lk, my + hr * 0.01);
      ctx.stroke();
    }
  } else drawMouth(ctx, x + lk, my, hr * 0.9, mouth);
  ctx.restore();
  return { head: { x, y: headY, r: hr }, top: headY - hr * hairTop(c), ...hands(x, pose.flip, l, r) };
}
