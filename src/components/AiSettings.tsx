"use client";

import { useEffect, useMemo, useState } from "react";
import { browserListModels, browserScan, browserTest, type LocalServer } from "@/lib/localai";
import { detectProvider, PRESET_MAP, PROVIDER_GROUPS, PROVIDER_PRESETS } from "@/lib/providers";

/** "builtin" or a provider id from src/lib/providers.ts. */
export type Provider = string;
export type Mode = "fast" | "balanced" | "best";

export interface AiSettingsValue {
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl: string;
  mode: Mode;
  images: boolean;
  /** Remembered key/model per provider, so switching back and forth keeps them. */
  saved?: Record<string, { apiKey?: string; model?: string; baseUrl?: string }>;
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

export function loadAiSettings(): AiSettingsValue {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const v = raw ? { ...DEFAULT_AI, ...JSON.parse(raw) } : DEFAULT_AI;
    return v.provider === "builtin" || PRESET_MAP[v.provider] ? v : DEFAULT_AI;
  } catch {
    return DEFAULT_AI;
  }
}

export function aiLabel(v: AiSettingsValue) {
  const p = PRESET_MAP[v.provider];
  if (!p) return "Built-in director";
  return `${p.name.replace(/ \(local\)$/, "")} · ${v.model || p.models[0] || "model"}`;
}

/** What goes to the server: the active provider only, never the other remembered keys. */
export function aiForRequest(v: AiSettingsValue) {
  const { saved: _saved, ...active } = v;
  void _saved;
  return active;
}

/** Store the current provider's key/model before switching away. */
function remember(v: AiSettingsValue): AiSettingsValue {
  if (v.provider === "builtin") return v;
  return { ...v, saved: { ...v.saved, [v.provider]: { apiKey: v.apiKey, model: v.model, baseUrl: v.baseUrl } } };
}

function switchTo(v: AiSettingsValue, id: string): AiSettingsValue {
  const kept = remember(v);
  const s = kept.saved?.[id] ?? {};
  return { ...kept, provider: id, apiKey: s.apiKey ?? "", model: s.model ?? "", baseUrl: s.baseUrl ?? "" };
}

