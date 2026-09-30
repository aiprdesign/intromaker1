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

interface EventLog {
  seen: string[];
  last?: { id: string; type: string; at: number; result: string; livemode?: boolean };
  count: number;
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
  const tmp = `${EVENTS}.tmp`;
  await writeFile(tmp, JSON.stringify(log), { mode: 0o600 });
  await rename(tmp, EVENTS);
}

export async function billingStatus() {
  const log = await readLog();
  return { last: log.last ?? null, count: log.count };
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

/** Apply one verified event. Returns what happened (for the admin's status line). */
export async function handleStripeEvent(ev: StripeEvent): Promise<string> {
  const log = await readLog();
  if (log.seen.includes(ev.id)) return "duplicate (already applied)";
  const obj = ev.data?.object ?? {};
  let result = "ignored";

  if (ev.type === "checkout.session.completed") {
    const u = await userFor(obj);
    const paid = obj.payment_status === "paid" || obj.payment_status === "no_payment_required" || obj.status === "complete";
    if (!u) result = "no matching account (client_reference_id / email)";
    else if (!paid) result = `checkout not paid (${String(obj.payment_status)})`;
    else {
      await updateUser(u.id, (x) => {
        x.plan = "pro";
        x.planSource = "stripe";
        x.stripeCustomerId = idOf(obj.customer) ?? x.stripeCustomerId;
        x.stripeSubscriptionId = idOf(obj.subscription) ?? x.stripeSubscriptionId;
        x.billingStatus = "active";
        x.upgradeRequestedAt = undefined;
      });
      result = `${u.email} → Pro`;
    }
  } else if (ev.type === "customer.subscription.created" || ev.type === "customer.subscription.updated" || ev.type === "customer.subscription.deleted") {
    const u = await userFor(obj);
    const status = ev.type === "customer.subscription.deleted" ? "canceled" : String(obj.status ?? "");
    if (!u) result = "no matching account (customer)";
    else {
      const keep = ACTIVE.has(status);
      const periodEnd = Number(obj.current_period_end ?? (obj.items as { data?: { current_period_end?: number }[] } | undefined)?.data?.[0]?.current_period_end) || undefined;
      await updateUser(u.id, (x) => {
        x.stripeCustomerId = idOf(obj.customer) ?? x.stripeCustomerId;
        x.stripeSubscriptionId = idOf(obj.id) ?? x.stripeSubscriptionId;
        x.periodEnd = periodEnd ? periodEnd * 1000 : x.periodEnd;
        x.billingStatus = keep ? (obj.cancel_at_period_end ? "canceling" : status === "past_due" ? "past_due" : "active") : "canceled";
        if (keep) {
          x.plan = "pro";
          x.planSource = "stripe";
        } else if (x.planSource === "stripe") {
          // Only plans Stripe granted are taken back; one the owner set by hand stays.
          x.plan = "free";
        }
      });
      result = `${u.email}: subscription ${status}${keep ? " (Pro)" : ""}`;
    }
  } else if (ev.type === "invoice.payment_failed") {
    const u = await userFor(obj);
    if (u) {
      await updateUser(u.id, (x) => void (x.billingStatus = "past_due"));
      result = `${u.email}: payment failed (Stripe retries; Pro kept meanwhile)`;
    }
  }

  log.seen = [...log.seen, ev.id].slice(-1000);
  log.count += 1;
  log.last = { id: ev.id, type: ev.type, at: Date.now(), result, livemode: ev.livemode };
  await writeLog(log);
  return result;
}
