import { AccountError, publicUser, sessionFor, useReset, userCookie } from "@/lib/accounts";
import { noStore, sameOrigin } from "@/lib/http";
import { signedIn } from "@/lib/lockout";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set a new password from a reset link: { token, password }. Signs in; other sessions end. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  const limited = rateLimit(req, "accountLogin");
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
  try {
    const user = await useReset(body?.token, body?.password);
    signedIn(req);
    const { token, maxAge } = await sessionFor(user);
    return Response.json({ user: publicUser(user) }, { headers: { ...noStore, "Set-Cookie": userCookie(req, token, maxAge) } });
  } catch (e) {
    if (e instanceof AccountError) return Response.json({ error: e.message }, { status: e.status, headers: noStore });
    throw e;
  }
}
