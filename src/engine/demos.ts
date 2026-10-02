import type { VideoPlan } from "./types";

export const HERO_PLAN: VideoPlan = {
  title: "IntroMaker",
  palette: "cosmos",
  font: "inter",
  aspect: "16:9",
  bpm: 120,
  seed: 4242,
  style: "saas",
  scenes: [
    { skill: "blur-reveal", text: "Turn a prompt into a *launch film*", items: ["Introducing IntroMaker"], duration: 3.5, transition: "cut" },
    { skill: "word-swap", text: "Make intros|trailers|launch films|promos", subtext: "Or paste your website URL", duration: 4, transition: "dolly" },
    {
      skill: "bento",
      text: "Made in *one studio*",
      items: ["AI director", "57 motion skills", "Website import", "Beat-synced score", "Video export", "Vertical & square"],
      duration: 5,
      transition: "whip",
    },
    { skill: "cta", text: "Make yours *now*", subtext: "Try for Free!", duration: 4, transition: "dolly" },
  ],
};

/**
 * The homepage backdrop: product UI turning on a 3D carousel, then flowing through GPU
 * transitions, with no words competing with the headline on top of it.
 */
export const HOME_BACKDROP: VideoPlan = {
  title: "IntroMaker",
  palette: "cosmos",
  font: "inter",
  aspect: "16:9",
  bpm: 120,
  seed: 4242,
  style: "saas",
  scenes: [
    { skill: "carousel-3d", text: "", duration: 7, transition: "cut" },
    { skill: "gallery-flow", text: "", duration: 6, transition: "dissolve" },
  ],
};

export const EXAMPLE_PROMPTS = [
  'Launch video for "Lumetrik", an analytics app for product teams. Dashboards, AI insights, team sharing',
  'Cyberpunk launch trailer for "VEKTORA AI", an AI copilot for developers. Code suggestions, reviews, launching 2026',
  'Gold intro for a watch brand called "AURUM" — craftsmanship, Swiss made',
  "Gaming channel intro for SHADOWSTRIKE with toxic green energy, headshots and victory",
  "Retro 80s synthwave music festival teaser for NEON NIGHTS, live DJs all night",
  'Space documentary opener "BEYOND ORBIT" about a mission to Mars',
  'Playful summer app launch for "SPLASH" — make friends, share moments',
];
