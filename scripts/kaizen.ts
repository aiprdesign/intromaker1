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
import { hasClaim, isHealthClaim } from "../src/engine/claims";
import { LENGTH_SECONDS, planFromPrompt, planFromSite, safeSite, stripHealth, type Angle, type Length } from "../src/engine/planner";
import { TEMPLATES } from "../src/engine/templates";
import { speakable, wordBudget } from "../src/engine/voice";
import type { SiteData, VideoPlan } from "../src/engine/types";
import { PROMPTS, SITES } from "./kaizen-corpus";

type Issue = { metric: string; points: number; msg: string };

const STOP = new Set("a an the of to in on at by for with and or but your our my their this that is are be as from into".split(" "));
const words = (s: string) => s.replace(/\*/g, "").split(/\s+/).filter(Boolean);
const norm = (s: string) => s.toLowerCase().replace(/\*/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const PRODUCT = new Set(["meet", "tour", "cards", "gallery"]);
// A demo beat (command palette, AI answer, one-click flow, live notifications) shows value too.
const VALUE = new Set(["features", "how", "bento", "demo"]);
const IN_ACTION = new Set(["tour", "meet", "cards", "demo", "gallery"]);
const ROLE_OK = new Set(["promise"]);
const PROOF = new Set(["quote", "logos", "cards", "stat"]);

function score(plan: VideoPlan, requested: number, site: SiteData | null, safe = true): { score: number; issues: Issue[] } {
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

  // ── Voice-over (5): a narrator line that fits each scene, names the brand on the reveal,
  // closes on the call to action and leaves the testimonial to read on its own.
  for (const s of sc) {
    if (!s.vo) continue;
    const n = speakable(s.vo).split(/\s+/).filter(Boolean).length;
    if (n > wordBudget(s.duration) + 1) add("voice", 1, `${s.role} voice line ${n} words for ${s.duration.toFixed(1)}s`);
    if (/\*|\|/.test(s.vo)) add("voice", 1, `${s.role} voice line has markup`);
  }
  const revealScene = sc.find((s) => s.role === "reveal");
  if (revealScene && !(revealScene.vo ?? "").includes(plan.brand?.name ?? plan.title)) add("voice", 1, "reveal doesn't say the brand name");
  if (sc.some((s) => s.role === "quote" && s.vo)) add("voice", 1, "testimonial is talked over");
  if (sc[sc.length - 1]?.role === "cta" && !sc[sc.length - 1].vo) add("voice", 1, "CTA has no voice line");

  // ── Claims: claim-safe films say what the product is and does, never how much better it is.
  for (const s of sc) {
    const health = [s.text, s.subtext, s.eyebrow, s.vo, ...(s.items ?? [])].find((x) => x && isHealthClaim(x));
    if (health) add("claims", 10, `${s.role} makes a health claim: "${health.replace(/\*/g, "").slice(0, 60)}"`);
  }
  if (safe) {
    for (const s of sc) {
      const claim = [s.text, s.subtext, s.eyebrow, s.vo, ...(s.items ?? [])].find((x) => x && hasClaim(x));
      if (claim) add("claims", 5, `${s.role} makes a claim: "${claim.replace(/\*/g, "").slice(0, 60)}"`);
    }
  }

  // ── Experience: what a viewer notices, beyond the checklist.
  experience(plan, site, requested, add);

  // ── CTA (5).
  const cta = sc.find((s) => s.role === "cta");
  if (cta && !cta.subtext) add("cta", 3, "CTA has no button label");
  if (cta && norm(cta.text) === norm(sc[0].text)) add("cta", 2, "CTA repeats the hook");

  const lost = issues.reduce((a, i) => a + i.points, 0);
  return { score: Math.max(0, 100 - lost), issues };
}

/** Content words (4+ letters) of a line, for "is this the product's own copy?" checks. */
const content = (x: string) => new Set(norm(x).split(" ").filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w)));
const GENERIC_WORDS = new Set("your with from that this what team teams work into more make built tools need inside action introducing using".split(" "));
const DANGLING = /\b(close|closes|get|make|help|helps|lets|so|that|which|to|for|with|and|or|the|a|an|your|by|of|on|at|in|more|less|than)[.!?]?$/i;

