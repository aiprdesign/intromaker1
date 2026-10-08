/**
 * Abstract characters: a modern, minimal character library that invents its people. Every
 * character is generated from a seed: a body shape (pill, arch, bell, triangle, round or block)
 * with an optional pattern, a head shape, a hair style or hat, skin tones (natural, or now and then
 * a playful colour), bendy "noodle" arms and long legs with big shoes, and a minimal face (dot,
 * line or oval eyes, a simple mouth, sometimes glasses or blush). Proportions vary too (tall, short,
 * big-headed), so a crowd never repeats.
 *
 * The seed comes from the video and the slide, so the same video always shows the same people and
 * a remake meets new ones. Motion is bouncy: squash and stretch on landing, noodle arms that wave
 * and swing, little hops, blinking, a walk with a bob.
 *
 * Slides:
 * - abs-hello:    one character bounces in, waves and says the headline in a speech bubble.
 * - abs-crowd:    a crowd of different characters pops up under the headline, bobbing and waving.
 * - abs-features: a character per point holds up a sign with it, one after another.
 * - abs-parade:   characters walk across the frame in a line, the first ones carrying the points.
 * - abs-chat:     two characters talk: the lines as an alternating conversation.
 * - abs-cheer:    a crowd jumps and cheers around the call-to-action button.
 */
import { BODIES, HAIR_STYLES, HAIRS, introColors, matchColors, NEUTRALS, PLAYFUL_SKINS, SKINS } from "../cast";
import { solid } from "./solid";
import { clamp, ease, hashString, lerp, mixHex, rgba, rng, TAU } from "../math";
import { saasBackground, saasFont, spring } from "../saasfx";
import { displayFont, fillTextFit, subFont } from "../text";
import type { ArtStyle, CastMember, CharacterKind, Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { exitOf, itemsOr, split, stage } from "./beats";
import { drawFace, drawHeadHair, painter, sitLeg } from "./abspaint";
import { drawBlob, drawClassic, drawMemphis, drawStick } from "./abskinds";
import { blinkAt, fitBubble, pointTimes, pop, speech, useToon } from "./characters";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const plain = (s: string) => s.replace(/\*/g, "").trim();

/* ───────────────────────── The generator ───────────────────────── */

/** A character's design (the same shape the character designer edits). */
export type AbsSpec = CastMember;
type Hair = AbsSpec["hair"];

/** A new character of a `kind` from a seed, dressed in the video's own colours. */
export function makeCharacter(seed: number, p: Palette, kind: CharacterKind = "abstract"): AbsSpec {
  const c = makeBase(seed, p, kind);
  // Now and then a wheelchair user (from a seed of its own, so the rest of the design holds).
  return kind !== "blob" && rng(hashString(`wheels:${seed}`))() < 0.12 ? { ...c, wheelchair: true } : c;
}

function makeBase(seed: number, p: Palette, kind: CharacterKind): AbsSpec {
  const r = rng(hashString(`abs:${seed}`));
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length) % xs.length];
  // Dressed in the intro's own colours (and neutrals for trousers and shoes).
  const colors = introColors(p);
  const bodyColor = pick(colors);
  let patternColor = pick(colors);
  if (patternColor === bodyColor) patternColor = mixHex(bodyColor, "#ffffff", 0.45);
  const skin = r() < 0.18 ? pick(PLAYFUL_SKINS) : pick(SKINS);
  const tall = r();
  const lineColor = p.light ? NEUTRALS[1] : NEUTRALS[3];
  const c: AbsSpec = {
    body: pick(BODIES),
    bodyW: 0.24 + r() * 0.16,
    bodyH: 0.3 + r() * 0.14,
    bodyColor,
    pattern: pick(["none", "none", "stripes", "dots", "half"] as const),
    patternColor,
    head: pick(["circle", "circle", "oval", "squircle"] as const),
    headR: 0.085 + r() * 0.05,
    neck: r() * 0.035,
    skin,
    hair: pick(HAIR_STYLES),
    hairColor: r() < 0.85 ? pick(HAIRS.slice(0, 5)) : pick(colors),
    legLen: 0.22 + tall * 0.18,
    legColor: r() < 0.55 ? lineColor : mixHex(pick(colors), "#000000", 0.2),
    shoe: r() < 0.6 ? NEUTRALS[0] : pick(colors),
    armColor: r() < 0.5 ? skin : bodyColor,
    eyes: pick(["dots", "dots", "lines", "ovals"] as const),
    glasses: r() < 0.18,
    cheeks: r() < 0.55,
    nose: r() < 0.4,
  };
  switch (kind) {
    case "memphis": {
      // Playful skin tones are the look; mostly bare arms with big hands; trousers in a deep colour.
      const mskin = r() < 0.6 ? pick([...PLAYFUL_SKINS, mixHex(pick(colors), "#ffffff", 0.35)]) : skin;
      return { ...c, kind, skin: mskin, armColor: r() < 0.7 ? mskin : bodyColor, legColor: mixHex(pick(colors), "#000000", 0.35), pattern: pick(["none", "none", "none", "stripes", "half"] as const), eyes: "dots", nose: false };
    }
    case "blob":
      return { ...c, kind, armColor: bodyColor, legColor: mixHex(bodyColor, "#000000", 0.2), shoe: mixHex(bodyColor, "#000000", 0.35), pattern: pick(["none", "half", "half", "dots"] as const), hair: pick(["none", "cap", "bun", "spikes", "wave", "afro", "beanie"] as const), eyes: pick(["dots", "dots", "dots", "ovals", "lines"] as const), cheeks: r() < 0.75, glasses: r() < 0.1 };
    case "stick":
      return { ...c, kind, legColor: lineColor, body: pick(["pill", "pill", "block", "triangle"] as const), pattern: pick(["none", "stripes", "dots", "half", "half"] as const), head: "circle", glasses: r() < 0.15, cheeks: r() < 0.8, eyes: pick(["dots", "dots", "ovals"] as const) };
    case "classic":
      return { ...c, kind, head: "circle", shoe: pick(["#8a4b2a", "#c0392b", "#1d1b26", "#f1c40f"]), hair: pick(["none", "cap", "cap", "bun", "wave"] as const), hairColor: pick(HAIRS.slice(0, 5)), eyes: pick(["dots", "dots", "ovals"] as const), nose: r() < 0.7, glasses: r() < 0.1, legColor: "#1d1b26", armColor: "#1d1b26" };
    default:
      return c;
  }
}

