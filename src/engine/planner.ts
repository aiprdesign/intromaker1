import { assetUrl } from "./assets";
import { hashString, rng } from "./math";
import { applyTemplate, DEFAULT_TEMPLATE } from "./templates";
import {
  FONTS,
  PALETTE_IDS,
  SKILL_IDS,
  TRANSITIONS,
  type Aspect,
  type Brand,
  type FontId,
  type Media,
  type PaletteId,
  type Scene,
  type SiteData,
  type SkillId,
  type Transition,
  type VideoPlan,
} from "./types";

export type Length = "short" | "standard" | "long";
export const LENGTH_SECONDS: Record<Length, number> = { short: 12, standard: 20, long: 34 };

export type StyleChoice = "auto" | "saas" | "trailer";

export interface PlanRequest {
  prompt: string;
  aspect: Aspect;
  length: Length;
  palette?: PaletteId | "auto";
  seed?: number;
  style?: StyleChoice;
  template?: string;
}

interface Mood {
  palette: PaletteId;
  font: FontId;
  bpm: number;
  hook: SkillId[];
  title: SkillId[];
  body: SkillId[];
  outro: SkillId[];
  transitions: Transition[];
}

const MOODS: { keys: RegExp; mood: Mood }[] = [
  {
    keys: /\b(cyber|hack|matrix|glitch|security|code|dev|crypto|web3|blockchain)/,
    mood: {
      palette: "cyber",
      font: "grotesk",
      bpm: 128,
      hook: ["glitch-reveal", "hyperspace", "warp-tunnel"],
      title: ["particle-assemble", "glitch-reveal", "glass-shatter"],
      body: ["hud-scan", "glitch-reveal", "kinetic-slam", "split-wipe", "orbit-rings", "flip-3d"],
      outro: ["cinematic-title", "neon-draw", "god-rays"],
      transitions: ["glitch", "whip", "flash", "dolly"],
    },
  },
  {
    keys: /\b(ai|tech|futur|saas|app|platform|software|startup|data|cloud|robot|quantum)/,
    mood: {
      palette: "cosmos",
      font: "grotesk",
      bpm: 120,
      hook: ["hyperspace", "shockwave", "warp-tunnel"],
      title: ["particle-assemble", "orbit-rings", "god-rays", "flip-3d"],
      body: ["liquid-gradient", "hud-scan", "orbit-rings", "type-cascade", "kinetic-slam", "flip-3d"],
      outro: ["cinematic-title", "particle-assemble", "god-rays"],
      transitions: ["dolly", "leak", "whip", "zoom"],
    },
  },
  {
    keys: /\b(fire|action|sport|fight|power|rage|beast|war|battle|gym|fitness|race|car|speed)/,
    mood: {
      palette: "inferno",
      font: "anton",
      bpm: 140,
      hook: ["shockwave", "hyperspace", "glass-shatter"],
      title: ["shockwave", "kinetic-slam", "glass-shatter"],
      body: ["kinetic-slam", "split-wipe", "shockwave", "glitch-reveal", "glass-shatter", "flip-3d"],
      outro: ["cinematic-title", "kinetic-slam", "god-rays"],
      transitions: ["whip", "flash", "dolly", "shutter"],
    },
  },
  {
    keys: /\b(space|galax|cosmic|star|planet|orbit|astro|universe|nasa|rocket)/,
    mood: {
      palette: "cosmos",
      font: "anton",
      bpm: 110,
      hook: ["hyperspace", "warp-tunnel"],
      title: ["particle-assemble", "shockwave", "god-rays"],
      body: ["orbit-rings", "cinematic-title", "hud-scan", "liquid-gradient", "god-rays"],
      outro: ["cinematic-title", "god-rays"],
      transitions: ["dolly", "leak", "zoom"],
    },
  },
  {
    keys: /\b(luxury|gold|premium|elegant|fashion|jewel|perfume|watch|royal|vip|hotel|wedding)/,
    mood: {
      palette: "gold",
      font: "grotesk",
      bpm: 96,
      hook: ["cinematic-title", "god-rays"],
      title: ["particle-assemble", "cinematic-title", "god-rays"],
      body: ["liquid-gradient", "type-cascade", "cinematic-title", "orbit-rings", "flip-3d"],
      outro: ["cinematic-title", "god-rays"],
      transitions: ["leak", "shutter", "dolly"],
    },
  },
  {
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
    keys: /\b(music|dj|party|club|night|festival|concert|neon|rave|edm|beat)/,
    mood: {
      palette: "synthwave",
      font: "anton",
      bpm: 128,
      hook: ["neon-draw", "shockwave", "warp-tunnel"],
      title: ["neon-draw", "shockwave", "warp-tunnel"],
      body: ["kinetic-slam", "neon-draw", "split-wipe", "glitch-reveal", "shape-burst", "glass-shatter"],
      outro: ["neon-draw", "retro-grid", "god-rays"],
      transitions: ["flash", "whip", "glitch", "leak"],
    },
  },
  {
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
    keys: /\b(nature|eco|green|organic|health|wellness|calm|yoga|travel|ocean|aurora)/,
    mood: {
      palette: "aurora",
      font: "grotesk",
      bpm: 92,
      hook: ["liquid-gradient", "god-rays"],
      title: ["particle-assemble", "liquid-gradient", "god-rays"],
      body: ["liquid-gradient", "type-cascade", "orbit-rings", "flip-3d"],
      outro: ["cinematic-title", "liquid-gradient", "god-rays"],
      transitions: ["leak", "dolly", "zoom"],
    },
  },
  {
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
    keys: /\b(news|editorial|podcast|documentary|corporate|business|finance|report|minimal)/,
    mood: {
      palette: "mono",
      font: "grotesk",
      bpm: 100,
      hook: ["type-cascade", "split-wipe", "glass-shatter"],
      title: ["cinematic-title", "type-cascade", "flip-3d"],
      body: ["split-wipe", "type-cascade", "hud-scan", "kinetic-slam", "flip-3d", "glass-shatter"],
      outro: ["cinematic-title", "god-rays"],
      transitions: ["shutter", "wipe", "whip"],
    },
  },
];

