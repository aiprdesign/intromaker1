import { clamp, ease, mixHex, noise1, range, rgba, rng } from "./math";
import { PALETTES } from "./palettes";
import { scratch } from "./scratch";
import { SKILL_MAP } from "./skills";
import type { Aspect, Palette, Scene, SkillContext, Transition, VideoPlan } from "./types";

export const TRANSITION_LEN = 0.45;

/** Transitions that need the incoming scene rendered to a buffer first. */
const BUFFERED = new Set<Transition>(["whip", "dolly"]);

export function aspectSize(aspect: Aspect, long: number) {
  if (aspect === "9:16") return { w: Math.round((long * 9) / 16), h: long };
  if (aspect === "1:1") return { w: Math.round((long * 9) / 16), h: Math.round((long * 9) / 16) };
  return { w: long, h: Math.round((long * 9) / 16) };
}

export function totalDuration(plan: VideoPlan) {
  return plan.scenes.reduce((a, s) => a + s.duration, 0);
}

export function sceneAt(plan: VideoPlan, time: number) {
  let start = 0;
  for (let i = 0; i < plan.scenes.length; i++) {
    const s = plan.scenes[i];
    if (time < start + s.duration || i === plan.scenes.length - 1) {
      return { index: i, scene: s, start, local: Math.max(0, Math.min(s.duration, time - start)) };
    }
    start += s.duration;
  }
  return null;
}

function resetCtx(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.filter = "none";
  ctx.setLineDash([]);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
}

export interface RenderOptions {
  /** Handheld drift + beat pulse camera. */
  camera?: boolean;
  bloom?: boolean;
  grade?: boolean;
  grain?: boolean;
  watermark?: string;
}

/** Render a single scene at local time t (used directly by the skill showcase). */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  plan: Pick<VideoPlan, "palette" | "font" | "seed"> & { bpm?: number; brand?: VideoPlan["brand"]; style?: VideoPlan["style"] },
  t: number,
  w: number,
  h: number,
  index = 0,
  opts: RenderOptions = {},
  globalT = t,
) {
  const palette = brandPalette(plan.palette, plan.brand);
  const beat = 60 / (plan.bpm ?? 120);
  const buffered = t < TRANSITION_LEN && BUFFERED.has(scene.transition);
  const target = buffered ? scratch("scene-buffer", w, h).ctx : ctx;
  const sc: SkillContext = {
    ctx: target,
    w,
    h,
    t,
    d: scene.duration,
    p: clamp(t / scene.duration),
    u: Math.min(w, h) / 1080,
    scene,
    palette,
    font: plan.font,
    seed: (plan.seed + index * 7919) >>> 0,
    beat,
    brand: plan.brand,
    style: plan.style,
  };
  resetCtx(target);
  target.save();
  if (opts.camera !== false) applyCamera(sc, globalT);
  applyTransitionIn(sc);
  SKILL_MAP[scene.skill].render(sc);
  target.restore();
  resetCtx(target);
  const out = { ...sc, ctx };
  if (buffered) compositeTransition(out, target.canvas);
  resetCtx(ctx);
  transitionOverlay(out);
  post(ctx, w, h, t, sc.seed, palette, opts, globalT);
}

/** Base palette with the brand's colours swapped in (backgrounds keep the base's darkness). */
export function brandPalette(id: VideoPlan["palette"], brand?: VideoPlan["brand"]): Palette {
  const base = PALETTES[id];
  const c = brand?.colors;
  if (!c) return base;
  return {
    ...base,
    primary: c.primary,
    secondary: c.secondary,
    accent: mixHex(c.primary, c.secondary, 0.5),
    bg1: mixHex(base.bg0, c.primary, 0.22),
  };
}

/** Render the whole plan at absolute time `time`. */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  plan: VideoPlan,
  time: number,
  w: number,
  h: number,
  opts: RenderOptions = {},
) {
  const at = sceneAt(plan, time);
  if (!at) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    return;
  }
  renderScene(ctx, at.scene, plan, at.local, w, h, at.index, opts, time);
}

/**
 * Virtual camera: slight overscan, slow handheld drift and a punch-in on every beat,
 * so even static typography breathes with the soundtrack.
 */
