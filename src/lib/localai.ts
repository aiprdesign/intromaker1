/**
 * Browser-side AI for local model servers (Ollama, LM Studio, llama.cpp, Jan, vLLM…).
 *
 * Routing rule: local AI runs where the model is. When Prodintro.com's server runs on your own
 * machine it calls localhost itself; when Prodintro.com is hosted online the server can't reach
 * your computer, so the browser talks to the local model directly. Cloud providers always go
 * through the server (keys stay out of third-party pages, no CORS limits).
 */
import { PRESET_MAP, PROVIDER_PRESETS } from "./providers";

export interface BrowserAiConfig {
  provider: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  mode?: "fast" | "balanced" | "best";
  images?: boolean;
}

export interface LocalServer {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
}

function endpoint(cfg: BrowserAiConfig) {
  const p = PRESET_MAP[cfg.provider];
  const base = (cfg.baseUrl || p?.baseUrl || "").replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  return { p, base, headers };
}

/** What to do when the browser can't reach a local server (usually CORS). */
export function corsHelp(id: string) {
  switch (id) {
    case "ollama":
      return `Allow this site in Ollama: set OLLAMA_ORIGINS=${typeof location !== "undefined" ? location.origin : "*"} and restart Ollama.`;
    case "lmstudio":
      return "In LM Studio → Developer → Server settings, turn on “Enable CORS”, then start the server.";
    case "jan":
      return "In Jan → Settings → Local API Server, enable CORS and start the server.";
    case "llamacpp":
      return "Start llama-server (CORS is on by default) and check the port.";
    default:
      return "Start the local server and allow cross-origin requests (CORS) from this site.";
  }
}

/** Probe the known local servers from this browser. */
export async function browserScan(): Promise<LocalServer[]> {
  const found: LocalServer[] = [];
  await Promise.all(
    PROVIDER_PRESETS.filter((p) => p.group === "Local" && p.baseUrl).map(async (p) => {
      try {
        const res = await fetch(`${p.baseUrl}/models`, { signal: AbortSignal.timeout(1500) });
        if (!res.ok) return;
        const data = (await res.json()) as { data?: { id: string }[] };
        found.push({ id: p.id, name: p.name, baseUrl: p.baseUrl!, models: (data.data ?? []).map((m) => m.id).filter(Boolean).slice(0, 50) });
      } catch {
        /* not running or CORS-blocked */
      }
    }),
  );
  return found;
}

export async function browserListModels(cfg: BrowserAiConfig) {
  const { p, base, headers } = endpoint(cfg);
  try {
    const res = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`${p?.name ?? "Server"} answered ${res.status}`);
    const data = (await res.json()) as { data?: { id: string }[] };
    return (data.data ?? []).map((m) => m.id).filter(Boolean);
  } catch (e) {
    if (e instanceof TypeError) throw new Error(`Couldn't reach ${base}. ${corsHelp(cfg.provider)}`);
    throw e;
  }
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The model didn't return JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** One JSON chat completion against an OpenAI-compatible local server, degrading gracefully. */
async function chatJson(
  cfg: BrowserAiConfig,
  system: string,
  text: string,
  images: { data: string; mediaType: string }[],
  schema: unknown,
): Promise<unknown> {
  const { p, base, headers } = endpoint(cfg);
  const model = cfg.model || p?.models[0] || "local-model";
  const instruction = `\n\nRespond with ONLY a JSON object (no prose, no markdown) that matches this JSON Schema:\n${JSON.stringify(schema)}`;
  const send = (withImages: boolean, jsonMode: boolean) =>
    fetch(`${base}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: withImages
              ? [{ type: "text", text: text + instruction }, ...images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mediaType};base64,${i.data}` } }))]
              : text + instruction,
          },
        ],
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(300_000),
    });
  let withImages = cfg.images !== false && images.length > 0 && !!p?.vision;
  let jsonMode = true;
  let res: Response;
  try {
    res = await send(withImages, jsonMode);
    for (let i = 0; i < 2 && res.status === 400; i++) {
      if (withImages) withImages = false;
      else jsonMode = false;
      res = await send(withImages, jsonMode);
    }
  } catch (e) {
    if (e instanceof TypeError) throw new Error(`Couldn't reach ${base}. ${corsHelp(cfg.provider)}`);
    throw e;
  }
  if (res.status === 404) throw new Error(`Model "${model}" not found on ${p?.name ?? base}.`);
  if (!res.ok) throw new Error(`${p?.name ?? "Local model"} error ${res.status}.`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return extractJson(data.choices?.[0]?.message?.content ?? "");
}

export async function browserTest(cfg: BrowserAiConfig) {
  const out = (await chatJson(cfg, "You are a connectivity check.", 'Reply with the JSON object {"ok": true}.', [], { type: "object" })) as { ok?: boolean };
  return !!out;
}

const post = async (body: unknown) => {
  const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * Run the AI director with a local model from this browser: the server builds the request,
 * the local model writes the storyboard (and revises it when the self-review asks), and the
 * server checks, repairs and styles it into a plan.
 */
export async function runBrowserDirector(body: Record<string, unknown>, cfg: BrowserAiConfig) {
  const req = (await post({ ...body, phase: "prompt" })) as { system: string; text: string; images: { data: string; mediaType: string }[]; schema: unknown };
  const draft = await chatJson(cfg, req.system, req.text, req.images, req.schema);
  let r = await post({ ...body, phase: "finish", draft });
  if (r.review) {
    const revised = await chatJson(cfg, req.system, r.review, [], req.schema).catch(() => draft);
    r = await post({ ...body, phase: "finish", draft, revised });
  }
  return r as { plan: unknown; engine: string; engineLabel?: string; note?: string };
}
