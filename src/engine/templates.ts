import { cinematography, mixTransition, ZOOMS } from "./cinema";
import { clamp, hashString, rng } from "./math";
import type { FontId, Look, PaletteId, Scene, SkillId, Transition, VideoPlan } from "./types";

/**
 * Style templates for SaaS launch films. Each is a complete creative direction: palette,
 * typeface, background treatment, transition language, music and tempo, pacing, and which
 * skill plays each story role. Scenes carry a `role`, so switching templates restyles an
 * existing storyboard instantly without regenerating it.
 */

export type Role =
  | "hook"
  | "pain"
  | "reveal"
  | "meet"
  | "how"
  | "tour"
  | "bento"
  | "cards"
  | "quote"
  | "logos"
  | "stat"
  | "integrations"
  | "features"
  | "promise"
  | "demo"
  | "metric"
  | "gallery"
  | "reach"
  | "compare"
  | "solve"
  | "support"
  | "cta";

export type TemplateCategory = "Clean & Epic" | "Product Trailers" | "Modern" | "Clean & Light" | "Sci-Fi" | "3D" | "Bold & Playful" | "Cartoon" | "Premium";
export const TEMPLATE_CATEGORIES: TemplateCategory[] = ["Clean & Epic", "Product Trailers", "Modern", "Sci-Fi", "3D", "Clean & Light", "Bold & Playful", "Cartoon", "Premium"];

export interface Template {
  id: string;
  name: string;
  /** Gallery group (defaults to "Modern"). */
  category?: TemplateCategory;
  /** A movie-trailer cut: product videos open cold on close-ups (Trailer Cold Open) before the reveal. */
  trailer?: boolean;
  description: string;
  /** Creative brief handed to the AI director. */
  vibe: string;
  palette: PaletteId;
  font: FontId;
  bpm: number;
  music: "saas" | "trailer";
  flavor: NonNullable<VideoPlan["flavor"]>;
  look: Look;
  transitions: Transition[];
  /** Duration multiplier: <1 snappier, >1 more breathing room. */
  pace: number;
  /** Skill overrides per role (unlisted roles use the defaults). */
  roles: Partial<Record<Role, SkillId>>;
  /** Brand reveal when the site has no logo. */
  revealNoLogo: SkillId;
  /** Preview scene for the template gallery. */
  sample: Scene;
}

export const DEFAULT_ROLE_SKILL: Record<Role, SkillId> = {
  hook: "blur-reveal",
  pain: "pain-strike",
  reveal: "logo-reveal",
  meet: "site-scroll",
  how: "steps",
  tour: "ui-tour",
  bento: "bento",
  cards: "ui-cards",
  quote: "testimonial",
  logos: "logo-marquee",
  stat: "number-ticker",
  integrations: "integrations",
  features: "icon-features",
  promise: "word-swap",
  demo: "click-flow",
  metric: "chart-grow",
  gallery: "gallery-flow",
  reach: "globe",
  compare: "before-after",
  solve: "problem-solution",
  support: "support",
  cta: "cta",
};

/** Interaction moments: the director picks one per film to suit the product, and templates keep it. */
export const DEMO_SKILLS = new Set<SkillId>(["command-k", "ai-prompt", "click-flow", "notify-stack", "code-deploy", "kanban", "live-cursors", "chat-thread", "keycaps", "toggle-list", "changelog", "calendar-drop", "inbox-sweep", "comment-pins", "table-fill", "phone-tour", "drop-zone"]);

/** Base length of each role in beats (and a floor in seconds). */
function roleLength(scene: Scene, role: Role): [number, number] {
  switch (role) {
    case "pain":
      return [(scene.items?.length ?? 2) * 2 + 5, 4.5];
    case "hook":
      // The trailer cold open: two beats a shot, and the white-out into the reveal.
      if (scene.skill === "product-teaser") return [Math.max(1, Math.min(3, scene.items?.length ?? 1)) * 2.5 + 1.5, 3.4];
      return [7, 3.2];
    case "reveal":
      // Video in text needs time to hold the letters before diving through them.
      return scene.skill === "type-mask" ? [9, 4.2] : [6, 2.8];
    case "meet":
      return [10, 5];
    case "how":
      return scene.skill === "node-graph" ? [(scene.items?.length ?? 3) * 2 + 6, 5.2] : [(scene.items?.length ?? 3) * 2 + 4, 4.4];
    case "tour":
      return [12, 5.6];
    case "gallery":
      return [12, 5.8];
    case "reach":
      return [11, 5.4];
    case "compare":
      return [10, 5];
    case "solve":
      return [(scene.items?.length ?? 3) * 2.5 + 4, 5];
    case "support":
      return [12, 5.6];
    case "bento":
      return [10, 4.4];
    case "cards":
      return [9, 4.2];
    case "quote":
      return [10, 4.6];
    case "logos":
      return [7, 3.4];
    case "stat":
      return [6, 2.8];
    case "integrations":
      return [8, 3.8];
    case "promise":
      return [8, 3.8];
    case "features":
      if (scene.skill === "feature-slides") return [(scene.items?.length ?? 3) * 4.5 + 2, 6.4];
      return [(scene.items?.length ?? 4) * 1.5 + 6, 4.6];
    case "demo":
      if (scene.skill === "ai-prompt" || scene.skill === "code-deploy" || scene.skill === "kanban") return [12, 5.6];
      if (scene.skill === "chat-thread") return [11, 5.2];
      return scene.skill === "notify-stack" ? [(scene.items?.length ?? 4) * 1.2 + 5, 4.4] : [10, 4.8];
    case "metric":
      return [8, 4];
    case "cta":
      return [8, 3.6];
  }
}

const sample = (text: string, skill: SkillId = "blur-reveal", extra: Partial<Scene> = {}): Scene => ({
  skill,
  text,
  duration: 4.6,
  transition: "cut",
  eyebrow: "Introducing",
  ...extra,
});

/** The character slides for each part of the story (the cartoon styles). */
/** The advanced characters for each part of the story. */
// Cartoon styles give characters as many slides as they can (pictures, logos and QR codes keep
// theirs, with the companion character beside them: see companion.ts).
const PRO_ROLES: Template["roles"] = { hook: "pro-walk", pain: "pro-thinker", features: "pro-explainer", bento: "pro-explainer", how: "pro-explainer", cards: "pro-duo", quote: "pro-duo", solve: "pro-thinker", compare: "pro-thinker", promise: "pro-unveil", stat: "pro-explainer", metric: "pro-explainer", integrations: "pro-duo", support: "pro-duo", reach: "pro-walk", demo: "pro-explainer", cta: "pro-highfive" };
const ABS_ROLES: Template["roles"] = { hook: "abs-hello", pain: "abs-features", features: "abs-features", bento: "abs-features", how: "abs-parade", cards: "abs-crowd", quote: "abs-chat", solve: "abs-chat", compare: "abs-chat", promise: "abs-parade", stat: "abs-features", metric: "abs-features", integrations: "abs-crowd", support: "abs-chat", reach: "abs-crowd", demo: "abs-features", cta: "abs-cheer" };
const ROLES: Template["roles"] = { hook: "char-hello", pain: "char-aha", features: "char-presenter", cards: "char-team", bento: "char-presenter", how: "char-presenter", quote: "char-team", solve: "char-aha", compare: "char-aha", promise: "char-hello", stat: "char-presenter", metric: "char-presenter", integrations: "char-team", support: "char-desk", reach: "char-team", demo: "char-desk", cta: "char-cheer" };
/** The middle-of-the-story character slides of each family, to swap in for a repeat. */
const CHARACTER_POOLS = [
  ["char-presenter", "char-team", "char-aha", "char-desk"],
  ["pro-explainer", "pro-duo", "pro-thinker", "pro-unveil"],
  ["abs-features", "abs-crowd", "abs-chat", "abs-parade"],
] as SkillId[][];

