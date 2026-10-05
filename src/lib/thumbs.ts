"use client";

import { ensureFonts } from "@/engine/fonts";
import { preloadImages } from "@/engine/media";
import { placeholderSources, withPlaceholders } from "@/engine/placeholders";
import { aspectSize, renderScene } from "@/engine/renderer";
import { slideContent } from "@/engine/newslide";
import { SKILL_MAP } from "@/engine/skills";
import { DEMO_SKILLS, roleOf } from "@/engine/templates";
import type { Scene, SkillId, VideoPlan } from "@/engine/types";

/**
 * Small still frames of slides for the studio: the storyboard timeline and the slide-style
 * picker. Frames render with the film's own palette, font and brand (camera off), at the moment
 * each slide's content is settled, and are cached as data URLs.
 */

const cache = new Map<string, string>();
const MAX = 400;
let canvas: HTMLCanvasElement | null = null;

/** The long side of a thumbnail, in pixels (displayed at half size for crisp HiDPI). */
const LONG = 336;

const lookKeys = new WeakMap<VideoPlan, string>();
/** Everything about the film's look (not its slides), so a style or colour change re-renders. */
function lookKey(plan: VideoPlan) {
  let k = lookKeys.get(plan);
  if (k === undefined) {
    const { scenes: _scenes, title: _title, ...look } = plan;
    k = JSON.stringify(look);
    lookKeys.set(plan, k);
  }
  return k;
}

function paint(scene: Scene, plan: VideoPlan): string {
  const { w, h } = aspectSize(plan.aspect, LONG);
  canvas ??= document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  // A CPU canvas: reading a GPU canvas back (toDataURL) can stall the page for seconds.
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  // Settled content: late enough for staggered reveals, before the exit.
  const t = Math.max(0.6, Math.min(scene.duration - 0.5, scene.duration * 0.62));
  try {
    renderScene(ctx, scene, plan, t, w, h, 0, { camera: false, bloom: false });
  } catch {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);
  }
  return canvas.toDataURL("image/jpeg", 0.82);
}

function remember(key: string, url: string) {
  if (cache.size >= MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, url);
  return url;
}

/** A thumbnail of one of the film's slides as it stands (its text, items and media). */
export function sceneThumb(scene: Scene, plan: VideoPlan): string {
  const key = `s|${lookKey(plan)}|${JSON.stringify(scene)}`;
  return cache.get(key) ?? remember(key, paint(scene, plan));
}

const LOGO_SKILL = /^logo-|^liquid-logo$|^particle-assemble$/;

/**
 * What a slide style shows in the menu: the video's own content, never the style's sample copy.
 * For a slide being restyled (`base`), that slide's own headline, line, items and picture; for a
 * new slide, copy written from the video itself (its features, moments and brand: see
 * newslide.ts, without re-running the director, so the menu stays instant). Logo slides show the
 * brand's name. The sample fills only what the video has nothing for.
 */
