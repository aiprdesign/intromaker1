/**
 * Animated geometric shapes behind SaaS slides: rings, triangles, rounded squares, hexagons, plus
 * signs, dot grids, arcs and zigzags floating around the edges of the frame, in the palette's
 * colours. They drift and turn slowly on the film's own clock (so they carry on across cuts instead
 * of jumping), sit at different depths (near ones bigger, brighter and drifting further), breathe
 * gently and swell a touch on each kick of the score. Kept in the outer band of the frame, faint,
 * and never flashing. Switched on per film (VideoPlan.shapes), on by default for SaaS videos.
 */
import { clamp, noise1, rgba, rng, TAU } from "./math";
import type { SkillContext } from "./types";

type Kind = "ring" | "triangle" | "square" | "plus" | "dots" | "arc" | "hex" | "zigzag" | "disc";
const KINDS: Kind[] = ["ring", "triangle", "plus", "square", "dots", "hex", "arc", "zigzag", "disc"];

export function geoShapes(sc: SkillContext) {
  const seed = sc.shapes;
  if (seed === undefined) return;
  const { ctx, w, h, u, palette, music } = sc;
  const T = sc.globalT ?? sc.t;
  const light = !!palette.light;
  const r = rng((seed ^ 0x6e05) >>> 0);
  const cols = [palette.primary, palette.secondary, palette.accent];
  const kick = music && Number.isFinite(music.kick) ? Math.exp(-music.kick * 10) * music.energy : 0;
  const portrait = h > w;
  const n = portrait ? 9 : 11;
  const start = r() * KINDS.length;
  const fadeIn = clamp(T / 0.8);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < n; i++) {
    const kind = KINDS[Math.floor(start + i * 1.618 * 3) % KINDS.length];
    const a = (i / n) * TAU + (r() - 0.5) * 0.5;
    const band = 0.36 + r() * 0.12;
    const depth = r();
    const size = (30 + depth * 70 + r() * 24) * u;
    const spin = (r() - 0.5) * 0.6;
    const phase = r() * 100;
    const col = cols[Math.floor(r() * cols.length)];
    const filled = r() < 0.3;
    // A slow wander around its spot; nearer shapes wander further (parallax).
    const reach = (30 + depth * 60) * u;
    const x = w * (0.5 + Math.cos(a) * band * (portrait ? 0.95 : 1.05)) + noise1(T * 0.07 + phase) * reach;
    const y = h * (0.5 + Math.sin(a) * band * (portrait ? 1 : 0.95)) + noise1(T * 0.06 + phase + 31) * reach;
    const s = size * (1 + kick * 0.07 * (0.5 + depth)) * (0.96 + 0.04 * Math.sin(T * 0.9 + phase));
    const alpha = (light ? 0.4 : 0.32) * (0.55 + 0.45 * depth) * (0.85 + 0.15 * Math.sin(T * 0.7 + phase)) * fadeIn;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(phase + T * spin);
    ctx.strokeStyle = rgba(col, alpha);
    ctx.fillStyle = rgba(col, alpha * (filled ? 0.45 : 1));
    ctx.lineWidth = (1.4 + depth * 1.4) * u;
    draw(ctx, kind, s, filled, u);
    ctx.restore();
  }
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, kind: Kind, s: number, filled: boolean, u: number) {
  const half = s / 2;
  ctx.beginPath();
  switch (kind) {
    case "ring":
      ctx.arc(0, 0, half, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.55, 0, TAU);
      ctx.globalAlpha *= 0.6;
      ctx.stroke();
      return;
    case "disc": {
      ctx.arc(0, 0, half * 0.7, 0, TAU);
      ctx.globalAlpha *= 0.5;
      ctx.fill();
      return;
    }
    case "triangle":
      for (let k = 0; k < 3; k++) {
        const t = -Math.PI / 2 + (k * TAU) / 3;
        if (k) ctx.lineTo(Math.cos(t) * half, Math.sin(t) * half);
        else ctx.moveTo(Math.cos(t) * half, Math.sin(t) * half);
      }
      ctx.closePath();
      break;
    case "hex":
      for (let k = 0; k < 6; k++) {
        const t = (k * TAU) / 6;
        if (k) ctx.lineTo(Math.cos(t) * half, Math.sin(t) * half);
        else ctx.moveTo(Math.cos(t) * half, Math.sin(t) * half);
      }
      ctx.closePath();
      break;
    case "square":
      ctx.roundRect(-half * 0.8, -half * 0.8, half * 1.6, half * 1.6, half * 0.25);
      break;
    case "plus":
      ctx.lineWidth *= 1.6;
      ctx.moveTo(-half * 0.5, 0);
      ctx.lineTo(half * 0.5, 0);
      ctx.moveTo(0, -half * 0.5);
      ctx.lineTo(0, half * 0.5);
      ctx.stroke();
      return;
    case "dots":
      for (let gx = -1; gx <= 1; gx++)
        for (let gy = -1; gy <= 1; gy++) {
          ctx.moveTo(gx * half * 0.6 + 2 * u, gy * half * 0.6);
          ctx.arc(gx * half * 0.6, gy * half * 0.6, 2 * u, 0, TAU);
        }
      ctx.fill();
      return;
    case "arc":
      ctx.lineWidth *= 2.2;
      ctx.arc(0, 0, half * 0.8, 0, Math.PI);
      ctx.stroke();
      return;
    case "zigzag":
      for (let k = 0; k <= 5; k++) {
        const px = -half + (k / 5) * s;
        const py = k % 2 ? -half * 0.22 : half * 0.22;
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
      return;
  }
  if (filled) ctx.fill();
  else ctx.stroke();
}
