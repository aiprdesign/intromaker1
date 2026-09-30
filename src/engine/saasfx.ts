/**
 * Design toolkit for modern SaaS launch-video aesthetics (Linear / Vercel / Stripe / Apple):
 * sentence-case type with blur-in, spring physics, grid + spotlight + travelling beams,
 * glass cards with animated border beams, a macOS cursor with click ripples, and icon glyphs.
 */
import { headline } from "./fx";
import { clamp, mixHex, range, rgba, rng, TAU } from "./math";
import { CONCEPT_MAP, ROLE_ICONS, type ConceptRole } from "./concepts";
import { liquidText } from "./gl";
import { drawLucide, iconFor as lucideFor, iconsFor as lucideIconsFor } from "./icons";
import { scratch } from "./scratch";
import { renderShaderBg } from "./shaderbg";
import { subFont, type HeadlineLayout } from "./text";
import type { FontId, SkillContext, TextFx } from "./types";

/** Critically-damped-ish spring: fast settle with a gentle overshoot. t in seconds since start. */
export function spring(t: number, stiffness = 12, damping = 7) {
  if (t <= 0) return 0;
  return 1 - Math.exp(-damping * t) * Math.cos(stiffness * t);
}

/** SaaS skills prefer a clean geometric face even if the plan asked for condensed trailer type. */
export function saasFont(sc: SkillContext): FontId {
  return sc.font === "anton" ? "inter" : sc.font;
}

/** Sentence-case headline layout in the SaaS face. */
export function sentence(sc: SkillContext, opts: Parameters<typeof headline>[1] = {}) {
  const k = sc.look?.textScale ?? 1;
  return headline(sc, { natural: true, font: saasFont(sc), ...opts, sizeFrac: (opts.sizeFrac ?? 0.3) * k });
}

/**
 * The signature "dark grid" stage: aurora glow at the top, a spotlight cone,
 * a faded grid with dots, and bright beams that travel along the grid lines.
 */
