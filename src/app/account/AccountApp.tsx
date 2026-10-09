"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { REFUND_DAYS } from "@/lib/stripe-links";
import { describeLimits, PLAN_NAMES, type PlanId, type PlanLimits } from "@/lib/plans";
import { countries, REGIONS, regionLabel } from "@/lib/regions";

type User = {
  id: string;
  email: string;
  plan: PlanId;
  firstName?: string;
  createdAt: number;
  upgradeRequestedAt?: number;
  mustChangePassword: boolean;
  planSource?: "admin" | "stripe";
  billingStatus?: "active" | "past_due" | "canceling" | "canceled";
  periodEnd?: number;
};
type Billing = { online: boolean; monthly?: string | null; yearly?: string | null; yearlyPrice?: string | null; portal?: string | null };
type Me = {
  user: User | null;
  limits: PlanLimits;
  usage: { ai: number; imports: number; exports: number };
  plans: Record<PlanId, PlanLimits>;
  proPrice: string | null;
  contactEmail: string | null;
  billing: Billing;
};
type Film = { id: string; title: string; thumb?: string; aspect: string; scenes: number; seconds: number; updatedAt: number };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (res.status === 204) return {} as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as { error?: string }).error ?? `HTTP ${res.status}`), { status: res.status });
  return data as T;
}

/** Only same-site paths are followed after signing in. */
/** A path on this site only (browsers read "/\\evil.com" as another site, so backslashes are refused). */
const safeNext = (n: string | null) => {
  if (!n || !n.startsWith("/") || n.startsWith("//") || n.includes("\\")) return null;
  try {
    return new URL(n, location.origin).origin === location.origin ? n : null;
  } catch {
    return null;
  }
};
/** Came to buy Pro (from the pricing page): after signing in, go straight to the plans. */
const wantsPro = () => typeof location !== "undefined" && new URLSearchParams(location.search).get("plan") === "pro";
const showPlans = () => setTimeout(() => document.getElementById("plan")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
/** The sign-up headline: the free videos, when Free has a set number. */
const freeHeadline = (n: number) => (n >= 100_000 ? "Save your intros" : `${n} free video${n === 1 ? "" : "s"} for your business`);
/** The limit after a usage count: "of 50", or "(no limit)" for the big ones. */
const usageOf = (n: number) => (n >= 100_000 ? "(no limit)" : `of ${n}`);

export default function AccountApp() {
  const [me, setMe] = useState<Me | null>(null);
  const load = useCallback(() => api<Me>("/api/account").then(setMe), []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!me) return <main className="account"><p className="hint">Loading…</p></main>;
  return me.user ? <Dashboard me={me as Me & { user: User }} reload={load} /> : <SignIn me={me} onIn={load} />;
}

function SignIn({ me, onIn }: { me: Me; onIn: () => void }) {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Sign-up asks only for a first name, a country and, optionally, a state or region.
  const [firstName, setFirstName] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [list, setList] = useState<[string, string][]>([]);
  useEffect(() => {
    const m = new URLSearchParams(location.search).get("mode");
    if (m === "in" || m === "forgot") setMode(m);
    setList(countries());
    // (The country from the browser's language, as a starting point: "en-US" → United States.)
    const guess = (navigator.language.split("-")[1] ?? "").toUpperCase();
    if (/^[A-Z]{2}$/.test(guess)) setCountry(guess);
  }, []);
  const regions = REGIONS[country];
  if (mode === "forgot") return <Forgot me={me} email={email} setEmail={setEmail} onBack={() => setMode("in")} />;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(mode === "up" ? "/api/account" : "/api/account/session", { method: "POST", body: JSON.stringify(mode === "up" ? { email, password, firstName, country, region } : { email, password }) });
      const next = safeNext(new URLSearchParams(location.search).get("next"));
      if (next) location.href = next;
      else onIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="account">
      <div className="account-split">
        <form className="account-card auth" onSubmit={submit}>
          <div className="seg-control">
            <button type="button" className={mode === "up" ? "active" : ""} onClick={() => setMode("up")}>
              Create account
            </button>
            <button type="button" className={mode === "in" ? "active" : ""} onClick={() => setMode("in")}>
              Sign in
            </button>
          </div>
          <h1>{wantsPro() ? (mode === "up" ? "Create an account to get Pro" : "Sign in to get Pro") : mode === "up" ? freeHeadline(me.plans.free.exports) : "Welcome back"}</h1>
          {mode === "up" && !wantsPro() && me.plans.free.exports < 100_000 && <p className="hint">Sign up free: no card needed. Your free videos are yours to use for your business.</p>}
          {mode === "up" && (
            <label className="fld">
              <span className="fld-cap">First name</span>
              <input className="input" autoComplete="given-name" required maxLength={40} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
          )}
          <label className="fld">
            <span className="fld-cap">Email</span>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="fld">
            <span className="fld-cap">
              Password {mode === "up" && <em>at least 8 characters</em>}
            </span>
            <span className="pw-row">
              <input
                className="input"
                type={show ? "text" : "password"}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                required
                minLength={mode === "up" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"}>
                {show ? "Hide" : "Show"}
              </button>
            </span>
          </label>
          {mode === "up" && (
            <div className="fld-row">
              <label className="fld">
                <span className="fld-cap">Country</span>
                <select
                  className="input"
                  autoComplete="country"
                  required
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setRegion("");
                  }}
                >
                  <option value="">Choose…</option>
                  {list.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {country && (
                <label className="fld">
                  <span className="fld-cap">
                    {regionLabel(country)} <em>optional</em>
                  </span>
                  {regions ? (
                    <select className="input" autoComplete="address-level1" value={region} onChange={(e) => setRegion(e.target.value)}>
                      <option value="">Choose…</option>
                      {regions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input className="input" autoComplete="address-level1" maxLength={60} value={region} onChange={(e) => setRegion(e.target.value)} />
                  )}
                </label>
              )}
            </div>
          )}
          {mode === "up" && <p className="hint small">We ask only for what&apos;s above: your email to sign in, and your name, country and state to know who uses Prodintro.com. See the <Link href="/privacy">privacy page</Link>.</p>}
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "One moment…" : mode === "up" ? (me.plans.free.exports < 100_000 ? `Get ${me.plans.free.exports} free videos` : "Create free account") : "Sign in"}
          </button>
          {mode === "in" && (
            <p className="hint">
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setError(null);
                  setMode("forgot");
                }}
              >
                Forgot your password?
              </button>
            </p>
          )}
        </form>
        <PlanCards me={me} />
      </div>
    </main>
  );
}

