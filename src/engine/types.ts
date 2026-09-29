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
  "blur-reveal",
  "word-swap",
  "ui-tour",
  "bento",
  "ui-cards",
  "pain-strike",
  "integrations",
  "testimonial",
  "logo-marquee",
  "cta",
  "site-scroll",
  "steps",
  "icon-features",
  "command-k",
  "ai-prompt",
  "click-flow",
  "notify-stack",
  "chart-grow",
  "ui-assemble",
  "type-mask",
  "node-graph",
  "gallery-flow",
  "carousel-3d",
  "tilt-wall",
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
  "midnight",
  "paper",
  "sunset",
  "ocean",
  "pastel",
  "enterprise",
  "terminal",
  "brutal",
  "cream",
  "violet",
  "volt",
  "spatial",
  "hud",
  "swiss",
  "clay",
  "chrome",
  "holo",
  "dither",
] as const;

export type PaletteId = (typeof PALETTE_IDS)[number];

export const TRANSITIONS = ["cut", "flash", "zoom", "glitch", "wipe", "whip", "dolly", "leak", "shutter", "push", "dissolve"] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const FONTS = ["anton", "grotesk", "inter", "serif", "mono"] as const;
export type FontId = (typeof FONTS)[number];

export type Aspect = "16:9" | "9:16" | "1:1";

export interface Media {
  /** Same-origin URL (proxied through /api/asset) so frames can be exported. */
  src: string;
  kind: "image" | "video";
}

/** Brand kit imported from a website. */
/**
 * One UI component cut out of the live page (a product shot, an app panel, a feature card, a
 * button), with its box in page pixels (1440px-wide layout) so it can be animated on its own
 * and reassembled exactly where it sits on the page.
 */
export interface SitePart {
  src: string;
  kind: "media" | "panel" | "card" | "button";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius in page pixels. */
  r: number;
  text?: string;
}

export interface Brand {
  name: string;
  /** Display domain, e.g. "acme.com". */
  domain?: string;
  logo?: string;
  images: string[];
  videos: string[];
  /** Customer / partner logos for "Trusted by" scenes. */
  clientLogos?: string[];
  /** Brand headline font family, loaded from Google Fonts when available. */
  font?: string;
  /** UI components cut out of the live page (see SitePart). */
  parts?: SitePart[];
  /** Customer avatars keyed by testimonial author. */
  avatars?: Record<string, string>;
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
  /** Short feature descriptions paired with headlines where found. */
  features: string[];
  stats: string[];
  /** Real customer quotes found on the page. */
  testimonials: { quote: string; author: string; role: string; avatar: string | null }[];
  /** Customer / partner logo images ("Trusted by…" walls). */
  clientLogos: string[];
  /** "How it works" step titles. */
  steps: string[];
  /** Problems the product removes ("no more spreadsheets" → "Spreadsheets"). */
  pains: string[];
  /** The site's headline font family (e.g. from Google Fonts). */
  font: string | null;
  /** Screenshots from the live browser capture (same-origin /api/shot URLs). */
  shots: { hero: string | null; full: string | null; sections: string[]; parts?: SitePart[] };
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
  /** List content for multi-item skills (bento features, pain points, logos…). */
  items?: string[];
  /** Chapter label shown above the headline ("How it works", "Loved by teams"). */
  eyebrow?: string;
  /** Story role, so a style template can restyle the scene ("hook", "reveal", "cta"…). */
  role?: string;
  /** Narrator's line for this scene (voice-over), in speakable sentence case. */
  vo?: string;
}

export type VoiceSource = "local" | "openai" | "elevenlabs" | "custom" | "upload";

export interface VoiceSettings {
  enabled: boolean;
  source: VoiceSource;
  /** Voice id for the source (Kokoro voice, OpenAI voice, ElevenLabs voice id…). */
  voice: string;
  /** Word-by-word captions. */
  captions: boolean;
  /** Model override for cloud / custom sources. */
  model?: string;
  /** Uploaded narration: where it starts in the film (seconds). */
  offset?: number;
}

/** Headline text effects: the five originals plus the modern AI-video set (decode, roll, letters,
 * streak, chroma, flip, focus, highlight, shine). */
