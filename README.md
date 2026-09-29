# IntroMaker — prompt → epic motion graphics

IntroMaker is a SaaS web app that turns a text prompt into a cinematic motion-graphics video. You can use it for intros, trailers, launch promos and social reels.

- **Website → intro**: paste a URL and IntroMaker imports the site's name, tagline, feature headlines, stats, call to action, header logo, screenshots, product videos and brand colours, then storyboards a launch film around them. The film follows a hook, logo, a product tour of the real UI, a features bento, integrations, and a CTA with the site's own button label. Copy is claim-safe by default (see below); proof beats (real testimonials, customer logos and stats only) are added when you switch to *Use site's claims*.
- **SaaS launch-film mode**: modelled on popular product-launch videos. It uses sentence-case blur reveals with gradient accent words, rotating word swaps, a cursor-driven UI zoom tour with callouts, bento feature grids with live micro-animations, floating glass UI widgets, pain-to-solution strikes, an integration orbit, real testimonials, a customer-logo marquee and a CTA button that the cursor clicks. It has a grid, spotlight and beam backdrop, spring physics and glass cards with animated border beams, and is scored with an upbeat track plus UI sound effects synced to every click, pop and whoosh.
- **Two styles**: *SaaS launch* (auto-selected for websites and product prompts) or *Epic trailer*.
- **44 motion skills**: UI Assemble, Video in Text, Node Graph, Website Scroll, How It Works, Command Palette, AI Prompt, One-Click Flow, Notification Stack, Growth Chart, Feature Icons, Blur Reveal, Word Swap, UI Zoom Tour, Bento Grid, Floating UI, Pain → Solution, Integration Orbit, Testimonial, Trusted By, CTA Lock-up, Logo Reveal, Product Showcase, Photo Montage, Screen Wall, God Rays, Glass Shatter, Warp Tunnel, 3D Flip, Particle Vortex, Hyperspace Punch, Kinetic Slam, Glitch Decode, Shockwave, Liquid Mesh, Retrowave, Neon Ignite, Orbital Core, Stat Counter, Cinematic Title, Block Cascade, Split Sweep, Shape Burst and HUD Interface.
- **AI Director**: Claude storyboards the prompt into a hook, a title reveal, feature beats and an outro. It picks the skills, palette, typeface and tempo. When no API key is set, a built-in rule-based director does the same job offline.
- **Live studio**: preview, scrub, edit each scene's text, skill, timing and transition, switch palettes and formats (16:9, 9:16, 1:1), remix, and share a link.
- **A produced soundtrack, arranged to the film**: SaaS films get a modern cue synthesised in the browser, with no stock music and no licences. It's edited like a record:
  - filtered keys under the hook;
  - a snare-roll, riser and filter-sweep build that **drops exactly as the logo hits**;
  - a groove through the product beats (sidechain-pumped keys and bass, swung and open hats, ping-pong delay);
  - one breakdown mid-film with a re-drop;
  - a final chord that **lands on the CTA button click** and rings out under the end card.

  There are five production styles, one per template family: deep house (Rhodes chords, off-beat bass), lo-fi chill keys, future bass (chopped supersaw chords), tech-house stabs and synthwave. The mix goes through a saturated drum bus, a glue compressor, a limiter and a clip-free ceiling. Trailer films keep the epic trailer score.
- **Voice-over, with word-by-word captions**: turn on *Voice-over* in the studio and the director writes a narrator line for every scene from the site's own copy. Lines are sized to fit each scene at a natural pace, numbers and web addresses are said properly ("more than 10,000 teams", "nimbus dot dev"), the reveal says the brand name, and testimonials are left silent so the quote reads. Edit any line in the storyboard, then press *Record*. Choose the voice:
  - **Free, on your computer (default)**: the open-source [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) voice (Apache-2.0) runs in your browser via kokoro-js, using WebGPU when available and WebAssembly otherwise. No key, nothing leaves your machine. It needs a one-time download of about 90 MB.
  - **OpenAI** (gpt-4o-mini-tts, directed as a warm launch-film narrator) or **ElevenLabs**, which returns exact word timings for the captions. Paste a key in the voice settings (the OpenAI key from AI settings is reused), or set `OPENAI_API_KEY` / `ELEVENLABS_API_KEY` on the server.
  - **Any OpenAI-compatible voice server**, such as Kokoro-FastAPI or openedai-speech running on your own machine.
  - **Your own recording**: upload an MP3/WAV/M4A and set where it starts.

  The narration goes through a voice chain (rumble filter, presence lift, compression), and the music ducks under every line. Scenes stretch to the next beat when a line needs more time. Captions sit on a frosted pill that reads over any layout, with the spoken word lit in the accent colour. Voice and captions are included in every export.
