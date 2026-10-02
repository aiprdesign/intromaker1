import { SKILL_MAP } from "./skills";
import { roleOf } from "./templates";
import type { Scene, SkillId, VideoPlan } from "./types";

/** Lists that are about the product's features (others, like a kanban board's cards, aren't). */
const FEATURE_LIST = /feature|benefit|callout|caption|close-up/i;

const norm = (x: string) => x.replace(/\*/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The film's own features: list items from its slides ("Title — detail" keeps the title). */
function filmFeatures(plan: VideoPlan) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of plan.scenes) {
    // Only lists about the product (not a board's cards, a chat's messages or a QR link).
    if (!FEATURE_LIST.test(SKILL_MAP[s.skill]?.itemsHint ?? "")) continue;
    for (const it of s.items ?? []) {
      const title = it.split(/\s+[—–]\s+/)[0].trim();
      const k = norm(title);
      if (title && k.split(" ").length <= 6 && !seen.has(k)) {
        seen.add(k);
        out.push(it);
      }
    }
  }
  return out;
}

/** The film's features shaped like the slide's sample: "Title — detail" pairs, or plain titles. */
function itemsLike(skill: SkillId, from: string[]) {
  const k = SKILL_MAP[skill];
  const sample = k.sample.items;
  if (!sample?.length || from.length < 2 || !FEATURE_LIST.test(k.itemsHint ?? "")) return undefined;
  if (sample.some((x) => /\s[—–]\s/.test(x))) {
    // "Title — detail" where the film has them; its plain feature titles otherwise.
    const pairs = from.filter((x) => /\s[—–]\s/.test(x));
    return (pairs.length >= 2 ? pairs : from).slice(0, Math.max(3, sample.length));
  }
  return from.slice(0, Math.max(3, sample.length)).map((x) => x.split(/\s+[—–]\s+/)[0]);
}

/** A word-swap line ("Your code, built|tested|shipped") as one line for other slides ("Your code, *shipped*"). */
function swapAsLine(text: string) {
  if (!text.includes("|")) return text;
  const [lead, words = ""] = text.split(/,\s*(?=[^,]*$)/);
  const last = words.split("|").filter(Boolean).pop();
  return last ? `${lead}, *${last}*` : text.replace(/\|/g, " ");
}

/**
 * Content for a slide added to a film, written from the film's own material rather than the
 * slide's sample: the built-in director is run again on the same website, listing or prompt (a
 * few story angles and remakes), and its version of this slide is taken, preferring wording the
 * film doesn't use yet; else a slide in the same story role lends its words; else the slide is
 * built from the film itself (its brand and the features on its other slides).
 * `direct` returns a storyboard for a remake number and angle (or null with no source).
 */
export function slideContent(skill: SkillId, plan: VideoPlan, direct: (variant: number, angle?: "story" | "product" | "proof") => VideoPlan | null): Partial<Scene> {
  const k = SKILL_MAP[skill];
  const name = plan.brand?.name ?? plan.title ?? "";
  const used = new Set(plan.scenes.map((s) => norm(s.text)));
  const fresh = (s: Scene) => !used.has(norm(s.text));
  const role = roleOf({ skill, text: "", duration: 3, transition: "cut" }, 1, 3);

  // 1. The director's own version of this slide (or one in the same role).
  const takes: VideoPlan[] = [];
  for (const [variant, angle] of [[0, undefined], [1, "product"], [2, "proof"], [3, "story"], [4, undefined], [5, "product"]] as const) {
    try {
      const p = direct(variant, angle);
      if (p) takes.push(p);
    } catch {
      /* a take that can't be made is skipped */
    }
    const same = takes.flatMap((t) => t.scenes).filter((s) => s.skill === skill);
    if (same.some(fresh)) break;
  }
  const scenes = takes.flatMap((t) => t.scenes);
  const same = scenes.filter((s) => s.skill === skill);
  const hit = same.find(fresh) ?? same[0];
  if (hit) {
    const { text, subtext, items, eyebrow, media, vo, role: r, duration } = hit;
    return { text, subtext, items, eyebrow, media, vo, role: r, duration };
  }
  const features = filmFeatures(plan);
  const kin = role ? scenes.filter((s, i, all) => roleOf(s, i, all.length) === role) : [];
  const lend = kin.find(fresh) ?? kin[0];
  if (lend) {
    return {
      text: skill === "word-swap" ? lend.text : swapAsLine(lend.text),
      eyebrow: lend.eyebrow,
      subtext: k.sample.subtext !== undefined ? lend.subtext ?? k.sample.subtext : undefined,
      items: k.itemsHint !== undefined ? itemsLike(skill, lend.items?.length ? lend.items : features) ?? itemsLike(skill, features) ?? k.sample.items : undefined,
      media: lend.media,
      role,
    };
  }

  // 2. From the film itself.
  const titles = features.map((x) => x.split(/\s+[—–]\s+/)[0]);
  if (skill === "word-swap" && titles.length >= 2)
    return { text: plan.product ? `${name}:` : "One place for", items: titles.slice(0, 4).map((x) => (plan.product ? x : x.toLowerCase())), role };
  if (skill === "steps" && plan.product) return { text: `Get started with *${name}*`, items: ["Unbox it", "Set it up", "Make it yours"], role };
  const promise = role === "promise" ? scenes.find((s) => s.skill === "word-swap") : undefined;
  if (promise && skill !== "word-swap") return { text: swapAsLine(promise.text), eyebrow: promise.eyebrow, items: k.itemsHint !== undefined ? itemsLike(skill, features) ?? k.sample.items : undefined, role };
  const headline =
    role === "cta" ? `Get started with *${name}*` : role === "reveal" ? name : role === "hook" ? `Introducing *${name}*` : role === "features" || role === "bento" || role === "cards" ? `Inside *${name}*` : role === "promise" ? `This is *${name}*` : `See *${name}* in action`;
  return {
    text: name ? headline : k.sample.text,
    subtext: k.sample.subtext,
    items: k.itemsHint !== undefined ? itemsLike(skill, features) ?? k.sample.items : undefined,
    role,
  };
}
