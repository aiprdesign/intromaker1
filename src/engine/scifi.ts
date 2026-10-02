import { mixHex, rgba, rng, TAU } from "./math";
import type { SkillContext } from "./types";

/**
 * Sci-fi stages behind the content (the Sci-Fi templates' backdrops): light-speed warp streaks, a
 * ringed planet on the horizon, a wormhole tunnel, falling data glyphs and a rotating quantum mesh.
 * Each is drawn from the film's palette and keeps moving on the film's clock (globalT), so it
 * flows across cuts. They sit behind the slides, so they stay dim around the middle of the frame
 * where the headline goes.
 */

type Op = GlobalCompositeOperation;
const time = (sc: SkillContext) => sc.globalT ?? sc.t;

/** Light-speed: streaks of starlight rushing out of a bright vanishing point. */
export function warpStage(sc: SkillContext, glowOp: Op) {
  const { ctx, w, h, u, palette, seed } = sc;
  const T = time(sc);
  const cx = w / 2;
  const cy = h * 0.46;
  const R = Math.hypot(w, h) * 0.62;
  const r = rng(seed + 911);
  ctx.save();
  ctx.globalCompositeOperation = glowOp;
  // The tunnel's heart: a cold glow where the stars come from.
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.55);
  core.addColorStop(0, rgba(palette.primary, 0.26));
  core.addColorStop(0.35, rgba(palette.secondary, 0.08));
  core.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = "round";
  for (let i = 0; i < 240; i++) {
    const a = r() * TAU;
    const speed = 0.16 + r() * 0.22;
    const z = (T * speed + r()) % 1;
    const e = z * z * z; // stars accelerate as they pass the camera
    const d0 = R * (0.025 + e * 0.95);
    const len = R * (0.015 + e * 0.32);
    const x0 = cx + Math.cos(a) * d0;
    const y0 = cy + Math.sin(a) * d0;
    const x1 = cx + Math.cos(a) * (d0 + len);
    const y1 = cy + Math.sin(a) * (d0 + len);
    const c = i % 5 === 0 ? palette.secondary : i % 3 === 0 ? palette.primary : palette.text;
    const alpha = Math.min(1, z * 1.8) * 0.9;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgba(c, 0));
    g.addColorStop(1, rgba(c, alpha));
    ctx.strokeStyle = g;
    ctx.lineWidth = (0.5 + e * 2.6) * u;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();
  calmCentre(sc, 0.35);
}

