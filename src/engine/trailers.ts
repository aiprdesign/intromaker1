import { hashString, rng } from "./math";
import type { FontId, PaletteId, SkillId, Transition, VideoPlan } from "./types";

/**
 * Trailer styles for the epic trailer cut: each is a palette, typeface, tempo, transition language
 * and the cinematic effects it draws its hook, title, body and outro from. The director matches one
 * to the product (by keywords), or you pick one, and switching restyles the film instantly.
 */
export interface Mood {
  palette: PaletteId;
  font: FontId;
  bpm: number;
  hook: SkillId[];
  title: SkillId[];
  body: SkillId[];
  outro: SkillId[];
  transitions: Transition[];
}

export interface TrailerStyle {
  id: string;
  name: string;
  description: string;
  /** Words that suggest it (matched against the prompt or site). */
  keys?: RegExp;
  mood: Mood;
  /** A movie-genre trailer (studio card, title cards, billing block, widescreen) rather than a brand launch. */
  movie?: boolean;
  /** Text its preview card shows. */
  preview?: string;
}

const card = "intertitle" as const;
const billing = "billing-block" as const;
/**
 * Movie trailers by genre: each plays the trailer's own grammar (a studio card, title cards
 * between the shots, the title, the billing block) in its genre's palette, title type, tempo and
 * cutting, letterboxed to widescreen.
 */
