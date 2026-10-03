import {
  background,
  bevel,
  drawLayout,
  extrude,
  exitT,
  flash,
  glow,
  headline,
  headlineGradient,
  noGlow,
  shake,
  speedLines,
  subline,
} from "../fx";
import { clamp, ease, lerp, range, rgba, rng } from "../math";
import { tokens } from "../grid";
import { scratch } from "../scratch";
import { displayFont, drawTracked, layoutChars } from "../text";
import type { Skill, SkillContext } from "../types";

/* ───────────────────────── Kinetic Slam ───────────────────────── */

function kineticSlam(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u } = sc;
  const words = sc.scene.text.toUpperCase().split(/\s+/).filter(Boolean);
  const n = Math.max(1, words.length);
  // One word per beat (half-beats for long lines) so every slam lands on a kick.
  const slot = n * sc.beat <= d * 0.6 ? sc.beat : sc.beat / 2;
  const start = 0;
  const finalT = start + n * slot;
  const idx = Math.min(n - 1, Math.floor((t - start) / slot));
  const inFinal = t >= finalT || n === 1;

  const impactT = inFinal ? (n === 1 ? start : finalT) : start + Math.max(0, idx) * slot;
  const local = t - impactT;
  const invert = !inFinal && idx % 2 === 1;

  // Background: alternate between deep bg and a solid primary block.
  if (invert) {
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, w, h);
  } else {
    background(sc, { hot: palette.accent, hotAlpha: 0.25 });
  }

  const sh = shake(sc, impactT, 22, 0.3);
  const ex = exitT(sc, 0.3);
  ctx.save();
  ctx.translate(w / 2 + sh.x, h / 2 + sh.y);
  const slam = ease.outExpo(range(local, 0, 0.22));
  // After the slam, a slow drift that eases toward +8% (inside the layout's 10% headroom).
  const s = lerp(2.6, 1, slam) * (1 + ex * 0.5) * (1 + 0.08 * (1 - Math.exp(-Math.max(0, local) * 0.4)));
  ctx.scale(s, s);
  ctx.translate(-w / 2, -h / 2);
  ctx.globalAlpha = clamp(slam * 1.5) * (1 - ex);

  if (!inFinal && idx >= 0) {
    // Settled words fit the title-safe width, with headroom for the slow drift after each slam.
    const layout = headline(sc, { text: words[idx], widthFrac: tokens(w, h).safe.width / w / 1.1, sizeFrac: 0.55, maxLines: 1 });
    // Motion-blur ghosts while slamming in.
    if (slam < 1) {
      ctx.save();
      ctx.globalAlpha = 0.25 * (1 - slam);
      ctx.fillStyle = invert ? palette.bg0 : palette.secondary;
      for (let k = 1; k <= 3; k++) {
        ctx.save();
        const gs = 1 + k * 0.12 * (1 - slam);
        ctx.translate(w / 2, h / 2);
        ctx.scale(gs, gs);
        ctx.translate(-w / 2, -h / 2);
        drawLayout(sc, layout);
        ctx.restore();
      }
      ctx.restore();
    }
    extrude(sc, layout, { color: invert ? palette.secondary : undefined });
    ctx.fillStyle = invert ? palette.bg0 : palette.text;
    drawLayout(sc, layout);
    bevel(sc, layout);
  } else {
    const layout = headline(sc, { cy: h * 0.47, sizeFrac: 0.3, widthFrac: tokens(w, h).safe.width / w / 1.1 });
    extrude(sc, layout);
    ctx.fillStyle = headlineGradient(sc, layout, palette.text, palette.primary);
    glow(ctx, rgba(palette.primary, 0.6), 30 * u);
    drawLayout(sc, layout);
    noGlow(ctx);
    bevel(sc, layout);
    const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
    ctx.globalAlpha = 1 - ex;
    ctx.fillStyle = palette.secondary;
    const barW = w * 0.3 * ease.outExpo(range(t, finalT + 0.1, finalT + 0.6));
    ctx.fillRect(w / 2 - barW / 2, bottom + 24 * u, barW, 6 * u);
    subline(sc, bottom + 70 * u, range(t, finalT + 0.25, finalT + 0.9));
  }
  ctx.restore();

  speedLines(sc, (1 - range(local, 0, 0.35)) * 0.8, invert ? palette.bg0 : palette.text);
  flash(sc, (1 - range(local, 0, 0.18)) * 0.35, invert ? palette.text : palette.primary);
}

