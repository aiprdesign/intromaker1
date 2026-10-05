/**
 * Animated background behind SaaS slides, in one of several sets (VideoPlan.shapeSet):
 *
 * - geometric: rings, triangles, rounded squares, hexagons, plus signs, dot grids, arcs, zigzags.
 * - soft:      blobs, pills, half discs, squiggles, bubbles and soft dots.
 * - tech:      code brackets, braces, chevrons, a cursor, linked nodes, a prompt and a hash.
 * - sparkle:   four-point sparkles, stars, twinkles, small rings and plus signs.
 * - lines:     waves, concentric arcs, parallel strokes, dashed rings and spirals.
 * - text:      watermark text: the brand's name (or any line) in big outlined rows drifting across
 *              the frame, alternate rows in opposite directions.
 *
 * Shapes float around the edges of the frame in the palette's colours. They drift and turn slowly
 * on the film's own clock (so they carry on across cuts instead of jumping), sit at different
 * depths (near ones bigger, brighter and drifting further), breathe gently and swell a touch on
 * each kick of the score. Faint, kept in the outer band of the frame, and never flashing. On by
 * default for SaaS videos (VideoPlan.shapes = false turns them off).
 */
import { clamp, noise1, rgba, rng, TAU } from "./math";
import { subFont } from "./text";
import { SHAPE_SETS, type ShapeSet, type SkillContext } from "./types";

type Kind =
  | "ring" | "triangle" | "square" | "plus" | "dots" | "arc" | "hex" | "zigzag" | "disc"
  | "blob" | "pill" | "half" | "squiggle" | "bubble"
  | "code" | "braces" | "chevron" | "cursor" | "nodes" | "prompt" | "hash"
  | "sparkle" | "star" | "twinkle"
  | "wave" | "arcs" | "strokes" | "dashed" | "spiral";

const SETS: Record<Exclude<ShapeSet, "text">, Kind[]> = {
  geometric: ["ring", "triangle", "plus", "square", "dots", "hex", "arc", "zigzag", "disc"],
  soft: ["blob", "pill", "half", "squiggle", "bubble", "disc", "blob", "pill"],
  tech: ["code", "braces", "chevron", "cursor", "nodes", "prompt", "hash", "dots"],
  sparkle: ["sparkle", "star", "twinkle", "ring", "plus", "sparkle", "disc"],
  lines: ["wave", "arcs", "strokes", "dashed", "spiral", "wave", "zigzag"],
};

/** Names and one-liners for the studio. */
export const SHAPE_SET_INFO: Record<ShapeSet, { name: string; note: string }> = {
  geometric: { name: "Geometric", note: "Rings, triangles, hexagons, dot grids" },
  soft: { name: "Soft", note: "Blobs, pills, bubbles, squiggles" },
  tech: { name: "Tech", note: "Code brackets, chevrons, nodes, a cursor" },
  sparkle: { name: "Sparkles", note: "Sparkles, stars and twinkles" },
  lines: { name: "Lines", note: "Waves, arcs, dashed rings, spirals" },
  text: { name: "Watermark text", note: "Your name in big rows drifting by" },
};

