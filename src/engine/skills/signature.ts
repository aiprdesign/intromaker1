import { background, bevel, drawLayout, dust, exitT, extrude, flash, glow, headline, headlineGradient, noGlow, subline } from "../fx";
import { clamp, ease, lerp, mix, mixHex, range, rgba, rng, TAU } from "../math";
import { scratch } from "../scratch";
import { displayFont, drawTracked, layoutChars } from "../text";
import type { Skill, SkillContext } from "../types";

/* ───────────────────────── God Rays ───────────────────────── */

function godRays(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u } = sc;
  background(sc);
  dust(sc, 110, palette.secondary, 0.12);
  const ex = exitT(sc, 0.5);
  const layout = headline(sc, { cy: h * 0.46, sizeFrac: 0.27 });
  const intensity = ease.outCubic(range(t, 0.1, 1.2)) * (1 - ex);

  // Light source drifts behind the title so the shafts sweep.
  const lx = w / 2 + Math.sin(t * 0.6) * w * 0.05;
  const ly = layout.ys[0] + (layout.ys[layout.ys.length - 1] - layout.ys[0]) / 2 + Math.cos(t * 0.45) * h * 0.02;
  const R = Math.max(w, h) * 0.24;

  // Occlusion mask at half resolution: a bright light with the letters cut out of it.
  const hw = Math.round(w / 2);
  const hh = Math.round(h / 2);
  const mask = scratch("rays-mask", hw, hh);
  const m = mask.ctx;
  const lg = m.createRadialGradient(lx / 2, ly / 2, 0, lx / 2, ly / 2, R / 2);
  lg.addColorStop(0, rgba(palette.secondary, 0.95));
  lg.addColorStop(0.4, rgba(palette.primary, 0.55));
  lg.addColorStop(1, rgba(palette.primary, 0));
  m.fillStyle = lg;
  m.fillRect(0, 0, hw, hh);
  m.globalCompositeOperation = "destination-out";
  m.font = displayFont(sc.font, layout.size / 2);
  m.textAlign = "center";
  m.textBaseline = "middle";
  m.fillStyle = "#000";
  layout.lines.forEach((line, i) => drawTracked(m, line, w / 4, layout.ys[i] / 2, layout.tracking / 2));
  m.globalCompositeOperation = "source-over";

  const ignite = ease.inOutCubic(range(t, Math.min(1.6, d * 0.45), Math.min(2.4, d * 0.7)));
  // Radial blur outward from the light turns the gaps into volumetric shafts.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const n = 24;
  const rays = intensity * (1 - ignite * 0.45);
  for (let i = 0; i < n; i++) {
    const sc2 = 1 + (i / n) * 1.5;
    ctx.globalAlpha = 0.075 * (1 - i / n) * rays;
    ctx.drawImage(mask.canvas, lx - lx * sc2, ly - ly * sc2, w * sc2, h * sc2);
  }
  ctx.restore();

  // Title face: a dark silhouette with a rim light that ignites into metal.
  ctx.save();
  ctx.globalAlpha = clamp(intensity * 1.5) * (1 - ex);
  ctx.fillStyle = palette.bg0;
  drawLayout(sc, layout);
  ctx.globalAlpha *= ignite;
  extrude(sc, layout, { depth: 12 });
  ctx.fillStyle = headlineGradient(sc, layout, palette.secondary, palette.accent);
  drawLayout(sc, layout);
  ctx.strokeStyle = rgba(palette.bg0, 0.8);
  ctx.lineWidth = 2.5 * u;
  drawLayout(sc, layout, "stroke");
  bevel(sc, layout, 0.8);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = intensity * (1 - ignite * 0.6);
  ctx.strokeStyle = rgba(palette.secondary, 0.9);
  ctx.lineWidth = 2 * u;
  glow(ctx, palette.secondary, 12 * u);
  drawLayout(sc, layout, "stroke");
  ctx.restore();

  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 56 * u, range(t, Math.min(1.9, d * 0.55), Math.min(2.5, d * 0.75)), { alpha: 1 - ex });
  flash(sc, ignite > 0 && ignite < 1 ? 0.12 * Math.sin(ignite * Math.PI) : 0, palette.secondary);
}

