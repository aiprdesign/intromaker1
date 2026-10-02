import { TEMPLATE_MAP } from "./templates";
import type { Scene, VideoPlan } from "./types";

/**
 * Sample films for the homepage: what IntroMaker makes for a SaaS launch, a physical product and a
 * trailer. The brands are imaginary (Lumetrik, Kelvo, The Lantern Deep) and the product photos are illustrations
 * made for these samples (public/samples). Each one strings together the slides that show the
 * engine at its best for that kind of film.
 */

/** A film in a template's look (palette, type, tempo, score) with its slides kept as chosen. */
function inTemplate(plan: Omit<VideoPlan, "palette" | "font" | "bpm" | "scenes">, templateId: string, scenes: [Omit<Scene, "duration">, number][]): VideoPlan {
  const tpl = TEMPLATE_MAP[templateId];
  const beat = 60 / tpl.bpm;
  return {
    ...plan,
    template: tpl.id,
    palette: tpl.palette,
    font: tpl.font,
    bpm: tpl.bpm,
    style: "saas",
    music: tpl.music,
    flavor: tpl.flavor,
    look: tpl.look,
    scenes: scenes.map(([s, beats]) => ({ ...s, duration: beats * beat })),
  };
}

export const SAAS_SAMPLE: VideoPlan = inTemplate(
  { title: "Lumetrik", aspect: "16:9", seed: 1207, brand: { name: "Lumetrik", domain: "lumetrik.app", images: [], videos: [] }, concept: "analytics" },
  "midnight",
  [
    [{ role: "hook", skill: "blur-reveal", text: "Your metrics, *finally clear*.", eyebrow: "Introducing Lumetrik", subtext: "Analytics for product teams", transition: "cut" }, 8],
    [{ role: "problem", skill: "pain-strike", text: "There's a *better* way.", items: ["Scattered dashboards", "Weekly CSV exports", "Guesswork"], transition: "dolly" }, 10],
    [{ role: "demo", skill: "ui-tour", text: "Every metric, *one view*", eyebrow: "The product", items: ["Live funnels", "Shared reports"], transition: "whip" }, 12],
    [{ role: "features", skill: "ai-prompt", text: "Just *ask*.", subtext: "Here's what changed:", items: ["Why did signups dip on Tuesday?", "Mobile checkout errors rose after Monday's release", "Fix shipped, checkout back to normal", "A summary is ready for your team"], transition: "dolly" }, 12],
    [{ role: "features", skill: "chart-grow", text: "Growth you can *see*", subtext: "12,480 weekly active users", transition: "push" }, 9],
    [{ role: "features", skill: "live-cursors", text: "Built for *teams*", subtext: "Looks great, let's ship it", items: ["Q3 roadmap", "Funnel review", "Launch metrics", "Release notes"], transition: "dolly" }, 10],
    [{ role: "features", skill: "integrations", text: "Works with *your stack*", transition: "whip" }, 8],
    [{ role: "cta", skill: "cta", text: "Start with *Lumetrik*", subtext: "Get started", transition: "dolly" }, 8],
  ],
);

const KELVO = ["/samples/kelvo-front.jpg", "/samples/kelvo-angle.jpg", "/samples/kelvo-back.jpg"];
const photo = (i: number) => ({ src: KELVO[i], kind: "image" as const });

export const PRODUCT_SAMPLE: VideoPlan = inTemplate(
  { title: "Kelvo", aspect: "16:9", seed: 3301, brand: { name: "Kelvo", images: KELVO, videos: [] }, product: true },
  "studio",
  [
    [{ role: "reveal", skill: "product-hero", text: "Kelvo", subtext: "The smart bottle with a temperature display", media: photo(0), transition: "cut" }, 8],
    [{ role: "features", skill: "product-hero", text: "Made for *every day*", eyebrow: "Why you'll love it", items: ["Temperature display", "Screw-top lid", "Carry loop"], media: photo(1), transition: "dolly" }, 14],
    [{ role: "gallery", skill: "product-spin", text: "From every *angle*", eyebrow: "Gallery", transition: "dolly" }, 12],
    [{ role: "gallery", skill: "product-zoom", text: "Every *detail*", eyebrow: "Details", items: ["Glanceable display", "Brushed steel cap", "Matte finish"], media: photo(0), transition: "whip" }, 12],
    [{ role: "cta", skill: "product-end", text: "Get yours *today*", subtext: "Shop now", media: photo(0), transition: "flash" }, 8],
  ],
);

/** A movie trailer (Thriller genre): studio card, title cards between the shots, title, billing block. */
const TRAILER_BEAT = 60 / 100;
const trailerScene = (skill: Scene["skill"], text: string, beats: number, transition: Scene["transition"], extra: Partial<Scene> = {}): Scene => ({ skill, text, duration: beats * TRAILER_BEAT, transition, ...extra });

export const TRAILER_SAMPLE: VideoPlan = {
  title: "THE LANTERN DEEP",
  palette: "steel",
  font: "jost",
  aspect: "16:9",
  bpm: 100,
  seed: 2026,
  style: "trailer",
  trailerStyle: "film-thriller",
  brand: { name: "IntroMaker Pictures", images: [], videos: [] },
  scenes: [
    trailerScene("studio-ident", "IntroMaker Pictures", 6, "cut", { subtext: "presents" }),
    trailerScene("intertitle", "This winter", 5, "cut"),
    trailerScene("split-wipe", "A lighthouse goes dark", 5, "shutter"),
    trailerScene("intertitle", "Its keeper is gone", 5, "cut"),
    trailerScene("glitch-reveal", "A storm is coming", 5, "flash"),
    trailerScene("intertitle", "Nothing is what it seems", 5, "cut"),
    trailerScene("cinematic-title", "The Lantern Deep", 7, "shutter"),
    trailerScene("billing-block", "The Lantern Deep", 9, "cut", { subtext: "Coming soon", items: ["IntroMaker Pictures presents", "A film by IntroMaker Pictures"] }),
  ],
};

export const SAMPLE_FILMS = [
  {
    id: "saas",
    label: "SaaS launch",
    plan: SAAS_SAMPLE,
    blurb: "Lumetrik is an imaginary analytics app. Its launch film covers a hook, the problem, a product tour, an AI answer, live charts, teamwork, integrations and a call to action.",
    prompt: 'Launch video for "Lumetrik", an analytics app for product teams. Dashboards, AI insights, team sharing',
  },
  {
    id: "product",
    label: "Product video",
    plan: PRODUCT_SAMPLE,
    blurb: "Kelvo is an imaginary smart bottle. From three photos the film builds the reveal, feature callouts, every angle, close-ups and an end card.",
    prompt: 'Product video for "Kelvo", a smart water bottle with a temperature display on the cap. Screw-top lid, carry loop, brushed steel cap',
  },
  {
    id: "trailer",
    label: "Trailer",
    plan: TRAILER_SAMPLE,
    blurb: "The Lantern Deep is an imaginary thriller. Its trailer is cut like a film's: a studio card, title cards between the shots, the title and a billing block, in widescreen.",
    prompt: 'Thriller film "THE LANTERN DEEP" from IntroMaker Pictures: a lighthouse goes dark, its keeper is gone, a storm is coming',
  },
] as const;
