"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LoopCanvas from "@/components/LoopCanvas";
import { encodePlan, sanitizePlan } from "@/engine/planner";
import { SKILL_MAP } from "@/engine/skills";
import type { SkillId, VideoPlan } from "@/engine/types";
import { PLAN_NAMES, type PlanId, type PlanLimits } from "@/lib/plans";
import { PROVIDER_GROUPS, PROVIDER_PRESETS, PRESET_MAP } from "@/lib/providers";
import { sceneThumb, thumbsReady } from "@/lib/thumbs";

type Entry = {
  id: string;
  at: number;
  kind: "generated" | "remake" | "take" | "exported";
  visitor: string;
  source: "prompt" | "site";
  prompt?: string;
  url?: string;
  title: string;
  engine: string;
  aspect: string;
  seconds: number;
  scenes: number;
  skills: string[];
  template?: string;
  preset?: string;
};
type Stats = {
  total: number;
  today: number;
  week: number;
  visitors: number;
  exported: number;
  fromSites: number;
  engines: [string, number][];
  skills: [string, number][];
  templates: [string, number][];
  perDay: { day: string; films: number }[];
};
type List = { items: Entry[]; total: number; page: number; size: number; stats: Stats; aiToday: number; aiBudget: number };
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

const KIND_LABEL: Record<Entry["kind"], string> = { generated: "New film", remake: "Remake", take: "Alternative take", exported: "Exported" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as { error?: string }).error ?? `HTTP ${res.status}`), { status: res.status });
  return data as T;
}

const when = (t: number) => {
  const d = Date.now() - t;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.round(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/** The owner's admin area: films visitors made, and the server's AI settings. */
export default function AdminApp() {
  const [state, setState] = useState<"loading" | "off" | "login" | "in">("loading");
  const [tab, setTab] = useState<"films" | "users" | "plans" | "ai">("films");
  useEffect(() => {
    api<{ enabled: boolean; authed: boolean }>("/api/admin/session")
      .then((s) => setState(!s.enabled ? "off" : s.authed ? "in" : "login"))
      .catch(() => setState("off"));
  }, []);
  const signOut = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    setState("login");
  };

  if (state === "loading") return <main className="admin"><p className="hint">Loading…</p></main>;
  if (state === "off")
    return (
      <main className="admin">
        <div className="admin-card narrow">
          <h1>Admin is off</h1>
          <p className="hint">
            Set the <code>ADMIN_PASSWORD</code> environment variable on your server (for example in Railway → Variables) and redeploy. Until then nothing is logged
            and this page stays closed.
          </p>
        </div>
      </main>
    );
  if (state === "login") return <Login onIn={() => setState("in")} />;
  return (
    <main className="admin">
      <header className="admin-head">
        <h1>Admin</h1>
        <nav className="admin-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "films"} className={tab === "films" ? "active" : ""} onClick={() => setTab("films")}>
            Films
          </button>
          <button role="tab" aria-selected={tab === "users"} className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
            Users
          </button>
          <button role="tab" aria-selected={tab === "plans"} className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")}>
            Plans
          </button>
          <button role="tab" aria-selected={tab === "ai"} className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}>
            AI settings
          </button>
        </nav>
        <div className="admin-head-actions">
          <a className="btn btn-ghost" href="/studio">
            Open studio
          </a>
          <button className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      {tab === "films" && <Films onSignedOut={() => setState("login")} />}
      {tab === "users" && <Users onSignedOut={() => setState("login")} />}
      {tab === "plans" && <Plans onSignedOut={() => setState("login")} />}
      {tab === "ai" && <AiSettingsPanel onSignedOut={() => setState("login")} />}
    </main>
  );
}

function Login({ onIn }: { onIn: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/session", { method: "POST", body: JSON.stringify({ password: pw }) });
      onIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="admin">
      <form className="admin-card narrow" onSubmit={submit}>
        <h1>Admin sign in</h1>
        <label className="fld">
          <span className="fld-cap">Password</span>
          <input className="input" type="password" autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy || !pw}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="hint">The password is the server&apos;s ADMIN_PASSWORD. Sessions last 12 hours.</p>
      </form>
    </main>
  );
}

