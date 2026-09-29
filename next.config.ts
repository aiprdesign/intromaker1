import type { NextConfig } from "next";

/** Sent with every page and API response. (Framing is refused with X-Frame-Options, not a CSP,
 * so /api/shot keeps its own sandboxing Content-Security-Policy.) */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Docker image runs Next's minimal standalone server (INTROMAKER_STANDALONE=1 at build).
  ...(process.env.INTROMAKER_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
  // Dev mode blocks its scripts on non-localhost origins, which leaves the page visible but
  // unresponsive. Allow opening the dev server via this machine's LAN / WSL addresses too.
  allowedDevOrigins: ["172.18.144.1", "127.0.0.1", "*.local"],
  // Live website capture drives a headless browser; keep it out of the bundle.
  serverExternalPackages: ["playwright-core"],
  // No next/image optimisation: frames are drawn on canvas. So Next's optional sharp / libvips
  // (LGPL-3.0) is never loaded, and the Dockerfile deletes it from the standalone build.
  images: { unoptimized: true },
  // Captures are read from a runtime folder (INTROMAKER_DATA_DIR), which the file tracer can't see
  // statically; keep the project's own files out of the standalone build.
  outputFileTracingExcludes: {
    "/*": ["./scripts/**", "./demo/**", "./src/**", "./*.md", "./Dockerfile", "./render.yaml", "./.next/cache/**", "./tsconfig*"],
  },
  headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
