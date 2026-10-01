"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AiSettings, { aiForRequest, aiLabel, DEFAULT_AI, loadAiSettings, type AiSettingsValue } from "@/components/AiSettings";
import { Logo } from "@/components/Nav";
import SkillPicker from "@/components/SkillPicker";
import type { PlanLimits } from "@/lib/plans";
import { sceneThumb, thumbsReady } from "@/lib/thumbs";
import SlideTimeline from "@/components/SlideTimeline";
import Icon from "@/components/Icon";
import { useReorder } from "@/components/useReorder";
import LoopCanvas from "@/components/LoopCanvas";
import PaletteChooser, { type ColourChoice } from "@/components/PaletteChooser";
import BackgroundPicker, { applyBackground, type BgChoice, BG_OPTIONS } from "@/components/BackgroundPicker";
import { runBrowserDirector } from "@/lib/localai";
import { MAX_PHOTOS, PHOTO_ID, uploadPhotos } from "@/lib/photos";
import { isLocalProvider } from "@/lib/providers";
import TemplatePicker from "@/components/TemplatePicker";
import TextFxPicker, { TEXT_FX_OPTIONS } from "@/components/TextFxPicker";
import { applyTemplate, DEFAULT_TEMPLATE, TEMPLATE_MAP } from "@/engine/templates";
import { applyTrailerStyle, detectTrailerStyle, TRAILER_STYLE_MAP } from "@/engine/trailers";
import TrailerStylePicker from "@/components/TrailerStylePicker";
import { CONCEPT_MAP } from "@/engine/concepts";
import Player from "@/components/Player";
import VoicePanel, { loadVoiceSettings } from "@/components/VoicePanel";
import { useNarration } from "@/components/useNarration";
import { writeVoiceover } from "@/engine/script";
import { DEFAULT_VOICE, speakable, wordBudget } from "@/engine/voice";
import { EXAMPLE_PROMPTS, HERO_PLAN } from "@/engine/demos";
import { PALETTES } from "@/engine/palettes";
import { assetUrl, extractBrandColors, extractLogoColors } from "@/engine/media";
import { ANGLES, decodePlan, encodePlan, planFromPrompt, planFromSite, sanitizePlan, type Angle, type Length, type StyleChoice } from "@/engine/planner";
import { offerKey, offersIn } from "@/engine/claims";
import { SKILL_MAP } from "@/engine/skills";
import { PALETTE_IDS, TEXT_FX, TRANSITIONS, type TextFx, type Aspect, type Brand, type PaletteId, type Scene, type SiteData, type SkillId, type VideoPlan, type VoiceSettings } from "@/engine/types";

type Engine = "ai" | "builtin" | "manual";
const FILM_KEY = "intromaker.film";
const TRANSITION_NAMES: Record<string, string> = {
  cut: "Cut",
  flash: "Flash",
  zoom: "Zoom through",
  glitch: "Glitch",
  wipe: "Wipe",
  whip: "Whip pan",
  dolly: "Dolly",
  leak: "Light leak",
  shutter: "Shutter",
  push: "Push",
  dissolve: "Dissolve",
  liquid: "Liquid",
  cube: "3D cube",
};
type Take = { plan: VideoPlan; engine: Engine; engineLabel: string; label: string; note?: string };

const PRODUCT_VOICE_OFF = "intromaker.product-voice-off";

