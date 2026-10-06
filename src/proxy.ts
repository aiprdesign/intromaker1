import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, readGate, validGateToken } from "@/lib/gate";
import { clientKey } from "@/lib/ratelimit";

/**
 * Site PIN (Admin → Site PIN): while it's on, a visitor without the unlock cookie is sent to the
 * PIN page, and the app's API answers "locked"; addresses on the allow list skip it. Always open: the PIN page itself, the admin area
 * (so the owner can always get in and turn it off), the Stripe webhook, the health check and
 * static files (scripts, styles, fonts, images).
 */
const OPEN = [/^\/unlock$/, /^\/api\/unlock$/, /^\/admin(?:\/|$)/, /^\/api\/admin(?:\/|$)/, /^\/api\/stripe\/webhook(?:\/|$)/, /^\/api\/health$/];
const STATIC = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|css|js|map|txt|xml|webmanifest|json|mp3|mp4|webm|wav)$/i;

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // (Files under /api are the app's own data, such as captured screenshots: those stay locked.)
  if (OPEN.some((r) => r.test(pathname)) || (!pathname.startsWith("/api/") && STATIC.test(pathname))) return NextResponse.next();
  const gate = await readGate();
  if (!gate?.on || validGateToken(gate, req.cookies.get(GATE_COOKIE)?.value)) return NextResponse.next();
  // Allowed addresses (Admin → Site PIN, or INTROMAKER_SITE_PIN_ALLOW) skip the PIN.
  if (gate.allow.length && gate.allow.includes(clientKey(req))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "This site is locked. Enter the PIN to continue." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = pathname === "/" && !search ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  // Everything except Next's own build files (the PIN page needs its scripts and styles).
  matcher: ["/((?!_next/static|_next/image).*)"],
};
