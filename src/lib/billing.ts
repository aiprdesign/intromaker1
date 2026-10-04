import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findUserByEmail, findUserByStripeCustomer, getUser, updateUser, type User } from "./accounts";

/**
 * Stripe, plug and play: no Stripe SDK and no API key on the server.
 *
 *   1. Stripe Payment Links (monthly, optionally yearly) are pasted into Admin → Billing. The account
 *      page sends each visitor to the link with `client_reference_id` (their account id) and their
 *      email prefilled.
 *   2. A webhook endpoint (/api/stripe/webhook) receives Stripe's signed events. Its signing secret is
 *      the STRIPE_WEBHOOK_SECRET environment variable. Payment → Pro; cancellation → Free.
 *   3. The Stripe customer portal login link (also pasted in Admin) lets subscribers manage billing.
 *
 * Every event is verified (HMAC-SHA256 over the raw body, 5-minute tolerance) and applied once.
 */

const ROOT = process.env.INTROMAKER_DATA_DIR ? join(process.env.INTROMAKER_DATA_DIR, "accounts") : join(tmpdir(), "intromaker-accounts");
const EVENTS = join(ROOT, "stripe-events.json");

export { checkoutUrl, isTestLink, portalUrl, stripeLink, type BillingLinks } from "./stripe-links";

export const webhookConfigured = () => (process.env.STRIPE_WEBHOOK_SECRET ?? "").startsWith("whsec_");

/**
 * Verify a Stripe-Signature header ("t=…,v1=…[,v1=…]") against the raw body.
 * https://docs.stripe.com/webhooks#verify-manually
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now(), toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  let t = "";
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k?.trim() === "t") t = v?.trim() ?? "";
    if (k?.trim() === "v1" && v) sigs.push(v.trim());
  }
  const ts = Number(t);
  if (!t || !Number.isFinite(ts) || Math.abs(now / 1000 - ts) > toleranceSec || !sigs.length) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex"));
  return sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

// ───────────────────────── Events ─────────────────────────

type StripeObject = Record<string, unknown>;
export interface StripeEvent {
  id: string;
  type: string;
  created?: number;
  livemode?: boolean;
  data: { object: StripeObject };
}

/** One handled event, for the owner's Billing tab. */
export interface EventRecord {
  id: string;
  type: string;
  at: number;
  result: string;
  livemode?: boolean;
  /** Needs the owner: money arrived for no account, a refund, a dispute. */
  attention?: boolean;
  email?: string;
  customer?: string;
}

interface EventLog {
  seen: string[];
  last?: EventRecord;
  recent?: EventRecord[];
  count: number;
  /** Deliveries refused for a bad signature (a wrong STRIPE_WEBHOOK_SECRET, or test vs live). */
  rejected?: number;
  lastRejectedAt?: number;
}

async function readLog(): Promise<EventLog> {
  try {
    return JSON.parse(await readFile(EVENTS, "utf8"));
  } catch {
    return { seen: [], count: 0 };
  }
}

