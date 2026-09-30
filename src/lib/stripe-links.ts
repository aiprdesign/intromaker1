/** Stripe Payment Link and customer-portal URL helpers (no imports, so any module can use them). */

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

