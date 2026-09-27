import { clamp, ease, range, rgba, rng } from "./math";
import { PALETTES } from "./palettes";
import { scratch } from "./scratch";
import { SKILL_MAP } from "./skills";
import type { Aspect, Scene, SkillContext, VideoPlan } from "./types";

export const TRANSITION_LEN = 0.4;

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
  bloom?: boolean;
  grain?: boolean;
  watermark?: string;
}

/** Render a single scene at local time t (used by the skill showcase). */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  plan: Pick<VideoPlan, "palette" | "font" | "seed">,
  t: number,
  w: number,
  h: number,
  index = 0,
  opts: RenderOptions = {},
) {
  const palette = PALETTES[plan.palette];
  const sc: SkillContext = {
    ctx,
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
  };
  resetCtx(ctx);
  ctx.save();
  applyTransitionIn(sc);
  SKILL_MAP[scene.skill].render(sc);
  ctx.restore();
  resetCtx(ctx);
  transitionOverlay(sc);
  post(ctx, w, h, t, sc.seed, palette.primary, opts);
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
  renderScene(ctx, at.scene, plan, at.local, w, h, at.index, opts);
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

/** Bloom, vignette and film grain. */
function post(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  seed: number,
  tint: string,
  opts: RenderOptions,
) {
  if (opts.bloom !== false) {
    // Downsample → upscale gives a cheap soft glow.
    const bw = Math.max(1, Math.round(w / 8));
    const bh = Math.max(1, Math.round(h / 8));
    const b = scratch("bloom", bw, bh);
    b.ctx.imageSmoothingEnabled = true;
    b.ctx.drawImage(ctx.canvas, 0, 0, bw, bh);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.45;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(b.canvas, 0, 0, w, h);
    ctx.restore();
  }
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgba(tint, 0.02);
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
    const u = Math.min(w, h) / 1080;
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
