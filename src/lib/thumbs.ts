"use client";

import { ensureFonts } from "@/engine/fonts";
import { aspectSize, renderScene } from "@/engine/renderer";
import { SKILL_MAP } from "@/engine/skills";
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
  const ctx = canvas.getContext("2d")!;
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

/** A thumbnail of a slide style with its sample content, in the film's look. */
export function skillThumb(skill: SkillId, plan: VideoPlan): string {
  const key = `k|${lookKey(plan)}|${skill}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = SKILL_MAP[skill];
  const scene: Scene = { skill, text: s.sample.text, subtext: s.sample.subtext, items: s.sample.items, duration: 4.5, transition: "cut", eyebrow: plan.style === "saas" ? "Features" : undefined };
  return remember(key, paint(scene, plan));
}

/** Fonts first, or the first thumbnails render in fallback type and stay cached that way. */
export const thumbsReady = () => ensureFonts();