/* ───────────────────────── Glitch Reveal ───────────────────────── */

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=/<>";

function glitchReveal(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u, seed } = sc;
  background(sc, { hot: palette.primary, hotAlpha: 0.12 });

  // Glitch intensity: heavy on entry, random spikes, rising on exit.
  const bucket = Math.floor(t * 12);
  const spikeR = rng(seed * 31 + bucket)();
  const spike = spikeR > 0.86 ? 0.6 : 0;
  const g = clamp(Math.max(1 - range(t, 0.2, 1.1), spike, range(t, d - 0.4, d)));

  const layout = headline(sc, { cy: h * 0.47, sizeFrac: 0.28 });
  const resolveEnd = 1.0;
  const text = scratch("glitch-text", w, h);
  const o = text.ctx;
  o.font = displayFont(sc.font, layout.size);
  o.textBaseline = "middle";
  o.textAlign = "center";
  o.fillStyle = "#fff";
  let gi = 0;
  const totalChars = layout.lines.join("").length;
  layout.lines.forEach((line, li) => {
    for (const ch of layoutChars(o, line, w / 2, layout.tracking)) {
      const r = rng(seed + gi * 13);
      const resolveAt = 0.1 + (gi / Math.max(1, totalChars)) * 0.6 * resolveEnd + r() * 0.25;
      let c = ch.char;
      if (c !== " " && (t < resolveAt || (g > 0.5 && rng(seed + gi + bucket * 7)() < g * 0.3))) {
        c = GLYPHS[Math.floor(rng(seed + gi * 7 + bucket)() * GLYPHS.length)];
      }
      if (t > resolveAt - 0.35) o.fillText(c, ch.x, layout.ys[li]);
      gi++;
    }
  });

  // Colourise and composite with RGB split + slice displacement.
  const split = (4 + g * 26) * u;
  const tinted = (color: string) => {
    const s = scratch("glitch-tint", w, h);
    s.ctx.drawImage(text.canvas, 0, 0);
    s.ctx.globalCompositeOperation = "source-in";
    s.ctx.fillStyle = color;
    s.ctx.fillRect(0, 0, w, h);
    return s.canvas;
  };
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.85;
  ctx.drawImage(tinted(palette.secondary), -split, 0);
  ctx.drawImage(tinted(palette.primary), split, 0);
  ctx.restore();

  const r = rng(seed + bucket * 101);
  const sliceCount = 14;
  for (let i = 0; i < sliceCount; i++) {
    const y0 = (i / sliceCount) * h;
    const sh = h / sliceCount;
    const off = r() < g * 0.6 ? (r() - 0.5) * 140 * g * u : 0;
    ctx.drawImage(text.canvas, 0, y0, w, sh, off, y0, w, sh);
  }

  // Noise blocks.
  ctx.save();
  for (let i = 0; i < Math.floor(g * 18); i++) {
    ctx.globalAlpha = 0.25 + r() * 0.5;
    ctx.fillStyle = r() > 0.5 ? palette.primary : palette.secondary;
    ctx.fillRect(r() * w, r() * h, (20 + r() * 220) * u, (2 + r() * 14) * u);
  }
  ctx.restore();

  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 60 * u, range(t, 0.9, 1.5), { color: palette.primary });

  // Scanlines.
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#000";
  for (let y = 0; y < h; y += 4 * Math.max(1, Math.round(u))) ctx.fillRect(0, y, w, 1.5 * Math.max(1, u));
  ctx.restore();
}

/* ───────────────────────── Neon Draw ───────────────────────── */

