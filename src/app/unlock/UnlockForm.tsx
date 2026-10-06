"use client";

import { useState } from "react";

export default function UnlockForm({ next }: { next: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
      if (res.ok) {
        // A full load, so the site is fetched with the unlock cookie.
        window.location.assign(next);
        return;
      }
      setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work. Try again.");
      setPin("");
    } catch {
      setError("Couldn't reach the site. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="unlock-form" onSubmit={submit}>
      <label className="fld">
        <span className="fld-cap">PIN</span>
        <input
          className="input unlock-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={32}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "unlock-error" : undefined}
        />
      </label>
      {error && (
        <p id="unlock-error" className="error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-lg" disabled={busy || !pin.trim()}>
        {busy ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}
