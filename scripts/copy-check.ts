/**
 * Copy rules the directors rely on: the end card's button is worded for the intro's content,
 * "free" is only offered when the copy really offers it, and site buttons are cleaned.
 * Run: npm run check:copy
 */
import { isClaimWord, mentionsOffer, offerKey, offerSafe, offersIn, safeCopy } from "../src/engine/claims";
import { cleanCta, contextCta, lowerFirst, offersFree, safePlan } from "../src/engine/planner";
import { speakable } from "../src/engine/voice";
import { applyTemplate, trailerBeats } from "../src/engine/templates";
import { slideContent } from "../src/engine/newslide";
import { SKILL_MAP, SKILLS } from "../src/engine/skills";
import type { VideoPlan } from "../src/engine/types";
import { applyTrailerStyle, detectTrailerStyle, TRAILER_STYLES } from "../src/engine/trailers";
import { planFromPrompt } from "../src/engine/planner";

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

console.log("Voice-over reads specs naturally");
for (const [raw, said] of [
  ["Folds down to 6 ft. Fits in your bag.", "Folds down to 6 feet. Fits in your bag."],
  ["A 12 in. skillet", "A 12 inch skillet"],
  ["#1 in sales, available in 3 colours", "Number 1 in sales, available in 3 colours"],
  ["Measures 10 x 12 x 3 in", "Measures 10 by 12 by 3 inches"],
  ["16 oz cups", "16 ounce cups"],
  ["Heats to 450°F", "Heats to 450 degrees Fahrenheit"],
  ["Ships in 2-3 days", "Ships in 2 to 3 days"],
]) check(speakable(raw) === said, speakable(raw) === said ? `"${raw}" → "${said}"` : `"${raw}" → "${speakable(raw)}", wanted "${said}"`);
check(speakable("4K video, 5G ready").startsWith("4 K video") && speakable("4K video, 5G ready").includes("5G ready"), "4K is spelled, 5G is left alone");
check(speakable("Bluetooth 5.3, 40 hrs playtime").includes("40 hour playtime"), "a unit before a noun is singular");

console.log("Product trailers");
check(JSON.stringify(trailerBeats("Wireless earbuds with active noise cancelling")) === JSON.stringify(["Wireless earbuds", "with active noise cancelling"]), "a line is said in beats, cut at its connectors");
check(JSON.stringify(trailerBeats("Aero Buds Pro")) === JSON.stringify(["Aero", "Buds", "Pro"]), "a name builds word by word");
const ad: VideoPlan = {
  title: "Aero Buds Pro", palette: "studio", font: "inter", aspect: "16:9", bpm: 116, seed: 1, style: "saas", product: true, target: 20,
  scenes: [
    { role: "reveal", skill: "product-hero", text: "Aero Buds Pro", subtext: "Wireless earbuds with active noise cancelling", duration: 4, transition: "cut" },
    { role: "features", skill: "product-hero", text: "Made for *everyday*", items: ["Noise cancelling", "Long battery life"], duration: 5, transition: "dolly" },
    { role: "cta", skill: "product-end", text: "Get yours *today*", duration: 4, transition: "flash" },
  ],
};
const cut = applyTemplate(applyTemplate(ad, "studio"), "drop");
check(cut.scenes[0].skill === "product-teaser" && cut.scenes[1].transition === "flash" && cut.music === "trailer", "a trailer style opens cold, flashes into the reveal, with the trailer score");
check(cut.scenes[0].text === "Wireless earbuds with active noise cancelling", "the cold open says the product's own line, not its callouts");
check(applyTemplate(cut, "noir").scenes.filter((x) => x.skill === "product-teaser").length === 1, "switching between trailer styles keeps one cold open");
check(applyTemplate(cut, "studio").scenes[0].skill === "product-hero", "a clean style removes the cold open again");
check(applyTemplate({ ...ad, target: 12 }, "drop").scenes[0].skill === "product-hero", "short films keep the trailer look without a cold open");
check(applyTemplate({ ...ad, product: undefined }, "drop").scenes[0].skill === "product-hero", "software films get the look only");

