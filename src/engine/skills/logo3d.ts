/**
 * 3D logo intros: the brand's own logo turned into a solid, extruded object and staged like a
 * studio ident. Any logo works: the imported logo (wordmarks included), the site's app icon, or
 * the generated brand mark when there's none. Each one lands on the score's drop (revealHit), then
 * keeps moving in 3D while the name comes in under it.
 *
 * - logo-extrude: the flat logo snaps into depth on the hit and swings round to a three-quarter view.
 * - logo-spin:    the logo spins like a coin, slowing until it faces you on the hit.
 * - logo-shatter: shards of the logo fly in from depth and lock together, then it gains depth.
 * - logo-orbit:   two tilted rings orbit the solid logo, passing in front of it and behind.
 * - logo-stage:   the logo rises through a reflective floor under a spotlight as the camera arcs round.
 * - logo-layers:  stacked glass layers of the logo collapse into one solid mark.
 * - logo-tunnel:  the camera flies down a tunnel of the logo's outlines to the logo itself.
 * - logo-flip:    strips of the logo flip round in a wave from the brand colour to the logo.
 *
 * The 3D is drawn on the 2D canvas: the logo's silhouette, tinted, is stacked along the depth axis
 * behind its face (darker towards the back), so any shape extrudes properly. Nothing flashes the
 * frame: light stays in thin streaks, sweeps across the mark and soft glows.
 */
import { brandGlyph, saasBackground, saasFont, spring } from "../saasfx";
import { background, drawLayout, dust, exitT, headline, lightSweep, subline } from "../fx";
import { clamp, ease, hashString, lerp, mixHex, range, rgba, TAU } from "../math";
import { getImage, isWideLogo, logoAt } from "../media";
import { revealHit } from "../arrange";
import { scratch } from "../scratch";
import type { Scene, SfxCue, Skill, SkillContext, SkillId } from "../types";

/* ───────────────────────── The mark ───────────────────────── */

type Src = HTMLCanvasElement | HTMLImageElement;
type Mark = { src: Src; key: string; ar: number; wide: boolean };

const glyphs = new Map<string, HTMLCanvasElement>();

/** The brand's mark: its logo, else its app icon, else the generated brand mark. */
function markOf(sc: SkillContext): Mark {
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
function tint(m: Mark, color: string) {
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
};

/**
 * The mark as a solid: its silhouette stacked along the depth axis behind the face (darker towards
 * the back, a bright bevel just behind the face), then the face itself (its back, in the brand
 * colour, when turned away).
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
  const dark = mixHex(palette.primary, "#000000", palette.light ? 0.35 : 0.55);
  const lite = mixHex(palette.primary, "#ffffff", palette.light ? 0.05 : 0.18);
  const sideDark = tint(m, dark);
  const sideLite = tint(m, lite);
  const fw = mw * s * Math.abs(cy0);
  const fh = mh * s * cp;
  ctx.save();
  ctx.globalAlpha *= p.alpha ?? 1;
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
  // A bright bevel just behind the face catches the light.
  if (n) {
    ctx.save();
    ctx.globalAlpha *= 0.9;
    ctx.drawImage(tint(m, mixHex(lite, "#ffffff", 0.45)), cx + dx * 0.035 - fw / 2, cy + dy * 0.035 - fh / 2, fw, fh);
    ctx.restore();
  }
  // The face (or, turned away, the back in the brand colour), with its sweep of light.
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
    if (p.sweep !== undefined) lightSweep(buf.ctx, 0, 0, bw, bh, p.sweep, { alpha: 0.85, width: 0.22, op: "source-atop" });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(buf.canvas, 0, 0, bw, bh, cx - fw / 2, cy - fh / 2, fw, fh);
  }
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
  else {
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
  ctx.globalCompositeOperation = palette.light ? "source-over" : "lighter";
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

/** The name (and line) under the mark, rising in after the hit. Wordmarks already spell it. */
function nameBelow(sc: SkillContext, y: number, start: number, ex: number) {
  const { ctx, t, u } = sc;
  const k = ease.outExpo(range(t, start, start + 0.7));
  if (k <= 0) return;
  const saas = sc.style === "saas";
  const layout = headline(sc, { cy: y, sizeFrac: 0.11, maxLines: 1, natural: saas, font: saas ? saasFont(sc) : undefined });
  ctx.save();
  ctx.globalAlpha *= k * (1 - ex);
  ctx.translate(0, (1 - k) * 24 * u);
  ctx.fillStyle = sc.palette.text;
  drawLayout(sc, layout);
  ctx.restore();
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 36 * u, range(t, start + 0.4, start + 1), { alpha: 1 - ex });
}

