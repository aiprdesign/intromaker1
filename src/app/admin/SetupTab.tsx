"use client";

import { useEffect, useState } from "react";
import { api, Skeleton, useAdminUi } from "./ui";

type KeyName = "openaiVoice" | "elevenlabs" | "amazonAccess" | "amazonSecret" | "amazonTag" | "ebayId" | "ebaySecret";
type KeyView = { label: string; env: string; source: "admin" | "env" | null; hint: string };
export type SetupView = {
  keys: Record<KeyName, KeyView>;
  status: {
    persistent: boolean;
    ai: string | null;
    voice: boolean;
    stripeLinks: boolean;
    stripeWebhook: boolean;
    proUnlocksMore: boolean;
    proPrice: boolean;
    contactEmail: boolean;
    amazon: boolean;
    ebay: boolean;
  };
};
type Go = (tab: "ai" | "billing" | "plans") => void;

/**
 * Service keys pasted here instead of environment variables: write-only (the page only ever gets
 * a masked hint), saved on the data volume, and the environment variable is the fallback.
 */
export function KeysCard({ title, intro, names, view, onSaved }: { title: string; intro: React.ReactNode; names: KeyName[]; view: SetupView; onSaved: (v: SetupView) => void }) {
  const { notify } = useAdminUi();
  const [vals, setVals] = useState<Partial<Record<KeyName, string>>>({});
  const [busy, setBusy] = useState(false);
  const dirty = names.some((n) => vals[n]?.trim());
  const put = async (body: object, ok: string) => {
    setBusy(true);
    try {
      onSaved(await api<SetupView>("/api/admin/setup", { method: "PUT", body: JSON.stringify(body) }));
      setVals({});
      notify(ok);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-card keys-card">
      <h2>{title}</h2>
      <p className="hint">{intro}</p>
      <div className="keys-grid">
        {names.map((n) => {
          const k = view.keys[n];
          return (
            <label key={n} className="fld">
              <span className="fld-cap">
                {k.label}{" "}
                <em>{k.source === "admin" ? "saved here" : k.source === "env" ? `from ${k.env}` : "not set"}</em>
              </span>
              <span className="key-row">
                <input
                  className="input"
                  type={n === "amazonTag" ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={vals[n] ?? ""}
                  placeholder={k.source ? `${k.hint}. Leave empty to keep it.` : `Paste it here (or set ${k.env})`}
                  onChange={(e) => setVals({ ...vals, [n]: e.target.value })}
                />
                {k.source === "admin" && (
                  <button type="button" className="btn btn-ghost sm" disabled={busy} onClick={() => put({ clear: [n] }, `${k.label} removed`)}>
                    Remove
                  </button>
                )}
              </span>
            </label>
          );
        })}
      </div>
      <div className="admin-row actions">
        <button className="btn btn-primary" disabled={!dirty || busy} onClick={() => put({ keys: vals }, "Keys saved. They apply right away.")}>
          {busy ? "Saving…" : dirty ? "Save keys" : "Saved"}
        </button>
      </div>
    </div>
  );
}

/** Plug and play: what the site needs, what's set up, and where to set the rest, all from here. */
export default function SetupTab({ go }: { go: Go }) {
  const [view, setView] = useState<SetupView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<SetupView>("/api/admin/setup")
      .then(setView)
      .catch((e) => setError((e as Error).message));
  }, []);
  if (!view) return error ? <p className="error">{error}</p> : <Skeleton rows={4} />;
  const s = view.status;
  const planTodo = [
    !s.contactEmail && "add a contact email (licences, billing, password help)",
    s.stripeLinks && !s.proPrice && "add the Pro price label",
    s.stripeLinks && !s.proUnlocksMore && "set what Pro unlocks over Free",
  ].filter((x): x is string => !!x);
  const rows: { done: boolean; optional?: boolean; title: string; body: React.ReactNode; action?: React.ReactNode }[] = [
    { done: true, title: "Admin area", body: "On: ADMIN_PASSWORD is set in the environment (it stays there, never on a page)." },
    {
      done: s.persistent,
      title: "Data volume",
      body: s.persistent ? (
        "Accounts, saved intros, the video log and these settings survive redeploys."
      ) : (
        <>
          Kept in a temporary folder: a redeploy empties accounts, saved intros, the video log and these settings. In Railway → your service → <strong>Volumes</strong>,
          mount a volume at <code>/data</code> and set <code>INTROMAKER_DATA_DIR=/data</code>.
        </>
      ),
    },
    {
      done: !!s.ai,
      title: "AI director",
      body: s.ai ? <>In use: {s.ai}. Switch provider or model any time.</> : "The built-in director writes the videos (no AI). Choose a provider and paste its key to let AI direct them.",
      action: (
        <button className="btn btn-ghost sm" onClick={() => go("ai")}>
          {s.ai ? "Change AI" : "Choose AI"}
        </button>
      ),
    },
    {
      done: s.voice,
      optional: true,
      title: "Voice-over AI",
      body: s.voice ? "Visitors' voice-overs can use the server's voice key." : "Optional: the free on-device voice works without a key. Add an OpenAI or ElevenLabs key for studio-quality narration.",
      action: (
        <button className="btn btn-ghost sm" onClick={() => go("ai")}>
          {s.voice ? "Change voice" : "Add a voice key"}
        </button>
      ),
    },
    {
      done: s.stripeLinks && s.stripeWebhook,
      optional: true,
      title: "Payments (Stripe)",
      body: s.stripeLinks && s.stripeWebhook ? "Pro is paid through Stripe and switches on by itself." : s.stripeLinks ? "Payment links are in, but STRIPE_WEBHOOK_SECRET isn't set, so payments won't switch plans on." : "Optional: paste Stripe Payment Links and add the webhook to sell Pro.",
      action: (
        <button className="btn btn-ghost sm" onClick={() => go("billing")}>
          Open Billing
        </button>
      ),
    },
    {
      done: !planTodo.length,
      title: "Plans and pricing",
      body: planTodo.length ? `To do: ${planTodo.join("; ")}.` : "Plan limits, the Pro price and your contact email are set.",
      action: (
        <button className="btn btn-ghost sm" onClick={() => go("plans")}>
          Open Plans
        </button>
      ),
    },
    {
      done: s.amazon || s.ebay,
      optional: true,
      title: "Marketplace imports",
      body: s.amazon || s.ebay ? `Product listings are read through ${[s.amazon && "Amazon's", s.ebay && "eBay's"].filter(Boolean).join(" and ")} API.` : "Optional: listings are read from their pages; Amazon and eBay API keys below make imports reliable.",
    },
  ];
  return (
    <section className="admin-setup">
      <div className="admin-card">
        <h2>Setup</h2>
        <p className="hint">Everything the site needs, set from here. Keys pasted on this page are stored on the server, readable only by the app, and never shown again.</p>
        <ol className="setup-steps">
          {rows.map((r, i) => (
            <li key={r.title} className={r.done ? "done" : ""}>
              <span className="step-no" aria-hidden>
                {r.done ? "✓" : i + 1}
              </span>
              <div>
                <strong>
                  {r.title}
                  {r.optional && !r.done && <em className="hint"> optional</em>}
                </strong>
                <p className="hint">{r.body}</p>
              </div>
              {r.action}
            </li>
          ))}
        </ol>
      </div>
      <KeysCard
        title="Marketplace APIs"
        intro={
          <>
            For product videos from listing links. Amazon: the Product Advertising API keys of an Amazon Associates account. eBay: a production keyset from the eBay
            developer program (client id and secret).
          </>
        }
        names={["amazonAccess", "amazonSecret", "amazonTag", "ebayId", "ebaySecret"]}
        view={view}
        onSaved={setView}
      />
    </section>
  );
}
