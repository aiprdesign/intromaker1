/**
 * Kaizen scorecard for IntroMaker's built-in director.
 *
 *   npx tsx scripts/kaizen.ts            # summary
 *   npx tsx scripts/kaizen.ts --worst 5  # also print the 5 lowest-scoring storyboards
 *
 * Generates storyboards for a corpus of websites and prompts across lengths, story angles and
 * style templates, scores each out of 100 against what makes a great SaaS launch film (arc,
 * length, copy, variety, pacing, chapters, icons, CTA), and reports the most frequent issues so
 * each improvement cycle can target the biggest win and prove it with a re-run.
 */
import { CONCEPT_MAP } from "../src/engine/concepts";
import { iconsFor } from "../src/engine/icons";
import { LENGTH_SECONDS, planFromPrompt, planFromSite, type Angle, type Length } from "../src/engine/planner";
import { TEMPLATES } from "../src/engine/templates";
import type { SiteData, VideoPlan } from "../src/engine/types";
import { PROMPTS, SITES } from "./kaizen-corpus";

type Issue = { metric: string; points: number; msg: string };

const STOP = new Set("a an the of to in on at by for with and or but your our my their this that is are be as from into".split(" "));
const words = (s: string) => s.replace(/\*/g, "").split(/\s+/).filter(Boolean);
const norm = (s: string) => s.toLowerCase().replace(/\*/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const PRODUCT = new Set(["meet", "tour", "cards"]);
// A demo beat (command palette, AI answer, one-click flow, live notifications) shows value too.
const VALUE = new Set(["features", "how", "bento", "demo"]);
const IN_ACTION = new Set(["tour", "meet", "cards", "demo"]);
const ROLE_OK = new Set(["promise"]);
const PROOF = new Set(["quote", "logos", "cards", "stat"]);

function score(plan: VideoPlan, requested: number, site: SiteData | null): { score: number; issues: Issue[] } {
  let target = requested;
  const issues: Issue[] = [];
  const add = (metric: string, points: number, msg: string) => issues.push({ metric, points, msg });
  const sc = plan.scenes;
  const roles = sc.map((s) => s.role ?? "");

  // ── Arc (25): hook → reveal → product → value → proof → CTA.
  if (!["hook", "pain"].includes(roles[0])) add("arc", 6, `opens on ${roles[0] || sc[0]?.skill}, not a hook`);
  const reveal = roles.indexOf("reveal");
  if (reveal < 0 || reveal > 2) add("arc", 5, "brand reveal missing or late");
  if (target >= 20 && !roles.some((r) => PRODUCT.has(r)) && (site?.images.length || site?.shots.full)) add("arc", 4, "no product beat despite product media");
  // In a teaser, a product tour with feature callouts is the value beat.
  if (!roles.some((r) => VALUE.has(r) || (target < 20 && (r === "tour" || r === "quote")))) add("arc", 4, "no feature/value beat");
  const proofAvailable = !!site && (site.testimonials.length > 0 || site.clientLogos.length > 0 || site.stats.length > 0);
  if (target >= 20 && proofAvailable && !roles.some((r) => PROOF.has(r))) add("arc", 4, "site has proof but the film shows none");
  if (roles[roles.length - 1] !== "cta") add("arc", 8, "does not end on the CTA");
  // Best-in-class launch films show the product *doing* something, not only talking about it.
  if (target >= 20 && !roles.some((r) => IN_ACTION.has(r))) add("arc", 3, "no product-in-action moment (tour, demo, live UI)");
  // Interaction moments need their inputs: a command to run, a prompt to send, tasks to tick off.
  for (const s of sc.filter((x) => x.role === "demo")) {
    if ((s.items ?? []).length < (s.skill === "ai-prompt" ? 1 : 3)) add("arc", 2, `${s.skill} demo has too few items`);
    if (s.skill === "ai-prompt" && !s.subtext && (s.items ?? []).length < 2) add("copy", 2, "AI answer has no content");
  }

  // ── Richness: long films use the material the site offers.
  if (site && requested >= 30) {
    if (site.steps.length >= 2 && !roles.includes("how")) add("richness", 2, "long film skips the site's how-it-works steps");
    if (site.testimonials.length && !roles.includes("quote")) add("richness", 2, "long film skips a real testimonial");
  }

  // ── Length (10). A film the director shortened for thin material is judged on that cut,
  // provided it told the user why.
  if (plan.notes?.length && plan.target && plan.target < target) target = plan.target;
  const total = sc.reduce((a, s) => a + s.duration, 0);
  const off = Math.abs(total - target) / target;
  if (off > 0.2) add("length", 8, `length ${total.toFixed(0)}s vs ${target}s target`);
  else if (off > 0.1) add("length", 3, `length ${total.toFixed(0)}s vs ${target}s target (±10%)`);

  // ── Copy (20).
  const seen = new Map<string, string>();
  for (const s of sc) {
    const n = words(s.text).length;
    if (s.role !== "quote" && s.role !== "reveal" && (n > 9 || n < 2)) add("copy", 3, `${s.role} headline ${n} words: "${s.text.slice(0, 50)}"`);
    const last = norm(words(s.text).slice(-1)[0] ?? "");
    if (s.role !== "quote" && STOP.has(last)) add("copy", 3, `${s.role} headline ends on "${last}": "${s.text}"`);
    const key = norm(s.text);
    if (seen.has(key) && s.role !== "reveal") add("copy", 4, `headline repeated in ${seen.get(key)} and ${s.role}: "${s.text}"`);
    seen.set(key, s.role ?? s.skill);
    if (site && /your product|feature one|lorem/i.test(s.text + (s.items ?? []).join(" "))) add("copy", 5, `placeholder copy in ${s.role}`);
    const items = (s.items ?? []).map((i) => norm(i.split(/\s+[—–]\s+/)[0]));
    if (new Set(items).size < items.length) add("copy", 2, `${s.role} repeats an item`);
    if (items.includes(key)) add("copy", 2, `${s.role} item repeats its headline`);
    if (s.eyebrow && norm(s.eyebrow) === key) add("copy", 1, `${s.role} eyebrow equals headline`);
  }
  // Items reused verbatim across scenes read as filler.
  const itemOwners = new Map<string, string>();
  for (const s of sc) {
    for (const it of s.items ?? []) {
      const k = norm(it.split(/\s+[—–]\s+/)[0]);
      if (k.split(" ").length < 3) continue;
      if (itemOwners.has(k) && itemOwners.get(k) !== s.role) add("copy", 1, `"${it.slice(0, 40)}" used in ${itemOwners.get(k)} and ${s.role}`);
      itemOwners.set(k, s.role ?? "");
    }
  }

  // ── Variety (15).
  for (let i = 1; i < sc.length; i++) {
    if (sc[i].skill === sc[i - 1].skill) add("variety", 5, `${sc[i].skill} twice in a row`);
    if (sc[i].transition === sc[i - 1].transition && sc[i].transition !== "cut") add("variety", 1, `transition ${sc[i].transition} twice in a row`);
  }
  const distinct = new Set(sc.map((s) => s.skill)).size;
  if (distinct < Math.min(5, sc.length)) add("variety", 4, `only ${distinct} distinct skills`);

  // ── Pacing (10).
  for (const s of sc) {
    if (s.duration < 2.4 || s.duration > 8.5) add("pacing", 2, `${s.role} lasts ${s.duration.toFixed(1)}s`);
  }
  if (sc.length < Math.round(target / 6)) add("pacing", 4, `only ${sc.length} scenes for ${target}s`);

  // ── Chapters (10): middle scenes carry an eyebrow.
  const middle = sc.filter((s) => !["reveal", "cta", "hook", "pain"].includes(s.role ?? ""));
  const withEb = middle.filter((s) => s.eyebrow).length;
  if (middle.length && withEb < middle.length) add("chapters", Math.round((10 * (middle.length - withEb)) / middle.length), `${middle.length - withEb}/${middle.length} middle scenes without a chapter label`);

  // ── Icons (5): feature scenes use distinct icons.
  const family = CONCEPT_MAP[plan.concept ?? "general"]?.icons;
  for (const s of sc.filter((x) => x.skill === "icon-features" || x.skill === "bento")) {
    const icons = iconsFor((s.items ?? []).map((it) => it.split(/\s+[—–]\s+/)[0]), family);
    if (new Set(icons).size < icons.length) add("icons", 3, `${s.role} repeats an icon (${icons.join(",")})`);
  }

  // ── CTA (5).
  const cta = sc.find((s) => s.role === "cta");
  if (cta && !cta.subtext) add("cta", 3, "CTA has no button label");
  if (cta && norm(cta.text) === norm(sc[0].text)) add("cta", 2, "CTA repeats the hook");

  const lost = issues.reduce((a, i) => a + i.points, 0);
  return { score: Math.max(0, 100 - lost), issues };
}

const LENGTHS: Length[] = ["short", "standard", "long"];
const ANGLES: Angle[] = ["story", "product", "proof"];
const TPLS = TEMPLATES.map((t) => t.id);

const results: { name: string; score: number; issues: Issue[] }[] = [];
for (const { id, site } of SITES) {
  for (const length of LENGTHS)
    for (const angle of ANGLES)
      for (const [ti, template] of TPLS.entries()) {
        if (ti % 3 !== ANGLES.indexOf(angle)) continue; // spread templates across angles
        const plan = planFromSite(site, { aspect: "16:9", length, template, angle, seed: 7 });
        results.push({ name: `site:${id} ${length}/${angle}/${template}`, ...score(plan, LENGTH_SECONDS[length], site) });
      }
}
for (const prompt of PROMPTS)
  for (const length of LENGTHS)
    for (const template of ["midnight", "paper", "kinetic", "spatial"]) {
      const plan = planFromPrompt({ prompt, aspect: "16:9", length, template, style: "saas", seed: 7 });
      results.push({ name: `prompt:"${prompt.slice(0, 32)}" ${length}/${template}`, ...score(plan, LENGTH_SECONDS[length], null) });
    }

const avg = results.reduce((a, r) => a + r.score, 0) / results.length;
const byMetric = new Map<string, number>();
const byMsg = new Map<string, number>();
for (const r of results)
  for (const i of r.issues) {
    byMetric.set(i.metric, (byMetric.get(i.metric) ?? 0) + i.points);
    const k = `${i.metric}: ${i.msg.replace(/"[^"]*"/g, '"…"').replace(/\d+(\.\d+)?/g, "#")}`;
    byMsg.set(k, (byMsg.get(k) ?? 0) + 1);
  }
console.log(`\nKaizen scorecard — ${results.length} storyboards, average ${avg.toFixed(1)}/100`);
console.log(`perfect (100): ${results.filter((r) => r.score === 100).length}   below 80: ${results.filter((r) => r.score < 80).length}   min: ${Math.min(...results.map((r) => r.score))}`);
console.log("\nPoints lost by metric:");
for (const [m, p] of [...byMetric].sort((a, b) => b[1] - a[1])) console.log(`  ${m.padEnd(9)} ${(p / results.length).toFixed(2)} per film`);
console.log("\nMost frequent issues:");
for (const [m, n] of [...byMsg].sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log(`  ${String(n).padStart(4)}×  ${m}`);
const worstN = Number(process.argv[process.argv.indexOf("--worst") + 1]) || 0;
if (process.argv.includes("--worst")) {
  console.log("\nLowest scoring:");
  for (const r of [...results].sort((a, b) => a.score - b.score).slice(0, worstN)) {
    console.log(`  ${r.score}  ${r.name}`);
    for (const i of r.issues) console.log(`        -${i.points} ${i.metric}: ${i.msg}`);
  }
}