export const TEMPLATES: Template[] = [
  {
    id: "midnight",
    name: "Midnight Grid",
    category: "Modern",
    description: "Dark developer-tool aesthetic: fine grid, travelling light beams, crisp Inter type.",
    vibe: "Precise, confident, engineered. Short declarative lines. Dark grid stage with beams; smooth dolly and whip moves.",
    palette: "midnight",
    font: "inter",
    bpm: 120,
    music: "saas",
    flavor: "tech",
    look: { grid: true, beams: 1, aurora: 1, text: "blur", grain: 0.8, shader: "mesh", shaderStrength: 0.9 },
    transitions: ["dolly", "whip", "push", "dissolve", "morph"],
    pace: 1,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Build what's *next*."),
  },
  {
    id: "aurora",
    name: "Aurora Gradient",
    category: "Modern",
    description: "Vibrant flowing gradients and soft light, no grid — polished fintech / platform launch.",
    vibe: "Optimistic and premium. Rich colour, flowing gradient light, generous pacing, warm light-leak transitions.",
    palette: "aurora",
    font: "inter",
    bpm: 116,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 1.9, text: "blur", grain: 0.6, shader: "warp", shaderStrength: 0.95 },
    transitions: ["leak", "dissolve", "dolly", "morph"],
    pace: 1.1,
    roles: { integrations: "integrations" },
    revealNoLogo: "logo-reveal",
    sample: sample("Money that moves at *internet speed*."),
  },
  {
    id: "paper",
    name: "Minimal Light",
    category: "Clean & Light",
    description: "Bright, airy and minimal: white stage, restrained colour, calm keynote pacing.",
    vibe: "Calm, human, minimal — like a product keynote. Few words, lots of space, gentle cuts, no hype.",
    palette: "paper",
    font: "inter",
    bpm: 104,
    music: "saas",
    flavor: "soft",
    look: { grid: true, beams: 0, aurora: 0.6, text: "mask", bokeh: false, grain: 0.3, shader: "mesh", shaderStrength: 0.7 },
    transitions: ["dissolve", "push", "cut", "swipe"],
    pace: 1.15,
    roles: { reveal: "logo-draw" },
    revealNoLogo: "logo-draw",
    sample: sample("Simple. Powerful. *Yours*."),
  },
  {
    id: "mono",
    name: "Mono Pro",
    category: "Modern",
    description: "Black and white with one accent, geometric type, tight rhythmic cuts.",
    vibe: "Sharp, minimal, technical. Monochrome with one red accent. Punchy short lines and hard cuts on the beat.",
    palette: "mono",
    font: "grotesk",
    bpm: 118,
    music: "saas",
    flavor: "minimal",
    look: { grid: true, beams: 2, aurora: 0.25, text: "mask", bokeh: false, grain: 1.4, vignette: 1.2, shader: "grain", shaderStrength: 0.55 },
    transitions: ["cut", "shutter", "push"],
    pace: 0.9,
    roles: { reveal: "logo-dots", promise: "slice-switch" },
    revealNoLogo: "logo-dots",
    sample: sample("Ship it. *Scale it.*"),
  },
  {
    id: "pop",
    name: "Bold Pop",
    category: "Bold & Playful",
    description: "Warm, colourful and playful: bouncy 3D type, confetti energy, snappy pacing.",
    vibe: "Friendly, playful, energetic consumer app. Punchy copy with personality, bouncy motion, quick whips.",
    palette: "sunset",
    font: "inter",
    bpm: 128,
    music: "saas",
    flavor: "pop",
    look: { grid: false, beams: 0, aurora: 1.4, text: "pop", grain: 0.5, shader: "mesh", shaderStrength: 1 },
    transitions: ["whip", "push", "zoom", "spin", "swipe"],
    pace: 0.85,
    roles: { promise: "rapid-fire", how: "arrow-rise" },
    revealNoLogo: "flip-3d",
    sample: sample("Plans with friends, *sorted*."),
  },
  {
    id: "cartoon",
    name: "Cartoon Pals",
    category: "Cartoon",
    description: "Friendly flat cartoon characters tell the story: a mascot says hello, a presenter explains, a team cheers you on.",
    vibe: "Warm, human and playful. Simple, friendly copy a child could read aloud; characters do the talking; bouncy motion.",
    palette: "pastel",
    font: "manrope",
    bpm: 118,
    music: "saas",
    flavor: "pop",
    look: { grid: false, beams: 0, aurora: 1.1, text: "pop", grain: 0.3, toon: "flat" },
    transitions: ["push", "swipe", "zoom", "dissolve"],
    pace: 1,
    roles: ROLES,
    revealNoLogo: "char-hello",
    sample: sample("Learning, *made friendly*."),
  },
  {
    id: "comic",
    name: "Comic Pop",
    category: "Cartoon",
    description: "A comic book: bold ink outlines and cel shading, halftone dots, punchy panels and hard-shadow speech bubbles.",
    vibe: "Loud, funny and bold like a comic strip. Short, punchy lines with exclamation energy; snappy whips and zooms.",
    palette: "brutal",
    font: "anton",
    bpm: 126,
    music: "saas",
    flavor: "pop",
    look: { grid: false, beams: 0, aurora: 0.4, backdrop: "dots", card: "brutal", text: "pop", grain: 0.4, toon: "comic" },
    transitions: ["whip", "zoom", "swipe", "flash"],
    pace: 0.9,
    roles: ROLES,
    revealNoLogo: "char-hello",
    sample: sample("Your new *sidekick*!"),
  },
  {
    id: "storybook",
    name: "Storybook",
    category: "Cartoon",
    description: "A picture book: hand-drawn ink characters that gently boil like animation frames, on warm paper with a classic serif.",
    vibe: "Gentle, cosy and wonder-filled, like a bedtime story. Calm, kind copy; soft dissolves and slow page-turn pacing.",
    palette: "cream",
    font: "playfair",
    bpm: 96,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0.5, backdrop: "plain", card: "flat", text: "blur", grain: 1.2, vignette: 0.8, toon: "doodle" },
    transitions: ["dissolve", "morph", "push"],
    pace: 1.15,
    roles: ROLES,
    revealNoLogo: "char-hello",
    sample: sample("Once upon a *better way*."),
  },
  {
    id: "claybuddies",
    name: "Clay Buddies",
    category: "Cartoon",
    description: "Soft clay characters with rounded 3D shading and gentle glossy highlights, on puffy clay cards and pastel colour.",
    vibe: "Squishy, cuddly and calm. Friendly, reassuring copy; soft, springy motion.",
    palette: "clay",
    font: "jost",
    bpm: 110,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0.9, card: "clay", text: "pop", grain: 0.2, shader: "mesh", shaderStrength: 0.45, toon: "soft" },
    transitions: ["push", "dolly", "dissolve"],
    pace: 1.05,
    roles: ROLES,
    revealNoLogo: "char-hello",
    sample: sample("Help that feels *soft*."),
  },
  {
    id: "sunnypark",
    name: "Sunny Park",
    category: "Cartoon",
    description: "Characters outdoors on a sunny day: blue sky and drifting clouds, green hills, a winding river and swaying trees.",
    vibe: "Fresh, outdoorsy and cheerful. Upbeat, simple copy; breezy pushes and swipes.",
    palette: "daybreak",
    font: "manrope",
    bpm: 116,
    music: "saas",
    flavor: "pop",
    look: { grid: false, beams: 0, aurora: 0, backdrop: "meadow", card: "flat", text: "pop", grain: 0.2, vignette: 0.4, toon: "flat" },
    transitions: ["push", "swipe", "dissolve", "zoom"],
    pace: 1,
    roles: ROLES,
    revealNoLogo: "char-hello",
    sample: sample("A brighter day, *outside*."),
  },
  {
    id: "nightowls",
    name: "Night Owls",
    category: "Cartoon",
    description: "Characters under a twinkling night sky: deep blue, soft starlight and glowing cards, for late-night and dreamy stories.",
    vibe: "Dreamy, quiet and magical. Short, soothing lines; slow dolly moves and dissolves.",
    palette: "midnight",
    font: "manrope",
    bpm: 100,
    music: "saas",
    flavor: "minimal",
    look: { grid: false, beams: 0, aurora: 0.8, backdrop: "stars", card: "glass", text: "glow", grain: 0.6, vignette: 1.1, toon: "flat" },
    transitions: ["dolly", "dissolve", "push"],
    pace: 1.1,
    roles: ROLES,
    revealNoLogo: "char-hello",
    sample: sample("Sweet dreams, *sorted*."),
  },
  {
    id: "explainer",
    name: "Explainer Studio",
    category: "Cartoon",
    description: "A narrated explainer with advanced characters: a host walks in, a presenter points things out, two people talk it through.",
    vibe: "Clear, friendly and human, like a good explainer video. Plain-spoken copy; characters walk, point and talk; calm pushes.",
    palette: "paper",
    font: "manrope",
    bpm: 112,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0.7, backdrop: "plain", card: "flat", text: "mask", grain: 0.2, toon: "flat" },
    transitions: ["push", "dissolve", "swipe"],
    pace: 1.1,
    roles: PRO_ROLES,
    revealNoLogo: "pro-unveil",
    sample: sample("Here's how it *works*."),
  },
  {
    id: "storycast",
    name: "Story Cast",
    category: "Cartoon",
    description: "Advanced characters outdoors: they walk across green hills by a winding river, talk, and high-five at the end.",
    vibe: "Warm, human and hopeful. Simple, conversational copy; characters act the story out under a big sky.",
    palette: "daybreak",
    font: "jost",
    bpm: 114,
    music: "saas",
    flavor: "pop",
    look: { grid: false, beams: 0, aurora: 0, backdrop: "meadow", card: "flat", text: "pop", grain: 0.2, vignette: 0.4, toon: "flat" },
    transitions: ["push", "swipe", "dissolve"],
    pace: 1.1,
    roles: PRO_ROLES,
    revealNoLogo: "pro-unveil",
    sample: sample("A better day *starts here*."),
  },
  {
    id: "abstract",
    name: "Abstract People",
    category: "Cartoon",
    description: "A modern, minimal character library: geometric people in bold colours, generated fresh for each video (remake for a new cast).",
    vibe: "Modern, inclusive and upbeat. Short, friendly copy; a crowd of simple shapes with personality does the talking.",
    palette: "swiss",
    font: "jost",
    bpm: 120,
    music: "saas",
    flavor: "pop",
    look: { grid: false, beams: 0, aurora: 0.5, text: "pop", grain: 0.15, toon: "flat" },
    transitions: ["push", "swipe", "zoom", "dissolve"],
    pace: 1,
    roles: ABS_ROLES,
    revealNoLogo: "abs-hello",
    sample: sample("Made for *your team*."),
  },
  {
    id: "memphis",
    name: "Memphis Crowd",
    category: "Cartoon",
    description: "The modern Corporate Memphis look: people with tiny heads, long bendy limbs and big hands on a warm, dotted stage, parading, holding up signs and cheering.",
    vibe: "Bold, friendly and on-trend. Punchy copy; stylised people, confident colour and bouncy motion.",
    palette: "cream",
    font: "manrope",
    bpm: 124,
    music: "saas",
    flavor: "pop",
    look: { grid: false, beams: 0, aurora: 0.3, backdrop: "dots", text: "pop", grain: 0.3, toon: "flat", people: "memphis" },
    transitions: ["push", "swipe", "zoom"],
    pace: 1.05,
    roles: ABS_ROLES,
    revealNoLogo: "abs-hello",
    sample: sample("Join the *crowd*."),
  },
  {
    id: "keynote",
    name: "Cinematic Keynote",
    category: "Premium",
    description: "Epic launch keynote: volumetric light, slow pull-backs and a cinematic trailer score.",
    vibe: "Grand and cinematic, like a flagship launch event. Big statements, dramatic light, slower pacing, trailer music.",
    palette: "midnight",
    font: "inter",
    bpm: 96,
    music: "trailer",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.8, text: "glow", grain: 1, vignette: 1.4, shader: "rays", shaderStrength: 0.9 },
    transitions: ["dissolve", "leak", "dolly", "morph", "iris"],
    pace: 1.2,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("The next era of *work* begins."),
  },
  {
    id: "neon",
    name: "Neon Tech",
    category: "Sci-Fi",
    description: "Cyber-neon AI / security vibe: dense beams, glitch cuts, electric colour.",
    vibe: "Futuristic AI and security. Electric neon, dense light beams, glitch and whip cuts, fast tempo.",
    palette: "cyber",
    font: "grotesk",
    bpm: 128,
    music: "saas",
    flavor: "neon",
    look: { grid: true, beams: 2.5, aurora: 1.2, text: "blur", grain: 1, shader: "neuro", shaderStrength: 0.85 },
    transitions: ["glitch", "whip", "dolly"],
    pace: 0.95,
    roles: { promise: "jump-cut" },
    revealNoLogo: "logo-reveal",
    sample: sample("Security that thinks *ahead*."),
  },
  {
    id: "frosted",
    name: "Frosted Glass",
    category: "Clean & Light",
    description: "Glassmorphism: pastel colour blobs drifting behind frosted, translucent cards. Soft and modern.",
    vibe: "Light, friendly and modern. Airy pastel colour, frosted glass UI, smooth dissolves, optimistic copy.",
    palette: "pastel",
    font: "inter",
    bpm: 110,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 1, backdrop: "blobs", card: "frost", text: "blur", bokeh: false, grain: 0.3, shader: "mesh", shaderStrength: 1 },
    transitions: ["dissolve", "push", "dolly", "iris"],
    pace: 1.05,
    roles: { reveal: "logo-morph" },
    revealNoLogo: "logo-morph",
    sample: sample("Work that feels *calm*."),
  },
  {
    id: "enterprise",
    name: "Enterprise Clean",
    category: "Clean & Light",
    description: "Trustworthy B2B: white stage, dot grid, crisp flat cards and confident blue. Salesforce / HubSpot energy.",
    vibe: "Credible, clear and reassuring for business buyers. Plain-spoken benefit headlines, proof and numbers, calm pushes.",
    palette: "enterprise",
    font: "inter",
    bpm: 108,
    music: "saas",
    flavor: "minimal",
    look: { grid: false, beams: 0, aurora: 0.5, backdrop: "dots", card: "flat", text: "mask", bokeh: false, grain: 0.2, shader: "grain", shaderStrength: 0.85 },
    transitions: ["push", "dissolve", "cut"],
    pace: 1.05,
    roles: { reveal: "logo-wipe", bento: "spec-sheet" },
    revealNoLogo: "logo-wipe",
    sample: sample("Revenue, *finally in sync*."),
  },
  {
    id: "terminal",
    name: "Dev Terminal",
    category: "Sci-Fi",
    description: "For developer tools: CRT scanlines, phosphor green, monospace type that types itself out.",
    vibe: "Written for engineers: terse, technical, a little dry. Commands, not slogans. Glitch and hard cuts.",
    palette: "terminal",
    font: "mono",
    bpm: 124,
    music: "saas",
    flavor: "neon",
    look: { grid: false, beams: 0, aurora: 0.3, backdrop: "scanlines", card: "flat", text: "type", bokeh: false, grain: 1.2, vignette: 1.4 },
    transitions: ["cut", "glitch", "shutter"],
    pace: 0.95,
    roles: { promise: "split-flap" },
    revealNoLogo: "logo-reveal",
    sample: sample("npm run *launch*"),
  },
  {
    id: "kinetic",
    name: "Kinetic Type",
    category: "Bold & Playful",
    description: "Huge bold words slamming in on the beat, black and electric yellow. The Figma / Framer promo look.",
    vibe: "Loud, confident and fast. Two-to-five word punches, huge type, hard cuts and whips exactly on the beat.",
    palette: "volt",
    font: "grotesk",
    bpm: 132,
    music: "saas",
    flavor: "pop",
    look: { grid: false, beams: 0, aurora: 0.2, backdrop: "plain", card: "flat", text: "pop", textScale: 1.35, bokeh: false, grain: 0.8, shader: "grain", shaderStrength: 0.55 },
    transitions: ["cut", "whip", "zoom", "split", "spin"],
    pace: 0.8,
    roles: { reveal: "logo-shapes", promise: "type-rows" },
    revealNoLogo: "logo-shapes",
    sample: sample("Design. Ship. *Repeat.*"),
  },
  {
    id: "brutalist",
    name: "Neo-Brutalist",
    category: "Bold & Playful",
    description: "Bold yellow, thick black outlines and hard offset shadows. Playful indie-SaaS / Gumroad style.",
    vibe: "Cheeky, direct and indie. Short punchy lines with personality, chunky UI, snappy pushes and cuts.",
    palette: "brutal",
    font: "grotesk",
    bpm: 124,
    music: "saas",
    flavor: "pop",
    look: { grid: false, beams: 0, aurora: 0, backdrop: "dots", card: "brutal", text: "pop", textScale: 1.1, bokeh: false, grain: 0.2, vignette: 0.4 },
    transitions: ["cut", "push", "zoom", "split"],
    pace: 0.9,
    roles: { promise: "poster-grid" },
    revealNoLogo: "flip-3d",
    sample: sample("No fluff. *Just results.*"),
  },
  {
    id: "editorial",
    name: "Editorial Serif",
    category: "Premium",
    description: "Warm cream paper, elegant serif headlines and unhurried dissolves. Premium, story-first brands.",
    vibe: "Thoughtful and premium, like a magazine feature. Elegant, human sentences; slow, confident pacing.",
    palette: "cream",
    font: "serif",
    bpm: 96,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0.35, backdrop: "plain", card: "flat", text: "mask", textScale: 1.12, bokeh: false, grain: 0.7, vignette: 0.6, shader: "grain", shaderStrength: 0.9 },
    transitions: ["dissolve", "leak", "push", "swipe"],
    pace: 1.15,
    roles: { reveal: "logo-type", promise: "type-poster" },
    revealNoLogo: "logo-type",
    sample: sample("Crafted for the *curious*."),
  },
  {
    id: "aiglow",
    name: "AI Glow",
    category: "Modern",
    description: "The AI-startup launch look: deep violet, glowing orange-pink gradients, soft blobs and glowing type.",
    vibe: "Visionary AI launch. Big promises grounded in the product, glowing reveals, smooth dolly moves.",
    palette: "violet",
    font: "inter",
    bpm: 118,
    music: "saas",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.7, backdrop: "blobs", card: "frost", text: "glow", grain: 0.8, vignette: 1.3, shader: "smoke", shaderStrength: 1 },
    transitions: ["dolly", "dissolve", "leak", "morph"],
    pace: 1,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Your new *AI teammate*."),
  },
  {
    id: "spatial",
    name: "3D Spatial",
    category: "3D",
    description: "The product floats on a tilted 3D plane that slowly orbits, over glowing 3D light panels. Vision Pro-style depth.",
    vibe: "Immersive and futuristic but calm. Short confident lines, the product front and centre in 3D space, smooth dolly moves.",
    palette: "spatial",
    font: "inter",
    bpm: 116,
    music: "saas",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.4, card: "glass", text: "blur", grain: 0.6, shader: "panels", shaderStrength: 1, depth: 14 },
    transitions: ["dolly", "push", "dissolve", "portal", "spin"],
    pace: 1.05,
    roles: { reveal: "logo-layers" },
    revealNoLogo: "logo-layers",
    sample: sample("Work in a *new dimension*."),
  },
  {
    id: "epic",
    name: "Epic Launch",
    category: "Premium",
    description: "Trailer-grade SaaS: light rays, big streaking type, punchy zoom and flash cuts, a subtle 3D tilt and a cinematic score with hits.",
    vibe: "Epic and cinematic, like a keynote trailer. Bold short lines (3–6 words), big moments, cuts on the hits.",
    palette: "midnight",
    font: "inter",
    bpm: 112,
    music: "trailer",
    flavor: "tech",
    look: { grid: false, beams: 1, aurora: 0.6, card: "glass", text: "streak", textScale: 1.12, grain: 0.9, vignette: 1.4, shader: "rays", shaderStrength: 0.9, depth: 6 },
    transitions: ["zoom", "flash", "whip", "dolly", "portal"],
    pace: 0.95,
    roles: { reveal: "logo-stage" },
    revealNoLogo: "logo-stage",
    sample: sample("The future of work *starts now*."),
  },
  {
    id: "turntable",
    name: "3D Turntable",
    category: "3D",
    description: "Shots sit on panels turned in 3D perspective, swinging slowly like a product on a turntable, with a floor reflection and cube turns between scenes.",
    vibe: "Premium product-launch showroom. Confident short lines, the product presented like hardware on a stage, smooth 3D turns.",
    palette: "midnight",
    font: "inter",
    bpm: 118,
    music: "saas",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.45, card: "glass", text: "blur", grain: 0.5, vignette: 1.1, shader: "rays", shaderStrength: 0.8, turn: 16 },
    transitions: ["cube", "dolly", "cube", "push"],
    pace: 1,
    roles: { reveal: "logo-spin" },
    revealNoLogo: "logo-spin",
    sample: sample("Built for the *main stage*."),
  },
  {
    id: "slab",
    name: "3D Glass Slab",
    category: "3D",
    description: "Shots are thick floating glass slabs tilted in 3D, bobbing gently over a soft floor shadow.",
    vibe: "Tactile, modern and crafted. Clean short lines, UI presented as physical objects, gentle dolly and push moves.",
    palette: "violet",
    font: "grotesk",
    bpm: 116,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0.5, card: "frost", text: "pop", grain: 0.4, shader: "mesh", shaderStrength: 0.85, slab: true },
    transitions: ["dolly", "push", "dissolve", "portal"],
    pace: 1,
    roles: { reveal: "logo-flip" },
    revealNoLogo: "logo-flip",
    sample: sample("Software you can *almost touch*."),
  },
  {
    id: "hud",
    name: "Sci-Fi HUD",
    category: "Sci-Fi",
    description: "Mission-control HUD: corner brackets, live timecode and readouts, scan lines, glowing voronoi cells, typed text.",
    vibe: "Tactical and precise, like a spacecraft interface. Terse system-style copy, glitch cuts, data on screen.",
    palette: "hud",
    font: "mono",
    bpm: 126,
    music: "saas",
    flavor: "neon",
    look: { grid: false, beams: 0, aurora: 0.3, card: "flat", text: "type", grain: 1, vignette: 1.4, shader: "voronoi", shaderStrength: 0.55, overlay: "hud" },
    transitions: ["glitch", "shutter", "cut"],
    pace: 0.95,
    roles: { promise: "speed-gauge" },
    revealNoLogo: "logo-reveal",
    sample: sample("Threat detected. *Neutralised.*"),
  },
  {
    id: "warp",
    name: "Warp Drive",
    category: "Sci-Fi",
    description: "Light-speed: streaks of starlight rush out of a glowing vanishing point while headlines fly in on motion streaks. Electric blue.",
    vibe: "Fast and thrilling, a jump to light speed. Short punchy lines, zoom and flash cuts on the beat.",
    palette: "ion",
    font: "grotesk",
    bpm: 128,
    music: "saas",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.3, backdrop: "warp", card: "glass", text: "streak", grain: 0.8, vignette: 1.35 },
    transitions: ["zoom", "flash", "dolly"],
    pace: 0.92,
    roles: { reveal: "logo-tunnel" },
    revealNoLogo: "logo-tunnel",
    sample: sample("Ready for *lightspeed*.", "blur-reveal", { eyebrow: "Engage" }),
  },
  {
    id: "planetfall",
    name: "Planetfall",
    category: "Sci-Fi",
    description: "A ringed planet rises at the foot of the frame, its atmosphere lit and a moon on its orbit, over a field of stars. Glowing reveals in rust and amber.",
    vibe: "Vast and cinematic, like the opening of a space epic. Calm, confident lines with room to breathe, slow dissolves.",
    palette: "mars",
    font: "grotesk",
    bpm: 100,
    music: "trailer",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0.35, backdrop: "planet", card: "glass", text: "glow", grain: 0.9, vignette: 1.3 },
    transitions: ["dissolve", "dolly", "leak"],
    pace: 1.08,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("A new world, *within reach*.", "blur-reveal", { eyebrow: "Arriving" }),
  },
  {
    id: "wormhole",
    name: "Wormhole",
    category: "Sci-Fi",
    description: "A tunnel of light rings rushes towards the camera, twisting as it goes, and type converges out of an RGB split. Violet and pink.",
    vibe: "Mind-bending and futuristic. Short lines that feel like a jump through space, zooms and liquid cuts.",
    palette: "nebula",
    font: "inter",
    bpm: 120,
    music: "saas",
    flavor: "neon",
    look: { grid: false, beams: 0, aurora: 0.35, backdrop: "wormhole", card: "glass", text: "chroma", grain: 0.8, vignette: 1.35 },
    transitions: ["zoom", "liquid", "dolly"],
    pace: 1,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Step *through*.", "blur-reveal", { eyebrow: "Next dimension" }),
  },
  {
    id: "datarain",
    name: "Data Rain",
    category: "Sci-Fi",
    description: "Columns of glowing glyphs stream down the screen behind flat terminal cards, and headlines decode themselves out of scrambled characters. Acid green.",
    vibe: "Hacker cinema: mysterious, precise, a little ominous. Terse lines, glitch and shutter cuts.",
    palette: "xeno",
    font: "mono",
    bpm: 130,
    music: "saas",
    flavor: "neon",
    look: { grid: false, beams: 0, aurora: 0.25, backdrop: "rain", card: "flat", text: "decode", grain: 1.1, vignette: 1.45 },
    transitions: ["glitch", "shutter", "cut"],
    pace: 0.94,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Follow *the signal*.", "blur-reveal", { eyebrow: "Incoming" }),
  },
  {
    id: "quantum",
    name: "Quantum Mesh",
    category: "Sci-Fi",
    description: "A cloud of glowing nodes turns slowly in 3D, linked to its neighbours by threads of light, while words light up one by one. Deep space blue.",
    vibe: "Intelligent and connected: AI, data and networks. Measured lines, smooth dissolves and dolly moves.",
    palette: "cosmos",
    font: "inter",
    bpm: 112,
    music: "saas",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.4, backdrop: "plexus", card: "glass", text: "focus", grain: 0.7, vignette: 1.25 },
    transitions: ["dissolve", "dolly", "zoom"],
    pace: 1.02,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Your work, *connected*.", "blur-reveal", { eyebrow: "Introducing" }),
  },
  {
    id: "bridge",
    name: "Starship Bridge",
    category: "Sci-Fi",
    description: "The view from the bridge: stars streaking past at warp behind a mission HUD of brackets, timecode and readouts, with typed system text.",
    vibe: "Command-deck calm at high speed. Terse, system-style lines, glitch and zoom cuts.",
    palette: "hud",
    font: "mono",
    bpm: 124,
    music: "saas",
    flavor: "neon",
    look: { grid: false, beams: 0, aurora: 0.25, backdrop: "warp", card: "flat", text: "type", grain: 1, vignette: 1.4, overlay: "hud" },
    transitions: ["glitch", "zoom", "cut"],
    pace: 0.96,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Course set. *Engage.*", "blur-reveal", { eyebrow: "Bridge" }),
  },
  {
    id: "swiss",
    name: "Swiss Clean",
    category: "Clean & Light",
    description: "International-style layout: white stage, hairline frame with corner labels, big grotesk type, one red accent.",
    vibe: "Rational, crisp and typographic. Few words set big, strict hierarchy, hard cuts and pushes.",
    palette: "swiss",
    font: "grotesk",
    bpm: 112,
    music: "saas",
    flavor: "minimal",
    look: { grid: false, beams: 0, aurora: 0, backdrop: "plain", card: "flat", text: "mask", textScale: 1.2, grain: 0.2, vignette: 0.3, overlay: "frame" },
    transitions: ["cut", "push", "split"],
    pace: 0.95,
    roles: { reveal: "logo-slices", bento: "card-system" },
    revealNoLogo: "logo-slices",
    sample: sample("Less, but *considered*."),
  },
  {
    id: "clay",
    name: "Clay 3D",
    category: "Bold & Playful",
    description: "Soft 3D claymorphism: puffy extruded cards, gooey 3D metaballs and bouncy type in warm pastels.",
    vibe: "Friendly, tactile and delightful. Warm playful copy, bouncy motion, soft pushes and zooms.",
    palette: "clay",
    font: "inter",
    bpm: 118,
    music: "saas",
    flavor: "pop",
    look: { grid: false, beams: 0, aurora: 0.5, card: "clay", text: "pop", grain: 0.2, vignette: 0.3, shader: "metaballs", shaderStrength: 0.9, depth: 7 },
    transitions: ["push", "zoom", "dissolve", "swipe", "iris"],
    pace: 0.95,
    roles: { reveal: "logo-pop", promise: "stretch-snap" },
    revealNoLogo: "logo-pop",
    sample: sample("Software that feels *squishy*."),
  },
  {
    id: "chrome",
    name: "Liquid Chrome",
    category: "3D",
    description: "Y2K-meets-2026: molten chrome swirls, iridescent glow and glowing reveals on graphite.",
    vibe: "Sleek, glossy and fashion-forward. Bold short statements, glowing reveals, fast dolly and whip moves.",
    palette: "chrome",
    font: "grotesk",
    bpm: 122,
    music: "saas",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.4, card: "frost", text: "glow", grain: 0.7, vignette: 1.2, shader: "swirl", shaderStrength: 0.95 },
    transitions: ["dolly", "whip", "dissolve", "spin"],
    pace: 1,
    roles: { reveal: "logo-extrude" },
    revealNoLogo: "logo-extrude",
    sample: sample("Polished to *perfection*."),
  },
  {
    id: "liquid",
    name: "Liquid Motion",
    category: "Modern",
    description: "It flows: headlines pour in as glossy liquid, and scenes rise in on a fast liquid wave over fluid metaball gradients.",
    vibe: "Fluid, fast and playful-premium. Short punchy lines, quick liquid reveals and liquid wave transitions between scenes.",
    palette: "ocean",
    font: "inter",
    bpm: 126,
    music: "saas",
    flavor: "pop",
    look: { grid: false, beams: 0, aurora: 0.35, card: "frost", text: "liquid", grain: 0.5, shader: "metaballs", shaderStrength: 0.85, shaderSpeed: 1.3 },
    transitions: ["liquid"],
    pace: 0.92,
    roles: { reveal: "liquid-logo" },
    revealNoLogo: "liquid-logo",
    sample: sample("Ideas that *flow*."),
  },
  {
    id: "holo",
    name: "Holographic",
    category: "3D",
    description: "Iridescent holo-foil gradients with frosted glass UI on a gently orbiting 3D plane.",
    vibe: "Dreamy, premium and futuristic. Elegant lines, shimmering light, slow dissolves and dollies.",
    palette: "holo",
    font: "inter",
    bpm: 112,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0.5, card: "frost", text: "blur", grain: 0.6, shader: "warp", shaderStrength: 0.9, depth: 10 },
    transitions: ["dissolve", "dolly", "leak"],
    pace: 1.05,
    roles: { promise: "cube-spin" },
    revealNoLogo: "logo-reveal",
    sample: sample("The future, *in full colour*."),
  },
  {
    id: "dither",
    name: "Retro Dither",
    category: "Bold & Playful",
    description: "1-bit dithered gradients in ink and lime, pixel-crisp monospace that types itself out. The AI-lab indie look.",
    vibe: "Nerdy, cool and understated. Lowercase-friendly terse copy, typed text, hard cuts and glitches.",
    palette: "dither",
    font: "mono",
    bpm: 124,
    music: "saas",
    flavor: "minimal",
    look: { grid: false, beams: 0, aurora: 0.2, card: "flat", text: "type", grain: 0.4, vignette: 1, shader: "dither", shaderStrength: 0.8 },
    transitions: ["cut", "glitch", "shutter"],
    pace: 0.95,
    roles: { promise: "speed-type" },
    revealNoLogo: "logo-reveal",
    sample: sample("thinking in *pixels*."),
  },
  {
    id: "horizon",
    name: "Synthwave 3D",
    category: "Sci-Fi",
    description: "Retro-futurist 3D: a neon grid floor racing to a glowing horizon, content on a tilted plane.",
    vibe: "Nostalgic, energetic and cinematic. Big bold lines, neon glow, whip and zoom cuts on the beat.",
    palette: "synthwave",
    font: "grotesk",
    bpm: 118,
    music: "saas",
    flavor: "neon",
    look: { grid: false, beams: 0, aurora: 0.6, backdrop: "horizon", card: "glass", text: "glow", grain: 1, vignette: 1.2, depth: 9 },
    transitions: ["whip", "zoom", "dolly", "portal"],
    pace: 0.95,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Drive into *tomorrow*."),
  },
  {
    id: "cosmic",
    name: "Deep Space",
    category: "Sci-Fi",
    description: "A calm cosmic stage: parallax starfield drifting over a deep nebula gradient, with glowing type.",
    vibe: "Awe-inspiring and calm. Big-picture statements, slow reveals, gentle dissolves.",
    palette: "cosmos",
    font: "inter",
    bpm: 100,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0.5, backdrop: "stars", card: "glass", text: "glow", grain: 0.8, vignette: 1.3, shader: "mesh", shaderStrength: 0.6 },
    transitions: ["dissolve", "dolly", "leak"],
    pace: 1.1,
    roles: { reveal: "logo-orbit" },
    revealNoLogo: "logo-orbit",
    sample: sample("Built for *infinite scale*."),
  },
  {
    id: "luxe",
    name: "Luxe Noir",
    category: "Premium",
    description: "Black and champagne gold, elegant serif, fine flowing line waves and a hairline frame. Luxury-brand restraint.",
    vibe: "Exclusive, refined and quiet. Few elegant words, generous space, slow dissolves and light leaks.",
    palette: "gold",
    font: "serif",
    bpm: 92,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0.3, backdrop: "plain", card: "flat", text: "mask", textScale: 1.12, grain: 0.9, vignette: 1.3, shader: "waves", shaderStrength: 0.5, overlay: "frame" },
    transitions: ["dissolve", "leak"],
    pace: 1.15,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Quietly *exceptional*."),
  },
  {
    id: "eclipse",
    name: "Eclipse",
    category: "Clean & Epic",
    description: "A planet's glowing rim rises at the foot of the frame on near-black, with soft blur-in type, glass UI and the product leaning back on a 3D stage. The Linear launch look.",
    vibe: "Calm, precise and cinematic. Short confident lines with lots of space, slow dolly moves and soft dissolves.",
    palette: "eclipse",
    font: "inter",
    bpm: 108,
    music: "saas",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.25, backdrop: "eclipse", card: "glass", text: "blur", textScale: 1.08, grain: 0.7, vignette: 1.2, depth: 8 },
    transitions: ["dolly", "dissolve", "push"],
    pace: 1.02,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("A new *horizon* for your team."),
  },
  {
    id: "studio",
    name: "Studio White",
    category: "Clean & Epic",
    description: "A bright seamless studio with a soft key-light pool and floor shadow, huge crisp type and frosted UI. The Apple keynote reveal.",
    vibe: "Bright, premium and effortless. Very few words set very big, gentle dollies and dissolves, generous holds.",
    palette: "studio",
    font: "inter",
    bpm: 100,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0, backdrop: "studio", card: "frost", text: "mask", textScale: 1.22, bokeh: false, grain: 0.2, vignette: 0.4, depth: 8 },
    transitions: ["dolly", "dissolve", "push", "morph"],
    pace: 1.08,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Simply *brilliant*."),
  },
  {
    id: "flow",
    name: "Gradient Flow",
    category: "Clean & Epic",
    description: "Vivid silk-gradient bands flow across the top and foot of a clean white stage, with shining type and crisp cards. The Stripe look.",
    vibe: "Polished, optimistic and fast-moving. Clear benefit-led lines, shine reveals, smooth pushes and whips.",
    palette: "flow",
    font: "grotesk",
    bpm: 118,
    music: "saas",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0, backdrop: "ribbon", card: "flat", text: "shine", textScale: 1.08, bokeh: false, grain: 0.2, vignette: 0.3, depth: 6 },
    transitions: ["push", "whip", "dolly", "morph", "swipe"],
    pace: 0.95,
    roles: { promise: "slipstream" },
    revealNoLogo: "logo-reveal",
    sample: sample("Payments, *beautifully* simple."),
  },
  {
    id: "ink",
    name: "Ink & Light",
    category: "Clean & Epic",
    description: "Pure black and white: one cone of light falls onto a floor glow with a faint spectral fringe, focus-pull type and hairline cards. The Vercel look.",
    vibe: "Minimal, sharp and developer-grade. Terse lines, focus pulls, tight cuts and pushes on the beat.",
    palette: "ink",
    font: "grotesk",
    bpm: 124,
    music: "saas",
    flavor: "minimal",
    look: { grid: false, beams: 0, aurora: 0, backdrop: "beam", card: "flat", text: "focus", textScale: 1.1, grain: 0.8, vignette: 1.3, depth: 6 },
    transitions: ["cut", "push", "zoom", "split"],
    pace: 0.94,
    roles: { reveal: "logo-draw" },
    revealNoLogo: "logo-draw",
    sample: sample("Ship at the *speed of light*."),
  },
  {
    id: "bloom",
    name: "Colour Bloom",
    category: "Clean & Epic",
    description: "A large orb of slowly turning colour blooms up behind the headline on deep ink, with glowing type, frosted UI and a cinematic score. The Raycast / Arc launch look.",
    vibe: "Vivid, confident and a little magical. Punchy lines that glow in, dollies and zooms, light leaks on the big moments.",
    palette: "bloom",
    font: "inter",
    bpm: 110,
    music: "trailer",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.2, backdrop: "bloom", card: "frost", text: "glow", textScale: 1.1, grain: 0.8, vignette: 1.3, depth: 8 },
    transitions: ["dolly", "zoom", "leak", "iris"],
    pace: 1,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Your work, *in full colour*."),
  },
  {
    id: "daybreak",
    name: "Daybreak",
    category: "Clean & Epic",
    description: "A warm sunrise arc glows over a soft cream stage, with highlighted keywords, frosted cards and friendly pacing. Notion / Framer warmth with a cinematic lift.",
    vibe: "Warm, hopeful and human. Plain friendly language, key words highlighted, smooth pushes and dissolves.",
    palette: "daybreak",
    font: "grotesk",
    bpm: 112,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0.3, backdrop: "eclipse", card: "frost", text: "highlight", textScale: 1.1, bokeh: false, grain: 0.3, vignette: 0.4, depth: 6 },
    transitions: ["push", "dissolve", "dolly", "morph"],
    pace: 1,
    roles: { reveal: "logo-wipe" },
    revealNoLogo: "logo-wipe",
    sample: sample("A brighter way to *work*."),
  },
  {
    id: "drop",
    name: "Hero Drop",
    category: "Product Trailers",
    trailer: true,
    description: "The product launch trailer: a cold open of close-ups cut on the hits, light rays, streaking type and a flash cut to the product, with a cinematic score.",
    vibe: "Epic and cinematic, like a flagship product trailer. One or two words a shot, big moments, cuts on the hits.",
    palette: "midnight",
    font: "cinzel",
    bpm: 112,
    music: "trailer",
    flavor: "tech",
    look: { grid: false, beams: 1, aurora: 0.4, card: "glass", text: "streak", textScale: 1.12, grain: 0.9, vignette: 1.5, shader: "rays", shaderStrength: 0.85, depth: 6 },
    transitions: ["flash", "zoom", "whip", "spin"],
    pace: 0.95,
    roles: { promise: "stack-stomp" },
    revealNoLogo: "logo-reveal",
    sample: sample("Built *different*.", "blur-reveal", { eyebrow: "Coming soon" }),
  },
  {
    id: "spotlight",
    name: "Spotlight",
    category: "Product Trailers",
    trailer: true,
    description: "Pure black and one cone of light: the product steps into the spotlight between hard cuts, with focus-pull type and a slow, heavy trailer score.",
    vibe: "Dramatic and minimal. Very few words, long holds in the light, hard cuts and slow zooms.",
    palette: "ink",
    font: "cinzel",
    bpm: 100,
    music: "trailer",
    flavor: "minimal",
    look: { grid: false, beams: 0, aurora: 0, backdrop: "beam", card: "flat", text: "focus", textScale: 1.14, grain: 1, vignette: 1.5, depth: 8 },
    transitions: ["cut", "zoom", "dissolve", "iris"],
    pace: 1.05,
    roles: { promise: "rack-focus" },
    revealNoLogo: "logo-reveal",
    sample: sample("Step into the *light*.", "blur-reveal", { eyebrow: "In the spotlight" }),
  },
  {
    id: "noir",
    name: "Noir Gold",
    category: "Product Trailers",
    trailer: true,
    description: "A luxury trailer: black and gold, a soft beam of light, elegant serif type that unmasks, slow dissolves and light leaks. For beauty, fragrance, jewellery and premium goods.",
    vibe: "Luxurious, slow and seductive. Short elegant lines, long dissolves, warm light leaks.",
    palette: "gold",
    font: "serif",
    bpm: 90,
    music: "trailer",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0.2, backdrop: "beam", card: "flat", text: "mask", textScale: 1.1, grain: 1, vignette: 1.5 },
    transitions: ["dissolve", "leak", "flash"],
    pace: 1.12,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Pure *indulgence*.", "blur-reveal", { eyebrow: "The collection" }),
  },
  {
    id: "blockbuster",
    name: "Blockbuster",
    category: "Product Trailers",
    trailer: true,
    description: "Summer-blockbuster energy: fiery orange light, smoke, condensed headline type, whip pans, flash cuts and light leaks on a driving score.",
    vibe: "Loud, bold and fast. Punchy two-word lines in big condensed type, whips and flashes on the hits.",
    palette: "inferno",
    font: "bebas",
    bpm: 124,
    music: "trailer",
    flavor: "tech",
    look: { grid: false, beams: 0.6, aurora: 0.5, card: "glass", text: "streak", textScale: 1.16, grain: 1, vignette: 1.6, shader: "smoke", shaderStrength: 0.7, depth: 6 },
    transitions: ["whip", "flash", "leak", "zoom"],
    pace: 0.9,
    roles: { promise: "crash-zoom", reveal: "logo-shatter" },
    revealNoLogo: "logo-shatter",
    sample: sample("Bring the *heat*.", "blur-reveal", { eyebrow: "This summer" }),
  },
  {
    id: "neondrop",
    name: "Neon Drop",
    category: "Product Trailers",
    trailer: true,
    description: "A gaming-gear trailer: neon on black, glitch and flash cuts, chromatic type and a fast cyber score. For gadgets, gaming and tech accessories.",
    vibe: "Fast, electric and techy. Very short lines, glitch cuts on the hits, neon colour.",
    palette: "cyber",
    font: "grotesk",
    bpm: 128,
    music: "trailer",
    flavor: "tech",
    look: { grid: false, beams: 1.5, aurora: 0.8, card: "glass", text: "chroma", textScale: 1.1, grain: 1, vignette: 1.4, shader: "neuro", shaderStrength: 0.6, depth: 6 },
    transitions: ["glitch", "flash", "whip"],
    pace: 0.9,
    roles: { promise: "zoom-through" },
    revealNoLogo: "logo-reveal",
    sample: sample("Level *up*.", "blur-reveal", { eyebrow: "Next gen" }),
  },
];

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<string, Template>;
export const DEFAULT_TEMPLATE = "midnight";