/** Forgot password: a reset link by email (or, where the site sends no email, who to ask). */
function Forgot({ me, email, setEmail, onBack }: { me: Me; email: string; setEmail: (v: string) => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; minutes: number; devLink?: string } | null>(null);
  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent(await api<{ email: string; minutes: number; devLink?: string }>("/api/account/reset", { method: "POST", body: JSON.stringify({ email }) }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="account">
      <div className="account-split">
        {sent ? (
          <div className="account-card auth sent">
            <span className="sent-icon" aria-hidden>
              ✉️
            </span>
            <h1>Check your inbox</h1>
            <p>
              If an account uses <strong>{sent.email}</strong>, we&apos;ve sent it a link to choose a new password. It works once, for {sent.minutes} minutes.
            </p>
            <p className="hint">No email? Check spam or promotions, or send it again.</p>
            {sent.devLink && (
              <p className="hint">
                Development (no email service set up): <a href={sent.devLink}>open the reset link</a>
              </p>
            )}
            {error && <p className="error">{error}</p>}
            <div className="admin-row actions">
              <button type="button" className="btn btn-ghost" onClick={onBack}>
                Back to sign in
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => send()}>
                {busy ? "Sending…" : "Send it again"}
              </button>
            </div>
          </div>
        ) : (
          <form className="account-card auth" onSubmit={send}>
            <h1>Reset your password</h1>
            <p className="hint">Enter your account&apos;s email and we&apos;ll send you a link to choose a new password.</p>
            <label className="fld">
              <span className="fld-cap">Email</span>
              <input className="input" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {error && (
              <p className="error">
                {error}
                {me.contactEmail && /isn't set up/.test(error) && (
                  <>
                    {" "}
                    <a href={`mailto:${me.contactEmail}?subject=Password%20reset`}>Write now</a>
                  </>
                )}
              </p>
            )}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Sending…" : "Email me a reset link"}
            </button>
            <p className="hint">
              <button type="button" className="link-btn" onClick={onBack}>
                Back to sign in
              </button>
            </p>
          </form>
        )}
        <PlanCards me={me} />
      </div>
    </main>
  );
}