/** Where the name sits under a mark standing on the floor: below its reflection. */
const nameY = (sc: SkillContext, P: { mh: number }, floorY: number) => floorY + P.mh * 0.36 + Math.min(sc.w, sc.h) * 0.07;

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

/* ───────────────────────── 3D Extrude ───────────────────────── */

function logoExtrude(sc: SkillContext) {
  const { t, u } = sc;
  stageBg(sc);
  const m = markOf(sc);
  const P = placement(sc, m);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const depth = Math.min(P.mw, P.mh) * 0.38;
  charge(sc, P.cx, P.cy, Math.max(P.mw, P.mh), hit);
  // Flat until the hit, then it snaps into depth (with overshoot) and swings round to a three-quarter view.
  const grow = clamp(spring(t - hit, 16, 8), 0, 1.15);
  const swing = spring(t - hit, 7, 4.5);
  const yaw = lerp(-0.85, -0.36, clamp(swing, 0, 1.2)) + Math.sin(t * 0.7) * 0.04 * range(t, hit + 1, hit + 2);
  const arrive = ease.outBack(range(t, 0, hit), 1.4);
  const floorY = P.cy + P.mh / 2 + 18 * u;
  contactShadow(sc, P.cx, floorY, P.mw * 0.6, range(t, hit - 0.2, hit + 0.3) * (1 - ex));
  withReflection(sc, floorY, 0.28 * (1 - ex), (L) =>
    solid(L, m, P.cx, P.cy, P.mw, P.mh, {
      yaw: t < hit ? -0.2 * (1 - arrive) : yaw,
      pitch: 0.16 * clamp(swing, 0, 1),
      depth: depth * (t < hit ? 0 : grow),
      scale: lerp(0.6, 1, clamp(arrive)) * (1 + 0.05 * ex),
      sweep: ease.inOutCubic(range(t, hit + 0.35, hit + 1.3)),
      alpha: clamp(t / 0.25) * (1 - ex),
    }),
  );
  streak(sc, P.cx, P.cy, hit, ex);
  if (P.named) nameBelow(sc, nameY(sc, P, floorY), hit + 0.35, ex);
}

/* ───────────────────────── Coin Spin ───────────────────────── */

function logoSpin(sc: SkillContext) {
  const { t, u } = sc;
  stageBg(sc);
  const m = markOf(sc);
  const P = placement(sc, m);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const depth = Math.min(P.mw, P.mh) * 0.16;
  charge(sc, P.cx, P.cy, Math.max(P.mw, P.mh), hit);
  // Two turns, braking to face front exactly on the hit; then a slow living sway.
  const turns = 2 * TAU;
  const spinAt = (tt: number) => (tt < hit ? turns * (1 - ease.outCubic(range(tt, 0, hit))) : 0) + Math.sin(tt * 0.9) * 0.06 * range(tt, hit + 0.6, hit + 1.6);
  const yaw = spinAt(t);
  const speed = Math.abs(spinAt(t) - spinAt(t - 1 / 30));
  const floorY = P.cy + P.mh / 2 + 22 * u;
  const bob = Math.sin(t * 1.4) * 4 * u * range(t, hit + 0.4, hit + 1.2);
  contactShadow(sc, P.cx, floorY, P.mw * 0.55, (1 - ex) * clamp(t / 0.3));
  withReflection(sc, floorY, 0.3 * (1 - ex), (L) => {
    // Motion trails while it spins fast.
    if (speed > 0.15) for (let g = 3; g >= 1; g--) solid(L, m, P.cx, P.cy + bob, P.mw, P.mh, { yaw: spinAt(t - g * 0.025), depth, alpha: 0.14 * clamp(speed) * clamp(t / 0.25) });
    solid(L, m, P.cx, P.cy + bob, P.mw, P.mh, {
      yaw,
      depth,
      scale: lerp(0.75, 1, ease.outCubic(range(t, 0, hit))) * (1 + 0.05 * ex),
      sweep: ease.inOutCubic(range(t, hit + 0.2, hit + 1.1)),
      alpha: clamp(t / 0.25) * (1 - ex),
    });
  });
  streak(sc, P.cx, P.cy, hit, ex);
  if (P.named) nameBelow(sc, nameY(sc, P, floorY), hit + 0.3, ex);
}

