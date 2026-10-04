import { adminEnabled, checkPassword, COOKIE, newSession, noStore, sameOrigin, sessionCookie, validSession } from "@/lib/admin";
import { lockedOut, signedIn, wrongPassword } from "@/lib/lockout";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookieOf(req: Request) {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Is the admin area on, and is this browser signed in? */
export async function GET(req: Request) {
  if (!adminEnabled()) return Response.json({ enabled: false, authed: false }, { headers: noStore });
  return Response.json({ enabled: true, authed: validSession(cookieOf(req)) }, { headers: noStore });
}

/** Sign in with ADMIN_PASSWORD. */
export async function POST(req: Request) {
  if (!adminEnabled()) return Response.json({ error: "Not found" }, { status: 404 });
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  // Three wrong passwords block the address from signing in (lib/lockout.ts).
  const locked = lockedOut(req);
  if (locked) return locked;
  const limited = rateLimit(req, "adminLogin");
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  if (!checkPassword(body?.password)) {
    // A small fixed delay on top of the lockout makes guessing slower still.
    await new Promise((r) => setTimeout(r, 400));
    const w = wrongPassword(req, "admin", "Wrong password.");
    return Response.json({ error: w.message, blocked: w.blocked }, { status: w.blocked ? 429 : 401, headers: noStore });
  }
  signedIn(req);
  const { token, maxAge } = newSession();
  return Response.json({ ok: true }, { headers: { ...noStore, "Set-Cookie": sessionCookie(req, token, maxAge) } });
}

/** Sign out. */
export async function DELETE(req: Request) {
  return new Response(null, { status: 204, headers: { ...noStore, "Set-Cookie": sessionCookie(req, "", 0) } });
}
