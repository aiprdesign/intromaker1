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

export type TemplateCategory = "Clean & Epic" | "Modern" | "Clean & Light" | "3D & Sci-Fi" | "Bold & Playful" | "Premium";
export const TEMPLATE_CATEGORIES: TemplateCategory[] = ["Clean & Epic", "Modern", "3D & Sci-Fi", "Clean & Light", "Bold & Playful", "Premium"];

export interface Template {
  id: string;
  name: string;
  /** Gallery group (defaults to "Modern"). */
  category?: TemplateCategory;
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
export const DEMO_SKILLS = new Set<SkillId>(["command-k", "ai-prompt", "click-flow", "notify-stack", "code-deploy", "kanban", "live-cursors", "chat-thread"]);

/** Base length of each role in beats (and a floor in seconds). */
function roleLength(scene: Scene, role: Role): [number, number] {
  switch (role) {
    case "pain":
      return [(scene.items?.length ?? 2) * 2 + 5, 4.5];
    case "hook":
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
    transitions: ["dolly", "whip", "push", "dissolve"],
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
    transitions: ["leak", "dissolve", "dolly"],
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
    transitions: ["dissolve", "push", "cut"],
    pace: 1.15,
    roles: {},
    revealNoLogo: "logo-reveal",
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
    roles: {},
    revealNoLogo: "logo-reveal",
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
    transitions: ["whip", "push", "zoom"],
    pace: 0.85,
    roles: {},
    revealNoLogo: "flip-3d",
    sample: sample("Plans with friends, *sorted*."),
  },
  {
    id: "keynote",
    name: "Cinematic Keynote",
    category: "Premium",
    description: "Epic launch keynote: volumetric light, slow push-ins and a cinematic trailer score.",
    vibe: "Grand and cinematic, like a flagship launch event. Big statements, dramatic light, slower pacing, trailer music.",
    palette: "midnight",
    font: "inter",
    bpm: 96,
    music: "trailer",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.8, text: "glow", grain: 1, vignette: 1.4, shader: "rays", shaderStrength: 0.9 },
    transitions: ["dissolve", "leak", "dolly"],
    pace: 1.2,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("The next era of *work* begins."),
  },
  {
    id: "neon",
    name: "Neon Tech",
    category: "3D & Sci-Fi",
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
    roles: {},
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
    transitions: ["dissolve", "push", "dolly"],
    pace: 1.05,
    roles: {},
    revealNoLogo: "logo-reveal",
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
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Revenue, *finally in sync*."),
  },
  {
    id: "terminal",
    name: "Dev Terminal",
    category: "3D & Sci-Fi",
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
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("npm install *speed*"),
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
    transitions: ["cut", "whip", "zoom"],
    pace: 0.8,
    roles: {},
    revealNoLogo: "logo-reveal",
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
    transitions: ["cut", "push", "zoom"],
    pace: 0.9,
    roles: {},
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
    transitions: ["dissolve", "leak", "push"],
    pace: 1.15,
    roles: {},
    revealNoLogo: "logo-reveal",
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
    transitions: ["dolly", "dissolve", "leak"],
    pace: 1,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Your new *AI teammate*."),
  },
  {
    id: "spatial",
    name: "3D Spatial",
    category: "3D & Sci-Fi",
    description: "The product floats on a tilted 3D plane that slowly orbits, over glowing 3D light panels. Vision Pro-style depth.",
    vibe: "Immersive and futuristic but calm. Short confident lines, the product front and centre in 3D space, smooth dolly moves.",
    palette: "spatial",
    font: "inter",
    bpm: 116,
    music: "saas",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.4, card: "glass", text: "blur", grain: 0.6, shader: "panels", shaderStrength: 1, depth: 14 },
    transitions: ["dolly", "push", "dissolve"],
    pace: 1.05,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Work in a *new dimension*."),
  },
  {
    id: "epic",
    name: "Epic Launch",
    category: "Premium",
    description: "Trailer-grade SaaS: light rays, big streaking type, punchy zoom and flash cuts, a subtle 3D tilt and a cinematic score with hits.",
    vibe: "Epic and cinematic, like a keynote trailer. Bold short lines (3–6 words), big moments, every cut on a hit.",
    palette: "midnight",
    font: "inter",
    bpm: 112,
    music: "trailer",
    flavor: "tech",
    look: { grid: false, beams: 1, aurora: 0.6, card: "glass", text: "streak", textScale: 1.12, grain: 0.9, vignette: 1.4, shader: "rays", shaderStrength: 0.9, depth: 6 },
    transitions: ["zoom", "flash", "whip", "dolly"],
    pace: 0.95,
    roles: {},
    revealNoLogo: "god-rays",
    sample: sample("The future of work *starts now*."),
  },
  {
    id: "turntable",
    name: "3D Turntable",
    category: "3D & Sci-Fi",
    description: "Every shot sits on a panel turned in 3D perspective, swinging slowly like a product on a turntable, with a floor reflection and cube turns between scenes.",
    vibe: "Premium product-launch showroom. Confident short lines, the product presented like hardware on a stage, smooth 3D turns.",
    palette: "midnight",
    font: "inter",
    bpm: 118,
    music: "saas",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.45, card: "glass", text: "blur", grain: 0.5, vignette: 1.1, shader: "rays", shaderStrength: 0.8, turn: 16 },
    transitions: ["cube", "dolly", "cube", "push"],
    pace: 1,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Built for the *main stage*."),
  },
  {
    id: "slab",
    name: "3D Glass Slab",
    category: "3D & Sci-Fi",
    description: "Each shot is a thick floating glass slab tilted in 3D, bobbing gently over a soft floor shadow.",
    vibe: "Tactile, modern and crafted. Clean short lines, UI presented as physical objects, gentle dolly and push moves.",
    palette: "violet",
    font: "grotesk",
    bpm: 116,
    music: "saas",
    flavor: "soft",
    look: { grid: false, beams: 0, aurora: 0.5, card: "frost", text: "pop", grain: 0.4, shader: "mesh", shaderStrength: 0.85, slab: true },
    transitions: ["dolly", "push", "dissolve"],
    pace: 1,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Software you can *almost touch*."),
  },
  {
    id: "hud",
    name: "Sci-Fi HUD",
    category: "3D & Sci-Fi",
    description: "Mission-control HUD: corner brackets, live timecode and readouts, scan lines, glowing voronoi cells, typed text.",
    vibe: "Tactical and precise, like a spacecraft interface. Terse system-style copy, glitch cuts, data everywhere.",
    palette: "hud",
    font: "mono",
    bpm: 126,
    music: "saas",
    flavor: "neon",
    look: { grid: false, beams: 0, aurora: 0.3, card: "flat", text: "type", grain: 1, vignette: 1.4, shader: "voronoi", shaderStrength: 0.55, overlay: "hud" },
    transitions: ["glitch", "shutter", "cut"],
    pace: 0.95,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Threat detected. *Neutralised.*"),
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
    transitions: ["cut", "push"],
    pace: 0.95,
    roles: {},
    revealNoLogo: "logo-reveal",
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
    transitions: ["push", "zoom", "dissolve"],
    pace: 0.95,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Software that feels *squishy*."),
  },
  {
    id: "chrome",
    name: "Liquid Chrome",
    category: "3D & Sci-Fi",
    description: "Y2K-meets-2026: molten chrome swirls, iridescent glow and glowing reveals on graphite.",
    vibe: "Sleek, glossy and fashion-forward. Bold short statements, glowing reveals, fast dolly and whip moves.",
    palette: "chrome",
    font: "grotesk",
    bpm: 122,
    music: "saas",
    flavor: "tech",
    look: { grid: false, beams: 0, aurora: 0.4, card: "frost", text: "glow", grain: 0.7, vignette: 1.2, shader: "swirl", shaderStrength: 0.95 },
    transitions: ["dolly", "whip", "dissolve"],
    pace: 1,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Polished to *perfection*."),
  },
  {
    id: "liquid",
    name: "Liquid Motion",
    category: "Modern",
    description: "Everything flows: headlines pour in as glossy liquid, and every scene rises in on a fast liquid wave over fluid metaball gradients.",
    vibe: "Fluid, fast and playful-premium. Short punchy lines, quick liquid reveals and liquid wave transitions between every scene.",
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
    category: "3D & Sci-Fi",
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
    roles: {},
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
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("thinking in *pixels*."),
  },
  {
    id: "horizon",
    name: "Synthwave 3D",
    category: "3D & Sci-Fi",
    description: "Retro-futurist 3D: a neon grid floor racing to a glowing horizon, content on a tilted plane.",
    vibe: "Nostalgic, energetic and cinematic. Big bold lines, neon glow, whip and zoom cuts on the beat.",
    palette: "synthwave",
    font: "grotesk",
    bpm: 118,
    music: "saas",
    flavor: "neon",
    look: { grid: false, beams: 0, aurora: 0.6, backdrop: "horizon", card: "glass", text: "glow", grain: 1, vignette: 1.2, depth: 9 },
    transitions: ["whip", "zoom", "dolly"],
    pace: 0.95,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("Drive into *tomorrow*."),
  },
  {
    id: "cosmic",
    name: "Deep Space",
    category: "3D & Sci-Fi",
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
    roles: {},
    revealNoLogo: "logo-reveal",
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
    transitions: ["dolly", "dissolve", "push"],
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
    transitions: ["push", "whip", "dolly"],
    pace: 0.95,
    roles: {},
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
    transitions: ["cut", "push", "zoom"],
    pace: 0.94,
    roles: {},
    revealNoLogo: "logo-reveal",
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
    transitions: ["dolly", "zoom", "leak"],
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
    transitions: ["push", "dissolve", "dolly"],
    pace: 1,
    roles: {},
    revealNoLogo: "logo-reveal",
    sample: sample("A brighter way to *work*."),
  },
];

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<string, Template>;
export const DEFAULT_TEMPLATE = "midnight";

