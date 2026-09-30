import { createHash } from "node:crypto";
import type { Browser, Page } from "playwright-core";
import type { SitePart } from "@/engine/types";
import { assertPublicUrl } from "./netguard";
import { saveShot } from "./storage";

/**
 * Live website capture with the user's own installed Chrome/Edge (no browser download):
 * renders JavaScript sites, dismisses cookie banners, triggers lazy loading, then grabs a
 * hero screenshot, a full-page screenshot, per-section screenshots, the page's UI components cut
 * out one by one (so the film can animate them individually) and the rendered HTML.
 * Falls back gracefully (returns null) when no browser is available.
 */

export { SHOT_DIR } from "./storage";

export interface Capture {
  html: string;
  finalUrl: string;
  hero: string | null;
  full: string | null;
  sections: string[];
  parts: SitePart[];
  /** The header logo: an image URL from the page, or a saved SVG/PNG (/api/shot URL). */
  logo: string | null;
}

async function launch(): Promise<Browser | null> {
  const { chromium } = await import("playwright-core");
  const attempts: Parameters<typeof chromium.launch>[0][] = [];
  if (process.env.INTROMAKER_BROWSER) attempts.push({ executablePath: process.env.INTROMAKER_BROWSER });
  // Your installed Chrome or Edge locally; in the Docker image, the Chromium Playwright installed.
  attempts.push({ channel: "chrome" }, { channel: "msedge" }, { channel: "chromium" }, {});
  for (const opts of attempts) {
    try {
      return await chromium.launch({ ...opts, headless: true, timeout: 15_000 });
    } catch {
      /* try the next browser */
    }
  }
  return null;
}

const hostVerdict = new Map<string, Promise<boolean>>();
function hostAllowed(url: string) {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return Promise.resolve(false);
  }
  if (!hostVerdict.has(host)) {
    hostVerdict.set(
      host,
      assertPublicUrl(url)
        .then(() => true)
        .catch(() => false),
    );
  }
  return hostVerdict.get(host)!;
}

export async function save(id: string, data: Buffer | string, ext: "jpg" | "png" | "svg" = "jpg") {
  return saveShot(id, data, ext);
}

/** Remove script/handlers from site SVG markup before we store and serve it. */
export function cleanSvg(svg: string) {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, "")
    .replace(/(href|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "");
}

/**
 * Find the page's real UI components (product shots, app panels, feature cards, buttons) by
 * their rendered styling, and screenshot each on its own with its page-pixel box.
 */