export const MOVIE_STYLES: TrailerStyle[] = [
  {
    id: "film-horror", name: "Horror", movie: true, preview: "IT KNOWS",
    description: "Black and blood red, an unsettled serif, cards that stutter and flicker, hard cuts and glitches on a slow, heavy pulse.",
    keys: /\b(horror|scary|haunt\w*|ghosts?|zombies?|demons?|terror|slasher|creepy|nightmares?|possess\w*|curse[ds]?)\b/,
    mood: { palette: "crimson", font: "serif", bpm: 84, hook: [card], title: ["glitch-reveal", "cinematic-title"], body: [card, "glitch-reveal"], outro: [billing], transitions: ["cut", "glitch", "flash"] },
  },
  {
    id: "film-thriller", name: "Thriller", movie: true, preview: "TRUST NO ONE",
    description: "Cold steel blue, thin wide-set type, a slit of light under each card, shutters and cuts on a heartbeat tempo.",
    keys: /\b(thriller|heist|spy|espionage|detectives?|conspiracy|hostage|killer|crime|assassins?|fbi|manhunt)\b/,
    mood: { palette: "steel", font: "jost", bpm: 100, hook: [card], title: ["glitch-reveal", "cinematic-title"], body: [card, "split-wipe", "glitch-reveal", "anamorphic-flare"], outro: [billing], transitions: ["cut", "shutter", "flash"] },
  },
  {
    id: "film-action", name: "Action", movie: true, preview: "NO RETREAT",
    description: "Orange and teal heat, tall condensed caps that slam in on a flash, shockwaves, whips and shutters at full tempo.",
    keys: /\b(action|explosions?|fights?|fighting|chase|mercenar\w*|martial arts|revenge|blockbuster)\b/,
    mood: { palette: "inferno", font: "bebas", bpm: 128, hook: [card], title: ["kinetic-slam", "shockwave", "blade-slash"], body: [card, "kinetic-slam", "split-wipe", "shockwave", "steel-title", "blade-slash"], outro: [billing], transitions: ["flash", "whip", "shutter"] },
  },
  {
    id: "film-scifi", name: "Sci-Fi", movie: true, preview: "BEYOND THE EDGE",
    description: "Electric blue, wide geometric type, hyperspace, orbit rings and warp tunnels, dolly moves and light leaks.",
    keys: /\b(sci-?fi|science fiction|aliens?|spaceships?|galax\w*|robots?|androids?|time travel|planets?|mars|dystopi\w*|cyborgs?|starship)\b/,
    mood: { palette: "ion", font: "jost", bpm: 112, hook: [card, "hyperspace"], title: ["cinematic-title", "particle-assemble", "monolith", "eclipse"], body: [card, "orbit-rings", "hud-scan", "warp-tunnel", "anamorphic-flare", "rift-open"], outro: [billing], transitions: ["dolly", "flash", "leak"] },
  },
  {
    id: "film-fantasy", name: "Fantasy Epic", movie: true, preview: "LEGENDS RISE",
    description: "Gold and shadow, classic movie capitals, god rays and drifting embers, slow dissolves and light leaks.",
    keys: /\b(fantasy|dragons?|wizards?|magic\w*|kingdoms?|quests?|elves|swords?|legends?|myths?|mythical|sorcer\w*)\b/,
    mood: { palette: "gold", font: "cinzel", bpm: 92, hook: [card, "god-rays"], title: ["god-rays", "cinematic-title", "ember-title", "rift-open"], body: [card, "god-rays", "particle-assemble", "sand-reveal", "ember-title"], outro: [billing], transitions: ["dissolve", "leak", "dolly"] },
  },
  {
    id: "film-drama", name: "Drama", movie: true, preview: "WHAT WE KEEP",
    description: "Muted night tones, an editorial serif, long title cards that fade up warm, slow dissolves and light leaks.",
    keys: /\b(drama|dramatic|true story|biopic|grief|coming of age|family saga)\b/,
    mood: { palette: "midnight", font: "playfair", bpm: 84, hook: [card], title: ["cinematic-title"], body: [card, "cinematic-title"], outro: [billing], transitions: ["dissolve", "leak", "cut"] },
  },
  {
    id: "film-comedy", name: "Comedy", movie: true, preview: "WHAT COULD GO WRONG?",
    description: "Bright colour cards that pop on a bounce, friendly rounded type, shape bursts and flips, whip pans and quick cuts.",
    keys: /\b(comedy|comedic|funny|hilarious|rom-?com|sitcom|parody|buddy)\b/,
    mood: { palette: "sunset", font: "manrope", bpm: 120, hook: [card], title: ["kinetic-slam", "shape-burst"], body: [card, "shape-burst", "flip-3d"], outro: [billing], transitions: ["whip", "cut", "zoom"] },
  },
  {
    id: "film-romance", name: "Romance", movie: true, preview: "ONE SUMMER",
    description: "Rose and gold light, a graceful serif, soft cards and flowing colour, long dissolves and warm light leaks.",
    keys: /\b(romance|romantic|love story|in love|wedding|rom-?com|lovers|sweethearts?)\b/,
    mood: { palette: "rose", font: "playfair", bpm: 86, hook: [card], title: ["cinematic-title", "liquid-gradient"], body: [card, "liquid-gradient"], outro: [billing], transitions: ["dissolve", "leak"] },
  },
  {
    id: "film-noir", name: "Mystery Noir", movie: true, preview: "SOMEONE IS LYING",
    description: "Black and white, an editorial serif, split-wipe reveals, hard cuts, shutters and smoky dissolves.",
    keys: /\b(noir|mystery|whodunit|murder mystery|1940s|private eye)\b/,
    mood: { palette: "mono", font: "playfair", bpm: 92, hook: [card], title: ["cinematic-title", "split-wipe"], body: [card, "split-wipe"], outro: [billing], transitions: ["cut", "dissolve", "shutter"] },
  },
  {
    id: "film-doc", name: "Documentary", movie: true, preview: "A STORY OF",
    description: "Ink-black and clean, an understated geometric type, calm title cards and light, slow dissolves.",
    keys: /\b(documentary|docuseries|docu-?series|wildlife|nature film|true events)\b/,
    mood: { palette: "ink", font: "jost", bpm: 90, hook: [card], title: ["cinematic-title", "god-rays"], body: [card, "orbit-rings", "eclipse"], outro: [billing], transitions: ["dissolve", "cut"] },
  },
  {
    id: "film-family", name: "Family & Animation", movie: true, preview: "ONE WILD RIDE",
    description: "Bright, bouncy colour cards, rounded friendly type, shape bursts and flips, zooms and whips.",
    keys: /\b(animated|animation|family film|for kids|cartoon|all ages|fairy tale)\b/,
    mood: { palette: "aurora", font: "manrope", bpm: 116, hook: [card], title: ["shape-burst", "flip-3d"], body: [card, "shape-burst", "flip-3d"], outro: [billing], transitions: ["zoom", "whip", "cut"] },
  },
  {
    id: "film-western", name: "Western", movie: true, preview: "OUT WEST",
    description: "Sepia dust and sunset gold, classic movie capitals, god rays over the horizon, split wipes and slow dissolves.",
    keys: /\b(western|cowboys?|outlaws?|frontier|sheriff|gunslingers?|wild west)\b/,
    mood: { palette: "sepia", font: "cinzel", bpm: 84, hook: [card], title: ["cinematic-title", "god-rays", "sand-reveal"], body: [card, "split-wipe", "sand-reveal"], outro: [billing], transitions: ["dissolve", "cut", "leak"] },
  },
];

