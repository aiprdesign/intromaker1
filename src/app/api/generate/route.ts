import { z } from "zod/v4";
import { assetUrl } from "@/engine/assets";
import { AiError, describe, modelOf, readAiConfig, runDirector, serverReachesLocal, type AiConfig } from "@/lib/ai";
import { readShot } from "@/lib/storage";
import { lintStoryboard, repairStoryboard, reviewBrief } from "@/lib/review";
import { PALETTES } from "@/engine/palettes";
import { rateLimit, spendServerAi } from "@/lib/ratelimit";
import { readSettings, recordFilm, serverAi } from "@/lib/admin";
import { currentUser, limitsFor, spendAi, usageOf } from "@/lib/accounts";
import {
  beatSync,
  brandFromSite,
  LENGTH_SECONDS,
  isLength,
  planFromPrompt,
  isSaasPrompt,
  ANGLES,
  type Angle,
  planFromSite,
  parseSaasPrompt,
  productFromPrompt,
  healthPlan,
  safePlan,
  safeSite,
  stripHealth,
  readSite,
  sanitizePlan,
  type Length,
  type PlanRequest,
  type StyleChoice,
} from "@/engine/planner";
import { SKILLS } from "@/engine/skills";
import { applyTemplate, DEFAULT_TEMPLATE, TEMPLATE_MAP } from "@/engine/templates";
import { TRAILER_STYLE_MAP } from "@/engine/trailers";
import { rankMoments, detectConcept } from "@/engine/concepts";
import { writeVoiceover } from "@/engine/script";
import { FONTS, PALETTE_IDS, SKILL_IDS, TRANSITIONS, type Aspect, type Brand, type Media, type PaletteId, type SiteData, type VideoPlan } from "@/engine/types";
import { noStore } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;



const SceneSchema = z.object({
  skill: z.enum(SKILL_IDS),
  text: z.string().describe("Headline. Trailer style: UPPERCASE 1-4 words. SaaS style: sentence case, 3-9 words, *accent* key word"),
  items: z.array(z.string()).describe("List content for bento/ui-tour/ui-cards/pain-strike/steps/word-swap; else []"),
  eyebrow: z.string().describe("SaaS chapter label shown above the headline (e.g. 'How it works'), or empty"),
  subtext: z.string().describe("Optional supporting line, max ~40 characters, or empty string"),
  duration: z.number().describe("Seconds, 2-5"),
  transition: z.enum(TRANSITIONS),
  vo: z
    .string()
    .describe("Voice-over: the narrator's spoken line for this scene, conversational sentence case, at most ~2.5 words per second of the scene, only real claims; empty for testimonial scenes"),
});

const SitePlanSchema = z.object({
  title: z.string().describe("Short project title"),
  style: z.enum(["saas", "trailer"]),
  palette: z.enum(PALETTE_IDS),
  font: z.enum(FONTS),
  bpm: z.number().int().describe("Soundtrack tempo, 85-145"),
  scenes: z.array(
    SceneSchema.extend({
      media: z.number().int().describe("Index into the ASSETS list for product-showcase/photo-montage scenes, else -1"),
    }),
  ),
});

const PlanSchema = z.object({
  title: z.string().describe("Short project title"),
  style: z.enum(["saas", "trailer"]),
  palette: z.enum(PALETTE_IDS),
  font: z.enum(FONTS),
  bpm: z.number().int().describe("Soundtrack tempo, 85-145"),
  scenes: z.array(SceneSchema),
});

