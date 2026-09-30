"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AiSettings, { aiForRequest, aiLabel, DEFAULT_AI, loadAiSettings, type AiSettingsValue } from "@/components/AiSettings";
import { Logo } from "@/components/Nav";
import ArcStrip from "@/components/ArcStrip";
import LoopCanvas from "@/components/LoopCanvas";
import PaletteChooser, { type ColourChoice } from "@/components/PaletteChooser";
import BackgroundPicker, { applyBackground, type BgChoice, BG_OPTIONS } from "@/components/BackgroundPicker";
import { runBrowserDirector } from "@/lib/localai";
import { isLocalProvider } from "@/lib/providers";
import TemplatePicker from "@/components/TemplatePicker";
import TextFxPicker, { TEXT_FX_OPTIONS } from "@/components/TextFxPicker";
import { applyTemplate, DEFAULT_TEMPLATE, TEMPLATE_MAP } from "@/engine/templates";
import { CONCEPT_MAP } from "@/engine/concepts";
import Player from "@/components/Player";
import VoicePanel, { loadVoiceSettings } from "@/components/VoicePanel";
import { writeVoiceover } from "@/engine/script";
import { DEFAULT_VOICE, speakable, wordBudget } from "@/engine/voice";
import { EXAMPLE_PROMPTS, HERO_PLAN } from "@/engine/demos";
import { PALETTES } from "@/engine/palettes";
import { assetUrl, extractBrandColors, extractLogoColors } from "@/engine/media";
import { ANGLES, decodePlan, encodePlan, planFromPrompt, planFromSite, sanitizePlan, type Angle, type Length, type StyleChoice } from "@/engine/planner";
import { SKILL_MAP, SKILLS } from "@/engine/skills";
import { PALETTE_IDS, TEXT_FX, TRANSITIONS, type TextFx, type Aspect, type Brand, type PaletteId, type Scene, type SiteData, type SkillId, type VideoPlan, type VoiceSettings } from "@/engine/types";

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
  // Settings live in tabs, so the panel fits the screen; the last tab used is remembered.
  type PanelTab = "create" | "style" | "colours" | "voice";
  const [tab, setTab] = useState<PanelTab>("create");
  useEffect(() => {
    try {
      const t = localStorage.getItem("intromaker.tab");
      if (t === "create" || t === "style" || t === "colours" || t === "voice") setTab(t);
    } catch {
      /* ignore */
    }
  }, []);
  const chooseTab = (t: PanelTab) => {
    setTab(t);
    try {
      localStorage.setItem("intromaker.tab", t);
    } catch {
      /* ignore */
    }
  };
  // Claim-safe copy: generic wording with no superlatives, guarantees, speed claims or numbers.
  // On by default; the site's own claims (stats, quotes, customer logos) only when switched off.
  const [safe, setSafe] = useState(true);
  const safeRef = useRef(safe);
  safeRef.current = safe;
  useEffect(() => {
    try {
      if (localStorage.getItem("intromaker.claims") === "site") setSafe(false);
    } catch {
      /* ignore */
    }
  }, []);
  const chooseSafe = (on: boolean) => {
    setSafe(on);
    safeRef.current = on;
    try {
      localStorage.setItem("intromaker.claims", on ? "safe" : "site");
    } catch {
      /* ignore */
    }
  };
  // Headline text effect: null keeps each template's own; a choice applies to every headline.
  const [textFx, setTextFx] = useState<TextFx | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem("intromaker.textfx");
      if (v && (TEXT_FX as readonly string[]).includes(v)) setTextFx(v as TextFx);
    } catch {
      /* ignore */
    }
  }, []);
  const chooseTextFx = (fx: TextFx | null) => {
    setTextFx(fx);
    try {
      if (fx) localStorage.setItem("intromaker.textfx", fx);
      else localStorage.removeItem("intromaker.textfx");
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if ((plan.textFx ?? null) !== textFx) setPlan((p) => ({ ...p, textFx: textFx ?? undefined }));
  }, [plan, textFx]);
  // Glow on type and the highlight bloom. Off by default: crisp, halo-free text.
  const [glow, setGlow] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("intromaker.glow") === "on") setGlow(true);
    } catch {
      /* ignore */
    }
  }, []);
  const chooseGlow = (on: boolean) => {
    setGlow(on);
    try {
      localStorage.setItem("intromaker.glow", on ? "on" : "off");
    } catch {
      /* ignore */
    }
  };
  // Every storyboard (new takes, template switches, shared links) follows the switch.
  useEffect(() => {
    if ((plan.glow !== false) !== glow) setPlan((p) => ({ ...p, glow: glow ? undefined : false }));
  }, [plan, glow]);
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
  // Auto style (default): each new film takes the style suggested for its kind of product. Picking
  // a style by hand turns it off; the Auto chip turns it back on.
  const [autoStyle, setAutoStyle] = useState(true);
  const autoStyleRef = useRef(true);
  autoStyleRef.current = autoStyle;
  useEffect(() => {
    try {
      if (localStorage.getItem("intromaker.style.auto") === "off") setAutoStyle(false);
    } catch {
      /* ignore */
    }
  }, []);
  const setAuto = (on: boolean) => {
    setAutoStyle(on);
    autoStyleRef.current = on;
    try {
      localStorage.setItem("intromaker.style.auto", on ? "on" : "off");
    } catch {
      /* ignore */
    }
  };
  /** The style suggested for a plan's kind of product (when auto is on and it differs). */
  const suggestedFor = (p: VideoPlan) => {
    const id = p.style === "saas" && p.concept ? CONCEPT_MAP[p.concept]?.template : undefined;
    return id && TEMPLATE_MAP[id] ? id : undefined;
  };
  /** Switch template: restyles the current SaaS storyboard instantly (no regeneration). */
  const chooseTemplate = (id: string, auto = false) => {
    if (!auto) setAuto(false);
    setTemplate(id);
    templateRef.current = id;
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
  // Voice-over settings are the studio's (they follow you across storyboards); the lines live on scenes.
  const [voice, setVoice] = useState<VoiceSettings>(DEFAULT_VOICE);
  useEffect(() => setVoice(loadVoiceSettings(DEFAULT_VOICE)), []);
  const onVoice = (v: VoiceSettings) => {
    if (v.enabled && !voice.enabled) setPlan((p) => writeVoiceover(p));
    setVoice(v);
  };
  const narrating = voice.enabled && voice.source !== "upload";
  const playPlan = useMemo(() => ({ ...plan, voiceover: voice }), [plan, voice]);
  const [siteUrl, setSiteUrl] = useState("");
  const [site, setSite] = useState<SiteData | null>(null);
  const [brandColors, setBrandColors] = useState<Brand["colors"]>(undefined);
  const [logoColors, setLogoColors] = useState<Brand["colors"]>(undefined);
  /** Which brand colours drive the film: detected across the site (auto), the logo's, or none. */
  const [brandMode, setBrandMode] = useState<"site" | "logo" | "off">("site");
  const activeColors = brandMode === "logo" ? logoColors : brandMode === "site" ? brandColors : undefined;
  const colourChoice: ColourChoice =
    palette !== "auto" ? palette : brandMode === "logo" && logoColors ? "logo" : brandMode === "site" && brandColors ? "brand" : "template";
  /** Apply a colour choice to the current film instantly (and to future generations). */
  const chooseColours = (c: ColourChoice) => {
    const mode = c === "logo" ? "logo" : c === "brand" ? "site" : "off";
    const colors = mode === "logo" ? logoColors : mode === "site" ? brandColors : undefined;
    const keepTemplate = c === "template" || c === "brand" || c === "logo";
    setBrandMode(mode);
    setPalette(keepTemplate ? "auto" : c);
    setPlan((p) => {
      const tplPalette = TEMPLATE_MAP[p.template ?? templateRef.current]?.palette;
      const pal = keepTemplate ? (p.style === "saas" && tplPalette ? tplPalette : p.palette) : c;
      return { ...p, palette: pal, brand: p.brand ? { ...p.brand, colors: colors } : p.brand };
    });
  };
  const [importing, setImporting] = useState(false);
  const [importStage, setImportStage] = useState<string | null>(null);
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
    /** Remake number: other slides for each section (0 = the director's best fit). */
    variant?: number;
  };

  /** One storyboard from the director (server AI or built-in; falls back to in-browser). */
  const direct = async (opts: GenOpts): Promise<Take> => {
    const s = opts.site !== undefined ? opts.site : site;
    const colors = opts.colors !== undefined ? opts.colors : activeColors;
    const p = (opts.prompt ?? prompt).trim() || (s ? "" : EXAMPLE_PROMPTS[0]);
    const a = opts.aspect ?? aspect;
    const pal = opts.palette ?? palette;
    const len = opts.length ?? length;
    const template = templateRef.current;
    const label = ANGLES.find((x) => x.id === opts.angle)?.name ?? "Take";
    const aiCfg = aiForRequest(loadAiSettings());
    const safeCopy = safeRef.current;
    const body = { prompt: p, aspect: a, length: len, palette: pal, seed: opts.seed, site: s, colors, style, ai: aiCfg, template, angle: opts.angle, safe: safeCopy, variant: opts.variant };
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
        ? planFromSite(s, { aspect: a, length: len, palette: pal, seed: opts.seed, colors, style, template, angle: opts.angle, safe: safeCopy, variant: opts.variant })
        : planFromPrompt({ prompt: p, aspect: a, length: len, palette: pal, seed: opts.seed, style, template, safe: safeCopy, variant: opts.variant });
      return { plan, engine: "builtin", engineLabel: "", label };
    }
  };

  /** Which version (take) is on screen, by its place in the list. */
  const [current, setCurrent] = useState(0);
  const show = (take: Take, index?: number) => {
    if (index !== undefined) setCurrent(index);
    let p = take.plan;
    const suggested = autoStyleRef.current ? suggestedFor(p) : undefined;
    if (suggested && suggested !== p.template) {
      p = applyTemplate(p, suggested, { palette: palette !== "auto" ? palette : undefined });
      setTemplate(suggested);
      templateRef.current = suggested;
    }
    setPlan({ ...applyBackground(p, bgRef.current), scheme: schemeRef.current });
    setVersion((v) => v + 1);
    setEngine(take.engine);
    setEngineLabel(take.engineLabel);
  };

  const generate = async (opts: GenOpts = {}) => {
    setLoading(true);
    setNote(null);
    try {
      const take = await direct(opts);
      show(take, 0);
      setTakes([{ ...take, label: "Original" }]);
      if (take.note || take.plan.notes?.length) setNote([take.note, ...(take.plan.notes ?? [])].filter(Boolean).join(" "));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Remake: a new version of the film with other slides for its sections (another story angle,
   * feature layout, interaction moment, opener…). Every version is kept, so Undo steps back and
   * Original returns to the first.
   */
  const [remaking, setRemaking] = useState(false);
  const remake = async () => {
    setRemaking(true);
    setNote(null);
    try {
      const n = takes.filter((t) => t.label.startsWith("Remake")).length + 1;
      const take = await direct({ seed: Math.floor(Math.random() * 1e9), variant: n });
      const base = takes.length ? takes : [{ plan, engine, engineLabel, label: "Original" }];
      const next = [...base, { ...take, label: `Remake ${n}` }];
      setTakes(next);
      show(take, next.length - 1);
      if (take.note) setNote(take.note);
    } finally {
      setRemaking(false);
    }
  };
  const undo = () => {
    if (current > 0 && takes[current - 1]) show(takes[current - 1], current - 1);
  };
  const original = () => {
    if (takes[0]) show(takes[0], 0);
  };

  /** Three alternative cuts (different story angles / creative seeds) to choose from. */
  const moreTakes = async () => {
    setTakesLoading(true);
    try {
      const angles: (Angle | undefined)[] = site ? ["product", "proof", "story"] : [undefined, undefined, undefined];
      const results = await Promise.all(angles.map((angle) => direct({ angle, seed: Math.floor(Math.random() * 1e9) })));
      setTakes((prev) => {
        const base = prev.length ? prev : [{ plan, engine, engineLabel, label: "Original" }];
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
    // Narrate what's happening while the site is captured and read.
    const stages = ["Opening the site in a real browser…", "Capturing screenshots…", "Reading copy, features and proof…"];
    let si = 0;
    setImportStage(stages[0]);
    const timer = setInterval(() => setImportStage(stages[Math.min(++si, stages.length - 1)]), 2500);
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
      clearInterval(timer);
      setImportStage("Detecting brand colours…");
      const colors = (await extractBrandColors(colorSources, s.themeColor)) ?? undefined;
      const fromLogo = (s.logo ? await extractLogoColors(assetUrl(s.logo)) : null) ?? undefined;
      setBrandColors(colors);
      setLogoColors(fromLogo);
      // A full story arc needs room: websites default to the long cut.
      const len = length === "standard" ? "long" : length;
      setLength(len);
      setImportStage(`Directing your ${s.name} film…`);
      const chosen = brandMode === "logo" ? fromLogo ?? colors : brandMode === "site" ? colors : undefined;
      if (brandMode === "logo" && !fromLogo) setBrandMode("site");
      await generate({ site: s, colors: chosen, length: len });
    } catch (e) {
      clearInterval(timer);
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
      setImportStage(null);
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
      // Preview one skill with its sample content (?aspect=9:16 and ?dur=6 for other formats and lengths).
      const asp = params.get("aspect") as Aspect | null;
      const dur = Number(params.get("dur")) || 4.5;
      setPlan(
        sanitizePlan({
          title: s.name,
          palette: pal ?? "cyber",
          font: "anton",
          aspect: asp === "9:16" || asp === "1:1" ? asp : "16:9",
          bpm: 124,
          seed: 7,
          scenes: [{ skill, text: s.sample.text, subtext: s.sample.subtext, items: s.sample.items, duration: dur, transition: "cut" }],
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
          <nav className="panel-tabs" role="tablist" aria-label="Settings">
            {(
              [
                ["create", "Create"],
                ["style", "Style"],
                ["colours", "Colours"],
                ["voice", "Voice"],
              ] as [PanelTab, string][]
            ).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => chooseTab(id)}>
                {label}
                {id === "voice" && voice.enabled && <span className="tab-dot" aria-label="on" />}
              </button>
            ))}
          </nav>
          <div className="panel-scroll">
            {tab === "create" && (
              <>
          <label className="field-label first">From a website</label>
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
          {importStage && (
            <p className="hint import-stage">
              <span className="spinner sm" /> {importStage}
            </p>
          )}
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
                {[
                  [(site.shots?.sections.length ?? 0) + (site.shots?.full ? 2 : 0), "shots"],
                  [site.images.length, "images"],
                  [site.videos.length, "videos"],
                  [site.headlines.length, "features"],
                  [site.steps?.length ?? 0, "steps"],
                  [site.stats.length, "stats"],
                  [site.testimonials.length, "quotes"],
                  [site.clientLogos.length, "logos"],
                ]
                  .filter(([n]) => (n as number) > 0)
                  .map(([n, label]) => (
                    <span key={label as string}>
                      {n} {label}
                    </span>
                  ))}
              </div>
              {!site.shots?.full && (
                <p className="hint">Tip: install Google Chrome or Microsoft Edge to capture live screenshots of the site.</p>
              )}
              {(brandColors || logoColors) && (
                <div className="brand-color-row">
                  {brandColors && (
                    <button
                      className={`brand-colors ${colourChoice === "brand" ? "on" : ""}`}
                      onClick={() => chooseColours(colourChoice === "brand" ? "template" : "brand")}
                      title="Detected automatically from the website: its theme colour, logo and images"
                    >
                      <span className="swatch lg" style={{ background: brandColors.primary }} />
                      <span className="swatch lg" style={{ background: brandColors.secondary }} />
                      {colourChoice === "brand" ? "Auto brand colours ✓" : "Auto brand colours"}
                    </button>
                  )}
                  {logoColors ? (
                    <button
                      className={`brand-colors ${colourChoice === "logo" ? "on" : ""}`}
                      onClick={() => chooseColours(colourChoice === "logo" ? "template" : "logo")}
                      title="Colours taken from the logo alone"
                    >
                      <span className="swatch lg" style={{ background: logoColors.primary }} />
                      <span className="swatch lg" style={{ background: logoColors.secondary }} />
                      {colourChoice === "logo" ? "Logo colours ✓" : "Logo colours"}
                    </button>
                  ) : (
                    site.logo && <span className="hint">Logo is black &amp; white: no logo colours.</span>
                  )}
                </div>
              )}
            </div>
          )}

          <label className="field-label">{site ? "Extra direction (optional)" : "Or describe it"}</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={site ? "e.g. focus on the dashboard, end with 'Book a demo'" : "Describe your video: product, what it does, the vibe…"}
            rows={site ? 2 : 3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
            }}
          />
          {!site && (
            <details className="examples-fold">
              <summary>Example prompts</summary>
              <div className="examples compact">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button key={p} className="chip" onClick={() => setPrompt(p)} title={p}>
                    {p.length > 38 ? `${p.slice(0, 36)}…` : p}
                  </button>
                ))}
              </div>
            </details>
          )}

          <div className="field-pair">
            <div>
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
                {a === "16:9" ? "16:9" : a === "9:16" ? "9:16" : "1:1"}
              </button>
            ))}
          </div>
            </div>
            <div>
          <label className="field-label">Length</label>
          <div className="seg-control">
            {(["short", "standard", "long"] as Length[]).map((l) => (
              <button key={l} className={length === l ? "active" : ""} onClick={() => setLength(l)}>
                {l === "short" ? "12s" : l === "standard" ? "20s" : "34s"}
              </button>
            ))}
          </div>
            </div>
          </div>
          <label className="field-label">
            Wording <span className="tpl-desc">{safe ? "Claim-safe" : "Site's claims"}</span>
          </label>
          <div className="seg-control">
            <button className={safe ? "active" : ""} onClick={() => chooseSafe(true)}>
              Claim-safe (generic)
            </button>
            <button className={!safe ? "active" : ""} onClick={() => chooseSafe(false)}>
              Use site&apos;s claims
            </button>
          </div>
          <p className="hint" title="Automated screening, not legal advice: review the copy before publishing.">
            {safe
              ? "No superlatives, guarantees, results, numbers, certifications, green claims or endorsements; health claims always removed. Not legal advice."
              : "Adds the site's stats, quotes, certifications and logos: you must be able to back them up. Health claims still removed."}
          </p>

              </>
            )}
            {tab === "style" && (
              <>
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
                  {!autoStyle && TEMPLATE_MAP[CONCEPT_MAP[plan.concept].template] && template !== CONCEPT_MAP[plan.concept].template && (
                    <button className="btn btn-ghost sm" onClick={() => chooseTemplate(CONCEPT_MAP[plan.concept!].template)}>
                      Use suggested style: {TEMPLATE_MAP[CONCEPT_MAP[plan.concept].template].name}
                    </button>
                  )}
                </div>
              )}
              <button
                className={`chip auto-style ${autoStyle ? "active" : ""}`}
                aria-pressed={autoStyle}
                onClick={() => {
                  setAuto(true);
                  const id = suggestedFor(plan);
                  if (id) chooseTemplate(id, true);
                }}
                title="Each new film takes the style suggested for its kind of product"
              >
                ✦ Auto: best style for your product
                {autoStyle && suggestedFor(plan) ? ` (${TEMPLATE_MAP[suggestedFor(plan)!].name})` : ""}
              </button>
              <TemplatePicker value={template} onChange={(id) => chooseTemplate(id)} />
              <p className="hint">{TEMPLATE_MAP[template]?.description}</p>
              <details className="fold">
                <summary>
                  <span className="field-label inline">Text effect</span>{" "}
                  <span className="tpl-desc">{textFx ? TEXT_FX_OPTIONS.find((o) => o.id === textFx)?.name : "Template default"}</span>
                </summary>
                <TextFxPicker value={textFx} onChange={chooseTextFx} plan={{ palette: plan.palette, font: plan.font, seed: plan.seed, bpm: plan.bpm, look: plan.style === "saas" ? plan.look : TEMPLATE_MAP[template].look }} />
              </details>

            </>
          )}

          <label className="field-label">
            Text glow <span className="tpl-desc">{glow ? "On" : "Off"}</span>
          </label>
          <div className="seg-control">
            <button className={!glow ? "active" : ""} onClick={() => chooseGlow(false)}>
              Crisp (no glow)
            </button>
            <button className={glow ? "active" : ""} onClick={() => chooseGlow(true)}>
              Glow
            </button>
          </div>
          <p className="hint">{glow ? "Soft halo around text and highlights." : "Sharp text, no halo or bloom."}</p>
          {style !== "trailer" && (
            <details className="fold">
              <summary>
                <span className="field-label inline">Background</span> <span className="tpl-desc">{BG_OPTIONS.find((o) => o.id === bg)?.name ?? "Template default"}</span>
              </summary>
              <BackgroundPicker value={bg} onChange={chooseBackground} palette={plan.style === "saas" ? plan.palette : TEMPLATE_MAP[template].palette} look={plan.style === "saas" ? plan.look : TEMPLATE_MAP[template].look} />
              <p className="hint">GPU gradient stages rendered with the open-source Paper Shaders (Apache-2.0).</p>
            </details>
          )}
              </>
            )}
            {tab === "colours" && (
              <>
          <label className="field-label">
            Colours <span className="tpl-desc">{colourChoice === "template" ? "Template" : colourChoice === "brand" ? "Brand (auto)" : colourChoice === "logo" ? "Logo" : PALETTES[colourChoice].name}</span>
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
              ? "60% background, 30% cards and gradients, 10% accent for highlights."
              : "Every palette colour at full strength."}
          </p>
          <PaletteChooser
            value={colourChoice}
            onChange={chooseColours}
            templatePalette={(style !== "trailer" && TEMPLATE_MAP[template]?.palette) || plan.palette}
            templateName={style !== "trailer" ? TEMPLATE_MAP[template]?.name : undefined}
            brandColors={brandColors}
            logoColors={logoColors}
            hasLogo={!!site?.logo}
          />

              </>
            )}
            {tab === "voice" && (
              <>
          <VoicePanel
            voice={voice}
            onVoice={onVoice}
            plan={plan}
            onPlan={(p) => setPlan(p)}
            onRewrite={() => setPlan((p) => writeVoiceover(p, { overwrite: true }))}
          />
              </>
            )}
          </div>
          <div className="panel-foot">
          <div className="gen-row">
            <button className="btn btn-primary btn-lg grow" onClick={() => generate()} disabled={loading}>
              {loading ? "Directing…" : "Generate ✦"}
            </button>
            <button className="btn btn-ghost btn-lg" onClick={remake} disabled={loading || remaking} title="A new version with different slides for each section. Undo or Original brings back earlier versions.">
              {remaking ? "Remaking…" : "Remake ↻"}
            </button>
          </div>
          {takes.length > 1 && (
            <div className="version-row">
              <span className="hint">
                Showing <strong>{takes[current]?.label ?? "Original"}</strong> of {takes.length}
              </span>
              <button className="link-btn" onClick={undo} disabled={current === 0}>
                ↶ Undo
              </button>
              <button className="link-btn" onClick={original} disabled={current === 0}>
                ⟲ Original
              </button>
            </div>
          )}
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
            )} ·{" "}
            <a href="/privacy" target="_blank" rel="noopener">
              Privacy
            </a>{" "}
            ·{" "}
            <a href="/licenses" target="_blank" rel="noopener">
              Licences
            </a>
          </p>
          {note && <p className="hint warn">{note}</p>}

          </div>
        </aside>

        <section className="main">
          <div className={loading ? "dim" : ""}>
            <Player plan={playPlan} resetKey={version} />
          </div>

          {plan.style === "saas" && (
            <ArcStrip plan={plan} onPick={(i) => document.getElementById(`scene-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} />
          )}

          <div className="takes">
            <div className="takes-head">
              <h2>Versions</h2>
              <span className="hint">Your original, every remake and alternative cuts. Click one to go back to it.</span>
            </div>
            <div className="takes-row">
              {takes.map((t, i) => (
                <button key={i} className={`take-card ${i === current ? "active" : ""}`} onClick={() => show(t, i)} title="Use this version">
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
              <div className="scene-card" key={i} id={`scene-${i}`}>
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
                {narrating && (
                  <div className="vo-line">
                    <textarea
                      className="input"
                      rows={2}
                      value={s.vo ?? ""}
                      maxLength={240}
                      placeholder="Narration (leave empty for no voice here)"
                      onChange={(e) => updateScene(i, { vo: e.target.value || undefined })}
                      aria-label="Narration"
                    />
                    {(() => {
                      const n = s.vo ? speakable(s.vo).split(/\s+/).filter(Boolean).length : 0;
                      const max = wordBudget(Math.min(8, s.duration + 1));
                      return <span className={`vo-count ${n > max ? "over" : ""}`}>🎙 {n}/{wordBudget(s.duration)} words{n > max ? " · too long for this scene" : ""}</span>;
                    })()}
                  </div>
                )}
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
