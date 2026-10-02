/**
 * Director audit: prints the storyboard the built-in director writes for a varied set of prompts
 * (SaaS launches, physical products, trailers), slide by slide with every line on screen and the
 * narration, so copy problems (cut-off names, repeated lines, leaked prompt text, the wrong demo
 * for the product) can be read at a glance. Kaizen scores films; this is for reading them.
 *
 *   npm run audit:director              # standard length
 *   npm run audit:director -- long      # short | standard | long
 */
import { planFromPrompt, planFromSite, productFromPrompt, type Length } from "../src/engine/planner";
import type { VideoPlan } from "../src/engine/types";

const SAAS = [
  'Launch video for "Pulse", an analytics app for product teams. Dashboards, AI insights, team sharing',
  "Nimbus is a developer platform with instant rollbacks, preview URLs and edge functions",
  "Ledgerly: business banking, corporate cards and automated expenses for startups",
  "Meet Harbor, the AI assistant that writes your emails and summarises your meetings",
  "Shopwave helps brands sell online with beautiful stores, fast checkout and easy shipping",
  "A productivity app",
  "Tidy is a shared inbox for customer support teams with canned replies, SLAs and a help center",
  "Frame: a design tool for teams to prototype, comment and hand off to developers",
];
const PRODUCT: [string, number][] = [
  ["Halo smart water bottle with a temperature display on the cap. Screw-top lid, carry loop, brushed steel cap, keeps drinks cold", 3],
  ["Aero Buds wireless earbuds with noise cancelling, all-day battery, water resistant and a pocket charging case", 0],
  ["Ember ceramic mug that keeps coffee at your chosen temperature, app control, 80 minute battery", 0],
];
const TRAILER = [
  'Cyberpunk launch trailer for "NOVA AI", an AI copilot for developers. Code suggestions, reviews, launching 2026',
  "Gaming channel intro for SHADOWSTRIKE with toxic green energy, headshots and victory",
  'Space documentary opener "BEYOND ORBIT" about a mission to Mars',
  'Gold intro for a watch brand called "AURUM" — craftsmanship, Swiss made',
];

const length = (process.argv[2] ?? "standard") as Length;
const show = (label: string, p: VideoPlan) => {
  const secs = p.scenes.reduce((a, s) => a + s.duration, 0);
  console.log(`\n=== ${label}\n    [${p.template ?? p.trailerStyle ?? ""} · ${p.palette} · ${p.font}] ${secs.toFixed(1)}s`);
  for (const s of p.scenes)
    console.log(`  ${(s.role ?? "").padEnd(8)} ${s.skill.padEnd(17)} ${s.duration.toFixed(1)}s | ${s.eyebrow ? `[${s.eyebrow}] ` : ""}${s.text}${s.subtext ? ` // ${s.subtext}` : ""}${s.items?.length ? `  {${s.items.join(" | ")}}` : ""}`);
  console.log(`  VO: ${p.scenes.map((s) => s.vo).filter(Boolean).join(" / ")}`);
  for (const n of p.notes ?? []) console.log(`  note: ${n}`);
};
for (const pr of SAAS) show(pr, planFromPrompt({ prompt: pr, aspect: "16:9", length }));
// (Photo URLs stand in for uploads: the storyboard only needs to know how many there are.)
for (const [pr, n] of PRODUCT) show(pr, planFromSite(productFromPrompt(pr, Array.from({ length: n }, (_, i) => `https://example.com/photo-${i}.jpg`)), { aspect: "16:9", length }));
for (const pr of TRAILER) show(pr, planFromPrompt({ prompt: pr, aspect: "16:9", length, style: "trailer" }));
