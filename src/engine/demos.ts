import type { VideoPlan } from "./types";

export const HERO_PLAN: VideoPlan = {
  title: "IntroMaker",
  palette: "cyber",
  font: "grotesk",
  aspect: "16:9",
  bpm: 124,
  seed: 4242,
  scenes: [
    { skill: "hyperspace", text: "TYPE A PROMPT", duration: 2.6, transition: "cut" },
    { skill: "particle-assemble", text: "GET EPIC", subtext: "motion graphics", duration: 3.4, transition: "flash" },
    { skill: "kinetic-slam", text: "IN SECONDS", duration: 2.6, transition: "zoom" },
    { skill: "glitch-reveal", text: "15 SKILLS", subtext: "one prompt", duration: 2.6, transition: "glitch" },
    { skill: "cinematic-title", text: "INTROMAKER", subtext: "Prompt to motion", duration: 3.4, transition: "zoom" },
  ],
};

export const EXAMPLE_PROMPTS = [
  'Epic cyberpunk launch trailer for "NOVA AI", an AI copilot for developers. 10M+ users, ship faster, launching 2026',
  'Luxury gold intro for a watch brand called "AURUM" — timeless craftsmanship, Swiss made',
  "Hype gaming channel intro for SHADOWSTRIKE with toxic green energy, headshots and victory",
  "Retro 80s synthwave music festival teaser for NEON NIGHTS, live DJs all night",
  'Space documentary opener "BEYOND ORBIT" about the first mission to Mars',
  'Playful summer app launch for "SPLASH" — make friends, share moments, 500K downloads',
];
