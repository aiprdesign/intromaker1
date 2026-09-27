import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dev mode blocks its scripts on non-localhost origins, which leaves the page visible but
  // unresponsive. Allow opening the dev server via this machine's LAN / WSL addresses too.
  allowedDevOrigins: ["172.18.144.1", "127.0.0.1", "*.local"],
  // Live website capture drives the user's installed browser; keep it out of the bundle.
  serverExternalPackages: ["playwright-core"],
};

export default nextConfig;
