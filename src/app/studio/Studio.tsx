"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AiSettings, { aiForRequest, aiLabel, DEFAULT_AI, loadAiSettings, type AiSettingsValue } from "@/components/AiSettings";
import { Logo } from "@/components/Nav";
import LoopCanvas from "@/components/LoopCanvas";
import PaletteChooser, { type ColourChoice } from "@/components/PaletteChooser";
import BackgroundPicker, { applyBackground, type BgChoice } from "@/components/BackgroundPicker";
import { runBrowserDirector } from "@/lib/localai";
import { isLocalProvider } from "@/lib/providers";
import TemplatePicker from "@/components/TemplatePicker";
import { applyTemplate, DEFAULT_TEMPLATE, TEMPLATE_MAP } from "@/engine/templates";
import { CONCEPT_MAP } from "@/engine/concepts";
import Player from "@/components/Player";
import { EXAMPLE_PROMPTS, HERO_PLAN } from "@/engine/demos";
import { PALETTES } from "@/engine/palettes";
import { assetUrl, extractBrandColors } from "@/engine/media";
import { ANGLES, decodePlan, encodePlan, planFromPrompt, planFromSite, sanitizePlan, type Angle, type Length, type StyleChoice } from "@/engine/planner";
import { SKILL_MAP, SKILLS } from "@/engine/skills";
import { PALETTE_IDS, TRANSITIONS, type Aspect, type Brand, type PaletteId, type Scene, type SiteData, type SkillId, type VideoPlan } from "@/engine/types";

type Engine = "ai" | "builtin" | "manual";
type Take = { plan: VideoPlan; engine: Engine; engineLabel: string; label: string; note?: string };

