import {
  background,
  bevel,
  drawLayout,
  extrude,
  dust,
  exitT,
  flash,
  glow,
  headline,
  headlineGradient,
  noGlow,
  shake,
  subline,
} from "../fx";
import { clamp, ease, lerp, mix, range, rgba, rng, TAU } from "../math";
import { textPoints } from "../text";
import type { Skill, SkillContext } from "../types";

/* ───────────────────────── Particle Assemble ───────────────────────── */

function particleAssemble(sc: SkillContext) {
  const { ctx, w, h, t, palette, u, seed } = sc;
  background(sc, { hot: palette.accent, hotAlpha: 0.2 });
  dust(sc, 60, palette.primary, 0.6);

  const count = Math.round(2200 * Math.min(1, (w * h) / (1920 * 1080)) + 500);
  const pts = textPoints(sc.scene.text.toUpperCase(), sc.font, w, h, count);
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.hypot(w, h) * 0.6;
  const ex = ease.inCubic(exitT(sc, 0.5));
  const r = rng(seed);
  const settle = 1.9;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const delay = r() * 0.6;
    const sa = r() * TAU;
    const sr = R * (0.5 + r() * 0.7);
    const jitter = r();
    const k = ease.outCubic(range(t, 0.1 + delay, 1.3 + delay));
    const tx = p.x - cx;
    const ty = p.y - cy;
    const tr = Math.hypot(tx, ty);
    const ta = Math.atan2(ty, tx);
    // Vortex path: interpolate in polar space with extra swirl.
    const ang = lerp(sa, ta, k) + (1 - k) * 2.4;
    const rad = lerp(sr, tr, k);
    let x = cx + Math.cos(ang) * rad;
    let y = cy + Math.sin(ang) * rad;
    if (k >= 1) {
      x += Math.sin(t * 3 + i) * 0.8 * u;
      y += Math.cos(t * 2.6 + i * 1.3) * 0.8 * u;
    }
    if (ex > 0) {
      const ea = ta + (jitter - 0.5);
      x += Math.cos(ea) * ex * R * (0.4 + jitter);
      y += Math.sin(ea) * ex * R * (0.4 + jitter);
    }
    const c = mix(palette.primary, palette.secondary, clamp(p.x / w));
    ctx.fillStyle = c;
    ctx.globalAlpha = (0.6 + 0.4 * k) * (1 - ex * 0.8);
    const s = (1.6 + jitter * 2) * u * (k < 1 ? 1.8 : 1);
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
  ctx.restore();

  // Solid title crystallises once particles settle.
  const solid = ease.outCubic(range(t, settle - 0.2, settle + 0.5)) * (1 - exitT(sc, 0.25));
  const layout = headline(sc, { widthFrac: 0.84, sizeFrac: 0.34 });
  if (solid > 0) {
    ctx.save();
    ctx.globalAlpha = solid * 0.95;
    ctx.fillStyle = headlineGradient(sc, layout, palette.text, palette.primary);
    glow(ctx, palette.primary, 40 * u);
    drawLayout(sc, layout);
    noGlow(ctx);
    // Shimmer sweep.
    const sx = lerp(-w * 0.2, w * 1.2, range(t, settle, settle + 1.1));
    const g = ctx.createLinearGradient(sx - 120 * u, 0, sx + 120 * u, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.restore();
    // Filling the glyphs with a moving highlight band keeps it on the letters.
    ctx.save();
    ctx.globalAlpha = solid * 0.6;
    ctx.fillStyle = g;
    drawLayout(sc, layout);
    ctx.restore();
  }
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 60 * u, range(t, settle + 0.2, settle + 0.8), { alpha: 1 - exitT(sc, 0.3) });
}

/* ───────────────────────── Hyperspace ───────────────────────── */

