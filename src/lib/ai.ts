import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { assertPublicUrl } from "./netguard";

/**
 * Bring-your-own-key AI director. Claude runs through the Anthropic SDK with structured output;
 * OpenAI, OpenRouter and any OpenAI-compatible endpoint (Groq, DeepSeek, Mistral, Together,
 * Ollama, LM Studio…) use /chat/completions JSON mode; Gemini uses generateContent JSON mode.
 * Keys come from the user's browser per request (or the server env for Claude) and are never logged.
 */

export const PROVIDERS = ["builtin", "anthropic", "openai", "gemini", "openrouter", "custom"] as const;
export type Provider = (typeof PROVIDERS)[number];
export type Mode = "fast" | "balanced" | "best";

export interface AiConfig {
  provider: Provider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  mode?: Mode;
  /** Send website screenshots to vision-capable models. */
  images?: boolean;
}

export const DEFAULT_MODELS: Record<Exclude<Provider, "builtin">, string> = {
  anthropic: "claude-opus-5",
  openai: "gpt-4.1",
  gemini: "gemini-2.5-flash",
  openrouter: "anthropic/claude-sonnet-5",
  custom: "llama3.1",
};

export class AiError extends Error {}

export interface DirectorCall<T extends z.ZodType> {
  system: string;
  text: string;
  images: { data: string; mediaType: "image/jpeg" }[];
  schema: T;
}

/** Validate an untrusted config from the browser. */
export function readAiConfig(raw: unknown): AiConfig | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return null;
  const provider = (PROVIDERS as readonly string[]).includes(r.provider as string) ? (r.provider as Provider) : null;
  if (!provider) return null;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  return {
    provider,
    apiKey: str(r.apiKey, 400),
    model: str(r.model, 120)?.replace(/[^\w.:/@\-]/g, ""),
    baseUrl: str(r.baseUrl, 300),
    mode: r.mode === "fast" || r.mode === "best" ? r.mode : "balanced",
    images: r.images !== false,
  };
}

