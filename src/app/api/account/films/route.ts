import { AccountError, limitsFor, listSavedFilms, requireUser, saveFilm } from "@/lib/accounts";
import { sanitizePlan } from "@/engine/planner";
import { noStore } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The account's saved films (without their storyboards), newest first. */
export async function GET(req: Request) {
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  return Response.json({ films: await listSavedFilms(u.id), limit: (await limitsFor(u)).savedFilms }, { headers: noStore });
}

/** Save a film: { id? (to update), title?, plan, thumb? }. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "account");
  if (limited) return limited;
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const body = (await req.json().catch(() => null)) as { id?: unknown; title?: unknown; plan?: unknown; thumb?: unknown } | null;
  if (!body?.plan || typeof body.plan !== "object") return Response.json({ error: "Missing video" }, { status: 400 });
  let plan;
  try {
    plan = sanitizePlan(body.plan as never);
  } catch {
    return Response.json({ error: "That isn't a valid video." }, { status: 400 });
  }
  try {
    const film = await saveFilm(u, {
      id: typeof body.id === "string" ? body.id : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      plan,
      thumb: typeof body.thumb === "string" ? body.thumb : undefined,
    });
    return Response.json({ id: film.id, title: film.title, updatedAt: film.updatedAt }, { headers: noStore });
  } catch (e) {
    if (e instanceof AccountError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
