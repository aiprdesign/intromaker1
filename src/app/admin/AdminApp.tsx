"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Nav";
import AiTab from "./AiTab";
import BillingTab from "./BillingTab";
import FilmsTab from "./FilmsTab";
import PlansTab from "./PlansTab";
import UsersTab from "./UsersTab";
import { AdminUiProvider, api } from "./ui";

const TABS = [
  { id: "films", label: "Films" },
  { id: "users", label: "Users" },
  { id: "plans", label: "Plans" },
  { id: "billing", label: "Billing" },
  { id: "ai", label: "AI" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const isTab = (v: string): v is Tab => TABS.some((t) => t.id === v);

/** The owner's admin area: films visitors made, accounts, plans, Stripe billing and the server's AI. */
export default function AdminApp() {
  const [state, setState] = useState<"loading" | "off" | "login" | "in">("loading");
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    api<{ enabled: boolean; authed: boolean }>("/api/admin/session")
      .then((s) => setState(!s.enabled ? "off" : s.authed ? "in" : "login"))
      .catch(() => setState("off"));
  }, []);
  useEffect(() => {
    const out = () => {
      setState((s) => {
        if (s === "in") setExpired(true);
        return s === "in" ? "login" : s;
      });
    };
    window.addEventListener("admin:expired", out);
    return () => window.removeEventListener("admin:expired", out);
  }, []);

  if (state === "loading")
    return (
      <main className="admin">
        <p className="hint">Loading…</p>
      </main>
    );
  if (state === "off")
    return (
      <main className="admin">
        <div className="admin-card narrow">
          <Logo />
          <h1>Admin is off</h1>
          <p className="hint">
            Set the <code>ADMIN_PASSWORD</code> environment variable on your server (for example in Railway → Variables) and redeploy. Until then nothing is logged
            and this page stays closed.
          </p>
          <a className="link-btn" href="/">
            ← Back to site
          </a>
        </div>
      </main>
    );
  return (
    <AdminUiProvider>
      {state === "login" ? (
        <Login
          expired={expired}
          onIn={() => {
            setExpired(false);
            setState("in");
          }}
        />
      ) : (
        <Shell
          onSignOut={async () => {
            await fetch("/api/admin/session", { method: "DELETE" });
            setState("login");
          }}
        />
      )}
    </AdminUiProvider>
  );
}

function Login({ onIn, expired }: { onIn: () => void; expired: boolean }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
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
      <form className="admin-card narrow admin-login" onSubmit={submit}>
        <Logo />
        <h1>Admin sign in</h1>
        {expired && !error && (
          <p className="info-line" role="status">
            Your session expired. Sign in again to carry on.
          </p>
        )}
        <label className="fld">
          <span className="fld-cap">Password</span>
          <span className="pw-row">
            <input
              className="input"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              autoFocus
              value={pw}
              aria-invalid={!!error}
              onChange={(e) => setPw(e.target.value)}
            />
            <button type="button" className="btn btn-ghost sm" onClick={() => setShow((v) => !v)} aria-pressed={show}>
              {show ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy || !pw}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="hint">The password is the server&apos;s ADMIN_PASSWORD. Sessions last 12 hours.</p>
        <a className="link-btn" href="/">
          ← Back to site
        </a>
      </form>
    </main>
  );
}

const tabFromHash = (): Tab => {
  const h = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return isTab(h) ? h : "films";
};

function Shell({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTabState] = useState<Tab>(tabFromHash);
  const [requests, setRequests] = useState(0);
  const [billingOn, setBillingOn] = useState(false);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const setTab = useCallback((t: Tab, focus = false) => {
    setTabState(t);
    if (window.location.hash.slice(1) !== t) history.replaceState(null, "", `#${t}`);
    if (focus) tabRefs.current[t]?.focus();
  }, []);
  useEffect(() => {
    const onHash = () => setTabState(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  // Badge and plan hints before their tabs are opened.
  useEffect(() => {
    api<{ counts: { requests: number } }>("/api/admin/users")
      .then((d) => setRequests(d.counts.requests))
      .catch(() => {});
    api<{ monthlyLink: string }>("/api/admin/billing")
      .then((b) => setBillingOn(!!b.monthlyLink))
      .catch(() => {});
  }, []);
  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setTab(TABS[(next + TABS.length) % TABS.length].id, true);
  };
  const onCounts = useCallback((n: number) => setRequests(n), []);

  return (
    <main className="admin">
      <header className="admin-head">
        <div className="admin-brand">
          <Logo />
          <span className="admin-label">Admin</span>
        </div>
        <nav className="admin-tabs" role="tablist" aria-label="Admin sections" onKeyDown={onKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              id={`tab-${t.id}`}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls="admin-panel"
              tabIndex={tab === t.id ? 0 : -1}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "users" && requests > 0 && (
                <span className="tab-badge" title={`${requests} asking for Pro`}>
                  {requests}
                </span>
              )}
              {t.id === "billing" && !billingOn && <span className="tab-dot" title="Not set up" />}
            </button>
          ))}
        </nav>
        <div className="admin-head-actions">
          <a className="btn btn-ghost sm" href="/" target="_blank" rel="noopener">
            View site ↗
          </a>
          <a className="btn btn-ghost sm" href="/studio" target="_blank" rel="noopener">
            Open studio ↗
          </a>
          <button className="btn btn-ghost sm" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>
      <div id="admin-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="admin-panel">
        {tab === "films" && <FilmsTab />}
        {tab === "users" && <UsersTab onCounts={onCounts} />}
        {tab === "plans" && <PlansTab billingOn={billingOn} onOpenBilling={() => setTab("billing")} />}
        {tab === "billing" && <BillingTab onChange={setBillingOn} onOpenPlans={() => setTab("plans")} />}
        {tab === "ai" && <AiTab />}
      </div>
    </main>
  );
}
