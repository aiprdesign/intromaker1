import { publicUser, requireUser, updateUser } from "@/lib/accounts";
import { noStore } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ask the owner for Pro (there's no payment provider yet: the owner switches plans in the admin area). */
export async function POST(req: Request) {
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  if (u.plan === "pro") return Response.json({ user: publicUser(u) }, { headers: noStore });
  const fresh = await updateUser(u.id, (x) => void (x.upgradeRequestedAt ??= Date.now()));
  return Response.json({ user: fresh ? publicUser(fresh) : null }, { headers: noStore });
}
