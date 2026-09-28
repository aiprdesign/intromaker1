import { z } from "zod/v4";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assetUrl } from "@/engine/assets";
import { AiError, describe, envClaudeAvailable, readAiConfig, runDirector, serverReachesLocal, type AiConfig } from "@/lib/ai";
import { SHOT_DIR } from "@/lib/capture";
import { lintStoryboard, repairStoryboard, reviewBrief } from "@/lib/review";
import { PALETTES } from "@/engine/palettes";
import {
  beatSync,
  brandFromSite,
  LENGTH_SECONDS,
  planFromPrompt,
  isSaasPrompt,
  ANGLES,
  type Angle,
  planFromSite,
  readSite,
  sanitizePlan,
  type Length,
  type PlanRequest,
  type StyleChoice,
} from "@/engine/planner";
import { SKILLS } from "@/engine/skills";
import { applyTemplate, DEFAULT_TEMPLATE, TEMPLATE_MAP } from "@/engine/templates";
import { DEMOS, detectConcept } from "@/engine/concepts";
import { writeVoiceover } from "@/engine/script";
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

const SYSTEM = `You are the creative director of IntroMaker, a motion-graphics engine. You turn a user's prompt into a storyboard of scenes. Each scene is rendered by one "skill" — a pre-built, high-end animated effect that animates the scene's headline text.

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
SAAS: a world-class product-launch film in the style of Linear, Vercel, Stripe and Apple keynotes. Rules:
- Font "inter". Copy in sentence case, 3-9 words, confident and concrete; wrap the key word in *asterisks* for the brand gradient ("Close deals at the speed of *thought*").
- Narrative: hook (the promise, or pain-strike with 2-4 real pains → the better way) → brand (logo-reveal or particle-assemble) → product in action (ui-tour with 2 callout items or ui-cards over real media, and/or ONE interaction moment) → features (bento with 3-6 items, each "Short title — one-line benefit" using the site's own feature descriptions) → proof (testimonial ONLY with a real quote; logo-marquee ONLY with real customer logos; stats in ui-cards/number-ticker) → integrations if relevant → cta (subtext = the button label) last.
- Interaction moments — the best launch films SHOW the product doing something. Use at most one per film, matched to the product: command-k (keyboard-first dev/productivity tools; items = commands, the first is a real feature that runs), ai-prompt (AI products; items[0] = the prompt, subtext = the answer in the product's voice, items[1..3] = real capabilities), click-flow (automation; subtext = the button label, items = 3-5 tasks it completes), notify-stack (sales, e-commerce, security, messaging; items = 3-5 "Event — detail" notifications). chart-grow shows ONE real metric (subtext = the stat, e.g. "30,000+ businesses").
- Prefer these skills: site-scroll, steps, icon-features, command-k, ai-prompt, click-flow, notify-stack, chart-grow, blur-reveal, word-swap ("Ship faster|smarter|together"), pain-strike, ui-tour, bento, ui-cards, integrations, testimonial, logo-marquee, cta, logo-reveal. Avoid neon/retro/glitch/shockwave/kinetic-slam.
- Transitions: dolly, whip, push, dissolve, leak, cut. bpm 112-126. Durations: hooks 3-3.5s, ui-tour 5.5-6.5s, bento 4.5-5s, others 3.5-4.5s.
- Never invent customer names, quotes, logos or statistics.
- Vary skills so no two consecutive scenes use the same one, and pick skills whose aesthetic fits the prompt's mood. Save the most spectacular skills (god-rays, shockwave, particle-assemble, glass-shatter, warp-tunnel) for the hook, title and outro.
- Vary transitions; don't repeat the same one back to back. Use whip/flash/glitch for energy, dolly/leak/shutter for cinematic moments.
- Choose the palette, font and bpm that match the mood: 128-145 bpm for hype/action/gaming, 110-125 for tech/launches, 85-100 for luxury/calm/documentary.
- Hit the requested total length (sum of durations) within ±1.5 seconds.
- Voice-over ("vo"): write the narrator's line for every scene as one flowing script, like a launch-film voice-over: warm, confident, second person, plain words. Each line must be speakable within its scene (about 2.5 words per second, minus half a second), may paraphrase but never add claims, and should complement rather than just read out the headline where there's room. Say the brand name on the reveal ("Meet Nimbus."). Leave vo empty on testimonial scenes so the quote reads.`;