/* ───────────────────────── Shard Assemble ───────────────────────── */

function logoShatter(sc: SkillContext) {
  const { ctx, t, u, seed } = sc;
  stageBg(sc);
  const m = markOf(sc);
  const P = placement(sc, m);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const depth = Math.min(P.mw, P.mh) * 0.26;
  const assembled = t >= hit;
  if (!assembled) {
    // Shards of the face, each starting somewhere in depth, flying to their place by the hit.
    const cols = m.ar > 2 ? 10 : 6;
    const rows = m.ar > 2 ? 3 : 6;
    const sw = m.src.width / cols;
    const sh = m.src.height / rows;
    const tw = P.mw / cols;
    const th = P.mh / rows;
    ctx.save();
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
        ctx.save();
        ctx.globalAlpha = clamp(t / 0.15) * clamp(k * 3);
        ctx.translate(x, y);
        ctx.rotate((1 - k) * (z - 0.5) * 6);
        ctx.scale(s, s);
        ctx.drawImage(m.src, c * sw, r * sh, sw, sh, -tw / 2, -th / 2, tw + 0.6, th + 0.6);
        ctx.restore();
      }
    ctx.restore();
  }
  const grow = clamp(spring(t - hit, 15, 8), 0, 1.12);
  const yaw = assembled ? -0.32 * clamp(spring(t - hit, 6, 4.5), 0, 1.2) + Math.sin(t * 0.6) * 0.04 * range(t, hit + 1, hit + 2) : 0;
  const floorY = P.cy + P.mh / 2 + 18 * u;
  if (assembled) {
    contactShadow(sc, P.cx, floorY, P.mw * 0.6, (1 - ex) * range(t, hit, hit + 0.3));
    withReflection(sc, floorY, 0.26 * (1 - ex), (L) =>
      solid(L, m, P.cx, P.cy, P.mw, P.mh, { yaw, pitch: 0.1, depth: depth * grow, scale: 1 + 0.05 * ex, sweep: ease.inOutCubic(range(t, hit + 0.3, hit + 1.2)), alpha: 1 - ex }),
    );
  }
  streak(sc, P.cx, P.cy, hit, ex);
  if (P.named) nameBelow(sc, nameY(sc, P, floorY), hit + 0.35, ex);
}

/* ───────────────────────── Orbit Rings ───────────────────────── */

