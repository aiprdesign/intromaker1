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
}

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
      hook: ["glitch-reveal", "hyperspace", "warp-tunnel"],
      title: ["particle-assemble", "glitch-reveal", "glass-shatter"],
      body: ["hud-scan", "glitch-reveal", "kinetic-slam", "split-wipe", "orbit-rings", "flip-3d"],
      outro: ["cinematic-title", "neon-draw", "god-rays"],
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
      hook: ["hyperspace", "shockwave", "warp-tunnel"],
      title: ["particle-assemble", "orbit-rings", "god-rays", "flip-3d"],
      body: ["liquid-gradient", "hud-scan", "orbit-rings", "type-cascade", "kinetic-slam", "flip-3d"],
      outro: ["cinematic-title", "particle-assemble", "god-rays"],
      transitions: ["dolly", "leak", "whip", "zoom"],
    },
  },
  {
    id: "action",
    name: "Action Blast",
    description: "Shockwaves, slamming type and shattering glass in fiery orange, whips and flashes at 140 bpm. Sport, fitness, cars and anything fast.",
    keys: /\b(fire|action|sport|fight|power|rage|beast|war|battle|gym|fitness|race|car|speed)/,
    mood: {
      palette: "inferno",
      font: "bebas",
      bpm: 140,
      hook: ["shockwave", "hyperspace", "glass-shatter"],
      title: ["shockwave", "kinetic-slam", "glass-shatter"],
      body: ["kinetic-slam", "split-wipe", "shockwave", "glitch-reveal", "glass-shatter", "flip-3d"],
      outro: ["cinematic-title", "kinetic-slam", "god-rays"],
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
      hook: ["hyperspace", "warp-tunnel"],
      title: ["particle-assemble", "shockwave", "god-rays"],
      body: ["orbit-rings", "cinematic-title", "hud-scan", "liquid-gradient", "god-rays"],
      outro: ["cinematic-title", "god-rays"],
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
      title: ["particle-assemble", "cinematic-title", "god-rays"],
      body: ["liquid-gradient", "type-cascade", "cinematic-title", "orbit-rings", "flip-3d"],
      outro: ["cinematic-title", "god-rays"],
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
      title: ["retro-grid", "neon-draw"],
      body: ["neon-draw", "kinetic-slam", "split-wipe", "shape-burst", "flip-3d"],
      outro: ["retro-grid"],
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
      hook: ["neon-draw", "shockwave", "warp-tunnel"],
      title: ["neon-draw", "shockwave", "warp-tunnel"],
      body: ["kinetic-slam", "neon-draw", "split-wipe", "glitch-reveal", "shape-burst", "glass-shatter"],
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
      hook: ["glitch-reveal", "shockwave", "warp-tunnel"],
      title: ["shockwave", "glitch-reveal", "glass-shatter"],
      body: ["kinetic-slam", "hud-scan", "split-wipe", "glitch-reveal", "glass-shatter"],
      outro: ["shockwave", "cinematic-title", "god-rays"],
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
      hook: ["liquid-gradient", "god-rays"],
      title: ["particle-assemble", "liquid-gradient", "god-rays"],
      body: ["liquid-gradient", "type-cascade", "orbit-rings", "flip-3d"],
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
      title: ["cinematic-title", "type-cascade", "flip-3d"],
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
      hook: ["hyperspace", "shockwave", "warp-tunnel"],
      title: ["particle-assemble", "shockwave", "god-rays", "glass-shatter"],
      body: ["kinetic-slam", "glitch-reveal", "split-wipe", "liquid-gradient", "type-cascade", "hud-scan", "flip-3d", "glass-shatter"],
      outro: ["cinematic-title", "god-rays"],
      transitions: ["flash", "whip", "dolly", "leak", "glitch"],
    },
  },
];

export const TRAILER_STYLE_MAP = Object.fromEntries(TRAILER_STYLES.map((t) => [t.id, t])) as Record<string, TrailerStyle>;
export const DEFAULT_TRAILER_STYLE = "hype";

/** The style whose keywords the text hits most (earlier styles win ties), else the fallback. */
export function detectTrailerStyle(text: string, fallback = DEFAULT_TRAILER_STYLE): TrailerStyle {
  let best = TRAILER_STYLE_MAP[fallback] ?? TRAILER_STYLE_MAP[DEFAULT_TRAILER_STYLE];
  let hits = 0;
  for (const s of TRAILER_STYLES) {
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
const TRAILER_FX = new Set<SkillId>(TRAILER_STYLES.flatMap((s) => [...s.mood.hook, ...s.mood.title, ...s.mood.body, ...s.mood.outro]));

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