export const SKILL_ROLE: Partial<Record<SkillId, Role>> = {
  "blur-reveal": "hook",
  "pain-strike": "pain",
  "logo-reveal": "reveal",
  "logo-extrude": "reveal",
  "logo-spin": "reveal",
  "logo-shatter": "reveal",
  "logo-orbit": "reveal",
  "logo-stage": "reveal",
  "logo-layers": "reveal",
  "logo-tunnel": "reveal",
  "logo-flip": "reveal",
  "logo-draw": "reveal",
  "logo-wipe": "reveal",
  "logo-pop": "reveal",
  "logo-morph": "reveal",
  "logo-slices": "reveal",
  "logo-dots": "reveal",
  "logo-type": "reveal",
  "logo-shapes": "reveal",
  "particle-assemble": "reveal",
  "site-scroll": "meet",
  steps: "how",
  "ui-tour": "tour",
  bento: "bento",
  "ui-cards": "cards",
  "icon-features": "features",
  "word-swap": "promise",
  "type-rows": "promise",
  "type-poster": "promise",
  showreel: "features",
  "card-system": "bento",
  "poster-grid": "promise",
  "poster-split": "promise",
  "type-echo": "promise",
  "type-slots": "promise",
  "rapid-fire": "promise",
  "flip-switch": "promise",
  "zoom-through": "promise",
  "slice-switch": "promise",
  "style-shuffle": "promise",
  "split-flap": "promise",
  "whip-pan": "promise",
  "stack-stomp": "promise",
  "speed-ticker": "promise",
  "cube-spin": "promise",
  "speed-type": "promise",
  "bar-wipe": "promise",
  "crash-zoom": "promise",
  "word-grid": "promise",
  "orbit-text": "promise",
  "tape-rush": "promise",
  "jump-cut": "promise",
  "letter-rush": "promise",
  "stamp-rush": "promise",
  "rally": "promise",
  "spiral-in": "promise",
  "speed-gauge": "promise",
  "domino": "promise",
  "slipstream": "promise",
  "stretch-snap": "promise",
  "rack-focus": "promise",
  "card-stack": "features",
  "contact-sheet": "features",
  "spec-sheet": "bento",
  "widget-set": "bento",
  testimonial: "quote",
  "logo-marquee": "logos",
  "number-ticker": "stat",
  integrations: "integrations",
  "command-k": "demo",
  "ai-prompt": "demo",
  "click-flow": "demo",
  "notify-stack": "demo",
  "chart-grow": "metric",
  "ui-assemble": "meet",
  "gallery-flow": "gallery",
  "carousel-3d": "gallery",
  "photo-fan": "gallery",
  "card-spread": "gallery",
  "photo-drop": "gallery",
  "tilt-wall": "hook",
  "code-deploy": "demo",
  kanban: "demo",
  "live-cursors": "demo",
  "chat-thread": "demo",
  "keycaps": "demo",
  "toggle-list": "demo",
  "changelog": "demo",
  "calendar-drop": "demo",
  "inbox-sweep": "demo",
  "comment-pins": "demo",
  "table-fill": "demo",
  "phone-tour": "demo",
  "drop-zone": "demo",
  "arrow-rise": "how",
  "process-chevrons": "how",
  "process-cycle": "how",
  "step-stairs": "how",
  services: "features",
  "step-portals": "how",
  "light-trail": "how",
  "step-cards": "how",
  "service-orbit": "features",
  "service-carousel": "features",
  "service-hex": "features",
  "service-cube": "features",
  "service-bloom": "features",
  "service-fan": "features",
  "service-board": "features",
  "service-bento": "features",
  "char-hello": "hook",
  "char-presenter": "features",
  "char-team": "cards",
  "char-aha": "solve",
  "char-desk": "demo",
  "char-cheer": "cta",
  "pro-walk": "hook",
  "pro-explainer": "features",
  "pro-duo": "quote",
  "pro-thinker": "solve",
  "pro-unveil": "promise",
  "pro-highfive": "cta",
  "abs-hello": "hook",
  "abs-crowd": "cards",
  "abs-features": "features",
  "abs-parade": "promise",
  "abs-chat": "quote",
  "abs-cheer": "cta",
  "ind-hometour": "features",
  "ind-build": "how",
  "ind-site": "how",
  "ind-care": "features",
  "ind-menu": "features",
  "ind-shop": "features",
  "ind-lesson": "how",
  "ind-team": "features",
  "ind-route": "how",
  "d3-laptop": "meet",
  "d3-phone": "tour",
  "d3-lineup": "reach",
  "d3-dive": "tour",
  "d3-desk": "meet",
  "home-hero": "hook",
  "home-aerial": "reach",
  "home-build3d": "how",
  "home-plan": "features",
  "home-energy": "features",
  "home-choice": "compare",
  "home-journey": "how",
  "service-spotlight": "features",
  "spotlight": "tour",
  "device-trio": "tour",
  "exploded-ui": "tour",
  globe: "reach",
  "before-after": "compare",
  "problem-solution": "solve",
  support: "support",
  "world-map": "reach",
  "feature-slides": "features",
  "liquid-logo": "reveal",
  "product-hero": "reveal",
  "product-end": "cta",
  "product-spin": "gallery",
  "product-zoom": "gallery",
  "product-teaser": "hook",
  cta: "cta",
  "qr-end": "cta",
};

