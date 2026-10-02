import { clamp, ease, mix, mixHex, range, rgba, rng, TAU } from "./math";
import { displayFont, drawTracked, layoutHeadline, subFont, type HeadlineLayout } from "./text";
import type { SkillContext } from "./types";

/** Deep radial background with a slow drifting hotspot. */
export function background(sc: SkillContext, opts: { hot?: string; hotAlpha?: number } = {}) {
  const { ctx, w, h, t, palette } = sc;
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(0, 0, w, h);
  const cx = w * (0.5 + Math.sin(t * 0.4) * 0.08);
  const cy = h * (0.45 + Math.cos(t * 0.3) * 0.06);
  const r = Math.max(w, h) * 0.8;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, palette.bg1);
  g.addColorStop(1, palette.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Soft overhead key light for depth.
  const kl = ctx.createRadialGradient(w / 2, -h * 0.25, 0, w / 2, -h * 0.25, h * 1.1);
  kl.addColorStop(0, rgba(palette.primary, 0.1));
  kl.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = kl;
  ctx.fillRect(0, 0, w, h);
  if (opts.hot) {
    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.6);
    g2.addColorStop(0, rgba(opts.hot, opts.hotAlpha ?? 0.18));
    g2.addColorStop(1, rgba(opts.hot, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);
  }
}

/** Standard headline layout for a scene. */
export function headline(
  sc: SkillContext,
  opts: { cy?: number; widthFrac?: number; sizeFrac?: number; maxLines?: number; text?: string; natural?: boolean; font?: SkillContext["font"] } = {},
): HeadlineLayout {
  const { ctx, w, h, scene } = sc;
  const font = opts.font ?? sc.font;
  const short = Math.min(w, h);
  const layout = layoutHeadline(ctx, opts.text ?? scene.text, font, {
    w,
    h,
    cx: w / 2,
    cy: opts.cy ?? h / 2,
    maxWidth: w * (opts.widthFrac ?? 0.84),
    maxSize: short * (opts.sizeFrac ?? 0.3),
    maxLines: opts.maxLines,
    natural: opts.natural,
  });
  ctx.font = displayFont(font, layout.size);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  return layout;
}

/** Vertical gradient fill spanning the headline block. */
export function headlineGradient(sc: SkillContext, layout: HeadlineLayout, top: string, bottom: string) {
  const y0 = layout.ys[0] - layout.size / 2;
  const y1 = layout.ys[layout.ys.length - 1] + layout.size / 2;
  const g = sc.ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}

export function drawLayout(sc: SkillContext, layout: HeadlineLayout, mode: "fill" | "stroke" = "fill") {
  layout.lines.forEach((line, i) => drawTracked(sc.ctx, line, sc.w / 2, layout.ys[i], layout.tracking, mode));
}

/** Supporting line with a left-to-right wipe reveal. */
export function subline(sc: SkillContext, y: number, reveal: number, opts: { color?: string; alpha?: number; text?: string } = {}) {
  const text = (opts.text ?? sc.scene.subtext ?? "").toUpperCase();
  if (!text || reveal <= 0) return;
  const { ctx, w, u } = sc;
  const size = Math.min(34 * u, (w * 0.8) / Math.max(8, text.length * 0.85));
  ctx.save();
  ctx.font = subFont(size, 600);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const tracking = size * 0.32;
  const width = ctx.measureText(text).width + tracking * (text.length - 1);
  const x0 = w / 2 - width / 2 - size;
  const r = ease.outCubic(clamp(reveal));
  ctx.beginPath();
  ctx.rect(x0, y - size, (width + size * 2) * r, size * 2);
  ctx.clip();
  ctx.globalAlpha = opts.alpha ?? 0.9;
  ctx.fillStyle = opts.color ?? sc.palette.text;
  drawTracked(ctx, text, w / 2, y, tracking);
  ctx.restore();
  // Leading accent bar that rides the wipe edge.
  if (r < 1) {
    ctx.save();
    ctx.fillStyle = sc.palette.primary;
    ctx.fillRect(x0 + (width + size * 2) * r - 3 * u, y - size * 0.7, 6 * u, size * 1.4);
    ctx.restore();
  }
}

/** Exit factor 0..1 over the last `len` seconds of a scene. */
export function exitT(sc: SkillContext, len = 0.35) {
  return range(sc.t, sc.d - len, sc.d);
}

/** Drifting starfield / dust. */
export function dust(sc: SkillContext, count: number, color: string, speed = 1, seedOffset = 0) {
  const { ctx, w, h, t, u, seed } = sc;
  const r = rng(seed + 991 + seedOffset);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = r() * w;
    const y0 = r() * h;
    const z = 0.3 + r() * 0.7;
    const y = (((y0 - t * 30 * speed * z * u) % h) + h) % h;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + r() * 3) + i);
    ctx.globalAlpha = 0.15 + 0.5 * z * tw;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + Math.sin(t * 0.5 + i) * 6 * u, y, (0.8 + z * 1.8) * u, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Radial speed lines from the centre, used on impacts. */
