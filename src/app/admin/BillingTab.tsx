"use client";

import { useEffect, useState } from "react";
import { STRIPE_EVENTS } from "@/lib/stripe-links";
import { api, CopyButton, SaveBar, Skeleton, useAdminUi, useDirty, When } from "./ui";

type Form = { monthlyLink: string; yearlyLink: string; portalLink: string; yearlyPrice: string };
type View = Form & {
  /** Fields set by the server's environment variables (they win over these fields). */
  fromEnv: Partial<Record<keyof Form, string>>;
  proPrice: string;
  webhookUrl: string;
  successUrl: string;
  webhookSecretSet: boolean;
  mode: "test" | "live" | "mixed" | null;
  last: EventRow | null;
  recent: EventRow[];
  count: number;
  rejected: number;
  lastRejectedAt: number | null;
  checks: { proUnlocksMore: boolean; proPriceSet: boolean; contactEmailSet: boolean; persistent: boolean; modeMatches: boolean; testPassed: boolean };
};
type EventRow = { id: string; type: string; at: number; result: string; livemode?: boolean; attention?: boolean; email?: string; customer?: string };

const EVENTS = STRIPE_EVENTS;
const MODE: Record<string, { label: string; tone: string }> = {
  test: { label: "Test mode", tone: "warn" },
  live: { label: "Live", tone: "exported" },
  mixed: { label: "Mixed test and live links", tone: "warn" },
};

const payOk = (v: string) => !v.trim() || /^https:\/\/(buy|checkout)\.stripe\.com\//.test(v.trim());
const portalOk = (v: string) => !v.trim() || /^https:\/\/billing\.stripe\.com\//.test(v.trim());

