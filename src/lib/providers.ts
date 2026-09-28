/**
 * Registry of well-known AI providers. Each preset knows its API protocol, endpoint, auth
 * header and a few suggested models, so the user only pastes an API key and picks a model.
 * Shared by the settings UI (browser) and the director (server) — no Node imports here.
 */

export type Protocol = "anthropic" | "openai" | "gemini";
export type ProviderGroup = "Popular" | "Fast inference" | "Open models" | "Regional" | "Local" | "Other";

export interface ProviderPreset {
  id: string;
  name: string;
  group: ProviderGroup;
  protocol: Protocol;
  /** OpenAI-compatible base URL (…/v1); requests go to `${baseUrl}/chat/completions`. */
  baseUrl?: string;
  /** The user must supply the base URL (Azure resource, custom server). */
  needsBaseUrl?: boolean;
  baseUrlHint?: string;
  /** Header carrying the key: `Authorization: Bearer <key>` unless set (Azure uses `api-key`). */
  authHeader?: "bearer" | "api-key";
  keyOptional?: boolean;
  keyHint: string;
  keyUrl?: string;
  /** Recognise a pasted key: its prefix. */
  keyPrefix?: RegExp;
  /** Suggested models (the field accepts any model name). */
  models: string[];
  /** Whether the suggested models accept images (website screenshots). */
  vision: boolean;
  note?: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  // ── Popular
  {
    id: "anthropic",
    name: "Anthropic Claude",
    group: "Popular",
    protocol: "anthropic",
    keyHint: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyPrefix: /^sk-ant-/,
    models: ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"],
    vision: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    group: "Popular",
    protocol: "openai",
    baseUrl: "https://api.openai.com/v1",
    keyHint: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPrefix: /^sk-(proj-|svcacct-)?(?!ant-|or-)[A-Za-z0-9]/,
    models: ["gpt-4.1", "gpt-4o", "gpt-4.1-mini"],
    vision: true,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    group: "Popular",
    protocol: "gemini",
    keyHint: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
    keyPrefix: /^AIza/,
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
    vision: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    group: "Popular",
    protocol: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    keyHint: "sk-or-…",
    keyUrl: "https://openrouter.ai/keys",
    keyPrefix: /^sk-or-/,
    models: ["anthropic/claude-sonnet-5", "openai/gpt-4.1", "google/gemini-2.5-flash", "meta-llama/llama-3.3-70b-instruct"],
    vision: true,
    note: "One key for hundreds of models from every lab.",
  },
  {
    id: "xai",
    name: "xAI Grok",
    group: "Popular",
    protocol: "openai",
    baseUrl: "https://api.x.ai/v1",
    keyHint: "xai-…",
    keyUrl: "https://console.x.ai",
    keyPrefix: /^xai-/,
    models: ["grok-4", "grok-3-mini"],
    vision: true,
  },
  {
    id: "mistral",
    name: "Mistral AI",
    group: "Popular",
    protocol: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    keyHint: "API key",
    keyUrl: "https://console.mistral.ai/api-keys",
    models: ["mistral-large-latest", "mistral-medium-latest", "pixtral-large-latest"],
    vision: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    group: "Popular",
    protocol: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    keyHint: "sk-…",
    keyUrl: "https://platform.deepseek.com/api_keys",
    models: ["deepseek-chat", "deepseek-reasoner"],
    vision: false,
  },
  // ── Fast inference
  {
    id: "groq",
    name: "Groq",
    group: "Fast inference",
    protocol: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    keyHint: "gsk_…",
    keyUrl: "https://console.groq.com/keys",
    keyPrefix: /^gsk_/,
    models: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "meta-llama/llama-4-scout-17b-16e-instruct"],
    vision: false,
  },
  {
    id: "cerebras",
    name: "Cerebras",
    group: "Fast inference",
    protocol: "openai",
    baseUrl: "https://api.cerebras.ai/v1",
    keyHint: "csk-…",
    keyUrl: "https://cloud.cerebras.ai",
    keyPrefix: /^csk-/,
    models: ["llama-3.3-70b", "gpt-oss-120b", "qwen-3-32b"],
    vision: false,
  },
  {
    id: "sambanova",
    name: "SambaNova",
    group: "Fast inference",
    protocol: "openai",
    baseUrl: "https://api.sambanova.ai/v1",
    keyHint: "API key",
    keyUrl: "https://cloud.sambanova.ai/apis",
    models: ["Meta-Llama-3.3-70B-Instruct", "DeepSeek-V3-0324"],
    vision: false,
  },
  // ── Open models
  {
    id: "together",
    name: "Together AI",
    group: "Open models",
    protocol: "openai",
    baseUrl: "https://api.together.xyz/v1",
    keyHint: "API key",
    keyUrl: "https://api.together.ai/settings/api-keys",
    models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3"],
    vision: false,
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    group: "Open models",
    protocol: "openai",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    keyHint: "fw_…",
    keyUrl: "https://fireworks.ai/account/api-keys",
    keyPrefix: /^fw_/,
    models: ["accounts/fireworks/models/llama-v3p3-70b-instruct", "accounts/fireworks/models/deepseek-v3"],
    vision: false,
  },
  {
    id: "deepinfra",
    name: "DeepInfra",
    group: "Open models",
    protocol: "openai",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    keyHint: "API key",
    keyUrl: "https://deepinfra.com/dash/api_keys",
    models: ["meta-llama/Llama-3.3-70B-Instruct", "deepseek-ai/DeepSeek-V3"],
    vision: false,
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    group: "Open models",
    protocol: "openai",
    baseUrl: "https://router.huggingface.co/v1",
    keyHint: "hf_…",
    keyUrl: "https://huggingface.co/settings/tokens",
    keyPrefix: /^hf_/,
    models: ["meta-llama/Llama-3.3-70B-Instruct", "Qwen/Qwen2.5-72B-Instruct"],
    vision: false,
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    group: "Open models",
    protocol: "openai",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    keyHint: "nvapi-…",
    keyUrl: "https://build.nvidia.com",
    keyPrefix: /^nvapi-/,
    models: ["meta/llama-3.3-70b-instruct", "deepseek-ai/deepseek-r1"],
    vision: false,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    group: "Open models",
    protocol: "openai",
    baseUrl: "https://api.perplexity.ai",
    keyHint: "pplx-…",
    keyUrl: "https://www.perplexity.ai/settings/api",
    keyPrefix: /^pplx-/,
    models: ["sonar-pro", "sonar"],
    vision: false,
  },
  // ── Regional
  {
    id: "qwen",
    name: "Alibaba Qwen",
    group: "Regional",
    protocol: "openai",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    keyHint: "sk-…",
    keyUrl: "https://modelstudio.console.alibabacloud.com",
    models: ["qwen-max", "qwen-plus", "qwen-vl-max"],
    vision: true,
  },
  {
    id: "moonshot",
    name: "Moonshot Kimi",
    group: "Regional",
    protocol: "openai",
    baseUrl: "https://api.moonshot.ai/v1",
    keyHint: "sk-…",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    models: ["kimi-k2-0711-preview", "moonshot-v1-32k"],
    vision: false,
  },
  {
    id: "zhipu",
    name: "Z.ai GLM",
    group: "Regional",
    protocol: "openai",
    baseUrl: "https://api.z.ai/api/paas/v4",
    keyHint: "API key",
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    models: ["glm-4.5", "glm-4.5-air"],
    vision: false,
  },
  // ── Local (runs on your machine, no key)
  {
    id: "ollama",
    name: "Ollama (local)",
    group: "Local",
    protocol: "openai",
    baseUrl: "http://localhost:11434/v1",
    keyOptional: true,
    keyHint: "not needed",
    keyUrl: "https://ollama.com/download",
    models: ["llama3.1", "qwen2.5", "mistral"],
    vision: false,
    note: "Free and private: run `ollama pull llama3.1`, then pick it here.",
  },
  {
    id: "lmstudio",
    name: "LM Studio (local)",
    group: "Local",
    protocol: "openai",
    baseUrl: "http://localhost:1234/v1",
    keyOptional: true,
    keyHint: "not needed",
    keyUrl: "https://lmstudio.ai",
    models: ["local-model"],
    vision: false,
    note: "Start LM Studio's local server, then Load models.",
  },
  // ── Other
  {
    id: "azure",
    name: "Azure OpenAI",
    group: "Other",
    protocol: "openai",
    needsBaseUrl: true,
    baseUrlHint: "https://YOUR-RESOURCE.openai.azure.com/openai/v1",
    authHeader: "api-key",
    keyHint: "Azure key",
    keyUrl: "https://portal.azure.com",
    models: ["gpt-4.1", "gpt-4o"],
    vision: true,
    note: "Model = your deployment name.",
  },
  {
    id: "custom",
    name: "Any OpenAI-compatible API",
    group: "Other",
    protocol: "openai",
    needsBaseUrl: true,
    baseUrlHint: "https://api.example.com/v1",
    keyOptional: true,
    keyHint: "API key (if required)",
    models: [],
    vision: true,
    note: "Works with any service exposing /v1/chat/completions.",
  },
];

export const PRESET_MAP: Record<string, ProviderPreset> = Object.fromEntries(PROVIDER_PRESETS.map((p) => [p.id, p]));
export const PROVIDER_GROUPS: ProviderGroup[] = ["Popular", "Fast inference", "Open models", "Regional", "Local", "Other"];

/** Guess the provider from a pasted API key (most specific prefixes first). */
export function detectProvider(key: string): ProviderPreset | null {
  const k = key.trim();
  if (!k) return null;
  const ordered = [...PROVIDER_PRESETS].filter((p) => p.keyPrefix).sort((a, b) => (a.id === "openai" ? 1 : b.id === "openai" ? -1 : 0));
  return ordered.find((p) => p.keyPrefix!.test(k)) ?? null;
}