const SYSTEM = `You are the creative director of Prodintro.com, a motion-graphics engine. You turn a user's prompt into a storyboard of scenes. Each scene is rendered by one "skill" — a pre-built, high-end animated effect that animates the scene's headline text.

Available skills:
${SKILLS.map((s) => `- ${s.id} (${s.name}): ${s.tagline} Best for: ${s.bestFor}`).join("\n")}

Palettes: ${PALETTE_IDS.map((id) => `${id} (${PALETTES[id].name})`).join(", ")}.
Fonts: anton (tall condensed, trailer/impact), grotesk (modern geometric, tech/premium), inter (clean SaaS), serif (elegant editorial), mono (developer / code).
Transitions (how a scene enters): cut, flash, zoom, glitch, wipe, whip (motion-blurred whip pan), dolly (zoom-blur rush-in), leak (warm light-leak burn), shutter (letterbox shutters snap open), push (both shots slide), dissolve (blurred cross-dissolve). whip, dolly, push, dissolve and leak overlap the outgoing and incoming shots like a real edit.

How to direct an epic, modern piece:
- Structure with an energy arc: a short hook that builds anticipation → the main title/brand reveal (the biggest hit) → 2-5 punchy beats (features, benefits, stats, emotions) → a final brand lock-up outro with a call to action in the subtext.
- The engine snaps every scene to whole beats of the soundtrack and the camera pulses on each kick, so think in beats: hook ≈ 6 beats, title ≈ 8 beats, each feature beat ≈ 5-6 beats, outro ≈ 8 beats. The soundtrack's arrangement follows the storyboard (sparse hook, full groove on the title, trailer braams on the title and outro).
- Copy: headlines are short and punchy (1-4 words, ideally ≤ 16 characters), written like trailer cards. Use strong verbs and concrete claims. Pull real names, claims and numbers from the prompt; never put style words from the prompt (e.g. "cyberpunk", "hype", "retro 80s") on screen. Invent tasteful copy only where the prompt is thin.
- Put the brand's one-line descriptor in the title scene's subtext and a clear call to action in the outro subtext.
- Use number-ticker only when the headline contains a number.
- The media skills (logo-reveal, product-showcase, photo-montage, screen-wall, ui-tour media) need imported website assets; use them only when a WEBSITE is provided.

TWO STYLES — set "style" and follow its rules:
TRAILER: epic cinematic trailer. UPPERCASE 1-4 word cards, anton/grotesk font, spectacular skills, trailer score.
SAAS: a polished product-launch film in the style of Linear, Vercel, Stripe and Apple keynotes. Rules:
- Font "inter". Copy in sentence case, 3-9 words, confident and concrete; wrap the key word in *asterisks* for the brand gradient ("Your pipeline, *in one view*").
- Narrative: hook (the promise, or pain-strike with 2-4 real pains → another way) → brand (logo-reveal or particle-assemble) → product in action (ui-tour with 2 callout items or ui-cards over real media, and/or ONE interaction moment) → features (bento with 3-6 items, each "Short title — one-line benefit" using the site's own feature descriptions) → proof (testimonial ONLY with a real quote; logo-marquee ONLY with real customer logos; stats in ui-cards/number-ticker) → integrations if relevant → cta (subtext = the button label) last. The button label fits what this intro is about: the site's own button when it has one, else the action the product invites ("Book a demo", "Start free trial", "Download the app", "Shop now", "Join the waitlist", "Start building", "Start learning"); never "free" unless the material offers something free.
- Interaction moments — the best launch films SHOW the product doing something. Use at most one per film, matched to the product: command-k (keyboard-first dev/productivity tools; items = commands, the first is a real feature that runs), ai-prompt (AI products; items[0] = the prompt, subtext = the answer in the product's voice, items[1..3] = real capabilities), click-flow (automation; subtext = the button label, items = 3-5 tasks it completes), notify-stack (sales, e-commerce, security, messaging; items = 3-5 "Title — detail" notifications, each one of the product's own features with what it just did, from the site or prompt, never stock events), code-deploy (developer tools and hosting; code types in, git push runs, items = 3-5 generic pipeline steps), kanban (project, hiring and sales-pipeline tools; subtext = "Col / Col / Col", items = 3-5 cards), live-cursors (collaboration: whiteboards, design, docs; items = 3-4 board cards, subtext = a short teammate comment), chat-thread (messaging and support; items = 2-4 short messages, subtext = the product's update card "Title — detail"). chart-grow shows ONE real metric (subtext = the stat, e.g. "30,000+ businesses").
- Signature text moments (at most one of each per film): type-mask = giant type filled with the product's footage that the camera dives through (1–3 word headline + a product video/screenshot as media; great as the brand moment of a product-first cut); node-graph = the steps as a ComfyUI-style node workflow (AI, automation and creative tools; items = 3–5 "Title — detail" steps).
- Galleries of the site's own images and captured UI (need 3+ images): gallery-flow = images in a frame joined by GPU transitions, items = one caption each; carousel-3d = a turning 3D ring of cards (visual products, templates, examples); tilt-wall = a perspective wall of screenshots behind a big headline (a hero hook or closing promise).
- Scene moments (at most one of each): globe = a dotted world with arcs and live events, ONLY when the site talks about global/international use (items = 3-4 generic events like "Payment received"); world-map = the same on a flat dotted map (sites that talk about countries, regions, currencies or languages); support = help centre search + support chat (ONLY when the site talks about support/docs/onboarding; subtext = the question, items = 3-4 article titles; no response-time or 24/7 claims); feature-slides = one full slide per feature with product UI (long films; items = 2-4 "Title — one-line benefit"); problem-solution = each of the site's pains struck through and answered by a feature (items = 2-4 "Problem → Solution"); before-after = a comparison slider from the old way (items = 2-4 of the site's own pains) to the product screenshot (media).
- 3D logo intros (brand reveal; headline = brand name, subtext = a short tagline; they use the logo, app icon or a generated mark): logo-extrude (snaps into a solid block), logo-spin (coin spin), logo-shatter (shards assemble), logo-orbit (rings orbit it), logo-stage (rises through a reflective floor), logo-layers (glass layers collapse), logo-tunnel (fly-through), logo-flip (strips flip in a wave). Use one for an epic, cinematic or 3D brand reveal instead of logo-reveal.
- Bookends: liquid-logo = the brand reveal poured in as glossy liquid (fluid, playful-premium films; headline = brand name, subtext = a short tagline). qr-end = the final scene with a scannable QR code of the website, ONLY when the viewer asks for a film for a talk, event, conference, trade show, store or big screen ("presentation", "booth", "TV"); headline = closing line, subtext = the call to scan ("Scan to try it"); items only if the link differs from the website. Otherwise end on cta.
- Prefer these skills: site-scroll, steps, node-graph, type-mask, gallery-flow, carousel-3d, tilt-wall, icon-features, command-k, ai-prompt, click-flow, notify-stack, code-deploy, kanban, live-cursors, chat-thread, globe, world-map, before-after, problem-solution, feature-slides, support, chart-grow, blur-reveal, word-swap ("Your work, planned|built|shared"), pain-strike, ui-tour, bento, ui-cards, integrations, testimonial, logo-marquee, cta, qr-end, logo-reveal, liquid-logo. Avoid neon/retro/glitch/shockwave/kinetic-slam.
- Transitions: dolly, whip, push, dissolve, leak, cut. bpm 112-126. Durations: hooks 3-3.5s, ui-tour 5.5-6.5s, bento 4.5-5s, others 3.5-4.5s.
- Never invent customer names, quotes, logos or statistics.
- Vary skills so no two consecutive scenes use the same one, and pick skills whose aesthetic fits the prompt's mood. Save the most spectacular skills (god-rays, shockwave, particle-assemble, glass-shatter, warp-tunnel) for the hook, title and outro.
- Vary transitions; don't repeat the same one back to back. Use whip/flash/glitch for energy, dolly/leak/shutter for cinematic moments, and the continuity transitions to make slides flow into each other: morph (match cut between centred headlines), portal (fly into the next slide through a window), iris (circle reveal), spin (turning whip), split (the slide parts down the middle), swipe (the slide flies away as a card).
- Choose the palette, font and bpm that match the mood: 128-145 bpm for hype/action/gaming, 110-125 for tech/launches, 85-100 for luxury/calm/documentary.
- Hit the requested total length (sum of durations) within ±1.5 seconds.
- Voice-over ("vo"): write the narrator's line for every scene as one flowing script, like a launch-film voice-over: warm, confident, second person, plain words. Each line must be speakable within its scene (about 2.5 words per second, minus half a second), may paraphrase but never add claims, and should complement rather than just read out the headline where there's room. Say the brand name on the reveal ("Meet Nimbus."). Leave vo empty on testimonial scenes so the quote reads.`;

