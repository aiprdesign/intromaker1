import { hexToRgb, mixHex } from "./math";
import type { CastMember, Palette } from "./types";

/**
 * The character designer's options: what a custom abstract character (see skills/abstract.ts) can
 * be made of, the ranges its proportions keep to, and the check a saved or shared cast goes
 * through before it is drawn.
 */
export const BODIES = ["pill", "arch", "bell", "triangle", "round", "block"] as const;
export const PATTERNS = ["none", "stripes", "dots", "half"] as const;
export const HEADS = ["circle", "oval", "squircle"] as const;
export const HAIR_STYLES = ["none", "cap", "bun", "spikes", "wave", "bob", "afro", "beanie"] as const;
export const EYES = ["dots", "lines", "ovals"] as const;
/**
 * Kinds of character: abstract noodle people, the Corporate Memphis trend, blob mascots, stick
 * figures and classic rubber-hose cartoons.
 */
export const KINDS = ["abstract", "memphis", "blob", "stick", "classic"] as const;
/** Drawing styles: flat colour, soft 3D shading, bold outlines, line art, or paper cut-outs with hard shadows. */
export const ART_STYLES = ["flat", "soft", "outline", "line", "paper"] as const;

/** Bold modern colours for clothes, shoes and playful hair. */
export const MODERN = ["#ff6b6b", "#ffd166", "#06d6a0", "#118ab2", "#8338ec", "#ff8fab", "#3a86ff", "#fb5607", "#2ec4b6", "#ffbe0b"];
export const SKINS = ["#f6d5bf", "#eab896", "#d39a72", "#b5784f", "#8a5636", "#5e3a24"];
export const PLAYFUL_SKINS = ["#9aa8ff", "#ffb08f", "#86d9bb", "#c9a7ff"];
export const HAIRS = ["#1d1520", "#3b2417", "#6b3a1e", "#c88a3a", "#e8e1d8", "#ff6b6b", "#3a86ff"];
/** Trousers and shoes: neutrals first. */
export const NEUTRALS = ["#1d1b26", "#2b2f45", "#5b5f73", "#d9dcef", "#ffffff"];

/** Proportions, as fractions of the character's height unit: [min, max]. */
export const RANGES = {
  bodyW: [0.24, 0.4],
  bodyH: [0.3, 0.44],
  headR: [0.085, 0.135],
  neck: [0, 0.035],
  legLen: [0.22, 0.4],
} as const;

/** The most custom characters a video keeps. */
export const CAST_MAX = 8;

const HEX = /^#[0-9a-f]{6}$/i;
const one = <T extends string>(xs: readonly T[], v: unknown, d: T): T => ((xs as readonly string[]).includes(v as string) ? (v as T) : d);
const num = (v: unknown, [lo, hi]: readonly [number, number]) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : (lo + hi) / 2;
  return Math.min(hi, Math.max(lo, n));
};
const hex = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : d);

/** One character, checked: unknown parts fall back, numbers are kept in range, colours must be hex. */
export function sanitizeMember(raw: unknown): CastMember | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const skin = hex(r.skin, SKINS[1]);
  const bodyColor = hex(r.bodyColor, MODERN[0]);
  const name = typeof r.name === "string" ? r.name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 24) : "";
  const art = one(ART_STYLES, r.art, "flat");
  const kind = one(KINDS, r.kind, "abstract");
  return {
    ...(name ? { name } : {}),
    ...(kind !== "abstract" ? { kind } : {}),
    ...(art !== "flat" ? { art } : {}),
    body: one(BODIES, r.body, "pill"),
    bodyW: num(r.bodyW, RANGES.bodyW),
    bodyH: num(r.bodyH, RANGES.bodyH),
    bodyColor,
    pattern: one(PATTERNS, r.pattern, "none"),
    patternColor: hex(r.patternColor, "#ffffff"),
    head: one(HEADS, r.head, "circle"),
    headR: num(r.headR, RANGES.headR),
    neck: num(r.neck, RANGES.neck),
    skin,
    hair: one(HAIR_STYLES, r.hair, "none"),
    hairColor: hex(r.hairColor, HAIRS[0]),
    legLen: num(r.legLen, RANGES.legLen),
    legColor: hex(r.legColor, NEUTRALS[1]),
    shoe: hex(r.shoe, NEUTRALS[0]),
    armColor: hex(r.armColor, skin),
    eyes: one(EYES, r.eyes, "dots"),
    glasses: r.glasses === true,
    cheeks: r.cheeks === true,
    nose: r.nose === true,
    ...(r.ownColors === true ? { ownColors: true } : {}),
  };
}

