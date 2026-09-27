import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SHOT_DIR } from "@/lib/capture";

export const runtime = "nodejs";

/** Serves screenshots captured by the live website capture. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[a-f0-9]{16}-(hero|full|s\d)$/.test(id)) return new Response("Bad id", { status: 400 });
  try {
    const data = await readFile(join(SHOT_DIR, `${id}.jpg`));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
