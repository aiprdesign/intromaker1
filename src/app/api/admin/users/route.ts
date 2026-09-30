import { listUsers } from "@/lib/accounts";
import { noStore, requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every account (never password hashes), newest first. */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const users = await listUsers();
  return Response.json(
    { users, counts: { total: users.length, pro: users.filter((u) => u.plan === "pro").length, requests: users.filter((u) => u.upgradeRequestedAt && u.plan !== "pro").length } },
    { headers: noStore },
  );
}