/** A cast, checked (at most CAST_MAX); undefined when empty. */
export function sanitizeCast(raw: unknown): CastMember[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.slice(0, CAST_MAX).map(sanitizeMember).filter((m): m is CastMember => !!m);
  return out.length ? out : undefined;
}

/* ───────────── Matching the intro's colours ───────────── */

const lum = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const sat = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
};

/** Rotate a colour's hue by `deg`. */
function hue(hex: string, deg: number) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return hex;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + deg) % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [rr, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[rr, gg, bb].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Clothes colours that belong to an intro: its primary, secondary and accent, their tints and
 * shades, neighbouring and complementary hues and a neutral for variety, each nudged until it
 * stands out from the stage.
 */
export function introColors(p: Palette): string[] {
  const base = [p.primary, p.secondary, p.accent].filter((c) => HEX.test(c ?? ""));
  if (!base.length) return MODERN;
  const raw = [
    ...base,
    ...base.map((c) => mixHex(c, "#ffffff", 0.35)),
    ...base.map((c) => mixHex(c, "#000000", 0.22)),
    // Neighbouring hues, and the complement for a pop of contrast (still the intro's harmony).
    hue(base[0], 32),
    hue(base[0], -32),
    hue(base[0], 64),
    hue(base[0], 180),
    // A neutral that reads on the stage (dark on light, light on dark).
    p.light ? "#2b2f45" : "#e6e4f0",
  ];
  const bg = HEX.test(p.bg0) ? p.bg0 : p.light ? "#ffffff" : "#0b0b12";
  const away = lum(bg) > 0.4 ? "#000000" : "#ffffff";
  const out: string[] = [];
  for (let c of raw) {
    for (let k = 0.12; k <= 0.6 && ratio(c, bg) < 1.6; k += 0.12) c = mixHex(c, away, k);
    c = c.toLowerCase();
    const rgb = hexToRgb(c);
    if (!out.some((o) => hexToRgb(o).every((v, i) => Math.abs(v - rgb[i]) < 18))) out.push(c);
  }
  return out;
}

const NATURAL_HAIR = new Set(HAIRS.slice(0, 5));
const isNeutral = (c: string) => NEUTRALS.includes(c) || sat(c) < 0.12;

/**
 * A character dressed in the intro's colours: top, pattern, sleeves, and coloured trousers, shoes
 * or hair change; skin, natural hair and neutral trousers and shoes stay. `slot` spreads a cast
 * across the colours. A character with its own colours (ownColors) is returned as it is.
 */
export function matchColors(c: CastMember, p: Palette, slot = 0): CastMember {
  if (c.ownColors) return c;
  const set = introColors(p);
  const n = set.length;
  const body = set[slot % n];
  let pattern = set[(slot + 2) % n];
  if (ratio(pattern, body) < 1.4) pattern = lum(body) > 0.35 ? mixHex(body, "#000000", 0.35) : mixHex(body, "#ffffff", 0.6);
  const second = set[(slot + 1) % n];
  // A blob's arms and feet are its body colour.
  if (c.kind === "blob") return { ...c, bodyColor: body, patternColor: pattern, armColor: body, legColor: mixHex(body, "#000000", 0.2), shoe: mixHex(body, "#000000", 0.35), hairColor: NATURAL_HAIR.has(c.hairColor) ? c.hairColor : second };
  return {
    ...c,
    bodyColor: body,
    patternColor: pattern,
    armColor: c.armColor === c.skin ? c.skin : body,
    legColor: isNeutral(c.legColor) ? c.legColor : mixHex(second, "#000000", 0.2),
    shoe: isNeutral(c.shoe) ? c.shoe : second,
    hairColor: NATURAL_HAIR.has(c.hairColor) ? c.hairColor : second,
  };
}
