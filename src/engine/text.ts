import type { FontId } from "./types";

export const FONT_FAMILY: Record<FontId, { display: string; weight: number; tracking: number }> = {
  anton: { display: "Anton", weight: 400, tracking: 0.02 },
  grotesk: { display: "Space Grotesk", weight: 700, tracking: -0.02 },
  inter: { display: "Inter", weight: 800, tracking: -0.045 },
  serif: { display: "Instrument Serif", weight: 400, tracking: -0.01 },
  mono: { display: "JetBrains Mono", weight: 800, tracking: -0.03 },
  // Classic movie-poster capitals (the Trajan look), set wide like a film title.
  cinzel: { display: "Cinzel", weight: 700, tracking: 0.1 },
  // Tall condensed trailer type.
  bebas: { display: "Bebas Neue", weight: 400, tracking: 0.04 },
  playfair: { display: "Playfair Display", weight: 800, tracking: -0.01 },
  manrope: { display: "Manrope", weight: 800, tracking: -0.035 },
  jost: { display: "Jost", weight: 600, tracking: -0.01 },
};

/** Names shown in the font picker, with what each face is for. */
export const FONT_LABELS: Record<FontId, { name: string; note: string }> = {
  inter: { name: "Inter", note: "Clean product sans" },
  manrope: { name: "Manrope", note: "Rounded modern sans" },
  grotesk: { name: "Space Grotesk", note: "Techy grotesk" },
  jost: { name: "Jost", note: "Geometric (Futura-like)" },
  playfair: { name: "Playfair Display", note: "Editorial serif" },
  serif: { name: "Instrument Serif", note: "Elegant light serif" },
  mono: { name: "JetBrains Mono", note: "Developer mono" },
  cinzel: { name: "Cinzel", note: "Classic movie title" },
  bebas: { name: "Bebas Neue", note: "Condensed trailer caps" },
  anton: { name: "Anton", note: "Heavy impact caps" },
};

export const SUB_FONT = "Inter";

/**
 * The supporting type (subtitles, labels) paired with the headline face. SaaS films keep Inter;
 * trailers pair their display face with a contrasting family, like a film poster: movie capitals
 * over a light geometric sans, a condensed title over wide-set sans, and so on.
 */
let subFamily = SUB_FONT;
export function setSubFamily(name: string | null) {
  subFamily = name || SUB_FONT;
}
const TRAILER_PAIR: Partial<Record<FontId, string>> = {
  cinzel: "Jost",
  bebas: "Jost",
  anton: "Jost",
  playfair: "Jost",
  serif: "Jost",
  grotesk: "Inter",
  jost: "Inter",
};
/** Title faces that always take their poster pair, whatever kind of film they're in. */
const TITLE_FACES = new Set<FontId>(["cinzel", "bebas", "anton", "playfair"]);
/** The subtitle family for a film: the poster pair of its headline face, else Inter. */
export function pairedSubFamily(font: FontId, style: "saas" | "trailer" | undefined) {
  return style === "trailer" || TITLE_FACES.has(font) ? TRAILER_PAIR[font] ?? SUB_FONT : SUB_FONT;
}

/** The website's own headline font, used in place of Inter when it has loaded. */
let brandFont: string | null = null;
export function setBrandFont(name: string | null) {
  brandFont = name;
}

/** Letter tracking (em) for a face; brand fonts get a neutral tight setting. */
export function trackingOf(font: FontId) {
  return font === "inter" && brandFont ? -0.02 : FONT_FAMILY[font].tracking;
}

export function displayFont(font: FontId, size: number) {
  const f = FONT_FAMILY[font];
  if (font === "inter" && brandFont) return `700 ${Math.round(size)}px "${brandFont}", "Inter", sans-serif`;
  return `${f.weight} ${Math.round(size)}px "${f.display}", Impact, sans-serif`;
}

