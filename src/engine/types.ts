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
