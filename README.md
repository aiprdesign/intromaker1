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
- **Export presets**: YouTube 1080p60, Reels/TikTok/Shorts 9:16, LinkedIn/Instagram 1:1 and web 720p. The same storyboard re-lays itself out for each format, so nothing is cropped. There's also a one-click PNG thumbnail of the end card. Output is MP4 where the browser supports it (WebM otherwise) with the soundtrack mixed in, rendered entirely in the browser.

### What makes the SaaS films look pro

- **24 style templates**, modelled on the most popular SaaS intro looks and grouped in the picker:
  - **Modern**: Midnight Grid, Aurora Gradient, Mono Pro, AI Glow.
  - **3D & Sci-Fi**: 3D Spatial (content on an orbiting 3D plane over glowing 3D panels), Sci-Fi HUD (brackets, timecode, readouts, scan lines), Synthwave 3D (neon grid floor to the horizon), Deep Space (parallax starfield and nebula), Holographic, Liquid Chrome, Neon Tech, Dev Terminal.
  - **Clean & Light**: Minimal Light, Swiss Clean (hairline layout frame), Enterprise Clean, Frosted Glass.
  - **Bold & Playful**: Bold Pop, Kinetic Type, Neo-Brutalist, Clay 3D (puffy claymorphism cards and gooey metaballs), Retro Dither.
  - **Premium**: Cinematic Keynote, Editorial Serif, Luxe Noir.

  Each style has its own palette, typeface, GPU background, card style (glass, frosted, flat, brutalist or clay), text motion (blur, mask, pop, glow or typewriter), optional 3D stage and HUD or frame overlay, transitions, music and pacing. Switching restyles the film instantly.