function Films({ onSignedOut }: { onSignedOut: () => void }) {
  const [data, setData] = useState<List | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [visitor, setVisitor] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, VideoPlan | null>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page) });
    if (q.trim()) qs.set("q", q.trim());
    if (kind) qs.set("kind", kind);
    if (visitor) qs.set("visitor", visitor);
    try {
      setData(await api<List>(`/api/admin/films?${qs}`));
      setError(null);
    } catch (e) {
      if ((e as { status?: number }).status === 401) onSignedOut();
      else setError((e as Error).message);
    }
  }, [q, kind, visitor, page, onSignedOut]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Fetch each film's storyboard (one at a time) and draw a thumbnail of its middle slide.
  useEffect(() => {
    if (!data) return;
    let alive = true;
    (async () => {
      await thumbsReady();
      for (const e of data.items) {
        if (!alive) return;
        if (plans[e.id] !== undefined) continue;
        try {
          const f = await api<{ plan: VideoPlan | null }>(`/api/admin/films/${e.id}`);
          const plan = f.plan ? sanitizePlan(f.plan) : null;
          if (!alive) return;
          setPlans((p) => ({ ...p, [e.id]: plan }));
          if (plan?.scenes.length) {
            const i = Math.min(plan.scenes.length - 1, Math.max(0, Math.floor(plan.scenes.length / 2)));
            setThumbs((t) => ({ ...t, [e.id]: sceneThumb(plan.scenes[i], plan) }));
          }
        } catch {
          setPlans((p) => ({ ...p, [e.id]: null }));
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const remove = async (ids: string[] | "all") => {
    if (!confirm(ids === "all" ? "Delete every logged film? This can't be undone." : "Delete this film from the log?")) return;
    await api("/api/admin/films", { method: "DELETE", body: JSON.stringify(ids === "all" ? { all: true } : { ids }) });
    setOpen(null);
    load();
  };

  const s = data?.stats;
  const maxDay = Math.max(1, ...(s?.perDay.map((d) => d.films) ?? [1]));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const openEntry = data?.items.find((e) => e.id === open);
  return (
    <>
      {error && <p className="error">{error}</p>}
      {s && (
        <section className="admin-stats">
          <Stat label="Films logged" value={s.total} />
          <Stat label="Today" value={s.today} />
          <Stat label="Last 7 days" value={s.week} />
          <Stat label="Visitors" value={s.visitors} />
          <Stat label="Exported" value={s.exported} />
          <Stat label="From websites" value={s.fromSites} />
          <Stat label="AI today (server key)" value={`${data!.aiToday} / ${data!.aiBudget}`} />
          <div className="admin-card chart">
            <span className="fld-cap">Films per day (14 days)</span>
            <div className="bars">
              {s.perDay.map((d) => (
                <div key={d.day} className="bar" title={`${d.day}: ${d.films}`}>
                  <span style={{ height: `${(d.films / maxDay) * 100}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="admin-card tops">
            <span className="fld-cap">Most used slides</span>
            <div className="chips">
              {s.skills.map(([k, n]) => (
                <button key={k} className="chip" onClick={() => setQ(k)}>
                  {SKILL_MAP[k as SkillId]?.name ?? k} · {n}
                </button>
              ))}
            </div>
            <span className="fld-cap">Directors</span>
            <div className="chips">
              {s.engines.map(([k, n]) => (
                <span key={k} className="chip static">
                  {k} · {n}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="admin-filters">
        <input className="input" placeholder="Search prompts, sites, titles, slides…" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} />
        <select className="select" value={kind} onChange={(e) => (setKind(e.target.value), setPage(0))}>
          <option value="">All events</option>
          {Object.entries(KIND_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {visitor && (
          <button className="chip" onClick={() => setVisitor("")} title="Show all visitors">
            Visitor {visitor} ×
          </button>
        )}
        <span className="hint">{data ? `${data.total} film${data.total === 1 ? "" : "s"}` : ""}</span>
        {!!data?.total && (
          <button className="link-btn danger" onClick={() => remove("all")}>
            Delete all
          </button>
        )}
      </section>

      {data && !data.items.length && (
        <div className="admin-card">
          <p className="hint">No films yet. Every film made in the studio (new, remakes, alternative takes) and every export will show up here.</p>
        </div>
      )}
      <section className="admin-grid">
        {data?.items.map((e) => (
          <button key={e.id} className="film-card" onClick={() => setOpen(e.id)}>
            <span className={`film-thumb${e.aspect === "9:16" ? " tall" : ""}`}>{thumbs[e.id] ? <img src={thumbs[e.id]} alt="" /> : null}</span>
            <span className="film-meta">
              <strong>{e.title}</strong>
              <span className="film-src">{e.url ? e.url.replace(/^https?:\/\//, "") : e.prompt || "—"}</span>
              <span className="film-tags">
                <span className={`tag ${e.kind}`}>{KIND_LABEL[e.kind]}</span>
                <span className="tag">{e.engine === "builtin" ? "Built-in" : e.engine === "export" ? e.preset || "Export" : "AI"}</span>
                <span className="tag">
                  {e.aspect} · {e.seconds}s · {e.scenes} slides
                </span>
              </span>
              <span className="film-when">
                {when(e.at)} ·{" "}
                <span
                  role="link"
                  tabIndex={0}
                  className="visitor"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setVisitor(e.visitor);
                    setPage(0);
                  }}
                  title="Show this visitor's films"
                >
                  visitor {e.visitor}
                </span>
              </span>
            </span>
          </button>
        ))}
      </section>
      {pages > 1 && (
        <nav className="admin-pages">
          <button className="btn btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            ← Newer
          </button>
          <span className="hint">
            Page {page + 1} of {pages}
          </span>
          <button className="btn btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
            Older →
          </button>
        </nav>
      )}

      {openEntry && <FilmDetail entry={openEntry} plan={plans[openEntry.id]} onClose={() => setOpen(null)} onDelete={() => remove([openEntry.id])} />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="admin-card stat">
      <span className="fld-cap">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FilmDetail({ entry, plan, onClose, onDelete }: { entry: Entry; plan: VideoPlan | null | undefined; onClose: () => void; onDelete: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const studioLink = useMemo(() => (plan ? `/studio#plan=${encodePlan(plan)}` : null), [plan]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal admin-detail" role="dialog" aria-label={entry.title} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{entry.title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className={`admin-preview${entry.aspect === "9:16" ? " tall" : ""}`}>
          {plan ? <LoopCanvas plan={plan} long={720} fps={30} /> : <p className="hint">{plan === null ? "Storyboard not available." : "Loading…"}</p>}
        </div>
        <dl className="admin-facts">
          <dt>{entry.url ? "Website" : "Prompt"}</dt>
          <dd>
            {entry.url ? (
              <a href={entry.url} target="_blank" rel="noopener noreferrer nofollow">
                {entry.url}
              </a>
            ) : (
              entry.prompt || "—"
            )}
          </dd>
          <dt>Event</dt>
          <dd>
            {KIND_LABEL[entry.kind]}
            {entry.preset ? ` · ${entry.preset}` : ""} · {new Date(entry.at).toLocaleString()}
          </dd>
          <dt>Director</dt>
          <dd>{entry.engine === "builtin" ? "Built-in director" : entry.engine}</dd>
          <dt>Film</dt>
          <dd>
            {entry.aspect} · {entry.seconds}s · {entry.scenes} slides{entry.template ? ` · style ${entry.template}` : ""}
          </dd>
          <dt>Visitor</dt>
          <dd>{entry.visitor} (anonymous)</dd>
        </dl>
        {plan && (
          <ol className="admin-scenes">
            {plan.scenes.map((s, i) => (
              <li key={i}>
                <span className="tag">{SKILL_MAP[s.skill]?.name ?? s.skill}</span> {s.text.replace(/\*/g, "")}
                {s.items?.length ? <small> — {s.items.join(", ")}</small> : null}
              </li>
            ))}
          </ol>
        )}
        <footer>
          {studioLink && (
            <a className="btn btn-primary" href={studioLink} target="_blank" rel="noopener">
              Open in studio
            </a>
          )}
          <button className="btn btn-ghost danger" onClick={onDelete}>
            Delete
          </button>
        </footer>
      </div>
    </div>
  );
}

function AiSettingsPanel({ onSignedOut }: { onSignedOut: () => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [form, setForm] = useState({ provider: "builtin", apiKey: "", model: "", baseUrl: "", mode: "balanced", images: true, dailyBudget: "", perVisitor: "", clearKey: false });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  const fill = (v: Settings) => {
    setS(v);
    setForm({
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
  };
  useEffect(() => {
    api<Settings>("/api/admin/settings")
      .then(fill)
      .catch((e) => ((e as { status?: number }).status === 401 ? onSignedOut() : setMsg({ ok: false, text: (e as Error).message })));
  }, [onSignedOut]);
  const preset = PRESET_MAP[form.provider];
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const payload = () => ({ ...form, dailyBudget: form.dailyBudget === "" ? null : Number(form.dailyBudget), perVisitor: form.perVisitor === "" ? null : Number(form.perVisitor) });
  const save = async () => {
    setBusy("save");
    setMsg(null);
    try {
      fill(await api<Settings>("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload()) }));
      setMsg({ ok: true, text: "Saved. New films use these settings right away." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };
  const test = async () => {
    setBusy("test");
    setMsg(null);
    try {
      const r = await api<{ ok: boolean; label?: string; error?: string }>("/api/admin/settings/test", { method: "POST", body: JSON.stringify(payload()) });
      setMsg(r.ok ? { ok: true, text: `Connected: ${r.label}` } : { ok: false, text: r.error ?? "Failed" });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };
  if (!s) return <p className="hint">{msg?.text ?? "Loading…"}</p>;
  const sameProvider = form.provider === s.provider;
  return (
    <section className="admin-card admin-ai">
      <p>
        <span className="fld-cap">In use now</span>
        <br />
        <strong>{s.active}</strong>
      </p>
      <p className="hint">
        This is the AI the server&apos;s director uses when a visitor hasn&apos;t added a key of their own (their own keys stay in their browser). The key is stored on the
        server&apos;s data volume, readable only by the app, and is never sent back to the browser.
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
            <div className="seg-control">
              {(["fast", "balanced", "best"] as const).map((m) => (
                <button key={m} className={form.mode === m ? "active" : ""} onClick={() => set({ mode: m })}>
                  {m === "fast" ? "Fast" : m === "balanced" ? "Balanced (self-review when needed)" : "Best (always self-review)"}
                </button>
              ))}
            </div>
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
          <span className="fld-cap">AI films per day (everyone)</span>
          <input className="input" type="number" min={0} value={form.dailyBudget} placeholder={`${s.envBudget} (default)`} onChange={(e) => set({ dailyBudget: e.target.value })} />
        </label>
        <label className="fld">
          <span className="fld-cap">AI films per visitor per day</span>
          <input className="input" type="number" min={0} value={form.perVisitor} placeholder="12 (default)" onChange={(e) => set({ perVisitor: e.target.value })} />
        </label>
      </div>
      <p className="hint">Past these limits visitors still get films, made by the built-in director.</p>
      {msg && <p className={msg.ok ? "ok-msg" : "error"}>{msg.text}</p>}
      <div className="admin-row actions">
        <button className="btn btn-ghost" onClick={test} disabled={!!busy}>
          {busy === "test" ? "Testing…" : "Test connection"}
        </button>
        <button className="btn btn-primary" onClick={save} disabled={!!busy}>
          {busy === "save" ? "Saving…" : "Save settings"}
        </button>
      </div>
    </section>
  );
}

type AdminUser = {
  id: string;
  email: string;
  plan: PlanId;
  createdAt: number;
  lastLoginAt?: number;
  upgradeRequestedAt?: number;
  mustChangePassword: boolean;
  disabled: boolean;
  films: number;
  usage: { aiMonth?: string; ai?: number };
};

function Users({ onSignedOut }: { onSignedOut: () => void }) {
  const [data, setData] = useState<{ users: AdminUser[]; counts: { total: number; pro: number; requests: number } } | null>(null);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"" | "requests" | "pro">("");
  const [temp, setTemp] = useState<{ email: string; pw: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await api("/api/admin/users"));
    } catch (e) {
      if ((e as { status?: number }).status === 401) onSignedOut();
      else setError((e as Error).message);
    }
  }, [onSignedOut]);
  useEffect(() => {
    void load();
  }, [load]);
  const patch = async (u: AdminUser, body: object) => {
    await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify(body) });
    void load();
  };
  const reset = async (u: AdminUser) => {
    if (!confirm(`Reset the password of ${u.email}? They'll be signed out and must choose a new one.`)) return;
    const r = await api<{ tempPassword: string }>(`/api/admin/users/${u.id}`, { method: "POST" });
    setTemp({ email: u.email, pw: r.tempPassword });
    void load();
  };
  const remove = async (u: AdminUser) => {
    if (!confirm(`Delete ${u.email} and their ${u.films} saved intro(s)? This can't be undone.`)) return;
    await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
    void load();
  };
  if (!data) return <p className="hint">{error ?? "Loading…"}</p>;
  const shown = data.users.filter(
    (u) => (!q.trim() || u.email.includes(q.trim().toLowerCase())) && (only === "" || (only === "pro" ? u.plan === "pro" : !!u.upgradeRequestedAt && u.plan !== "pro")),
  );
  return (
    <>
      <section className="admin-stats">
        <Stat label="Accounts" value={data.counts.total} />
        <Stat label="Pro" value={data.counts.pro} />
        <Stat label="Asking for Pro" value={data.counts.requests} />
      </section>
      {temp && (
        <div className="admin-card warn-card">
          <strong>One-time password for {temp.email}:</strong> <code>{temp.pw}</code>
          <span className="hint">Send it to them privately. They sign in with it and must choose a new password. It isn&apos;t shown again.</span>
          <button className="link-btn" onClick={() => setTemp(null)}>
            Done
          </button>
        </div>
      )}
      <section className="admin-filters">
        <input className="input" placeholder="Search by email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg-control">
          {(
            [
              ["", "All"],
              ["requests", "Asking for Pro"],
              ["pro", "Pro"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} className={only === k ? "active" : ""} onClick={() => setOnly(k)}>
              {label}
            </button>
          ))}
        </div>
      </section>
      {!shown.length && (
        <div className="admin-card">
          <p className="hint">{data.users.length ? "No accounts match." : "No accounts yet. Visitors create one at /account to save their intros."}</p>
        </div>
      )}
      <div className="admin-table">
        {shown.map((u) => (
          <div key={u.id} className={`admin-user${u.disabled ? " disabled" : ""}`}>
            <div className="who">
              <strong>{u.email}</strong>
              <span className="hint">
                joined {new Date(u.createdAt).toLocaleDateString()} · last in {u.lastLoginAt ? when(u.lastLoginAt) : "never"} · {u.films} saved
                {u.usage?.aiMonth === new Date().toISOString().slice(0, 7) ? ` · ${u.usage.ai ?? 0} AI films this month` : ""}
              </span>
              <span className="film-tags">
                {u.upgradeRequestedAt && u.plan !== "pro" && <span className="tag remake">Asked for Pro {when(u.upgradeRequestedAt)}</span>}
                {u.mustChangePassword && <span className="tag">Password reset pending</span>}
                {u.disabled && <span className="tag">Disabled</span>}
              </span>
            </div>
            <div className="seg-control plan-switch">
              {(["free", "pro"] as PlanId[]).map((id) => (
                <button key={id} className={u.plan === id ? "active" : ""} onClick={() => u.plan !== id && patch(u, { plan: id })}>
                  {PLAN_NAMES[id]}
                </button>
              ))}
            </div>
            <div className="user-actions">
              <button className="link-btn" onClick={() => reset(u)}>
                Reset password
              </button>
              <button className="link-btn" onClick={() => patch(u, { disabled: !u.disabled })}>
                {u.disabled ? "Enable" : "Disable"}
              </button>
              <button className="link-btn danger" onClick={() => remove(u)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Plans({ onSignedOut }: { onSignedOut: () => void }) {
  const [plans, setPlans] = useState<Record<PlanId, PlanLimits> | null>(null);
  const [proPrice, setProPrice] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    api<{ plans: Record<PlanId, PlanLimits>; proPrice: string; contactEmail: string }>("/api/admin/plans")
      .then((r) => {
        setPlans(r.plans);
        setProPrice(r.proPrice);
        setContactEmail(r.contactEmail);
      })
      .catch((e) => ((e as { status?: number }).status === 401 ? onSignedOut() : setMsg({ ok: false, text: (e as Error).message })));
  }, [onSignedOut]);
  if (!plans) return <p className="hint">{msg?.text ?? "Loading…"}</p>;
  const set = (id: PlanId, patch: Partial<PlanLimits>) => setPlans((p) => (p ? { ...p, [id]: { ...p[id], ...patch } } : p));
  const save = async () => {
    try {
      const r = await api<{ plans: Record<PlanId, PlanLimits> }>("/api/admin/plans", { method: "PUT", body: JSON.stringify({ plans, proPrice, contactEmail }) });
      setPlans(r.plans);
      setMsg({ ok: true, text: "Saved. The pricing page and every account use these limits now." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  const num = (id: PlanId, key: "savedFilms" | "aiPerMonth" | "importsPerDay", label: string, hint?: string) => (
    <label className="fld">
      <span className="fld-cap">
        {label} {hint && <em>{hint}</em>}
      </span>
      <input className="input" type="number" min={0} value={plans[id][key]} onChange={(e) => set(id, { [key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
    </label>
  );
  return (
    <section className="admin-plans">
      <p className="hint">
        No payment provider is connected yet: visitors ask for Pro from their account page, and you switch them in <strong>Users</strong>. Saved intros, the AI
        allowance and website imports are enforced by the server. The watermark and export size are applied in the browser, where videos are rendered.
      </p>
      <div className="admin-row">
        {(["free", "pro"] as PlanId[]).map((id) => (
          <div key={id} className="admin-card">
            <h2>{PLAN_NAMES[id]}</h2>
            {num(id, "savedFilms", "Saved intros")}
            {num(id, "aiPerMonth", "AI films a month", "on the site's AI; 0 = built-in director only")}
            {num(id, "importsPerDay", "Website imports a day")}
            <label className="fld">
              <span className="fld-cap">Largest export</span>
              <select className="select" value={plans[id].maxLong} onChange={(e) => set(id, { maxLong: Number(e.target.value) })}>
                <option value={1280}>720p</option>
                <option value={1920}>1080p</option>
                <option value={2560}>1440p</option>
                <option value={3840}>4K</option>
              </select>
            </label>
            <label className="fld">
              <span className="fld-cap">Frame rate</span>
              <select className="select" value={plans[id].maxFps} onChange={(e) => set(id, { maxFps: Number(e.target.value) })}>
                <option value={30}>30 fps</option>
                <option value={60}>60 fps</option>
              </select>
            </label>
            <label className="check-row">
              <input type="checkbox" checked={plans[id].watermark} onChange={(e) => set(id, { watermark: e.target.checked })} /> Watermark on exports
            </label>
          </div>
        ))}
      </div>
      <div className="admin-card">
        <div className="admin-row">
          <label className="fld">
            <span className="fld-cap">Pro price shown on the pricing page</span>
            <input className="input" value={proPrice} maxLength={40} placeholder="e.g. $9 / month (empty shows “Ask us”)" onChange={(e) => setProPrice(e.target.value)} />
          </label>
          <label className="fld">
            <span className="fld-cap">Contact email</span>
            <input className="input" type="email" value={contactEmail} maxLength={120} placeholder="for upgrades and password resets" onChange={(e) => setContactEmail(e.target.value)} />
          </label>
        </div>
      </div>
      {msg && <p className={msg.ok ? "ok-msg" : "error"}>{msg.text}</p>}
      <div className="admin-row actions">
        <button className="btn btn-primary" onClick={save}>
          Save plans
        </button>
      </div>
    </section>
  );
}