/** Always in force: health and medical claims never go into a film. */
const HEALTH_RULES = `HEALTH CLAIMS (required): no health or medical claims of any kind: nothing that treats, cures, prevents, diagnoses or heals; no "clinically proven", "FDA approved/cleared", "doctor recommended"; no effects on the body or mind (sleep, stress, mood, immunity, weight, energy).
OFFERS (required): say "free" (free trial, start free) only when the website itself offers it; otherwise use "Get started", "Book a demo" or "Try <name>".`;

/** Added to the system prompt when claim-safe copy is on (the default). */
const CLAIM_RULES = `CLAIM-SAFE COPY (required — overrides the rules above): every on-screen line and narrator line is generic and descriptive: what the product is and what it does, in plain words.
- No superlatives or rankings: best, #1, leading, top, world's first, fastest, most powerful, award-winning, ultimate.
- No badges, awards or boosts: Editor's Choice, staff pick, bestseller, top pick, must-have, acclaimed, award winner, premium quality, extra strong.
- No absolute or totality words on screen or in the narration: all, each, every, everything, everyone, always, never, forever. Say "your projects", not "all your projects"; "the cups", not "each cup".
- No absolutes or guarantees: 100%, guaranteed, never, always, everything, zero downtime, risk-free.
- No speed or multiplier claims: in seconds, in minutes, instantly, 10x faster, 50% more.
- No comparatives without a comparison: faster, better, smarter, easier.
- No numbers used as claims (customer counts, percentages, ratings, uptime, revenue), no testimonials, no customer-logo walls, no metric or number scenes (testimonial, logo-marquee, chart-grow, number-ticker are not used).
- No efficacy or outcome promises ("stops every threat", "boost your revenue", "save money") — describe what the product does, not results it guarantees.
- FTC/FDA: no health or medical claims of any kind (treats, cures, prevents, diagnoses, heals, improves sleep/stress/mood, clinically proven, FDA approved, doctor recommended); no certification or compliance claims (SOC 2, HIPAA, GDPR, "compliant", "certified", "bank-grade"); no green claims (eco-friendly, sustainable, carbon neutral); no endorsements ("as seen on", "recommended by"); no origin claims ("Made in USA").
- No offers: never "free", free trials, discounts, "% off", coupons, "no credit card" or money-back promises.
- Word-swap lines use neutral verbs ("Your work, planned|built|shared"). CTAs are simple actions ("Get started", "Book a demo", "Try Acme").`;

export async function GET() {
  const server = await serverAi();
  return Response.json({
    ai: !!server,
    model: server ? modelOf(server.ai) || null : null,
    // Local AI goes through this server only when it runs on the user's machine.
    localViaServer: serverReachesLocal(),
  }, { headers: noStore });
}