function neonDraw(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u, seed } = sc;
  background(sc);
  // Faint floor reflection plane.
  const floorY = h * 0.66;
  const fg = ctx.createLinearGradient(0, floorY, 0, h);
  fg.addColorStop(0, rgba(palette.primary, 0.08));
  fg.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = fg;
  ctx.fillRect(0, floorY, w, h - floorY);

  const layout = headline(sc, { cy: h * 0.44, sizeFrac: 0.26 });
  const drawP = ease.inOutCubic(range(t, 0.05, Math.min(1.5, d * 0.5)));
  const on = t > Math.min(1.5, d * 0.5);
  // Flicker as the tube ignites.
  const fr = rng(seed + Math.floor(t * 30))();
  const flick = on ? (t < Math.min(1.5, d * 0.5) + 0.35 ? (fr > 0.35 ? 1 : 0.25) : 0.92 + 0.08 * Math.sin(t * 40)) : 1;
  const ex = exitT(sc, 0.4);
  const alpha = (1 - ex) * flick;

  const dash = layout.size * 8;
  const strokePass = (color: string, width: number, blur: number, a: number, k: number) => {
    ctx.save();
    ctx.globalAlpha = a * alpha * k;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.setLineDash([dash * drawP, dash]);
    glow(ctx, color, blur);
    drawLayout(sc, layout, "stroke");
    ctx.restore();
  };

  const textBottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  const tube = (flip: boolean) => {
    const k = flip ? 0.1 : 1;
    ctx.save();
    if (flip) {
      // Mirror about a floor line below the subtitle.
      const mirror = textBottom + 120 * u;
      ctx.translate(0, mirror * 2);
      ctx.scale(1, -1);
    }
    if (on) {
      ctx.save();
      ctx.globalAlpha = 0.18 * alpha * k;
      ctx.fillStyle = palette.primary;
      drawLayout(sc, layout);
      ctx.restore();
    }
    strokePass(palette.primary, 10 * u, 40 * u, 0.6, k);
    strokePass(palette.primary, 5 * u, 16 * u, 0.9, k);
    strokePass("#ffffff", 1.8 * u, 4 * u, 1, k);
    ctx.restore();
  };
  tube(true);
  tube(false);

  // A travelling spark at the head of the stroke while drawing.
  if (!on && drawP > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const sx = lerp(w * 0.1, w * 0.9, drawP);
    const g = ctx.createRadialGradient(sx, layout.ys[0], 0, sx, layout.ys[0], 120 * u);
    g.addColorStop(0, rgba(palette.secondary, 0.5));
    g.addColorStop(1, rgba(palette.secondary, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  ctx.save();
  glow(ctx, palette.secondary, 18 * u);
  subline(sc, bottom + 60 * u, range(t, Math.min(1.7, d * 0.55), Math.min(2.3, d * 0.75)), {
    color: palette.secondary,
    alpha: 1 - ex,
  });
  ctx.restore();
}

/* ───────────────────────── Type Cascade ───────────────────────── */

function typeCascade(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u } = sc;
  background(sc, { hot: palette.secondary, hotAlpha: 0.12 });
  const layout = headline(sc, { cy: h * 0.46, sizeFrac: 0.27 });
  const colors = [palette.primary, palette.secondary, palette.accent];
  const total = layout.lines.join("").length;
  const stagger = Math.min(0.06, 0.9 / Math.max(1, total));
  const ex = exitT(sc, 0.5);
  let gi = 0;
  layout.lines.forEach((line, li) => {
    const y = layout.ys[li];
    for (const ch of layoutChars(ctx, line, w / 2, layout.tracking)) {
      const t0 = 0.1 + gi * stagger;
      const blockIn = ease.outExpo(range(t, t0, t0 + 0.22));
      const blockOut = ease.inOutExpo(range(t, t0 + 0.22, t0 + 0.5));
      const top = y - layout.size * 0.52;
      const bh = layout.size * 1.04;
      const bw = ch.w + layout.tracking;
      // Exit: letters fall away in sequence.
      const fall = ease.inCubic(range(t, d - 0.5 + gi * stagger * 0.4, d - 0.1 + gi * stagger * 0.4));
      ctx.save();
      ctx.translate(0, fall * h * 0.6);
      ctx.globalAlpha = 1 - fall;
      if (ch.char !== " ") {
        // Letter itself, revealed behind the block.
        if (blockIn >= 1) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(ch.x - bw / 2, top, bw, bh);
          ctx.clip();
          const rise = ease.outExpo(range(t, t0 + 0.18, t0 + 0.6));
          ctx.fillStyle = palette.text;
          ctx.fillText(ch.char, ch.x, y + (1 - rise) * bh);
          ctx.restore();
        }
        // Colour block wipes up then away.
        const b0 = top + bh * (1 - blockIn);
        const b1 = top + bh * (1 - blockOut);
        const hh = Math.max(0, Math.min(b1, top + bh) - b0);
        if (hh > 0 && blockOut < 1) {
          ctx.fillStyle = colors[gi % colors.length];
          ctx.fillRect(ch.x - bw / 2, blockOut > 0 ? top : b0, bw, blockOut > 0 ? bh * (1 - blockOut) : hh);
        }
      }
      ctx.restore();
      gi++;
    }
  });
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 60 * u, range(t, 0.4 + total * stagger, 1 + total * stagger), { alpha: 1 - ex });
}

