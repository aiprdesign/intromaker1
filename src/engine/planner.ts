import { assetUrl } from "./assets";
import { hashString, rng } from "./math";
import { CONCEPT_MAP, CONCEPTS, detectConcept, rankMoments } from "./concepts";
import { writeVoiceover } from "./script";
import { isHealthClaim, isNumericClaim, isUnsafe, safeCopy } from "./claims";
import { applyTemplate, DEFAULT_TEMPLATE, fitLength } from "./templates";
import {
  FONTS,
  PALETTE_IDS,
  SKILL_IDS,
  TEXT_FX,
  TRANSITIONS,
  type Aspect,
  type Brand,
  type FontId,
  type Media,
  type PaletteId,
  type Scene,
  type SiteData,
  type SitePart,
  type SkillId,
  type Transition,
  type VideoPlan,
} from "./types";

export type Length = "short" | "standard" | "long";
export const LENGTH_SECONDS: Record<Length, number> = { short: 12, standard: 20, long: 34 };

/** The site talks about being used across countries (the globe beat's evidence). */
const GLOBAL = /\b(global(ly)?|worldwide|international(ly)?|countries|currencies|cross-border|around the world|multi-region|edge network|borders)\b/i;
const HOOK_VERBS = /^(ship|build|know|see|get|make|run|turn|meet|grow|close|sell|plan|track|find|launch|create|design|write|automate|stop|start|bring|keep|move|work|scale|save|spend|manage|connect|send|share|say|go|do|take|put|power|own|win)\b/i;
const BOILERPLATE = /\b(welcome to|introducing|the (best|leading|ultimate|only)|all[- ]in[- ]one|platform for|solution for|powered by|next[- ]gen(eration)?|revolutionary|world[- ]class)\b/i;

/** A question hook from a pain: "Chasing receipts" → "Still chasing receipts?". */
function painQuestion(pain: string) {
  const p = pain.replace(/[.!?]+$/, "").trim();
  if (!p || p.split(/\s+/).length > 6) return "";
  const lower = p.charAt(0).toLowerCase() + p.slice(1);
  const first = lower.split(/\s+/)[0];
  if (/ing$/.test(first)) return `Still ${lower}?`;
  if (/^(too|so|endless|hours|days|weeks)\b/.test(lower)) return `Tired of ${lower}?`;
  return `Still stuck with ${lower}?`;
}

/**
 * Pick the opening line an editor would: short (4–7 words), speaking to the viewer, leading with
 * a verb, specific rather than boilerplate, and never a claim. Story-led films can open on a
 * question made from one of the site's pains ("Still chasing receipts?").
 */
function bestHook(c: { tagline: string; descClause: string; headlines: string[]; pains: string[]; name: string; taken: string[]; pick?: number }): { text: string; why: string } | null {
  const cands: { text: string; kind: string }[] = [];
  // Lines the tour or feature tiles will use are theirs (the film never says a line twice).
  const used = c.taken.map(norm).filter(Boolean);
  const clash = (t: string) => used.some((u) => u === norm(t) || u.startsWith(norm(t)) || norm(t).startsWith(u));
  const pushLine = (text: string | undefined, kind: string) => {
    const t = (text ?? "").trim();
    if (!t || cands.some((x) => norm(x.text) === norm(t))) return;
    if (kind === "headline" && clash(t)) return;
    cands.push({ text: t, kind });
  };
  pushLine(c.tagline, "tagline");
  pushLine(c.descClause, "description");
  for (const hd of c.headlines.slice(0, 3)) pushLine(sentenceCopy(hd, 9) || shortenCopy(hd, 8), "headline");
  for (const pn of c.pains.slice(0, 2)) pushLine(painQuestion(pn), "question");
  const scored = cands
    .filter((x) => !isUnsafe(x.text) && !isNumericClaim(x.text))
    .map((x) => {
      const words = x.text.replace(/\*/g, "").split(/\s+/).length;
      let score = words >= 4 && words <= 7 ? 3 : words === 3 || words === 8 || words === 9 ? 1 : -2;
      if (/\b(you|your)\b/i.test(x.text)) score += 1;
      if (HOOK_VERBS.test(x.text.replace(/^\W+/, ""))) score += 1;
      if (BOILERPLATE.test(x.text)) score -= 3;
      if (new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(x.text)) score -= 1;
      if (x.kind === "question") score += 2;
      if (x.kind === "tagline") score += 0.5;
      return { ...x, score };
    })
    .sort((a, b) => b.score - a.score);
  // Remakes try the runner-up opener when it's nearly as strong.
  const close = scored.filter((x) => x.score >= (scored[0]?.score ?? 0) - 1.5);
  const best = close.length ? close[(c.pick ?? 0) % close.length] : undefined;
  if (!best) return null;
  const why =
    best.kind === "question" ? "Opens on a question from the site's own pain point"
    : best.kind === "tagline" ? "The site's tagline makes the strongest opener"
    : `A sharper opener than the tagline: the site's ${best.kind}`;
  return { text: best.text, why };
}

/** The site talks about places: a flat world map suits it better than a globe. */
const MAP_WORDS = /\b(countries|country|regions?|currencies|languages|markets|offices|cities|locations)\b/i;
/** The site talks about helping its customers. */
const SUPPORT = /\b(customer support|support team|help (center|centre|desk)|documentation|docs|knowledge base|onboarding|customer success|live chat|dedicated (support|success)|here to help)\b/i;

/** Pair each pain with the feature that answers it: shared words, or words from the same family. */
const FAMILIES = [
  ["spreadsheet", "sheet", "excel", "data", "dashboard", "report", "insight", "analytic", "chart", "metric"],
  ["meeting", "status", "update", "standup", "progress", "async", "visibility"],
  ["email", "inbox", "message", "chat", "thread", "conversation", "reply"],
  ["manual", "copy", "paste", "busywork", "repetitive", "automat", "workflow", "hand"],
  ["slow", "wait", "delay", "fast", "instant", "real-time", "real time", "speed", "quick", "hours"],
  ["scattered", "silo", "disconnect", "switch", "tools", "connect", "integrat", "one place", "all-in-one", "workspace", "sync"],
  ["error", "mistake", "bug", "broken", "reliab", "check", "review", "catch"],
  ["security", "risk", "breach", "leak", "protect", "secur", "complian", "threat"],
  ["cost", "expensive", "spend", "budget", "save", "invoice", "expense", "billing"],
  ["lost", "find", "search", "organi", "track", "miss", "forget", "remind"],
  ["deploy", "release", "ship", "build", "preview", "rollback"],
];
export function pairPains(pains: string[], fixes: string[]) {
  const words = (x: string) => new Set(x.toLowerCase().split(/[^a-z]+/).filter((wd) => wd.length >= 4).map((wd) => wd.replace(/(ing|ed|es|s)$/, "")));
  const fam = (x: string) => new Set(FAMILIES.map((f, i) => (f.some((k) => x.toLowerCase().includes(k)) ? i : -1)).filter((i) => i >= 0));
  const pool = [...new Set(fixes)].filter(Boolean);
  const out: { pain: string; fix: string; score: number }[] = [];
  for (const pain of pains.slice(0, 4)) {
    const pw = words(pain);
    const pf = fam(pain);
    let best = -1;
    let bestScore = -1;
    pool.forEach((f, i) => {
      const score = [...words(f)].filter((wd) => pw.has(wd)).length * 2 + [...fam(f)].filter((k) => pf.has(k)).length;
      if (score > bestScore) (best = i), (bestScore = score);
    });
    if (best < 0) break;
    out.push({ pain, fix: pool[best], score: bestScore });
    pool.splice(best, 1);
  }
  return out;
}

/** The globe's neutral headline and generic live events, per category. */
const REACH: Record<string, { title: string; items: string[] }> = {
  fintech: { title: "Money that moves *across borders*", items: ["Payment received", "Invoice paid", "Transfer sent", "Card approved"] },
  ecommerce: { title: "Sell to customers *across borders*", items: ["New order", "Order shipped", "Payment received", "New review"] },
  devtools: { title: "Ship to users *worldwide*", items: ["Deployed", "Preview ready", "Request served", "Build finished"] },
  communication: { title: "Stay close, *across time zones*", items: ["New message", "Call started", "Thread replied", "File shared"] },
  security: { title: "Protect *distributed* teams", items: ["Login verified", "Device checked", "Alert resolved", "Policy applied"] },
  general: { title: "Built for *distributed* teams", items: ["New signup", "Task completed", "Update synced", "Report shared"] },
};

export type StyleChoice = "auto" | "saas" | "trailer";

export interface PlanRequest {
  prompt: string;
  aspect: Aspect;
  length: Length;
  palette?: PaletteId | "auto";
  seed?: number;
  style?: StyleChoice;
  template?: string;
  /** Claim-safe copy (default on): generic wording, no superlatives, guarantees or numbers. */
  safe?: boolean;
  /** Remake number (see SiteRequest.variant). */
  variant?: number;
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
  // "Sentinel stops threats…" / "Shopwave helps brands…": a capitalised name opening a sentence.
  const opener = prompt.match(/^\s*(?:meet\s+|introducing\s+)?([A-Z][a-z][\w.&-]{1,24})\s+(?:is|are|helps|lets|makes|stops|keeps|turns|gives|brings|writes|runs|puts|connects|automates|finds|builds|ships)\b/);
  if (opener) return opener[1].trim();
  // "Ledgerly: business banking…" / "Nimbus is a developer platform…" / "Meet Nimbus, …"
  const lead = prompt.match(/^\s*(?:meet\s+|introducing\s+)?([A-Z][\w.&-]{1,24}(?:\s+[A-Z][\w.&-]{1,24})?)\s*(?::|—|–|-\s|,|\s+(?:is|are|helps|lets|makes)\b)/i);
  if (lead && !/^(an?|the|my|our|this|make|create|build|launch)$/i.test(lead[1])) return lead[1].trim();
  // All-caps names ("PULSE"), ignoring common acronyms.
  const caps = prompt.match(/\b(?!(?:AI|API|SDK|CRM|HR|SEO|SaaS|UI|UX|B2B|CEO|CTO|SQL|LLM)\b)([A-Z][A-Z0-9.&-]{1,}(?:\s+[A-Z0-9][A-Z0-9.&-]+){0,2})\b/);
  if (caps) return caps[1].trim();
  const inner = prompt.match(/(?:^|[.!?]\s+)([A-Z][a-z][\w.&-]{1,24})\s+(?:is|helps|lets|makes)\b/);
  if (inner) return inner[1].trim();
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
  // Any recognisable product category (an AI assistant, a CRM, a payments tool…) is a SaaS film too.
  // (Plurals count: "deploy your apps" is a product. Saying "SaaS" or "product launch" outright
  // wins over trailer words, so "an epic SaaS launch" is an epic SaaS film, not a movie trailer.)
  const product = /\b(saas|apps?|platforms?|software|startups?|products?|dashboards?|b2b|apis?|crm|tools?|workspaces?|launch video|explainer|demo|systems?|teams|assistants?|automations?|analytics)\b/.test(l) ||
    Math.max(...CONCEPTS.map((c) => (l.match(c.keywords) ?? []).length)) >= 2;
  const outright = /\b(saas|product launch|launch video|explainer|b2b)\b/.test(l);
  return product && (outright || !/\b(epic|trailer|cinematic|game|gaming|movie|film|hype|festival|documentary)\b/.test(l));
}

