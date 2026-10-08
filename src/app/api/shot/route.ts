import { readShot } from "@/lib/storage";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const TYPES = { jpg: "image/jpeg", png: "image/png", svg: "image/svg+xml" } as const;

/** Serves screenshots, UI components and header logos captured from websites. */
export async function GET(req: Request) {
  const limited = rateLimit(req, "shot");
  if (limited) return limited;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[a-f0-9]{16}-(hero|full|mobile|s\d|p\d{1,2}|u\d{1,2}|logo)$/.test(id)) return new Response("Bad id", { status: 400 });
  // Logos are PNG or SVG; everything else is JPEG.
  const exts = id.endsWith("-logo") ? (["png", "svg"] as const) : (["jpg"] as const);
  for (const ext of exts) {
    const data = await readShot(`${id}.${ext}`);
    if (data) {
      return new Response(new Uint8Array(data), {
        headers: {
          "Content-Type": TYPES[ext],
          "Cache-Control": "public, max-age=86400, immutable",
          "X-Content-Type-Options": "nosniff",
          // SVGs are only ever drawn as images; never let one run script if opened directly.
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        },
      });
    }
  }
  return new Response("Not found", { status: 404 });
}
