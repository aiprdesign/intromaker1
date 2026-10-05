"use client";

import { useEffect, useState } from "react";
import { api, CopyButton, Skeleton, useAdminUi, When } from "./ui";

type KeyName = "openaiVoice" | "elevenlabs" | "amazonAccess" | "amazonSecret" | "amazonTag" | "ebayId" | "ebaySecret";
type KeyView = { label: string; env: string; source: "admin" | "env" | null; hint: string };
type EnvRow = { name: string; group: string; purpose: string; example: string; secret: boolean; needed?: boolean; set: boolean; value?: string };
export type SetupView = {
  keys: Record<KeyName, KeyView>;
  env: EnvRow[];
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

/** Where to add an environment variable, per host. */
const HOSTS: { id: string; name: string; steps: React.ReactNode[] }[] = [
  {
    id: "railway",
    name: "Railway",
    steps: [
      <>Open your project on railway.com and click the Prodintro.com service.</>,
      <>
        Go to the <strong>Variables</strong> tab and press <strong>New Variable</strong>.
      </>,
      <>
        Type the name exactly as shown below (for example <code>STRIPE_WEBHOOK_SECRET</code>), paste the value, and press <strong>Add</strong>.
      </>,
      <>
        Press <strong>Deploy</strong> (or <strong>Apply changes</strong>). Railway redeploys the service with the new variable in about a minute.
      </>,
      <>Come back to this page and refresh: the variable shows as set.</>,
    ],
  },
  {
    id: "render",
    name: "Render",
    steps: [
      <>Open the Prodintro.com web service on dashboard.render.com.</>,
      <>
        Go to <strong>Environment</strong> and press <strong>Add Environment Variable</strong>.
      </>,
      <>Enter the name and the value.</>,
      <>
        Press <strong>Save, rebuild, and deploy</strong> (or <strong>Save and deploy</strong>).
      </>,
      <>Refresh this page once the deploy is live.</>,
    ],
  },
  {
    id: "fly",
    name: "Fly.io",
    steps: [
      <>In a terminal, in the app&apos;s folder (with the fly CLI signed in):</>,
      <>
        Secrets: <code>fly secrets set STRIPE_WEBHOOK_SECRET=whsec_…</code>. Fly restarts the app with it.
      </>,
      <>
        Plain settings can also go in <code>fly.toml</code> under <code>[env]</code>, then <code>fly deploy</code>.
      </>,
    ],
  },
  {
    id: "docker",
    name: "Docker / a server",
    steps: [
      <>
        Put the variables in a file next to the app, one per line, e.g. <code>intromaker.env</code>: <code>STRIPE_WEBHOOK_SECRET=whsec_…</code>
      </>,
      <>Keep the file private (it holds secrets) and out of git.</>,
      <>
        Start the container with it: <code>docker run --env-file intromaker.env -p 3000:3000 -v intromaker-data:/data intromaker</code>
      </>,
      <>After changing the file, restart the container.</>,
    ],
  },
  {
    id: "local",
    name: "On your computer",
    steps: [
      <>
        Copy <code>.env.example</code> to <code>.env.local</code> in the project folder.
      </>,
      <>
        Fill in the values (<code>NAME=value</code>, one per line). <code>.env.local</code> isn&apos;t committed.
      </>,
      <>
        Restart <code>npm run dev</code> (or <code>npm start</code>) so it reads them.
      </>,
    ],
  },
];

/** How to add environment variables on the server, and which ones are set here. */
function EnvGuide({ env }: { env: EnvRow[] }) {
  const [host, setHost] = useState("railway");
  const groups = [...new Set(env.map((e) => e.group))];
  const h = HOSTS.find((x) => x.id === host)!;
  return (
    <div className="admin-card env-guide" id="env-vars">
      <h2>Environment variables</h2>
      <p className="hint">
        Secrets such as the Stripe webhook secret and the admin password live in the server&apos;s environment variables: set on your host, not typed into a page,
        and not shown here (this page only says whether each one is set). After adding or changing one, the server restarts with it.
      </p>
      <div className="seg-control env-hosts" role="tablist" aria-label="Where the site runs">
        {HOSTS.map((x) => (
          <button key={x.id} role="tab" aria-selected={host === x.id} className={host === x.id ? "active" : ""} onClick={() => setHost(x.id)}>
            {x.name}
          </button>
        ))}
      </div>
      <ol className="env-steps">
        {h.steps.map((st, i) => (
          <li key={i}>{st}</li>
        ))}
      </ol>
      {groups.map((g) => (
        <div key={g} className="env-group">
          <span className="fld-cap">{g}</span>
          <ul className="env-list">
            {env
              .filter((e) => e.group === g)
              .map((e) => (
                <li key={e.name}>
                  <span className="env-name">
                    <code>{e.name}</code>
                    <CopyButton text={e.name} />
                  </span>
                  <span className="env-purpose">
                    {e.purpose} <span className="hint">e.g. {e.example}</span>
                  </span>
                  <span className={`tag ${e.set ? "exported" : e.needed ? "warn" : ""}`}>{e.set ? (e.value ? `Set: ${e.value}` : "Set ✓") : e.needed ? "Not set (needed)" : "Not set"}</span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

type BlockRow = { id: string; address: string; where: "admin" | "account"; at: number; until: number; fails: number };

/** Addresses blocked from signing in after too many wrong passwords, with a way to lift a block. */
function Blocks() {
  const { notify } = useAdminUi();
  const [data, setData] = useState<{ blocks: BlockRow[]; tries: number; blockMinutes: number } | null>(null);
  const load = () =>
    api<{ blocks: BlockRow[]; tries: number; blockMinutes: number }>("/api/admin/blocks")
      .then(setData)
      .catch(() => {});
  useEffect(() => {
    void load();
  }, []);
  if (!data) return null;
  const lift = async (b: BlockRow) => {
    try {
      await api("/api/admin/blocks", { method: "DELETE", body: JSON.stringify({ id: b.id }) });
      notify(`${b.address} can sign in again`);
    } catch (e) {
      notify((e as Error).message, "error");
    }
    void load();
  };
  return (
    <div className="admin-card blocks-card">
      <h2>Sign-in protection</h2>
      <p className="hint">
        After {data.tries} wrong passwords (admin or account sign-in), the address is blocked from signing in for {data.blockMinutes} minutes. A correct password resets the
        count. Blocks are kept in memory only.
      </p>
      {data.blocks.length ? (
        <ul className="event-list">
          {data.blocks.map((b) => (
            <li key={b.id} className="attention">
              <span className="hint">
                <When t={b.at} />
              </span>
              <span>
                <code>{b.address}</code> · {b.fails} wrong {b.where === "admin" ? "admin" : "account"} passwords · blocked until {new Date(b.until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button className="btn btn-ghost sm" onClick={() => lift(b)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">No address is blocked right now.</p>
      )}
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
    { done: true, title: "Admin area", body: "On: ADMIN_PASSWORD is set in the environment (it stays there, not on a page)." },
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
        <p className="hint">What the site needs, set from here. Keys pasted on this page are stored on the server, readable only by the app, and not shown again.</p>
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
      <Blocks />
      <EnvGuide env={view.env} />
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
