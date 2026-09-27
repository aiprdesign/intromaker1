import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { PALETTES } from "@/engine/palettes";
import { LENGTH_SECONDS, planFromPrompt, sanitizePlan, type Length, type PlanRequest } from "@/engine/planner";
import { SKILLS } from "@/engine/skills";
import { FONTS, PALETTE_IDS, SKILL_IDS, TRANSITIONS, type Aspect, type PaletteId } from "@/engine/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.INTROMAKER_MODEL || "claude-opus-5";

const PlanSchema = z.object({
  title: z.string().describe("Short project title"),
  palette: z.enum(PALETTE_IDS),
  font: z.enum(FONTS),
  bpm: z.number().int().describe("Soundtrack tempo, 80-150"),
  scenes: z.array(
    z.object({
      skill: z.enum(SKILL_IDS),
      text: z.string().describe("Headline, UPPERCASE, 1-4 words, max ~20 characters"),
      subtext: z.string().describe("Optional supporting line, max ~40 characters, or empty string"),
      duration: z.number().describe("Seconds, 2-5"),
      transition: z.enum(TRANSITIONS),
    }),
  ),
});

const SYSTEM = `You are the creative director of IntroMaker, a motion-graphics engine. You turn a user's prompt into a storyboard of scenes. Each scene is rendered by one "skill" — a pre-built, high-end animated effect that animates the scene's headline text.

Available skills:
${SKILLS.map((s) => `- ${s.id} (${s.name}): ${s.tagline} Best for: ${s.bestFor}`).join("\n")}

Palettes: ${PALETTE_IDS.map((id) => `${id} (${PALETTES[id].name})`).join(", ")}.
Fonts: anton (tall condensed, trailer/impact), grotesk (modern geometric, tech/premium).
Transitions (how a scene enters): cut, flash, zoom, glitch, wipe.

How to direct an epic, modern piece:
- Structure: a hook that builds anticipation → the main title/brand reveal → 2-5 punchy beats (features, benefits, stats, emotions) → a final brand lock-up outro with a call to action in the subtext.
- Headlines are short and punchy (1-4 words). Pull real names, claims and numbers from the prompt; invent tasteful copy only where the prompt is thin.
- Use number-ticker only when the headline contains a number.
- Vary skills so no two consecutive scenes use the same one, and pick skills whose aesthetic fits the prompt's mood.
- Choose the palette, font and bpm that match the mood. Faster bpm for hype, slower for luxury/calm.
- Hit the requested total length (sum of durations) within ±1.5 seconds.`;

function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function GET() {
  return Response.json({ ai: hasCredentials(), model: hasCredentials() ? MODEL : null });
}

export async function POST(req: Request) {
  let body: Partial<PlanRequest>;
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
  const request: PlanRequest = { prompt, aspect, length, palette, seed };

  const builtin = () => planFromPrompt(request);

  if (!hasCredentials() || !prompt.trim()) {
    return Response.json({ plan: builtin(), engine: "builtin" });
  }

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(PlanSchema) },
      // Server-side fallback: if the model declines, Anthropic re-runs on its recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Prompt: ${prompt}\n\nAspect ratio: ${aspect}. Target total length: ${LENGTH_SECONDS[length]} seconds.` +
            (palette !== "auto" ? ` Use the "${palette}" palette.` : "") +
            (seed ? ` Variation #${seed % 1000}: take a fresh creative angle.` : ""),
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ plan: builtin(), engine: "builtin", note: "AI director declined; used built-in director." });
    }
    const out = response.parsed_output;
    const plan = sanitizePlan({
      ...out,
      aspect,
      palette: palette !== "auto" ? palette : out.palette,
      seed: seed ?? Math.floor(Math.random() * 1e9),
      scenes: out.scenes.map((s) => ({ ...s, subtext: s.subtext || undefined })),
    });
    return Response.json({ plan, engine: "claude" });
  } catch (err) {
    const message =
      err instanceof Anthropic.APIError ? `${err.status ?? ""} ${err.message}`.trim() : "AI director unavailable";
    console.error("[generate] falling back to built-in director:", message);
    return Response.json({ plan: builtin(), engine: "builtin", note: `AI director error (${message}); used built-in director.` });
  }
}
