import { deleteSavedFilm, getSavedFilm, renameFilm, requireUser } from "@/lib/accounts";
import { noStore } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** One saved film with its storyboard (only the account's own). */
export async function GET(req: Request, { params }: Ctx) {
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const film = await getSavedFilm(u.id, (await params).id);
  if (!film) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(film, { headers: noStore });
}

/** Rename: { title }. */
export async function PATCH(req: Request, { params }: Ctx) {
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const body = (await req.json().catch(() => null)) as { title?: unknown } | null;
  const film = await renameFilm(u.id, (await params).id, body?.title);
  if (!film) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ id: film.id, title: film.title }, { headers: noStore });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  await deleteSavedFilm(u.id, (await params).id);
  return new Response(null, { status: 204 });
}