/** The character in a slide's `slot`: the video's own cast first (from the character designer), then generated people. */
export function person(sc: SkillContext, slot: number, seed: number): AbsSpec {
  const own = sc.cast?.[slot];
  // Characters you picked for the style win: your designed cast is drawn as that kind too (keeping
  // its colours and features), and everyone else is generated in it.
  const picked = sc.characters;
  // Your characters wear the intro's colours unless you gave them their own.
  if (own) {
    const c = matchColors(own, sc.palette, slot);
    return picked ? { ...c, kind: picked === "abstract" ? undefined : picked } : c;
  }
  // Generated people match the cast's lead in drawing style, else the style's own look…
  const art = (picked ? undefined : sc.cast?.[0]?.art) ?? sc.look?.art ?? TOON_ART[sc.look?.toon ?? "flat"];
  // …and the lead's kind (or the style's).
  const kind = picked ?? (sc.cast?.length ? (sc.cast[0].kind ?? "abstract") : (sc.look?.people ?? "abstract"));
  const c = makeCharacter(seed, sc.palette, kind);
  return art === "flat" ? c : { ...c, art };
}
const TOON_ART: Record<NonNullable<NonNullable<SkillContext["look"]>["toon"]>, ArtStyle> = { flat: "flat", comic: "outline", soft: "soft", doodle: "line" };

/** A slot order for a row of `n`: from the middle outwards, so a custom cast stands front and centre. */
function middleOut(i: number, n: number) {
  const mid = (n - 1) / 2;
  return [...Array(n).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b).indexOf(i);
}

const KIND_DRAW: Record<Exclude<CharacterKind, "abstract">, typeof drawMemphis> = { memphis: drawMemphis, blob: drawBlob, stick: drawStick, classic: drawClassic };

export interface AbsPose {
  /** Arm angles from hanging down (radians, positive = out and up on that side). */
  armL: number;
  armR: number;
  /** Extra bend of the noodle (−1 … 1). */
  curlL?: number;
  curlR?: number;
  /** Walk phase (radians); undefined = standing. */
  walk?: number;
  /** Squash (−) and stretch (+), around the feet. */
  squash?: number;
  lift?: number;
  lean?: number;
  mouth?: "smile" | "open" | "flat" | "o";
  blink?: number;
  look?: number;
  /** Mirror (face left). */
  flip?: boolean;
  /** Seated (a wheelchair user): the thigh length, in character heights. Set by drawAbstract for `wheelchair` characters. */
  sit?: number;
}

export interface AbsRig {
  head: { x: number; y: number; r: number };
  top: number;
  handL: { x: number; y: number };
  handR: { x: number; y: number };
}

/** Draw a generated character standing on `groundY` at `x`, `H` tall (a unit; shapes vary). */
/** Draw the character; while fading it fades as one solid piece (see solid.ts). */
export function drawAbstract(ctx: CanvasRenderingContext2D, x: number, groundY: number, H: number, c: AbsSpec, pose: AbsPose): AbsRig {
  return solid(ctx, (c2) => (c.wheelchair && c.kind !== "blob" ? drawSeated(c2, x, groundY, H, c, pose) : drawAbstractRaw(c2, x, groundY, H, c, pose)));
}

/** How long each kind draws its legs, for `legLen` (see the drawers). */
const LEG_K: Record<CharacterKind, number> = { abstract: 1, memphis: 1.2, stick: 1, classic: 0.85, blob: 0.32 };

/**
 * A wheelchair user: the character seated (thighs forward, feet on the footrest) in a side-on
 * chair with a big wheel that turns as they move (the walk phase rolls it), a backrest with push
 * handles, a cushion and a little front caster. Drawn in the character's own drawing style; a stick
 * figure's chair is line art in its line colour.
 */