/** Recover a phrase's original casing from the prompt ("AI insights", not "Ai insights"). */
function naturalCase(phrase: string, source: string) {
  const i = source.toLowerCase().indexOf(phrase.toLowerCase());
  const raw = i >= 0 ? source.slice(i, i + phrase.length) : phrase.charAt(0) + phrase.slice(1).toLowerCase();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Read a SaaS prompt like a copywriter: the product name, its one-line pitch and the feature
 * list. "Nimbus is a developer platform with instant rollbacks, preview URLs and edge
 * functions" → pitch "The developer platform", features [Instant rollbacks, Preview URLs,
 * Edge functions]; verb clauses ("writes your emails and summarises your meetings") become
 * features too.
 */
export function parseSaasPrompt(prompt: string) {
  const brand = extractBrand(prompt);
  let body = prompt.replace(/["“”‘’]/g, "").trim();
  body = body.replace(/^(?:an?\s+)?(?:(?:launch|intro|promo|product|explainer)\s+)?(?:video|film|teaser|trailer|intro|promo)\s+(?:for|about|of)\s+/i, "");
  body = body.replace(/^(?:meet|introducing)\s+/i, "");
  if (brand) body = body.split(brand).join(" ").replace(/^\s*[,:—–-]?\s*(?:is|are)?\s*/i, "").trim();
  // Real stats have magnitude ("10,000+ teams", "99.9% uptime"), not "SOC 2" or "3 steps".
  const numbers = stats(prompt).filter((n) => /\d{2,}|\d[kmbx%]|\+/i.test(n.split(" ")[0]));
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  // Pitch: the leading noun phrase, up to the first list or clause marker.
  const pitchRaw = body.split(/\s(?:with|that|which|who|featuring|including)\s|:|;|\.|,\s(?=\w+\s)/i)[0].trim();
  const pitchWords = pitchRaw.split(/\s+/).filter(Boolean);
  const pitch =
    pitchWords.length >= 2 && pitchWords.length <= 10 ? cap(pitchRaw.replace(/^(an?|the)\s+/i, "The ")) : shortenCopy(cap(pitchRaw), 9);
  // Features: list items and verb clauses after the pitch.
  let rest = body.slice(pitchRaw.length);
  // A bare pitch ("the AI assistant") reads better with its first verb clause:
  // "The AI assistant that writes your emails".
  let pitchOut = pitch;
  const clause = rest.match(/^\s+(that|which|who)\s+([^,;.]+?)(?=\s+and\s|[,;.]|$)/i);
  // Only when at least two other features remain for the feature row.
  const clauseCount = rest.split(/,|\sand\s|;/).filter((c) => c.trim()).length;
  if (clause && clauseCount >= 3 && pitchWords.length <= 4 && pitchWords.length + 1 + clause[2].split(/\s+/).length <= 9) {
    pitchOut = `${pitch} ${clause[1].toLowerCase()} ${clause[2].trim()}`;
    rest = rest.slice(clause[0].length);
  }
  const features = rest
    .split(/(?<!\d),|,(?!\d)|[;:]|\.(?!\d)|\sand\s|\s&\s|\s(?:with|that|which|who|featuring|including|plus)\s/i)
    .map((c) => c.trim().replace(/^(?:and|with|that|which|also|plus|to|it)\s+/i, "").replace(/\s+(?:for|to)\s+(?:teams?|startups?|you|everyone|businesses)\b.*$/i, ""))
    .filter((c) => c && !/^[$€£]?\d[\d,.]*[kmb%x]?\+?(\s|$)/i.test(c) && !/^[\d\s.,%+$€£kmb]+$/i.test(c))
    .map((c) => cap(c.split(/\s+/).length > 6 ? shortenCopy(c, 6) : c))
    .filter((c) => c && c.split(/\s+/).length <= 6 && !/^(the|a|an|you|it|them|teams?)$/i.test(c));
  return { brand, pitch: pitchOut, features: [...new Set(features)], numbers };
}

function planFromPromptSaas(req: PlanRequest): VideoPlan {
  const prompt = req.prompt.trim();
  const seed = (req.seed ?? hashString(prompt)) >>> 0;
  const parsed = parseSaasPrompt(prompt);
  const brand = parsed.brand ?? "Your product";
  const numbers = parsed.numbers;
  const tagline = parsed.pitch || `Meet ${brand}`;
  const features = parsed.features.filter((f) => norm(f) !== norm(tagline));
  // A prompt becomes a minimal site profile, so prompt films get the same concept-aware arc,
  // feature icons, chapters, pacing and CTA voice as website films.
  const site: SiteData = {
    url: "",
    domain: "",
    name: brand,
    tagline,
    description: prompt,
    headlines: features.slice(0, 6),
    features: [],
    stats: numbers.map((n) => naturalCase(n, prompt)),
    testimonials: [],
    clientLogos: [],
    steps: [],
    pains: [],
    font: null,
    shots: { hero: null, full: null, sections: [] },
    cta: null,
    logo: null,
    images: [],
    videos: [],
    themeColor: null,
  };
  const plan = planFromSiteSaas(site, { aspect: req.aspect, length: req.length, palette: req.palette, seed, template: req.template, style: "saas", variant: req.variant });
  return { ...plan, title: brand };
}

/** Built-in rule-based director: prompt → storyboard. Deterministic for a given seed. */
/** Prompt → intro, with a narrator line on every scene (used when voice-over is on). */
export function planFromPrompt(req: PlanRequest): VideoPlan {
  if (req.safe === false) {
    const prompt = req.prompt.split(/,(?!\d{3})|;|(?<=[.!?])\s+/).filter((part) => !isHealthClaim(part)).join(", ");
    return healthPlan(writeVoiceover(planFromPromptRaw({ ...req, prompt: prompt || req.prompt })));
  }
  // Claim-safe: the prompt's claims ("10M+ users", "the #1 copilot", "10x faster") are taken
  // out before directing, so the film is built from what the product is rather than trimmed later.
  const prompt = req.prompt
    .split(/,(?!\d{3})|;|(?<=[.!?])\s+/)
    .map((part) => (isNumericClaim(part) || isUnsafe(part) ? "" : safeCopy(part.trim())))
    .filter((part) => part.replace(/[^a-z0-9]/gi, "").length > 1)
    .join(", ");
  return safePlan(writeVoiceover(planFromPromptRaw({ ...req, prompt: prompt || req.prompt })));
}

function planFromPromptRaw(req: PlanRequest): VideoPlan {
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
  const fillers = ["GET READY", "STAY TUNED", "A NEW CHAPTER", "LOOK CLOSER", "WATCH THIS SPACE", "COMING SOON"];
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
    icon: site.icon ? assetUrl(site.icon) : undefined,
    page: site.shots?.full && site.shots.bands?.length ? { src: site.shots.full, bands: site.shots.bands } : undefined,
    images: site.images.map(assetUrl),
    videos: site.videos.map(assetUrl),
    clientLogos: site.clientLogos.map(assetUrl),
    font: site.font ?? undefined,
    colors,
    parts: site.shots?.parts ?? [],
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
        parts: sanitizeParts(sh.parts),
        bands: sanitizeBands(sh.bands),
      };
    })(),
    cta: typeof r.cta === "string" ? r.cta.slice(0, 40) : null,
    logo: http(r.logo) || isShot(r.logo) ? (r.logo as string) : null,
    icon: http(r.icon) || isShot(r.icon) ? (r.icon as string) : null,
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
  /** Creative angle for the story: problem-led (default), product-first or proof-first. */
  angle?: Angle;
  /** Claim-safe copy (default on): generic wording, no superlatives, guarantees or numbers. */
  safe?: boolean;
  /** Remake number: 0 is the director's best fit; each remake picks other slides for its sections. */
  variant?: number;
  /** The visitor's extra direction ("for our conference booth", "end with Book a demo"). */
  direction?: string;
}

/**
 * Whether the copy really offers something free (a free plan, trial, tier or account), as opposed
 * to "hassle-free", "free up your time" or "free of errors". Free offers must be real (FTC).
 */
export function offersFree(text: string): boolean {
  const t = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  // Not offers: compounds and verbs ("error-free", "free up", "free of", "feel free").
  const cleaned = t.replace(/\b[\w]+-free\b|\bfree (up|of|from|yourself|your time|time|to (use|explore|ask))\b|\b(feel|set|break) free\b|\btoll[- ]free\b|\bfreedom\b/g, " ");
  return /\b(free (plan|trial|tier|account|version|forever|to start|for (ever|everyone|individuals|teams|students|life))|(try|start|use|get started|sign up|join|download)( it| now)? (for )?free|for free|is free|always free|100% free|free\b[^.]{0,20}\bno (credit )?card)\b/.test(cleaned);
}