const DEFAULT_MOOD: Mood = {
  palette: "cyber",
  font: "anton",
  bpm: 124,
  hook: ["hyperspace", "shockwave", "warp-tunnel"],
  title: ["particle-assemble", "shockwave", "god-rays", "glass-shatter"],
  body: ["kinetic-slam", "glitch-reveal", "split-wipe", "liquid-gradient", "type-cascade", "hud-scan", "flip-3d", "glass-shatter"],
  outro: ["cinematic-title", "god-rays"],
  transitions: ["flash", "whip", "dolly", "leak", "glitch"],
};

/** Words that never carry meaning in a prompt. */
const FILLER = new Set(
  (
    "make create generate build give me i want need please video intro outro trailer teaser promo launch launching " +
    "motion graphics graphic animation animated epic modern cinematic style called named " +
    "some very really super cool awesome amazing using use like vibe vibes feel feeling seconds second sec"
  ).split(" "),
);
/** Glue words kept inside a phrase but trimmed from its edges. */
const GLUE = new Set(
  "a an the and or of for to in on with by at from into as is are be it its this that my our your about".split(" "),
);
const STOP = new Set([...FILLER, ...GLUE]);

const HOOKS = ["GET READY", "INTRODUCING", "ARE YOU READY", "THE WAIT IS OVER", "IT BEGINS NOW", "LEGENDS RISE"];
const OUTRO_SUBS = ["Coming soon", "Available now", "Join the movement", "Start today", "Experience it"];

function extractBrand(prompt: string): string | null {
  const quoted = prompt.match(/["“'‘]([^"”'’]{2,32})["”'’]/);
  if (quoted) return quoted[1].trim();
  const named = prompt.match(/\b(?:called|named|for|brand|channel|company|startup|product)\s+([A-Z][\w.&-]*(?:\s+[A-Z0-9][\w.&-]*){0,2})/);
  if (named) return named[1].trim();
  const caps = prompt.match(/\b([A-Z][A-Z0-9.&-]{1,}(?:\s+[A-Z0-9][A-Z0-9.&-]+){0,2})\b/);
  if (caps) return caps[1].trim();
  return null;
}

function phrases(prompt: string, brand: string | null): string[] {
  let p = prompt;
  if (brand) p = p.split(brand).join(" , ");
  const chunks = p
    .replace(/["“”'‘’]/g, " ")
    .split(/[,.;:!?\n—–]|\s-\s|\band\b|\bwith\b|\bthat\b|\bwho\b|\bwhich\b/i)
    .map((c) => c.split(/\s+/).filter((w) => /\w/.test(w) && !FILLER.has(w.toLowerCase())));
  const trim = (words: string[]) => {
    const out = [...words];
    while (out.length && GLUE.has(out[0].toLowerCase())) out.shift();
    while (out.length && GLUE.has(out[out.length - 1].toLowerCase())) out.pop();
    return out;
  };
  const out: string[] = [];
  for (const raw of chunks) {
    const words = trim(raw);
    if (words.join("").length < 2) continue;
    // Keep short phrases whole; split long ones into 3-word beats.
    const size = words.length <= 4 && words.join(" ").length <= 26 ? 4 : words.length <= 4 ? 2 : 3;
    for (let i = 0; i < words.length; i += size) {
      const beat = trim(words.slice(i, i + size));
      if (beat.length) out.push(beat.join(" ").toUpperCase());
    }
  }
  // Bare numbers/years are handled as stats or outro dates, not headlines.
  return [...new Set(out)].filter((s) => s.length <= 28 && !/^[\d\s.,%+$€£kmb]+$/i.test(s));
}

function stats(prompt: string): string[] {
  const out: string[] = [];
  // A number must stand alone ("80s" or "3D" are words, not stats).
  const re =
    /(?<![\w.])([$€£]?\d[\d,.]*(?:\s*(?:million|billion|thousand)\b|[kKmMbBx]\b|%)?\+?)(?![a-zA-Z\d])\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt))) {
    const num = m[1]
      .replace(/\s*million/i, "M")
      .replace(/\s*billion/i, "B")
      .replace(/\s*thousand/i, "K")
      .trim();
    if (/^(19|20)\d\d$/.test(num)) continue; // years become text, not stats
    const label = (m[2] ?? "").split(" ").filter((w) => !STOP.has(w.toLowerCase())).join(" ");
    out.push(`${num} ${label}`.trim().toUpperCase());
  }
  return out;
}