function drawSeated(ctx: CanvasRenderingContext2D, x: number, groundY: number, H: number, c: AbsSpec, pose: AbsPose): AbsRig {
  const kind = c.kind ?? "abstract";
  const seated: AbsSpec = { ...c, legLen: 0.11 + c.legLen * 0.22 };
  const thigh = kind === "memphis" ? 0.22 : kind === "stick" ? 0.18 : 0.2;
  const footY = groundY - H * 0.05;
  const hipY = footY - seated.legLen * LEG_K[kind] * H;
  const seatY = hipY + H * 0.014;
  const dir = pose.flip ? -1 : 1;
  const X = (v: number) => x + dir * v * H;
  const bodyHalf = kind === "stick" ? 0.03 : c.bodyW * (kind === "memphis" ? 0.47 : 0.5);
  const back = -Math.max(0.09, bodyHalf * 0.85);
  const R = (groundY - seatY) * 0.52;
  const wx = X(-0.04);
  const wy = groundY - R;
  const stick = kind === "stick";
  const P = painter(ctx, H, c.art ?? "flat");
  const frame = stick ? c.legColor : "#3d4154";
  const lw = stick ? Math.max(2, H * 0.02) : Math.max(2, H * 0.016);
  const bar = (trace: () => void, col = frame, w = lw) => P.strokeLimb(col, w, trace, stick);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // The chair's shadow.
  ctx.fillStyle = "rgba(20,10,40,0.16)";
  ctx.beginPath();
  ctx.ellipse(x + dir * H * 0.04, groundY + H * 0.008, H * 0.2, H * 0.022, 0, 0, TAU);
  ctx.fill();
  // Backrest with a push handle, the seat, and the frame down to the footrest.
  const topY = hipY - H * (stick ? 0.16 : 0.2);
  bar(() => {
    ctx.beginPath();
    ctx.moveTo(X(back + 0.01), seatY);
    ctx.lineTo(X(back), topY);
    ctx.lineTo(X(back - 0.05), topY - H * 0.004);
  });
  if (!stick) {
    ctx.beginPath();
    ctx.roundRect(Math.min(X(back - 0.012), X(back + 0.03)), topY + H * 0.02, H * 0.042, seatY - topY - H * 0.03, H * 0.012);
    P.fillShape(mixHex(c.patternColor, "#000000", 0.25), topY, seatY);
  }
  bar(() => {
    ctx.beginPath();
    ctx.moveTo(X(thigh - 0.02), seatY + H * 0.02);
    ctx.lineTo(X(thigh + 0.03), footY);
    ctx.lineTo(X(thigh + 0.1), footY);
  });
  // The seat cushion, then the seated character, then the near wheel over the hips.
  if (stick) {
    bar(() => {
      ctx.beginPath();
      ctx.moveTo(X(back + 0.01), seatY + lw);
      ctx.lineTo(X(thigh), seatY + lw);
    });
  } else {
    ctx.beginPath();
    ctx.roundRect(Math.min(X(back), X(thigh)), seatY, Math.abs(X(thigh) - X(back)), H * 0.03, H * 0.012);
    P.fillShape(c.patternColor, seatY, seatY + H * 0.03);
  }
  const rig = drawAbstractRaw(ctx, x, footY, H, seated, { ...pose, walk: undefined, lift: 0, squash: 0, sit: thigh });
  // The big wheel: a tyre, a push rim and spokes that roll with the walk.
  const spin = dir * (pose.walk ?? 0) * 0.55;
  if (!stick) {
    ctx.beginPath();
    ctx.arc(wx, wy, R, 0, TAU);
    ctx.arc(wx, wy, R * 0.8, 0, TAU, true);
    P.fillShape("#26282f", wy - R, wy + R);
  }
  bar(() => {
    ctx.beginPath();
    ctx.arc(wx, wy, stick ? R : R * 0.68, 0, TAU);
  }, stick ? frame : "#b8bfcc", stick ? lw : Math.max(1.5, H * 0.01));
  bar(() => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * Math.PI) / 3;
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(a) * R * (stick ? 0.92 : 0.8), wy + Math.sin(a) * R * (stick ? 0.92 : 0.8));
    }
  }, stick ? frame : "#9aa3b2", stick ? lw * 0.6 : Math.max(1, H * 0.006));
  ctx.beginPath();
  ctx.arc(wx, wy, H * 0.016, 0, TAU);
  P.fillShape(stick ? frame : c.bodyColor, wy - H * 0.016, wy + H * 0.016);
  // The front caster on its fork.
  const cr = H * 0.028;
  const cx = X(thigh + 0.02);
  bar(() => {
    ctx.beginPath();
    ctx.moveTo(X(thigh - 0.005), seatY + H * 0.03);
    ctx.lineTo(cx, groundY - cr);
  });
  if (stick) {
    bar(() => {
      ctx.beginPath();
      ctx.arc(cx, groundY - cr, cr, 0, TAU);
    });
  } else {
    ctx.beginPath();
    ctx.arc(cx, groundY - cr, cr, 0, TAU);
    P.fillShape("#26282f", groundY - cr * 2, groundY);
  }
  ctx.restore();
  return rig;
}

