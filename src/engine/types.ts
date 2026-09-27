export const SKILL_IDS = [
  "kinetic-slam",
  "glitch-reveal",
  "particle-assemble",
  "hyperspace",
  "liquid-gradient",
  "shape-burst",
  "retro-grid",
  "neon-draw",
  "split-wipe",
  "orbit-rings",
  "number-ticker",
  "cinematic-title",
  "shockwave",
  "type-cascade",
  "hud-scan",
  "god-rays",
  "glass-shatter",
  "warp-tunnel",
  "flip-3d",
  "logo-reveal",
  "product-showcase",
  "photo-montage",
  "screen-wall",
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

export const PALETTE_IDS = [
  "cyber",
  "inferno",
  "cosmos",
  "gold",
  "synthwave",
  "aurora",
  "ice",
  "toxic",
  "mono",
] as const;

export type PaletteId = (typeof PALETTE_IDS)[number];

export const TRANSITIONS = ["cut", "flash", "zoom", "glitch", "wipe", "whip", "dolly", "leak", "shutter"] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const FONTS = ["anton", "grotesk"] as const;
export type FontId = (typeof FONTS)[number];

export type Aspect = "16:9" | "9:16" | "1:1";

export interface Media {
  /** Same-origin URL (proxied through /api/asset) so frames can be exported. */
  src: string;
  kind: "image" | "video";
}

/** Brand kit imported from a website. */
export interface Brand {
  name: string;
  /** Display domain, e.g. "acme.com". */
  domain?: string;
  logo?: string;
  images: string[];
  videos: string[];
  /** Brand colours; override the palette's accent colours. */
  colors?: { primary: string; secondary: string };
}

/** Everything extracted from a website by /api/scrape (absolute, un-proxied URLs). */
export interface SiteData {
  url: string;
  domain: string;
  name: string;
  tagline: string;
  description: string;
  headlines: string[];
  stats: string[];
  cta: string | null;
  logo: string | null;
  images: string[];
  videos: string[];
  themeColor: string | null;
}

export interface Scene {
  skill: SkillId;
  /** Main headline for the scene. Short and punchy: 1–4 words works best. */
  text: string;
  /** Optional supporting line. */
  subtext?: string;
  /** Seconds. */
  duration: number;
  /** How this scene enters. */
  transition: Transition;
  /** Image or video shown by media skills. */
  media?: Media;
}

export interface VideoPlan {
  title: string;
  palette: PaletteId;
  font: FontId;
  aspect: Aspect;
  /** Beats per minute of the generated soundtrack. */
  bpm: number;
  seed: number;
  scenes: Scene[];
  brand?: Brand;
}

export interface Palette {
  id: PaletteId;
  name: string;
  bg0: string;
  bg1: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
}

export interface SkillContext {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** Seconds since scene start. */
  t: number;
  /** Scene duration in seconds. */
  d: number;
  /** Normalised progress 0..1. */
  p: number;
  /** Scale unit: 1 at 1080px on the short side. */
  u: number;
  scene: Scene;
  palette: Palette;
  font: FontId;
  seed: number;
  /** Seconds per beat of the soundtrack; scenes start on a beat, so impacts can land on kicks. */
  beat: number;
  brand?: Brand;
}

export interface Skill {
  id: SkillId;
  name: string;
  tagline: string;
  /** Guidance for the AI director. */
  bestFor: string;
  sample: { text: string; subtext?: string };
  render: (sc: SkillContext) => void;
}
