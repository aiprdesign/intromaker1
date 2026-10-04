import { noStore, requireAdmin } from "@/lib/admin";
import { listBlocks, maxTries, unblock } from "@/lib/lockout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Addresses blocked from signing in after too many wrong passwords (masked). */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return Response.json({ blocks: listBlocks(), tries: maxTries(), blockMinutes: Math.min(24 * 60, Math.max(1, Number(process.env.INTROMAKER_LOGIN_BLOCK_MIN ?? 60) || 60)) }, { headers: noStore });
}

/** Lift a block: { id }. */
export async function DELETE(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof body?.id !== "string" || !unblock(body.id)) return Response.json({ error: "Not blocked (any more)" }, { status: 404 });
  return Response.json({ blocks: listBlocks() }, { headers: noStore });
}