/* ───────────────────────── Glass Shatter ───────────────────────── */

interface Shard {
  pts: [number, number][];
  cx: number;
  cy: number;
  ang: number;
  dist: number;
  spin: number;
  delay: number;
  box: [number, number, number, number];
}

const shardCache = new Map<string, Shard[]>();

function makeShards(key: string, x0: number, y0: number, bw: number, bh: number, seed: number) {
  const hit = shardCache.get(key);
  if (hit) return hit;
  const r = rng(seed);
  const cols = 12;
  const rows = 5;
  // Jittered lattice → two triangles per cell.
  const P: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    P.push([]);
    for (let i = 0; i <= cols; i++) {
      const edge = i === 0 || j === 0 || i === cols || j === rows;
      const jx = edge ? 0 : (r() - 0.5) * (bw / cols) * 0.8;
      const jy = edge ? 0 : (r() - 0.5) * (bh / rows) * 0.8;
      P[j].push([x0 + (i / cols) * bw + jx, y0 + (j / rows) * bh + jy]);
    }
  }
  const shards: Shard[] = [];
  const mx = x0 + bw / 2;
  const my = y0 + bh / 2;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = P[j][i];
      const b = P[j][i + 1];
      const c = P[j + 1][i + 1];
      const d = P[j + 1][i];
      const tris = r() > 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      for (const tri of tris as [number, number][][]) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        const xs = tri.map((p) => p[0]);
        const ys = tri.map((p) => p[1]);
        const box: [number, number, number, number] = [
          Math.floor(Math.min(...xs)) - 2,
          Math.floor(Math.min(...ys)) - 2,
          Math.ceil(Math.max(...xs) - Math.min(...xs)) + 4,
          Math.ceil(Math.max(...ys) - Math.min(...ys)) + 4,
        ];
        const fromCentre = Math.hypot(cx - mx, cy - my) / Math.hypot(bw, bh);
        shards.push({
          pts: tri,
          cx,
          cy,
          ang: Math.atan2(cy - my, cx - mx) + (r() - 0.5) * 0.8,
          dist: (0.5 + r()) * Math.max(bw, bh) * 0.9,
          spin: (r() - 0.5) * 7,
          delay: fromCentre * 0.5 + r() * 0.15,
          box,
        });
      }
    }
  }
  if (shardCache.size > 32) shardCache.clear();
  shardCache.set(key, shards);
  return shards;
}