/** Stripe, plug and play: paste Payment Links, add one webhook, set one environment variable. */
export default function BillingTab({ onChange, onOpenPlans, onOpenEnvGuide }: { onChange: (on: boolean) => void; onOpenPlans: () => void; onOpenEnvGuide: () => void }) {
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
    onChange(!!(v.monthlyLink || v.yearlyLink));
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
  const envNote = (key: keyof Form) =>
    view.fromEnv?.[key] ? (
      <span className="hint sm">
        Set on the server by <code>{view.fromEnv[key]}</code>. Change it in your host&apos;s environment variables.
      </span>
    ) : null;
  const field = (key: keyof Form, label: string, placeholder: string, ok: boolean, hint?: React.ReactNode) => (
    <label className="fld">
      <span className="fld-cap">{label}</span>
      <input
        className={`input${ok ? "" : " invalid"}`}
        value={form[key]}
        placeholder={placeholder}
        spellCheck={false}
        aria-invalid={!ok}
        readOnly={!!view.fromEnv?.[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
      {!ok ? <span className="error sm">{key === "portalLink" ? "Use the https://billing.stripe.com/p/login/… link." : "Use a https://buy.stripe.com/… Payment Link."}</span> : (envNote(key) ?? hint)}
    </label>
  );
  // Either link turns the Upgrade buttons on.
  const linksOn = !!(view.monthlyLink || view.yearlyLink);
  const c = view.checks;
  // What still stands between the plumbing and selling Pro.
  const gaps: { key: string; text: React.ReactNode; fix?: React.ReactNode }[] = [];
  if (linksOn && !c.proUnlocksMore)
    gaps.push({
      key: "same",
      text: "Pro unlocks nothing over Free: both plans have the same limits, so a buyer would pay for nothing.",
      fix: (
        <button className="link-btn" onClick={onOpenPlans}>
          Set what Pro unlocks in Plans
        </button>
      ),
    });
  if (linksOn && !c.proPriceSet) gaps.push({ key: "price", text: "No Pro price label: the Pro card shows “Ask us” next to the Upgrade button.", fix: <button className="link-btn" onClick={onOpenPlans}>Add the price in Plans</button> });
  if (linksOn && !c.contactEmailSet) gaps.push({ key: "contact", text: "No contact email: paying customers have no way to reach you about billing or refunds.", fix: <button className="link-btn" onClick={onOpenPlans}>Add it in Plans</button> });
  if (!c.persistent)
    gaps.push({
      key: "volume",
      text: (
        <>
          Accounts and Pro status are kept in a temporary folder: a redeploy (setting <code>STRIPE_WEBHOOK_SECRET</code> causes one) wipes them while customers keep paying. Mount a volume at{" "}
          <code>/data</code> with <code>INTROMAKER_DATA_DIR=/data</code>.
        </>
      ),
    });
  if (!c.modeMatches) gaps.push({ key: "mode", text: "The events received are from the other Stripe mode than your links (test vs live): use the signing secret and links from the same mode." });
  if (view.rejected)
    gaps.push({
      key: "sig",
      text: (
        <>
          {view.rejected} webhook deliver{view.rejected === 1 ? "y was" : "ies were"} refused for a bad signature{view.lastRejectedAt ? <> (latest <When t={view.lastRejectedAt} />)</> : null}: the
          signing secret doesn&apos;t match this endpoint, or it&apos;s from the other mode.
        </>
      ),
    });
  const ready = linksOn && view.webhookSecretSet;
  const steps: { done: boolean; title: string; body: React.ReactNode }[] = [
    {
      done: linksOn,
      title: "Create the Pro product and a Payment Link",
      body: (
        <>
          In Stripe → <strong>Product catalog</strong>, add “Prodintro.com Pro” with a recurring price (and a yearly one if you like). Then <strong>Payment Links</strong> →
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
          Reveal the <strong>Signing secret</strong> (whsec_…) and add it to your server as the environment variable <code>STRIPE_WEBHOOK_SECRET</code> (Railway: the
          service → <strong>Variables</strong> → <strong>New Variable</strong> → Deploy). The secret stays in the environment, not on this page.{" "}
          <button className="link-btn" onClick={onOpenEnvGuide}>
            How to add an environment variable on your host →
          </button>
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
      done: c.testPassed,
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
                ? gaps.length
                  ? "Payments switch Pro on by themselves. See Before you sell Pro below for what's still missing."
                  : "Visitors can pay for Pro and it switches on by itself."
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

      {gaps.length > 0 && (
        <div className="admin-card billing-gaps">
          <h2>Before you sell Pro</h2>
          <ul>
            {gaps.map((g) => (
              <li key={g.key}>
                {g.text} {g.fix}
              </li>
            ))}
          </ul>
        </div>
      )}

      {view.recent.length > 0 && (
        <div className="admin-card">
          <h2>Recent Stripe events</h2>
          <ul className="event-list">
            {view.recent.map((e) => (
              <li key={e.id} className={e.attention ? "attention" : ""}>
                <span className="hint">
                  <When t={e.at} />
                  {e.livemode === false ? " · test" : ""}
                </span>
                <code>{e.type}</code>
                <span>{e.result}</span>
              </li>
            ))}
          </ul>
          <p className="hint">Highlighted: money arrived for no account, or a refund or dispute. Link a payment to its account in Users → Link Stripe customer.</p>
        </div>
      )}

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
            <input className="input" value={form.yearlyPrice} maxLength={40} placeholder="e.g. $90 / year" readOnly={!!view.fromEnv?.yearlyPrice} onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })} />
            {envNote("yearlyPrice")}
          </label>
          {field("portalLink", "Customer portal login link", "https://billing.stripe.com/p/login/…", portalOk(form.portalLink))}
        </div>
        <p className="hint">
          The monthly price label lives in{" "}
          <button className="link-btn" onClick={onOpenPlans}>
            Plans
          </button>
          , with the limits Pro unlocks. Only Stripe-hosted links are accepted. Clear both payment links to switch payments off.
        </p>
        <p className="hint">
          Prefer the server&apos;s environment? Set <code>STRIPE_MONTHLY_LINK</code>, <code>STRIPE_YEARLY_LINK</code>, <code>STRIPE_PORTAL_LINK</code> and <code>STRIPE_YEARLY_PRICE</code>{" "}
          instead: they win over these fields. The webhook&apos;s signing secret is only read from <code>STRIPE_WEBHOOK_SECRET</code>, not saved here.{" "}
          <button className="link-btn" onClick={onOpenEnvGuide}>
            How to add environment variables
          </button>
        </p>
        {linksOn && (
          <p className="hint">
            Refunds: with payments on, the <a href="/terms#refunds">Terms and refunds</a> page is live (linked in the footer, pricing and account pages),
            promising a full refund within 30 days of a payment. Without a Payment Link it isn&apos;t shown. In Stripe, refund the payment and cancel the
            subscription; a full refund moves the account to Free by itself. Add <code>{view.webhookUrl.replace(/\/api\/stripe\/webhook$/, "/terms")}</code> <CopyButton text={view.webhookUrl.replace(/\/api\/stripe\/webhook$/, "/terms")} /> as the terms link in your Payment
            Links&apos; settings so buyers see it at checkout.
          </p>
        )}
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
