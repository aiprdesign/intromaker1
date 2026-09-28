import { parse, type HTMLElement } from "node-html-parser";
import type { SiteData } from "@/engine/types";
import { captureSite } from "./capture";
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

export async function scrapeSite(rawUrl: string, opts: { live?: boolean } = {}): Promise<SiteData> {
  const withScheme = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  // Prefer a live render in the user's browser (JS sites, lazy images, screenshots); else static fetch.
  const live = opts.live !== false ? await (async () => {
    const { assertPublicUrl } = await import("./netguard");
    await assertPublicUrl(withScheme);
    return captureSite(withScheme);
  })() : null;
  let html: string;
  let finalUrl: string;
  if (live) {
    html = live.html.slice(0, MAX_HTML);
    finalUrl = live.finalUrl;
  } else {
    const res = await safeFetch(withScheme, { headers: { Accept: "text/html,application/xhtml+xml" } });
    if (!res.ok) throw new UrlError(`The site responded with HTTP ${res.status}.`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) throw new UrlError("That URL isn't a web page.");
    html = (await res.text()).slice(0, MAX_HTML);
    finalUrl = res.url || withScheme;
  }
  const base = new URL(finalUrl);
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false } });
  const baseHref = root.querySelector("base")?.getAttribute("href");
  const pageBase = baseHref ? new URL(baseHref, base) : base;
  const host = pageBase.hostname;

  const name = siteName(root, host);
  const description = meta(root, "og:description", "description", "twitter:description") ?? "";
  const h1 = clean(root.querySelector("h1")?.text ?? "");
  const tagline = h1 && h1.split(" ").length <= 12 && h1.toLowerCase() !== name.toLowerCase() ? h1 : description.split(/(?<=[.!?])\s/)[0] ?? "";

  // Headlines: short, meaningful h1–h3 text (features / value props), each with the
  // paragraph that follows it as its description.
  const seen = new Set<string>([name.toLowerCase(), tagline.toLowerCase()]);
  const headlines: string[] = [];
  const features: string[] = [];
  for (const el of root.querySelectorAll("h1, h2, h3")) {
    const t = clean(el.text).replace(/[.!]+$/, "");
    const words = t.split(" ").length;
    if (!t || words < 2 || words > 9 || t.length > 60 || JUNK.test(t) || seen.has(t.toLowerCase())) continue;
    if (/cookie|javascript|browser|©|\?$/i.test(t)) continue;
    // Step titles and section labels aren't features.
    if (/^(step\s*)?\d+[.):\-–]\s|^how (it|\w+) works|^(features|testimonials|pricing|faq)$/i.test(t)) continue;
    seen.add(t.toLowerCase());
    headlines.push(t);
    let desc = "";
    for (let sib = el.nextElementSibling, n = 0; sib && n < 3; sib = sib.nextElementSibling, n++) {
      const txt = clean(sib.text);
      if (/^(p|div|span)$/i.test(sib.tagName) && txt.length >= 20 && txt.length <= 180) {
        desc = txt;
        break;
      }
    }
    features.push(desc);
    if (headlines.length >= 12) break;
  }

  // Stats: "10,000+ teams", "99.99% uptime", "$2B processed".
  // structuredText keeps block boundaries ("12,000+ teams" / "99.9% uptime" stay separate).
  const bodyText = clean((root.querySelector("body") ?? root).structuredText).slice(0, 200_000);
  const stats: string[] = [];
  const statRe =
    /(?<![\w.])([$€£]?\d[\d,.]*(?:\s?(?:million|billion|thousand)\b|[kKmMbB](?![a-z])|%|x\b)?\+?)\s*([A-Za-z][A-Za-z]+(?:\s[a-z][a-z]+)?)/g;
  let m: RegExpExecArray | null;
  // Claims about the company ("10,000+ teams") rank above figures that are just UI in a product
  // mockup ("▲ 12.4%" deltas, KPI tiles), which are never used as claims.
  const CLAIM = /team|customer|compan|user|business|developer|people|brand|merchant|countr|uptime|processed|event|download|review|integration|member|org|deploy|transaction|request/i;
  const candidates: { s: string; score: number; i: number }[] = [];
  while ((m = statRe.exec(bodyText)) && candidates.length < 16) {
    const num = m[1];
    if (/^(19|20)\d\d$/.test(num) || /^\d{1,2}$/.test(num) || num.replace(/\D/g, "").length > 12) continue;
    if (!/[+%kKmMbBx$€£,]|million|billion|thousand/.test(num)) continue;
    if (/[▲▼↑↓↗↘]\s*$|[+-]\s*$/.test(bodyText.slice(Math.max(0, m.index - 3), m.index))) continue;
    const s = `${num} ${m[2]}`.toUpperCase();
    if (candidates.some((c) => c.s === s)) continue;
    candidates.push({ s, score: (CLAIM.test(m[2]) ? 2 : 0) + (/\+|[kKmMbB]\b|million|billion/.test(num) ? 1 : 0), i: candidates.length });
  }
  stats.push(...candidates.sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 4).map((c) => c.s));

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

  // Real customer testimonials only (never invented).
  const ancestorMatches = (el: HTMLElement, re: RegExp, depth = 5) => {
    for (let n: HTMLElement | null = el, d = 0; n && d < depth; n = n.parentNode as HTMLElement | null, d++) {
      if (re.test(`${n.getAttribute?.("class") ?? ""} ${n.getAttribute?.("id") ?? ""} ${n.getAttribute?.("aria-label") ?? ""}`)) return true;
    }
    return false;
  };
  const testimonials: SiteData["testimonials"] = [];
  const quoteSeen = new Set<string>();
  const containers = [
    ...root.querySelectorAll("blockquote"),
    ...root.querySelectorAll("figure"),
    ...root.querySelectorAll("[class*=testimonial], [class*=Testimonial], [class*=quote], [class*=review]"),
  ];
  for (const el of containers) {
    if (testimonials.length >= 3) break;
    const qEl = el.tagName === "BLOCKQUOTE" ? el : (el.querySelector("blockquote, q, p") ?? el);
    // The attribution often sits inside the blockquote (<cite>, <footer>): keep it out of the quote.
    let qText = clean(qEl.text);
    for (const c of qEl.querySelectorAll("cite, footer, figcaption, [class*=author], [class*=name]")) {
      const ct = clean(c.text);
      if (ct && ct.length < qText.length) qText = clean(qText.replace(ct, ""));
    }
    const quote = qText.replace(/^["“”']+|["“”']+$/g, "");
    if (quote.length < 30 || quote.length > 280 || quoteSeen.has(quote)) continue;
    const scope = el.tagName === "BLOCKQUOTE" ? (el.parentNode as HTMLElement) ?? el : el;
    // Most specific selector first: a dedicated name element beats a whole caption.
    const nameEl = ["[class*=name]", "[class*=author]", "cite", "strong", "figcaption"]
      .map((sel) => scope.querySelector(sel))
      .find((n) => n && clean(n.text) && !clean(n.text).includes(quote.slice(0, 30)));
    const author = clean((nameEl?.structuredText ?? "").split("\n")[0]).split(/[,–—|·]/)[0].trim();
    if (!author || author.length > 60) continue;
    const roleEl = scope.querySelector("[class*=role], [class*=title], [class*=position], [class*=company], small");
    let role = clean(roleEl?.text ?? "");
    if (role === author || role.length > 80) role = "";
    if (!role && nameEl) role = clean(nameEl.text).split(/[,–—|·]/).slice(1).join(", ").trim();
    const avatarEl = scope.querySelector("img");
    const avatar = absolute(avatarEl?.getAttribute("src") ?? fromSrcset(avatarEl?.getAttribute("srcset")), pageBase);
    quoteSeen.add(quote);
    testimonials.push({ quote, author, role, avatar });
  }

  // Customer / partner logo walls.
  const clientLogos: string[] = [];
  for (const img of root.querySelectorAll("img")) {
    if (clientLogos.length >= 12) break;
    const u = absolute(img.getAttribute("src") ?? fromSrcset(img.getAttribute("srcset")), pageBase);
    if (!u || u === logo || clientLogos.includes(u)) continue;
    const hint = `${img.getAttribute("alt") ?? ""} ${img.getAttribute("class") ?? ""}`;
    if (ancestorMatches(img, /customer|client|trusted|partner|logo-?(wall|cloud|grid|strip|marquee)|brands|companies/i) || (/logo/i.test(hint) && !ancestorMatches(img, /header|nav/i, 6))) {
      clientLogos.push(u);
    }
  }

  // "How it works" steps: titles under a steps heading, or numbered sub-headings.
  const steps: string[] = [];
  const stepsHeading = root
    .querySelectorAll("h2, h3")
    .find((el) => /how (it|\w+) works|get started in|in \w+ (simple |easy )?steps|three steps|simple steps|how to get started/i.test(el.text));
  if (stepsHeading) {
    let scope: HTMLElement | null = stepsHeading.parentNode as HTMLElement;
    for (let i = 0; i < 3 && scope && scope.querySelectorAll("h3, h4").length < 2; i++) scope = scope.parentNode as HTMLElement;
    for (const el of scope?.querySelectorAll("h3, h4") ?? []) {
      const t = clean(el.text).replace(/^(step\s*)?\d+[.):\-–]?\s*/i, "");
      if (t && t !== clean(stepsHeading.text) && t.split(" ").length <= 7 && !steps.includes(t)) steps.push(t);
      if (steps.length >= 4) break;
    }
  }
  if (steps.length < 2) {
    steps.length = 0;
    for (const el of root.querySelectorAll("h3, h4")) {
      const m = clean(el.text).match(/^(?:step\s*)?(\d)[.):\-–]\s*(.{3,50})$/i);
      if (m && m[2].split(" ").length <= 7) steps.push(m[2]);
      if (steps.length >= 4) break;
    }
  }

  // Pain points the product removes.
  const pains: string[] = [];
  const painRe = /\b(?:no more|say goodbye to|stop|without|tired of|instead of|forget about|ditch|replace)\s+([a-z][a-z-]*(?:\s[a-z][a-z-]*){0,3})(?=[.,!;:]|\s(?:and|or|with|so|to)\s|$)/gi;
  let pm: RegExpExecArray | null;
  while ((pm = painRe.exec(bodyText)) && pains.length < 4) {
    const phrase = pm[1].trim();
    if (/^(the|a|an|your|you|it|this|that|any|all|using|having|worrying)$/i.test(phrase.split(" ")[0]) && phrase.split(" ").length === 1) continue;
    const nice = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    if (nice.length >= 5 && !pains.includes(nice)) pains.push(nice);
  }

  // Brand font: the first Google Fonts family the page loads.
  let font: string | null = null;
  for (const l of root.querySelectorAll('link[href*="fonts.googleapis.com"]')) {
    const fam = (l.getAttribute("href") ?? "").match(/family=([^:&;]+)/);
    if (fam) {
      const name = decodeURIComponent(fam[1]).replace(/\+/g, " ").trim();
      if (/^[A-Za-z0-9 ]{2,40}$/.test(name)) {
        font = name;
        break;
      }
    }
  }

  const themeColor = meta(root, "theme-color", "msapplication-TileColor");

  return {
    url: pageBase.toString(),
    domain: host.replace(/^www\./, ""),
    name,
    tagline,
    description,
    headlines,
    features,
    stats,
    testimonials,
    clientLogos,
    steps,
    pains,
    font,
    shots: { hero: live?.hero ?? null, full: live?.full ?? null, sections: live?.sections ?? [], parts: live?.parts ?? [] },
    cta,
    logo,
    images,
    videos,
    themeColor: themeColor && /^#[0-9a-f]{3,8}$/i.test(themeColor) ? themeColor : null,
  };
}