/** A ringed planet rising at the foot of the frame, its atmosphere lit, a moon on its orbit. */
export function planetStage(sc: SkillContext, glowOp: Op) {
  const { ctx, w, h, u, palette, seed } = sc;
  const T = time(sc);
  const portrait = h > w;
  const pr = Math.max(w, h) * (portrait ? 0.62 : 0.5);
  const px = w * (portrait ? 0.5 : 0.7);
  const py = h + pr * (portrait ? 0.48 : 0.42);
  // Distant stars.
  const r = rng(seed + 313);
  ctx.save();
  ctx.globalCompositeOperation = glowOp;
  for (let i = 0; i < 110; i++) {
    const x = r() * w;
    const y = r() * h;
    const tw = 0.5 + 0.5 * Math.sin(T * (0.6 + r() * 1.6) + i);
    ctx.fillStyle = rgba(i % 9 === 0 ? palette.secondary : palette.text, 0.45 * tw);
    const s = (0.7 + r() * 1.3) * u;
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
  // Ring geometry (tilted ellipse around the planet).
  const tilt = -0.18;
  const rx = pr * 1.75;
  const ry = pr * 0.32;
  const ring = (back: boolean) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(tilt);
    ctx.beginPath();
    // Back half above the planet's centre line, front half below.
    if (back) ctx.rect(-rx * 1.1, -ry * 1.2, rx * 2.2, ry * 1.2);
    else ctx.rect(-rx * 1.1, 0, rx * 2.2, ry * 1.2);
    ctx.clip();
    for (let k = 0; k < 7; k++) {
      const f = 1 - k * 0.055;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * f, ry * f, 0, 0, TAU);
      ctx.strokeStyle = rgba(k % 3 === 1 ? palette.secondary : mixHex(palette.primary, palette.text, 0.35), (back ? 0.22 : 0.42) * (1 - k * 0.09));
      ctx.lineWidth = (k % 3 === 0 ? 5 : 2) * u;
      ctx.stroke();
    }
    ctx.restore();
  };
  ring(true);
  // The planet: lit from the upper left, slowly turning bands, a bright limb.
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, TAU);
  const body = ctx.createRadialGradient(px - pr * 0.45, py - pr * 0.55, pr * 0.1, px, py, pr * 1.05);
  body.addColorStop(0, mixHex(palette.bg1, palette.primary, 0.32));
  body.addColorStop(0.55, mixHex(palette.bg0, palette.bg1, 0.6));
  body.addColorStop(1, palette.bg0);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.clip();
  const spin = (T * 6 * u) % (pr * 0.25);
  for (let b = -8; b <= 8; b++) {
    const y = py - pr + ((b + 8) / 16) * pr * 2 + Math.sin(b * 1.7) * pr * 0.02;
    ctx.fillStyle = rgba(b % 2 ? palette.secondary : palette.primary, 0.05 + 0.03 * Math.sin(b * 2.3));
    ctx.fillRect(px - pr + spin * (b % 2 ? 1 : -1), y, pr * 2, pr * (0.03 + 0.03 * Math.abs(Math.sin(b * 1.3))));
  }
  // Night side.
  const night = ctx.createLinearGradient(px - pr * 0.6, py - pr * 0.6, px + pr * 0.7, py + pr * 0.4);
  night.addColorStop(0, "rgba(0,0,0,0)");
  night.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = night;
  ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  ctx.restore();
  // Atmosphere: a lit rim, brightest towards the light.
  ctx.save();
  ctx.globalCompositeOperation = glowOp;
  const rim = ctx.createRadialGradient(px, py, pr * 0.97, px, py, pr * 1.12);
  rim.addColorStop(0, rgba(palette.primary, 0));
  rim.addColorStop(0.25, rgba(palette.primary, 0.55));
  rim.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(px, py, pr * 1.12, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2 * u;
  ctx.strokeStyle = rgba(mixHex(palette.primary, "#ffffff", 0.5), 0.8);
  ctx.beginPath();
  ctx.arc(px, py, pr, Math.PI * 1.08, Math.PI * 1.62);
  ctx.stroke();
  ctx.restore();
  ring(false);
  // A moon on a slow orbit.
  const ma = T * 0.12 + 2.2;
  const mx = px + Math.cos(ma) * pr * 1.45;
  const my = py - pr * 0.95 + Math.sin(ma) * pr * 0.25;
  const mr = pr * 0.06;
  if (my < h) {
    ctx.save();
    const moon = ctx.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, mr * 0.1, mx, my, mr);
    moon.addColorStop(0, mixHex(palette.text, palette.primary, 0.3));
    moon.addColorStop(1, mixHex(palette.bg1, palette.bg0, 0.4));
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/** A tunnel of light rings rushing towards the camera, gently twisting. */
export function wormholeStage(sc: SkillContext, glowOp: Op) {
  const { ctx, w, h, u, palette } = sc;
  const T = time(sc);
  const cx = w / 2 + Math.sin(T * 0.21) * w * 0.04;
  const cy = h * 0.46 + Math.cos(T * 0.17) * h * 0.04;
  const R = Math.hypot(w, h) * 0.55;
  ctx.save();
  // The throat: darker at the centre, lit around it.
  const throat = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  throat.addColorStop(0, rgba(palette.secondary, 0.25));
  throat.addColorStop(0.08, rgba(palette.bg0, 0.6));
  throat.addColorStop(0.5, rgba(palette.primary, 0.08));
  throat.addColorStop(1, rgba(palette.bg0, 0));
  ctx.fillStyle = throat;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = glowOp;
  const N = 26;
  const flow = (T * 0.55) % 1;
  for (let i = N; i >= 1; i--) {
    const z = i - flow;
    const rr = R / (z * 0.42 + 0.35);
    if (rr > R * 2.2) continue;
    const near = 1 - z / N;
    const c = i % 2 ? palette.primary : palette.secondary;
    ctx.strokeStyle = rgba(c, 0.08 + near * 0.5);
    ctx.lineWidth = Math.max(1, near * near * 7 * u);
    // Each ring is a set of light segments, turned a little more the deeper it sits.
    const segs = 18;
    const rot = T * 0.25 + z * 0.22;
    for (let s = 0; s < segs; s++) {
      const a0 = rot + (s / segs) * TAU;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr, rr * 0.92, 0, a0, a0 + (TAU / segs) * 0.62);
      ctx.stroke();
    }
  }
  ctx.restore();
  calmCentre(sc, 0.3);
}

const GLYPHS = "0123456789ABCDEFXZ#$%&<>/\\=+*";

