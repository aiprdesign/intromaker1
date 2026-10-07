import type { CastMember } from "./types";

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
  return {
    ...(name ? { name } : {}),
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
  };
}

/** A cast, checked (at most CAST_MAX); undefined when empty. */
export function sanitizeCast(raw: unknown): CastMember[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.slice(0, CAST_MAX).map(sanitizeMember).filter((m): m is CastMember => !!m);
  return out.length ? out : undefined;
}