export function subFont(size: number, weight = 500) {
  return `${weight} ${Math.round(size)}px "${subFamily}", "${SUB_FONT}", system-ui, sans-serif`;
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
  const w = measureTracked(ctx, text, 100 * trackingOf(font));
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
  const lineHeight = size * (font === "anton" || font === "bebas" ? 1.02 : font === "inter" || font === "manrope" ? 1.08 : font === "cinzel" || font === "playfair" ? 1.12 : 1.0);
  const top = opts.cy - ((lines.length - 1) * lineHeight) / 2;
  return {
    lines,
    size,
    lineHeight,
    ys: lines.map((_, i) => top + i * lineHeight),
    tracking: size * trackingOf(font),
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

const ACCENT_BOOST =
  /^(\d[\d,.]*[kmx%+]*|faster|fastest|fast|smarter|better|instantly|instant|automatically|automatic|effortless(ly)?|everything|everyone|anyone|seconds|minutes|trust|themselves|free|ai|zero|never|always|speed|scale|thought|together|anywhere|superpowers?|magic|simple|minutes)$/i;
const ACCENT_WEAK = new Set(
  "use do it them you us today now need needs want love know get go can will is are be for with of to the a an and or in on at by your our my their that this".split(" "),
);
const ACCENT_LEAD = new Set(["whole", "every", "all", "one", "single", "real", "entire"]);

/**
 * Pick the word(s) a designer would highlight and wrap them in *…*: a benefit word or number
 * if there is one ("*300+ tools*", "trust"), else the last meaningful word ("whole *team*" →
 * "*whole team*"), never a filler like "use" or "today". Text already marked is unchanged.
 */
export function autoAccent(text: string) {
  if (text.includes("*")) return text;
  const words = text.trim().split(/\s+/);
  if (words.length < 3) return text;
  const bare = (w: string) => w.replace(/^[^\w\d]+|[^\w\d%+]+$/g, "");
  let from = -1;
  let to = -1;
  for (let i = words.length - 1; i >= 1; i--) {
    if (ACCENT_BOOST.test(bare(words[i]))) {
      from = to = i;
      // "300+ tools", "10x faster": carry the number's noun.
      if (/^\d/.test(bare(words[i])) && i + 1 < words.length && !ACCENT_WEAK.has(bare(words[i + 1]).toLowerCase())) to = i + 1;
      break;
    }
  }
  if (from < 0) {
    let i = words.length - 1;
    while (i > 0 && ACCENT_WEAK.has(bare(words[i]).toLowerCase())) i--;
    if (i < 1) return text;
    from = to = i;
    // Walk back over filler to the noun ("team can use" → "team").
    if (i > 1 && ACCENT_LEAD.has(bare(words[i - 1]).toLowerCase())) from = i - 1;
  }
  const last = words[to].match(/^(.*?)([.!?,:;]*)$/)!;
  const out = [...words];
  out[to] = `${last[1]}*${last[2]}`;
  out[from] = `*${out[from]}`;
  return out.join(" ");
}

/**
 * How text that has to stay inside a box of width `maxW` should be set with the context's current
 * font: on one line when it fits; otherwise on up to `maxLines` lines (two lines split where they
 * balance best), shrinking the type a little (down to `minScale`) only when a line still won't fit,
 * and only as a last resort shortening the last line with "…". Returns the lines, the font size
 * to use, the widest line's width and the font string at that size.
 */
export function fitTextLines(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxW: number,
  opts: { maxLines?: number; minScale?: number } = {},
): { lines: string[]; size: number; width: number; font: string } {
  const maxLines = opts.maxLines ?? 2;
  const minScale = opts.minScale ?? 0.8;
  const font0 = ctx.font;
  const m = /(\d+(?:\.\d+)?)px/.exec(font0);
  const size0 = m ? parseFloat(m[1]) : 16;
  const fontAt = (s: number) => font0.replace(/(\d+(?:\.\d+)?)px/, `${s.toFixed(1)}px`);
  const width = (s: string) => ctx.measureText(s).width;
  const clean = text.replace(/\s+/g, " ").trim();
  const words = clean.split(" ");
  const greedy = () => {
    const out: string[] = [];
    let line = "";
    for (const wd of words) {
      const next = line ? `${line} ${wd}` : wd;
      if (width(next) > maxW && line) {
        out.push(line);
        line = wd;
      } else line = next;
    }
    out.push(line);
    return out;
  };
  // The best way to lay the words into at most n lines at the current size, or null if none fits.
  const layout = (n: number): string[] | null => {
    if (width(clean) <= maxW) return [clean];
    if (n < 2 || words.length < 2) return null;
    if (n === 2) {
      let best: string[] | null = null;
      let bestW = Infinity;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(" ");
        const b = words.slice(i).join(" ");
        const wmax = Math.max(width(a), width(b));
        if (wmax <= maxW && wmax < bestW) {
          bestW = wmax;
          best = [a, b];
        }
      }
      return best;
    }
    const out = greedy();
    return out.length <= n && out.every((l) => width(l) <= maxW) ? out : null;
  };
  let lines: string[] | null = null;
  let size = size0;
  for (let k = 1; k >= minScale - 1e-6 && !lines; k -= 0.05) {
    size = size0 * k;
    ctx.font = fontAt(size);
    lines = layout(maxLines);
  }
  if (!lines) {
    // Still too long at the smallest size: wrap greedily and shorten the last line.
    const out = greedy();
    lines = out.slice(0, maxLines);
    if (out.length > maxLines || width(lines[lines.length - 1]) > maxW) {
      let last = lines[lines.length - 1];
      while (last.length > 1 && width(`${last}…`) > maxW) last = last.slice(0, -1);
      lines[lines.length - 1] = `${last.replace(/[\s,.;:—–-]+$/, "")}…`;
    }
  }
  const widest = Math.min(maxW, Math.max(...lines.map(width)));
  const font = ctx.font;
  ctx.font = font0;
  return { lines, size, width: widest, font };
}

/**
 * Optical centring. A "middle" baseline centres the font's em box on y, which leaves capitals
 * sitting a pixel or two high in a chip, button or row and above the icon beside them. This is
 * how far to move text drawn on a "middle" baseline (in the current font) so the capitals'
 * centre lands exactly on y.
 */
export function capShift(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): number {
  const base = ctx.textBaseline;
  ctx.textBaseline = "middle";
  const m = ctx.measureText("H");
  ctx.textBaseline = base;
  return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
}

/**
 * fillText for UI text (chips, buttons, rows) centred optically: on a "middle" baseline its
 * capitals centre on y (see capShift), and centre-aligned text centres its ink rather than its
 * advance width, so a short label sits dead centre in its chip.
 */
export function fillTextMid(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW?: number,
) {
  const dy = ctx.textBaseline === "middle" ? capShift(ctx) : 0;
  let dx = 0;
  if (ctx.textAlign === "center" && maxW === undefined) {
    const m = ctx.measureText(text.trimEnd());
    dx = (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
  }
  if (maxW === undefined) ctx.fillText(text, x + dx, y + dy);
  else ctx.fillText(text, x, y + dy, maxW);
}

/**
 * Draw text that has to stay inside its container (a card, a row, a strip), set as fitTextLines
 * lays it out: wrapped onto up to `maxLines` lines rather than squeezed or cut. It follows the
 * context's current font, alignment and baseline like fillText: a "middle" baseline centres the
 * block on `y`, "top"/"hanging" stacks it down from `y`, other baselines stack it up so the last
 * line sits on `y`. Returns how many lines it used.
 */
export function fillTextFit(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  opts: { maxLines?: number; lineHeight?: number; minScale?: number } = {},
): number {
  const font0 = ctx.font;
  const fit = fitTextLines(ctx, text, maxW, opts);
  const step = fit.size * (opts.lineHeight ?? 1.18);
  const n = fit.lines.length;
  const base = ctx.textBaseline;
  ctx.font = fit.font;
  // A "middle" block is centred on its capitals, so it lines up with icons and sits centred in its row.
  const oy = base === "middle" ? capShift(ctx) : 0;
  fit.lines.forEach((l, i) => {
    const ly = oy + (base === "middle" ? y + (i - (n - 1) / 2) * step : base === "top" || base === "hanging" ? y + i * step : y - (n - 1 - i) * step);
    const m = ctx.measureText(l);
    // A single word longer than the box is the one case left: draw it at the box's width.
    if (m.width > maxW) ctx.fillText(l, x, ly, maxW);
    // Centred lines centre their ink, not their advance width (see fillTextMid).
    else ctx.fillText(l, ctx.textAlign === "center" ? x + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2 : x, ly);
  });
  ctx.font = font0;
  return n;
}
