"use client";

import { useCallback, useEffect, useState } from "react";
import { PLAN_NAMES, type PlanId } from "@/lib/plans";
import { api, CopyButton, Kpi, Skeleton, useAdminUi, When } from "./ui";

type AdminUser = {
  id: string;
  email: string;
  plan: PlanId;
  createdAt: number;
  lastLoginAt?: number;
  upgradeRequestedAt?: number;
  mustChangePassword: boolean;
  disabled: boolean;
  films: number;
  usage: { aiMonth?: string; ai?: number };
  planSource?: "admin" | "stripe";
  billingStatus?: "active" | "past_due" | "canceling" | "canceled";
  periodEnd?: number;
  stripeCustomerId?: string;
  stripeLive?: boolean;
  billingFlag?: "refunded" | "disputed";
  /** Intros made (from the film log): how many, when last, and their latest prompts or sites. */
  made: { made: number; lastAt: number; recent: string[] };
};
type Data = { users: AdminUser[]; counts: { total: number; pro: number; requests: number } };

const SORTS = {
  new: { label: "Newest", fn: (a: AdminUser, b: AdminUser) => b.createdAt - a.createdAt },
  active: { label: "Last active", fn: (a: AdminUser, b: AdminUser) => (b.lastLoginAt ?? 0) - (a.lastLoginAt ?? 0) },
  films: { label: "Most saved", fn: (a: AdminUser, b: AdminUser) => b.films - a.films },
  made: { label: "Most made", fn: (a: AdminUser, b: AdminUser) => (b.made?.made ?? 0) - (a.made?.made ?? 0) },
  email: { label: "Email A–Z", fn: (a: AdminUser, b: AdminUser) => a.email.localeCompare(b.email) },
};
const BILLING: Record<string, string> = { active: "Paying", past_due: "Payment failed", canceling: "Cancelling", canceled: "Cancelled" };

