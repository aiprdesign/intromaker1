import {
  background,
  drawLayout,
  dust,
  exitT,
  flash,
  glow,
  headline,
  headlineGradient,
  noGlow,
  subline,
} from "../fx";
import { clamp, ease, lerp, range, rgba, rng, TAU } from "../math";
import { displayFont, layoutChars, subFont } from "../text";
import type { Skill, SkillContext } from "../types";

/* ───────────────────────── Liquid Gradient ───────────────────────── */

function liquidGradient(sc: SkillContext) {
  const { ctx, w, h, t, palette, u, seed } = sc;
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(0, 0, w, h);
  const r = rng(seed);
  const colors = [palette.primary, palette.secondary, palette.accent, palette.primary, palette.bg1];
  const grow = ease.outCubic(range(t, 0, 1.2));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  colors.forEach((c, i) => {
    const fx = 0.2 + r() * 0.4;
    const fy = 0.2 + r() * 0.4;
    const ph = r() * TAU;
    const x = w * (0.5 + 0.35 * Math.sin(t * fx + ph));
    const y = h * (0.5 + 0.35 * Math.cos(t * fy + ph * 1.3));
    const rad = Math.max(w, h) * (0.35 + 0.15 * Math.sin(t * 0.7 + i)) * grow;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, rgba(c, 0.55));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  ctx.restore();
  // Soft darkening so type stays legible.
  ctx.fillStyle = rgba(palette.bg0, 0.25);
  ctx.fillRect(0, 0, w, h);

  const layout = headline(sc, { cy: h * 0.46, sizeFrac: 0.26 });
  const ex = ease.inCubic(exitT(sc, 0.5));
  let gi = 0;
  layout.lines.forEach((line, li) => {
    const y = layout.ys[li];
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y - layout.size * 0.62, w, layout.size * 1.24);
    ctx.clip();
    for (const ch of layoutChars(ctx, line, w / 2, layout.tracking)) {
      const t0 = 0.3 + gi * 0.035 + li * 0.1;
      const k = ease.outExpo(range(t, t0, t0 + 0.9));
      const out = ease.inExpo(range(t, sc.d - 0.5 + gi * 0.01, sc.d - 0.05 + gi * 0.01));
      ctx.fillStyle = palette.text;
      ctx.fillText(ch.char, ch.x, y + (1 - k) * layout.size * 1.2 - out * layout.size * 1.2);
      gi++;
    }
    ctx.restore();
  });

  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  const sub = (sc.scene.subtext ?? "").toUpperCase();
  if (sub) {
    const k = ease.outCubic(range(t, 0.9, 1.5)) * (1 - ex);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.font = subFont(26 * u, 600);
    const tw = ctx.measureText(sub).width + sub.length * 26 * u * 0.3 + 60 * u;
    const ph = 56 * u;
    const py = bottom + 50 * u;
    ctx.strokeStyle = rgba(palette.text, 0.5);
    ctx.fillStyle = rgba(palette.text, 0.08);
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.roundRect(w / 2 - tw / 2, py, tw, ph, ph / 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    subline(sc, py + ph / 2, range(t, 1.0, 1.6), { alpha: 1 - ex });
  }
}

/* ───────────────────────── Retro Grid ───────────────────────── */

function retroGrid(sc: SkillContext) {
  const { ctx, w, h, t, palette, u } = sc;
  const horizon = h * 0.6;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, palette.bg0);
  sky.addColorStop(0.7, palette.bg1);
  sky.addColorStop(1, rgba(palette.primary, 0.55));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  dust(sc, 80, palette.text, 0.05);

  // Striped sun.
  const rise = ease.outCubic(range(t, 0, 1.4));
  const sunR = Math.min(w, h) * 0.2;
  const sunY = horizon - sunR * 0.35 * rise + sunR * (1 - rise);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, horizon);
  ctx.clip();
  const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sg.addColorStop(0, palette.secondary);
  sg.addColorStop(1, palette.primary);
  glow(ctx, palette.primary, 60 * u);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(w / 2, sunY, sunR, 0, TAU);
  ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = palette.bg1;
  for (let i = 0; i < 7; i++) {
    const k = (i + ((t * 0.6) % 1)) / 7;
    const y = sunY + sunR * (0.05 + k * 0.95);
    ctx.fillRect(w / 2 - sunR, y, sunR * 2, k * 10 * u + 1);
  }
  ctx.restore();

  // Floor.
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, w, h - horizon);
  ctx.clip();
  ctx.strokeStyle = palette.primary;
  glow(ctx, palette.primary, 12 * u);
  ctx.lineWidth = 2 * u;
  const vx = w / 2;
  for (let i = -24; i <= 24; i++) {
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(vx + i * w * 0.012, horizon);
    ctx.lineTo(vx + i * w * 0.16, h * 1.05);
    ctx.stroke();
  }
  const scroll = (t * 1.6) % 1;
  for (let i = 0; i < 18; i++) {
    const z = (i + 1 - scroll) / 18;
    const y = horizon + (h - horizon) * Math.pow(1 - z, 2.4);
    ctx.globalAlpha = 1 - z;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
  const hz = ctx.createLinearGradient(0, horizon - 40 * u, 0, horizon + 40 * u);
  hz.addColorStop(0, rgba(palette.secondary, 0));
  hz.addColorStop(0.5, rgba(palette.secondary, 0.6));
  hz.addColorStop(1, rgba(palette.secondary, 0));
  ctx.fillStyle = hz;
  ctx.fillRect(0, horizon - 40 * u, w, 80 * u);

  // Chrome title.
  const ex = exitT(sc, 0.4);
  const layout = headline(sc, { cy: h * (h > w ? 0.28 : 0.17), sizeFrac: 0.2 });
  const drop = ease.outBack(range(t, 0.4, 1.2), 1.4);
  ctx.save();
  ctx.translate(0, (1 - drop) * -h * 0.5 - ex * h * 0.1);
  ctx.globalAlpha = clamp(drop * 2) * (1 - ex);
  const y0 = layout.ys[0] - layout.size / 2;
  const y1 = layout.ys[layout.ys.length - 1] + layout.size / 2;
  const chrome = ctx.createLinearGradient(0, y0, 0, y1);
  chrome.addColorStop(0, "#ffffff");
  chrome.addColorStop(0.45, palette.accent);
  chrome.addColorStop(0.5, palette.bg1);
  chrome.addColorStop(0.55, palette.secondary);
  chrome.addColorStop(1, "#ffffff");
  ctx.lineWidth = 6 * u;
  ctx.strokeStyle = palette.primary;
  glow(ctx, palette.primary, 30 * u);
  drawLayout(sc, layout, "stroke");
  noGlow(ctx);
  ctx.fillStyle = chrome;
  drawLayout(sc, layout);
  ctx.restore();
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  ctx.save();
  glow(ctx, palette.accent, 16 * u);
  subline(sc, bottom + 36 * u, range(t, 1.1, 1.7), { color: palette.accent, alpha: 1 - ex });
  ctx.restore();
}

