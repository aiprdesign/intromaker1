import { AccountError, changePassword, publicUser, requireUser, sessionFor, userCookie } from "@/lib/accounts";
import { noStore } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Change the password: { current, next }. Other sessions end; this one is renewed. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "accountLogin");
  if (limited) return limited;
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const body = (await req.json().catch(() => null)) as { current?: unknown; next?: unknown } | null;
  try {
    const fresh = await changePassword(u, body?.current, body?.next);
    const { token, maxAge } = await sessionFor(fresh);
    return Response.json({ user: publicUser(fresh) }, { headers: { ...noStore, "Set-Cookie": userCookie(req, token, maxAge) } });
  } catch (e) {
    if (e instanceof AccountError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
