import { headers } from "next/headers";

/**
 * The site's public address, for the sitemap, robots.txt and canonical links. INTROMAKER_SITE_URL
 * when set (e.g. https://prodintro.com), else the address the request came in on.
 */
export const SITE_URL_ENV = (process.env.INTROMAKER_SITE_URL ?? "").trim().replace(/\/+$/, "");

export async function siteUrl(): Promise<string> {
  if (SITE_URL_ENV) return SITE_URL_ENV;
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/** The public pages, for the sitemap. */
export const PUBLIC_PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/saas-video-maker", priority: 0.9 },
  { path: "/skills", priority: 0.8 },
  { path: "/characters", priority: 0.7 },
  { path: "/studio", priority: 0.7 },
  { path: "/privacy", priority: 0.3 },
  { path: "/license", priority: 0.2 },
  { path: "/licenses", priority: 0.2 },
];
