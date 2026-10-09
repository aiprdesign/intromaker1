import { AccountError, recordExport, requireUser } from "@/lib/accounts";
import { noStore, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Count an exported video against the account's allowance (Free: a few videos, licensed for
 * commercial use). Called by the studio as an export starts; 402 when the allowance is used up.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  try {
    return Response.json(await recordExport(u), { headers: noStore });
  } catch (e) {
    if (e instanceof AccountError) return Response.json({ error: e.message, code: "limit" }, { status: e.status, headers: noStore });
    throw e;
  }
}