function glassShatter(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u, seed } = sc;
  background(sc, { hot: palette.primary, hotAlpha: 0.14 });
  const layout = headline(sc, { cy: h * 0.46, sizeFrac: 0.29 });
  const top = layout.ys[0] - layout.size * 0.62;
  const bh = layout.ys[layout.ys.length - 1] + layout.size * 0.62 - top;
  const x0 = w * 0.06;
  const bw = w * 0.88;

  // Render the finished title (with depth) once per frame into a buffer.
  const face = scratch("shatter-face", w, h);
  const fsc = { ...sc, ctx: face.ctx };
  face.ctx.font = displayFont(sc.font, layout.size);
  face.ctx.textAlign = "center";
  face.ctx.textBaseline = "middle";
  extrude(fsc, layout, { depth: 12 });
  face.ctx.fillStyle = headlineGradient(fsc, layout, palette.text, palette.primary);
  drawLayout(fsc, layout);
  bevel(fsc, layout);

  const shards = makeShards(`${sc.scene.text}|${w}|${h}|${sc.font}`, x0, top, bw, bh, seed);
  const assembleEnd = Math.min(1.5, d * 0.45);
  const breakAt = d - 0.6;
  let sparkle = 0;
  ctx.save();
  for (const s of shards) {
    const kin = ease.outExpo(range(t, 0.1 + s.delay, assembleEnd * 0.6 + s.delay));
    const kout = ease.inQuad(range(t, breakAt + s.delay * 0.3, d));
    const off = (1 - kin) * s.dist + kout * s.dist * 1.4;
    const rot = (1 - kin) * s.spin + kout * s.spin * 1.2;
    if (kin <= 0) continue;
    const dx = Math.cos(s.ang) * off;
    const dy = Math.sin(s.ang) * off + kout * kout * h * 0.4;
    ctx.save();
    ctx.globalAlpha = clamp(kin * 2) * (1 - kout);
    ctx.translate(s.cx + dx, s.cy + dy);
    ctx.rotate(rot);
    ctx.translate(-s.cx, -s.cy);
    ctx.beginPath();
    ctx.moveTo(s.pts[0][0], s.pts[0][1]);
    ctx.lineTo(s.pts[1][0], s.pts[1][1]);
    ctx.lineTo(s.pts[2][0], s.pts[2][1]);
    ctx.closePath();
    // Faint glass body so shards read even where there is no letter.
    ctx.fillStyle = rgba(palette.primary, 0.05 + (1 - kin) * 0.1);
    ctx.fill();
    ctx.save();
    ctx.clip();
    const [bx, by, bwid, bhei] = s.box;
    ctx.drawImage(face.canvas, bx, by, bwid, bhei, bx, by, bwid, bhei);
    ctx.restore();
    // Edge glint while in motion.
    const moving = (1 - kin) + kout;
    if (moving > 0.02) {
      ctx.strokeStyle = rgba("#ffffff", 0.6 * clamp(moving * 2));
      ctx.lineWidth = 1.2 * u;
      ctx.stroke();
    }
    ctx.restore();
    if (kin > 0.97 && kin < 1) sparkle++;
  }
  ctx.restore();

  // Once locked, a specular sweep across the glass.
  const locked = range(t, assembleEnd, assembleEnd + 0.9);
  if (locked > 0 && locked < 1 && t < breakAt) {
    const sx = lerp(x0 - 200 * u, x0 + bw + 200 * u, ease.inOutCubic(locked));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, top, bw, bh);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(sx - 120 * u, 0, sx + 120 * u, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.translate(sx, 0);
    ctx.transform(1, 0, -0.4, 1, 0, 0);
    ctx.translate(-sx, 0);
    ctx.fillRect(sx - 150 * u, top, 300 * u, bh);
    ctx.restore();
  }
  const bottom = top + bh;
  subline(sc, bottom + 40 * u, range(t, assembleEnd + 0.1, assembleEnd + 0.7), { alpha: 1 - exitT(sc, 0.6) });
  flash(sc, sparkle > 0 ? 0.05 : 0, palette.primary);
  flash(sc, t > breakAt ? (1 - range(t, breakAt, breakAt + 0.2)) * 0.4 : 0, "#ffffff");
}

/* ───────────────────────── Warp Tunnel ───────────────────────── */

