"use client";

import { useEffect, useState } from "react";
import { PLAN_NAMES, type PlanId, type PlanLimits } from "@/lib/plans";
import { api, SaveBar, Skeleton, useAdminUi, useDirty } from "./ui";

type Form = { plans: Record<PlanId, PlanLimits>; proPrice: string; contactEmail: string };
type View = Form & { defaults: Record<PlanId, PlanLimits> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PlansTab({ billingOn, onOpenBilling }: { billingOn: boolean; onOpenBilling: () => void }) {
  const { notify, confirm } = useAdminUi();
  const [saved, setSaved] = useState<Form | null>(null);
  const [defaults, setDefaults] = useState<View["defaults"] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const take = (r: View) => {
    const f = { plans: r.plans, proPrice: r.proPrice, contactEmail: r.contactEmail };
    setSaved(f);
    setForm(f);
    setDefaults(r.defaults);
  };
  useEffect(() => {
    api<View>("/api/admin/plans")
      .then(take)
      .catch((e) => setError((e as Error).message));
  }, []);
  const dirty = useDirty(form, saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!form || !defaults) return error ? <p className="error">{error}</p> : <Skeleton rows={2} kind="card" />;
  const { plans } = form;
  const set = (id: PlanId, patch: Partial<PlanLimits>) => setForm((f) => f && { ...f, plans: { ...f.plans, [id]: { ...f.plans[id], ...patch } } });
  const emailBad = !!form.contactEmail.trim() && !EMAIL.test(form.contactEmail.trim());
  const save = async () => {
    if (emailBad) return notify("The contact email doesn't look right.", "error");
    setBusy(true);
    try {
      take(await api<View>("/api/admin/plans", { method: "PUT", body: JSON.stringify(form) }));
      notify("Plans saved. The pricing page and accounts use them now.");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const resetDefaults = async () => {
    if (!(await confirm({ title: "Reset the limits to the defaults?", body: "The form goes back to the built-in Free and Pro limits. Changes apply when you save.", confirm: "Reset form" }))) return;
    setForm((f) => f && { ...f, plans: defaults });
  };
  const differs = (id: PlanId, key: keyof PlanLimits) => plans[id][key] !== defaults[id][key];
  const num = (id: PlanId, key: "savedFilms" | "aiPerMonth" | "importsPerDay", label: string, hint?: string) => (
    <label className="fld">
      <span className="fld-cap">
        {label} {hint && <em>{hint}</em>}
        {differs(id, key) && <em className="changed"> · default {defaults[id][key]}</em>}
      </span>
      <input className="input" type="number" min={0} inputMode="numeric" value={plans[id][key]} onChange={(e) => set(id, { [key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
    </label>
  );

  return (
    <section className="admin-plans">
      <div className="admin-card info-card">
        {billingOn ? (
          <p>
            <strong>Stripe is connected.</strong> Visitors upgrade from their account page and Pro switches on by itself when they pay. You can still set a plan by
            hand in <strong>Users</strong>.
          </p>
        ) : (
          <p>
            <strong>No payments yet.</strong> Visitors ask for Pro from their account page and you switch them in <strong>Users</strong>.{" "}
            <button className="link-btn" onClick={onOpenBilling}>
              Connect Stripe →
            </button>
          </p>
        )}
        <p className="hint">
          Saved intros, the AI allowance and website imports are enforced by the server. The watermark and export size are applied in the browser, where videos are
          rendered.
        </p>
      </div>
      <div className="admin-row">
        {(["free", "pro"] as PlanId[]).map((id) => (
          <div key={id} className="admin-card">
            <h2>{PLAN_NAMES[id]}</h2>
            {num(id, "savedFilms", "Saved intros")}
            {num(id, "aiPerMonth", "AI films a month", "0 = built-in director only")}
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
              <input type="checkbox" checked={plans[id].watermark} onChange={(e) => set(id, { watermark: e.target.checked })} /> “Made with IntroMaker” watermark on exports
            </label>
          </div>
        ))}
      </div>
      <div className="admin-card">
        <div className="admin-row">
          <label className="fld">
            <span className="fld-cap">Pro price on the pricing page</span>
            <input
              className="input"
              value={form.proPrice}
              maxLength={40}
              placeholder="e.g. $9 / month (empty shows “Ask us”)"
              onChange={(e) => setForm({ ...form, proPrice: e.target.value })}
            />
          </label>
          <label className="fld">
            <span className="fld-cap">Contact email</span>
            <input
              className={`input${emailBad ? " invalid" : ""}`}
              type="email"
              value={form.contactEmail}
              maxLength={120}
              placeholder="for commercial licences, upgrades and password resets"
              aria-invalid={emailBad}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            />
            {emailBad && <span className="error sm">That doesn&apos;t look like an email address.</span>}
          </label>
        </div>
      </div>
      <div className="admin-row actions">
        <button className="btn btn-ghost" onClick={resetDefaults} disabled={JSON.stringify(plans) === JSON.stringify(defaults)}>
          Reset limits to defaults
        </button>
        <button className="btn btn-primary" onClick={save} disabled={!dirty || busy}>
          {busy ? "Saving…" : dirty ? "Save plans" : "Saved"}
        </button>
      </div>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onDiscard={() => setForm(saved)} label="Save plans" />
    </section>
  );
}