function siteAssets(site: SiteData): { media: Media; label: string }[] {
  const brand = brandFromSite(site);
  const sh = site.shots ?? { hero: null, full: null, sections: [] };
  return [
    ...(sh.full ? [{ media: { src: sh.full, kind: "image" as const }, label: "FULL-PAGE screenshot of the website (use with site-scroll)" }] : []),
    ...(sh.hero
      ? [{ media: { src: sh.hero, kind: "image" as const }, label: `hero screenshot of the website (above the fold)${(sh.parts?.length ?? 0) >= 3 ? `; its ${sh.parts!.length} UI components were captured — use with ui-assemble` : " (use with ui-assemble)"}` }]
      : []),
    ...sh.sections.map((src, i) => ({ media: { src, kind: "image" as const }, label: `screenshot of page section ${i + 1}` })),
    ...brand.images.map((src, i) => ({ media: { src, kind: "image" as const }, label: `image from the page${i === 0 ? " (social card / hero)" : ""}: ${site.images[i]}` })),
    ...brand.videos.map((src, i) => ({ media: { src, kind: "video" as const }, label: `product video: ${site.videos[i]}` })),
  ];
}

function siteBrief(site: SiteData) {
  const assets = siteAssets(site).map((a, i) => `[${i}] ${a.label}`);
  return [
    `WEBSITE: ${site.url}`,
    `Brand name: ${site.name}`,
    `Tagline: ${site.tagline}`,
    `Description: ${site.description}`,
    `Headlines on the page: ${site.headlines.map((h) => `"${h}"`).join(", ") || "(none)"}`,
    `Stats found: ${site.stats.join(", ") || "(none)"}`,
    `Call to action: ${site.cta ?? "(none)"}`,
    `Feature descriptions: ${site.features.filter(Boolean).map((f) => `"${f}"`).join(", ") || "(none)"}`,
    `TESTIMONIALS: ${site.testimonials.map((q) => `"${q.quote}" — ${q.author}${q.role ? `, ${q.role}` : ""}`).join(" | ") || "(none)"}`,
    `CUSTOMER LOGOS: ${site.clientLogos.length}`,
    `HOW IT WORKS steps: ${site.steps.join(" → ") || "(none)"}`,
    `Pains the product removes: ${site.pains.join(", ") || "(none)"}`,
    `Logo available: ${site.logo ? "yes (logo-reveal will use it automatically)" : "no"}`,
    `ASSETS:\n${assets.join("\n") || "(none)"}`,
  ].join("\n");
}

const SITE_RULES = `
This storyboard is a product intro for the website below, built from its own brand assets. Use the SAAS style unless told otherwise.
- Use the site's real name, claims, features and stats as copy. Never invent numbers, quotes or customers.
- If a logo is available, use logo-reveal for the brand reveal (headline = brand name).
- Show the real product: ui-assemble, site-scroll, ui-tour and ui-cards take "media" = the ASSETS index of the best screenshot/video for them. Prefer ui-assemble over a flat screenshot; use ui-tour for real product images/video, not page-section screenshots.
- TRAILER style only: product-showcase with the hero image/video, photo-montage feature beats over other images, screen-wall once with 3+ images, logo-reveal again as the outro.
- For skills without media set "media" to -1. End with a cta scene whose subtext is the site's real call-to-action label.
- testimonial: use a quote from TESTIMONIALS verbatim (text = quote, subtext = "Name · Role"). logo-marquee only if CUSTOMER LOGOS > 0.
- Tell ONE coherent story with a clear arc, each scene setting up the next, with an "eyebrow" chapter label:
  1 Hook ("The old way": pain-strike with the real pains → "There's a *better* way", or blur-reveal with the promise)
  2 Reveal (logo-reveal, subtext = the promise) 3 Meet (ui-assemble on the HERO screenshot: the product rebuilt from its real UI components; site-scroll on the FULL-PAGE screenshot only when there is no hero; eyebrow "Meet <Name>")
  4 How it works (steps with the real steps) 5 Features (ui-tour on the best product image/video with 2 callouts; bento)
  5b Product in action: one interaction moment (command-k / ai-prompt / click-flow / notify-stack) that suits the product
  6 Proof ("Loved by teams" testimonial, "Customers" logo-marquee, "Results" ui-cards or chart-grow with a real stat) 7 Integrations 8 CTA.
  Skip beats the site has no material for. Keep copy consistent: one voice, one promise, recurring brand name.`;

/** Screenshots the AI should look at: the hero plus a few page sections (vision input). */
async function siteImages(site: SiteData) {
  const sh = site.shots ?? { hero: null, full: null, sections: [] };
  const picks = [sh.hero, ...sh.sections.slice(0, 3)].filter((x): x is string => !!x);
  const out: { data: string; mediaType: "image/jpeg" }[] = [];
  for (const src of picks) {
    const id = src.match(/id=([a-f0-9]{16}-(?:hero|full|s\d|p\d{1,2}|u\d{1,2}))$/)?.[1];
    if (!id) continue;
    try {
      const data = await readShot(`${id}.jpg`);
      if (!data) continue;
      if (data.length <= 4_500_000) out.push({ data: data.toString("base64"), mediaType: "image/jpeg" });
    } catch {
      /* screenshot expired */
    }
  }
  return out;
}

