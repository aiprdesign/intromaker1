import { safeFetch, UrlError } from "@/lib/netguard";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_VIDEO = 150 * 1024 * 1024;

/**
 * Same-origin proxy for website images and videos, so the renderer can draw them onto a canvas
 * without tainting it (tainted canvases can't be exported). Forwards Range requests so videos
 * can seek.
 */
export async function GET(req: Request) {
  const limited = rateLimit(req, "asset");
  if (limited) return limited;
  const target = new URL(req.url).searchParams.get("url");
  if (!target) return new Response("Missing url", { status: 400 });
  try {
    const range = req.headers.get("range");
    const upstream = await safeFetch(target, { headers: range ? { Range: range } : {} });
    if (!upstream.ok && upstream.status !== 206) return new Response("Upstream error", { status: 502 });
    const type = upstream.headers.get("content-type")?.split(";")[0].trim() ?? "";
    const isImage = type.startsWith("image/");
    const isVideo = type.startsWith("video/") || type === "application/octet-stream";
    if (!isImage && !isVideo) return new Response("Unsupported media type", { status: 415 });
    const len = Number(upstream.headers.get("content-length") ?? 0);
    if (len > (isImage ? MAX_IMAGE : MAX_VIDEO)) return new Response("File too large", { status: 413 });

    const headers = new Headers({
      "Content-Type": type || "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      // SVGs are rendered as images only; never allow them to run script if opened directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    });
    for (const h of ["content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    return new Response(e instanceof UrlError ? e.message : "Couldn't fetch asset", { status: 422 });
  }
}