function hasCredentials() {
  return envClaudeAvailable();
}

export async function GET() {
  return Response.json({
    ai: hasCredentials(),
    model: hasCredentials() ? process.env.INTROMAKER_MODEL || "claude-opus-5" : null,
    // Local AI goes through this server only when it runs on the user's machine.
    localViaServer: serverReachesLocal(),
  });
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
    const id = src.match(/id=([a-f0-9]{16}-(?:hero|full|s\d|p\d{1,2}))$/)?.[1];
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

type Body = Partial<PlanRequest> & {
  site?: unknown;
  colors?: Brand["colors"];
  style?: StyleChoice;
  ai?: unknown;
  template?: string;
  angle?: unknown;
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

function readBody(body: Body) {
  const prompt = String(body.prompt ?? "").slice(0, 1000);
  const aspect: Aspect = body.aspect === "9:16" || body.aspect === "1:1" ? body.aspect : "16:9";
  const length: Length = body.length === "short" || body.length === "long" ? body.length : "standard";
  const palette: PaletteId | "auto" = (PALETTE_IDS as readonly string[]).includes(body.palette as string) ? (body.palette as PaletteId) : "auto";
  const seed = Number(body.seed) || undefined;
  const site = readSite(body.site);
  const colors =
    body.colors && /^#[0-9a-f]{6}$/i.test(body.colors.primary) && /^#[0-9a-f]{6}$/i.test(body.colors.secondary) ? body.colors : undefined;
  const style: StyleChoice = body.style === "saas" || body.style === "trailer" ? body.style : "auto";
  const template = typeof body.template === "string" && TEMPLATE_MAP[body.template] ? body.template : DEFAULT_TEMPLATE;
  const angle = ANGLES.find((a) => a.id === body.angle)?.id as Angle | undefined;
  const wantSaas = style === "saas" || (style === "auto" && (site ? true : isSaasPrompt(prompt)));
  const request: PlanRequest = { prompt, aspect, length, palette, seed, style, template };
  const concept = site
    ? detectConcept(`${site.name} ${site.tagline} ${site.description}`, [...site.headlines, ...site.features, ...site.steps, ...site.pains].join(" "))
    : detectConcept(prompt);
  const builtin = () => (site ? planFromSite(site, { aspect, length, palette, seed, colors, style, template, angle }) : planFromPrompt(request));
  return { prompt, aspect, length, palette, seed, site, colors, style, template, angle, wantSaas, builtin, concept };
}
type Ctx = ReturnType<typeof readBody>;

/** Everything the AI director is sent: system prompt, brief, screenshots and output schema. */
async function directorRequest(c: Ctx) {
  const schema = c.site ? SitePlanSchema : PlanSchema;
  const images = c.site ? await siteImages(c.site) : [];
  const text =
    (c.site ? `${images.length ? "The attached images are screenshots of the website — use them to understand the product, its look and which assets best show it. Screenshot order matches ASSETS: hero first, then sections.\n\n" : ""}${siteBrief(c.site)}\n\n` : "") +
    (c.prompt ? `Prompt: ${c.prompt}\n\n` : "") +
    `Style: ${c.wantSaas ? "SAAS" : "TRAILER"}. Aspect ratio: ${c.aspect}. Target total length: ${LENGTH_SECONDS[c.length]} seconds.` +
    (c.wantSaas ? `\nSTYLE TEMPLATE "${TEMPLATE_MAP[c.template].name}": ${TEMPLATE_MAP[c.template].vibe} Write copy in this voice.` : "") +
    (c.wantSaas ? `\nINTERACTION MOMENT for this product: ${DEMOS[c.concept.id]?.skill ?? DEMOS.general.skill} (e.g. headline "${(DEMOS[c.concept.id] ?? DEMOS.general).title.replace(/\*/g, "")}"); fill it from the product's real features.` : "") +
    (c.wantSaas && c.concept.id !== "general"
      ? `\nPRODUCT CATEGORY: ${c.concept.name}. Follow this category's typical launch-film arc: ${c.concept.arc.filter((r) => r !== "bento" && r !== "stat").join(" → ")} (skip beats without material). Use icon-features for the key features (items "Title — one-line benefit"; icons are picked from the wording). CTA in this voice, e.g. "${c.concept.cta[0].replace(/\{name\}/g, c.site?.name ?? "the product").replace(/\*/g, "")}".`
      : "") +
    (c.palette !== "auto" ? ` Use the "${c.palette}" palette.` : "") +
    (c.angle ? `\nCREATIVE ANGLE "${ANGLES.find((a) => a.id === c.angle)!.name}": ${ANGLES.find((a) => a.id === c.angle)!.brief}` : "") +
    (c.seed ? ` Variation #${c.seed % 1000}: take a fresh creative angle.` : "");
  const system = c.site ? SYSTEM + "\n" + SITE_RULES : SYSTEM;
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
  return writeVoiceover(styled);
}

/** Validate model output against the storyboard schema (tolerating small deviations). */
function readDraft(schema: z.ZodType, raw: unknown): z.infer<typeof SitePlanSchema> | null {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data as z.infer<typeof SitePlanSchema>;
  const o = raw as { scenes?: unknown };
  return o && typeof o === "object" && Array.isArray(o.scenes) && o.scenes.length ? (raw as z.infer<typeof SitePlanSchema>) : null;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const c = readBody(body);
  const lintCtx = { site: c.site, targetSeconds: LENGTH_SECONDS[c.length] };

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
    if (!draft) return Response.json({ plan: c.builtin(), engine: "builtin", note: "The local model's reply wasn't a storyboard; used built-in director." });
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
    return Response.json({ plan: finishPlan(c, out), engine: "ai", engineLabel: `${label}${reviewed}` });
  }

  // Which AI runs the director: the user's own key/provider, else a server Claude key, else built-in.
  const userAi = readAiConfig(body.ai);
  const ai: AiConfig | null =
    userAi && userAi.provider !== "builtin"
      ? userAi
      : !userAi && hasCredentials()
        ? { provider: "anthropic", mode: "balanced", images: true }
        : null;
  if (!ai || (!c.prompt.trim() && !c.site)) {
    return Response.json({ plan: c.builtin(), engine: "builtin" });
  }

  try {
    const { schema, images, text, system } = await directorRequest(c);
    const result = await runDirector(ai, { system, text, images, schema });
    if (result === "refusal") {
      return Response.json({ plan: c.builtin(), engine: "builtin", note: "AI director declined; used built-in director." });
    }
    // Self-review: Best mode always critiques and revises its draft; Balanced revises only
    // when the checklist finds real problems; Fast ships the first draft.
    let out = result as z.infer<typeof SitePlanSchema>;
    const issues = lintStoryboard(out, lintCtx);
    const mode = ai.mode ?? "balanced";
    let reviewed = "";
    if (mode === "best" || (mode === "balanced" && issues.length)) {
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
    return Response.json({ plan: finishPlan(c, out), engine: "ai", engineLabel: describe(ai) + reviewed });
  } catch (err) {
    const message = err instanceof AiError ? err.message : (err as Error).name === "TimeoutError" ? "AI request timed out" : "AI director unavailable";
    console.error("[generate] falling back to built-in director:", message);
    return Response.json({ plan: c.builtin(), engine: "builtin", note: `AI director error (${message}); used built-in director.` });
  }
}