/** Best-guess role for a scene the AI (or an old plan) created without one. */
export function roleOf(scene: Scene, index: number, count: number): Role | undefined {
  if (scene.role && scene.role in DEFAULT_ROLE_SKILL) return scene.role as Role;
  if (index === count - 1) return "cta";
  return SKILL_ROLE[scene.skill];
}

/**
 * A line cut into trailer beats: at its connectors ("Wireless earbuds | with active noise
 * cancelling"), at most 4 words a beat and 3 beats. A name alone builds word by word.
 */
export function trailerBeats(line: string): string[] {
  const words = line.replace(/\*/g, "").replace(/[.!?]+$/, "").split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;
  if (words.length <= 3) return words.length === 3 || /^[A-Z]/.test(words[1]) ? words : [words.join(" ")];
  const beats: string[][] = [[]];
  for (const w of words) {
    const cur = beats[beats.length - 1];
    if (cur.length && (cur.length >= 4 || (/^(with|and|for|that|so|to|plus|in|on|from|by)$/i.test(w) && cur.length >= 2))) beats.push([w]);
    else cur.push(w);
  }
  return beats.slice(0, 3).map((b) => b.join(" "));
}

/**
 * Trailer styles give product videos a cold open: close-ups of the product, cut on the beat, with
 * its own line said in beats, before the reveal. It replaces another opener (taking its line), and
 * goes again when you switch back to a style that isn't a trailer.
 */
