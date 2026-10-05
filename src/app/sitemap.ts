import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await siteUrl();
  return PUBLIC_PAGES.map((p) => ({ url: `${base}${p.path}`, changeFrequency: "weekly", priority: p.priority }));
}
