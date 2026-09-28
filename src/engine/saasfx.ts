/**
 * Design toolkit for modern SaaS launch-video aesthetics (Linear / Vercel / Stripe / Apple):
 * sentence-case type with blur-in, spring physics, grid + spotlight + travelling beams,
 * glass cards with animated border beams, a macOS cursor with click ripples, and icon glyphs.
 */
import { headline } from "./fx";
import { clamp, mixHex, range, rgba, rng, TAU } from "./math";
import { scratch } from "./scratch";
import { renderShaderBg } from "./shaderbg";
import { subFont, type HeadlineLayout } from "./text";
import type { FontId, SkillContext } from "./types";

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

export type IconKind =
  | "bolt"
  | "chart"
  | "shield"
  | "users"
  | "sparkle"
  | "globe"
  | "clock"
  | "check"
  | "chat"
  | "cloud"
  | "layers"
  | "code";

/** Pick a glyph that matches a feature's wording. */
export function iconFor(label: string, i: number): IconKind {
  const l = label.toLowerCase();
  if (/fast|speed|instant|quick|performance|second/.test(l)) return "bolt";
  if (/secur|privacy|safe|complian|encrypt|trust/.test(l)) return "shield";
  if (/team|collab|together|people|member|share/.test(l)) return "users";
  if (/insight|analytic|report|data|metric|dashboard|forecast|revenue|growth/.test(l)) return "chart";
  if (/ai\b|smart|automat|magic|intelligen|assist/.test(l)) return "sparkle";
  if (/global|world|anywhere|language|region/.test(l)) return "globe";
  if (/time|schedul|real-time|realtime|minute|hour/.test(l)) return "clock";
  if (/chat|message|support|comment|feedback/.test(l)) return "chat";
  if (/cloud|sync|backup|storage|deploy/.test(l)) return "cloud";
  if (/integrat|connect|tool|app|plugin|workflow|pipeline/.test(l)) return "layers";
  if (/api|code|developer|sdk|build/.test(l)) return "code";
  return (["check", "sparkle", "bolt", "chart", "layers", "shield"] as IconKind[])[i % 6];
}

