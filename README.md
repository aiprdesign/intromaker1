# IntroMaker — prompt → epic motion graphics

IntroMaker is a SaaS web app that turns a text prompt into a cinematic motion-graphics video. You can use it for intros, trailers, launch promos and social reels.

- **19 motion skills**: God Rays, Glass Shatter, Warp Tunnel, 3D Flip, Particle Vortex, Hyperspace Punch, Kinetic Slam, Glitch Decode, Shockwave, Liquid Mesh, Retrowave, Neon Ignite, Orbital Core, Stat Counter, Cinematic Title, Block Cascade, Split Sweep, Shape Burst and HUD Interface.
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
| `/skills` | All 19 skills rendered live, with a palette switcher |
| `/studio` | The editor. Accepts `?prompt=…`, `?skill=…&palette=…`, or `#plan=…` (shared links) |
| `POST /api/generate` | `{ prompt, aspect, length, palette?, seed? }` → `{ plan, engine }` |

## Architecture

```
src/engine/
  types.ts        VideoPlan / Scene / Skill contracts
  skills/         the 19 skills (typography.ts, energy.ts, worlds.ts, signature.ts); each is a pure render(ctx, t)
  renderer.ts     timeline, beat camera, transitions (cut/flash/zoom/glitch/wipe/whip/dolly/leak/shutter), finishing pass
  planner.ts      built-in director + plan sanitising + share-link encoding
  audio.ts        procedural trailer score arranged to the storyboard (WebAudio)
  export.ts       MediaRecorder capture of canvas + audio
src/app/api/generate/route.ts   Claude AI Director (structured output), falls back to planner.ts
```

Every skill is a deterministic function of time: it takes a seeded RNG and no per-frame state. That means scrubbing, looping previews and export all produce identical frames.

### Adding a skill

1. Write a `render(sc: SkillContext)` function in `src/engine/skills/`. Use the helpers in `fx.ts`: `background`, `headline`, `subline`, `exitT` and so on.
2. Add its id to `SKILL_IDS` in `types.ts`.
3. Register it in `skills/index.ts`. The AI Director picks it up automatically from its `bestFor` description.

## Notes

- The pricing tiers on the landing page are marketing UI only. Auth and billing are not wired up.
- Export records in real time, so keep the tab visible while it renders.