function trailerCut(plan: VideoPlan, tpl: Template): Scene[] {
  const scenes = plan.scenes;
  if (!plan.product || !scenes.length) return scenes;
  const open = scenes[0].skill === "product-teaser";
  if (!tpl.trailer) return open && TEMPLATE_MAP[plan.template ?? ""]?.trailer ? scenes.slice(1) : scenes;
  // Short films (under ~18s) keep the trailer look but go straight to the product.
  if (open || (plan.target ?? 30) < 18) return scenes;
  // The line: the opener's, else the reveal's benefit, else the product's (short) name.
  const hook = scenes[0].role === "hook" && !/^(meet|say hello to)\b/i.test(scenes[0].text) ? scenes[0].text : "";
  const reveal = scenes.find((s) => s.role === "reveal");
  const benefit = reveal?.subtext && !/^by\s/i.test(reveal.subtext) ? reveal.subtext : "";
  const name = (reveal?.text || plan.title || "").split(/\s+/).slice(0, 3).join(" ");
  const line = (hook || benefit || name).replace(/\*/g, "");
  const teaser: Scene = {
    role: "hook",
    skill: "product-teaser",
    text: line.split(/\s+/).length >= 2 ? line : `Meet ${line}`,
    items: trailerBeats(line),
    duration: 4,
    transition: "cut",
    why: "Trailer cold open: close-ups of the product, cut on the beat",
  };
  return [teaser, ...(scenes[0].role === "hook" ? scenes.slice(1) : scenes)];
}

