import { noStore, requireAdmin } from "@/lib/admin";
import { cleanAllow, envAllow, gateCookie, pinProblem, readGate, savedAllow, saveGate } from "@/lib/gate";
import { isHttps } from "@/lib/http";
import { clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The site PIN's state for Admin (never the PIN or its hash), and the address this request comes from. */
async function view(req: Request) {
  const g = await readGate();
  const you = clientKey(req);
  return {
    on: !!g?.on,
    pinSet: !!g,
    env: !!g?.env,
    allow: await savedAllow(),
    envAllow: envAllow(),
    // ("direct": INTROMAKER_PROXY_HOPS=0, so addresses can't be told apart and the list can't work.)
    yourIp: you === "direct" ? null : you,
    updatedAt: g?.env ? null : (g?.updatedAt ?? null),
  };
}

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return Response.json(await view(req), { headers: noStore });
}

/**
 * Save: { on?, pin?, allow? }. A new PIN signs out every browser unlocked with the old one; the
 * owner's own browser is unlocked with the PIN in force, so turning it on never locks the owner out.
 */
export async function PUT(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { on?: unknown; pin?: unknown; allow?: unknown } | null;
  if (!body) return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  const pin = typeof body.pin === "string" && body.pin.trim() ? body.pin.trim() : undefined;
  if (pin) {
    const problem = pinProblem(pin);
    if (problem) return Response.json({ error: problem }, { status: 400 });
  }
  const raw = Array.isArray(body.allow) ? body.allow : typeof body.allow === "string" ? body.allow.split(/[\s,;]+/) : undefined;
  if (raw) {
    const bad = raw.map((x) => String(x).trim()).filter((x) => x && !cleanAllow([x]).length);
    if (bad.length) return Response.json({ error: `Not an IP address: ${bad.slice(0, 3).join(", ")}` }, { status: 400 });
  }
  try {
    await saveGate({ on: typeof body.on === "boolean" ? body.on : undefined, pin, allow: raw ? cleanAllow(raw) : undefined });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  const g = await readGate();
  return Response.json(await view(req), { headers: { ...noStore, ...(g ? { "Set-Cookie": gateCookie(g, isHttps(req)) } : {}) } });
}