type Body = Partial<PlanRequest> & {
  site?: unknown;
  /** Uploaded product photos (/api/shot URLs from /api/photos): makes a product video. */
  photos?: unknown;
  colors?: Brand["colors"];
  style?: StyleChoice;
  trailerStyle?: string;
  ai?: unknown;
  template?: string;
  angle?: unknown;
  /** Claim-safe copy (default on). */
  safe?: boolean;
  /**
   * Browser-run AI (a local model on the user's machine when this server is online):
   * "prompt" returns the director request; "finish" turns the model's JSON into a plan
   * (asking for one revision first when the self-review wants it).
   */
  phase?: "prompt" | "finish";
  draft?: unknown;
  revised?: unknown;
  engineLabel?: string;
};

const PHOTO = /^\/api\/shot\?id=[a-f0-9]{16}-u\d{1,2}$/;

function readBody(body: Body) {
  const prompt = String(body.prompt ?? "").slice(0, 1000);
  const aspect: Aspect = body.aspect === "9:16" || body.aspect === "1:1" ? body.aspect : "16:9";
  const length: Length = isLength(body.length) ? body.length : "long";
  const palette: PaletteId | "auto" = (PALETTE_IDS as readonly string[]).includes(body.palette as string) ? (body.palette as PaletteId) : "auto";
  const seed = Number(body.seed) || undefined;
  // Claim-safe, always (the studio no longer offers the site's own claims).
  const safe = true;
  // Claim-safe: the director (built-in or AI) only ever sees the site's claim-free copy.
  // Uploaded product photos make it a product video: of the imported listing or site (the
  // uploads lead), or of the product the prompt describes.
  const photos = (Array.isArray(body.photos) ? body.photos : []).filter((p): p is string => typeof p === "string" && PHOTO.test(p)).slice(0, 12);
  const read = readSite(body.site);
  // A partly read listing (the name from its link and its main photo) takes the features the
  // visitor typed in the prompt ("with noise cancelling, all-day battery and a pocket case").
  const typed = read?.partial && prompt ? parseSaasPrompt(prompt) : null;
  const listed =
    read && typed
      ? {
          ...read,
          name: read.name === "Your product" || /^your product$/i.test(read.tagline) ? typed.brand ?? read.name : read.name,
          tagline: /^your product$/i.test(read.tagline) && typed.pitch ? typed.pitch : read.tagline,
          headlines: [...read.headlines, ...typed.features].slice(0, 12),
          features: [...read.features, ...typed.features.map(() => "")].slice(0, 12),
        }
      : read;
  const rawSite = photos.length
    ? listed
      ? { ...listed, kind: "product" as const, images: [...new Set([...photos, ...listed.images])].slice(0, 14) }
      : productFromPrompt(prompt, photos)
    : listed;
  // Health and medical claims are screened out in every mode.
  const site = rawSite ? (safe ? safeSite(rawSite) : stripHealth(rawSite)) : rawSite;
  const colors =
    body.colors && /^#[0-9a-f]{6}$/i.test(body.colors.primary) && /^#[0-9a-f]{6}$/i.test(body.colors.secondary) ? body.colors : undefined;
  const style: StyleChoice = body.style === "saas" || body.style === "trailer" ? body.style : "auto";
  const asked = typeof body.template === "string" && TEMPLATE_MAP[body.template] ? body.template : DEFAULT_TEMPLATE;
  // A product's "Epic trailer" is its product video in a trailer style (cold open, trailer score).
  const template = site?.kind === "product" && style === "trailer" && !TEMPLATE_MAP[asked].trailer ? "drop" : asked;
  const angle = ANGLES.find((a) => a.id === body.angle)?.id as Angle | undefined;
  const trailerStyle = typeof body.trailerStyle === "string" && TRAILER_STYLE_MAP[body.trailerStyle] ? body.trailerStyle : undefined;
  const variant = Math.min(50, Math.max(0, Math.floor(Number(body.variant) || 0)));
  const wantSaas = style === "saas" || site?.kind === "product" || (style === "auto" && (site ? true : isSaasPrompt(prompt)));
  const request: PlanRequest = { prompt, aspect, length, palette, seed, style, trailerStyle, template, safe, variant, angle };
  const concept = rawSite
    ? detectConcept(`${rawSite.name} ${rawSite.tagline} ${rawSite.description}`, [...rawSite.headlines, ...rawSite.features, ...rawSite.steps, ...rawSite.pains].join(" "))
    : detectConcept(prompt);
  const builtin = () => (site ? planFromSite(site, { aspect, length, palette, seed, colors, style, trailerStyle, template, angle, safe, variant, direction: prompt }) : planFromPrompt(request));
  return { prompt, aspect, length, palette, seed, site, colors, style, template, angle, wantSaas, builtin, concept, safe, variant };
}
type Ctx = ReturnType<typeof readBody>;

