import { randomBytes } from "node:crypto";
import { sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { saveShot } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_PHOTOS = 10;
const MAX_BYTES = 6 * 1024 * 1024;

/** A whole JPEG: starts with the SOI marker and ends with EOI. */
const isJpeg = (b: Buffer) => b.length > 64 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;

/**
 * Product photos for a product video (your own, or your listing's when a marketplace won't let
 * the import read them). The studio re-encodes each photo as a JPEG in the browser first (resized,
 * with camera metadata such as location dropped), so only plain JPEGs are accepted here. They're
 * stored like website captures and served back from /api/shot.
 */
export async function POST(req: Request) {
  // Only the studio itself may store files here.
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  const limited = rateLimit(req, "photos");
  if (limited) return limited;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Send the photos as form data." }, { status: 400 });
  }
  const files = form.getAll("photo").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (!files.length) return Response.json({ error: "No photos were sent." }, { status: 400 });
  if (files.length > MAX_PHOTOS) return Response.json({ error: `Add up to ${MAX_PHOTOS} photos at a time.` }, { status: 400 });
  const id = randomBytes(8).toString("hex");
  const urls: string[] = [];
  for (const [i, f] of files.entries()) {
    if (f.size > MAX_BYTES) return Response.json({ error: "A photo is too large (6 MB at most)." }, { status: 413 });
    const buf = Buffer.from(await f.arrayBuffer());
    if (!isJpeg(buf)) return Response.json({ error: "That file isn't a photo the studio can use (JPEG, PNG or WebP)." }, { status: 415 });
    urls.push(await saveShot(`${id}-u${i}`, buf, "jpg"));
  }
  return Response.json({ photos: urls });
}