const SKILL_ROLE: Partial<Record<SkillId, Role>> = {
  "blur-reveal": "hook",
  "pain-strike": "pain",
  "logo-reveal": "reveal",
  "particle-assemble": "reveal",
  "site-scroll": "meet",
  steps: "how",
  "ui-tour": "tour",
  bento: "bento",
  "ui-cards": "cards",
  "icon-features": "features",
  "word-swap": "promise",
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
  "tilt-wall": "hook",
  "code-deploy": "demo",
  kanban: "demo",
  "live-cursors": "demo",
  "chat-thread": "demo",
  globe: "reach",
  "before-after": "compare",
  "problem-solution": "solve",
  support: "support",
  "world-map": "reach",
  "feature-slides": "features",
  "liquid-logo": "reveal",
  "product-hero": "reveal",
  "product-end": "cta",
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
 * Restyle a plan with a template: palette, font, tempo, music, background look, transitions,
 * role skills and pacing. Content (copy, items, media) is untouched.
 */
export function applyTemplate(plan: VideoPlan, templateId: string, opts: { palette?: PaletteId } = {}): VideoPlan {
  const tpl = TEMPLATE_MAP[templateId] ?? TEMPLATE_MAP[DEFAULT_TEMPLATE];
  const beat = 60 / tpl.bpm;
  const r = rng(hashString(`${plan.seed}:${tpl.id}`));
  let last: Transition = "cut";
  const scenes = plan.scenes.map((scene, i, all) => {
    const role = roleOf(scene, i, all.length);
    if (!role) return scene;
    let skill = tpl.roles[role] ?? DEFAULT_ROLE_SKILL[role];
    if (role === "reveal" && !plan.brand?.logo) skill = tpl.revealNoLogo;
    if (role === "demo" && DEMO_SKILLS.has(scene.skill)) skill = scene.skill;
    // The product assembled from its own components beats a flat page scroll whenever it's available.
    if (role === "meet" && scene.skill === "ui-assemble") skill = scene.skill;
    // A tour of the website's own sections (no product footage to zoom into) stays one.
    if (role === "tour" && scene.skill === "site-scroll") skill = scene.skill;
    // Signature text moments the director chose on purpose (video in text, node graph) stay.
    if (["type-mask", "node-graph", "gallery-flow", "carousel-3d", "tilt-wall", "world-map", "feature-slides", "qr-end", "liquid-logo", "product-hero", "product-end"].includes(scene.skill)) skill = scene.skill;
    const [beats, floor] = roleLength({ ...scene, skill }, role);
    const duration = Math.max(floor, beats * beat) * tpl.pace;
    let transition: Transition = "cut";
    if (i > 0) {
      const pool = tpl.transitions.filter((t) => t !== last);
      transition = (pool.length ? pool : tpl.transitions)[Math.floor(r() * (pool.length || tpl.transitions.length))];
    }
    last = transition;
    return { ...scene, role, skill, duration, transition };
  });
  // Templates change the feel, not the runtime: keep the film within -12%/+10% of the length
  // the same storyboard runs at a neutral 120 bpm, scaling every scene proportionally.
  const neutral = plan.scenes.reduce((a, scene, i, all) => {
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
    look: tpl.look,
    scenes: scenes.map((s) => ({ ...s, duration: Math.max(4, Math.round((s.duration * fit) / beat)) * beat })),
  };
  return plan.target ? fitLength(styledPlan, plan.target) : styledPlan;
}

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
