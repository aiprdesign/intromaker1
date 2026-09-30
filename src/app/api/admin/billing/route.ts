import { noStore, readSettings, requireAdmin, writeSettings } from "@/lib/admin";
import { billingStatus, isTestLink, stripeLink, webhookConfigured } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function view(req: Request) {
  const s = await readSettings();
  const b = s.billing ?? {};
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const links = [b.monthlyLink, b.yearlyLink].filter(Boolean) as string[];
  return {
    monthlyLink: b.monthlyLink ?? "",
    yearlyLink: b.yearlyLink ?? "",
    portalLink: b.portalLink ?? "",
    yearlyPrice: b.yearlyPrice ?? "",
    proPrice: s.proPrice ?? "",
    webhookUrl: `${proto}://${host}/api/stripe/webhook`,
    successUrl: `${proto}://${host}/account?upgraded=1`,
    webhookSecretSet: webhookConfigured(),
    mode: !links.length ? null : links.every(isTestLink) ? "test" : links.some(isTestLink) ? "mixed" : "live",
    ...(await billingStatus()),
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
  await writeSettings({ billing });
  return Response.json(await view(req), { headers: noStore });
}