function experience(plan: VideoPlan, site: SiteData | null, requested: number, add: (metric: string, points: number, msg: string) => void) {
  const sc = plan.scenes;
  const name = plan.brand?.name ?? plan.title;
  // Specificity: headlines should be the product's own story, not boilerplate any product could use.
  if (site) {
    const own = content([site.tagline, site.description, ...site.headlines, ...site.features, ...site.steps, ...site.pains, ...site.stats].join(" "));
    const judged = sc.filter((s) => ["hook", "meet", "tour", "features", "bento", "cards", "integrations"].includes(s.role ?? ""));
    // A scene is the product's own when its headline or (for feature grids) its items are.
    const ownWords = (x: string) => [...content(x)].some((w) => own.has(w)) || (x.match(/\d[\d,.]*/g) ?? []).some((n) => site.stats.some((st) => st.includes(n)));
    const generic = judged.filter((s) => !ownWords(s.text) && !(["features", "bento"].includes(s.role ?? "") && (s.items ?? []).some(ownWords)));
    const hook = sc.find((s) => s.role === "hook" || s.role === "pain");
    if (hook?.role === "hook" && generic.includes(hook) && [...own].length > 8) add("specific", 3, `hook is boilerplate: "${hook.text}"`);
    if (judged.length >= 3 && generic.length / judged.length > 0.5) add("specific", 3, `${generic.length}/${judged.length} headlines are boilerplate`);
  }
  // Rewrite damage: fragments a viewer would read as broken copy.
  const lines: [string, string][] = [];
  for (const s of sc) {
    // Customer quotes are verbatim; they aren't ours to judge.
    if (s.role === "quote") continue;
    if (s.role !== "reveal") lines.push([`${s.role} headline`, s.text.split("|")[0]]);
    for (const it of s.items ?? []) lines.push([`${s.role} item`, it.split(/\s+[—–]\s+/)[0]]);
    for (const sent of (s.vo ?? "").split(/(?<=[.!?])\s+/)) if (sent) lines.push([`${s.role} voice`, sent]);
  }
  let damage = 0;
  for (const [where, raw] of lines) {
    const x = raw.replace(/\*/g, "").trim();
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\.?$/i.test(x)) continue; // a web address, said as written
    if (/\d+\+? more$/i.test(x)) continue; // "Gmail, Slack and 50 more" is complete
    const bad = /\bever (?:built|made)\b|\b[a-z]+s-(?:up|in|on|out)s?\b/i.test(x) ? "reads as a broken rewrite" : DANGLING.test(x) && x.split(" ").length > 1 ? "ends mid-thought" : /^[a-z]/.test(x) && !/^(iOS|e[A-Z]|macOS)/.test(x) ? "starts lowercase" : /\b(\w+) \1\b/i.test(x) ? "repeats a word" : "";
    if (bad && damage++ < 3) add("damage", 2, `${where} ${bad}: "${x.slice(0, 60)}"`);
  }
  // Brand: the real logo is revealed when there is one; the close names the brand.
  // (Video in text shows the logo above its letters.)
  if (plan.brand?.logo && !sc.some((s) => s.skill === "logo-reveal" || s.skill === "type-mask")) add("brand", 3, "site has a logo but the film never reveals it");
  const last = sc[sc.length - 1];
  if (last?.role === "cta" && last.vo && !last.vo.includes(name) && !(plan.brand?.domain && last.vo.includes(plan.brand.domain))) add("brand", 1, "CTA line doesn't name the brand");
  // The real product: captured UI and imagery should be on screen.
  if (site && requested >= 20) {
    const parts = site.shots.parts?.length ?? 0;
    if (parts >= 3 && !sc.some((s) => s.skill === "ui-assemble")) add("product", 3, `${parts} UI components captured but no UI Assemble`);
    const hasVisuals = !!(site.shots.hero || site.shots.full || site.images.length || site.videos.length);
    const shown = sc.filter((s) => s.media || ["ui-assemble", "site-scroll"].includes(s.skill)).length;
    if (hasVisuals && shown === 0) add("product", 4, "site has product visuals but none are shown");
  }
  // Beat sync: every cut on the beat grid.
  const beat = 60 / (plan.bpm || 120);
  const off = sc.filter((s) => Math.abs(s.duration / beat - Math.round(s.duration / beat)) > 0.04).length;
  if (off) add("sync", Math.min(3, off), `${off} scene${off > 1 ? "s" : ""} cut off the beat`);
  // Vertical: headlines that won't fit a phone frame.
  if (plan.aspect === "9:16") {
    for (const s of sc) {
      const longest = Math.max(...s.text.replace(/\*/g, "").split(/[\s|]+/).map((w) => w.length));
      if (s.role !== "quote" && (longest > 14 || s.text.replace(/\*/g, "").length > 56)) add("portrait", 2, `${s.role} headline too wide for 9:16: "${s.text.slice(0, 40)}"`);
    }
  }
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
        // Claim-safe (the default) is judged on the material it may use; the site's-claims mode
        // on the full site.
        for (const safe of [true, false]) {
          const plan = planFromSite(site, { aspect: "16:9", length, template, angle, seed: 7, safe });
          results.push({ name: `site:${id} ${length}/${angle}/${template}${safe ? "" : " +claims"}`, ...score(plan, LENGTH_SECONDS[length], safe ? safeSite(site) : stripHealth(site), safe) });
        }
      }
}
// Vertical cuts and take variety ("3 more takes" should give genuinely different films).
for (const { id, site } of SITES) {
  for (const template of ["midnight", "paper", "kinetic"]) {
    const plan = planFromSite(site, { aspect: "9:16", length: "standard", template, angle: "story", seed: 7 });
    results.push({ name: `site:${id} 9:16/${template}`, ...score(plan, LENGTH_SECONDS.standard, safeSite(site)) });
  }
  for (const length of ["standard", "long"] as Length[]) {
    const takes = ANGLES.map((angle) => planFromSite(site, { aspect: "16:9", length, template: "midnight", angle, seed: 7 }));
    const arcs = takes.map((p) => p.scenes.map((s) => s.role).join(">"));
    const issues: Issue[] = [];
    const same = arcs.length - new Set(arcs).size;
    if (same) issues.push({ metric: "takes", points: 3 * same, msg: `${same + 1} of 3 takes have the same arc` });
    if (new Set(takes.map((p) => norm(p.scenes[0].text))).size === 1) issues.push({ metric: "takes", points: 2, msg: "all takes open on the same line" });
    results.push({ name: `takes:${id} ${length}`, score: Math.max(0, 100 - issues.reduce((a, i) => a + i.points, 0)), issues });
  }
}
for (const prompt of PROMPTS)
  for (const length of LENGTHS)
    for (const template of ["midnight", "paper", "kinetic", "spatial"]) {
      const plan = planFromPrompt({ prompt, aspect: "16:9", length, template, style: "saas", seed: 7, safe: true });
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