/** Product/SaaS prompts get the modern launch-film treatment unless they ask for a trailer. */
export function isSaasPrompt(prompt: string) {
  const l = prompt.toLowerCase();
  return (
    /\b(saas|app|platform|software|startup|product|dashboard|b2b|api|crm|tool|workspace|launch video|explainer|demo)\b/.test(l) &&
    !/\b(epic|trailer|cinematic|game|gaming|movie|film|hype|festival|documentary)\b/.test(l)
  );
}

/** Recover a phrase's original casing from the prompt ("AI insights", not "Ai insights"). */
function naturalCase(phrase: string, source: string) {
  const i = source.toLowerCase().indexOf(phrase.toLowerCase());
  const raw = i >= 0 ? source.slice(i, i + phrase.length) : phrase.charAt(0) + phrase.slice(1).toLowerCase();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function planFromPromptSaas(req: PlanRequest): VideoPlan {
  const prompt = req.prompt.trim();
  const seed = (req.seed ?? hashString(prompt)) >>> 0;
  const r = rng(seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
  const bpm = pick([116, 120, 124] as const);
  const beat = 60 / bpm;
  const brand = extractBrand(prompt) ?? "Your product";
  const numbers = stats(prompt);
  const body = phrases(prompt, brand)
    .filter((p) => !numbers.some((n) => n.includes(p)))
    .map((p) => naturalCase(p, prompt))
    .filter((p) => p.split(" ").length <= 6);
  // The clause right after the brand is usually its one-line pitch: "an analytics app for product teams".
  const pitch = prompt
    .slice(prompt.indexOf(brand) + brand.length)
    .replace(/^["'”’\s,:—–-]+/, "")
    .split(/[.;!?\n]|,\s/)[0]
    .trim()
    .replace(/^(is\s+)?(an?|the)\s+/i, "The ");
  const pitchOk = pitch.split(/\s+/).length >= 3 && pitch.split(/\s+/).length <= 10;
  const tagline = pitchOk ? pitch : body[0] ?? `Meet ${brand}`;
  const features = body.filter((b) => !tagline.toLowerCase().includes(b.toLowerCase()));
  const target = LENGTH_SECONDS[req.length];
  const scenes: Scene[] = [
    { role: "hook", skill: "blur-reveal", text: tagline, items: [`Introducing ${brand}`], duration: 7 * beat, transition: "cut" },
    { role: "reveal", skill: "particle-assemble", text: brand, duration: 6 * beat, transition: "dolly" },
  ];
  if (features.length >= 3) {
    scenes.push({ role: "bento", skill: "bento", text: `Everything in *${brand}*`, items: features.slice(0, 6), duration: Math.max(4.4, 10 * beat), transition: "whip" });
  } else if (features.length) {
    scenes.push({ skill: "blur-reveal", text: features.join(". "), duration: 7 * beat, transition: "whip" });
  }
  if (numbers.length) {
    scenes.push({
      role: "cards", skill: "ui-cards",
      text: `See ${brand} *in action*`,
      items: [features[0] ?? brand, naturalCase(numbers[0], prompt), features[1] ?? "", features[2] ?? ""],
      duration: Math.max(4.2, 9 * beat),
      transition: "dolly",
    });
  }
  const used = scenes.reduce((a, s) => a + s.duration, 0);
  if (used + 8 * beat < target && features.length >= 2) {
    scenes.push({ skill: "word-swap", text: `Built for ${features.slice(0, 3).map((f) => f.toLowerCase()).join("|")}`, duration: 8 * beat, transition: "whip" });
  }
  scenes.push({ role: "cta", skill: "cta", text: `Try *${brand}* today`, subtext: "Get started", duration: Math.max(3.6, 8 * beat), transition: "dolly" });
  const plan = sanitizePlan({ title: brand, palette: "cosmos", font: "inter", aspect: req.aspect, bpm, seed, scenes, style: "saas" });
  return applyTemplate(plan, req.template ?? DEFAULT_TEMPLATE, {
    palette: req.palette && req.palette !== "auto" ? req.palette : undefined,
  });
}

/** Built-in rule-based director: prompt → storyboard. Deterministic for a given seed. */
export function planFromPrompt(req: PlanRequest): VideoPlan {
  if (req.style === "saas" || (req.style !== "trailer" && isSaasPrompt(req.prompt))) return planFromPromptSaas(req);
  const prompt = req.prompt.trim() || "Epic intro";
  const lower = prompt.toLowerCase();
  const seed = (req.seed ?? hashString(prompt)) >>> 0;
  const r = rng(seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];

  // Score every mood by keyword hits; earlier moods win ties.
  let mood = DEFAULT_MOOD;
  let best = 0;
  for (const m of MOODS) {
    const hits = lower.match(new RegExp(m.keys.source, "g"))?.length ?? 0;
    if (hits > best) {
      best = hits;
      mood = m.mood;
    }
  }
  const brand = extractBrand(prompt);
  const numbers = stats(prompt);
  // Drop phrases that only describe the video's style ("retro 80s synthwave", "hype gaming channel").
  const STYLE =
    /^(hype|hyped|channel|documentary|opener|opening|playful|colorful|colourful|dark|bright|energetic|dramatic|dynamic|bold|sleek|clean|minimal|minimalist|vibrant|glowing|futuristic|aesthetic|themed|theme|looking|style|80s|90s|neon|retro|cyberpunk|synthwave|luxury|premium|gaming|sci-fi|scifi)$/i;
  const isStyle = (w: string) => STYLE.test(w);
  const styleOnly = (p: string) => {
    const words = p.split(" ");
    return words.filter(isStyle).length * 2 >= words.length;
  };
  const allPhrases = phrases(prompt, brand).filter((p) => !numbers.some((n) => n.includes(p)));
  const content = allPhrases.filter((p) => !styleOnly(p));
  let body = content.length ? content : allPhrases;
  const target = LENGTH_SECONDS[req.length];
  const year = prompt.match(/\b(19|20)\d\d\b/)?.[0];

  const scenes: Scene[] = [];
  const usedSkills = new Set<SkillId>();
  /** Prefer skills not used yet, never the same as the previous scene. */
  const pickSkill = (pool: SkillId[], prev: SkillId | null): SkillId => {
    const fresh = pool.filter((s) => !usedSkills.has(s) && s !== prev);
    const ok = pool.filter((s) => s !== prev);
    const skill = pick(fresh.length ? fresh : ok.length ? ok : pool);
    usedSkills.add(skill);
    return skill;
  };
  // Pacing in beats: a short hook, a long title hold, snappy beats, a long outro.
  const beat = 60 / mood.bpm;
  const beats = (n: number, minSec: number) => Math.max(n, Math.ceil(minSec / beat)) * beat;
  const HOOK = beats(6, 2.6);
  const TITLE = beats(8, 3.4);
  const BEAT = beats(mood.bpm >= 124 ? 5 : 6, 2.4);
  const STAT = beats(6, 2.8);
  const OUTRO = beats(8, 3.6);
  let lastTransition: Transition = "cut";
  const nextTransition = (pool: readonly Transition[]) => {
    const options = pool.filter((t) => t !== lastTransition);
    lastTransition = pick(options.length ? options : [...pool]);
    return lastTransition;
  };

  const hookText = /\blaunch|release|drop|coming/.test(lower) ? "THE WAIT IS OVER" : pick(HOOKS);
  scenes.push({ skill: pickSkill(mood.hook, null), text: hookText, duration: HOOK, transition: "cut" });

  // The phrase right after the brand usually describes it ("NOVA AI, an AI copilot for…").
  const afterBrand = brand ? phrases(prompt.slice(prompt.indexOf(brand) + brand.length), null)[0] : undefined;
  const title = (brand ?? body.shift() ?? "YOUR BRAND").toUpperCase();
  const tagline = afterBrand ?? body[0];
  body = body.filter((b) => b !== tagline);
  scenes.push({
    skill: pickSkill(mood.title, scenes[0].skill),
    text: title,
    subtext: tagline ? tagline.toLowerCase() : undefined,
    duration: TITLE,
    transition: nextTransition(mood.transitions),
  });

  let used = HOOK + TITLE + OUTRO;
  const bodyPool = [...mood.body];
  let last: SkillId | null = scenes[1].skill;
  const queue = [...numbers.map((n) => ({ text: n, stat: true })), ...body.map((b) => ({ text: b, stat: false }))];
  while (queue.length) {
    const item = queue[0];
    const dur = item.stat ? STAT : BEAT;
    // Always keep at least one feature beat, even at slow tempos.
    if (used + dur > target + 1 && scenes.length > 2) break;
    queue.shift();
    const skill: SkillId = item.stat ? "number-ticker" : pickSkill(bodyPool, last);
    scenes.push({ skill, text: item.text, duration: dur, transition: nextTransition(mood.transitions) });
    last = skill;
    used += dur;
  }
  // Pad short prompts with brand-flavoured beats.
  const fillers = ["BIGGER", "BOLDER", "NEXT LEVEL", "NO LIMITS", "BUILT DIFFERENT", "UNSTOPPABLE"];
  while (used + BEAT <= target + 0.5 && fillers.length) {
    const skill = pickSkill(bodyPool, last);
    const text = fillers.splice(Math.floor(r() * fillers.length), 1)[0];
    scenes.push({ skill, text, duration: BEAT, transition: nextTransition(mood.transitions) });
    last = skill;
    used += BEAT;
  }

  scenes.push({
    skill: pickSkill(mood.outro, last),
    text: title,
    subtext: year ? `${pick(OUTRO_SUBS)} · ${year}` : pick(OUTRO_SUBS),
    duration: OUTRO,
    transition: nextTransition(["leak", "dolly", "shutter"]),
  });

  const palette = req.palette && req.palette !== "auto" ? req.palette : mood.palette;
  return beatSync(sanitizePlan({
    title: title,
    palette,
    font: mood.font,
    aspect: req.aspect,
    bpm: mood.bpm,
    seed,
    scenes,
  }));
}

export function brandFromSite(site: SiteData, colors?: Brand["colors"]): Brand {
  return {
    name: site.name,
    domain: site.domain,
    logo: site.logo ? assetUrl(site.logo) : undefined,
    images: site.images.map(assetUrl),
    videos: site.videos.map(assetUrl),
    clientLogos: site.clientLogos.map(assetUrl),
    font: site.font ?? undefined,
    colors,
  };
}

/** Coerce untrusted JSON into SiteData (only http(s) asset URLs survive). */
export function readSite(raw: unknown): SiteData | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object" || typeof r.url !== "string" || typeof r.name !== "string") return null;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const http = (v: unknown) => typeof v === "string" && /^https?:\/\//i.test(v) && v.length < 2000;
  const strs = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, n).map((x) => x.slice(0, max)) : []);
  return {
    url: str(r.url, 2000),
    domain: str(r.domain, 120),
    name: str(r.name, 60) || "Your brand",
    tagline: str(r.tagline, 200),
    description: str(r.description, 400),
    headlines: strs(r.headlines, 14, 80),
    features: strs(r.features, 14, 160),
    stats: strs(r.stats, 6, 40),
    testimonials: (Array.isArray(r.testimonials) ? r.testimonials : [])
      .filter((q): q is Record<string, unknown> => !!q && typeof q === "object" && typeof (q as Record<string, unknown>).quote === "string")
      .slice(0, 4)
      .map((q) => ({
        quote: String(q.quote).slice(0, 280),
        author: String(q.author ?? "").slice(0, 60),
        role: String(q.role ?? "").slice(0, 80),
        avatar: http(q.avatar) ? (q.avatar as string) : null,
      })),
    clientLogos: (Array.isArray(r.clientLogos) ? r.clientLogos : []).filter(http).slice(0, 16) as string[],
    steps: strs(r.steps, 4, 60),
    pains: strs(r.pains, 4, 50),
    font: typeof r.font === "string" && /^[A-Za-z0-9 ]{2,40}$/.test(r.font) ? r.font : null,
    shots: (() => {
      const sh = (r.shots ?? {}) as Record<string, unknown>;
      return {
        hero: isShot(sh.hero) ? sh.hero : null,
        full: isShot(sh.full) ? sh.full : null,
        sections: (Array.isArray(sh.sections) ? sh.sections : []).filter(isShot).slice(0, 6),
      };
    })(),
    cta: typeof r.cta === "string" ? r.cta.slice(0, 40) : null,
    logo: http(r.logo) ? (r.logo as string) : null,
    images: (Array.isArray(r.images) ? r.images : []).filter(http).slice(0, 14) as string[],
    videos: (Array.isArray(r.videos) ? r.videos : []).filter(http).slice(0, 4) as string[],
    themeColor: typeof r.themeColor === "string" && /^#[0-9a-f]{3,8}$/i.test(r.themeColor) ? r.themeColor : null,
  };
}

/** Trim marketing copy to a punchy headline of at most `max` words. */
function punchy(text: string, max: number) {
  const first = text.split(/[.!?;:—–|]|\s-\s|,\s/)[0].trim();
  const words = first.split(/\s+/).filter(Boolean);
  return words.length <= max ? first : "";
}

/**
 * Built-in director for an imported website: logo reveal, the real product in a 3D browser,
 * feature beats over the site's own imagery, stats, a screen wall and a CTA outro.
 */
export interface SiteRequest {
  aspect: Aspect;
  length: Length;
  palette?: PaletteId | "auto";
  seed?: number;
  colors?: Brand["colors"];
  style?: StyleChoice;
  template?: string;
}

/** Website → intro. SaaS launch-film structure by default; epic trailer cut on request. */
export function planFromSite(site: SiteData, req: SiteRequest): VideoPlan {
  return req.style === "trailer" ? planFromSiteTrailer(site, req) : planFromSiteSaas(site, req);
}

/** Sentence-case copy: trim, drop trailing period for headlines, keep the site's own casing. */
function sentenceCopy(text: string, maxWords: number) {
  const first = text.split(/(?<=[.!?])\s|\s[—–|]\s/)[0].trim();
  const words = first.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > maxWords) return "";
  return first;
}