function warpTunnel(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u } = sc;
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2 + Math.sin(t * 0.7) * w * 0.03;
  const cy = h / 2 + Math.cos(t * 0.5) * h * 0.03;
  const tp = Math.min(d * 0.45, sc.beat * Math.max(2, Math.round(1.4 / sc.beat)));
  const speed = t < tp ? 0.6 + 2.2 * range(t, 0, tp) ** 2 : 0.35 + 2.45 * Math.exp(-(t - tp) * 2.5);
  const travel = t < tp ? 0.6 * t + (2.2 * tp * range(t, 0, tp) ** 3) / 3 : 0.6 * tp + (2.2 * tp) / 3 + 0.35 * (t - tp) + (2.45 / 2.5) * (1 - Math.exp(-(t - tp) * 2.5));
  const N = 22;
  const sides = 6;
  const R = Math.max(w, h) * 0.12;
  const colors = [palette.primary, palette.secondary, palette.accent];

  // Glow at the vanishing point.
  const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.5);
  vg.addColorStop(0, rgba(palette.secondary, 0.45));
  vg.addColorStop(1, rgba(palette.secondary, 0));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  let prev: [number, number][] | null = null;
  // Far → near so near rings draw on top.
  for (let i = N - 1; i >= 0; i--) {
    const idx = i + Math.floor(travel * 4);
    const z = (i + 1 - ((travel * 4) % 1)) / N; // 0 near → 1 far
    const p = 1 / (z * 6 + 0.05);
    const rad = R * p;
    const rot = idx * 0.18 + t * 0.2;
    const pts: [number, number][] = [];
    for (let k = 0; k < sides; k++) {
      const a = rot + (k / sides) * TAU;
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    const alpha = clamp((1 - z) * 1.4) * clamp(z * 8);
    const color = colors[((idx % 3) + 3) % 3];
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha * 0.9;
    ctx.lineWidth = Math.max(1, 3 * p * 0.25 * u);
    glow(ctx, color, 14 * u);
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    // Longitudinal rails joining to the previous (farther) ring.
    if (prev) {
      ctx.globalAlpha = alpha * 0.35;
      ctx.lineWidth = 1.2 * u;
      ctx.beginPath();
      for (let k = 0; k < sides; k++) {
        ctx.moveTo(pts[k][0], pts[k][1]);
        ctx.lineTo(prev[k][0], prev[k][1]);
      }
      ctx.stroke();
    }
    prev = pts;
  }
  noGlow(ctx);
  // Speed streaks.
  const r = rng(sc.seed + 5);
  for (let i = 0; i < 90; i++) {
    const a = r() * TAU;
    const z = ((r() + travel * 0.8) % 1);
    const p0 = (0.2 + z * 1.4) * Math.max(w, h) * 0.5;
    const len = speed * 40 * u * (0.5 + z);
    ctx.globalAlpha = z * 0.6;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = (0.5 + z * 1.5) * u;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * p0, cy + Math.sin(a) * p0);
    ctx.lineTo(cx + Math.cos(a) * (p0 + len), cy + Math.sin(a) * (p0 + len));
    ctx.stroke();
  }
  ctx.restore();

  // Title rockets out of the vanishing point.
  const k = ease.outExpo(range(t, tp - 0.35, tp + 0.4));
  if (k > 0) {
    const ex = exitT(sc, 0.4);
    const layout = headline(sc, { sizeFrac: 0.27 });
    ctx.save();
    ctx.globalAlpha = clamp(k * 1.3) * (1 - ex);
    ctx.translate(w / 2, h / 2);
    const s = lerp(0.05, 1, k) * (1 + ex * 3);
    ctx.scale(s, s);
    ctx.translate(-w / 2, -h / 2);
    extrude(sc, layout);
    ctx.fillStyle = headlineGradient(sc, layout, "#ffffff", palette.primary);
    glow(ctx, palette.primary, 26 * u);
    drawLayout(sc, layout);
    noGlow(ctx);
    bevel(sc, layout);
    ctx.restore();
    const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
    subline(sc, bottom + 56 * u, range(t, tp + 0.3, tp + 0.9), { alpha: 1 - ex });
  }
  flash(sc, t >= tp ? (1 - range(t, tp, tp + 0.25)) * 0.6 : 0, "#ffffff");
}

/* ───────────────────────── 3D Flip ───────────────────────── */