function drawAbstractRaw(ctx: CanvasRenderingContext2D, x: number, groundY: number, H: number, c: AbsSpec, pose: AbsPose): AbsRig {
  // The other kinds of character (abskinds.ts) take the same design and pose.
  if (c.kind && c.kind !== "abstract") return KIND_DRAW[c.kind](ctx, x, groundY, H, c, pose);
  const legLen = c.legLen * H;
  const bw = c.bodyW * H;
  const bh = c.bodyH * H;
  const hr = c.headR * H;
  const lift = (pose.lift ?? 0) * H;
  const sq = pose.squash ?? 0;
  const hipY = groundY - legLen - lift;
  const top = hipY - bh;
  const headY = top - c.neck * H - hr * 0.85;
  const out: AbsRig = { head: { x, y: headY, r: hr }, top: headY - hr * (c.hair === "spikes" || c.hair === "bun" || c.hair === "beanie" ? 1.5 : 1.15), handL: { x, y: 0 }, handR: { x, y: 0 } };
  ctx.save();
  // Ground shadow (stays on the ground when hopping; seated, the chair casts it).
  if (pose.sit === undefined) {
    ctx.fillStyle = `rgba(20,10,40,${0.16 * clamp(1 - lift / (H * 0.3))})`;
    ctx.beginPath();
    ctx.ellipse(x, groundY + H * 0.008, bw * 0.55, H * 0.022, 0, 0, TAU);
    ctx.fill();
  }
  // Squash and stretch around the feet, and a lean.
  ctx.translate(x, groundY);
  ctx.scale(1 - sq * 0.6, 1 + sq);
  ctx.rotate(pose.lean ?? 0);
  if (pose.flip) ctx.scale(-1, 1);
  ctx.translate(-x, -groundY);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // The drawing style: how shapes are filled and limbs stroked (see ART_STYLES).
  const art = c.art ?? "flat";
  const P = painter(ctx, H, art);
  const { inked, tint, inkStroke, fillShape, strokeLimb } = P;
  // Legs: thin noodles with big shoes; a walk swings them.
  const lw = Math.max(2, H * 0.024);
  for (const s of [-1, 1]) {
    const hx = x + s * bw * 0.18;
    if (pose.sit !== undefined) {
      const L = sitLeg(s, x, hipY, groundY, H, pose.sit);
      strokeLimb(c.legColor, lw, () => {
        ctx.beginPath();
        ctx.moveTo(hx, hipY - H * 0.01);
        ctx.quadraticCurveTo(L.bend.x, L.bend.y, L.foot.x, L.foot.y - H * 0.012);
      });
      ctx.beginPath();
      ctx.ellipse(L.foot.x + H * 0.022, L.foot.y - H * 0.008, H * 0.045, H * 0.02, 0, 0, TAU);
      fillShape(c.shoe, L.foot.y - H * 0.03, L.foot.y + H * 0.012);
      continue;
    }
    const ph = pose.walk !== undefined ? pose.walk + (s > 0 ? Math.PI : 0) : 0;
    const swing = pose.walk !== undefined ? Math.sin(ph) * legLen * 0.45 : 0;
    const raise = pose.walk !== undefined ? Math.max(0, Math.cos(ph)) * legLen * 0.18 : 0;
    const fx = hx + swing;
    const fy = groundY - raise - lift * 0;
    strokeLimb(c.legColor, lw, () => {
      ctx.beginPath();
      ctx.moveTo(hx, hipY - H * 0.01);
      ctx.quadraticCurveTo(hx + swing * 0.3 + s * H * 0.01, lerp(hipY, fy, 0.55) - raise * 0.3, fx, fy - lift - H * 0.012);
    });
    ctx.beginPath();
    ctx.ellipse(fx + H * 0.022, fy - lift - H * 0.008, H * 0.045, H * 0.02, 0, 0, TAU);
    fillShape(c.shoe, fy - lift - H * 0.03, fy - lift + H * 0.012);
  }
  // Body shape.
  const bodyPath = () => {
    ctx.beginPath();
    const l = x - bw / 2;
    switch (c.body) {
      case "pill":
        ctx.roundRect(l, top, bw, bh, bw / 2);
        break;
      case "arch":
        ctx.moveTo(l, hipY);
        ctx.lineTo(l, top + bw / 2);
        ctx.arc(x, top + bw / 2, bw / 2, Math.PI, 0);
        ctx.lineTo(l + bw, hipY);
        ctx.closePath();
        break;
      case "bell":
        ctx.moveTo(x - bw * 0.28, top);
        ctx.quadraticCurveTo(x, top - bw * 0.12, x + bw * 0.28, top);
        ctx.bezierCurveTo(x + bw * 0.32, top + bh * 0.5, x + bw * 0.56, hipY - bh * 0.2, x + bw * 0.56, hipY);
        ctx.lineTo(x - bw * 0.56, hipY);
        ctx.bezierCurveTo(x - bw * 0.56, hipY - bh * 0.2, x - bw * 0.32, top + bh * 0.5, x - bw * 0.28, top);
        ctx.closePath();
        break;
      case "triangle":
        ctx.moveTo(x, top - bh * 0.04);
        ctx.quadraticCurveTo(x + bw * 0.12, top, x + bw * 0.58, hipY - H * 0.01);
        ctx.quadraticCurveTo(x + bw * 0.6, hipY + H * 0.01, x + bw * 0.5, hipY + H * 0.01);
        ctx.lineTo(x - bw * 0.5, hipY + H * 0.01);
        ctx.quadraticCurveTo(x - bw * 0.6, hipY + H * 0.01, x - bw * 0.58, hipY - H * 0.01);
        ctx.quadraticCurveTo(x - bw * 0.12, top, x, top - bh * 0.04);
        ctx.closePath();
        break;
      case "round":
        ctx.ellipse(x, top + bh / 2, bw * 0.56, bh / 2, 0, 0, TAU);
        break;
      default:
        ctx.roundRect(l, top, bw, bh, bw * 0.18);
    }
  };
  // Arms come from the body's sides, behind it at the top.
  const shoulderY = top + bh * 0.18;
  const widthAt = (y: number) => {
    const k = clamp((y - top) / bh);
    switch (c.body) {
      case "bell":
        return lerp(bw * 0.28, bw * 0.56, k * k);
      case "triangle":
        return lerp(bw * 0.08, bw * 0.58, k);
      case "round":
        return bw * 0.56 * Math.sqrt(Math.max(0, 1 - Math.pow((k - 0.5) * 2, 2)));
      case "arch":
        return k * bh < bw / 2 ? Math.sqrt(Math.max(0, Math.pow(bw / 2, 2) - Math.pow(bw / 2 - k * bh, 2))) : bw / 2;
      default:
        return bw / 2;
    }
  };
  const armLen = H * 0.24;
  const drawArm = (s: number) => {
    const a = s < 0 ? pose.armL : pose.armR;
    const curl = (s < 0 ? pose.curlL : pose.curlR) ?? 0.3;
    const sx = x + s * Math.max(bw * 0.12, widthAt(shoulderY) * 0.9);
    const sy = shoulderY;
    const ex = sx + s * Math.sin(a) * armLen;
    const ey = sy + Math.cos(a) * armLen;
    // The noodle bows sideways (perpendicular to the arm).
    const mx = (sx + ex) / 2 + s * Math.cos(a) * armLen * 0.28 * curl;
    const my = (sy + ey) / 2 - Math.sin(a) * armLen * 0.28 * curl;
    strokeLimb(c.armColor, Math.max(2, H * 0.022), () => {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
    });
    ctx.beginPath();
    ctx.arc(ex, ey, H * 0.024, 0, TAU);
    fillShape(c.skin, ey - H * 0.024, ey + H * 0.024);
    return { x: ex, y: ey };
  };
  const handL = drawArm(-1);
  const handR = drawArm(1);
  out.handL = pose.flip ? { x: 2 * x - handR.x, y: handR.y } : handL;
  out.handR = pose.flip ? { x: 2 * x - handL.x, y: handL.y } : handR;
  bodyPath();
  fillShape(c.bodyColor, top, hipY, false);
  // Pattern.
  if (c.pattern !== "none") {
    ctx.save();
    bodyPath();
    ctx.clip();
    ctx.fillStyle = tint(c.patternColor);
    if (c.pattern === "stripes") {
      const step = bh / 5;
      for (let k = 1; k < 5; k += 2) ctx.fillRect(x - bw, top + k * step, bw * 2, step * 0.55);
    } else if (c.pattern === "dots") {
      const step = bw / 4;
      for (let yy = top + step * 0.6; yy < hipY; yy += step) for (let xx = x - bw / 2 + step * 0.5 + ((Math.round((yy - top) / step) % 2) * step) / 2; xx < x + bw / 2; xx += step) {
        ctx.beginPath();
        ctx.arc(xx, yy, step * 0.16, 0, TAU);
        ctx.fill();
      }
    } else {
      ctx.fillRect(x - bw, top + bh * 0.55, bw * 2, bh);
    }
    ctx.restore();
  }
  // A soft shadow down one side, for a little depth (soft shading and line art have their own).
  if (art !== "soft" && art !== "line") {
    ctx.save();
    bodyPath();
    ctx.clip();
    ctx.fillStyle = "rgba(36,18,63,0.1)";
    ctx.fillRect(x + bw * 0.18, top - H, bw, H * 2);
    ctx.restore();
  }
  if (inked) {
    bodyPath();
    inkStroke();
  }
  // Neck.
  if (c.neck > 0.008) {
    strokeLimb(c.skin, Math.max(2, H * 0.03), () => {
      ctx.beginPath();
      ctx.moveTo(x, top + H * 0.01);
      ctx.lineTo(x, headY + hr * 0.6);
    });
  }
  drawHeadHair(ctx, P, x, headY, hr, c);
  drawFace(ctx, x, headY, hr, c, pose);
  ctx.restore();
  return out;
}