export function saasBackground(sc: SkillContext, opts: { grid?: boolean; beams?: number; aurora?: number } = {}) {
  if (sc.noStage) return;
  const { ctx, w, h, t, u, palette, seed } = sc;
  const look = sc.look;
  const light = !!palette.light;
  // Additive light only reads on dark stages; light themes paint solid colour instead.
  const glowOp: GlobalCompositeOperation = light ? "source-over" : "lighter";
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(0, 0, w, h);

  // Premium GPU gradient stage (mesh / grain / warp / smoke / neuro / rays), when the look has one.
  // The camera overscans slightly, so paint a little beyond the frame.
  const shaderKind = look?.shader ?? (look?.backdrop === "blobs" ? "mesh" : undefined);
  const shaded = shaderKind ? renderShaderBg(shaderKind, palette, w, h, sc.globalT ?? t, seed, look?.shaderSpeed ?? 0.6) : null;
  if (shaded) {
    ctx.save();
    ctx.globalAlpha = look?.shaderStrength ?? 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(shaded, -w * 0.03, -h * 0.03, w * 1.06, h * 1.06);
    ctx.restore();
  }

  // Aurora: soft moving colour fields bleeding from the top edge.
  const aur = (opts.aurora ?? 1) * (look?.aurora ?? 1) * (light ? 0.7 : 1) * (shaded ? 0.35 : 1);
  ctx.save();
  ctx.globalCompositeOperation = glowOp;
  const fields: [number, string, number][] = [
    [0.3 + 0.12 * Math.sin(t * 0.35), palette.primary, 0.22],
    [0.7 + 0.1 * Math.cos(t * 0.3), palette.secondary, 0.18],
    [0.5 + 0.2 * Math.sin(t * 0.22 + 2), palette.accent, 0.1],
  ];
  for (const [x, c, a] of fields) {
    const g = ctx.createRadialGradient(x * w, -h * 0.05, 0, x * w, -h * 0.05, Math.max(w, h) * 0.6);
    g.addColorStop(0, rgba(c, a * aur));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();

  const backdrop = look?.backdrop ?? "grid";
  if (backdrop === "blobs" && !shaded) {
    // Big soft colour blobs drifting across the whole frame (glassmorphism / AI-glow stages).
    ctx.save();
    ctx.globalCompositeOperation = glowOp;
    const cols = [palette.primary, palette.secondary, palette.accent, palette.primary];
    const R = Math.max(w, h);
    cols.forEach((c, i) => {
      const bx = w * (0.5 + 0.38 * Math.sin(t * (0.13 + i * 0.03) + i * 1.9));
      const by = h * (0.5 + 0.34 * Math.cos(t * (0.11 + i * 0.025) + i * 2.7));
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, R * (0.42 - i * 0.04));
      g.addColorStop(0, rgba(c, (light ? 0.42 : 0.3) * (look?.aurora ?? 1)));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    ctx.restore();
  } else if (backdrop === "dots") {
    const step = 34 * u;
    const ox = (w / 2) % step;
    const oy = (h / 2) % step;
    ctx.save();
    ctx.fillStyle = rgba(palette.text, light ? 0.16 : 0.12);
    for (let x = ox; x < w; x += step) for (let y = oy; y < h; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (!shaded) {
      const fade = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.45, Math.max(w, h) * 0.7);
      fade.addColorStop(0, rgba(palette.bg0, 0));
      fade.addColorStop(1, rgba(palette.bg0, 0.85));
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (backdrop === "scanlines") {
    // CRT terminal: phosphor glow, scanlines and a slow rolling bright band.
    ctx.save();
    ctx.globalCompositeOperation = glowOp;
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
    glow.addColorStop(0, rgba(palette.primary, 0.09));
    glow.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    const band = ((t * 0.12) % 1.3) * h * 1.3 - h * 0.15;
    const bg = ctx.createLinearGradient(0, band - h * 0.12, 0, band + h * 0.12);
    bg.addColorStop(0, rgba(palette.primary, 0));
    bg.addColorStop(0.5, rgba(palette.primary, 0.05));
    bg.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = bg;
    ctx.fillRect(0, band - h * 0.12, w, h * 0.24);
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    const gap = Math.max(3, 4 * u);
    for (let y = 0; y < h; y += gap) ctx.fillRect(0, y, w, gap * 0.45);
  }

  if (backdrop === "horizon") {
    // Synthwave 3D floor: perspective grid rushing towards the viewer, glowing horizon line.
    const hy = h * 0.6;
    ctx.save();
    const sky = ctx.createLinearGradient(0, hy - h * 0.35, 0, hy);
    sky.addColorStop(0, rgba(palette.primary, 0));
    sky.addColorStop(1, rgba(palette.primary, 0.28));
    ctx.fillStyle = sky;
    ctx.fillRect(0, hy - h * 0.35, w, h * 0.35);
    const floor = ctx.createLinearGradient(0, hy, 0, h);
    floor.addColorStop(0, rgba(palette.bg1, 0.9));
    floor.addColorStop(1, rgba(palette.bg0, 1));
    ctx.fillStyle = floor;
    ctx.fillRect(0, hy, w, h - hy);
    ctx.beginPath();
    ctx.rect(0, hy, w, h - hy);
    ctx.clip();
    ctx.strokeStyle = palette.primary;
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = 10 * u;
    const f = h * 0.4;
    const phase = ((sc.globalT ?? t) * 0.9) % 1;
    for (let i = 0; i < 26; i++) {
      const z = i + 1 - phase;
      const y = hy + f / z;
      if (y > h + 4) continue;
      ctx.globalAlpha = Math.min(1, 1.6 / z) * 0.85;
      ctx.lineWidth = Math.max(1, 2.4 * u / Math.sqrt(z));
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.6 * u;
    for (let i = -18; i <= 18; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * w * 0.012, hy);
      ctx.lineTo(w / 2 + i * w * 0.16, h);
      ctx.stroke();
    }
    ctx.restore();
    // Horizon glow.
    const hg = ctx.createLinearGradient(0, hy - 30 * u, 0, hy + 30 * u);
    hg.addColorStop(0, rgba(palette.secondary, 0));
    hg.addColorStop(0.5, rgba(palette.secondary, 0.75));
    hg.addColorStop(1, rgba(palette.secondary, 0));
    ctx.save();
    ctx.globalCompositeOperation = glowOp;
    ctx.fillStyle = hg;
    ctx.fillRect(0, hy - 30 * u, w, 60 * u);
    ctx.restore();
  } else if (backdrop === "stars") {
    // Parallax starfield: three depth layers drifting, gently twinkling.
    const r = rng(seed + 77);
    const T = sc.globalT ?? t;
    ctx.save();
    ctx.globalCompositeOperation = glowOp;
    for (let layer = 0; layer < 3; layer++) {
      const n = [140, 70, 26][layer];
      const speed = [4, 10, 22][layer] * u;
      const size = [0.9, 1.4, 2.2][layer] * u;
      for (let i = 0; i < n; i++) {
        const x = (((r() * w - T * speed) % w) + w) % w;
        const y = r() * h;
        const tw = 0.55 + 0.45 * Math.sin(T * (1 + r() * 2) + i);
        ctx.fillStyle = rgba(i % 7 === 0 ? palette.secondary : palette.text, (0.35 + layer * 0.25) * tw);
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.restore();
  }

  if (backdrop === "grid" && opts.grid !== false && look?.grid !== false) {
    // Over a shader stage the grid lives on its own layer, masked to fade at the edges;
    // on a flat stage it is drawn directly and faded with the base colour.
    const layer = shaded ? scratch("saas-grid", w, h) : null;
    const gc = layer ? layer.ctx : ctx;
    const step = 72 * u;
    const ox = (w / 2) % step;
    const oy = (h / 2) % step;
    gc.save();
    gc.strokeStyle = rgba(palette.text, 0.055);
    gc.lineWidth = 1;
    gc.beginPath();
    for (let x = ox; x < w; x += step) {
      gc.moveTo(x, 0);
      gc.lineTo(x, h);
    }
    for (let y = oy; y < h; y += step) {
      gc.moveTo(0, y);
      gc.lineTo(w, y);
    }
    gc.stroke();
    gc.fillStyle = rgba(palette.text, 0.12);
    for (let x = ox; x < w; x += step) for (let y = oy; y < h; y += step) gc.fillRect(x - 1, y - 1, 2, 2);

    // Travelling beams along grid lines.
    const r = rng(seed + 404);
    const beams = Math.round((opts.beams ?? 4) * (look ? look.beams : 1));
    gc.globalCompositeOperation = glowOp;
    for (let i = 0; i < beams; i++) {
      const vertical = r() > 0.5;
      const lineIdx = Math.floor(r() * (vertical ? w / step : h / step));
      const speed = (0.25 + r() * 0.35) * (r() > 0.5 ? 1 : -1);
      const phase = r();
      const len = (160 + r() * 200) * u;
      const span = vertical ? h : w;
      const pos = ((((t * speed + phase) % 1) + 1) % 1) * (span + len) - len / 2;
      const c = i % 2 ? palette.primary : palette.secondary;
      if (vertical) {
        const x = ox + lineIdx * step;
        const g = gc.createLinearGradient(0, pos - len, 0, pos);
        g.addColorStop(0, rgba(c, 0));
        g.addColorStop(1, rgba(c, 0.9));
        gc.fillStyle = g;
        gc.fillRect(x - 1, pos - len, 2, len);
      } else {
        const y = oy + lineIdx * step;
        const g = gc.createLinearGradient(pos - len, 0, pos, 0);
        g.addColorStop(0, rgba(c, 0));
        g.addColorStop(1, rgba(c, 0.9));
        gc.fillStyle = g;
        gc.fillRect(pos - len, y - 1, len, 2);
      }
    }
    gc.restore();

    if (layer) {
      gc.save();
      gc.globalCompositeOperation = "destination-in";
      const mask = gc.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.15, w / 2, h * 0.45, Math.max(w, h) * 0.6);
      mask.addColorStop(0, "rgba(0,0,0,0.75)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      gc.fillStyle = mask;
      gc.fillRect(0, 0, w, h);
      gc.restore();
      ctx.drawImage(layer.canvas, 0, 0);
    } else {
      // Fade the grid out towards the edges.
      const fade = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.2, w / 2, h * 0.45, Math.max(w, h) * 0.65);
      fade.addColorStop(0, rgba(palette.bg0, 0));
      fade.addColorStop(1, rgba(palette.bg0, 0.92));
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // The stage breathes with the score: a soft light swell on each kick, a bloom on each drop.
  if (sc.music) {
    const m = sc.music;
    const kick = Number.isFinite(m.kick) ? Math.exp(-m.kick * 9) * 0.05 * m.energy : 0;
    const drop = m.drop < 1.2 ? Math.exp(-m.drop * 3.5) * 0.16 : 0;
    const k = kick + drop;
    if (k > 0.004) {
      ctx.save();
      ctx.globalCompositeOperation = glowOp;
      const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.65);
      g.addColorStop(0, rgba(light ? palette.primary : palette.text, k * (light ? 0.5 : 1)));
      g.addColorStop(0.5, rgba(palette.primary, k * 0.5));
      g.addColorStop(1, rgba(palette.primary, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // Spotlight cone from above.
  if (light || backdrop === "plain" || backdrop === "scanlines") return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const sp = ctx.createRadialGradient(w / 2, -h * 0.1, 0, w / 2, -h * 0.1, h * 0.9);
  sp.addColorStop(0, rgba(palette.text, 0.07));
  sp.addColorStop(1, rgba(palette.text, 0));
  ctx.fillStyle = sp;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Frosted glass panel with inner highlight and hairline border. */
export function glassCard(
  sc: SkillContext,
  x: number,
  y: number,
  cw: number,
  ch: number,
  opts: { r?: number; alpha?: number; tint?: string } = {},
) {
  const { ctx, u, palette } = sc;
  const r = opts.r ?? 18 * u;
  const a = opts.alpha ?? 1;
  const kind = sc.look?.card ?? "glass";
  if (kind !== "glass") {
    ctx.save();
    ctx.globalAlpha *= a;
    const light = !!palette.light;
    if (kind === "clay") {
      // Claymorphism: soft pastel slab, extruded underside, puffy inner highlight.
      const rr = Math.max(r, 26 * u);
      const face = opts.tint ? mixHex(palette.bg1, opts.tint, 0.2) : palette.bg1;
      ctx.shadowColor = rgba(palette.support ?? palette.primary, light ? 0.35 : 0.5);
      ctx.shadowBlur = 44 * u;
      ctx.shadowOffsetY = 24 * u;
      ctx.beginPath();
      ctx.roundRect(x, y + 10 * u, cw, ch, rr);
      ctx.fillStyle = mixHex(face, "#000000", light ? 0.12 : 0.35);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, rr);
      ctx.fillStyle = face;
      ctx.fill();
      const hl = ctx.createLinearGradient(x, y, x, y + ch * 0.6);
      hl.addColorStop(0, "rgba(255,255,255,0.55)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.save();
      ctx.clip();
      ctx.fillStyle = hl;
      ctx.beginPath();
      ctx.roundRect(x + 6 * u, y + 5 * u, cw - 12 * u, ch * 0.5, rr * 0.8);
      ctx.fill();
      ctx.restore();
    } else if (kind === "brutal") {
      // Neo-brutalist: solid fill, thick ink border, hard offset shadow.
      const rr = Math.min(r, 12 * u);
      ctx.fillStyle = palette.text;
      ctx.beginPath();
      ctx.roundRect(x + 9 * u, y + 9 * u, cw, ch, rr);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, rr);
      ctx.fillStyle = opts.tint ? mixHex(palette.bg1, opts.tint, 0.15) : palette.bg1;
      ctx.fill();
      ctx.strokeStyle = palette.text;
      ctx.lineWidth = 3.5 * u;
      ctx.stroke();
    } else if (kind === "frost") {
      // Frosted light glass over colour blobs.
      ctx.shadowColor = rgba(palette.primary, light ? 0.2 : 0.35);
      ctx.shadowBlur = 50 * u;
      ctx.shadowOffsetY = 16 * u;
      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, r);
      ctx.fillStyle = light ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.09)";
      ctx.fill();
      ctx.shadowColor = "transparent";
      const sheen = ctx.createLinearGradient(x, y, x + cw, y + ch);
      sheen.addColorStop(0, "rgba(255,255,255,0.35)");
      sheen.addColorStop(0.5, "rgba(255,255,255,0.05)");
      sheen.addColorStop(1, "rgba(255,255,255,0.12)");
      ctx.fillStyle = sheen;
      ctx.fill();
      ctx.strokeStyle = light ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.28)";
      ctx.lineWidth = Math.max(1, 1.5 * u);
      ctx.stroke();
    } else {
      // Flat: clean solid card, hairline border, soft drop shadow.
      ctx.shadowColor = light ? "rgba(15,30,60,0.12)" : "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 28 * u;
      ctx.shadowOffsetY = 10 * u;
      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, r);
      ctx.fillStyle = opts.tint ? mixHex(palette.bg1, opts.tint, light ? 0.06 : 0.4) : palette.bg1;
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = rgba(palette.text, light ? 0.1 : 0.14);
      ctx.lineWidth = Math.max(1, 1.2 * u);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 40 * u;
  ctx.shadowOffsetY = 18 * u;
  ctx.beginPath();
  ctx.roundRect(x, y, cw, ch, r);
  const fill = ctx.createLinearGradient(x, y, x, y + ch);
  fill.addColorStop(0, rgba(opts.tint ?? palette.bg1, 0.92));
  fill.addColorStop(1, rgba(palette.bg0, 0.92));
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Sheen.
  const sheen = ctx.createLinearGradient(x, y, x, y + ch * 0.5);
  sheen.addColorStop(0, "rgba(255,255,255,0.07)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fill();
  const border = ctx.createLinearGradient(x, y, x, y + ch);
  const edge = palette.light ? palette.text : "#ffffff";
  border.addColorStop(0, rgba(edge, palette.light ? 0.14 : 0.22));
  border.addColorStop(1, rgba(edge, palette.light ? 0.08 : 0.06));
  ctx.strokeStyle = border;
  ctx.lineWidth = Math.max(1, 1.2 * u);
  ctx.stroke();
  ctx.restore();
}

/** A bright segment of light racing around a rounded rectangle's border. */
export function borderBeam(sc: SkillContext, x: number, y: number, cw: number, ch: number, phase: number, opts: { r?: number; color?: string; alpha?: number } = {}) {
  const { ctx, u, palette } = sc;
  const r = opts.r ?? 18 * u;
  const perim = 2 * (cw + ch) - (8 - TAU) * r;
  const len = perim * 0.22;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.globalCompositeOperation = palette.light ? "source-over" : "lighter";
  ctx.beginPath();
  ctx.roundRect(x, y, cw, ch, r);
  ctx.setLineDash([len, perim - len]);
  ctx.lineDashOffset = -((((phase % 1) + 1) % 1) * perim);
  const c = opts.color ?? palette.primary;
  ctx.strokeStyle = c;
  ctx.lineWidth = 2 * u;
  ctx.shadowColor = c;
  ctx.shadowBlur = 14 * u;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** macOS-style arrow cursor with a soft shadow; `press` 0..1 squashes it on click. */
export function drawCursor(sc: SkillContext, x: number, y: number, press = 0, scale = 1) {
  const { ctx, u } = sc;
  const s = 1.9 * u * scale * (1 - press * 0.12);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 22);
  ctx.lineTo(5.5, 17);
  ctx.lineTo(9.5, 26);
  ctx.lineTo(13, 24.5);
  ctx.lineTo(9, 15.8);
  ctx.lineTo(16, 15.8);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#111";
  ctx.stroke();
  ctx.restore();
}

/** Expanding ring where a click lands. k: 0..1 over the ripple's life. */
export function clickRipple(sc: SkillContext, x: number, y: number, k: number, color?: string) {
  if (k <= 0 || k >= 1) return;
  const { ctx, u, palette } = sc;
  ctx.save();
  ctx.strokeStyle = color ?? palette.primary;
  ctx.globalAlpha = (1 - k) * 0.9;
  ctx.lineWidth = 3 * u * (1 - k) + 1;
  ctx.beginPath();
  ctx.arc(x, y, 8 * u + k * 46 * u, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = rgba(color ?? palette.primary, 0.25 * (1 - k));
  ctx.beginPath();
  ctx.arc(x, y, 10 * u + k * 20 * u, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Width of a pill() without drawing it. */
export function pillWidth(sc: SkillContext, text: string, opts: { size?: number; weight?: number; padX?: number } = {}) {
  const { ctx, u } = sc;
  const size = opts.size ?? 22 * u;
  ctx.save();
  ctx.font = subFont(size, opts.weight ?? 600);
  const tw = ctx.measureText(text).width;
  ctx.restore();
  return tw + (opts.padX ?? size * 0.9) * 2;
}

/** Pill label (callouts, badges, CTA text). Returns its width. */
export function pill(
  sc: SkillContext,
  text: string,
  cx: number,
  cy: number,
  opts: { size?: number; fill?: string; color?: string; border?: string; weight?: number; padX?: number } = {},
) {
  const { ctx, u, palette } = sc;
  const size = opts.size ?? 22 * u;
  const light = !!palette.light;
  ctx.save();
  ctx.font = subFont(size, opts.weight ?? 600);
  const tw = ctx.measureText(text).width;
  const px = opts.padX ?? size * 0.9;
  const pw = tw + px * 2;
  const ph = size * 2;
  ctx.beginPath();
  ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
  ctx.fillStyle = opts.fill ?? (light ? rgba(palette.text, 0.05) : "rgba(255,255,255,0.08)");
  ctx.fill();
  if (opts.border !== "none") {
    ctx.strokeStyle = opts.border ?? (light ? rgba(palette.text, 0.16) : "rgba(255,255,255,0.18)");
    ctx.lineWidth = Math.max(1, 1.2 * u);
    ctx.stroke();
  }
  ctx.fillStyle = opts.color ?? (light ? palette.text : "#fff");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + size * 0.04);
  ctx.restore();
  return pw;
}

/** Legacy glyph names, now drawn with Lucide icons; any Lucide name also works. */
export type IconKind = string;
const LEGACY: Record<string, string> = {
  bolt: "Zap",
  chart: "ChartColumn",
  shield: "ShieldCheck",
  users: "Users",
  sparkle: "Sparkles",
  globe: "Globe",
  clock: "Clock",
  check: "Check",
  chat: "MessageCircle",
  cloud: "Cloud",
  layers: "Layers",
  code: "CodeXml",
};

/** Pick the icon for a feature's wording (falls back to the product concept's icon family). */
export function iconFor(label: string, i: number, sc?: Pick<SkillContext, "concept">): IconKind {
  return lucideFor(label, i, CONCEPT_MAP[sc?.concept ?? "general"]?.icons);
}

/** Distinct icons for labels shown together in one scene. */
export function iconsFor(labels: string[], sc?: Pick<SkillContext, "concept">): IconKind[] {
  return lucideIconsFor(labels, CONCEPT_MAP[sc?.concept ?? "general"]?.icons);
}

/** Draw an icon (Lucide) centred in a size×size box. */
export function drawIcon(ctx: CanvasRenderingContext2D, kind: IconKind, cx: number, cy: number, size: number, color: string, progress = 1) {
  drawLucide(ctx, LEGACY[kind] ?? kind, cx, cy, size, color, { progress });
}

/**
 * Word-by-word blur-in (the Apple/Linear reveal): each word rises, un-blurs and fades in on a
 * stagger. Words wrapped in *asterisks* get the brand gradient.
 */
export function blurInLayout(
  sc: SkillContext,
  layout: HeadlineLayout,
  start: number,
  stagger: number,
  opts: { alpha?: number; exitAt?: number; gradient?: [string, string] } = {},
) {
  const { ctx, t, u, w, palette } = sc;
  const exit = opts.exitAt !== undefined ? range(t, opts.exitAt, opts.exitAt + 0.4) : 0;
  const alpha0 = (opts.alpha ?? 1) * (1 - exit);
  const want: TextFx = sc.look?.text ?? "blur";
  if (want === "liquid") {
    const n = liquidLayout(sc, layout, start, stagger, opts);
    if (n !== null) return n;
  }
  // (Liquid falls back to the blur-in where WebGL isn't available.)
  const mode: TextFx = want === "liquid" ? "blur" : want;
  let wi = 0;
  // Typewriter mode: characters appear one by one behind a block cursor.
  const typing = mode === "type";
  const totalChars = layout.lines.reduce((a, l) => a + l.replace(/\*/g, "").length + 1, 0);
  const totalWords = layout.lines.reduce((a, l) => a + l.split(" ").length, 0);
  const charDur = Math.min(0.045, 1.5 / Math.max(1, totalChars));
  const visible = typing ? Math.floor(Math.max(0, t - start) / charDur) : Infinity;
  // Per-mode pacing: how far apart words start, and how long each takes.
  const pace = FX_PACE[mode] ?? { stagger: 1, dur: 0.7 };
  // Shine: one specular sweep across the finished headline.
  const sweepAt = start + (totalWords - 1) * stagger * pace.stagger + pace.dur + 0.15;
  const sweep = mode === "shine" ? range(t, sweepAt, sweepAt + 0.9) : 0;
  const frame = Math.floor(t * 24);
  let gi = 0;
  let cursor: { x: number; y: number } | null = null;
  layout.lines.forEach((line, li) => {
    const y = layout.ys[li];
    const words = line.split(" ");
    const widths = words.map((wd) => ctx.measureText(wd.replace(/\*/g, "")).width + layout.tracking * Math.max(0, wd.length - 1));
    const space = ctx.measureText(" ").width;
    const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    const lineX0 = w / 2 - total / 2;
    let x = lineX0;
    words.forEach((word, i) => {
      const accent = /^\*.*\*$/.test(word) || word.startsWith("*") || word.endsWith("*");
      const clean = word.replace(/\*/g, "");
      const t0 = start + wi * stagger * pace.stagger;
      const k = clamp(range(t, t0, t0 + pace.dur));
      const e = mode === "glow" ? k * k * (3 - 2 * k) : 1 - Math.pow(1 - k, 3);
      const size = layout.size;
      const charX = (ci: number) => x + (ci ? ctx.measureText(clean.slice(0, ci)).width : 0) + layout.tracking * ci;
      const accentFill = () => {
        const g = ctx.createLinearGradient(x, y - size / 2, x + widths[i], y + size / 2);
        g.addColorStop(0, (opts.gradient ?? [palette.primary, palette.secondary])[0]);
        g.addColorStop(1, (opts.gradient ?? [palette.primary, palette.secondary])[1]);
        return g;
      };
      /** The word's glyphs, each at its kerned position (optionally per-glyph transformed). */
      const drawGlyphs = (dx = 0, dy = 0, each?: (ci: number, cx: number) => boolean | void) => {
        for (let ci = 0; ci < clean.length; ci++) {
          const cx = charX(ci);
          if (each) {
            ctx.save();
            const skip = each(ci, cx);
            if (!skip) ctx.fillText(clean[ci], cx + dx, y + dy);
            ctx.restore();
          } else ctx.fillText(clean[ci], cx + dx, y + dy);
        }
      };
      ctx.save();
      ctx.textAlign = "left";
      const fill = accent ? accentFill() : palette.text;
      ctx.fillStyle = fill;
      let drawn = false;
      if (mode === "type") {
        ctx.globalAlpha = alpha0;
      } else if (mode === "mask") {
        // Crisp editorial reveal: each word slides up out of a mask.
        const m = 1 - Math.pow(1 - clamp(range(t, t0, t0 + 0.55)), 4);
        ctx.beginPath();
        ctx.rect(x - size * 0.1, y - size * 0.62, widths[i] + size * 0.2, size * 1.24);
        ctx.clip();
        ctx.globalAlpha = alpha0;
        ctx.translate(0, (1 - m) * size * 1.1 - exit * size * 1.1);
      } else if (mode === "pop") {
        // Bouncy: words spring up from small.
        const sp = Math.max(0, spring(t - t0, 13, 6));
        ctx.globalAlpha = alpha0 * clamp((t - t0) / 0.12);
        const cx = x + widths[i] / 2;
        // Overshoot only as far as the word gap allows, so neighbours never collide.
        const sz = Math.min(0.3 + 0.7 * sp * (1 - exit * 0.5), 1 + (space * 0.9) / Math.max(1, widths[i]));
        ctx.translate(cx, y);
        ctx.scale(sz, sz);
        ctx.rotate((1 - Math.min(1, sp)) * (wi % 2 ? 0.12 : -0.12));
        ctx.translate(-cx, -y);
      } else if (mode === "decode") {
        // Characters scramble through random glyphs, then lock in left to right.
        ctx.globalAlpha = alpha0;
        drawGlyphs(0, 0, (ci) => {
          const on = t0 + ci * 0.022;
          const lock = t0 + 0.28 + ci * 0.045;
          if (t < on) return true;
          if (t < lock) {
            const hsh = (Math.imul(gi + ci + 1, 2654435761) ^ Math.imul(frame + 7, 40503) ^ sc.seed) >>> 0;
            ctx.globalAlpha = alpha0 * (0.45 + 0.4 * ((hsh >> 8) % 100) / 100);
            if (!accent) ctx.fillStyle = mixHex(palette.text, palette.primary, 0.55);
            ctx.fillText(DECODE_GLYPHS[hsh % DECODE_GLYPHS.length], charX(ci), y);
            return true;
          }
          const snap = clamp((t - lock) / 0.12);
          ctx.globalAlpha = alpha0 * (0.7 + 0.3 * snap);
        });
        drawn = true;
      } else if (mode === "roll") {
        // Odometer: each letter rolls up out of a mask, a touch after its neighbour.
        ctx.beginPath();
        ctx.rect(x - size * 0.1, y - size * 0.64, widths[i] + size * 0.2, size * 1.28);
        ctx.clip();
        ctx.globalAlpha = alpha0;
        drawGlyphs(0, 0, (ci) => {
          const kc = clamp(range(t, t0 + ci * 0.035, t0 + ci * 0.035 + 0.5));
          const ec = 1 - Math.pow(1 - kc, 4);
          ctx.translate(0, (1 - ec) * size * 1.15 - exit * size * 1.1);
          return kc <= 0;
        });
        drawn = true;
      } else if (mode === "letters") {
        // Letters spring up one after another in a wave.
        drawGlyphs(0, 0, (ci, cx) => {
          const tc = t0 + ci * 0.028;
          if (t < tc) return true;
          const sp = spring(t - tc, 14, 7);
          ctx.globalAlpha = alpha0 * clamp((t - tc) / 0.14);
          const cw = ctx.measureText(clean[ci]).width;
          ctx.translate(cx + cw / 2, y);
          ctx.rotate((1 - Math.min(1, sp)) * 0.35 * (ci % 2 ? 1 : -1));
          ctx.translate(-(cx + cw / 2), -y + (1 - sp) * size * 0.55);
        });
        drawn = true;
      } else if (mode === "streak") {
        // Words fly in from the right on motion streaks and stretch as they brake.
        const ek = 1 - Math.pow(1 - k, 5);
        if (k <= 0) drawn = true;
        else {
          const dx = (1 - ek) * size * 3.2;
          const stretch = 1 + (1 - ek) * 1.1;
          ctx.translate(x, y);
          ctx.scale(stretch, 1);
          ctx.translate(-x, -y);
          for (let j = 4; j >= 1; j--) {
            ctx.globalAlpha = alpha0 * 0.16 * (1 - ek) * (1 - j / 5);
            drawGlyphs(dx / stretch + j * size * 0.28 * (1 - ek), 0);
          }
          ctx.globalAlpha = alpha0 * Math.min(1, k * 3);
          drawGlyphs(dx / stretch, 0);
          drawn = true;
        }
      } else if (mode === "chroma") {
        // RGB split: cyan and magenta ghosts converge into crisp type.
        if (k <= 0) drawn = true;
        else {
          const d = (1 - e) * size * 0.14 + (k < 1 ? Math.sin(frame * 2.3 + wi) * size * 0.012 * (1 - e) : 0);
          const ghosts = palette.light ? ["#00a3c4", "#d4007a"] : ["#00f0ff", "#ff2bd6"];
          ctx.globalAlpha = alpha0 * 0.75 * (1 - e * 0.9);
          ctx.fillStyle = ghosts[0];
          drawGlyphs(-d, d * 0.2);
          ctx.fillStyle = ghosts[1];
          drawGlyphs(d, -d * 0.2);
          ctx.fillStyle = fill;
          ctx.globalAlpha = alpha0 * Math.min(1, k * 2.5);
          drawGlyphs();
          drawn = true;
        }
      } else if (mode === "flip") {
        // Split-flap: each word flips up on its baseline, darker until it faces the camera.
        const sp = Math.min(1.08, Math.max(0, spring(t - t0, 11, 7)));
        const sy = Math.max(0.02, Math.abs(Math.cos((1 - sp) * Math.PI * 0.5)));
        ctx.globalAlpha = alpha0 * clamp((t - t0) / 0.1) * (0.35 + 0.65 * Math.min(1, sp));
        ctx.translate(0, y + size * 0.36);
        ctx.transform(1, 0, (1 - Math.min(1, sp)) * -0.25, sy, 0, 0);
        ctx.translate(0, -(y + size * 0.36));
      } else if (mode === "focus") {
        // Runway-style: the whole line is there, dimmed; each word lights up as it's reached.
        const lit = 1 - Math.pow(1 - k, 3);
        ctx.globalAlpha = alpha0 * clamp(range(t, start - 0.1, start + 0.3)) * (0.16 + 0.84 * lit);
        const cx = x + widths[i] / 2;
        const sz = 1 + 0.06 * Math.sin(Math.PI * clamp(k * 1.2));
        ctx.translate(cx, y);
        ctx.scale(sz, sz);
        ctx.translate(-cx, -y);
        if (!accent && lit < 1) ctx.fillStyle = mixHex(palette.text, palette.bg1, 0.25 * (1 - lit));
      } else if (mode === "highlight") {
        // Words rise in; a marker box wipes in behind the key word, which flips to contrast.
        const key = accent || (!layout.lines.join(" ").includes("*") && li === layout.lines.length - 1 && i === words.length - 1);
        ctx.globalAlpha = alpha0 * e;
        ctx.translate(0, (1 - e) * size * 0.25);
        if (key) {
          const wk = 1 - Math.pow(1 - clamp(range(t, t0 + 0.3, t0 + 0.75)), 3);
          if (wk > 0) {
            const padX = size * 0.14;
            const bw = (widths[i] + padX * 2) * wk;
            ctx.save();
            ctx.fillStyle = palette.primary;
            ctx.globalAlpha = alpha0 * e * 0.95;
            ctx.beginPath();
            ctx.roundRect(x - padX, y - size * 0.52, bw, size * 1.02, size * 0.14);
            ctx.fill();
            ctx.restore();
            // Text over the box: whichever of white / the stage's darkest colour reads.
            const onBox = luminance(palette.primary) > 0.45 ? palette.bg0 : "#ffffff";
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - padX, y - size, bw, size * 2);
            ctx.clip();
            ctx.fillStyle = onBox;
            drawGlyphs();
            ctx.restore();
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - padX + bw, y - size, widths[i] + padX * 2, size * 2);
            ctx.clip();
            drawGlyphs();
            ctx.restore();
            drawn = true;
          }
        }
      } else if (mode === "shine") {
        // Words rise in slightly dimmed; a light band then sweeps across the whole headline,
        // leaving what it has passed at full brightness (with a thin edge in the brand colour).
        ctx.globalAlpha = alpha0 * e;
        ctx.translate(0, (1 - e) * size * 0.3);
        const bx = sweep >= 1 ? Infinity : sweep <= 0 ? -Infinity : lineX0 - size + (total + size * 2) * sweep + li * size * 0.4;
        const lit = (x0: number, x1: number, style: string | CanvasGradient) => {
          if (x1 <= x0) return;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x0, y - size, x1 - x0, size * 2);
          ctx.clip();
          ctx.fillStyle = style;
          drawGlyphs();
          ctx.restore();
        };
        const x0 = x - size;
        const x1 = x + widths[i] + size;
        // Not yet swept: dimmed. Swept: full colour.
        lit(Math.max(x0, bx), x1, accent ? fill : mixHex(palette.text, palette.bg1, 0.42));
        lit(x0, Math.min(x1, bx), fill);
        if (sweep > 0 && sweep < 1) {
          const band = ctx.createLinearGradient(bx - size * 0.7, 0, bx + size * 0.25, 0);
          band.addColorStop(0, "rgba(255,255,255,0)");
          band.addColorStop(0.72, palette.light ? "rgba(255,255,255,0.95)" : "#ffffff");
          band.addColorStop(0.86, palette.primary);
          band.addColorStop(1, rgba(palette.primary, 0));
          lit(bx - size * 0.7, bx + size * 0.25, band);
        }
        drawn = true;
      } else {
        const blur = (1 - e) * (mode === "glow" ? 22 : 14) * u + exit * 10 * u;
        ctx.globalAlpha = alpha0 * e;
        if (blur > 0.6) ctx.filter = `blur(${blur.toFixed(1)}px)`;
        if (mode === "glow") {
          ctx.shadowColor = rgba(palette.primary, 0.8 * (1 - e * 0.6));
          ctx.shadowBlur = 30 * u;
        }
        ctx.translate(0, (1 - e) * size * (mode === "glow" ? 0.12 : 0.35) - exit * size * 0.2);
      }
      let cx = x;
      let complete = true;
      if (!drawn) {
        // Glyphs are placed by prefix width so kerning is kept: summing single-glyph widths
        // runs long and pushes the word into its neighbour.
        for (let ci = 0; ci < clean.length; ci++) {
          cx = charX(ci);
          if (gi >= visible) {
            cursor ??= { x: cx, y };
            complete = false;
            break;
          }
          ctx.fillText(clean[ci], cx, y);
          gi++;
        }
      } else gi += clean.length;
      if (complete) cx = x + widths[i];
      if (typing && gi >= visible) cursor ??= { x: cx, y };
      ctx.restore();
      gi++;
      x += widths[i] + space;
      wi++;
    });
  });
  if (typing) {
    // Block cursor: follows the typing, then blinks at the end of the line.
    const done = visible >= totalChars;
    const last = layout.lines.length - 1;
    const pos = cursor ?? { x: w / 2 + ctx.measureText(layout.lines[last].replace(/\*/g, "")).width / 2 + layout.size * 0.08, y: layout.ys[last] };
    if (t >= start && (!done || Math.floor(t * 2) % 2 === 0)) {
      ctx.save();
      ctx.globalAlpha = alpha0;
      ctx.fillStyle = palette.primary;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = 14 * u;
      ctx.fillRect(pos.x + layout.size * 0.04, pos.y - layout.size * 0.42, layout.size * 0.5, layout.size * 0.84);
      ctx.restore();
    }
  }
  ctx.textAlign = "center";
  return wi;
}

/** Glyphs the decode effect cycles through before a character locks in. */
const DECODE_GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>/?";

/** How far apart words start (× the scene's stagger) and how long each word's reveal takes. */
/**
 * Liquid headline: the finished type is drawn to an offscreen canvas, then poured in on the GPU
 * (gl.ts liquidText). Returns the word count, or null when WebGL isn't available.
 */
function liquidLayout(sc: SkillContext, layout: HeadlineLayout, start: number, stagger: number, opts: { alpha?: number; exitAt?: number; gradient?: [string, string] }): number | null {
  const { ctx, t, w } = sc;
  const size = layout.size;
  let maxW = 0;
  for (const line of layout.lines) {
    const words = line.split(" ").map((wd) => wd.replace(/\*/g, ""));
    const lw = words.reduce((a, wd) => a + ctx.measureText(wd).width + layout.tracking * Math.max(0, wd.length - 1), 0) + ctx.measureText(" ").width * (words.length - 1);
    maxW = Math.max(maxW, lw);
  }
  const padX = size * 0.45;
  const padTop = size * 1.2;
  const padBottom = size * 0.9;
  const bx = Math.floor(w / 2 - maxW / 2 - padX);
  const by = Math.floor(layout.ys[0] - size * 0.7 - padTop);
  const bw = Math.max(2, Math.ceil(maxW + padX * 2));
  const bh = Math.max(2, Math.ceil(layout.ys[layout.ys.length - 1] - layout.ys[0] + size * 1.4 + padTop + padBottom));
  const off = scratch("liquid-text", bw, bh);
  off.ctx.font = ctx.font;
  off.ctx.textBaseline = ctx.textBaseline;
  off.ctx.translate(-bx, -by);
  const settled = { ...sc, ctx: off.ctx, t: start + 60, look: sc.look ? { ...sc.look, text: "blur" as const } : undefined };
  const words = blurInLayout(settled, layout, start, stagger, { alpha: 1, gradient: opts.gradient });
  const exit = opts.exitAt !== undefined ? range(t, opts.exitAt, opts.exitAt + 0.45) : 0;
  const out = liquidText(off.canvas, {
    t: t - start,
    spread: Math.min(0.75, 0.2 + words * stagger * 0.6),
    dur: 0.7,
    exit,
    drop: (size * 0.85) / bh,
    goo: size * 0.2,
  });
  if (!out) return null;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.drawImage(out, bx, by, bw, bh);
  ctx.restore();
  return words;
}

const FX_PACE: Partial<Record<TextFx, { stagger: number; dur: number }>> = {
  blur: { stagger: 1, dur: 0.7 },
  mask: { stagger: 1, dur: 0.7 },
  pop: { stagger: 1, dur: 0.7 },
  glow: { stagger: 1.6, dur: 1.2 },
  type: { stagger: 1, dur: 0.7 },
  decode: { stagger: 0.9, dur: 0.7 },
  roll: { stagger: 1, dur: 0.7 },
  letters: { stagger: 1.1, dur: 0.7 },
  streak: { stagger: 0.8, dur: 0.75 },
  chroma: { stagger: 1, dur: 0.8 },
  flip: { stagger: 1, dur: 0.7 },
  focus: { stagger: 1.5, dur: 0.45 },
  highlight: { stagger: 1, dur: 0.6 },
  shine: { stagger: 1, dur: 0.6 },
};

function luminance(hex: string) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Shared "eyebrow" label above SaaS headlines (e.g. "Introducing", "Features"). */
export function eyebrow(sc: SkillContext, text: string, y: number, k: number) {
  if (k <= 0 || !text) return;
  const { ctx, u, palette } = sc;
  const icon = ROLE_ICONS[sc.scene.role as ConceptRole];
  const size = 27 * u;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  // Pad the label on the left to make room for the chapter icon.
  const label = icon ? `\u2002\u2002 ${text}` : text;
  const cy = y + (1 - k) * 10 * u;
  pill(sc, label, sc.w / 2, cy, {
    size,
    fill: rgba(palette.primary, 0.12),
    border: rgba(palette.primary, 0.45),
    color: palette.text,
  });
  if (icon) {
    ctx.font = subFont(size, 600);
    const tw = ctx.measureText(label).width;
    drawLucide(ctx, icon, sc.w / 2 - tw / 2 + size * 0.55, cy, size * 0.95, palette.primary, { progress: k });
  }
  ctx.restore();
}


/* ───────────────────────── Concept visuals (films without website imagery) ───────────────────────── */

/**
 * A film made from a text concept has no screenshots, product images or logo to show. These give
 * it visuals of its own: icons from the product's concept (developer tool, AI, fintech…), matched
 * to its words.
 */
export function imageless(sc: SkillContext) {
  const b = sc.brand;
  return !sc.scene.media && !b?.logo && !b?.images?.length && !b?.parts?.length;
}

/** The product's mark: its concept's lead icon (the same on every slide, like a logo). */
export function brandIcon(sc: SkillContext): IconKind {
  return (CONCEPT_MAP[sc.concept ?? "general"] ?? CONCEPT_MAP.general).icons[0] as IconKind;
}

/** The concept's icon family, with the brand's own icon first. */
export function conceptIcons(sc: SkillContext): IconKind[] {
  const set = (CONCEPT_MAP[sc.concept ?? "general"]?.icons ?? CONCEPT_MAP.general.icons) as IconKind[];
  const first = brandIcon(sc);
  return [first, ...set.filter((i) => i !== first)];
}

/**
 * A generated brand mark: a gradient tile with the product's icon in white (in place of a logo).
 * `k` scales it in; `glowAmt` 0..1.
 */
export function brandGlyph(sc: SkillContext, cx: number, cy: number, size: number, k = 1, glowAmt = 1) {
  if (k <= 0) return;
  const { ctx, u, palette } = sc;
  const s = size * k;
  ctx.save();
  ctx.translate(cx, cy);
  const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.shadowColor = rgba(palette.primary, 0.75 * glowAmt);
  ctx.shadowBlur = 40 * u * glowAmt;
  ctx.beginPath();
  ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.28);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Glassy top highlight and a hairline rim.
  const hl = ctx.createLinearGradient(0, -s / 2, 0, s * 0.1);
  hl.addColorStop(0, "rgba(255,255,255,0.35)");
  hl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hl;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(1, 1.2 * u);
  ctx.stroke();
  drawIcon(ctx, brandIcon(sc), 0, 0, s * 0.52, "#ffffff", clamp(k * 1.3));
  ctx.restore();
}

/**
 * A constellation of the concept's icons in glass tiles, floating at different depths around the
 * edges of the frame (the middle stays clear for the headline). Near tiles are larger, brighter and
 * drift more; far ones are small and dim. Tiles arrive on a stagger and leave with `fade`.
 */
export function iconConstellation(sc: SkillContext, opts: { count?: number; start?: number; fade?: number; clear?: number } = {}) {
  const { ctx, w, h, t, u, palette, seed } = sc;
  const icons = conceptIcons(sc);
  const n = opts.count ?? (h > w ? 7 : 9);
  const fade = 1 - (opts.fade ?? 0);
  if (fade <= 0) return;
  const r = rng(seed * 7 + 311);
  const portrait = h > w;
  // Keep a clear ellipse in the middle for the words.
  const clear = opts.clear ?? 1;
  // Landscape: an ellipse around the words. Portrait: the words fill the width, so the tiles sit in
  // bands above and below them instead.
  const tiles = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU + r() * 0.5 - 0.25 + 0.4;
    const z = 0.45 + r() * 0.55;
    let x: number;
    let y: number;
    if (portrait) {
      const top = i % 2 === 0;
      const slot = Math.floor(i / 2);
      const per = Math.ceil(n / 2);
      x = w * (0.14 + (0.72 * (slot + 0.5 + (r() - 0.5) * 0.5)) / per);
      y = top ? h * (0.1 + r() * 0.14) * (2 - clear) : h * (1 - (0.1 + r() * 0.15) * (2 - clear));
    } else {
      x = w / 2 + Math.cos(a) * w * 0.4 * (0.92 + r() * 0.16) * clear;
      y = h / 2 + Math.sin(a) * h * 0.36 * (0.9 + r() * 0.2) * clear;
    }
    return { x, y, z, icon: icons[i % icons.length], hue: [palette.primary, palette.secondary, palette.accent][i % 3], ph: r() * TAU, tilt: (r() - 0.5) * 0.3 };
  }).sort((p, q) => p.z - q.z);
  for (const [i, p] of tiles.entries()) {
    const k = clamp(spring(t - (opts.start ?? 0.1) - i * 0.07, 9, 7), 0, 1.08);
    if (k <= 0) continue;
    const drift = (6 + 14 * p.z) * u;
    const x = p.x + Math.sin(t * 0.45 + p.ph) * drift;
    const y = p.y + Math.cos(t * 0.38 + p.ph) * drift * 0.8 - t * 4 * u * p.z;
    const size = (54 + 58 * p.z) * u * (portrait ? 1.15 : 1);
    ctx.save();
    ctx.globalAlpha = clamp(k) * fade * (0.28 + 0.62 * p.z);
    ctx.translate(x, y);
    ctx.rotate(p.tilt + Math.sin(t * 0.3 + p.ph) * 0.04);
    ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
    glassCard(sc, -size / 2, -size / 2, size, size, { r: size * 0.26 });
    drawIcon(ctx, p.icon, 0, 0, size * 0.46, p.hue, clamp(k));
    ctx.restore();
  }
}