/** A site's own button text, cleaned: arrows, emoji and shouting removed; null when unusable. */
export function cleanCta(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = raw
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[→›»>←‹«<↗➜➔➝⟶]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:·•|]+|[\s\-–—:·•|.,;]+$/g, "")
    .trim();
  if (!v || v.length > 28 || v.split(" ").length > 5 || !/[a-z]/i.test(v)) return null;
  // SHOUTED LABELS read as sentence case ("START FREE TRIAL" → "Start free trial"); acronyms stay.
  if (v === v.toUpperCase() && /[A-Z]{3}/.test(v)) v = v.charAt(0) + v.slice(1).toLowerCase();
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** "Book a demo" → "book a demo" for "Scan to …"; acronyms and names keep their capitals. */
export function lowerFirst(label: string): string {
  const [first, ...rest] = label.split(" ");
  const keep = /^[A-Z0-9]{2,}$/.test(first) || /[A-Z]/.test(first.slice(1));
  return [keep ? first : first.charAt(0).toLowerCase() + first.slice(1), ...rest].join(" ");
}

/**
 * The end card's button, worded for what the intro is about: the site's own button when it has a
 * usable one, else the action the product invites, chosen by weighing every signal in the copy
 * (not the first word that happens to match), then the product category. The product's name is
 * never read as a signal. "Free" is only offered when the copy really offers something free.
 */
export function contextCta(site: Pick<SiteData, "cta" | "name" | "tagline" | "description" | "headlines" | "features">, concept?: string): string {
  const own = cleanCta(site.cta);
  if (own && (!/\bfree\b/i.test(own) || offersFree([own, site.tagline, site.description, ...site.headlines, ...site.features].join(" ")) || /free trial/i.test(own))) return own;
  const name = site.name.trim().toLowerCase();
  const text = ` ${[site.tagline, site.description, ...site.headlines, ...site.features].join(" . ").toLowerCase()} `
    .split(name && name.length > 2 ? name : "\u0000")
    .join(" ");
  const count = (re: RegExp) => (text.match(re) ?? []).length;
  // Each action scores its signals; strong phrases outweigh single words.
  const scores: [string, number][] = [
    ["Start free trial", count(/\bfree trial\b|\btrial (for|of) \d+ days\b|\b\d+-day (free )?trial\b/g) * 5],
    ["Join the waitlist", count(/\b(waitlist|wait list|early access|coming soon|pre-?launch|private beta|launching soon)\b/g) * 4],
    ["Book a demo", count(/\b(book|schedule|request|get) (a )?(demo|call)\b|\btalk to (sales|us)\b/g) * 4 + count(/\benterprise\b/g)],
    ["Download the app", count(/\b(app store|google play|ios and android|iphone and android|mobile app|download (the|our) app)\b/g) * 4 + count(/\b(ios|android)\b/g)],
    ["Book now", count(/\b(book (an |your )?(appointment|table|session|stay|room)|online booking|appointments?|reservations?)\b/g) * 3 + count(/\b(salon|clinic|dentist|spa|studio visit|restaurant|hotel)\b/g)],
    ["Shop now", count(/\b(shop (now|the|our)|add to cart|free shipping|order online|our collection|new arrivals|online store|shop)\b/g) * 2 + count(/\b(products? line|apparel|jewelry|jewellery|skincare|clothing)\b/g)],
    ["Start learning", count(/\b(online courses?|lessons?|tutoring|bootcamp|curriculum|certification|learn to|students?)\b/g) * 2 + count(/\bcourses?\b/g)],
    ["Start building", count(/\b(api|sdk|cli|developers?|open source)\b/g) * 2 + count(/\b(deploy|git|framework|library|code)\b/g)],
    ["Subscribe", count(/\b(newsletter|podcast|subscribe to|weekly digest)\b/g) * 3],
    ["Get in touch", count(/\b(agency|consulting|consultancy|our services|hire us|we help (brands|companies)|work with us)\b/g) * 3],
  ];
  const best = scores.filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])[0];
  if (best) return best[0];
  if (offersFree(text)) return "Try it free";
  const byConcept: Record<string, string> = {
    devtools: "Start building",
    ai: "Try it now",
    fintech: "Open an account",
    security: "Get protected",
    analytics: "See your data",
    sales: "Book a demo",
    marketing: "Start growing",
    productivity: "Get organised",
    hr: "Book a demo",
    ecommerce: "Shop now",
    health: "Get started",
    education: "Start learning",
    creative: "Start creating",
    communication: "Start chatting",
  };
  return byConcept[concept ?? ""] ?? "Get started";
}

/** Films for a room (talks, booths, TV): the end card carries a QR code of the website. */
export const BIG_SCREEN = /\b(event|conference|keynote|presentation|booth|trade ?show|expo|meetup|tv|big screen|signage|webinar|demo day|qr)\b/i;

export type Angle = "story" | "product" | "proof";
export const ANGLES: { id: Angle; name: string; brief: string }[] = [
  { id: "story", name: "Story-led", brief: "Problem → solution: open on the pain, reveal the product as the better way." },
  { id: "product", name: "Product-first", brief: "Open on the promise and get to the product in action within seconds; demo-heavy." },
  { id: "proof", name: "Proof-first", brief: "Lead with social proof (customers, real numbers, a real quote), then show why." },
];
/** Proof-first with no proof: open on the positioning line, then the product doing its job. */
const VALUE_ORDER = ["hook", "reveal", "demo", "features", "bento", "meet", "tour", "how", "cards", "integrations", "cta"];
const ANGLE_ORDER: Record<Angle, string[]> = {
  story: ["pain", "hook", "reveal", "meet", "how", "tour", "features", "bento", "quote", "logos", "cards", "integrations", "cta"],
  product: ["hook", "pain", "reveal", "tour", "features", "meet", "bento", "how", "cards", "quote", "logos", "integrations", "cta"],
  proof: ["hook", "pain", "reveal", "quote", "logos", "meet", "tour", "features", "how", "bento", "cards", "integrations", "cta"],
};

/**
 * Turn the product's description into its own first-person answer for the AI-prompt demo:
 * "Scribe drafts emails in your voice" → "I draft emails in your voice";
 * "Meet Harbor, the AI assistant that…" → "I'm the AI assistant that…".
 */
export function aiSelfIntro(text: string, name: string): { answer: string; firstPerson: boolean } {
  const clean = text.replace(/\*/g, "").trim();
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let rest = clean.replace(new RegExp(`^(meet|introducing|say hello to)\\s+${esc}[,:]?\\s*`, "i"), "");
  if (rest !== clean && /^(the|an?|your)\s/i.test(rest)) return { answer: `I'm ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`.replace(/([^.!?])$/, "$1."), firstPerson: true };
  const m = rest.match(new RegExp(`^${esc}\\s+(is|has|helps|makes|lets|gives|turns|brings|drafts|writes|keeps|puts|finds|runs|builds|automates|stops|sends|takes|does|answers|summari[sz]es|handles|manages|tracks|creates|connects|[a-z]+s)\\b\\s*`, "i"));
  if (m) {
    const verb = m[1].toLowerCase();
    rest = rest.slice(m[0].length);
    const first = verb === "is" ? "I'm" : verb === "has" ? "I have" : verb === "does" ? "I do" : `I ${verb.replace(/(ch|sh|x|ss|z)es$/, "$1").replace(/ies$/, "y").replace(/s$/, "")}`;
    return { answer: `${first} ${rest}`.trim().replace(/([^.!?])$/, "$1."), firstPerson: true };
  }
  return { answer: clean, firstPerson: false };
}

/** Website → intro. SaaS launch-film structure by default; epic trailer cut on request. */
export function planFromSite(site: SiteData, req: SiteRequest): VideoPlan {
  const safe = req.safe !== false;
  const input = safe ? safeSite(site) : stripHealth(site);
  const plan = writeVoiceover(req.style === "trailer" ? planFromSiteTrailer(input, req) : trimToTarget(planFromSiteSaas(input, req)));
  return safe ? safePlan(plan) : healthPlan(plan);
}

/**
 * "Use site's claims" still never carries health or medical claims (treats, cures, clinically
 * proven, FDA approved, improves sleep…): those lines of the site's copy are left out.
 */
export function stripHealth(site: SiteData): SiteData {
  const ok = (x: string | null | undefined) => !!x && !isHealthClaim(x);
  const pairs = site.headlines.map((h, i) => ({ h, f: site.features[i] ?? "" })).filter((p) => ok(p.h));
  const tagline = ok(site.tagline) ? site.tagline : pairs[0]?.h ?? site.name;
  const out: SiteData = {
    ...site,
    tagline,
    description: site.description.split(/(?<=[.!?])\s+/).filter(ok).join(" "),
    headlines: pairs.map((p) => p.h),
    features: pairs.map((p) => (ok(p.f) ? p.f : "")),
    steps: site.steps.filter(ok),
    pains: site.pains.filter(ok),
    stats: site.stats.filter(ok),
    testimonials: site.testimonials.filter((q) => ok(q.quote)),
  };
  ORIGINAL.set(out, site);
  return out;
}

/** The finished plan with any health claim that slipped in (AI output, prompts) taken out. */
export function healthPlan(plan: VideoPlan): VideoPlan {
  const name = plan.brand?.name ?? plan.title;
  const scenes = plan.scenes
    .filter((sc, i) => i === 0 || !(sc.role === "quote" && isHealthClaim(sc.text)))
    .map((sc) => ({
      ...sc,
      text: isHealthClaim(sc.text) ? (sc.role === "hook" ? `Introducing *${name}*` : `See *${name}* in action`) : sc.text,
      subtext: sc.subtext && isHealthClaim(sc.subtext) ? undefined : sc.subtext,
      items: sc.items?.filter((it) => !isHealthClaim(it)),
      vo: sc.vo && isHealthClaim(sc.vo) ? undefined : sc.vo,
    }));
  return writeVoiceover({ ...plan, scenes });
}

/** The site as captured, for category detection (vocabulary and icons, never on-screen claims). */
const ORIGINAL = new WeakMap<SiteData, SiteData>();

