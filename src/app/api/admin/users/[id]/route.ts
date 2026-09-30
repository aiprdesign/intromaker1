import { deleteUser, publicUser, resetPassword, updateUser } from "@/lib/accounts";
import { noStore, requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Change an account: { plan?: "free" | "pro", disabled?: boolean, clearRequest?: true }. */
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { plan?: unknown; disabled?: unknown; clearRequest?: unknown } | null;
  const u = await updateUser((await params).id, (x) => {
    if (body?.plan === "free" || body?.plan === "pro") {
      x.plan = body.plan;
      if (body.plan === "pro") x.upgradeRequestedAt = undefined;
    }
    if (typeof body?.disabled === "boolean") {
      x.disabled = body.disabled;
      if (body.disabled) x.sv += 1; // sign them out
    }
    if (body?.clearRequest) x.upgradeRequestedAt = undefined;
  });
  if (!u) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ user: { ...publicUser(u), disabled: !!u.disabled } }, { headers: noStore });
}

/** Reset the password: returns a one-time password to hand over (the user must pick a new one). */
export async function POST(req: Request, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const temp = await resetPassword((await params).id);
  if (!temp) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ tempPassword: temp }, { headers: noStore });
}

/** Delete the account and its saved films. */
export async function DELETE(req: Request, { params }: Ctx) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const ok = await deleteUser((await params).id);
  return ok ? new Response(null, { status: 204 }) : Response.json({ error: "Not found" }, { status: 404 });
}
