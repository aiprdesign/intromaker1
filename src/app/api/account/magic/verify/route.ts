import { AccountError, publicUser, sessionFor, useMagic, userCookie } from "@/lib/accounts";
import { noStore, sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open a sign-in link: { token }. Signs in (making the account for a new sign-up) and says where to go next. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  const limited = rateLimit(req, "accountLogin");
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  try {
    const { user, next, created } = await useMagic(body?.token);
    const { token, maxAge } = await sessionFor(user);
    return Response.json({ user: publicUser(user), next: next ?? null, created }, { headers: { ...noStore, "Set-Cookie": userCookie(req, token, maxAge) } });
  } catch (e) {
    if (e instanceof AccountError) return Response.json({ error: e.message }, { status: e.status, headers: noStore });
    throw e;
  }
}