- **Beat-synced direction**: scene lengths snap to whole beats, so every cut lands on the kick. The picture and the score share one arrangement: the camera punches on the kicks the music actually plays, holds still in the breakdown and hits harder on each drop. Component entrances land on the eighth-note grid.
- **Cinematic finishing**: two-scale highlight bloom, a colour grade, light leaks, lens bokeh, extruded 3D type, vignette and film grain. Text glow is off by default for crisp type; switch *Glow* on in the studio for halos and highlight bloom.
- **Export presets**: YouTube 1080p60, Reels/TikTok/Shorts 9:16, LinkedIn/Instagram 1:1 and web 720p. The same storyboard re-lays itself out for each format, so nothing is cropped. There's also a one-click PNG thumbnail of the end card. Output is MP4 where the browser supports it (WebM otherwise) with the soundtrack mixed in, rendered entirely in the browser.

### What makes the SaaS films look pro

- **24 style templates**, modelled on the most popular SaaS intro looks and grouped in the picker:
  - **Modern**: Midnight Grid, Aurora Gradient, Mono Pro, AI Glow.
  - **3D & Sci-Fi**: 3D Spatial (content on an orbiting 3D plane over glowing 3D panels), Sci-Fi HUD (brackets, timecode, readouts, scan lines), Synthwave 3D (neon grid floor to the horizon), Deep Space (parallax starfield and nebula), Holographic, Liquid Chrome, Neon Tech, Dev Terminal.
  - **Clean & Light**: Minimal Light, Swiss Clean (hairline layout frame), Enterprise Clean, Frosted Glass.
  - **Bold & Playful**: Bold Pop, Kinetic Type, Neo-Brutalist, Clay 3D (puffy claymorphism cards and gooey metaballs), Retro Dither.
  - **Premium**: Cinematic Keynote, Editorial Serif, Luxe Noir.

  Each style has its own palette, typeface, GPU background, card style (glass, frosted, flat, brutalist or clay), text motion (blur, mask, pop, glow or typewriter), optional 3D stage and HUD or frame overlay, transitions, music and pacing. Switching restyles the film instantly.
- **Modern text effects**, inspired by AI-video launch films (Runway, Higgsfield, ComfyUI). Every SaaS headline can use:
  - *Decode*: characters scramble through random glyphs, then lock in left to right;
  - *Odometer*: letters roll up out of a mask;
  - *Letter wave*: letters spring up one by one;
  - *Streak*: words fly in on motion trails and stretch as they brake;
  - *Chromatic*: cyan and magenta ghosts converge into crisp type;
  - *Flip*: words flip up like a split-flap board;
  - *Focus*: the line appears dimmed and lights up word by word;
  - *Highlight*: a marker box wipes in behind the key word;
  - *Shine*: the headline settles dimmed, then a light band sweeps across it;
  - plus the originals (blur rise, mask slide, pop, typewriter, glow).

  Pick one in *Style → Text effect* (live previews), or keep each template's own. All effects are deterministic per frame and stay crisp (no blur filters or halos). Two signature moments join them:
  - **Video in Text**: the product name as giant type filled with the product's own footage, with the real logo above it. The camera then dives through a letter into the footage. Used as the brand moment of product-first cuts of 20 seconds or more.
  - **Node Graph**: the steps as a ComfyUI-style workflow. Nodes pop in, wires draw between their ports and data pulses through to an output that completes. Used for how-it-works in AI and creative products.
