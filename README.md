# IntroMaker — prompt → epic motion graphics

IntroMaker is a SaaS web app that turns a text prompt into a cinematic motion-graphics video. You can use it for intros, trailers, launch promos and social reels.

- **Website → intro**: paste a URL and IntroMaker imports the site's name, tagline, feature headlines, stats, call to action, logo, screenshots, product videos and brand colours, then storyboards a launch film around them. The film follows a hook, logo, a product tour of the real UI, a features bento, proof (real testimonials and customer logos only), integrations, and a CTA with the site's own button label.
- **SaaS launch-film mode**: modelled on today's best product videos. It uses sentence-case blur reveals with gradient accent words, rotating word swaps, a cursor-driven UI zoom tour with callouts, bento feature grids with live micro-animations, floating glass UI widgets, pain-to-solution strikes, an integration orbit, real testimonials, a customer-logo marquee and a CTA button that the cursor clicks. It has a grid, spotlight and beam backdrop, spring physics and glass cards with animated border beams, and is scored with an upbeat track plus UI sound effects synced to every click, pop and whoosh.
- **Two styles**: *SaaS launch* (auto-selected for websites and product prompts) or *Epic trailer*.
- **33 motion skills**: Blur Reveal, Word Swap, UI Zoom Tour, Bento Grid, Floating UI, Pain → Solution, Integration Orbit, Testimonial, Trusted By, CTA Lock-up, Logo Reveal, Product Showcase, Photo Montage, Screen Wall, God Rays, Glass Shatter, Warp Tunnel, 3D Flip, Particle Vortex, Hyperspace Punch, Kinetic Slam, Glitch Decode, Shockwave, Liquid Mesh, Retrowave, Neon Ignite, Orbital Core, Stat Counter, Cinematic Title, Block Cascade, Split Sweep, Shape Burst and HUD Interface.
- **AI Director**: Claude storyboards the prompt into a hook, a title reveal, feature beats and an outro. It picks the skills, palette, typeface and tempo. When no API key is set, a built-in rule-based director does the same job offline.
- **Live studio**: preview, scrub, edit each scene's text, skill, timing and transition, switch palettes and formats (16:9, 9:16, 1:1), remix, and share a link.
- **Generated trailer score**: a WebAudio synth follows the storyboard, playing a minor chord progression with bass, sidechain-pumped pads, a half-time hook that builds into the full groove, trailer braams on the title and outro, risers and reverse swells into each cut, and a reverb tail at the end.
- **Beat-synced direction**: scene lengths snap to whole beats, so every cut lands on the kick. A virtual camera drifts handheld and punches in on each beat.
- **Cinematic finishing**: two-scale highlight bloom, a colour grade, light leaks, lens bokeh, extruded 3D type, vignette and film grain.
- **Export**: records 1080p or 720p video at 60 fps (MP4 where the browser supports it, WebM otherwise) with the soundtrack mixed in. Rendering happens entirely in the browser.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY to enable the Claude AI Director
npm run dev                  # http://localhost:3000
```

| Route | What it is |
|---|---|
| `/` | Landing page with a live hero render, the skill showcase, how it works and pricing |
| `/skills` | All 33 skills rendered live, with a palette switcher |
| `/studio` | The editor. Accepts `?prompt=…`, `?skill=…&palette=…`, or `#plan=…` (shared links) |
| `/studio?url=…` | Imports a website and generates an intro from it |
| `POST /api/scrape` | `{ url }` → `{ site }`: brand, copy and asset URLs extracted from a web page |
| `GET /api/asset?url=…` | Same-origin image/video proxy (with Range support) so website media can be drawn and exported |
| `POST /api/generate` | `{ prompt, aspect, length, palette?, seed?, site?, colors? }` → `{ plan, engine }` |

## Architecture

```
src/engine/
  types.ts        VideoPlan / Scene / Skill contracts
  skills/         the 33 skills (saas.ts, typography.ts, energy.ts, worlds.ts, signature.ts, media.ts); each is a pure render(ctx, t)
  saasfx.ts       SaaS design toolkit: springs, grid/beam backdrop, glass cards, border beams, cursor, icons, blur-in type
  media.ts        website image/video cache, frame-exact video sync for export, logo + brand-colour analysis
  renderer.ts     timeline, beat camera, transitions (cut/flash/zoom/glitch/wipe/whip/dolly/leak/shutter), finishing pass
  planner.ts      built-in director + plan sanitising + share-link encoding
  audio.ts        procedural trailer score arranged to the storyboard (WebAudio)
  export.ts       MediaRecorder capture of canvas + audio
src/app/api/generate/route.ts   Claude AI Director (structured output), falls back to planner.ts
src/lib/scrape.ts               website extraction (name, copy, features, stats, CTA, testimonials, customer logos, logo, images, videos, theme colour)
src/lib/netguard.ts             SSRF guard: only public http(s) hosts, re-checked on every redirect
```

Every skill is a deterministic function of time: it takes a seeded RNG and no per-frame state. That means scrubbing, looping previews and export all produce identical frames.

### Adding a skill

1. Write a `render(sc: SkillContext)` function in `src/engine/skills/`. Use the helpers in `fx.ts`: `background`, `headline`, `subline`, `exitT` and so on.
2. Add its id to `SKILL_IDS` in `types.ts`.
3. Register it in `skills/index.ts`. The AI Director picks it up automatically from its `bestFor` description.

## Notes

- Website import fetches pages server-side and blocks private and internal addresses. For local testing against `localhost` sites, set `INTROMAKER_ALLOW_PRIVATE_URLS=1`.

- The pricing tiers on the landing page are marketing UI only. Auth and billing are not wired up.
- Export renders every frame offline with WebCodecs (Chrome, Edge, Safari 17+), so videos come out smooth and exactly the right length on any machine. Other browsers fall back to real-time recording.