/* ───────────────────────── Orbit Rings ───────────────────────── */

function orbitRings(sc: SkillContext) {
  const { ctx, w, h, t, palette, u } = sc;
  background(sc, { hot: palette.primary, hotAlpha: 0.2 });
  dust(sc, 70, palette.text, 0.2);
  const cx = w / 2;
  const cy = h / 2;
  const short = Math.min(w, h);
  const grow = ease.outExpo(range(t, 0, 1.2));
  const ex = ease.inCubic(exitT(sc, 0.5));
  const rings = [
    { r: 0.36, tiltX: 1.15, tiltZ: 0.35, speed: 0.6, color: palette.primary },
    { r: 0.44, tiltX: 1.3, tiltZ: -0.6, speed: -0.45, color: palette.secondary },
    { r: 0.52, tiltX: 1.05, tiltZ: 1.4, speed: 0.3, color: palette.accent },
  ];
  const project = (ring: (typeof rings)[number], a: number) => {
    const R = ring.r * short * grow * (1 + ex * 0.8);
    let x = Math.cos(a) * R;
    let y = Math.sin(a) * R;
    let z = 0;
    // Tilt around X.
    const cyx = Math.cos(ring.tiltX);
    const syx = Math.sin(ring.tiltX);
    [y, z] = [y * cyx, y * syx];
    // Rotate around view axis.
    const cz = Math.cos(ring.tiltZ + t * 0.1);
    const sz = Math.sin(ring.tiltZ + t * 0.1);
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    const persp = 1 / (1 + z / (short * 1.6));
    return { x: cx + x * persp, y: cy + y * persp, z };
  };
  const drawRings = (front: boolean) => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const ring of rings) {
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2 * u;
      glow(ctx, ring.color, 14 * u);
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 160; i++) {
        const p = project(ring, (i / 160) * TAU);
        if (p.z < 0 === front) {
          if (!pen) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
          pen = true;
        } else pen = false;
      }
      ctx.globalAlpha = (front ? 0.95 : 0.35) * (1 - ex);
      ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const p = project(ring, t * ring.speed * 2 + (k * TAU) / 3);
        if (p.z < 0 !== front) continue;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, (front ? 5 : 3) * u, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  };
  drawRings(false);

  // Core glow + title.
  const layout = headline(sc, { sizeFrac: 0.2, widthFrac: 0.6 });
  const k = ease.outCubic(range(t, 0.5, 1.3));
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, short * 0.35);
  cg.addColorStop(0, rgba(palette.primary, 0.35 * k));
  cg.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = k * (1 - ex);
  ctx.translate(cx, cy);
  const s = lerp(0.85, 1, k);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = headlineGradient(sc, layout, palette.text, palette.primary);
  glow(ctx, palette.primary, 24 * u);
  drawLayout(sc, layout);
  ctx.restore();
  drawRings(true);

  // HUD dial ticks.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.15);
  ctx.strokeStyle = rgba(palette.text, 0.35 * grow * (1 - ex));
  ctx.lineWidth = 1.5 * u;
  const dr = short * 0.6 * grow;
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * TAU;
    const l = i % 10 === 0 ? 16 * u : 6 * u;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * dr, Math.sin(a) * dr);
    ctx.lineTo(Math.cos(a) * (dr + l), Math.sin(a) * (dr + l));
    ctx.stroke();
  }
  ctx.restore();

  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 44 * u, range(t, 1.0, 1.6), { alpha: 1 - ex });
}