async function captureParts(page: Page, key: string, maxY: number): Promise<SitePart[]> {
  const found = await page
    .evaluate((limitY) => {
      const transparent = (c: string) => !c || c === "transparent" || /rgba\(.*,\s*0\)$/.test(c);
      const bgOf = (el: Element | null) => {
        let p = el;
        while (p && transparent(getComputedStyle(p).backgroundColor)) p = p.parentElement;
        return p ? getComputedStyle(p).backgroundColor : "rgb(255, 255, 255)";
      };
      type Found = { x: number; y: number; w: number; h: number; r: number; kind: "media" | "panel" | "card" | "button"; text: string };
      const out: Found[] = [];
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const b = el.getBoundingClientRect();
        const x = b.left + window.scrollX;
        const y = b.top + window.scrollY;
        const w = b.width;
        const h = b.height;
        if (w < 40 || h < 24 || y < 0 || y + h > limitY || x < -2 || x + w > window.innerWidth + 2) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.6) continue;
        const tag = el.tagName.toLowerCase();
        const r = parseFloat(cs.borderTopLeftRadius) || 0;
        const text = ((el as HTMLElement).innerText || el.getAttribute("alt") || "").trim().replace(/\s+/g, " ");
        const own = cs.backgroundColor;
        const distinct = !transparent(own) && own !== bgOf(el.parentElement);
        const border = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none" && !transparent(cs.borderTopColor);
        const framed = cs.boxShadow !== "none" || border || distinct || cs.backgroundImage.includes("gradient");
        let kind: Found["kind"] | null = null;
        if (["img", "video", "canvas", "picture"].includes(tag) && w >= 320 && h >= 180) kind = "media";
        else if ((tag === "a" || tag === "button" || el.getAttribute("role") === "button") && !transparent(own) && text.length >= 2 && text.length <= 28 && w <= 380 && h >= 28 && h <= 96) kind = "button";
        else if (framed && r >= 4 && w >= 140 && w <= 900 && h >= 70 && h <= 700 && text.length > 0 && text.length < 400) kind = "card";
        else if (framed && r >= 6 && w > 900 && h >= 280 && h <= 1100) kind = "panel";
        if (kind) out.push({ x, y, w, h, r, kind, text: text.slice(0, 90) });
      }
      // Keep the outermost of nested same-kind boxes (a card, not the card's inner wrapper).
      const inside = (a: Found, b: Found) => a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.w <= b.x + b.w + 1 && a.y + a.h <= b.y + b.h + 1;
      const keep = out.filter((a, i) => !out.some((b, j) => j !== i && b.kind === a.kind && inside(a, b) && (b.w * b.h > a.w * a.h || j < i)));
      const pick = (kind: Found["kind"], n: number) => keep.filter((p) => p.kind === kind).sort((a, b) => a.y - b.y || a.x - b.x).slice(0, n);
      return [...pick("panel", 2), ...pick("media", 4), ...pick("card", 9), ...pick("button", 2)];
    }, maxY)
    .catch(() => [] as { x: number; y: number; w: number; h: number; r: number; kind: SitePart["kind"]; text: string }[]);
  const parts: SitePart[] = [];
  for (const [i, p] of found.slice(0, 16).entries()) {
    const shot = await page
      .screenshot({ type: "jpeg", quality: 90, scale: "device", fullPage: true, clip: { x: Math.max(0, p.x), y: p.y, width: p.w, height: p.h } })
      .catch(() => null);
    if (shot) parts.push({ ...p, src: await save(`${key}-p${i}`, shot) });
  }
  return parts;
}

/**
 * The brand mark from the site header, found the way a person would: the home link or a
 * logo-named element near the top-left of the page. Then it's taken in the best form available:
 * the original image file (PNG, JPG, WebP, SVG…), an inline SVG serialised with its computed
 * colours, or, for text/CSS logos (icon + name), a 2× screenshot with the background removed.
 */
/** The SVG version of a raster logo, when the site serves one beside it. */
async function svgTwin(page: Page, src: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  if (!/\.(png|jpe?g|gif|webp|avif)$/i.test(url.pathname)) return null;
  url.pathname = url.pathname.replace(/\.(png|jpe?g|gif|webp|avif)$/i, ".svg");
  url.search = "";
  if (!(await hostAllowed(url.href))) return null;
  const res = await page.request.get(url.href, { timeout: 5000, maxRedirects: 0 }).catch(() => null);
  if (!res || !res.ok()) return null;
  const body = (await res.text().catch(() => "")).trim();
  if (!/svg/i.test(res.headers()["content-type"] ?? "") || !/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(body) || body.length > 400_000) return null;
  return cleanSvg(body);
}