/* ───────────────────────── Motion helpers ───────────────────────── */

/** A pop-up entrance with a squash on landing (0 … 1 enter, squash amount). */
export function bounceIn(t: number, t0: number) {
  const k = clamp(spring(t - t0, 11, 6), 0, 1.15);
  const land = t - t0 - 0.28;
  const squash = land > 0 && land < 0.3 ? -Math.sin((land / 0.3) * Math.PI) * 0.12 : 0;
  return { k, squash };
}

/** A friendly idle: a little bob and an arm sway, different per character. */
export function idle(t: number, i: number) {
  const ph = t * 2.2 + i * 1.7;
  return { lift: Math.max(0, Math.sin(ph)) * 0.012, armL: 0.25 + Math.sin(ph + 1) * 0.08, armR: 0.25 + Math.sin(ph + 2) * 0.08, squash: Math.sin(ph * 2) * 0.012 };
}

/** A wave with the right arm, up and rocking. */
export const waveArm = (t: number, k: number) => lerp(0.25, 2.5 + Math.sin(t * 9) * 0.3, k);

/* ───────────────────────── Slides ───────────────────────── */

function absHello(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, seed } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.5 });
  const ex = exitOf(sc);
  const portrait = h > w;
  const H = portrait ? h * 0.42 : h * 0.62;
  const ground = portrait ? h * 0.92 : h * 0.92;
  const cx = portrait ? w / 2 : w * 0.28;
  const c = person(sc, 0, seed);
  const b = bounceIn(t, 0.1);
  const wk = ease.inOutCubic(clamp((t - 0.6) / 0.3)) * (1 - ease.inOutCubic(clamp((t - 2.6) / 0.3)));
  const id = idle(t, 0);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const rig = drawAbstract(ctx, cx, ground + (1 - Math.min(1, b.k)) * H, H, c, {
    armL: id.armL,
    armR: waveArm(t, wk),
    curlR: 0.5,
    lift: id.lift,
    squash: b.squash + id.squash,
    mouth: wk > 0.3 ? "open" : "smile",
    blink: blinkAt(t, 0.5),
    look: portrait ? 0 : 0.6,
  });
  const text = plain(scene.text) || "Hello!";
  const size = (portrait ? 62 : 70) * u;
  const bw = portrait ? w * 0.84 : w * 0.44;
  const area = portrait ? { x: (w - bw) / 2, y: h * 0.1, w: bw, h: Math.max(h * 0.12, rig.top - h * 0.1 - 40 * u) } : { x: w * 0.47, y: h * 0.12, w: bw, h: h * 0.5 };
  const tip = portrait ? { x: rig.head.x, y: rig.top - 10 * u } : { x: rig.head.x + rig.head.r * 1.15, y: rig.head.y + rig.head.r * 0.25 };
  const box = fitBubble(sc, text, tip, size, { area });
  const k = pop(t, 0.7);
  speech(sc, text, box, tip, size, k);
  if (scene.subtext) {
    ctx.globalAlpha = (1 - ex) * clamp((t - 1.1) / 0.4);
    ctx.fillStyle = rgba(palette.text, 0.78);
    ctx.font = subFont((portrait ? 30 : 32) * u, 500);
    ctx.textAlign = portrait ? "center" : "left";
    // Under the bubble; above it in vertical frames, where the head is just below.
    ctx.textBaseline = portrait ? "bottom" : "top";
    fillTextFit(ctx, plain(scene.subtext), portrait ? w / 2 : box.x + 8 * u, portrait ? box.y - 24 * u : box.y + box.h + 26 * u, bw - 16 * u, { maxLines: 2, lineHeight: 1.25 });
  }
  ctx.restore();
}