/**
 * Detection order for ties: what a film is (a documentary, a comedy) outranks what it's about
 * (a documentary about Mars is a documentary; a rom-com is a comedy first).
 */
const MOVIE_PRIORITY = ["film-doc", "film-horror", "film-comedy", "film-family", "film-romance", "film-western", "film-noir", "film-thriller", "film-fantasy", "film-scifi", "film-action", "film-drama"].map(
  (id) => MOVIE_STYLES.find((s) => s.id === id)!,
);

/** A movie-genre trailer style (letterboxed, with the trailer grammar). */
export function isMovieStyle(id: string | undefined) {
  return !!id && id.startsWith("film-");
}

/** Words that say the trailer is for a film or a series (not a product or a brand). */
export const FILM_CUE = /\b(film|movie|feature film|short film|documentary|docuseries|series|episode|season|cinema|horror|thriller|comedy|rom-?com|romance|drama|western|noir|animated feature|fantasy epic|epic fantasy|tv show|web series|anime)\b/i;

export const TRAILER_STYLES: TrailerStyle[] = [
  {
    id: "cyber",
    name: "Cyber Glitch",
    description: "Glitch reveals, HUD scans and hyperspace on neon black, cut on a fast cyber score. For security, crypto and developer launches.",
    keys: /\b(cyber|hack|matrix|glitch|security|code|dev|crypto|web3|blockchain)/,
    mood: {
      palette: "cyber",
      font: "bebas",
      bpm: 128,
      hook: ["glitch-reveal", "hyperspace", "warp-tunnel", "countdown"],
      title: ["particle-assemble", "glitch-reveal", "glass-shatter", "rift-open"],
      body: ["hud-scan", "glitch-reveal", "kinetic-slam", "split-wipe", "orbit-rings", "flip-3d", "blade-slash"],
      outro: ["cinematic-title", "neon-draw", "god-rays", "anamorphic-flare"],
      transitions: ["glitch", "whip", "flash", "dolly"],
    },
  },
  {
    id: "tech",
    name: "Future Tech",
    description: "Particles assemble the title, orbit rings and liquid gradients, dolly moves and light leaks. The classic tech launch trailer.",
    keys: /\b(ai|tech|futur|saas|app|platform|software|startup|data|cloud|robot|quantum)/,
    mood: {
      palette: "cosmos",
      font: "cinzel",
      bpm: 120,
      hook: ["hyperspace", "shockwave", "warp-tunnel", "countdown"],
      title: ["particle-assemble", "orbit-rings", "god-rays", "flip-3d", "anamorphic-flare", "steel-title"],
      body: ["liquid-gradient", "hud-scan", "orbit-rings", "type-cascade", "kinetic-slam", "flip-3d", "monolith"],
      outro: ["cinematic-title", "particle-assemble", "god-rays", "anamorphic-flare"],
      transitions: ["dolly", "leak", "whip", "zoom"],
    },
  },
  {
    id: "action",
    name: "High Energy",
    description: "Shockwaves, slamming type and shattering glass in fiery orange, whips and flashes at 140 bpm. Sport, fitness, cars and anything fast.",
    keys: /\b(fire|action|sport|fight|power|rage|beast|war|battle|gym|fitness|race|car|speed)/,
    mood: {
      palette: "inferno",
      font: "bebas",
      bpm: 140,
      hook: ["shockwave", "hyperspace", "glass-shatter", "countdown"],
      title: ["shockwave", "kinetic-slam", "glass-shatter", "steel-title", "blade-slash"],
      body: ["kinetic-slam", "split-wipe", "shockwave", "glitch-reveal", "glass-shatter", "flip-3d", "blade-slash", "ember-title"],
      outro: ["cinematic-title", "kinetic-slam", "god-rays", "steel-title"],
      transitions: ["whip", "flash", "dolly", "shutter"],
    },
  },
  {
    id: "space",
    name: "Deep Space",
    description: "Hyperspace jumps, god rays and orbit rings in condensed type, with slow dollies through the stars.",
    keys: /\b(space|galax|cosmic|star|planet|orbit|astro|universe|nasa|rocket)/,
    mood: {
      palette: "cosmos",
      font: "cinzel",
      bpm: 110,
      hook: ["hyperspace", "warp-tunnel", "monolith"],
      title: ["particle-assemble", "shockwave", "god-rays", "eclipse", "anamorphic-flare"],
      body: ["orbit-rings", "cinematic-title", "hud-scan", "liquid-gradient", "god-rays", "monolith", "eclipse"],
      outro: ["cinematic-title", "god-rays", "eclipse"],
      transitions: ["dolly", "leak", "zoom"],
    },
  },
  {
    id: "luxury",
    name: "Black Gold",
    description: "Cinematic titles and god rays in black and gold, light leaks and shutters at a stately tempo. Fashion, jewellery, hotels and premium goods.",
    keys: /\b(luxury|gold|premium|elegant|fashion|jewel|perfume|watch|royal|vip|hotel|wedding)/,
    mood: {
      palette: "gold",
      font: "cinzel",
      bpm: 96,
      hook: ["cinematic-title", "god-rays"],
      title: ["particle-assemble", "cinematic-title", "god-rays", "searchlights", "steel-title"],
      body: ["liquid-gradient", "type-cascade", "cinematic-title", "orbit-rings", "flip-3d"],
      outro: ["cinematic-title", "god-rays", "anamorphic-flare"],
      transitions: ["leak", "shutter", "dolly"],
    },
  },
  {
    id: "retro",
    name: "Retro 80s",
    description: "Neon-drawn type over the synthwave grid, glitches and wipes. Retro, arcade and vapourwave.",
    keys: /\b(retro|80s|synth|vapor|arcade|outrun|vhs|disco|miami)/,
    mood: {
      palette: "synthwave",
      font: "anton",
      bpm: 118,
      hook: ["neon-draw", "hyperspace", "warp-tunnel"],
      title: ["retro-grid", "neon-draw", "steel-title"],
      body: ["neon-draw", "kinetic-slam", "split-wipe", "shape-burst", "flip-3d", "searchlights"],
      outro: ["retro-grid", "steel-title"],
      transitions: ["glitch", "wipe", "leak", "whip"],
    },
  },
  {
    id: "music",
    name: "Neon Night",
    description: "Neon, shockwaves and warp tunnels on a club beat, flash and glitch cuts. Music, events and nightlife.",
    keys: /\b(music|dj|party|club|night|festival|concert|neon|rave|edm|beat)/,
    mood: {
      palette: "synthwave",
      font: "bebas",
      bpm: 128,
      hook: ["neon-draw", "shockwave", "warp-tunnel", "searchlights"],
      title: ["neon-draw", "shockwave", "warp-tunnel", "anamorphic-flare"],
      body: ["kinetic-slam", "neon-draw", "split-wipe", "glitch-reveal", "shape-burst", "glass-shatter", "searchlights"],
      outro: ["neon-draw", "retro-grid", "god-rays"],
      transitions: ["flash", "whip", "glitch", "leak"],
    },
  },
  {
    id: "gaming",
    name: "Gaming Hype",
    description: "Toxic green glitch reveals, shockwaves and HUD scans at 140 bpm. Games, streams and esports.",
    keys: /\b(game|gaming|esport|stream|twitch|youtube|toxic|zombie|clan|squad)/,
    mood: {
      palette: "toxic",
      font: "anton",
      bpm: 140,
      hook: ["glitch-reveal", "shockwave", "warp-tunnel", "countdown"],
      title: ["shockwave", "glitch-reveal", "glass-shatter", "rift-open", "blade-slash"],
      body: ["kinetic-slam", "hud-scan", "split-wipe", "glitch-reveal", "glass-shatter", "blade-slash", "ember-title"],
      outro: ["shockwave", "cinematic-title", "god-rays", "rift-open"],
      transitions: ["glitch", "whip", "flash", "dolly"],
    },
  },
  {
    id: "nature",
    name: "Nature Calm",
    description: "Flowing liquid gradients and soft god rays in aurora colours, slow leaks and dollies. Wellness, travel and eco.",
    keys: /\b(nature|eco|green|organic|health|wellness|calm|yoga|travel|ocean|aurora)/,
    mood: {
      palette: "aurora",
      font: "cinzel",
      bpm: 92,
      hook: ["liquid-gradient", "god-rays", "sand-reveal"],
      title: ["particle-assemble", "liquid-gradient", "god-rays", "eclipse", "sand-reveal"],
      body: ["liquid-gradient", "type-cascade", "orbit-rings", "flip-3d", "sand-reveal"],
      outro: ["cinematic-title", "liquid-gradient", "god-rays"],
      transitions: ["leak", "dolly", "zoom"],
    },
  },
  {
    id: "fun",
    name: "Pop Party",
    description: "Shape bursts, cascading type and 3D flips in candy colours, wipes and whips. Kids, food, social and summer.",
    keys: /\b(fun|kid|party|summer|birthday|colorful|colourful|playful|social|tiktok|reel|food)/,
    mood: {
      palette: "synthwave",
      font: "anton",
      bpm: 124,
      hook: ["shape-burst"],
      title: ["shape-burst", "type-cascade", "flip-3d"],
      body: ["type-cascade", "split-wipe", "shape-burst", "kinetic-slam", "flip-3d"],
      outro: ["shape-burst", "type-cascade", "flip-3d"],
      transitions: ["wipe", "whip", "zoom"],
    },
  },
  {
    id: "editorial",
    name: "Editorial Doc",
    description: "Monochrome type cascades, split wipes and shutters at a measured pace. News, podcasts, business and documentary.",
    keys: /\b(news|editorial|podcast|documentary|corporate|business|finance|report|minimal)/,
    mood: {
      palette: "mono",
      font: "playfair",
      bpm: 100,
      hook: ["type-cascade", "split-wipe", "glass-shatter"],
      title: ["cinematic-title", "type-cascade", "flip-3d", "anamorphic-flare"],
      body: ["split-wipe", "type-cascade", "hud-scan", "kinetic-slam", "flip-3d", "glass-shatter"],
      outro: ["cinematic-title", "god-rays"],
      transitions: ["shutter", "wipe", "whip"],
    },
  },
  {
    id: "hype",
    name: "Hype Trailer",
    description: "The all-rounder: hyperspace, shockwaves and glass shatter in neon cyan with condensed type, flash and whip cuts.",
    mood: {
      palette: "cyber",
      font: "bebas",
      bpm: 124,
      hook: ["hyperspace", "shockwave", "warp-tunnel", "countdown"],
      title: ["particle-assemble", "shockwave", "god-rays", "glass-shatter", "steel-title", "searchlights", "anamorphic-flare"],
      body: ["kinetic-slam", "glitch-reveal", "split-wipe", "liquid-gradient", "type-cascade", "hud-scan", "flip-3d", "glass-shatter", "blade-slash", "ember-title"],
      outro: ["cinematic-title", "god-rays", "searchlights"],
      transitions: ["flash", "whip", "dolly", "leak", "glitch"],
    },
  },
];

