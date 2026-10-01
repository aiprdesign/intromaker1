/**
 * Voice-over script: one narrator line per scene, written from what the scene shows (the site's
 * own copy, never new claims), in the rhythm of a launch-film narrator: short, warm sentences
 * that fit the scene at a comfortable pace. Testimonials stay unvoiced so the quote reads, and
 * the brand reveal gets its name said on the hit.
 */
import type { Scene, VideoPlan } from "./types";
import { speakable, wordBudget } from "./voice";

/** Copy as a narrator reads it: no markup, and SHOUTED stat labels in normal case (acronyms kept). */
const clean = (s?: string) =>
  (s ?? "")
    .replace(/\*/g, "")
    .replace(/\b[A-Z]{4,}\b/g, (w) => (/^(GDPR|HIPAA|SAML|SOC|HTML|JSON|CRUD|OKRS?)$/.test(w) ? w : w.toLowerCase()))
    .replace(/\s+/g, " ")
    .trim();
const title = (item: string) => clean(item.split(/\s+[—–]\s+/)[0]);
const sentence = (s: string) => {
  const t = clean(s).replace(/[.!?]+$/, "");
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}.` : "";
};
const lower = (s: string) => (/^[A-Z][a-z]/.test(s) && !/^[A-Z][a-z]+[A-Z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** "a, b and c" from up to `n` items. */
function list(items: string[], n: number) {
  const xs = items.map(title).filter(Boolean).slice(0, n).map(lower);
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

const count = (s: string) => speakable(s).split(/\s+/).filter(Boolean).length;

/** Trim a line to the scene's word budget, dropping list items first, then whole clauses. */
function fit(candidates: string[], budget: number) {
  for (const c of candidates) if (c && count(c) <= budget) return c;
  // One word over is fine (a recorded line stretches its scene to the next beat); chopping the
  // last word of a sentence is not.
  for (const c of candidates) if (c && count(c) <= budget + 1) return c;
  const last = candidates.filter(Boolean).pop() ?? "";
  const words = last.split(" ").slice(0, budget);
  // Numbers read longer than they look ("10,000+" → "more than 10,000").
  while (words.length > 2 && count(words.join(" ")) > budget) words.pop();
  // Cut at a clause boundary rather than mid-phrase ("The tools you need to close" → "The tools you need").
  const boundary = words.reduce((at, w, k) => (k >= 3 && /^(to|that|so|which|with|for|and|while|when)$/i.test(w) ? k : at), -1);
  if (boundary > 0 && boundary < words.length - 1) words.length = boundary;
  while (words.length > 2 && /^(and|or|the|a|an|to|of|for|with|your|more|less|than|so|that|in|on|at|by)$/i.test(words[words.length - 1])) words.pop();
  return words.length ? `${words.join(" ").replace(/[,;:]$/, "")}.` : "";
}

function lineFor(s: Scene, plan: VideoPlan, i: number): string | undefined {
  const name = plan.brand?.name ?? plan.title;
  const budget = wordBudget(s.duration);
  const items = s.items ?? [];
  const head = clean(s.text);
  // Product videos speak about the product itself, and say where to find it.
  if (plan.product) {
    if (s.role === "reveal") {
      const by = clean(s.subtext);
      const meet = head.split(/\s+/).length >= 3 ? `Meet the ${head}` : `Meet ${head}`;
      return fit([by ? `${meet}, ${by.replace(/[.!]+$/, "")}.` : "", `${meet}.`], budget);
    }
    if (s.role === "cta") {
      // The close names the product (its short name), and where to find it when there's an address.
      const domain = plan.brand?.domain && !/localhost|^\d+\.\d+/.test(plan.brand.domain) ? plan.brand.domain : "";
      const words = (plan.title || name).split(/\s+/);
      const nick = words.length > 4 ? words.slice(0, 3).join(" ") : words.join(" ");
      return fit(
        [
          domain ? `${sentence(head)} ${nick}, at ${domain}.` : "",
          `${sentence(head)} ${nick}.`,
          domain ? `${nick}, at ${domain}.` : "",
          `${nick}.`,
        ],
        budget,
      );
    }
    if (s.skill === "product-zoom" && items.length >= 2) return fit([`${sentence(head)} ${sentence(list(items, 3))}`, sentence(head)], budget);
  }
  switch (s.role) {
    case "quote":
      return undefined;
    case "pain":
      return fit(
        items.length >= 2
          ? [`${sentence(`Less time on ${list(items, 3)}`)} ${sentence(head)}`, `${sentence(`Less time on ${list(items, 2)}`)} ${sentence(head)}`, sentence(`Less time on ${list(items, 3)}`), sentence(`Less time on ${list(items, 2)}`), sentence(head)]
          : [sentence(head)],
        budget,
      );
    case "hook":
      // A word-swap opener is said as its alternatives ("Your data, explored. Measured. Shared.").
      return fit([head.includes("|") ? head.split("|").map((w) => sentence(w.trim())).join(" ") : sentence(head)], budget);
    case "reveal":
      // The reveal's subtext is sometimes just the web address: that's shown, not said.
      return fit([s.subtext && /\s/.test(s.subtext.trim()) ? `Meet ${name}. ${sentence(s.subtext)}` : "", `Meet ${name}.`], budget);
    case "meet":
      return fit([sentence(head)], budget);
    case "promise":
      return fit([head.split("|").map((w, k) => (k ? sentence(w.trim()) : sentence(w.trim()))).join(" ")], budget);
    case "demo":
    case "gallery":
    case "reach":
    case "support":
      return fit([sentence(head)], budget);
    case "solve": {
      // "Less time on scattered spreadsheets and status meetings. From problem to solution."
      const problems = items.map((it) => it.split(/\s*(?:→|->|=>)\s*/)[0]);
      return fit([problems.length >= 2 ? `${sentence(`Less time on ${list(problems, 2)}`)} ${sentence(head)}` : "", sentence(head)], budget);
    }
    case "compare":
      // The old way, then the product: "Less time on spreadsheets and status meetings."
      return fit([items.length >= 2 ? `${sentence(`Less time on ${list(items, 2)}`)} ${sentence(head)}` : "", sentence(head)], budget);
    case "features":
    case "bento":
      return fit([`${sentence(head)} ${sentence(list(items, 3))}`, `${sentence(head)} ${sentence(list(items, 2))}`, sentence(head)], budget);
    case "how":
      return fit([items.length >= 2 ? `${sentence(head)} ${sentence(list(items, 3))}` : "", sentence(head)], budget);
    case "tour":
      return fit([items[0] ? `${sentence(head)} ${sentence(title(items[0]))}` : "", sentence(head)], budget);
    case "metric":
      return fit([s.subtext ? `${sentence(s.subtext)}` : "", sentence(head)], budget);
    case "logos":
    case "cards":
    case "integrations":
    case "stat":
      return fit([sentence(head)], budget);
    case "cta": {
      const domain = plan.brand?.domain && !/localhost/.test(plan.brand.domain) ? plan.brand.domain : "";
      const button = clean(s.subtext);
      // The close always names the product (by its web address, or its name).
      const says = (x: string) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(x);
      const named = says(`${head} ${button}`);
      const bare = button.replace(/[.!]+$/, "");
      return fit(
        [
          button && domain ? `${sentence(head)} ${bare} at ${domain}.` : "",
          button && !named ? `${sentence(head)} ${bare} with ${name}.` : "",
          button && named ? `${sentence(head)} ${sentence(button)}` : "",
          domain ? `${sentence(head)} ${domain}.` : "",
          says(head) ? sentence(head) : "",
          button && says(button) ? sentence(button) : "",
          `${sentence(head)} ${name}.`,
          `Try ${name}.`,
        ],
        budget,
      );
    }
    default:
      // Trailer films and scenes without a role: the card's own words.
      return i === 0 || head.split(" ").length >= 2 ? fit([sentence(head.toLowerCase().replace(/^./, (c) => c.toUpperCase()))], budget) : undefined;
  }
}

/** Fill in a narrator line for every scene that doesn't have one (keeps lines you've edited). */
export function writeVoiceover(plan: VideoPlan, opts: { overwrite?: boolean } = {}): VideoPlan {
  return {
    ...plan,
    scenes: plan.scenes.map((s, i) => (s.vo && !opts.overwrite ? s : { ...s, vo: lineFor(s, plan, i) || undefined })),
  };
}