/**
 * Restyle a plan with a template: palette, font, tempo, music, background look, transitions,
 * role skills and pacing. Content (copy, items, media) is untouched.
 */
export function applyTemplate(plan: VideoPlan, templateId: string, opts: { palette?: PaletteId } = {}): VideoPlan {
  const tpl = TEMPLATE_MAP[templateId] ?? TEMPLATE_MAP[DEFAULT_TEMPLATE];
  const beat = 60 / tpl.bpm;
  const r = rng(hashString(`${plan.seed}:${tpl.id}`));
  let last: Transition = "cut";
  let zooms = 0;
  const base = trailerCut(plan, tpl);
  // A Cartoon style can tell the story with another kind of character (plan.characters): the
  // abstract-family slides, drawn as that kind, in the style's own look.
  const people = tpl.category === "Cartoon" ? plan.characters : undefined;
  const roles = people ? ABS_ROLES : tpl.roles;
  let prevSkill: SkillId | undefined;
  const usedIndustry = new Set<SkillId>();
  const scenes = base.map((scene, i, all) => {
    const role = roleOf(scene, i, all.length);
    if (!role) return scene;
    let skill = roles[role] ?? DEFAULT_ROLE_SKILL[role];
    // A Cartoon style shows the intro's industry its own way, once per part (see INDUSTRY_ROLES).
    const ind = !plan.setting || scene.media ? undefined : tpl.category === "Cartoon" ? INDUSTRY_ROLES[plan.setting]?.[role] : plan.setting === "house" ? HOME_ROLES[role] : undefined;
    if (ind && !usedIndustry.has(ind)) {
      skill = ind;
      usedIndustry.add(ind);
    }
    // 3D styles show the product on real 3D devices (once per part of the story): the site's own
    // screenshots when it was captured, else designed screens in the video's colours.
    let dev = tpl.category === "3D" && !scene.media && !plan.product ? DEVICE_ROLES[role] : undefined;
    if (dev && usedIndustry.has(dev)) dev = undefined;
    if (dev) {
      skill = dev;
      usedIndustry.add(dev);
    }
    if (role === "reveal" && !plan.brand?.logo) skill = people ? "abs-hello" : tpl.revealNoLogo;
    // In a Cartoon style a character slide wins over the director's words-only design (not over a
    // QR end card, a logo or product moment, or a slide that shows your pictures).
    const cartoonOver = tpl.category === "Cartoon" && CHARACTER_SLIDE.test(skill) && !scene.media && !/^(qr-end|liquid-logo|logo-|product-)/.test(scene.skill);
    // (A Cartoon style shows a character instead of a mock-up demo, unless the demo has your pictures.)
    if (role === "demo" && DEMO_SKILLS.has(scene.skill) && !(tpl.category === "Cartoon" && CHARACTER_SLIDE.test(skill) && !scene.media)) skill = scene.skill;
    // The product assembled from its own components beats a flat page scroll whenever it's available.
    if (role === "meet" && scene.skill === "ui-assemble") skill = scene.skill;
    // A tour of the website's own sections (no product footage to zoom into) stays one.
    if (role === "tour" && scene.skill === "site-scroll") skill = scene.skill;
    // Signature text moments the director chose on purpose (video in text, node graph) stay.
    if (["type-mask", "node-graph", "gallery-flow", "carousel-3d", "photo-fan", "card-spread", "photo-drop", "tilt-wall", "world-map", "feature-slides", "showreel", "card-system", "type-rows", "type-poster", "poster-grid", "poster-split", "type-echo", "type-slots", "rapid-fire", "flip-switch", "zoom-through", "slice-switch", "style-shuffle", "split-flap", "whip-pan", "stack-stomp", "speed-ticker", "cube-spin", "speed-type", "bar-wipe", "crash-zoom", "word-grid", "orbit-text", "tape-rush", "jump-cut", "letter-rush", "stamp-rush", "rally", "spiral-in", "speed-gauge", "domino", "slipstream", "stretch-snap", "rack-focus", "spotlight", "device-trio", "exploded-ui", "card-stack", "contact-sheet", "spec-sheet", "widget-set", "qr-end", "liquid-logo", "logo-extrude", "logo-spin", "logo-shatter", "logo-orbit", "logo-stage", "logo-layers", "logo-tunnel", "logo-flip", "logo-draw", "logo-wipe", "logo-pop", "logo-morph", "logo-slices", "logo-dots", "logo-type", "logo-shapes", "arrow-rise", "process-chevrons", "process-cycle", "step-stairs", "services", "step-portals", "light-trail", "step-cards", "service-orbit", "service-carousel", "service-hex", "service-cube", "service-bloom", "service-fan", "service-board", "service-bento", "service-spotlight", "char-hello", "char-presenter", "char-team", "char-aha", "char-desk", "char-cheer", "pro-walk", "pro-explainer", "pro-duo", "pro-thinker", "pro-unveil", "pro-highfive", "abs-hello", "abs-crowd", "abs-features", "abs-parade", "abs-chat", "abs-cheer", "ind-hometour", "ind-build", "ind-site", "ind-care", "ind-menu", "ind-shop", "ind-lesson", "ind-team", "ind-route", "d3-laptop", "d3-phone", "d3-lineup", "d3-dive", "d3-desk", "home-hero", "home-aerial", "home-build3d", "home-plan", "home-energy", "home-choice", "home-journey", "product-hero", "product-end", "product-spin", "product-zoom", "product-teaser"].includes(scene.skill) && !(CHARACTER_SLIDE.test(scene.skill) && CHARACTER_SLIDE.test(skill)) && !cartoonOver) skill = scene.skill;
    if (dev) skill = dev;
    // The flat device mock-up becomes the real 3D lineup (it shows the same screenshots).
    if (skill === "device-trio") skill = "d3-lineup";
    // Pictures are never dropped for characters: the slide keeps them (and gets the companion).
    if (scene.media && CHARACTER_SLIDE.test(skill)) skill = CHARACTER_SLIDE.test(scene.skill) ? DEFAULT_ROLE_SKILL[role] : scene.skill;
    // A slide style you picked yourself stays, whatever the template would choose.
    if (scene.locked) skill = scene.skill;
    // No character slide twice in a row: the next one in its family steps in.
    const prev = i > 0 ? prevSkill : undefined;
    if (prev === skill && CHARACTER_SLIDE.test(skill) && !scene.locked) {
      const pool = CHARACTER_POOLS.find((p) => p.includes(skill) || p[0].slice(0, 4) === skill.slice(0, 4));
      const alt = pool?.find((x) => x !== skill);
      if (alt) skill = alt;
    }
    prevSkill = skill;
    const [beats, floor] = roleLength({ ...scene, skill }, role);
    const duration = Math.max(floor, beats * beat) * tpl.pace;
    let transition: Transition = "cut";
    // Each slide enters on a move that fits it: a zoom reveal into the brand, the product or the
    // answer, slides between lists, cuts into punchy lines (see mixTransition).
    if (i > 0) {
      transition = mixTransition(role, roleOf(all[i - 1], i - 1, all.length), tpl.transitions, last, zooms, all.length, r);
      if (ZOOMS.has(transition)) zooms++;
    }
    // Out of the cold open, the product lands on a flash.
    if (i > 0 && all[i - 1].skill === "product-teaser") transition = "flash";
    last = transition;
    // A word swap ("planned|built|shared") turned into a character slide keeps its first word.
    const text = CHARACTER_SLIDE.test(skill) && !CHARACTER_SLIDE.test(scene.skill) && scene.text?.includes("|") ? scene.text.replace(/([^\s|]+)(?:\|[^\s|]+)+/g, "$1") : scene.text;
    return { ...scene, text, role, skill, duration, transition };
  });
  // A 3D style always has the product on a real 3D device: when no part of the story called for
  // one, the first words-only middle slide becomes the 3D laptop.
  if (tpl.category === "3D" && !plan.product && !scenes.some((x) => x.skill.startsWith("d3-"))) {
    const i = scenes.findIndex((x, k) => k > 0 && k < scenes.length - 1 && !x.media && !x.locked && x.role && !["hook", "reveal", "cta", "logos"].includes(x.role) && !/^(qr-end|liquid-logo|logo-|product-)/.test(x.skill));
    if (i > 0) scenes[i] = { ...scenes[i], skill: "d3-laptop" };
  }
  // Templates change the feel, not the runtime: keep the film within -12%/+10% of the length
  // the same storyboard runs at a neutral 120 bpm, scaling every scene proportionally.
  const neutral = base.reduce((a, scene, i, all) => {
    const role = roleOf(scene, i, all.length);
    if (!role) return a + scene.duration;
    const [beats, floor] = roleLength(scene, role);
    return a + Math.max(floor, beats * 0.5);
  }, 0);
  const styled = scenes.reduce((a, sc) => a + sc.duration, 0);
  const fit = styled > 0 ? clamp(styled, neutral * 0.88, neutral * 1.1) / styled : 1;
  const styledPlan: VideoPlan = {
    ...plan,
    template: tpl.id,
    palette: opts.palette ?? tpl.palette,
    font: tpl.font,
    bpm: tpl.bpm,
    style: "saas",
    music: tpl.music,
    flavor: tpl.flavor,
    look: staged(tpl, people ? { ...tpl.look, people } : tpl.look, plan.setting),
    scenes: scenes.map((s) => ({ ...s, duration: Math.max(4, Math.round((s.duration * fit) / beat)) * beat })),
  };
  const fitted = plan.target ? fitLength(styledPlan, plan.target) : styledPlan;
  // The cinematography pass: transition grammar, holds and variety, in this style's own vocabulary.
  return cinematography(fitted, { pool: tpl.transitions, roleSkill: (role) => (role in DEFAULT_ROLE_SKILL ? (roles[role as Role] ?? DEFAULT_ROLE_SKILL[role as Role]) : undefined) });
}

