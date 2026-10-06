"use client";

import { useEffect, useState } from "react";
import { api, Skeleton, useAdminUi, When } from "./ui";

type View = { on: boolean; pinSet: boolean; env: boolean; allow: string[]; envAllow: string[]; yourIp: string | null; updatedAt: number | null };

const lines = (s: string) => s.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);

/**
 * Site PIN: make the whole site private behind a PIN (like 2020), with addresses that skip it.
 * Visitors without it see only the PIN page; this admin area stays reachable so it can always be
 * turned off.
 */
export default function AccessTab() {
  const { notify, confirm } = useAdminUi();
  const [view, setView] = useState<View | null>(null);
  const [on, setOn] = useState(false);
  const [pin, setPin] = useState("");
  const [allow, setAllow] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const take = (v: View) => {
    setView(v);
    setOn(v.on);
    setPin("");
    setAllow(v.allow.join("\n"));
  };
  useEffect(() => {
    api<View>("/api/admin/gate")
      .then(take)
      .catch((e) => setError((e as Error).message));
  }, []);
  if (!view) return error ? <p className="error">{error}</p> : <Skeleton rows={2} kind="card" />;

  const newPin = pin.trim();
  const tooShort = !!newPin && newPin.length < 4;
  const needsPin = on && !view.pinSet && !newPin;
  const allowList = lines(allow);
  const allowDirty = allowList.join("\n") !== view.allow.join("\n");
  const dirty = (!view.env && on !== view.on) || !!newPin || allowDirty;
  const youListed = !!view.yourIp && (allowList.includes(view.yourIp) || view.envAllow.includes(view.yourIp));
  const save = async () => {
    if (tooShort) return notify("The PIN needs at least 4 characters.", "error");
    if (needsPin) return notify("Choose a PIN first.", "error");
    if (newPin && view.pinSet && !(await confirm({ title: "Change the PIN?", body: "Visitors who unlocked the site with the old PIN will need the new one.", confirm: "Change PIN" }))) return;
    setBusy(true);
    try {
      const v = await api<View>("/api/admin/gate", { method: "PUT", body: JSON.stringify({ on: view.env ? undefined : on, pin: newPin || undefined, allow: allowList }) });
      take(v);
      notify(v.on ? "Saved. The site is private: visitors need the PIN (allowed addresses skip it). This browser is unlocked." : "Saved. The site is open to everyone.");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="access-tab">
      <div className="admin-card">
        <header className="access-head">
          <h2>Site PIN</h2>
          <span className={`tag ${view.on ? "warn" : ""}`}>{view.on ? "Private: PIN required" : "Open to everyone"}</span>
        </header>
        <p className="hint">
          Lock the whole website behind a PIN (for example 2020). Visitors see only a page asking for it; once they enter it, their browser stays unlocked for 30 days. This
          admin area stays open so you can always turn it off.
        </p>
        {view.env && (
          <p className="env-note">
            The PIN is set by the <code>INTROMAKER_SITE_PIN</code> variable where the site is hosted (Railway → Variables), so the site stays private whatever this page says. Change or
            remove that variable to change the PIN or open the site. The allowed addresses below still apply.
          </p>
        )}
        <label className="check-row">
          <input type="checkbox" checked={view.env || on} onChange={(e) => setOn(e.target.checked)} disabled={view.env} />
          <span>Ask visitors for a PIN</span>
        </label>
        <label className="fld">
          <span className="fld-cap">{view.pinSet ? "New PIN (leave empty to keep the current one)" : "PIN"}</span>
          <span className="pw-row">
            <input
              className="input"
              type={show ? "text" : "password"}
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={32}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={view.env ? "Set by INTROMAKER_SITE_PIN" : view.pinSet ? "••••" : "e.g. 2020"}
              aria-invalid={tooShort || needsPin}
              disabled={view.env}
            />
            <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? "Hide PIN" : "Show PIN"}>
              {show ? "Hide" : "Show"}
            </button>
          </span>
          {tooShort && <span className="error">At least 4 characters.</span>}
          {needsPin && <span className="hint">Choose a PIN to turn this on.</span>}
        </label>

        <label className="fld">
          <span className="fld-cap">Allowed IP addresses (skip the PIN), one per line</span>
          <textarea className="input mono" rows={4} value={allow} onChange={(e) => setAllow(e.target.value)} placeholder={"203.0.113.7\n2001:db8::1"} spellCheck={false} />
          {view.yourIp ? (
            <span className="hint">
              Your address now: <code>{view.yourIp}</code>{" "}
              {youListed ? (
                "(on the list)"
              ) : (
                <button type="button" className="link-btn" onClick={() => setAllow((a) => (a.trim() ? `${a.trim()}\n${view.yourIp}` : view.yourIp!))}>
                  Add my address
                </button>
              )}
              . Home and mobile addresses can change; the PIN still works from anywhere.
            </span>
          ) : (
            <span className="hint">Addresses can&apos;t be told apart while INTROMAKER_PROXY_HOPS is 0, so the list can&apos;t work on this server.</span>
          )}
          {view.envAllow.length > 0 && (
            <span className="hint">
              Also allowed by <code>INTROMAKER_SITE_PIN_ALLOW</code>: {view.envAllow.join(", ")}
            </span>
          )}
        </label>

        <div className="admin-row actions">
          <button className="btn btn-primary" onClick={save} disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        <ul className="hint access-notes">
          <li>The PIN is stored hashed on the server; it can&apos;t be shown again, only replaced.</li>
          <li>A new PIN signs out every browser that unlocked with the old one.</li>
          <li>Wrong PINs are limited to 8 tries per 15 minutes per visitor.</li>
          <li>The Stripe webhook and health check keep working while the site is private.</li>
          <li>
            Or set it where the site is hosted (Railway → Variables): <code>INTROMAKER_SITE_PIN</code> (e.g. 2020) makes the site private and wins over this page, and{" "}
            <code>INTROMAKER_SITE_PIN_ALLOW</code> lists addresses that skip it (comma-separated). Remove the PIN variable to open the site.
          </li>
          {view.updatedAt ? (
            <li>
              Last changed <When t={view.updatedAt} />.
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