export function speedLines(sc: SkillContext, intensity: number, color: string) {
  if (intensity <= 0.01) return;
  const { ctx, w, h, seed, t } = sc;
  const r = rng(seed + Math.floor(t * 24));
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.hypot(w, h) / 2;
  ctx.save();
  ctx.strokeStyle = color;
  for (let i = 0; i < 70; i++) {
    const a = r() * TAU;
    const r0 = R * (0.35 + r() * 0.35);
    ctx.globalAlpha = intensity * (0.2 + r() * 0.6);
    ctx.lineWidth = 1 + r() * 3 * sc.u;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * R * 1.1, cy + Math.sin(a) * R * 1.1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Screen shake offset that decays after an impact time. */
export function shake(sc: SkillContext, impactT: number, amount = 18, decay = 0.35) {
  const dt = sc.t - impactT;
  if (dt < 0 || dt > decay) return { x: 0, y: 0 };
  const k = (1 - dt / decay) ** 2 * amount * sc.u;
  return { x: Math.sin(dt * 90) * k, y: Math.cos(dt * 73) * k };
}

/** Full-frame colour flash. */
export function flash(sc: SkillContext, amount: number, color = "#ffffff") {
  if (amount <= 0.001) return;
  const { ctx, w, h } = sc;
  ctx.save();
  ctx.globalAlpha = clamp(amount);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Glow helper: sets canvas shadow for bloom-y strokes/fills. */
export function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  if (crisp) return noGlow(ctx);
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Crisp text: with glow switched off, text is drawn without its halo. Every glow on type is a
 * centred canvas shadow, so text draws simply skip a shadow that has no offset (drop shadows
 * with an offset stay). Set per frame by the renderer from the plan's `glow` setting.
 */
let crisp = false;
let patched = false;
export function setCrispText(on: boolean) {
  crisp = on;
  if (!on || patched || typeof CanvasRenderingContext2D === "undefined") return;
  patched = true;
  const protos: { fillText: CanvasText["fillText"]; strokeText: CanvasText["strokeText"] }[] = [CanvasRenderingContext2D.prototype];
  if (typeof OffscreenCanvasRenderingContext2D !== "undefined") protos.push(OffscreenCanvasRenderingContext2D.prototype);
  for (const proto of protos) {
    for (const name of ["fillText", "strokeText"] as const) {
      const draw = proto[name];
      proto[name] = function (this: CanvasRenderingContext2D, ...args: Parameters<CanvasText["fillText"]>) {
        if (!crisp || this.shadowBlur <= 0 || this.shadowOffsetX || this.shadowOffsetY) return draw.apply(this, args);
        const blur = this.shadowBlur;
        this.shadowBlur = 0;
        draw.apply(this, args);
        this.shadowBlur = blur;
      };
    }
  }
}

export function noGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

/**
 * Solid 3D extrusion behind a headline: stacked, progressively darker copies plus a soft
 * contact shadow. Call before drawing the face of the text.
 */
export function extrude(
  sc: SkillContext,
  layout: HeadlineLayout,
  opts: { depth?: number; color?: string; dx?: number; dy?: number } = {},
) {
  const { ctx, u, palette } = sc;
  const depth = (opts.depth ?? 16) * u * (layout.size / (200 * u));
  const side = opts.color ?? mixHex(palette.primary, palette.bg0, 0.55);
  const dx = opts.dx ?? 0.35;
  const dy = opts.dy ?? 1;
  const steps = Math.max(4, Math.min(24, Math.round(depth / (1.2 * u))));
  ctx.save();
  // Contact shadow under the whole block.
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 40 * u;
  ctx.shadowOffsetY = 24 * u;
  for (let i = steps; i >= 1; i--) {
    const k = i / steps;
    ctx.save();
    ctx.translate(dx * depth * k, dy * depth * k);
    ctx.fillStyle = mix(side, "#000000", k * 0.65);
    drawLayout(sc, layout);
    ctx.restore();
    if (i === steps) noGlow(ctx);
  }
  ctx.restore();
}

/** Thin bright highlight along the top edge of the glyphs (a bevel catch-light). */
export function bevel(sc: SkillContext, layout: HeadlineLayout, alpha = 0.55) {
  const { ctx, u } = sc;
  ctx.save();
  ctx.beginPath();
  layout.ys.forEach((y) => ctx.rect(0, y - layout.size * 0.6, sc.w, layout.size * 0.35));
  ctx.clip();
  ctx.globalAlpha *= alpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.translate(0, -1.5 * u);
  drawLayout(sc, layout);
  ctx.restore();
}

/**
 * A diagonal band of light that sweeps once across a box. It starts fully off one side and ends
 * fully off the other, and draws nothing before or after, so it never parks on a corner. `p`
 * (0..1) is the sweep's progress; the band travels along a direction tilted `slant` radians below
 * horizontal, `width` is its half-width as a fraction of the box's longer side.
 */
export function lightSweep(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  p: number,
  opts: { alpha?: number; width?: number; slant?: number; op?: GlobalCompositeOperation; color?: string } = {},
) {
  if (p <= 0 || p >= 1 || w <= 0 || h <= 0) return;
  const slant = opts.slant ?? 0.35;
  const dx = Math.cos(slant);
  const dy = Math.sin(slant);
  const band = (opts.width ?? 0.18) * Math.max(w, h);
  // Where the box's corners fall along the travel axis: the band runs from before the first to past the last.
  const along = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ].map(([px, py]) => px * dx + py * dy);
  const lo = Math.min(...along) - band;
  const hi = Math.max(...along) + band;
  const c = lo + (hi - lo) * p;
  const g = ctx.createLinearGradient((c - band) * dx, (c - band) * dy, (c + band) * dx, (c + band) * dy);
  const col = opts.color ?? "255,255,255";
  g.addColorStop(0, `rgba(${col},0)`);
  g.addColorStop(0.5, `rgba(${col},${opts.alpha ?? 0.6})`);
  g.addColorStop(1, `rgba(${col},0)`);
  ctx.save();
  if (opts.op) ctx.globalCompositeOperation = opts.op;
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
