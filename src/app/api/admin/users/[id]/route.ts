import { adminUser, deleteUser, findUserByStripeCustomer, getUser, resetPassword, subscribed, updateUser } from "@/lib/accounts";
import { noStore, requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Change an account: { plan?: "free" | "pro", disabled?: boolean, clearRequest?: true,
 * stripeCustomerId?: "cus_…" | "" (link a payment that reached no account, or unlink), clearFlag?: true }.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { plan?: unknown; disabled?: unknown; clearRequest?: unknown; stripeCustomerId?: unknown; clearFlag?: unknown } | null;
  const cus = typeof body?.stripeCustomerId === "string" ? body.stripeCustomerId.trim() : undefined;
  if (cus && !/^cus_[A-Za-z0-9]{6,40}$/.test(cus)) return Response.json({ error: "A Stripe customer id looks like cus_…" }, { status: 400 });
  if (cus) {
    const owner = await findUserByStripeCustomer(cus);
    if (owner && owner.id !== (await params).id) return Response.json({ error: `That customer is already linked to ${owner.email}.` }, { status: 409 });
  }
  const u = await updateUser((await params).id, (x) => {
    if (body?.plan === "free" || body?.plan === "pro") {
      x.plan = body.plan;
      // A plan set by hand stays until changed by hand (Stripe events won't take it back).
      x.planSource = "admin";
      if (body.plan === "pro") x.upgradeRequestedAt = undefined;
    }
    if (typeof body?.disabled === "boolean") {
      x.disabled = body.disabled;
      if (body.disabled) x.sv += 1; // sign them out
    }
    if (body?.clearRequest) x.upgradeRequestedAt = undefined;
    if (body?.clearFlag) x.billingFlag = undefined;
    if (cus) {
      // The owner found this account's payment in Stripe: Stripe runs the plan from now on.
      x.stripeCustomerId = cus;
      x.planSource = "stripe";
      x.plan = "pro";
      x.billingStatus = "active";
      x.upgradeRequestedAt = undefined;
    } else if (cus === "") {
      x.stripeCustomerId = undefined;
      x.stripeSubscriptionId = undefined;
    }
  });
  if (!u) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ user: { ...adminUser(u), disabled: !!u.disabled } }, { headers: noStore });
}

/** Reset the password: returns a one-time password to hand over (the user must pick a new one). */
export async function POST(req: Request, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const temp = await resetPassword((await params).id);
  if (!temp) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ tempPassword: temp }, { headers: noStore });
}

/** Delete the account and its saved films. A paying subscriber needs ?stripeCancelled=1 (cancelled in Stripe first). */
export async function DELETE(req: Request, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const id = (await params).id;
  const u = await getUser(id);
  if (u && subscribed(u) && new URL(req.url).searchParams.get("stripeCancelled") !== "1") {
    return Response.json({ error: "This account has a live Stripe subscription. Cancel it in Stripe first, or it keeps being charged." }, { status: 409 });
  }
  const ok = await deleteUser(id);
  return ok ? new Response(null, { status: 204 }) : Response.json({ error: "Not found" }, { status: 404 });
}