/**
 * A flat Cartoon style's characters stand in the intro's setting (an office, a hospital…) when it
 * has one; styles with a stage of their own (night stars, a GPU gradient) keep it.
 */
function staged(tpl: Template, look: Template["look"], setting: VideoPlan["setting"]): Template["look"] {
  if (!setting || tpl.category !== "Cartoon" || look?.toon !== "flat" || look.shader || look.backdrop === "stars") return look;
  return { ...look, backdrop: setting, aurora: 0, grid: false };
}

/** Homebuilder and real-estate intros in the other styles: the home in real 3D, by part of the story. */
const HOME_ROLES: Partial<Record<Role, SkillId>> = { hook: "home-hero", features: "home-plan", bento: "home-energy", how: "home-build3d", promise: "home-journey", reach: "home-aerial", cards: "home-choice", compare: "home-choice", stat: "home-energy", metric: "home-energy" };

/** Real 3D device slides for 3D styles when the site is captured, by part of the story. */
const DEVICE_ROLES: Partial<Record<Role, SkillId>> = { meet: "d3-laptop", tour: "d3-dive", reach: "d3-lineup", demo: "d3-desk", promise: "d3-phone", solve: "d3-laptop", integrations: "d3-lineup", support: "d3-phone", gallery: "d3-desk" };