/** Beats that can go when a film runs long, least essential first. */
const DROPPABLE = ["integrations", "promise", "cards", "how", "bento", "features", "meet"];

/**
 * A film that can't reach its length because every beat is already at its shortest readable
 * duration (slow templates, many beats) loses its least essential beat instead of overrunning.
 * The film keeps at least one value beat and five scenes.
 */
function trimToTarget(plan: VideoPlan): VideoPlan {
  const target = plan.target;
  if (!target) return plan;
  let scenes = plan.scenes;
  const total = () => scenes.reduce((a, sc) => a + sc.duration, 0);
  const hasValue = (xs: Scene[]) => xs.some((sc) => ["features", "bento", "demo", "how"].includes(sc.role ?? ""));
  while (total() > target * 1.1 && scenes.length > 5) {
    const i = DROPPABLE.map((r) => scenes.findIndex((sc) => sc.role === r)).find((k) => k >= 0 && hasValue(scenes.filter((_, j) => j !== k)));
    if (i === undefined) break;
    scenes = scenes.filter((_, j) => j !== i);
    // The cut that now joins two scenes mustn't repeat the one before it.
    if (scenes[i] && scenes[i - 1] && scenes[i].transition === scenes[i - 1].transition && scenes[i].transition !== "cut") {
      const alt = (["whip", "dolly", "push", "dissolve"] as Transition[]).find((tr) => tr !== scenes[i - 1].transition && tr !== scenes[i + 1]?.transition)!;
      scenes = scenes.map((sc, j) => (j === i ? { ...sc, transition: alt } : sc));
    }
  }
  return scenes === plan.scenes ? plan : fitLength({ ...plan, scenes }, target);
}

/**
 * The site's copy, claim-safe: superlatives, guarantees and speed claims taken out of its
 * wording, and anything that is a number-as-claim ("10,000+ teams", "99.9% uptime") left out,
 * along with testimonials and customer-logo walls (endorsements). What remains is what the
 * product is and does.
 */
export function safeSite(site: SiteData): SiteData {
  const line = (x: string | null | undefined) => (x && !isNumericClaim(x) && !isUnsafe(x) ? safeCopy(x) : "");
  const words = (x: string) => x.replace(/\*/g, "").trim().split(/\s+/).filter(Boolean).length;
  // Lines the site wrote without claims lead; rewritten ones follow (a boast with its claim taken
  // out reads thinner), minus a leftover article ("The most powerful lead scoring" → "Lead scoring").
  const pairs: { head: string; desc: string; rewritten: boolean }[] = [];
  site.headlines.forEach((h, i) => {
    let head = line(h);
    const rewritten = head !== h.trim();
    if (rewritten && words(head) <= 4) head = head.replace(/^(the|a|an|our)\s+/i, "").replace(/^[a-z]/, (c) => c.toUpperCase());
    if (words(head) < 2) return;
    pairs.push({ head, desc: line(site.features[i]), rewritten });
  });
  pairs.sort((a, b) => Number(a.rewritten) - Number(b.rewritten));
  const headlines = pairs.map((p) => p.head);
  const features = pairs.map((p) => p.desc);
  const list = (xs: string[]) => xs.map(line).filter((x) => words(x) >= 1);
  const sentences = (x: string) =>
    x
      .split(/(?<=[.!?])\s+/)
      .map(line)
      .filter((y) => words(y) >= 3)
      .join(" ");
  const tagline = line(site.tagline);
  const out = {
    ...site,
    tagline: words(tagline) >= 2 ? tagline : headlines[0] ?? site.name,
    description: sentences(site.description),
    headlines,
    features,
    steps: list(site.steps),
    pains: list(site.pains),
    stats: [],
    testimonials: [],
    clientLogos: [],
    // An unsafe or claim-y button is dropped, so the end card words its own from the content.
    cta: site.cta && !isNumericClaim(site.cta) && !isUnsafe(site.cta) ? safeCopy(site.cta) || null : null,
  };
  REWRITTEN.set(out, new Set(pairs.filter((p) => p.rewritten).map((p) => p.head)));
  ORIGINAL.set(out, site);
  return out;
}

/** Headlines safeSite had to rewrite: ranked a little lower, so the site's own clean lines lead. */
const REWRITTEN = new WeakMap<SiteData, Set<string>>();

/** Roles whose whole point is a claim (a number, a quote, a customer wall): left out when claim-safe. */
const CLAIM_ROLES = new Set(["quote", "logos", "metric", "stat"]);
const CLAIM_SKILLS = new Set(["testimonial", "logo-marquee", "chart-grow", "number-ticker"]);

/**
 * A finished plan made claim-safe: every on-screen line and narrator line rewritten without
 * superlatives, guarantees or speed claims; list items that are numbers-as-claims dropped; a
 * headline that is one replaced with a neutral line; quote, customer-wall and metric scenes
 * left out (the film is re-timed to keep its length).
 */
export function safePlan(plan: VideoPlan): VideoPlan {
  const name = plan.brand?.name ?? plan.title;
  const neutral = (role?: string) => (role === "hook" ? `Introducing *${name}*` : role === "cta" ? `Try *${name}*` : `See *${name}* in action`);
  const fix = (x: string | undefined) => (x ? safeCopy(x) || undefined : x);
  const before = plan.scenes.reduce((a, sc) => a + sc.duration, 0);
  const kept = plan.scenes.filter((sc, i) => i === 0 || !(CLAIM_ROLES.has(sc.role ?? "") || CLAIM_SKILLS.has(sc.skill)));
  const scenes = kept.map((sc) => {
    // Word-swap alternatives are rewritten one by one; claims among them are dropped.
    const text = sc.text.includes("|")
      ? sc.text
          .split("|")
          .map((part, k) => (k === 0 ? safeCopy(part) : isNumericClaim(part) || isUnsafe(part) ? "" : safeCopy(part)))
          .filter(Boolean)
          .join("|")
      : (isNumericClaim(sc.text) || isUnsafe(sc.text)) && sc.role !== "reveal"
        ? neutral(sc.role)
        : safeCopy(sc.text) || neutral(sc.role);
    const items = sc.items?.filter((it) => !isNumericClaim(it) && !isUnsafe(it)).map((it) => safeCopy(it)).filter(Boolean);
    return {
      ...sc,
      text,
      subtext: sc.subtext && (isNumericClaim(sc.subtext) || isUnsafe(sc.subtext)) && sc.role !== "cta" ? undefined : fix(sc.subtext),
      eyebrow: sc.eyebrow && isUnsafe(sc.eyebrow) ? undefined : fix(sc.eyebrow),
      items: items?.length ? items : sc.items?.length ? undefined : sc.items,
      vo: sc.vo && !isNumericClaim(sc.vo) && !isUnsafe(sc.vo) ? fix(sc.vo) : sc.vo ? undefined : sc.vo,
    };
  });
  // Keep the film's length: the time of any scene left out goes to the scenes around it.
  const after = scenes.reduce((a, sc) => a + sc.duration, 0);
  const k = after > 0 && before > after ? Math.min(1.35, before / after) : 1;
  const beat = 60 / (plan.bpm || 120);
  const out = { ...plan, scenes: k === 1 ? scenes : scenes.map((sc) => ({ ...sc, duration: Math.max(4, Math.round((sc.duration * k) / beat)) * beat })) };
  // Narrator lines for any scene whose line was dropped.
  return writeVoiceover(out);
}

/**
 * Shorten a long headline to its core clause ("Plan every project with flexible boards…" →
 * "Plan every project"), never ending on a filler word. Returns "" if nothing usable.
 */
function shortenCopy(text: string, maxWords: number) {
  const clean = text.replace(/[.!?]+$/, "").trim();
  const words = clean.split(/\s+/);
  if (words.length <= maxWords) return clean;
  const clause = clean.split(/\s(?:with|that|so|and|to|for|by|while|without|—|–)\s|,\s/)[0].trim();
  const cw = clause.split(/\s+/);
  if (cw.length >= 2 && cw.length <= maxWords) return clause;
  const cut = words.slice(0, maxWords);
  while (cut.length > 2 && /^(a|an|the|of|to|in|on|at|by|for|with|and|or|your|our|their|every|all)$/i.test(cut[cut.length - 1])) cut.pop();
  return cut.length >= 2 ? cut.join(" ") : "";
}

/** Loose comparison key for copy. */
const norm = (t: string) => t.toLowerCase().replace(/\*/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Sentence-case copy: trim, drop trailing period for headlines, keep the site's own casing. */
function sentenceCopy(text: string, maxWords: number) {
  const first = text.split(/(?<=[.!?])\s|\s[—–|]\s/)[0].trim();
  const words = first.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > maxWords) return "";
  return first;
}

