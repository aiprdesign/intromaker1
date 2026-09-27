import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser } from "playwright-core";
import { assertPublicUrl } from "./netguard";

/**
 * Live website capture with the user's own installed Chrome/Edge (no browser download):
 * renders JavaScript sites, dismisses cookie banners, triggers lazy loading, then grabs a
 * hero screenshot, a full-page screenshot, per-section screenshots and the rendered HTML.
 * Falls back gracefully (returns null) when no browser is available.
 */

export const SHOT_DIR = join(tmpdir(), "intromaker-shots");

export interface Capture {
  html: string;
  finalUrl: string;
  hero: string | null;
  full: string | null;
  sections: string[];
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

export async function captureSite(url: string): Promise<Capture | null> {
  const browser = await launch();
  if (!browser) return null;
  const key = createHash("sha1").update(url + Date.now()).digest("hex").slice(0, 16);
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
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

    const hero = await save(`${key}-hero`, await page.screenshot({ type: "jpeg", quality: 82 }));
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const full = await save(
      `${key}-full`,
      await page.screenshot({ type: "jpeg", quality: 72, fullPage: true, clip: { x: 0, y: 0, width: 1440, height: Math.min(pageHeight, 7200) } }),
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
      const shot = await page.screenshot({ type: "jpeg", quality: 78, fullPage: true, clip: { x: 0, y: b.y, width: 1440, height: b.h } }).catch(() => null);
      if (shot) sections.push(await save(`${key}-s${i}`, shot));
    }
    const html = await page.content();
    return { html, finalUrl: page.url(), hero, full, sections };
  } catch (e) {
    console.warn("[capture] live capture failed, using static fetch:", (e as Error).message);
    return null;
  } finally {
    await browser.close().catch(() => {});
  }
}