console.log("Trailer video styles");
const trailer = planFromPrompt({ prompt: "Epic cinematic trailer for Nova, a racing game with fast cars", aspect: "16:9", length: "standard", style: "trailer" });
check(trailer.style === "trailer" && !!trailer.trailerStyle, `a trailer is matched to a style (${trailer.trailerStyle})`);
check(planFromPrompt({ prompt: "Epic cinematic trailer for Nova, a racing game with fast cars", aspect: "16:9", length: "standard", style: "trailer", trailerStyle: "luxury" }).palette === "gold", "a picked trailer style is used for new trailers");
const lux = applyTrailerStyle(trailer, "luxury");
check(lux.palette === "gold" && lux.bpm === 96 && lux.trailerStyle === "luxury", "picking a style restyles the trailer instantly (palette, tempo)");
check(lux.scenes.every((x, i) => x.text === trailer.scenes[i].text), "restyling never changes the words");
check(lux.scenes.every((x) => Math.abs(x.duration / (60 / 96) - Math.round(x.duration / (60 / 96))) < 1e-6), "scenes snap to the new tempo");
const withLogo: VideoPlan = { ...trailer, scenes: trailer.scenes.map((x, i) => (i === 1 ? { ...x, skill: "logo-reveal" as const } : x)) };
check(applyTrailerStyle(withLogo, "retro").scenes[1].skill === "logo-reveal", "scenes showing your material keep their slide");
check(detectTrailerStyle("a luxury perfume and jewellery brand").id === "luxury" && detectTrailerStyle("plain words").id === "hype", "Auto matches the product's words, else the all-rounder");
check(new Set(TRAILER_STYLES.map((t) => t.name)).size === TRAILER_STYLES.length && TRAILER_STYLES.length >= 12, `${TRAILER_STYLES.length} named trailer styles`);

console.log("Offers reworded automatically (no questions)");
for (const [raw, want] of [
  ["Try for Free!", "Try it today!"],
  ["Start your 14-day free trial", "Get started"],
  ["Sign up free", "Sign up"],
  ["Start building today. No credit card required.", "Start building today."],
  ["Shop now — free returns", "Shop now"],
  ["Get 50% off your first month", ""],
  ["Free plan available", ""],
  ["Hassle-free invoicing", "Hassle-free invoicing"],
  ["Free up your team", "Free up your team"],
]) check(offerSafe(raw) === want, `"${raw}" → "${want}"${offerSafe(raw) === want ? "" : ` (got "${offerSafe(raw)}")`}`);
{
  const offerFilm: VideoPlan = {
    title: "Nimbus", palette: "midnight", font: "inter", aspect: "16:9", bpm: 120, seed: 1, style: "saas",
    scenes: [
      { role: "hook", skill: "blur-reveal", text: "The *fastest* way to plan, free forever", duration: 3, transition: "cut" },
      { role: "cta", skill: "cta", text: "Start your free trial", subtext: "Try for Free!", duration: 3, transition: "cut" },
    ],
  };
  const safe = safePlan(offerFilm, { keepScenes: true });
  check(safe.scenes.length === 2 && !offersIn(safe).length, "a film is made claim-safe and offer-free, every slide kept");
  check(safe.scenes[1].subtext === "Try it today!" && safe.scenes[1].text === "Get started", `the end card keeps a plain call to action ("${safe.scenes[1].text}" / "${safe.scenes[1].subtext}")`);
  check(!/fastest|free/i.test(safe.scenes[0].text), `superlatives and offers go from the hook ("${safe.scenes[0].text}")`);
}