/** How good a site headline is as on-screen copy: short, concrete, benefit-led. */
function scoreHeadline(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  let s = 2 - Math.abs(words - 5) * 0.35;
  if (/\d/.test(text)) s += 0.6;
  if (/\b(fast|faster|automat\w*|ai|every\w*|trust\w*|instant\w*|without|never|save\w*|scale\w*|secur\w*|real-time|one place|themselves|minutes|seconds)\b/i.test(text)) s += 0.8;
  if (/^(our|we|welcome|about|blog|pricing|faq|features|resources|contact|log ?in|sign ?up|learn more)\b/i.test(text)) s -= 3;
  if (/\?$/.test(text)) s -= 0.5;
  if (text === text.toUpperCase() && /[A-Z]/.test(text)) s -= 0.5;
  return s;
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

  const tagline = sentenceCopy(site.tagline, 10) || shortenCopy(site.tagline, 9) || sentenceCopy(site.description, 12) || shortenCopy(site.description, 9) || `Meet ${site.name}`;
  // Best headlines first; each keeps its feature description from the page.
  const rewritten = REWRITTEN.get(site);
  const allHeads = site.headlines.map((title, i) => ({ title, desc: site.features[i] ?? "", score: scoreHeadline(title) - (rewritten?.has(title) ? 1.2 : 0), i }));
  // When the page's features come with descriptions (feature cards), headings without one are
  // section titles ("Start understanding your users today"), not features.
  const described = allHeads.filter((f) => f.desc.trim().split(/\s+/).length >= 4);
  const ranked = (described.length >= 3 ? described : allHeads).sort((a, b) => b.score - a.score || a.i - b.i);
  const shortFeatures = ranked.map((f) => sentenceCopy(f.title, 6) || shortenCopy(f.title, 6)).filter((h) => h && h !== tagline);
  const longFeatures = ranked.map((f) => sentenceCopy(f.title, 9) || shortenCopy(f.title, 9)).filter((h) => h && h !== tagline);
  // Bento cards: "Title — one-line description" when the page has one.
  const bentoItems = ranked
    .map((f) => {
      const title = sentenceCopy(f.title, 6) || shortenCopy(f.title, 6);
      if (!title || title === tagline) return "";
      const desc = sentenceCopy(f.desc, 10).replace(/\.$/, "");
      return desc && desc.toLowerCase() !== title.toLowerCase() ? `${title} — ${desc}` : title;
    })
    .filter(Boolean);
  const stat = site.stats.find((st) => /team|customer|compan|user|business|developer|people|brand|org/i.test(st));
  const quote = site.testimonials.find((q) => q.quote.length <= 190 && q.author);
  const integrationLine = site.headlines.find((h) => /integrat|connect|tools|apps|stack|plug/i.test(h));
  const pains = (site.pains ?? []).slice(0, 3);

  type Beat = { scene: Scene; priority: number };
  const candidates: Beat[] = [];
  const add = (priority: number, scene: Scene) => candidates.push({ priority, scene });

  // A remake tells the story from another angle (unless one was asked for) and swaps each section's
  // slide for its alternative (alt); remake 0 is the director's best fit.
  const variant = Math.max(0, Math.floor(req.variant ?? 0));
  const alt = variant % 2 === 1;
  const angle: Angle = req.angle ?? (variant ? (["product", "story", "proof"] as Angle[])[(variant - 1) % 3] : "story");
  // What kind of product this is decides the arc, chapter labels, CTA voice and icons.
  // (From the site as captured: screening a claim out mustn't change what kind of product it is.)
  const whole = ORIGINAL.get(site) ?? site;
  const concept = detectConcept(
    `${whole.name} ${whole.tagline} ${whole.description}`,
    [...whole.headlines, ...whole.features, ...(whole.steps ?? []), ...(whole.pains ?? [])].join(" "),
  );
  const teamStat = site.stats.find((st) => /\d/.test(st) && /team|customer|compan|user|business|developer/i.test(st));
  // Product imagery available to the gallery skills: the site's images and captured UI components.
  const visuals = brand.images.length + (shots.parts ?? []).filter((p) => p.kind !== "button" && p.w * p.h > 120 * 90).length;
  // 1. Hook: the problem, the promise, or the proof.
  // Open on the problem only in categories whose films do (e-commerce / creative lead with the promise).
  const painHook = angle === "story" && target >= 20 && pains.length >= 2 && concept.arc.indexOf("pain") < concept.arc.indexOf("reveal");
  const proofHook = angle === "proof" && !!teamStat;
  // Proof-first with no proof to show (claim-safe, or a site without any) becomes value-first:
  // it opens on the positioning line and leads with the product doing its job.
  const hasProof = !!teamStat || site.testimonials.length > 0 || (brand.clientLogos?.length ?? 0) >= 4 || site.stats.length > 0;
  const valueFirst = angle === "proof" && !hasProof;
  const descClause = sentenceCopy(site.description.split(/\s(?:so|because|that|which|to help)\s|\s[—–]\s/)[0], 10);
  // Product-first opens on what the product does (its description) and keeps the tagline for the logo.
  // (Without a description, a feature line the tour doesn't use.)
  const usable = (x: string | undefined): x is string => !!x && norm(x) !== norm(tagline) && x.split(" ").length >= 3;
  const productLine = [descClause, longFeatures[1], longFeatures[2], longFeatures[3]].find(usable) ?? "";
  const productHook = angle === "product" && !painHook ? productLine : "";
  // Value-first opens on what the product does for you: a feature benefit the tour doesn't use.
  // (Never the line product-first opens on, so the two takes differ.)
  const valueHook = valueFirst ? [longFeatures[2], longFeatures[3], longFeatures[1], descClause].find((x) => usable(x) && norm(x) !== norm(productLine)) ?? "" : "";
  // The opening line, when no angle dictates it: the strongest of the site's own lines (or a
  // question made from one of its pains), scored like an editor would (see bestHook).
  const openHook = !proofHook && !painHook && !(valueFirst && valueHook) && !productHook
    ? bestHook({ tagline, descClause, headlines: site.headlines, pains: angle === "story" && target >= 20 ? pains : [], name: site.name, taken: [...longFeatures.slice(0, 4), ...shortFeatures.slice(0, 6)], pick: variant })
    : null;
  // The tagline is used once: in the hook, or (if the hook is pains/proof/value) under the logo.
  const taglineFree = painHook || proofHook || !!valueHook || !!productHook || (!!openHook && norm(openHook.text) !== norm(tagline));
  // Whether the film opens on the wall of product images (then the gallery beat is optional).
  let wall = false;
  if (proofHook) {
    add(1, { role: "hook", skill: "blur-reveal", text: `Trusted by *${teamStat.toLowerCase()}*`, eyebrow: `Introducing ${site.name}`, duration: beats(7), transition: "cut" });
  } else if (painHook) {
    add(1, {
      role: "pain", skill: "pain-strike",
      text: pick(["There's *another* way.", "It doesn't have to be *this hard*.", "Time for a *new* way."]),
      items: pains,
      eyebrow: "The old way",
      duration: beats(pains.length * 2 + 5),
      transition: "cut",
    });
  } else if (valueFirst && valueHook) {
    add(1, { role: "hook", skill: "blur-reveal", text: valueHook, eyebrow: `Introducing ${site.name}`, duration: beats(7), transition: "cut" });
  } else {
    // Story-led films with plenty of product imagery open on the whole product: a tilted wall of
    // its screenshots drifting behind the promise (Linear / Vercel hero look).
    wall = angle === "story" && !productHook && target >= 20 && visuals >= 4 && !alt;
    const hookText = productHook || openHook?.text || tagline;
    const hookWhy = [openHook?.why, wall ? `${visuals} product images and UI components: a wall of the product behind it` : ""].filter(Boolean).join("; ");
    add(1, { role: "hook", skill: wall ? "tilt-wall" : "blur-reveal", text: hookText, eyebrow: wall ? undefined : `Introducing ${site.name}`, duration: beats(wall ? 9 : 7), transition: "cut", why: hookWhy || undefined });
  }
  // 2. Reveal.
  // Product-first with real product footage: the name as giant type filled with the product,
  // diving through a letter into it (Runway-style). Otherwise the logo reveal.
  const revealMedia = angle === "product" && target >= 20 ? (video ?? images[0] ?? img(shots.hero)) : undefined;
  add(1, revealMedia && site.name.length <= 14
    ? { role: "reveal", skill: "type-mask", text: site.name, subtext: taglineFree ? tagline : undefined, duration: beats(9), transition: "dolly", media: revealMedia }
    : {
        role: "reveal", skill: brand.logo ? "logo-reveal" : "particle-assemble",
        text: site.name,
        subtext: taglineFree ? tagline : site.domain,
        duration: beats(6),
        transition: "dolly",
      });
  // 3. Meet: the real product, rebuilt from its own UI components (or the page scrolling by).
  if (shots.hero || shots.full) {
    const assemble = !!shots.hero && !(alt && shots.full);
    add(!(video ?? images[0] ?? shots.sections[0] ?? shots.hero) && target >= 20 ? 2 : assemble && target >= 20 ? 2 : 3, {
      role: "meet", skill: assemble ? "ui-assemble" : "site-scroll",
      text: taglineFree && !(valueHook && descClause && norm(valueHook) !== norm(descClause)) ? tagline : descClause || `Say hello to *${site.name}*`,
      eyebrow: `Meet ${site.name}`,
      duration: Math.max(5, beats(10)),
      transition: "whip",
      media: img(assemble ? shots.hero : shots.full),
    });
  }
  // 4. How it works.
  if (site.steps && site.steps.length >= 2) {
    add(target >= 30 ? 3 : 5, {
      // AI and creative tools show their steps as a node workflow (ComfyUI-style).
      // (Or any product whose steps read as a pipeline: connect, trigger, transform, publish.)
      role: "how", skill: site.steps.length >= 3 && alt !== (concept.id === "ai" || concept.id === "creative" || /\b(workflows?|pipelines?|automat\w*|nodes?|connect\w*|triggers?|integrat\w*)\b/i.test(site.steps.join(" "))) ? "node-graph" : "steps",
      text: `Get started in *${site.steps.length} steps*`,
      items: site.steps.slice(0, 4),
      eyebrow: "How it works",
      duration: Math.max(4.4, beats(site.steps.length * 2 + 4)),
      transition: "dolly",
    });
  }
  // 5. Features: cursor tour on the product, then a bento.
  // (The hero screenshot belongs to the assembled "meet" beat in 20s+ films, so it isn't shown twice.)
  // With the page's components captured, a raw page-section screenshot isn't product footage:
  // the tour is kept for real product images and video.
  const hasParts = (shots.parts?.length ?? 0) >= 3;
  const tourMedia = video ?? images[0] ?? (hasParts ? undefined : img(shots.sections[0])) ?? (target >= 20 ? undefined : img(shots.hero));
  // Each beat gets its own copy: the tour's headline and callouts are not reused by the
  // feature tiles or result cards (repetition reads as filler).
  const tourHead = longFeatures[0] ?? `See *${site.name}* in action`;
  // With only a handful of features, the tour keeps its headline and leaves the rest to the tiles.
  const otherTitles = shortFeatures.filter((f) => norm(f) !== norm(tourHead));
  const tourCallouts = otherTitles.length >= 4 ? otherTitles.slice(0, 2) : otherTitles.length === 3 ? otherTitles.slice(2) : [];
  const usedByTour = new Set(tourMedia ? [tourHead, ...tourCallouts].map(norm) : []);
  const freshItems = bentoItems.filter((it) => !usedByTour.has(norm(it.split(/\s+[—–]\s+/)[0])));
  const featureItems = freshItems.length >= 2 ? freshItems : bentoItems.filter((it) => norm(it.split(/\s+[—–]\s+/)[0]) !== norm(tourHead));
  // With no real product footage or images, zooming into one section's screenshot shows little:
  // the tour becomes the website itself, split into its real sections, visited one by one.
  const sectionTour = !video && !images[0] && !!brand.page && brand.page.bands.length >= 3 && !!shots.full && tourMedia?.src !== shots.full;
  if (tourMedia) {
    add(angle === "product" ? 1 : target >= 20 ? 2 : 4, {
      role: "tour", skill: sectionTour ? "site-scroll" : "ui-tour",
      text: tourHead,
      items: sectionTour ? undefined : tourCallouts,
      eyebrow: "Features",
      duration: Math.max(5.6, beats(12)),
      transition: "whip",
      media: sectionTour ? img(shots.full) : tourMedia,
    });
  }
  // Key features as icon tiles (the classic SaaS feature row); a bento when there are many.
  // One value beat, always: icon tiles for up to four features, a bento for a richer set.
  // (In a product-first teaser the tour already carries the features.)
  const valuePriority = target < 20 && ((angle === "product" && tourMedia) || (angle === "proof" && quote)) ? 5 : 2;
  // Long films with real feature descriptions and product UI to show give each feature its own
  // slide; otherwise a bento for a rich set, or the classic icon row.
  const withBenefit = featureItems.filter((it) => (it.split(/\s+[—–]\s+/)[1] ?? "").split(/\s+/).length >= 4);
  // Remakes rotate through the other feature layouts the material allows.
  const featureKinds = [
    ...(target >= 30 && withBenefit.length >= 3 && visuals >= 2 ? ["slides"] : []),
    ...(featureItems.length >= 5 ? ["bento"] : []),
    ...(featureItems.length >= 2 ? ["icons"] : []),
    ...(featureItems.length === 3 || featureItems.length === 4 ? ["bento"] : []),
  ];
  const featureKind = featureKinds.length ? featureKinds[variant % featureKinds.length] : null;
  const featureSlides = featureKind === "slides";
  if (featureSlides) {
    add(valuePriority, {
      role: "features", skill: "feature-slides",
      text: `Inside *${site.name}*`,
      items: withBenefit.slice(0, 3),
      eyebrow: "Features",
      why: `${withBenefit.length} features with real descriptions and ${visuals} product images to show`,
      duration: beats(15.5),
      transition: "dolly",
    });
  } else if (featureKind === "bento") {
    add(valuePriority, {
      role: "bento", skill: "bento",
      text: `Inside *${site.name}*`,
      items: featureItems.slice(0, 6),
      eyebrow: "All-in-one",
      duration: Math.max(4.4, beats(10)),
      transition: "dolly",
    });
  } else if (featureKind === "icons") {
    add(valuePriority, {
      role: "features", skill: "icon-features",
      text: concept.featuresTitle,
      items: featureItems.slice(0, 4),
      eyebrow: "Features",
      duration: Math.max(4.6, beats(Math.min(4, featureItems.length) * 1.5 + 6)),
      transition: "dolly",
    });
  }
  // 5b. The signature interaction moment: the product *doing* something (a command palette,
  // a streamed AI answer, a one-click cascade, live notifications), chosen for the category.
  // Products that lead with AI get the AI moment whatever their category.
  const aiLed = concept.id !== "ai" && [site.tagline, ...site.headlines.slice(0, 4)].some((x) => /\b(ai|assistant|copilot|gpt)\b/i.test(x ?? ""));
  const shownTitles = new Set([...(featureSlides ? withBenefit.slice(0, 3) : featureItems.slice(0, featureKind === "bento" ? 6 : 4)), ...(tourMedia ? [tourHead, ...tourCallouts] : [])].map((x) => norm(x.split(/\s+[—–]\s+/)[0])));
  const spareFeatures = shortFeatures.filter((f) => !shownTitles.has(norm(f)));
  // The moment that suits this product best, scored on the site's own words, its category and its
  // material (see rankMoments): a dev platform that talks about deploys gets code → deploy, a
  // whiteboard gets live cursors, a hiring tool its candidate board.
  const leadCopy = [whole.tagline, whole.description].join(" ");
  const bodyCopy = [...whole.headlines, ...whole.features, ...(whole.steps ?? [])].join(" ");
  const moments = rankMoments(leadCopy, bodyCopy, concept.id, { aiLed, spareFeatures: spareFeatures.length });
  // Remakes try the runner-up moments that still suit the product (at least 60% of the best fit).
  // When only one moment clearly fits (a short prompt), remakes still get the runner-up to try.
  const fitting = moments.filter((m, i) => m.score >= moments[0].score * 0.6 || (variant > 0 && i === 1 && m.score > 0));
  // Offset from the feature-layout rotation, so consecutive remakes never repeat the original's pair.
  const fit = fitting[(variant + Math.floor(variant / 2)) % fitting.length];
  const demo = fit.spec;
  const demoWhy = fit.because.length ? `Best fit: the site talks about ${fit.because.slice(0, 3).join(", ")}` : `Typical of ${concept.name.toLowerCase()} launch films`;
  let demoScene: Scene | null = null;
  if (demo.skill === "command-k") {
    // The command that runs is a real feature; the rest are the palette's everyday commands.
    // (A feature already shown elsewhere in the film isn't repeated: the palette's own commands run instead.)
    const lead = spareFeatures[0];
    demoScene = { role: "demo", skill: "command-k", text: demo.title, items: lead ? [lead, ...demo.items].slice(0, 4) : demo.items, eyebrow: demo.eyebrow, duration: beats(10), transition: "whip" };
  } else if (demo.skill === "ai-prompt") {
    // Ask the product what it does; it answers in its own words (the site's copy, first person).
    const said = aiSelfIntro(shortenCopy(site.description.split(/(?<=[.!?])\s/)[0] ?? "", 24) || descClause || tagline, site.name);
    // The answer's points are the features' own one-line benefits (the tiles carry their titles).
    const points = ranked
      .map((f) => sentenceCopy(f.desc, 12).replace(/\.$/, ""))
      .filter((x) => x && x.split(" ").length >= 4)
      .slice(0, 3);
    demoScene = {
      role: "demo", skill: "ai-prompt", text: demo.title,
      subtext: said.answer,
      items: [(said.firstPerson ? demo.items[0] : "Tell me about {name}").replace(/\{name\}/g, site.name), ...(points.length >= 2 ? points : spareFeatures.slice(0, 3))],
      eyebrow: demo.eyebrow, duration: beats(12), transition: "whip",
    };
  } else if (demo.skill === "code-deploy") {
    demoScene = { role: "demo", skill: "code-deploy", text: demo.title, items: demo.items, eyebrow: demo.eyebrow, duration: beats(12), transition: "whip" };
  } else if (demo.skill === "kanban") {
    demoScene = { role: "demo", skill: "kanban", text: demo.title, subtext: demo.action, items: demo.items, eyebrow: demo.eyebrow, duration: beats(12), transition: "whip" };
  } else if (demo.skill === "live-cursors") {
    // The shared board holds the product's own features when the film hasn't shown them yet.
    const cards = spareFeatures.length >= 3 ? spareFeatures.slice(0, 4) : demo.items;
    demoScene = { role: "demo", skill: "live-cursors", text: demo.title, subtext: demo.action, items: cards, eyebrow: demo.eyebrow, duration: beats(10), transition: "whip" };
  } else if (demo.skill === "chat-thread") {
    demoScene = { role: "demo", skill: "chat-thread", text: demo.title, subtext: demo.action, items: demo.items, eyebrow: demo.eyebrow, duration: beats(11), transition: "whip" };
  } else if (demo.skill === "click-flow") {
    demoScene = { role: "demo", skill: "click-flow", text: demo.title, subtext: demo.action, items: demo.items, eyebrow: demo.eyebrow, duration: beats(10), transition: "whip" };
  } else {
    demoScene = { role: "demo", skill: "notify-stack", text: demo.title, items: demo.items, eyebrow: demo.eyebrow, duration: beats(demo.items.length * 1.2 + 5), transition: "whip" };
  }
  // A product-first or media-less film leans on it; teasers keep it only when it is the product.
  // (When the film already shows the real product — a tour or the assembled page — it's optional.)
  const productShown = !!tourMedia || !!shots.hero;
  if (demoScene) demoScene.why = demoWhy;
  add(valueFirst && target >= 20 ? 2 : target < 20 ? (angle === "product" && !productShown ? 3 : 6) : !productShown ? 2 : target >= 30 ? 3 : 4, demoScene);
  // 5c. Gallery: the product's own images and UI components, animated (GPU transitions, or a 3D
  // carousel for visual products).
  if (target >= 20 && visuals >= 3) {
    // Visual products (stores, templates, creative work) turn on a 3D carousel; product UI flows
    // through the framed gallery.
    const carousel = (concept.id === "creative" || concept.id === "ecommerce") !== alt;
    add(target >= 30 ? (wall ? 4.5 : 3) : 5, {
      role: "gallery",
      skill: carousel ? "carousel-3d" : "gallery-flow",
      text: carousel ? `Made with *${site.name}*` : `A closer look at *${site.name}*`,
      items: spareFeatures.slice(1, 5).length >= 2 ? spareFeatures.slice(1, 5) : undefined,
      eyebrow: "Gallery",
      why: `${visuals} product images and UI components to show${carousel ? " (a visual product: 3D carousel)" : ""}`,
      duration: beats(12),
      transition: "whip",
      media: images[0] ?? img(shots.sections[0]),
    });
  }
  // 5d. Reach: a dotted globe with live events, only when the site itself talks about global use.
  // (The site's own line when it's a short, number-free sentence; else a neutral one.)
  const globalLine = [site.tagline, site.description, ...site.headlines, ...site.features].find((x) => GLOBAL.test(x ?? ""));
  if (target >= 20 && globalLine) {
    const own = sentenceCopy(globalLine, 8);
    const n = own.split(/\s+/).length;
    // A flat map when the site talks about places (countries, regions, currencies, languages);
    // the turning globe when it talks about a global network or reach.
    const flatMap = MAP_WORDS.test([whole.tagline, whole.description, ...whole.headlines, ...whole.features].join(" ")) !== alt;
    add(target >= 30 ? 4 : 6, {
      role: "reach", skill: flatMap ? "world-map" : "globe",
      text: own && !/\d/.test(own) && n >= 3 && n <= 8 ? own : REACH[concept.id]?.title ?? REACH.general.title,
      items: (REACH[concept.id] ?? REACH.general).items,
      eyebrow: "Global",
      why: flatMap ? "The site talks about countries, regions or currencies" : "The site talks about global use",
      duration: beats(11),
      transition: "dolly",
    });
  }
  // 5e. The site's own pains, when the film doesn't open on them: each answered by the feature that
  // solves it (when they line up), else the old way next to the product on a before/after slider.
  const compareMedia = images[0] ?? img(shots.hero) ?? img(shots.sections[0]);
  const pairs = target >= 20 && pains.length >= 2 && !painHook ? pairPains(pains, [...spareFeatures, ...shortFeatures]) : [];
  const matched = pairs.filter((p) => p.score > 0).length;
  if (pairs.length >= 2 && ((matched >= 2) !== (alt && !!compareMedia) || !compareMedia)) {
    add(target >= 30 ? 4 : 6, {
      role: "solve", skill: "problem-solution",
      text: "From problem to *solution*",
      items: pairs.slice(0, 3).map((p) => `${p.pain} → ${p.fix}`),
      eyebrow: "Problem → solution",
      why: matched >= 2 ? "The site's pains line up with its features" : "The site names the problems it solves",
      duration: beats(Math.min(3, pairs.length) * 2.5 + 4),
      transition: "whip",
    });
  } else if (target >= 20 && pains.length >= 2 && !painHook && compareMedia) {
    add(target >= 30 ? 4 : 6, {
      role: "compare", skill: "before-after",
      text: "Leave the old way *behind*",
      items: pains,
      eyebrow: "Before & after",
      why: "The site names the problems it solves",
      duration: beats(10),
      transition: "whip",
      media: compareMedia,
    });
  }
  // 5f. Support: when the site talks about help, docs or onboarding (and the demo isn't already a
  // support chat).
  if (target >= 20 && SUPPORT.test([whole.tagline, whole.description, ...whole.headlines, ...whole.features].join(" ")) && demo.skill !== "chat-thread") {
    add(target >= 30 ? 5 : 7, {
      role: "support", skill: "support",
      text: "Support, *built in*",
      subtext: "How do I invite my team?",
      items: [`Getting started with ${site.name}`, "Invite your team", "Connect your tools", "Manage your account"],
      eyebrow: "Support",
      why: "The site talks about support, docs or onboarding",
      duration: beats(12),
      transition: "dolly",
    });
  }

  // 6. Proof — only real quotes, logos and numbers.
  // Positioning line in the category's voice ("Ship faster|safer|together"): a rhythm change
  // between the reveal and the product that needs no media and makes no claims.
  add(target >= 20 && !tourMedia && !shots.full && !valueFirst ? 3 : 6, {
    role: "promise", skill: "word-swap",
    text: concept.swap,
    subtext: sentenceCopy(site.description, 12) || undefined,
    eyebrow: `Why ${site.name}`,
    duration: beats(8),
    transition: "whip",
  });
  // The strongest proof we have (a real quote, else customer logos, else numbers) is kept.
  const proofKind = quote ? "quote" : brand.clientLogos && brand.clientLogos.length >= 4 ? "logos" : site.stats.length ? "cards" : null;
  const proofPriority = (kind: string, normal: number) => (proofKind === kind && target >= 20 ? 2 : normal);
  if (quote) {
    add(angle === "proof" ? 1 : proofPriority("quote", 5), {
      role: "quote", skill: "testimonial",
      text: quote.quote,
      subtext: [quote.author, quote.role].filter(Boolean).join(" · "),
      eyebrow: "Customer story",
      duration: Math.max(4.6, beats(10)),
      transition: "leak",
      ...(quote.avatar ? { media: { src: assetUrl(quote.avatar), kind: "image" as const } } : {}),
    });
  }
  if (brand.clientLogos && brand.clientLogos.length >= 4) {
    add(proofPriority("logos", 6), {
      role: "logos", skill: "logo-marquee",
      text: "Teams using *" + site.name + "*",
      eyebrow: "Customers",
      duration: beats(7),
      transition: "dolly",
    });
  }
  const cardsMedia = img(shots.sections[1]) ?? images[1] ?? img(shots.hero) ?? images[0];
  if (site.stats.length) {
    const spare = longFeatures.find((f) => !usedByTour.has(norm(f)) && !featureItems.some((it) => norm(it.split(/\s+[—–]\s+/)[0]) === norm(f)));
    add(proofPriority("cards", 7), {
      role: "cards", skill: "ui-cards",
      text: spare ?? `${site.name} *in numbers*`,
      items: [`${site.name} update: all systems go`, site.stats[0], "This week", "Your team"],
      eyebrow: "Results",
      duration: Math.max(4.2, beats(9)),
      transition: "whip",
      media: cardsMedia,
    });
  }
  // One real adoption number, counted up over a chart that draws itself on.
  const countStat = site.stats.find((st) => /\d/.test(st) && /team|customer|compan|user|business|developer|merchant|brand|processed|deploy|member|people|org/i.test(st) && !/%/.test(st));
  const metricStat = countStat && !(proofHook && countStat === teamStat) ? countStat : undefined;
  if (metricStat) {
    add(target >= 30 ? 4 : proofKind === "cards" && target >= 20 ? 3 : 7, {
      role: "metric", skill: "chart-grow",
      text: `${site.name}, *by the numbers*`,
      subtext: metricStat,
      eyebrow: "By the numbers",
      duration: beats(8),
      transition: "dolly",
    });
  }
  // 7. Ecosystem.
  if (integrationLine) {
    add(8, {
      role: "integrations", skill: "integrations",
      text: sentenceCopy(integrationLine, 9) || "Works with *your stack*",
      eyebrow: "Integrations",
      duration: beats(8),
      transition: "whip",
    });
  }
  // 8. CTA (with a QR code when the film is for a room: "Scan to book a demo").
  const qr = BIG_SCREEN.test(req.direction ?? "") && !!brand.domain;
  const ctaLabel = contextCta(site, concept.id).replace(/[→›>»]+/g, "").trim();
  add(1, {
    role: "cta", skill: qr ? "qr-end" : "cta",
    text: `Try *${site.name}* today`,
    subtext: qr ? `Scan to ${lowerFirst(ctaLabel)}` : ctaLabel,
    duration: Math.max(3.6, beats(8)),
    transition: "dolly",
  });

  // Keep the highest-priority beats that fit, in story order.
  const order = candidates.map((c, i) => ({ ...c, i }));
  const chosen = new Set<number>();
  let used = 0;
  for (const c of [...order].sort((a, b) => a.priority - b.priority || a.i - b.i)) {
    // Scenes are fitted to the target afterwards (down to ~75%), so the budget can run a little over.
    if (c.priority <= 2 || used + c.scene.duration <= target * 1.12 + 1.5) {
      chosen.add(c.i);
      used += c.scene.duration;
    }
  }
  const rank: string[] = angle === "story" ? concept.arc : valueFirst ? VALUE_ORDER : ANGLE_ORDER[angle];
  const scenes0 = candidates.map((c) => c.scene);
  // Beats an arc doesn't list (the positioning line) sit right after the reveal.
  const rankOf = (role?: string) => {
    if (role === "demo") return valueFirst ? rank.indexOf("demo") : rank.indexOf("tour") - 0.5;
    // The gallery follows the product tour (or the features, when there's no tour in the arc).
    if (role === "gallery") return (rank.indexOf("tour") >= 0 ? rank.indexOf("tour") : rank.indexOf("features")) + 0.4;
    // Before / after follows the product's first appearance; the globe follows the features.
    if (role === "solve") return (rank.indexOf("meet") >= 0 ? rank.indexOf("meet") : rank.indexOf("reveal")) + 0.6;
    if (role === "support") return rank.indexOf("cta") - 0.6;
    if (role === "compare") return (rank.indexOf("meet") >= 0 ? rank.indexOf("meet") : rank.indexOf("reveal")) + 0.6;
    if (role === "reach") return (["features", "bento", "tour"].map((r) => rank.indexOf(r)).find((i) => i >= 0) ?? rank.length - 2) + 0.6;
    // The product assembled from its own components is the first thing after the reveal.
    if (role === "meet" && scenes0.some((c) => c.role === "meet" && c.skill === "ui-assemble")) return rank.indexOf("reveal") + 0.3;
    if (role === "metric") return rank.indexOf("cards") - 0.25;
    const i = rank.indexOf(role ?? "");
    return i >= 0 ? i : rank.indexOf("reveal") + 0.5;
  };
  const scenes = order
    .filter((c) => chosen.has(c.i))
    .sort((a, b) => rankOf(a.scene.role) - rankOf(b.scene.role) || a.i - b.i)
    .map((c) => c.scene);
  // Product-first is a cold open: the first product beat plays before the logo.
  if (angle === "product") {
    const r = scenes.findIndex((sc) => sc.role === "reveal");
    const first = scenes.findIndex((sc) => sc.role === "meet" || sc.role === "tour");
    if (r > 0 && first > r) scenes.splice(r, 0, scenes.splice(first, 1)[0]);
  }
  // Transitions follow the new order: the opener cuts in.
  if (scenes[0]) scenes[0] = { ...scenes[0], transition: "cut" };
  // Closing line: social proof when the film hasn't used it yet, else a varied call to action.
  const cta = scenes[scenes.length - 1];
  const usedStat = scenes.some((sc) => sc.role === "logos" || (sc.role === "metric" && sc.subtext === teamStat)) || (angle === "proof" && !!teamStat);
  // Chapter labels in the category's own voice.
  for (const sc of scenes) {
    const eb = concept.eyebrows[sc.role as keyof typeof concept.eyebrows];
    if (eb && sc.role !== "reveal" && sc.role !== "cta") sc.eyebrow = eb;
  }
  // "Free" is an offer, and an offer must be real: only when the site itself offers something free.
  const freeOffer = offersFree([site.cta ?? "", site.tagline, site.description, ...site.headlines, ...site.features].join(" "));
  const lines = concept.cta.filter((l) => freeOffer || !/\bfree\b/i.test(l)).map((l) => l.replace(/\{name\}/g, site.name));
  if (freeOffer && /\bfree\b/i.test(ctaLabel)) lines.push("Start *free* today");
  if (cta?.role === "cta") {
    // The closing line mustn't just repeat the button under it ("Start free" / "Start free trial").
    const button = norm(ctaLabel);
    const fresh = lines.filter((l) => {
      const n = norm(l);
      return !button || !(button.startsWith(n) || n.startsWith(button) || n.split(" ").filter((wd) => button.includes(wd)).length >= 2);
    });
    cta.text = teamStat && !usedStat ? `Join *${teamStat.toLowerCase()}*` : pick(fresh.length ? fresh : lines);
    // Nothing to try yet: the line matches the waitlist button.
    if (/waitlist/i.test(ctaLabel)) cta.text = `Be first to try *${site.name}*`;
  }

  // Thin material (a one-line prompt, a sparse page) makes a tight shorter cut rather than
  // padding with invented beats, and the director says what would unlock the full length.
  const plan = sanitizePlan({ title: site.name, palette: "cosmos", font: "inter", aspect: req.aspect, bpm, seed, scenes, brand, style: "saas", concept: concept.id, target });
  const styled = applyTemplate(plan, req.template ?? DEFAULT_TEMPLATE, {
    palette: req.palette && req.palette !== "auto" ? req.palette : undefined,
  });
  const total = styled.scenes.reduce((a, sc) => a + sc.duration, 0);
  if (total < target * 0.9) {
    const cut = Math.round(total);
    styled.target = cut;
    styled.notes = [
      `There's enough material for a tight ${cut}s film rather than ${target}s, so nothing is padded or invented. ` +
        (site.url
          ? "Sites with more feature headlines, steps or testimonials make longer films."
          : "List a few features in your prompt (e.g. “with X, Y and Z”) or import the website for the full cut."),
    ];
  }
  return styled;
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
      text: pick(["ALL IN ONE PLACE", "BUILT FOR TEAMS", "SEE IT IN ACTION"] as const),
      subtext: site.domain,
      duration: BEAT,
      transition: tr(["dolly", "whip", "zoom"]),
    });
  }
  scenes.push({
    skill: brand.logo ? "logo-reveal" : pick(["god-rays", "cinematic-title"] as const),
    text: name,
    subtext: `${contextCta(site)} · ${site.domain}`,
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
const isShot = (s: unknown): s is string => typeof s === "string" && /^\/api\/shot\?id=[a-f0-9]{16}-(hero|full|s\d|p\d{1,2}|logo)$/.test(s);
const PART_KINDS = new Set(["media", "panel", "card", "button"]);
function sanitizeParts(v: unknown): SitePart[] {
  if (!Array.isArray(v)) return [];
  const num = (x: unknown, max: number) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(max, x)) : 0);
  return v
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object" && isShot((p as { src?: unknown }).src) && PART_KINDS.has(String((p as { kind?: unknown }).kind)))
    .slice(0, 16)
    .map((p) => ({
      src: p.src as string,
      kind: p.kind as SitePart["kind"],
      x: num(p.x, 4000),
      y: num(p.y, 20000),
      w: num(p.w, 4000),
      h: num(p.h, 4000),
      r: num(p.r, 200),
      ...(typeof p.text === "string" ? { text: p.text.slice(0, 90) } : {}),
    }))
    .filter((p) => p.w >= 20 && p.h >= 16);
}
const isAsset = (s: unknown): s is string =>
  (typeof s === "string" && s.startsWith("/api/asset?url=") && s.length < 2100) || isShot(s);