function absCrowd(sc: SkillContext) {
  const { ctx, t, u, palette, scene, seed } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.4 });
  const st = stage(sc);
  const { narrow, ex } = st;
  const room = st.bottom - st.top;
  const n = narrow ? 7 : 11;
  const back = Math.floor(n / 2);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Back row first (smaller, higher), then the front row.
  const people = Array.from({ length: n }, (_, i) => {
    const row = i < back ? 0 : 1;
    const k = row ? i - back : i;
    const count = row ? n - back : back;
    // Sized to their slot too, so a tall vertical frame doesn't blow the crowd up past its edges.
    const H = Math.min(room * (row ? 0.62 : 0.5), (st.width / count) * (row ? 2.3 : 2.1));
    const x = st.left + (st.width * (k + (row ? 0.5 : 1))) / (row ? count : count + 1);
    const ground = row ? st.bottom : st.bottom - H * 0.3;
    return { i, x, H, ground };
  });
  for (const p of people) {
    // The front row is cast first (from the middle), then the back.
    const row = p.i < back ? 0 : 1;
    const k = row ? p.i - back : p.i;
    const slot = row ? middleOut(k, n - back) : n - back + middleOut(k, back);
    const c = person(sc, slot, seed * 31 + p.i * 7 + 1);
    const b = bounceIn(t, 0.25 + ((p.i * 0.37) % 1) * 0.6);
    if (b.k <= 0) continue;
    const id = idle(t, p.i);
    const waves = (p.i * 5) % 7 === 2 ? ease.inOutCubic(clamp((t - 1.4 - (p.i % 3) * 0.4) / 0.3)) : 0;
    ctx.save();
    ctx.globalAlpha *= clamp(b.k * 2);
    drawAbstract(ctx, p.x, p.ground + (1 - Math.min(1, b.k)) * p.H * 0.4, p.H, c, {
      armL: id.armL,
      armR: waves ? waveArm(t + p.i, waves) : id.armR,
      lift: id.lift,
      squash: b.squash + id.squash,
      mouth: waves ? "open" : "smile",
      blink: blinkAt(t, p.i * 0.9),
      look: Math.sin(p.i * 2.1) * 0.6,
      flip: p.i % 3 === 1,
    });
    ctx.restore();
  }
  if (scene.subtext) {
    ctx.fillStyle = rgba(palette.text, 0.8);
    ctx.font = subFont(30 * u * st.S, 500);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = (1 - ex) * clamp((t - 0.6) / 0.4);
    fillTextFit(ctx, plain(scene.subtext), st.left + st.width / 2, st.top, st.width, { maxLines: 2 });
  }
  ctx.restore();
}

/**
 * A placard held up over the head: its bottom edge clears the head (and hair), and where the
 * hands can't reach that high they hold it on two short poles.
 */
function placard(sc: SkillContext, rig: AbsRig, cx0: number, sw0: number, sh: number, label: string, size: number, lit: boolean) {
  const { ctx, u, palette } = sc;
  // The sign is centred on the hands and at least as wide as they are apart, so each pole rises
  // straight from a hand (the hands stay on the poles, never beside them).
  const spread = Math.abs(rig.handR.x - rig.handL.x);
  const cx = (rig.handL.x + rig.handR.x) / 2 || cx0;
  const sw = Math.max(sw0, spread + 36 * u);
  const handY = Math.min(rig.handL.y, rig.handR.y);
  const bottom = Math.min(handY + 6 * u, rig.top - 14 * u);
  const sy = bottom - sh;
  ctx.strokeStyle = mixHex(palette.text, palette.light ? "#ffffff" : "#000000", 0.35);
  ctx.lineWidth = 5 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const hd of [rig.handL, rig.handR]) {
    if (hd.y <= bottom + 4 * u) continue;
    ctx.moveTo(hd.x, hd.y + 2 * u);
    ctx.lineTo(hd.x, bottom - 2 * u);
  }
  ctx.stroke();
  ctx.fillStyle = lit ? palette.primary : palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.1);
  ctx.shadowColor = "rgba(0,0,0,0.16)";
  ctx.shadowBlur = 16 * u;
  ctx.shadowOffsetY = 4 * u;
  ctx.beginPath();
  ctx.roundRect(cx - sw / 2, sy, sw, sh, 16 * u);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = lit ? "#ffffff" : palette.text;
  ctx.font = subFont(size, 750);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fillTextFit(ctx, label, cx, sy + sh / 2, sw - 28 * u, { maxLines: 2, lineHeight: 1.1, minScale: 0.55 });
}

const ABS_POINTS = ["Easy to start", "Made to share", "Works anywhere", "Friendly help"];

