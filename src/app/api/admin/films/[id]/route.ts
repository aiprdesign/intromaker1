import { getFilm, noStore, requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One film: its log entry and storyboard. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const film = await getFilm((await params).id);
  if (!film) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(film, { headers: noStore });
}