export default function Studio() {
  const params = useSearchParams();
  // Seeded from ?prompt= so the box shows what the first film was made from.
  const [prompt, setPrompt] = useState(() => params.get("prompt") ?? "");
  /** The prompt the film on screen was made from (the box may already hold the next one). */
  const promptRef = useRef(prompt);
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [length, setLength] = useState<Length>("standard");
  const [palette, setPalette] = useState<PaletteId | "auto">("auto");
  const [plan, setPlan] = useState<VideoPlan>(HERO_PLAN);
  const planRef = useRef(plan);
  planRef.current = plan;
  /** The saved film this one is, in the visitor's account (so Save updates it rather than copying). */
  const [savedId, setSavedId] = useState<string | null>(null);
  const savedIdRef = useRef(savedId);
  savedIdRef.current = savedId;
  /** Edit history for the film on screen (slides, text, look): undo / redo, Ctrl+Z / Ctrl+Shift+Z. */
  const past = useRef<VideoPlan[]>([]);
  const future = useRef<VideoPlan[]>([]);
  const lastEdit = useRef({ key: "", at: 0 });
  const [, setHistoryTick] = useState(0);
  /** The slide picked on the timeline (edited right under the player), and the one playing. */
  const [selected, setSelected] = useState<number | null>(null);
  const [activeScene, setActiveScene] = useState(0);
  const [seek, setSeek] = useState<{ t: number; key: number } | undefined>(undefined);
  const [toast, setToast] = useState<{ text: string; key: number; undo?: () => void; link?: { label: string; href: string } } | null>(null);
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
  const styleRef = useRef(style);
  styleRef.current = style;
  // Trailer films: the trailer style ("auto" matches it to the product), remembered.
  const [trailerStyle, setTrailerStyle] = useState<string>("auto");
  const trailerStyleRef = useRef(trailerStyle);
  trailerStyleRef.current = trailerStyle;
  useEffect(() => {
    try {
      const saved = localStorage.getItem("intromaker.trailer-style");
      if (saved && (saved === "auto" || TRAILER_STYLE_MAP[saved])) setTrailerStyle(saved);
    } catch {
      /* ignore */
    }
  }, []);
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
    // Product videos look best in the bright studio (or, as a trailer, in a trailer style); software
    // films get their category's style.
    const trailerCut = styleRef.current === "trailer";
    const id =
      p.style === "saas"
        ? p.product
          ? trailerCut
            ? TEMPLATE_MAP[p.template ?? ""]?.trailer
              ? p.template
              : "drop"
            : "studio"
          : p.concept
            ? CONCEPT_MAP[p.concept]?.template
            : undefined
        : undefined;
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
  /** The trailer style matched to this film's product (what Auto uses). */
  const detectedTrailer = () =>
    site
      ? detectTrailerStyle([site.name, site.tagline, site.description, ...site.headlines].join(" ").toLowerCase(), "tech").id
      : detectTrailerStyle(prompt.toLowerCase()).id;
  /** Pick a trailer style: the trailer on screen restyles instantly, and new trailers use it. */
  const chooseTrailerStyle = (id: string) => {
    setTrailerStyle(id);
    trailerStyleRef.current = id;
    try {
      localStorage.setItem("intromaker.trailer-style", id);
    } catch {
      /* ignore */
    }
    const use = id === "auto" ? detectedTrailer() : id;
    setPlan((p) => (p.style === "trailer" ? applyTrailerStyle(p, use, { palette: palette !== "auto" ? palette : undefined }) : p));
    setVersion((v) => v + 1);
  };
  /**
   * Switch between Auto, SaaS launch and Epic trailer, applied straight away: a product video
   * restyles instantly (a trailer style, or back to the studio look); any other film is remade in
   * the new style from the same website or prompt.
   */
  const chooseStyle = (id: StyleChoice) => {
    setStyle(id);
    styleRef.current = id;
    const p = planRef.current;
    if (p.product) {
      if (id === "trailer") chooseTemplate(TEMPLATE_MAP[templateRef.current]?.trailer ? templateRef.current : "drop", true);
      else if (TEMPLATE_MAP[templateRef.current]?.trailer) chooseTemplate("studio", true);
      return;
    }
    const hasFilm = p !== HERO_PLAN && (!!site || !!promptRef.current.trim() || !!prompt.trim());
    const isTrailer = p.style === "trailer";
    if (hasFilm && (id === "trailer" ? !isTrailer : isTrailer)) void generate({ prompt: promptRef.current || prompt });
  };
  useEffect(() => setAi(loadAiSettings()), []);
  // Voice-over settings are the studio's (they follow you across storyboards); the lines live on scenes.
  const [voice, setVoice] = useState<VoiceSettings>(DEFAULT_VOICE);
  const [voiceLoaded, setVoiceLoaded] = useState(false);
  useEffect(() => {
    setVoice(loadVoiceSettings(DEFAULT_VOICE));
    setVoiceLoaded(true);
  }, []);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  /** Set when the voice-over was switched on for a product video (not by you). */
  const autoVoiceOn = useRef(false);
  const onVoice = (v: VoiceSettings) => {
    if (v.enabled && !voice.enabled) setPlan((p) => writeVoiceover(p));
    // Switching it off on a product video means you don't want it auto-added to product videos.
    if (v.enabled !== voice.enabled && planRef.current.product) {
      try {
        if (v.enabled) localStorage.removeItem(PRODUCT_VOICE_OFF);
        else localStorage.setItem(PRODUCT_VOICE_OFF, "1");
      } catch {
        /* private mode */
      }
    }
    autoVoiceOn.current = false;
    setVoice(v);
  };
  const narrating = voice.enabled && voice.source !== "upload";
  const playPlan = useMemo(() => ({ ...plan, voiceover: voice }), [plan, voice]);
  // The narrator records in the background, whichever settings tab is open.
  const narration = useNarration(plan, voice, (p) => setPlan(p));
  // Product videos get a voice-over automatically (the format that sells best is narrated), with
  // a voice that works here without a key; other films go back to silent if it was added for them.
  useEffect(() => {
    if (!voiceLoaded) return;
    const cur = voiceRef.current;
    if (!plan.product) {
      if (autoVoiceOn.current && cur.enabled) setVoice({ ...cur, enabled: false });
      autoVoiceOn.current = false;
      return;
    }
    if (cur.enabled) return;
    try {
      if (localStorage.getItem(PRODUCT_VOICE_OFF)) return;
    } catch {
      /* private mode */
    }
    const v = narration.autoVoice(cur);
    if (!v) return;
    autoVoiceOn.current = true;
    setPlan((p) => writeVoiceover(p));
    setVoice(v);
    // Runs per film shown (and once the voice settings and server keys are known), not per edit.
  }, [version, voiceLoaded, !!plan.product, narration.server.openai, narration.server.elevenlabs]);
  const [siteUrl, setSiteUrl] = useState("");
  const [site, setSite] = useState<SiteData | null>(null);
  // Uploaded product photos (/api/shot URLs): with them, Generate makes a product video.
  const [photos, setPhotos] = useState<string[]>([]);
  const photosRef = useRef<string[]>([]);
  photosRef.current = photos;
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);
  /** Re-encode in the browser (at most 2000px, JPEG, no camera metadata such as location), then upload. */
  const addPhotos = async (files: FileList | File[] | null) => {
    if (!Array.from(files ?? []).some((f) => f.type.startsWith("image/"))) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const urls = await uploadPhotos(files, MAX_PHOTOS - photosRef.current.length);
      setPhotos((cur) => [...cur, ...urls].slice(0, MAX_PHOTOS));
      setImportError((e) => (e?.code === "listing" ? null : e));
    } catch (e) {
      setPhotoError((e as Error).message || "Couldn't upload the photos.");
    } finally {
      setPhotoBusy(false);
    }
  };
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
  const [importError, setImportError] = useState<{ message: string; code?: string; suggestion?: string; url: string } | null>(null);
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
    const style = styleRef.current;
    const trailerStyle = trailerStyleRef.current !== "auto" ? trailerStyleRef.current : undefined;
    const label = ANGLES.find((x) => x.id === opts.angle)?.name ?? "Take";
    const aiCfg = aiForRequest(loadAiSettings());
    const safeCopy = safeRef.current;
    const shots = photosRef.current.length ? photosRef.current : undefined;
    const body = { prompt: p, aspect: a, length: len, palette: pal, seed: opts.seed, site: s, photos: shots, colors, style, trailerStyle, ai: aiCfg, template, angle: opts.angle, safe: safeCopy, variant: opts.variant };
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
        ? planFromSite(s, { aspect: a, length: len, palette: pal, seed: opts.seed, colors, style, trailerStyle, template, angle: opts.angle, safe: safeCopy, variant: opts.variant, direction: p })
        : planFromPrompt({ prompt: p, aspect: a, length: len, palette: pal, seed: opts.seed, style, trailerStyle, template, safe: safeCopy, variant: opts.variant });
      return { plan, engine: "builtin", engineLabel: "", label };
    }
  };

  /** Which version (take) is on screen, by its place in the list. */
  const [current, setCurrent] = useState(0);
  const show = (take: Take, index?: number) => {
    // Keep edits made to the version on screen, so switching back finds them.
    const leaving = current;
    const edited = planRef.current;
    setTakes((ts) => ts.map((t, j) => (j === leaving && t.plan !== take.plan ? { ...t, plan: edited } : t)));
    past.current = [];
    future.current = [];
    setSelected(null);
    if (index !== undefined) setCurrent(index);
    let p = take.plan;
    const suggested = autoStyleRef.current ? suggestedFor(p) : undefined;
    if (suggested && suggested !== p.template) {
      p = applyTemplate(p, suggested, { palette: palette !== "auto" ? palette : undefined });
      setTemplate(suggested);
      templateRef.current = suggested;
    }
    // A trailer style you picked applies to every trailer film (the AI director's too).
    const ts = trailerStyleRef.current;
    if (p.style === "trailer" && ts !== "auto" && p.trailerStyle !== ts) p = applyTrailerStyle(p, ts, { palette: palette !== "auto" ? palette : undefined });
    setPlan({ ...applyBackground(p, bgRef.current), scheme: schemeRef.current });
    setVersion((v) => v + 1);
    setEngine(take.engine);
    setEngineLabel(take.engineLabel);
  };

  const generate = async (opts: GenOpts = {}) => {
    setLoading(true);
    setNote(null);
    // The film on screen and its versions, so making a new one can be undone.
    const before = { plan: planRef.current, takes, current, engine, engineLabel, prompt: promptRef.current };
    try {
      const take = await direct(opts);
      show(take, 0);
      setSavedId(null);
      promptRef.current = (opts.prompt ?? prompt).trim();
      setTakes([{ ...take, label: "Original" }]);
      if (before.plan !== HERO_PLAN && booted.current && !bootingRef.current)
        setToast({
          text: "Made a new film",
          key: Date.now(),
          undo: () => {
            setPlan(before.plan);
            setPrompt(before.prompt);
            setTakes(before.takes);
            setCurrent(before.current);
            setEngine(before.engine);
            setEngineLabel(before.engineLabel);
            setVersion((v) => v + 1);
          },
        });
      bootingRef.current = false;
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
  const importSite = async (raw?: string, fmt: { aspect?: Aspect; length?: Length } = {}) => {
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error ?? `The import failed (${res.status}). Try again.`), { code: data.code, suggestion: data.suggestion });
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
      // A full story arc needs room: websites default to the long cut. Product videos keep the
      // length chosen for where they'll run (short-form social works best at 15–30s).
      const len = fmt.length ?? (s.kind === "product" ? length : length === "standard" ? "long" : length);
      setLength(len);
      setImportStage(`Directing your ${s.name} film…`);
      const chosen = brandMode === "logo" ? fromLogo ?? colors : brandMode === "site" ? colors : undefined;
      if (brandMode === "logo" && !fromLogo) setBrandMode("site");
      await generate({ site: s, colors: chosen, length: len, aspect: fmt.aspect });
    } catch (e) {
      clearInterval(timer);
      const err = e as Error & { code?: string; suggestion?: string };
      setImportError({ message: err.name === "TypeError" ? "Couldn't reach IntroMaker's server. Check your connection and try again." : err.message, code: err.code, suggestion: err.suggestion, url });
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

  // Autosave: the film, its versions and the prompt are kept in this browser, so a reload or a
  // closed tab picks up where you left off. (A one-skill preview is only kept once it's edited.)
  const saving = useRef(false);
  useEffect(() => {
    if (!saving.current || plan === HERO_PLAN) return;
    const timer = window.setTimeout(() => {
      const film = { v: 1, plan, prompt, current, savedId: savedIdRef.current, takes: takes.map(({ plan: tp, engine: te, engineLabel: tl, label }) => ({ plan: tp, engine: te, engineLabel: tl, label })) };
      try {
        localStorage.setItem(FILM_KEY, JSON.stringify(film));
      } catch {
        try {
          localStorage.setItem(FILM_KEY, JSON.stringify({ ...film, takes: [], current: 0 }));
        } catch {
          /* storage full or blocked: nothing to do */
        }
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [plan, prompt, takes, current, savedId]);
  // The address shows the studio, not the prompt it booted from (a reload restores the saved film).
  const bootingRef = useRef(true);
  const cleanUrl = () => {
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      /* ignore */
    }
  };

  // Boot from URL: #plan=… (shared link), ?url=… (website), ?prompt=…, or ?skill=… from the showcase;
  // otherwise the film saved in this browser.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const filmId = params.get("film");
    if (filmId) {
      bootingRef.current = false;
      saving.current = true;
      cleanUrl();
      fetch(`/api/account/films/${encodeURIComponent(filmId)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((f: { id: string; plan: VideoPlan }) => {
          const p = sanitizePlan(f.plan);
          setPlan(p);
          setAspect(p.aspect);
          if (p.template) setTemplate(p.template);
          setTakes([]);
          setCurrent(0);
          setSavedId(f.id);
          setEngine("manual");
          setVersion((v) => v + 1);
        })
        .catch((status) => setNote(status === 401 ? "Sign in to open your saved intros." : "That saved intro wasn't found."));
      return;
    }
    const hasBootParams = hash.startsWith("#plan=") || ["skill", "url", "prompt", "photos"].some((k) => params.get(k));
    if (!hasBootParams) {
      bootingRef.current = false;
      saving.current = true;
      try {
        const saved = JSON.parse(localStorage.getItem(FILM_KEY) ?? "null");
        if (saved?.v === 1 && saved.plan?.scenes?.length) {
          const restored = sanitizePlan(saved.plan);
          setPlan(restored);
          setAspect(restored.aspect);
          if (restored.template) setTemplate(restored.template);
          setPrompt(saved.prompt ?? "");
          promptRef.current = saved.prompt ?? "";
          if (typeof saved.savedId === "string") setSavedId(saved.savedId);
          const savedTakes = Array.isArray(saved.takes) ? (saved.takes as Take[]).map((t) => ({ ...t, plan: sanitizePlan(t.plan) })) : [];
          setTakes(savedTakes);
          setCurrent(Math.min(Math.max(0, saved.current ?? 0), Math.max(0, savedTakes.length - 1)));
          setEngine("manual");
          setNote("Restored your last film from this browser. Generate or Import starts a new one.");
        }
      } catch {
        /* nothing saved, or unreadable */
      }
      return;
    }
    if (!params.get("skill")) saving.current = true;
    cleanUrl();
    const shared = hash.startsWith("#plan=") ? decodePlan(hash.slice(6)) : null;
    if (shared) {
      bootingRef.current = false;
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
    // The format chosen on the homepage (?aspect=9:16&length=standard), e.g. for Reels or Amazon.
    const fa = params.get("aspect");
    const fl = params.get("length");
    const fmt = {
      aspect: fa === "9:16" || fa === "1:1" || fa === "16:9" ? (fa as Aspect) : undefined,
      length: fl === "short" || fl === "standard" || fl === "long" ? (fl as Length) : undefined,
    };
    if (fmt.aspect) setAspect(fmt.aspect);
    if (fmt.length) setLength(fmt.length);
    // ?look=trailer: the product video cut as a trailer (the homepage's Trailer choice).
    if (params.get("look") === "trailer") {
      styleRef.current = "trailer";
      setStyle("trailer");
    }
    const web = params.get("url");
    if (web) {
      setSiteUrl(web);
      importSite(web, fmt);
      return;
    }
    // Product video from the homepage: photos uploaded there (?photos=id,id…) with a short description.
    const shots = (params.get("photos") ?? "").split(",").filter((id) => PHOTO_ID.test(id)).slice(0, MAX_PHOTOS).map((id) => `/api/shot?id=${id}`);
    const q = params.get("prompt");
    if (shots.length) {
      photosRef.current = shots;
      setPhotos(shots);
      const text = q?.trim() || "Your product";
      setPrompt(text);
      generate({ prompt: text, palette: pal ?? "auto", ...fmt });
      return;
    }
    if (q) {
      setPrompt(q);
      generate({ prompt: q, palette: pal ?? "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Save the film as it is before an edit. Edits with the same key within a second (typing) merge. */
  const record = (key = "") => {
    const now = Date.now();
    if (key && lastEdit.current.key === key && now - lastEdit.current.at < 1000) {
      lastEdit.current.at = now;
      return;
    }
    saving.current = true;
    past.current.push(planRef.current);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    lastEdit.current = { key, at: now };
    setHistoryTick((n) => n + 1);
  };
  const undoEdit = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(planRef.current);
    lastEdit.current = { key: "", at: 0 };
    setPlan(prev);
    setSelected((sel) => (sel !== null && sel >= prev.scenes.length ? null : sel));
    setHistoryTick((n) => n + 1);
  }, []);
  const redoEdit = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(planRef.current);
    lastEdit.current = { key: "", at: 0 };
    setPlan(next);
    setSelected((sel) => (sel !== null && sel >= next.scenes.length ? null : sel));
    setHistoryTick((n) => n + 1);
  }, []);
  // Shortcuts (outside text fields, which keep their own keys): Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z
  // or Ctrl+Y redo, ←/→ previous/next slide, Delete remove, D duplicate, Esc done. Space (play) is
  // the player's.
  const keys = useRef({ selectScene: (_i: number) => {}, removeScene: (_i: number) => {}, duplicateScene: (_i: number) => {}, selected: null as number | null, count: 0 });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented || (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable))) return;
      if (document.querySelector(".skill-menu, .modal")) return;
      const k = e.key.toLowerCase();
      const { selected: sel, count } = keys.current;
      if (e.metaKey || e.ctrlKey) {
        if (k === "z" && !e.shiftKey) {
          e.preventDefault();
          undoEdit();
        } else if ((k === "z" && e.shiftKey) || k === "y") {
          e.preventDefault();
          redoEdit();
        }
        return;
      }
      if (e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const next = sel === null ? (e.key === "ArrowRight" ? 0 : count - 1) : Math.max(0, Math.min(count - 1, sel + (e.key === "ArrowRight" ? 1 : -1)));
        keys.current.selectScene(next);
      } else if ((e.key === "Delete" || e.key === "Backspace") && sel !== null) {
        e.preventDefault();
        keys.current.removeScene(sel);
      } else if (k === "d" && sel !== null) {
        e.preventDefault();
        keys.current.duplicateScene(sel);
      } else if (e.key === "Escape" && sel !== null) setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoEdit, redoEdit]);
  // The undo toast stays while the pointer is on it, then fades after 8 s.
  const [toastHover, setToastHover] = useState(false);
  useEffect(() => {
    if (!toast || toastHover) return;
    const timer = window.setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timer);
  }, [toast, toastHover]);

  const startOf = (p: VideoPlan, i: number) => p.scenes.slice(0, i).reduce((a, s) => a + s.duration, 0);
  /** Pick a slide: edit it under the player, and show its settled frame. */
  const selectScene = (i: number, p: VideoPlan = plan) => {
    setSelected(i);
    const s = p.scenes[i];
    if (s) setSeek({ t: startOf(p, i) + Math.min(s.duration * 0.6, s.duration - 0.3), key: Date.now() });
  };

  // Offers on screen (free, trials, discounts) the maker hasn't confirmed are real yet.
  const pendingOffers = offersIn(plan).filter((o) => !(plan.offersOk ?? []).includes(offerKey(o.text)));
  const confirmOffers = () => {
    record("offers");
    setPlan((p) => ({ ...p, offersOk: [...new Set([...(p.offersOk ?? []), ...offersIn(p).map((o) => offerKey(o.text))])].slice(-12) }));
  };

  const updateScene = (i: number, patch: Partial<Scene>) => {
    record(`scene:${i}:${Object.keys(patch).join(",")}`);
    // Not sanitised: an empty headline mid-typing must stay empty.
    if (patch.duration !== undefined) patch.duration = Math.min(8, Math.max(1.6, patch.duration || 1.6));
    setPlan((p) => ({ ...p, scenes: p.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
    setEngine("manual");
  };
  /** Move slide `from` to position `to` (drag on the timeline, or the arrows). */
  const moveScene = (from: number, to: number) => {
    if (to < 0 || to >= plan.scenes.length || to === from) return;
    record();
    setPlan((p) => {
      const scenes = [...p.scenes];
      const [s] = scenes.splice(from, 1);
      scenes.splice(to, 0, s);
      return { ...p, scenes };
    });
    setEngine("manual");
    if (selected === from) setSelected(to);
    else if (selected !== null && from < selected && to >= selected) setSelected(selected - 1);
    else if (selected !== null && from > selected && to <= selected) setSelected(selected + 1);
  };
  // Storyboard cards reorder by dragging their grip (mouse, touch or pen).
  const cardReorder = useReorder("cards", (from, to) => moveScene(from, to));
  const removeScene = (i: number) => {
    if (plan.scenes.length <= 1) return;
    record();
    const name = SKILL_MAP[plan.scenes[i].skill]?.name ?? "Slide";
    setPlan((p) => (p.scenes.length > 1 ? { ...p, scenes: p.scenes.filter((_, j) => j !== i) } : p));
    setEngine("manual");
    setSelected((sel) => (sel === null ? null : sel === i ? null : sel > i ? sel - 1 : sel));
    setToast({ text: `Removed slide ${i + 1} (${name})`, key: Date.now(), undo: undoEdit });
  };
  const duplicateScene = (i: number) => {
    record();
    const next = { ...plan, scenes: [...plan.scenes.slice(0, i + 1), { ...plan.scenes[i], why: undefined }, ...plan.scenes.slice(i + 1)] };
    setPlan(next);
    setEngine("manual");
    selectScene(i + 1, next);
  };
  /** Add a slide of the chosen style (with its sample content) after the selected slide, or at the end. */
  const addScene = (skill: SkillId) => {
    record();
    const k = SKILL_MAP[skill];
    const at = selected !== null ? selected + 1 : plan.scenes.length;
    // Brand slides start from the film's own brand; the QR code uses the website unless a link is added.
    const brandName = (skill === "liquid-logo" || skill === "logo-reveal") && plan.brand?.name;
    const scene: Scene = {
      skill,
      text: brandName || k.sample.text,
      subtext: k.sample.subtext,
      items: skill === "qr-end" ? undefined : k.sample.items,
      duration: skill === "qr-end" ? 4.5 : 3.5,
      transition: plan.scenes[at - 1]?.transition ?? "cut",
    };
    const next = sanitizePlan({ ...plan, scenes: [...plan.scenes.slice(0, at), scene, ...plan.scenes.slice(at)] });
    setPlan(next);
    setEngine("manual");
    selectScene(at, next);
  };

  keys.current = { selectScene: (i) => selectScene(i), removeScene, duplicateScene, selected, count: plan.scenes.length };

  /** One slide's editor: in the storyboard grid, and under the player when picked on the timeline. */
  const sceneCard = (s: Scene, i: number, where: "grid" | "inspector") => {
    const skill = SKILL_MAP[s.skill];
    // Blur Reveal's list is only a fallback eyebrow; SaaS films have the chapter label for that.
    const showItems = skill.itemsHint !== undefined && !(plan.style === "saas" && s.skill === "blur-reveal");
    return (
      <div
        className={`scene-card${selected === i ? " selected" : ""}${where === "grid" ? cardReorder.classOf(i) : ""}`}
        key={`${where}-${i}`}
        id={where === "grid" ? `scene-${i}` : undefined}
        {...(where === "grid" ? { "data-reorder": "cards", "data-index": i } : {})}
      >
        <div className="scene-top">
          {where === "grid" && (
            <button type="button" className="drag-handle" data-drag-handle onPointerDown={cardReorder.start(i)} aria-label={`Drag slide ${i + 1} to reorder`} title="Drag to reorder">
              <Icon name="GripVertical" size={14} />
            </button>
          )}
          <span className="scene-n">{String(i + 1).padStart(2, "0")}</span>
          <SkillPicker plan={plan} value={s.skill} onPick={(id) => id !== s.skill && updateScene(i, { skill: id })} />
        </div>
        {plan.style === "saas" && (
          <label className="fld">
            <span className="fld-cap">Chapter label</span>
            <input className="input eyebrow-input" value={s.eyebrow ?? ""} placeholder="Optional, e.g. How it works" onChange={(e) => updateScene(i, { eyebrow: e.target.value || undefined })} />
          </label>
        )}
        <label className="fld">
          <span className="fld-cap">
            Headline <em>*word* = accent colour</em>
          </span>
          <input className={`input headline ${plan.style === "saas" ? "natural" : ""}`} value={s.text} maxLength={200} onChange={(e) => updateScene(i, { text: e.target.value })} />
        </label>
        {showItems && (
          <label className="fld">
            <span className="fld-cap" title={skill.itemsHint}>
              List <em>{skill.itemsHint}</em>
            </span>
            <input
              className="input"
              value={(s.items ?? []).join(", ")}
              placeholder={skill.itemsHint}
              onChange={(e) =>
                updateScene(i, {
                  items: e.target.value
                    .split(",")
                    .map((x) => x.trimStart())
                    .filter((x, j, arr) => x || j === arr.length - 1),
                })
              }
            />
          </label>
        )}
        <label className="fld">
          <span className="fld-cap">Subtext</span>
          <input className="input" value={s.subtext ?? ""} maxLength={60} placeholder="Optional" onChange={(e) => updateScene(i, { subtext: e.target.value || undefined })} />
        </label>
        {narrating && (
          <div className="vo-line">
            <label className="fld">
              <span className="fld-cap">Narration</span>
              <textarea className="input" rows={2} value={s.vo ?? ""} maxLength={240} placeholder="Leave empty for no voice here" onChange={(e) => updateScene(i, { vo: e.target.value || undefined })} />
            </label>
            {(() => {
              const n = s.vo ? speakable(s.vo).split(/\s+/).filter(Boolean).length : 0;
              const max = wordBudget(Math.min(8, s.duration + 1));
              return <span className={`vo-count ${n > max ? "over" : ""}`}>🎙 {n}/{wordBudget(s.duration)} words{n > max ? " · too long for this scene" : ""}</span>;
            })()}
          </div>
        )}
        <div className="scene-row">
          <label title="Length in seconds">
            <input className="input sm" type="number" step={0.1} min={1.6} max={8} value={Number(s.duration.toFixed(1))} onChange={(e) => updateScene(i, { duration: Number(e.target.value) })} aria-label="Length in seconds" />s
          </label>
          <select className="select sm" value={s.transition} onChange={(e) => updateScene(i, { transition: e.target.value as Scene["transition"] })} aria-label="Transition in" title="Transition into this slide">
            {TRANSITIONS.map((tr) => (
              <option key={tr} value={tr}>
                {TRANSITION_NAMES[tr] ?? tr}
              </option>
            ))}
          </select>
          <div className="scene-actions">
            <button className="icon-btn sm" onClick={() => moveScene(i, i - 1)} disabled={i === 0} aria-label="Move earlier" title="Move earlier">←</button>
            <button className="icon-btn sm" onClick={() => moveScene(i, i + 1)} disabled={i === plan.scenes.length - 1} aria-label="Move later" title="Move later">→</button>
            <button className="icon-btn sm" onClick={() => duplicateScene(i)} aria-label="Duplicate slide" title="Duplicate (D)">⧉</button>
            <button className="icon-btn sm" onClick={() => removeScene(i)} disabled={plan.scenes.length <= 1} aria-label="Remove slide" title="Remove from the film (Delete)">✕</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Account: who's signed in, their plan's limits, and saving films to it.
  type Account = { user: { email: string; plan: "free" | "pro" } | null; limits: PlanLimits };
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((a) => setAccount({ user: a.user, limits: a.limits }))
      .catch(() => setAccount(null));
  }, []);
  const [saveState, setSavingState] = useState<"" | "saving" | "saved">("");
  const saveFilm = async () => {
    if (!account?.user) {
      setToast({ text: "Create a free account to keep your intros.", key: Date.now(), link: { label: "Sign in or sign up", href: "/account?next=/studio" } });
      return;
    }
    setSavingState("saving");
    const p = planRef.current;
    let thumb: string | undefined;
    try {
      await thumbsReady();
      thumb = sceneThumb(p.scenes[Math.floor(p.scenes.length / 2)] ?? p.scenes[0], p);
    } catch {
      /* saved without a thumbnail */
    }
    try {
      const res = await fetch("/api/account/films", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: savedIdRef.current ?? undefined, plan: p, thumb }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSavingState("");
        setToast({ text: data.error ?? "Couldn't save.", key: Date.now(), link: res.status === 402 ? { label: "My intros", href: "/account" } : undefined });
        return;
      }
      setSavedId(data.id);
      setSavingState("saved");
      setTimeout(() => setSavingState(""), 2000);
    } catch {
      setSavingState("");
      setToast({ text: "Couldn't reach the server to save.", key: Date.now() });
    }
  };
  const saveRef = useRef(saveFilm);
  saveRef.current = saveFilm;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const setGlobal = (patch: Partial<VideoPlan>) => {
    record(`global:${Object.keys(patch).join(",")}`);
    setPlan((p) => sanitizePlan({ ...p, ...patch }));
  };

  return (
    <div className="studio">
      <header className="studio-bar">
        <Logo />
        <span className="studio-title">{plan.title}</span>
        <span className={`engine-badge ${engine}`}>
          {engine === "ai" ? `✦ ${engineLabel || "AI director"}` : engine === "builtin" ? "Built-in director" : "Manual edit"}
        </span>
        <button className="btn btn-ghost" onClick={() => setAiOpen(true)} title={`AI director: ${aiLabel(ai)}. Choose provider, key, model and mode.`}>
          ⚙ AI settings
        </button>
        <button className="btn btn-ghost" onClick={share}>
          {copied ? "Link copied ✓" : "Share link"}
        </button>
        <button className="btn btn-primary" onClick={saveFilm} disabled={saveState === "saving"} title={account?.user ? "Save to your intros (Ctrl+S)" : "Sign in to save your intros"}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : savedId ? "Save" : "Save intro"}
        </button>
        <a className="btn btn-ghost account-btn" href={account?.user ? "/account" : "/account?next=/studio"} title={account?.user ? `${account.user.email} · My intros` : "Sign in to save intros"}>
          {account?.user ? (
            <>
              <span className="avatar">{account.user.email[0]?.toUpperCase()}</span>
              <span className={`plan-badge ${account.user.plan}`}>{account.user.plan === "pro" ? "Pro" : "Free"}</span>
            </>
          ) : (
            "Sign in"
          )}
        </a>
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
          <label className="field-label first">From a website or product listing</label>
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
              placeholder="yourproduct.com or an Amazon / eBay listing"
              aria-label="Website or listing URL"
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
          {importError && (
            <div className="import-error" role="alert">
              <p>{importError.message}</p>
              <div className="import-error-actions">
                {importError.suggestion && (
                  <button
                    className="btn btn-ghost sm"
                    onClick={() => {
                      setSiteUrl(importError.suggestion!);
                      void importSite(importError.suggestion);
                    }}
                  >
                    Import {importError.suggestion.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </button>
                )}
                {importError.code === "listing" && (
                  <button className="btn btn-primary sm" onClick={() => photoInput.current?.click()}>
                    Add product photos
                  </button>
                )}
                {["timeout", "refused", "server", "busy", "failed", undefined].includes(importError.code) && (
                  <button className="btn btn-ghost sm" onClick={() => void importSite(importError.url)}>
                    Try again
                  </button>
                )}
                <button
                  className="btn btn-ghost sm"
                  onClick={() => {
                    const name = importError.url.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
                    setImportError(null);
                    if (!prompt.trim()) setPrompt(`An intro for ${name}: `);
                    requestAnimationFrame(() => {
                      const el = document.getElementById("studio-prompt") as HTMLTextAreaElement | null;
                      el?.focus();
                      el?.setSelectionRange(el.value.length, el.value.length);
                    });
                  }}
                >
                  Describe it instead
                </button>
              </div>
            </div>
          )}
          <div
            className={`photo-drop ${photos.length ? "has" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void addPhotos(e.dataTransfer.files);
            }}
          >
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void addPhotos(e.target.files);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn btn-ghost sm" onClick={() => photoInput.current?.click()} disabled={photoBusy || photos.length >= MAX_PHOTOS}>
              {photoBusy ? "Adding photos…" : "＋ Add product photos"}
            </button>
            <span className="hint">
              {photos.length
                ? `${photos.length} photo${photos.length > 1 ? "s" : ""}: Generate makes a product video.`
                : "Or drop them here for a product video. Use photos you own or have the right to use."}
            </span>
            {photos.length > 0 && (
              <div className="photo-thumbs">
                {photos.map((src) => (
                  <span key={src} className="photo-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" />
                    <button className="icon-btn sm" aria-label="Remove photo" onClick={() => setPhotos((cur) => cur.filter((x) => x !== src))}>
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            {photoError && <p className="hint warn">{photoError}</p>}
          </div>
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
                <span className={site.shots?.full ? "live" : ""}>
                  {site.kind === "product" ? `${site.marketplace ?? "Product"} listing` : site.shots?.full ? "● Live capture" : "Static import"}
                </span>
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
              {site.partial && (
                <p className="hint warn">
                  {site.marketplace ?? "The marketplace"} only let us read part of this listing: the product name from the link and its main photo. Add more
                  photos above, and type the product&apos;s name and features in the prompt (e.g. &ldquo;Aero Buds: wireless earbuds with noise cancelling, all-day
                  battery and a pocket case&rdquo;), then Generate.
                </p>
              )}
              {!site.shots?.full && site.kind !== "product" && (
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
                      <span className="swatch-pair">
                        <span className="swatch lg" style={{ background: brandColors.primary }} />
                        <span className="swatch lg" style={{ background: brandColors.secondary }} />
                      </span>
                      <span className="brand-colors-label">{colourChoice === "brand" ? "Auto brand colours ✓" : "Auto brand colours"}</span>
                    </button>
                  )}
                  {logoColors ? (
                    <button
                      className={`brand-colors ${colourChoice === "logo" ? "on" : ""}`}
                      onClick={() => chooseColours(colourChoice === "logo" ? "template" : "logo")}
                      title="Colours taken from the logo alone"
                    >
                      <span className="swatch-pair">
                        <span className="swatch lg" style={{ background: logoColors.primary }} />
                        <span className="swatch lg" style={{ background: logoColors.secondary }} />
                      </span>
                      <span className="brand-colors-label">{colourChoice === "logo" ? "Logo colours ✓" : "Logo colours"}</span>
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
            id="studio-prompt"
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
              <button key={id} className={style === id ? "active" : ""} onClick={() => chooseStyle(id)} disabled={loading}>
                {label}
              </button>
            ))}
          </div>

          {style === "trailer" && !plan.product && (
            <>
              <label className="field-label">
                Video style{" "}
                <span className="tpl-desc">
                  {TRAILER_STYLE_MAP[trailerStyle === "auto" ? (plan.style === "trailer" && plan.trailerStyle) || detectedTrailer() : trailerStyle]?.name}
                </span>
              </label>
              <button
                className={`chip auto-style ${trailerStyle === "auto" ? "active" : ""}`}
                aria-pressed={trailerStyle === "auto"}
                onClick={() => chooseTrailerStyle("auto")}
                title="Each new trailer takes the style that matches your product"
              >
                ✦ Auto: matched to your product{trailerStyle === "auto" ? ` (${TRAILER_STYLE_MAP[detectedTrailer()]?.name})` : ""}
              </button>
              <TrailerStylePicker value={trailerStyle === "auto" ? "" : trailerStyle} onChange={chooseTrailerStyle} />
              <p className="hint">
                {TRAILER_STYLE_MAP[trailerStyle === "auto" ? detectedTrailer() : trailerStyle]?.description}
                {plan.style !== "trailer" ? " Making the trailer…" : ""}
              </p>
            </>
          )}

          {(style !== "trailer" || plan.product) && (
            <>
              <label className="field-label">
                {plan.product ? (style === "trailer" ? "Trailer style" : "Product video style") : "SaaS template"} <span className="tpl-desc">{TEMPLATE_MAP[template]?.name}</span>
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
              <TemplatePicker value={template} onChange={(id) => chooseTemplate(id)} categories={plan.product && style === "trailer" ? ["Product Trailers"] : undefined} />
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
          {(style !== "trailer" || plan.product) && (
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
            templatePalette={((style !== "trailer" || plan.product) && TEMPLATE_MAP[template]?.palette) || plan.palette}
            templateName={style !== "trailer" || plan.product ? TEMPLATE_MAP[template]?.name : undefined}
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
            narration={narration}
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
                ? "AI director: provided by this site."
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
          {pendingOffers.length > 0 && (
            <div className="offer-warn" role="alert">
              <strong>Confirm {pendingOffers.length === 1 ? "this offer is" : "these offers are"} real</strong>
              <ul>
                {pendingOffers.map((o) => (
                  <li key={o.text}>
                    “{o.text}” <span className="hint sm">slide {o.scene + 1}</span>
                  </li>
                ))}
              </ul>
              <p className="hint sm">
                Only publish an offer viewers can really get, exactly as worded (a free plan or trial, a discount). If it isn&apos;t available, change the wording on
                the slide.
              </p>
              <div className="import-error-actions">
                <button className="btn btn-primary sm" onClick={confirmOffers}>
                  It&apos;s a real offer
                </button>
                <button className="btn btn-ghost sm" onClick={() => selectScene(pendingOffers[0].scene)}>
                  Edit slide {pendingOffers[0].scene + 1}
                </button>
              </div>
            </div>
          )}

          </div>
        </aside>

        <section className="main">
          <div className={loading ? "dim" : ""}>
            <Player
              plan={playPlan}
              resetKey={version}
              seek={seek}
              onScene={setActiveScene}
              limits={account?.limits}
              beforeExport={async () => {
                if (pendingOffers.length) {
                  const ok = window.confirm(
                    `This intro makes an offer: ${pendingOffers.map((o) => `“${o.text}”`).join(", ")}.\n\nExport only if viewers can really get it, exactly as worded. Is it a real offer?`,
                  );
                  if (!ok) return false;
                  confirmOffers();
                }
                // Lines still recording are finished first, so the narration is in the file.
                const film = await narration.ensure();
                if (film) return film;
                return window.confirm(`The voice-over couldn't be recorded${narration.failure() ? ` (${narration.failure()})` : ""}.\n\nExport without it?`) ? { ...playPlan, voiceover: undefined } : false;
              }}
              onExported={(p, preset) => {
                // Tell the owner's admin area what was made (ignored when it's off).
                void fetch("/api/films", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ plan: { ...p, voiceover: undefined }, preset, prompt: promptRef.current, url: site?.url }),
                }).catch(() => {});
              }}
            />
          </div>

          {narrating && (narration.busy || narration.error) && (
            <p className={`voice-status${narration.error ? " warn" : ""}`} role="status">
              {narration.error ? (
                <>
                  🎙 Voice-over: {narration.error}{" "}
                  <button className="link-btn" onClick={() => chooseTab("voice")}>
                    Voice settings
                  </button>
                </>
              ) : (
                <>🎙 {narration.busy}</>
              )}
            </p>
          )}

          <div className="edit-bar">
            <span className="hint">
              <strong>
                {plan.scenes.length} slides · {plan.scenes.reduce((a, x) => a + x.duration, 0).toFixed(1)}s
              </strong>{" "}
              · {selected === null ? "Click a slide to edit it, drag to reorder" : `Editing slide ${selected + 1}`}
              <span className="kbd-hint" title="Space play/pause · ← → previous/next slide · Delete remove · D duplicate · Esc done · Ctrl+Z undo · Ctrl+Shift+Z redo">
                {" "}
                · Shortcuts
              </span>
            </span>
            <div className="edit-bar-actions">
              <button className="link-btn" onClick={undoEdit} disabled={!past.current.length} title="Undo edit (Ctrl+Z)">
                ↶ Undo edit
              </button>
              <button className="link-btn" onClick={redoEdit} disabled={!future.current.length} title="Redo edit (Ctrl+Shift+Z)">
                ↷ Redo
              </button>
              {selected !== null && (
                <button className="link-btn" onClick={() => setSelected(null)}>
                  Done
                </button>
              )}
            </div>
          </div>
          <SlideTimeline
            plan={plan}
            selected={selected}
            active={activeScene}
            onSelect={(i) => (selected === i ? setSelected(null) : selectScene(i))}
            onRemove={removeScene}
            onDuplicate={duplicateScene}
            onMove={moveScene}
            onAdd={addScene}
          />
          {selected !== null && plan.scenes[selected] && <div className="inspector">{sceneCard(plan.scenes[selected], selected, "inspector")}</div>}

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
            {plan.scenes.map((sc, i) => sceneCard(sc, i, "grid"))}
            <SkillPicker plan={plan} onPick={addScene} variant="add" label="+ Add slide" />
          </div>
        </section>
      </div>
      {toast && (
        <div className="toast" role="status" key={toast.key} onMouseEnter={() => setToastHover(true)} onMouseLeave={() => setToastHover(false)}>
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              className="link-btn"
              onClick={() => {
                toast.undo?.();
                setToast(null);
                setToastHover(false);
              }}
            >
              Undo
            </button>
          )}
          {toast.link && (
            <a className="link-btn" href={toast.link.href}>
              {toast.link.label}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
