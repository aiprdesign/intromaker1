import { noStore, planLimits, readSettings, requireAdmin, writeSettings } from "@/lib/admin";
import { DEFAULT_LIMITS, readLimits } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function view() {
  const s = await readSettings();
  return { plans: await planLimits(), defaults: DEFAULT_LIMITS, proPrice: s.proPrice ?? "", contactEmail: s.contactEmail ?? "" };
}

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return Response.json(await view(), { headers: noStore });
}

/** Save plan limits and the pricing text: { plans, proPrice, contactEmail }. */
export async function PUT(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { plans?: unknown; proPrice?: unknown; contactEmail?: unknown } | null;
  if (!body) return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) || undefined : undefined);
  await writeSettings({ plans: readLimits(body.plans), proPrice: str(body.proPrice, 40), contactEmail: str(body.contactEmail, 120) });
  return Response.json(await view(), { headers: noStore });
}
