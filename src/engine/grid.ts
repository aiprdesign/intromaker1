/**
 * IntroMaker's design system: one spacing grid, safe areas, layout columns, a type scale and a
 * radius scale that every scene lays out on, so spacing and alignment are consistent across
 * skills and formats.
 *
 * - Spacing: an 8-point grid (4-point half steps) in frame units: 8pt at 1080px on the short side,
 *   scaled for 720p / 4K and every aspect.
 * - Safe areas: broadcast title-safe margins (5% landscape; 6% sides and a taller bottom in
 *   vertical, where platform UI and captions sit). Headlines, labels and captions stay inside.
 * - Columns: 12 in landscape and square, 4 in vertical, with grid gutters.
 * - Type scale: a 1.25 (major third) modular scale from caption to display.
 * - Snapping: rectangles and baselines land on whole pixels in design space; 1px lines sit on
 *   pixel centres. (The cinematic camera then scales the finished frame as a whole, like a real
 *   lens, so relative spacing stays exact.)
 */

/** Points per grid step at 1080px on the short side. */
export const GRID = 8;

export interface Tokens {
  /** Frame unit: 1 at 1080px on the short side. */
  u: number;
  /** n grid steps in pixels (n may be 0.5 for a 4pt half step). */
  space: (n: number) => number;
  /** Title-safe area. */
  safe: { x: number; top: number; bottom: number; left: number; right: number; width: number; height: number };
  columns: number;
  gutter: number;
  /** Left edge of column i (0-based) and the width of n columns. */
  col: (i: number) => number;
  span: (n: number) => number;
  /** Type sizes in pixels. */
  type: { caption: number; small: number; body: number; lead: number; h4: number; h3: number; h2: number; h1: number; display: number };
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
}

export function tokens(w: number, h: number): Tokens {
  const u = Math.min(w, h) / 1080;
  const portrait = h > w;
  const unit = GRID * u;
  const space = (n: number) => Math.round(n * unit);
  const x = Math.round(w * (portrait ? 0.06 : 0.05));
  const top = Math.round(h * (portrait ? 0.06 : 0.065));
  const bottom = Math.round(h * (portrait ? 0.1 : 0.065));
  const safe = { x, top, bottom, left: x, right: w - x, width: w - x * 2, height: h - top - bottom };
  const columns = portrait ? 4 : 12;
  const gutter = space(portrait ? 2 : 3);
  const colW = (safe.width - gutter * (columns - 1)) / columns;
  // Type: a 1.25 modular scale around a 20pt body.
  const step = (n: number) => Math.round(20 * Math.pow(1.25, n) * u);
  return {
    u,
    space,
    safe,
    columns,
    gutter,
    col: (i) => Math.round(safe.left + i * (colW + gutter)),
    span: (n) => Math.round(n * colW + (n - 1) * gutter),
    type: { caption: step(-1), small: step(-0.5), body: step(0), lead: step(1), h4: step(2), h3: step(3), h2: step(4), h1: step(5), display: step(6) },
    radius: { sm: space(1), md: space(1.5), lg: space(2), xl: space(3), pill: 999 },
  };
}

/** Whole pixel. */
export const snap = (v: number) => Math.round(v);
/** A rectangle on whole pixels (edges rounded, so abutting boxes never gap or overlap). */
export function snapRect(x: number, y: number, w: number, h: number): [number, number, number, number] {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  return [x0, y0, Math.max(0, Math.round(x + w) - x0), Math.max(0, Math.round(y + h) - y0)];
}
/** A 1px line's coordinate, centred on a pixel so it renders crisp instead of as a 2px blur. */
export const hairline = (v: number) => Math.round(v - 0.5) + 0.5;
/** Round a length to the nearest half grid step (4pt), for spacing that sits on the rhythm. */
export const onGrid = (v: number, u: number) => Math.round(v / ((GRID / 2) * u)) * ((GRID / 2) * u);

/**
 * Designer's overlay (preview only, never exported): the title-safe area, layout columns, the
 * 8pt rhythm and centre lines.
 */
export function drawGridOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const t = tokens(w, h);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 8pt rhythm (every 4th line brighter: the 32pt major grid).
  const unit = GRID * t.u;
  for (let i = 0, y = 0; y < h; i++, y = i * unit) {
    ctx.fillStyle = i % 4 === 0 ? "rgba(255,64,160,0.16)" : "rgba(255,64,160,0.06)";
    ctx.fillRect(0, Math.round(y), w, 1);
  }
  // Columns.
  ctx.fillStyle = "rgba(0,200,255,0.08)";
  for (let i = 0; i < t.columns; i++) ctx.fillRect(t.col(i), t.safe.top, t.span(1), t.safe.height);
  // Title-safe area and centre lines.
  ctx.strokeStyle = "rgba(0,240,255,0.85)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(hairline(t.safe.left), hairline(t.safe.top), t.safe.width, t.safe.height);
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.moveTo(hairline(w / 2), 0);
  ctx.lineTo(hairline(w / 2), h);
  ctx.moveTo(0, hairline(h / 2));
  ctx.lineTo(w, hairline(h / 2));
  ctx.stroke();
  ctx.restore();
}

/** Move a text block down, if needed, so its first line's glyphs start inside the title-safe top. */
export function fitSafeTop<L extends { ys: number[]; size: number }>(layout: L, w: number, h: number): L {
  const shift = tokens(w, h).safe.top - (layout.ys[0] - layout.size * 0.5);
  if (shift > 0) layout.ys = layout.ys.map((y) => y + shift);
  return layout;
}