/* ───────────────────────── Number Ticker ───────────────────────── */

export function parseStat(text: string) {
  const m = text.match(/([$€£]?)(\d[\d,]*(?:\.\d+)?)\s*([kKmMbB%+x×]*\+?)/);
  if (!m) return { prefix: "", value: 100, decimals: 0, suffix: "%", label: text.trim() };
  const raw = m[2].replace(/,/g, "");
  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
  const label = (text.slice(0, m.index) + text.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, " ").trim();
  return { prefix: m[1], value: parseFloat(raw), decimals, suffix: m[3].toUpperCase(), label };
}

function numberTicker(sc: SkillContext) {
  const { ctx, w, h, t, palette, u, font } = sc;
  background(sc, { hot: palette.primary, hotAlpha: 0.18 });
  const stat = parseStat(sc.scene.text);
  const cx = w / 2;
  const cy = h * 0.44;
  const short = Math.min(w, h);
  const count = ease.outExpo(range(t, 0.2, 1.8));
  const ex = ease.inCubic(exitT(sc, 0.4));
  const value = stat.value * count;
  const digits =
    stat.decimals > 0
      ? value.toFixed(stat.decimals)
      : Math.round(value).toLocaleString("en-US");
  const str = `${stat.prefix}${digits}${stat.suffix}`;

  // Progress arc + ticks.
  const R = short * 0.34;
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  ctx.lineCap = "round";
  ctx.strokeStyle = rgba(palette.text, 0.1);
  ctx.lineWidth = 14 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();
  const arc = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  arc.addColorStop(0, palette.primary);
  arc.addColorStop(1, palette.secondary);
  ctx.strokeStyle = arc;
  glow(ctx, palette.primary, 24 * u);
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * 0.999 * count);
  ctx.stroke();
  noGlow(ctx);
  ctx.translate(cx, cy);
  ctx.rotate(-t * 0.2);
  ctx.strokeStyle = rgba(palette.primary, 0.5);
  ctx.lineWidth = 2 * u;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 1.12, Math.sin(a) * R * 1.12);
    ctx.lineTo(Math.cos(a) * R * (i % 5 === 0 ? 1.2 : 1.15), Math.sin(a) * R * (i % 5 === 0 ? 1.2 : 1.15));
    ctx.stroke();
  }
  ctx.restore();

  // Digits with fixed advance so they don't jitter while counting.
  const size = Math.min(short * 0.26, (R * 1.7) / Math.max(2, str.length * 0.62));
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  ctx.font = displayFont(font, size);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const adv = ctx.measureText("0").width * 1.02;
  const total = [...str].reduce((a, c) => a + (/\d/.test(c) ? adv : ctx.measureText(c).width), 0);
  let x = cx - total / 2;
  const g = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
  g.addColorStop(0, palette.text);
  g.addColorStop(1, palette.primary);
  ctx.fillStyle = g;
  glow(ctx, palette.primary, 30 * u);
  for (const c of str) {
    const cw = /\d/.test(c) ? adv : ctx.measureText(c).width;
    ctx.fillText(c, x + cw / 2, cy);
    x += cw;
  }
  ctx.restore();

  if (stat.label) {
    ctx.save();
    const ls = Math.min(56 * u, (w * 0.8) / Math.max(6, stat.label.length * 0.62));
    ctx.font = displayFont(font, ls);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const k = ease.outCubic(range(t, 0.8, 1.4));
    ctx.globalAlpha = k * (1 - ex);
    ctx.fillStyle = palette.text;
    ctx.fillText(stat.label.toUpperCase(), cx, cy + R + 70 * u + (1 - k) * 20 * u);
    ctx.restore();
  }
  subline(sc, cy + R + 130 * u, range(t, 1.2, 1.8), { alpha: 1 - ex });
  flash(sc, count >= 0.999 ? (1 - range(t, 1.8, 2.1)) * 0.2 : 0, palette.primary);
}