export const TEXT_FX = ["blur", "mask", "pop", "glow", "type", "decode", "roll", "letters", "streak", "chroma", "flip", "focus", "highlight", "shine"] as const;
export type TextFx = (typeof TEXT_FX)[number];

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
  /** "saas": clean product-launch look and upbeat score; "trailer": epic cinematic. */
  style?: "saas" | "trailer";
  /** Style template id (see templates.ts). */
  template?: string;
  look?: Look;
  /** Score style; defaults to follow `style`. */
  music?: "saas" | "trailer";
  /** Requested film length in seconds; templates fit scene lengths to it. */
  target?: number;
  /** Director's notes for the user (e.g. "only enough material for a 20s cut"). */
  notes?: string[];
  /** Product concept (devtools, ai, fintech…): picks icon families and story vocabulary. */
  concept?: string;
  /** Colour balance: the 60-30-10 rule (default for SaaS films) or every palette colour at full strength. */
  scheme?: "60-30-10" | "vibrant";
  /** Glow on type and the highlight bloom (default on). Off gives crisp, halo-free text. */
  glow?: boolean;
  /** Headline text effect chosen in the studio; overrides the template's (look.text). */
  textFx?: TextFx;
  /** Flavour of the SaaS score. */
  flavor?: "tech" | "soft" | "pop" | "minimal" | "neon";
  /** Voice-over settings (the lines live on the scenes; audio in the clip store). */
  voiceover?: VoiceSettings;
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
  /** Light-background theme: glows become solid, borders darken, logos stay as-is. */
  light?: boolean;
  /** 60-30-10 rule: the supporting 30% colour (surfaces, gradient fields). Set when the rule is applied. */
  support?: string;
}

/** Background treatment for SaaS scenes, set by the style template. */
export interface Look {
  grid: boolean;
  beams: number;
  aurora: number;
  /** Headline animation: blur-in, crisp mask slide, bouncy pop, or slow glowing reveal. */
  text?: TextFx;
  /** Foreground lens bokeh (off for SaaS looks unless true). */
  bokeh?: boolean;
  /** Film grain strength multiplier. */
  grain?: number;
  /** Vignette strength multiplier. */
  vignette?: number;
  /** Stage behind the content: fine grid (default), dot matrix, soft colour blobs, CRT scanlines, or plain. */
  backdrop?: "grid" | "dots" | "blobs" | "scanlines" | "plain" | "horizon" | "stars";
  /** UI card treatment: frosted glass (default), frosted-light, flat, or neo-brutalist. */
  card?: "glass" | "frost" | "flat" | "brutal" | "clay";
  /** Headline size multiplier (kinetic-type styles go big). */
  textScale?: number;
  /** GPU shader gradient behind everything (Paper Shaders): mesh, grain, warp, smoke, neuro, rays. */
  shader?: "mesh" | "grain" | "warp" | "smoke" | "neuro" | "rays" | "panels" | "metaballs" | "swirl" | "voronoi" | "dither" | "waves";
  /** Shader opacity over the base colour (0–1). */
  shaderStrength?: number;
  /** Shader animation speed multiplier. */
  shaderSpeed?: number;
  /** 3D stage: scene content floats on a tilted plane (degrees) that slowly orbits. */
  depth?: number;
  /** Frame overlay drawn over the film: sci-fi HUD or a Swiss-style layout frame. */
  overlay?: "hud" | "frame";
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
  style?: "saas" | "trailer";
  look?: Look;
  /** Time in the whole film (seconds): lets backgrounds flow continuously across cuts. */
  globalT?: number;
  /** Set while rendering a 3D-stage content layer: the stage (background) is drawn separately. */
  noStage?: boolean;
  /** Product concept id (see concepts.ts) for on-brand icon choices. */
  concept?: string;
  /** The score at this moment, so motion can hit with the music (full-film renders only). */
  music?: MusicPulse;
}

export interface MusicPulse {
  /** Seconds since the last kick the score played (Infinity when the drums are out). */
  kick: number;
  /** Seconds since the last drop (Infinity before the first). */
  drop: number;
  /** Musical energy 0..1 (intro/breakdown low, groove high). */
  energy: number;
}

export type SfxKind = "whoosh" | "click" | "pop" | "swoosh" | "tick" | "shimmer" | "strike" | "key" | "success";

/** A sound-effect cue at a scene-local time (seconds). */
export interface SfxCue {
  t: number;
  kind: SfxKind;
}

export interface Skill {
  id: SkillId;
  name: string;
  tagline: string;
  /** Guidance for the AI director. */
  bestFor: string;
  sample: { text: string; subtext?: string; items?: string[] };
  render: (sc: SkillContext) => void;
  /** Sound effects synced to this skill's animation. */
  sfx?: (scene: Scene, beat: number, brand?: Brand) => SfxCue[];
  /** Placeholder shown for the storyboard's list field when the skill uses `items`. */
  itemsHint?: string;
}