/** The interaction moment that suits this product best (the same ranking the built-in director uses). */
function momentBrief(c: Ctx) {
  const s = c.site;
  const lead = s ? `${s.tagline} ${s.description}` : c.prompt ?? "";
  const body = s ? [...s.headlines, ...s.features, ...(s.steps ?? [])].join(" ") : "";
  const aiLed = c.concept.id !== "ai" && /\b(ai|assistant|copilot|gpt)\b/i.test(s ? [s.tagline, ...s.headlines.slice(0, 4)].join(" ") : lead);
  const [best, next] = rankMoments(lead, body, c.concept.id, { aiLed });
  const spec = best.spec;
  return (
    `\nINTERACTION MOMENT that suits this product best: ${spec.skill}${best.because.length ? ` (its copy talks about ${best.because.join(", ")})` : ""}, e.g. headline "${spec.title.replace(/\*/g, "")}"` +
    `${spec.action ? `, subtext "${spec.action}"` : ""}; fill it from the product's real features (its items, cards, messages, notifications or commands come from this product's site or prompt, not stock examples).` +
    (next && next.score >= best.score * 0.8 ? ` A close second: ${next.spec.skill}.` : "")
  );
}

/**
 * Prompt-only films: one icon-card beat built from the features the prompt names, topped up with
 * what a product of this kind typically offers when it names fewer than two (plain words, no
 * claims; the film's note tells the user, see typicalNote).
 */
function featureCardBrief(c: Ctx) {
  const starter = c.concept.starter;
  return (
    `\nFEATURE CARDS: include one icon-features scene (3-4 items, short "Title — one-line benefit"; each card's icon is picked from its wording) built from the features the prompt names.` +
    (starter ? ` If the prompt names fewer than two, add what a ${c.concept.name.toLowerCase()} product typically offers, plainly worded, e.g. ${starter.map((x) => `"${x}"`).join(", ")}.` : "")
  );
}

/** Physical products (a marketplace listing or uploaded photos) get a product video, not a software film. */
function productBrief(c: Ctx) {
  const from = c.site?.marketplace ? `a ${c.site.marketplace} listing` : "the maker's product photos";
  return (
    `\nPRODUCT VIDEO: this is a physical product (from ${from}); every ASSETS image is a product photo. Film it like a product ad: ` +
    `product-hero for the reveal (media = the main photo, headline = the product name, subtext = "by <brand>" or a short line) and again for 2-4 feature callouts ` +
    `(items = short feature titles from the listing's bullet points, 1-4 words each), product-spin to show every angle (2+ photos; or gallery-flow / carousel-3d), product-zoom for a close look at the details in long films (items = up to 3 short feature titles, optional), tilt-wall as the hook with 4+ photos, ` +
    `feature-slides for long films ("Title — one-line benefit" with photos), and product-end last (media = the main photo, headline = the closing line, subtext = "Shop now" unless the listing's own button says otherwise). ` +
    (TEMPLATE_MAP[c.template]?.trailer
      ? `This is a PRODUCT TRAILER: open cold with product-teaser (items = 2-3 punchy feature words from the listing, 1-3 words each, one per close-up; no media), then the product-hero reveal right after it. `
      : "") +
    `No software moments: no ui-tour, site-scroll, ui-assemble, command-k, ai-prompt, click-flow, notify-stack, kanban, code-deploy, chart-grow, integrations or logo-reveal. ` +
    `Never mention prices, discounts, ratings or reviews.`
  );
}

/** A note when a prompt film's cards include the category's typical features the prompt didn't name. */
function typicalNote(c: Ctx, plan: VideoPlan): string | null {
  if (c.site || !c.concept.starter) return null;
  const said = (c.prompt ?? "").toLowerCase();
  const n = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const shown = c.concept.starter.filter(
    (f) => !said.includes(f.toLowerCase()) && plan.scenes.some((sc) => sc.items?.some((it) => n(it.split(/\s+[—–]\s+/)[0]) === n(f))),
  );
  return shown.length
    ? `The feature cards include what a typical ${c.concept.name.toLowerCase()} product offers (${shown.join(", ")}). Edit them to match yours, or list features in your prompt (e.g. “with X, Y and Z”).`
    : null;
}

