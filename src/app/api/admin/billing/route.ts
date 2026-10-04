import { noStore, planLimits, readSettings, requireAdmin, writeSettings } from "@/lib/admin";
import { dataIsPersistent } from "@/lib/storage";
import { billingStatus, isTestLink, stripeLink, webhookConfigured } from "@/lib/billing";
import { BILLING_ENV, effectiveBilling } from "@/lib/stripe-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function view(req: Request) {
  const s = await readSettings();
  const b = effectiveBilling(s.billing);
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const links = [b.monthlyLink, b.yearlyLink].filter(Boolean) as string[];
  const status = await billingStatus();
  const plans = await planLimits();
  return {
    monthlyLink: b.monthlyLink ?? "",
    yearlyLink: b.yearlyLink ?? "",
    portalLink: b.portalLink ?? "",
    yearlyPrice: b.yearlyPrice ?? "",
    // Set on the server (STRIPE_MONTHLY_LINK…): shown read-only here, and they win over saved ones.
    fromEnv: Object.fromEntries(b.fromEnv.map((k) => [k, BILLING_ENV[k]])),
    proPrice: s.proPrice ?? "",
    webhookUrl: `${proto}://${host}/api/stripe/webhook`,
    successUrl: `${proto}://${host}/account?upgraded=1`,
    webhookSecretSet: webhookConfigured(),
    mode: !links.length ? null : links.every(isTestLink) ? "test" : links.some(isTestLink) ? "mixed" : "live",
    ...status,
    // What a real paid plan needs besides the plumbing.
    checks: {
      // Pro has to unlock something Free doesn't, or buyers pay for nothing.
      proUnlocksMore: JSON.stringify(plans.free) !== JSON.stringify(plans.pro),
      proPriceSet: !!s.proPrice?.trim(),
      contactEmailSet: !!s.contactEmail?.trim(),
      // Accounts and Pro status are kept on the data volume; without one a redeploy wipes them.
      persistent: dataIsPersistent(),
      // Test links with live events (or the reverse) mean the secret is from the other mode.
      modeMatches: !status.last || status.last.livemode === undefined || !links.length || (links.every(isTestLink) ? status.last.livemode === false : links.some(isTestLink) ? true : status.last.livemode === true),
      // A paid checkout reached an account.
      testPassed: status.recent.some((r) => /→ Pro$/.test(r.result)),
    },
  };
}

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return Response.json(await view(req), { headers: noStore });
}

/** Save links: { monthlyLink, yearlyLink, portalLink, yearlyPrice }. Only Stripe-hosted URLs are accepted. */
export async function PUT(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  const errors: string[] = [];
  const pick = (key: string, kind: "pay" | "portal", label: string) => {
    const raw = typeof body[key] === "string" ? (body[key] as string).trim() : "";
    if (!raw) return undefined;
    const ok = stripeLink(raw, kind);
    if (!ok) errors.push(`${label} must be a ${kind === "pay" ? "https://buy.stripe.com/… Payment Link" : "https://billing.stripe.com/p/login/… customer portal link"}.`);
    return ok;
  };
  const billing = {
    monthlyLink: pick("monthlyLink", "pay", "Monthly link"),
    yearlyLink: pick("yearlyLink", "pay", "Yearly link"),
    portalLink: pick("portalLink", "portal", "Portal link"),
    yearlyPrice: typeof body.yearlyPrice === "string" ? body.yearlyPrice.trim().slice(0, 40) || undefined : undefined,
  };
  if (errors.length) return Response.json({ error: errors.join(" ") }, { status: 400 });
  // Fields set in the environment aren't edited here: keep what was saved under them.
  const saved = (await readSettings()).billing ?? {};
  for (const k of effectiveBilling(saved).fromEnv) billing[k] = saved[k];
  await writeSettings({ billing });
  return Response.json(await view(req), { headers: noStore });
}