async function writeLog(log: EventLog) {
  await mkdir(ROOT, { recursive: true });
  const tmp = `${EVENTS}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(log), { mode: 0o600 });
  await rename(tmp, EVENTS);
}

// Events are applied one at a time, so two deliveries can't both pass the duplicate check or
// overwrite each other's log.
let queue: Promise<unknown> = Promise.resolve();
function inOrder<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

export async function billingStatus() {
  const log = await readLog();
  return { last: log.last ?? null, count: log.count, recent: log.recent ?? (log.last ? [log.last] : []), rejected: log.rejected ?? 0, lastRejectedAt: log.lastRejectedAt ?? null };
}

/** A delivery with a bad signature: counted so the owner sees a secret or mode mismatch. */
export function noteRejected() {
  return inOrder(async () => {
    const log = await readLog();
    log.rejected = (log.rejected ?? 0) + 1;
    log.lastRejectedAt = Date.now();
    await writeLog(log);
  });
}

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const idOf = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" ? str((v as StripeObject).id) : undefined);

/** Subscription states that keep Pro (past_due keeps it through Stripe's retries). */
const ACTIVE = new Set(["active", "trialing", "past_due"]);

async function userFor(obj: StripeObject): Promise<User | null> {
  const ref = str(obj.client_reference_id);
  if (ref) {
    const u = await getUser(ref);
    if (u) return u;
  }
  const customer = idOf(obj.customer);
  if (customer) {
    const u = await findUserByStripeCustomer(customer);
    if (u) return u;
  }
  const email = str((obj.customer_details as StripeObject | undefined)?.email) ?? str(obj.customer_email);
  return email ? findUserByEmail(email) : null;
}

const emailOf = (obj: StripeObject) => str((obj.customer_details as StripeObject | undefined)?.email) ?? str(obj.customer_email) ?? str(obj.receipt_email);

/** Apply one verified event. Returns what happened (for the admin's status line). */
export function handleStripeEvent(ev: StripeEvent): Promise<string> {
  return inOrder(() => applyEvent(ev));
}

async function applyEvent(ev: StripeEvent): Promise<string> {
  const log = await readLog();
  if (log.seen.includes(ev.id)) return "duplicate (already applied)";
  const obj = ev.data?.object ?? {};
  let result = "ignored";
  let attention = false;
  // Events about a subscription carry its time; an older one arriving late (a retry) is skipped.
  const at = Number(ev.created) || 0;
  const newer = (x: User) => !at || !x.stripeEventAt || at >= x.stripeEventAt;

  if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
    const u = await userFor(obj);
    // A bank debit (SEPA, ACH) completes the checkout before the money arrives: wait for it.
    const paid = obj.payment_status === "paid" || obj.payment_status === "no_payment_required";
    if (!u) {
      result = paid ? `paid, but no account matches (${emailOf(obj) ?? "no email"}): link it in Users` : "no matching account (client_reference_id / email)";
      attention = paid;
    } else if (!paid) result = `${u.email}: checkout complete, payment pending (${String(obj.payment_status)})`;
    else {
      // A new purchase: Pro, whatever was set before (the buyer paid for it just now).
      await updateUser(u.id, (x) => {
        x.plan = "pro";
        x.planSource = "stripe";
        x.stripeCustomerId = idOf(obj.customer) ?? x.stripeCustomerId;
        if (typeof ev.livemode === "boolean") x.stripeLive = ev.livemode;
        x.stripeSubscriptionId = idOf(obj.subscription) ?? x.stripeSubscriptionId;
        x.billingStatus = "active";
        x.upgradeRequestedAt = undefined;
        if (at) x.stripeEventAt = Math.max(x.stripeEventAt ?? 0, at);
      });
      result = `${u.email} → Pro`;
    }
  } else if (ev.type === "checkout.session.async_payment_failed") {
    const u = await userFor(obj);
    result = `${u?.email ?? emailOf(obj) ?? "unknown"}: the bank payment failed (no Pro)`;
  } else if (ev.type === "customer.subscription.created" || ev.type === "customer.subscription.updated" || ev.type === "customer.subscription.deleted") {
    const u = await userFor(obj);
    const status = ev.type === "customer.subscription.deleted" ? "canceled" : String(obj.status ?? "");
    if (!u) {
      result = `no matching account (customer ${idOf(obj.customer) ?? "?"})`;
      attention = ACTIVE.has(status);
    } else if (!newer(u)) result = `${u.email}: older event skipped (subscription ${status})`;
    else {
      const keep = ACTIVE.has(status);
      const periodEnd = Number(obj.current_period_end ?? (obj.items as { data?: { current_period_end?: number }[] } | undefined)?.data?.[0]?.current_period_end) || undefined;
      let held = false;
      await updateUser(u.id, (x) => {
        x.stripeCustomerId = idOf(obj.customer) ?? x.stripeCustomerId;
        if (typeof ev.livemode === "boolean") x.stripeLive = ev.livemode;
        x.stripeSubscriptionId = idOf(obj.id) ?? x.stripeSubscriptionId;
        x.periodEnd = periodEnd ? periodEnd * 1000 : x.periodEnd;
        x.billingStatus = keep ? (obj.cancel_at_period_end ? "canceling" : status === "past_due" ? "past_due" : "active") : "canceled";
        if (at) x.stripeEventAt = at;
        // A plan the owner set by hand stays until the next purchase.
        if (x.planSource === "admin") held = true;
        else if (keep) {
          x.plan = "pro";
          x.planSource = "stripe";
        } else if (x.planSource === "stripe") x.plan = "free";
      });
      result = `${u.email}: subscription ${status}${held ? " (plan set by hand, kept)" : keep ? " (Pro)" : ""}`;
    }
  } else if (ev.type === "invoice.payment_failed") {
    const u = await userFor(obj);
    if (u) {
      await updateUser(u.id, (x) => void (x.billingStatus = "past_due"));
      result = `${u.email}: payment failed (Stripe retries; Pro kept meanwhile)`;
    } else result = "payment failed for no matching account";
  } else if (ev.type === "invoice.paid") {
    const u = await userFor(obj);
    if (u) {
      await updateUser(u.id, (x) => {
        if (x.billingStatus === "past_due") x.billingStatus = "active";
      });
      result = `${u.email}: invoice paid`;
    } else {
      result = `invoice paid, but no account matches (${emailOf(obj) ?? idOf(obj.customer) ?? "?"})`;
      attention = Number(obj.amount_paid) > 0;
    }
  } else if (ev.type === "charge.refunded" || ev.type === "charge.dispute.created") {
    const u = await userFor(obj);
    const what = ev.type === "charge.refunded" ? "refunded" : "disputed";
    // A full refund (the 30-day refund promise on the Terms page) ends Pro; a partial one is the owner's call.
    const full = ev.type === "charge.refunded" && (obj.refunded === true || (Number(obj.amount) > 0 && Number(obj.amount_refunded) >= Number(obj.amount)));
    let downgraded = false;
    if (u)
      await updateUser(u.id, (x) => {
        x.billingFlag = what;
        if (full && x.planSource === "stripe" && x.plan !== "free") {
          x.plan = "free";
          x.billingStatus = "canceled";
          downgraded = true;
        }
      });
    const who = u?.email ?? emailOf(obj) ?? "unknown customer";
    result = downgraded
      ? `${who}: payment refunded in full → Free. Cancel the subscription in Stripe if it's still active, so it isn't charged again`
      : full
        ? `${who}: payment refunded in full. Check the plan in Users`
        : `${who}: payment ${what}${ev.type === "charge.refunded" ? " in part" : ""}. Check the plan in Users`;
    attention = true;
  }

  const record: EventRecord = { id: ev.id, type: ev.type, at: Date.now(), result, livemode: ev.livemode, attention: attention || undefined, email: emailOf(obj), customer: idOf(obj.customer) };
  log.seen = [...log.seen, ev.id].slice(-1000);
  log.count += 1;
  log.last = record;
  log.recent = [record, ...(log.recent ?? [])].slice(0, 30);
  await writeLog(log);
  return result;
}