function absFeatures(sc: SkillContext) {
  const { ctx, t, u, palette, scene, seed } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.4 });
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, ABS_POINTS, narrow ? 3 : 4, 2).map((x) => plain(split(x).title));
  const n = P.length;
  const T = pointTimes(scene, n, 0.6);
  const room = st.bottom - st.top;
  const cur = T.reduce((cc, ti, i) => (t >= ti - 0.05 ? i : cc), -1);
  const slotW = st.width / n;
  const H = Math.min(room * 0.6, slotW * 1.5);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  P.forEach((label, i) => {
    const b = bounceIn(t, T[i] - 0.25);
    if (b.k <= 0) return;
    const c = person(sc, i, seed * 17 + i * 13 + 5);
    const x = st.left + slotW * (i + 0.5);
    const lit = i === cur;
    const hop = lit ? Math.max(0, Math.sin(clamp((t - T[i]) / 0.4) * Math.PI)) * 0.05 : 0;
    const id = idle(t, i);
    ctx.save();
    ctx.globalAlpha *= clamp(b.k * 2);
    // Both arms up, holding the sign.
    const rig = drawAbstract(ctx, x, st.bottom + (1 - Math.min(1, b.k)) * H * 0.5, H, c, {
      armL: 2.75,
      armR: 2.75,
      curlL: -0.2,
      curlR: -0.2,
      lift: id.lift + hop,
      squash: b.squash,
      mouth: lit ? "open" : "smile",
      blink: blinkAt(t, i * 1.3),
    });
    // The sign, held up above the head.
    const sw = Math.min(slotW * 0.92, 340 * u * S);
    placard(sc, rig, x, sw, 78 * u * S, label, 28 * u * S, lit);
    ctx.restore();
  });
  ctx.restore();
}

function absParade(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene, seed } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.4 });
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, ABS_POINTS, 4, 0).map((x) => plain(split(x).title));
  const room = st.bottom - st.top;
  const n = narrow ? 5 : 7;
  const H = Math.min(room * 0.62, (w / n) * 1.6);
  const gap = (w + H) / n;
  const speed = gap * 0.42;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  for (let i = 0; i < n; i++) {
    // A line walking left to right, wrapping round so the parade never ends.
    const x = ((((i * gap + t * speed) % (w + H)) + (w + H)) % (w + H)) - H * 0.5;
    const c = person(sc, i, seed * 23 + i * 11 + 3);
    const ph = (x / (H * 0.32)) * Math.PI;
    const sign = i < P.length ? P[i] : null;
    const rig = drawAbstract(ctx, x, st.bottom, H, c, {
      armL: sign ? 2.6 : 0.3 + Math.sin(ph + Math.PI) * 0.35,
      armR: sign ? 2.6 : 0.3 + Math.sin(ph) * 0.35,
      curlL: sign ? -0.2 : 0.3,
      curlR: sign ? -0.2 : 0.3,
      walk: ph,
      lift: Math.abs(Math.sin(ph)) * 0.02,
      lean: 0.05,
      mouth: "smile",
      blink: blinkAt(t, i),
      look: 0.8,
    });
    if (sign) placard(sc, rig, x, Math.min(gap * 0.9, 300 * u * S), 68 * u * S, sign, 26 * u * S, false);
  }
  ctx.restore();
}

const ABS_DIALOG = ["Is it hard to set up?", "Not really, a few clicks", "Can my team join?", "Yes, invite them in"];

function absChat(sc: SkillContext) {
  const { ctx, t, u, palette, scene, seed } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.4 });
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = itemsOr(scene, ABS_DIALOG, 4, 2).map((x) => plain(x));
  const n = P.length;
  const T = pointTimes(scene, n, 0.7);
  const room = st.bottom - st.top;
  const cur = T.reduce((cc, ti, i) => (t >= ti - 0.05 ? i : cc), -1);
  const H = Math.min(room * 0.7, st.width * (narrow ? 0.55 : 0.4));
  const xs = [st.left + st.width * 0.28, st.left + st.width * 0.72];
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const rigs = [0, 1].map((i) => {
    const b = bounceIn(t, 0.1 + i * 0.15);
    const speaking = cur >= 0 && cur % 2 === i;
    const id = idle(t, i * 3);
    return drawAbstract(ctx, xs[i], st.bottom + (1 - Math.min(1, b.k)) * H * 0.5, H, person(sc, i, seed * 41 + i * 19 + 9), {
      armL: speaking && i === 1 ? 1.2 + Math.sin(t * 4) * 0.25 : id.armL,
      armR: speaking && i === 0 ? 1.2 + Math.sin(t * 4) * 0.25 : id.armR,
      lift: id.lift + (speaking ? Math.max(0, Math.sin(t * 6)) * 0.01 : 0),
      squash: b.squash + id.squash,
      mouth: speaking ? (Math.sin(t * 12) > 0 ? "open" : "o") : "smile",
      blink: blinkAt(t, i * 1.6),
      look: i === 0 ? 0.9 : -0.9,
    });
  });
  if (cur >= 0) {
    const r = rigs[cur % 2];
    const k = pop(t, T[cur], T[cur + 1] !== undefined ? T[cur + 1] - 0.15 : Infinity);
    const size = 32 * u * S;
    const tip = { x: r.head.x, y: r.top - 6 * u };
    const area = { x: st.left, y: st.top, w: st.width, h: Math.max(size * 2, tip.y - 28 * u - st.top) };
    const box = fitBubble(sc, P[cur], tip, size, { area, maxW: st.width * (narrow ? 0.9 : 0.48), display: false });
    speech(sc, P[cur], box, tip, size, k, false);
  }
  ctx.restore();
}