function PlanCards({ me, current, onRequest, requested }: { me: Me; current?: PlanId; onRequest?: () => void; requested?: boolean }) {
  // No checkout while Pro unlocks nothing over Free: nobody should pay for the same limits.
  const proWorth = JSON.stringify(me.plans.free) !== JSON.stringify(me.plans.pro);
  // While Pro unlocks nothing more, one card shows the one plan (two identical cards only confuse).
  const ids: PlanId[] = proWorth ? ["free", "pro"] : [current ?? "free"];
  return (
    <div className={`plan-cards${ids.length === 1 ? " single" : ""}`}>
      {ids.map((id) => (
        <div key={id} className={`account-card plan-card ${id}${current === id ? " current" : ""}`}>
          <header>
            <h2>{PLAN_NAMES[id]}</h2>
            <span className="price">{id === "free" ? "$0" : me.proPrice || (me.billing.online ? "" : "Ask us")}</span>
          </header>
          <ul>
            {describeLimits(me.plans[id]).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {current === id && <span className="plan-badge current">Your plan</span>}
          {id === "pro" && current === "free" && proWorth && (me.billing.monthly || me.billing.yearly) && (
            <div className="plan-buy">
              {me.billing.monthly && (
                <a className="btn btn-primary" href={me.billing.monthly}>
                  Upgrade{me.proPrice ? ` · ${me.proPrice}` : ""}
                </a>
              )}
              {me.billing.yearly && (
                <a className="btn btn-ghost" href={me.billing.yearly}>
                  Yearly{me.billing.yearlyPrice ? ` · ${me.billing.yearlyPrice}` : ""}
                </a>
              )}
              <span className="hint">
                Secure checkout by Stripe. Cancel from Manage billing. <Link href="/terms#refunds">{REFUND_DAYS}-day refunds</Link>
              </span>
            </div>
          )}
          {id === "pro" && current === "free" && proWorth && !me.billing.monthly && !me.billing.yearly && onRequest && (
            <button className="btn btn-primary" onClick={onRequest} disabled={requested}>
              {requested ? "Requested ✓" : "Request Pro"}
            </button>
          )}
          {id === "pro" && !current && me.billing.online && proWorth && <span className="hint">Create an account or sign in, then upgrade with Stripe.</span>}
          {!proWorth && <span className="hint">One plan for now: no upgrade needed.</span>}
        </div>
      ))}
    </div>
  );
}

function Dashboard({ me, reload }: { me: Me & { user: User }; reload: () => Promise<void> }) {
  const [films, setFilms] = useState<Film[] | null>(null);
  // Arrived to buy Pro (from the pricing page): the plans are what they came for.
  useEffect(() => {
    if (wantsPro()) showPlans();
  }, []);
  const [limit, setLimit] = useState(me.limits.savedFilms);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const loadFilms = useCallback(async () => {
    const r = await api<{ films: Film[]; limit: number }>("/api/account/films");
    setFilms(r.films);
    setLimit(r.limit);
  }, []);
  // Reload when the plan changes (after an upgrade the saved-intro limit grows).
  useEffect(() => {
    void loadFilms();
  }, [loadFilms, me.limits.savedFilms]);
  const u = me.user;

  // Back from Stripe checkout (?upgraded=1): the webhook switches the plan within seconds.
  const [activating, setActivating] = useState<"" | "waiting" | "done" | "slow">("");
  useEffect(() => {
    if (!new URLSearchParams(location.search).get("upgraded")) return;
    history.replaceState(null, "", "/account");
    if (me.user.plan === "pro") return setActivating("done");
    setActivating("waiting");
    let tries = 0;
    const timer = window.setInterval(async () => {
      tries++;
      const fresh = await api<Me>("/api/account").catch(() => null);
      if (fresh?.user?.plan === "pro") {
        window.clearInterval(timer);
        setActivating("done");
        void reload();
      } else if (tries >= 20) {
        window.clearInterval(timer);
        setActivating("slow");
      }
    }, 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rename = async (id: string, title: string) => {
    setEditing(null);
    if (!title.trim()) return;
    await api(`/api/account/films/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
    void loadFilms();
  };
  const remove = async (f: Film) => {
    if (!confirm(`Delete “${f.title}”? This can't be undone.`)) return;
    await api(`/api/account/films/${f.id}`, { method: "DELETE" });
    void loadFilms();
  };
  const requestPro = async () => {
    await api("/api/account/upgrade", { method: "POST" });
    await reload();
    setMsg({ ok: true, text: `Thanks! The site owner will switch your account to Pro${me.contactEmail ? ` (questions: ${me.contactEmail})` : ""}.` });
  };
  const signOut = async (everywhere = false) => {
    await api(`/api/account/session${everywhere ? "?everywhere=1" : ""}`, { method: "DELETE" });
    location.href = "/account?mode=in";
  };

  return (
    <main className="account">
      <header className="account-head">
        <div>
          <h1>My intros</h1>
          <p className="hint">
            {u.email} · <span className={`plan-badge ${u.plan}`}>{PLAN_NAMES[u.plan]}</span>
          </p>
        </div>
        <div className="account-head-actions">
          <a className="btn btn-primary" href="/studio">
            + New intro
          </a>
          <button className="btn btn-ghost" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {activating === "waiting" && (
        <div className="account-card info-card">
          <span className="spinner sm" /> Payment received. Activating Pro…
        </div>
      )}
      {activating === "done" && <div className="account-card ok-card">You&apos;re on Pro. Thank you!</div>}
      {activating === "slow" && (
        <div className="account-card warn-card">
          Your payment is being confirmed. Pro switches on as soon as Stripe tells us; refresh in a minute{me.contactEmail ? `, or write to ${me.contactEmail}` : ""}.
        </div>
      )}
      {u.billingStatus === "past_due" && (
        <div className="account-card warn-card">
          Your last payment didn&apos;t go through. Stripe will retry; {me.billing.portal ? "update your card in Manage billing" : "please update your card"} to keep Pro.
        </div>
      )}
      {u.mustChangePassword && (
        <div className="account-card warn-card">
          <strong>Choose a new password.</strong> The site owner reset your password; pick your own below.
        </div>
      )}
      {msg && <p className={msg.ok ? "ok-msg" : "error"}>{msg.text}</p>}

      <section>
        <p className="hint">
          {films ? (limit >= 100_000 ? `${films.length} saved` : `${films.length} of ${limit} saved`) : "Loading…"}
          {films && films.length >= limit && u.plan === "free" ? ` · Your Free plan is full: delete one or ${me.billing.online ? "upgrade to Pro" : "request Pro"} to keep more.` : ""}
        </p>
        {films && !films.length && (
          <div className="account-card empty">
            <p>No saved intros yet. Make one in the studio and press Save intro (Ctrl+S).</p>
            <a className="btn btn-primary" href="/studio">
              Open the studio
            </a>
          </div>
        )}
        <div className="saved-grid">
          {films?.map((f) => (
            <div key={f.id} className="saved-card">
              <a className={`film-thumb${f.aspect === "9:16" ? " tall" : ""}`} href={`/studio?film=${f.id}`} title="Open in the studio">
                {f.thumb ? <img src={f.thumb} alt="" /> : null}
              </a>
              <div className="film-meta">
                {editing === f.id ? (
                  <input
                    className="input sm"
                    autoFocus
                    defaultValue={f.title}
                    maxLength={120}
                    onBlur={(e) => rename(f.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                ) : (
                  <strong title="Rename" onClick={() => setEditing(f.id)} className="renamable">
                    {f.title}
                  </strong>
                )}
                <span className="film-when">
                  {f.aspect} · {f.seconds}s · {f.scenes} slides · saved {new Date(f.updatedAt).toLocaleDateString()}
                </span>
                <span className="saved-actions">
                  <a className="btn btn-ghost sm" href={`/studio?film=${f.id}`}>
                    Open
                  </a>
                  <button className="link-btn" onClick={() => setEditing(f.id)}>
                    Rename
                  </button>
                  <button className="link-btn danger" onClick={() => remove(f)}>
                    Delete
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="account-plan" id="plan">
        <h2>Plan</h2>
        <div className="account-card usage">
          <span>
            Videos exported: <strong>{me.usage.exports}</strong> {usageOf(me.limits.exports)}
          </span>
          <span>
            AI videos this month: <strong>{me.usage.ai}</strong> {usageOf(me.limits.aiPerMonth)}
          </span>
          <span>
            Website imports today: <strong>{me.usage.imports}</strong> {usageOf(me.limits.importsPerDay)}
          </span>
        </div>
        {(u.plan === "pro" || me.billing.portal) && (u.billingStatus || me.billing.portal) && (
          <div className="account-card billing-row">
            <span>
              {u.plan !== "pro"
                ? "Your Pro subscription has ended. Invoices and receipts are in Manage billing."
                : u.planSource !== "stripe"
                  ? "Pro, set by the site owner"
                  : u.billingStatus === "canceling" && u.periodEnd
                    ? `Pro until ${new Date(u.periodEnd).toLocaleDateString()} (cancelled; renew any time).`
                    : u.periodEnd && u.periodEnd > Date.now()
                      ? `Pro subscription · renews ${new Date(u.periodEnd).toLocaleDateString()}`
                      : "Pro subscription"}
            </span>
            {me.billing.portal && (
              <a className="btn btn-ghost sm" href={me.billing.portal}>
                Manage billing
              </a>
            )}
          </div>
        )}
        <PlanCards me={me} current={u.plan} onRequest={requestPro} requested={!!u.upgradeRequestedAt} />
        {u.plan === "free" && u.upgradeRequestedAt && <p className="hint">You asked for Pro on {new Date(u.upgradeRequestedAt).toLocaleDateString()}. The site owner will switch your plan.</p>}
      </section>

      <Security mustChange={u.mustChangePassword} onChanged={() => (setMsg({ ok: true, text: "Password changed. Other devices were signed out." }), reload())} onSignOutAll={() => signOut(true)} />
    </main>
  );
}

function Security({ mustChange, onChanged, onSignOutAll }: { mustChange: boolean; onChanged: () => void; onSignOutAll: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [delPw, setDelPw] = useState("");
  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/account/password", { method: "POST", body: JSON.stringify({ current, next }) });
      setCurrent("");
      setNext("");
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const del = async () => {
    if (!confirm("Delete your account and your saved intros? This can't be undone.")) return;
    try {
      await api("/api/account", { method: "DELETE", body: JSON.stringify({ password: delPw }) });
      location.href = "/";
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <section className="account-security">
      <h2>Security</h2>
      <form className="account-card" onSubmit={change}>
        <strong>Change password</strong>
        {!mustChange && (
          <label className="fld">
            <span className="fld-cap">Current password</span>
            <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
        )}
        <label className="fld">
          <span className="fld-cap">
            New password <em>at least 8 characters</em>
          </span>
          <input className="input" type="password" autoComplete="new-password" minLength={8} required value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="admin-row actions">
          <button type="button" className="btn btn-ghost" onClick={onSignOutAll}>
            Sign out everywhere
          </button>
          <button className="btn btn-primary">Change password</button>
        </div>
      </form>
      <details className="account-card danger-zone">
        <summary>Delete account</summary>
        <p className="hint">Deletes your account and your saved intros. Enter your password to confirm.</p>
        <input className="input" type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="Password" />
        <button className="btn btn-ghost danger" onClick={del} disabled={!delPw}>
          Delete my account
        </button>
      </details>
    </section>
  );
}
