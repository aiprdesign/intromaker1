import { scanLocal, serverReachesLocal } from "@/lib/ai";

export const runtime = "nodejs";

/** Finds local model servers running on this machine (only when the server is local itself). */
export async function GET() {
  if (!serverReachesLocal()) return Response.json({ available: false, found: [] });
  return Response.json({ available: true, found: await scanLocal() });
}