function logoOrbit(sc: SkillContext) {
  const { ctx, t, u, palette } = sc;
  stageBg(sc);
  const m = markOf(sc);
  const P = placement(sc, m);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const depth = Math.min(P.mw, P.mh) * 0.24;
  const R = Math.max(P.mw, P.mh) * 0.78;
  const grow = ease.outCubic(range(t, 0.05, hit + 0.3));
  const rings = [
    { tilt: 0.32, spin: 0.9, rot: 0.35, color: palette.primary },
    { tilt: 0.22, spin: -0.65, rot: -0.5, color: palette.secondary },
  ];
  // Each ring is drawn in two halves: the far half behind the mark, the near half in front.
  const ring = (front: boolean) => {
    rings.forEach((rg, i) => {
      const rr = R * (1 + i * 0.16) * grow;
      if (rr < 2) return;
      ctx.save();
      ctx.translate(P.cx, P.cy);
      ctx.rotate(rg.rot);
      ctx.globalAlpha = (1 - ex) * clamp(grow * 1.5);
      ctx.strokeStyle = rgba(rg.color, front ? 0.85 : 0.35);
      ctx.lineWidth = (front ? 3 : 2) * u;
      ctx.beginPath();
      ctx.ellipse(0, 0, rr, rr * rg.tilt, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
      ctx.stroke();
      // Points of light travelling round it.
      for (let k = 0; k < 3; k++) {
        const a = t * rg.spin * 1.6 + (k * TAU) / 3;
        const near = Math.sin(a) > 0;
        if (near !== front) continue;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr * rg.tilt;
        const g = ctx.createRadialGradient(px, py, 0, px, py, 14 * u);
        g.addColorStop(0, rgba(palette.light ? rg.color : "#ffffff", 0.95));
        g.addColorStop(0.4, rgba(rg.color, 0.6));
        g.addColorStop(1, rgba(rg.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, 14 * u, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    });
  };
  charge(sc, P.cx, P.cy, R, hit);
  ring(false);
  const k = ease.outBack(range(t, hit - 0.25, hit + 0.35), 1.5);
  solid(sc, m, P.cx, P.cy, P.mw, P.mh, {
    yaw: Math.sin(t * 0.8) * 0.3 * clamp(range(t, hit, hit + 0.6)),
    pitch: 0.08,
    depth,
    scale: Math.max(0, k) * (1 + 0.05 * ex),
    sweep: ease.inOutCubic(range(t, hit + 0.3, hit + 1.2)),
    alpha: clamp(k * 2) * (1 - ex),
  });
  ring(true);
  streak(sc, P.cx, P.cy, hit, ex);
  if (P.named) nameBelow(sc, P.cy + R * 0.4 + Math.min(sc.w, sc.h) * 0.14, hit + 0.35, ex);
}

/* ───────────────────────── Hero Stage ───────────────────────── */

function logoStage(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette } = sc;
  stageBg(sc);
  const m = markOf(sc);
  const P = placement(sc, m);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const depth = Math.min(P.mw, P.mh) * 0.3;
  const floorY = P.cy + P.mh / 2 + 10 * u;
  // A cone of light from above onto the spot where the mark stands.
  const cone = clamp(t / 0.4) * (1 - ex);
  ctx.save();
  const cg = ctx.createLinearGradient(0, 0, 0, floorY);
  cg.addColorStop(0, rgba(palette.light ? palette.primary : "#ffffff", palette.light ? 0.05 : 0.1));
  cg.addColorStop(1, rgba(palette.primary, palette.light ? 0.1 : 0.16));
  ctx.fillStyle = cg;
  ctx.globalAlpha = cone;
  ctx.beginPath();
  ctx.moveTo(P.cx - P.mw * 0.12, 0);
  ctx.lineTo(P.cx + P.mw * 0.12, 0);
  ctx.lineTo(P.cx + P.mw * 0.85, floorY);
  ctx.lineTo(P.cx - P.mw * 0.85, floorY);
  ctx.closePath();
  ctx.fill();
  // The pool of light on the floor.
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
  ctx.restore();
  // Rises through the floor to stand on it by the hit; the camera arcs round as it holds.
  const rise = ease.outCubic(range(t, 0.05, hit));
  const arc = ease.inOutCubic(range(t, hit, d - 0.4));
  const lift = (1 - rise) * (P.mh + depth);
  withReflection(sc, floorY, 0.32 * (1 - ex), (L) => {
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
    });
    L.ctx.restore();
  });
  streak(sc, P.cx, P.cy, hit, ex);
  if (P.named) nameBelow(sc, nameY(sc, P, floorY), hit + 0.4, ex);
}

/* ───────────────────────── Layer Stack ───────────────────────── */

function logoLayers(sc: SkillContext) {
  const { ctx, t, u, palette } = sc;
  stageBg(sc);
  const m = markOf(sc);
  const P = placement(sc, m);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const layers = 5;
  // Apart (in an isometric tilt) until the hit, when they collapse into one solid that turns to face you.
  const apart = 1 - ease.inOutCubic(range(t, hit * 0.35, hit));
  const tilt = 1 - ease.inOutCubic(range(t, hit, hit + 0.8));
  const fade = clamp(t / 0.3) * (1 - ex);
  const gap = P.mh * 0.32 * apart;
  const grow = clamp(spring(t - hit, 14, 8), 0, 1.1);
  if (tilt > 0.01 && t < hit + 0.8) {
    for (let L = layers - 1; L >= 0; L--) {
      ctx.save();
      ctx.globalAlpha = fade * (L === 0 ? 1 : 0.55 + 0.45 * (1 - apart)) * (t < hit ? 1 : tilt);
      ctx.translate(P.cx, P.cy - (L - (layers - 1) / 2) * gap);
      ctx.scale(1, 1 - 0.5 * tilt);
      ctx.rotate(-0.55 * tilt);
      const src = L === 0 ? m.src : tint(m, mixHex(palette.primary, palette.secondary, L / layers));
      ctx.drawImage(src, -P.mw / 2, -P.mh / 2, P.mw, P.mh);
      if (L > 0) {
        ctx.strokeStyle = rgba(palette.primary, 0.5 * apart);
        ctx.lineWidth = 1.5 * u;
        ctx.strokeRect(-P.mw / 2 - 8 * u, -P.mh / 2 - 8 * u, P.mw + 16 * u, P.mh + 16 * u);
      }
      ctx.restore();
    }
  }
  const floorY = P.cy + P.mh / 2 + 18 * u;
  if (t >= hit) {
    contactShadow(sc, P.cx, floorY, P.mw * 0.6, (1 - ex) * range(t, hit, hit + 0.4));
    withReflection(sc, floorY, 0.26 * (1 - ex) * (1 - tilt), (Lc) =>
      solid(Lc, m, P.cx, P.cy, P.mw, P.mh, {
        yaw: -0.25 * (1 - tilt) * clamp(spring(t - hit - 0.5, 6, 4.5), 0, 1.2),
        pitch: 0.1,
        depth: Math.min(P.mw, P.mh) * 0.28 * grow,
        sweep: ease.inOutCubic(range(t, hit + 0.6, hit + 1.5)),
        alpha: (1 - ex) * (1 - tilt * 0.999),
      }),
    );
  }
  streak(sc, P.cx, P.cy, hit, ex);
  if (P.named) nameBelow(sc, nameY(sc, P, floorY), hit + 0.5, ex);
}

/* ───────────────────────── Fly-through ───────────────────────── */

function logoTunnel(sc: SkillContext) {
  const { ctx, t, u, palette } = sc;
  stageBg(sc);
  const m = markOf(sc);
  const P = placement(sc, m);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  // Outlines of the mark at depths down the tunnel; the camera flies forward, braking at the hit.
  const travel = (tt: number) => (tt < hit ? 6 * ease.outCubic(range(tt, 0, hit)) : 6 + (tt - hit) * 0.15);
  const cam = travel(t);
  const outline = tint(m, palette.primary);
  const fade = clamp(t / 0.25) * (1 - ex) * (1 - range(t, hit, hit + 0.7) * 0.8);
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const z = i * 0.6 + 0.4 - (cam % 0.6) - 0.0001;
    if (z <= 0.05) continue;
    const s = 0.55 / z;
    // Near copies fade out before they fill the frame.
    const a = fade * clamp((1.6 - s) / 0.8) * clamp(s / 0.12) * 0.55;
    if (a <= 0.01) continue;
    ctx.globalAlpha = a;
    ctx.save();
    ctx.translate(P.cx, P.cy);
    ctx.rotate(i * 0.12 + t * 0.2);
    ctx.drawImage(outline, (-P.mw / 2) * s, (-P.mh / 2) * s, P.mw * s, P.mh * s);
    ctx.restore();
  }
  ctx.restore();
  charge(sc, P.cx, P.cy, Math.max(P.mw, P.mh), hit);
  const k = ease.outBack(range(t, hit - 0.3, hit + 0.3), 1.4);
  const floorY = P.cy + P.mh / 2 + 18 * u;
  if (k > 0)
    solid(sc, m, P.cx, P.cy, P.mw, P.mh, {
      yaw: -0.25 * clamp(spring(t - hit, 6, 4.5), 0, 1.2),
      pitch: 0.08,
      depth: Math.min(P.mw, P.mh) * 0.26 * clamp(range(t, hit, hit + 0.4)),
      scale: Math.max(0.01, k),
      sweep: ease.inOutCubic(range(t, hit + 0.3, hit + 1.2)),
      alpha: clamp(k * 2) * (1 - ex),
    });
  streak(sc, P.cx, P.cy, hit, ex);
  if (P.named) nameBelow(sc, nameY(sc, P, floorY), hit + 0.35, ex);
}

