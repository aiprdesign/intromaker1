import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser, Page } from "playwright-core";
import type { SitePart } from "@/engine/types";
import { assertPublicUrl } from "./netguard";

/**
 * Live website capture with the user's own installed Chrome/Edge (no browser download):
 * renders JavaScript sites, dismisses cookie banners, triggers lazy loading, then grabs a
 * hero screenshot, a full-page screenshot, per-section screenshots, the page's UI components cut
 * out one by one (so the film can animate them individually) and the rendered HTML.
 * Falls back gracefully (returns null) when no browser is available.
 */

export const SHOT_DIR = join(tmpdir(), "intromaker-shots");

export interface Capture {
  html: string;
  finalUrl: string;
  hero: string | null;
  full: string | null;
  sections: string[];
  parts: SitePart[];
}

async function launch(): Promise<Browser | null> {
  const { chromium } = await import("playwright-core");
  const attempts: Parameters<typeof chromium.launch>[0][] = [];
  if (process.env.INTROMAKER_BROWSER) attempts.push({ executablePath: process.env.INTROMAKER_BROWSER });
  attempts.push({ channel: "chrome" }, { channel: "msedge" }, { channel: "chromium" });
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

async function save(id: string, data: Buffer) {
  await mkdir(SHOT_DIR, { recursive: true });
  await writeFile(join(SHOT_DIR, `${id}.jpg`), data);
  return `/api/shot?id=${id}`;
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

export async function captureSite(url: string): Promise<Capture | null> {
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
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 25_000 });
    } catch {
      await page.goto(url, { waitUntil: "load", timeout: 20_000 }).catch(() => {});
    }
    // Dismiss cookie / consent banners so they don't ruin the screenshots.
    for (const label of [/accept all/i, /accept/i, /agree/i, /allow all/i, /got it/i, /^ok$/i]) {
      const btn = page.getByRole("button", { name: label }).first();
      if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
        await btn.click({ timeout: 1000 }).catch(() => {});
        break;
      }
    }
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
    return { html, finalUrl: page.url(), hero, full, sections, parts };
  } catch (e) {
    console.warn("[capture] live capture failed, using static fetch:", (e as Error).message);
    return null;
  } finally {
    await browser.close().catch(() => {});
  }
}
