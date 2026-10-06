import { gateCookie, pinMatches, readGate } from "@/lib/gate";
import { isHttps, noStore } from "@/lib/http";
import { clientKey, take } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Unlock the site with its PIN: { pin }. Wrong PINs are limited per visitor (see RULES.unlock). */
export async function POST(req: Request) {
  // Always counted (even with INTROMAKER_RATE_LIMIT=off): a PIN is short.
  const tries = take("unlock", clientKey(req));
  if (!tries.ok) {
    const mins = Math.ceil(tries.retryAfter / 60);
    return Response.json({ error: `Too many tries. Try again in ${mins > 1 ? `${mins} minutes` : "a minute"}.` }, { status: 429, headers: { ...noStore, "Retry-After": String(tries.retryAfter) } });
  }
  const gate = await readGate();
  if (!gate?.on) return Response.json({ ok: true }, { headers: noStore });
  const body = (await req.json().catch(() => null)) as { pin?: unknown } | null;
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  if (!pin || !pinMatches(gate, pin)) return Response.json({ error: "That PIN isn't right." }, { status: 401, headers: noStore });
  return Response.json({ ok: true }, { headers: { ...noStore, "Set-Cookie": gateCookie(gate, isHttps(req)) } });
}
