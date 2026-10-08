export const SKILL_IDS = [
  "type-poster",
  "photo-fan",
  "card-spread",
  "photo-drop",
  "showreel",
  "card-system",
  "type-rows",
  "poster-grid",
  "poster-split",
  "card-stack",
  "contact-sheet",
  "spec-sheet",
  "widget-set",
  "type-echo",
  "type-slots",
  "rapid-fire",
  "flip-switch",
  "zoom-through",
  "slice-switch",
  "style-shuffle",
  "split-flap",
  "whip-pan",
  "stack-stomp",
  "speed-ticker",
  "cube-spin",
  "speed-type",
  "bar-wipe",
  "crash-zoom",
  "word-grid",
  "orbit-text",
  "tape-rush",
  "jump-cut",
  "letter-rush",
  "stamp-rush",
  "rally",
  "spiral-in",
  "speed-gauge",
  "domino",
  "slipstream",
  "stretch-snap",
  "rack-focus",
  "keycaps",
  "spotlight",
  "toggle-list",
  "device-trio",
  "exploded-ui",
  "changelog",
  "calendar-drop",
  "inbox-sweep",
  "comment-pins",
  "table-fill",
  "persona-switch",
  "phone-tour",
  "drop-zone",
  "unbox",
  "arrow-rise",
  "process-chevrons",
  "process-cycle",
  "step-stairs",
  "services",
  "step-portals",
  "light-trail",
  "step-cards",
  "service-orbit",
  "service-carousel",
  "service-hex",
  "service-cube",
  "service-bloom",
  "service-fan",
  "service-board",
  "service-bento",
  "char-hello",
  "char-presenter",
  "char-team",
  "char-aha",
  "char-desk",
  "char-cheer",
  "pro-walk",
  "pro-explainer",
  "pro-duo",
  "pro-thinker",
  "pro-unveil",
  "pro-highfive",
  "abs-hello",
  "abs-crowd",
  "abs-features",
  "abs-parade",
  "abs-chat",
  "abs-cheer",
  "ind-hometour",
  "ind-build",
  "ind-site",
  "ind-care",
  "ind-menu",
  "ind-shop",
  "ind-lesson",
  "ind-team",
  "ind-route",
  "service-spotlight",
  "logo-draw",
  "logo-wipe",
  "logo-pop",
  "logo-morph",
  "logo-slices",
  "logo-dots",
  "logo-type",
  "logo-shapes",
  "anamorphic-flare",
  "monolith",
  "sand-reveal",
  "ember-title",
  "steel-title",
  "eclipse",
  "countdown",
  "searchlights",
  "rift-open",
  "blade-slash",
  "icon-reveal",
  "icon-ring",
  "studio-ident",
  "intertitle",
  "billing-block",
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
  "code-deploy",
  "globe",
  "live-cursors",
  "kanban",
  "before-after",
  "chat-thread",
  "support",
  "world-map",
  "feature-slides",
  "problem-solution",
  "liquid-logo",
  "qr-end",
  "product-hero",
  "product-end",
  "product-spin",
  "product-zoom",
  "product-teaser",
  "logo-extrude",
  "logo-spin",
  "logo-shatter",
  "logo-orbit",
  "logo-stage",
  "logo-layers",
  "logo-tunnel",
  "logo-flip",
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
  "eclipse",
  "studio",
  "flow",
  "ink",
  "bloom",
  "daybreak",
  "mars",
  "xeno",
  "ion",
  "nebula",
  "steel",
  "crimson",
  "rose",
  "sepia",
] as const;

export type PaletteId = (typeof PALETTE_IDS)[number];

/** Background shape sets (or watermark text) for SaaS slides; see shapes.ts. */
export const SHAPE_SETS = ["geometric", "soft", "tech", "sparkle", "lines", "text"] as const;
export type ShapeSet = (typeof SHAPE_SETS)[number];

/** The mouse pointer's look in product moments: "auto" is white on dark styles, graphite on light. */
export const POINTER_STYLES = ["auto", "white", "graphite", "brand", "glass", "clay", "classic"] as const;
export type PointerStyle = (typeof POINTER_STYLES)[number];