/** Brand and launch trailers (products, channels, events), apart from the movie genres. */
export const BRAND_STYLES = TRAILER_STYLES;
export const ALL_TRAILER_STYLES: TrailerStyle[] = [...MOVIE_STYLES, ...TRAILER_STYLES];
export const TRAILER_STYLE_MAP = Object.fromEntries(ALL_TRAILER_STYLES.map((t) => [t.id, t])) as Record<string, TrailerStyle>;
export const DEFAULT_TRAILER_STYLE = "hype";

/** The style whose keywords the text hits most (earlier styles win ties), else the fallback. */
export function detectTrailerStyle(text: string, fallback = DEFAULT_TRAILER_STYLE): TrailerStyle {
  // A film or a series gets a movie-genre trailer (drama when no genre is named); anything else a
  // brand style.
  const film = FILM_CUE.test(text);
  let best = film ? TRAILER_STYLE_MAP["film-drama"] : TRAILER_STYLE_MAP[fallback] ?? TRAILER_STYLE_MAP[DEFAULT_TRAILER_STYLE];
  let hits = 0;
  for (const s of film ? MOVIE_PRIORITY : TRAILER_STYLES) {
      if (!s.keys) continue;
      const n = text.match(new RegExp(s.keys.source, "g"))?.length ?? 0;
      if (n > hits) {
      hits = n;
      best = s;
      }
  }
  return best;
}