function hyperspace(sc: SkillContext) {
  const { ctx, w, h, t, palette, u, seed } = sc;
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(0, 0, w, h);
  // Punch through on a downbeat.
  const tp = Math.min(sc.d * 0.45, sc.beat * Math.max(2, Math.round(1.2 / sc.beat)));
  const s = range(t, 0, tp);
  const speed = t < tp ? 0.25 + 9 * s * s * s : 0.3 + 8.9 * Math.exp(-(t - tp) * 3.5);
  const travel = t < tp ? 0.25 * t + (9 * tp * s ** 4) / 4 : 0.25 * tp + (9 * tp) / 4 + 0.3 * (t - tp) + (8.9 / 3.5) * (1 - Math.exp(-(t - tp) * 3.5));
  const cx = w / 2;
  const cy = h / 2;
  const F = Math.min(w, h) * 0.45;
  const r = rng(seed);

  // Tunnel glow.
  const tg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
  tg.addColorStop(0, rgba(palette.accent, 0.35 * clamp(speed / 4)));
  tg.addColorStop(0.4, rgba(palette.bg1, 0.6));
  tg.addColorStop(1, rgba(palette.bg0, 0));
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = 0; i < 520; i++) {
    const a = r() * TAU;
    const spread = 0.05 + r() * 1.2;
    const z0 = r();
    const color = r() > 0.5 ? palette.primary : r() > 0.5 ? palette.secondary : palette.text;
    const z = 1 - ((((z0 + travel * 0.35) % 1) + 1) % 1); // 1 far → 0 near
    const zz = Math.max(0.02, z);
    const len = Math.min(0.5, speed * 0.02);
    const p1 = (spread * F) / zz;
    const p0 = (spread * F) / Math.min(1.2, zz + len);
    if (p0 > Math.hypot(w, h)) continue;
    ctx.strokeStyle = color;
    ctx.globalAlpha = clamp((1 - z) * 1.3) * 0.9;
    ctx.lineWidth = (0.6 + (1 - z) * 2.6) * u;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * p0, cy + Math.sin(a) * p0);
    ctx.lineTo(cx + Math.cos(a) * p1, cy + Math.sin(a) * p1);
    ctx.stroke();
  }
  ctx.restore();

  // Title punches out of the warp.
  const k = ease.outExpo(range(t, tp - 0.05, tp + 0.5));
  if (k > 0) {
    const ex = exitT(sc, 0.35);
    const layout = headline(sc, { sizeFrac: 0.3 });
    const sh = shake(sc, tp, 16, 0.4);
    ctx.save();
    ctx.translate(cx + sh.x, cy + sh.y);
    const sc0 = lerp(0.15, 1, k) * (1 + ex * 2);
    ctx.scale(sc0, sc0);
    ctx.translate(-cx, -cy);
    // Zoom-blur trail.
    ctx.globalCompositeOperation = "lighter";
    for (let i = 5; i >= 1; i--) {
      ctx.save();
      const zs = 1 + i * 0.06 * (1 - k * 0.8);
      ctx.translate(cx, cy);
      ctx.scale(zs, zs);
      ctx.translate(-cx, -cy);
      ctx.globalAlpha = (0.12 * (1 - i / 6)) * (1 - ex);
      ctx.fillStyle = palette.primary;
      drawLayout(sc, layout);
      ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = clamp(k * 1.4) * (1 - ex);
    extrude(sc, layout);
    ctx.fillStyle = headlineGradient(sc, layout, palette.text, mix(palette.text, palette.primary, 0.6));
    glow(ctx, palette.primary, 30 * u);
    drawLayout(sc, layout);
    noGlow(ctx);
    bevel(sc, layout);
    ctx.restore();
    const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
    subline(sc, bottom + 60 * u, range(t, tp + 0.4, tp + 1), { alpha: 1 - ex });
  }
  flash(sc, (1 - range(t, tp, tp + 0.35)) * (t >= tp ? 0.85 : 0), palette.text);
}

/* ───────────────────────── Shockwave ───────────────────────── */