/** Simple line-art glyphs, drawn centred in a size×size box. */
export function drawIcon(ctx: CanvasRenderingContext2D, kind: IconKind, cx: number, cy: number, size: number, color: string) {
  const s = size / 24;
  ctx.save();
  ctx.translate(cx - 12 * s, cy - 12 * s);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  switch (kind) {
    case "bolt":
      ctx.moveTo(13, 2);
      ctx.lineTo(4, 14);
      ctx.lineTo(12, 14);
      ctx.lineTo(11, 22);
      ctx.lineTo(20, 10);
      ctx.lineTo(12, 10);
      ctx.closePath();
      ctx.stroke();
      break;
    case "chart":
      ctx.moveTo(3, 21);
      ctx.lineTo(21, 21);
      ctx.moveTo(6, 17);
      ctx.lineTo(6, 12);
      ctx.moveTo(11, 17);
      ctx.lineTo(11, 7);
      ctx.moveTo(16, 17);
      ctx.lineTo(16, 10);
      ctx.moveTo(21, 17);
      ctx.lineTo(21, 4);
      ctx.stroke();
      break;
    case "shield":
      ctx.moveTo(12, 2);
      ctx.lineTo(20, 5);
      ctx.lineTo(20, 11);
      ctx.bezierCurveTo(20, 16, 16.5, 20, 12, 22);
      ctx.bezierCurveTo(7.5, 20, 4, 16, 4, 11);
      ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.moveTo(8.5, 12);
      ctx.lineTo(11, 14.5);
      ctx.lineTo(15.5, 9.5);
      ctx.stroke();
      break;
    case "users":
      ctx.arc(9, 8, 3.5, 0, TAU);
      ctx.moveTo(19.5, 9);
      ctx.arc(17, 9, 2.5, 0, TAU);
      ctx.moveTo(2, 20);
      ctx.bezierCurveTo(2, 15, 16, 15, 16, 20);
      ctx.moveTo(16.5, 14);
      ctx.bezierCurveTo(19, 14, 22, 15.5, 22, 19);
      ctx.stroke();
      break;
    case "sparkle":
      ctx.moveTo(12, 2);
      ctx.quadraticCurveTo(13, 11, 22, 12);
      ctx.quadraticCurveTo(13, 13, 12, 22);
      ctx.quadraticCurveTo(11, 13, 2, 12);
      ctx.quadraticCurveTo(11, 11, 12, 2);
      ctx.fill();
      break;
    case "globe":
      ctx.arc(12, 12, 9.5, 0, TAU);
      ctx.moveTo(2.5, 12);
      ctx.lineTo(21.5, 12);
      ctx.moveTo(12, 2.5);
      ctx.bezierCurveTo(7, 7, 7, 17, 12, 21.5);
      ctx.moveTo(12, 2.5);
      ctx.bezierCurveTo(17, 7, 17, 17, 12, 21.5);
      ctx.stroke();
      break;
    case "clock":
      ctx.arc(12, 12, 9.5, 0, TAU);
      ctx.moveTo(12, 6.5);
      ctx.lineTo(12, 12);
      ctx.lineTo(16, 14);
      ctx.stroke();
      break;
    case "chat":
      ctx.roundRect(3, 4, 18, 13, 4);
      ctx.moveTo(8, 17);
      ctx.lineTo(7, 21);
      ctx.lineTo(12, 17);
      ctx.stroke();
      break;
    case "cloud":
      ctx.moveTo(7, 19);
      ctx.bezierCurveTo(2, 19, 2, 12, 7, 12);
      ctx.bezierCurveTo(7, 6, 16, 5, 17, 11);
      ctx.bezierCurveTo(22, 11, 22, 19, 17, 19);
      ctx.closePath();
      ctx.stroke();
      break;
    case "layers":
      ctx.moveTo(12, 3);
      ctx.lineTo(21, 8);
      ctx.lineTo(12, 13);
      ctx.lineTo(3, 8);
      ctx.closePath();
      ctx.moveTo(3, 12.5);
      ctx.lineTo(12, 17.5);
      ctx.lineTo(21, 12.5);
      ctx.moveTo(3, 17);
      ctx.lineTo(12, 22);
      ctx.lineTo(21, 17);
      ctx.stroke();
      break;
    case "code":
      ctx.moveTo(8, 7);
      ctx.lineTo(3, 12);
      ctx.lineTo(8, 17);
      ctx.moveTo(16, 7);
      ctx.lineTo(21, 12);
      ctx.lineTo(16, 17);
      ctx.moveTo(13.5, 4);
      ctx.lineTo(10.5, 20);
      ctx.stroke();
      break;
    default:
      ctx.arc(12, 12, 9.5, 0, TAU);
      ctx.moveTo(7.5, 12);
      ctx.lineTo(10.5, 15);
      ctx.lineTo(16.5, 9);
      ctx.stroke();
  }
  ctx.restore();
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
  let wi = 0;
  // Typewriter mode: characters appear one by one behind a block cursor.
  const typing = sc.look?.text === "type";
  const totalChars = layout.lines.reduce((a, l) => a + l.replace(/\*/g, "").length + 1, 0);
  const charDur = Math.min(0.045, 1.5 / Math.max(1, totalChars));
  const visible = typing ? Math.floor(Math.max(0, t - start) / charDur) : Infinity;
  let gi = 0;
  let cursor: { x: number; y: number } | null = null;
  layout.lines.forEach((line, li) => {
    const y = layout.ys[li];
    const words = line.split(" ");
    const widths = words.map((wd) => ctx.measureText(wd.replace(/\*/g, "")).width + layout.tracking * Math.max(0, wd.length - 1));
    const space = ctx.measureText(" ").width;
    const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    let x = w / 2 - total / 2;
    words.forEach((word, i) => {
      const accent = /^\*.*\*$/.test(word) || word.startsWith("*") || word.endsWith("*");
      const clean = word.replace(/\*/g, "");
      const mode = sc.look?.text ?? "blur";
      const t0 = start + wi * stagger * (mode === "glow" ? 1.6 : 1);
      const k = clamp(range(t, t0, t0 + (mode === "glow" ? 1.2 : 0.7)));
      const e = mode === "glow" ? k * k * (3 - 2 * k) : 1 - Math.pow(1 - k, 3);
      ctx.save();
      if (mode === "type") {
        ctx.globalAlpha = (opts.alpha ?? 1) * (1 - exit);
      } else if (mode === "mask") {
        // Crisp editorial reveal: each word slides up out of a mask.
        const m = 1 - Math.pow(1 - clamp(range(t, t0, t0 + 0.55)), 4);
        ctx.beginPath();
        ctx.rect(x - layout.size * 0.1, y - layout.size * 0.62, widths[i] + layout.size * 0.2, layout.size * 1.24);
        ctx.clip();
        ctx.globalAlpha = (opts.alpha ?? 1) * (1 - exit);
        ctx.translate(0, (1 - m) * layout.size * 1.1 - exit * layout.size * 1.1);
      } else if (mode === "pop") {
        // Bouncy: words spring up from small.
        const s = Math.max(0, spring(t - t0, 13, 6));
        ctx.globalAlpha = (opts.alpha ?? 1) * clamp((t - t0) / 0.12) * (1 - exit);
        const cx = x + widths[i] / 2;
        // Overshoot only as far as the word gap allows, so neighbours never collide.
        const sz = Math.min(0.3 + 0.7 * s * (1 - exit * 0.5), 1 + (space * 0.9) / Math.max(1, widths[i]));
        ctx.translate(cx, y);
        ctx.scale(sz, sz);
        ctx.rotate((1 - Math.min(1, s)) * (wi % 2 ? 0.12 : -0.12));
        ctx.translate(-cx, -y);
      } else {
        const blur = (1 - e) * (mode === "glow" ? 22 : 14) * u + exit * 10 * u;
        ctx.globalAlpha = (opts.alpha ?? 1) * e * (1 - exit);
        if (blur > 0.6) ctx.filter = `blur(${blur.toFixed(1)}px)`;
        if (mode === "glow") {
          ctx.shadowColor = rgba(palette.primary, 0.8 * (1 - e * 0.6));
          ctx.shadowBlur = 30 * u;
        }
        ctx.translate(0, (1 - e) * layout.size * (mode === "glow" ? 0.12 : 0.35) - exit * layout.size * 0.2);
      }
      if (accent) {
        const g = ctx.createLinearGradient(x, y - layout.size / 2, x + widths[i], y + layout.size / 2);
        g.addColorStop(0, (opts.gradient ?? [palette.primary, palette.secondary])[0]);
        g.addColorStop(1, (opts.gradient ?? [palette.primary, palette.secondary])[1]);
        ctx.fillStyle = g;
      } else ctx.fillStyle = palette.text;
      ctx.textAlign = "left";
      let cx = x;
      for (const ch of clean) {
        if (gi >= visible) {
          cursor ??= { x: cx, y };
          break;
        }
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width + layout.tracking;
        gi++;
      }
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
      ctx.globalAlpha = (opts.alpha ?? 1) * (1 - exit);
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

/** Shared "eyebrow" label above SaaS headlines (e.g. "Introducing", "Features"). */
export function eyebrow(sc: SkillContext, text: string, y: number, k: number) {
  if (k <= 0 || !text) return;
  const { ctx, u, palette } = sc;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  pill(sc, text, sc.w / 2, y + (1 - k) * 10 * u, {
    size: 27 * u,
    fill: rgba(palette.primary, 0.12),
    border: rgba(palette.primary, 0.45),
    color: palette.text,
  });
  ctx.restore();
}

