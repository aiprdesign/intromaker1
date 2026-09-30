/**
 * Copy rules the directors rely on: the end card's button is worded for the intro's content,
 * "free" is only offered when the copy really offers it, and site buttons are cleaned.
 * Run: npm run check:copy
 */
import { mentionsOffer, offerKey, offersIn } from "../src/engine/claims";
import { cleanCta, contextCta, lowerFirst, offersFree } from "../src/engine/planner";

let failed = 0;
const check = (ok: boolean, what: string) => {
  if (!ok) failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${what}`);
};
const site = (tagline: string, extra: Partial<{ name: string; cta: string | null; description: string; headlines: string[]; features: string[] }> = {}) => ({
  name: extra.name ?? "Acme",
  cta: extra.cta ?? null,
  tagline,
  description: extra.description ?? "",
  headlines: extra.headlines ?? [],
  features: extra.features ?? [],
});

console.log("Free offers");
for (const t of ["Free plan for small teams", "Try it free for 14 days", "Start free, no credit card", "Get started for free", "Free forever for individuals", "Sign up free"]) check(offersFree(t), `offer: "${t}"`);
for (const t of ["Hassle-free invoicing", "Free up your time", "Error-free reports", "Free of charge setup? Ask sales", "Feel free to reach out", "Toll-free support line", "Freedom to build", "Gluten-free recipes"]) check(!offersFree(t) || /charge/.test(t), `not an offer: "${t}"`);

console.log("Button labels");
const cases: [ReturnType<typeof site>, string | undefined, string][] = [
  [site("Deploy apps from git with our API and CLI"), undefined, "Start building"],
  [site("Online courses to learn design, for students of all levels"), undefined, "Start learning"],
  [site("Book an appointment at our salon online"), undefined, "Book now"],
  [site("The dog-walking app on the App Store and Google Play"), undefined, "Download the app"],
  [site("A CRM for enterprise sales teams. Book a demo."), undefined, "Book a demo"],
  [site("A new music tool, coming soon. Join early access."), undefined, "Join the waitlist"],
  [site("Budgeting with a 14-day free trial"), undefined, "Start free trial"],
  [site("Hassle-free invoicing for freelancers"), "fintech", "Open an account"],
  [site("Store your files securely in the cloud"), "security", "Get protected"],
  [site("Download detailed reports in one click"), "analytics", "See your data"],
  [site("Plan projects with your team"), "productivity", "Get organised"],
  [site("Plan projects with your team"), undefined, "Get started"],
  [site("Sell more", { name: "ShopStack" }), "sales", "Book a demo"],
  [site("Everything you need", { cta: "START FREE TRIAL →" }), undefined, "START FREE TRIAL"],
  [site("Hassle-free invoicing", { cta: "Try for Free!" }), "fintech", "Try for Free!"],
  [site("Everything you need", { cta: "Try it free — no credit card" }), undefined, "Try it free — no credit card"],
  // The site's own "free" button is its own offer, even when other copy says "hassle-free".
  [site("Hassle-free payroll", { cta: "Try it free" }), "hr", "Try it free"],
  [site("Free plan for teams", { cta: "Try it free" }), undefined, "Try it free"],
  [site("Great tool", { cta: "Click here to get started with our amazing platform today" }), undefined, "Get started"],
  [site("Great tool", { cta: "🚀 Get started" }), undefined, "Get started"],
];
for (const [s, concept, want] of cases) {
  const got = contextCta(s, concept);
  check(got === want, `${JSON.stringify(s.tagline)}${s.cta ? ` [site button ${JSON.stringify(s.cta)}]` : ""}${concept ? ` (${concept})` : ""} → ${JSON.stringify(got)}${got === want ? "" : `, expected ${JSON.stringify(want)}`}`);
}

console.log("Cleaning");
check(cleanCta("  Get started  →") === "Get started", "arrows and spaces trimmed");
check(cleanCta("SIGN UP FREE") === "SIGN UP FREE" && cleanCta("Try for Free!") === "Try for Free!", "the site's wording is kept exactly");
check(cleanCta("Try the API") === "Try the API", "acronyms stay");
check(cleanCta("→") === null && cleanCta("") === null, "empty labels are dropped");
check(lowerFirst("Book a demo") === "book a demo" && lowerFirst("API access") === "API access" && lowerFirst("GitHub login") === "GitHub login", "'Scan to …' keeps acronyms and names");

console.log("Offers the maker must confirm");
for (const t of ["Try for Free!", "Start free trial", "Get 50% off", "No credit card required", "30-day money-back guarantee", "Free plan", "Use code LAUNCH for a discount"]) check(mentionsOffer(t), `asks to confirm: "${t}"`);
for (const t of ["Hassle-free invoicing", "Book a demo", "Get started", "Free up your team", "Error-free reports"]) check(!mentionsOffer(t), `no offer: "${t}"`);
const film = { scenes: [{ text: "Plan *faster*" }, { text: "Hassle-free payroll" }, { text: "Start today", subtext: "Try for Free!" }] };
const found = offersIn(film);
check(found.length === 1 && found[0].scene === 2 && found[0].text === "Try for Free!", "the end card's offer is found on its slide");
check(offerKey("Try for Free!") === offerKey("try for free") && offerKey("Try for Free!") !== offerKey("Try for $5"), "a confirmation covers the same words, not edited ones");

console.log(failed ? `\n${failed} check(s) failed` : "\nAll copy checks passed");
process.exit(failed ? 1 : 0);