/** Everything the AI director is sent: system prompt, brief, screenshots and output schema. */
async function directorRequest(c: Ctx) {
  const schema = c.site ? SitePlanSchema : PlanSchema;
  const images = c.site ? await siteImages(c.site) : [];
  const text =
    (c.site ? `${images.length ? "The attached images are screenshots of the website — use them to understand the product, its look and which assets best show it. Screenshot order matches ASSETS: hero first, then sections.\n\n" : ""}${siteBrief(c.site)}\n\n` : "") +
    (c.prompt ? `Prompt: ${c.prompt}\n\n` : "") +
    `Style: ${c.wantSaas ? "SAAS" : "TRAILER"}. Aspect ratio: ${c.aspect}. Target total length: ${LENGTH_SECONDS[c.length]} seconds.` +
    (c.wantSaas ? `\nSTYLE TEMPLATE "${TEMPLATE_MAP[c.template].name}": ${TEMPLATE_MAP[c.template].vibe} Write copy in this voice.` : "") +
    (c.wantSaas && c.site?.kind === "product" ? productBrief(c) : c.wantSaas ? momentBrief(c) : "") +
    (c.wantSaas && c.concept.id !== "general"
      ? `\nPRODUCT CATEGORY: ${c.concept.name}. Follow this category's typical launch-film arc: ${c.concept.arc.filter((r) => r !== "bento" && r !== "stat" && !(c.safe && ["quote", "logos", "metric"].includes(r))).join(" → ")} (skip beats without material). Use icon-features for the key features (items "Title — one-line benefit"; icons are picked from the wording). CTA in this voice, e.g. "${(c.concept.cta.find((l) => !/free/i.test(l)) ?? c.concept.cta[0]).replace(/\{name\}/g, c.site?.name ?? "the product").replace(/\*/g, "")}".`
      : "") +
    (c.wantSaas && !c.site ? featureCardBrief(c) : "") +
    (c.palette !== "auto" ? ` Use the "${c.palette}" palette.` : "") +
    (c.angle ? `\nCREATIVE ANGLE "${ANGLES.find((a) => a.id === c.angle)!.name}": ${ANGLES.find((a) => a.id === c.angle)!.brief}` : "") +
    (c.variant
      ? `\nREMAKE #${c.variant}: make a clearly different film from the obvious one. Use different slides for its sections (e.g. feature-slides or bento instead of icon-features, a different interaction moment, node-graph vs steps, carousel-3d vs gallery-flow, world-map vs globe, problem-solution vs before-after) and a different opening line, keeping every rule above.`
      : c.seed
        ? ` Variation #${c.seed % 1000}: take a fresh creative angle.`
        : "");
  const system = (c.site ? SYSTEM + "\n" + SITE_RULES : SYSTEM) + "\n" + (c.safe ? CLAIM_RULES : HEALTH_RULES);
  return { schema, images, text, system };
}

/** Turn a (checked, repaired) AI storyboard into a renderable plan in the chosen style. */
function finishPlan(c: Ctx, raw: z.infer<typeof SitePlanSchema>) {
  const out = repairStoryboard(raw, { site: c.site, targetSeconds: LENGTH_SECONDS[c.length] });
  const brand = c.site ? brandFromSite(c.site, c.colors) : undefined;
  const assets: Media[] = c.site ? siteAssets(c.site).map((a) => a.media) : [];
  const directed = beatSync(
    sanitizePlan({
      ...out,
      aspect: c.aspect,
      palette: c.palette !== "auto" ? c.palette : out.palette,
      seed: c.seed ?? Math.floor(Math.random() * 1e9),
      brand,
      style: out.style,
      concept: c.concept.id,
      // A physical product: its photos are cut out on the stage and the narrator speaks about the product.
      product: c.site?.kind === "product" ? true : undefined,
      scenes: out.scenes.map((s) => {
        const idx = "media" in s ? (s.media as number) : -1;
        // Testimonials get the real author's avatar when the quote matches the site's.
        const q = c.site?.testimonials.find((x) => s.skill === "testimonial" && x.avatar && s.text.includes(x.quote.slice(0, 40)));
        const media = q?.avatar ? { src: assetUrl(q.avatar), kind: "image" as const } : assets[idx];
        return { ...s, subtext: s.subtext || undefined, items: s.items?.length ? s.items : undefined, eyebrow: s.eyebrow || undefined, vo: s.vo || undefined, media };
      }),
    }),
  );
  // SaaS films get the chosen template's look, music, pacing and role skills.
  const styled = c.wantSaas ? applyTemplate({ ...directed, brand: directed.brand }, c.template, { palette: c.palette !== "auto" ? c.palette : undefined }) : directed;
  // Any scene the AI left without a narrator line gets one from the built-in script writer.
  const voiced = writeVoiceover(styled);
  const note = typicalNote(c, voiced);
  if (note) voiced.notes = [note, ...(voiced.notes ?? [])].slice(0, 3);
  return c.safe ? safePlan(voiced) : healthPlan(voiced);
}

/** Validate model output against the storyboard schema (tolerating small deviations). */
function readDraft(schema: z.ZodType, raw: unknown): z.infer<typeof SitePlanSchema> | null {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data as z.infer<typeof SitePlanSchema>;
  const o = raw as { scenes?: unknown };
  return o && typeof o === "object" && Array.isArray(o.scenes) && o.scenes.length ? (raw as z.infer<typeof SitePlanSchema>) : null;
}