- **Choose your colours**: keep the template's colours, use the website's brand colours, or pick any of 20 dark and light palettes. A palette you pick survives template switches.
- **Edited like a real film**: whip pans, dolly zoom-throughs, pushes, dissolves and light leaks show the outgoing and incoming shots at the same time, and every cut lands on the beat.
- **A product tour that clicks real UI**: the screenshot (or first video frame) is analysed for its busiest interface regions, and the camera zooms and the cursor clicks there.
- **Brand polish**: an anamorphic logo reveal, a corner brand bug through the body of the film, and an end card that holds on the logo, closing line, button and URL.
- **Copy that reads like a designer wrote it**: the site's headlines are ranked for on-screen quality, the emphasis word is chosen by meaning ("*300+ tools*", "*whole team*"), bento cards carry the site's own one-line feature descriptions, and CTAs vary, including social proof ("Join *12,000+ teams*").
- **Takes**: "3 more takes" directs alternative cuts (product-first, proof-first, a fresh story) in parallel. They appear as live previews, and you click one to use it.
- **AI self-review**: the AI's draft is checked against a storyboard checklist covering arc, copy length, pacing, and invented quotes, logos or numbers. *Best* mode always critiques and revises its draft. *Balanced* revises only when the checklist fails. Anything invented that remains is removed.
- **Icons everywhere**: around 200 Lucide icons (ISC licence) drawn as crisp canvas vectors that draw themselves on. They appear in feature tiles, bento cards, steps, struck-out pains (a red ✕), chapter pills, notification widgets and the integrations orbit. Each icon is picked from the wording ("Invoices paid on time" gives a receipt, "Deploy in seconds" a rocket, "Close deals" a handshake), with the product category's icon family as the fallback.
- **Story arcs that adapt to the product**: IntroMaker detects the product type from the site or prompt and uses the launch-film arc typical of it. There are 14 types: developer tool, AI, fintech, security, analytics, sales and CRM, marketing, productivity, HR, e-commerce, health, education, creative and communication. Each type sets its own beat order, whether to open on the pain or the promise, chapter labels ("Built for developers", "Works with your stack", "Trusted by security teams"), CTA voice ("Start building", "Book a demo", "Open an account", "Start selling"), icon family and a suggested style. The AI director gets the same brief, and the studio shows what it detected, with a one-click "Use suggested style".
- **New skill: Feature Icons**, the classic SaaS feature row. Glowing icon tiles draw themselves on, each with a title and a one-line benefit.
- **60-30-10 colour rule** (default for SaaS films): 60% dominant background, 30% supporting colour for cards, panels and gradient fields, and 10% accent for highlight words, buttons, cursor and progress, in one hue. Shader gradients weight their colour spots in the same proportion, and the accent is the palette's most vivid colour. Switch to *Vibrant* in the studio for full-strength colour.
- **High-end GPU backgrounds**: animated mesh gradients, grainy gradients, silk flow, smoke rings, a neural glow and light rays, rendered frame-exactly on the GPU with the open-source [Paper Shaders](https://github.com/paper-design/shaders) (Apache-2.0). They're tinted from the palette and kept deep enough for text to stay readable. Every style has a signature background, and the studio's *Background* picker can put any gradient behind any style. Preview and export match exactly.
- **Every format**: all SaaS scenes are laid out for 16:9, 9:16 and 1:1.

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
  shaderbg.ts     WebGL2 runner for Paper Shaders gradients (frame-exact, shared context)
  templates.ts    style templates (look, motion, music, pacing, role → skill)
  export.ts       WebCodecs offline export, export presets, PNG thumbnail
src/app/api/generate/route.ts   Claude AI Director (structured output), falls back to planner.ts
src/lib/providers.ts            provider registry (endpoint, auth, key prefix, suggested models, vision)
src/lib/ai.ts                   AI director over 3 protocols (Anthropic SDK, OpenAI-compatible, Gemini) + model listing
src/lib/localai.ts              browser-side local AI (scan, test, director) for online deployments
src/lib/review.ts               storyboard checklist, self-review brief and repair
src/lib/scrape.ts               website extraction (name, copy, features, stats, CTA, testimonials, customer logos, logo, images, videos, theme colour)
src/lib/netguard.ts             SSRF guard: only public http(s) hosts, re-checked on every redirect
```

Every skill is a deterministic function of time: it takes a seeded RNG and no per-frame state. That means scrubbing, looping previews and export all produce identical frames.

### Adding a skill

1. Write a `render(sc: SkillContext)` function in `src/engine/skills/`. Use the helpers in `fx.ts`: `background`, `headline`, `subline`, `exitT` and so on.
2. Add its id to `SKILL_IDS` in `types.ts`.
3. Register it in `skills/index.ts`. The AI Director picks it up automatically from its `bestFor` description.

## Notes

- **Live website capture** uses the Chrome or Edge already installed on your computer to take screenshots (hero, full page, sections) and render JavaScript-heavy sites. If neither is installed it falls back to a plain HTML fetch. Set `INTROMAKER_BROWSER` to a browser executable to use a specific one.
- **Bring any AI, with almost no setup**: open ⚙ in the studio.
  - **Local AI is found automatically**: Ollama, LM Studio, llama.cpp, Jan, vLLM, text-generation-webui, KoboldCpp and GPT4All. Click *Use* and it's ready.
  - **Cloud AI**: paste a key and the provider is recognised from its prefix. 42 presets have endpoints, auth and suggested models filled in:
    - **Popular**: Claude, OpenAI, Gemini, OpenRouter, xAI, Mistral, DeepSeek, Cohere.
    - **Fast inference**: Groq, Cerebras, SambaNova.
    - **Open models**: Together, Fireworks, DeepInfra, Hugging Face, NVIDIA NIM, Perplexity, Novita, Hyperbolic, Nebius, Featherless, Venice.
    - **Gateways**: GitHub Models, Vercel AI Gateway, Cloudflare Workers AI.
    - **Regional**: Qwen, Kimi, GLM, Scaleway, SiliconFlow, MiniMax, Volcengine.
    - **Other**: Azure OpenAI, and any OpenAI-compatible URL.
  - *Load models* lists what your key can use, and each provider remembers its own key.
- **Where the AI runs**:
  - **Cloud AI** always goes through the IntroMaker server, so keys never reach third-party pages and there are no CORS limits.
  - **Local AI** runs where the model is. When IntroMaker runs on your machine, its server calls localhost. When IntroMaker is hosted online (set `INTROMAKER_HOSTED=1`), the server can't reach your computer, so the browser calls your local model directly. The server still builds the prompt, runs the quality checklist and styles the result. If the browser is blocked, the settings explain how to allow it (for example `OLLAMA_ORIGINS` or LM Studio's *Enable CORS*).
  - To add a provider, add an entry in `src/lib/providers.ts`.
- **AI that reads the site**: with a key (or `ANTHROPIC_API_KEY` on the server), Claude receives the extracted copy, features, steps, pains, stats, testimonials and asset list, plus the site's screenshots as images, and writes the storyboard. Without a key, the built-in director uses the same story arc.

- Website import fetches pages server-side and blocks private and internal addresses. For local testing against `localhost` sites, set `INTROMAKER_ALLOW_PRIVATE_URLS=1`.

- The pricing tiers on the landing page are marketing UI only. Auth and billing are not wired up.
- Export renders every frame offline with WebCodecs (Chrome, Edge, Safari 17+), so videos come out smooth and exactly the right length on any machine. Other browsers fall back to real-time recording.

## Third-party

- [Paper Shaders](https://github.com/paper-design/shaders) (Apache-2.0) by Paper Design. `src/engine/shaderbg.ts` includes their vertex shader source.
- Fonts via Fontsource: Inter, Space Grotesk, Anton, Instrument Serif and JetBrains Mono (SIL Open Font License).
- [Lucide](https://lucide.dev) icons (ISC).