export function envClaudeAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Strip anything that looks like a secret from provider error text before showing it. */
function redact(msg: string, key?: string) {
  let out = msg.slice(0, 300);
  if (key && key.length > 6) out = out.split(key).join("•••");
  return out.replace(/\b(sk|gsk|AIza|xai|or)-?[A-Za-z0-9_\-]{8,}/g, "•••");
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AiError("The model didn't return JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Parse against the schema; if the model was slightly off-spec, keep what's usable. */
function coerce<T extends z.ZodType>(schema: T, obj: unknown): z.infer<T> {
  const parsed = schema.safeParse(obj);
  if (parsed.success) return parsed.data;
  const o = obj as Record<string, unknown>;
  if (o && typeof o === "object" && Array.isArray(o.scenes)) return o as z.infer<T>;
  if (o && typeof o === "object" && "ok" in o) return o as z.infer<T>;
  throw new AiError("The model's JSON didn't match the storyboard format.");
}

const EFFORT: Record<Mode, "low" | "medium" | "high"> = { fast: "low", balanced: "medium", best: "high" };

async function callClaude<T extends z.ZodType>(cfg: AiConfig, call: DirectorCall<T>): Promise<z.infer<T> | "refusal"> {
  const key = cfg.apiKey;
  if (!key && !envClaudeAvailable()) throw new AiError("Add an Anthropic API key in AI settings.");
  const client = new Anthropic(key ? { apiKey: key } : {});
  const model = cfg.model || process.env.INTROMAKER_MODEL || DEFAULT_MODELS.anthropic;
  // Model families differ: Haiku 4.5 has no adaptive thinking/effort; server-side fallbacks
  // apply to the models with safety classifiers (Opus 5 / Fable).
  const adaptive = !/haiku/i.test(model);
  const fallbackCapable = /claude-(opus-5|fable-5)/.test(model);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (cfg.images !== false) {
    for (const img of call.images) content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  }
  content.push({ type: "text", text: call.text });
  try {
    const res = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      ...(adaptive ? { thinking: { type: "adaptive" as const } } : {}),
      output_config: { ...(adaptive ? { effort: EFFORT[cfg.mode ?? "balanced"] } : {}), format: betaZodOutputFormat(call.schema) },
      ...(fallbackCapable ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      system: call.system,
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") return "refusal";
    if (!res.parsed_output) throw new AiError("Claude returned an empty storyboard.");
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("Anthropic rejected the API key (401).");
    if (e instanceof Anthropic.NotFoundError) throw new AiError(`Unknown Claude model "${model}".`);
    if (e instanceof Anthropic.RateLimitError) throw new AiError("Anthropic rate limit reached — try again shortly.");
    if (e instanceof Anthropic.APIError) throw new AiError(`Anthropic error ${e.status ?? ""}: ${redact(e.message, key)}`);
    throw e;
  }
}

async function checkBaseUrl(base: string) {
  const allowLocal = process.env.NODE_ENV !== "production" || process.env.INTROMAKER_ALLOW_PRIVATE_URLS === "1";
  const url = new URL(base);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new AiError("Base URL must be http(s).");
  // Local model servers (Ollama, LM Studio) are fine on your own machine; not on a public deployment.
  if (!allowLocal) await assertPublicUrl(base).catch(() => {
    throw new AiError("That base URL isn't reachable from this server.");
  });
}

async function callOpenAiCompatible<T extends z.ZodType>(cfg: AiConfig, call: DirectorCall<T>): Promise<z.infer<T>> {
  const base =
    cfg.provider === "openai"
      ? "https://api.openai.com/v1"
      : cfg.provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : (cfg.baseUrl ?? "").replace(/\/+$/, "");
  if (!base) throw new AiError("Add the base URL of your OpenAI-compatible endpoint.");
  if (cfg.provider === "custom") await checkBaseUrl(base);
  if (!cfg.apiKey && cfg.provider !== "custom") throw new AiError("Add your API key in AI settings.");
  const model = cfg.model || DEFAULT_MODELS[cfg.provider as "openai" | "openrouter" | "custom"];
  const schemaText = JSON.stringify(z.toJSONSchema(call.schema));
  const instruction = `\n\nRespond with ONLY a JSON object (no prose, no markdown) that matches this JSON Schema:\n${schemaText}`;

  const attempt = async (withImages: boolean, jsonMode: boolean) => {
    const userContent = [
      { type: "text", text: call.text + instruction },
      ...(withImages ? call.images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mediaType};base64,${i.data}` } })) : []),
    ];
    return fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        ...(cfg.provider === "openrouter" ? { "HTTP-Referer": "https://intromaker.local", "X-Title": "IntroMaker" } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: call.system },
          { role: "user", content: withImages ? userContent : call.text + instruction },
        ],
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(180_000),
    });
  };

  let images = cfg.images !== false && call.images.length > 0;
  let jsonMode = true;
  let res = await attempt(images, jsonMode);
  // Older/local models may not support images or JSON mode: degrade gracefully.
  for (let i = 0; i < 2 && res.status === 400; i++) {
    const body = await res.text();
    if (images) images = false;
    else if (jsonMode && /response_format|json/i.test(body)) jsonMode = false;
    else throw new AiError(`Provider error 400: ${redact(body, cfg.apiKey)}`);
    res = await attempt(images, jsonMode);
  }
  if (res.status === 401 || res.status === 403) throw new AiError("The provider rejected the API key.");
  if (res.status === 404) throw new AiError(`Model "${model}" or endpoint not found.`);
  if (res.status === 429) throw new AiError("Provider rate limit or quota reached.");
  if (!res.ok) throw new AiError(`Provider error ${res.status}: ${redact(await res.text(), cfg.apiKey)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  return coerce(call.schema, extractJson(text));
}

async function callGemini<T extends z.ZodType>(cfg: AiConfig, call: DirectorCall<T>): Promise<z.infer<T>> {
  if (!cfg.apiKey) throw new AiError("Add your Google AI Studio API key in AI settings.");
  const model = cfg.model || DEFAULT_MODELS.gemini;
  const schemaText = JSON.stringify(z.toJSONSchema(call.schema));
  const attempt = (withImages: boolean) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: call.system }] },
        contents: [
          {
            role: "user",
            parts: [
              ...(withImages ? call.images.map((i) => ({ inline_data: { mime_type: i.mediaType, data: i.data } })) : []),
              { text: `${call.text}\n\nRespond with ONLY a JSON object matching this JSON Schema:\n${schemaText}` },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(180_000),
    });
  let res = await attempt(cfg.images !== false && call.images.length > 0);
  if (res.status === 400 && call.images.length) res = await attempt(false);
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    const body = await res.text();
    if (/API key|API_KEY/i.test(body)) throw new AiError("Google rejected the API key.");
    throw new AiError(`Gemini error ${res.status}: ${redact(body, cfg.apiKey)}`);
  }
  if (res.status === 404) throw new AiError(`Gemini model "${model}" not found.`);
  if (res.status === 429) throw new AiError("Gemini rate limit or quota reached.");
  if (!res.ok) throw new AiError(`Gemini error ${res.status}: ${redact(await res.text(), cfg.apiKey)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  return coerce(call.schema, extractJson(text));
}

/** Run the director on the configured provider. Returns "refusal" if Claude declined. */
export async function runDirector<T extends z.ZodType>(cfg: AiConfig, call: DirectorCall<T>): Promise<z.infer<T> | "refusal"> {
  try {
    return await dispatch(cfg, call);
  } catch (e) {
    if (e instanceof AiError) throw e;
    if ((e as Error).name === "TimeoutError") throw new AiError("The AI took too long to answer.");
    if (e instanceof TypeError) throw new AiError(`Couldn't reach ${cfg.provider === "custom" ? cfg.baseUrl : cfg.provider} — check the URL and your connection.`);
    if (e instanceof SyntaxError) throw new AiError("The model returned malformed JSON.");
    throw e;
  }
}

function dispatch<T extends z.ZodType>(cfg: AiConfig, call: DirectorCall<T>): Promise<z.infer<T> | "refusal"> {
  switch (cfg.provider) {
    case "anthropic":
      return callClaude(cfg, call);
    case "gemini":
      return callGemini(cfg, call);
    case "openai":
    case "openrouter":
    case "custom":
      return callOpenAiCompatible(cfg, call);
    default:
      throw new AiError("No AI provider selected.");
  }
}

export function describe(cfg: AiConfig) {
  const names: Record<Provider, string> = {
    builtin: "Built-in director",
    anthropic: "Claude",
    openai: "OpenAI",
    gemini: "Gemini",
    openrouter: "OpenRouter",
    custom: "Custom model",
  };
  const model = cfg.provider === "builtin" ? "" : cfg.model || (cfg.provider === "anthropic" ? process.env.INTROMAKER_MODEL : "") || DEFAULT_MODELS[cfg.provider];
  return model ? `${names[cfg.provider]} · ${model}` : names[cfg.provider];
}