export default function UsersTab({ onCounts, onShowFilms }: { onCounts: (requests: number) => void; onShowFilms: (u: { id: string; email: string }) => void }) {
  const { notify, confirm } = useAdminUi();
  const [data, setData] = useState<Data | null>(null);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"" | "requests" | "pro" | "stripe">("");
  const [sort, setSort] = useState<keyof typeof SORTS>("new");
  const [temp, setTemp] = useState<{ email: string; pw: string } | null>(null);
  // Linking a Stripe payment that reached no account: which account, and the customer id typed.
  const [linking, setLinking] = useState<{ id: string; cus: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const d = await api<Data>("/api/admin/users");
      setData(d);
      onCounts(d.counts.requests);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [onCounts]);
  useEffect(() => {
    void load();
  }, [load]);

  const setPlan = async (u: AdminUser, plan: PlanId) => {
    if (u.plan === plan) return;
    const stripe = u.planSource === "stripe" && u.billingStatus && u.billingStatus !== "canceled";
    const ok = await confirm({
      title: `Switch ${u.email} to ${PLAN_NAMES[plan]}?`,
      body:
        plan === "free" && stripe
          ? "They pay through Stripe: this changes their plan here only. Cancel their subscription in Stripe too, or they'll keep being charged."
          : plan === "pro"
            ? "They get Pro's limits right away, without paying. Stripe won't change a plan you set by hand."
            : "They go back to the Free limits right away. Their saved intros are kept.",
      confirm: `Switch to ${PLAN_NAMES[plan]}`,
    });
    if (!ok) return;
    await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ plan }) });
    notify(`${u.email} is on ${PLAN_NAMES[plan]}`);
    void load();
  };
  const reset = async (u: AdminUser) => {
    if (!(await confirm({ title: `Reset the password of ${u.email}?`, body: "They're signed out of their sessions and must choose a new password after signing in with the one-time password.", confirm: "Reset password" }))) return;
    const r = await api<{ tempPassword: string }>(`/api/admin/users/${u.id}`, { method: "POST" });
    setTemp({ email: u.email, pw: r.tempPassword });
    void load();
  };
  const paying = (u: AdminUser) => u.planSource === "stripe" && (u.billingStatus === "active" || u.billingStatus === "past_due" || u.billingStatus === "canceling");
  const toggle = async (u: AdminUser) => {
    const body = `They're signed out and can't sign in until you enable the account again. Their data is kept.${paying(u) ? " They still pay through Stripe: cancel or pause their subscription in Stripe too." : ""}`;
    if (!u.disabled && !(await confirm({ title: `Disable ${u.email}?`, body, confirm: "Disable", danger: true }))) return;
    await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ disabled: !u.disabled }) });
    notify(u.disabled ? `${u.email} enabled` : `${u.email} disabled`);
    void load();
  };
  const remove = async (u: AdminUser) => {
    const live = paying(u);
    const ok = await confirm({
      title: `Delete ${u.email}?`,
      body: live
        ? `They have a live Stripe subscription. Cancel it in Stripe first, or it keeps charging after the account is gone. Then type CANCELLED to delete the account and its ${u.films} saved intro${u.films === 1 ? "" : "s"}.`
        : `The account and its ${u.films} saved intro${u.films === 1 ? "" : "s"} are removed for good.`,
      confirm: "Delete account",
      danger: true,
      typed: live ? "CANCELLED" : u.email,
    });
    if (!ok) return;
    await api(`/api/admin/users/${u.id}${live ? "?stripeCancelled=1" : ""}`, { method: "DELETE" });
    notify("Account deleted");
    void load();
  };

  const link = async () => {
    if (!linking) return;
    try {
      await api(`/api/admin/users/${linking.id}`, { method: "PATCH", body: JSON.stringify({ stripeCustomerId: linking.cus.trim() }) });
      notify("Stripe customer linked: the account is on Pro, and Stripe runs its plan from now on");
      setLinking(null);
      void load();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  };
  const clearFlag = async (u: AdminUser) => {
    await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ clearFlag: true }) });
    void load();
  };

  if (!data) return error ? <p className="error">{error}</p> : <Skeleton rows={4} />;
  const needle = q.trim().toLowerCase();
  const shown = data.users
    .filter(
      (u) =>
        (!needle || u.email.includes(needle)) &&
        (only === "" || (only === "pro" ? u.plan === "pro" : only === "stripe" ? u.planSource === "stripe" : !!u.upgradeRequestedAt && u.plan !== "pro")),
    )
    .sort(SORTS[sort].fn);
  const payingCount = data.users.filter(paying).length;
  return (
    <>
      <section className="admin-kpis">
        <Kpi label="Accounts" value={data.counts.total} />
        <Kpi label="Pro" value={data.counts.pro} />
        <Kpi label="Paying via Stripe" value={payingCount} />
        <Kpi label="Asking for Pro" value={data.counts.requests} />
      </section>
      {temp && (
        <div className="admin-card warn-card">
          <strong>One-time password for {temp.email}:</strong> <code className="secret">{temp.pw}</code>
          <CopyButton text={temp.pw} />
          <span className="hint">Send it to them privately. They sign in with it and must choose a new password. It isn&apos;t shown again.</span>
          <button className="link-btn" onClick={() => setTemp(null)}>
            Done
          </button>
        </div>
      )}
      <section className="admin-filters">
        <span className="search-box">
          <input className="input" placeholder="Search by email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search accounts" />
          {q && (
            <button className="clear" onClick={() => setQ("")} aria-label="Clear search">
              ×
            </button>
          )}
        </span>
        <div className="seg-control nowrap" role="radiogroup" aria-label="Show">
          {(
            [
              ["", `Accounts · ${data.counts.total}`],
              ["requests", `Requests · ${data.counts.requests}`],
              ["pro", `Pro · ${data.counts.pro}`],
              ["stripe", "Stripe"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} role="radio" aria-checked={only === k} className={only === k ? "active" : ""} onClick={() => setOnly(k)}>
              {label}
            </button>
          ))}
        </div>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} aria-label="Sort">
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <span className="hint">
          {shown.length} of {data.users.length}
        </span>
      </section>
      {!shown.length && (
        <div className="admin-card empty">
          <p>{data.users.length ? "No accounts match." : "No accounts yet."}</p>
          <p className="hint">{data.users.length ? "Try another search or filter." : "Visitors create one at /account to save their intros."}</p>
        </div>
      )}
      <div className="admin-table">
        {shown.map((u) => (
          <div key={u.id} className={`admin-user${u.disabled ? " disabled" : ""}`}>
            <div className="who">
              <strong title={u.email}>{u.email}</strong>
              <span className="hint">
                joined <When t={u.createdAt} /> · last in {u.lastLoginAt ? <When t={u.lastLoginAt} /> : "not yet"} · {u.made?.made ?? 0} made · {u.films} saved
                {u.usage?.aiMonth === new Date().toISOString().slice(0, 7) ? ` · ${u.usage.ai ?? 0} AI films this month` : ""}
              </span>
              <span className="film-tags">
                {u.planSource === "stripe" && u.billingStatus && (
                  <span className={`tag ${u.billingStatus === "past_due" ? "warn" : "exported"}`}>
                    Stripe · {BILLING[u.billingStatus]}
                    {u.periodEnd && u.billingStatus === "canceling" ? ` until ${new Date(u.periodEnd).toLocaleDateString()}` : ""}
                  </span>
                )}
                {u.stripeCustomerId && (
                  <a className="tag link" href={`https://dashboard.stripe.com/${u.stripeLive === false ? "test/" : ""}customers/${u.stripeCustomerId}`} target="_blank" rel="noopener noreferrer">
                    Open in Stripe{u.stripeLive === false ? " (test)" : ""} ↗
                  </a>
                )}
                {u.billingFlag && (
                  <button className="tag warn" onClick={() => clearFlag(u)} title="Looked at it: clear the flag">
                    Payment {u.billingFlag} ×
                  </button>
                )}
                {u.upgradeRequestedAt && u.plan !== "pro" && (
                  <span className="tag remake">
                    Asked for Pro <When t={u.upgradeRequestedAt} />
                  </span>
                )}
                {u.mustChangePassword && <span className="tag">Password reset pending</span>}
                {u.disabled && <span className="tag warn">Disabled</span>}
              </span>
              {u.made?.made ? (
                <div className="user-made">
                  <ul>
                    {u.made.recent.map((r) => (
                      <li key={r} title={r}>
                        {/^https?:\/\//.test(r) ? r.replace(/^https?:\/\//, "") : `“${r}”`}
                      </li>
                    ))}
                  </ul>
                  <button className="link-btn" onClick={() => onShowFilms({ id: u.id, email: u.email })}>
                    View {u.made.made} film{u.made.made === 1 ? "" : "s"} · newest <When t={u.made.lastAt} /> →
                  </button>
                </div>
              ) : (
                <span className="hint">No intros made while signed in yet.</span>
              )}
            </div>
            <div className="seg-control plan-switch" role="radiogroup" aria-label={`Plan of ${u.email}`}>
              {(["free", "pro"] as PlanId[]).map((id) => (
                <button key={id} role="radio" aria-checked={u.plan === id} className={u.plan === id ? "active" : ""} onClick={() => setPlan(u, id)}>
                  {PLAN_NAMES[id]}
                </button>
              ))}
            </div>
            <div className="user-actions">
              {!u.stripeCustomerId && (
                <button className="btn btn-ghost sm" onClick={() => setLinking(linking?.id === u.id ? null : { id: u.id, cus: "" })} title="A payment in Stripe that reached no account">
                  Link Stripe customer
                </button>
              )}
              <button className="btn btn-ghost sm" onClick={() => reset(u)}>
                Reset password
              </button>
              <button className="btn btn-ghost sm" onClick={() => toggle(u)}>
                {u.disabled ? "Enable" : "Disable"}
              </button>
              <button className="btn btn-ghost sm danger" onClick={() => remove(u)}>
                Delete
              </button>
            </div>
            {linking?.id === u.id && (
              <form
                className="link-customer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void link();
                }}
              >
                <label className="fld">
                  <span className="fld-cap">Stripe customer id (from the payment in Stripe → Customers)</span>
                  <input className="input" autoFocus placeholder="cus_…" value={linking.cus} spellCheck={false} onChange={(e) => setLinking({ ...linking, cus: e.target.value })} />
                </label>
                <button className="btn btn-primary sm" disabled={!/^cus_[A-Za-z0-9]{6,}$/.test(linking.cus.trim())}>
                  Link and switch to Pro
                </button>
                <button type="button" className="btn btn-ghost sm" onClick={() => setLinking(null)}>
                  Cancel
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
