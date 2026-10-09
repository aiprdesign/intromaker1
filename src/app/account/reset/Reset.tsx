"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Where a password-reset link lands: the token is read from the address's fragment (so it never
 * reaches server logs) and kept in memory; it's spent only when the new password is sent, so
 * email scanners that open links ahead of the visitor don't use it up.
 */
export default function Reset() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = new URLSearchParams(location.hash.slice(1)).get("t");
    // (The token leaves the address bar straight away.)
    history.replaceState(null, "", location.pathname);
    setToken(t);
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/account/reset/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(data.error ?? "That didn't work. Ask for a new reset link.");
      setDone(true);
      setTimeout(() => location.replace("/account"), 900);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (token === undefined) return <main className="account" />;
  return (
    <main className="account">
      {done ? (
        <div className="account-card auth verify-card">
          <span className="sent-icon" aria-hidden>
            ✓
          </span>
          <h1>Password changed</h1>
          <p className="hint">You&apos;re signed in. Taking you to your account…</p>
        </div>
      ) : !token ? (
        <div className="account-card auth verify-card">
          <h1>That link didn&apos;t work</h1>
          <p>This reset link is incomplete. Open the link from the email again, or ask for a new one.</p>
          <Link className="btn btn-primary" href="/account?mode=forgot">
            Send me a new link
          </Link>
        </div>
      ) : (
        <form className="account-card auth reset-card" onSubmit={submit}>
          <h1>Choose a new password</h1>
          <label className="fld">
            <span className="fld-cap">
              New password <em>at least 8 characters</em>
            </span>
            <span className="pw-row">
              <input className="input" type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"}>
                {show ? "Hide" : "Show"}
              </button>
            </span>
          </label>
          {error && (
            <p className="error">
              {error}{" "}
              {/expired|used|valid|out of date/.test(error) && <Link href="/account?mode=forgot">Ask for a new link</Link>}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save and sign in"}
          </button>
        </form>
      )}
    </main>
  );
}