/* ───────────────────────── Cinematic Title ───────────────────────── */

function cinematicTitle(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u } = sc;
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  const push = 1 + 0.08 * ease.inOutCubic(range(t, 0, d));
  ctx.translate(cx, cy);
  ctx.scale(push, push);
  ctx.translate(-cx, -cy);
  background(sc, { hot: palette.primary, hotAlpha: 0.12 });
  dust(sc, 90, palette.secondary, 0.15);

  const layout = headline(sc, { sizeFrac: 0.22, widthFrac: 0.78 });
  const reveal = ease.outCubic(range(t, 0.3, 2.0));
  const ex = range(t, d - 0.6, d);
  // Tracking collapses from wide to tight while the title un-blurs.
  const wide = { ...layout, tracking: layout.tracking + layout.size * 0.35 * (1 - reveal) };
  const metal = headlineGradient(sc, layout, palette.secondary, palette.accent);
  ctx.save();
  ctx.globalAlpha = reveal * (1 - ex);
  const blur = (1 - reveal) * 18 * u;
  if (blur > 0.5) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.fillStyle = metal;
  drawLayout(sc, wide);
  ctx.filter = "none";
  // Light sweep across the metal.
  const sx = lerp(-w * 0.3, w * 1.3, range(t, 1.2, 2.6));
  const g = ctx.createLinearGradient(sx - 160 * u, 0, sx + 160 * u, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  drawLayout(sc, wide);
  ctx.restore();

  // Anamorphic flare.
  const fl = Math.exp(-Math.pow((t - 1.3) * 2.2, 2)) * (1 - ex);
  if (fl > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const fy = layout.ys[0];
    const fg = ctx.createLinearGradient(0, 0, w, 0);
    fg.addColorStop(0, rgba(palette.primary, 0));
    fg.addColorStop(0.5, rgba(palette.primary, 0.8 * fl));
    fg.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = fg;
    ctx.fillRect(0, fy - 2 * u, w, 4 * u);
    const rg = ctx.createRadialGradient(sx0(w, t), fy, 0, sx0(w, t), fy, 200 * u);
    rg.addColorStop(0, rgba("#ffffff", 0.7 * fl));
    rg.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 50 * u, range(t, 1.6, 2.4), { color: palette.secondary, alpha: (1 - ex) * 0.85 });
  ctx.restore();

  // Letterbox bars (outside the push-in).
  const bar = h * 0.11 * ease.outExpo(range(t, 0, 0.8));
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, bar);
  ctx.fillRect(0, h - bar, w, bar);
  // Fade to black on exit.
  flash(sc, ex, "#000000");
}