function thumbScene(skill: SkillId, plan: VideoPlan, base?: Scene): Scene {
  const s = SKILL_MAP[skill];
  const brand = plan.brand?.name?.trim();
  let own: Partial<Scene> = {};
  try {
    own = slideContent(skill, plan, () => null);
  } catch {
    /* the sample stands in */
  }
  // The video's own slide of the same kind (this style, else the same part of the story: its end
  // card for a call to action, its reveal for a logo) has the real lines.
  const role = roleOf({ skill, text: "", duration: 3, transition: "cut" }, 1, 3);
  // (A product moment only borrows from the very same moment: each reads its line and items in its
  // own format, a board's columns, a chat's messages.)
  const twin = plan.scenes.find((x) => x.skill === skill) ?? (role && !DEMO_SKILLS.has(skill) ? plan.scenes.find((x, i, all) => roleOf(x, i, all.length) === role) : undefined);
  if (twin) own = { ...own, text: twin.text || own.text, subtext: twin.subtext, items: twin.items?.length ? twin.items : own.items, eyebrow: twin.eyebrow ?? own.eyebrow, media: twin.media ?? own.media };
  // A style's sample line is never shown as if it were the video's (a moment's stock data line,
  // a board's columns or a notification, is fine: it isn't a claim).
  if (!DEMO_SKILLS.has(skill) && own.subtext === s.sample.subtext) own.subtext = "";
  let c: Partial<Scene> = own;
  // (An empty line is left empty: a style's sample line is never shown as if it were the video's.)
  if (LOGO_SKILL.test(skill) && brand) c = { text: brand, subtext: plan.scenes.find((x) => x.role === "reveal" || LOGO_SKILL.test(x.skill))?.subtext ?? "" };
  else if (base) {
    // A product moment (a board, a chat, a file drop) reads its line as its own data (columns, a
    // notification, a file name): that comes from the video's material, not the slide's line.
    const moment = DEMO_SKILLS.has(skill);
    c = {
      text: base.text || own.text,
      subtext: (moment ? own.subtext : base.subtext ?? own.subtext) ?? "",
      items: base.items?.length ? base.items : own.items,
      eyebrow: base.eyebrow ?? own.eyebrow,
      media: base.media ?? own.media,
    };
  }
  return {
    skill,
    text: c.text || s.sample.text,
    subtext: c.subtext ?? (base ? "" : s.sample.subtext),
    items: s.itemsHint !== undefined || c.items?.length ? (c.items?.length ? c.items : s.sample.items) : undefined,
    eyebrow: plan.style === "saas" ? c.eyebrow ?? "Features" : undefined,
    media: c.media,
    role: c.role,
    duration: 4.5,
    transition: "cut",
  };
}

/**
 * A slide switched to another style, with the content its menu thumbnail showed (so what you pick
 * is what you saw): its own headline and items, a moment's own data line, or the brand's name on a
 * logo slide. Its picture, timing, transition and narration stay.
 */
export function restyleScene(base: Scene, skill: SkillId, plan: VideoPlan): Scene {
  const t = thumbScene(skill, plan, base);
  return { ...base, skill, text: t.text, subtext: t.subtext, items: t.items };
}

/** A thumbnail of a slide style in the film's look, showing the film's own content (see thumbScene). */
export function skillThumb(skill: SkillId, plan: VideoPlan, base?: Scene): string {
  const scene = thumbScene(skill, plan, base);
  const key = `k|${lookKey(plan)}|${JSON.stringify(scene)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // A style that shows your media previews with stand-in pictures when the film has none.
  const preview = withPlaceholders(scene, plan);
  return remember(key, paint(preview.scene, preview.plan));
}

/**
 * Paints thumbnails a few at a time (about 12 ms per turn), so a storyboard of slides never
 * freezes the page: the import progress keeps animating and its response is handled promptly.
 * `alive()` false drops a queued thumbnail that is no longer wanted.
 */
const queue: { run: () => void; alive: () => boolean }[] = [];
let pumping = false;
let paused = false;
/**
 * While a video is being built its slides are about to change: thumbnails wait, so the page
 * stays free for the progress and the import's response.
 */
export function pauseThumbs(on: boolean) {
  paused = on;
  if (!on && queue.length && !pumping) {
    pumping = true;
    window.setTimeout(pump, 0);
  }
}
function pump() {
  if (paused) {
    pumping = false;
    return;
  }
  const until = performance.now() + 12;
  while (queue.length && performance.now() < until) {
    const job = queue.shift()!;
    if (job.alive()) job.run();
  }
  if (queue.length) window.setTimeout(pump, 0);
  else pumping = false;
}
export function later(paintOne: () => string, alive: () => boolean = () => true): Promise<string | null> {
  return new Promise((resolve) => {
    queue.push({ run: () => resolve(paintOne()), alive: () => alive() || (resolve(null), false) });
    if (!pumping) {
      pumping = true;
      window.setTimeout(pump, 0);
    }
  });
}

/**
 * Fonts first, or the first thumbnails render in fallback type and stay cached that way; and the
 * stand-in pictures, so the slide-style previews that use them aren't painted empty.
 */
export const thumbsReady = () => Promise.all([ensureFonts(), preloadImages(placeholderSources())]);