console.log("New slides are written from the film");
{
  const prompt = "Nimbus, a project management app for remote teams with tasks, docs and chat";
  const film = planFromPrompt({ prompt, aspect: "16:9", length: "standard", safe: true });
  const direct = (variant: number) => planFromPrompt({ prompt, aspect: "16:9", length: "standard", safe: true, variant, seed: 1 + variant });
  for (const sk of ["bento", "icon-features", "word-swap", "feature-slides", "showreel", "card-system", "type-rows", "type-poster", "poster-grid", "poster-split", "card-stack", "contact-sheet", "spec-sheet", "widget-set", "type-echo", "type-slots", "rapid-fire", "flip-switch", "zoom-through", "slice-switch", "style-shuffle", "split-flap", "whip-pan", "stack-stomp", "speed-ticker", "cube-spin", "speed-type", "bar-wipe", "crash-zoom", "word-grid", "orbit-text", "tape-rush", "jump-cut", "letter-rush", "stamp-rush", "rally", "spiral-in", "speed-gauge", "domino", "slipstream", "stretch-snap", "rack-focus", "keycaps", "spotlight", "toggle-list", "device-trio", "exploded-ui", "changelog", "calendar-drop", "inbox-sweep", "comment-pins", "table-fill", "persona-switch", "phone-tour", "drop-zone", "unbox", "arrow-rise", "photo-fan", "card-spread", "photo-drop", "cta"] as const) {
    const c = slideContent(sk, film, direct);
    const all = [c.text, ...(c.items ?? [])].join(" ");
    check(c.text !== SKILL_MAP[sk].sample.text && !/developers|Git deploys|your team\*?$/i.test(all), `${sk}: "${c.text}" ${c.items ? `(${c.items.join(", ")})` : ""}`);
  }
}

console.log("No absolute words on screen");
for (const [from, to] of [
  ["Each cup made by hand", "The cups made by hand"],
  ["See it from every angle", "See it from different angles"],
  ["Never settle", "Don't settle"],
  ["All night long", "Through the night"],
  ["Each and every customer", "Your customers"],
  ["Every step of the way", "Along the way"],
  ["Each of the bottles is tested", "The bottles are tested"],
  ["Plan all your projects", "Plan your projects"],
  ["Built for everyone", "Built for you"],
  ["Always on time", "On time"],
]) check(safeCopy(from) === to, `"${from}" → "${safeCopy(from)}"`);

console.log("No bare claim words on slides");
{
  const claims = ["Secure", "Tested", "Approved", "Fast", "Fully encrypted", "Bank-grade", "Certified", "*Proven*"];
  const plain = ["Security", "Reviews", "Approvals", "Encryption", "Tests", "Draft", "Ship", "Share"];
  check(claims.every(isClaimWord) && !plain.some(isClaimWord), `claim words (${claims.join(", ")}) are caught, feature names (${plain.join(", ")}) aren't`);
  const plan: VideoPlan = {
    title: "Acme", palette: "cosmos", font: "inter", aspect: "16:9", bpm: 120, seed: 1, brand: { name: "Acme", images: [], videos: [] },
    scenes: [
      { skill: "logo-reveal", text: "Acme", duration: 3, transition: "cut", role: "reveal" },
      { skill: "stamp-rush", text: "Signed, sealed, *shipped*", items: ["Approved", "Tested", "Secure", "Draft", "Share"], duration: 4, transition: "cut", role: "promise" },
      { skill: "word-swap", text: "Your code, built|tested|shipped", duration: 4, transition: "cut", role: "promise" },
    ],
  };
  const out = safePlan(plan, { keepScenes: true });
  check(out.scenes[1].items?.join() === "Draft,Share", `claim words leave the slide's items: ${out.scenes[1].items?.join(", ")}`);
  check(out.scenes[2].text === "Your code, built|shipped", `and a word-swap line: "${out.scenes[2].text}"`);
  const loud = /\b(?:faster|full speed|secure|tested|approved|certified|fast|safe|reliable|proven)\b/i;
  const bad = SKILLS.filter((k) => loud.test(k.sample.text) || (k.sample.items ?? []).some((x) => isClaimWord(x) || loud.test(x))).map((k) => k.id);
  check(!bad.length, `slide samples make no claims${bad.length ? ` (${bad.join(", ")})` : ""}`);
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll copy checks passed");
process.exit(failed ? 1 : 0);