/** Every effect some trailer style draws on: scenes using anything else (logo, photos, stats) keep it. */
const TRAILER_FX = new Set<SkillId>(ALL_TRAILER_STYLES.flatMap((s) => [...s.mood.hook, ...s.mood.title, ...s.mood.body, ...s.mood.outro]));

/**
 * Restyle a trailer film instantly: palette, type, tempo, transitions, and the effect each scene
 * plays (opener from the style's hooks, then its title, body and outro effects). Scenes that show
 * your material (logo reveal, product shots, photo montage, screen wall, stats) keep their slide;
 * the words never change. Lengths snap to the new tempo's beats.
 */
export function applyTrailerStyle(plan: VideoPlan, id: string, opts: { palette?: PaletteId } = {}): VideoPlan {
  const style = TRAILER_STYLE_MAP[id];
  if (!style || plan.style === "saas") return plan;
  const m = style.mood;
  const r = rng(hashString(`${plan.seed}:${id}`));
  const pick = <T,>(arr: readonly T[], not?: T) => {
      const pool = arr.filter((x) => x !== not);
      const from = pool.length ? pool : arr;
      return from[Math.floor(r() * from.length)];
  };
  const beat = 60 / m.bpm;
  let lastSkill: SkillId | undefined;
  let lastT: Transition = "cut";
  const n = plan.scenes.length;
  const scenes = plan.scenes.map((s, i) => {
      let skill = s.skill;
      if (TRAILER_FX.has(s.skill)) {
      const pool = i === 0 ? m.hook : i === n - 1 ? m.outro : i === 1 ? m.title : m.body;
      skill = pick(pool, lastSkill);
      }
      lastSkill = skill;
      const transition: Transition = i === 0 ? "cut" : pick(m.transitions, lastT);
      lastT = transition;
      return { ...s, skill, transition, duration: Math.max(4, Math.round(s.duration / beat)) * beat };
  });
  return { ...plan, scenes, palette: opts.palette ?? m.palette, font: m.font, bpm: m.bpm, trailerStyle: id };
}