export function geoShapes(sc: SkillContext) {
  const seed = sc.shapes;
  if (seed === undefined) return;
  const set: ShapeSet = sc.shapeSet && (SHAPE_SETS as readonly string[]).includes(sc.shapeSet) ? sc.shapeSet : "geometric";
  if (set === "text") return watermark(sc);
  const kinds = SETS[set];
  const { ctx, w, h, u, palette, music } = sc;
  const T = sc.globalT ?? sc.t;
  const light = !!palette.light;
  const r = rng((seed ^ 0x6e05) >>> 0);
  const cols = [palette.primary, palette.secondary, palette.accent];
  const kick = music && Number.isFinite(music.kick) ? Math.exp(-music.kick * 10) * music.energy : 0;
  const portrait = h > w;
  const n = portrait ? 9 : 11;
  const start = r() * kinds.length;
  const fadeIn = clamp(T / 0.8);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < n; i++) {
    const kind = kinds[Math.floor(start + i * 1.618 * 3) % kinds.length];
    const a = (i / n) * TAU + (r() - 0.5) * 0.5;
    const band = 0.36 + r() * 0.12;
    const depth = r();
    const size = (30 + depth * 70 + r() * 24) * u;
    const spin = (r() - 0.5) * 0.6;
    const phase = r() * 100;
    const col = cols[Math.floor(r() * cols.length)];
    const filled = r() < 0.3;
    // Symbols that read upright (code, cursor, prompt) only sway; the rest turn.
    const upright = kind === "code" || kind === "braces" || kind === "cursor" || kind === "prompt" || kind === "hash" || kind === "chevron";
    // A slow wander around its spot; nearer shapes wander further (parallax).
    const reach = (30 + depth * 60) * u;
    const x = w * (0.5 + Math.cos(a) * band * (portrait ? 0.95 : 1.05)) + noise1(T * 0.07 + phase) * reach;
    const y = h * (0.5 + Math.sin(a) * band * (portrait ? 1 : 0.95)) + noise1(T * 0.06 + phase + 31) * reach;
    const s = size * (1 + kick * 0.07 * (0.5 + depth)) * (0.96 + 0.04 * Math.sin(T * 0.9 + phase));
    const alpha = (light ? 0.4 : 0.32) * (0.55 + 0.45 * depth) * (0.85 + 0.15 * Math.sin(T * 0.7 + phase)) * fadeIn;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(upright ? Math.sin(T * 0.5 + phase) * 0.12 : phase + T * spin);
    ctx.strokeStyle = rgba(col, alpha);
    ctx.fillStyle = rgba(col, alpha * (filled ? 0.45 : 1));
    ctx.lineWidth = (1.4 + depth * 1.4) * u;
    draw(ctx, kind, s, filled, u, T + phase);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Watermark text: the line (default: the brand's name) repeated in big outlined rows across a
 * slightly tilted frame, rows drifting in opposite directions on the film's clock. Very faint, so
 * it reads as texture behind the slide, never as copy.
 */
function watermark(sc: SkillContext) {
  const { ctx, w, h, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  // (The renderer has already chosen the words: the typed text, else the site's or product's name,
  // else the title or main heading.)
  const text = ((sc.watermark ?? "").trim() || sc.brand?.name?.trim() || "Your brand").toUpperCase().slice(0, 40);
  const light = !!palette.light;
  // Small, widely tracked caps in level rows: a fine pattern, like a brand's printed tissue paper.
  const size = Math.max(9, Math.min(w, h) * 0.022);
  const fadeIn = clamp(T / 0.8);
  ctx.save();
  ctx.font = subFont(size, 650);
  ctx.letterSpacing = `${Math.round(size * 0.32)}px`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const unit = `${text}      `;
  const uw = Math.max(1, ctx.measureText(unit).width);
  const gap = size * 3.4;
  const rows = Math.ceil(h / gap) + 1;
  const a = (light ? 0.1 : 0.075) * fadeIn;
  ctx.fillStyle = rgba(light ? palette.primary : palette.text, a);
  for (let i = 0; i < rows; i++) {
    const y = (i + 0.5) * gap - ((rows * gap - h) / 2);
    // Rows drift slowly in alternate directions, offset like brickwork.
    const dir = i % 2 ? -1 : 1;
    const off = (((T * 9 * u * dir + (i % 2) * uw * 0.5) % uw) + uw) % uw;
    for (let x = -uw + off; x < w; x += uw) ctx.fillText(unit, x, y);
  }
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, n: number, r: number, inner?: number, rot = -Math.PI / 2) {
  const steps = inner ? n * 2 : n;
  for (let k = 0; k < steps; k++) {
    const t = rot + (k * TAU) / steps;
    const rr = inner && k % 2 ? inner : r;
    if (k) ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr);
    else ctx.moveTo(Math.cos(t) * rr, Math.sin(t) * rr);
  }
  ctx.closePath();
}

function draw(ctx: CanvasRenderingContext2D, kind: Kind, s: number, filled: boolean, u: number, t: number) {
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
    case "disc":
      ctx.arc(0, 0, half * 0.7, 0, TAU);
      ctx.globalAlpha *= 0.5;
      ctx.fill();
      return;
    case "triangle":
      poly(ctx, 3, half);
      break;
    case "hex":
      poly(ctx, 6, half, undefined, 0);
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
    // Soft
    case "blob": {
      // A wobbly round shape that slowly changes.
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * TAU;
        const rr = half * (0.75 + 0.12 * Math.sin(a * 3 + t * 0.6) + 0.08 * Math.sin(a * 2 - t * 0.4));
        if (k) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.globalAlpha *= 0.55;
      ctx.fill();
      return;
    }
    case "pill":
      ctx.roundRect(-half, -half * 0.32, s, half * 0.64, half * 0.32);
      break;
    case "half":
      ctx.arc(0, 0, half * 0.75, Math.PI, TAU);
      ctx.closePath();
      ctx.globalAlpha *= 0.6;
      ctx.fill();
      return;
    case "squiggle":
      ctx.lineWidth *= 1.8;
      ctx.moveTo(-half, 0);
      for (let k = 1; k <= 4; k++) ctx.quadraticCurveTo(-half + (k - 0.5) * (s / 4), k % 2 ? -half * 0.35 : half * 0.35, -half + k * (s / 4), 0);
      ctx.stroke();
      return;
    case "bubble":
      ctx.arc(0, 0, half * 0.8, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-half * 0.3, -half * 0.3, half * 0.14, 0, TAU);
      ctx.fill();
      return;
    // Tech
    case "code":
      ctx.lineWidth *= 1.5;
      ctx.moveTo(-half * 0.35, -half * 0.45);
      ctx.lineTo(-half * 0.8, 0);
      ctx.lineTo(-half * 0.35, half * 0.45);
      ctx.moveTo(half * 0.35, -half * 0.45);
      ctx.lineTo(half * 0.8, 0);
      ctx.lineTo(half * 0.35, half * 0.45);
      ctx.moveTo(half * 0.15, -half * 0.55);
      ctx.lineTo(-half * 0.15, half * 0.55);
      ctx.stroke();
      return;
    case "braces":
      ctx.lineWidth *= 1.4;
      for (const sgn of [-1, 1]) {
        const x0 = sgn * half * 0.55;
        ctx.moveTo(x0, -half * 0.6);
        ctx.quadraticCurveTo(x0 - sgn * half * 0.25, -half * 0.6, x0 - sgn * half * 0.25, -half * 0.3);
        ctx.quadraticCurveTo(x0 - sgn * half * 0.25, 0, x0 - sgn * half * 0.45, 0);
        ctx.quadraticCurveTo(x0 - sgn * half * 0.25, 0, x0 - sgn * half * 0.25, half * 0.3);
        ctx.quadraticCurveTo(x0 - sgn * half * 0.25, half * 0.6, x0, half * 0.6);
      }
      ctx.stroke();
      return;
    case "chevron":
      ctx.lineWidth *= 1.8;
      ctx.moveTo(-half * 0.3, -half * 0.5);
      ctx.lineTo(half * 0.25, 0);
      ctx.lineTo(-half * 0.3, half * 0.5);
      ctx.stroke();
      return;
    case "cursor":
      ctx.moveTo(-half * 0.4, -half * 0.6);
      ctx.lineTo(half * 0.45, half * 0.15);
      ctx.lineTo(half * 0.05, half * 0.2);
      ctx.lineTo(-half * 0.15, half * 0.65);
      ctx.lineTo(-half * 0.32, half * 0.58);
      ctx.lineTo(-half * 0.12, half * 0.14);
      ctx.lineTo(-half * 0.4, half * 0.3);
      ctx.closePath();
      break;
    case "nodes": {
      const pts = [
        [-half * 0.6, half * 0.35],
        [0, -half * 0.5],
        [half * 0.6, half * 0.3],
      ];
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.stroke();
      ctx.beginPath();
      for (const [px, py] of pts) {
        ctx.moveTo(px + half * 0.16, py);
        ctx.arc(px, py, half * 0.16, 0, TAU);
      }
      ctx.fill();
      return;
    }
    case "prompt":
      ctx.lineWidth *= 1.6;
      ctx.moveTo(-half * 0.7, -half * 0.35);
      ctx.lineTo(-half * 0.3, 0);
      ctx.lineTo(-half * 0.7, half * 0.35);
      // The caret blinks slowly (no sudden flash: it fades).
      ctx.stroke();
      ctx.beginPath();
      ctx.globalAlpha *= 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.4));
      ctx.moveTo(-half * 0.05, half * 0.38);
      ctx.lineTo(half * 0.7, half * 0.38);
      ctx.stroke();
      return;
    case "hash":
      ctx.lineWidth *= 1.4;
      for (const k of [-1, 1]) {
        ctx.moveTo(k * half * 0.22 + half * 0.08, -half * 0.6);
        ctx.lineTo(k * half * 0.22 - half * 0.08, half * 0.6);
        ctx.moveTo(-half * 0.6, k * half * 0.22);
        ctx.lineTo(half * 0.6, k * half * 0.22);
      }
      ctx.stroke();
      return;
    // Sparkle
    case "sparkle": {
      const k = 0.75 + 0.25 * Math.sin(t * 1.3);
      poly(ctx, 4, half * k, half * 0.18 * k);
      ctx.fill();
      return;
    }
    case "star":
      poly(ctx, 5, half * 0.8, half * 0.36);
      break;
    case "twinkle":
      ctx.lineWidth *= 1.2;
      for (let k = 0; k < 4; k++) {
        const a = (k * TAU) / 8 + Math.PI / 8;
        ctx.moveTo(Math.cos(a) * half * 0.15, Math.sin(a) * half * 0.15);
        ctx.lineTo(Math.cos(a) * half * (k % 2 ? 0.45 : 0.75), Math.sin(a) * half * (k % 2 ? 0.45 : 0.75));
        ctx.moveTo(-Math.cos(a) * half * 0.15, -Math.sin(a) * half * 0.15);
        ctx.lineTo(-Math.cos(a) * half * (k % 2 ? 0.45 : 0.75), -Math.sin(a) * half * (k % 2 ? 0.45 : 0.75));
      }
      ctx.stroke();
      return;
    // Lines
    case "wave":
      ctx.lineWidth *= 1.5;
      for (let k = 0; k <= 30; k++) {
        const px = -half * 1.2 + (k / 30) * s * 1.2;
        const py = Math.sin(k * 0.6 + t * 1.2) * half * 0.25;
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
      return;
    case "arcs":
      for (let k = 1; k <= 3; k++) {
        ctx.moveTo(half * 0.3 * k, 0);
        ctx.arc(0, 0, half * 0.3 * k, 0, Math.PI * 0.75);
      }
      ctx.stroke();
      return;
    case "strokes":
      ctx.lineWidth *= 1.6;
      for (let k = -1; k <= 1; k++) {
        ctx.moveTo(-half * 0.6, k * half * 0.3);
        ctx.lineTo(half * (0.6 - Math.abs(k) * 0.2), k * half * 0.3);
      }
      ctx.stroke();
      return;
    case "dashed":
      ctx.setLineDash([4 * u, 5 * u]);
      ctx.arc(0, 0, half * 0.85, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    case "spiral":
      for (let k = 0; k <= 60; k++) {
        const a = (k / 60) * TAU * 2.2;
        const rr = (k / 60) * half * 0.9;
        if (k) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.moveTo(0, 0);
      }
      ctx.stroke();
      return;
  }
  if (filled) ctx.fill();
  else ctx.stroke();
}