export default function Studio() {
  const params = useSearchParams();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [length, setLength] = useState<Length>("standard");
  const [palette, setPalette] = useState<PaletteId | "auto">("auto");
  const [plan, setPlan] = useState<VideoPlan>(HERO_PLAN);
  const [engine, setEngine] = useState<Engine>("manual");
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  /** Whether the server can reach this computer's local AI (else local models run from the browser). */
  const [localViaServer, setLocalViaServer] = useState(true);
  const localViaServerRef = useRef(true);
  localViaServerRef.current = localViaServer;
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [version, setVersion] = useState(0);
  const [style, setStyle] = useState<StyleChoice>("auto");
  const [ai, setAi] = useState<AiSettingsValue>(DEFAULT_AI);
  const [aiOpen, setAiOpen] = useState(false);
  const [engineLabel, setEngineLabel] = useState("");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  // Read at call time: boot-time generation (?url=…) must see the saved template, not the default.
  const templateRef = useRef(template);
  templateRef.current = template;
  const [takes, setTakes] = useState<Take[]>([]);
  const [scheme, setScheme] = useState<NonNullable<VideoPlan["scheme"]>>("60-30-10");
  const schemeRef = useRef(scheme);
  schemeRef.current = scheme;
  const chooseScheme = (sc: NonNullable<VideoPlan["scheme"]>) => {
    setScheme(sc);
    schemeRef.current = sc;
    setPlan((p) => ({ ...p, scheme: sc }));
  };
  const [bg, setBg] = useState<BgChoice>("template");
  const bgRef = useRef(bg);
  bgRef.current = bg;
  const chooseBackground = (b: BgChoice) => {
    setBg(b);
    bgRef.current = b;
    // "Template default" restores the template's own look; others override just the stage.
    setPlan((p) => (b === "template" && p.style === "saas" && p.template ? applyTemplate(p, p.template, { palette: p.palette }) : applyBackground(p, b)));
  };
  const [takesLoading, setTakesLoading] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("intromaker.template");
      if (saved && TEMPLATE_MAP[saved]) {
        templateRef.current = saved;
        setTemplate(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);
  /** Switch template: restyles the current SaaS storyboard instantly (no regeneration). */
  const chooseTemplate = (id: string) => {
    setTemplate(id);
    try {
      localStorage.setItem("intromaker.template", id);
    } catch {
      /* ignore */
    }
    // A palette the user picked survives template switches; otherwise the template's colours apply.
    setPlan((p) => (p.style === "saas" ? applyBackground(applyTemplate(p, id, { palette: palette !== "auto" ? palette : undefined }), bgRef.current) : p));
    setVersion((v) => v + 1);
  };
  useEffect(() => setAi(loadAiSettings()), []);
  const [siteUrl, setSiteUrl] = useState("");
  const [site, setSite] = useState<SiteData | null>(null);
  const [brandColors, setBrandColors] = useState<Brand["colors"]>(undefined);
  const [useBrandColors, setUseBrandColors] = useState(true);
  const colourChoice: ColourChoice = palette !== "auto" ? palette : useBrandColors && brandColors ? "brand" : "template";
  /** Apply a colour choice to the current film instantly (and to future generations). */
  const chooseColours = (c: ColourChoice) => {
    const brandOn = c === "brand";
    setUseBrandColors(brandOn);
    setPalette(c === "template" || c === "brand" ? "auto" : c);
    setPlan((p) => {
      const tplPalette = TEMPLATE_MAP[p.template ?? templateRef.current]?.palette;
      const pal = c === "template" || c === "brand" ? (p.style === "saas" && tplPalette ? tplPalette : p.palette) : c;
      return { ...p, palette: pal, brand: p.brand ? { ...p.brand, colors: brandOn ? brandColors : undefined } : p.brand };
    });
  };
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    fetch("/api/generate")
      .then((r) => r.json())
      .then((d) => {
        setAiAvailable(Boolean(d.ai));
        setLocalViaServer(d.localViaServer !== false);
      })
      .catch(() => setAiAvailable(false));
  }, []);

  type GenOpts = {
    prompt?: string;
    seed?: number;
    aspect?: Aspect;
    palette?: PaletteId | "auto";
    site?: SiteData | null;
    colors?: Brand["colors"];
    length?: Length;
    angle?: Angle;
  };

  /** One storyboard from the director (server AI or built-in; falls back to in-browser). */
  const direct = async (opts: GenOpts): Promise<Take> => {
    const s = opts.site !== undefined ? opts.site : site;
    const colors = opts.colors !== undefined ? opts.colors : useBrandColors ? brandColors : undefined;
    const p = (opts.prompt ?? prompt).trim() || (s ? "" : EXAMPLE_PROMPTS[0]);
    const a = opts.aspect ?? aspect;
    const pal = opts.palette ?? palette;
    const len = opts.length ?? length;
    const template = templateRef.current;
    const label = ANGLES.find((x) => x.id === opts.angle)?.name ?? "Take";
    const aiCfg = aiForRequest(loadAiSettings());
    const body = { prompt: p, aspect: a, length: len, palette: pal, seed: opts.seed, site: s, colors, style, ai: aiCfg, template, angle: opts.angle };
    // Local AI runs where the model is: from this browser when the server is online.
    if (isLocalProvider(aiCfg.provider) && !localViaServerRef.current) {
      try {
        const data = await runBrowserDirector(body, aiCfg);
        return { plan: sanitizePlan(data.plan as VideoPlan), engine: data.engine as Engine, engineLabel: data.engineLabel ?? "", note: data.note, label };
      } catch (e) {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, ai: { provider: "builtin" } }),
        }).catch(() => null);
        const data = res?.ok ? await res.json() : null;
        if (data) return { plan: sanitizePlan(data.plan), engine: "builtin", engineLabel: "", note: `Local AI: ${(e as Error).message} Used the built-in director.`, label };
      }
    }
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { plan: sanitizePlan(data.plan), engine: data.engine, engineLabel: data.engineLabel ?? "", note: data.note, label };
    } catch {
      // Offline or API unavailable: the director also runs in the browser.
      const plan = s
        ? planFromSite(s, { aspect: a, length: len, palette: pal, seed: opts.seed, colors, style, template, angle: opts.angle })
        : planFromPrompt({ prompt: p, aspect: a, length: len, palette: pal, seed: opts.seed, style, template });
      return { plan, engine: "builtin", engineLabel: "", label };
    }
  };

  const show = (take: Take) => {
    setPlan({ ...applyBackground(take.plan, bgRef.current), scheme: schemeRef.current });
    setVersion((v) => v + 1);
    setEngine(take.engine);
    setEngineLabel(take.engineLabel);
  };

  const generate = async (opts: GenOpts = {}) => {
    setLoading(true);
    setNote(null);
    try {
      const take = await direct(opts);
      show(take);
      setTakes([{ ...take, label: "Take 1" }]);
      if (take.note) setNote(take.note);
    } finally {
      setLoading(false);
    }
  };

  /** Three alternative cuts (different story angles / creative seeds) to choose from. */
  const moreTakes = async () => {
    setTakesLoading(true);
    try {
      const angles: (Angle | undefined)[] = site ? ["product", "proof", "story"] : [undefined, undefined, undefined];
      const results = await Promise.all(angles.map((angle) => direct({ angle, seed: Math.floor(Math.random() * 1e9) })));
      setTakes((prev) => {
        const base = prev.length ? prev : [{ plan, engine, engineLabel, label: "Take 1" }];
        return [...base, ...results.map((r, i) => ({ ...r, label: `Take ${base.length + i + 1}${r.label !== "Take" ? ` · ${r.label}` : ""}` }))].slice(-8);
      });
    } finally {
      setTakesLoading(false);
    }
  };

  /** Scrape a website, pull its brand colours, then storyboard an intro from it. */
  const importSite = async (raw?: string) => {
    const url = (raw ?? siteUrl).trim();
    if (!url) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const s: SiteData = data.site;
      setSite(s);
      setSiteUrl(s.url);
      const colorSources = [s.logo, ...s.images.slice(0, 2)].filter(Boolean).map((u) => assetUrl(u as string));
      const colors = (await extractBrandColors(colorSources, s.themeColor)) ?? undefined;
      setBrandColors(colors);
      // A full story arc needs room: websites default to the long cut.
      const len = length === "standard" ? "long" : length;
      setLength(len);
      await generate({ site: s, colors: useBrandColors ? colors : undefined, length: len });
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const clearSite = () => {
    setSite(null);
    setBrandColors(undefined);
    setImportError(null);
  };

  // Boot from URL: #plan=… (shared link), ?url=… (website), ?prompt=…, or ?skill=… from the showcase.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const shared = hash.startsWith("#plan=") ? decodePlan(hash.slice(6)) : null;
    if (shared) {
      setPlan(shared);
      setAspect(shared.aspect);
      setEngine("manual");
      return;
    }
    const pal = params.get("palette") as PaletteId | null;
    if (pal && (PALETTE_IDS as readonly string[]).includes(pal)) setPalette(pal);
    const skill = params.get("skill") as SkillId | null;
    if (skill && SKILL_MAP[skill]) {
      const s = SKILL_MAP[skill];
      setPlan(
        sanitizePlan({
          title: s.name,
          palette: pal ?? "cyber",
          font: "anton",
          aspect: "16:9",
          bpm: 124,
          seed: 7,
          scenes: [{ skill, text: s.sample.text, subtext: s.sample.subtext, duration: 4.5, transition: "cut" }],
        }),
      );
      return;
    }
    const web = params.get("url");
    if (web) {
      setSiteUrl(web);
      importSite(web);
      return;
    }
    const q = params.get("prompt");
    if (q) {
      setPrompt(q);
      generate({ prompt: q, palette: pal ?? "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateScene = (i: number, patch: Partial<Scene>) => {
    // Not sanitised: an empty headline mid-typing must stay empty.
    if (patch.duration !== undefined) patch.duration = Math.min(8, Math.max(1.6, patch.duration || 1.6));
    setPlan((p) => ({ ...p, scenes: p.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
    setEngine("manual");
  };
  const moveScene = (i: number, dir: -1 | 1) => {
    setPlan((p) => {
      const scenes = [...p.scenes];
      const j = i + dir;
      if (j < 0 || j >= scenes.length) return p;
      [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
      return { ...p, scenes };
    });
  };
  const removeScene = (i: number) =>
    setPlan((p) => (p.scenes.length > 1 ? { ...p, scenes: p.scenes.filter((_, j) => j !== i) } : p));
  const addScene = () =>
    setPlan((p) =>
      sanitizePlan({
        ...p,
        scenes: [...p.scenes, { skill: "kinetic-slam", text: "NEW SCENE", duration: 2.8, transition: "flash" }],
      }),
    );

  const share = async () => {
    const url = `${window.location.origin}/studio#plan=${encodePlan(plan)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  const setGlobal = (patch: Partial<VideoPlan>) => setPlan((p) => sanitizePlan({ ...p, ...patch }));

  return (
    <div className="studio">
      <header className="studio-bar">
        <Logo />
        <span className="studio-title">{plan.title}</span>
        <span className={`engine-badge ${engine}`}>
          {engine === "ai" ? `✦ ${engineLabel || "AI director"}` : engine === "builtin" ? "Built-in director" : "Manual edit"}
        </span>
        <button className="btn btn-ghost" onClick={() => setAiOpen(true)} title="Choose AI provider, key, model and mode">
          ⚙ {aiLabel(ai)}
        </button>
        <button className="btn btn-ghost" onClick={share}>
          {copied ? "Link copied ✓" : "Share link"}
        </button>
      </header>

      {aiOpen && <AiSettings value={ai} onChange={setAi} onClose={() => setAiOpen(false)} serverClaude={!!aiAvailable} localViaServer={localViaServer} />}
      <div className="studio-body">
        <aside className="panel">
          <h2>From a website</h2>
          <form
            className="url-row"
            onSubmit={(e) => {
              e.preventDefault();
              importSite();
            }}
          >
            <input
              className="input"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="yourproduct.com"
              aria-label="Website URL"
              inputMode="url"
            />
            <button className="btn btn-ghost" type="submit" disabled={importing || loading}>
              {importing ? "Importing…" : "Import"}
            </button>
          </form>
          {importError && <p className="hint warn">{importError}</p>}
          {site && (
            <div className="site-card">
              <div className="site-head">
                {site.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(site.logo)} alt="" className="site-logo" />
                ) : (
                  <span className="site-logo placeholder">{site.name.slice(0, 1)}</span>
                )}
                <div className="site-meta">
                  <strong>{site.name}</strong>
                  <span>{site.domain}</span>
                </div>
                <button className="icon-btn sm" onClick={clearSite} aria-label="Remove website">
                  ✕
                </button>
              </div>
              {site.tagline && <p className="site-tagline">{site.tagline}</p>}
              {(site.images.length > 0 || site.shots?.hero) && (
                <div className="site-thumbs">
                  {[site.shots?.hero, site.shots?.full, ...(site.shots?.sections ?? [])]
                    .filter((x): x is string => !!x)
                    .slice(0, 4)
                    .map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={src} src={src} alt="" loading="lazy" className="shot" />
                    ))}
                  {site.images.slice(0, 8).map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={assetUrl(src)} alt="" loading="lazy" />
                  ))}
                </div>
              )}
              <div className="site-stats">
                <span className={site.shots?.full ? "live" : ""}>{site.shots?.full ? "● Live capture" : "Static import"}</span>
                <span>{(site.shots?.sections.length ?? 0) + (site.shots?.full ? 2 : 0)} screenshots</span>
                <span>{site.images.length} images</span>
                <span>{site.videos.length} videos</span>
                <span>{site.headlines.length} features</span>
                <span>{site.stats.length} stats</span>
                <span>{site.steps?.length ?? 0} steps</span>
                <span>{site.testimonials.length} quotes</span>
                <span>{site.clientLogos.length} customer logos</span>
                {site.font && <span>Font: {site.font}</span>}
              </div>
              {!site.shots?.full && (
                <p className="hint">Tip: install Google Chrome or Microsoft Edge to capture live screenshots of the site.</p>
              )}
              {brandColors && (
                <button className={`brand-colors ${colourChoice === "brand" ? "on" : ""}`} onClick={() => chooseColours(colourChoice === "brand" ? "template" : "brand")}>
                  <span className="swatch lg" style={{ background: brandColors.primary }} />
                  <span className="swatch lg" style={{ background: brandColors.secondary }} />
                  {colourChoice === "brand" ? "Using brand colours ✓" : "Use brand colours"}
                </button>
              )}
            </div>
          )}

          <h2 className="mt">{site ? "Extra direction (optional)" : "Prompt"}</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={site ? "e.g. focus on speed, end with 'Start free trial'" : "Describe your video: brand, vibe, claims, numbers…"}
            rows={5}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
            }}
          />
          <div className="examples compact">
            {EXAMPLE_PROMPTS.map((p) => (
              <button key={p} className="chip" onClick={() => setPrompt(p)} title={p}>
                {p.length > 38 ? `${p.slice(0, 36)}…` : p}
              </button>
            ))}
          </div>

          <label className="field-label">Format</label>
          <div className="seg-control">
            {(["16:9", "9:16", "1:1"] as Aspect[]).map((a) => (
              <button
                key={a}
                className={aspect === a ? "active" : ""}
                onClick={() => {
                  setAspect(a);
                  setGlobal({ aspect: a });
                }}
              >
                {a === "16:9" ? "Landscape" : a === "9:16" ? "Vertical" : "Square"}
              </button>
            ))}
          </div>

          <label className="field-label">Style</label>
          <div className="seg-control">
            {(
              [
                ["auto", "Auto"],
                ["saas", "SaaS launch"],
                ["trailer", "Epic trailer"],
              ] as [StyleChoice, string][]
            ).map(([id, label]) => (
              <button key={id} className={style === id ? "active" : ""} onClick={() => setStyle(id)}>
                {label}
              </button>
            ))}
          </div>

          {style !== "trailer" && (
            <>
              <label className="field-label">
                SaaS template <span className="tpl-desc">{TEMPLATE_MAP[template]?.name}</span>
              </label>
              {plan.concept && plan.concept !== "general" && CONCEPT_MAP[plan.concept] && (
                <div className="concept-hint">
                  <span>
                    Detected: <strong>{CONCEPT_MAP[plan.concept].name}</strong>. The story arc, chapters, CTA and icons are adapted.
                  </span>
                  {TEMPLATE_MAP[CONCEPT_MAP[plan.concept].template] && template !== CONCEPT_MAP[plan.concept].template && (
                    <button className="btn btn-ghost sm" onClick={() => chooseTemplate(CONCEPT_MAP[plan.concept!].template)}>
                      Use suggested style: {TEMPLATE_MAP[CONCEPT_MAP[plan.concept].template].name}
                    </button>
                  )}
                </div>
              )}
              <TemplatePicker value={template} onChange={chooseTemplate} />
              <p className="hint">{TEMPLATE_MAP[template]?.description}</p>
              <label className="field-label">Background</label>
              <BackgroundPicker value={bg} onChange={chooseBackground} palette={plan.style === "saas" ? plan.palette : TEMPLATE_MAP[template].palette} look={plan.style === "saas" ? plan.look : TEMPLATE_MAP[template].look} />
              <p className="hint">GPU gradient stages rendered with the open-source Paper Shaders (Apache-2.0).</p>
            </>
          )}

          <label className="field-label">Length</label>
          <div className="seg-control">
            {(["short", "standard", "long"] as Length[]).map((l) => (
              <button key={l} className={length === l ? "active" : ""} onClick={() => setLength(l)}>
                {l === "short" ? "~12s" : l === "standard" ? "~20s" : "~34s"}
              </button>
            ))}
          </div>

          <label className="field-label">
            Colours <span className="tpl-desc">{colourChoice === "template" ? "Template" : colourChoice === "brand" ? "Brand" : PALETTES[colourChoice].name}</span>
          </label>
          <div className="seg-control">
            {(
              [
                ["60-30-10", "60 · 30 · 10 balance"],
                ["vibrant", "Vibrant"],
              ] as [NonNullable<VideoPlan["scheme"]>, string][]
            ).map(([id, label]) => (
              <button key={id} className={scheme === id ? "active" : ""} onClick={() => chooseScheme(id)}>
                {label}
              </button>
            ))}
          </div>
          <p className="hint">
            {scheme === "60-30-10"
              ? "Designer's 60-30-10 rule: 60% dominant background, 30% supporting colour for cards and gradients, 10% accent for highlights and buttons."
              : "Every palette colour at full strength: louder, more colourful."}
          </p>
          <PaletteChooser
            value={colourChoice}
            onChange={chooseColours}
            templatePalette={(style !== "trailer" && TEMPLATE_MAP[template]?.palette) || plan.palette}
            templateName={style !== "trailer" ? TEMPLATE_MAP[template]?.name : undefined}
            brandColors={brandColors}
          />

          <div className="gen-row">
            <button className="btn btn-primary btn-lg grow" onClick={() => generate()} disabled={loading}>
              {loading ? "Directing…" : "Generate ✦"}
            </button>
            <button
              className="btn btn-ghost btn-lg"
              onClick={() => generate({ seed: Math.floor(Math.random() * 1e9) })}
              disabled={loading}
              title="Same prompt, new creative take"
            >
              Remix
            </button>
          </div>
          <p className="hint">
            {ai.provider !== "builtin"
              ? `AI director: ${aiLabel(ai)}.`
              : aiAvailable
                ? "AI director: Claude (server key)."
                : "Built-in director. "}
            {ai.provider === "builtin" && !aiAvailable && (
              <button className="link-btn" onClick={() => setAiOpen(true)}>
                Add an AI key
              </button>
            )}
          </p>
          {note && <p className="hint warn">{note}</p>}
        </aside>

        <section className="main">
          <div className={loading ? "dim" : ""}>
            <Player plan={plan} resetKey={version} />
          </div>

          <div className="takes">
            <div className="takes-head">
              <h2>Takes</h2>
              <span className="hint">{site ? "Alternative cuts: product-first, proof-first and a fresh story." : "Alternative creative takes on the same brief."}</span>
            </div>
            <div className="takes-row">
              {takes.map((t, i) => (
                <button key={i} className={`take-card ${t.plan === plan ? "active" : ""}`} onClick={() => show(t)} title="Use this take">
                  <LoopCanvas plan={t.plan} long={300} fps={15} />
                  <span className="take-name">{t.label}</span>
                </button>
              ))}
              <button className="take-card more" onClick={moreTakes} disabled={takesLoading || loading}>
                <span>{takesLoading ? "Directing 3 takes…" : "✦ 3 more takes"}</span>
              </button>
            </div>
          </div>

          <div className="storyboard-head">
            <h2>Storyboard</h2>
            <div className="global-opts">
              <label>
                Type
                <select className="select sm" value={plan.font} onChange={(e) => setGlobal({ font: e.target.value as VideoPlan["font"] })}>
                  <option value="inter">Clean (Inter)</option>
                  <option value="grotesk">Modern (Grotesk)</option>
                  <option value="serif">Editorial (Serif)</option>
                  <option value="mono">Code (Mono)</option>
                  <option value="anton">Impact (Anton)</option>
                </select>
              </label>
              <label>
                Tempo
                <input
                  className="input sm"
                  type="number"
                  min={70}
                  max={160}
                  value={plan.bpm}
                  onChange={(e) => setGlobal({ bpm: Number(e.target.value) })}
                />
                bpm
              </label>
            </div>
          </div>
          <div className="storyboard">
            {plan.scenes.map((s, i) => (
              <div className="scene-card" key={i}>
                {plan.style === "saas" && (
                  <input
                    className="input eyebrow-input"
                    value={s.eyebrow ?? ""}
                    placeholder="Chapter label (optional)"
                    onChange={(e) => updateScene(i, { eyebrow: e.target.value || undefined })}
                    aria-label="Chapter label"
                  />
                )}
                <div className="scene-top">
                  <span className="scene-n">{String(i + 1).padStart(2, "0")}</span>
                  <select className="select sm grow" value={s.skill} onChange={(e) => updateScene(i, { skill: e.target.value as SkillId })}>
                    {SKILLS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  className={`input headline ${plan.style === "saas" ? "natural" : ""}`}
                  value={s.text}
                  maxLength={200}
                  onChange={(e) => updateScene(i, { text: e.target.value })}
                  aria-label="Headline"
                  title="Wrap a word in *asterisks* for the gradient accent"
                />
                {SKILL_MAP[s.skill].itemsHint !== undefined && (
                  <input
                    className="input"
                    value={(s.items ?? []).join(", ")}
                    placeholder={SKILL_MAP[s.skill].itemsHint}
                    onChange={(e) =>
                      updateScene(i, {
                        items: e.target.value
                          .split(",")
                          .map((x) => x.trimStart())
                          .filter((x, j, arr) => x || j === arr.length - 1),
                      })
                    }
                    aria-label="List items"
                  />
                )}
                <input
                  className="input"
                  value={s.subtext ?? ""}
                  maxLength={60}
                  placeholder="Subtext (optional)"
                  onChange={(e) => updateScene(i, { subtext: e.target.value || undefined })}
                  aria-label="Subtext"
                />
                <div className="scene-row">
                  <label>
                    <input
                      className="input sm"
                      type="number"
                      step={0.1}
                      min={1.6}
                      max={8}
                      value={Number(s.duration.toFixed(2))}
                      onChange={(e) => updateScene(i, { duration: Number(e.target.value) })}
                    />
                    s
                  </label>
                  <select className="select sm" value={s.transition} onChange={(e) => updateScene(i, { transition: e.target.value as Scene["transition"] })}>
                    {TRANSITIONS.map((tr) => (
                      <option key={tr} value={tr}>
                        {tr}
                      </option>
                    ))}
                  </select>
                  <div className="scene-actions">
                    <button className="icon-btn sm" onClick={() => moveScene(i, -1)} aria-label="Move left">←</button>
                    <button className="icon-btn sm" onClick={() => moveScene(i, 1)} aria-label="Move right">→</button>
                    <button className="icon-btn sm" onClick={() => removeScene(i)} aria-label="Delete scene">✕</button>
                  </div>
                </div>
              </div>
            ))}
            <button className="scene-add" onClick={addScene}>
              + Add scene
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