const sx0 = (w: number, t: number) => w * (0.35 + 0.3 * range(t, 0.8, 1.8));

/* ───────────────────────── HUD Scan ───────────────────────── */

function hudScan(sc: SkillContext) {
  const { ctx, w, h, t, palette, u, seed, font } = sc;
  background(sc, { hot: palette.primary, hotAlpha: 0.08 });
  const ex = ease.inCubic(exitT(sc, 0.4));
  const ui = rgba(palette.primary, 0.9 * (1 - ex));
  // Dot grid.
  ctx.fillStyle = rgba(palette.primary, 0.12 * (1 - ex));
  const step = 40 * u;
  for (let x = step / 2; x < w; x += step) for (let y = step / 2; y < h; y += step) ctx.fillRect(x, y, 2 * u, 2 * u);

  // Corner brackets snap in.
  const k = ease.outExpo(range(t, 0, 0.6));
  const m = lerp(0, 60 * u, k);
  const L = 70 * u;
  ctx.strokeStyle = ui;
  ctx.lineWidth = 3 * u;
  const corner = (x: number, y: number, sx: number, sy: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * L, y);
    ctx.stroke();
  };
  corner(m, m, 1, 1);
  corner(w - m, m, -1, 1);
  corner(m, h - m, 1, -1);
  corner(w - m, h - m, -1, -1);

  // Readouts.
  const r = rng(seed + Math.floor(t * 10));
  ctx.font = subFont(16 * u, 600);
  ctx.fillStyle = ui;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const hex = () => Math.floor(r() * 0xffffff).toString(16).toUpperCase().padStart(6, "0");
  const lines = [`SYS.STATUS // ONLINE`, `NODE 0x${hex()}`, `SIGNAL ${(80 + r() * 20).toFixed(1)}%`, `T+${t.toFixed(2)}s`];
  lines.forEach((l, i) => {
    if (t > 0.3 + i * 0.12) ctx.fillText(l, m + 24 * u, m + 24 * u + i * 24 * u);
  });
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  for (let i = 0; i < 4; i++) {
    const bw = 180 * u;
    const fill = clamp(range(t, 0.4 + i * 0.2, 1.4 + i * 0.25) * (0.5 + 0.5 * rng(seed + i)()));
    const y = h - m - 24 * u - i * 22 * u;
    ctx.fillStyle = rgba(palette.primary, 0.2 * (1 - ex));
    ctx.fillRect(w - m - 24 * u - bw, y - 8 * u, bw, 8 * u);
    ctx.fillStyle = ui;
    ctx.fillRect(w - m - 24 * u - bw, y - 8 * u, bw * fill, 8 * u);
  }

  // Target reticle.
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = rgba(palette.primary, 0.3 * (1 - ex));
  ctx.lineWidth = 1.5 * u;
  const rr = Math.min(w, h) * 0.38 * k;
  ctx.setLineDash([20 * u, 14 * u]);
  ctx.beginPath();
  ctx.arc(0, 0, rr, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Typed title with cursor, then scan line.
  const layout = headline(sc, { sizeFrac: 0.2, widthFrac: 0.7 });
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const full = layout.lines.join("\n");
  const typed = Math.floor(range(t, 0.5, 0.5 + full.length * 0.045) * full.length);
  let shown = 0;
  let cursor = { x: cx, y: layout.ys[0] };
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  ctx.fillStyle = palette.text;
  glow(ctx, palette.primary, 16 * u);
  ctx.font = displayFont(font, layout.size);
  layout.lines.forEach((line, li) => {
    for (const ch of layoutChars(ctx, line, cx, layout.tracking)) {
      if (shown < typed) {
        ctx.fillText(ch.char, ch.x, layout.ys[li]);
        cursor = { x: ch.x + ch.w / 2 + layout.tracking, y: layout.ys[li] };
      }
      shown++;
    }
    shown++;
  });
  noGlow(ctx);
  if (Math.floor(t * 3) % 2 === 0 || typed < full.length) {
    ctx.fillStyle = palette.primary;
    ctx.fillRect(cursor.x + 6 * u, cursor.y - layout.size * 0.4, layout.size * 0.08, layout.size * 0.8);
  }
  ctx.restore();

  const sy = lerp(-0.1, 1.1, range(t, 0.4 + full.length * 0.045, 1.4 + full.length * 0.045)) * h;
  const sg = ctx.createLinearGradient(0, sy - 60 * u, 0, sy);
  sg.addColorStop(0, rgba(palette.primary, 0));
  sg.addColorStop(1, rgba(palette.primary, 0.35));
  ctx.fillStyle = sg;
  ctx.fillRect(0, sy - 60 * u, w, 60 * u);
  ctx.fillStyle = palette.primary;
  ctx.fillRect(0, sy, w, 2 * u);

  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 50 * u, range(t, 0.7 + full.length * 0.045, 1.3 + full.length * 0.045), {
    color: palette.primary,
    alpha: 1 - ex,
  });
}