/** The industry slides a setting gets, by part of the story. */
const INDUSTRY_ROLES: Partial<Record<NonNullable<VideoPlan["setting"]>, Partial<Record<Role, SkillId>>>> = {
  house: { features: "ind-hometour", how: "ind-build", promise: "ind-build" },
  home: { features: "ind-hometour", how: "ind-build" },
  kitchen: { features: "ind-hometour" },
  bedroom: { features: "ind-hometour" },
  bathroom: { features: "ind-hometour" },
  construction: { how: "ind-site", features: "ind-build" },
  hospital: { features: "ind-care", how: "ind-care" },
  cafe: { features: "ind-menu", demo: "ind-menu" },
  shop: { features: "ind-shop", demo: "ind-shop" },
  classroom: { how: "ind-lesson", features: "ind-lesson" },
  office: { features: "ind-team", how: "ind-team" },
  city: { how: "ind-route", promise: "ind-route" },
};

/** Character slides: switching characters swaps one for another rather than keeping the old one. */
const CHARACTER_SLIDE = /^(char|pro|abs|ind)-/;

/**
 * Stretch or compress scene lengths so the film lands on the requested length (within what
 * keeps each beat readable), snapping every scene to whole beats of the template's tempo.
 */
export function fitLength(plan: VideoPlan, target: number): VideoPlan {
  const beat = 60 / plan.bpm;
  const total = plan.scenes.reduce((a, s) => a + s.duration, 0);
  if (!total) return plan;
  const k = Math.min(1.35, Math.max(0.72, target / total));
  if (Math.abs(k - 1) < 0.04) return plan;
  return {
    ...plan,
    scenes: plan.scenes.map((s) => {
      const floor = { cta: 3, reveal: 2.4, hook: 2.6, features: 3.4, tour: 4.2, how: 3.6, quote: 3.8, demo: 4.2, metric: 3.4 }[s.role ?? ""] ?? 3;
      // Past ~8s a single shot drags, however much time there is to fill.
      return { ...s, duration: Math.min(Math.floor(8.4 / beat), Math.max(Math.ceil(floor / beat), Math.round((s.duration * k) / beat))) * beat };
    }),
  };
}
