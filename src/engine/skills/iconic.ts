/**
 * Icon slides in the trailer look, so a film made from words alone isn't only type. The icons come
 * from the slide's words (items) when it has them, else the product category's icon family, else
 * the trailer style's own (gaming, music, luxury…).
 *
 * - Icon Reveal: big line icons draw on one per beat inside rim-lit plates, labels under them.
 * - Icon Ring: icons fly out of the centre into a slowly turning ring, and the line lands inside it.
 */
import { CONCEPT_MAP } from "../concepts";
import { background, bevel, drawLayout, dust, exitT, extrude, headline, headlineGradient, subline } from "../fx";
import { tokens } from "../grid";
import { drawLucide, iconsFor } from "../icons";
import { clamp, ease, lerp, mixHex, range, rgba, TAU } from "../math";
import { spring } from "../saasfx";
import { subFont } from "../text";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { titleOf } from "./editorial";

/** Icon families for trailer styles whose product category is too general to say. */
const LOOK_ICONS: Record<string, string[]> = {
  gaming: ["Gamepad2", "Trophy", "Crosshair", "Zap"],
  music: ["Music", "Headphones", "Mic", "Disc3"],
  luxury: ["Gem", "Crown", "Sparkles", "Star"],
  fun: ["PartyPopper", "Smile", "Gift", "Star"],
  nature: ["Leaf", "Mountain", "Sun", "Waves"],
  action: ["Flame", "Zap", "Trophy", "Target"],
  hype: ["Flame", "Zap", "Star", "Trophy"],
  tech: ["Cpu", "Rocket", "Globe", "Zap"],
  cyber: ["ShieldCheck", "Lock", "Fingerprint", "Cpu"],
  space: ["Rocket", "Orbit", "Satellite", "Star"],
  retro: ["Radio", "Gamepad2", "Disc3", "Star"],
  editorial: ["PenTool", "BookOpen", "Camera", "Sparkles"],
};

function familyOf(sc: SkillContext) {
  const own = sc.concept && sc.concept !== "general" ? CONCEPT_MAP[sc.concept]?.icons : undefined;
  return own?.length ? own : (LOOK_ICONS[sc.genre ?? ""] ?? ["Sparkles", "Zap", "Star", "Rocket"]);
}

/** Icons (with their labels when the slide has words for them). */
function picks(sc: SkillContext, n: number) {
  const items = (sc.scene.items ?? []).map((x) => titleOf(x).trim()).filter(Boolean).slice(0, n);
  const family = familyOf(sc);
  if (items.length >= 2) {
    const icons = iconsFor(items, family);
    return items.map((label, i) => ({ icon: icons[i], label }));
  }
  return family.slice(0, n).map((icon) => ({ icon, label: "" }));
}

const stepOf = (beat: number) => clamp(beat, 0.35, 0.6);
const exitOf = (sc: SkillContext) => ease.inCubic(exitT(sc, 0.5));

/** A rim-lit round plate behind an icon; the rim draws on with `k`. */
function plate(sc: SkillContext, cx: number, cy: number, r: number, k: number, lit: number) {
  const { ctx, u, palette } = sc;
  const g = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, mixHex(palette.bg1, palette.secondary, 0.18 + 0.12 * lit));
  g.addColorStop(1, mixHex(palette.bg0, palette.secondary, 0.04));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(palette.secondary, 0.35 + 0.45 * lit);
  ctx.lineWidth = Math.max(1, 2 * u);
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * k);
  ctx.stroke();
}

/* ───────────────────────── Icon Reveal ───────────────────────── */