/* ───────────────────────── Tile Flip ───────────────────────── */

function logoFlip(sc: SkillContext) {
  const { ctx, t, u, palette } = sc;
  stageBg(sc);
  const m = markOf(sc);
  const P = placement(sc, m);
  const hit = hitOf(sc);
  const ex = exitOf(sc);
  const strips = m.ar > 2 ? 14 : 8;
  const sw = m.src.width / strips;
  const tw = P.mw / strips;
  const back = tint(m, mixHex(palette.primary, palette.secondary, 0.5));
  if (t < hit + 0.05) {
    // Each strip turns about its own vertical axis, in a wave from left to right, landing on the hit.
    ctx.save();
    ctx.globalAlpha = clamp(t / 0.2);
    for (let i = 0; i < strips; i++) {
      const start = (i / strips) * hit * 0.5;
      const k = ease.inOutCubic(range(t, start, start + hit * 0.5));
      const ang = Math.PI * (1 - k);
      const c = Math.cos(ang);
      const x = P.cx - P.mw / 2 + (i + 0.5) * tw;
      const ww = Math.max(0.5, tw * Math.abs(c));
      const src = c >= 0 ? m.src : back;
      ctx.drawImage(src, i * sw, 0, sw, m.src.height, x - ww / 2, P.cy - P.mh / 2, ww + 0.5, P.mh);
    }
    ctx.restore();
  }
  const floorY = P.cy + P.mh / 2 + 18 * u;
  if (t >= hit) {
    const grow = clamp(spring(t - hit, 15, 8), 0, 1.12);
    contactShadow(sc, P.cx, floorY, P.mw * 0.6, (1 - ex) * range(t, hit, hit + 0.3));
    withReflection(sc, floorY, 0.26 * (1 - ex), (L) =>
      solid(L, m, P.cx, P.cy, P.mw, P.mh, {
        yaw: -0.34 * clamp(spring(t - hit, 6, 4.5), 0, 1.2),
        pitch: 0.1,
        depth: Math.min(P.mw, P.mh) * 0.26 * grow,
        scale: 1 + 0.05 * ex,
        sweep: ease.inOutCubic(range(t, hit + 0.3, hit + 1.2)),
        alpha: 1 - ex,
      }),
    );
  }
  streak(sc, P.cx, P.cy, hit, ex);
  if (P.named) nameBelow(sc, nameY(sc, P, floorY), hit + 0.35, ex);
}

