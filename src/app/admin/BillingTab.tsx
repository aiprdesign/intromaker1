"use client";

import { useEffect, useState } from "react";
import { api, CopyButton, SaveBar, Skeleton, useAdminUi, useDirty, When } from "./ui";

type Form = { monthlyLink: string; yearlyLink: string; portalLink: string; yearlyPrice: string };
type View = Form & {
  proPrice: string;
  webhookUrl: string;
  successUrl: string;
  webhookSecretSet: boolean;
  mode: "test" | "live" | "mixed" | null;
  last: { id: string; type: string; at: number; result: string; livemode?: boolean } | null;
  count: number;
};

const EVENTS = ["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"];
const MODE: Record<string, { label: string; tone: string }> = {
  test: { label: "Test mode", tone: "warn" },
  live: { label: "Live", tone: "exported" },
  mixed: { label: "Mixed test and live links", tone: "warn" },
};

const payOk = (v: string) => !v.trim() || /^https:\/\/(buy|checkout)\.stripe\.com\//.test(v.trim());
const portalOk = (v: string) => !v.trim() || /^https:\/\/billing\.stripe\.com\//.test(v.trim());

/** Stripe, plug and play: paste Payment Links, add one webhook, set one environment variable. */
export default function BillingTab({ onChange, onOpenPlans }: { onChange: (on: boolean) => void; onOpenPlans: () => void }) {
  const { notify } = useAdminUi();
  const [view, setView] = useState<View | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const take = (v: View) => {
    const f = { monthlyLink: v.monthlyLink, yearlyLink: v.yearlyLink, portalLink: v.portalLink, yearlyPrice: v.yearlyPrice };
    setView(v);
    setSaved(f);
    setForm(f);
    onChange(!!v.monthlyLink);
  };
  useEffect(() => {
    api<View>("/api/admin/billing")
      .then(take)
      .catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dirty = useDirty(form, saved);
  if (!view || !form) return error ? <p className="error">{error}</p> : <Skeleton rows={3} />;

  const invalid = !payOk(form.monthlyLink) || !payOk(form.yearlyLink) || !portalOk(form.portalLink);
  const save = async () => {
    if (invalid) return notify("Fix the highlighted links first.", "error");
    setBusy(true);
    try {
      take(await api<View>("/api/admin/billing", { method: "PUT", body: JSON.stringify(form) }));
      notify(form.monthlyLink ? "Billing saved. The Upgrade button is live on account pages." : "Billing saved. Stripe links are off.");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const field = (key: keyof Form, label: string, placeholder: string, ok: boolean, hint?: React.ReactNode) => (
    <label className="fld">
      <span className="fld-cap">{label}</span>
      <input
        className={`input${ok ? "" : " invalid"}`}
        value={form[key]}
        placeholder={placeholder}
        spellCheck={false}
        aria-invalid={!ok}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
      {!ok ? <span className="error sm">{key === "portalLink" ? "Use the https://billing.stripe.com/p/login/… link." : "Use a https://buy.stripe.com/… Payment Link."}</span> : hint}
    </label>
  );
  const linksOn = !!view.monthlyLink;
  const ready = linksOn && view.webhookSecretSet;
  const steps: { done: boolean; title: string; body: React.ReactNode }[] = [
    {
      done: linksOn,
      title: "Create the Pro product and a Payment Link",
      body: (
        <>
          In Stripe → <strong>Product catalog</strong>, add “IntroMaker Pro” with a recurring price (and a yearly one if you like). Then <strong>Payment Links</strong> →
          New, pick the price, and under <strong>After payment</strong> choose “Don&apos;t show confirmation page” and redirect to:
          <span className="copy-line">
            <code>{view.successUrl}</code>
            <CopyButton text={view.successUrl} />
          </span>
          Paste the link below. Visitors&apos; account ids and emails are added to it automatically.
        </>
      ),
    },
    {
      done: view.webhookSecretSet,
      title: "Add the webhook",
      body: (
        <>
          Stripe → <strong>Developers → Webhooks</strong> → Add endpoint:
          <span className="copy-line">
            <code>{view.webhookUrl}</code>
            <CopyButton text={view.webhookUrl} />
          </span>
          Select these events:
          <span className="copy-line">
            <code>{EVENTS.join(", ")}</code>
            <CopyButton text={EVENTS.join("\n")} label="Copy list" />
          </span>
          Reveal the <strong>Signing secret</strong> (whsec_…) and set it as <code>STRIPE_WEBHOOK_SECRET</code> in Railway → Variables. Railway redeploys by itself. The
          secret stays in the environment, never on this page.
        </>
      ),
    },
    {
      done: !!view.portalLink,
      title: "Turn on the customer portal (recommended)",
      body: (
        <>
          Stripe → <strong>Settings → Billing → Customer portal</strong> → activate, allow cancelling, and copy the <strong>login link</strong> below. Subscribers get
          a “Manage billing” button to update cards, download invoices or cancel. Cancellations come back through the webhook.
        </>
      ),
    },
    {
      done: view.count > 0,
      title: "Test it",
      body: (
        <>
          Use test-mode links first. Sign up on <a href="/account">/account</a>, press Upgrade and pay with card <code>4242 4242 4242 4242</code>, any future date and any
          CVC. You should land back on your account as Pro, and the event appears above. Then swap in your live links and live signing secret.
        </>
      ),
    },
  ];

  return (
    <section className="admin-billing">
      <div className="admin-card billing-status">
        <div className="billing-state">
          <span className={`status-dot ${ready ? "on" : linksOn || view.webhookSecretSet ? "half" : ""}`} aria-hidden />
          <div>
            <strong>{ready ? "Stripe is connected" : linksOn || view.webhookSecretSet ? "Stripe is half set up" : "Stripe isn't set up"}</strong>
            <span className="hint">
              {ready
                ? "Visitors can pay for Pro and it switches on by itself."
                : linksOn
                  ? "Payment links are live but the webhook secret is missing, so payments won't switch plans on."
                  : "Visitors ask for Pro and you switch them in Users. Follow the steps below to take payments."}
            </span>
          </div>
        </div>
        <div className="film-tags">
          {view.mode && <span className={`tag ${MODE[view.mode].tone}`}>{MODE[view.mode].label}</span>}
          <span className={`tag ${view.webhookSecretSet ? "exported" : "warn"}`}>{view.webhookSecretSet ? "Webhook secret set ✓" : "STRIPE_WEBHOOK_SECRET not set"}</span>
          <span className="tag">
            {view.count} event{view.count === 1 ? "" : "s"} received
          </span>
        </div>
        {view.last && (
          <p className="hint last-event">
            Last event <When t={view.last.at} />: <code>{view.last.type}</code> → {view.last.result}
            {view.last.livemode === false ? " (test)" : ""}
          </p>
        )}
      </div>

      <ol className="setup-steps">
        {steps.map((s, i) => (
          <li key={s.title} className={s.done ? "done" : ""}>
            <span className="step-no" aria-hidden>
              {s.done ? "✓" : i + 1}
            </span>
            <div>
              <strong>
                {s.title}
                {s.done && <span className="sr-only"> (done)</span>}
              </strong>
              <p className="hint">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="admin-card">
        <h2>Links</h2>
        <div className="admin-row">
          {field("monthlyLink", "Monthly Payment Link", "https://buy.stripe.com/…", payOk(form.monthlyLink), <span className="hint sm">The Upgrade button. Price shown: {view.proPrice || "set it in Plans"}.</span>)}
          {field("yearlyLink", "Yearly Payment Link (optional)", "https://buy.stripe.com/…", payOk(form.yearlyLink))}
        </div>
        <div className="admin-row">
          <label className="fld">
            <span className="fld-cap">Yearly price label</span>
            <input className="input" value={form.yearlyPrice} maxLength={40} placeholder="e.g. $90 / year" onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })} />
          </label>
          {field("portalLink", "Customer portal login link", "https://billing.stripe.com/p/login/…", portalOk(form.portalLink))}
        </div>
        <p className="hint">
          The monthly price label lives in{" "}
          <button className="link-btn" onClick={onOpenPlans}>
            Plans
          </button>
          , with the limits Pro unlocks. Only Stripe-hosted links are accepted. Clear the monthly link to switch payments off.
        </p>
        <div className="admin-row actions">
          <button className="btn btn-primary" onClick={save} disabled={!dirty || busy || invalid}>
            {busy ? "Saving…" : dirty ? "Save billing" : "Saved"}
          </button>
        </div>
      </div>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onDiscard={() => setForm(saved)} label="Save billing" />
    </section>
  );
}