export const TRANSITIONS = ["cut", "flash", "zoom", "glitch", "wipe", "whip", "dolly", "leak", "shutter", "push", "dissolve", "liquid", "cube", "morph", "portal", "iris", "spin", "split", "swipe"] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const FONTS = ["anton", "grotesk", "inter", "serif", "mono", "cinzel", "bebas", "playfair", "manrope", "jost"] as const;
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
  /** App icon: shown with the name beneath it when the logo is a wide wordmark. */
  icon?: string;
  /** The full-page screenshot and its real sections ([top, bottom] fractions), shown section by section. */
  page?: { src: string; bands: [number, number][] };
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
  /** bands: the page's real sections on `full`, as [top, bottom] fractions of its height. */
  shots: { hero: string | null; full: string | null; sections: string[]; parts?: SitePart[]; bands?: [number, number][] };
  cta: string | null;
  logo: string | null;
  /** The site's app icon (apple-touch / SVG icon), used where a wide wordmark won't fit. */
  icon?: string | null;
  images: string[];
  videos: string[];
  themeColor: string | null;
  /** "product": a physical product (a marketplace listing or uploaded product photos), filmed as a product video. */
  kind?: "site" | "product";
  /** The marketplace a listing came from ("Amazon", "eBay", or a store's domain). */
  marketplace?: string;
  /**
   * The marketplace let us read only part of the listing (the product name from its link and its
   * main photo): the studio asks for more photos and the features.
   */
  partial?: boolean;
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
  /** The director's transition, kept while one transition is applied to the whole video (to restore it). */
  baseTransition?: Transition;
  /** Image or video shown by media skills. */
  media?: Media;
  /**
   * A contrast slide: the stage flips to a bold block of the video's colour with type to match, to
   * break the rhythm. Unset: the director decides (see contrast.ts); true or false: your choice.
   */
  contrast?: boolean;
  /** List content for multi-item skills (bento features, pain points, logos…). */
  items?: string[];
  /** Chapter label shown above the headline ("How it works", "Loved by teams"). */
  eyebrow?: string;
  /** Story role, so a style template can restyle the scene ("hook", "reveal", "cta"…). */
  role?: string;
  /** Narrator's line for this scene (voice-over), in speakable sentence case. */
  vo?: string;
  /** Why the director chose this beat for this product (shown on the story-arc chip). */
  why?: string;
  /**
   * Detail Zoom's lens, as set in the studio: where each stop looks (0–1 across the product
   * cut-out, in visiting order), the lens size (× the default) and the zoom strength (×).
   * Anything left out stays automatic.
   */
  zoom?: { points?: [number, number][]; size?: number; power?: number };
  /**
   * UI Zoom Tour's highlight areas, as set in the studio: one [x, y, width, height] box per stop
   * (fractions of the screenshot), for the screenshot `src` they were set on.
   */
  tour?: { areas?: [number, number, number, number][]; src?: string };
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
  /** Caption look: frosted pill (default), pop (bold outlined words springing in), box (highlight box on the spoken word) or karaoke (the line fills as it's said). */
  captionStyle?: "frosted" | "pop" | "box" | "karaoke";
}

/** Headline text effects: the five originals plus the modern AI-video set (decode, roll, letters,
 * streak, chroma, flip, focus, highlight, shine). */
export const TEXT_FX = ["blur", "mask", "pop", "glow", "type", "decode", "roll", "letters", "streak", "chroma", "flip", "focus", "highlight", "shine", "liquid"] as const;
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
  /** Trailer films: the trailer style (see trailers.ts) their palette, type, tempo and effects come from. */
  trailerStyle?: string;
  /** Style template id (see templates.ts). */
  template?: string;
  look?: Look;
  /** Score style; defaults to follow `style`. */
  music?: "saas" | "trailer";
  /** Requested film length in seconds; templates fit scene lengths to it. */
  target?: number;
  /** Director's notes for the user (e.g. "only enough material for a 20s cut"). */
  notes?: string[];
  /** Offers the maker confirmed are real (keys from offerKey), so the studio stops asking. */
  offersOk?: string[];
  /** A physical product film (from a listing or product photos): suggests the Studio White style. */
  product?: boolean;
  /** Product concept (devtools, ai, fintech…): picks icon families and story vocabulary. */
  concept?: string;
  /** Colour balance: the 60-30-10 rule (default for SaaS films) or every palette colour at full strength. */
  scheme?: "60-30-10" | "vibrant";
  /** Glow on type and the highlight bloom. Off by default (crisp, halo-free text); true turns it on. */
  glow?: boolean;
  /** Camera motion blur (a 180° shutter). On by default; false turns it off. */
  motionBlur?: boolean;
  /**
   * Playback speed of the whole video (see SPEEDS): 2 plays it twice as fast and exports a video half
   * as long. The slides keep their timing; the clock runs faster or slower. Unset: 1.
   */
  speed?: number;
  /** Contrast slides (a bold colour-block text beat every few slides). On by default; false turns them off. */
  contrast?: boolean;
  /** The mouse pointer's look (unset: auto). */
  pointer?: PointerStyle;
  /** Animated geometric shapes behind SaaS slides. On by default; false turns them off. */
  shapes?: boolean;
  /** Which background shapes (default geometric), or "text" for watermark text. */
  shapeSet?: ShapeSet;
  /** The watermark line for the "text" set (default: the brand's name). */
  watermark?: string;
  /** Headline text effect chosen in the studio; overrides the template's (look.text). */
  textFx?: TextFx;
  /** Flavour of the SaaS score. */
  flavor?: "tech" | "soft" | "pop" | "minimal" | "neon";
  /** Voice-over settings (the lines live on the scenes; audio in the clip store). */
  voiceover?: VoiceSettings;
  /** Custom abstract characters (the character designer's cast), cast first in the abstract slides. */
  cast?: CastMember[];
  /** The characters a Cartoon style tells the story with (unset: the style's own). */
  characters?: CharacterKind;
  /** Where a flat Cartoon style's characters are (an office, a hospital…), from the intro's theme (see scenes.ts). */
  setting?: "office" | "city" | "construction" | "hospital" | "classroom" | "home" | "shop" | "cafe" | "kitchen" | "bedroom" | "bathroom" | "house";
}