function flip3d(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u } = sc;
  background(sc, { hot: palette.secondary, hotAlpha: 0.14 });
  // Stage floor with a spotlight pool.
  const floorY = h * 0.68;
  const pool = ctx.createRadialGradient(w / 2, floorY, 0, w / 2, floorY, w * 0.45);
  pool.addColorStop(0, rgba(palette.primary, 0.22));
  pool.addColorStop(1, rgba(palette.primary, 0));
  ctx.save();
  ctx.translate(w / 2, floorY);
  ctx.scale(1, 0.18);
  ctx.translate(-w / 2, -floorY);
  ctx.fillStyle = pool;
  ctx.fillRect(0, floorY - w * 0.5, w, w);
  ctx.restore();

  const layout = headline(sc, { cy: h * 0.44, sizeFrac: 0.27 });
  const depth = layout.size * 0.16;
  const side = mixHex(palette.primary, palette.bg0, 0.5);
  let wi = 0;
  layout.lines.forEach((line, li) => {
    const chars = layoutChars(ctx, line, w / 2, layout.tracking);
    // Group characters into words with their centres.
    const words: { text: string; x: number }[] = [];
    let cur: typeof chars = [];
    const push = () => {
      if (!cur.length) return;
      const left = cur[0].x - cur[0].w / 2;
      const right = cur[cur.length - 1].x + cur[cur.length - 1].w / 2;
      words.push({ text: cur.map((c) => c.char).join(""), x: (left + right) / 2 });
      cur = [];
    };
    for (const c of chars) (c.char === " " ? push() : cur.push(c));
    push();

    for (const word of words) {
      const t0 = 0.1 + wi * sc.beat * 0.5;
      const kin = ease.outBack(range(t, t0, t0 + 0.7), 1.3);
      const kout = ease.inCubic(range(t, d - 0.5 + wi * 0.05, d - 0.1 + wi * 0.05));
      const sway = Math.sin((t - t0) * 1.6 + wi) * 0.12 * range(t, t0 + 0.7, t0 + 1.2);
      const angle = (1 - kin) * -1.75 + sway + kout * 1.6;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const y = layout.ys[li];
      ctx.save();
      ctx.globalAlpha = clamp(kin * 3) * (1 - kout);
      // Extrusion layers slide out to the side the word turns away from.
      const steps = 14;
      for (let k = steps; k >= 1; k--) {
        const f = k / steps;
        ctx.save();
        ctx.translate(word.x - sin * depth * f, y + depth * 0.25 * f);
        ctx.scale(Math.max(0.02, Math.abs(cos)), 1);
        ctx.fillStyle = mix(side, "#000000", f * 0.6);
        drawTracked(ctx, word.text, 0, 0, layout.tracking);
        ctx.restore();
      }
      // Face, lit by how squarely it faces camera.
      ctx.save();
      ctx.translate(word.x, y);
      ctx.scale(Math.max(0.02, Math.abs(cos)), 1);
      const lit = 0.55 + 0.45 * Math.abs(cos);
      const g = ctx.createLinearGradient(0, -layout.size / 2, 0, layout.size / 2);
      g.addColorStop(0, mix(palette.bg0, "#ffffff", lit));
      g.addColorStop(1, mix(palette.bg0, palette.primary, lit));
      ctx.fillStyle = g;
      drawTracked(ctx, word.text, 0, 0, layout.tracking);
      ctx.restore();
      // Floor reflection.
      ctx.save();
      ctx.globalAlpha *= 0.12;
      ctx.translate(word.x, floorY + (floorY - y) * 0.35);
      ctx.scale(Math.max(0.02, Math.abs(cos)), -0.6);
      ctx.fillStyle = palette.primary;
      drawTracked(ctx, word.text, 0, 0, layout.tracking);
      ctx.restore();
      ctx.restore();
      wi++;
    }
  });
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 44 * u, range(t, 0.9 + wi * sc.beat * 0.5, 1.5 + wi * sc.beat * 0.5), { alpha: 1 - exitT(sc, 0.4) });
}

export const signatureSkills: Skill[] = [
  {
    id: "god-rays",
    name: "God Rays",
    tagline: "Volumetric light shafts blaze through a silhouetted title until it ignites.",
    bestFor: "Epic reveals, faith, luxury, film titles, the main brand hit or outro. 1–2 words.",
    sample: { text: "ASCEND", subtext: "A new era begins" },
    render: godRays,
  },
  {
    id: "glass-shatter",
    name: "Glass Shatter",
    tagline: "Glass shards fly in, lock into your title with a glint, then explode apart.",
    bestFor: "Action, sports, gaming, breaking news, bold statements. 1–3 words.",
    sample: { text: "BREAKTHROUGH", subtext: "A new chapter" },
    render: glassShatter,
  },
  {
    id: "warp-tunnel",
    name: "Warp Tunnel",
    tagline: "A neon hex tunnel flythrough that fires the title out of the vanishing point.",
    bestFor: "Openers, sci-fi, music drops, gaming, tech launches. 1–2 words.",
    sample: { text: "ENTER", subtext: "The next dimension" },
    render: warpTunnel,
  },
  {
    id: "flip-3d",
    name: "3D Flip",
    tagline: "Solid extruded words spin in on the beat over a spotlit stage.",
    bestFor: "Brand names, product names, taglines of 1–4 words, modern and playful.",
    sample: { text: "LEVEL UP", subtext: "Now available" },
    render: flip3d,
  },
];