export async function POST(req: Request) {
  const limited = rateLimit(req, "generate");
  if (limited) return limited;
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const c = readBody(body);
  const lintCtx = { site: c.site, targetSeconds: LENGTH_SECONDS[c.length], safe: c.safe };
  // Every film made is logged for the owner's admin area (a remake, an alternative take, or new).
  const film = async (out: { plan: VideoPlan; engine: string; engineLabel?: string; note?: string }) => {
    const who = await currentUser(req).catch(() => null);
    await recordFilm(req, {
      account: who ? { id: who.id, email: who.email } : null,
      kind: c.variant ? "remake" : c.angle ? "take" : "generated",
      plan: out.plan,
      engine: out.engine === "ai" ? out.engineLabel || "AI" : "builtin",
      prompt: c.site ? undefined : c.prompt,
      url: c.site?.url,
    });
    return Response.json(out);
  };

  // ── Browser-run AI: hand out the request, then finish what the model returned.
  if (body.phase === "prompt") {
    const r = await directorRequest(c);
    return Response.json({ system: r.system, text: r.text, images: r.images, schema: z.toJSONSchema(r.schema) });
  }
  if (body.phase === "finish") {
    const { schema, text } = await directorRequest(c);
    const cfg = readAiConfig(body.ai);
    const label = (cfg ? describe(cfg) : "Local AI").slice(0, 80);
    const draft = readDraft(schema, body.draft);
    if (!draft) return film({ plan: c.builtin(), engine: "builtin", note: "The local model's reply wasn't a storyboard; used built-in director." });
    const issues = lintStoryboard(draft, lintCtx);
    const mode = cfg?.mode ?? "balanced";
    const revised = body.revised ? readDraft(schema, body.revised) : null;
    if (!body.revised && (mode === "best" || (mode === "balanced" && issues.length))) {
      return Response.json({ review: text + "\n" + reviewBrief(draft, issues) });
    }
    let out = draft;
    let reviewed = "";
    if (revised) {
      const left = lintStoryboard(revised, lintCtx).length;
      if (left <= issues.length) {
        out = revised;
        const fixed = issues.length - left;
        reviewed = fixed > 0 ? ` · self-reviewed, fixed ${fixed} issue${fixed > 1 ? "s" : ""}` : " · self-reviewed";
      }
    }
    return film({ plan: finishPlan(c, out), engine: "ai", engineLabel: `${label}${reviewed}` });
  }

  // Which AI runs the director: the user's own key/provider, else the server's (the admin's saved
  // provider, or ANTHROPIC_API_KEY), else built-in.
  const userAi = readAiConfig(body.ai);
  const server = !userAi ? await serverAi() : null;
  const ai: AiConfig | null = userAi && userAi.provider !== "builtin" ? userAi : (server?.ai ?? null);
  if (!ai || (!c.prompt.trim() && !c.site)) {
    return film({ plan: c.builtin(), engine: "builtin" });
  }
  // The site's own AI is a plan feature (Pro by default) with a monthly allowance per account,
  // inside a shared daily budget. Visitors' own keys aren't counted or limited.
  if (!userAi) {
    const who = await currentUser(req);
    const limits = await limitsFor(who);
    if (limits.aiPerMonth <= 0) {
      return film({ plan: c.builtin(), engine: "builtin", note: "The AI director is part of Pro; this film was made by the built-in director. Upgrade, or add your own AI key in AI settings." });
    }
    if (who && usageOf(who).ai >= limits.aiPerMonth) {
      return film({ plan: c.builtin(), engine: "builtin", note: `You've used this month's ${limits.aiPerMonth} AI films; used the built-in director.` });
    }
    const settings = await readSettings();
    const spend = spendServerAi(req, { daily: settings.dailyBudget, perVisitor: who ? Number.MAX_SAFE_INTEGER : settings.perVisitor });
    if (!spend.ok) return film({ plan: c.builtin(), engine: "builtin", note: `${spend.reason}; used the built-in director. Add your own AI key for more.` });
    if (who && !(await spendAi(who))) return film({ plan: c.builtin(), engine: "builtin", note: "You've used this month's AI films; used the built-in director." });
  }

  try {
    const { schema, images, text, system } = await directorRequest(c);
    const started = Date.now();
    const result = await runDirector(ai, { system, text, images, schema });
    if (result === "refusal") {
      return film({ plan: c.builtin(), engine: "builtin", note: "AI director declined; used built-in director." });
    }
    // Self-review: Best mode always critiques and revises its draft; Balanced revises only
    // when the checklist finds real problems; Fast ships the first draft.
    let out = result as z.infer<typeof SitePlanSchema>;
    const issues = lintStoryboard(out, lintCtx);
    const mode = ai.mode ?? "balanced";
    let reviewed = "";
    // A slow model skips the review so the answer arrives inside the route's time limit.
    const slow = Date.now() - started > 90_000;
    if (!slow && (mode === "best" || (mode === "balanced" && issues.length))) {
      try {
        const revised = await runDirector(ai, { system, text: text + "\n" + reviewBrief(out, issues), images: [], schema });
        if (revised !== "refusal") {
          const left = lintStoryboard(revised as typeof out, lintCtx).length;
          if (left <= issues.length) {
            out = revised as typeof out;
            const fixed = issues.length - left;
            reviewed = fixed > 0 ? ` · self-reviewed, fixed ${fixed} issue${fixed > 1 ? "s" : ""}` : " · self-reviewed";
          }
        }
      } catch (err) {
        console.error("[generate] review pass failed, keeping draft:", err instanceof AiError ? err.message : (err as Error).name);
      }
    }
    return film({ plan: finishPlan(c, out), engine: "ai", engineLabel: describe(ai) + reviewed });
  } catch (err) {
    const message = err instanceof AiError ? err.message : (err as Error).name === "TimeoutError" ? "AI request timed out" : "AI director unavailable";
    console.error("[generate] falling back to built-in director:", message);
    return film({ plan: c.builtin(), engine: "builtin", note: `AI director error (${message}); used built-in director.` });
  }
}