async function captureLogo(page: Page, key: string): Promise<string | null> {
  await page.evaluate(() => window.scrollTo(0, 0));
  const found = await page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width >= 12 && r.height >= 10 && cs.visibility !== "hidden" && cs.display !== "none" && parseFloat(cs.opacity) > 0.1 ? r : null;
    };
    const isHome = (a: Element) => {
      const href = a.getAttribute("href") ?? "";
      try {
        const u = new URL(href, location.href);
        return u.host === location.host && /^\/?(index\.html?)?$/.test(u.pathname) && !u.hash;
      } catch {
        return false;
      }
    };
    const hinted = (el: Element | null) =>
      !!el && /logo|brand|wordmark|site-?title|navbar-brand|site-?name/i.test(`${el.id} ${el.getAttribute("class") ?? ""} ${el.getAttribute("alt") ?? ""} ${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("src") ?? ""} ${el.getAttribute("title") ?? ""}`);
    type Cand = { el: Element; score: number };
    const cands: Cand[] = [];
    const consider = (el: Element, base: number) => {
      const r = visible(el);
      if (!r || r.top < -4 || r.top > 200 || r.width > 480 || r.height > 160) return;
      if (el.closest("button") && !el.closest("a")) return; // menu / theme toggles
      let score = base;
      if (el.closest("header, nav, [role=banner]")) score += 3;
      if (hinted(el) || hinted(el.parentElement)) score += 3;
      const a = el.closest("a");
      if (a && isHome(a)) score += 4;
      if (r.left < window.innerWidth * 0.35) score += 2;
      else if (Math.abs(r.left + r.width / 2 - window.innerWidth / 2) < 120) score += 1;
      cands.push({ el, score: score - r.top / 120 });
    };
    for (const el of Array.from(document.querySelectorAll("a, img, svg, picture, [class*=logo], [id*=logo], [class*=brand]"))) {
      const tag = el.tagName.toLowerCase();
      if (tag === "a") {
        if (isHome(el)) consider(el, 1);
      } else if (tag === "svg") {
        if (el.parentElement?.closest("svg")) continue;
        consider(el, 1);
      } else consider(el, tag === "img" || tag === "picture" ? 1 : 0);
    }
    cands.sort((a, b) => b.score - a.score);
    const best = cands[0];
    if (!best || best.score < 5) return null;
    let el = best.el;
    const text = (e: Element) => ((e as HTMLElement).innerText ?? "").trim();
    // A container holding just one image or one SVG: use the graphic itself (text drawn inside
    // an SVG wordmark is part of the graphic, not a separate text logo).
    if (!["img", "svg"].includes(el.tagName.toLowerCase())) {
      const imgs = el.querySelectorAll("img");
      const svgs = Array.from(el.querySelectorAll("svg")).filter((s) => !s.parentElement?.closest("svg"));
      const svgText = svgs.map((s) => (s.textContent ?? "").trim()).join("");
      const ownText = text(el).replace(/\s+/g, "").replace(svgText.replace(/\s+/g, ""), "");
      if (ownText.length <= 1 && imgs.length + svgs.length === 1) el = imgs[0] ?? svgs[0];
    }
    const r = el.getBoundingClientRect();
    const box = { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
    if (el.tagName.toLowerCase() === "img") {
      const img = el as HTMLImageElement;
      // Every file the page offers for this logo: <picture> sources and srcset entries. An SVG
      // among them wins; otherwise the largest raster.
      const offered: { url: string; w: number }[] = [];
      const addSet = (set: string | null, type?: string | null) => {
        for (const part of (set ?? "").split(",")) {
          const [u, size] = part.trim().split(/\s+/);
          if (!u) continue;
          try {
            const url = new URL(u, location.href).href;
            const w = /svg/i.test(type ?? "") || /\.svg(\?|#|$)/i.test(url) ? Infinity : size ? parseFloat(size) * (size.endsWith("x") ? img.getBoundingClientRect().width : 1) : img.naturalWidth;
            offered.push({ url, w });
          } catch {
            /* bad URL */
          }
        }
      };
      if (img.parentElement?.tagName.toLowerCase() === "picture") for (const s of Array.from(img.parentElement.querySelectorAll("source"))) addSet(s.getAttribute("srcset"), s.getAttribute("type"));
      addSet(img.getAttribute("srcset"));
      if (img.currentSrc && !img.currentSrc.startsWith("blob:")) offered.push({ url: img.currentSrc, w: /\.svg(\?|#|$)/i.test(img.currentSrc) || /^data:image\/svg/i.test(img.currentSrc) ? Infinity : img.naturalWidth });
      offered.sort((a, b) => b.w - a.w);
      if (img.naturalWidth >= 16 && offered.length) return { mode: "img" as const, src: offered[0].url, vector: offered[0].w === Infinity, box };
      return { mode: "shot" as const, box };
    }
    if (el.tagName.toLowerCase() === "svg") {
      // Inline SVG: resolve <use> references and bake computed colours, so it renders on its own.
      const src = el as SVGSVGElement;
      const clone = src.cloneNode(true) as SVGSVGElement;
      for (const use of Array.from(clone.querySelectorAll("use"))) {
        const ref = (use.getAttribute("href") ?? use.getAttribute("xlink:href") ?? "").trim();
        const target = ref.startsWith("#") ? document.getElementById(ref.slice(1)) : null;
        if (!target) continue;
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        for (const child of Array.from(target.childNodes)) g.appendChild(child.cloneNode(true));
        use.replaceWith(g);
      }
      const orig = [src, ...Array.from(src.querySelectorAll("*"))];
      const copy = [clone, ...Array.from(clone.querySelectorAll("*"))];
      orig.forEach((o, i) => {
        const c = copy[i];
        if (!c || !(o instanceof SVGElement)) return;
        const cs = getComputedStyle(o);
        for (const prop of ["fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stop-color"]) {
          const v = cs.getPropertyValue(prop);
          if (v && v !== "normal") c.setAttribute(prop, v);
        }
      });
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(Math.round(r.width)));
      clone.setAttribute("height", String(Math.round(r.height)));
      if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`);
      return { mode: "svg" as const, svg: new XMLSerializer().serializeToString(clone), box };
    }
    return { mode: "shot" as const, box };
  });
  if (!found) return null;
  if (found.mode === "img") {
    if (found.vector) return found.src;
    // A raster logo often has an SVG twin at the same path (logo.png → logo.svg): use it if so.
    const twin = await svgTwin(page, found.src);
    if (twin) return save(`${key}-logo`, twin, "svg");
    return found.src;
  }
  if (found.mode === "svg" && found.svg.length < 400_000) return save(`${key}-logo`, cleanSvg(found.svg), "svg");
  // Text / CSS logo: a 2× screenshot on real transparency (the page, header and wrappers behind
  // the logo are made see-through for the shot), with colour-keying as a fallback.
  await page.evaluate((b) => {
    const style = document.createElement("style");
    style.textContent = "html, body { background: transparent !important; }";
    document.head.appendChild(style);
    const hit = document.elementFromPoint(b.x + b.w / 2 - window.scrollX, b.y + b.h / 2 - window.scrollY);
    for (let n: Element | null = hit?.closest("a, [class*=logo], [class*=brand]")?.parentElement ?? null; n && n !== document.documentElement; n = n.parentElement) {
      (n as HTMLElement).style.setProperty("background", "transparent", "important");
      (n as HTMLElement).style.setProperty("backdrop-filter", "none", "important");
    }
  }, found.box);
  const pad = 4;
  // Shot at 4× (Chromium re-renders the text and CSS at that density),
  // so the logo stays sharp when the film shows it large. Playwright's own screenshot is the
  // fallback.
  const clip = { x: Math.max(0, found.box.x - pad), y: Math.max(0, found.box.y - pad), width: found.box.w + pad * 2, height: found.box.h + pad * 2 };
  let shot: Buffer | null = null;
  const cdp = await page.context().newCDPSession(page).catch(() => null);
  if (cdp) {
    try {
      await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
      const res = (await cdp.send("Page.captureScreenshot", { format: "png", clip: { ...clip, scale: 4 }, captureBeyondViewport: true, fromSurface: true })) as { data: string };
      shot = Buffer.from(res.data, "base64");
    } catch {
      shot = null;
    }
    await cdp.send("Emulation.setDefaultBackgroundColorOverride", {}).catch(() => {});
    await cdp.detach().catch(() => {});
  }
  shot ??= await page.screenshot({ type: "png", scale: "device", omitBackground: true, fullPage: true, clip }).catch(() => null);
  if (!shot) return null;
  const keyed = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    const px = d.data;
    const at = (x: number, y: number) => (y * c.width + x) * 4;
    const corners = [at(0, 0), at(c.width - 1, 0), at(0, c.height - 1), at(c.width - 1, c.height - 1)];
    if (corners.every((i) => px[i + 3] < 8)) return c.toDataURL("image/png").split(",")[1]; // already transparent
    const bg = [0, 1, 2].map((k) => corners.reduce((a, i) => a + px[i + k], 0) / 4);
    const uniform = corners.every((i) => Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) < 30);
    if (uniform) {
      for (let i = 0; i < px.length; i += 4) {
        const dist = Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]);
        // Soft edge: clear on the background colour, fading in over a small band…
        const a = Math.min(1, Math.max(0, (dist - 18) / 70));
        px[i + 3] = Math.round(px[i + 3] * a);
        // …and the edge pixels' own colour recovered (the page background removed from the
        // anti-aliasing), so there's no dark or light fringe on a new background.
        if (a > 0 && a < 1) {
          for (let k = 0; k < 3; k++) px[i + k] = Math.max(0, Math.min(255, Math.round((px[i + k] - bg[k] * (1 - a)) / a)));
        }
      }
      g.putImageData(d, 0, 0);
    }
    return c.toDataURL("image/png").split(",")[1];
  }, shot.toString("base64"));
  return save(`${key}-logo`, Buffer.from(keyed, "base64"), "png");
}

/*
 * Capture queue. Each capture is a headless browser session (a few hundred MB of memory), so a
 * hosted server runs at most INTROMAKER_MAX_CAPTURES at once (default 2); a few more wait their
 * turn, and beyond that (or after a hard timeout) the import falls back to reading the HTML.
 */
const MAX_ACTIVE = Math.max(1, Number(process.env.INTROMAKER_MAX_CAPTURES ?? 2) || 2);
const MAX_WAITING = 6;
const WAIT_MS = 45_000;
const HARD_TIMEOUT_MS = 90_000;
let active = 0;
const waiting: (() => void)[] = [];

async function slot(): Promise<(() => void) | null> {
  if (active >= MAX_ACTIVE) {
    if (waiting.length >= MAX_WAITING) return null;
    const got = await new Promise<boolean>((resolve) => {
      const go = () => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        const i = waiting.indexOf(go);
        if (i >= 0) waiting.splice(i, 1);
        resolve(false);
      }, WAIT_MS);
      waiting.push(go);
    });
    if (!got) return null;
  } else active++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = waiting.shift();
    if (next) next(); // the slot passes straight to the next in line
    else active--;
  };
}

/** Live capture through the queue; null means "use the static import instead". */
export async function captureSite(url: string): Promise<Capture | null> {
  const release = await slot();
  if (!release) return null;
  const run = captureSiteNow(url).finally(release);
  // The caller stops waiting after the hard timeout; the session still finishes (and frees its
  // slot) on its own.
  return Promise.race([run.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), HARD_TIMEOUT_MS).unref?.())]);
}

async function captureSiteNow(url: string): Promise<Capture | null> {
  const browser = await launch();
  if (!browser) return null;
  const key = createHash("sha1").update(url + Date.now()).digest("hex").slice(0, 16);
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      // Components are cut out at 2× so close-ups stay sharp; page screenshots stay at 1×.
      deviceScaleFactor: 2,
      colorScheme: "dark",
      locale: "en-US",
    });
    // Every request the page makes must also pass the public-address check (SSRF guard).
    await context.route("**/*", async (route) => {
      const u = route.request().url();
      if (u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
      if (!/^https?:/i.test(u) || !(await hostAllowed(u))) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    let res = null;
    try {
      res = await page.goto(url, { waitUntil: "networkidle", timeout: 25_000 });
    } catch {
      res = await page.goto(url, { waitUntil: "load", timeout: 20_000 }).catch(() => null);
    }
    // An error page (404, 5xx, blocked) or a failed load isn't the product: give up, and the static
    // fetch explains to the visitor what went wrong.
    if (!res || res.status() >= 400 || page.url().startsWith("chrome-error:")) {
      console.warn("[capture] no usable page:", res ? `HTTP ${res.status()}` : "navigation failed");
      return null;
    }
    // Cookie / consent banners, chat bubbles and pop-ups would ruin every screenshot: clear them
    // now, again after scrolling (many appear late), and just before the shots.
    await cleanPage(page);
    // Scroll through to trigger lazy-loaded images and scroll animations, then return to top.
    await page.evaluate(async () => {
      const h = Math.min(document.documentElement.scrollHeight, 12000);
      for (let y = 0; y < h; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(900);
    await cleanPage(page);

    const hero = await save(`${key}-hero`, await page.screenshot({ type: "jpeg", quality: 82, scale: "css" }));
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const full = await save(
      `${key}-full`,
      await page.screenshot({ type: "jpeg", quality: 72, scale: "css", fullPage: true, clip: { x: 0, y: 0, width: 1440, height: Math.min(pageHeight, 7200) } }),
    );

    // Distinct, reasonably sized sections below the hero.
    const boxes = await page.evaluate(() => {
      const out: { y: number; h: number }[] = [];
      const els = Array.from(document.querySelectorAll("section, main > div, [class*=feature], [class*=Feature]"));
      for (const el of els) {
        const r = el.getBoundingClientRect();
        const y = r.top + window.scrollY;
        if (r.height < 320 || r.height > 1400 || r.width < 900 || y < 700) continue;
        if (out.some((o) => Math.abs(o.y - y) < 250)) continue;
        out.push({ y, h: r.height });
      }
      return out.sort((a, b) => a.y - b.y).slice(0, 6);
    });
    const sections: string[] = [];
    for (const [i, b] of boxes.entries()) {
      if (b.y + b.h > Math.min(pageHeight, 7200)) break;
      const shot = await page.screenshot({ type: "jpeg", quality: 78, scale: "css", fullPage: true, clip: { x: 0, y: b.y, width: 1440, height: b.h } }).catch(() => null);
      if (shot) sections.push(await save(`${key}-s${i}`, shot));
    }
    const parts = await captureParts(page, key, Math.min(pageHeight, 7200));
    const html = await page.content();
    // Last: the logo capture may clear page backgrounds for a transparent screenshot.
    const logo = await captureLogo(page, key).catch(() => null);
    return { html, finalUrl: page.url(), hero, full, sections, parts, logo };
  } catch (e) {
    console.warn("[capture] live capture failed, using static fetch:", (e as Error).message);
    return null;
  } finally {
    await browser.close().catch(() => {});
  }
}

/* ───────── Clean screenshots ───────── */

/** Consent platforms, cookie bars, chat widgets and pop-up containers hidden before any screenshot. */
const CLUTTER = [
  // Consent platforms.
  "#onetrust-banner-sdk", "#onetrust-consent-sdk", ".onetrust-pc-dark-filter", "#CybotCookiebotDialog", "#CybotCookiebotDialogBodyUnderlay",
  "#usercentrics-root", "#usercentrics-cmp-ui", "#didomi-host", ".didomi-popup-backdrop", "#qc-cmp2-container", ".qc-cmp2-container",
  "[id^='sp_message_container']", ".sp_veil", "#truste-consent-track", ".truste_box_overlay", ".truste_overlay", ".osano-cm-window",
  ".osano-cm-dialog", ".fc-consent-root", "#iubenda-cs-banner", "#hs-eu-cookie-confirmation", "#cookie-law-info-bar", ".cky-consent-container",
  ".cky-overlay", ".cc-window", ".cc-banner", ".cmplz-cookiebanner", "#cmplz-cookiebanner-container", "#moove_gdpr_cookie_info_bar", ".termly-styles-root",
  "#termly-code-snippet-support", "#axeptio_overlay", ".klaro", "#klaro", ".cookiefirst-root", "#ccc", "#ccc-overlay", ".tarteaucitronRoot",
  "#tarteaucitronRoot", "[data-nosnippet][class*='cookie' i]", "[aria-label*='cookie' i]", "[aria-label*='consent' i]", "[aria-describedby*='cookie' i]",
  "[id*='cookie-banner' i]", "[class*='cookie-banner' i]", "[id*='cookie-consent' i]", "[class*='cookie-consent' i]", "[class*='cookieConsent']",
  "[id*='cookieConsent']", "[class*='CookieBanner']", "[class*='cookie-notice' i]", "[id*='cookie-notice' i]", "[class*='consent-banner' i]", "[id*='gdpr' i]",
  // Chat and support widgets.
  "#intercom-container", ".intercom-lightweight-app", ".intercom-launcher", "#hubspot-messages-iframe-container", "#drift-widget", "#drift-frame-controller",
  "#drift-frame-chat", ".crisp-client", "#crisp-chatbox", "#tidio-chat", "#tidio-chat-iframe", "#fc_frame", ".zsiq_floatmain", "#launcher[title]",
  "iframe[title*='chat' i]", "iframe[title*='messaging' i]", "iframe[src*='intercom']", "iframe[id*='chat' i]", "#chat-widget-container", "[class*='livechat' i]",
];
/** Exact accept wording (never a partial match: "Accept payments" is a product feature, not a banner). */
const ACCEPT = /^\s*(accept( all)?( cookies)?|allow( all)?( cookies)?|i accept|i agree|agree( (and|&) (continue|close))?|got it|ok(ay)?|understood|accept & close|accept and close|consent)\s*[.!]?\s*$/i;

/**
 * Leave the page as a visitor sees it after dismissing the noise: accept consent banners through
 * their own buttons (in the page and in consent iframes, only inside a consent container), then
 * hide known consent and chat elements, remove any other fixed or sticky element that talks about
 * cookies or consent, remove full-screen pop-up overlays, and unlock scrolling.
 */
export async function cleanPage(page: Page) {
  const accept = ACCEPT.source;
  for (const frame of page.frames()) {
    await frame
      .evaluate((src) => {
        const re = new RegExp(src, "i");
        const consent = /cookie|consent|gdpr|privacy (settings|preferences|choices)|we use cookies|tracking technologies/i;
        const buttons = Array.from(document.querySelectorAll<HTMLElement>("button, [role=button], a, input[type=button], input[type=submit]"));
        for (const b of buttons) {
          const label = (b.innerText || (b as HTMLInputElement).value || b.getAttribute("aria-label") || "").trim();
          if (!re.test(label)) continue;
          // Only inside something that is about cookies / consent (or a consent iframe).
          let el: HTMLElement | null = b;
          let ok = window.top !== window && consent.test(document.body?.innerText ?? "");
          for (let i = 0; i < 8 && el && !ok; i++, el = el.parentElement) {
            const text = el.innerText ?? "";
            ok = consent.test(`${el.id} ${el.className} ${el.getAttribute("aria-label") ?? ""}`) || (i >= 1 && text.length < 1500 && consent.test(text));
          }
          if (ok) {
            b.click();
            return true;
          }
        }
        return false;
      }, accept)
      .catch(() => false);
  }
  await page.waitForTimeout(250);
  await page
    .evaluate((selectors) => {
      const style = document.createElement("style");
      style.setAttribute("data-intromaker", "clean");
      style.textContent = `${selectors.join(",")}{display:none!important;visibility:hidden!important}`;
      document.head.appendChild(style);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const talk = /cookie|consent|gdpr|we use cookies|privacy (settings|preferences|choices)|tracking technologies/i;
      const promo = /subscribe|newsletter|sign up for|join our|get \d+% off|discount|download (the|our) (guide|ebook)/i;
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "sticky") continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const text = (el.innerText || "").slice(0, 2000);
        const ids = `${el.id} ${el.className} ${el.getAttribute("aria-label") ?? ""}`;
        const cover = (r.width * r.height) / (vw * vh);
        const modal = el.getAttribute("aria-modal") === "true" || el.getAttribute("role") === "dialog" || el.getAttribute("role") === "alertdialog";
        // A cookie / consent bar or card, wherever it sits.
        if ((talk.test(text) || talk.test(ids)) && cover < 0.85) el.style.setProperty("display", "none", "important");
        // A pop-up covering most of the page (modal, newsletter, promo) and its dimmed backdrop.
        else if (cover > 0.55 && (modal || promo.test(text) || (!text.trim() && parseFloat(cs.opacity) < 1) || /overlay|backdrop|modal|popup/i.test(ids)))
          el.style.setProperty("display", "none", "important");
        // A floating pop-up card (not a header or nav bar at the top edge).
        else if ((modal || promo.test(text)) && r.top > 60) el.style.setProperty("display", "none", "important");
      }
      // Modals often lock scrolling; screenshots need the page as it scrolls.
      for (const el of [document.documentElement, document.body]) {
        if (!el) continue;
        if (getComputedStyle(el).overflow === "hidden") el.style.setProperty("overflow", "visible", "important");
        el.style.removeProperty("filter");
      }
    }, CLUTTER)
    .catch(() => {});
}