const isHex = (s: unknown): s is string => typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);

/** Page sections as ordered [top, bottom] fractions (0..1), at most 24. */
function sanitizeBands(v: unknown): [number, number][] {
  if (!Array.isArray(v)) return [];
  const out: [number, number][] = [];
  for (const b of v.slice(0, 24)) {
    if (!Array.isArray(b) || b.length !== 2) continue;
    const [t, e] = b.map(Number);
    if (Number.isFinite(t) && Number.isFinite(e) && t >= 0 && e <= 1.0001 && e - t > 0.002 && t >= (out[out.length - 1]?.[1] ?? 0) - 0.002) out.push([t, Math.min(1, e)]);
  }
  return out;
}

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
    icon: isAsset(brand.icon) ? brand.icon : undefined,
    page: brand.page && isAsset(brand.page.src) && sanitizeBands(brand.page.bands).length ? { src: brand.page.src, bands: sanitizeBands(brand.page.bands) } : undefined,
    images: (brand.images ?? []).filter(isAsset).slice(0, 14),
    videos: (brand.videos ?? []).filter(isAsset).slice(0, 4),
    clientLogos: (brand.clientLogos ?? []).filter(isAsset).slice(0, 16),
    font: typeof brand.font === "string" && /^[A-Za-z0-9 ]{2,40}$/.test(brand.font) ? brand.font : undefined,
    colors: brand.colors && isHex(brand.colors.primary) && isHex(brand.colors.secondary) ? brand.colors : undefined,
    parts: sanitizeParts(brand.parts),
  };
}

