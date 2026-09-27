"use client";

import { useEffect, useState } from "react";

export type Provider = "builtin" | "anthropic" | "openai" | "gemini" | "openrouter" | "custom";
export type Mode = "fast" | "balanced" | "best";

export interface AiSettingsValue {
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl: string;
  mode: Mode;
  images: boolean;
}

const STORAGE_KEY = "intromaker.ai.v1";

export const DEFAULT_AI: AiSettingsValue = {
  provider: "builtin",
  apiKey: "",
  model: "",
  baseUrl: "",
  mode: "balanced",
  images: true,
};

const PROVIDERS: { id: Provider; name: string; keyHint: string; models: string[]; link?: string }[] = [
  { id: "builtin", name: "Built-in (no key)", keyHint: "", models: [] },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    keyHint: "sk-ant-…",
    models: ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"],
    link: "https://console.anthropic.com/settings/keys",
  },
  { id: "openai", name: "OpenAI", keyHint: "sk-…", models: ["gpt-4.1", "gpt-4o", "gpt-4.1-mini"], link: "https://platform.openai.com/api-keys" },
  {
    id: "gemini",
    name: "Google Gemini",
    keyHint: "AIza…",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
    link: "https://aistudio.google.com/apikey",
  },
  {
    id: "openrouter",
    name: "OpenRouter (any model)",
    keyHint: "sk-or-…",
    models: ["anthropic/claude-sonnet-5", "openai/gpt-4.1", "google/gemini-2.5-flash", "meta-llama/llama-3.3-70b-instruct"],
    link: "https://openrouter.ai/keys",
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    keyHint: "optional",
    models: ["llama3.1", "qwen2.5", "mistral"],
  },
];

export function loadAiSettings(): AiSettingsValue {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_AI, ...JSON.parse(raw) } : DEFAULT_AI;
  } catch {
    return DEFAULT_AI;
  }
}

export function aiLabel(v: AiSettingsValue) {
  const p = PROVIDERS.find((x) => x.id === v.provider);
  if (!p || v.provider === "builtin") return "Built-in director";
  return `${p.name.split(" (")[0]} · ${v.model || p.models[0] || "model"}`;
}

export default function AiSettings({
  value,
  onChange,
  onClose,
  serverClaude,
}: {
  value: AiSettingsValue;
  onChange: (v: AiSettingsValue) => void;
  onClose: () => void;
  serverClaude: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<{ state: "idle" | "running" | "ok" | "fail"; msg?: string }>({ state: "idle" });
  const p = PROVIDERS.find((x) => x.id === draft.provider)!;
  useEffect(() => setTest({ state: "idle" }), [draft.provider, draft.apiKey, draft.model, draft.baseUrl]);

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* private mode: keep for this session only */
    }
    onChange(draft);
    onClose();
  };

  const runTest = async () => {
    setTest({ state: "running" });
    try {
      const res = await fetch("/api/ai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      setTest(data.ok ? { state: "ok", msg: `Connected: ${data.label}` } : { state: "fail", msg: data.error });
    } catch {
      setTest({ state: "fail", msg: "Couldn't reach the IntroMaker server." });
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="AI settings">
        <div className="modal-head">
          <h2>AI director</h2>
          <button className="icon-btn sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="hint">
          Choose which AI writes your storyboards. Your key is stored only in this browser and sent only to your own
          IntroMaker server, which forwards it to the provider.
        </p>

        <label className="field-label">Provider</label>
        <div className="provider-grid">
          {PROVIDERS.map((x) => (
            <button
              key={x.id}
              className={`provider ${draft.provider === x.id ? "active" : ""}`}
              onClick={() => setDraft({ ...draft, provider: x.id, model: "" })}
            >
              {x.name}
            </button>
          ))}
        </div>
        {draft.provider === "builtin" && (
          <p className="hint">
            {serverClaude
              ? "This server has its own Claude key: storyboards use Claude automatically."
              : "Rule-based director: fast, free and offline. Add a key for AI-written storyboards that read your website."}
          </p>
        )}

        {draft.provider !== "builtin" && (
          <>
            {draft.provider === "custom" && (
              <>
                <label className="field-label">Base URL</label>
                <input
                  className="input"
                  value={draft.baseUrl}
                  placeholder="http://localhost:11434/v1  (Ollama) · https://api.groq.com/openai/v1"
                  onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                />
              </>
            )}
            <label className="field-label">
              API key{" "}
              {p.link && (
                <a href={p.link} target="_blank" rel="noreferrer" className="key-link">
                  Get a key ↗
                </a>
              )}
            </label>
            <div className="url-row">
              <input
                className="input"
                type={showKey ? "text" : "password"}
                value={draft.apiKey}
                placeholder={p.keyHint}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value.trim() })}
              />
              <button className="btn btn-ghost" onClick={() => setShowKey((s) => !s)}>
                {showKey ? "Hide" : "Show"}
              </button>
            </div>

            <label className="field-label">Model</label>
            <input
              className="input"
              list={`models-${draft.provider}`}
              value={draft.model}
              placeholder={p.models[0] ?? "model name"}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            />
            <datalist id={`models-${draft.provider}`}>
              {p.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>

            <label className="field-label">Mode</label>
            <div className="seg-control">
              {(
                [
                  ["fast", "Fast"],
                  ["balanced", "Balanced"],
                  ["best", "Best quality"],
                ] as [Mode, string][]
              ).map(([id, label]) => (
                <button key={id} className={draft.mode === id ? "active" : ""} onClick={() => setDraft({ ...draft, mode: id })}>
                  {label}
                </button>
              ))}
            </div>
            <p className="hint">Mode sets how deeply the AI thinks (Claude effort). Best is slower but more considered.</p>

            <label className="check-row">
              <input type="checkbox" checked={draft.images} onChange={(e) => setDraft({ ...draft, images: e.target.checked })} />
              Let the AI see website screenshots (vision)
            </label>

            <div className="gen-row">
              <button className="btn btn-ghost" onClick={runTest} disabled={test.state === "running"}>
                {test.state === "running" ? "Testing…" : "Test connection"}
              </button>
            </div>
            {test.msg && <p className={`hint ${test.state === "fail" ? "warn" : "ok"}`}>{test.msg}</p>}
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
