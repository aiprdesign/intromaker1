"use client";

import { useEffect, useState } from "react";
import { PROVIDER_GROUPS, PROVIDER_PRESETS, PRESET_MAP } from "@/lib/providers";
import { KeysCard, type SetupView } from "./SetupTab";
import { api, SaveBar, Skeleton, useAdminUi, useDirty, When } from "./ui";

type Settings = {
  provider: string;
  model: string;
  baseUrl: string;
  mode: "fast" | "balanced" | "best";
  images: boolean;
  keySet: boolean;
  keyHint: string;
  dailyBudget: number | null;
  perVisitor: number | null;
  envKey: boolean;
  envBudget: number;
  active: string;
  updatedAt: number | null;
};
type Form = { provider: string; apiKey: string; model: string; baseUrl: string; mode: string; images: boolean; dailyBudget: string; perVisitor: string; clearKey: boolean };

const toForm = (v: Settings): Form => ({
  provider: v.provider,
  apiKey: "",
  model: v.model,
  baseUrl: v.baseUrl,
  mode: v.mode,
  images: v.images,
  dailyBudget: v.dailyBudget === null ? "" : String(v.dailyBudget),
  perVisitor: v.perVisitor === null ? "" : String(v.perVisitor),
  clearKey: false,
});

/** The AI the server's director uses. Keys are write-only: the browser only ever sees a masked hint. */
function DirectorAi() {
  const { notify } = useAdminUi();
  const [s, setS] = useState<Settings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  const [error, setError] = useState<string | null>(null);
  const fill = (v: Settings) => {
    setS(v);
    setForm(toForm(v));
  };
  useEffect(() => {
    api<Settings>("/api/admin/settings")
      .then(fill)
      .catch((e) => setError((e as Error).message));
  }, []);
  const dirty = useDirty(form, s && toForm(s));
  if (!s || !form) return error ? <p className="error">{error}</p> : <Skeleton rows={3} />;

  const preset = PRESET_MAP[form.provider];
  const set = (patch: Partial<Form>) => {
    setForm((f) => f && { ...f, ...patch });
    setTest(null);
  };
  const payload = () => ({ ...form, dailyBudget: form.dailyBudget === "" ? null : Number(form.dailyBudget), perVisitor: form.perVisitor === "" ? null : Number(form.perVisitor) });
  const save = async () => {
    setBusy("save");
    try {
      fill(await api<Settings>("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload()) }));
      notify("AI settings saved. New videos use them right away.");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy("");
    }
  };
  const runTest = async () => {
    setBusy("test");
    setTest(null);
    try {
      const r = await api<{ ok: boolean; label?: string; error?: string }>("/api/admin/settings/test", { method: "POST", body: JSON.stringify(payload()) });
      setTest(r.ok ? { ok: true, text: `Connected: ${r.label}` } : { ok: false, text: r.error ?? "Failed" });
    } catch (e) {
      setTest({ ok: false, text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };
  const sameProvider = form.provider === s.provider;
  return (
    <section className="admin-card admin-ai">
      <div className="ai-now">
        <span className="fld-cap">In use now</span>
        <strong>{s.active}</strong>
        {s.updatedAt && (
          <span className="hint sm">
            changed <When t={s.updatedAt} />
          </span>
        )}
      </div>
      <p className="hint">
        The AI the server&apos;s director uses when a visitor hasn&apos;t added a key of their own (their own keys stay in their browser). The key is stored on the
        server&apos;s data volume, readable only by the app, and isn&apos;t sent back to the browser.
        {s.envKey && " ANTHROPIC_API_KEY is also set in the environment; it's used when no provider is chosen here."}
      </p>
      <label className="fld">
        <span className="fld-cap">Provider</span>
        <select className="select" value={form.provider} onChange={(e) => set({ provider: e.target.value, model: "", baseUrl: "" })}>
          <option value="builtin">None: built-in director{s.envKey ? " (or ANTHROPIC_API_KEY)" : ""}</option>
          {PROVIDER_GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {PROVIDER_PRESETS.filter((p) => p.group === g).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {preset && (
        <>
          <label className="fld">
            <span className="fld-cap">
              API key{" "}
              {preset.keyUrl && (
                <em>
                  <a href={preset.keyUrl} target="_blank" rel="noopener noreferrer">
                    get a key ↗
                  </a>
                </em>
              )}
            </span>
            <input
              className="input"
              type="password"
              autoComplete="off"
              value={form.apiKey}
              placeholder={sameProvider && s.keySet && !form.clearKey ? `Saved (${s.keyHint}). Leave empty to keep it.` : preset.keyHint}
              onChange={(e) => set({ apiKey: e.target.value, clearKey: false })}
            />
          </label>
          {sameProvider && s.keySet && (
            <label className="check-row">
              <input type="checkbox" checked={form.clearKey} onChange={(e) => set({ clearKey: e.target.checked, apiKey: "" })} /> Remove the saved key
            </label>
          )}
          <label className="fld">
            <span className="fld-cap">Model</span>
            <input className="input" list="admin-models" value={form.model} placeholder={preset.models[0] ?? "model name"} onChange={(e) => set({ model: e.target.value })} />
            <datalist id="admin-models">
              {preset.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          {(preset.needsBaseUrl || preset.group === "Local" || form.baseUrl) && (
            <label className="fld">
              <span className="fld-cap">Base URL</span>
              <input className="input" value={form.baseUrl} placeholder={preset.baseUrlHint ?? preset.baseUrl ?? "https://…/v1"} onChange={(e) => set({ baseUrl: e.target.value })} />
            </label>
          )}
          <div className="fld">
            <span className="fld-cap">Quality</span>
            <div className="seg-control" role="radiogroup" aria-label="Quality">
              {(["fast", "balanced", "best"] as const).map((m) => (
                <button key={m} role="radio" aria-checked={form.mode === m} className={form.mode === m ? "active" : ""} onClick={() => set({ mode: m })}>
                  {m === "fast" ? "Fast" : m === "balanced" ? "Balanced" : "Best"}
                </button>
              ))}
            </div>
            <span className="hint sm">
              {form.mode === "fast" ? "One pass, cheapest." : form.mode === "balanced" ? "The director reviews its own draft when it looks weak." : "Self-review pass on: slower, more polished videos."}
            </span>
          </div>
          {preset.vision && (
            <label className="check-row">
              <input type="checkbox" checked={form.images} onChange={(e) => set({ images: e.target.checked })} /> Send website screenshots to the model
            </label>
          )}
          {preset.note && <p className="hint">{preset.note}</p>}
        </>
      )}
      <div className="admin-row">
        <label className="fld">
          <span className="fld-cap">AI videos per day (site-wide)</span>
          <input className="input" type="number" min={0} value={form.dailyBudget} placeholder={`${s.envBudget} (default)`} onChange={(e) => set({ dailyBudget: e.target.value })} />
        </label>
        <label className="fld">
          <span className="fld-cap">AI videos per visitor per day</span>
          <input className="input" type="number" min={0} value={form.perVisitor} placeholder="12 (default)" onChange={(e) => set({ perVisitor: e.target.value })} />
        </label>
      </div>
      <p className="hint">Past these limits visitors still get videos, made by the built-in director. Accounts also have monthly allowances, set in Plans.</p>
      {test && (
        <p className={test.ok ? "ok-msg" : "error"} role="status">
          {test.text}
        </p>
      )}
      <div className="admin-row actions">
        <button className="btn btn-ghost" onClick={runTest} disabled={!!busy || !preset}>
          {busy === "test" ? "Testing…" : "Test connection"}
        </button>
        <button className="btn btn-primary" onClick={save} disabled={!!busy || !dirty}>
          {busy === "save" ? "Saving…" : dirty ? "Save settings" : "Saved"}
        </button>
      </div>
      <SaveBar dirty={dirty} busy={busy === "save"} onSave={save} onDiscard={() => fill(s)} label="Save settings" />
    </section>
  );
}

/** The director's AI, then the voice-over AI, on one tab. */
export default function AiTab() {
  const [keys, setKeys] = useState<SetupView | null>(null);
  useEffect(() => {
    api<SetupView>("/api/admin/setup")
      .then(setKeys)
      .catch(() => {});
  }, []);
  return (
    <>
      <DirectorAi />
      {keys && (
        <KeysCard
          title="Voice-over AI"
          intro={
            <>
              Server keys for narration. Visitors who pick OpenAI or ElevenLabs voices in the studio use these when they haven&apos;t added their own key (voice requests are
              rate-limited per visitor). The free on-device voice needs no key.
            </>
          }
          names={["openaiVoice", "elevenlabs"]}
          view={keys}
          onSaved={setKeys}
        />
      )}
    </>
  );
}
