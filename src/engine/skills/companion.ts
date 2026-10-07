/**
 * The companion: in a Cartoon style, slides that aren't character slides (a website tour, product
 * photos, a logo reveal…) still get a character. The video's lead peeks up into the bottom corner,
 * waves, and idles there, in the style's own drawing look and the video's colours, moving and
 * leaving with the slide. It's the style's own kind of character (or your designed lead).
 */
import { matchColors } from "../cast";
import { clamp, ease, hashString, lerp } from "../math";
import { spring } from "../saasfx";
import type { ArtStyle, Look, Scene, SkillContext, VideoPlan } from "../types";
import { drawAbstract, makeCharacter, waveArm } from "./abstract";
import { blinkAt, castLook, drawCharacter, useToon } from "./characters";
import { drawPro, proLook } from "./charpro";

export type Family = "char" | "pro" | "abs";

const CHARACTER_SLIDE = /^(char|pro|abs)-/;
const TOON_ART: Record<NonNullable<Look["toon"]>, ArtStyle> = { flat: "flat", comic: "outline", soft: "soft", doodle: "line" };

/** Which characters a plan's Cartoon style uses (null: not a Cartoon style, so no companion). */
export function companionFamily(plan: { style?: VideoPlan["style"]; look?: Look; scenes?: Scene[]; characters?: VideoPlan["characters"] }): Family | null {
  if (plan.style !== "saas" || !plan.look?.toon) return null;
  if (plan.characters || plan.look.people) return "abs";
  const skills = plan.scenes?.map((s) => s.skill) ?? [];
  if (skills.some((s) => s.startsWith("pro-"))) return "pro";
  if (skills.some((s) => s.startsWith("abs-"))) return "abs";
  return "char";
}

/** Whether a slide gets the companion (it has no characters of its own). */
export const wantsCompanion = (skill: string) => !CHARACTER_SLIDE.test(skill);

export function drawCompanion(sc: SkillContext, fam: Family) {
  const { ctx, w, h, t, palette, look } = sc;
  const portrait = h > w;
  const H = portrait ? h * 0.21 : h * 0.32;
  const x = portrait ? w * 0.84 : w - Math.max(w * 0.085, H * 0.36);
  const rise = clamp(spring(t - 0.35, 9, 7), 0, 1.05);
  const ground = h * 0.985 + (1 - rise) * H * 1.2;
  // A wave hello, then a little idle.
  const k = ease.inOutCubic(clamp((t - 0.75) / 0.3)) * (1 - ease.inOutCubic(clamp((t - 2.2) / 0.3)));
  const bob = Math.sin(t * 2.4) * 0.01;
  ctx.save();
  ctx.globalAlpha *= clamp(rise * 2);
  if (fam === "char") {
    useToon(sc);
    drawCharacter(ctx, x, ground - bob * H, H, castLook(palette, 0), {
      armL: 0.25,
      armR: lerp(0.2, 2.55, k),
      foreR: k * (0.35 + 0.35 * Math.sin(t * 10)),
      mouth: k > 0.2 ? "grin" : "smile",
      blink: blinkAt(t, 3),
      look: -0.6,
    });
  } else if (fam === "pro") {
    useToon(sc);
    drawPro(ctx, x, ground, H, proLook(palette, 0), { facing: -0.25, lift: Math.max(0, bob), armL: [-0.1, -0.08], armR: [0.1, 0.08], smile: 0.7, blink: blinkAt(t, 3), lookX: -0.6 });
  } else {
    const lead = sc.cast?.[0];
    const kind = lead?.kind ?? look?.people ?? "abstract";
    const art = lead?.art ?? look?.art ?? TOON_ART[look?.toon ?? "flat"];
    const c = lead ? matchColors(lead, palette, 0) : makeCharacter(hashString(`companion:${palette.primary}:${kind}`), palette, kind);
    drawAbstract(ctx, x, ground, H * (kind === "blob" ? 0.85 : 1), art === "flat" || lead ? c : { ...c, art }, {
      armL: 0.3,
      armR: waveArm(t, k),
      curlR: 0.5,
      lift: Math.max(0, bob),
      mouth: k > 0.3 ? "open" : "smile",
      blink: blinkAt(t, 3),
      look: -0.6,
    });
  }
  ctx.restore();
}
