import { z } from "zod/v4";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assetUrl } from "@/engine/assets";
import { AiError, describe, envClaudeAvailable, readAiConfig, runDirector, type AiConfig } from "@/lib/ai";
import { SHOT_DIR } from "@/lib/capture";
import { PALETTES } from "@/engine/palettes";
import {
  beatSync,
  brandFromSite,
  LENGTH_SECONDS,
  planFromPrompt,
  isSaasPrompt,
  planFromSite,
  readSite,
  sanitizePlan,
  type Length,
  type PlanRequest,
  type StyleChoice,
} from "@/engine/planner";
import { SKILLS } from "@/engine/skills";
import { applyTemplate, DEFAULT_TEMPLATE, TEMPLATE_MAP } from "@/engine/templates";
import { FONTS, PALETTE_IDS, SKILL_IDS, TRANSITIONS, type Aspect, type Brand, type Media, type PaletteId, type SiteData } from "@/engine/types";

export const runtime = "nodejs";
export const maxDuration = 120;



const SceneSchema = z.object({
  skill: z.enum(SKILL_IDS),
  text: z.string().describe("Headline. Trailer style: UPPERCASE 1-4 words. SaaS style: sentence case, 3-9 words, *accent* key word"),
  items: z.array(z.string()).describe("List content for bento/ui-tour/ui-cards/pain-strike/steps/word-swap; else []"),
  eyebrow: z.string().describe("SaaS chapter label shown above the headline (e.g. 'How it works'), or empty"),
  subtext: z.string().describe("Optional supporting line, max ~40 characters, or empty string"),
  duration: z.number().describe("Seconds, 2-5"),
  transition: z.enum(TRANSITIONS),
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

const SYSTEM = `You are the creative director of IntroMaker, a motion-graphics engine. You turn a user's prompt into a storyboard of scenes. Each scene is rendered by one "skill" — a pre-built, high-end animated effect that animates the scene's headline text.

Available skills:
${SKILLS.map((s) => `- ${s.id} (${s.name}): ${s.tagline} Best for: ${s.bestFor}`).join("\n")}

Palettes: ${PALETTE_IDS.map((id) => `${id} (${PALETTES[id].name})`).join(", ")}.
Fonts: anton (tall condensed, trailer/impact), grotesk (modern geometric, tech/premium).
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
SAAS: a world-class product-launch film in the style of Linear, Vercel, Stripe and Apple keynotes. Rules:
- Font "inter". Copy in sentence case, 3-9 words, confident and concrete; wrap the key word in *asterisks* for the brand gradient ("Close deals at the speed of *thought*").
- Narrative: hook (the promise, or pain-strike with 2-4 real pains → the better way) → brand (logo-reveal or particle-assemble) → product (ui-tour with 2 callout items, or ui-cards) → features (bento with 3-6 short feature items) → proof (testimonial ONLY with a real quote; logo-marquee ONLY with real customer logos; stats in ui-cards/number-ticker) → integrations if relevant → cta (subtext = the button label) last.
- Prefer these skills: site-scroll, steps, blur-reveal, word-swap ("Ship faster|smarter|together"), pain-strike, ui-tour, bento, ui-cards, integrations, testimonial, logo-marquee, cta, logo-reveal. Avoid neon/retro/glitch/shockwave/kinetic-slam.
- Transitions: dolly, whip, push, dissolve, leak, cut. bpm 112-126. Durations: hooks 3-3.5s, ui-tour 5.5-6.5s, bento 4.5-5s, others 3.5-4.5s.
- Never invent customer names, quotes, logos or statistics.
- Vary skills so no two consecutive scenes use the same one, and pick skills whose aesthetic fits the prompt's mood. Save the most spectacular skills (god-rays, shockwave, particle-assemble, glass-shatter, warp-tunnel) for the hook, title and outro.
- Vary transitions; don't repeat the same one back to back. Use whip/flash/glitch for energy, dolly/leak/shutter for cinematic moments.
- Choose the palette, font and bpm that match the mood: 128-145 bpm for hype/action/gaming, 110-125 for tech/launches, 85-100 for luxury/calm/documentary.
- Hit the requested total length (sum of durations) within ±1.5 seconds.`;

function hasCredentials() {
  return envClaudeAvailable();
}

export async function GET() {
  return Response.json({ ai: hasCredentials(), model: hasCredentials() ? process.env.INTROMAKER_MODEL || "claude-opus-5" : null });
}

function siteAssets(site: SiteData): { media: Media; label: string }[] {
  const brand = brandFromSite(site);
  const sh = site.shots ?? { hero: null, full: null, sections: [] };
  return [
    ...(sh.full ? [{ media: { src: sh.full, kind: "image" as const }, label: "FULL-PAGE screenshot of the website (use with site-scroll)" }] : []),
    ...(sh.hero ? [{ media: { src: sh.hero, kind: "image" as const }, label: "hero screenshot of the website (above the fold)" }] : []),
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
- Use the site's real name, claims, features and stats as copy (shortened into trailer cards).
- If a logo is available, use logo-reveal for the brand reveal and the outro (headline = brand name).
- Show the real product: include a product-showcase scene with the best hero image or video (set "media" to its ASSETS index).
- Use photo-montage for feature beats over other images (each with its own "media" index), and screen-wall once when there are 3+ images.
- For every other skill set "media" to -1. End with a cta scene whose subtext is the site's real call-to-action label.
- testimonial: use a quote from TESTIMONIALS verbatim (text = quote, subtext = "Name · Role"). logo-marquee only if CUSTOMER LOGOS > 0.
- Tell ONE coherent story with a clear arc, each scene setting up the next, with an "eyebrow" chapter label:
  1 Hook ("The old way": pain-strike with the real pains → "There's a *better* way", or blur-reveal with the promise)
  2 Reveal (logo-reveal, subtext = the promise) 3 Meet (site-scroll on the FULL-PAGE screenshot, eyebrow "Meet <Name>")
  4 How it works (steps with the real steps) 5 Features (ui-tour on the best product image/video with 2 callouts; bento)
  6 Proof ("Loved by teams" testimonial, "Customers" logo-marquee, "Results" ui-cards with real stats) 7 Integrations 8 CTA.
  Skip beats the site has no material for. Keep copy consistent: one voice, one promise, recurring brand name.`;

/** Screenshots the AI should look at: the hero plus a few page sections (vision input). */
async function siteImages(site: SiteData) {
  const sh = site.shots ?? { hero: null, full: null, sections: [] };
  const picks = [sh.hero, ...sh.sections.slice(0, 3)].filter((x): x is string => !!x);
  const out: { data: string; mediaType: "image/jpeg" }[] = [];
  for (const src of picks) {
    const id = src.match(/id=([a-f0-9]{16}-(?:hero|full|s\d))$/)?.[1];
    if (!id) continue;
    try {
      const data = await readFile(join(SHOT_DIR, `${id}.jpg`));
      if (data.length <= 4_500_000) out.push({ data: data.toString("base64"), mediaType: "image/jpeg" });
    } catch {
      /* screenshot expired */
    }
  }
  return out;
}

export async function POST(req: Request) {
  let body: Partial<PlanRequest> & { site?: unknown; colors?: Brand["colors"]; style?: StyleChoice; ai?: unknown; template?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const prompt = String(body.prompt ?? "").slice(0, 1000);
  const aspect: Aspect = body.aspect === "9:16" || body.aspect === "1:1" ? body.aspect : "16:9";
  const length: Length = body.length === "short" || body.length === "long" ? body.length : "standard";
  const palette = (PALETTE_IDS as readonly string[]).includes(body.palette as string)
    ? (body.palette as PaletteId)
    : "auto";
  const seed = Number(body.seed) || undefined;
  const site = readSite(body.site);
  const colors =
    body.colors && /^#[0-9a-f]{6}$/i.test(body.colors.primary) && /^#[0-9a-f]{6}$/i.test(body.colors.secondary)
      ? body.colors
      : undefined;
  const style: StyleChoice = body.style === "saas" || body.style === "trailer" ? body.style : "auto";
  const template = typeof body.template === "string" && TEMPLATE_MAP[body.template] ? body.template : DEFAULT_TEMPLATE;
  const request: PlanRequest = { prompt, aspect, length, palette, seed, style, template };
  const wantSaas = style === "saas" || (style === "auto" && (site ? true : isSaasPrompt(prompt)));

  const builtin = () =>
    site ? planFromSite(site, { aspect, length, palette, seed, colors, style, template }) : planFromPrompt(request);

  // Which AI runs the director: the user's own key/provider, else a server Claude key, else built-in.
  const userAi = readAiConfig(body.ai);
  const ai: AiConfig | null =
    userAi && userAi.provider !== "builtin"
      ? userAi
      : !userAi && hasCredentials()
        ? { provider: "anthropic", mode: "balanced", images: true }
        : null;
  if (!ai || (!prompt.trim() && !site)) {
    return Response.json({ plan: builtin(), engine: "builtin" });
  }

  try {
    const schema = site ? SitePlanSchema : PlanSchema;
    const images = site ? await siteImages(site) : [];
    const text =
      (site ? `${images.length ? "The attached images are screenshots of the website — use them to understand the product, its look and which assets best show it. Screenshot order matches ASSETS: hero first, then sections.\n\n" : ""}${siteBrief(site)}\n\n` : "") +
      (prompt ? `Prompt: ${prompt}\n\n` : "") +
      `Style: ${wantSaas ? "SAAS" : "TRAILER"}. Aspect ratio: ${aspect}. Target total length: ${LENGTH_SECONDS[length]} seconds.` +
      (wantSaas ? `\nSTYLE TEMPLATE "${TEMPLATE_MAP[template].name}": ${TEMPLATE_MAP[template].vibe} Write copy in this voice.` : "") +
      (palette !== "auto" ? ` Use the "${palette}" palette.` : "") +
      (seed ? ` Variation #${seed % 1000}: take a fresh creative angle.` : "");
    const result = await runDirector(ai, { system: site ? SYSTEM + "\n" + SITE_RULES : SYSTEM, text, images, schema });
    if (result === "refusal") {
      return Response.json({ plan: builtin(), engine: "builtin", note: "AI director declined; used built-in director." });
    }
    const out = result as z.infer<typeof SitePlanSchema>;
    const brand = site ? brandFromSite(site, colors) : undefined;
    const assets: Media[] = site ? siteAssets(site).map((a) => a.media) : [];
    const directed = beatSync(
      sanitizePlan({
        ...out,
        aspect,
        palette: palette !== "auto" ? palette : out.palette,
        seed: seed ?? Math.floor(Math.random() * 1e9),
        brand,
        style: out.style,
        scenes: out.scenes.map((s) => {
          const idx = "media" in s ? (s.media as number) : -1;
          // Testimonials get the real author's avatar when the quote matches the site's.
          const q = site?.testimonials.find((x) => s.skill === "testimonial" && x.avatar && s.text.includes(x.quote.slice(0, 40)));
          const media = q?.avatar ? { src: assetUrl(q.avatar), kind: "image" as const } : assets[idx];
          return { ...s, subtext: s.subtext || undefined, items: s.items?.length ? s.items : undefined, eyebrow: s.eyebrow || undefined, media };
        }),
      }),
    );
    // SaaS films get the chosen template's look, music, pacing and role skills.
    const plan = wantSaas
      ? applyTemplate({ ...directed, brand: directed.brand }, template, { palette: palette !== "auto" ? palette : undefined })
      : directed;
    return Response.json({ plan, engine: "ai", engineLabel: describe(ai) });
  } catch (err) {
    const message = err instanceof AiError ? err.message : (err as Error).name === "TimeoutError" ? "AI request timed out" : "AI director unavailable";
    console.error("[generate] falling back to built-in director:", message);
    return Response.json({ plan: builtin(), engine: "builtin", note: `AI director error (${message}); used built-in director.` });
  }
}
