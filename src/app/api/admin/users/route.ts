import { listUsers } from "@/lib/accounts";
import { filmsByAccount, noStore, requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The accounts (without password hashes), newest first, with the intros they made. */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const made = await filmsByAccount();
  // With the intros they've made (from the film log) and what they asked for.
  const users = (await listUsers()).map((u) => ({ ...u, made: made.get(u.id) ?? { made: 0, lastAt: 0, recent: [] } }));
  return Response.json(
    { users, counts: { total: users.length, pro: users.filter((u) => u.plan === "pro").length, requests: users.filter((u) => u.upgradeRequestedAt && u.plan !== "pro").length } },
    { headers: noStore },
  );
}