/* ───────────────────────── Split Wipe ───────────────────────── */

function splitWipe(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u } = sc;
  background(sc, { hot: palette.primary, hotAlpha: 0.1 });
  const colors = [palette.primary, palette.secondary, palette.accent];
  const skew = h * 0.35;

  const panel = (x: number, color: string, width: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + skew, 0);
    ctx.lineTo(x + skew + width, 0);
    ctx.lineTo(x + width - skew, h);
    ctx.lineTo(x - skew, h);
    ctx.closePath();
    ctx.fill();
  };

  const layout = headline(sc, { cy: h * 0.47, sizeFrac: 0.28 });
  const reveal = ease.outExpo(range(t, 0.45, 1.1));
  const ex = ease.inOutExpo(range(t, d - 0.55, d));
  const top = layout.ys[0] - layout.size * 0.55;
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.55;
  const mid = (top + bottom) / 2;

  // Top half slides from the left, bottom half from the right.
  for (const half of [0, 1]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, half ? mid : 0, w, half ? h - mid : mid);
    ctx.clip();
    const dir = half ? 1 : -1;
    ctx.translate(dir * (1 - reveal) * w * 0.6 + dir * ex * -w * 0.1, 0);
    extrude(sc, layout, { depth: 10 });
    ctx.fillStyle = half ? palette.primary : palette.text;
    drawLayout(sc, layout);
    ctx.restore();
  }
  // Cut line.
  const lw = w * 0.9 * ease.outExpo(range(t, 0.9, 1.5));
  ctx.fillStyle = palette.secondary;
  ctx.fillRect(w / 2 - lw / 2, mid - 1.5 * u, lw, 3 * u);
  subline(sc, bottom + 50 * u, range(t, 1.1, 1.7));

  // Panels sweep in to open, and again to close the scene.
  const sweep = (p: number, lead: number) => {
    colors.forEach((c, i) => {
      const k = ease.inOutExpo(clamp(p * 1.25 - i * 0.12 * lead));
      const x = lerp(-w - skew * 2, w + skew * 2, k);
      panel(x, c, w * 0.9);
    });
  };
  if (t < 1.2) sweep(range(t, 0, 0.9), 1);
  if (ex > 0) {
    colors.forEach((c, i) => {
      const k = ease.inOutExpo(clamp(ex * 1.3 - i * 0.1));
      panel(lerp(-w * 2 - skew * 2, -skew, k), c, w + skew * 2);
    });
  }
}

export const typographySkills: Skill[] = [
  {
    id: "kinetic-slam",
    name: "Kinetic Slam",
    tagline: "Word-by-word impact typography with camera shake and speed lines.",
    bestFor: "Hype phrases of 2–5 words, trailers, sports, launches. The words slam in on the beat.",
    sample: { text: "BUILT TO WIN", subtext: "Season 2026" },
    render: kineticSlam,
  },
  {
    id: "glitch-reveal",
    name: "Glitch Decode",
    tagline: "Scrambled glyphs decode into your title through RGB-split data-moshing.",
    bestFor: "Tech, cyber, AI, gaming, hacker aesthetics. Short titles of 1–3 words.",
    sample: { text: "SYSTEM ONLINE", subtext: "Access granted" },
    render: glitchReveal,
  },
  {
    id: "neon-draw",
    name: "Neon Ignite",
    tagline: "Glowing tubes trace your letters, flicker on and reflect on the floor.",
    bestFor: "Nightlife, gaming, retro, music events. 1–2 words.",
    sample: { text: "NIGHT SHIFT", subtext: "Live on Fridays" },
    render: neonDraw,
  },
  {
    id: "type-cascade",
    name: "Block Cascade",
    tagline: "Colour blocks wipe through the letters in a rhythmic cascade.",
    bestFor: "Modern brand intros, agencies, playful launches. Any short title.",
    sample: { text: "MAKE IT BOLD", subtext: "Studio reel" },
    render: typeCascade,
  },
  {
    id: "split-wipe",
    name: "Split Sweep",
    tagline: "Diagonal colour panels sweep through while the title slices together.",
    bestFor: "Energetic transitions, sports, fashion, feature callouts. 1–3 words.",
    sample: { text: "NEXT LEVEL", subtext: "Performance mode" },
    render: splitWipe,
  },
];
