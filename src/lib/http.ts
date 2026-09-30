/** Small helpers shared by the routes that use cookies (admin area, accounts). */

export function cookieOf(req: Request, name: string) {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/** A browser on another site can't drive a signed-in API: its requests carry a foreign Origin. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return req.method === "GET" || req.method === "HEAD";
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isHttps(req: Request) {
  return req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:";
}

export const noStore = { "Cache-Control": "no-store" };
