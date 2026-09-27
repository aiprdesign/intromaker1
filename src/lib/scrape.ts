import { parse, type HTMLElement } from "node-html-parser";
import type { SiteData } from "@/engine/types";
import { safeFetch, UrlError } from "./netguard";

const MAX_HTML = 3_000_000;

const JUNK = /^(log ?in|sign ?in|sign ?up|menu|pricing|blog|docs|careers|contact( us)?|about( us)?|home|search|cookies?|privacy|terms|skip to content|close|open menu|toggle|language|english|resources|company|product|solutions|customers|changelog|support|help|faq|download|©.*)$/i;
const CTA = /\b(get started|start (for )?free|start (your )?(free )?trial|try( it)?( for)? free|try now|sign up( free)?|book a demo|request (a )?demo|get a demo|join( now| free)?|download( now)?|get (it|the app)|start building|create (a )?free account|get early access|join the waitlist)\b/i;

function clean(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[​ ]/g, " ")
    .trim();
}

function absolute(src: string | undefined | null, base: URL) {
  if (!src) return null;
  const s = src.trim();
  if (!s || s.startsWith("data:") || s.startsWith("blob:") || s.startsWith("javascript:")) return null;
  try {
    const u = new URL(s, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Pick the widest candidate from a srcset attribute. */
function fromSrcset(srcset: string | undefined) {
  if (!srcset) return null;
  let best: { url: string; w: number } | null = null;
  for (const part of srcset.split(",")) {
    const [url, size] = part.trim().split(/\s+/);
    const w = size ? parseFloat(size) * (size.endsWith("x") ? 1000 : 1) : 1;
    if (url && (!best || w > best.w)) best = { url, w };
  }
  return best?.url ?? null;
}

function meta(root: HTMLElement, ...keys: string[]) {
  for (const k of keys) {
    const el = root.querySelector(`meta[property="${k}"]`) ?? root.querySelector(`meta[name="${k}"]`);
    const v = el?.getAttribute("content");
    if (v && v.trim()) return clean(v);
  }
  return null;
}

function nameFromDomain(host: string) {
  const root = host.replace(/^www\./, "").split(".")[0];
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function siteName(root: HTMLElement, host: string) {
  const explicit = meta(root, "og:site_name", "application-name", "apple-mobile-web-app-title");
  if (explicit && explicit.split(" ").length <= 4) return explicit;
  const title = clean(root.querySelector("title")?.text ?? "") || meta(root, "og:title") || "";
  const parts = title.split(/\s[|\-–—:·•]\s/).map((p) => p.trim()).filter(Boolean);
  const domainRoot = host.replace(/^www\./, "").split(".")[0].toLowerCase();
  // Prefer the title segment that matches the domain ("Linear – Plan and build" on linear.app).
  const match = parts.find((p) => p.toLowerCase().replace(/\s+/g, "").includes(domainRoot));
  if (match && match.split(" ").length <= 4) return match;
  const short = parts.find((p) => p.split(" ").length <= 3);
  return short ?? nameFromDomain(host);
}

export async function scrapeSite(rawUrl: string): Promise<SiteData> {
  const withScheme = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  const res = await safeFetch(withScheme, { headers: { Accept: "text/html,application/xhtml+xml" } });
  if (!res.ok) throw new UrlError(`The site responded with HTTP ${res.status}.`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html")) throw new UrlError("That URL isn't a web page.");
  const html = (await res.text()).slice(0, MAX_HTML);
  const base = new URL(res.url || withScheme);
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false } });
  const baseHref = root.querySelector("base")?.getAttribute("href");
  const pageBase = baseHref ? new URL(baseHref, base) : base;
  const host = pageBase.hostname;

  const name = siteName(root, host);
  const description = meta(root, "og:description", "description", "twitter:description") ?? "";
  const h1 = clean(root.querySelector("h1")?.text ?? "");
  const tagline = h1 && h1.split(" ").length <= 12 && h1.toLowerCase() !== name.toLowerCase() ? h1 : description.split(/(?<=[.!?])\s/)[0] ?? "";

  // Headlines: short, meaningful h1–h3 text (features / value props).
  const seen = new Set<string>([name.toLowerCase(), tagline.toLowerCase()]);
  const headlines: string[] = [];
  for (const el of root.querySelectorAll("h1, h2, h3")) {
    const t = clean(el.text).replace(/[.!]+$/, "");
    const words = t.split(" ").length;
    if (!t || words < 2 || words > 9 || t.length > 60 || JUNK.test(t) || seen.has(t.toLowerCase())) continue;
    if (/cookie|javascript|browser|©|\?$/i.test(t)) continue;
    seen.add(t.toLowerCase());
    headlines.push(t);
    if (headlines.length >= 12) break;
  }

  // Stats: "10,000+ teams", "99.99% uptime", "$2B processed".
  // structuredText keeps block boundaries ("12,000+ teams" / "99.9% uptime" stay separate).
  const bodyText = clean((root.querySelector("body") ?? root).structuredText).slice(0, 200_000);
  const stats: string[] = [];
  const statRe =
    /(?<![\w.])([$€£]?\d[\d,.]*(?:\s?(?:million|billion|thousand)\b|[kKmMbB]\b|%|x\b)?\+?)\s+([A-Za-z][A-Za-z]+(?:\s[a-z][a-z]+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = statRe.exec(bodyText)) && stats.length < 4) {
    const num = m[1];
    if (/^(19|20)\d\d$/.test(num) || /^\d{1,2}$/.test(num) || num.replace(/\D/g, "").length > 12) continue;
    if (!/[+%kKmMbBx$€£,]|million|billion|thousand/.test(num)) continue;
    const s = `${num} ${m[2]}`.toUpperCase();
    if (!stats.includes(s)) stats.push(s);
  }

  // Call to action.
  let cta: string | null = null;
  for (const el of root.querySelectorAll("a, button")) {
    const t = clean(el.text);
    if (t && t.split(" ").length <= 5 && CTA.test(t)) {
      cta = t.replace(/[→›»>]+$/, "").trim();
      break;
    }
  }

  // Logo: explicit <img> logos first, then high-res icons.
  let logo: string | null = null;
  for (const img of root.querySelectorAll("header img, nav img, a img, img")) {
    const attrs = `${img.getAttribute("class") ?? ""} ${img.getAttribute("id") ?? ""} ${img.getAttribute("alt") ?? ""} ${img.getAttribute("src") ?? ""}`;
    if (/logo/i.test(attrs)) {
      logo = absolute(img.getAttribute("src") ?? fromSrcset(img.getAttribute("srcset")), pageBase);
      if (logo) break;
    }
  }
  if (!logo) {
    const icons = root
      .querySelectorAll('link[rel~="apple-touch-icon"], link[rel~="icon"], link[rel="shortcut icon"]')
      .map((l) => ({
        href: absolute(l.getAttribute("href"), pageBase),
        size: parseInt(l.getAttribute("sizes")?.split("x")[0] ?? "0", 10) || (l.getAttribute("href")?.endsWith(".svg") ? 512 : 16),
      }))
      .filter((i) => i.href)
      .sort((a, b) => b.size - a.size);
    logo = icons[0]?.href ?? meta(root, "og:logo");
  }

  // Images: social cards first, then large content images.
  const images: string[] = [];
  const addImg = (u: string | null) => {
    if (u && !images.includes(u) && u !== logo && images.length < 14) images.push(u);
  };
  addImg(absolute(meta(root, "og:image", "og:image:url", "og:image:secure_url"), pageBase));
  addImg(absolute(meta(root, "twitter:image", "twitter:image:src"), pageBase));
  for (const el of root.querySelectorAll("img, picture source")) {
    const src =
      fromSrcset(el.getAttribute("srcset") ?? el.getAttribute("data-srcset")) ??
      el.getAttribute("src") ??
      el.getAttribute("data-src") ??
      el.getAttribute("data-lazy-src");
    const u = absolute(src, pageBase);
    if (!u) continue;
    const w = parseInt(el.getAttribute("width") ?? "0", 10);
    const h = parseInt(el.getAttribute("height") ?? "0", 10);
    if ((w && w < 240) || (h && h < 160)) continue;
    const hint = `${u} ${el.getAttribute("alt") ?? ""} ${el.getAttribute("class") ?? ""}`;
    if (/logo|icon|avatar|sprite|pixel|badge|flag|emoji|favicon|spinner|loader|tracking|\.svg(\?|$)|\.gif(\?|$)/i.test(hint)) continue;
    addImg(u);
  }

  // Videos: hero/product videos.
  const videos: string[] = [];
  const addVid = (u: string | null) => {
    if (u && /\.(mp4|webm|mov)(\?|$)/i.test(u) && !videos.includes(u) && videos.length < 4) videos.push(u);
  };
  for (const v of root.querySelectorAll("video")) {
    addVid(absolute(v.getAttribute("src") ?? v.getAttribute("data-src"), pageBase));
    for (const s of v.querySelectorAll("source")) addVid(absolute(s.getAttribute("src") ?? s.getAttribute("data-src"), pageBase));
  }
  addVid(absolute(meta(root, "og:video", "og:video:url", "og:video:secure_url"), pageBase));

  const themeColor = meta(root, "theme-color", "msapplication-TileColor");

  return {
    url: pageBase.toString(),
    domain: host.replace(/^www\./, ""),
    name,
    tagline,
    description,
    headlines,
    stats,
    cta,
    logo,
    images,
    videos,
    themeColor: themeColor && /^#[0-9a-f]{3,8}$/i.test(themeColor) ? themeColor : null,
  };
}
