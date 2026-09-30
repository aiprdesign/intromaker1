import { UrlError } from "@/lib/netguard";
import { scrapeSite } from "@/lib/scrape";
import { clientKey, enabled, rateLimit, refund, take } from "@/lib/ratelimit";
import { currentUser, limitsFor, spendImport, usageOf } from "@/lib/accounts";

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
  // Website imports per day come with the plan: per account when signed in, per address otherwise.
  const who = await currentUser(req);
  const limits = await limitsFor(who);
  const counted = !who && enabled();
  if (who ? usageOf(who).imports >= limits.importsPerDay : counted && !take("importDay", clientKey(req), Date.now(), limits.importsPerDay).ok) {
    const n = limits.importsPerDay;
    return Response.json(
      { error: `You've used today's ${n} website import${n === 1 ? "" : "s"}${who ? ` on the ${who.plan === "pro" ? "Pro" : "Free"} plan` : ""}. ${who?.plan === "pro" ? "Try again tomorrow." : "Upgrade to Pro for more, or try again tomorrow."}` },
      { status: 429 },
    );
  }
  try {
    const site = await scrapeSite(url);
    if (who) await spendImport(who);
    return Response.json({ site });
  } catch (e) {
    // Only imports that produce a site count against the daily allowance (a typo or a site that's
    // down shouldn't use one up). The per-10-minute limit above still caps attempts.
    if (counted) refund("importDay", clientKey(req));
    if (e instanceof UrlError) return Response.json({ error: e.message, code: e.code, suggestion: e.suggestion }, { status: 422 });
    console.error("[scrape]", url, e);
    const timeout = (e as Error).name === "TimeoutError";
    return Response.json(
      { error: timeout ? "The site took too long to respond. Try again in a few minutes." : "Couldn't read that website. Try again, or describe your product in the prompt.", code: timeout ? "timeout" : "failed" },
      { status: 422 },
    );
  }
}
