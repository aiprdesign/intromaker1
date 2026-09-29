import { access, constants, mkdir } from "node:fs/promises";
import { SHOT_DIR } from "@/lib/storage";
import { enabled as rateLimited } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness for the host's health check: the server answers and its capture folder is writable. */
export async function GET() {
  const storage = await mkdir(SHOT_DIR, { recursive: true })
    .then(() => access(SHOT_DIR, constants.W_OK))
    .then(() => "writable")
    .catch(() => "unavailable");
  return Response.json(
    { ok: storage === "writable", storage, persistent: !!process.env.INTROMAKER_DATA_DIR, rateLimits: rateLimited(), uptime: Math.round(process.uptime()) },
    { status: storage === "writable" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
