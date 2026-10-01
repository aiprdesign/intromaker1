import { arrange, energyAt, sinceDrop, sinceKick, type Arrangement } from "./arrange";
import { clamp, ease, mixHex, noise1, range, rgba, rng } from "./math";
import { tokens } from "./grid";
import { styleOf } from "./music";
import { captionAt } from "./voice";
import { PALETTES } from "./palettes";
import { brandFontReady } from "./fonts";
import { scratch } from "./scratch";
import { drawLogo, getImage } from "./media";
import { withPlaceholders } from "./placeholders";
import { setBrandFont, subFont } from "./text";
import { SKILL_MAP } from "./skills";
import { saasBackground } from "./saasfx";
import { setCrispText } from "./fx";
import { liquidWipe, loadTransitions, renderTransition, transitionsReady } from "./gl";
import type { Aspect, MusicPulse, Palette, Scene, SkillContext, Transition, VideoPlan } from "./types";

export const TRANSITION_LEN = 0.45;

/** Transitions where outgoing and incoming shots overlap on screen. */
export const OVERLAP = new Set<Transition>(["whip", "dolly", "push", "dissolve", "leak", "liquid", "cube"]);
/** How long past its end an overlapped scene keeps rendering (exit suppressed). */
const OVERLAP_EXTEND = TRANSITION_LEN + 0.25;

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

type PlanLike = Pick<VideoPlan, "palette" | "font" | "seed"> & {
  bpm?: number;
  brand?: VideoPlan["brand"];
  product?: boolean;
  style?: VideoPlan["style"];
  look?: VideoPlan["look"];
  scheme?: VideoPlan["scheme"];
  glow?: VideoPlan["glow"];
  textFx?: VideoPlan["textFx"];
  concept?: VideoPlan["concept"];
};

/** Renders exactly like an absent look (bokeh on, one beam set, full aurora, grid). */
const NO_LOOK: NonNullable<VideoPlan["look"]> = { grid: true, beams: 1, aurora: 1, bokeh: true };

/** Draw a scene's content (camera + skill), without transitions or post, into `target`. */
function drawScene(
  target: CanvasRenderingContext2D,
  scene: Scene,
  plan: PlanLike,
  t: number,
  w: number,
  h: number,
  index: number,
  opts: RenderOptions,
  globalT: number,
  /** Pretend-duration: extended when the next scene overlaps, so this one doesn't play its exit. */
  d = scene.duration,
  transitionIn = true,
  music?: MusicPulse,
) {
  // A slide that shows your pictures but has none yet shows a placeholder graphic in their place.
  ({ scene, plan } = withPlaceholders(scene, plan));
  const palette = brandPalette(plan.palette, plan.brand, schemeOf(plan));
  const beat = 60 / (plan.bpm ?? 120);
  const saas = plan.style === "saas";
  // Beat-locked motion: within each beat, animation is front-loaded so moves hit on the beat and
  // ease before the next. Exact on every beat (so beat-timed moments and sound cues don't move).
  // Video scenes keep real time (their footage would stutter).
  const tl = saas && scene.media?.kind !== "video" ? beatLock(t, beat) : t;
  const sc: SkillContext = {
    ctx: target,
    w,
    h,
    t: tl,
    d,
    p: clamp(tl / d),
    u: Math.min(w, h) / 1080,
    scene,
    palette,
    font: plan.font,
    seed: (plan.seed + index * 7919) >>> 0,
    beat,
    brand: plan.brand,
    style: plan.style,
    // The studio's text effect overrides the template's. (A plan without a look renders like
    // NO_LOOK, so the override starts from that.)
    look: plan.textFx ? { ...(plan.look ?? NO_LOOK), text: plan.textFx } : plan.look,
    globalT,
    concept: plan.concept,
    product: plan.product,
    music,
  };
  resetCtx(target);
  // Product shots float on a gently tilted, orbiting plane in every SaaS style (the 3D styles
  // set their own depth); headline, logo and closing shots stay flat so their type reads cleanly.
  const styleDepth = plan.style === "saas" ? plan.look?.depth ?? 0 : 0;
  const depth = styleDepth || (plan.style === "saas" && PRODUCT_SHOTS.has(scene.skill) ? 10 : 0);
  // The default product stage only leans back: rows and cards stay perfectly level.
  const level = !styleDepth;
  const turn = plan.style === "saas" ? plan.look?.turn ?? 0 : 0;
  const slab = plan.style === "saas" && !!plan.look?.slab;
  // Exit: when the next shot simply cuts in, this shot's content leaves on its last beat (lifts,
  // softens and fades) while the background stays; the cut lands mid-exit, so there's no dead air. Overlapping transitions are their own exit
  // (they extend d); the last shot and end cards always hold.
  const scenes = (plan as { scenes?: Scene[] }).scenes;
  const last = !scenes || index >= scenes.length - 1;
  const exitLen = Math.min(0.42, beat * 0.85);
  const exit = saas && d === scene.duration && !last && scene.role !== "cta" && !/^(cta|qr-end)$/.test(scene.skill) ? ease.inCubic(clamp((t - (d - exitLen)) / exitLen)) * 0.8 : 0;
  if (turn > 0 || slab) {
    // 3D stages: the shot is drawn flat, then shown turned on a panel (turntable) or as a thick
    // floating slab, over the style's own background.
    saasBackground(sc);
    const layer = scratch("depth-content", w, h);
    const csc: SkillContext = { ...sc, ctx: layer.ctx, noStage: true };
    layer.ctx.save();
    glassFace(csc);
    if (opts.camera !== false) applyCamera(csc, globalT);
    if (transitionIn) applyTransitionIn(csc);
    SKILL_MAP[scene.skill].render(csc);
    layer.ctx.restore();
    const shot = exitLayer(layer.canvas, w, h, exit, sc.u);
    if (slab) projectSlab(target, shot, w, h, globalT, sc);
    else projectTurn(target, shot, w, h, turn, globalT, sc);
    resetCtx(target);
    return sc;
  }
  if (depth > 0) {
    // 3D stage: flat shader background, content projected onto a tilted, orbiting plane.
    saasBackground(sc);
    const layer = scratch("depth-content", w, h);
    const csc: SkillContext = { ...sc, ctx: layer.ctx, noStage: true };
    layer.ctx.save();
    if (opts.camera !== false) applyCamera(csc, globalT);
    if (transitionIn) applyTransitionIn(csc);
    SKILL_MAP[scene.skill].render(csc);
    layer.ctx.restore();
    projectPlane(target, exitLayer(layer.canvas, w, h, exit, sc.u), w, h, depth, globalT, level);
    resetCtx(target);
    return sc;
  }
  if (exit > 0) {
    // Leaving: the background stays put while the content (drawn on its own layer) exits.
    saasBackground(sc);
    const layer = scratch("exit-content", w, h);
    const csc: SkillContext = { ...sc, ctx: layer.ctx, noStage: true };
    layer.ctx.save();
    if (opts.camera !== false) applyCamera(csc, globalT);
    SKILL_MAP[scene.skill].render(csc);
    layer.ctx.restore();
    target.drawImage(exitLayer(layer.canvas, w, h, exit, sc.u), 0, 0);
    resetCtx(target);
    return sc;
  }
  target.save();
  if (opts.camera !== false) applyCamera(sc, globalT);
  if (transitionIn) applyTransitionIn(sc);
  SKILL_MAP[scene.skill].render(sc);
  target.restore();
  resetCtx(target);
  return sc;
}

