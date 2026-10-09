import { assetUrl } from "./assets";
import { ART_STYLES, KINDS, sanitizeCast } from "./cast";
import { hashString, rng } from "./math";
import { SCENES } from "./scenes";
import { CONCEPT_MAP, CONCEPTS, detectConcept, rankMoments } from "./concepts";
import { ownMoment } from "./momentitems";
import { playSpeed } from "./speed";
import { DEMO_SKILLS } from "./templates";
import { hasSpecificIcon } from "./icons";
import { writeVoiceover } from "./script";
import { isClaimWord, isHealthClaim, isNumericClaim, isUnsafe, mentionsOffer, offerSafe, safeCopy } from "./claims";
import { applyTemplate, DEFAULT_TEMPLATE, fitLength, TEMPLATE_MAP } from "./templates";
import { DEFAULT_TRAILER_STYLE, detectTrailerStyle, FILM_CUE, TRAILER_STYLE_MAP, type TrailerStyle } from "./trailers";
import { softwareKind } from "./software";
import {
  FONTS,
  PALETTE_IDS,
  SKILL_IDS,
  TEXT_FX,
  TRANSITIONS,
  POINTER_STYLES,
  SHAPE_SETS,
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

/** The 3D and clean logo intros, in the order remakes try them (a 3D one, then a clean one). */
const LOGO_3D = ["logo-extrude", "logo-draw", "logo-stage", "logo-wipe", "logo-spin", "logo-pop", "logo-shatter", "logo-morph", "logo-orbit", "logo-slices", "logo-layers", "logo-dots", "logo-tunnel", "logo-type", "logo-flip", "logo-shapes"] as const;

export type Length = "short" | "standard" | "long" | "minute" | "ninety" | "two";
export const LENGTH_SECONDS: Record<Length, number> = { short: 12, standard: 20, long: 34, minute: 60, ninety: 90, two: 120 };
/** The lengths offered in the studio, shortest first (34s is the default). */
export const LENGTHS: { id: Length; label: string }[] = [
  { id: "short", label: "12s" },
  { id: "standard", label: "20s" },
  { id: "long", label: "34s" },
  { id: "minute", label: "1m" },
  { id: "ninety", label: "1.5m" },
  { id: "two", label: "2m" },
];
export const isLength = (x: unknown): x is Length => typeof x === "string" && x in LENGTH_SECONDS;

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

/**
 * Who a product is for, as the words a site uses when it names them ("for designers and developers"),
 * each with a neutral line about the work it helps with (no promises, no numbers).
 */
const AUDIENCES: { re: RegExp; card: string }[] = [
  { re: /\b(designers?|design teams?)\b/i, card: "Designers — Mockups, reviews and hand-offs in one place" },
  { re: /\b(developers?|engineers?|engineering teams?|dev teams?)\b/i, card: "Developers — Specs and code right where you work" },
  { re: /\b(product managers?|product teams?|pms)\b/i, card: "Product teams — Plans, priorities and feedback together" },
  { re: /\b(marketers?|marketing teams?)\b/i, card: "Marketers — Campaigns from brief to launch" },
  { re: /\b(sales (teams?|reps?)|account executives?|sellers)\b/i, card: "Sales teams — Your pipeline and follow-ups in view" },
  { re: /\b(support (teams?|agents?)|customer success)\b/i, card: "Support teams — Customer questions in one place" },
  { re: /\b(founders?|startups?)\b/i, card: "Founders — The whole business in one view" },
  { re: /\b(agenc(y|ies)|freelancers?|consultants?)\b/i, card: "Agencies — Client work, organised" },
  { re: /\b(creators?|youtubers?|podcasters?|influencers?)\b/i, card: "Creators — From idea to published" },
  { re: /\b(teachers?|educators?|instructors?)\b/i, card: "Educators — Lessons and classes in one place" },
  { re: /\b(students?|learners?)\b/i, card: "Students — Notes and study, organised" },
  { re: /\b(recruiters?|hr teams?|people teams?|hiring managers?)\b/i, card: "People teams — Hiring and onboarding together" },
  { re: /\b(finance teams?|accountants?|bookkeepers?|cfos?)\b/i, card: "Finance teams — Numbers and reports in one view" },
  { re: /\b(IT (teams?|admins?|departments?)|sysadmins?|workspace admins?)\b/, card: "IT and admins — Access and settings under control" },
];

/** The audiences a site names itself (at least two, else none), in the order it names them. */
/** A business that sells services (an agency, studio, consultancy or freelancer), from its own words. */
export const SERVICE_BIZ =
  /\b(?:our services|services we offer|what we do|full[- ]service|(?:creative|digital|design|marketing|web|branding|development|seo|video|content|growth) (?:agency|studio)|agency|consult(?:ing|ancy|ants?)|freelanc\w*|we help (?:brands|businesses|companies|startups|teams))\b/i;

/**
 * The how-it-works layout for a remake: the numbered line (the default), business-process arrows,
 * a light trail, a staircase, portals, a cycle (three steps or more) and flip cards (four or
 * fewer). Service businesses lead with the process arrows.
 */
export function howLayout(variant: number, n: number, serviceBiz = false) {
  const order = serviceBiz
    ? (["process-chevrons", "steps", "step-portals", "step-stairs", "light-trail", "process-cycle", "step-cards"] as const)
    : (["steps", "process-chevrons", "light-trail", "step-stairs", "step-portals", "process-cycle", "step-cards"] as const);
  // Every third even take rides the 3D arrow (see the caller), so the order counts the takes
  // left over: each layout comes up within the first few remakes.
  const slot = Math.floor(variant / 2);
  const pick = order[(slot - Math.floor((slot + 2) / 3)) % order.length];
  // (A cycle needs three steps; flip cards suit four or fewer.)
  if (pick === "process-cycle" && n < 3) return "process-chevrons";
  if (pick === "step-cards" && n > 4) return "step-portals";
  return pick;
}

export function audiencesOf(text: string): string[] {
  const found = AUDIENCES.map((a) => ({ card: a.card, at: text.search(a.re) })).filter((a) => a.at >= 0);
  return found.length >= 2 ? found.sort((a, b) => a.at - b.at).slice(0, 4).map((a) => a.card) : [];
}

/**
 * What comes in the box, from a listing's own words ("In the box: earbuds, charging case, USB-C
 * cable"; "Includes a carry pouch and a quick start guide"). Quantities are dropped (no numbers on
 * slides); 2–5 short names, else none.
 */
export function boxContents(lines: string[]): string[] {
  const lead = /\b(?:in the box|what'?s in the box|box contents|package (?:includes|contents)|(?:it )?comes with|what'?s included|included accessories)\s*[:\-–—]?\s*(.+)/i;
  for (const line of lines) {
    const m = (line ?? "").match(lead);
    if (!m) continue;
    const items = m[1]
      .split(/[.;!?]/)[0]
      .replace(/\s*\(.*?\)\s*/g, " ")
      .split(/\s*(?:,|\+|\/|\band\b|\bplus\b|&)\s*/i)
      .map((x) => x.replace(/\b\d+\s*(?:x|pcs?|pieces?|pack)?\b\s*/gi, "").replace(/^(?:a|an|the|one|two|three|four|your|our)\s+/i, "").replace(/^(?:pairs?|sets?) of\s+/i, "").trim())
      .filter((x) => x && x.split(/\s+/).length <= 4 && x.length <= 28 && !/\d|%|free|warranty|guarantee/i.test(x));
    const seen = new Set<string>();
    const uniq = items.filter((x) => !seen.has(x.toLowerCase()) && !!seen.add(x.toLowerCase())).map((x) => x.charAt(0).toUpperCase() + x.slice(1));
    if (uniq.length >= 2) return uniq.slice(0, 5);
  }
  return [];
}

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
/**
 * Designs that take the same content, per story beat. A remake rotates each beat through its
 * designs (offset per beat, so beats don't move in step), so consecutive remakes show the same
 * material in other slides. The first take keeps the director's best fit.
 */
const REMIX: Record<string, readonly SkillId[]> = {
  hook: ["blur-reveal", "type-cascade", "split-wipe", "type-echo", "style-shuffle"],
  revealNoLogo: ["logo-reveal", "particle-assemble", "logo-pop", "logo-type", "logo-draw", "logo-wipe", "logo-shapes", "logo-dots", "logo-morph", "logo-slices"],
  features: ["icon-features", "showreel", "card-stack", "contact-sheet"],
  bento: ["bento", "card-system", "spec-sheet", "widget-set"],
  how: ["steps", "process-chevrons", "step-stairs", "step-cards", "step-portals", "light-trail"],
};

function remix(plan: VideoPlan, variant: number): VideoPlan {
  if (!variant) return plan;
  const used = new Set(plan.scenes.map((s) => s.skill));
  const scenes = plan.scenes.map((s) => {
    const key = s.role === "reveal" && !plan.brand?.logo ? "revealNoLogo" : s.role ?? "";
    const pool = REMIX[key];
    if (!pool?.includes(s.skill)) return s;
    // (The list layouts want three items or more; a product's services keep their own designs.)
    const n = s.items?.length ?? 0;
    if ((key === "features" || key === "bento" || key === "how") && n < (key === "how" ? 2 : 3)) return s;
    const offset = [...key].reduce((a, c) => a + c.charCodeAt(0), 0) % pool.length;
    for (let k = 0; k < pool.length; k++) {
      const next = pool[(variant + offset + k) % pool.length];
      if (next !== s.skill && used.has(next)) continue;
      used.add(next);
      if (next === s.skill) return s;
      // A list shown one item at a time needs a little longer than a grid.
      const duration = key === "features" && next !== "icon-features" ? Math.min(8, Math.max(s.duration, 1.8 + n * 1.1)) : s.duration;
      return { ...s, skill: next, duration, why: [s.why, "Remake: another design for the same content"].filter(Boolean).join("; ") };
    }
    return s;
  });
  return { ...plan, scenes };
}

/**
 * Who the product is for, from its own words ("bookkeeping for freelancers" → "freelancers"): the
 * audience call-out an opener carries ("For freelancers"). Plural groups only, not "for you".
 */
export function audienceOf(lines: string[]) {
  const SKIP = /^(you|your|everyone|anyone|all|the|free|less|more|good|life|now|today|ever|teams? of one|years?|months?|weeks?|days?|hours?|minutes?|seconds?|people|users|customers|business|work)$/i;
  for (const line of lines) {
    const m = (line ?? "").match(/\bfor\s+((?:[a-z][a-z-]*\s){0,2}[a-z][a-z-]*s)\b/i);
    const who = m?.[1]?.trim();
    if (!who || who.split(/\s+/).some((w) => SKIP.test(w)) || who.length > 28) continue;
    return who.toLowerCase();
  }
  return "";
}

/** The site's own risk-reversal line, for under the end card's button ("Cancel anytime"). */
export function reassuranceOf(lines: string[]) {
  for (const line of lines) {
    const m = (line ?? "").match(/\b(cancel any ?time|no (?:long[- ]term )?contracts?|no lock-?in|no credit card(?: required| needed)?|no setup fees?)\b/i);
    if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase().replace("anytime", "anytime");
  }
  return "";
}

/**
 * Problems written from a product's own features or services, for a problem → solution film on a
 * site that names none ("SEO" → "Stuck on SEO"): plain struggle lines, never a claim. Two to three.
 */
export function problemsFrom(features: string[]) {
  const lead = [(x: string) => `Struggling with ${x}`, (x: string) => `Stuck on ${x}`, (x: string) => `Falling behind on ${x}`];
  const mid = (x: string) => (/^[A-Z][a-z]/.test(x) ? x[0].toLowerCase() + x.slice(1) : x);
  const seen = new Set<string>();
  const out: { pain: string; feature: string }[] = [];
  for (const f of features) {
    // ("Social media for small businesses" → "Social media": who it's for isn't the problem.)
    const t = f.split(/\s+[—–]\s+/)[0].replace(/\s+(?:for|to|with|so)\s+.*$/i, "").trim();
    const k = t.toLowerCase();
    // (Whole phrases — "Funnels that explain themselves", "The tools you need" — don't make problems.)
    if (!t || t.split(/\s+/).length > 4 || /\b(that|which|who|you|your|our|we|the|a|an)\b/i.test(t) || seen.has(k)) continue;
    seen.add(k);
    out.push({ pain: lead[out.length % lead.length](mid(t)), feature: t });
    if (out.length === 3) break;
  }
  return out.length >= 2 ? out : [];
}

/** The answer to a written problem: the feature's own line from the site ("SEO — Rank for what you sell"), else its name. */
function solutionLine(feature: string, described: string[]) {
  const hit = described.find((d) => d.split(/\s+[—–]\s+/)[0].trim().toLowerCase() === feature.toLowerCase());
  const detail = hit?.split(/\s+[—–]\s+/)[1]?.trim().replace(/[.!]+$/, "");
  // (Without a line of its own: the feature itself, taken care of.)
  return detail && detail.split(/\s+/).length <= 10 ? detail : `${feature}, sorted`;
}

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
  /** Story angle for SaaS films (problem → solution, product-first…); see ANGLES. */
  angle?: Angle;
  aspect: Aspect;
  length: Length;
  palette?: PaletteId | "auto";
  seed?: number;
  style?: StyleChoice;
  template?: string;
  /** Trailer films: the trailer style picked (see trailers.ts); otherwise matched to the prompt. */
  trailerStyle?: string;
  /** Claim-safe copy (default on): generic wording, no superlatives, guarantees or numbers. */
  safe?: boolean;
  /** Remake number (see SiteRequest.variant). */
  variant?: number;
}

/** Words that never carry meaning in a prompt. */
const FILLER = new Set(
  (
    "make create generate build give me i want need please video intro outro trailer teaser promo launch launching " +
    "motion graphics graphic animation animated epic modern cinematic style called named " +
    "some very really super cool awesome amazing using use like vibe vibes feel feeling seconds second sec " +
    "cartoon cartoons character characters"
  ).split(" "),
);
/** Glue words kept inside a phrase but trimmed from its edges. */
const GLUE = new Set(
  "a an the and or of for to in on with by at from into as is are be it its this that my our your about".split(" "),
);
const STOP = new Set([...FILLER, ...GLUE]);

const HOOKS = ["GET READY", "INTRODUCING", "ARE YOU READY", "THE WAIT IS OVER", "IT BEGINS NOW", "LEGENDS RISE"];
const OUTRO_SUBS = ["Coming soon", "Available now", "Join the movement", "Start today", "Experience it"];

/**
 * Trailer lines in each style's own voice: the opening line, the beats that pad a short prompt,
 * and the closing call. (A space documentary shouldn't say "Join the movement", nor a watch
 * brand "Look closer".)
 */
const GENRE_LINES: Record<string, { hooks: string[]; beats: string[]; outro: string[] }> = {
  cyber: { hooks: ["SYSTEM ONLINE", "ACCESS GRANTED", "THE CODE HAS CHANGED"], beats: ["ENTER THE GRID", "PUSH FURTHER", "UPLOAD COMPLETE", "BREAK THE SYSTEM"], outro: ["Access now", "Coming soon", "Join the network"] },
  tech: { hooks: ["THE FUTURE IS HERE", "INTRODUCING", "A NEW ERA BEGINS"], beats: ["BUILT FOR WHAT'S NEXT", "THINK BIGGER", "SEE WHAT'S POSSIBLE", "SMARTER BY DESIGN"], outro: ["Coming soon", "Available now", "Start today"] },
  action: { hooks: ["NO TURNING BACK", "BRACE YOURSELF", "IT BEGINS NOW"], beats: ["PUSH FURTHER", "NO FEAR", "HOLD ON", "NO HOLDING BACK"], outro: ["Coming soon", "Out now"] },
  space: { hooks: ["THE JOURNEY BEGINS", "LOOK UP", "BEYOND THE STARS"], beats: ["INTO THE UNKNOWN", "FURTHER OUT", "ONE SMALL STEP", "BEYOND THE EDGE"], outro: ["Coming soon", "Premieres soon"] },
  luxury: { hooks: ["TIMELESS", "CRAFTED WITH CARE", "BEAUTY IN DETAIL"], beats: ["IN THE DETAILS", "PURE ELEGANCE", "TIME, REFINED", "QUIET CONFIDENCE"], outro: ["Discover the collection", "Available now", "Experience it"] },
  retro: { hooks: ["PRESS PLAY", "TONIGHT", "TURN IT UP"], beats: ["UNTIL SUNRISE", "FEEL THE BEAT", "NEON DREAMS", "BACK IN TIME"], outro: ["Get your tickets", "Coming soon", "See you there"] },
  music: { hooks: ["TURN IT UP", "PRESS PLAY", "FEEL IT"], beats: ["LIVE", "LOUDER", "TILL LATE", "ONE MORE SONG"], outro: ["Listen now", "Out now", "Get your tickets"] },
  gaming: { hooks: ["GAME ON", "PRESS START", "LET THE GAMES BEGIN"], beats: ["NO MERCY", "LEVEL UP", "LOCK AND LOAD", "ONE MORE ROUND"], outro: ["Subscribe now", "Play now", "Join the squad"] },
  nature: { hooks: ["LISTEN CLOSELY", "WILD AT HEART", "WHERE IT BEGINS"], beats: ["UNTAMED", "BREATHE IN", "FIND YOUR PATH", "STILL WATERS"], outro: ["Coming soon", "Explore now"] },
  fun: { hooks: ["GUESS WHAT", "HERE WE GO", "GET READY"], beats: ["LET'S GO", "SAY HELLO", "MORE FUN", "JUST FOR YOU"], outro: ["Download now", "Join the fun", "Available now"] },
  editorial: { hooks: ["CHAPTER ONE", "IN FOCUS", "A STORY"], beats: ["LOOK CLOSER", "THE DETAILS", "BEHIND THE SCENES", "IN THEIR WORDS"], outro: ["Coming soon", "Read the story"] },
  hype: { hooks: ["ARE YOU READY", "IT'S HERE", "THE WAIT IS OVER"], beats: ["PUSH FURTHER", "LET'S GO", "GAME ON", "TURN IT UP"], outro: ["Out now", "Coming soon", "Join the movement"] },
  // Movie trailers: title-card lines in each genre's voice.
  "film-horror": { hooks: ["SOME DOORS STAY CLOSED", "IT KNOWS YOUR NAME", "DON'T LOOK BACK"], beats: ["STAY CLOSE", "LISTEN", "THE NIGHT IS LONG", "IT'S STILL HERE"], outro: ["Coming soon"] },
  "film-thriller": { hooks: ["ONE LAST JOB", "WATCH YOUR BACK", "SECRETS RUN DEEP"], beats: ["THE CLOCK IS RUNNING", "LOOK AGAIN", "NO WAY OUT", "ONE CHANCE"], outro: ["Coming soon"] },
  "film-action": { hooks: ["THIS SUMMER", "NO RULES", "ONE MISSION"], beats: ["NO RETREAT", "NO SURRENDER", "HOLD THE LINE", "FULL THROTTLE"], outro: ["Coming soon"] },
  "film-scifi": { hooks: ["THE STARS ARE CALLING", "BEYOND THE EDGE", "ONE SIGNAL"], beats: ["NO WAY HOME", "THE FUTURE IS WATCHING", "FURTHER OUT", "ONE LAST HOPE"], outro: ["Coming soon"] },
  "film-fantasy": { hooks: ["AN AGE IS ENDING", "LEGENDS ARE FORGED", "BEYOND THE MOUNTAINS"], beats: ["ONE QUEST", "ONE CHOICE", "THE OLD MAGIC STIRS", "A KINGDOM WAITS"], outro: ["Coming soon"] },
  "film-drama": { hooks: ["A FAMILY STORY", "SOME MOMENTS CHANGE YOU", "THIS WINTER"], beats: ["WHAT WE KEEP", "WHAT WE LOSE", "WHO WE BECOME", "WHAT WE LEAVE BEHIND"], outro: ["Coming soon"] },
  "film-comedy": { hooks: ["THIS SUMMER", "WHAT COULD GO WRONG?", "BAD IDEA. GREAT TIMING."], beats: ["IT DIDN'T GO TO PLAN", "THEN IT WENT WRONG", "AND THEN IT GOT WORSE", "THEY'RE BACK"], outro: ["Coming soon"] },
  "film-romance": { hooks: ["SOME LOVE STORIES", "ONE SUMMER", "TWO STRANGERS"], beats: ["ONE CHANCE", "TWO HEARTS", "THIS MOMENT", "ONE LAST DANCE"], outro: ["Coming soon"] },
  "film-noir": { hooks: ["THE CITY IS AWAKE", "THE CLUES HIDE SECRETS", "ONE NIGHT"], beats: ["SOMEONE IS LYING", "FOLLOW THE TRUTH", "SOMEONE KNOWS", "THE RAIN KEEPS FALLING"], outro: ["Coming soon"] },
  "film-doc": { hooks: ["A STORY OF", "SEE IT AS IT IS", "LOOK CLOSER"], beats: ["THE PEOPLE", "THE PLACE", "THE MOMENT", "THE JOURNEY"], outro: ["Coming soon"] },
  "film-family": { hooks: ["THIS HOLIDAY", "GET READY FOR", "THE BIGGEST LITTLE ADVENTURE"], beats: ["NEW FRIENDS", "BIG DREAMS", "ONE WILD RIDE", "HOME IS WHERE"], outro: ["Coming soon"] },
  "film-western": { hooks: ["OUT WEST", "THE LAW ENDS HERE", "ONE TOWN"], beats: ["ONE SHERIFF", "NO MERCY", "A RECKONING", "AT SUNDOWN"], outro: ["Coming soon"] },
};