function shockwave(sc: SkillContext) {
  const { ctx, w, h, t, palette, u, seed } = sc;
  const tb = Math.min(sc.d * 0.4, sc.beat * 2);
  const after = t - tb;
  background(sc, { hot: palette.primary, hotAlpha: after > 0 ? 0.35 * Math.exp(-after * 1.5) + 0.12 : 0.1 });
  const cx = w / 2;
  const cy = h / 2;
  const short = Math.min(w, h);
  const r = rng(seed);
  const rumble = after < 0 ? shake(sc, 0, 6 * range(t, 0, tb), tb + 0.01) : shake(sc, tb, 30, 0.5);

  ctx.save();
  ctx.translate(rumble.x, rumble.y);
  ctx.globalCompositeOperation = "lighter";
  if (after < 0) {
    // Charge: sparks spiral into a growing core.
    const charge = range(t, 0, tb);
    for (let i = 0; i < 160; i++) {
      const a0 = r() * TAU;
      const life = (r() + t * (0.8 + r())) % 1;
      const rad = short * 0.6 * (1 - ease.inQuad(life));
      const a = a0 + life * 3;
      ctx.globalAlpha = life * 0.9;
      ctx.fillStyle = r() > 0.5 ? palette.primary : palette.secondary;
      const s = (1 + r() * 2.5) * u;
      ctx.fillRect(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, s, s);
    }
    const core = short * (0.02 + 0.08 * ease.inCubic(charge)) * (1 + 0.15 * Math.sin(t * 40));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, core * 4);
    g.addColorStop(0, rgba(palette.text, 1));
    g.addColorStop(0.2, rgba(palette.primary, 0.9));
    g.addColorStop(1, rgba(palette.primary, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, core * 4, 0, TAU);
    ctx.fill();
  } else {
    // Rings.
    [0, 0.08, 0.18].forEach((delay, i) => {
      const k = ease.outExpo(range(after, delay, delay + 1.4));
      if (k <= 0 || k >= 1) return;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = i === 1 ? palette.secondary : palette.primary;
      ctx.lineWidth = (1 - k) * 40 * u + 1;
      ctx.beginPath();
      ctx.arc(cx, cy, k * Math.hypot(w, h) * 0.6, 0, TAU);
      ctx.stroke();
    });
    // Debris with drag.
    for (let i = 0; i < 220; i++) {
      const a = r() * TAU;
      const v = (0.3 + r() * 1.1) * short;
      const drag = 2.2 + r() * 2;
      const dist = (v / drag) * (1 - Math.exp(-after * drag));
      const life = 1 - range(after, 0, 1.2 + r() * 1.5);
      if (life <= 0) continue;
      const x = cx + Math.cos(a) * dist;
      const y = cy + Math.sin(a) * dist + after * after * 60 * u;
      const tail = v * Math.exp(-after * drag) * 0.04;
      ctx.globalAlpha = life;
      ctx.strokeStyle = r() > 0.4 ? palette.primary : palette.secondary;
      ctx.lineWidth = (1 + r() * 2.5) * u;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(a) * tail, y - Math.sin(a) * tail);
      ctx.stroke();
    }
  }
  ctx.restore();

  if (after >= 0) {
    const ex = exitT(sc, 0.35);
    const layout = headline(sc, { sizeFrac: 0.3 });
    const k = ease.outExpo(range(after, 0, 0.35));
    const ab = (1 - range(after, 0, 0.6)) * 22 * u + 2 * u;
    ctx.save();
    ctx.translate(cx + rumble.x, cy + rumble.y);
    const s = lerp(1.7, 1, k) * (1 + ex * 0.3) * (1 + after * 0.02);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = (1 - ex);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = rgba(palette.secondary, 0.8);
    ctx.save();
    ctx.translate(-ab, 0);
    drawLayout(sc, layout);
    ctx.restore();
    ctx.fillStyle = rgba(palette.primary, 0.8);
    ctx.save();
    ctx.translate(ab, 0);
    drawLayout(sc, layout);
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    extrude(sc, layout);
    ctx.fillStyle = palette.text;
    glow(ctx, palette.primary, (20 + 30 * (0.5 + 0.5 * Math.sin(t * 5))) * u);
    drawLayout(sc, layout);
    noGlow(ctx);
    bevel(sc, layout);
    ctx.restore();
    const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
    subline(sc, bottom + 60 * u, range(after, 0.5, 1.1), { alpha: 1 - ex });
  }
  flash(sc, after >= 0 ? 1 - range(after, 0, 0.25) : 0, palette.text);
}

/* ───────────────────────── Shape Burst ───────────────────────── */

