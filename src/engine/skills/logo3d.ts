/**
 * 3D logo intros: the brand's own logo turned into a solid, extruded object and staged like a
 * studio ident. Any logo works: the imported logo (wordmarks included), the site's app icon, or
 * the generated brand mark when there's none. Each one lands on the score's drop (revealHit), then
 * keeps moving in 3D while the name comes in under it.
 *
 * - logo-extrude: a scan line builds the flat logo, which snaps into depth on the hit and swings round.
 * - logo-spin:    the logo spins like a coin, glinting edge-on, slowing until it faces you on the hit.
 * - logo-shatter: thick shards fly in from depth and lock together, their seams glowing as they fuse.
 * - logo-orbit:   three tilted rings with comet lights orbit the solid logo, in front of it and behind.
 * - logo-stage:   the logo rises through a rippling, reflective floor under a dusty spotlight.
 * - logo-layers:  stacked glass plates of the logo collapse into one solid mark.
 * - logo-tunnel:  the camera warps down a tunnel of the logo's glowing outlines to the logo itself.
 * - logo-flip:    thick strips of the logo flip round in a glinting wave, then it gains its depth.
 *
 * The 3D is drawn on the 2D canvas: the logo's silhouette, tinted, is stacked along the depth axis
 * behind its glossy face (darker towards the back, lit by the turn), so any shape extrudes properly.
 * Around it, the shared ident kit stages it like a film studio's: volumetric light shafts behind the
 * mark, a perspective floor with its reflection, energy streaming in before the drop, then a floor
 * shockwave, bouncing sparks, a lens flare and a camera kick on it, embers drifting through, and the
 * name tracking in with a sweep of light. Nothing flashes the frame: light ramps in and out, stays in
 * shafts, thin lines and small sparks, and the frame's brightness never pulses.
 */
import { brandGlyph, saasBackground, saasFont, spring } from "../saasfx";
import { background, drawLayout, dust, exitT, headline, lightSweep, shake, subline } from "../fx";
import { clamp, ease, hashString, lerp, mixHex, range, rgba, rng, TAU } from "../math";
import { getImage, isWideLogo, logoAt } from "../media";
import { revealHit } from "../arrange";
import { scratch } from "../scratch";
import type { Scene, SfxCue, Skill, SkillContext, SkillId } from "../types";

/* ───────────────────────── The mark ───────────────────────── */

type Src = HTMLCanvasElement | HTMLImageElement;
export type Mark = { src: Src; key: string; ar: number; wide: boolean };

const glyphs = new Map<string, HTMLCanvasElement>();

/** The brand's mark: its logo, else its app icon, else the generated brand mark. */
export function markOf(sc: SkillContext): Mark {
  const light = !!sc.palette.light;
  const logo = getImage(sc.brand?.logo);
  if (logo?.naturalWidth) {
    const src = logoAt(logo, light, 1024);
    return { src, key: `${logo.src}|${light}`, ar: logo.naturalWidth / logo.naturalHeight, wide: isWideLogo(logo) };
  }
  const icon = getImage(sc.brand?.icon);
  if (icon?.naturalWidth) return { src: logoAt(icon, light, 1024), key: `${icon.src}|${light}`, ar: icon.naturalWidth / icon.naturalHeight, wide: false };
  const key = `glyph|${sc.palette.primary}|${sc.palette.secondary}|${sc.palette.bg0}|${sc.concept ?? ""}`;
  let c = glyphs.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d")!;
    brandGlyph({ ...sc, ctx: g, w: 512, h: 512, u: 1 }, 256, 256, 470, 1, 0);
    glyphs.set(key, c);
  }
  return { src: c, key, ar: 1, wide: false };
}