function iconReveal(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene } = sc;
  background(sc);
  dust(sc, 60, palette.secondary, 0.06);
  const ex = exitOf(sc);
  const portrait = h > w;
  const safe = tokens(w, h).safe;
  const short = Math.min(w, h);
  const set = picks(sc, 4);
  const n = set.length;
  const step = stepOf(sc.beat);
  // Heading above, in the film's title face.
  const head = headline(sc, { cy: h * (portrait ? 0.24 : 0.27), sizeFrac: portrait ? 0.11 : 0.1, maxLines: 2 });
  const hk = ease.outCubic(range(t, 0.05, 0.5));
  ctx.save();
  ctx.globalAlpha = hk * (1 - ex);
  ctx.fillStyle = headlineGradient(sc, head, palette.text, mixHex(palette.text, palette.secondary, 0.4));
  drawLayout(sc, head);
  ctx.restore();
  // A row (2×2 in tall frames), each icon drawing on in its plate on the beat.
  const cols = portrait && n > 2 ? 2 : n;
  const rows = Math.ceil(n / cols);
  const cellW = (safe.width * 0.9) / cols;
  // The icons fill the space between the heading and the foot of the frame (leaving room for each
  // row's label and the line under them), so they never run up into the heading.
  const labelH = short * 0.075;
  const rowGap = short * 0.045;
  const areaTop = head.ys[head.ys.length - 1] + head.size * 0.6 + short * 0.06;
  const areaBottom = h - safe.bottom - (scene.subtext ? short * 0.09 : 0);
  const fitR = (areaBottom - areaTop - rows * labelH - (rows - 1) * rowGap) / (2 * rows);
  const r = Math.max(short * 0.05, Math.min(cellW * 0.32, short * (portrait ? 0.16 : 0.15), fitR));
  const rowH = r * 2 + labelH + rowGap;
  const gridH = rows * (r * 2 + labelH) + (rows - 1) * rowGap;
  const top = areaTop + Math.max(0, (areaBottom - areaTop - gridH) / 2) + r;
  set.forEach((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const cx = w / 2 + (col - (inRow - 1) / 2) * cellW;
    const cy = top + row * rowH;
    const at = 0.45 + i * step;
    if (t < at) return;
    const pop = clamp(spring(t - at, 12, 7), 0, 1.08);
    const draw = ease.inOutCubic(range(t, at, at + 0.6));
    const lit = 1 - range(t, at + 0.2, at + 1.2);
    const float = Math.sin(t * 1.2 + i) * 3 * u;
    ctx.save();
    ctx.globalAlpha = clamp((t - at) / 0.12) * (1 - ex);
    ctx.translate(cx, cy + float);
    ctx.scale(pop, pop);
    plate(sc, 0, 0, r, draw, lit);
    drawLucide(ctx, p.icon, 0, 0, r * 1.05, mixHex(palette.text, palette.secondary, 0.25 * lit), { progress: draw, weight: 1.1 });
    ctx.restore();
    if (p.label) {
      ctx.save();
      ctx.globalAlpha = ease.outCubic(range(t, at + 0.25, at + 0.6)) * (1 - ex);
      ctx.fillStyle = rgba(palette.text, 0.85);
      ctx.font = subFont(Math.min(short * 0.032, cellW * 0.11), 600);
      ctx.letterSpacing = `${(short * 0.004).toFixed(1)}px`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(p.label.toUpperCase(), cx, cy + r + short * 0.035, cellW * 0.92);
      ctx.restore();
    }
  });
  const last = 0.45 + (n - 1) * step;
  subline(sc, top + (rows - 1) * rowH + r + labelH + short * 0.03, range(t, last + 0.5, last + 1), { alpha: 1 - ex });
}

const revealSfx = (scene: Scene, beat: number): SfxCue[] => {
  const n = Math.max(2, Math.min(4, (scene.items ?? []).length || 4));
  return Array.from({ length: n }, (_, i) => ({ t: 0.45 + i * stepOf(beat), kind: "pop" as const }));
};

/* ───────────────────────── Icon Ring ───────────────────────── */

