import { AccountError, createUser, currentUser, deleteUser, limitsFor, login, publicUser, requireUser, sessionFor, subscribed, usageOf, userCookie } from "@/lib/accounts";
import { planLimits, readSettings } from "@/lib/admin";
import { noStore, sameOrigin } from "@/lib/http";
import { checkoutUrl, effectiveBilling, portalUrl, type BillingLinks } from "@/lib/stripe-links";
import { lockedOut, wrongPassword } from "@/lib/lockout";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Stripe checkout for this account (links carry its id, so the payment finds it), and the billing
 * portal for subscribers. Without an account only whether paying online is possible.
 */
function billingFor(u: Awaited<ReturnType<typeof currentUser>>, b: BillingLinks | undefined) {
  const online = !!(b?.monthlyLink || b?.yearlyLink);
  if (!u) return { online };
  return {
    online,
    monthly: b?.monthlyLink ? checkoutUrl(b.monthlyLink, u) : null,
    yearly: b?.yearlyLink ? checkoutUrl(b.yearlyLink, u) : null,
    yearlyPrice: b?.yearlyPrice ?? null,
    portal: b?.portalLink && (u.stripeCustomerId || u.planSource === "stripe") ? portalUrl(b.portalLink, u.email) : null,
  };
}
export const dynamic = "force-dynamic";

/** Who's signed in (or null), their plan, limits and usage, and every plan's limits for the pricing UI. */
export async function GET(req: Request) {
  const u = await currentUser(req);
  const settings = await readSettings();
  return Response.json(
    {
      user: u ? publicUser(u) : null,
      limits: await limitsFor(u),
      usage: u ? usageOf(u) : { ai: 0, imports: 0 },
      plans: await planLimits(),
      proPrice: settings.proPrice ?? null,
      contactEmail: settings.contactEmail ?? null,
      billing: billingFor(u, effectiveBilling(settings.billing)),
    },
    { headers: noStore },
  );
}

/** Create an account: { email, password }. Signs in. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  const limited = rateLimit(req, "signup");
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  try {
    const u = await createUser(body?.email, body?.password);
    const { token, maxAge } = await sessionFor(u);
    return Response.json({ user: publicUser(u) }, { headers: { ...noStore, "Set-Cookie": userCookie(req, token, maxAge) } });
  } catch (e) {
    if (e instanceof AccountError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

/** Delete the account and its saved films: { password }. */
export async function DELETE(req: Request) {
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const locked = lockedOut(req);
  if (locked) return locked;
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  try {
    await login(u.email, body?.password);
  } catch {
    const w = wrongPassword(req, "account", "Your password is wrong.");
    return Response.json({ error: w.message }, { status: w.blocked ? 429 : 401 });
  }
  // A live subscription would keep charging an account that no longer exists.
  if (subscribed(u)) {
    return Response.json({ error: "Cancel your Pro subscription first (Manage billing), then delete the account.", code: "subscribed" }, { status: 409 });
  }
  await deleteUser(u.id);
  return new Response(null, { status: 204, headers: { ...noStore, "Set-Cookie": userCookie(req, "", 0) } });
}