const VOICE_SOURCES_OK = new Set(["local", "openai", "elevenlabs", "custom", "upload"]);
function sanitizeVoice(v: unknown): VideoPlan["voiceover"] {
  if (!v || typeof v !== "object") return undefined;
  const r = v as Record<string, unknown>;
  if (!VOICE_SOURCES_OK.has(String(r.source))) return undefined;
  return {
    enabled: r.enabled === true,
    source: r.source as NonNullable<VideoPlan["voiceover"]>["source"],
    voice: typeof r.voice === "string" && /^[\w.-]{1,64}$/.test(r.voice) ? r.voice : "af_heart",
    captions: r.captions !== false,
    model: typeof r.model === "string" && /^[\w.:/-]{1,64}$/.test(r.model) ? r.model : undefined,
    offset: Number(r.offset) > 0 ? Math.min(60, Number(r.offset)) : undefined,
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
        ? s.items.filter((i) => typeof i === "string" && i.trim()).slice(0, 8).map((i) => String(i).slice(0, 140))
        : undefined,
      vo: typeof s.vo === "string" && s.vo.trim() ? s.vo.trim().slice(0, 240) : undefined,
      why: typeof s.why === "string" && s.why.trim() ? s.why.trim().slice(0, 160) : undefined,
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
    flavor: ["tech", "soft", "pop", "minimal", "neon"].includes(raw.flavor as string) ? raw.flavor : undefined,
    scheme: raw.scheme === "vibrant" || raw.scheme === "60-30-10" ? raw.scheme : undefined,
    glow: raw.glow === false ? false : undefined,
    textFx: (TEXT_FX as readonly string[]).includes(raw.textFx as string) ? (raw.textFx as VideoPlan["textFx"]) : undefined,
    concept: typeof raw.concept === "string" && CONCEPT_MAP[raw.concept] ? raw.concept : undefined,
    voiceover: sanitizeVoice(raw.voiceover),
    target: Number(raw.target) > 0 ? Math.min(120, Math.max(6, Number(raw.target))) : undefined,
    notes: Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === "string").slice(0, 3).map((n) => n.slice(0, 300)) : undefined,
    look:
      raw.look && typeof raw.look === "object"
        ? {
            grid: raw.look.grid !== false,
            beams: Math.min(8, Math.max(0, Number(raw.look.beams) || 0)),
            aurora: Math.min(3, Math.max(0, Number(raw.look.aurora) || 0)),
            text: (TEXT_FX as readonly string[]).includes(raw.look.text as string) ? raw.look.text : undefined,
            backdrop: ["grid", "dots", "blobs", "scanlines", "plain", "horizon", "stars"].includes(raw.look.backdrop as string) ? raw.look.backdrop : undefined,
            card: ["glass", "frost", "flat", "brutal", "clay"].includes(raw.look.card as string) ? raw.look.card : undefined,
            shader: ["mesh", "grain", "warp", "smoke", "neuro", "rays", "panels", "metaballs", "swirl", "voronoi", "dither", "waves"].includes(raw.look.shader as string) ? raw.look.shader : undefined,
            shaderStrength: raw.look.shaderStrength !== undefined ? Math.min(1, Math.max(0, Number(raw.look.shaderStrength) || 0)) : undefined,
            shaderSpeed: raw.look.shaderSpeed !== undefined ? Math.min(3, Math.max(0, Number(raw.look.shaderSpeed) || 0)) : undefined,
            bokeh: raw.look.bokeh === true ? true : raw.look.bokeh === false ? false : undefined,
            depth: raw.look.depth !== undefined ? Math.min(30, Math.max(0, Number(raw.look.depth) || 0)) : undefined,
            turn: raw.look.turn !== undefined ? Math.min(40, Math.max(0, Number(raw.look.turn) || 0)) : undefined,
            slab: raw.look.slab === true ? true : undefined,
            overlay: raw.look.overlay === "hud" || raw.look.overlay === "frame" ? raw.look.overlay : undefined,
            textScale: raw.look.textScale !== undefined ? Math.min(1.6, Math.max(0.7, Number(raw.look.textScale) || 1)) : undefined,
            grain: raw.look.grain !== undefined ? Math.min(2, Math.max(0, Number(raw.look.grain) || 0)) : undefined,
            vignette: raw.look.vignette !== undefined ? Math.min(1.6, Math.max(0, Number(raw.look.vignette) || 0)) : undefined,
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