function iconRing(sc: SkillContext) {
  const { ctx, w, h, t, u, palette } = sc;
  background(sc);
  dust(sc, 70, palette.secondary, 0.06);
  const ex = exitOf(sc);
  const portrait = h > w;
  const short = Math.min(w, h);
  const fam = picks(sc, 4);
  // Six around the ring: the set, repeated in turn.
  const ring = Array.from({ length: 6 }, (_, i) => fam[i % fam.length]);
  const cx = w / 2;
  const cy = h * 0.47;
  const R = portrait ? w * 0.38 : short * 0.36;
  const ey = portrait ? 1 : 0.82;
  const spin = t * 0.18;
  const r = short * 0.075;
  // The orbit guide.
  ctx.save();
  ctx.globalAlpha = 0.18 * ease.outCubic(range(t, 0.2, 0.8)) * (1 - ex);
  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = Math.max(1, u);
  ctx.beginPath();
  ctx.ellipse(cx, cy, R, R * ey, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
  ring.forEach((p, i) => {
    const at = 0.3 + i * 0.12;
    if (t < at) return;
    const fly = ease.outExpo(range(t, at, at + 0.55));
    const a = (i / ring.length) * TAU + spin - Math.PI / 2;
    const x = cx + Math.cos(a) * R * fly;
    const y = cy + Math.sin(a) * R * ey * fly;
    // Nearer the bottom of the ellipse reads as nearer the camera.
    const depth = portrait ? 1 : 0.85 + 0.15 * (Math.sin(a) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = clamp((t - at) / 0.15) * (1 - ex);
    ctx.translate(x, y);
    ctx.scale(depth, depth);
    plate(sc, 0, 0, r, fly, 1 - range(t, at + 0.3, at + 1.2));
    drawLucide(ctx, p.icon, 0, 0, r * 1.05, palette.text, { progress: ease.inOutCubic(range(t, at + 0.15, at + 0.7)), weight: 1.1 });
    ctx.restore();
  });
  // The line lands in the middle once the ring has formed.
  const land = 0.3 + ring.length * 0.12 + 0.3;
  const layout = headline(sc, { cy, sizeFrac: portrait ? 0.13 : 0.12, widthFrac: (R * 1.35) / w, maxLines: 3 });
  const k = ease.outExpo(range(t, land, land + 0.3));
  if (k > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(k * 2) * (1 - ex);
    ctx.translate(cx, cy);
    ctx.scale(lerp(1.25, 1, k), lerp(1.25, 1, k));
    ctx.translate(-cx, -cy);
    extrude(sc, layout, { depth: 8 });
    ctx.fillStyle = headlineGradient(sc, layout, palette.text, mixHex(palette.text, palette.secondary, 0.45));
    drawLayout(sc, layout);
    bevel(sc, layout, 0.6);
    ctx.restore();
  }
  subline(sc, cy + R * ey + short * 0.09, range(t, land + 0.4, land + 0.9), { alpha: 1 - ex });
}

const ringSfx = (): SfxCue[] => [
  { t: 0.3, kind: "whoosh" },
  { t: 1.32, kind: "pop" },
];

export const iconicSkills: Skill[] = [
  {
    id: "icon-reveal",
    name: "Icon Reveal",
    tagline: "Big line icons draw on one per beat inside rim-lit plates with their labels, under a heading in the title face.",
    bestFor: "Trailer and intro videos made from words alone: 2–4 things the brand is about (items), shown as icons. Heading of 1–4 words.",
    sample: { text: "WHAT WE DO", items: ["Fresh bread", "Coffee", "Cakes"] },
    itemsHint: "2–4 short things it's about; they become icons",
    render: iconReveal,
    sfx: revealSfx,
  },
  {
    id: "icon-ring",
    name: "Icon Ring",
    tagline: "Icons fly out of the centre into a slowly turning ring, and the line lands inside it.",
    bestFor: "A brand line circled by what it's about: 2–4 short features (items) as icons, line of 1–4 words.",
    sample: { text: "LEVEL UP", items: ["Play", "Compete", "Win"] },
    itemsHint: "2–4 short features; they become icons",
    render: iconRing,
    sfx: ringSfx,
  },
];