function applyCamera(sc: SkillContext, globalT: number) {
  const { ctx, w, h, u, beat } = sc;
  const phase = (globalT / beat) % 1;
  const bar = Math.floor(globalT / beat) % 4 === 0 ? 1.6 : 1;
  const pulse = Math.exp(-phase * 7) * 0.012 * bar;
  const s = 1.035 + pulse;
  const dx = noise1(globalT * 0.45, 11) * 9 * u;
  const dy = noise1(globalT * 0.37, 23) * 7 * u;
  const rot = noise1(globalT * 0.23, 37) * 0.007;
  ctx.translate(w / 2 + dx, h / 2 + dy);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.translate(-w / 2, -h / 2);
}

/** Composite a buffered incoming scene with a motion-blurred move. */
function compositeTransition(sc: SkillContext, frame: HTMLCanvasElement) {
  const { ctx, w, h, t, palette, seed } = sc;
  const k = range(t, 0, TRANSITION_LEN);
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(0, 0, w, h);
  if (sc.scene.transition === "whip") {
    // Whip pan: slide in with a smeared motion-blur trail.
    const e = ease.outExpo(k);
    const dir = seed % 2 ? 1 : -1;
    const off = (1 - e) * w * 0.9 * dir;
    const smear = (1 - e) * w * 0.35 * dir;
    const n = 8;
    for (let i = n; i >= 1; i--) {
      ctx.globalAlpha = 0.22;
      ctx.drawImage(frame, off + (smear * i) / n, 0);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(frame, off, 0);
  } else {
    // Dolly: rush in through a radial zoom blur.
    const e = ease.outCubic(k);
    const n = 8;
    for (let i = n; i >= 0; i--) {
      const sz = 1 + (1 - e) * (0.12 + (0.9 * i) / n);
      ctx.globalAlpha = i === 0 ? 1 : 0.16;
      ctx.drawImage(frame, (w - w * sz) / 2, (h - h * sz) / 2, w * sz, h * sz);
    }
  }
  ctx.globalAlpha = 1;
}

/** Transform applied before the skill draws (zoom-in punch). */
function applyTransitionIn(sc: SkillContext) {
  const { ctx, w, h, t, scene } = sc;
  if (scene.transition === "zoom") {
    const k = ease.outExpo(range(t, 0, TRANSITION_LEN));
    const s = 1 + (1 - k) * 0.35;
    ctx.translate(w / 2, h / 2);
    ctx.scale(s, s);
    ctx.rotate((1 - k) * 0.04);
    ctx.translate(-w / 2, -h / 2);
  }
}

/** Overlays drawn after the skill (flash, glitch, wipe). */
function transitionOverlay(sc: SkillContext) {
  const { ctx, w, h, t, scene, palette, seed } = sc;
  const k = range(t, 0, TRANSITION_LEN);
  if (k >= 1) return;
  switch (scene.transition) {
    case "flash":
    case "zoom": {
      ctx.fillStyle = scene.transition === "flash" ? "#ffffff" : palette.text;
      ctx.globalAlpha = (1 - ease.outCubic(k)) * (scene.transition === "flash" ? 0.9 : 0.4);
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      break;
    }
    case "glitch": {
      const src = scratch("transition-copy", w, h);
      src.ctx.drawImage(ctx.canvas, 0, 0, w, h);
      const r = rng(seed + Math.floor(t * 40));
      const g = 1 - k;
      const n = 12;
      for (let i = 0; i < n; i++) {
        const y = (i / n) * h;
        const sh = h / n;
        const off = (r() - 0.5) * w * 0.25 * g;
        ctx.drawImage(src.canvas, 0, y, w, sh, off, y, w, sh);
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.3 * g;
      ctx.drawImage(src.canvas, 12 * g * sc.u, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      break;
    }
    case "leak": {
      // Warm light leak blooms across the frame and burns off.
      const a = Math.pow(1 - k, 1.4);
      ctx.globalCompositeOperation = "screen";
      const blobs: [number, number, string][] = [
        [-0.1 + k * 0.9, 0.3, palette.secondary],
        [0.2 + k * 1.1, 0.75, palette.primary],
        [0.5 + k * 0.6, 0.1, "#ffd9a8"],
      ];
      for (const [x, y, c] of blobs) {
        const r = Math.max(w, h) * 0.7;
        const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r);
        g.addColorStop(0, rgba(c, 0.95 * a));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = Math.pow(1 - k, 3) * 0.6;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      break;
    }
    case "shutter": {
      // Letterbox shutters snap open from the centre line.
      const open = ease.outExpo(k);
      const bh = (1 - open) * (h / 2);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, bh);
      ctx.fillRect(0, h - bh, w, bh);
      ctx.fillStyle = palette.primary;
      ctx.globalAlpha = 1 - open;
      ctx.fillRect(0, bh - 2 * sc.u, w, 4 * sc.u);
      ctx.fillRect(0, h - bh - 2 * sc.u, w, 4 * sc.u);
      ctx.globalAlpha = 1;
      break;
    }
    case "whip":
    case "dolly": {
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = Math.pow(1 - k, 4) * 0.35;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      break;
    }
    case "wipe": {
      // A colour panel slides off to the right, uncovering the scene.
      const e = ease.inOutExpo(k);
      const x = e * w * 1.2;
      ctx.fillStyle = palette.primary;
      ctx.fillRect(x, 0, w * 1.2, h);
      ctx.fillStyle = palette.secondary;
      ctx.fillRect(x - 24 * sc.u, 0, 24 * sc.u, h);
      break;
    }
    default:
      break;
  }
}

let grainTile: HTMLCanvasElement | null = null;
function getGrain() {
  if (grainTile) return grainTile;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const img = g.createImageData(256, 256);
  const r = rng(1234);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(r() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 22;
  }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

/**
 * Finishing pass: thresholded two-scale bloom, colour grade, drifting light leaks,
 * foreground lens bokeh, vignette and film grain.
 */
function post(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  seed: number,
  palette: Palette,
  opts: RenderOptions,
  globalT: number,
) {
  const u = Math.min(w, h) / 1080;
  if (opts.bloom !== false) {
    // Highlights only (contrast/brightness filter acts as a soft threshold), at two radii.
    const passes: [number, number][] = [
      [6, 0.38],
      [20, 0.34],
    ];
    for (const [div, alpha] of passes) {
      const bw = Math.max(1, Math.round(w / div));
      const bh = Math.max(1, Math.round(h / div));
      const b = scratch(`bloom-${div}`, bw, bh);
      b.ctx.imageSmoothingEnabled = true;
      b.ctx.filter = "brightness(0.85) contrast(2.2) saturate(1.3)";
      b.ctx.drawImage(ctx.canvas, 0, 0, bw, bh);
      b.ctx.filter = "none";
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(b.canvas, 0, 0, w, h);
      ctx.restore();
    }
  }

  // Colour grade: punchier contrast and saturation.
  if (opts.grade !== false) {
    const g = scratch("grade", w, h, false);
    g.ctx.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.filter = "contrast(1.1) saturate(1.18)";
    ctx.drawImage(g.canvas, 0, 0);
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  // Slow light leaks drifting in from the edges.
  const leaks: [number, number, string, number][] = [
    [0.05 + 0.08 * Math.sin(globalT * 0.3), 0.0, palette.secondary, 0.16],
    [0.95 + 0.06 * Math.cos(globalT * 0.25), 1.0, palette.primary, 0.12],
  ];
  for (const [x, y, c, a] of leaks) {
    const r = Math.max(w, h) * 0.55;
    const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r);
    const breathe = a * (0.75 + 0.25 * Math.sin(globalT * 0.9 + x * 5));
    g.addColorStop(0, rgba(c, breathe));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // Out-of-focus foreground bokeh for depth.
  const r = rng(seed * 3 + 17);
  for (let i = 0; i < 7; i++) {
    const bx = (r() * 1.2 - 0.1 + globalT * (0.01 + r() * 0.02)) % 1.2;
    const by = r();
    const br = (60 + r() * 140) * u;
    const c = r() > 0.5 ? palette.primary : palette.secondary;
    const a = 0.05 + 0.07 * (0.5 + 0.5 * Math.sin(globalT * (0.5 + r()) + i));
    const g = ctx.createRadialGradient(bx * w, by * h, br * 0.6, bx * w, by * h, br);
    g.addColorStop(0, rgba(c, a));
    g.addColorStop(0.85, rgba(c, a * 0.8));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx * w, by * h, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  if (opts.grain !== false) {
    const g = getGrain();
    const r = rng(seed + Math.floor(t * 24));
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.translate(-r() * 256, -r() * 256);
    ctx.fillStyle = ctx.createPattern(g, "repeat")!;
    ctx.fillRect(0, 0, w + 256, h + 256);
    ctx.restore();
  }
  if (opts.watermark) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${Math.round(20 * u)}px Inter, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(opts.watermark, w - 24 * u, h - 20 * u);
    ctx.restore();
  }
}