export default function AiSettings({
  value,
  onChange,
  onClose,
  serverClaude,
  localViaServer = true,
}: {
  value: AiSettingsValue;
  onChange: (v: AiSettingsValue) => void;
  onClose: () => void;
  serverClaude: boolean;
  /** False when IntroMaker is hosted online: local models are then called from this browser. */
  localViaServer?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [showKey, setShowKey] = useState(false);
  const [query, setQuery] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);
  const [models, setModels] = useState<{ state: "idle" | "loading" | "ok" | "fail"; list: string[]; msg?: string }>({ state: "idle", list: [] });
  const [test, setTest] = useState<{ state: "idle" | "running" | "ok" | "fail"; msg?: string }>({ state: "idle" });
  const p = PRESET_MAP[draft.provider];
  const isLocal = p?.group === "Local";
  const inBrowser = isLocal && !localViaServer;
  const [scan, setScan] = useState<{ state: "idle" | "scanning" | "done"; found: LocalServer[] }>({ state: "idle", found: [] });
  /** Look for Ollama, LM Studio, llama.cpp, Jan, vLLM… on this computer. */
  const runScan = async () => {
    setScan({ state: "scanning", found: [] });
    let found: LocalServer[] = [];
    try {
      const r = await fetch("/api/ai-scan").then((x) => x.json());
      found = r.available ? r.found : await browserScan();
    } catch {
      found = await browserScan();
    }
    setScan({ state: "done", found });
  };
  useEffect(() => {
    void runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pickLocal = (f: LocalServer) => {
    setDraft({ ...switchTo(draft, f.id), model: f.models[0] ?? "", baseUrl: "" });
    setModels({ state: "ok", list: f.models, msg: `${f.models.length} models found on ${f.name.replace(" (local)", "")}` });
  };
  useEffect(() => setTest({ state: "idle" }), [draft.provider, draft.apiKey, draft.model, draft.baseUrl]);
  useEffect(() => {
    setModels({ state: "idle", list: [] });
    setAdvanced(false);
  }, [draft.provider]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? PROVIDER_PRESETS.filter((x) => `${x.name} ${x.id} ${x.group}`.toLowerCase().includes(q)) : PROVIDER_PRESETS;
  }, [query]);

  const setKey = (key: string) => {
    const hit = detectProvider(key);
    // A pasted key that clearly belongs to another provider switches to it.
    if (hit && hit.id !== draft.provider && !(p?.keyPrefix && p.keyPrefix.test(key))) {
      setDraft({ ...switchTo(draft, hit.id), apiKey: key });
      setDetected(hit.name);
    } else {
      setDraft({ ...draft, apiKey: key });
      setDetected(null);
    }
  };

  const save = () => {
    const out = remember(draft);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {
      /* private mode: keep for this session only */
    }
    onChange(out);
    onClose();
  };

  const post = (path: string) =>
    fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aiForRequest(draft)) }).then((r) => r.json());

  const loadModels = async () => {
    setModels({ state: "loading", list: [] });
    if (inBrowser) {
      try {
        const list = await browserListModels(draft);
        setModels({ state: "ok", list, msg: `${list.length} models available` });
      } catch (e) {
        setModels({ state: "fail", list: [], msg: (e as Error).message });
      }
      return;
    }
    try {
      const data = await post("/api/ai-models");
      if (data.error) setModels({ state: "fail", list: [], msg: data.error });
      else setModels({ state: "ok", list: data.models, msg: `${data.models.length} models available` });
    } catch {
      setModels({ state: "fail", list: [], msg: "Couldn't reach the IntroMaker server." });
    }
  };

  const runTest = async () => {
    setTest({ state: "running" });
    if (inBrowser) {
      try {
        await browserTest(draft);
        setTest({ state: "ok", msg: `Connected from this browser: ${p?.name} · ${draft.model || p?.models[0]}` });
      } catch (e) {
        setTest({ state: "fail", msg: (e as Error).message });
      }
      return;
    }
    try {
      const data = await post("/api/ai-test");
      setTest(data.ok ? { state: "ok", msg: `Connected: ${data.label}` } : { state: "fail", msg: data.error });
    } catch {
      setTest({ state: "fail", msg: "Couldn't reach the IntroMaker server." });
    }
  };

  const modelOptions = [...new Set([...(p?.models ?? []), ...models.list])];
  const showBase = !!p && (p.needsBaseUrl || advanced);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="AI settings">
        <div className="modal-head">
          <h2>AI director</h2>
          <button className="icon-btn sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="hint">
          Pick a provider (or just paste a key: it&apos;s recognised automatically), then choose a model. Endpoints are
          built in. Keys are stored only in this browser and sent only to your own IntroMaker server.
        </p>

        <div className="quick-setup">
          <div className="quick-head">
            <strong>Local AI on this computer</strong>
            <button className="btn btn-ghost sm" onClick={runScan} disabled={scan.state === "scanning"}>
              {scan.state === "scanning" ? "Scanning…" : "Scan again"}
            </button>
          </div>
          {scan.state === "done" && scan.found.length === 0 && (
            <p className="hint">
              None found. Install <a className="key-link" href="https://ollama.com/download" target="_blank" rel="noreferrer">Ollama ↗</a> or{" "}
              <a className="key-link" href="https://lmstudio.ai" target="_blank" rel="noreferrer">LM Studio ↗</a> for free, private AI, or paste any
              cloud API key below.
            </p>
          )}
          {scan.found.length > 0 && (
            <div className="model-chips">
              {scan.found.map((f) => (
                <button key={f.id} className={`chip ${draft.provider === f.id ? "active" : ""}`} onClick={() => pickLocal(f)}>
                  ● {f.name.replace(" (local)", "")} · {f.models.length} model{f.models.length === 1 ? "" : "s"} · Use
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="provider-toolbar">
          <label className="field-label">Provider</label>
          <input className="input sm" value={query} placeholder="Search providers…" onChange={(e) => setQuery(e.target.value)} aria-label="Search providers" />
        </div>
        <div className="provider-groups">
          {!query && (
            <div className="provider-grid">
              <button className={`provider ${draft.provider === "builtin" ? "active" : ""}`} onClick={() => setDraft(switchTo(draft, "builtin"))}>
                Built-in (no key)
              </button>
            </div>
          )}
          {PROVIDER_GROUPS.map((g) => {
            const items = shown.filter((x) => x.group === g);
            if (!items.length) return null;
            return (
              <div key={g}>
                <div className="provider-group">{g}</div>
                <div className="provider-grid">
                  {items.map((x) => (
                    <button key={x.id} className={`provider ${draft.provider === x.id ? "active" : ""}`} onClick={() => setDraft(switchTo(draft, x.id))}>
                      {x.name.replace(/ \(local\)$/, "")}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {draft.provider === "builtin" && (
          <>
            <label className="field-label">Paste any API key</label>
            <input
              className="input"
              type="password"
              placeholder="sk-ant-…, sk-…, AIza…, gsk_…, xai-…, sk-or-…, hf_…"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setKey(e.target.value.trim())}
            />
            {draft.apiKey && <p className="hint warn">Key not recognised: pick its provider above (or “Any OpenAI-compatible API”).</p>}
            <p className="hint">
              {serverClaude
                ? "This site provides its own AI: storyboards use it automatically, within a daily limit."
                : "Rule-based director: fast, free and offline. Add a key for AI-written storyboards that read your website."}
            </p>
          </>
        )}

        {p && (
          <>
            <p className="runs-on">
              {isLocal
                ? inBrowser
                  ? "Runs on your computer: this browser talks to the local model directly (IntroMaker is online)."
                  : "Runs on your computer: the local IntroMaker server calls the model on localhost."
                : "Runs in the cloud, through the IntroMaker server (your key is never sent anywhere else)."}
            </p>
            {detected && <p className="hint ok">Recognised a {detected} key.</p>}
            {p.note && <p className="hint">{p.note}</p>}
            {showBase && (
              <>
                <label className="field-label">Base URL</label>
                <input
                  className="input"
                  value={draft.baseUrl}
                  placeholder={p.baseUrlHint ?? p.baseUrl ?? "https://api.example.com/v1"}
                  onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value.trim() })}
                />
              </>
            )}
            <label className="field-label">
              API key{p.keyOptional ? " (optional)" : ""}{" "}
              {p.keyUrl && (
                <a href={p.keyUrl} target="_blank" rel="noreferrer" className="key-link">
                  {p.group === "Local" ? "Download ↗" : "Get a key ↗"}
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
                onChange={(e) => setKey(e.target.value.trim())}
              />
              <button className="btn btn-ghost" onClick={() => setShowKey((s) => !s)}>
                {showKey ? "Hide" : "Show"}
              </button>
            </div>

            <label className="field-label">Model</label>
            <div className="url-row">
              <input
                className="input"
                list={`models-${draft.provider}`}
                value={draft.model}
                placeholder={p.models[0] ?? "model name"}
                onChange={(e) => setDraft({ ...draft, model: e.target.value.trim() })}
              />
              <button className="btn btn-ghost" onClick={loadModels} disabled={models.state === "loading"} title="Ask the provider which models this key can use">
                {models.state === "loading" ? "Loading…" : "Load models"}
              </button>
            </div>
            <datalist id={`models-${draft.provider}`}>
              {modelOptions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {models.msg && <p className={`hint ${models.state === "fail" ? "warn" : "ok"}`}>{models.msg}</p>}
            {p.models.length > 0 && (
              <div className="model-chips">
                {p.models.map((m) => (
                  <button key={m} className={`chip ${(draft.model || p.models[0]) === m ? "active" : ""}`} onClick={() => setDraft({ ...draft, model: m })}>
                    {m}
                  </button>
                ))}
              </div>
            )}
            {!p.needsBaseUrl && (
              <button className="link-btn" onClick={() => setAdvanced((a) => !a)}>
                {advanced ? "Use the default endpoint" : "Advanced: custom endpoint URL"}
              </button>
            )}

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
            <p className="hint">
              Fast ships the first draft. Balanced fixes drafts that fail the quality checklist. Best always has the AI
              critique and revise its storyboard (two calls, slower, noticeably better).
            </p>

            <label className="check-row">
              <input type="checkbox" checked={draft.images} onChange={(e) => setDraft({ ...draft, images: e.target.checked })} />
              Let the AI see website screenshots (vision)
            </label>
            {!p.vision && draft.images && (
              <p className="hint">This provider&apos;s suggested models are text-only, so screenshots are skipped unless you pick a vision model.</p>
            )}

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
