import { UrlError } from "@/lib/netguard";
import { scrapeSite } from "@/lib/scrape";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = rateLimit(req, "scrape");
  if (limited) return limited;
  let url = "";
  try {
    url = String((await req.json()).url ?? "").slice(0, 2000);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!url.trim()) return Response.json({ error: "Enter a website URL." }, { status: 400 });
  try {
    const site = await scrapeSite(url);
    return Response.json({ site });
  } catch (e) {
    const message =
      e instanceof UrlError
        ? e.message
        : (e as Error).name === "TimeoutError"
          ? "The site took too long to respond."
          : "Couldn't load that website.";
    if (!(e instanceof UrlError)) console.error("[scrape]", url, e);
    return Response.json({ error: message }, { status: 422 });
  }
}