- **A studio that fits the screen**: settings sit in four tabs (*Create*, *Style*, *Colours*, *Voice*) with **Generate** and **Remix** pinned at the bottom. Create, Style and Voice fit a laptop screen without scrolling, and the preview stays in view. Templates show one category at a time, the background picker and example prompts fold away, and the last tab you used is remembered.
- **Choose your colours**: keep the template's colours, use the website's brand colours, or pick any of 20 dark and light palettes. A palette you pick survives template switches. After a website import, two buttons sit side by side on the site card: *Auto brand colours* (read from the whole page, the default) and *Logo colours* (read from the header logo alone; a one-colour logo gets a close analogous partner hue). A black-and-white logo has no colours to offer, so that option is greyed out.
- **Edited like a real film**: whip pans, dolly zoom-throughs, pushes, dissolves and light leaks show the outgoing and incoming shots at the same time, and every cut lands on the beat.
- **Real UI, animated piece by piece — not flat screenshots**:
  - When a site is imported, the real browser also cuts out the page's UI components (product shots, app panels, KPI cards, charts, feature cards, buttons) with their exact positions. On other screenshots, image segmentation finds the blocks instead.
  - **UI Assemble** shows the product like a film, not a collage. The real page sits in soft focus; its two or three best components (KPI cards, charts, product shots) are pulled out one at a time into a big, isolated close-up with a soft shadow, glide back into their exact slot as the next one comes out, and then the whole page racks into focus as one piece. Nothing is drawn around the sections, and a returned component lands pixel-aligned on the page it was cut from, so there are no seams. Components are captured at 2× resolution so close-ups stay sharp. Screenshots without captured components are never cut up; the camera zooms into their strongest regions instead.
  - Bento tiles show the product's real UI instead of placeholder graphics, and the floating-UI scene uses the real app panel.
- **A product tour that clicks real UI**: the screenshot (or first video frame) is analysed for its busiest interface regions. The camera zooms there, the cursor clicks, the focus ring hugs the actual component under the cursor, and the rest of the screen dims around it.
- **Signature interaction moments**, as the best launch films stage them, chosen to suit the product:
  - a ⌘K command palette (keycaps, live filtering, a result card);
  - an AI prompt that streams its answer, in the product's own words;
  - a one-click flow (micro-zoom, then a task cascade);
  - an iOS-style notification stack;
  - a growth chart for one real metric.
- **The real logo, whatever it's made of**: the brand mark is found in the site header the way a person would find it (the home link or a logo-named element near the top-left), and taken in its best form:
  - SVG first: inline SVG logos serialised with their real colours, an SVG offered in `<picture>` or `srcset`, or an SVG twin served beside a raster logo (`logo.png` → `logo.svg`);
  - otherwise the largest raster the page offers (PNG, WebP, JPG; GIF only as a last resort);
  - text/CSS logos (icon + name) as a 4× screenshot on true transparency.

  Without a live browser, the HTML is read for the same clues (SVG preferred, largest `srcset` entry), then structured-data logos, `og:logo` and large app icons (never a 16px favicon).

  On screen, SVG logos are rendered fresh at every size, so edges are always sharp. Raster logos are cleaned once:
  - a plain white box is keyed out, including the holes in letters, with colour-to-alpha edges and no grey outline;
  - GIF's hard 1-bit edges are smoothed;
  - small files are upscaled with high-quality filtering and never shown more than 2.5× their own pixels;
  - small copies (the corner brand bug) are scaled down in steps, so they aren't aliased.

  Only the neutral ink adapts to the style (black wordmark text goes white on dark styles, white text goes dark on light ones), so coloured marks keep their brand colours.