/** Beat-locked time: exact on every beat, front-loaded within it (monotonic, so nothing reverses). */
function beatLock(t: number, beat: number) {
  if (t <= 0 || beat <= 0) return t;
  const n = Math.floor(t / beat);
  const f = t / beat - n;
  return (n + f + (ease.outCubic(f) - f) * 0.3) * beat;
}

/** The content layer on its way out: lifted, slightly smaller, softened and faded (level). */
function exitLayer(src: HTMLCanvasElement, w: number, h: number, k: number, u: number): HTMLCanvasElement {
  if (k <= 0) return src;
  const out = scratch("exit-out", w, h);
  const c = out.ctx;
  c.save();
  c.globalAlpha = 1 - k;
  const s = 1 - 0.05 * k;
  c.translate(w / 2, h / 2 - 46 * u * k);
  c.scale(s, s);
  c.translate(-w / 2, -h / 2);
  if (k > 0.05) c.filter = `blur(${(8 * u * k).toFixed(1)}px)`;
  c.drawImage(src, 0, 0);
  c.restore();
  return out.canvas;
}

/** Skills that show the product itself (screens, boards, flows): these get the 3D product stage. */
const PRODUCT_SHOTS = new Set<string>([
  "ui-assemble", "ui-tour", "site-scroll", "ui-cards", "kanban", "code-deploy", "command-k", "ai-prompt",
  "click-flow", "notify-stack", "live-cursors", "chat-thread", "feature-slides", "before-after", "support",
]);

/**
 * Draw `src` as a plane tilted back by ~`depth` degrees (true perspective, via thin horizontal
 * strips), with a slow orbit: the tilt breathes and the plane yaws gently from side to side.
 */
function projectPlane(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, w: number, h: number, depth: number, t: number, level = false) {
  const ax = ((depth * (0.8 + 0.2 * Math.sin(t * 0.33))) * Math.PI) / 180;
  // Level: no side-to-side swing, so every horizontal line stays horizontal.
  const yaw = level ? 0 : ((depth * 0.35 * Math.sin(t * 0.21)) * Math.PI) / 180;
  const f = h * 2.4;
  const strip = Math.max(2, Math.round(h / 300));
  const project = (y: number) => {
    const yc = y - h / 2;
    const z = -yc * Math.sin(ax);
    const k = f / (f + z);
    return { y: h / 2 + yc * Math.cos(ax) * k, k };
  };
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.transform(Math.cos(yaw), Math.sin(yaw) * 0.18, 0, 1, 0, 0);
  const zoom = 1.02;
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);
  ctx.imageSmoothingEnabled = true;
  for (let y = 0; y < h; y += strip) {
    const a = project(y);
    const b = project(Math.min(h, y + strip));
    const k = (a.k + b.k) / 2;
    const dw = w * k;
    ctx.drawImage(src, 0, y, w, Math.min(strip, h - y), w / 2 - dw / 2, a.y, dw, Math.max(0.5, b.y - a.y) + 0.6);
  }
  ctx.restore();
}

/**
 * Turntable: the shot on a panel turned `turn` degrees about the vertical axis (true perspective,
 * via thin vertical strips), swinging slowly from side to side like a product on a turntable,
 * with a soft reflection on the floor.
 */