const tints = new Map<string, HTMLCanvasElement>();
/** The mark's silhouette in one colour (its sides and back). */
export function tint(m: Mark, color: string) {
  const key = `${m.key}|${color}|${m.src.width}`;
  let c = tints.get(key);
  if (!c) {
    if (tints.size > 64) tints.clear();
    c = document.createElement("canvas");
    c.width = Math.max(1, m.src.width);
    c.height = Math.max(1, m.src.height);
    const g = c.getContext("2d")!;
    g.drawImage(m.src, 0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    tints.set(key, c);
  }
  return c;
}

/** Where the mark sits and how big: a box that fits square marks and wide wordmarks alike. */
function placement(sc: SkillContext, m: Mark) {
  const { w, h } = sc;
  const portrait = h > w;
  const short = Math.min(w, h);
  const named = !m.wide && !!sc.scene.text;
  // Room under a named mark for its reflection and the name.
  const box = short * (portrait ? 0.4 : named ? 0.32 : 0.36);
  let mw = m.ar >= 1 ? Math.min(box * m.ar, w * (portrait ? 0.78 : 0.56)) : box * m.ar;
  let mh = mw / m.ar;
  if (mh > box * 1.1) {
    mh = box * 1.1;
    mw = mh * m.ar;
  }
  return { mw, mh, cx: w / 2, cy: h * (named ? (portrait ? 0.4 : 0.37) : 0.47), named };
}


type Placement = ReturnType<typeof placement>;

type Pose = {
  /** Turn about the vertical axis (radians; 0 faces the camera). */
  yaw: number;
  /** Tilt back about the horizontal axis (radians). */
  pitch?: number;
  /** Extrusion depth in pixels. */
  depth: number;
  scale?: number;
  /** 0..1 progress of a specular sweep across the face (outside 0..1: none). */
  sweep?: number;
  alpha?: number;
  /** A soft glow of light around the whole object (0..1). */
  halo?: number;
};

/** Where the face of the last solid drawn landed (for overlays that sit on it). */
type Rect = { x: number; y: number; w: number; h: number };
let lastFace: Rect = { x: 0, y: 0, w: 0, h: 0 };

/**
 * The mark as a solid: its silhouette stacked along the depth axis behind the face (darker towards
 * the back and lit by the turn, a bright bevel just behind the face), then the glossy face itself
 * (its back, in the brand colour, when turned away).
 */
function solid(sc: SkillContext, m: Mark, cx: number, cy: number, mw: number, mh: number, p: Pose) {
  const { ctx, u, palette } = sc;
  const s = p.scale ?? 1;
  const cy0 = Math.cos(p.yaw);
  const sy0 = Math.sin(p.yaw);
  const pitch = p.pitch ?? 0;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  // The depth axis on screen: turned right shows the left side, tilted back shows the top.
  const dx = -sy0 * p.depth * s;
  const dy = -sp * p.depth * s;
  const reach = Math.hypot(dx, dy);
  // The light comes from the upper left: the left side, turned towards it, is brighter (in steps, so
  // the tinted silhouettes stay cached).
  const lit = Math.round((0.5 + 0.5 * sy0) * 4) / 4;
  const dark = mixHex(palette.primary, "#000000", (palette.light ? 0.26 : 0.38) + (1 - lit) * 0.14);
  const lite = mixHex(palette.primary, "#ffffff", palette.light ? 0.05 : 0.12 + lit * 0.12);
  const sideDark = tint(m, dark);
  const sideLite = tint(m, lite);
  const fw = mw * s * Math.abs(cy0);
  const fh = mh * s * cp;
  ctx.save();
  ctx.globalAlpha *= p.alpha ?? 1;
  // (The halo covers the whole body, face and sides, with room to spare on every side.)
  if (p.halo && p.halo > 0.01) haloAt(sc, m, cx + dx / 2, cy + dy / 2, (Math.max(fw, mw * s * 0.25) + Math.abs(dx)) * 1.08, (fh + Math.abs(dy)) * 1.08, p.halo);
  // The body: copies a pixel or so apart, so the sides read as continuous surfaces.
  const n = reach > 1 ? clamp(Math.round(reach / (1.4 * u)), 3, 40) : 0;
  for (let i = n; i >= 1; i--) {
    const f = i / n;
    const shrink = 1 - 0.05 * f;
    const w1 = Math.max(0.5, fw * shrink);
    const h1 = Math.max(0.5, fh * shrink);
    const x = cx + dx * f - w1 / 2;
    const y = cy + dy * f - h1 / 2;
    ctx.drawImage(sideDark, x, y, w1, h1);
    const a = (1 - f) * 0.85;
    if (a > 0.02) {
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.drawImage(sideLite, x, y, w1, h1);
      ctx.restore();
    }
  }
  // The glow wraps over the sides too (a softer second pass), so the body's edge never cuts it off
  // in a hard dark line.
  if (n && p.halo && p.halo > 0.01) haloAt(sc, m, cx + dx * 0.6, cy + dy * 0.6, fw + Math.abs(dx) * 0.8, fh + Math.abs(dy) * 0.8, p.halo * 0.45);
  // A bright bevel just behind the face catches the light.
  if (n) {
    ctx.save();
    ctx.globalAlpha *= 0.9;
    ctx.drawImage(tint(m, mixHex(lite, "#ffffff", 0.45)), cx + dx * 0.035 - fw / 2, cy + dy * 0.035 - fh / 2, fw, fh);
    ctx.restore();
  }
  // The face (or, turned away, the back in the brand colour): glossy, with its sweep of light.
  lastFace = { x: cx - fw / 2, y: cy - fh / 2, w: fw, h: fh };
  if (fw > 0.5 && fh > 0.5) {
    const back = cy0 < 0;
    const res = Math.min(2, Math.max(1, Math.hypot(ctx.getTransform().a, ctx.getTransform().b)));
    const bw = Math.ceil(mw * s * res);
    const bh = Math.ceil(mh * s * res);
    const buf = scratch("logo3d-face", Math.max(1, bw), Math.max(1, bh));
    buf.ctx.imageSmoothingQuality = "high";
    if (back) {
      buf.ctx.save();
      buf.ctx.translate(bw, 0);
      buf.ctx.scale(-1, 1);
      buf.ctx.drawImage(tint(m, mixHex(palette.primary, palette.secondary, 0.4)), 0, 0, bw, bh);
      buf.ctx.restore();
    } else buf.ctx.drawImage(m.src, 0, 0, bw, bh);
    // Gloss: a bright upper half, a soft horizon line across the middle and a faint floor bounce.
    const gl = buf.ctx.createLinearGradient(0, 0, 0, bh);
    const k = palette.light ? 0.6 : 1;
    gl.addColorStop(0, `rgba(255,255,255,${0.3 * k})`);
    gl.addColorStop(0.46, `rgba(255,255,255,${0.06 * k})`);
    gl.addColorStop(0.5, `rgba(0,0,0,${0.1 * k})`);
    gl.addColorStop(1, `rgba(255,255,255,${0.1 * k})`);
    buf.ctx.globalCompositeOperation = "source-atop";
    buf.ctx.fillStyle = gl;
    buf.ctx.fillRect(0, 0, bw, bh);
    buf.ctx.globalCompositeOperation = "source-over";
    if (p.sweep !== undefined) lightSweep(buf.ctx, 0, 0, bw, bh, p.sweep, { alpha: 0.85, width: 0.22, op: "source-atop" });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(buf.canvas, 0, 0, bw, bh, cx - fw / 2, cy - fh / 2, fw, fh);
  }
  ctx.restore();
}

const glows = new Map<string, { c: HTMLCanvasElement; px: number; py: number }>();
/** The mark's silhouette blurred into a glow (cached), with its padding as fractions of its size. */
function glowOf(m: Mark, color: string) {
  const key = `${m.key}|${color}|${m.src.width}`;
  let g = glows.get(key);
  if (!g) {
    if (glows.size > 32) glows.clear();
    const f = Math.min(1, 220 / Math.max(m.src.width, m.src.height));
    const w0 = Math.max(1, Math.round(m.src.width * f));
    const h0 = Math.max(1, Math.round(m.src.height * f));
    const pad = Math.ceil(Math.max(w0, h0) * 0.32);
    const c = document.createElement("canvas");
    c.width = w0 + pad * 2;
    c.height = h0 + pad * 2;
    const x = c.getContext("2d")!;
    // The shadow alone: the silhouette is drawn off the canvas and its blurred shadow cast back on.
    x.shadowColor = color;
    x.shadowBlur = pad * 0.5;
    x.shadowOffsetX = c.width + 8;
    const sil = tint(m, color);
    x.drawImage(sil, pad - c.width - 8, pad, w0, h0);
    x.drawImage(sil, pad - c.width - 8, pad, w0, h0);
    g = { c, px: pad / w0, py: pad / h0 };
    glows.set(key, g);
  }
  return g;
}

const haloColor = (sc: SkillContext) => (sc.palette.light ? sc.palette.primary : mixHex(sc.palette.primary, "#ffffff", 0.3));
/** Composite for added light: additive on dark stages, plain on light ones. */
const addOp = (sc: SkillContext): GlobalCompositeOperation => (sc.palette.light ? "source-over" : "lighter");
/** The hottest colour of a light: near white on dark stages, the brand colour on light ones. */
const hotOf = (sc: SkillContext) => (sc.palette.light ? sc.palette.primary : mixHex(sc.palette.primary, "#ffffff", 0.75));

/** A glow of light around the mark's own shape. */
function haloAt(sc: SkillContext, m: Mark, cx: number, cy: number, fw: number, fh: number, k: number) {
  const { ctx } = sc;
  const g = glowOf(m, haloColor(sc));
  const w = fw * (1 + 2 * g.px);
  const h = fh * (1 + 2 * g.py);
  ctx.save();
  ctx.globalCompositeOperation = addOp(sc);
  ctx.globalAlpha *= k * (sc.palette.light ? 0.4 : 0.65);
  ctx.drawImage(g.c, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

/** A soft contact shadow on the floor under the mark. */
function contactShadow(sc: SkillContext, cx: number, y: number, rw: number, k: number) {
  const { ctx, palette } = sc;
  if (k <= 0) return;
  const g = ctx.createRadialGradient(cx, y, 0, cx, y, rw);
  g.addColorStop(0, `rgba(0,0,0,${(palette.light ? 0.22 : 0.45) * k})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.fillStyle = g;
  ctx.translate(cx, y);
  ctx.scale(1, 0.16);
  ctx.translate(-cx, -y);
  ctx.beginPath();
  ctx.arc(cx, y, rw, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw `paint` (the mark, onto a full-frame layer) and its reflection in a floor at `floorY`, fading
 * downwards. The layer is reused, so the mark is painted once per frame.
 */
function withReflection(sc: SkillContext, floorY: number, strength: number, paint: (layer: SkillContext) => void, fade = Math.min(sc.w, sc.h) * 0.11) {
  const { ctx, w, h } = sc;
  const res = Math.max(1, Math.hypot(ctx.getTransform().a, ctx.getTransform().b));
  const lw = Math.ceil(w * res);
  const lh = Math.ceil(h * res);
  const layer = scratch("logo3d-layer", lw, lh);
  layer.ctx.setTransform(res, 0, 0, res, 0, 0);
  paint({ ...sc, ctx: layer.ctx });
  layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (strength > 0) {
    const refl = scratch("logo3d-refl", lw, lh);
    refl.ctx.save();
    refl.ctx.translate(0, floorY * 2 * res);
    refl.ctx.scale(1, -1);
    refl.ctx.drawImage(layer.canvas, 0, 0);
    refl.ctx.restore();
    // Fade with distance below the floor.
    const g = refl.ctx.createLinearGradient(0, floorY * res, 0, (floorY + fade) * res);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    refl.ctx.globalCompositeOperation = "destination-in";
    refl.ctx.fillStyle = g;
    refl.ctx.fillRect(0, 0, lw, lh);
    refl.ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(refl.canvas, 0, 0, lw, lh, 0, 0, w, h);
  }
  ctx.drawImage(layer.canvas, 0, 0, lw, lh, 0, 0, w, h);
}

/** The stage behind: the SaaS stage in SaaS videos, the dark cinematic one in trailers. */
function stageBg(sc: SkillContext) {
  if (sc.style === "saas") saasBackground(sc, { beams: 1 });
  else if (!sc.noStage) {
    background(sc, { hot: sc.palette.primary, hotAlpha: 0.2 });
    dust(sc, 60, sc.palette.secondary, 0.12);
  }
}

/** Light gathering where the mark will land, until the hit (a soft glow, never a flash). */
function charge(sc: SkillContext, cx: number, cy: number, r: number, hit: number) {
  const { ctx, t, palette } = sc;
  const k = range(t, 0, hit) * (1 - range(t, hit, hit + 0.6));
  if (k <= 0) return;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, rgba(palette.light ? palette.primary : "#ffffff", 0.28 * k));
  g.addColorStop(0.35, rgba(palette.primary, 0.35 * k));
  g.addColorStop(1, rgba(palette.primary, 0));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** A thin anamorphic streak through the mark on the hit. */
function streak(sc: SkillContext, cx: number, cy: number, hit: number, ex: number) {
  const { ctx, w, t, u, palette } = sc;
  const k = range(t, hit - 0.05, hit + 1.1);
  if (k <= 0 || k >= 1) return;
  const sw = w * 0.5 * ease.outExpo(k);
  const a = Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - ex) * (palette.light ? 0.4 : 0.75);
  ctx.save();
  ctx.globalCompositeOperation = addOp(sc);
  for (const [th, al] of [[2, 1], [10, 0.3]] as const) {
    const g = ctx.createLinearGradient(cx - sw, 0, cx + sw, 0);
    g.addColorStop(0, rgba(palette.primary, 0));
    g.addColorStop(0.5, rgba(palette.light ? palette.primary : "#ffffff", a * al));
    g.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, sw, th * u, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ───────────────────────── The ident kit ───────────────────────── */

type Shot = { m: Mark; P: Placement; hit: number; ex: number; floorY: number };

function shotOf(sc: SkillContext, gap = 18): Shot {
  const m = markOf(sc);
  const P = placement(sc, m);
  return { m, P, hit: hitOf(sc), ex: exitOf(sc), floorY: P.cy + P.mh / 2 + gap * sc.u };
}

/**
 * The camera: it rushes in from slightly closer and turned (settling by the hit), kicks on the hit,
 * then creeps in while the logo holds.
 */
function camera(sc: SkillContext, S: Shot, fly: number, draw: () => void) {
  const { ctx, t, d } = sc;
  const arrive = ease.outCubic(range(t, 0, S.hit + 0.2));
  const creep = ease.inOutCubic(range(t, S.hit, d));
  const zoom = (1 + fly * (1 - arrive)) * (1 + 0.035 * creep);
  const kick = shake(sc, S.hit, 6, 0.45);
  const roll = (sc.seed % 2 ? 1 : -1) * 0.035 * (1 - arrive);
  ctx.save();
  ctx.translate(S.P.cx + kick.x, S.P.cy + kick.y);
  ctx.rotate(roll);
  ctx.scale(zoom, zoom);
  ctx.translate(-S.P.cx, -S.P.cy);
  draw();
  ctx.restore();
}

/** How strong the light behind the mark is: building to the hit, swelling just after, then holding. */
function rayLevel(sc: SkillContext, S: Shot) {
  const { t } = sc;
  const pre = ease.inCubic(range(t, 0.05, S.hit)) * 0.75;
  const post = 0.6 + 0.15 * Math.exp(-(t - S.hit) * 2.2) + 0.25 * Math.sin(Math.PI * range(t, S.hit, S.hit + 0.8));
  return (t < S.hit ? pre : post) * (1 - S.ex);
}

/**
 * Volumetric light behind the mark: a hot core and shafts of light fanning out from behind it,
 * turning slowly. Drawn at a quarter resolution, so the shafts are soft-edged like light in haze.
 */
function backLight(sc: SkillContext, S: Shot, k: number, cy = S.P.cy, floorY = S.floorY) {
  if (k <= 0.01) return;
  const { ctx, w, h, t, palette, seed } = sc;
  const res = Math.max(1, Math.hypot(ctx.getTransform().a, ctx.getTransform().b));
  const q = 0.4 * res;
  const lw = Math.ceil(w * q);
  const lh = Math.ceil(h * q);
  const L = scratch("logo3d-rays", lw, lh);
  const g = L.ctx;
  g.setTransform(q, 0, 0, q, 0, 0);
  const light = !!palette.light;
  const cx = S.P.cx;
  const size = Math.max(S.P.mw, S.P.mh);
  const R = Math.hypot(w, h) * 0.6;
  const c1 = light ? palette.primary : mixHex(palette.primary, "#ffffff", 0.35);
  const c2 = light ? palette.secondary : mixHex(palette.secondary, "#ffffff", 0.25);
  const core = g.createRadialGradient(cx, cy, 0, cx, cy, size * 1.1);
  core.addColorStop(0, rgba(light ? palette.primary : "#ffffff", light ? 0.3 : 0.8));
  core.addColorStop(0.4, rgba(c1, light ? 0.15 : 0.38));
  core.addColorStop(1, rgba(c1, 0));
  g.fillStyle = core;
  g.fillRect(cx - size * 1.1, cy - size * 1.1, size * 2.2, size * 2.2);
  g.globalCompositeOperation = "lighter";
  const r = rng(seed ^ 0x51ab);
  for (let i = 0; i < 22; i++) {
    const dir = r() < 0.5 ? -1 : 1;
    const a = r() * TAU + t * (0.04 + r() * 0.05) * dir;
    const wd = 0.012 + r() * 0.05;
    const len = R * (0.5 + r() * 0.5);
    const al = (0.16 + r() * 0.38) * (light ? 0.5 : 1);
    const col = r() < 0.6 ? c1 : c2;
    const gr = g.createRadialGradient(cx, cy, size * 0.12, cx, cy, len);
    gr.addColorStop(0, rgba(col, al));
    gr.addColorStop(0.35, rgba(col, al * 0.45));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, len, a - wd, a + wd);
    g.closePath();
    g.fill();
  }
  // Calmer below the floor, where the name sits.
  g.globalCompositeOperation = "destination-out";
  const calm = g.createLinearGradient(0, floorY - S.P.mh * 0.1, 0, floorY + h * 0.2);
  calm.addColorStop(0, "rgba(0,0,0,0)");
  calm.addColorStop(1, "rgba(0,0,0,0.75)");
  g.fillStyle = calm;
  g.fillRect(0, floorY - S.P.mh * 0.1, w, h);
  g.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.globalCompositeOperation = addOp(sc);
  ctx.globalAlpha *= k * (light ? 0.6 : 0.55);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(L.canvas, 0, 0, lw, lh, 0, 0, w, h);
  ctx.restore();
}

/**
 * A perspective floor: grid lines running to the horizon under the mark, rows gliding slowly
 * towards the camera, and a glowing horizon line where the mark stands.
 */
function floorGrid(sc: SkillContext, S: Shot, k: number) {
  if (k <= 0.01) return;
  const { ctx, w, h, t, u, palette } = sc;
  const y0 = S.floorY;
  const cx = S.P.cx;
  const deep = h * 1.15 - y0;
  if (deep <= 0) return;
  const col = palette.light ? palette.primary : mixHex(palette.primary, "#ffffff", 0.3);
  const base = (palette.light ? 0.16 : 0.24) * k;
  ctx.save();
  ctx.lineWidth = 1.2 * u;
  // Columns, converging on a vanishing point just above the horizon.
  const vpY = y0 - deep * 0.12;
  const fade = ctx.createRadialGradient(cx, y0 + deep * 0.15, 0, cx, y0 + deep * 0.15, Math.max(w * 0.5, deep * 1.4));
  fade.addColorStop(0, rgba(col, base));
  fade.addColorStop(0.6, rgba(col, base * 0.4));
  fade.addColorStop(1, rgba(col, 0));
  ctx.strokeStyle = fade;
  ctx.beginPath();
  const yb = y0 + deep;
  for (let c = -12; c <= 12; c++) {
    const xb = cx + c * w * 0.1;
    const xh = cx + (xb - cx) * ((y0 - vpY) / (yb - vpY));
    ctx.moveTo(xh, y0);
    ctx.lineTo(xb, yb);
  }
  ctx.stroke();
  // Rows, closer together towards the horizon, gliding towards the camera.
  const glide = (t * 0.35) % 1;
  for (let i = 0; i < 16; i++) {
    const z = 1 + (i + 1 - glide) * 0.55;
    const y = y0 + deep / z;
    const far = clamp((9.5 - z) / 4.5);
    if (far <= 0) continue;
    const half = (w * 0.1 * 12 * (y - vpY)) / (yb - vpY);
    const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
    g.addColorStop(0, rgba(col, 0));
    g.addColorStop(0.5, rgba(col, base * far));
    g.addColorStop(1, rgba(col, 0));
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.lineTo(cx + half, y);
    ctx.stroke();
  }
  // The horizon line, brightest under the mark.
  const hz = ctx.createLinearGradient(cx - w * 0.45, 0, cx + w * 0.45, 0);
  hz.addColorStop(0, rgba(col, 0));
  hz.addColorStop(0.5, rgba(col, (palette.light ? 0.3 : 0.5) * k));
  hz.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = hz;
  ctx.fillRect(cx - w * 0.45, y0 - 0.75 * u, w * 0.9, 1.5 * u);
  ctx.restore();
}

/** Energy streaming in from the edges of the frame to the mark in the run-up to the drop. */
function converge(sc: SkillContext, S: Shot) {
  const { ctx, t, w, h, u, seed, palette } = sc;
  const start = Math.max(0, S.hit - 0.9);
  if (t >= S.hit || t < start) return;
  const k = range(t, start, S.hit);
  const r = rng(seed ^ 0xc0de);
  const R = Math.hypot(w, h) * 0.55;
  const inner = Math.max(S.P.mw, S.P.mh) * 0.45;
  const hot = hotOf(sc);
  ctx.save();
  ctx.globalCompositeOperation = addOp(sc);
  ctx.lineCap = "round";
  for (let i = 0; i < 34; i++) {
    const a = r() * TAU;
    const delay = r() * 0.5;
    const far = R * (0.6 + r() * 0.5);
    const col = r() < 0.5 ? palette.primary : palette.secondary;
    const lw = (1 + r() * 1.5) * u;
    const f = ease.inCubic(range(k, delay, 1));
    if (f <= 0) continue;
    const d0 = lerp(far, inner, f);
    const len = (far - inner) * 0.12 * (0.4 + f);
    const al = Math.min(1, f * 3) * (1 - f * 0.3) * 0.55;
    const x0 = S.P.cx + Math.cos(a) * d0;
    const y0 = S.P.cy + Math.sin(a) * d0;
    const x1 = S.P.cx + Math.cos(a) * (d0 + len);
    const y1 = S.P.cy + Math.sin(a) * (d0 + len);
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgba(hot, al));
    g.addColorStop(1, rgba(col, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

/** The drop's shockwave: a glow where the mark lands and two rings racing out across the floor. */
function shockwave(sc: SkillContext, S: Shot, start = S.hit) {
  const { ctx, t, w, u, palette } = sc;
  if (t < start) return;
  const { cx } = S.P;
  const y = S.floorY;
  const hot = hotOf(sc);
  ctx.save();
  ctx.globalCompositeOperation = addOp(sc);
  const gk = 1 - range(t, start, start + 0.8);
  if (gk > 0) {
    const r = S.P.mw * 0.95;
    const g = ctx.createRadialGradient(cx, y, 0, cx, y, r);
    g.addColorStop(0, rgba(hot, (palette.light ? 0.18 : 0.4) * gk));
    g.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, y, r, r * 0.2, 0, 0, TAU);
    ctx.fill();
  }
  for (const [delay, amp] of [
    [0, 1],
    [0.14, 0.55],
  ] as const) {
    const k = range(t, start + delay, start + delay + 1.1);
    if (k <= 0 || k >= 1) continue;
    const r = S.P.mw * 0.4 + ease.outCubic(k) * w * 0.6;
    const a = (1 - k) ** 1.6 * amp * (palette.light ? 0.5 : 0.85) * (1 - S.ex);
    for (const [lw, al] of [
      [16, 0.22],
      [2, 1],
    ] as const) {
      ctx.strokeStyle = rgba(al === 1 ? hot : palette.primary, a * al);
      ctx.lineWidth = lw * u * (1 - k * 0.5);
      ctx.beginPath();
      ctx.ellipse(cx, y, r, r * 0.17, 0, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Sparks thrown up by the impact: hot streaks flying out on ballistic arcs, cooling to the brand
 * colour as they fall, and bouncing once off the floor.
 */
function sparks(sc: SkillContext, S: Shot, start = S.hit, n = 46) {
  const { ctx, t, h, u, seed, palette } = sc;
  const dt = t - start;
  if (dt < 0 || dt > 2) return;
  const r = rng(seed ^ 0x5a5a);
  const g = h * 1.5;
  const fy = S.floorY;
  const hot = hotOf(sc);
  ctx.save();
  ctx.globalCompositeOperation = addOp(sc);
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const side = r() < 0.5 ? -1 : 1;
    const ang = -Math.PI / 2 + side * (0.25 + r() * 1.05);
    const speed = h * (0.45 + r() * 0.9);
    const x0 = S.P.cx + side * r() * S.P.mw * 0.5;
    const y0 = fy - r() * S.P.mh * 0.25;
    const life = 0.7 + r() * 1.1;
    const wd = 0.8 + r() * 1.6;
    if (dt > life) continue;
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed;
    const tb = (-vy + Math.sqrt(vy * vy - 2 * g * (y0 - fy))) / g;
    const at = (tt: number): [number, number] => {
      if (tt <= tb) return [x0 + vx * tt, y0 + vy * tt + 0.5 * g * tt * tt];
      const t2 = tt - tb;
      const vy2 = -(vy + g * tb) * 0.32;
      return [x0 + vx * tb + vx * 0.55 * t2, Math.min(fy, fy + vy2 * t2 + 0.5 * g * t2 * t2)];
    };
    const [x, y] = at(dt);
    const [px, py] = at(Math.max(0, dt - 0.03));
    const f = dt / life;
    ctx.strokeStyle = rgba(mixHex(hot, palette.primary, Math.min(1, f * 1.4)), (1 - f) ** 1.3 * 0.95);
    ctx.lineWidth = wd * u * (1 - f * 0.6);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Floating marks have no floor: their impact throws a ring of streaks straight out instead. */
function burst(sc: SkillContext, S: Shot, start = S.hit, n = 40) {
  const { ctx, t, w, h, u, seed, palette } = sc;
  const dt = t - start;
  if (dt < 0 || dt > 1.6) return;
  const r = rng(seed ^ 0xb005);
  const hot = hotOf(sc);
  const from = Math.max(S.P.mw, S.P.mh) * 0.32;
  ctx.save();
  ctx.globalCompositeOperation = addOp(sc);
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const speed = (0.35 + r() * 0.8) * Math.max(w, h) * 0.5;
    const life = 0.6 + r() * 0.9;
    const wd = 0.8 + r() * 1.4;
    if (dt > life) continue;
    const dist = (tt: number) => from + (speed * (1 - Math.exp(-3 * tt))) / 3;
    const d1 = dist(dt);
    const d0 = dist(Math.max(0, dt - 0.05));
    const f = dt / life;
    ctx.strokeStyle = rgba(mixHex(hot, palette.primary, Math.min(1, f * 1.4)), (1 - f) ** 1.4 * 0.9);
    ctx.lineWidth = wd * u;
    ctx.beginPath();
    ctx.moveTo(S.P.cx + Math.cos(a) * d0, S.P.cy + Math.sin(a) * d0);
    ctx.lineTo(S.P.cx + Math.cos(a) * d1 + 0.01, S.P.cy + Math.sin(a) * d1);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A lens flare off the mark's top corner after the hit: a hot point with a fine star, and ghosts
 * strung along the line through the centre of the frame. Dark stages only.
 */
function flare(sc: SkillContext, S: Shot, start = S.hit) {
  const { ctx, t, w, h, u, palette } = sc;
  if (palette.light) return;
  const k = Math.sin(Math.PI * range(t, start - 0.05, start + 1.8)) * (1 - S.ex);
  if (k <= 0.01) return;
  const drift = range(t, start, start + 1.8);
  const sx = S.P.cx + S.P.mw * (0.42 - drift * 0.22);
  const sy = S.P.cy - S.P.mh * 0.48;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const src = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60 * u);
  src.addColorStop(0, rgba("#ffffff", 0.7 * k));
  src.addColorStop(0.3, rgba(palette.primary, 0.25 * k));
  src.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = src;
  ctx.fillRect(sx - 60 * u, sy - 60 * u, 120 * u, 120 * u);
  for (const [ang, len] of [
    [0.35, 90],
    [0.35 + Math.PI / 2, 60],
  ] as const) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang + drift * 0.3);
    const g = ctx.createLinearGradient(-len * u, 0, len * u, 0);
    g.addColorStop(0, rgba("#ffffff", 0));
    g.addColorStop(0.5, rgba("#ffffff", 0.55 * k));
    g.addColorStop(1, rgba("#ffffff", 0));
    ctx.fillStyle = g;
    ctx.fillRect(-len * u, -0.8 * u, len * 2 * u, 1.6 * u);
    ctx.restore();
  }
  const ghosts = [
    [0.55, 18, palette.secondary, 0.18],
    [0.85, 34, palette.accent, 0.1],
    [1.2, 10, "#ffffff", 0.22],
    [1.5, 56, palette.primary, 0.08],
    [1.95, 24, palette.secondary, 0.12],
  ] as const;
  for (const [f, rad, col, a] of ghosts) {
    const x = sx + (w / 2 - sx) * f;
    const y = sy + (h / 2 - sy) * f;
    const rr = rad * u;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, rgba(col, a * 0.35 * k));
    g.addColorStop(0.75, rgba(col, a * k));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Embers drifting up through the shot: fine ones far back, a few big out-of-focus ones close to the
 * lens. The drop's blast pushes the nearby ones out from the mark.
 */
function embers(sc: SkillContext, S: Shot, front: boolean) {
  const { ctx, w, h, t, u, seed, palette } = sc;
  const n = front ? 9 : 36;
  const r = rng(seed ^ (front ? 0xf00d : 0xbeef));
  const fade = clamp(t / 0.6) * (1 - S.ex);
  if (fade <= 0) return;
  const push = ease.outCubic(range(t, S.hit, S.hit + 1.2));
  const span = h * 1.3;
  ctx.save();
  ctx.globalCompositeOperation = addOp(sc);
  for (let i = 0; i < n; i++) {
    const x0 = r() * w;
    const off = r();
    const speed = front ? 0.1 + r() * 0.1 : 0.025 + r() * 0.06;
    const size = (front ? 5 + r() * 9 : 1 + r() * 2.2) * u;
    const ph = r() * TAU;
    const a0 = front ? 0.1 + r() * 0.12 : 0.3 + r() * 0.45;
    const ci = r();
    let y = h * 1.12 - ((t * speed * h + off * span) % span);
    let x = x0 + Math.sin(t * 0.7 + ph) * 18 * u;
    const dx = x - S.P.cx;
    const dy = y - S.P.cy;
    const dd = Math.hypot(dx, dy) || 1;
    const near = clamp(1 - dd / (w * 0.6));
    x += (dx / dd) * push * near * 70 * u;
    y += (dy / dd) * push * near * 70 * u;
    const col = ci < 0.5 ? palette.primary : ci < 0.8 ? palette.secondary : palette.light ? palette.accent : "#ffffff";
    const a = a0 * fade * (0.75 + 0.25 * Math.sin(t * 2.3 + ph));
    if (front) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, size);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(0.6, rgba(col, a * 0.5));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
    } else ctx.fillStyle = rgba(col, a);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A bright scan line across the mark (the logo being built line by line). */
function scanLine(sc: SkillContext, P: Placement, y: number, k: number) {
  if (k <= 0.01) return;
  const { ctx, u, palette } = sc;
  const half = P.mw * 0.62;
  ctx.save();
  ctx.globalCompositeOperation = addOp(sc);
  for (const [th, al] of [
    [14, 0.25],
    [2, 0.95],
  ] as const) {
    const g = ctx.createLinearGradient(P.cx - half, 0, P.cx + half, 0);
    g.addColorStop(0, rgba(palette.primary, 0));
    g.addColorStop(0.5, rgba(hotOf(sc), al * k));
    g.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = g;
    ctx.fillRect(P.cx - half, y - (th * u) / 2, half * 2, th * u);
  }
  ctx.restore();
}

/** The name (and line) under the mark: tracking in as it rises, then a sweep of light across it. */
function nameBelow(sc: SkillContext, y: number, start: number, ex: number) {
  const { ctx, w, t, u, palette } = sc;
  const k = ease.outExpo(range(t, start, start + 0.9));
  if (k <= 0) return;
  const saas = sc.style === "saas";
  const layout = headline(sc, { cy: y, sizeFrac: 0.11, maxLines: 1, natural: saas, font: saas ? saasFont(sc) : undefined });
  const spaced = { ...layout, tracking: layout.tracking + (1 - k) * layout.size * 0.18 };
  ctx.save();
  ctx.globalAlpha *= k * (1 - ex);
  ctx.translate(0, (1 - k) * 24 * u);
  ctx.fillStyle = palette.text;
  drawLayout(sc, spaced);
  const s = range(t, start + 0.45, start + 1.6);
  if (s > 0 && s < 1) {
    const x = lerp(w * 0.15, w * 0.85, ease.inOutCubic(s));
    const band = w * 0.08;
    const g = ctx.createLinearGradient(x - band, 0, x + band, 0);
    const shine = palette.light ? palette.primary : "#ffffff";
    g.addColorStop(0, rgba(shine, 0));
    g.addColorStop(0.5, rgba(shine, palette.light ? 0.55 : 0.9));
    g.addColorStop(1, rgba(shine, 0));
    ctx.fillStyle = g;
    drawLayout(sc, spaced);
  }
  ctx.restore();
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 36 * u, range(t, start + 0.4, start + 1), { alpha: 1 - ex });
}

/** Where the name sits under a mark standing on the floor: below its reflection. */
const nameY = (sc: SkillContext, P: { mh: number }, floorY: number) => floorY + P.mh * 0.36 + Math.min(sc.w, sc.h) * 0.07;

type IdentOpts = {
  /** How much closer the camera starts (it settles by the hit). */
  fly?: number;
  /** Stand the mark on a reflective floor (default) or float it. */
  floor?: boolean;
  reflect?: number;
  /** Contact shadow strength. */
  shadow?: number;
  /** Strength of the light behind the mark, and where it sits. */
  rays?: number;
  raysY?: number;
  nameStart?: number;
  nameAt?: number;
  /** Drawn behind the mark (and in front of the floor). */
  behind?: () => void;
  /** Drawn in front of the mark. */
  front?: () => void;
};

/** One ident shot, in the kit's order: light, floor, embers and energy behind; the mark; flares, embers and the name in front. */
function ident(sc: SkillContext, S: Shot, o: IdentOpts, mark: (L: SkillContext) => void) {
  const { t } = sc;
  const floor = o.floor !== false;
  camera(sc, S, o.fly ?? 0.12, () => {
    backLight(sc, S, rayLevel(sc, S) * (o.rays ?? 1), o.raysY);
    if (floor) floorGrid(sc, S, clamp(t / 0.5) * (1 - S.ex) * (0.6 + 0.4 * range(t, S.hit, S.hit + 0.4)));
    embers(sc, S, false);
    converge(sc, S);
    charge(sc, S.P.cx, S.P.cy, Math.max(S.P.mw, S.P.mh), S.hit);
    o.behind?.();
    if (floor) {
      shockwave(sc, S);
      contactShadow(sc, S.P.cx, S.floorY, S.P.mw * 0.6, (1 - S.ex) * (o.shadow ?? 1));
      withReflection(sc, S.floorY, (o.reflect ?? 0.28) * (1 - S.ex), (L) => {
        mark(L);
        sparks(L, S);
      });
    } else {
      mark(sc);
      burst(sc, S);
    }
    o.front?.();
    streak(sc, S.P.cx, S.P.cy, S.hit, S.ex);
    flare(sc, S);
    embers(sc, S, true);
    if (S.P.named) nameBelow(sc, o.nameAt ?? nameY(sc, S.P, S.floorY), o.nameStart ?? S.hit + 0.35, S.ex);
  });
}

const hitOf = (sc: SkillContext) => revealHit(sc.d, sc.beat);
const exitOf = (sc: SkillContext) => ease.inOutCubic(exitT(sc, 0.5));
const identSfx = (raw: Scene, beat: number): SfxCue[] => {
  const hit = revealHit(raw.duration, beat);
  return [
    { t: 0.02, kind: "whoosh" },
    { t: hit, kind: "strike" },
    { t: hit + 0.45, kind: "shimmer" },
  ];
};

/** A slow turn while the logo holds after landing, so its depth keeps reading. */
const holdTurn = (sc: SkillContext, S: Shot, amount = 0.22) => amount * ease.inOutCubic(range(sc.t, S.hit + 0.9, sc.d));

/* ───────────────────────── 3D Extrude ───────────────────────── */

function logoExtrude(sc: SkillContext) {
  const { t } = sc;
  stageBg(sc);
  const S = shotOf(sc);
  const { m, P, hit, ex } = S;
  const depth = Math.min(P.mw, P.mh) * 0.38;
  // A scan line builds the flat logo by the hit; then it snaps into depth (with overshoot) and
  // swings round to a three-quarter view, turning on slowly as it holds.
  const scan = ease.inOutCubic(range(t, 0.04, hit * 0.92));
  const grow = clamp(spring(t - hit, 16, 8), 0, 1.15);
  const swing = clamp(spring(t - hit, 7, 4.5), 0, 1.2);
  ident(sc, S, { fly: 0.14, shadow: range(t, hit - 0.2, hit + 0.3) }, (L) => {
    if (t < hit) {
      const top = P.cy - P.mh / 2;
      const yS = top + P.mh * scan;
      haloAt(L, m, P.cx, P.cy, P.mw, P.mh, 0.3 * clamp(t / 0.15));
      L.ctx.save();
      L.ctx.beginPath();
      L.ctx.rect(0, 0, L.w, yS);
      L.ctx.clip();
      solid(L, m, P.cx, P.cy, P.mw, P.mh, { yaw: 0, depth: 0, alpha: 0.95 });
      L.ctx.restore();
      scanLine(L, P, yS, clamp(t / 0.1) * (1 - range(t, hit - 0.12, hit)));
      return;
    }
    solid(L, m, P.cx, P.cy, P.mw, P.mh, {
      yaw: -0.36 * swing + holdTurn(sc, S) + Math.sin(t * 0.7) * 0.03 * range(t, hit + 1, hit + 2),
      pitch: 0.16 * clamp(swing, 0, 1),
      depth: depth * grow,
      scale: 1 + 0.05 * ex,
      sweep: ease.inOutCubic(range(t, hit + 0.35, hit + 1.3)),
      alpha: 1 - ex,
      halo: 0.55 * range(t, hit, hit + 0.4),
    });
  });
}

/* ───────────────────────── Coin Spin ───────────────────────── */

function logoSpin(sc: SkillContext) {
  const { t, u } = sc;
  stageBg(sc);
  const S = shotOf(sc, 22);
  const { m, P, hit, ex } = S;
  const depth = Math.min(P.mw, P.mh) * 0.16;
  // Two turns, braking to face front exactly on the hit; then a slow living sway.
  const turns = 2 * TAU;
  const spinAt = (tt: number) => (tt < hit ? turns * (1 - ease.outCubic(range(tt, 0, hit))) : 0) + Math.sin(tt * 0.9) * 0.06 * range(tt, hit + 0.6, hit + 1.6);
  const yaw = spinAt(t) + holdTurn(sc, S, -0.18);
  const speed = Math.abs(spinAt(t) - spinAt(t - 1 / 30));
  const bob = Math.sin(t * 1.4) * 4 * u * range(t, hit + 0.4, hit + 1.2);
  ident(sc, S, { fly: 0.1, reflect: 0.3, shadow: clamp(t / 0.3) }, (L) => {
    // Motion trails while it spins fast.
    if (speed > 0.15) for (let g = 3; g >= 1; g--) solid(L, m, P.cx, P.cy + bob, P.mw, P.mh, { yaw: spinAt(t - g * 0.025), depth, alpha: 0.14 * clamp(speed) * clamp(t / 0.25) });
    solid(L, m, P.cx, P.cy + bob, P.mw, P.mh, {
      yaw,
      depth,
      scale: lerp(0.75, 1, ease.outCubic(range(t, 0, hit))) * (1 + 0.05 * ex),
      sweep: ease.inOutCubic(range(t, hit + 0.2, hit + 1.1)),
      alpha: clamp(t / 0.25) * (1 - ex),
      halo: 0.5 * range(t, hit - 0.1, hit + 0.3),
    });
    // A glint of light as the edge turns to face the camera.
    const edge = Math.abs(Math.cos(yaw));
    if (t < hit && edge < 0.3) {
      const k = (1 - edge / 0.3) * 0.8 * clamp(t / 0.2);
      const g = L.ctx.createLinearGradient(0, P.cy - P.mh * 0.6, 0, P.cy + P.mh * 0.6);
      g.addColorStop(0, rgba(hotOf(sc), 0));
      g.addColorStop(0.5, rgba(hotOf(sc), k));
      g.addColorStop(1, rgba(hotOf(sc), 0));
      L.ctx.save();
      L.ctx.globalCompositeOperation = addOp(sc);
      L.ctx.fillStyle = g;
      L.ctx.fillRect(P.cx - 1.5 * u, P.cy + bob - P.mh * 0.6, 3 * u, P.mh * 1.2);
      L.ctx.restore();
    }
  });
}

/* ───────────────────────── Shard Assemble ───────────────────────── */

function logoShatter(sc: SkillContext) {
  const { t, u, seed, palette } = sc;
  stageBg(sc);
  const S = shotOf(sc);
  const { m, P, hit, ex } = S;
  const depth = Math.min(P.mw, P.mh) * 0.26;
  const cols = m.ar > 2 ? 10 : 6;
  const rows = m.ar > 2 ? 3 : 6;
  const grow = clamp(spring(t - hit, 15, 8), 0, 1.12);
  const yaw = -0.32 * clamp(spring(t - hit, 6, 4.5), 0, 1.2) + holdTurn(sc, S) + Math.sin(t * 0.6) * 0.04 * range(t, hit + 1, hit + 2);
  const edgeTint = tint(m, mixHex(palette.primary, "#000000", palette.light ? 0.3 : 0.5));
  ident(
    sc,
    S,
    {
      shadow: range(t, hit, hit + 0.3),
      // As it fuses, the seams between the shards glow, then fade.
      front: () => {
        const k = (1 - range(t, hit, hit + 0.75)) * (1 - ex);
        if (t < hit || k <= 0.01) return;
        const F = lastFace;
        const res = Math.max(1, Math.hypot(sc.ctx.getTransform().a, sc.ctx.getTransform().b));
        const bw = Math.max(1, Math.ceil(F.w * res));
        const bh = Math.max(1, Math.ceil(F.h * res));
        const buf = scratch("logo3d-seams", bw, bh);
        const g = buf.ctx;
        g.strokeStyle = hotOf(sc);
        g.lineWidth = 2 * u * res;
        g.beginPath();
        for (let c = 1; c < cols; c++) {
          g.moveTo((c / cols) * bw, 0);
          g.lineTo((c / cols) * bw, bh);
        }
        for (let r = 1; r < rows; r++) {
          g.moveTo(0, (r / rows) * bh);
          g.lineTo(bw, (r / rows) * bh);
        }
        g.stroke();
        g.globalCompositeOperation = "destination-in";
        g.drawImage(m.src, 0, 0, bw, bh);
        g.globalCompositeOperation = "source-over";
        sc.ctx.save();
        sc.ctx.globalCompositeOperation = addOp(sc);
        sc.ctx.globalAlpha *= k * (palette.light ? 0.6 : 1);
        sc.ctx.drawImage(buf.canvas, 0, 0, bw, bh, F.x, F.y, F.w, F.h);
        sc.ctx.restore();
      },
    },
    (L) => {
      if (t >= hit) {
        solid(L, m, P.cx, P.cy, P.mw, P.mh, { yaw, pitch: 0.1, depth: depth * grow, scale: 1 + 0.05 * ex, sweep: ease.inOutCubic(range(t, hit + 0.3, hit + 1.2)), alpha: 1 - ex, halo: 0.55 * range(t, hit, hit + 0.3) });
        return;
      }
      // Thick shards of the face, each starting somewhere in depth, flying to their place by the hit.
      const ctx = L.ctx;
      const sw = m.src.width / cols;
      const sh = m.src.height / rows;
      const tw = P.mw / cols;
      const th = P.mh / rows;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const hsh = hashString(`${seed}:shard:${r}:${c}`);
          const a = ((hsh % 1000) / 1000) * TAU;
          const z = ((hsh >>> 10) % 1000) / 1000;
          const delay = (((hsh >>> 20) % 100) / 100) * 0.35;
          const k = ease.outCubic(range(t, delay * hit, hit));
          const tx = P.cx - P.mw / 2 + (c + 0.5) * tw;
          const ty = P.cy - P.mh / 2 + (r + 0.5) * th;
          const far = (1 - k) * Math.min(sc.w, sc.h) * (0.4 + z * 0.6);
          const x = tx + Math.cos(a) * far;
          const y = ty + Math.sin(a) * far;
          const s = lerp(0.3 + z * 1.6, 1, k);
          const rot = (1 - k) * (z - 0.5) * 6;
          const thick = (1 - k) * 7 * u;
          ctx.save();
          ctx.globalAlpha = clamp(t / 0.15) * clamp(k * 3);
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.scale(s, s);
          // Its edge (thickness), then its face, rimmed with light while it flies.
          if (thick > 0.3) ctx.drawImage(edgeTint, c * sw, r * sh, sw, sh, -tw / 2 + thick, -th / 2 + thick, tw + 0.6, th + 0.6);
          ctx.drawImage(m.src, c * sw, r * sh, sw, sh, -tw / 2, -th / 2, tw + 0.6, th + 0.6);
          if (k < 1) {
            ctx.globalCompositeOperation = addOp(sc);
            ctx.globalAlpha *= (1 - k) * 0.5;
            ctx.strokeStyle = hotOf(sc);
            ctx.lineWidth = 1.2 * u;
            ctx.strokeRect(-tw / 2, -th / 2, tw, th);
          }
          ctx.restore();
        }
    },
  );
}

/* ───────────────────────── Orbit Rings ───────────────────────── */

function logoOrbit(sc: SkillContext) {
  const { ctx, t, u, palette } = sc;
  stageBg(sc);
  const S = shotOf(sc);
  const { m, P, hit, ex } = S;
  const depth = Math.min(P.mw, P.mh) * 0.24;
  const R = Math.max(P.mw, P.mh) * 0.78;
  const grow = ease.outCubic(range(t, 0.05, hit + 0.3));
  const rings = [
    { tilt: 0.32, spin: 0.9, rot: 0.35, color: palette.primary, size: 1 },
    { tilt: 0.22, spin: -0.65, rot: -0.5, color: palette.secondary, size: 1.16 },
    { tilt: 0.4, spin: 0.45, rot: 0.08, color: palette.accent, size: 1.3 },
  ];
  // Each ring is drawn in two halves: the far half behind the mark, the near half in front. Comet
  // lights travel round them with fading tails, and a fine dust of points rides each one.
  const ring = (front: boolean) => {
    rings.forEach((rg, i) => {
      const rr = R * rg.size * grow;
      if (rr < 2) return;
      ctx.save();
      ctx.translate(P.cx, P.cy);
      ctx.rotate(rg.rot);
      const fade = (1 - ex) * clamp(grow * 1.5 - i * 0.15);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = rgba(rg.color, front ? 0.85 : 0.35);
      ctx.lineWidth = (front ? 2.5 : 1.6) * u;
      ctx.beginPath();
      ctx.ellipse(0, 0, rr, rr * rg.tilt, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = addOp(sc);
      ctx.fillStyle = rgba(rg.color, front ? 0.5 : 0.25);
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * TAU + t * rg.spin * 0.4;
        if (Math.sin(a) > 0 !== front) continue;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr * 1.04, Math.sin(a) * rr * rg.tilt * 1.04, 1.1 * u, 0, TAU);
        ctx.fill();
      }
      for (let k = 0; k < 2; k++) {
        const head = t * rg.spin * 1.6 + (k * TAU) / 2 + i;
        for (let j = 12; j >= 0; j--) {
          const a = head - j * 0.07 * Math.sign(rg.spin);
          if (Math.sin(a) > 0 !== front) continue;
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr * rg.tilt;
          const fall = 1 - j / 13;
          const rad = (j === 0 ? 14 : 5 * fall + 1) * u;
          const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
          g.addColorStop(0, rgba(palette.light ? rg.color : "#ffffff", (j === 0 ? 0.95 : 0.5) * fall));
          g.addColorStop(0.4, rgba(rg.color, 0.6 * fall));
          g.addColorStop(1, rgba(rg.color, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    });
  };
  const k = ease.outBack(range(t, hit - 0.25, hit + 0.35), 1.5);
  ident(
    sc,
    S,
    { floor: false, fly: 0.1, nameAt: P.cy + R * 0.42 + Math.min(sc.w, sc.h) * 0.14, behind: () => ring(false), front: () => ring(true) },
    (L) =>
      solid(L, m, P.cx, P.cy, P.mw, P.mh, {
        yaw: Math.sin(t * 0.8) * 0.3 * clamp(range(t, hit, hit + 0.6)),
        pitch: 0.08,
        depth,
        scale: Math.max(0, k) * (1 + 0.05 * ex),
        sweep: ease.inOutCubic(range(t, hit + 0.3, hit + 1.2)),
        alpha: clamp(k * 2) * (1 - ex),
        halo: 0.6 * range(t, hit, hit + 0.4),
      }),
  );
}

/* ───────────────────────── Hero Stage ───────────────────────── */

function logoStage(sc: SkillContext) {
  const { ctx, w, t, d, u, seed, palette } = sc;
  stageBg(sc);
  const S = shotOf(sc, 10);
  const { m, P, hit, ex, floorY } = S;
  const depth = Math.min(P.mw, P.mh) * 0.3;
  const cone = clamp(t / 0.4) * (1 - ex);
  const coneTop = P.mw * 0.12;
  const coneBottom = P.mw * 0.85;
  // Rises through the floor to stand on it by the hit; the camera arcs round as it holds.
  const rise = ease.outCubic(range(t, 0.05, hit));
  const arc = ease.inOutCubic(range(t, hit, d - 0.4));
  const lift = (1 - rise) * (P.mh + depth);
  ident(
    sc,
    S,
    {
      reflect: 0.32,
      rays: 0.55,
      shadow: rise,
      nameStart: hit + 0.4,
      behind: () => {
        // A cone of light from above onto the spot where the mark stands, and its pool on the floor.
        ctx.save();
        const cg = ctx.createLinearGradient(0, 0, 0, floorY);
        cg.addColorStop(0, rgba(palette.light ? palette.primary : "#ffffff", palette.light ? 0.05 : 0.1));
        cg.addColorStop(1, rgba(palette.primary, palette.light ? 0.1 : 0.16));
        ctx.fillStyle = cg;
        ctx.globalAlpha = cone;
        ctx.beginPath();
        ctx.moveTo(P.cx - coneTop, 0);
        ctx.lineTo(P.cx + coneTop, 0);
        ctx.lineTo(P.cx + coneBottom, floorY);
        ctx.lineTo(P.cx - coneBottom, floorY);
        ctx.closePath();
        ctx.fill();
        const pool = ctx.createRadialGradient(P.cx, floorY, 0, P.cx, floorY, P.mw);
        pool.addColorStop(0, rgba(palette.primary, palette.light ? 0.16 : 0.26));
        pool.addColorStop(1, rgba(palette.primary, 0));
        ctx.fillStyle = pool;
        ctx.translate(P.cx, floorY);
        ctx.scale(1, 0.18);
        ctx.beginPath();
        ctx.arc(0, 0, P.mw, 0, TAU);
        ctx.fill();
        ctx.restore();
        // A low mist line along the floor.
        ctx.save();
        const mist = ctx.createLinearGradient(0, floorY - 30 * u, 0, floorY + 30 * u);
        mist.addColorStop(0, rgba(palette.text, 0));
        mist.addColorStop(0.5, rgba(palette.text, (palette.light ? 0.06 : 0.08) * cone));
        mist.addColorStop(1, rgba(palette.text, 0));
        ctx.fillStyle = mist;
        ctx.fillRect(0, floorY - 30 * u, w, 60 * u);
        // Ripples spreading over the floor while it rises through it.
        ctx.globalCompositeOperation = addOp(sc);
        ctx.lineWidth = 1.5 * u;
        for (let i = 0; i < 4; i++) {
          const born = i * 0.18;
          const k = range(t, born, born + 1.2);
          if (k <= 0 || k >= 1) continue;
          const r = P.mw * (0.45 + k * 0.9);
          ctx.strokeStyle = rgba(hotOf(sc), (1 - k) ** 1.5 * 0.5 * cone);
          ctx.beginPath();
          ctx.ellipse(P.cx, floorY, r, r * 0.15, 0, 0, TAU);
          ctx.stroke();
        }
        ctx.restore();
      },
      front: () => {
        // Dust motes turning in the beam.
        const r = rng(seed ^ 0xd057);
        ctx.save();
        ctx.globalCompositeOperation = addOp(sc);
        for (let i = 0; i < 30; i++) {
          const v = r();
          const y = ((r() + t * (0.02 + r() * 0.03)) % 1) * floorY;
          const half = lerp(coneTop, coneBottom, y / floorY);
          const x = P.cx + (v * 2 - 1) * half * 0.9 + Math.sin(t * 0.6 + i) * 6 * u;
          const a = (0.25 + r() * 0.45) * cone * (1 - Math.abs(v * 2 - 1));
          ctx.fillStyle = rgba(palette.light ? palette.primary : "#ffffff", a);
          ctx.beginPath();
          ctx.arc(x, y, (0.8 + r() * 1.6) * u, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      },
    },
    (L) => {
      L.ctx.save();
      L.ctx.beginPath();
      L.ctx.rect(0, 0, w, floorY);
      L.ctx.clip();
      solid(L, m, P.cx, P.cy + lift, P.mw, P.mh, {
        yaw: lerp(0.55, 0.12, arc),
        pitch: 0.1,
        depth,
        scale: 1 + 0.06 * arc,
        sweep: ease.inOutCubic(range(t, hit + 0.2, hit + 1.2)),
        alpha: clamp(t / 0.2) * (1 - ex),
        halo: 0.5 * range(t, hit - 0.1, hit + 0.4),
      });
      L.ctx.restore();
    },
  );
}

/* ───────────────────────── Layer Stack ───────────────────────── */

function logoLayers(sc: SkillContext) {
  const { t, u, palette } = sc;
  stageBg(sc);
  const S = shotOf(sc);
  const { m, P, hit, ex } = S;
  const layers = 5;
  // Apart (in an isometric tilt) until the hit, when they collapse into one solid that turns to face you.
  const apart = 1 - ease.inOutCubic(range(t, hit * 0.35, hit));
  const tilt = 1 - ease.inOutCubic(range(t, hit, hit + 0.8));
  const fade = clamp(t / 0.3) * (1 - ex);
  const gap = P.mh * 0.32 * apart;
  const grow = clamp(spring(t - hit, 14, 8), 0, 1.1);
  ident(sc, S, { shadow: range(t, hit, hit + 0.4), reflect: 0.26 * (1 - tilt), nameStart: hit + 0.5 }, (L) => {
    const ctx = L.ctx;
    if (tilt > 0.01 && t < hit + 0.8) {
      for (let i = layers - 1; i >= 0; i--) {
        ctx.save();
        ctx.globalAlpha = fade * (i === 0 ? 1 : 0.55 + 0.45 * (1 - apart)) * (t < hit ? 1 : tilt);
        ctx.translate(P.cx, P.cy - (i - (layers - 1) / 2) * gap);
        ctx.scale(1, 1 - 0.5 * tilt);
        ctx.rotate(-0.55 * tilt);
        if (i > 0) {
          // A glass plate under each copy: a faint fill, a lit rim and a moving glint.
          const pw = P.mw + 16 * u;
          const ph = P.mh + 16 * u;
          ctx.fillStyle = rgba(palette.light ? palette.primary : "#ffffff", 0.05 * apart);
          ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
          ctx.strokeStyle = rgba(hotOf(sc), 0.45 * apart);
          ctx.lineWidth = 1.5 * u;
          ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
          const gx = ((t * 0.6 + i * 0.17) % 1) * pw * 1.6 - pw * 0.8;
          const gl = ctx.createLinearGradient(gx - 30 * u, 0, gx + 30 * u, 0);
          gl.addColorStop(0, rgba("#ffffff", 0));
          gl.addColorStop(0.5, rgba("#ffffff", (palette.light ? 0.25 : 0.14) * apart));
          gl.addColorStop(1, rgba("#ffffff", 0));
          ctx.fillStyle = gl;
          ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
        }
        const src = i === 0 ? m.src : tint(m, mixHex(palette.primary, palette.secondary, i / layers));
        ctx.drawImage(src, -P.mw / 2, -P.mh / 2, P.mw, P.mh);
        ctx.restore();
      }
    }
    if (t >= hit)
      solid(L, m, P.cx, P.cy, P.mw, P.mh, {
        yaw: -0.25 * (1 - tilt) * clamp(spring(t - hit - 0.5, 6, 4.5), 0, 1.2) + holdTurn(sc, S),
        pitch: 0.1,
        depth: Math.min(P.mw, P.mh) * 0.28 * grow,
        sweep: ease.inOutCubic(range(t, hit + 0.6, hit + 1.5)),
        alpha: (1 - ex) * (1 - tilt * 0.999),
        halo: 0.55 * (1 - tilt),
      });
  });
}

/* ───────────────────────── Fly-through ───────────────────────── */

function logoTunnel(sc: SkillContext) {
  const { ctx, w, h, t, u, seed, palette } = sc;
  stageBg(sc);
  const S = shotOf(sc);
  const { m, P, hit, ex } = S;
  // Outlines of the mark at depths down the tunnel; the camera flies forward, braking at the hit.
  const travel = (tt: number) => (tt < hit ? 6 * ease.outCubic(range(tt, 0, hit)) : 6 + (tt - hit) * 0.15);
  const cam = travel(t);
  const vel = (travel(t) - travel(t - 1 / 30)) * 30;
  const outline = tint(m, palette.primary);
  const glow = glowOf(m, haloColor(sc));
  const fade = clamp(t / 0.25) * (1 - ex) * (1 - range(t, hit, hit + 0.7) * 0.8);
  const k = ease.outBack(range(t, hit - 0.3, hit + 0.3), 1.4);
  ident(
    sc,
    S,
    {
      floor: false,
      fly: 0.06,
      behind: () => {
        // Warp streaks: stars stretched by the speed, streaming out from the centre.
        const r = rng(seed ^ 0x7a7a);
        const R = Math.hypot(w, h) * 0.55;
        ctx.save();
        ctx.globalCompositeOperation = addOp(sc);
        ctx.lineCap = "round";
        for (let i = 0; i < 70; i++) {
          const a = r() * TAU;
          const off = r();
          const col = r() < 0.5 ? palette.primary : palette.light ? palette.secondary : "#ffffff";
          const f = (cam * 0.35 + off) % 1;
          const d0 = R * f * f;
          const len = R * (0.02 + 0.09 * Math.min(1, vel / 6)) * f;
          const a1 = Math.min(1, f * 4) * (0.25 + 0.5 * Math.min(1, vel / 4)) * fade;
          if (a1 <= 0.01) continue;
          ctx.strokeStyle = rgba(col, a1);
          ctx.lineWidth = (0.6 + f * 1.6) * u;
          ctx.beginPath();
          ctx.moveTo(P.cx + Math.cos(a) * d0, P.cy + Math.sin(a) * d0);
          ctx.lineTo(P.cx + Math.cos(a) * (d0 + len), P.cy + Math.sin(a) * (d0 + len));
          ctx.stroke();
        }
        ctx.restore();
        // The tunnel of outlines, the nearest glowing as they pass.
        ctx.save();
        for (let i = 0; i < 14; i++) {
          const z = i * 0.6 + 0.4 - (cam % 0.6) - 0.0001;
          if (z <= 0.05) continue;
          const s = 0.55 / z;
          // Near copies fade out before they fill the frame.
          const a = fade * clamp((1.6 - s) / 0.8) * clamp(s / 0.12) * 0.55;
          if (a <= 0.01) continue;
          ctx.save();
          ctx.translate(P.cx, P.cy);
          ctx.rotate(i * 0.12 + t * 0.2);
          if (s > 0.6) {
            const gw = P.mw * s * (1 + 2 * glow.px);
            const gh = P.mh * s * (1 + 2 * glow.py);
            ctx.globalCompositeOperation = addOp(sc);
            ctx.globalAlpha = a * clamp((s - 0.6) / 0.5) * 0.8;
            ctx.drawImage(glow.c, -gw / 2, -gh / 2, gw, gh);
            ctx.globalCompositeOperation = "source-over";
          }
          ctx.globalAlpha = a;
          ctx.drawImage(outline, (-P.mw / 2) * s, (-P.mh / 2) * s, P.mw * s, P.mh * s);
          ctx.restore();
        }
        ctx.restore();
      },
    },
    (L) => {
      if (k <= 0) return;
      solid(L, m, P.cx, P.cy, P.mw, P.mh, {
        yaw: -0.25 * clamp(spring(t - hit, 6, 4.5), 0, 1.2) + holdTurn(sc, S),
        pitch: 0.08,
        depth: Math.min(P.mw, P.mh) * 0.26 * clamp(range(t, hit, hit + 0.4)),
        scale: Math.max(0.01, k),
        sweep: ease.inOutCubic(range(t, hit + 0.3, hit + 1.2)),
        alpha: clamp(k * 2) * (1 - ex),
        halo: 0.6 * range(t, hit, hit + 0.4),
      });
    },
  );
}

/* ───────────────────────── Tile Flip ───────────────────────── */

function logoFlip(sc: SkillContext) {
  const { t, u, palette } = sc;
  stageBg(sc);
  const S = shotOf(sc);
  const { m, P, hit, ex } = S;
  const strips = m.ar > 2 ? 14 : 8;
  const sw = m.src.width / strips;
  const tw = P.mw / strips;
  const back = tint(m, mixHex(palette.primary, palette.secondary, 0.5));
  const edge = tint(m, mixHex(palette.primary, "#000000", palette.light ? 0.25 : 0.45));
  const grow = clamp(spring(t - hit, 15, 8), 0, 1.12);
  ident(sc, S, { shadow: range(t, hit, hit + 0.3) }, (L) => {
    const ctx = L.ctx;
    if (t < hit + 0.05) {
      // Each strip turns about its own vertical axis, in a wave from left to right, landing on the
      // hit: its edge shows mid-turn, and a glint runs down it as it passes edge-on.
      ctx.save();
      ctx.globalAlpha = clamp(t / 0.2);
      for (let i = 0; i < strips; i++) {
        const start = (i / strips) * hit * 0.5;
        const k = ease.inOutCubic(range(t, start, start + hit * 0.5));
        const ang = Math.PI * (1 - k);
        const c = Math.cos(ang);
        const x = P.cx - P.mw / 2 + (i + 0.5) * tw;
        const ww = Math.max(0.5, tw * Math.abs(c));
        const thick = Math.abs(Math.sin(ang)) * tw * 0.22;
        if (thick > 0.5) ctx.drawImage(edge, i * sw, 0, sw, m.src.height, x + (c >= 0 ? ww / 2 : -ww / 2 - thick), P.cy - P.mh / 2, thick, P.mh);
        ctx.drawImage(c >= 0 ? m.src : back, i * sw, 0, sw, m.src.height, x - ww / 2, P.cy - P.mh / 2, ww + 0.5, P.mh);
        const glint = Math.abs(c) < 0.25 && k > 0 && k < 1 ? 1 - Math.abs(c) / 0.25 : 0;
        if (glint > 0) {
          ctx.save();
          ctx.globalCompositeOperation = addOp(sc);
          ctx.fillStyle = rgba(hotOf(sc), glint * 0.7);
          ctx.fillRect(x - 1.2 * u, P.cy - P.mh / 2, 2.4 * u, P.mh);
          ctx.restore();
        }
      }
      ctx.restore();
    }
    if (t >= hit)
      solid(L, m, P.cx, P.cy, P.mw, P.mh, {
        yaw: -0.34 * clamp(spring(t - hit, 6, 4.5), 0, 1.2) + holdTurn(sc, S),
        pitch: 0.1,
        depth: Math.min(P.mw, P.mh) * 0.26 * grow,
        scale: 1 + 0.05 * ex,
        sweep: ease.inOutCubic(range(t, hit + 0.3, hit + 1.2)),
        alpha: 1 - ex,
        halo: 0.55 * range(t, hit, hit + 0.3),
      });
  });
}

/* ───────────────────────── Registry ───────────────────────── */

const BEST = "The brand reveal: the logo (or app icon, or a generated mark) in 3D, landing on the drop. Headline = brand name (left off for a wordmark logo).";

export const logo3dSkills: Skill[] = [
  {
    id: "logo-extrude",
    name: "3D Extrude",
    tagline: "A scan line builds the logo, which snaps into a solid 3D block on the drop with a floor shockwave and sparks, then swings round under shafts of light over a reflective floor.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoExtrude,
    sfx: identSfx,
  },
  {
    id: "logo-spin",
    name: "Coin Spin",
    tagline: "The logo spins like a coin, glinting edge-on, and brakes to face you exactly on the drop, then floats over its reflection in a haze of light and embers.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoSpin,
    sfx: identSfx,
  },
  {
    id: "logo-shatter",
    name: "Shard Assemble",
    tagline: "Thick, light-rimmed shards of the logo fly in from depth and lock together on the drop, their seams glowing as they fuse into a solid 3D mark.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoShatter,
    sfx: identSfx,
  },
  {
    id: "logo-orbit",
    name: "Orbit Rings",
    tagline: "Three tilted rings with comet lights orbit the solid logo, passing in front of it and behind, as it bursts in on the drop.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoOrbit,
    sfx: identSfx,
  },
  {
    id: "logo-stage",
    name: "Hero Stage",
    tagline: "Under a dusty cone of light, the logo rises through a rippling, reflective floor to stand on it on the drop while the camera arcs slowly round it.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoStage,
    sfx: identSfx,
  },
  {
    id: "logo-layers",
    name: "Layer Stack",
    tagline: "Stacked glass plates of the logo, tilted apart and glinting, collapse into one solid mark on the drop and turn to face you.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoLayers,
    sfx: identSfx,
  },
  {
    id: "logo-tunnel",
    name: "Fly-through",
    tagline: "The camera warps down a turning tunnel of the logo's glowing outlines and arrives at the logo itself, which locks in 3D on the drop.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoTunnel,
    sfx: identSfx,
  },
  {
    id: "logo-flip",
    name: "Tile Flip",
    tagline: "Thick strips of the logo flip round in a glinting wave from the brand colour to the logo, then the mark gains its 3D depth on the drop.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoFlip,
    sfx: identSfx,
  },
];

export const LOGO_3D_IDS = new Set<SkillId>(logo3dSkills.map((s) => s.id));