/**
 * A custom abstract character (see skills/abstract.ts), designed in the character designer. The
 * abstract slides cast these first, in order, then fill the rest with generated people.
 */
/** Abstract characters' drawing styles (see cast.ts ART_STYLES). */
export type ArtStyle = "flat" | "soft" | "outline" | "line" | "paper";
/** Kinds of generated character (see cast.ts KINDS and skills/abskinds.ts). */
export type CharacterKind = "abstract" | "memphis" | "blob" | "stick" | "classic";

export interface CastMember {
  name?: string;
  /** The kind of character (unset: abstract). */
  kind?: CharacterKind;
  /** The drawing style (unset: flat). */
  art?: ArtStyle;
  body: "pill" | "arch" | "bell" | "triangle" | "round" | "block";
  /** Body width and height, as fractions of the character's height unit. */
  bodyW: number;
  bodyH: number;
  bodyColor: string;
  pattern: "none" | "stripes" | "dots" | "half";
  patternColor: string;
  head: "circle" | "oval" | "squircle";
  headR: number;
  neck: number;
  skin: string;
  hair: "none" | "cap" | "bun" | "spikes" | "wave" | "bob" | "afro" | "beanie";
  hairColor: string;
  legLen: number;
  legColor: string;
  shoe: string;
  armColor: string;
  eyes: "dots" | "lines" | "ovals";
  glasses: boolean;
  cheeks: boolean;
  nose: boolean;
  /** Keep these colours; unset: dressed in each video's own colours (see cast.ts matchColors). */
  ownColors?: boolean;
  /** Uses a wheelchair (every kind but blob). */
  wheelchair?: boolean;
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
  /** Stage behind the content: fine grid (default), dot matrix, soft colour blobs, CRT scanlines, plain, synthwave horizon, stars, the clean-epic stages (eclipse rim, studio sweep, silk ribbons, light beam, colour bloom), or the sci-fi stages (light-speed warp, ringed planet, wormhole, data rain, quantum mesh). */
  backdrop?: "grid" | "dots" | "blobs" | "scanlines" | "plain" | "horizon" | "stars" | "eclipse" | "studio" | "ribbon" | "beam" | "bloom" | "warp" | "planet" | "wormhole" | "rain" | "plexus" | "meadow" | "office" | "city" | "construction" | "hospital" | "classroom" | "home" | "shop" | "cafe" | "kitchen" | "bedroom" | "bathroom" | "house";
  /** How cartoon characters are drawn (character slides): flat, comic ink with cel shading, soft clay, or hand-drawn doodle. */
  toon?: "flat" | "comic" | "soft" | "doodle";
  /** How generated abstract characters are drawn (unset: from toon). Your own characters keep theirs. */
  art?: ArtStyle;
  /** Which kind of character the abstract slides generate (unset: abstract). */
  people?: CharacterKind;
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
  /** 3D turntable: the shot on a panel turned this many degrees about the vertical axis, swinging slowly. */
  turn?: number;
  /** 3D slab: the shot as a thick floating glass slab tilted in 3D. */
  slab?: boolean;
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
  /** A physical product film: product photos are shown cut out of their white backgrounds. */
  product?: boolean;
  /** The score at this moment, so motion can hit with the music (full-film renders only). */
  music?: MusicPulse;
  /** A trailer's style id (e.g. a movie genre: "horror", "comedy"), so cards can play it their way. */
  genre?: string;
  /** The film's seed for the animated geometric background shapes; unset when they're off. */
  shapes?: number;
  /** Which background shapes, or watermark text. */
  shapeSet?: ShapeSet;
  watermark?: string;
  /** The mouse pointer's look (unset: auto). */
  pointer?: PointerStyle;
  /** Custom abstract characters, cast first (see VideoPlan.cast). */
  cast?: CastMember[];
  /**
   * Set when the studio edits this slide's points on the paused preview: the slide draws its
   * overview (no zoom, lens or callouts) and reports where its editable points sit.
   */
  edit?: (layout: EditLayout) => void;
}

/**
 * A slide's editable points on the frame, for the studio's on-preview handles. `map` turns a
 * fraction of the picture into frame pixels: x = ox + fx * sx, y = oy + fy * sy.
 */
export type EditLayout =
  /** UI Zoom Tour: the highlight areas ([x, y, w, h] fractions of the screenshot) and the screenshot's key. */
  | { kind: "tour"; areas: [number, number, number, number][]; map: { ox: number; oy: number; sx: number; sy: number }; key?: string; clip: { x: number; y: number; w: number; h: number } }
  /** Detail Zoom: the lens stops (fractions of the product cut-out) and the magnified spot's radius in frame pixels. */
  | { kind: "lens"; points: [number, number][]; r: number; map: { ox: number; oy: number; sx: number; sy: number } };

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
