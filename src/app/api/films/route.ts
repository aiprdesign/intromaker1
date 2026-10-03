import { currentUser } from "@/lib/accounts";
import { adminEnabled, recordFilm } from "@/lib/admin";
import { sanitizePlan } from "@/engine/planner";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * The studio reports finished films here (an export), so the owner's admin area shows what
 * visitors actually made, edits included. A no-op unless the admin area is on.
 */
export async function POST(req: Request) {
  if (!adminEnabled()) return new Response(null, { status: 204 });
  const limited = rateLimit(req, "filmEvent");
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as { plan?: unknown; preset?: unknown; prompt?: unknown; url?: unknown } | null;
  if (!body?.plan || typeof body.plan !== "object") return Response.json({ error: "Missing plan" }, { status: 400 });
  let plan;
  try {
    plan = sanitizePlan(body.plan as never);
  } catch {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);
  const url = str(body.url, 300);
  const who = await currentUser(req).catch(() => null);
  await recordFilm(req, {
    account: who ? { id: who.id, email: who.email } : null,
    kind: "exported",
    plan,
    engine: "export",
    preset: str(body.preset, 40),
    prompt: url ? undefined : str(body.prompt, 400),
    url: url && /^https?:\/\//i.test(url) ? url : undefined,
  });
  return new Response(null, { status: 204 });
}