function absCheer(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, seed } = sc;
  useToon(sc);
  saasBackground(sc, { beams: 0, aurora: 0.5 });
  const ex = exitOf(sc);
  const portrait = h > w;
  const label = plain(scene.text) || "Get started";
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // The crowd along the bottom, jumping in turn.
  const n = portrait ? 6 : 10;
  const H = portrait ? h * 0.28 : h * 0.4;
  for (let i = 0; i < n; i++) {
    const x = (w * (i + 0.5)) / n;
    const b = bounceIn(t, 0.2 + ((i * 0.41) % 1) * 0.5);
    if (b.k <= 0) continue;
    const ph = t * 4.2 + i * 1.3;
    const jump = Math.max(0, Math.sin(ph)) * 0.08 * clamp(t - 0.9);
    const land = Math.sin(ph) < 0 ? -Math.sin(ph) * 0.06 * clamp(t - 0.9) : 0;
    const c = person(sc, middleOut(i, n), seed * 13 + i * 29 + 7);
    ctx.save();
    ctx.globalAlpha *= clamp(b.k * 2);
    drawAbstract(ctx, x, h * 0.97 + (1 - Math.min(1, b.k)) * H * 0.5, H * (0.85 + ((i * 7) % 5) * 0.05), c, {
      armL: 2.4 + Math.sin(ph) * 0.3,
      armR: 2.4 + Math.sin(ph + 0.5) * 0.3,
      curlL: 0.4,
      curlR: 0.4,
      lift: jump,
      squash: b.squash - land,
      mouth: "open",
      blink: blinkAt(t, i),
      flip: i % 2 === 1,
    });
    ctx.restore();
  }
  // The button.
  const size = (portrait ? 54 : 62) * u;
  ctx.font = displayFont(saasFont(sc), size);
  const bw = Math.min(portrait ? w * 0.84 : w * 0.5, ctx.measureText(label).width + 120 * u);
  const bh = size * 2;
  const by = portrait ? h * 0.24 : h * 0.22;
  const kb = ease.outBack(clamp((t - 0.3) / 0.45));
  ctx.save();
  ctx.translate(w / 2, by + bh / 2);
  ctx.scale(kb, kb);
  ctx.translate(-w / 2, -(by + bh / 2));
  const g = ctx.createLinearGradient(w / 2 - bw / 2, by, w / 2 + bw / 2, by + bh);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.fillStyle = g;
  ctx.shadowColor = rgba(palette.primary, 0.45);
  ctx.shadowBlur = 34 * u;
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
    ctx.globalAlpha = (1 - ex) * clamp((t - 0.6) / 0.4);
    ctx.fillStyle = rgba(palette.text, 0.8);
    ctx.font = subFont((portrait ? 30 : 32) * u, 500);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    fillTextFit(ctx, plain(scene.subtext), w / 2, by + bh + 26 * u, portrait ? w * 0.84 : w * 0.5, { maxLines: 2, lineHeight: 1.25 });
  }
  ctx.restore();
}

/* ───────────────────────── Registry ───────────────────────── */

export const abstractSkills: Skill[] = [
  {
    id: "abs-hello",
    name: "Abstract Hello",
    tagline: "A one-of-a-kind abstract character bounces in, waves a bendy arm and says your headline. A remake brings a new character.",
    bestFor: "A modern, playful opener: a short headline (2–6 words) and an optional line under it.",
    sample: { text: "Say hi to *Loop*!", subtext: "Planning, made playful" },
    render: absHello,
    sfx: () => [at(0.15, "pop"), at(0.7, "pop")],
  },
  {
    id: "abs-crowd",
    name: "Abstract Crowd",
    tagline: "A crowd of randomly generated abstract people pops up under your headline, bobbing and waving. A remake brings new people.",
    bestFor: "Community and inclusive beats: a headline and an optional line.",
    sample: { text: "Made for *people*", subtext: "Teams of many shapes and sizes" },
    render: absCrowd,
    sfx: () => [at(0.25, "pop"), at(0.6, "pop"), at(0.9, "pop")],
  },
  {
    id: "abs-features",
    name: "Sign Holders",
    tagline: "A different abstract character per point holds up a sign with it, one after another.",
    bestFor: "2–4 short benefits or features of 2–4 words, told with personality.",
    sample: { text: "Why people *love it*", items: ABS_POINTS },
    itemsHint: "2–4 short points",
    render: absFeatures,
    sfx: (scene: Scene) => pointTimes(scene, itemsOr(scene, ABS_POINTS, 4, 2).length, 0.6).map((ti) => at(ti, "pop")),
  },
  {
    id: "abs-parade",
    name: "Parade",
    tagline: "Abstract characters walk across the frame in an endless line, the first ones carrying your points on signs.",
    bestFor: "Momentum, movement and 'join us' beats: a headline with 0–4 short points to carry.",
    sample: { text: "Join the *movement*", items: ["Plan", "Share", "Grow"] },
    itemsHint: "0–4 short points (carried on signs)",
    render: absParade,
  },
  {
    id: "abs-chat",
    name: "Abstract Chat",
    tagline: "Two abstract characters talk: your lines as an alternating conversation in speech bubbles.",
    bestFor: "A quick Q&A or an objection and its answer: 2–4 short lines that alternate.",
    sample: { text: "Questions? *Answered.*", items: ABS_DIALOG },
    itemsHint: "2–4 lines, alternating speakers",
    render: absChat,
    sfx: (scene: Scene) => pointTimes(scene, itemsOr(scene, ABS_DIALOG, 4, 2).length, 0.7).map((ti) => at(ti, "pop")),
  },
  {
    id: "abs-cheer",
    name: "Cheering Crowd",
    tagline: "A crowd of abstract characters jumps and cheers along the bottom as your call-to-action button pops up.",
    bestFor: "A joyful end card: the action as the headline, an optional line under it.",
    sample: { text: "Jump *in*", subtext: "Bring your crew" },
    render: absCheer,
    sfx: () => [at(0.3, "pop"), at(0.5, "success")],
  },
];
