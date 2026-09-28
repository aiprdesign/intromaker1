import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { assertPublicUrl } from "./netguard";
import { PRESET_MAP, PROVIDER_PRESETS, type ProviderPreset } from "./providers";

/**
 * Bring-your-own-key AI director. Claude runs through the Anthropic SDK with structured output;
 * every OpenAI-compatible provider in the registry (OpenAI, OpenRouter, xAI, Mistral, DeepSeek,
 * Groq, Together, Ollama, Azure… see providers.ts) uses /chat/completions JSON mode; Gemini uses
 * generateContent JSON mode.
 * Keys come from the user's browser per request (or the server env for Claude) and are never logged.
 */

/** "builtin" (no AI) or a provider id from the registry in providers.ts. */
export type Provider = string;
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

function presetOf(cfg: AiConfig): ProviderPreset {
  const p = PRESET_MAP[cfg.provider];
  if (!p) throw new AiError("No AI provider selected.");
  return p;
}

/** The model to use: the user's choice, else the provider's first suggestion. */
export function modelOf(cfg: AiConfig) {
  if (cfg.model) return cfg.model;
  if (cfg.provider === "anthropic" && process.env.INTROMAKER_MODEL) return process.env.INTROMAKER_MODEL;
  return PRESET_MAP[cfg.provider]?.models[0] ?? "";
}

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
  const provider = r.provider === "builtin" || PRESET_MAP[r.provider as string] ? (r.provider as Provider) : null;
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
export function redact(msg: string, key?: string) {
  let out = msg.slice(0, 300);
  if (key && key.length > 6) out = out.split(key).join("•••");
  return out.replace(/\b(sk|gsk|AIza|xai|or|hf|pplx|nvapi|csk|fw)[-_]?[A-Za-z0-9_\-]{8,}/g, "•••");
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
  const model = modelOf(cfg);
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

/**
 * Can this server reach the user's local model servers (localhost)? True when it runs on the
 * user's own machine (dev mode or INTROMAKER_ALLOW_PRIVATE_URLS=1). An online deployment can't,
 * so local AI then runs from the user's browser instead.
 */
export function serverReachesLocal() {
  if (process.env.INTROMAKER_HOSTED === "1") return false;
  return process.env.NODE_ENV !== "production" || process.env.INTROMAKER_ALLOW_PRIVATE_URLS === "1";
}

/** Probe the known local model servers (Ollama, LM Studio, llama.cpp, Jan, vLLM…) for models. */
export async function scanLocal() {
  const found: { id: string; name: string; baseUrl: string; models: string[] }[] = [];
  await Promise.all(
    PROVIDER_PRESETS.filter((p) => p.group === "Local" && p.baseUrl).map(async (p) => {
      try {
        const res = await fetch(`${p.baseUrl}/models`, { signal: AbortSignal.timeout(1500) });
        if (!res.ok) return;
        const data = (await res.json()) as { data?: { id: string }[] };
        found.push({ id: p.id, name: p.name, baseUrl: p.baseUrl!, models: (data.data ?? []).map((m) => m.id).filter(Boolean).slice(0, 50) });
      } catch {
        /* not running */
      }
    }),
  );
  return found;
}

export async function checkBaseUrl(base: string) {
  const allowLocal = serverReachesLocal();
  const url = new URL(base);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new AiError("Base URL must be http(s).");
  // Local model servers (Ollama, LM Studio) are fine on your own machine; not on a public deployment.
  if (!allowLocal) await assertPublicUrl(base).catch(() => {
    throw new AiError("That base URL isn't reachable from this server.");
  });
}

/** Resolve an OpenAI-compatible endpoint: base URL (validated when user-supplied) and auth headers. */
async function openAiEndpoint(cfg: AiConfig) {
  const preset = presetOf(cfg);
  const custom = (cfg.baseUrl ?? "").replace(/\/+$/, "");
  const base = preset.needsBaseUrl || (custom && custom !== preset.baseUrl) ? custom : (preset.baseUrl ?? "");
  if (!base) throw new AiError(`Add the base URL for ${preset.name}.`);
  // Anything not a built-in public endpoint (custom URLs, local servers) is checked first.
  if (base !== preset.baseUrl || preset.group === "Local") await checkBaseUrl(base);
  if (!cfg.apiKey && !preset.keyOptional) throw new AiError(`Add your ${preset.name} API key in AI settings.`);
  const headers: Record<string, string> = {};
  if (cfg.apiKey) {
    if (preset.authHeader === "api-key") headers["api-key"] = cfg.apiKey;
    else headers.Authorization = `Bearer ${cfg.apiKey}`;
  }
  if (preset.id === "openrouter") Object.assign(headers, { "HTTP-Referer": "https://intromaker.local", "X-Title": "IntroMaker" });
  return { preset, base, headers };
}

async function callOpenAiCompatible<T extends z.ZodType>(cfg: AiConfig, call: DirectorCall<T>): Promise<z.infer<T>> {
  const { preset, base, headers } = await openAiEndpoint(cfg);
  const model = modelOf(cfg);
  if (!model) throw new AiError(`Enter a model name for ${preset.name}.`);
  const schemaText = JSON.stringify(z.toJSONSchema(call.schema));
  const instruction = `\n\nRespond with ONLY a JSON object (no prose, no markdown) that matches this JSON Schema:\n${schemaText}`;

  const attempt = async (withImages: boolean, jsonMode: boolean) => {
    const userContent = [
      { type: "text", text: call.text + instruction },
      ...(withImages ? call.images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mediaType};base64,${i.data}` } })) : []),
    ];
    return fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
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

  // Send screenshots only to vision models (a custom model name may be; the 400 retry covers it).
  let images = cfg.images !== false && call.images.length > 0 && (preset.vision || (!!cfg.model && !preset.models.includes(cfg.model)));
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
  const model = modelOf(cfg);
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
    if (e instanceof TypeError) {
      const p = PRESET_MAP[cfg.provider];
      const where = cfg.baseUrl || p?.baseUrl || p?.name || cfg.provider;
      throw new AiError(`Couldn't reach ${where}${p?.group === "Local" ? ` — is ${p.name.replace(" (local)", "")} running?` : " — check the URL and your connection."}`);
    }
    if (e instanceof SyntaxError) throw new AiError("The model returned malformed JSON.");
    throw e;
  }
}

function dispatch<T extends z.ZodType>(cfg: AiConfig, call: DirectorCall<T>): Promise<z.infer<T> | "refusal"> {
  switch (presetOf(cfg).protocol) {
    case "anthropic":
      return callClaude(cfg, call);
    case "gemini":
      return callGemini(cfg, call);
    default:
      return callOpenAiCompatible(cfg, call);
  }
}

/** Models the key can use, straight from the provider (for the settings model picker). */
export async function listModels(cfg: AiConfig): Promise<string[]> {
  const preset = presetOf(cfg);
  try {
    let ids: string[] = [];
    if (preset.protocol === "anthropic") {
      if (!cfg.apiKey && !envClaudeAvailable()) throw new AiError("Add an Anthropic API key first.");
      const client = new Anthropic(cfg.apiKey ? { apiKey: cfg.apiKey } : {});
      for await (const m of client.models.list({ limit: 100 })) ids.push(m.id);
    } else if (preset.protocol === "gemini") {
      if (!cfg.apiKey) throw new AiError("Add your Google AI Studio API key first.");
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
        headers: { "x-goog-api-key": cfg.apiKey },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 400 || res.status === 401 || res.status === 403) throw new AiError("Google rejected the API key.");
      if (!res.ok) throw new AiError(`Gemini error ${res.status}.`);
      const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      ids = (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""));
    } else {
      const { base, headers } = await openAiEndpoint(cfg);
      const res = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(20_000) });
      if (res.status === 401 || res.status === 403) throw new AiError("The provider rejected the API key.");
      if (!res.ok) throw new AiError(`${preset.name} doesn't list models (${res.status}); type the model name instead.`);
      const data = (await res.json()) as { data?: { id: string }[]; models?: { id?: string; name?: string }[] };
      ids = (data.data ?? data.models ?? []).map((m) => ("id" in m && m.id) || (m as { name?: string }).name || "").filter(Boolean);
    }
    return [...new Set(ids)].sort().slice(0, 400);
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("Anthropic rejected the API key (401).");
    if ((e as Error).name === "TimeoutError") throw new AiError("The provider took too long to answer.");
    if (e instanceof TypeError) throw new AiError(`Couldn't reach ${preset.name}${preset.group === "Local" ? " — is it running?" : "."}`);
    throw new AiError(`Couldn't list models: ${redact((e as Error).message ?? "", cfg.apiKey)}`);
  }
}

export function describe(cfg: AiConfig) {
  if (cfg.provider === "builtin") return "Built-in director";
  const name = PRESET_MAP[cfg.provider]?.name.replace(/ \(local\)$/, "") ?? "AI";
  const model = modelOf(cfg);
  return model ? `${name} · ${model}` : name;
}