function projectTurn(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, w: number, h: number, turn: number, t: number, sc: SkillContext) {
  // Always visibly turned (never straight-on), swinging between ~75% and 125% of the angle.
  const ay = ((turn * (1 + 0.25 * Math.sin(t * 0.28 + 0.6))) * Math.PI) / 180;
  const f = w * 1.6;
  const strip = Math.max(2, Math.round(w / 480));
  const scale = 0.86;
  const place = (x: number) => {
    const xc = (x - w / 2) * scale;
    const z = xc * Math.sin(ay);
    const k = f / (f + z);
    return { x: w / 2 + xc * Math.cos(ay) * k, k };
  };
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  // Floor reflection first, then the panel.
  for (const refl of [true, false]) {
    ctx.globalAlpha = refl ? 0.14 : 1;
    for (let x = 0; x < w; x += strip) {
      const a = place(x);
      const b = place(Math.min(w, x + strip));
      const k = (a.k + b.k) / 2;
      const dh = h * scale * k;
      const top = h / 2 - dh / 2;
      if (refl) {
        ctx.save();
        ctx.translate(0, top + dh * 2 + 6 * sc.u);
        ctx.scale(1, -1);
        ctx.drawImage(src, x, 0, Math.min(strip, w - x), h, a.x, 0, Math.max(0.5, b.x - a.x) + 0.6, dh);
        ctx.restore();
      } else ctx.drawImage(src, x, 0, Math.min(strip, w - x), h, a.x, top, Math.max(0.5, b.x - a.x) + 0.6, dh);
    }
  }
  ctx.restore();
  // Floor fade over the reflection.
  const g = ctx.createLinearGradient(0, h * 0.93, 0, h);
  g.addColorStop(0, rgba(sc.palette.bg0, 0));
  g.addColorStop(1, rgba(sc.palette.bg0, 0.9));
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.93, w, h * 0.07);
}

/** The slab's glass face, drawn under the shot's content. */
function glassFace(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 40 * u);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, rgba(mixHex(palette.bg1, "#ffffff", palette.light ? 0.5 : 0.1), 0.92));
  g.addColorStop(1, rgba(palette.bg0, 0.9));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/**
 * Slab: the shot as a thick, floating glass slab tilted in 3D (an oblique projection with a
 * visible edge), bobbing gently, with a soft shadow on the floor below.
 */
