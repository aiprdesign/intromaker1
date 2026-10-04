import { assertPublicUrl, UrlError } from "@/lib/netguard";
import { rateLimit } from "@/lib/ratelimit";
import { checkSite } from "@/lib/scrape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Why didn't the import work? One plain request to the site (no browser): is it online, how fast,
 * does it let automated visitors in, is there readable text, a title, a logo. The studio shows this
 * next to a failed import, so the visitor knows whether it's their site or our side.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, "siteCheck");
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim().slice(0, 2000) : "";
  if (!url) return Response.json({ error: "Enter a website URL." }, { status: 400 });
  try {
    await assertPublicUrl(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  } catch (e) {
    if (e instanceof UrlError && e.code !== "dns") return Response.json({ check: { host: url, online: false, problem: { code: e.code, message: e.message } } });
  }
  return Response.json({ check: await checkSite(url) }, { headers: { "Cache-Control": "no-store" } });
}