/**
 * The launch-film story arc used by best-in-class SaaS videos, built only from the site's
 * real content, with chapter labels so every scene reads as part of one story:
 *   1. Hook      — the problem (struck-through pains) or the product's promise
 *   2. Reveal    — the logo, with the promise as its line
 *   3. Meet      — the real website scrolling in a browser
 *   4. How       — "how it works" steps
 *   5. Features  — a cursor tour of the product, then a bento of features
 *   6. Proof     — real testimonial, customer logos, real stats
 *   7. Ecosystem — integrations, if the site mentions them
 *   8. CTA       — closing line + the site's own button, clicked
 */
function planFromSiteSaas(site: SiteData, req: SiteRequest): VideoPlan {
  const seed = (req.seed ?? hashString(site.url)) >>> 0;
  const r = rng(seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
  const bpm = pick([116, 120, 124] as const);
  const beat = 60 / bpm;
  const beats = (n: number) => n * beat;
  const target = LENGTH_SECONDS[req.length];
  const brand = brandFromSite(site, req.colors);
  const img = (src: string | null | undefined): Media | undefined => (src ? { src, kind: "image" } : undefined);
  const images = brand.images.map((src): Media => ({ src, kind: "image" }));
  const video: Media | undefined = brand.videos[0] ? { src: brand.videos[0], kind: "video" } : undefined;
  const shots = site.shots ?? { hero: null, full: null, sections: [] };

  const tagline = sentenceCopy(site.tagline, 10) || sentenceCopy(site.description, 12) || `Meet ${site.name}`;
  const shortFeatures = site.headlines.map((h) => sentenceCopy(h, 6)).filter((h) => h && h !== tagline);
  const longFeatures = site.headlines.map((h) => sentenceCopy(h, 9)).filter((h) => h && h !== tagline);
  const stat = site.stats.find((st) => /team|customer|compan|user|business|developer|people|brand|org/i.test(st));
  const quote = site.testimonials.find((q) => q.quote.length <= 190 && q.author);
  const integrationLine = site.headlines.find((h) => /integrat|connect|tools|apps|stack|plug/i.test(h));
  const pains = (site.pains ?? []).slice(0, 3);

  type Beat = { scene: Scene; priority: number };
  const candidates: Beat[] = [];
  const add = (priority: number, scene: Scene) => candidates.push({ priority, scene });

  // 1. Hook: the problem, or the promise.
  const painHook = pains.length >= 2;
  if (painHook) {
    add(1, {
      role: "pain", skill: "pain-strike",
      text: "There's a *better* way.",
      items: pains,
      eyebrow: "The old way",
      duration: beats(pains.length * 2 + 5),
      transition: "cut",
    });
  } else {
    add(1, { role: "hook", skill: "blur-reveal", text: tagline, eyebrow: `Introducing ${site.name}`, duration: beats(7), transition: "cut" });
  }
  // 2. Reveal.
  add(1, {
    role: "reveal", skill: brand.logo ? "logo-reveal" : "particle-assemble",
    text: site.name,
    subtext: painHook ? tagline : site.domain,
    duration: beats(6),
    transition: "dolly",
  });
  // 3. Meet: the real website.
  if (shots.full) {
    add(3, {
      role: "meet", skill: "site-scroll",
      text: painHook ? tagline : sentenceCopy(site.description, 10) || tagline,
      eyebrow: `Meet ${site.name}`,
      duration: Math.max(5, beats(10)),
      transition: "whip",
      media: img(shots.full),
    });
  }
  // 4. How it works.
  if (site.steps && site.steps.length >= 2) {
    add(5, {
      role: "how", skill: "steps",
      text: `Get started in *${site.steps.length} steps*`,
      items: site.steps.slice(0, 4),
      eyebrow: "How it works",
      duration: Math.max(4.4, beats(site.steps.length * 2 + 4)),
      transition: "dolly",
    });
  }
  // 5. Features: cursor tour on the product, then a bento.
  const tourMedia = video ?? images[0] ?? img(shots.sections[0]) ?? img(shots.hero);
  if (tourMedia) {
    add(4, {
      role: "tour", skill: "ui-tour",
      text: longFeatures[0] ?? `See ${site.name} in action`,
      items: shortFeatures.slice(1, 3),
      eyebrow: "Features",
      duration: Math.max(5.6, beats(12)),
      transition: "whip",
      media: tourMedia,
    });
  }
  if (shortFeatures.length >= 3) {
    add(6, {
      role: "bento", skill: "bento",
      text: `Everything in *${site.name}*`,
      items: shortFeatures.slice(0, 6),
      eyebrow: "All-in-one",
      duration: Math.max(4.4, beats(10)),
      transition: "dolly",
    });
  }
  // 6. Proof — only real quotes, logos and numbers.
  if (quote) {
    add(5, {
      role: "quote", skill: "testimonial",
      text: quote.quote,
      subtext: [quote.author, quote.role].filter(Boolean).join(" · "),
      eyebrow: "Loved by teams",
      duration: Math.max(4.6, beats(10)),
      transition: "leak",
      ...(quote.avatar ? { media: { src: assetUrl(quote.avatar), kind: "image" as const } } : {}),
    });
  }
  if (brand.clientLogos && brand.clientLogos.length >= 4) {
    add(6, {
      role: "logos", skill: "logo-marquee",
      text: stat ? `Trusted by *${stat.toLowerCase()}*` : "Trusted by *leading teams*",
      eyebrow: "Customers",
      duration: beats(7),
      transition: "dolly",
    });
  }
  const cardsMedia = img(shots.sections[1]) ?? images[1] ?? img(shots.hero) ?? images[0];
  if (site.stats.length && cardsMedia) {
    add(7, {
      role: "cards", skill: "ui-cards",
      text: longFeatures[1] ?? `${site.name}, *in action*`,
      items: [shortFeatures[0] ?? site.name, site.stats[0], shortFeatures[1] ?? "", shortFeatures[2] ?? ""],
      eyebrow: "Results",
      duration: Math.max(4.2, beats(9)),
      transition: "whip",
      media: cardsMedia,
    });
  }
  // 7. Ecosystem.
  if (integrationLine) {
    add(8, {
      role: "integrations", skill: "integrations",
      text: sentenceCopy(integrationLine, 9) || integrationLine,
      eyebrow: "Integrations",
      duration: beats(8),
      transition: "whip",
    });
  }
  // 8. CTA.
  add(1, {
    role: "cta", skill: "cta",
    text: `Try *${site.name}* today`,
    subtext: site.cta ?? "Get started",
    duration: Math.max(3.6, beats(8)),
    transition: "dolly",
  });

  // Keep the highest-priority beats that fit, in story order.
  const order = candidates.map((c, i) => ({ ...c, i }));
  const chosen = new Set<number>();
  let used = 0;
  for (const c of [...order].sort((a, b) => a.priority - b.priority || a.i - b.i)) {
    if (c.priority <= 1 || used + c.scene.duration <= target + 1.5) {
      chosen.add(c.i);
      used += c.scene.duration;
    }
  }
  const scenes = order.filter((c) => chosen.has(c.i)).map((c) => c.scene);

  const plan = sanitizePlan({ title: site.name, palette: "cosmos", font: "inter", aspect: req.aspect, bpm, seed, scenes, brand, style: "saas" });
  return applyTemplate(plan, req.template ?? DEFAULT_TEMPLATE, {
    palette: req.palette && req.palette !== "auto" ? req.palette : undefined,
  });
}

function planFromSiteTrailer(site: SiteData, req: SiteRequest): VideoPlan {
  const text = [site.name, site.tagline, site.description, ...site.headlines].join(" ").toLowerCase();
  const seed = (req.seed ?? hashString(site.url)) >>> 0;
  const r = rng(seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
  let mood = MOODS[1].mood; // SaaS default: tech
  let best = 0;
  for (const m of MOODS) {
    const hits = text.match(new RegExp(m.keys.source, "g"))?.length ?? 0;
    if (hits > best) {
      best = hits;
      mood = m.mood;
    }
  }
  const beat = 60 / mood.bpm;
  const beats = (n: number, minSec: number) => Math.max(n, Math.ceil(minSec / beat)) * beat;
  const target = LENGTH_SECONDS[req.length];

  const brand = brandFromSite(site, req.colors);
  const name = site.name.toUpperCase();
  const tagline = punchy(site.tagline, 9) || punchy(site.description, 9);
  const features = site.headlines.map((h) => punchy(h, 6)).filter((h) => h && h.toLowerCase() !== tagline.toLowerCase());
  const images = brand.images.map((src): Media => ({ src, kind: "image" }));
  const video: Media | undefined = brand.videos[0] ? { src: brand.videos[0], kind: "video" } : undefined;

  const scenes: Scene[] = [];
  let lastT: Transition = "cut";
  const tr = (pool: readonly Transition[]) => {
    const options = pool.filter((t) => t !== lastT);
    lastT = pick(options.length ? options : pool);
    return lastT;
  };

  scenes.push({ skill: pick(["warp-tunnel", "hyperspace", "god-rays"] as const), text: "INTRODUCING", duration: beats(6, 2.6), transition: "cut" });
  scenes.push({
    skill: brand.logo ? "logo-reveal" : pick(["particle-assemble", "god-rays"] as const),
    text: name,
    subtext: tagline || undefined,
    duration: beats(8, 3.6),
    transition: tr(["flash", "dolly"]),
  });
  const hero = video ?? images[0];
  if (hero) {
    scenes.push({
      skill: "product-showcase",
      text: features.shift() ?? (tagline || "SEE IT IN ACTION"),
      subtext: site.domain,
      duration: beats(10, 4.2),
      transition: tr(["whip", "dolly", "zoom"]),
    });
    scenes[scenes.length - 1].media = hero;
  }

  const outroLen = beats(8, 3.6);
  let used = scenes.reduce((a, s) => a + s.duration, 0) + outroLen;
  const BEAT = beats(6, 2.6);
  const body = [...mood.body];
  let imgIdx = hero === images[0] ? 1 : 0;
  let last = scenes[scenes.length - 1].skill;
  const stats = site.stats.slice(0, 2);
  const queue: { text: string; stat?: boolean }[] = [];
  // Interleave stats between features.
  features.forEach((f, i) => {
    queue.push({ text: f });
    if (stats[i]) queue.push({ text: stats[i], stat: true });
  });
  stats.slice(features.length).forEach((s) => queue.push({ text: s, stat: true }));
  let featureCount = 0;
  const wall = images.length >= 3;
  const reserve = wall ? BEAT : 0;
  for (const item of queue) {
    if (used + BEAT + reserve > target + 1 && scenes.length > 3) break;
    let skill: SkillId;
    let media: Media | undefined;
    if (item.stat) skill = "number-ticker";
    else if (images[imgIdx] && featureCount % 2 === 0) {
      skill = "photo-montage";
      media = images[imgIdx++];
    } else {
      const opts = body.filter((s) => s !== last);
      skill = pick(opts.length ? opts : body);
    }
    if (!item.stat) featureCount++;
    scenes.push({ skill, text: item.text, duration: BEAT, transition: tr(mood.transitions), ...(media ? { media } : {}) });
    last = skill;
    used += BEAT;
  }
  if (wall) {
    scenes.push({
      skill: "screen-wall",
      text: pick(["ALL IN ONE PLACE", "BUILT FOR SCALE", "EVERYTHING YOU NEED"] as const),
      subtext: site.domain,
      duration: BEAT,
      transition: tr(["dolly", "whip", "zoom"]),
    });
  }
  scenes.push({
    skill: brand.logo ? "logo-reveal" : pick(["god-rays", "cinematic-title"] as const),
    text: name,
    subtext: `${site.cta ?? "Get started"} · ${site.domain}`,
    duration: outroLen,
    transition: tr(["leak", "shutter", "dolly"]),
  });

  const palette = req.palette && req.palette !== "auto" ? req.palette : mood.palette;
  return beatSync(
    sanitizePlan({ title: site.name, palette, font: mood.font, aspect: req.aspect, bpm: mood.bpm, seed, scenes, brand, style: "trailer" }),
  );
}

/** Snap scene lengths to whole beats so every cut lands on a kick drum. */
export function beatSync(plan: VideoPlan): VideoPlan {
  const beat = 60 / plan.bpm;
  return {
    ...plan,
    scenes: plan.scenes.map((s) => ({ ...s, duration: Math.max(4, Math.round(s.duration / beat)) * beat })),
  };
}

/** Only same-origin proxied assets may be referenced by a plan. */
const isShot = (s: unknown): s is string => typeof s === "string" && /^\/api\/shot\?id=[a-f0-9]{16}-(hero|full|s\d)$/.test(s);
const isAsset = (s: unknown): s is string =>
  (typeof s === "string" && s.startsWith("/api/asset?url=") && s.length < 2100) || isShot(s);
const isHex = (s: unknown): s is string => typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);

function sanitizeMedia(m: unknown): Media | undefined {
  const media = m as Partial<Media> | undefined;
  if (!media || !isAsset(media.src)) return undefined;
  return { src: media.src, kind: media.kind === "video" ? "video" : "image" };
}

function sanitizeBrand(b: unknown): Brand | undefined {
  const brand = b as Partial<Brand> | undefined;
  if (!brand || typeof brand.name !== "string") return undefined;
  return {
    name: brand.name.slice(0, 60),
    domain: typeof brand.domain === "string" ? brand.domain.slice(0, 80) : undefined,
    logo: isAsset(brand.logo) ? brand.logo : undefined,
    images: (brand.images ?? []).filter(isAsset).slice(0, 14),
    videos: (brand.videos ?? []).filter(isAsset).slice(0, 4),
    clientLogos: (brand.clientLogos ?? []).filter(isAsset).slice(0, 16),
    font: typeof brand.font === "string" && /^[A-Za-z0-9 ]{2,40}$/.test(brand.font) ? brand.font : undefined,
    colors: brand.colors && isHex(brand.colors.primary) && isHex(brand.colors.secondary) ? brand.colors : undefined,
  };
}

/** Clamp and repair a plan from any source (AI, URL, user edits). */
export function sanitizePlan(raw: Partial<VideoPlan> & { scenes?: Partial<Scene>[] }): VideoPlan {
  const scenes: Scene[] = (raw.scenes ?? [])
    .slice(0, 16)
    .map((s) => ({
      skill: (SKILL_IDS as readonly string[]).includes(s.skill as string) ? (s.skill as SkillId) : "kinetic-slam",
      text: String(s.text ?? "").slice(0, 200) || "Untitled",
      subtext: s.subtext ? String(s.subtext).slice(0, 100) : undefined,
      duration: Math.min(8, Math.max(1.6, Number(s.duration) || 3)),
      transition: (TRANSITIONS as readonly string[]).includes(s.transition as string)
        ? (s.transition as Transition)
        : "cut",
      media: sanitizeMedia(s.media),
      eyebrow: typeof s.eyebrow === "string" && s.eyebrow.trim() ? s.eyebrow.slice(0, 40) : undefined,
      role: typeof s.role === "string" && /^[a-z]{2,14}$/.test(s.role) ? s.role : undefined,
      items: Array.isArray(s.items)
        ? s.items.filter((i) => typeof i === "string" && i.trim()).slice(0, 8).map((i) => String(i).slice(0, 70))
        : undefined,
    }));
  if (!scenes.length) scenes.push({ skill: "particle-assemble", text: "HELLO", duration: 3, transition: "cut" });
  return {
    title: String(raw.title ?? scenes[0].text).slice(0, 60),
    palette: (PALETTE_IDS as readonly string[]).includes(raw.palette as string) ? (raw.palette as PaletteId) : "cyber",
    font: (FONTS as readonly string[]).includes(raw.font as string) ? (raw.font as FontId) : "anton",
    aspect: raw.aspect === "9:16" || raw.aspect === "1:1" ? raw.aspect : "16:9",
    bpm: Math.min(160, Math.max(70, Number(raw.bpm) || 120)),
    seed: (Number(raw.seed) || 1) >>> 0,
    scenes,
    brand: sanitizeBrand(raw.brand),
    style: raw.style === "saas" ? "saas" : "trailer",
    template: typeof raw.template === "string" && /^[a-z]{2,20}$/.test(raw.template) ? raw.template : undefined,
    music: raw.music === "saas" || raw.music === "trailer" ? raw.music : undefined,
    look:
      raw.look && typeof raw.look === "object"
        ? {
            grid: raw.look.grid !== false,
            beams: Math.min(8, Math.max(0, Number(raw.look.beams) || 0)),
            aurora: Math.min(3, Math.max(0, Number(raw.look.aurora) || 0)),
          }
        : undefined,
  };
}

export function encodePlan(plan: VideoPlan) {
  const json = JSON.stringify(plan);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePlan(s: string): VideoPlan | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64)));
    return sanitizePlan(JSON.parse(json));
  } catch {
    return null;
  }
}
