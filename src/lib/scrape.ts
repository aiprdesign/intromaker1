import { parse, type HTMLElement } from "node-html-parser";
import type { SiteData } from "@/engine/types";
import { createHash } from "node:crypto";
import { captureSite, cleanSvg, save } from "./capture";
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

const isHomeHref = (href: string | undefined, base: URL) => {
  if (!href) return false;
  try {
    const u = new URL(href, base);
    return u.host === base.host && /^\/?(index\.html?)?$/.test(u.pathname) && !u.hash;
  } catch {
    return false;
  }
};

/**
 * The header logo from the page's HTML (when no live browser render is available), found the
 * way a person would: the home link or a logo-named image/SVG in the header, then the site's
 * structured-data logo, og:logo, and finally large app icons. Lazy-loaded (data-src),
 * <picture> sources and inline SVG logos are all understood. Returns an absolute URL, or a
 * saved SVG (/api/shot) for inline SVG logos.
 */
async function findLogo(root: HTMLElement, rawHtml: string, base: URL, siteName: string): Promise<string | null> {
  const hint = /logo|brand|wordmark|site-?title|navbar-brand|site-?name/i;
  const wall = /customer|client|trusted|partner|logo-?(wall|cloud|grid|strip|marquee|list)|brands|companies|testimonial|footer/i;
  const attrsOf = (el: HTMLElement | null) => (el ? `${el.getAttribute("class") ?? ""} ${el.getAttribute("id") ?? ""} ${el.getAttribute("aria-label") ?? ""}` : "");
  const context = (el: HTMLElement) => {
    let score = 0;
    let home = false;
    let header = false;
    for (let n: HTMLElement | null = el, d = 0; n && d < 8; n = n.parentNode as HTMLElement | null, d++) {
      const tag = n.tagName?.toLowerCase();
      if (tag === "a" && isHomeHref(n.getAttribute("href"), base)) home = true;
      if (tag === "header" || tag === "nav" || n.getAttribute?.("role") === "banner") header = true;
      if (d > 0 && wall.test(attrsOf(n))) return -99;
      if (d <= 2 && hint.test(attrsOf(n))) score += 3;
    }
    return score + (home ? 4 : 0) + (header ? 3 : 0);
  };
  type Cand = { score: number; src?: string; svg?: HTMLElement };
  const cands: Cand[] = [];
  const name = siteName.toLowerCase();
  for (const img of root.querySelectorAll("img")) {
    const src =
      img.getAttribute("src") && !img.getAttribute("src")!.startsWith("data:")
        ? img.getAttribute("src")
        : img.getAttribute("data-src") ?? img.getAttribute("data-lazy-src") ?? fromSrcset(img.getAttribute("srcset") ?? img.getAttribute("data-srcset"));
    const picture = img.parentNode && (img.parentNode as HTMLElement).tagName?.toLowerCase() === "picture" ? (img.parentNode as HTMLElement) : null;
    const pictureSrc = picture ? fromSrcset(picture.querySelector("source")?.getAttribute("srcset")) : null;
    // Best file for the logo: an SVG when one is offered, else the largest srcset entry.
    const sources = picture?.querySelectorAll("source") ?? [];
    const svgSource = sources.map((s) => fromSrcset(s.getAttribute("srcset"))).find((u, i) => u && (/svg/i.test(sources[i].getAttribute("type") ?? "") || /\.svg(\?|#|$)/i.test(u)));
    const largest = fromSrcset(img.getAttribute("srcset") ?? img.getAttribute("data-srcset"));
    const vectorSrc = src && /\.svg(\?|#|$)/i.test(src) ? src : null;
    const url = absolute(svgSource ?? vectorSrc ?? largest ?? src ?? pictureSrc, base);
    if (!url || (Number(img.getAttribute("width")) > 0 && Number(img.getAttribute("width")) <= 2)) continue;
    const alt = (img.getAttribute("alt") ?? "").toLowerCase();
    let score = context(img);
    if (hint.test(`${attrsOf(img)} ${img.getAttribute("alt") ?? ""} ${img.getAttribute("src") ?? ""}`)) score += 3;
    if (name && alt && (alt === name || alt.startsWith(`${name} `) || alt.includes(`${name} logo`))) score += 2;
    // Vector logos stay sharp at any size; GIFs have hard 1-bit edges.
    if (/\.svg(\?|#|$)/i.test(url)) score += 1;
    else if (/\.gif(\?|#|$)/i.test(url)) score -= 1;
    cands.push({ score, src: url });
  }
  for (const svg of root.querySelectorAll("svg")) {
    if ((svg.parentNode as HTMLElement | null)?.closest?.("svg")) continue;
    let score = context(svg) + (hint.test(attrsOf(svg)) ? 3 : 0);
    if (svg.querySelector("title") && name && svg.querySelector("title")!.text.toLowerCase().includes(name)) score += 2;
    if (svg.toString().length < 80) score = -99;
    cands.push({ score, svg });
  }
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0];
  if (best && best.score >= 5) {
    if (best.src) return best.src;
    if (best.svg) {
      let markup = cleanSvg(best.svg.toString());
      // currentColor inherits from the page; outside it that would render black. Use the nearest
      // inline colour when the HTML states one.
      if (/currentColor/i.test(markup)) {
        let color: string | null = null;
        for (let n: HTMLElement | null = best.svg, d = 0; n && d < 6 && !color; n = n.parentNode as HTMLElement | null, d++) {
          color = (n.getAttribute?.("style") ?? "").match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1]?.trim() ?? null;
        }
        if (color && /^[#a-z0-9(),.\s%-]+$/i.test(color)) markup = markup.replace(/currentColor/gi, color);
      }
      if (!/xmlns=/.test(markup)) markup = markup.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
      if (markup.length < 400_000) {
        const key = createHash("sha1").update(base.toString() + Date.now()).digest("hex").slice(0, 16);
        return save(`${key}-logo`, markup, "svg");
      }
    }
  }
  // Structured data (schema.org Organization) and og:logo.
  const ld = rawHtml.match(/"logo"\s*:\s*(?:"([^"]+)"|\{[^}]*?"url"\s*:\s*"([^"]+)")/);
  const fromLd = absolute(ld?.[1] ?? ld?.[2], base);
  if (fromLd) return fromLd;
  const og = absolute(meta(root, "og:logo") ?? root.querySelector('[itemprop="logo"]')?.getAttribute("content") ?? root.querySelector('img[itemprop="logo"]')?.getAttribute("src"), base);
  if (og) return og;
  // App icons, only when large enough to read as a logo (a 16px favicon isn't one).
  return appIcon(root, base);
}

/**
 * The site's app icon: an SVG icon, else the largest apple-touch / declared icon (64px or more).
 * A square mark, used in place of a wide wordmark where the wordmark would read too small.
 */
export function appIcon(root: HTMLElement, base: URL): string | null {
  const icons = root
    .querySelectorAll('link[rel~="apple-touch-icon"], link[rel~="icon"], link[rel="shortcut icon"], link[rel="mask-icon"]')
    .map((l) => {
      const href = l.getAttribute("href") ?? "";
      const rel = l.getAttribute("rel") ?? "";
      // Safari pinned-tab icons are one-colour silhouettes: a last resort.
      const size = rel === "mask-icon" ? 64 : /\.svg(\?|$)/i.test(href) ? 512 : /apple-touch/.test(rel) ? 180 : parseInt(l.getAttribute("sizes")?.split("x")[0] ?? "0", 10) || 16;
      return { href: absolute(href, base), size };
    })
    .filter((i) => i.href && i.size >= 64)
    .sort((a, b) => b.size - a.size);
  return icons[0]?.href ?? null;
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

/** The visitor-facing reason an HTTP status stops the import. */
export function httpProblem(status: number, url: URL): UrlError {
  const host = url.hostname;
  const home = `${url.protocol}//${url.host}/`;
  const notHome = url.pathname !== "/" || !!url.search;
  if (status === 404 || status === 410)
    return new UrlError(
      notHome ? `That page doesn't exist on ${host} (error ${status}). Check the address, or import the home page.` : `${host} answers "page not found" (error ${status}). Check the address.`,
      "notfound",
      notHome ? home : undefined,
    );
  if (status === 401 || status === 403 || status === 451)
    return new UrlError(`${host} doesn't let automated visitors in (error ${status}), so it can't be imported. Describe your product in the prompt instead.`, "blocked");
  if (status === 429) return new UrlError(`${host} is limiting visits right now (error 429). Try again in a minute.`, "busy");
  if (status >= 500) return new UrlError(`${host} is having trouble right now (error ${status}). Try again in a few minutes.`, "server");
  return new UrlError(`${host} answered with error ${status}, so there was nothing to import.`, "server");
}

/** The visitor-facing reason a connection failed (DNS, refused, timeout, certificate…). */
export function networkProblem(e: unknown, url: URL): UrlError {
  if (e instanceof UrlError) return e;
  const err = e as Error & { cause?: Error & { code?: string } };
  if (err?.cause instanceof UrlError) return err.cause;
  const code = err?.cause?.code ?? (err as { code?: string })?.code ?? "";
  const host = url.hostname;
  if (err?.name === "TimeoutError" || err?.name === "AbortError" || /TIMEOUT|ETIMEDOUT/.test(code))
    return new UrlError(`${host} took too long to respond. It may be down or very slow; try again in a few minutes.`, "timeout");
  if (/ENOTFOUND|EAI_AGAIN/.test(code)) return new UrlError(`We couldn't find ${host}. Check the spelling of the address.`, "dns");
  if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|UND_ERR_SOCKET|EPIPE/.test(code))
    return new UrlError(`${host} isn't accepting connections. The site may be down; try again later.`, "refused");
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code)) return new UrlError(`${host} has an invalid security certificate, so it wasn't opened.`, "tls");
  return new UrlError(`Couldn't open ${host}. Check the address, or try again later.`, "refused");
}

/** A 200 page that is really an error, a parked domain or a server default page. */
const PARKED =
  /\b(this domain (is|may be) for sale|buy this domain|domain (is )?parked|parked (free|domain)|domain parking|this site can.t be reached|account (has been )?suspended|website (is )?(currently )?unavailable|default web ?page|welcome to nginx|apache2? (ubuntu |debian )?default page|it works!|index of \/|hosting (account|provider) default)\b/i;
const SOFT_404 = /^(404|page not found|not found|error 404|oops[,!]? (that )?page)/i;

function checkContent(root: HTMLElement, bodyText: string, url: URL) {
  const title = clean(root.querySelector("title")?.text ?? "");
  const h1 = clean(root.querySelector("h1")?.text ?? "");
  if (SOFT_404.test(title) || SOFT_404.test(h1)) throw httpProblem(404, url);
  if (PARKED.test(`${title} ${h1} ${bodyText.slice(0, 3000)}`))
    throw new UrlError(`${url.hostname} looks like a parked domain or a placeholder page, with no product to show. Import the product's real site, or describe it in the prompt.`, "parked");
  if (bodyText.length < 40 && !title && !h1)
    throw new UrlError(`${url.hostname} has almost no text to read (it may need a browser feature that couldn't run). Describe your product in the prompt instead.`, "empty");
}

/**
 * Addresses to try, most likely first: what was typed (https added), then — only when no scheme
 * was typed — plain http, and the www. host when the bare domain doesn't resolve.
 */
function candidates(raw: string): string[] {
  const typed = raw.trim();
  const hasScheme = /^https?:\/\//i.test(typed);
  const first = hasScheme ? typed : `https://${typed}`;
  const out = [first];
  try {
    const u = new URL(first);
    if (!hasScheme) out.push(first.replace(/^https:/i, "http:"));
    if (!/^www\./i.test(u.hostname) && u.hostname.split(".").length === 2) {
      const w = new URL(first);
      w.hostname = `www.${u.hostname}`;
      out.push(w.toString());
    }
  } catch {
    /* invalid: assertPublicUrl explains */
  }
  return out;
}

/** Fetch the page statically, trying the fallbacks above. Throws the most useful problem. */
async function fetchPage(raw: string): Promise<{ html: string; finalUrl: string }> {
  let problem: UrlError | null = null;
  for (const candidate of candidates(raw)) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new UrlError("That doesn't look like a valid web address.", "invalid");
    }
    // The www. retry only helps when the bare domain didn't resolve; http only when https failed to connect.
    if (problem && url.hostname.startsWith("www.") && problem.code !== "dns") continue;
    if (problem && url.protocol === "http:" && !["refused", "tls", "timeout"].includes(problem.code)) continue;
    try {
      const res = await safeFetch(candidate, { headers: { Accept: "text/html,application/xhtml+xml" } });
      const at = new URL(res.url || candidate);
      if (!res.ok) throw httpProblem(res.status, at);
      const type = res.headers.get("content-type") ?? "";
      if (type && !type.includes("html")) throw new UrlError("That address is a file, not a web page. Enter the site's address instead.", "notpage");
      return { html: (await res.text()).slice(0, MAX_HTML), finalUrl: res.url || candidate };
    } catch (e) {
      const p = networkProblem(e, url);
      // An answer from the site (404, 5xx, blocked…) is final; connection problems try the next address.
      if (!["dns", "refused", "tls", "timeout"].includes(p.code)) throw p;
      // Keep the first problem (about what was typed) unless a later one is more specific.
      problem = !problem || (problem.code === "dns" && p.code !== "dns") ? p : problem;
    }
  }
  throw problem ?? new UrlError("Couldn't open that website.", "refused");
}

export async function scrapeSite(rawUrl: string, opts: { live?: boolean } = {}): Promise<SiteData> {
  const withScheme = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  // Prefer a live render in a real browser (JS sites, lazy images, screenshots); else static fetch.
  // The live capture gives up (null) on error pages, so the static fetch then explains what's wrong.
  const live =
    opts.live !== false
      ? await (async () => {
          const { assertPublicUrl } = await import("./netguard");
          try {
            await assertPublicUrl(withScheme);
          } catch (e) {
            // A bare domain that doesn't resolve may still work as www.; fetchPage tries that.
            if (e instanceof UrlError && e.code === "dns" && !/^https?:\/\//i.test(rawUrl.trim())) return null;
            throw e;
          }
          return captureSite(withScheme);
        })()
      : null;
  let html: string;
  let finalUrl: string;
  if (live) {
    html = live.html.slice(0, MAX_HTML);
    finalUrl = live.finalUrl;
  } else {
    ({ html, finalUrl } = await fetchPage(rawUrl));
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
  checkContent(root, bodyText, base);
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

  // Logo: the live capture's header mark when there is one; else read it from the HTML.
  const logo: string | null = live?.logo ?? (await findLogo(root, html, pageBase, name));

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
    icon: appIcon(root, pageBase),
    images,
    videos,
    themeColor: themeColor && /^#[0-9a-f]{3,8}$/i.test(themeColor) ? themeColor : null,
  };
}