function shapeBurst(sc: SkillContext) {
  const { ctx, w, h, t, palette, u, seed } = sc;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.hypot(w, h) / 2;
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(0, 0, w, h);
  // Circular colour wipe floods the frame.
  const flood = ease.inOutExpo(range(t, 0.05, 0.55));
  ctx.fillStyle = palette.primary;
  ctx.beginPath();
  ctx.arc(cx, cy, flood * R * 1.05, 0, TAU);
  ctx.fill();
  const ex = ease.inOutExpo(exitT(sc, 0.5));
  if (ex > 0) {
    ctx.fillStyle = palette.bg0;
    ctx.beginPath();
    ctx.arc(cx, cy, ex * R * 1.05, 0, TAU);
    ctx.fill();
  }

  const r = rng(seed);
  const colors = [palette.bg0, palette.secondary, palette.text, palette.accent];
  const burst = (t0: number, n: number, scale: number) => {
    const bt = t - t0;
    if (bt < 0) return;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU;
      const dist = (0.2 + r() * 0.75) * R * scale;
      const type = Math.floor(r() * 5);
      const size = (14 + r() * 34) * u * scale;
      const spin = (r() - 0.5) * 6;
      const col = colors[Math.floor(r() * colors.length)];
      const k = ease.outExpo(range(bt, 0, 1.1));
      const drift = bt * 20 * u;
      const x = cx + Math.cos(a) * (dist * k + drift);
      const y = cy + Math.sin(a) * (dist * k + drift);
      const pop = ease.outBack(range(bt, 0, 0.4));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin * bt + a);
      ctx.scale(pop, pop);
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 5 * u;
      ctx.beginPath();
      if (type === 0) {
        ctx.arc(0, 0, size / 2, 0, TAU);
        ctx.fill();
      } else if (type === 1) {
        ctx.arc(0, 0, size / 2, 0, TAU);
        ctx.stroke();
      } else if (type === 2) {
        ctx.moveTo(0, -size / 2);
        ctx.lineTo(size / 2, size / 2);
        ctx.lineTo(-size / 2, size / 2);
        ctx.closePath();
        ctx.fill();
      } else if (type === 3) {
        ctx.rect(-size / 2, -size / 2, size, size);
        ctx.stroke();
      } else {
        ctx.rect(-size / 2, -size / 8, size, size / 4);
        ctx.rect(-size / 8, -size / 2, size / 4, size);
        ctx.fill();
      }
      ctx.restore();
    }
  };
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  burst(0.35, 46, 1);
  burst(0.75, 24, 0.6);
  ctx.restore();

  const layout = headline(sc, { sizeFrac: 0.28 });
  const words = layout.lines;
  words.forEach((line, i) => {
    const pop = ease.outElastic(range(t, 0.45 + i * 0.12, 1.4 + i * 0.12));
    ctx.save();
    ctx.translate(cx, layout.ys[i]);
    ctx.scale(pop * (1 - ex), pop * (1 - ex));
    ctx.rotate((1 - pop) * -0.15);
    ctx.translate(-cx, -layout.ys[i]);
    // Hard drop shadow for a sticker look.
    ctx.fillStyle = palette.secondary;
    ctx.save();
    ctx.translate(8 * u, 8 * u);
    drawLayout(sc, { ...layout, lines: [line], ys: [layout.ys[i]] });
    ctx.restore();
    ctx.fillStyle = palette.bg0;
    drawLayout(sc, { ...layout, lines: [line], ys: [layout.ys[i]] });
    ctx.restore();
  });
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 60 * u, range(t, 1.0, 1.6), { color: palette.bg0, alpha: 1 - ex });
}

export const energySkills: Skill[] = [
  {
    id: "particle-assemble",
    name: "Particle Vortex",
    tagline: "Thousands of particles spiral in and crystallise into your logo-type.",
    bestFor: "Brand/title reveals, AI and tech products. Best with a 1–2 word brand name.",
    sample: { text: "NOVA", subtext: "Meet the new assistant" },
    render: particleAssemble,
  },
  {
    id: "hyperspace",
    name: "Hyperspace Punch",
    tagline: "Warp-speed star streaks accelerate until the title punches through.",
    bestFor: "Openers and hooks: 'GET READY', 'INTRODUCING', sci-fi, space, speed.",
    sample: { text: "INTRODUCING", subtext: "The future is here" },
    render: hyperspace,
  },
  {
    id: "shockwave",
    name: "Shockwave",
    tagline: "An energy core charges, detonates and blasts the title out with debris.",
    bestFor: "Big dramatic moments, game trailers, drops, the main title hit.",
    sample: { text: "UNLEASHED", subtext: "Out now" },
    render: shockwave,
  },
  {
    id: "shape-burst",
    name: "Shape Burst",
    tagline: "A colour flood and confetti of geometric shapes with elastic sticker type.",
    bestFor: "Playful, friendly, social media, kids, celebrations, app launches.",
    sample: { text: "LET'S GO", subtext: "Summer drop" },
    render: shapeBurst,
  },
];
