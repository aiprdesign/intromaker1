import type { FontId } from "./types";

export const FONT_FAMILY: Record<FontId, { display: string; weight: number; tracking: number }> = {
  anton: { display: "Anton", weight: 400, tracking: 0.02 },
  grotesk: { display: "Space Grotesk", weight: 700, tracking: -0.02 },
  inter: { display: "Inter", weight: 800, tracking: -0.045 },
};

export const SUB_FONT = "Inter";

export function displayFont(font: FontId, size: number) {
  const f = FONT_FAMILY[font];
  return `${f.weight} ${Math.round(size)}px "${f.display}", Impact, sans-serif`;
}

export function subFont(size: number, weight = 500) {
  return `${weight} ${Math.round(size)}px "${SUB_FONT}", system-ui, sans-serif`;
}

/** Largest font size (<= maxSize) at which `text` fits within maxWidth. */
export function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: FontId,
  maxWidth: number,
  maxSize: number,
) {
  ctx.font = displayFont(font, 100);
  const w = measureTracked(ctx, text, 100 * FONT_FAMILY[font].tracking);
  if (w <= 0) return maxSize;
  return Math.min(maxSize, (100 * maxWidth) / w);
}

export function measureTracked(ctx: CanvasRenderingContext2D, text: string, tracking: number) {
  return ctx.measureText(text).width + tracking * Math.max(0, text.length - 1);
}

/** Split text into at most `maxLines` roughly balanced lines. */
export function balanceLines(text: string, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1 || maxLines <= 1) return [words.join(" ")];
  const n = Math.min(maxLines, words.length);
  const total = words.join(" ").length;
  const target = total / n;
  const lines: string[] = [];
  let cur: string[] = [];
  for (const w of words) {
    const next = [...cur, w].join(" ");
    if (cur.length && next.length > target * 1.15 && lines.length < n - 1) {
      lines.push(cur.join(" "));
      cur = [w];
    } else {
      cur.push(w);
    }
  }
  if (cur.length) lines.push(cur.join(" "));
  return lines;
}

/** Per-character layout of a single line centred at (cx, cy). */
export function layoutChars(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  tracking: number,
) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
  let x = cx - total / 2;
  return chars.map((c, i) => {
    const out = { char: c, x: x + widths[i] / 2, w: widths[i], i };
    x += widths[i] + tracking;
    return out;
  });
}

/** Draw a line of text with letter tracking, centred at (cx, cy). */
export function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  tracking: number,
  mode: "fill" | "stroke" = "fill",
) {
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "center";
  for (const ch of layoutChars(ctx, text, cx, tracking)) {
    if (mode === "fill") ctx.fillText(ch.char, ch.x, cy);
    else ctx.strokeText(ch.char, ch.x, cy);
  }
  ctx.textAlign = prevAlign;
}

export interface HeadlineLayout {
  lines: string[];
  size: number;
  lineHeight: number;
  /** Baseline-centre y for each line (textBaseline = "middle"). */
  ys: number[];
  tracking: number;
}

/** Fit a headline into a box, choosing line breaks and font size. */
export function layoutHeadline(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: FontId,
  opts: {
    w: number;
    h: number;
    cx: number;
    cy: number;
    maxWidth: number;
    maxSize: number;
    maxLines?: number;
    /** Keep the copy's own casing (modern SaaS sentence case) instead of ALL CAPS. */
    natural?: boolean;
  },
): HeadlineLayout {
  const upper = opts.natural ? text : text.toUpperCase();
  const portrait = opts.h > opts.w;
  const maxLines = opts.maxLines ?? (portrait ? 3 : upper.length > 16 ? 2 : 1);
  // Use the fewest lines that keep the type near its maximum size (avoids "There's / a / way").
  let lines = balanceLines(upper, 1);
  let size = 0;
  for (let n = 1; n <= maxLines; n++) {
    const candidate = balanceLines(upper, n);
    let s = opts.maxSize;
    for (const line of candidate) s = Math.min(s, fitSize(ctx, line, font, opts.maxWidth, opts.maxSize));
    if (s > size * 1.12 || n === 1) {
      lines = candidate;
      size = s;
    }
    if (s >= opts.maxSize * 0.97) break;
  }
  const lineHeight = size * (font === "anton" ? 1.05 : font === "inter" ? 1.08 : 1.0);
  const top = opts.cy - ((lines.length - 1) * lineHeight) / 2;
  return {
    lines,
    size,
    lineHeight,
    ys: lines.map((_, i) => top + i * lineHeight),
    tracking: size * FONT_FAMILY[font].tracking,
  };
}

const pointCache = new Map<string, { x: number; y: number }[]>();

/** Sample points inside rendered text, in canvas coordinates. Cached. */
export function textPoints(
  text: string,
  font: FontId,
  w: number,
  h: number,
  maxPoints: number,
): { x: number; y: number }[] {
  const key = `${text}|${font}|${w}|${h}|${maxPoints}`;
  const hit = pointCache.get(key);
  if (hit) return hit;
  const scale = 0.25;
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const off = document.createElement("canvas");
  off.width = cw;
  off.height = ch;
  const o = off.getContext("2d", { willReadFrequently: true })!;
  const layout = layoutHeadline(o, text, font, {
    w: cw,
    h: ch,
    cx: cw / 2,
    cy: ch / 2,
    maxWidth: cw * 0.84,
    maxSize: Math.min(cw, ch) * 0.34,
  });
  o.fillStyle = "#fff";
  o.textBaseline = "middle";
  o.font = displayFont(font, layout.size);
  layout.lines.forEach((line, i) => drawTracked(o, line, cw / 2, layout.ys[i], layout.tracking));
  const data = o.getImageData(0, 0, cw, ch).data;
  const pts: { x: number; y: number }[] = [];
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (data[(y * cw + x) * 4 + 3] > 128) pts.push({ x: x / scale, y: y / scale });
    }
  }
  // Deterministic thinning to maxPoints.
  const out: { x: number; y: number }[] = [];
  const stride = Math.max(1, pts.length / maxPoints);
  for (let i = 0; i < pts.length && out.length < maxPoints; i += stride) out.push(pts[Math.floor(i)]);
  if (pointCache.size > 64) pointCache.clear();
  pointCache.set(key, out);
  return out;
}
