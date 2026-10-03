import { deleteFilms, listFilms, noStore, readSettings, requireAdmin } from "@/lib/admin";
import { serverAiUsedToday } from "@/lib/ratelimit";
import { dataIsPersistent } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Films visitors made, newest first, with an overview. ?q= search, ?kind=, ?visitor=, ?account=, ?page= */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const u = new URL(req.url);
  const out = await listFilms({
    q: u.searchParams.get("q") ?? undefined,
    kind: u.searchParams.get("kind") ?? undefined,
    visitor: u.searchParams.get("visitor") ?? undefined,
    account: u.searchParams.get("account") ?? undefined,
    page: Number(u.searchParams.get("page")) || 0,
    size: Number(u.searchParams.get("size")) || 30,
  });
  const settings = await readSettings();
  return Response.json(
    {
      ...out,
      aiToday: serverAiUsedToday(),
      aiBudget: settings.dailyBudget ?? (Number(process.env.INTROMAKER_AI_DAILY_BUDGET ?? 200) || 0),
      // Without a data volume the log lives in a temporary folder and a redeploy empties it.
      persistent: dataIsPersistent(),
    },
    { headers: noStore },
  );
}

/** Delete films: { ids: [...] } or { all: true }. */
export async function DELETE(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { ids?: unknown; all?: unknown } | null;
  if (body?.all === true) return Response.json({ deleted: await deleteFilms("all") }, { headers: noStore });
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 500) : [];
  if (!ids.length) return Response.json({ error: "No films given" }, { status: 400 });
  return Response.json({ deleted: await deleteFilms(ids) }, { headers: noStore });
}
