/** Stripe Payment Link and customer-portal URL helpers (no imports, so any module can use them). */

/** The refund window for Pro payments, in days (the Terms page, pricing and account pages say so). */
export const REFUND_DAYS = 30;

export interface BillingLinks {
  monthlyLink?: string;
  yearlyLink?: string;
  portalLink?: string;
  /** How the yearly price reads, e.g. "$90 / year". */
  yearlyPrice?: string;
}

/** Only Stripe's own hosted pages, so a stored link can never send visitors elsewhere. */
export function stripeLink(v: unknown, kind: "pay" | "portal"): string | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  try {
    const u = new URL(v.trim());
    const hosts = kind === "pay" ? ["buy.stripe.com", "checkout.stripe.com"] : ["billing.stripe.com"];
    if (u.protocol !== "https:" || !hosts.includes(u.hostname)) return undefined;
    u.hash = "";
    return u.toString().slice(0, 300);
  } catch {
    return undefined;
  }
}

/**
 * The Stripe links can also come from the server's environment, which wins over Admin → Billing
 * (the webhook's signing secret is environment-only: STRIPE_WEBHOOK_SECRET).
 */
export const BILLING_ENV = {
  monthlyLink: "STRIPE_MONTHLY_LINK",
  yearlyLink: "STRIPE_YEARLY_LINK",
  portalLink: "STRIPE_PORTAL_LINK",
  yearlyPrice: "STRIPE_YEARLY_PRICE",
} as const satisfies Record<keyof BillingLinks, string>;

/** The links in effect: environment first, then what was saved in Admin; and which came from the environment. */
export function effectiveBilling(saved: BillingLinks | undefined, env: Record<string, string | undefined> = process.env): BillingLinks & { fromEnv: (keyof BillingLinks)[] } {
  const fromEnv: (keyof BillingLinks)[] = [];
  const pick = (key: keyof BillingLinks) => {
    const raw = env[BILLING_ENV[key]]?.trim();
    const v = !raw ? undefined : key === "yearlyPrice" ? raw.slice(0, 40) : stripeLink(raw, key === "portalLink" ? "portal" : "pay");
    if (v) fromEnv.push(key);
    return v ?? saved?.[key];
  };
  return { monthlyLink: pick("monthlyLink"), yearlyLink: pick("yearlyLink"), portalLink: pick("portalLink"), yearlyPrice: pick("yearlyPrice"), fromEnv };
}

/** The webhook events Prodintro.com handles: select these on the Stripe endpoint. */
export const STRIPE_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
];

export const isTestLink = (link?: string) => !!link && /\/test_/.test(link);

/** The payment link for this account: its id comes back on the webhook, its email is prefilled. */
export function checkoutUrl(link: string, u: { id: string; email: string }) {
  const url = new URL(link);
  url.searchParams.set("client_reference_id", u.id);
  url.searchParams.set("prefilled_email", u.email);
  return url.toString();
}

export function portalUrl(link: string, email: string) {
  const url = new URL(link);
  url.searchParams.set("prefilled_email", email);
  return url.toString();
}