/** Data rain: columns of glyphs falling, a bright head on each trail. */
export function rainStage(sc: SkillContext, _glowOp: Op) {
  const { ctx, w, h, u, palette, seed } = sc;
  const T = time(sc);
  const size = Math.max(9, 17 * u);
  const colW = size * 1.45;
  const cols = Math.ceil(w / colW) + 1;
  const r = rng(seed + 1717);
  ctx.save();
  ctx.font = `600 ${size.toFixed(1)}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const trail = 14;
  for (let c = 0; c < cols; c++) {
    const speed = (5 + r() * 9) * size; // px per second
    const offset = r() * h * 2;
    const depth = 0.35 + r() * 0.65;
    const x = c * colW + colW / 2;
    const head = ((T * speed * depth + offset) % (h + trail * size * 1.2)) - size;
    for (let k = 0; k < trail; k++) {
      const y = head - k * size * 1.12;
      if (y < -size || y > h + size) continue;
      // Glyphs flicker as the stream runs through them.
      const gi = (Math.floor(T * 9 + c * 7 + k * 3 + Math.floor(y / size)) * 2654435761) >>> 0;
      const fade = 1 - k / trail;
      if (k === 0) {
        ctx.fillStyle = rgba(mixHex(palette.primary, "#ffffff", 0.6), 0.9 * depth);
        ctx.shadowColor = palette.primary;
        ctx.shadowBlur = 8 * u;
      } else {
        ctx.fillStyle = rgba(palette.primary, 0.55 * fade * fade * depth);
        ctx.shadowBlur = 0;
      }
      ctx.fillText(GLYPHS[gi % GLYPHS.length], x, y);
    }
  }
  ctx.restore();
  calmCentre(sc, 0.55);
}

/** Quantum mesh: a slowly turning cloud of nodes, linked to their neighbours by light. */
export function plexusStage(sc: SkillContext, glowOp: Op) {
  const { ctx, w, h, u, palette, seed } = sc;
  const T = time(sc);
  const r = rng(seed + 5151);
  const N = 64;
  const pts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < N; i++) {
    // Points spread through a flattened sphere.
    const a = r() * TAU;
    const b = Math.acos(2 * r() - 1);
    const rad = 0.55 + r() * 0.45;
    pts.push({ x: Math.sin(b) * Math.cos(a) * rad * 1.6, y: Math.cos(b) * rad * 0.9, z: Math.sin(b) * Math.sin(a) * rad });
  }
  const yaw = T * 0.12;
  const pitch = Math.sin(T * 0.07) * 0.25;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const S = Math.min(w, h) * 0.55;
  const proj = pts.map((p) => {
    const x = p.x * cy + p.z * sy;
    const z0 = -p.x * sy + p.z * cy;
    const y = p.y * cp - z0 * sp;
    const z = p.y * sp + z0 * cp;
    const k = 2.4 / (2.4 + z);
    return { X: w / 2 + x * S * k, Y: h * 0.47 + y * S * k, k, x, y, z };
  });
  ctx.save();
  ctx.globalCompositeOperation = glowOp;
  ctx.lineWidth = Math.max(1, 1.1 * u);
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const a = proj[i];
      const b = proj[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d > 0.62) continue;
      const near = (a.k + b.k) / 2;
      ctx.strokeStyle = rgba((i + j) % 3 ? palette.primary : palette.secondary, (1 - d / 0.62) * 0.4 * near * near);
      ctx.beginPath();
      ctx.moveTo(a.X, a.Y);
      ctx.lineTo(b.X, b.Y);
      ctx.stroke();
    }
  }
  for (let i = 0; i < N; i++) {
    const p = proj[i];
    const pulse = 0.6 + 0.4 * Math.sin(T * 2 + i * 1.3);
    const rad = (1.4 + p.k * 2.2) * u;
    const g = ctx.createRadialGradient(p.X, p.Y, 0, p.X, p.Y, rad * 4);
    g.addColorStop(0, rgba(i % 4 ? palette.primary : palette.text, 0.75 * pulse * p.k));
    g.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = g;
    ctx.fillRect(p.X - rad * 4, p.Y - rad * 4, rad * 8, rad * 8);
  }
  ctx.restore();
  calmCentre(sc, 0.3);
}

/** Dim the middle of the frame a touch, where the headline and cards sit. */
function calmCentre(sc: SkillContext, amount: number) {
  const { ctx, w, h, palette } = sc;
  const g = ctx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, Math.min(w, h) * 0.55);
  g.addColorStop(0, rgba(palette.bg0, amount));
  g.addColorStop(1, rgba(palette.bg0, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