- **Brand polish**: an anamorphic logo reveal, a corner brand bug through the body of the film, and an end card that holds on the logo, closing line, button and URL.
- **Copy that reads like a designer wrote it**: the site's headlines are ranked for on-screen quality, the emphasis word is chosen by meaning ("*300+ tools*", "*whole team*"), bento cards carry the site's own one-line feature descriptions, and CTAs vary.
- **Claim-safe copy (default)**: films are advertising, so the words on screen and in the voice-over stay generic and descriptive, saying what the product is and does:
  - no superlatives or rankings (best, #1, leading, world's first, fastest);
  - no absolutes or guarantees (100%, guaranteed, never, always, everything);
  - no speed or multiplier claims (in seconds, instantly, 10x faster) and no comparatives with nothing to compare against (faster, better, smarter);
  - no numbers used as claims (customer counts, percentages, ratings, uptime), and no testimonials, customer-logo walls or metric scenes;
  - no efficacy or outcome promises ("stops cyber threats" → "helps you monitor cyber threats"; "boost your revenue" is left out);
  - no certification or compliance claims (SOC 2, HIPAA, GDPR, "compliant", "certified", "bank-grade"), green claims (eco-friendly, sustainable, carbon neutral), endorsements ("as seen on", "recommended by") or origin claims ("Made in USA");
  - "free" only when the site itself offers something free (the FTC treats "free" as a claim that must be true).

  **Health and medical claims are removed in every mode**, following FDA rules: treats, cures, prevents, diagnoses, heals; clinically proven; FDA approved or cleared; doctor recommended; effects on sleep, stress, mood, immunity or weight.

  The site's own wording is kept where it's neutral, softened where that is safe ("The #1 CRM for startups" → "The CRM for startups"), and left out where it isn't. The built-in director's lines are written generic to begin with, and the product category is read from the site as captured, so screening never changes what kind of product it is. The same rules go into the AI director's brief, its self-review flags anything that slips through, and a final pass screens its output. Switch *Wording* to *Use site's claims* to include the site's stats, quotes, certifications and customer logos; you must be able to substantiate them. This is automated screening, not legal advice: review the copy before publishing.
- **Takes**: "3 more takes" directs alternative cuts (product-first, proof-first, a fresh story) in parallel. They appear as live previews, and you click one to use it.
- **AI self-review**: the AI's draft is checked against a storyboard checklist covering arc, copy length, pacing, and invented quotes, logos or numbers. *Best* mode always critiques and revises its draft. *Balanced* revises only when the checklist fails. Anything invented that remains is removed.
- **Icons everywhere**: around 200 Lucide icons (ISC licence) drawn as crisp canvas vectors that draw themselves on. They appear in feature tiles, bento cards, steps, struck-out pains (a red ✕), chapter pills, notification widgets and the integrations orbit. Each icon is picked from the wording ("Invoices paid on time" gives a receipt, "Deploy in seconds" a rocket, "Close deals" a handshake), with the product category's icon family as the fallback.
- **Story arcs that adapt to the product**: IntroMaker detects the product type from the site or prompt and uses the launch-film arc typical of it. There are 14 types: developer tool, AI, fintech, security, analytics, sales and CRM, marketing, productivity, HR, e-commerce, health, education, creative and communication. Each type sets its own beat order, whether to open on the pain or the promise, chapter labels ("Built for developers", "Works with your stack", "Security teams"), CTA voice ("Start building", "Book a demo", "Open an account", "Start selling"), icon family and a suggested style. The AI director gets the same brief, and the studio shows what it detected, with a one-click "Use suggested style".
- **New skill: Feature Icons**, the classic SaaS feature row. Glowing icon tiles draw themselves on, each with a title and a one-line benefit.
- **60-30-10 colour rule** (default for SaaS films): 60% dominant background, 30% supporting colour for cards, panels and gradient fields, and 10% accent for highlight words, buttons, cursor and progress, in one hue. Shader gradients weight their colour spots in the same proportion, and the accent is the palette's most vivid colour. Switch to *Vibrant* in the studio for full-strength colour.
- **High-end GPU backgrounds**: animated mesh gradients, grainy gradients, silk flow, smoke rings, a neural glow and light rays, rendered frame-exactly on the GPU with the open-source [Paper Shaders](https://github.com/paper-design/shaders) (Apache-2.0). They're tinted from the palette and kept deep enough for text to stay readable. Every style has a signature background, and the studio's *Background* picker can put any gradient behind any style. Preview and export match exactly.
- **Every format**: all SaaS scenes are laid out for 16:9, 9:16 and 1:1.
- **Colour theory with guard rails**: on top of 60-30-10, highlight words, buttons and beams are kept at ≥3:1 contrast with the background and body text at ≥7:1 (WCAG). A dark navy brand colour on a dark style is lifted until it reads.
- **Honest copy**: KPI figures inside a product mockup are never taken as company stats, quotes drop their inline attribution, and section headings aren't mistaken for features.

## Quality: Kaizen scorecard

`npm run kaizen` generates the storyboards and scores each out of 100 (including whether each narrator line fits its scene). The corpus covers 9 websites (sales, developer tool, AI, fintech, security, e-commerce, a live capture with UI components, a sparse site and a wordy site) and 8 prompts, across 3 lengths, 3 story angles and all 24 styles. Films are scored on story arc (including a product-in-action moment), length accuracy, copy (length, repeats, filler endings, placeholders), variety, pacing, chapter labels, icon uniqueness, CTA and use of the site's material. It then reports the most frequent issues, so every improvement can be measured. Five cycles took the average from **88.1 to 99.0**: perfect films rose from 2 to 504 and the lowest score from 57 to 93. Adding the interaction moments and component scenes, with a stricter scorecard, took it to **99.6**. The remaining misses are inputs with no feature material, which get an honest shorter cut and a director's note instead of invented content.

The corpus now has 10 websites, including a hype-heavy site whose copy is almost all claims, and scores 1,586 storyboards. That covers both wording modes, vertical 9:16 cuts and take variety. When the scorecard saturated, its bar was raised with what a viewer notices:
- **specificity**: headlines in the product's own words, not boilerplate;
- **rewrite damage**: fragments, dangling endings and broken plurals left by claim-safe rewriting;
- **brand**: the logo revealed when there is one, and the brand named in the closing line;
- **real product**: captured UI and imagery on screen;
- **beat sync**;
- **9:16 headline width**;
- **take variety**: "3 more takes" must give genuinely different films;
- **claims**: none in claim-safe mode.

On the raised bar, perfect films were 550 of 1,586. One cycle of fixes took that to **1,436**:
- product-first takes open cold on the product, with the logo after it;
- proof-first without proof becomes a value-first cut led by the product demo;
- each take opens on a different line;
- the closing narrator line always names the product;
- rewritten boasts rank below the site's clean lines;
- shortened voice lines are cut at clause boundaries;
- overlong films drop their least essential beat.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY to enable the Claude AI Director
npm run dev                  # http://localhost:3000
```

| Route | What it is |
|---|---|
| `/` | Landing page with a live hero render, the skill showcase, how it works and pricing |
| `/skills` | All the skills rendered live, with a palette switcher |
| `/studio` | The editor. Accepts `?prompt=…`, `?skill=…&palette=…`, or `#plan=…` (shared links) |
| `/studio?url=…` | Imports a website and generates an intro from it |
| `POST /api/scrape` | `{ url }` → `{ site }`: brand, copy and asset URLs extracted from a web page |
| `GET /api/asset?url=…` | Same-origin image/video proxy (with Range support) so website media can be drawn and exported |
| `POST /api/generate` | `{ prompt, aspect, length, palette?, seed?, site?, colors?, safe? }` → `{ plan, engine }` |
| `GET /api/health` | Liveness for the host: `{ ok, storage, persistent, rateLimits }` |
| `/privacy` | What happens to imported sites, API keys and videos |

## Deploy (Docker)

The image runs Next's standalone server with a headless Chromium for live website capture. Videos are rendered in each visitor's browser, so the server does no video work.

```bash
docker build -t intromaker .
docker run -p 3000:3000 -v intromaker-data:/data intromaker     # http://localhost:3000
```

**Render**: New → Blueprint → this repo. `render.yaml` defines one web service from the Dockerfile, a 1 GB persistent disk at `/data`, the health check and the settings below. Railway, Fly.io or any VPS run the same image; mount a volume at `/data`.

| Setting | Default | What it does |
|---|---|---|
| `INTROMAKER_DATA_DIR` | `/data` in the image | Where captured screenshots are stored; mount a persistent volume here |
| `INTROMAKER_SHOT_TTL_DAYS` / `INTROMAKER_SHOT_MAX_MB` | 7 / 1024 | Captures are deleted after this many days; the folder is held under this size, oldest first |
| `INTROMAKER_MAX_CAPTURES` | 2 | Headless browser sessions at once (about 300 MB each); more wait briefly, then fall back to reading the HTML |
| `INTROMAKER_PROXY_HOPS` | 1 | Trusted reverse proxies in front; the client address is read from `X-Forwarded-For` counted from the right, so it can't be spoofed. Use 0 when the server faces the internet directly |
| `INTROMAKER_RATE_LIMIT` | on in production | `off` disables the limits |
| `ANTHROPIC_API_KEY` | none | Optional Claude key for the AI director; visitors can bring their own |
| `INTROMAKER_AI_DAILY_BUDGET` | 200 | Generations per day, all visitors combined, paid by the server's key; after it, the built-in director is used |

**What protects a public deploy**:
- **Rate limits** per visitor on import (8 per 10 min), the image proxy, generation, voice and key checks. Over the limit you get a `429` with `Retry-After`. Generation that the server's own AI key pays for also has a per-visitor and a shared daily budget, and degrades to the built-in director rather than failing.
- **Capture queue**: live captures run a bounded number of browser sessions, with a wait list and a hard timeout.
- **SSRF guard**: only public `http(s)` addresses; loopback, private, link-local, CGNAT, cloud-metadata, IPv4-mapped and NAT64 IPv6 forms and numeric IP tricks are refused. Every redirect hop is re-checked. Server-side fetches are pinned to the checked address at connect time, which defeats DNS rebinding. Live capture checks every request the page makes.
- **Local AI** (Ollama, LM Studio) is only reachable from the server when it runs on your own machine; hosted, it runs from the visitor's browser.
- **Headers**: `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy, a permissions policy and HSTS; captured SVGs are served with a sandboxing CSP.
- **Keys** stay in the visitor's browser and are removed from error messages.

`npm run check:hosting` verifies all of this in production mode (rate limits, spoofing, the AI budget, storage clean-up, around 30 SSRF cases including DNS rebinding, local AI).

Known limits:
- Rate limits and the AI budget are in memory, which suits a single instance. Several instances would share them through Redis behind the same `rateLimit()` interface.
- The headless browser resolves DNS itself, so for defence in depth run it where the container has no route to internal services (the default on Render, Railway and Fly).

## Architecture

```
src/engine/
  types.ts        VideoPlan / Scene / Skill contracts
  skills/         the 44 skills (saas.ts, interactions.ts, typefx.ts, components.ts, typography.ts, energy.ts, worlds.ts, signature.ts, media.ts); each is a pure render(ctx, t)
  saasfx.ts       SaaS design toolkit: springs, grid/beam backdrop, glass cards, border beams, cursor, icons, blur-in type
  media.ts        website image/video cache, frame-exact video sync for export, logo + brand-colour analysis
  renderer.ts     timeline, beat camera, transitions (cut/flash/zoom/glitch/wipe/whip/dolly/leak/shutter), finishing pass
  planner.ts      built-in director + plan sanitising + share-link encoding
  claims.ts       claim-safe copy: rewrites superlatives, guarantees and speed claims; spots numbers-as-claims
  audio.ts        the synthesiser: produced SaaS cue + trailer score + UI sound design (WebAudio)
  music.ts        production sheets per music style (harmony, instruments, groove, mix)
  arrange.ts      the film's musical arrangement (intro, builds, drops, breakdown, ending) shared by score and camera
  voice.ts        voice-over: voices, clip store, speakable text, word timings, timeline, captions
  script.ts       narrator script writer (one line per scene, sized to the scene)
  shaderbg.ts     WebGL2 runner for Paper Shaders gradients (frame-exact, shared context)
  templates.ts    style templates (look, motion, music, pacing, role → skill)
  export.ts       WebCodecs offline export, export presets, PNG thumbnail
src/app/api/generate/route.ts   Claude AI Director (structured output), falls back to planner.ts
src/lib/providers.ts            provider registry (endpoint, auth, key prefix, suggested models, vision)
src/lib/ai.ts                   AI director over 3 protocols (Anthropic SDK, OpenAI-compatible, Gemini) + model listing
src/lib/localai.ts              browser-side local AI (scan, test, director) for online deployments
src/lib/review.ts               storyboard checklist, self-review brief and repair
src/lib/capture.ts              live browser capture: hero/full/section screenshots + the page's UI components cut out one by one
src/lib/tts.ts                  voice generation: Kokoro in the browser, cloud voices via /api/tts, uploads
src/app/api/tts/route.ts        OpenAI / ElevenLabs / OpenAI-compatible text-to-speech (keys stay server-side)
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
- Voice-over (optional, loaded at runtime when chosen): [kokoro-js](https://github.com/hexgrad/kokoro) and the Kokoro-82M voice model (Apache-2.0).