function projectSlab(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, w: number, h: number, t: number, sc: SkillContext) {
  const { u, palette } = sc;
  const sw = w * 0.8;
  const sh = h * 0.8;
  const bob = Math.sin(t * 0.8) * 8 * u;
  const tilt = -0.05 + Math.sin(t * 0.25) * 0.015;
  const skew = -0.14 + Math.sin(t * 0.21) * 0.03;
  const thick = 26 * u;
  ctx.save();
  // Floor shadow.
  const sg = ctx.createRadialGradient(w / 2, h * 0.93, 10 * u, w / 2, h * 0.93, sw * 0.55);
  sg.addColorStop(0, "rgba(0,0,0,0.45)");
  sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sg;
  ctx.save();
  ctx.translate(w / 2, h * 0.93);
  ctx.scale(1, 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, sw * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.translate(w / 2, h / 2 - 10 * u + bob);
  ctx.rotate(tilt);
  ctx.transform(1, 0, skew, 0.9, 0, 0);
  // The slab's edge: the face's outline extruded downward, shaded.
  for (let i = thick; i > 0; i -= 2 * u) {
    ctx.beginPath();
    ctx.roundRect(-sw / 2, -sh / 2 + i, sw, sh, 32 * u);
    ctx.fillStyle = mixHex(palette.bg1, "#000000", 0.35 + (i / thick) * 0.25);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.roundRect(-sw / 2, -sh / 2, sw, sh, 32 * u);
  ctx.save();
  ctx.clip();
  ctx.drawImage(src, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();
  ctx.strokeStyle = rgba("#ffffff", palette.light ? 0.5 : 0.18);
  ctx.lineWidth = 2 * u;
  ctx.stroke();
  ctx.restore();
}

const arrangements = new WeakMap<VideoPlan, Arrangement>();

/** Where the score is at `time`: the SaaS cue's kicks and drops, or a plain beat for trailers. */
function musicPulse(plan: VideoPlan, time: number): MusicPulse | undefined {
  if ((plan.music ?? plan.style) !== "saas") return undefined;
  let a = arrangements.get(plan);
  if (!a) {
    a = arrange(plan);
    arrangements.set(plan, a);
  }
  // The mastering chain's look-ahead delays the audio ~15 ms; the picture waits for it.
  const heard = time - 0.015;
  return { kick: sinceKick(a, heard, styleOf(plan.flavor).kick), drop: sinceDrop(a, heard), energy: energyAt(a, heard) };
}

/** Render a single scene at local time t (used directly by the skill showcase). */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  plan: PlanLike,
  t: number,
  w: number,
  h: number,
  index = 0,
  opts: RenderOptions = {},
  globalT = t,
  context: { prev?: { scene: Scene; index: number }; extendSelf?: boolean; music?: MusicPulse } = {},
) {
  const palette = brandPalette(plan.palette, plan.brand, schemeOf(plan));
  setBrandFont(brandFontReady(plan.brand?.font) ? plan.brand!.font! : null);
  // Glow off: halo-free type and no highlight bloom.
  setCrispText(plan.glow === false);
  if (plan.glow === false) opts = { ...opts, bloom: false };
  const d = context.extendSelf ? scene.duration + OVERLAP_EXTEND : scene.duration;
  const overlapping = !!context.prev && t < TRANSITION_LEN && OVERLAP.has(scene.transition);
  let sc: SkillContext;
  if (overlapping) {
    // Both shots on screen: the outgoing scene keeps running (exit suppressed) under the incoming one.
    const prev = context.prev!;
    const a = scratch("overlap-prev", w, h).ctx;
    drawScene(a, prev.scene, plan, prev.scene.duration + t, w, h, prev.index, opts, globalT, prev.scene.duration + OVERLAP_EXTEND, true, context.music);
    const b = scratch("overlap-next", w, h).ctx;
    sc = drawScene(b, scene, plan, t, w, h, index, opts, globalT, d, false, context.music);
    compositeOverlap({ ...sc, ctx }, a.canvas, b.canvas);
  } else {
    sc = drawScene(ctx, scene, plan, t, w, h, index, opts, globalT, d, true, context.music);
  }
  const out = { ...sc, ctx };
  resetCtx(ctx);
  if (!overlapping) transitionOverlay(out);
  else if (scene.transition === "leak") transitionOverlay(out);
  post(ctx, w, h, t, sc.seed, palette, opts, globalT, plan.look);
}

/** SaaS films follow the 60-30-10 colour rule unless the plan asks for "vibrant". */
export function schemeOf(plan: { style?: VideoPlan["style"]; scheme?: VideoPlan["scheme"] }) {
  return plan.style === "saas" && plan.scheme !== "vibrant" ? ("60-30-10" as const) : ("vibrant" as const);
}

/**
 * The 60-30-10 rule used by designers: 60% dominant (the stage, bg0), 30% supporting colour
 * (cards, panels, gradient fields) and 10% accent (highlight words, buttons, cursor, beams).
 * Accents collapse to one hue (secondary becomes a tint of the accent) so nothing competes,
 * and surfaces take a muted tone of the palette's secondary colour.
 */
function saturation(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

export function ruleOf(p: Palette): Palette {
  // The accent is the palette's most vivid colour (e.g. Mono's red, not its white).
  const swap = saturation(p.secondary) > saturation(p.primary) + 0.35;
  const accent = swap ? p.secondary : p.primary;
  const support = mixHex(p.bg0, swap ? p.primary : p.secondary, p.light ? 0.24 : 0.36);
  return {
    ...p,
    support,
    primary: accent,
    secondary: mixHex(accent, p.light ? "#000000" : "#ffffff", p.light ? 0.22 : 0.3),
    accent: mixHex(accent, support, 0.4),
    bg1: mixHex(p.bg0, support, p.light ? 0.35 : 0.55),
  };
}

/** WCAG relative luminance and contrast ratio. */
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Nudge a colour lighter (dark themes) or darker (light themes) until it reads on `bg` at `min`:1. */
function readable(hex: string, bg: string, min: number, light: boolean) {
  if (!/^#[0-9a-f]{6}$/i.test(hex) || !/^#[0-9a-f]{6}$/i.test(bg)) return hex;
  let out = hex;
  for (let k = 0.1; k <= 1 && contrast(out, bg) < min; k += 0.1) out = mixHex(hex, light ? "#000000" : "#ffffff", k);
  return out;
}
/**
 * Colour-theory guard rails: highlight words, buttons and beams keep at least 3:1 contrast with
 * the stage (WCAG large-text AA), body text at least 7:1, whatever brand colours come in.
 */
function legible(p: Palette): Palette {
  const light = !!p.light;
  return {
    ...p,
    primary: readable(p.primary, p.bg0, 3.2, light),
    secondary: readable(p.secondary, p.bg0, 3.2, light),
    accent: readable(p.accent, p.bg0, 3, light),
    text: readable(p.text, p.bg0, 7, light),
  };
}

/** Base palette with the brand's colours swapped in (backgrounds keep the base's darkness). */
export function brandPalette(id: VideoPlan["palette"], brand?: VideoPlan["brand"], scheme: VideoPlan["scheme"] = "vibrant"): Palette {
  const base = PALETTES[id];
  const c = brand?.colors;
  const p = c
    ? {
        ...base,
        primary: c.primary,
        secondary: c.secondary,
        accent: mixHex(c.primary, c.secondary, 0.5),
        bg1: mixHex(base.bg0, c.primary, 0.22),
      }
    : base;
  return legible(scheme === "60-30-10" ? ruleOf(p) : p);
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
  const next = plan.scenes[at.index + 1];
  renderScene(ctx, at.scene, plan, at.local, w, h, at.index, opts, time, {
    prev: at.index > 0 ? { scene: plan.scenes[at.index - 1], index: at.index - 1 } : undefined,
    extendSelf: !!next && OVERLAP.has(next.transition),
    music: musicPulse(plan, time),
  });
  if (plan.style === "saas" && opts.grade !== false) epicPass(ctx, plan, at.local, at.index, time, musicPulse(plan, time), w, h);
  if (plan.style === "saas" && plan.look?.overlay) filmOverlay(ctx, plan, time, w, h, at.index);
  else brandBug(ctx, plan, time, w, h);
  drawCaptions(ctx, plan, time, w, h);
}

/**
 * Word-by-word captions for the voice-over (most social video is watched muted): the phrase
 * being said on a soft pill near the bottom, the current word lit in the accent colour.
 */
function drawCaptions(ctx: CanvasRenderingContext2D, plan: VideoPlan, time: number, w: number, h: number) {
  const cap = captionAt(plan, time);
  if (!cap || !cap.words.length) return;
  const style = plan.voiceover?.captionStyle ?? "frosted";
  const palette = brandPalette(plan.palette, plan.brand, schemeOf(plan));
  const u = Math.min(w, h) / 1080;
  const portrait = h > w;
  const bold = style === "pop" || style === "box";
  const size = (portrait ? 46 : 38) * u * (bold ? 1.3 : 1);
  resetCtx(ctx);
  ctx.save();
  ctx.font = `${bold ? 900 : 800} ${Math.round(size)}px Inter, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const words = style === "pop" || style === "box" ? cap.words.map((wd) => wd.toUpperCase()) : cap.words;
  const space = ctx.measureText(" ").width * (style === "box" ? 1.7 : 1.2);
  const widths = words.map((wd) => ctx.measureText(wd).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  const padX = size * 0.7;
  const pw = Math.min(w * 0.92, total + padX * 2);
  const ph = size * 1.75;
  const cx = w / 2;
  const cy = h * (portrait ? 0.855 : bold ? 0.86 : 0.9);
  const k = ease.outCubic(clamp(cap.since / 0.18 + 0.01));
  if (style === "frosted") {
    // Frosted pill: whatever is behind it (cards, screenshots, headlines) is blurred and dimmed,
    // so the caption reads on any layout.
    const px = Math.max(0, Math.round(cx - pw / 2));
    const py = Math.max(0, Math.round(cy - ph / 2));
    const bw = Math.min(w - px, Math.round(pw));
    const bh = Math.min(h - py, Math.round(ph));
    const frost = scratch("caption-frost", Math.max(1, bw), Math.max(1, bh));
    frost.ctx.setTransform(1, 0, 0, 1, 0, 0);
    frost.ctx.filter = `blur(${Math.round(14 * u)}px)`;
    frost.ctx.drawImage(ctx.canvas, px - 20, py - 20, bw + 40, bh + 40, -20, -20, bw + 40, bh + 40);
    frost.ctx.filter = "none";
    ctx.globalAlpha = k;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 24 * u;
    ctx.fillStyle = palette.light ? "rgba(255,255,255,0.72)" : "rgba(6,6,12,0.55)";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    ctx.drawImage(frost.canvas, px, py);
    ctx.fillStyle = palette.light ? "rgba(255,255,255,0.72)" : "rgba(6,6,12,0.62)";
    ctx.fillRect(px, py, bw, bh);
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
    ctx.strokeStyle = palette.light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.14)";
    ctx.lineWidth = Math.max(1, 1.2 * u);
    ctx.stroke();
  } else ctx.globalAlpha = k;
  ctx.translate(cx, cy + (1 - k) * 10 * u);
  const fit = total > w * 0.92 - padX * 2 ? (w * 0.92 - padX * 2) / total : 1;
  ctx.scale(fit, fit);
  let x = -total / 2;
  words.forEach((wd, i) => {
    const on = i === cap.active;
    const said = i < cap.active || cap.active < 0;
    const tm = cap.times[i];
    ctx.save();
    if (style === "frosted") {
      ctx.fillStyle = on ? palette.primary : said ? palette.text : rgba(palette.text, 0.55);
      ctx.fillText(wd, x, size * 0.04 - (on ? 2 * u : 0));
    } else if (style === "pop") {
      // Bold outlined words that spring in as they're said; the current one pops bigger in colour.
      const since = cap.lt - tm.t0;
      if (since < -0.02) {
        ctx.restore();
        x += widths[i] + space;
        return;
      }
      const sp = clamp(0.4 + 0.6 * (1 - Math.exp(-since * 14) * Math.cos(since * 22)), 0, 1.25);
      const sc = (on ? 1.14 : 1) * sp;
      ctx.translate(x + widths[i] / 2, 0);
      ctx.scale(sc, sc);
      ctx.lineJoin = "round";
      ctx.lineWidth = size * 0.16;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(wd, -widths[i] / 2, size * 0.04);
      ctx.fillStyle = on ? palette.accent : "#ffffff";
      ctx.fillText(wd, -widths[i] / 2, size * 0.04);
    } else if (style === "box") {
      // A colour box slides onto the word being said.
      if (on) {
        const pad = size * 0.22;
        ctx.beginPath();
        ctx.roundRect(x - pad, -size * 0.62, widths[i] + pad * 2, size * 1.24, size * 0.2);
        ctx.fillStyle = palette.primary;
        ctx.fill();
      }
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = on ? 0 : 10 * u;
      ctx.fillStyle = on ? (palette.light ? "#ffffff" : palette.bg0) : "#ffffff";
      ctx.fillText(wd, x, size * 0.04);
    } else {
      // Karaoke: each word fills with colour as it's said.
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 10 * u;
      ctx.fillStyle = rgba("#ffffff", 0.55);
      ctx.fillText(wd, x, size * 0.04);
      ctx.shadowBlur = 0;
      const f = clamp((cap.lt - tm.t0) / Math.max(0.05, tm.t1 - tm.t0));
      if (f > 0) {
        ctx.beginPath();
        ctx.rect(x - 2, -size, (widths[i] + 4) * f, size * 2);
        ctx.clip();
        ctx.fillStyle = palette.accent;
        ctx.fillText(wd, x, size * 0.04);
        ctx.fillRect(x, size * 0.62, widths[i], 4 * u);
      }
    }
    ctx.restore();
    x += widths[i] + space;
  });
  ctx.restore();
  resetCtx(ctx);
}

/** Frame-level overlays: a sci-fi HUD or a Swiss-style layout frame (they carry the brand name). */
function filmOverlay(ctx: CanvasRenderingContext2D, plan: VideoPlan, time: number, w: number, h: number, index: number) {
  const palette = brandPalette(plan.palette, plan.brand, schemeOf(plan));
  const u = Math.min(w, h) / 1080;
  const name = plan.brand?.name ?? plan.title;
  const total = totalDuration(plan);
  const fade = Math.min(1, time / 0.6) * Math.min(1, (total - time) / 0.3 + 0.35);
  resetCtx(ctx);
  ctx.save();
  ctx.globalAlpha = fade;
  if (plan.look?.overlay === "hud") {
    const c = palette.primary;
    const m = 42 * u;
    const L = 46 * u;
    ctx.strokeStyle = rgba(c, 0.85);
    ctx.lineWidth = 2.5 * u;
    ctx.shadowColor = c;
    ctx.shadowBlur = 10 * u;
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * L);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * L, y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // Ruler ticks down the left edge.
    ctx.strokeStyle = rgba(c, 0.35);
    ctx.lineWidth = 1.2 * u;
    for (let i = 0; i < 24; i++) {
      const y = h * 0.2 + (i * h * 0.6) / 23;
      ctx.beginPath();
      ctx.moveTo(m, y);
      ctx.lineTo(m + (i % 4 === 0 ? 16 : 8) * u, y);
      ctx.stroke();
    }
    // Slow scan line.
    const sy = ((time * 0.18) % 1) * h;
    const g = ctx.createLinearGradient(0, sy - 60 * u, 0, sy);
    g.addColorStop(0, rgba(c, 0));
    g.addColorStop(1, rgba(c, 0.1));
    ctx.fillStyle = g;
    ctx.fillRect(0, sy - 60 * u, w, 60 * u);
    ctx.fillStyle = rgba(c, 0.35);
    ctx.fillRect(0, sy, w, Math.max(1, u));
    // Readouts.
    ctx.font = `500 ${Math.round(17 * u)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = rgba(c, 0.9);
    ctx.textBaseline = "middle";
    const tc = `T+${String(Math.floor(time / 60)).padStart(2, "0")}:${(time % 60).toFixed(2).padStart(5, "0")}`;
    ctx.textAlign = "left";
    ctx.fillText(`SYS // ${name.toUpperCase()}`, m + L + 14 * u, m + 2 * u);
    ctx.fillText(`SEQ ${String(index + 1).padStart(2, "0")}/${String(plan.scenes.length).padStart(2, "0")}`, m + L + 14 * u, h - m);
    ctx.textAlign = "right";
    ctx.fillText(tc, w - m - L - 14 * u, m + 2 * u);
    const lat = (37.7749 + Math.sin(time * 0.7) * 0.01).toFixed(4);
    const lon = (122.4194 + Math.cos(time * 0.6) * 0.01).toFixed(4);
    ctx.fillText(`${lat}N  ${lon}W`, w - m - L - 14 * u, h - m);
    // Blinking status square.
    if (Math.floor(time * 2) % 2 === 0) ctx.fillRect(w - m - L - 14 * u - 250 * u, m - 6 * u, 12 * u, 12 * u);
  } else {
    // Swiss layout frame: hairline inset border and corner labels.
    const m = 36 * u;
    ctx.strokeStyle = rgba(palette.text, 0.22);
    ctx.lineWidth = Math.max(1, 1.4 * u);
    ctx.strokeRect(m, m, w - m * 2, h - m * 2);
    ctx.font = subFont(17 * u, 600);
    ctx.fillStyle = rgba(palette.text, 0.75);
    ctx.textBaseline = "middle";
    const scene = plan.scenes[index];
    ctx.textAlign = "left";
    ctx.fillText(name, m + 18 * u, m + 26 * u);
    ctx.fillText((scene?.eyebrow ?? "").toUpperCase(), m + 18 * u, h - m - 26 * u);
    ctx.textAlign = "right";
    ctx.fillText(`Nº ${String(index + 1).padStart(2, "0")} / ${String(plan.scenes.length).padStart(2, "0")}`, w - m - 18 * u, m + 26 * u);
    ctx.fillStyle = palette.primary;
    ctx.fillRect(w - m - 18 * u - 14 * u, h - m - 33 * u, 14 * u, 14 * u);
  }
  ctx.restore();
}

const BUG_SKIP = new Set(["hook", "pain", "reveal", "cta"]);

/**
 * Persistent brand bug: a small logo lock-up in the top-left corner through the body of a
 * SaaS film (after the brand reveal, before the end card), like a broadcast network bug.
 */
function brandBug(ctx: CanvasRenderingContext2D, plan: VideoPlan, time: number, w: number, h: number) {
  const brand = plan.brand;
  if (plan.style !== "saas" || !brand || (!brand.logo && !brand.name)) return;
  const reveal = plan.scenes.findIndex((s) => s.role === "reveal");
  if (reveal < 0) return;
  let acc = 0;
  let start = -1;
  let end = -1;
  plan.scenes.forEach((s, i) => {
    if (i > reveal && !BUG_SKIP.has(s.role ?? "")) {
      if (start < 0) start = acc;
      end = acc + s.duration;
    }
    acc += s.duration;
  });
  if (start < 0) return;
  const a = ease.inOutCubic(range(time, start + 0.35, start + 0.95)) * (1 - ease.inCubic(range(time, end - 0.45, end - 0.05)));
  if (a <= 0) return;
  const palette = brandPalette(plan.palette, brand, schemeOf(plan));
  const u = Math.min(w, h) / 1080;
  // On the design grid: the lock-up's top-left corner sits on the title-safe corner.
  const safe = tokens(w, h).safe;
  const x = safe.left;
  const y = safe.top + 19 * u;
  resetCtx(ctx);
  ctx.save();
  ctx.globalAlpha = a * 0.78;
  const logo = getImage(brand.logo);
  let lx = x;
  const wordmark = !!logo?.naturalWidth && logo.naturalWidth / logo.naturalHeight >= 1.8;
  if (logo?.naturalWidth) {
    const lh = (wordmark ? 30 : 38) * u;
    const lw = (logo.naturalWidth / logo.naturalHeight) * lh;
    drawLogo(ctx, logo, !!palette.light, x, y - lh / 2, lw, lh);
    lx = x + lw + 12 * u;
  }
  if (!wordmark && brand.name) {
    ctx.font = subFont(28 * u, 650);
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(brand.name, lx, y + 1 * u);
  }
  ctx.restore();
}

/**
 * Virtual camera: slight overscan, slow handheld drift and a punch-in on every beat,
 * so even static typography breathes with the soundtrack.
 */
function applyCamera(sc: SkillContext, globalT: number) {
  const { ctx, w, h, u, beat } = sc;
  let pulse: number;
  if (sc.music) {
    // Punch on the kicks the score actually plays (none under the hook or in the breakdown),
    // with a bigger hit when the track drops.
    const m = sc.music;
    const kick = Number.isFinite(m.kick) ? Math.exp(-m.kick * 12) * 0.011 * m.energy : 0;
    const drop = m.drop < 0.8 ? Math.exp(-m.drop * 6) * 0.03 : 0;
    pulse = kick + drop;
  } else {
    const phase = (globalT / beat) % 1;
    const bar = Math.floor(globalT / beat) % 4 === 0 ? 1.6 : 1;
    pulse = Math.exp(-phase * 7) * 0.012 * bar;
  }
  // Cinematic dolly: every shot keeps pulling back slowly (5% over the shot, from slightly closer
  // to its resting framing), drifting a touch to one side, so no frame is ever static. Cuts hide
  // the reset.
  const p = clamp(sc.t / Math.max(0.5, sc.d));
  const saas = sc.style === "saas";
  const push = 0.05 * (1 - (p * p * (3 - 2 * p) * 0.35 + p * 0.65));
  const side = sc.seed % 2 ? 1 : -1;
  // SaaS shots land: a quick settle from slightly closer and turned, like a camera move ending.
  const arrive = saas ? 1 - ease.outExpo(clamp(sc.t / 0.75)) : 0;
  const s = 1.035 + push + pulse + 0.05 * arrive;
  const dx = noise1(globalT * 0.45, 11) * 9 * u + side * p * 14 * u + side * arrive * 26 * u;
  const dy = noise1(globalT * 0.37, 23) * 7 * u - p * 6 * u;
  // SaaS shots never roll or skew: text, cards and UI rows stay perfectly level.
  const rot = saas ? 0 : noise1(globalT * 0.23, 37) * 0.007;
  ctx.translate(w / 2 + dx, h / 2 + dy);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.translate(-w / 2, -h / 2);
}

/**
 * The SaaS finish, over the whole frame: a two-tone brand grade (so frames aren't one flat
 * hue), a glossy light sweep once per shot, a flash when the track drops, and drifting light
 * motes in the foreground that twinkle with the kicks.
 */
function epicPass(ctx: CanvasRenderingContext2D, plan: VideoPlan, local: number, index: number, time: number, music: MusicPulse | undefined, w: number, h: number) {
  const palette = brandPalette(plan.palette, plan.brand, schemeOf(plan));
  const u = Math.min(w, h) / 1080;
  const light = !!palette.light;
  resetCtx(ctx);
  ctx.save();
  // Two-tone grade: the brand colour lifts the top-left, the second colour the bottom-right.
  ctx.globalCompositeOperation = "soft-light";
  for (const [x, y, c] of [
    [0, 0, palette.primary],
    [w, h, palette.secondary],
  ] as [number, number, string][]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.hypot(w, h) * 0.7);
    g.addColorStop(0, rgba(c, light ? 0.18 : 0.32));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = light ? "source-over" : "screen";
  // One glossy sweep per shot, once it has built (alternating direction shot to shot).
  const sk = range(local, 0.45, 1.5);
  if (sk > 0 && sk < 1) {
    const dir = index % 2 ? -1 : 1;
    const x = dir > 0 ? -w * 0.3 + sk * w * 1.6 : w * 1.3 - sk * w * 1.6;
    const bw = w * 0.16;
    ctx.save();
    ctx.translate(x, h / 2);
    ctx.rotate(dir * 0.35);
    const g = ctx.createLinearGradient(-bw, 0, bw, 0);
    const a = Math.sin(Math.PI * sk) * (light ? 0.1 : 0.13);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, `rgba(255,255,255,${a})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-bw, -h, bw * 2, h * 2);
    ctx.restore();
  }
  // Type-led shots (hooks, reveals, closing lines) get a hero light as they land: a bloom of the
  // brand colours behind the headline and an anamorphic lens streak across it.
  const skill = plan.scenes[index]?.skill ?? "";
  // (Logo reveals have their own light, so they're left alone.)
  if (!PRODUCT_SHOTS.has(skill) && !light && !/logo|particle|type-mask/.test(skill)) {
    const cy = h * 0.46;
    const land = range(local, 0.15, 0.9);
    const glow = Math.sin(Math.PI * Math.min(1, land * 1.4)) * 0.22 + 0.08 * land;
    if (glow > 0.005) {
      const g = ctx.createRadialGradient(w / 2, cy, 0, w / 2, cy, Math.max(w, h) * 0.5);
      g.addColorStop(0, rgba(palette.primary, glow));
      g.addColorStop(0.45, rgba(palette.secondary, glow * 0.45));
      g.addColorStop(1, rgba(palette.secondary, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    const st = range(local, 0.25, 1.4);
    if (st > 0 && st < 1) {
      const sw = w * 0.6 * ease.outExpo(st);
      const sa = Math.sin(Math.PI * st) * 0.5;
      for (const [th, al] of [[2.5, 1], [16, 0.3]] as const) {
        const g = ctx.createLinearGradient(w / 2 - sw, 0, w / 2 + sw, 0);
        g.addColorStop(0, rgba(palette.primary, 0));
        g.addColorStop(0.5, `rgba(255,255,255,${sa * al})`);
        g.addColorStop(1, rgba(palette.primary, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(w / 2, cy, sw, th * u, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Drop flash: the frame blooms white for a moment when the track drops.
  if (music && music.drop < 0.35) {
    ctx.fillStyle = `rgba(255,255,255,${(light ? 0.12 : 0.2) * Math.exp(-music.drop * 12)})`;
    ctx.fillRect(0, 0, w, h);
  }
  // Foreground light motes, drifting up; brighter on each kick.
  const kick = music && Number.isFinite(music.kick) ? Math.exp(-music.kick * 9) * music.energy : 0;
  const r = rng(plan.seed * 5 + 91);
  const n = Math.round(18 * (w * h) / (1920 * 1080) + 8);
  for (let i = 0; i < n; i++) {
    const x0 = r();
    const speed = 0.012 + r() * 0.03;
    const y = (((r() - time * speed) % 1) + 1) % 1;
    const x = (x0 + Math.sin(time * (0.2 + r() * 0.3) + i) * 0.01) * w;
    const size = (1.2 + r() * 3.2) * u;
    const tw = 0.5 + 0.5 * Math.sin(time * (1.5 + r() * 2) + i * 1.7);
    const a = (light ? 0.25 : 0.45) * (0.35 + 0.65 * tw) * (0.7 + 0.8 * kick);
    const c = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? palette.primary : palette.secondary;
    const g = ctx.createRadialGradient(x, y * h, 0, x, y * h, size * 4);
    g.addColorStop(0, rgba(c, Math.min(1, a)));
    g.addColorStop(0.3, rgba(c, a * 0.35));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - size * 4, y * h - size * 4, size * 8, size * 8);
  }
  ctx.restore();
}

/**
 * Composite outgoing (a) and incoming (b) shots — both on screen at once, like an edit:
 * whip pan, dolly zoom-through, push, cross-dissolve with blur, light-leak dissolve.
 */
function compositeOverlap(sc: SkillContext, a: HTMLCanvasElement, b: HTMLCanvasElement) {
  const { ctx, w, h, t, u, palette, seed } = sc;
  const k = range(t, 0, TRANSITION_LEN);
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(0, 0, w, h);
  const kind = sc.scene.transition;
  // Liquid: the next shot rises in behind a wavy, blobby liquid front (GPU; dissolves without WebGL).
  const liquid = kind === "liquid" ? liquidWipe(a, b, ease.inOutCubic(k), seed) : null;
  // Cube: the two shots as faces of a turning 3D cube (gl-transitions "cube", on the GPU).
  if (kind === "cube" && !transitionsReady()) void loadTransitions();
  const cube = kind === "cube" ? renderTransition("cube", a, b, ease.inOutCubic(k), w, h, { bg: [0, 0, 0, 1] }) : null;
  if (liquid || cube) {
    ctx.drawImage((liquid ?? cube)!, 0, 0, w, h);
  } else if (kind === "whip" || kind === "push") {
    const e = kind === "whip" ? ease.inOutExpo(k) : ease.inOutCubic(k);
    const dir = seed % 2 ? 1 : -1;
    const smear = kind === "whip" ? Math.sin(Math.PI * k) * w * 0.12 : 0;
    const n = kind === "whip" ? 6 : 1;
    for (const [img, x0] of [
      [a, -e * w * dir],
      [b, (1 - e) * w * dir],
    ] as [HTMLCanvasElement, number][]) {
      for (let i = n; i >= 1; i--) {
        ctx.globalAlpha = i === 1 ? 1 : 0.18;
        ctx.drawImage(img, x0 + ((smear * (i - 1)) / n) * dir, 0);
      }
    }
  } else if (kind === "dolly") {
    // Zoom through: fly into the outgoing shot while the incoming one resolves behind it.
    const e = ease.inOutCubic(k);
    const sb = 0.85 + 0.15 * ease.outCubic(k);
    ctx.globalAlpha = clamp(e * 1.6);
    ctx.drawImage(b, (w - w * sb) / 2, (h - h * sb) / 2, w * sb, h * sb);
    const sa = 1 + e * 1.4;
    for (let i = 4; i >= 0; i--) {
      const z = sa * (1 + i * 0.04 * e);
      ctx.globalAlpha = (1 - e) * (i === 0 ? 1 : 0.2);
      ctx.drawImage(a, (w - w * z) / 2, (h - h * z) / 2, w * z, h * z);
    }
  } else {
    // Cross-dissolve: outgoing blurs away as the incoming sharpens in.
    const e = ease.inOutCubic(k);
    ctx.globalAlpha = 1;
    if ((1 - e) * 10 * u > 0.5) ctx.filter = `blur(${(e * 12 * u).toFixed(1)}px)`;
    ctx.drawImage(a, 0, 0);
    ctx.filter = (1 - e) * 10 * u > 0.5 ? `blur(${((1 - e) * 10 * u).toFixed(1)}px)` : "none";
    ctx.globalAlpha = e;
    ctx.drawImage(b, 0, 0);
    ctx.filter = "none";
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
  look?: VideoPlan["look"],
) {
  const u = Math.min(w, h) / 1080;
  if (opts.bloom !== false) {
    // Highlights only (contrast/brightness filter acts as a soft threshold), at two radii.
    const passes: [number, number][] = [
      [6, palette.light ? 0.12 : 0.38],
      [20, palette.light ? 0.1 : 0.34],
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
  for (let i = 0; i < (look ? (look.bokeh === true ? 7 : 0) : 7); i++) {
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
  v.addColorStop(1, palette.light ? "rgba(20,20,40,0.12)" : `rgba(0,0,0,${Math.min(0.9, 0.6 * (look?.vignette ?? 1))})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  if (opts.grain !== false && (look?.grain ?? 1) > 0) {
    const g = getGrain();
    const r = rng(seed + Math.floor(t * 24));
    ctx.save();
    ctx.globalAlpha = Math.min(1, look?.grain ?? 1);
    ctx.globalCompositeOperation = "overlay";
    ctx.translate(-r() * 256, -r() * 256);
    ctx.fillStyle = ctx.createPattern(g, "repeat")!;
    ctx.fillRect(0, 0, w + 256, h + 256);
    ctx.restore();
  }
  if (opts.watermark) {
    // A small frosted tag in the bottom-right corner of the title-safe area.
    const g = tokens(w, h);
    ctx.save();
    ctx.font = `600 ${Math.round(17 * u)}px Inter, sans-serif`;
    const tw = ctx.measureText(opts.watermark).width;
    const padX = g.space(1.5);
    const bh = Math.round(34 * u);
    const bx = Math.round(g.safe.right - tw - padX * 2);
    const by = Math.round(h - g.safe.bottom - bh);
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.roundRect(bx, by, tw + padX * 2, bh, bh / 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.watermark, bx + padX, by + bh / 2 + u);
    ctx.restore();
  }
}