/**
 * A movie trailer, the way trailers for films are cut: the studio's card (when the prompt names
 * one), a title card in the genre's voice, then shots and title cards in turn (the prompt's own
 * story beats as shots, the genre's lines as cards), the title, and the billing block with the
 * credits the prompt gives (never invented names) and the release line.
 */
function movieTrailer(o: {
  prompt: string;
  look: TrailerStyle;
  brand: string | null;
  content: string[];
  year: string | undefined;
  target: number;
  pick: <T>(arr: T[]) => T;
  req: PlanRequest;
  seed: number;
  styleOnly: (p: string) => boolean;
}): VideoPlan {
  const { prompt, look, year, target, pick, req, seed } = o;
  const mood = look.mood;
  const lines = GENRE_LINES[look.id] ?? GENRE_LINES["film-drama"];
  const beat = 60 / mood.bpm;
  const secs = (n: number, min: number) => Math.max(n, Math.ceil(min / beat)) * beat;
  const IDENT = secs(6, 3);
  const CARD = secs(4, 2.3);
  const SHOT = secs(4, 2.2);
  const TITLE = secs(6, 3.2);
  const END = secs(8, 4.2);
  // Who made it: the studio, the director, the writer and the cast, as the prompt says them.
  const name = String.raw`[A-Z][\w&.'-]*`;
  const studio =
    prompt.match(new RegExp(String.raw`\b(?:from|by)\s+((?:${name}\s+){0,3}(?:Pictures|Studios?|Films|Productions|Entertainment|Media))\b`))?.[1] ??
    prompt.match(new RegExp(String.raw`\b((?:${name}\s+){1,3})presents\b`))?.[1]?.trim();
  // (Names are capitalised words; only the cue itself may be in any case.)
  const credit = (re: string) => prompt.match(new RegExp(String.raw`\b${re}\s+(${name}(?:\s+${name}){0,3})`))?.[1];
  const director = credit("[Dd]irected [Bb]y");
  const writer = credit("[Ww]ritten [Bb]y");
  const starring = prompt.match(new RegExp(String.raw`\b[Ss]tarring\s+(${name}(?:\s+${name}){0,2}(?:\s*(?:,|and|&)\s*${name}(?:\s+${name}){0,2}){0,3})`))?.[1];
  const credits = [
    studio ? `${studio} presents` : "",
    director ? `A film by ${director}` : "",
    starring ? `Starring ${starring}` : "",
    writer ? `Written by ${writer}` : "",
  ].filter(Boolean);
  // The release line, as the prompt puts it ("in cinemas December 12"), else its year, else soon.
  const when = prompt.match(/\b(in (?:cinemas|theaters|theatres)(?: [A-Za-z]+ \d{1,2}| \d{4}| this [a-z]+)?|(?:this|next) (?:summer|winter|spring|autumn|fall|christmas|halloween)|coming (?:this|next) [a-z]+)/i)?.[1];
  const release = when ? when.charAt(0).toUpperCase() + when.slice(1) : year ? `Coming ${year}` : pick(lines.outro);
  // The story, line by line as a trailer's cards say it ("A YOUNG QUEEN", "A DRAGON", "A KINGDOM
  // AT WAR"): the prompt's own clauses after the title, whole, minus credits and request words.
  const creditWords = /\b(starring|directed|written|produced|presents|pictures|studios?|productions|entertainment|in cinemas|in theaters|in theatres|coming|trailer|teaser)\b/i;
  const title = (o.brand ?? o.content[0] ?? "Untitled").toUpperCase();
  const afterTitle = o.brand ? prompt.slice(prompt.indexOf(o.brand) + o.brand.length) : prompt;
  let story = afterTitle
    .replace(/["“”]/g, "")
    .replace(/^\s*(?:[:,—–-]|is|about)\s*/i, "")
    .replace(/\babout\s+/i, "")
    .split(/[,;:.!?]|\s[—–-]\s|\s+and\s+(?=(?:a|an|the|one|two|three|his|her|their)\b)/i)
    .map((x) => x.replace(/\s+(?:that|who|which)\s+/gi, " ").replace(/^\s*(?:and|with|then|but)\s+/i, "").trim())
    .filter((x) => x && !creditWords.test(x) && !o.styleOnly(x) && x.split(/\s+/).length <= 8 && x.toUpperCase() !== title);
  if (!story.length) story = o.content.filter((p) => !creditWords.test(p) && !o.styleOnly(p) && p.toUpperCase() !== title && !title.includes(p.toUpperCase()));
  // A tagline only when the prompt gives one in quotes after the title ("…" — "Some doors stay closed").
  const tagline = prompt.match(/["“][^"”]+["”][^"“]*["“]([^"”]{4,60})["”]/)?.[1];
  const scenes: Scene[] = [];
  let lastT: Transition = "cut";
  const cut = (pool: Transition[]) => {
    const t = pick(pool.filter((x) => x !== lastT).length ? pool.filter((x) => x !== lastT) : pool);
    lastT = t;
    return t;
  };
  if (studio) scenes.push({ skill: "studio-ident", text: studio, subtext: "presents", duration: IDENT, transition: "cut" });
  const hook = pick(lines.hooks);
  scenes.push({ skill: "intertitle", text: hook, duration: CARD, transition: "cut" });
  // Shots and cards in turn, as many as the length allows.
  const fixed = (studio ? IDENT : 0) + CARD + TITLE + END;
  // (Trailers need room to breathe: a little over the requested length, two story beats at least.)
  const pairs = Math.max(target >= 20 ? 2 : 1, Math.min(4, Math.floor((target * 1.15 - fixed + 1) / (SHOT + CARD))));
  const beats = lines.beats.filter((b) => b !== hook);
  const shotSkills = mood.body.filter((s) => s !== "intertitle");
  let lastShot: SkillId | undefined;
  for (let i = 0; i < pairs; i++) {
    const words = story[i] ?? beats[(i + 1) % beats.length];
    const pool = shotSkills.filter((s) => s !== lastShot);
    const skill = (pool.length ? pick(pool) : shotSkills[0] ?? "kinetic-slam") as SkillId;
    lastShot = skill;
    scenes.push({ skill, text: words.toUpperCase(), duration: SHOT, transition: cut(mood.transitions) });
    if (i < pairs - 1) scenes.push({ skill: "intertitle", text: beats[i % beats.length], duration: CARD, transition: "cut" });
  }
  const titleFx = mood.title.filter((x) => x !== lastShot);
  scenes.push({ skill: pick(titleFx.length ? titleFx : mood.title) as SkillId, text: title, subtext: tagline, duration: TITLE, transition: cut(mood.transitions) });
  scenes.push({ skill: "billing-block", text: title, items: credits, subtext: release, duration: END, transition: "cut" });
  const palette = req.palette && req.palette !== "auto" ? req.palette : mood.palette;
  return beatSync(sanitizePlan({ title, palette, font: mood.font, aspect: req.aspect, bpm: mood.bpm, seed, scenes, style: "trailer", trailerStyle: look.id }));
}

/** The closing call that fits what the trailer is for (a channel, a film, a launch, a collection). */
function trailerCall(lower: string, lines: { outro: string[] }, pick: <T>(arr: T[]) => T, year?: string) {
  if (/\b(channel|youtube|twitch|stream(er|ing)?|vlog|podcast)\b/.test(lower)) return "Subscribe now";
  if (/\b(documentary|series|film|movie|episode|season|opener)\b/.test(lower)) return year ? `Premieres ${year}` : "Coming soon";
  if (/\b(festival|concert|tour|party|night|gig|event)\b/.test(lower)) return year ? `Get your tickets · ${year}` : "Get your tickets";
  if (/\b(watch|watches|jewel(le)?ry|fragrance|perfume|collection|couture|fashion)\b/.test(lower)) return "Discover the collection";
  const line = pick(lines.outro);
  return year ? `${/soon|now/i.test(line) ? "Launching" : line} · ${year}` : line;
}

function extractBrand(prompt: string): string | null {
  const quoted = prompt.match(/["“'‘]([^"”'’]{2,32})["”'’]/);
  if (quoted) return quoted[1].trim();
  // "Grand opening of Sunny Side Bakery" / "Welcome to Casa Verde": the name after the occasion.
  const occasion = prompt.match(/\b(?:opening of|launch of|welcome to|reopening of)\s+([A-Z][\w'&.-]*(?:\s+[A-Z][\w'&.-]*){0,3})/i);
  if (occasion && /^[A-Z]/.test(occasion[1])) return occasion[1].trim();
  // "Orbitly: product analytics…" / "Orbitly — …": a name opening the prompt before a colon or
  // dash is the clearest signal, ahead of a capitalised word later on ("…for SaaS teams").
  const titledLead = prompt.match(/^\s*(?:meet\s+|introducing\s+)?([A-Z][\w.&-]{1,24}(?:\s+[A-Z][\w.&-]{1,24})?)\s*(?::|—|–|\s-\s)/);
  if (titledLead && !/^(an?|the|my|our|this|make|create|build|launch)$/i.test(titledLead[1]) && !NOT_BRAND.test(titledLead[1])) return titledLead[1].trim();
  // ("for SaaS teams", "for Shopify stores": who or what it's for, not its name; a name can follow.)
  const named = [...prompt.matchAll(/\b(?:called|named|for|brand|channel|company|startup|product)\s+([A-Z][\w.&-]*(?:\s+(?:&\s+)?[A-Z0-9][\w.&-]*){0,2})/g)].find((m) => !NOT_BRAND.test(m[1].split(/\s+/)[0]));
  if (named) return named[1].trim();
  // "Sentinel stops threats…" / "Shopwave helps brands…": a capitalised name opening a sentence.
  const opener = prompt.match(/^\s*(?:meet\s+|introducing\s+)?([A-Z][a-z][\w.&-]{1,24})\s+(?:is|are|helps|lets|makes|stops|keeps|turns|gives|brings|writes|runs|puts|connects|automates|finds|builds|ships)\b/);
  if (opener) return opener[1].trim();
  // "Ledgerly: business banking…" / "Nimbus is a developer platform…" / "Meet Nimbus, …"
  const lead = prompt.match(/^\s*(?:meet\s+|introducing\s+)?([A-Z][\w.&-]{1,24}(?:\s+[A-Z][\w.&-]{1,24})?)\s*(?::|—|–|-\s|,|\s+(?:is|are|helps|lets|makes)\b)/i);
  if (lead && !/^(an?|the|my|our|this|make|create|build|launch)$/i.test(lead[1])) return lead[1].trim();
  // "Sunrise Yoga studio intro with …": the capitalised name right before the request word.
  const titled = prompt.match(/^\s*((?:[A-Z][\w.&'-]*\s+){0,2}[A-Z][\w.&'-]*)\s+(?:[a-z]+\s+){0,2}(?:intro|launch video|promo|teaser|explainer)\b/);
  if (titled && !/^(an?|the|my|our|this|make|create|build|launch|intro|promo)$/i.test(titled[1].split(/\s+/)[0])) return titled[1].trim();
  // All-caps names ("PULSE"), ignoring common acronyms.
  const caps = prompt.match(/\b(?!(?:AI|API|SDK|CRM|HR|SEO|SaaS|UI|UX|B2B|CEO|CTO|SQL|LLM)\b)([A-Z][A-Z0-9.&-]{1,}(?:\s+[A-Z0-9][A-Z0-9.&-]+){0,2})\b/);
  if (caps) return caps[1].trim();
  const inner = prompt.match(/(?:^|[.!?]\s+)([A-Z][a-z][\w.&-]{1,24})\s+(?:is|helps|lets|makes)\b/);
  if (inner) return inner[1].trim();
  // "Halo smart water bottle with…" / "Aero Buds wireless earbuds…": a capitalised name leading
  // straight into what the product is (its lower-case description).
  const named2 = prompt.match(/^\s*((?:[A-Z][\w.&'-]*\s+){0,2}[A-Z][\w.&'-]*)\s+[a-z]/);
  if (named2 && !named2[1].split(/\s+/).some((w) => NOT_A_NAME.has(w.toLowerCase()))) return named2[1].trim();
  return null;
}

/** Acronyms and platforms a prompt names as the audience or the stack, not as the product. */
const NOT_BRAND = /^(?:AI|API|APIs|SDK|CRM|HR|SEO|SaaS|UI|UX|B2B|B2C|D2C|DTC|CEO|CTO|CFO|SQL|LLM|LLMs|iOS|Android|Mac|macOS|Windows|Linux|Slack|Shopify|Notion|Figma|GitHub|Stripe|Salesforce|HubSpot|Google|Amazon|Etsy|eBay|WordPress)$/;

/** Opening words that describe the request or its look, never the product's name. */
const NOT_A_NAME = new Set(
  (
    "a an the my our your this that i we me please make create build generate design launch need want new " +
    "modern epic cinematic playful retro gold golden dark light minimal minimalist clean simple sleek bold fun cyberpunk " +
    "gaming space luxury luxurious futuristic corporate professional elegant premium cool neon vibrant colourful colorful " +
    "short quick animated video intro outro promo teaser trailer explainer product brand logo summer winter holiday " +
    "christmas black white red blue green purple pink orange yellow 80s 90s"
  ).split(" "),
);

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
  const product = /\b(saas|apps?|platforms?|software|startups?|products?|dashboards?|b2b|apis?|crm|tools?|workspaces?|launch video|explainer|demo|systems?|teams|assistants?|automations?|analytics|management|tracking|trackers?|planners?|scheduling|bookkeeping|invoicing|roadmaps?|sprints?|kanban|workflows?)\b/.test(l) ||
    Math.max(...CONCEPTS.map((c) => (l.match(c.keywords) ?? []).length)) >= 2 ||
    // A business described ("Cartly, an online store for…", "a family dental clinic") is an intro too.
    /\b(stores?|shops?|online|e-?commerce|clinics?|firms?|agenc(?:y|ies)|compan(?:y|ies)|services?|caf[eé]s?|restaurants?|bakery|bakeries|business(?:es)?|marketplaces?|consultan(?:cy|ts?)|consulting|boutiques?|salons?|practices?|studios? for|solutions|enterprises?|corporate)\b/.test(l);
  const outright = /\b(saas|product launch|launch video|explainer|b2b)\b/.test(l);
  if (FILM_CUE.test(l) && !outright) return false;
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
/** "An intro for …" / "Launch video about …" / "A cartoon video with characters for …": the request, not the product. */
const LEAD_IN = /^(?:an?\s+)?(?:(?:launch|intro|promo|product|explainer|cartoon|animated|fun)\s+)*(?:video|film|teaser|trailer|intro|promo|cartoon|animation|explainer)(?:\s+with\s+(?:cartoon\s+|animated\s+|abstract\s+|blob\s+|memphis\s+|classic\s+|rubber[- ]hose\s+)?(?:characters?|a\s+mascot|mascots|stick\s+figures?|blobs?|people))?\s+(?:for|about|of)\s+/i;

/**
 * A written brief, the way people write one: a sentence about the business, then labelled parts
 * ("Features: …", "Services: …", "How it works: …", "End with a "Book a tour" button", a website,
 * an email and a phone number). The labelled parts are lifted out (steps, the button's words, the
 * contact details) and the rest, with its features or services, is the prompt the parser reads, so
 * a long brief doesn't turn into a row of odd feature cards. A plain one-line prompt passes through.
 */
type Brief = ReturnType<typeof readBrief>;

export function readBrief(prompt: string) {
  const list = (x: string) =>
    x
      .split(/,|;|\s(?:and|&)\s/i)
      .map((t) => t.trim().replace(/^(?:and|then)\s+/i, "").replace(/[.]+$/, ""))
      .filter((t) => t && t.split(/\s+/).length <= 7);
  const email = prompt.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0];
  const phone = prompt.match(/(?:\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/)?.[0];
  const domain = prompt
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, " ")
    .match(/\b(?:https?:\/\/)?((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|io|app|co|ai|dev|net|org|shop|studio|example)(?:\.[a-z]{2})?)\b/i)?.[1]
    ?.toLowerCase();
  let cta: string | undefined;
  let tagline: string | undefined;
  let social: string | undefined;
  let app: string | undefined;
  let steps: string[] = [];
  let features: string[] = [];
  let services = false;
  const keep: string[] = [];
  // Sentences (a full stop inside a website or an email doesn't end one).
  for (const raw of prompt.split(/(?<=[.!?])\s+(?=[A-Z"“])|\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const label = line.match(/^(features|key features|what it does|services|our services|we offer|how it works|steps|the process|process|tone|vibe|style|look|audience|it'?s for|made for|contact|reach us|find us|website|tagline|slogan|hook|open with|social|socials|follow us|app|get the app)\s*:\s*(.*)$/i);
    const end = line.match(/\b(?:end|close|finish)\s+(?:with|on)\s+(?:an?\s+|the\s+)?["“]([^"”]{2,32})["”](?:\s+(?:button|cta|call to action|link))?/i) ?? line.match(/^(?:cta|button|call to action)\s*:\s*["“]?([^"”.]{2,32})/i);
    if (end) cta = end[1].trim();
    if (label) {
      const key = label[1].toLowerCase();
      const body = label[2].replace(/[.]+$/, "");
      // A tagline, in quotes or not, opens the video ("Tagline: \"Skip the line, not the latte.\"").
      // Social handles ("@acme on Instagram and TikTok") and app stores go on the end card.
      if (/^(social|socials|follow us)$/.test(key)) social = body.match(/@[\w.]{2,30}/)?.[0];
      else if (/^(app|get the app)$/.test(key)) app = /app store|google play/i.test(body) ? [/app store/i.test(body) && "App Store", /google play/i.test(body) && "Google Play"].filter(Boolean).join(" & ") : undefined;
      else if (/^(tagline|slogan|hook|open with)$/.test(key)) tagline = body.replace(/^["“'‘]+|["”'’]+$/g, "").replace(/[.!]+$/, "").trim() || undefined;
      else if (/^(features|key features|what it does)$/.test(key)) features = list(body);
      else if (/services|we offer/.test(key)) {
        features = list(body);
        services = true;
      } else if (/how it works|steps|process/.test(key)) steps = list(body).slice(0, 4).map((x) => x.charAt(0).toUpperCase() + x.slice(1));
      // (Tone and audience aren't copy: the studio's style pick reads them from the prompt as typed.)
      continue;
    }
    // (A contact line, with the email, the phone or the website, isn't copy: it's read above.)
    const contactLine = (!!email && line.includes(email)) || (!!phone && line.includes(phone)) || (!!domain && line.toLowerCase().includes(domain) && /\b(?:visit|website|web|online at|find us|contact|call|email)\b/i.test(line));
    if (contactLine) continue;
    if (end && line.replace(end[0], "").replace(/[^a-z]/gi, "").length < 12) continue;
    keep.push(end ? line.replace(end[0], "").replace(/\s*(?:and\s*)?[.,]?\s*$/, ".").trim() : line);
  }
  // The business sentence first ("Make a launch video for…" reads as "a launch video for…"), its
  // features (or services) folded in as a list.
  let core = keep
    .join(" ")
    .trim()
    .replace(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:make|create|build|generate|produce|design|put together|i need|we need|i'd like|we'd like|i want|we want)\s+(?:me\s+|us\s+)?/i, "");
  if (features.length) {
    const head = core.replace(/[.]\s*$/, "");
    const firstEnd = head.search(/[.!?](\s|$)/);
    const lead = firstEnd > 0 ? head.slice(0, firstEnd) : head;
    const tail = firstEnd > 0 ? head.slice(firstEnd + 1).trim() : "";
    const feats = features.length > 1 ? `${features.slice(0, -1).join(", ")} and ${features[features.length - 1]}` : features[0];
    core = `${lead}: ${feats}.${tail ? ` ${tail}` : ""}`;
  }
  return { core: core || prompt, steps, cta, tagline, social, app, domain, email, phone, services, features };
}

export function parseSaasPrompt(prompt: string) {
  const brand = extractBrand(prompt);
  let body = prompt.replace(/["“”‘’]/g, "").trim();
  body = body.replace(LEAD_IN, "");
  body = body.replace(/^(?:meet|introducing)\s+/i, "");
  if (brand) body = body.split(brand).join(" ").replace(/^\s*[,:—–-]?\s*(?:is|are)?\s*/i, "").replace(/\s+(?:called|named)(?=\s*(?:[,.;:—–-]|$))/gi, "").trim();
  // "… studio intro with X": the request word isn't part of the pitch.
  body = body.replace(/^((?:[\w'-]+\s+){0,2})(?:intro|launch video|promo video|promo|teaser|explainer)\b\s*/i, "$1").trim();
  // Real stats have magnitude ("10,000+ teams", "99.9% uptime"), not "SOC 2" or "3 steps".
  const numbers = stats(prompt).filter((n) => /\d{2,}|\d[kmbx%]|\+/i.test(n.split(" ")[0]));
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  // Pitch: the leading noun phrase, up to the first list or clause marker. A list of what it
  // lets you do ("a design tool for teams to prototype, comment and hand off…") starts at "to":
  // "prototype" is the first feature, not part of the pitch.
  let pitchRaw = body.split(/\s(?:with|that|which|who|featuring|including)\s|:|;|\.|,\s(?=\w+\s)/i)[0].trim();
  const toList = pitchRaw.match(/^(.{6,}?)\s+to\s+((?:[\w-]+\s?){1,3})$/i);
  if (toList && new RegExp(`^${pitchRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*,`).test(body)) {
    pitchRaw = toList[1].trim();
    body = body.replace(/^(.*?)\s+to\s+/i, "$1, ");
  }
  const pitchWords = pitchRaw.split(/\s+/).filter(Boolean);
  // A one-word pitch ("studio") reads as the brand's own: "Sunrise Yoga studio".
  const pitch =
    pitchWords.length === 1 && brand
      ? `${brand} ${pitchRaw.toLowerCase()}`
      : pitchWords.length >= 2 && pitchWords.length <= 10
        ? cap(pitchRaw.replace(/^(an?|the)\s+/i, "The "))
        : shortenCopy(cap(pitchRaw), 9);
  // Features: list items and verb clauses after the pitch.
  let rest = body.slice(pitchRaw.length);
  // A bare pitch ("the AI assistant") reads better with its first verb clause:
  // "The AI assistant that writes your emails".
  let pitchOut = pitch;
  const clause = rest.match(/^\s+(that|which|who)\s+([^,;.]+?)(?=\s+and\s|[,;.]|$)/i);
  // Only when at least two other features remain for the feature row.
  // (Number clauses don't count: "80 minute battery" is screened out later as a spec claim.)
  const clauseCount = rest.split(/,|\sand\s|;/).filter((c) => c.trim() && !/^\s*\d/.test(c)).length;
  if (clause && clauseCount >= 3 && pitchWords.length <= 4 && pitchWords.length + 1 + clause[2].split(/\s+/).length <= 9) {
    pitchOut = `${pitch} ${clause[1].toLowerCase()} ${clause[2].trim()}`;
    rest = rest.slice(clause[0].length);
  }
  // A list opens with its connector ("… with X, Y and Z"); inside an item it belongs to the item
  // ("share galleries with clients", "reports that write themselves").
  rest = rest.replace(/^[\s,.;:—–-]*(?:with|that|which|who|featuring|including|plus)\s+/i, " ");
  const features = rest
    .split(/(?<!\d),|,(?!\d)|[;:]|\.(?!\d)|\sand\s|\s&\s|\s(?:featuring|including|plus)\s/i)
    .map((c) =>
      c
        .trim()
        .replace(/^(?:(?:it|they|we|you)\s+(?:also\s+)?(?:has|have|comes?|offers?|gives?(?:\s+you)?|includes?|features?|gets?)\s+(?:with\s+)?)/i, "")
        .replace(/^(?:and|with|that|which|also|plus|to|it)\s+/i, "")
        // ("a help center" → "Help center": a feature is a label.)
        .replace(/^(?:an?|the)\s+(?=\S+\s)/i, "")
        .replace(/\s+(?:for|to)\s+(?:teams?|startups?|you|everyone|businesses)\b.*$/i, ""),
    )
    .filter((c) => c && !/^[$€£]?\d[\d,.]*[kmb%x]?\+?(\s|$)/i.test(c) && !/^[\d\s.,%+$€£kmb]+$/i.test(c))
    .map((c) => cap(c.split(/\s+/).length > 6 ? shortenCopy(c, 6) : c))
    .filter((c) => c && c.split(/\s+/).length <= 6 && !/^(the|a|an|you|it|them|teams?)$/i.test(c));
  // Positioning reads better than a bare verb clause: "Helps brands sell online" → "For brands
  // that sell online"; and a pitch says who it's for when the prompt does ("…and automated
  // expenses for startups" → "Business banking for startups").
  const helps = pitchOut.match(/^(?:helps|lets|enables|allows)\s+([\w-]+(?:\s+[\w-]+)??)\s+(?:to\s+)?([a-z].*)$/i);
  if (helps && /s$/i.test(helps[1])) pitchOut = `For ${helps[1].toLowerCase()} that ${helps[2]}`;
  const audience = prompt.match(/\bfor\s+((?:(?:fast-growing|small|growing|remote|modern|busy|independent|creative)\s+)?(?:startups|teams|businesses|freelancers|creators|agencies|founders|families|students|enterprises|shops|merchants|restaurants|clinics|developers))\b/i);
  if (audience && !/\bfor\b/i.test(pitchOut) && pitchOut.split(/\s+/).length <= 5 && !features.some((f) => f.toLowerCase().includes(audience[1].toLowerCase())))
    pitchOut = `${pitchOut} for ${audience[1].toLowerCase()}`;
  return { brand, pitch: pitchOut, features: [...new Set(features)], numbers };
}

/** A phrase that opens on what something does ("writes your emails", "helps brands sell"). */
const VERB_LEAD = /^(helps|lets|makes|keeps|turns|gives|brings|writes|runs|stops|puts|connects|automates|finds|builds|ships|tracks|sends|shares|plans|books|manages|summari[sz]es|creates|generates|answers|handles|syncs|organi[sz]es|schedules|monitors|protects|saves|shows|tells|learns|records|edits|designs|delivers|collects|replaces|cuts|removes|captures|routes|matches|converts|predicts|detects|translates|transcribes|drafts|reviews|deploys|scales|hosts|stores|backs)\b/i;

/** "Pulse" + "The analytics app for product teams" + features → one plain sentence about it. */
function promptDescription(brand: string | null, pitch: string, features: string[]) {
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "");
  // Feature names keep their own capitals ("AI insights") but read as part of the sentence.
  const lower = (x: string) => (/^[A-Z][a-z]/.test(x) && !/^[A-Z][a-z]+[A-Z]/.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x);
  const what = /^(the|an?)\s/i.test(pitch) ? pitch.charAt(0).toLowerCase() + pitch.slice(1) : lower(pitch);
  // A pitch that's already a clause ("helps brands sell online") follows the name directly.
  const verbal = VERB_LEAD.test(what);
  const head = brand ? `${brand} ${verbal ? "" : "is "}${what}` : `${what.charAt(0).toUpperCase()}${what.slice(1)}`;
  const feats = features.slice(0, 4).map(lower);
  if (!feats.length) return `${head}.`;
  // Verb features ("writes your emails") join with "that"; things it has, with "with".
  const doing = feats.filter((f) => VERB_LEAD.test(f));
  const having = feats.filter((f) => !VERB_LEAD.test(f));
  const parts = [doing.length ? ` that ${list(doing)}` : "", having.length ? `${doing.length ? "," : ""} with ${list(having)}` : ""];
  return `${head}${doing.length ? "" : ","}${parts.join("")}.`.replace(/,\s*,/g, ",");
}

/** Problems a prompt names: "tired of X", "no more X", "instead of X", "struggling with X". */
function promptPains(prompt: string) {
  const out: string[] = [];
  for (const m of prompt.matchAll(/\b(tired of|no more|instead of|struggling with|sick of|without the)\s+([^,.;:!?]+?)(?=\s+(?:and|or|with|so|for)\b|[,.;:!?]|$)/gi)) {
    const phrase = m[2].trim();
    if (!phrase || phrase.split(/\s+/).length > 6) continue;
    const p = m[1].toLowerCase() === "no more" ? `No more ${phrase}` : phrase.charAt(0).toUpperCase() + phrase.slice(1);
    if (!out.some((x) => x.toLowerCase() === p.toLowerCase())) out.push(p);
  }
  return out.slice(0, 3);
}

/**
 * A contrast the words state themselves, as [old way, new way]: "less time typing, more time
 * selling", "from stressed to calm", "replace spreadsheets with one workspace", or "instead of /
 * no more / less time on X" (the new way then being `fallback`: the product itself, in its own
 * words). (The claim-safe copy pass softens "no more X" to "less time on X" before this reads it.) Only short
 * phrases in the writer's own words, so the slide never puts a claim in their mouth.
 */
export function contrastPairOf(text: string, fallback?: string): [string, string] | undefined {
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  // (Short phrases only, no prices or numbers, and not a place: "from anywhere to production".)
  const ok = (x?: string) => !!x && x.trim().split(/\s+/).length <= 6 && x.trim().length >= 3 && !/\d/.test(x) && !/^(anywhere|everywhere|anything|here|there|home|day one|one|any)\b/i.test(x.trim());
  const clean = (x: string) => x.trim().replace(/^(the|your|all)\s+/i, "").replace(/\s+(in|for|with) (minutes|seconds|days)$/i, (m) => m);
  const end = "(?=\\s*(?:[,.;:!?]|$|\\s+(?:and|so|for|with|while)\\b))";
  const tries: [RegExp, (m: RegExpMatchArray) => [string, string] | undefined][] = [
    [new RegExp(`\\bless\\s+([^,.;:!?]+?)\\s*(?:,|and|&)?\\s+more\\s+([^,.;:!?]+?)${end}`, "i"), (m) => [cap(clean(m[1])), `More ${clean(m[2])}`]],
    [new RegExp(`\\breplac(?:e|es|ing)\\s+([^,.;:!?]+?)\\s+with\\s+([^,.;:!?]+?)${end}`, "i"), (m) => [cap(clean(m[1])), cap(clean(m[2]))]],
    [new RegExp(`\\bfrom\\s+([^,.;:!?]+?)\\s+to\\s+([^,.;:!?]+?)${end}`, "i"), (m) => [cap(clean(m[1])), cap(clean(m[2]))]],
    [new RegExp(`\\b(?:instead of|rather than|no more|tired of|sick of|less time (?:on|with|spent on))\\s+([^,.;:!?]+?)${end}`, "i"), (m) => (fallback ? [cap(clean(m[1])), cap(fallback)] : undefined)],
  ];
  for (const [re, make] of tries) {
    const m = text.match(re);
    const pair = m ? make(m) : undefined;
    if (pair && ok(pair[0]) && ok(pair[1]) && pair[0].toLowerCase() !== pair[1].toLowerCase()) return pair;
  }
  return undefined;
}

/** A brief about software rather than a shop, a trade or a studio. */
const APPISH = /\b(apps?|software|platform|saas|dashboards?|api|extensions?|plugins?)\b/i;
/** Slides that show software at work: a local business shows itself instead. */
const SOFTWARE_SLIDES = new Set<string>(["click-flow", "notify-stack", "changelog", "ai-prompt", "kanban", "d3-desk", "d3-laptop", "d3-phone", "d3-popout", "d3-lineup", "d3-split", "chat-thread", "live-cursors", "phone-tour", "toggle-list", "calendar-drop", "inbox-sweep", "code-deploy", "table-fill", "comment-pins", "char-desk", "ui-tour", "product-tour"]);
/** Concepts whose lines suit a local business of their kind (others are software lines: "Sell with…", "Your pipeline…"). */
const LOCAL_CONCEPTS = new Set(["food", "booking", "pets", "realestate", "legal", "health", "education", "fitness", "general"]);
/** The industry slide for a kind of local business, with its headline. */
const LOCAL_KINDS: [RegExp, string, string][] = [
  [/\b(law|legal|tax|accounting|bookkeeping|agency|insurance)\b/i, "ind-team", "How we *help*"],
  [/\b(restaurants?|caf(e|é)s?|coffee|bak(ery|ehouse)|pizzas?|pizzeria|tacos?|ice cream|creamery|kitchen|diner|food truck|menu)\b/i, "ind-menu", "Fresh on the *menu*"],
  [/\b(plumb|electric|roof|construction|contract|hvac|heating|landscap|renovat|builders?)/i, "ind-site", "On the *job*"],
  [/\b(mov(ing|ers)|delivery|cleaning|cleaners|lawn)\b/i, "ind-route", "We come to *you*"],
  [/\b(daycare|preschool|school|tutor|dance|lessons|classes)\b/i, "ind-lesson", "A day at *{name}*"],
  [/\b(dental|dentists?|clinic)\b/i, "ind-care", "Your *visit*"],
];

/**
 * A storefront story for a local business: software slides (click flows, notification stacks,
 * device demos) give way to the business's own industry slide (a menu board, a job site, shop
 * tags…) and its steps; lines from a software category that doesn't fit ("Sell with…", "Get your
 * tickets") give way to plain local ones; and the close asks for the visit, the booking or the call.
 */
function localize(plan: VideoPlan, prompt: string, brief: Brief) {
  const name = plan.brand?.name ?? plan.title;
  const items = brief.features.map((f) => f.charAt(0).toUpperCase() + f.slice(1)).slice(0, 4);
  const [, skill, head] = LOCAL_KINDS.find(([re]) => re.test(prompt)) ?? [null, "ind-shop", "Come on *in*"];
  const concept = CONCEPT_MAP[plan.concept ?? ""];
  const fits = !concept || LOCAL_CONCEPTS.has(concept.id);
  const swapHead = concept?.swap.split(",")[0];
  const STEPS = /^(steps|process-|arrow-rise|step-|node-graph)/;
  let industry = false;
  let steps = plan.scenes.some((s) => STEPS.test(s.skill));
  const out: Scene[] = [];
  for (const s of plan.scenes) {
    if (SOFTWARE_SLIDES.has(s.skill)) {
      if (!industry && items.length >= 2) {
        industry = true;
        out.push({ ...s, skill: skill as SkillId, text: head.replace("{name}", name), subtext: undefined, items, role: s.role === "demo" || s.role === "tour" ? "features" : s.role });
      } else if (!steps && brief.steps.length >= 2) {
        steps = true;
        out.push({ ...s, skill: "steps" as SkillId, text: "How it *works*", subtext: undefined, items: brief.steps.slice(0, 4), role: "how" });
      }
      continue;
    }
    let text = s.text;
    if (!fits && s.role !== "hook" && s.role !== "reveal") {
      const bare = text.replace(/\*/g, "");
      if (concept && (bare === concept.featuresTitle.replace(/\*/g, "") || (swapHead && bare.startsWith(swapHead)))) text = s.skill === "word-swap" && items.length >= 3 ? `Come in for ${items.slice(0, 3).join("|").toLowerCase()}` : "What we *offer*";
    }
    if (s.role === "cta") {
      const b = (brief.cta ?? "").toLowerCase();
      text = /\b(book|schedule|appointment|class|trial|tour|consult|session|stay|groom)/.test(b) ? `Book with *${name}*` : /\b(call|quote|inspection)\b/.test(b) ? `Call *${name}* today` : /\b(order|menu|flavours)\b/.test(b) ? `Order from *${name}*` : `Visit *${name}*`;
    }
    out.push(text === s.text ? s : { ...s, text });
  }
  plan.scenes = out;
}

function planFromPromptSaas(req: PlanRequest & { brief?: Brief }): VideoPlan {
  // A written brief gives up its steps, button and contact details; the parser reads the rest.
  const brief = req.brief ?? readBrief(req.prompt.trim());
  // (The ask in front of the name, "a welcoming intro for", "a homebuilder video for", isn't the pitch.)
  const prompt = (req.brief ? req.prompt.trim() : brief.core).replace(/^(?:an?\s+)?(?:[\w'-]+,?\s+){0,5}?(?:video|intro|film|teaser|trailer|promo|opener|launch|showreel)\s+for\s+(?=["“])/i, "");
  const seed = (req.seed ?? hashString(prompt)) >>> 0;
  const parsed = parseSaasPrompt(prompt);
  const brand = parsed.brand ?? "Your product";
  const numbers = parsed.numbers;
  const tagline = parsed.pitch || `Meet ${brand}`;
  // (A reassurance in the prompt — "Cancel anytime" — goes under the end card's button, not into the features.)
  const named = parsed.features.filter((f) => norm(f) !== norm(tagline) && !reassuranceOf([f]));
  // A prompt that names fewer than two features ("an intro for my bakery booking app") still gets
  // feature cards: what a product of its kind typically offers, said plainly (no claims), and the
  // film's director's note says so, so they can be edited to match.
  const concept = detectConcept(`${brand} ${tagline} ${prompt}`);
  const typical = named.length < 2 && concept.starter ? concept.starter.filter((f) => !named.some((n) => norm(n) === norm(f))).slice(0, 4 - named.length) : [];
  const features = [...named, ...typical];
  // A prompt becomes a minimal site profile, so prompt films get the same concept-aware arc,
  // feature icons, chapters, pacing and CTA voice as website films.
  const site: SiteData = {
    url: "",
    domain: brief.domain ?? "",
    name: brand,
    tagline,
    // The product described in a clean sentence of its own ("Pulse is the analytics app for
    // product teams, with dashboards, AI insights and team sharing."), never the prompt as typed:
    // slides quote it (the AI answer, a subtitle).
    // (A brief that lists its services says so, so they're shown as services.)
    description: promptDescription(parsed.brand, tagline, named) + (brief.services && named.length ? ` Our services: ${named.slice(0, 5).join(", ")}.` : ""),
    headlines: features.slice(0, 6),
    features: [],
    stats: numbers.map((n) => naturalCase(n, prompt)),
    testimonials: [],
    clientLogos: [],
    steps: brief.steps,
    // Problems the prompt names ("for teams tired of spreadsheets", "no more missed calls").
    pains: promptPains(prompt),
    // A contrast the prompt states ("less typing, more selling"), for a split contrast slide.
    // (When it names only the old way, the new way is the product itself: "Invoicing software for freelancers".)
    contrast: contrastPairOf(prompt, [tagline.replace(/^(an?|the)\s+/i, "").replace(/\s+(instead of|rather than|so you|without|no more)\b.*$/i, ""), ...features].find((f) => f.split(/\s+/).length <= 6 && !/^meet\b/i.test(f))),
    font: null,
    shots: { hero: null, full: null, sections: [] },
    cta: brief.cta ?? null,
    logo: null,
    images: [],
    videos: [],
    themeColor: null,
  };
  const plan = planFromSiteSaas(site, { aspect: req.aspect, length: req.length, palette: req.palette, seed, template: req.template, style: "saas", variant: req.variant, angle: req.angle, reassure: reassuranceOf([prompt]) });
  const shown = typical.filter((f) => plan.scenes.some((sc) => sc.items?.some((it) => norm(it.split(/\s+[—–]\s+/)[0]) === norm(f))));
  if (shown.length) {
    const why = named.length ? "the prompt named only one feature" : "the prompt didn't name any features";
    const note = `The feature cards include what a typical ${concept.name.toLowerCase()} product offers (${shown.join(", ")}), because ${why}. Edit them to match yours, or list features in your prompt (e.g. “with X, Y and Z”).`;
    plan.notes = [note, ...(plan.notes ?? [])].slice(0, 3);
  }
  if (!parsed.brand) {
    // No name in the prompt: the film never says "Your product" as if it were one. The reveal
    // names what it is ("Your productivity app"), eyebrows lose the name, the close becomes a
    // plain call, and a note says where to add the name.
    const kind = tagline.replace(/^(the|an?|your)\s+/i, "").replace(/\.$/, "");
    const reveal = kind && kind.split(/\s+/).length <= 4 ? `Your ${kind.charAt(0).toLowerCase()}${kind.slice(1)}` : brand;
    plan.scenes = plan.scenes.map((s) => ({
      ...s,
      eyebrow: s.eyebrow?.replace(/^(Introducing|Why|Meet)\s+Your product$/, (_, w: string) => (w === "Why" ? "Why it works" : w)),
      text:
        s.role === "reveal"
          ? s.text.replace(/Your product/, reveal)
          : s.role === "cta" && /Your product/.test(s.text)
            ? "Get started *today*"
            : s.text.replace(/\*?Your product\*?/g, "*the product*"),
    }));
    // (The narrator and the end card's lock-up use the same words.)
    if (plan.brand) plan.brand = { ...plan.brand, name: reveal };
    plan.notes = [`No product name was found in the prompt, so the reveal says “${reveal}”. Type the name on that slide, or start the prompt with it (e.g. “Acme is a …”).`, ...(plan.notes ?? [])].slice(0, 3);
  }
  // A local business (a phone number, no app or software in the brief) gets a storefront story.
  if (brief.phone && !APPISH.test(prompt)) localize(plan, prompt, brief);
  // The brief's tagline is the opening line (a short one: it has to land in a second or two).
  const line = brief.tagline;
  if (line && line.split(/\s+/).length <= 9) {
    const at = plan.scenes.findIndex((s) => s.role === "hook");
    const i = at >= 0 ? at : 0;
    if (plan.scenes[i] && plan.scenes[i].role !== "reveal" && plan.scenes[i].role !== "cta") plan.scenes[i] = { ...plan.scenes[i], text: line };
  }
  // The brief's email, phone, social handle and app stores go on the end card, under the website.
  const contact = [brief.email, brief.phone, brief.social, brief.app].filter(Boolean).join("  ·  ");
  if (contact && plan.brand) plan.brand = { ...plan.brand, contact };
  return { ...plan, title: plan.brand?.name ?? brand };
}

/**
 * A product profile from a prompt and uploaded product photos ("Aero Buds: wireless earbuds with
 * noise cancelling, all-day battery and a pocket case" + photos): filmed as a product video.
 */
export function productFromPrompt(prompt: string, photos: string[]): SiteData {
  const parsed = parseSaasPrompt(prompt);
  // The product's own description, without its name in front ("Halo smart water bottle with…" →
  // "Smart water bottle with…"): the name is on screen already, so the subtitle shouldn't repeat it.
  let description = prompt.replace(LEAD_IN, "").replace(/["“”]/g, "").trim();
  if (parsed.brand) {
    const lead = new RegExp(`^(?:meet\\s+|introducing\\s+)?${parsed.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:[:,—–-]\\s*|(?:is|are)\\s+(?:an?\\s+|the\\s+)?)?`, "i");
    const rest = description.replace(lead, "").trim();
    if (rest.split(/\s+/).length >= 2) description = rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  const tagline = parsed.pitch || description.split(/\s+/).slice(0, 6).join(" ");
  return {
    url: "",
    domain: "",
    name: parsed.brand ?? (tagline.split(/\s+/).slice(0, 3).join(" ") || "Your product"),
    tagline,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    headlines: parsed.features.filter((f) => norm(f) !== norm(tagline)),
    features: [],
    stats: [],
    testimonials: [],
    clientLogos: [],
    steps: [],
    pains: [],
    font: null,
    shots: { hero: null, full: null, sections: [] },
    cta: null,
    logo: null,
    icon: null,
    images: photos,
    videos: [],
    themeColor: null,
    kind: "product",
  };
}

/** Built-in rule-based director: prompt → storyboard. Deterministic for a given seed. */
/** Prompt → intro, with a narrator line on every scene (used when voice-over is on). */
export function planFromPrompt(req0: PlanRequest): VideoPlan {
  // A written brief is read whole first (its labels and sentences), before the copy pass below
  // splits the prompt into phrases: its steps and button are made claim-safe like the rest.
  const brief = readBrief(req0.prompt);
  const okLine = (x?: string) => (x && (req0.safe === false || (!isNumericClaim(x) && !isUnsafe(x))) ? (req0.safe === false ? x : safeCopy(x)) || undefined : undefined);
  const req: PlanRequest & { brief?: Brief } = {
    ...req0,
    prompt: brief.core,
    brief: { ...brief, steps: brief.steps.map((x) => okLine(x)).filter((x): x is string => !!x), cta: okLine(brief.cta), tagline: okLine(brief.tagline) },
  };
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
  return withBriefCta(noteShort(safePlan(writeVoiceover(planFromPromptRaw({ ...req, prompt: prompt || req.prompt }))), LENGTH_SECONDS[req.length], false), req.brief?.cta, req.brief?.tagline);
}

/**
 * A trailer ends on the brief's own button words ("Wishlist now"), as a product film's end card
 * does, and its title card (the first one naming the title) carries the brief's tagline.
 */
function withBriefCta(plan: VideoPlan, cta: string | undefined, tagline?: string): VideoPlan {
  if (plan.style === "saas") return plan;
  let scenes = plan.scenes;
  const title = plan.title?.toUpperCase();
  const at = tagline && title && tagline.split(/\s+/).length <= 8 ? scenes.findIndex((s, i) => i < scenes.length - 1 && s.text.replace(/\*/g, "").toUpperCase() === title) : -1;
  if (at >= 0) scenes = scenes.map((s, i) => (i === at ? { ...s, subtext: tagline!.toUpperCase() } : s));
  const last = scenes[scenes.length - 1];
  if (cta && last && last.subtext !== undefined) scenes = [...scenes.slice(0, -1), { ...last, subtext: cta }];
  return scenes === plan.scenes ? plan : { ...plan, scenes };
}

/**
 * A video the material can't stretch to the length asked for (a minute or two from a one-line
 * prompt) stays the length its material makes, unpadded, and says so, once.
 */
function noteShort(plan: VideoPlan, target: number, fromSite: boolean): VideoPlan {
  const total = plan.scenes.reduce((a, sc) => a + sc.duration, 0);
  if (total >= target * 0.85 || plan.notes?.some((n) => /enough material/.test(n))) return plan;
  const cut = Math.round(total);
  const hint = fromSite
    ? "Sites with more feature headlines, steps or testimonials make longer videos."
    : "Describe more in your prompt (features, what makes it different, who it's for) or import the website for a longer cut.";
  return { ...plan, target: cut, notes: [...(plan.notes ?? []), `There's enough material for a ${cut}s video rather than ${target}s, with no padding or invented lines. ${hint}`] };
}

function planFromPromptRaw(req: PlanRequest): VideoPlan {
  // (A story angle asked for is a product story: problem → solution, before → after… aren't trailer cuts.)
  if (req.style === "saas" || (req.style !== "trailer" && (isSaasPrompt(req.prompt) || !!req.angle))) return planFromPromptSaas(req);
  const prompt = req.prompt.trim() || "Epic intro";
  const lower = prompt.toLowerCase();
  // (A remake is another draw: its number moves the seed, so a trailer remake picks other slides.)
  const seed = ((req.seed ?? hashString(prompt)) + Math.max(0, Math.floor(req.variant ?? 0)) * 7919) >>> 0;
  const r = rng(seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];

  // The trailer style you picked, else the one whose keywords the prompt hits most.
  const look = TRAILER_STYLE_MAP[req.trailerStyle ?? ""] ?? detectTrailerStyle(lower, DEFAULT_TRAILER_STYLE);
  const mood = look.mood;
  const brand = extractBrand(prompt);
  const numbers = stats(prompt);
  // Drop phrases that only describe the video's style ("retro 80s synthwave", "hype gaming channel").
  const STYLE =
    /^(hype|hyped|channel|documentary|opener|opening|playful|colorful|colourful|dark|bright|energetic|dramatic|dynamic|bold|sleek|clean|minimal|minimalist|vibrant|glowing|futuristic|aesthetic|themed|theme|looking|style|80s|90s|neon|retro|cyberpunk|synthwave|luxury|premium|gaming|sci-fi|scifi|gold|golden|silver|chrome|toxic|green|red|blue|purple|pink|orange|black|white|energy|vibe|vibes|glow|glitch|gritty|moody|elegant|cinematic|epic|film|movie|trailer|teaser|horror|thriller|comedy|romance|romantic|drama|western|noir|mystery|animated|fantasy|feature|series|indie|blockbuster|psychological|supernatural)$/i;
  const isStyle = (w: string) => STYLE.test(w);
  const styleOnly = (p: string) => {
    const words = p.split(" ");
    return words.filter(isStyle).length * 2 >= words.length;
  };
  const allPhrases = phrases(prompt, brand).filter((p) => !numbers.some((n) => n.includes(p)));
  // "a watch brand called AURUM": the kind of brand describes the request, it isn't a beat.
  const metaOnly = (p: string) => /\b(brand|company|business|channel|startup|label|agency|studio|organi[sz]ation)$/i.test(p) && p.split(" ").length <= 3;
  const content = allPhrases.filter((p) => !styleOnly(p) && !metaOnly(p));
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

  // A film or a series: the movie trailer's own grammar.
  if (look.movie) return movieTrailer({ prompt, look, brand, content: body, year, target, pick, req, seed, styleOnly });
  const lines = GENRE_LINES[look.id] ?? { hooks: HOOKS, beats: ["GET READY", "STAY TUNED", "A NEW CHAPTER", "WATCH THIS SPACE"], outro: OUTRO_SUBS };
  const hookText = /\b(launch|release|drop|coming)/.test(lower) && look.id !== "luxury" && look.id !== "space" ? pick(["THE WAIT IS OVER", ...lines.hooks]) : pick(lines.hooks);
  scenes.push({ skill: pickSkill(mood.hook, null), text: hookText, duration: HOOK, transition: "cut" });

  // The phrase right after the brand usually describes it ("NOVA AI, an AI copilot for…").
  const afterBrand = brand ? phrases(prompt.slice(prompt.indexOf(brand) + brand.length), null).find((p) => !styleOnly(p)) : undefined;
  const title = (brand ?? body.shift() ?? "YOUR BRAND").toUpperCase();
  const tagline = afterBrand ?? body[0];
  body = body.filter((b) => b !== tagline);
  scenes.push({
    skill: pickSkill(mood.title, scenes[0].skill),
    text: title,
    // (Its own capitals kept: "AI copilot for developers", not "ai copilot…".)
    subtext: tagline ? tagline.charAt(0).toUpperCase() + tagline.slice(1) : undefined,
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
  const fillers = lines.beats.filter((x) => x !== hookText);
  while (used + BEAT <= target + 0.5 && fillers.length) {
    const skill = pickSkill(bodyPool, last);
    const text = fillers.splice(Math.floor(r() * fillers.length), 1)[0];
    scenes.push({ skill, text, duration: BEAT, transition: nextTransition(mood.transitions) });
    last = skill;
    used += BEAT;
  }

  // Words alone shouldn't make an all-type film: a body beat becomes an icon slide (two in longer
  // films), its icons drawn from the prompt's own short words, else the category's icon family.
  // (Only wording that names something with an icon of its own, and none of the title's words:
  // otherwise the slide shows the category's icons without labels.)
  const titleWords = new Set(title.toLowerCase().split(/\s+/));
  const iconWords = [...new Set([...content, ...allPhrases].map((p) => p.toLowerCase()))]
    .filter((p) => p.length <= 18 && p.split(/\s+/).length <= 2 && !/\d/.test(p) && !/\b(of|the|for|and|with|to|in|on|a|an|my|our|your)\b/.test(p) && !p.split(/\s+/).some((x) => titleWords.has(x)) && hasSpecificIcon(p))
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .slice(0, 4);
  const beatsAt = scenes.map((s, i) => (i >= 2 && s.skill !== "number-ticker" ? i : -1)).filter((i) => i >= 0);
  const spare = lines.beats.filter((x) => !scenes.some((s) => s.text === x));
  const iconScene = (skill: SkillId, at: number) => {
    const s = scenes[at];
    // A heading worth reading above the icons (a stray fragment like "IN" becomes a trailer line).
    const weak = s.text.replace(/[^A-Za-z]/g, "").length < 5 || s.text.split(/\s+/).length < 2;
    const text = weak && spare.length ? spare.splice(Math.floor(r() * spare.length), 1)[0] : s.text;
    scenes[at] = { ...s, skill, text, items: iconWords.length >= 2 ? iconWords : undefined, duration: Math.max(s.duration, beats(8, 3.2)) };
  };
  if (beatsAt.length) iconScene("icon-reveal", beatsAt[0]);
  else {
    scenes.push({ skill: "icon-reveal", text: pick(lines.beats), items: iconWords.length >= 2 ? iconWords : undefined, duration: beats(8, 3.2), transition: nextTransition(mood.transitions) });
    last = "icon-reveal";
  }
  if (beatsAt.length >= 4) iconScene("icon-ring", beatsAt[beatsAt.length - 1]);
  if (scenes[scenes.length - 1].skill === last) last = scenes[scenes.length - 1].skill;

  scenes.push({
    skill: pickSkill(mood.outro, last),
    text: title,
    subtext: trailerCall(lower, lines, pick, year),
    duration: OUTRO,
    transition: nextTransition(["leak", "dolly", "shutter"]),
  });

  const palette = req.palette && req.palette !== "auto" ? req.palette : mood.palette;
  const concept = detectConcept(prompt).id;
  return beatSync(sanitizePlan({
    title: title,
    palette,
    font: mood.font,
    aspect: req.aspect,
    bpm: mood.bpm,
    seed,
    scenes,
    style: "trailer",
    trailerStyle: look.id,
    // The category (bakery → food, yoga → fitness) picks the icon slides' icons.
    ...(concept !== "general" ? { concept } : {}),
  }));
}

export function brandFromSite(site: SiteData, colors?: Brand["colors"]): Brand {
  return {
    name: site.name,
    domain: site.domain,
    logo: site.logo ? assetUrl(site.logo) : undefined,
    icon: site.icon ? assetUrl(site.icon) : undefined,
    shot: site.shots?.hero ? assetUrl(site.shots.hero) : undefined,
    mobile: site.shots?.mobile ? assetUrl(site.shots.mobile) : undefined,
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
        mobile: isShot(sh.mobile) ? sh.mobile : null,
      };
    })(),
    cta: typeof r.cta === "string" ? r.cta.slice(0, 40) : null,
    logo: http(r.logo) || isShot(r.logo) ? (r.logo as string) : null,
    icon: http(r.icon) || isShot(r.icon) ? (r.icon as string) : null,
    // Uploaded product photos are stored like captures.
    images: (Array.isArray(r.images) ? r.images : []).filter((v) => http(v) || isShot(v)).slice(0, 14) as string[],
    videos: (Array.isArray(r.videos) ? r.videos : []).filter(http).slice(0, 4) as string[],
    themeColor: typeof r.themeColor === "string" && /^#[0-9a-f]{3,8}$/i.test(r.themeColor) ? r.themeColor : null,
    kind: r.kind === "product" ? "product" : undefined,
    marketplace: typeof r.marketplace === "string" ? r.marketplace.slice(0, 60) : undefined,
    partial: r.partial === true ? true : undefined,
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
  /** Trailer films: the trailer style picked (see trailers.ts); otherwise matched to the site. */
  trailerStyle?: string;
  /** Creative angle for the story: problem-led (default), product-first or proof-first. */
  angle?: Angle;
  /** A reassurance the prompt gives ("Cancel anytime"), for under the end card's button. */
  reassure?: string;
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

/**
 * A site's own button text, as the site wrote it: only decoration (arrows, emoji, stray
 * punctuation around it) is trimmed. Null when there's no usable label (empty, or a sentence).
 */
export function cleanCta(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[→›»>←‹«<↗➜➔➝⟶]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:·•|]+|[\s\-–—:·•|.,;]+$/g, "")
    .trim();
  if (!v || v.length > 40 || v.split(" ").length > 7 || !/[a-z]/i.test(v)) return null;
  return v;
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
  // The site's own button, exactly as it says it (an offer in it is confirmed by the maker in the studio).
  const own = cleanCta(site.cta);
  if (own) return own;
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
    // A tool for sellers (a store builder, a checkout) invites them to sell, not to shop.
    ["Start selling", count(/\b(sell (online|anywhere|your products?)|selling online|merchants?|storefronts?|store builder|your (online )?store|helps (brands|businesses|creators) sell|commerce platform)\b/g) * 3],
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

export type Angle = "story" | "problem" | "bab" | "product" | "proof";
export const ANGLES: { id: Angle; name: string; brief: string }[] = [
  { id: "story", name: "Story-led", brief: "Problem → solution: open on the pain, reveal the product as the better way." },
  {
    id: "problem",
    name: "Problem → solution",
    brief:
      "Open on the problems the audience has (the site's own pains, or the problems its services or features take on), cross them out, reveal the product or service as the answer, then pair each problem with the feature or service that solves it.",
  },
  {
    id: "bab",
    name: "Before → after → bridge",
    brief:
      "Before: the audience's problems as they are today, crossed out (or the old way beside the product). After: the outcome, in the site's own promise. Bridge: the product revealed as how to get there, with its how-it-works steps.",
  },
  { id: "product", name: "Product-first", brief: "Open on the promise and get to the product in action within seconds; demo-heavy." },
  { id: "proof", name: "Proof-first", brief: "Lead with social proof (customers, real numbers, a real quote), then show why." },
];
/** Proof-first with no proof: open on the positioning line, then the product doing its job. */
const VALUE_ORDER = ["hook", "features", "bento", "reveal", "demo", "meet", "tour", "how", "cards", "integrations", "cta"];
const ANGLE_ORDER: Record<Angle, string[]> = {
  story: ["pain", "hook", "reveal", "meet", "how", "tour", "features", "bento", "quote", "logos", "cards", "integrations", "cta"],
  problem: ["pain", "agitate", "hook", "reveal", "meet", "how", "tour", "features", "bento", "quote", "logos", "cards", "integrations", "cta"],
  bab: ["pain", "compare", "after", "hook", "reveal", "how", "meet", "tour", "features", "bento", "quote", "logos", "cards", "integrations", "cta"],
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
  const plan = writeVoiceover(
    site.kind === "product"
      ? // A product's trailer is the product video cut in a trailer style (cold open, trailer score).
        planFromProduct(input, req.style === "trailer" && !TEMPLATE_MAP[req.template ?? ""]?.trailer ? { ...req, template: "drop" } : req)
      : req.style === "trailer"
        ? planFromSiteTrailer(input, req)
        : trimToTarget(planFromSiteSaas(input, req)),
  );
  return noteShort(safe ? safePlan(plan) : healthPlan(plan), LENGTH_SECONDS[req.length], true);
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
export function safePlan(plan: VideoPlan, opts: { keepScenes?: boolean } = {}): VideoPlan {
  const name = plan.brand?.name ?? plan.title;
  const neutral = (role?: string) => (role === "hook" ? `Introducing *${name}*` : role === "cta" ? `Try *${name}*` : `See *${name}* in action`);
  // Claims softened, then any offer ("free", "trial", "% off") reworded or left out.
  const clean = (x: string) => offerSafe(safeCopy(x));
  const fix = (x: string | undefined) => (x ? clean(x) || undefined : x);
  const before = plan.scenes.reduce((a, sc) => a + sc.duration, 0);
  const kept = opts.keepScenes ? plan.scenes : plan.scenes.filter((sc, i) => i === 0 || !(CLAIM_ROLES.has(sc.role ?? "") || CLAIM_SKILLS.has(sc.skill)));
  const scenes = kept.map((sc, i) => {
    // Word-swap alternatives are rewritten one by one; claims among them are dropped.
    const text = sc.text.includes("|")
      ? sc.text
          .split("|")
          .map((part, k) => (k === 0 ? clean(part) : isNumericClaim(part) || isUnsafe(part) || isClaimWord(part) ? "" : clean(part)))
          .filter(Boolean)
          .join("|")
      : (isNumericClaim(sc.text) || isUnsafe(sc.text)) && sc.role !== "reveal"
        ? neutral(sc.role)
        : clean(sc.text) || neutral(sc.role);
    const items = sc.items?.filter((it) => !isNumericClaim(it) && !isUnsafe(it) && !isClaimWord(it.split(/\s+[—–-]\s+/)[0])).map((it) => clean(it)).filter(Boolean);
    // The end card's button keeps a label: a plain call to action when its offer goes.
    const isEnd = sc.role === "cta" || i === kept.length - 1;
    const sub = sc.subtext && (isNumericClaim(sc.subtext) || isUnsafe(sc.subtext)) && sc.role !== "cta" ? undefined : fix(sc.subtext);
    return {
      ...sc,
      text,
      subtext: sub ?? (isEnd && sc.subtext && mentionsOffer(sc.subtext) ? "Get started" : undefined),
      eyebrow: sc.eyebrow && isUnsafe(sc.eyebrow) ? undefined : fix(sc.eyebrow),
      // (The QR code's link isn't copy: it stays as it is.)
      items: sc.skill === "qr-end" ? sc.items : items?.length ? items : sc.items?.length ? undefined : sc.items,
      vo: sc.vo && !isNumericClaim(sc.vo) && !isUnsafe(sc.vo) ? fix(sc.vo) : sc.vo ? undefined : sc.vo,
    };
  });
  // (Your own edits: nothing is added, so a narration line you cleared stays cleared.)
  if (opts.keepScenes) return { ...plan, scenes };
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
/** Builders, realtors and agencies selling homes (not software for the property trade). */
const HOME_BIZ = /\b(home ?builders?|house ?builders?|custom homes?|new homes?|new[- ]build|model homes?|floor ?plans?|realty|realtors?|real estate agen(?:ts?|cy|cies)|estate agen(?:ts?|cy|cies)|brokerage|homes? for sale|house hunting|find (?:your|their) (?:next |dream )?home|move-in|communit(?:y|ies))\b/;
const PROPTECH = /\b(apps?|software|platform|saas|dashboards?|crm|api|portal for (?:landlords|agents)|property management (?:app|software|platform))\b/;
function isHomeBusiness(site: SiteData) {
  const t = [site.name, site.tagline, site.description, ...site.headlines.slice(0, 8)].join(" ").toLowerCase();
  return HOME_BIZ.test(t) && !PROPTECH.test(t);
}

const HOME_ROOMS = /\b(room|kitchen|suite|bed(?:room)?s?|bath(?:room)?s?|dining|living|office|den|loft|study|pantry|laundry|garage|porch|patio|foyer|entry|closet|backyard|yard|garden|deck|nook|basement|theaters?|theatres?|cinema|bar|gym|bonus)\b/i;
/** Spaces the second line of rooms shows (bath, family room, basement, game room, theater). */
const MORE_ROOMS = /\b(bath(?:room)?s?|family room|basements?|game ?rooms?|rec(?:reation)? rooms?|theaters?|theatres?|cinema|media rooms?|bonus rooms?|wet bar)\b/i;

/**
 * Re-tell a home business's film as a home's story (in place): hook → brand → room to room → life
 * at home → (a photo of theirs) → the community → the path home → welcome home.
 */
function homeStory(scenes: Scene[], site: SiteData, beats: (n: number) => number, target: number) {
  const hook = scenes.find((sc) => sc.role === "hook");
  const reveal = scenes.find((sc) => sc.role === "reveal");
  const close = scenes[scenes.length - 1];
  // Their own pictures stay (one, after life at home).
  const photo = scenes.find((sc) => sc.media && sc !== hook && sc !== reveal && sc !== close);
  const named = [...site.headlines, ...site.features].map((x) => x.split(/\s+[—–]\s+/)[0].trim()).filter((x) => x.length < 34 && HOME_ROOMS.test(x));
  const rooms = named.filter((x) => !MORE_ROOMS.test(x)).slice(0, 5);
  const more = named.filter((x) => MORE_ROOMS.test(x)).slice(0, 5);
  // The bonus spaces get their own glide when the site talks about them.
  const siteText = [site.tagline, site.description, ...site.headlines, ...site.features].join(" ");
  const bonus = more.length >= 1 || MORE_ROOMS.test(siteText);
  const steps = site.steps.map((x) => x.split(/\s+[—–]\s+/)[0].trim()).filter((x) => x.length < 30).slice(0, 4);
  // The length decides how much of the story fits: room to room always; life at home from 20s;
  // their photo, the community and the path home in longer films.
  const roomy = target >= 30;
  const middle: Scene[] = ([
    { role: "tour", skill: "home-walkthrough", text: "Step *inside*", items: rooms.length >= 2 ? rooms : undefined, duration: beats(18), transition: "dolly", why: "One seamless walk from room to room, so viewers picture living there" },
    ...(bonus && target >= 25 ? [{ role: "tour", skill: "home-rooms", text: "Room for *more*", items: more.length >= 2 ? more : undefined, duration: beats(18), transition: "dolly", why: "The bonus spaces the site talks about: bath, family room, basement game room, home theater" } as Scene] : []),
    { role: "promise", skill: "home-family", text: "Made for *real life*", subtext: "Room to grow, together", duration: beats(10), transition: "dissolve", why: "Life at home: the family and the dog, the feeling the home is for" },
    ...(photo && roomy ? [photo] : []),
    ...(roomy
      ? [
          { role: "reach", skill: "home-aerial", text: "A place to *belong*", duration: beats(10), transition: "dolly", why: "The community around the home" } as Scene,
          { role: "how", skill: "home-journey", text: "Your path *home*", items: steps.length >= 2 ? steps : undefined, duration: beats(10), transition: "whip", why: "How buying works, as a walk up to the front door" } as Scene,
        ]
      : []),
  ] as Scene[]).filter((sc) => target >= 18 || sc.skill !== "home-family");
  const opener = hook ? { ...hook, skill: hook.media ? hook.skill : ("home-hero" as const) } : undefined;
  // A generic button becomes the home business's own next step.
  const generic = /^(get started|learn more|sign up|start (?:free|now|today)|try (?:it|now)|join now|contact us)$/i;
  const button = close?.subtext && !generic.test(close.subtext.trim()) ? close.subtext : "Book a tour";
  const end = close?.role === "cta" && close.skill !== "qr-end" ? { ...close, skill: "home-welcome" as const, subtext: button, why: "The welcome home: the family at the door, and the one action to take" } : close;
  const out = [opener, reveal, ...middle, end].filter((x): x is Scene => !!x);
  scenes.splice(0, scenes.length, ...out);
}

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
  // Section titles that only announce a part of the page (pricing, FAQ, testimonials, the closing
  // banner) are never features: "Simple pricing" pinned to a chart reads as a random label.
  const pageTitle = /\b(pricing|prices|plans?\b(?! (your|the|every|ahead))|questions|faq|frequently asked|testimonials?|what (our )?(customers|users|people) say|loved by|trusted by|our customers|get started|start (your |a )?(free )?trial|sign up|contact( us)?|ready to|join (us|thousands)|blog|news|careers|about us|footer|newsletter)\b/i;
  const allHeads = site.headlines
    .map((title, i) => ({ title, desc: site.features[i] ?? "", score: scoreHeadline(title) - (rewritten?.has(title) ? 1.2 : 0), i }))
    .filter((f, _, all) => !pageTitle.test(f.title) || all.filter((g) => !pageTitle.test(g.title)).length < 2);
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
  const sitePains = (site.pains ?? []).slice(0, 3);

  type Beat = { scene: Scene; priority: number };
  const candidates: Beat[] = [];
  const add = (priority: number, scene: Scene) => candidates.push({ priority, scene });

  // A remake tells the story from another angle (unless one was asked for) and swaps each section's
  // slide for its alternative (alt); remake 0 is the director's best fit.
  const variant = Math.max(0, Math.floor(req.variant ?? 0));
  const alt = variant % 2 === 1;
  const angle: Angle = req.angle ?? (variant ? (["product", "story", "proof"] as Angle[])[(variant - 1) % 3] : "story");
  // Problem → solution: the site's own pains, else the problems its services or features take on,
  // written from them ("Stuck on SEO"), so the film opens on the problem whatever the site says.
  const problemLed = angle === "problem" || angle === "bab";
  // What kind of product this is decides the arc, chapter labels, CTA voice and icons.
  // (From the site as captured: screening a claim out mustn't change what kind of product it is.)
  const whole = ORIGINAL.get(site) ?? site;
  const concept = detectConcept(
    `${whole.name} ${whole.tagline} ${whole.description}`,
    [...whole.headlines, ...whole.features, ...(whole.steps ?? []), ...(whole.pains ?? [])].join(" "),
  );
  // (Written from its own features first; where those are whole phrases, from what a product of
  // its kind typically does, which the director's note asks to check.)
  const ownProblems = problemLed && sitePains.length < 2 ? problemsFrom(shortFeatures) : [];
  const featurePains = !problemLed || sitePains.length >= 2 ? [] : ownProblems.length >= 2 ? ownProblems : problemsFrom([...shortFeatures, ...(concept.starter ?? [])]);
  const serviceWord = SERVICE_BIZ.test([site.tagline, site.description, ...site.headlines.slice(0, 8)].join(" \n ")) ? "services" : "features";
  const pains = featurePains.length >= 2 ? featurePains.map((p) => p.pain) : sitePains;
  const teamStat = site.stats.find((st) => /\d/.test(st) && /team|customer|compan|user|business|developer/i.test(st));
  // Product imagery available to the gallery skills: the site's images and captured UI components.
  const visuals = brand.images.length + (shots.parts ?? []).filter((p) => p.kind !== "button" && p.w * p.h > 120 * 90).length;
  // 1. Hook: the problem, the promise, or the proof.
  // Open on the problem only in categories whose films do (e-commerce / creative lead with the promise).
  const painHook = (problemLed && pains.length >= 2) || (angle === "story" && target >= 20 && pains.length >= 2 && concept.arc.indexOf("pain") < concept.arc.indexOf("reveal"));
  const proofHook = angle === "proof" && !!teamStat;
  // Proof-first with no proof to show (claim-safe, or a site without any) becomes value-first:
  // it opens on the positioning line and leads with the product doing its job.
  const hasProof = !!teamStat || site.testimonials.length > 0 || (brand.clientLogos?.length ?? 0) >= 4 || site.stats.length > 0;
  const valueFirst = angle === "proof" && !hasProof;
  // (Without its own name in front: "Harbor is the AI assistant" → "The AI assistant"; the
  // logo says the name a beat later.)
  const descClause = sentenceCopy(
    site.description
      .split(/\s(?:so|because|that|which|to help)\s|\s[—–]\s/)[0]
      .replace(new RegExp(`^${site.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(?:is|are)\\s+(?=\\S)`, "i"), "")
      .replace(/^./, (c) => c.toUpperCase()),
    // (A hook's length: the old limit of 10 counted the "Name is" this now leaves out.)
    8,
  );
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
  // Call out who it's for in the opener ("For freelancers"): viewers stay when it's about them.
  const audience = audienceOf([site.tagline, site.description, ...site.headlines.slice(0, 2)]);
  const opener = audience ? `For ${audience}` : `Introducing ${site.name}`;
  if (proofHook) {
    add(1, { role: "hook", skill: "blur-reveal", text: `Trusted by *${teamStat.toLowerCase()}*`, eyebrow: opener, duration: beats(7), transition: "cut", why: audience ? `Calls out who it's for: ${audience}` : undefined });
  } else if (painHook) {
    const written = featurePains.length ? ` (written from its ${serviceWord}: edit them to match)` : "";
    // Before → after → bridge with a picture of the product: the old way beside it, on a slider.
    const beforeMedia = angle === "bab" && target >= 20 ? images[0] ?? img(shots.hero) ?? img(shots.sections[0]) : undefined;
    add(1, beforeMedia
      ? { role: "pain", skill: "before-after", text: "Leave the old way *behind*", items: pains, eyebrow: "Before", why: `Before → after → bridge: before, the problems${written}`, duration: beats(10), transition: "cut", media: beforeMedia }
      : {
          role: "pain", skill: "pain-strike",
          text: pick(["There's *another* way.", "It doesn't have to be *this hard*.", "Time for a *new* way."]),
          items: pains,
          eyebrow: angle === "bab" ? "Before" : problemLed ? "The problem" : "The old way",
          why: angle === "bab" ? `Before → after → bridge: before, the problems${written}` : problemLed ? `Problem → agitate → solve (PAS): the ${featurePains.length ? "problems" : "site's own pains"}${written}` : undefined,
          duration: beats(pains.length * 2 + 5),
          transition: "cut",
        });
    // PAS: agitate. A beat on what the problem costs, before the answer arrives (no numbers, no claims).
    if (angle === "problem" && target >= 20)
      add(2, {
        role: "agitate", skill: "blur-reveal",
        text: pick(["Week after week, *it adds up*.", "And it *keeps piling up*.", "Meanwhile, *it adds up*."]),
        eyebrow: "Sound familiar?",
        why: "PAS: agitate the problem for a beat before the solution",
        duration: beats(5),
        transition: "whip",
      });
    // Before → after → bridge: after, the outcome in the site's own promise, before the product.
    if (angle === "bab")
      add(1, {
        role: "after", skill: "blur-reveal",
        text: tagline,
        eyebrow: "After",
        why: "Before → after → bridge: after, the outcome (the site's own promise); the product is the bridge",
        duration: beats(6),
        transition: "whip",
      });
  } else if (valueFirst && valueHook) {
    add(1, { role: "hook", skill: "blur-reveal", text: valueHook, eyebrow: opener, duration: beats(7), transition: "cut", why: audience ? `Calls out who it's for: ${audience}` : undefined });
  } else {
    // Story-led films with plenty of product imagery open on the whole product: a tilted wall of
    // its screenshots drifting behind the promise (Linear / Vercel hero look).
    wall = angle === "story" && !productHook && target >= 20 && visuals >= 4 && !alt;
    const hookText = productHook || openHook?.text || tagline;
    const hookWhy = [openHook?.why, wall ? `${visuals} product images and UI components: a wall of the product behind it` : ""].filter(Boolean).join("; ");
    add(1, { role: "hook", skill: wall ? "tilt-wall" : "blur-reveal", text: hookText, eyebrow: wall ? undefined : opener, duration: beats(wall ? 9 : 7), transition: "cut", why: [hookWhy, audience && !wall ? `calls out who it's for (${audience})` : ""].filter(Boolean).join("; ") || undefined });
  }
  // 2. Reveal.
  // Product-first with real product footage: the name as giant type filled with the product,
  // diving through a letter into it (Runway-style). Otherwise the logo reveal.
  const revealMedia = angle === "product" && target >= 20 ? (video ?? images[0] ?? img(shots.hero)) : undefined;
  add(1, revealMedia && site.name.length <= 14
    ? { role: "reveal", skill: "type-mask", text: site.name, subtext: taglineFree && angle !== "bab" ? tagline : undefined, duration: beats(9), transition: "dolly", media: revealMedia }
    : {
        // Remakes cycle through the 3D logo intros; the first take keeps the style's own reveal.
        role: "reveal", skill: brand.logo ? (variant ? LOGO_3D[(variant - 1) % LOGO_3D.length] : "logo-reveal") : "particle-assemble",
        text: site.name,
        subtext: taglineFree && angle !== "bab" ? tagline : site.domain,
        duration: beats(6),
        transition: "dolly",
      });
  // 3. Meet: the real product, rebuilt from its own UI components (or the page scrolling by).
  if (shots.hero || shots.full) {
    const assemble = !!shots.hero && !(alt && shots.full);
    add(!(video ?? images[0] ?? shots.sections[0] ?? shots.hero) && target >= 20 ? 2 : assemble && target >= 20 ? 2 : 3, {
      role: "meet", skill: assemble ? "ui-assemble" : "site-scroll",
      text: taglineFree && angle !== "bab" && !(valueHook && descClause && norm(valueHook) !== norm(descClause)) ? tagline : descClause || `Say hello to *${site.name}*`,
      eyebrow: `Meet ${site.name}`,
      duration: Math.max(5, beats(10)),
      transition: "whip",
      media: img(assemble ? shots.hero : shots.full),
    });
  }
  // 4. How it works.
  if (site.steps && site.steps.length >= 2) {
    // (Before → after → bridge: the steps are the bridge, so they're kept.)
    add(angle === "bab" ? 2 : target >= 30 ? 3 : 5, {
      // AI and creative tools show their steps as a node workflow (ComfyUI-style).
      // (Or any product whose steps read as a pipeline: connect, trigger, transform, publish.)
      // Every third remake with short steps rides them on a big 3D arrow.
      // Otherwise remakes rotate through the process layouts: the numbered line, business-process
      // arrows, a staircase and (3+ steps) a cycle; service businesses lead with the process arrows.
      role: "how", skill: variant % 3 === 2 && site.steps.slice(0, 4).every((x) => x.split(/\s+/).length <= 3) ? "arrow-rise" : site.steps.length >= 3 && alt !== (concept.id === "ai" || concept.id === "creative" || /\b(workflows?|pipelines?|automat\w*|nodes?|connect\w*|triggers?|integrat\w*)\b/i.test(site.steps.join(" "))) ? "node-graph" : howLayout(variant, site.steps.length, SERVICE_BIZ.test([site.tagline, site.description, ...site.headlines.slice(0, 8)].join(" \n "))),
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
    // Remakes stage the product's screen in other launch-film ways: a spotlight on its parts, the
    // product across devices, or its layers pulled apart.
    // (Labels are the tour's own callouts, else the next features; too few and the tour stays a tour.)
    const pointed = (tourCallouts.length >= 2 ? tourCallouts : otherTitles).filter((f) => f && f.split(/\s+/).length <= 5).slice(0, 3);
    const pick = (["ui-tour", "spotlight", "device-trio", "exploded-ui"] as const)[variant % 4];
    const tourKind = sectionTour ? "site-scroll" : (pick === "spotlight" || pick === "exploded-ui") && pointed.length < 2 ? "ui-tour" : pick;
    add(angle === "product" ? 1 : target >= 20 ? 2 : 4, {
      role: "tour", skill: tourKind,
      text: tourHead,
      items: tourKind === "ui-tour" ? tourCallouts : tourKind === "spotlight" || tourKind === "exploded-ui" ? (pointed.length >= 2 ? pointed : undefined) : undefined,
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
  // Remakes rotate through the other feature layouts the material allows. A service business
  // (an agency, studio or consultancy) shows its offer as a services list first.
  const serviceBiz = SERVICE_BIZ.test([whole.tagline, whole.description, ...whole.headlines.slice(0, 8)].join(" \n "));
  const featureKinds = [
    ...(serviceBiz && featureItems.length >= 2 ? ["services"] : []),
    ...(target >= 30 && withBenefit.length >= 3 && visuals >= 2 ? ["slides"] : []),
    ...(featureItems.length >= 5 ? ["bento"] : []),
    ...(featureItems.length >= 2 ? ["icons"] : []),
    ...(featureItems.length === 3 || featureItems.length === 4 ? ["bento"] : []),
    // Editorial system layouts: a showreel of the features, or the card system.
    ...(featureItems.length >= 3 ? ["reel", "system", "stack", "sheet", "contact", "widgets", ...(serviceBiz ? [] : ["services"])] : []),
  ];
  // (Service businesses show their services on every other take.)
  const featureKind = serviceBiz && featureItems.length >= 2 && variant % 2 === 0 ? "services" : featureKinds.length ? featureKinds[variant % featureKinds.length] : null;
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
      eyebrow: "Overview",
      duration: Math.max(4.4, beats(10)),
      transition: "dolly",
    });
  } else if (featureKind === "reel") {
    const reel = featureItems.slice(0, 5);
    add(valuePriority, {
      role: "features", skill: "showreel",
      text: concept.featuresTitle,
      items: reel,
      eyebrow: "Features",
      duration: Math.max(5.2, 1.7 + reel.length * 1.15, beats(12)),
      transition: "dolly",
    });
  } else if (featureKind === "system") {
    add(valuePriority, {
      role: "bento", skill: "card-system",
      text: `Inside *${site.name}*`,
      items: featureItems.slice(0, 4),
      eyebrow: "Overview",
      duration: Math.max(5, beats(12)),
      transition: "dolly",
    });
  } else if (featureKind === "stack" || featureKind === "contact") {
    const set = featureItems.slice(0, featureKind === "stack" ? 5 : 6);
    add(valuePriority, {
      role: "features", skill: featureKind === "stack" ? "card-stack" : "contact-sheet",
      text: concept.featuresTitle,
      items: set,
      eyebrow: "Features",
      duration: Math.max(5.2, (featureKind === "stack" ? 1.8 : 2.4) + set.length * 1.1, beats(12)),
      transition: "dolly",
    });
  } else if (featureKind === "sheet" || featureKind === "widgets") {
    // The spec sheet reads best with each feature's one-line detail.
    const rows = featureKind === "sheet" && withBenefit.length >= 3 ? withBenefit.slice(0, 5) : featureItems.slice(0, featureKind === "sheet" ? 5 : 4);
    add(valuePriority, {
      role: "bento", skill: featureKind === "sheet" ? "spec-sheet" : "widget-set",
      text: `Inside *${site.name}*`,
      items: rows,
      eyebrow: "Overview",
      duration: Math.max(5, beats(12)),
      transition: "dolly",
    });
  } else if (featureKind === "services") {
    // A big icon for the current service beside the list ("Service — what it is" where the site
    // says); remakes stage the services ten ways (orbit, cube, carousel, bloom, honeycomb, card fan,
    // bento, split-flap board, spotlight).
    const offer = (withBenefit.length >= 2 ? withBenefit : featureItems).slice(0, 5);
    const kinds = ["services", "service-orbit", "service-cube", "service-carousel", "service-bloom", "service-hex", "service-fan", "service-bento", "service-board", "service-spotlight"] as const;
    const serviceSkill = kinds[Math.floor(variant / 2) % kinds.length];
    // (An orbit, a flower and a bento want three services or more; a spotlight's stage fits five.)
    const fits = !((serviceSkill === "service-orbit" || serviceSkill === "service-bloom" || serviceSkill === "service-bento") && offer.length < 3) && !(serviceSkill === "service-spotlight" && offer.length > 5);
    add(valuePriority, {
      role: "features", skill: fits ? serviceSkill : "services",
      text: serviceBiz ? "What we *do*" : `Inside *${site.name}*`,
      items: offer,
      eyebrow: serviceBiz ? "Services" : "Features",
      why: serviceBiz ? "The site offers services (an agency, studio or consultancy)" : undefined,
      duration: Math.max(5, beats(offer.length * 2.4 + 4)),
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
  // A minute and a half or more: the features the first feature slide had no room for.
  if (target >= 90) {
    const shownNow = new Set(featureItems.slice(0, 4).map((it) => norm(it.split(/\s+[—–]\s+/)[0])));
    const rest = bentoItems.filter((it) => !shownNow.has(norm(it.split(/\s+[—–]\s+/)[0]))).slice(0, 4);
    if (rest.length >= 3)
      add(6, {
        role: "more", skill: "icon-features",
        text: `More in *${site.name}*`,
        items: rest,
        eyebrow: "Features",
        why: "A longer video: the features the first feature slide had no room for",
        duration: Math.max(4.6, beats(rest.length * 1.5 + 6)),
        transition: "dolly",
      });
  }
  // 5b. The signature interaction moment: the product *doing* something (a command palette,
  // a streamed AI answer, a one-click cascade, live notifications), chosen for the category.
  // Products that lead with AI get the AI moment whatever their category.
  const aiLed = concept.id !== "ai" && [site.tagline, ...site.headlines.slice(0, 4)].some((x) => /\b(ai|assistant|copilot|gpt)\b/i.test(x ?? ""));
  const shownTitles = new Set([...(featureSlides ? withBenefit.slice(0, 3) : featureItems.slice(0, featureKind === "bento" ? 6 : featureKind === "reel" || featureKind === "stack" || featureKind === "sheet" ? 5 : featureKind === "contact" ? 6 : 4)), ...(tourMedia ? [tourHead, ...tourCallouts] : [])].map((x) => norm(x.split(/\s+[—–]\s+/)[0])));
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
  // The moment is filled from the product's own features and steps (ones the film hasn't shown
  // first); the category's stock copy only when it names too few (see momentitems.ts).
  const spareSet = new Set(spareFeatures.map(norm));
  const ownFeatures = [...bentoItems.filter((it) => spareSet.has(norm(it.split(/\s+[—–]\s+/)[0]))), ...bentoItems.filter((it) => !spareSet.has(norm(it.split(/\s+[—–]\s+/)[0])))];
  const own = fit.spec.skill === "ai-prompt" ? null : ownMoment(fit.spec.skill, { name: site.name, features: ownFeatures, steps: site.steps ?? [] }, fit.spec);
  const demo = own ? { ...fit.spec, title: own.title ?? fit.spec.title, action: own.action ?? fit.spec.action, items: own.items } : fit.spec;
  const demoWhy =
    (fit.because.length ? `Best fit: the site talks about ${fit.because.slice(0, 3).join(", ")}` : `Typical of ${concept.name.toLowerCase()} launch videos`) +
    (own ? "; filled from its own features" : "");
  let demoScene: Scene | null = null;
  if (demo.skill === "command-k") {
    // With too few features of its own, the command that runs is a real feature and the rest are
    // the palette's everyday commands.
    const lead = spareFeatures[0];
    demoScene = { role: "demo", skill: "command-k", text: demo.title, items: own ? demo.items : lead ? [lead, ...demo.items].slice(0, 4) : demo.items, eyebrow: demo.eyebrow, duration: beats(10), transition: "whip" };
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
      // (Without a real name, the placeholder isn't asked about by name.)
      items: [site.name === "Your product" ? "What can you do?" : (said.firstPerson ? demo.items[0] : "Tell me about {name}").replace(/\{name\}/g, site.name), ...(points.length >= 2 ? points : spareFeatures.slice(0, 3))],
      eyebrow: demo.eyebrow, duration: beats(12), transition: "whip",
    };
  } else if (demo.skill === "code-deploy") {
    demoScene = { role: "demo", skill: "code-deploy", text: demo.title, items: demo.items, eyebrow: demo.eyebrow, duration: beats(12), transition: "whip" };
  } else if (demo.skill === "kanban" || demo.skill === "live-cursors" || demo.skill === "click-flow" || demo.skill === "phone-tour" || demo.skill === "drop-zone") {
    // (A phone tour's stock "Your work" takes the product's own noun: "Your goals, in your pocket".)
    const own = concept.swap?.split(",")[0]?.trim();
    const title = demo.skill === "phone-tour" && own && /^Your work,/.test(demo.title) ? demo.title.replace(/^Your work/, own) : demo.title;
    demoScene = { role: "demo", skill: demo.skill, text: title, subtext: demo.action, items: demo.items, eyebrow: demo.eyebrow, duration: beats(demo.skill === "kanban" ? 12 : demo.skill === "phone-tour" ? 11 : 10), transition: "whip" };
  } else if (demo.skill === "chat-thread") {
    demoScene = { role: "demo", skill: "chat-thread", text: demo.title, subtext: demo.action, items: demo.items, eyebrow: demo.eyebrow, duration: beats(11), transition: "whip" };
  } else if (demo.skill === "comment-pins") {
    // Comments land on the product's own screen.
    demoScene = { role: "demo", skill: "comment-pins", text: demo.title, items: demo.items, eyebrow: demo.eyebrow, duration: beats(11), transition: "whip", media: tourMedia ?? undefined };
  } else if (demo.skill === "toggle-list" || demo.skill === "changelog" || demo.skill === "keycaps" || demo.skill === "calendar-drop" || demo.skill === "inbox-sweep" || demo.skill === "table-fill") {
    demoScene = { role: "demo", skill: demo.skill, text: demo.title, items: demo.items, eyebrow: demo.eyebrow, duration: beats(11), transition: "whip" };
  } else {
    demoScene = { role: "demo", skill: "notify-stack", text: demo.title, items: demo.items, eyebrow: demo.eyebrow, duration: beats(demo.items.length * 1.2 + 5), transition: "whip" };
  }
  // A product-first or media-less film leans on it; teasers keep it only when it is the product.
  // (When the film already shows the real product — a tour or the assembled page — it's optional.)
  const productShown = !!tourMedia || !!shots.hero;
  if (demoScene) demoScene.why = demoWhy;
  // Longer videos (a minute and up) show the product at work in more ways: the next moments that
  // suit it (one per extra half-minute), each filled from its own features, never stock copy.
  if (target >= 60) {
    const extra = Math.round((target - 34) / 28);
    const usedMoments = new Set<string>([demo.skill]);
    for (const m of moments) {
      if (usedMoments.size > extra) break;
      const sk = m.spec.skill;
      if (usedMoments.has(sk) || m.score <= 0 || sk === "ai-prompt") continue;
      const more = ownMoment(sk, { name: site.name, features: ownFeatures, steps: site.steps ?? [] }, m.spec);
      if (!more) continue;
      usedMoments.add(sk);
      add(4 + usedMoments.size, {
        // (Numbered, so the extra moments spread through the video rather than play back to back.)
        role: `showcase${usedMoments.size - 1}`, skill: sk,
        text: more.title ?? m.spec.title,
        subtext: more.action ?? m.spec.action,
        items: more.items,
        eyebrow: m.spec.eyebrow,
        why: `A longer video: another moment that suits it${m.because.length ? ` (the site talks about ${m.because.slice(0, 2).join(", ")})` : ""}, from its own features`,
        duration: beats(11),
        transition: "whip",
        media: sk === "comment-pins" ? tourMedia ?? undefined : undefined,
      });
    }
  }
  add(valueFirst && target >= 20 ? 2 : target < 20 ? (angle === "product" && !productShown ? 3 : 6) : !productShown ? 2 : target >= 30 ? 3 : 4, demoScene);
  // 5c. Gallery: the product's own images and UI components, animated (GPU transitions, or a 3D
  // carousel for visual products).
  if (target >= 20 && visuals >= 3) {
    // Visual products (stores, templates, creative work) turn on a 3D carousel; product UI flows
    // through the framed gallery.
    const carousel = (concept.id === "creative" || concept.id === "ecommerce") !== alt;
    // Image-led products show their photos as cards; remakes rotate through the card layouts.
    const photoLed = concept.id === "creative" || concept.id === "ecommerce" || images.length >= 4;
    const cardKinds = ["carousel-3d", "photo-fan", "card-spread", "photo-drop"] as const;
    add(target >= 30 ? (wall ? 4.5 : 3) : 5, {
      role: "gallery",
      skill: carousel ? (photoLed ? cardKinds[variant % cardKinds.length] : "carousel-3d") : "gallery-flow",
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
    const reachEvents = [...new Set(shortFeatures.filter((f) => f.split(/\s+/).length <= 3))].slice(0, 4);
    const n = own.split(/\s+/).length;
    // A flat map when the site talks about places (countries, regions, currencies, languages);
    // the turning globe when it talks about a global network or reach.
    const flatMap = MAP_WORDS.test([whole.tagline, whole.description, ...whole.headlines, ...whole.features].join(" ")) !== alt;
    add(target >= 30 ? 4 : 6, {
      role: "reach", skill: flatMap ? "world-map" : "globe",
      text: own && !/\d/.test(own) && n >= 3 && n <= 8 ? own : REACH[concept.id]?.title ?? REACH.general.title,
      // The live events are the product's own short features; the category's generic ones otherwise.
      items: reachEvents.length >= 3 ? reachEvents : (REACH[concept.id] ?? REACH.general).items,
      eyebrow: "Global",
      why: flatMap ? "The site talks about countries, regions or currencies" : "The site talks about global use",
      duration: beats(11),
      transition: "dolly",
    });
  }
  // 5e. The site's own pains, when the film doesn't open on them: each answered by the feature that
  // solves it (when they line up), else the old way next to the product on a before/after slider.
  const compareMedia = images[0] ?? img(shots.hero) ?? img(shots.sections[0]);
  // (Problem → solution films answer each problem they opened on; written problems answer with
  // the feature or service each was written from, in the site's words where it has a line on it.)
  const pairs = featurePains.length >= 2
    ? featurePains.map((p) => ({ pain: p.pain, fix: solutionLine(p.feature, [...bentoItems, ...site.features, ...site.headlines]), score: 1 }))
    : (target >= 20 || problemLed) && pains.length >= 2 && (!painHook || problemLed) ? pairPains(pains, [...spareFeatures, ...shortFeatures]) : [];
  const matched = pairs.filter((p) => p.score > 0).length;
  if (angle !== "bab" && pairs.length >= 2 && (problemLed || (matched >= 2) !== (alt && !!compareMedia) || !compareMedia)) {
    add(problemLed ? (target >= 20 ? 2 : 3) : target >= 30 ? 4 : 6, {
      role: "solve", skill: "problem-solution",
      text: problemLed ? `How *${site.name === "Your product" ? "it" : site.name}* solves it` : "From problem to *solution*",
      items: pairs.slice(0, 3).map((p) => `${p.pain} → ${p.fix}`),
      eyebrow: "Problem → solution",
      why: featurePains.length >= 2 ? `Each problem answered by the ${serviceWord === "services" ? "service" : "feature"} it was written from` : matched >= 2 ? "The site's pains line up with its features" : "The site names the problems it solves",
      duration: beats(Math.min(3, pairs.length) * 2.5 + 4),
      transition: "whip",
    });
  } else if (target >= 20 && pains.length >= 2 && !painHook && compareMedia && angle !== "bab") {
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
  // 5e'. A contrast the site or prompt states itself (and no problem slide already shows it): the
  // old way against the new, side by side, the new way in inverse colours (see contrast.ts).
  const statedContrast = site.contrast ?? contrastPairOf([whole.tagline, whole.description, ...whole.headlines].join(". "), shortFeatures[0]);
  if (statedContrast && !candidates.some((c) => c.scene.role === "pain" || c.scene.role === "solve" || c.scene.role === "compare")) {
    // (One the prompt asks for in its own words is kept even in a short video.)
    add(site.contrast ? 2 : target >= 30 ? 5 : 7, {
      role: "compare", skill: "contrast-split",
      text: "Before and *after*",
      items: statedContrast,
      eyebrow: "The switch",
      why: `The ${site.contrast ? "prompt" : "site"} sets the old way against the new ("${statedContrast[0]}" → "${statedContrast[1]}")`,
      duration: beats(9),
      transition: "cut",
    });
  }
  // 5f. Support: when the site talks about help, docs or onboarding (and the demo isn't already a
  // support chat).
  const helpTopics = [...new Set(shortFeatures.filter((f) => f.split(/\s+/).length <= 4))];
  const lowerFirst = (x: string) => (/^[A-Z][a-z]/.test(x) ? x[0].toLowerCase() + x.slice(1) : x);
  if (target >= 20 && SUPPORT.test([whole.tagline, whole.description, ...whole.headlines, ...whole.features].join(" ")) && demo.skill !== "chat-thread") {
    add(target >= 30 ? 5 : 7, {
      role: "support", skill: "support",
      text: "Support, *built in*",
      // The help articles and the question are about the product's own features where it names them.
      subtext: helpTopics.length >= 2 ? `How do I use ${lowerFirst(helpTopics[0])}?` : "How do I invite my team?",
      items: helpTopics.length >= 2 ? [`Getting started with ${site.name}`, ...helpTopics.slice(0, 3).map((f) => `Using ${lowerFirst(f)}`)] : [`Getting started with ${site.name}`, "Invite your team", "Connect your tools", "Manage your account"],
      eyebrow: "Support",
      why: "The site talks about support, docs or onboarding",
      duration: beats(12),
      transition: "dolly",
    });
  }

  // 5g. Who it's for: when the site names two or more of the people it's for (designers and
  // developers, founders and agencies), the audience chips with what each one gets.
  const audiences = audiencesOf([whole.tagline, whole.description, ...whole.headlines, ...whole.features].join(" \n "));
  if (target >= 20 && audiences.length >= 2) {
    add(target >= 30 ? 5 : 7, {
      role: "audience", skill: "persona-switch",
      text: "Built for *your team*",
      items: audiences,
      eyebrow: "Who it's for",
      why: `The site names who it's for: ${audiences.map((a) => a.split(" — ")[0].toLowerCase()).join(", ")}`,
      duration: beats(Math.min(4, audiences.length) * 2.5 + 3),
      transition: "dolly",
    });
  }

  // 6. Proof — only real quotes, logos and numbers.
  // Positioning line in the category's voice ("Ship faster|safer|together"): a rhythm change
  // between the reveal and the product that needs no media and makes no claims.
  // Remakes set the same line as an editorial type moment: bands of kinetic type, or a poster.
  // Fast type joins the rotation: words switching on the half-beat before the line lands.
  const promiseKind = (["word-swap", "type-rows", "type-poster", "type-echo", "poster-split", "type-slots", "poster-grid", "rapid-fire", "flip-switch", "zoom-through", "slice-switch", "style-shuffle", "split-flap", "whip-pan", "stack-stomp", "speed-ticker", "cube-spin", "speed-type", "bar-wipe", "crash-zoom", "word-grid", "orbit-text", "tape-rush", "jump-cut", "letter-rush", "stamp-rush", "rally", "spiral-in", "speed-gauge", "domino", "slipstream", "stretch-snap", "rack-focus"] as const)[variant % 33];
  const [swapLead, swapWords = ""] = concept.swap.split(/,\s*(?=[^,]*$)/);
  const swapList = swapWords.split("|").filter(Boolean);
  const promiseLine = swapList.length ? `${swapLead}, *${swapList[swapList.length - 1]}*` : concept.swap;
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const snappy = shortFeatures.filter((f) => f.length <= 18 && f.split(/\s+/).length <= 2);
  add(target >= 20 && !tourMedia && !shots.full && !valueFirst ? 3 : 6, promiseKind === "word-swap"
    ? {
        role: "promise", skill: "word-swap",
        text: concept.swap,
        subtext: sentenceCopy(site.description, 12) || undefined,
        eyebrow: `Why ${site.name}`,
        duration: beats(8),
        transition: "whip",
      }
    : {
        role: "promise", skill: promiseKind,
        text: promiseLine,
        items:
          promiseKind === "type-echo" || promiseKind === "style-shuffle" || promiseKind === "stack-stomp"
            ? undefined
            : promiseKind === "flip-switch" || promiseKind === "speed-type"
              ? swapList.length >= 3 ? swapList.slice(0, -1).map(cap) : shortFeatures.slice(0, 4)
              : promiseKind === "split-flap"
                ? snappy.filter((f) => f.length <= 12).slice(0, 2)
                : ["rapid-fire", "zoom-through", "slice-switch", "whip-pan", "speed-ticker", "cube-spin", "bar-wipe", "crash-zoom", "word-grid", "orbit-text", "tape-rush", "jump-cut", "letter-rush", "stamp-rush", "rally", "spiral-in", "speed-gauge", "domino", "slipstream", "stretch-snap", "rack-focus"].includes(promiseKind)
                  ? // Fast type switches words every half-beat, so only short ones (else the category's swap words).
                    snappy.length >= 3 ? snappy.slice(0, 5) : swapList.length >= 2 ? swapList.map(cap) : snappy
                  : promiseKind === "type-rows" || promiseKind === "type-slots"
                    ? shortFeatures.length >= 3 ? shortFeatures.slice(0, 5) : swapList.map(cap)
                    : shortFeatures.slice(0, 3),
        subtext: promiseKind === "poster-split" ? sentenceCopy(site.description, 10) || undefined : undefined,
        eyebrow: `Why ${site.name}`,
        duration: Math.max(4.6, beats(9)),
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
      items: [`${site.name} update: systems go`, site.stats[0], "This week", "Your team"],
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
  const reassurance = reassuranceOf([site.cta ?? "", site.tagline, site.description, ...site.headlines, ...site.features]) || req.reassure || "";
  add(1, {
    role: "cta", skill: qr ? "qr-end" : "cta",
    text: `Try *${site.name}* today`,
    subtext: qr ? `Scan to ${lowerFirst(ctaLabel)}` : ctaLabel,
    // Risk reversal, only in the site's own words ("Cancel anytime"): it lowers the bar to click.
    items: !qr && reassurance ? [reassurance] : undefined,
    why: !qr && reassurance ? `One clear action, with the site's own reassurance under it ("${reassurance}")` : undefined,
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
    // A longer video's extra moments follow the features (spread out, not back to back with the demo).
    if (role?.startsWith("showcase")) {
      // The first after the features, the next after the proof, a third just before the close.
      const n = Number(role.slice(8)) || 1;
      const after = n === 1 ? ["features", "bento", "tour"] : n === 2 ? ["cards", "quote", "how"] : ["integrations", "logos"];
      return (after.map((r) => rank.indexOf(r)).find((i) => i >= 0) ?? rank.indexOf("cta") - 1) + 0.55;
    }
    if (role === "more") return (["features", "bento", "tour"].map((r) => rank.indexOf(r)).find((i) => i >= 0) ?? rank.length - 2) + 0.7;
    // Who it's for follows the product's first appearance (after the reveal's positioning line).
    if (role === "audience") return (rank.indexOf("meet") >= 0 ? rank.indexOf("meet") : rank.indexOf("reveal")) + 0.7;
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
  // Two product moments never play back to back: the next other beat (not the close) goes between.
  for (let i = 1; i < scenes.length - 1; i++) {
    if (!(DEMO_SKILLS.has(scenes[i].skill) && DEMO_SKILLS.has(scenes[i - 1].skill))) continue;
    const j = scenes.findIndex((sc, k) => k > i && k < scenes.length - 1 && !DEMO_SKILLS.has(sc.skill));
    if (j > i) scenes.splice(i, 0, scenes.splice(j, 1)[0]);
    // (With nothing else to put between them, the extra moment is left out.)
    else scenes.splice(i--, 1);
  }
  // Product-first is a cold open: the first product beat plays before the logo.
  if (angle === "product") {
    const r = scenes.findIndex((sc) => sc.role === "reveal");
    const first = scenes.findIndex((sc) => sc.role === "meet" || sc.role === "tour");
    // (Without a screen to show, the product moment opens cold instead.)
    const cold = first >= 0 ? first : scenes.findIndex((sc) => sc.role === "demo");
    if (r > 0 && cold > r) scenes.splice(r, 0, { ...scenes.splice(cold, 1)[0], why: "Product-first: the product at work before the logo (a cold open)" });
  }
  // Transitions follow the new order: the opener cuts in.
  if (scenes[0]) scenes[0] = { ...scenes[0], transition: "cut" };
  // Closing line: social proof when the film hasn't used it yet, else a varied call to action.
  const cta = scenes[scenes.length - 1];
  const usedStat = scenes.some((sc) => sc.role === "logos" || (sc.role === "metric" && sc.subtext === teamStat)) || (angle === "proof" && !!teamStat);
  // Chapter labels in the category's own voice.
  for (const sc of scenes) {
    const eb = concept.eyebrows[sc.role as keyof typeof concept.eyebrows];
    if (eb && sc.role !== "reveal" && sc.role !== "cta" && !((sc.skill === "services" || sc.skill.startsWith("service-")) && sc.eyebrow === "Services")) sc.eyebrow = eb;
  }
  // "Free" is an offer, and an offer must be real: only when the site itself offers something free.
  const freeOffer = offersFree([site.cta ?? "", site.tagline, site.description, ...site.headlines, ...site.features].join(" "));
  // (With a button of its own, "Get in touch", the line doesn't name another action, "Book a demo".)
  const ownButton = cleanCta(site.cta);
  const ACTION = /\b(demo|trial|download|account|install|sign up|subscribe|selling|shopping|building|shipping|creating|training|store|order|book)\b/i;
  const otherAction = (l: string) => {
    const m = ownButton ? l.match(ACTION) : null;
    return !!m && !ownButton!.toLowerCase().includes(m[1].toLowerCase());
  };
  const lines = concept.cta.filter((l) => (freeOffer || !/\bfree\b/i.test(l)) && !otherAction(l)).map((l) => l.replace(/\{name\}/g, site.name));
  if (freeOffer && /\bfree\b/i.test(ctaLabel)) lines.push("Start *free* today");
  if (cta?.role === "cta") {
    // The closing line mustn't just repeat the button under it ("Start free" / "Start free trial").
    const button = norm(ctaLabel);
    const fresh = lines.filter((l) => {
      const n = norm(l);
      // (Nor open on the button's own verb: "Book now" over "Book a walk".)
      return !button || !(button.startsWith(n) || n.startsWith(button) || n.split(" ").filter((wd) => button.includes(wd)).length >= 2 || n.split(" ")[0] === button.split(" ")[0]);
    });
    cta.text = teamStat && !usedStat ? `Join *${teamStat.toLowerCase()}*` : pick(fresh.length ? fresh : lines);
    // Nothing to try yet: the line matches the waitlist button.
    if (/waitlist/i.test(ctaLabel)) cta.text = `Be first to try *${site.name}*`;
  }

  // A home business (a builder, a realtor, an agency; not property software) tells a home's story
  // rather than an app's: the home at golden hour, the brand, one seamless walk from room to room,
  // the family's life there, the community, the path home, and the welcome home with the button.
  const home = concept.id === "realestate" && isHomeBusiness(site);
  if (home) homeStory(scenes, site, beats, target);

  // Thin material (a one-line prompt, a sparse page) makes a tight shorter cut rather than
  // padding with invented beats, and the director says what would unlock the full length.
  const plan = sanitizePlan({ title: site.name, palette: "cosmos", font: "inter", aspect: req.aspect, bpm, seed, scenes, brand, style: "saas", concept: concept.id, target, ...(home ? { setting: "house" as const } : { software: softwareKind(concept.id, [site.name, site.tagline, site.description, ...site.headlines, ...site.features].join(" ")) }) });
  const styled = applyTemplate(plan, req.template ?? DEFAULT_TEMPLATE, {
    palette: req.palette && req.palette !== "auto" ? req.palette : undefined,
  });
  const total = styled.scenes.reduce((a, sc) => a + sc.duration, 0);
  if (valueFirst && req.angle === "proof")
    styled.notes = [
      ...(styled.notes ?? []),
      "Proof-first needs real proof to lead with (a testimonial, customer logos or a real number), and this has none, so it leads with the benefits instead.",
    ];
  if (problemLed && !painHook)
    styled.notes = [
      ...(styled.notes ?? []),
      `${angle === "bab" ? "Before → after → bridge" : "Problem → solution"} needs two or more problems to open on: name them in your prompt (\"for teams tired of X and Y\"), or list two or more features or services.`,
    ];
  if (total < target * 0.9) {
    const cut = Math.round(total);
    styled.target = cut;
    styled.notes = [
      ...(styled.notes ?? []),
      `There's enough material for a tight ${cut}s video rather than ${target}s, with no padding or invented lines. ` +
        (site.url
          ? "Sites with more feature headlines, steps or testimonials make longer videos."
          : "List a few features in your prompt (e.g. “with X, Y and Z”) or import the website for the full cut."),
    ];
  }
  return remix(styled, variant);
}


/**
 * A feature title short enough for a callout chip: up to the first connector ("Premium sound
 * quality with deep bass" → "Premium sound quality"), at most four words, and Title Case turned
 * into sentence case, keeping model codes, acronyms and names the listing capitalises mid-sentence
 * ("IPX5 water resistant", "Works with Alexa").
 */
export function calloutTitle(raw: string, prose = ""): string {
  // ("A temperature display" → "Temperature display": a callout is a label, not a sentence.)
  const words = raw.replace(/[.!:;,]+$/, "").trim().replace(/^(?:an?|the)\s+(?=\S+\s)/i, "").split(/\s+/).filter(Boolean);
  const join = words.findIndex((w, i) => i >= 2 && /^(with|and|for|that|to|in|on|so|from)$/i.test(w));
  let out = join > 0 ? words.slice(0, join) : words;
  // Too long for a label: lose the possessives and articles inside it, then a leading verb
  // ("Keeps coffee at your chosen temperature" → "Coffee at chosen temperature"), rather than
  // cutting it off mid-phrase ("Keeps coffee at").
  if (out.length > 4) out = out.filter((w, i) => i === 0 || !/^(your|their|its|our|the|a|an)$/i.test(w));
  if (out.length > 4 && /^[A-Z]?[a-z]+s$/.test(out[0]) && !/ss$/.test(out[0])) {
    out = out.slice(1);
    out[0] = out[0].charAt(0).toUpperCase() + out[0].slice(1);
  }
  if (out.length > 4) out = out.slice(0, 4);
  while (out.length > 1 && /^(for|and|with|to|of|the|a|an|in|on|at|or|your|by|from|into)$/i.test(out[out.length - 1])) out.pop();
  if (out[0]) out[0] = out[0].charAt(0).toUpperCase() + out[0].slice(1);
  const proper = new Set([...prose.matchAll(/(?<![.!?]\s|^)\b([A-Z][a-z]+)\b/g)].map((m) => m[1]));
  // "All-Day battery" → "All-day battery".
  if (out[0] && !/^[A-Z]{2,}/.test(out[0])) out[0] = out[0].replace(/-([A-Z])(?=[a-z]{2,}\b)/g, (_, c: string) => `-${c.toLowerCase()}`);
  if (out.length > 1 && out.every((w) => /^[A-Z0-9]/.test(w)))
    out = out.map((w, i) =>
      i === 0 ? w.replace(/-([A-Z])(?=[a-z]{2,}\b)/g, (_, c: string) => `-${c.toLowerCase()}`) : /\d|^[A-Z]{2,}|[a-z][A-Z]/.test(w) || proper.has(w) ? w : w.toLowerCase(),
    );
  return out.join(" ");
}

/**
 * A product video for a physical product (a marketplace listing or uploaded product photos):
 * the product rises onto the stage, its features are called out around it, then every angle in
 * a gallery and the end card. No software moments (no cursors, palettes or dashboards).
 */
function planFromProduct(site: SiteData, req: SiteRequest): VideoPlan {
  const seed = (req.seed ?? hashString(site.url || site.tagline || site.name)) >>> 0;
  const variant = Math.max(0, Math.floor(req.variant ?? 0));
  // Remakes and takes tell it from another angle: story (a hook first), product-first (open on the
  // product itself), or a gallery-led cut.
  // (A physical product has no software problems to stage: problem → solution plays as story-led.)
  const angle: Angle = req.angle === "problem" || req.angle === "bab" ? "story" : req.angle ?? (variant ? (["product", "story", "proof"] as Angle[])[(variant - 1) % 3] : "story");
  const bpm = 116;
  const beat = 60 / bpm;
  const beats = (n: number) => n * beat;
  const target = LENGTH_SECONDS[req.length];
  const brand = brandFromSite(site, req.colors);
  const photo = (i: number): Media | undefined => (brand.images[i] ? { src: brand.images[i], kind: "image" } : undefined);
  const photos = brand.images.length;
  const whole = ORIGINAL.get(site) ?? site;
  // What the product is comes from its name (earbuds whose bullets mention "the gym" aren't fitness gear).
  const concept = detectConcept(`${whole.name} ${whole.tagline}`);
  const product = sentenceCopy(site.tagline, 7) || shortenCopy(site.tagline, 7) || site.name;
  const seen = new Set<string>();
  const prose = `${whole.description} ${whole.features.join(" ")}`;
  const feats = site.headlines
    .map((t, i) => ({ title: calloutTitle(t, prose), desc: (sentenceCopy(site.features[i] ?? "", 12) || shortenCopy(site.features[i] ?? "", 10)).replace(/[.,;:]$/, "") }))
    .filter((f) => f.title && !seen.has(norm(f.title)) && !!seen.add(norm(f.title)) && norm(f.title) !== norm(product));
  const firstLine = (site.description.split(/(?<=[.!?])\s+/)[0] ?? "").replace(/\.$/, "");
  const scenes: Scene[] = [];
  // What it's called: a prompt names the product ("Aero Buds") and pitches it ("Wireless earbuds");
  // a listing's title already carries the brand ("Aero Buds Pro Wireless Earbuds").
  const fromPrompt = !site.url;
  const title = fromPrompt && site.name ? site.name : product;
  const nick = title.split(/\s+/).length > 4 ? title.split(/\s+/).slice(0, 3).join(" ") : title;
  // The product's main benefit in its own words: the listing's first line when it's short.
  // (A long line is cut at its last natural break that fits: "Wireless earbuds with active noise
  // cancelling and a pocket-size charging case" → "Wireless earbuds with active noise cancelling".)
  const fitLine = (x: string) => {
    const w = x.split(/\s+/).filter(Boolean);
    if (w.length <= 9) return x;
    const cut = w.slice(0, 10).reduce((at, word, i) => (i >= 3 && /^(and|with|for|that|so|while|plus|to)$/i.test(word) ? i : at), -1);
    return cut > 0 ? w.slice(0, cut).join(" ").replace(/[,;:]$/, "") : "";
  };
  // ("Aero Buds: wireless earbuds…" → "Wireless earbuds…": the name is already on screen.)
  const own = firstLine.replace(new RegExp(`^${site.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:,—–-]\\s*`, "i"), "");
  const short = own ? fitLine(own.charAt(0).toUpperCase() + own.slice(1)) : "";
  const benefit = short && norm(short) !== norm(product) ? short : "";
  // The proven product-ad format opens on the product itself, its benefit beneath it, within the
  // first second (story, the default). Remakes try a hook line first (product angle) or open on
  // the gallery (proof angle).
  if (target >= 20 && angle !== "story") {
    const hook = angle === "proof" ? `Meet *${nick}*` : benefit || `Say hello to *${nick}*`;
    scenes.push({ role: "hook", skill: photos >= 4 ? "tilt-wall" : "blur-reveal", text: hook, eyebrow: photos >= 4 ? undefined : "Introducing", duration: beats(7), transition: "cut" });
  }
  // The reveal: the product itself.
  const by = fromPrompt
    ? norm(product) !== norm(title) ? product : undefined
    : site.name && !norm(product).includes(norm(site.name)) ? `by ${site.name}` : undefined;
  const opener = angle === "story" || target < 20;
  const reveal: Scene = { role: "reveal", skill: "product-hero", text: title, subtext: (opener && benefit) || by, duration: beats(8), transition: "zoom", media: photo(0) };
  const featuresTitle = concept.id !== "general" && concept.id !== "ecommerce" ? concept.featuresTitle : "Made for *everyday*";
  // A long film with five or more features gives the close-ups their own labels (the callouts
  // keep three); otherwise the lens shows the details on its own.
  const zoomLabels = target >= 30 && feats.length >= 5 ? feats.slice(3, 6).map((f) => f.title) : [];
  // Its features called out around it (another photo when there is one, so the shot changes).
  const callouts: Scene | null =
    feats.length >= 2
      ? {
          role: "features", skill: "product-hero", text: featuresTitle, eyebrow: "Why you'll love it",
          items: feats.slice(0, zoomLabels.length ? 3 : 4).map((f) => f.title),
          duration: beats(Math.min(4, feats.length) * 2 + 6), transition: "dolly",
          media: photo(photos > 1 ? 1 + (variant % Math.max(1, photos - 1)) : 0),
          why: "The listing's bullet points, called out around the product",
        }
      : null;
  // Short films: the features as icon cards (the hero already had the stage).
  const icons: Scene | null =
    feats.length >= 2 ? { role: "features", skill: "icon-features", text: callouts && target >= 20 ? "The *details*" : featuresTitle, eyebrow: "Features", items: feats.slice(0, 4).map((f) => f.title), duration: beats(10), transition: "dolly" } : null;
  // A slide per feature with its own photo (long films with enough of both).
  const described = feats.filter((f) => f.desc.split(/\s+/).length >= 4);
  const slides: Scene | null =
    target >= 30 && described.length >= 3 && photos >= 3
      ? { role: "features", skill: "feature-slides", text: `Inside *${nick}*`, eyebrow: "Details", items: described.slice(0, 3).map((f) => `${f.title} — ${f.desc}`), duration: beats(15.5), transition: "push" }
      : null;
  // Every angle: the photos take turns on the stage (remakes try the gallery and carousel), and
  // long films close in on the details with a magnifying lens.
  const galleryKinds = ["product-spin", "photo-fan", "gallery-flow", "card-spread", "carousel-3d", "photo-drop"] as const;
  const gallery: Scene | null =
    photos >= 2 && target >= 20
      ? { role: "gallery", skill: galleryKinds[variant % galleryKinds.length], text: "From *different angles*", eyebrow: "Gallery", items: [], duration: beats(12), transition: "dolly", why: `${photos} product photos` }
      : null;
  const closer: Scene | null =
    target >= 30
      ? { role: "gallery", skill: "product-zoom", text: "The *details*", eyebrow: "Details", items: zoomLabels, duration: beats(12), transition: "whip", media: photo(0), why: "A close look at the product's details" }
      : null;
  // Product first, then why it's worth having (benefits as on-screen callouts, readable with the
  // sound off), then every angle and the details, then one clear call to action.
  const order =
    target < 20
      ? [reveal, callouts ?? icons]
      : angle === "proof"
        ? [gallery, reveal, slides ?? (target >= 30 ? icons : null), callouts, closer]
        : angle === "product"
          ? [reveal, gallery, callouts, slides ?? (target >= 30 ? icons : null), closer]
          : [reveal, callouts, gallery, slides ?? (target >= 30 ? icons : null), closer];
  // The feature cards only when they add something: cards repeating the callouts' own list
  // (a prompt with four features) would tell the viewer the same thing twice in a row. The
  // other shots hold longer instead.
  const fresh = (icons?.items ?? []).filter((it) => !callouts?.items?.some((c) => norm(c) === norm(it)));
  const repeat = !!callouts && !!icons && order.includes(callouts) && order.includes(icons) && fresh.length < 2;
  const kept = order.filter((x): x is Scene => !!x && !(repeat && x === icons));
  if (repeat) {
    const gap = icons!.duration;
    const room = kept.filter((x) => x !== reveal);
    for (const x of room) x.duration += gap / Math.max(1, room.length);
  } else if (icons && fresh.length >= 2 && callouts && order.includes(callouts)) icons.items = fresh.slice(0, 4);
  // What's in the box, when the listing says: after the callouts (or the reveal).
  const box = target >= 20 ? boxContents([whole.description, ...whole.features, ...whole.headlines]) : [];
  if (box.length >= 2) {
    const after = callouts && kept.includes(callouts) ? callouts : reveal;
    kept.splice(kept.indexOf(after) + 1, 0, {
      role: "box", skill: "unbox", text: "What's in the *box*", eyebrow: "In the box", items: box,
      duration: beats(box.length * 2 + 6), transition: "dolly", why: "The listing says what comes in the box",
    });
  }
  scenes.push(...kept);
  // Never the same product shot twice in a row (the reveal then its callouts is a different shot).
  for (let i = 1; i < scenes.length; i++)
    if (scenes[i].skill === "product-hero" && scenes[i - 1].skill === "product-hero" && !!scenes[i].items?.length === !!scenes[i - 1].items?.length && icons) scenes[i] = { ...icons };
  // The end card: the product's own pitch, and where to get it.
  scenes.push({
    role: "cta", skill: "product-end",
    text: ["Get yours *today*", "Make it *yours*", "Treat *yourself*"][variant % 3],
    subtext: site.cta && !/free/i.test(site.cta) ? site.cta : "Shop now",
    duration: beats(8),
    transition: "flash",
    media: photo(0),
  });
  const plan = sanitizePlan({ title, palette: "cosmos", font: "inter", aspect: req.aspect, bpm, seed, scenes, brand, style: "saas", concept: concept.id, target, product: true });
  const styled = applyTemplate(plan, req.template ?? "studio", { palette: req.palette && req.palette !== "auto" ? req.palette : undefined });
  if (!feats.length || photos < 2) {
    const runs = styled.scenes.reduce((a, s) => a + s.duration, 0);
    styled.notes = [
      `${photos < 2 ? (photos ? "Only one product photo was found" : "No product photos were added") : "The listing has no bullet points"}, so this is a short product video${runs < target * 0.9 ? ` (${Math.round(runs)}s rather than ${target}s, with no padding or repeats)` : ""}. ${photos < 2 ? "Add more photos" : "Add features in your prompt"} for galleries and feature callouts.`,
    ];
    // Judged (and fitted later) on the length its material supports.
    if (runs < target * 0.9) styled.target = Math.round(runs);
  }
  return styled;
}

function planFromSiteTrailer(site: SiteData, req: SiteRequest): VideoPlan {
  const text = [site.name, site.tagline, site.description, ...site.headlines].join(" ").toLowerCase();
  const seed = (req.seed ?? hashString(site.url)) >>> 0;
  const r = rng(seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
  // (A website defaults to the tech trailer.)
  const look = TRAILER_STYLE_MAP[req.trailerStyle ?? ""] ?? detectTrailerStyle(text, "tech");
  const mood = look.mood;
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
    skill: brand.logo ? pick(["logo-reveal", "logo-stage", "logo-extrude", "logo-shatter", "logo-spin"] as const) : pick(["particle-assemble", "god-rays", "logo-stage"] as const),
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
      text: pick(["ONE PLACE FOR IT", "BUILT FOR TEAMS", "SEE IT IN ACTION"] as const),
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
    sanitizePlan({ title: site.name, palette, font: mood.font, aspect: req.aspect, bpm: mood.bpm, seed, scenes, brand, style: "trailer", trailerStyle: look.id }),
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
const isShot = (s: unknown): s is string => typeof s === "string" && /^\/api\/shot\?id=[a-f0-9]{16}-(hero|full|mobile|s\d|p\d{1,2}|u\d{1,2}|logo)$/.test(s);
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

/** A slide's pre-style choice (see Scene.base): kept only when every part is valid. */
function sanitizeBase(b: unknown): Scene["base"] {
  if (!b || typeof b !== "object") return undefined;
  const o = b as Record<string, unknown>;
  const ok = (v: unknown) => typeof v === "string" && (SKILL_IDS as readonly string[]).includes(v);
  if (!ok(o.skill) || !ok(o.styled) || typeof o.text !== "string" || typeof o.shown !== "string") return undefined;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 8).map((x) => x.slice(0, 120)) : undefined);
  return { skill: o.skill as SkillId, styled: o.styled as SkillId, text: o.text.slice(0, 200), shown: o.shown.slice(0, 200), items: list(o.items), lent: list(o.lent), subtext: typeof o.subtext === "string" ? o.subtext.slice(0, 100) : undefined };
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
    shot: isAsset(brand.shot) ? brand.shot : undefined,
    mobile: isAsset(brand.mobile) ? brand.mobile : undefined,
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
    cast: r.cast === false ? false : undefined,
    captionStyle: r.captionStyle === "pop" || r.captionStyle === "box" || r.captionStyle === "karaoke" || r.captionStyle === "frosted" ? r.captionStyle : undefined,
  };
}

/** Clamp and repair a plan from any source (AI, URL, user edits). */
/** Detail Zoom's lens settings, kept to sane ranges (stops on the product, size 0.6–1.6×, zoom 1.5–4.5×). */
function sanitizeZoom(z: unknown): Scene["zoom"] {
  if (!z || typeof z !== "object") return undefined;
  const o = z as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
  const points = Array.isArray(o.points)
    ? o.points
        .filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number" && Number.isFinite(v)))
        .slice(0, 4)
        .map(([x, y]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))] as [number, number])
    : undefined;
  const out = { points: points?.length ? points : undefined, size: num(o.size, 0.6, 1.6), power: num(o.power, 1.5, 4.5) };
  return out.points || out.size !== undefined || out.power !== undefined ? out : undefined;
}

function sanitizeTour(v: unknown): Scene["tour"] {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  const c = (n: number) => Math.min(1, Math.max(0, n));
  const areas = Array.isArray(o.areas)
    ? o.areas
        .filter((a): a is [number, number, number, number] => Array.isArray(a) && a.length === 4 && a.every(ok))
        .slice(0, 2)
        .map(([x, y, w, h]) => [c(x), c(y), Math.min(1 - c(x), Math.max(0.01, w)), Math.min(1 - c(y), Math.max(0.01, h))] as [number, number, number, number])
    : undefined;
  if (!areas?.length) return undefined;
  return { areas, src: typeof o.src === "string" && o.src.length < 4096 ? o.src : undefined };
}

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
      baseTransition: (TRANSITIONS as readonly string[]).includes(s.baseTransition as string) ? (s.baseTransition as Transition) : undefined,
      media: sanitizeMedia(s.media),
      contrast: typeof s.contrast === "boolean" || s.contrast === "left" || s.contrast === "right" ? s.contrast : undefined,
      locked: s.locked === true ? true : undefined,
      base: sanitizeBase(s.base),
      eyebrow: typeof s.eyebrow === "string" && s.eyebrow.trim() ? s.eyebrow.slice(0, 40) : undefined,
      role: typeof s.role === "string" && /^[a-z]{2,14}$/.test(s.role) ? s.role : undefined,
      items: Array.isArray(s.items)
        ? s.items.filter((i) => typeof i === "string" && i.trim()).slice(0, 8).map((i) => String(i).slice(0, 140))
        : undefined,
      vo: typeof s.vo === "string" && s.vo.trim() ? s.vo.trim().slice(0, 240) : undefined,
      why: typeof s.why === "string" && s.why.trim() ? s.why.trim().slice(0, 160) : undefined,
      zoom: sanitizeZoom(s.zoom),
      tour: sanitizeTour(s.tour),
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
    trailerStyle: typeof raw.trailerStyle === "string" && TRAILER_STYLE_MAP[raw.trailerStyle] ? raw.trailerStyle : undefined,
    music: raw.music === "saas" || raw.music === "trailer" ? raw.music : undefined,
    flavor: ["tech", "soft", "pop", "minimal", "neon"].includes(raw.flavor as string) ? raw.flavor : undefined,
    scheme: raw.scheme === "vibrant" || raw.scheme === "60-30-10" ? raw.scheme : undefined,
    glow: raw.glow === true ? true : undefined,
    motionBlur: raw.motionBlur === false ? false : undefined,
    speed: typeof raw.speed === "number" && raw.speed !== 1 && playSpeed({ speed: raw.speed }) === raw.speed ? raw.speed : undefined,
    pointer: (POINTER_STYLES as readonly string[]).includes(raw.pointer as string) && raw.pointer !== "auto" ? (raw.pointer as VideoPlan["pointer"]) : undefined,
    shapes: raw.shapes === false ? false : undefined,
    contrast: raw.contrast === false ? false : undefined,
    tones: raw.tones === false ? false : undefined,
    cast: sanitizeCast(raw.cast),
    characters: (KINDS as readonly string[]).includes(raw.characters as string) ? (raw.characters as VideoPlan["characters"]) : undefined,
    setting: (SCENES as readonly string[]).includes(raw.setting as string) ? raw.setting : undefined,
    render3d: raw.render3d === "flat" ? "flat" : undefined,
    shapeSet: (SHAPE_SETS as readonly string[]).includes(raw.shapeSet as string) && raw.shapeSet !== "geometric" ? (raw.shapeSet as VideoPlan["shapeSet"]) : undefined,
    watermark: typeof raw.watermark === "string" && raw.watermark.trim() ? raw.watermark.trim().slice(0, 40) : undefined,
    textFx: (TEXT_FX as readonly string[]).includes(raw.textFx as string) ? (raw.textFx as VideoPlan["textFx"]) : undefined,
    concept: typeof raw.concept === "string" && CONCEPT_MAP[raw.concept] ? raw.concept : undefined,
    software: raw.software === "web" || raw.software === "app" ? raw.software : undefined,
    devices3d: raw.devices3d === false ? false : undefined,
    voiceover: sanitizeVoice(raw.voiceover),
    target: Number(raw.target) > 0 ? Math.min(120, Math.max(6, Number(raw.target))) : undefined,
    product: raw.product === true ? true : undefined,
    offersOk: Array.isArray(raw.offersOk) ? raw.offersOk.filter((o): o is string => typeof o === "string").slice(0, 12).map((o) => o.slice(0, 120)) : undefined,
    notes: Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === "string").slice(0, 3).map((n) => n.slice(0, 300)) : undefined,
    look:
      raw.look && typeof raw.look === "object"
        ? {
            grid: raw.look.grid !== false,
            beams: Math.min(8, Math.max(0, Number(raw.look.beams) || 0)),
            aurora: Math.min(3, Math.max(0, Number(raw.look.aurora) || 0)),
            text: (TEXT_FX as readonly string[]).includes(raw.look.text as string) ? raw.look.text : undefined,
            backdrop: ["grid", "dots", "blobs", "scanlines", "plain", "horizon", "stars", "eclipse", "studio", "ribbon", "beam", "bloom", "warp", "planet", "wormhole", "rain", "plexus", "meadow", ...SCENES].includes(raw.look.backdrop as string) ? raw.look.backdrop : undefined,
            card: ["glass", "frost", "flat", "brutal", "clay"].includes(raw.look.card as string) ? raw.look.card : undefined,
            toon: ["flat", "comic", "soft", "doodle"].includes(raw.look.toon as string) ? raw.look.toon : undefined,
            art: (ART_STYLES as readonly string[]).includes(raw.look.art as string) ? raw.look.art : undefined,
            people: (KINDS as readonly string[]).includes(raw.look.people as string) ? raw.look.people : undefined,
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