/* ───────────────────────── Registry ───────────────────────── */

const BEST = "The brand reveal: the logo (or app icon, or a generated mark) in 3D, landing on the drop. Headline = brand name (left off for a wordmark logo).";

export const logo3dSkills: Skill[] = [
  {
    id: "logo-extrude",
    name: "3D Extrude",
    tagline: "The flat logo snaps into a solid 3D block on the drop and swings round to a three-quarter view, a sweep of light crossing its face over a reflective floor.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoExtrude,
    sfx: identSfx,
  },
  {
    id: "logo-spin",
    name: "Coin Spin",
    tagline: "The logo spins like a coin with motion trails, braking to face you exactly on the drop, then floats over its reflection.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoSpin,
    sfx: identSfx,
  },
  {
    id: "logo-shatter",
    name: "Shard Assemble",
    tagline: "Shards of the logo fly in from depth, turning as they come, and lock together on the drop before it gains its 3D depth.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoShatter,
    sfx: identSfx,
  },
  {
    id: "logo-orbit",
    name: "Orbit Rings",
    tagline: "Two tilted rings with travelling lights orbit the solid logo, passing in front of it and behind as it sways.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoOrbit,
    sfx: identSfx,
  },
  {
    id: "logo-stage",
    name: "Hero Stage",
    tagline: "Under a cone of light, the logo rises through a reflective floor to stand on it on the drop while the camera arcs slowly round it.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoStage,
    sfx: identSfx,
  },
  {
    id: "logo-layers",
    name: "Layer Stack",
    tagline: "Stacked glass layers of the logo, tilted apart, collapse into one solid mark on the drop and turn to face you.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoLayers,
    sfx: identSfx,
  },
  {
    id: "logo-tunnel",
    name: "Fly-through",
    tagline: "The camera flies down a turning tunnel of the logo's outlines and arrives at the logo itself, which locks in 3D on the drop.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoTunnel,
    sfx: identSfx,
  },
  {
    id: "logo-flip",
    name: "Tile Flip",
    tagline: "Strips of the logo flip round in a wave from the brand colour to the logo, then the mark gains its 3D depth on the drop.",
    bestFor: BEST,
    sample: { text: "ACME", subtext: "Build something new" },
    render: logoFlip,
    sfx: identSfx,
  },
];

export const LOGO_3D_IDS = new Set<SkillId>(logo3dSkills.map((s) => s.id));