export const worldSkills: Skill[] = [
  {
    id: "liquid-gradient",
    name: "Liquid Mesh",
    tagline: "Flowing mesh-gradient blobs with editorial masked type rising through.",
    bestFor: "Premium SaaS, product launches, calm/elegant brands, taglines of 2–5 words.",
    sample: { text: "DESIGN THAT FLOWS", subtext: "Now in beta" },
    render: liquidGradient,
  },
  {
    id: "retro-grid",
    name: "Retrowave",
    tagline: "Synthwave sunset, scrolling neon grid and a chrome title drop.",
    bestFor: "80s, retro, synthwave, music, gaming nostalgia. 1–2 words.",
    sample: { text: "OUTRUN", subtext: "Midnight edition" },
    render: retroGrid,
  },
  {
    id: "orbit-rings",
    name: "Orbital Core",
    tagline: "Tilted 3D orbits with satellites circle a glowing core title.",
    bestFor: "Tech platforms, AI, science, networks, ecosystems. 1–2 words.",
    sample: { text: "CORE AI", subtext: "Connected by design" },
    render: orbitRings,
  },
  {
    id: "number-ticker",
    name: "Stat Counter",
    tagline: "A glowing counter races up to your number inside a progress dial.",
    bestFor: "Stats and milestones. Text MUST contain a number: a factual one ('3 STEPS', '2026'), or the site's own stat only when claims are allowed.",
    sample: { text: "3 STEPS", subtext: "To get started" },
    render: numberTicker,
  },
  {
    id: "cinematic-title",
    name: "Cinematic Title",
    tagline: "Letterboxed push-in, metallic type, light sweep and anamorphic flare.",
    bestFor: "Film-trailer titles, luxury, outros and final brand lock-ups. 1–3 words.",
    sample: { text: "LEGACY", subtext: "Coming this winter" },
    render: cinematicTitle,
  },
  {
    id: "hud-scan",
    name: "HUD Interface",
    tagline: "Sci-fi HUD brackets, live readouts and a typed title with scan line.",
    bestFor: "Tech, security, data, military/sci-fi, product specs. 1–3 words.",
    sample: { text: "TARGET LOCKED", subtext: "Mission 07" },
    render: hudScan,
  },
];
