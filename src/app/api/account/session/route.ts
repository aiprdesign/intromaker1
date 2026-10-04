import { AccountError, login, publicUser, requireUser, sessionFor, updateUser, userCookie } from "@/lib/accounts";
import { noStore, sameOrigin } from "@/lib/http";
import { lockedOut, signedIn, wrongPassword } from "@/lib/lockout";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sign in: { email, password }. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  const locked = lockedOut(req);
  if (locked) return locked;
  const limited = rateLimit(req, "accountLogin");
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  try {
    const u = await login(body?.email, body?.password).catch((e) => {
      // Wrong email or password: counted towards the lockout (a disabled account isn't a guess).
      if (e instanceof AccountError && e.status === 401) {
        const w = wrongPassword(req, "account", e.message);
        throw new AccountError(w.message, w.blocked ? 429 : 401);
      }
      throw e;
    });
    signedIn(req);
    const { token, maxAge } = await sessionFor(u);
    return Response.json({ user: publicUser(u) }, { headers: { ...noStore, "Set-Cookie": userCookie(req, token, maxAge) } });
  } catch (e) {
    if (e instanceof AccountError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

/** Sign out; ?everywhere=1 ends every session of the account. */
export async function DELETE(req: Request) {
  if (new URL(req.url).searchParams.get("everywhere")) {
    const u = await requireUser(req);
    if (u instanceof Response) return u;
    await updateUser(u.id, (x) => void (x.sv += 1));
  }
  return new Response(null, { status: 204, headers: { ...noStore, "Set-Cookie": userCookie(req, "", 0) } });
}
