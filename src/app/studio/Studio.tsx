"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AiSettings, { aiForRequest, aiLabel, DEFAULT_AI, loadAiSettings, type AiSettingsValue } from "@/components/AiSettings";
import { Logo } from "@/components/Nav";
import SkillPicker from "@/components/SkillPicker";
import PointerPicker, { POINTER_NAMES } from "@/components/PointerPicker";
import ShapesPicker from "@/components/ShapesPicker";
import { SHAPE_SET_INFO } from "@/engine/shapes";
import TransitionPicker, { TransitionStylePicker, TRANSITION_NAMES } from "@/components/TransitionPicker";
import type { PlanLimits } from "@/lib/plans";
import { pauseThumbs, sceneThumb, thumbsReady, restyleScene } from "@/lib/thumbs";
import { redesignPlan } from "@/engine/redesign";
import { outputDuration, playSpeed } from "@/engine/speed";
import IntroSidebar, { type SidebarIntro } from "@/components/IntroSidebar";
import { duplicateLocalIntro, listLocalIntros, loadLocalIntro, newIntroId, removeLocalIntro, renameLocalIntro, saveLocalIntro, type LocalIntro } from "@/lib/localIntros";
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
import FontPicker, { SAAS_FONTS, TRAILER_FONTS } from "@/components/FontPicker";
import { FONT_LABELS } from "@/engine/text";
import { applyTemplate, DEFAULT_TEMPLATE, TEMPLATE_MAP } from "@/engine/templates";
import { applyTrailerStyle, detectTrailerStyle, TRAILER_STYLE_MAP } from "@/engine/trailers";
import TrailerStylePicker from "@/components/TrailerStylePicker";
import { CONCEPT_MAP } from "@/engine/concepts";
import Player from "@/components/Player";
import { BuildProgress, ImportFailure, type SiteCheck } from "@/components/BuildOverlay";
import VoicePanel, { loadVoiceSettings } from "@/components/VoicePanel";
import { useNarration } from "@/components/useNarration";
import { writeVoiceover } from "@/engine/script";
import { DEFAULT_VOICE, speakable, wordBudget } from "@/engine/voice";
import { EXAMPLE_PROMPTS, HERO_PLAN } from "@/engine/demos";
import { PALETTES } from "@/engine/palettes";
import { assetUrl, extractBrandColors, extractLogoColors } from "@/engine/media";
import { ANGLES, LENGTHS, decodePlan, encodePlan, isLength, parseSaasPrompt, planFromPrompt, planFromSite, safePlan, sanitizePlan, type Angle, type Length, type StyleChoice } from "@/engine/planner";
import { MEDIA_SKILLS, SKILL_MAP } from "@/engine/skills";
import { qrTarget } from "@/engine/skills/endings";
import { LOGO_3D_IDS } from "@/engine/skills/logo3d";
import { LOGO_CLEAN_IDS } from "@/engine/skills/logoclean";
import { marketOf } from "@/lib/markets";
import SlideMedia from "@/components/SlideMedia";
import ZoomLensEditor from "@/components/ZoomLensEditor";
import TourAreaEditor from "@/components/TourAreaEditor";
import { needsPicture } from "@/engine/placeholders";
import { slideContent } from "@/engine/newslide";
import { PALETTE_IDS, POINTER_STYLES, SHAPE_SETS, TEXT_FX, TRANSITIONS, type PointerStyle, type ShapeSet, type Transition, type FontId, type TextFx, type Aspect, type Brand, type PaletteId, type Media, type Scene, type SiteData, type SkillId, type VideoPlan, type VoiceSettings } from "@/engine/types";

type Engine = "ai" | "builtin" | "manual" | "sample";
const FILM_KEY = "intromaker.film";

/** An intro's name for the sidebar: its brand, its title, else the start of its prompt. */
function introTitle(plan: VideoPlan, prompt: string) {
  const t = (plan.brand?.name || plan.title || "").replace(/\*/g, "").trim();
  if (t && t !== "Your product") return t;
  const p = prompt.trim().split(/[,.\n]/)[0].trim();
  return p ? (p.length > 40 ? `${p.slice(0, 38)}…` : p) : "Untitled intro";
}
/**
 * What an intro was made from: the Create fields as they were at Generate or Import (the link, the
 * description, product photos, length and story), plus the imported site and its colours, so
 * opening the intro again fills them back in and remakes work from the same source.
 */
type MadeFrom = {
  url?: string;
  prompt?: string;
  photos?: string[];
  length?: Length;
  story?: "auto" | Angle;
  site?: SiteData | null;
  brandColors?: Brand["colors"];
  logoColors?: Brand["colors"];
  brandMode?: "site" | "logo" | "off";
};
/** Which cartoon style suits a description: comic, storybook, clay, outdoors, night, else Cartoon Pals. */
function cartoonStyleFor(prompt: string) {
  const p = prompt.toLowerCase();
  if (/\b(comics?|superheroe?s?|funny|comedy|jokes?)\b/.test(p)) return "comic";
  if (/\b(story|stories|storybook|bedtime|fairy ?tales?|picture books?)\b/.test(p)) return "storybook";
  if (/\b(clay|plush|cuddly|squishy|toys?)\b/.test(p)) return "claybuddies";
  if (/\b(night|sleep|sleeping|dreams?|stars?|moon)\b/.test(p)) return "nightowls";
  if (/\b(outdoors?|outside|parks?|gardens?|gardening|farms?|nature|picnics?|camping|hiking|walks?)\b/.test(p)) return "sunnypark";
  return "cartoon";
}
/** The part of MadeFrom kept on the account (the fields, not the imported site's data). */
const accountInputs = (m: MadeFrom | null) => (m ? { url: m.url, prompt: m.prompt, photos: m.photos, length: m.length, story: m.story } : undefined);
type Take = { plan: VideoPlan; engine: Engine; engineLabel: string; label: string; note?: string; angle?: Angle };

const PRODUCT_VOICE_OFF = "intromaker.product-voice-off";

export default function Studio() {
  const params = useSearchParams();
  // Seeded from ?prompt= so the box shows what the first film was made from.
  const [prompt, setPrompt] = useState(() => params.get("prompt") ?? "");
  /** The prompt the film on screen was made from (the box may already hold the next one). */
  const promptRef = useRef(prompt);
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [length, setLength] = useState<Length>("long");
  // The story's shape: the director's pick (Auto), or one asked for (problem → solution…).
  const [story, setStory] = useState<"auto" | Angle>("auto");
  const storyRef = useRef(story);
  storyRef.current = story;
  const [palette, setPalette] = useState<PaletteId | "auto">("auto");
  const [plan, setPlan] = useState<VideoPlan>(HERO_PLAN);
  const planRef = useRef(plan);
  planRef.current = plan;
  /** The saved film this one is, in the visitor's account (so Save updates it rather than copying). */
  const [savedId, setSavedId] = useState<string | null>(null);
  const savedIdRef = useRef(savedId);
  savedIdRef.current = savedId;
  // This browser's copy of the intro on screen (listed in the sidebar), from its first Generate.
  const [localId, setLocalId] = useState<string | null>(null);
  const localIdRef = useRef(localId);
  localIdRef.current = localId;
  const [localIntros, setLocalIntros] = useState<LocalIntro[]>([]);
  useEffect(() => setLocalIntros(listLocalIntros()), []);
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
  // (The sample on first open is labelled as one, not as a manual edit.)
  const [engine, setEngine] = useState<Engine>("sample");
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
  // Claim-safe copy, always: generic wording with no superlatives, guarantees, speed claims,
  // numbers or offers ("free", trials, discounts), and never a health claim.
  const safeRef = useRef(true);
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
  // Transitions: null keeps the director's mix; a choice applies to every slide (and to new takes),
  // remembering each slide's own so "Style default" brings it back.
  const [transFx, setTransFx] = useState<Transition | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem("intromaker.transition");
      if (v && (TRANSITIONS as readonly string[]).includes(v)) setTransFx(v as Transition);
    } catch {
      /* ignore */
    }
  }, []);
  const rememberTransFx = (tr: Transition | null) => {
    setTransFx(tr);
    try {
      if (tr) localStorage.setItem("intromaker.transition", tr);
      else localStorage.removeItem("intromaker.transition");
    } catch {
      /* ignore */
    }
  };
  const chooseTransFx = (tr: Transition | null) => {
    rememberTransFx(tr);
    // Back to the director's mix: each slide gets its own transition back.
    if (!tr) setPlan((p) => ({ ...p, scenes: p.scenes.map(({ baseTransition, ...s }) => ({ ...s, transition: baseTransition ?? s.transition })) }));
  };
  useEffect(() => {
    if (!transFx || !plan.scenes.some((s, i) => i > 0 && s.transition !== transFx)) return;
    setPlan((p) => ({ ...p, scenes: p.scenes.map((s, i) => (i === 0 ? s : { ...s, baseTransition: s.baseTransition ?? s.transition, transition: transFx })) }));
  }, [plan, transFx]);
  // Heading font: null keeps the style's own; a choice (kept separately for SaaS films and
  // trailers, and remembered) applies to every film of that kind, across styles and remakes.
  const [fonts, setFonts] = useState<{ saas: FontId | null; trailer: FontId | null }>({ saas: null, trailer: null });
  useEffect(() => {
    try {
      const sv = localStorage.getItem("intromaker.font.saas") as FontId | null;
      const tv = localStorage.getItem("intromaker.font.trailer") as FontId | null;
      setFonts({ saas: sv && SAAS_FONTS.includes(sv) ? sv : null, trailer: tv && TRAILER_FONTS.includes(tv) ? tv : null });
    } catch {
      /* ignore */
    }
  }, []);
  const fontKind: "saas" | "trailer" = plan.style === "trailer" ? "trailer" : "saas";
  const chooseFont = (f: FontId | null) => {
    setFonts((x) => ({ ...x, [fontKind]: f }));
    try {
      if (f) localStorage.setItem(`intromaker.font.${fontKind}`, f);
      else localStorage.removeItem(`intromaker.font.${fontKind}`);
    } catch {
      /* ignore */
    }
    // Back to the style's own face: re-apply the current style.
    if (!f) {
      if (plan.style === "trailer" && plan.trailerStyle) setPlan((p) => applyTrailerStyle(p, p.trailerStyle!, { palette: palette !== "auto" ? palette : undefined }));
      else if (plan.style === "saas") setPlan((p) => ({ ...p, font: TEMPLATE_MAP[p.template ?? template]?.font ?? p.font }));
    }
  };
  const fontChoice = fonts[fontKind];
  useEffect(() => {
    if (fontChoice && plan.font !== fontChoice) setPlan((p) => ({ ...p, font: fontChoice }));
  }, [plan, fontChoice]);
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
    if ((plan.glow === true) !== glow) setPlan((p) => ({ ...p, glow: glow ? true : undefined }));
  }, [plan, glow]);
  // Camera motion blur: on by default (moving things streak like film); remembered.
  const [motionBlur, setMotionBlur] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem("intromaker.motionblur") === "off") setMotionBlur(false);
    } catch {
      /* ignore */
    }
  }, []);
  const chooseMotionBlur = (on: boolean) => {
    setMotionBlur(on);
    try {
      localStorage.setItem("intromaker.motionblur", on ? "on" : "off");
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if ((plan.motionBlur !== false) !== motionBlur) setPlan((p) => ({ ...p, motionBlur: motionBlur ? undefined : false }));
  }, [plan, motionBlur]);
  // Contrast slides (a bold colour-block text beat every few slides): on by default; remembered.
  const [contrastOn, setContrastOn] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem("intromaker.contrast") === "off") setContrastOn(false);
    } catch {
      /* ignore */
    }
  }, []);
  const chooseContrast = (on: boolean) => {
    setContrastOn(on);
    try {
      localStorage.setItem("intromaker.contrast", on ? "on" : "off");
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if ((plan.contrast !== false) !== contrastOn) setPlan((p) => ({ ...p, contrast: contrastOn ? undefined : false }));
  }, [plan, contrastOn]);
  // The mouse pointer's look (auto: white on dark styles, graphite on light); remembered.
  const [pointer, setPointer] = useState<PointerStyle>("auto");
  useEffect(() => {
    try {
      const v = localStorage.getItem("intromaker.pointer") as PointerStyle | null;
      if (v && (POINTER_STYLES as readonly string[]).includes(v)) setPointer(v);
    } catch {
      /* ignore */
    }
  }, []);
  const choosePointer = (v: PointerStyle) => {
    setPointer(v);
    try {
      localStorage.setItem("intromaker.pointer", v);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if ((plan.pointer ?? "auto") !== pointer) setPlan((p) => ({ ...p, pointer: pointer === "auto" ? undefined : pointer }));
  }, [plan, pointer]);
  // What floats behind SaaS slides: a set of animated shapes (geometric by default), watermark
  // text, or nothing. Remembered, and saved with the video.
  const [shapes, setShapes] = useState<ShapeSet | "off">("geometric");
  const [watermark, setWatermark] = useState("");
  useEffect(() => {
    try {
      const v = localStorage.getItem("intromaker.shapes");
      if (v === "off" || (SHAPE_SETS as readonly string[]).includes(v ?? "")) setShapes(v as ShapeSet | "off");
      setWatermark(localStorage.getItem("intromaker.watermark") ?? "");
    } catch {
      /* ignore */
    }
  }, []);
  const chooseShapes = (v: ShapeSet | "off") => {
    setShapes(v);
    try {
      localStorage.setItem("intromaker.shapes", v);
    } catch {
      /* ignore */
    }
  };
  const chooseWatermark = (text: string) => {
    setWatermark(text);
    try {
      localStorage.setItem("intromaker.watermark", text);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    const want = {
      shapes: shapes === "off" ? false : undefined,
      shapeSet: shapes === "off" || shapes === "geometric" ? undefined : shapes,
      watermark: shapes === "text" && watermark.trim() ? watermark.trim().slice(0, 40) : undefined,
    };
    if (plan.shapes !== want.shapes || plan.shapeSet !== want.shapeSet || plan.watermark !== want.watermark) setPlan((p) => ({ ...p, ...want }));
  }, [plan, shapes, watermark]);
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
  // a style by hand turns it off for that film (its remakes and takes keep it); the next film made
  // from another website or prompt picks its own best style again. The Auto chip turns it back on.
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
  /**
   * Which film a hand-picked style (SaaS style or trailer style) belongs to: its website or prompt.
   * A new film from anything else goes back to Auto. Kept with the film, so a reload remembers it.
   */
  const pickedForRef = useRef<string | null>(null);
  useEffect(() => {
    try {
      pickedForRef.current = localStorage.getItem("intromaker.style.for");
    } catch {
      /* ignore */
    }
  }, []);
  const subjectOf = (s: SiteData | null | undefined, p: string) => (s ? `site:${s.url}` : `prompt:${p.trim().toLowerCase()}`);
  const markPicked = () => {
    // The film being worked on: the website, else what's in the prompt box (a style picked before
    // pressing Generate on a new prompt is meant for that film).
    const key = subjectOf(site, prompt || promptRef.current);
    pickedForRef.current = key;
    try {
      localStorage.setItem("intromaker.style.for", key);
    } catch {
      /* ignore */
    }
  };
  /** A new film (another website or prompt): back to Auto, so it gets the best style for itself. */
  const autoForNewFilm = (s: SiteData | null | undefined, p: string) => {
    if (pickedForRef.current === subjectOf(s, p)) return;
    pickedForRef.current = null;
    try {
      localStorage.removeItem("intromaker.style.for");
    } catch {
      /* ignore */
    }
    if (!autoStyleRef.current) {
      setAuto(true);
      setTemplate(DEFAULT_TEMPLATE);
      templateRef.current = DEFAULT_TEMPLATE;
    }
    if (trailerStyleRef.current !== "auto") {
      setTrailerStyle("auto");
      trailerStyleRef.current = "auto";
      try {
        localStorage.setItem("intromaker.trailer-style", "auto");
      } catch {
        /* ignore */
      }
    }
  };
  /** The style suggested for a plan's kind of product (when auto is on and it differs). */
  const suggestedFor = (p: VideoPlan) => {
    // Product videos look best in the bright studio (or, as a trailer, in a trailer style); software
    // films get their category's style.
    const trailerCut = styleRef.current === "trailer";
    // Asked for characters (a cartoon, a mascot, a video for kids): the cartoon style tells it.
    const cartoon = p.style === "saas" && !p.product && /\b(cartoons?|animated characters?|characters?|mascots?|kids?|children|preschool)\b/i.test(promptRef.current);
    const id = cartoon
      ? cartoonStyleFor(promptRef.current)
      : p.style === "saas"
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
    if (!auto) {
      setAuto(false);
      markPicked();
    }
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
  /** Pick a trailer style: the trailer on screen restyles instantly (and its remakes keep it). */
  const chooseTrailerStyle = (id: string) => {
    if (id !== "auto") markPicked();
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
  const [siteUrl, setSiteUrl] = useState(() => (params.get("film") ? "" : (params.get("url") ?? "")));
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
  /** What the intro on screen was made from (saved with it; see MadeFrom). */
  const madeFromRef = useRef<MadeFrom | null>(null);
  /** Fill the Create fields with what an intro was made from (an older intro: just its description). */
  const restoreInputs = (m: MadeFrom | null | undefined, fallbackPrompt = "") => {
    const from = m ?? (fallbackPrompt ? { prompt: fallbackPrompt } : null);
    madeFromRef.current = from;
    setSiteUrl(from?.url ?? from?.site?.url ?? "");
    setUrlHint(null);
    setImportError(null);
    setPrompt(from?.prompt ?? "");
    promptRef.current = from?.prompt ?? "";
    setPhotos(Array.isArray(from?.photos) ? from.photos.filter((x) => typeof x === "string").slice(0, MAX_PHOTOS) : []);
    setPhotoError(null);
    if (from?.length && isLength(from.length)) setLength(from.length);
    const st = from?.story;
    if (st && (st === "auto" || ANGLES.some((a) => a.id === st))) {
      setStory(st);
      storyRef.current = st;
    }
    setSite(from?.site ?? null);
    setBrandColors(from?.brandColors);
    setLogoColors(from?.logoColors);
    if (from?.brandMode) setBrandMode(from.brandMode);
  };
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
  // Opened with ?url=…: the build progress shows from the first paint, not after the studio loads.
  const [importing, setImporting] = useState(() => !!params.get("url") && !params.get("film"));
  const [importStage, setImportStage] = useState<string | null>(() => (params.get("url") && !params.get("film") ? "Opening the site in a real browser…" : null));
  const [importError, setImportError] = useState<{ message: string; code?: string; suggestion?: string; url: string; side?: "site" | "ours" | "limit" | "network" } | null>(null);
  // A quick health check of the site after a failed import (online? blocks bots? readable?).
  const [siteCheck, setSiteCheck] = useState<SiteCheck | "loading" | "failed" | null>(null);
  const runSiteCheck = (url: string) => {
    setSiteCheck("loading");
    fetch("/api/scrape/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { check: SiteCheck }) => setSiteCheck(d.check))
      .catch(() => setSiteCheck("failed"));
  };
  const booted = useRef(false);
  // Slide thumbnails wait while the preview is covered (building, or the import's failure card).
  const covered = importing || (loading && !takesLoading) || (!!importError && !loading);
  useEffect(() => {
    pauseThumbs(covered);
    return () => pauseThumbs(false);
  }, [covered]);

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
    /** Cancels the request (the Stop button). */
    signal?: AbortSignal;
  };

  /**
   * Stop: every director run (generate, remake, takes, import) carries the run number it started
   * with; Stop moves the number on and aborts the request in flight, so a late answer is ignored
   * and the film on screen stays as it was.
   */
  const runRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const startRun = () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    return { run: ++runRef.current, signal: ac.signal };
  };
  const stillRunning = (run: number) => run === runRef.current;
  const stopped = (e: unknown) => (e as Error)?.name === "AbortError";

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
    const angle = opts.angle ?? (storyRef.current !== "auto" ? storyRef.current : undefined);
    const label = ANGLES.find((x) => x.id === opts.angle)?.name ?? "Take";
    const aiCfg = aiForRequest(loadAiSettings());
    const safeCopy = safeRef.current;
    const shots = photosRef.current.length ? photosRef.current : undefined;
    const body = { prompt: p, aspect: a, length: len, palette: pal, seed: opts.seed, site: s, photos: shots, colors, style, trailerStyle, ai: aiCfg, template, angle, safe: safeCopy, variant: opts.variant };
    // Local AI runs where the model is: from this browser when the server is online.
    if (isLocalProvider(aiCfg.provider) && !localViaServerRef.current) {
      try {
        const data = await runBrowserDirector(body, aiCfg);
        if (opts.signal?.aborted) throw new DOMException("Stopped", "AbortError");
        return { plan: sanitizePlan(data.plan as VideoPlan), engine: data.engine as Engine, engineLabel: data.engineLabel ?? "", note: data.note, label };
      } catch (e) {
        if (opts.signal?.aborted) throw new DOMException("Stopped", "AbortError");
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, ai: { provider: "builtin" } }),
          signal: opts.signal,
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
        signal: opts.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { plan: sanitizePlan(data.plan), engine: data.engine, engineLabel: data.engineLabel ?? "", note: data.note, label };
    } catch (e) {
      // Stopped: no fallback, the run is over.
      if (opts.signal?.aborted || stopped(e)) throw new DOMException("Stopped", "AbortError");
      // Offline or API unavailable: the director also runs in the browser.
      const plan = s
        ? planFromSite(s, { aspect: a, length: len, palette: pal, seed: opts.seed, colors, style, trailerStyle, template, angle, safe: safeCopy, variant: opts.variant, direction: p })
        : planFromPrompt({ prompt: p, aspect: a, length: len, palette: pal, seed: opts.seed, style, trailerStyle, template, safe: safeCopy, variant: opts.variant, angle });
      const why = e instanceof Error && /^HTTP 50[234]$/.test(e.message) ? "the server stopped waiting for the AI's answer" : e instanceof Error && e.message.startsWith("HTTP") ? `server error ${e.message.slice(5)}` : "couldn't reach the server";
      const note = aiCfg.provider !== "builtin" ? `AI director unavailable (${why}); used the built-in director.` : undefined;
      return { plan, engine: "builtin", engineLabel: "", note, label };
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
    const { run, signal } = opts.signal ? { run: runRef.current, signal: opts.signal } : startRun();
    // A film from another website or prompt picks its own best style; the same one keeps your pick.
    autoForNewFilm(opts.site !== undefined ? opts.site : site, opts.prompt ?? prompt);
    setLoading(true);
    setNote(null);
    // The film on screen and its versions, so making a new one can be undone.
    const before = { plan: planRef.current, takes, current, engine, engineLabel, prompt: promptRef.current, localId: localIdRef.current, savedId: savedIdRef.current, madeFrom: madeFromRef.current };
    try {
      const take = await direct({ ...opts, signal });
      if (!stillRunning(run)) return;
      // (Known before the take is shown, so its style suggestion reads this description.)
      promptRef.current = (opts.prompt ?? prompt).trim();
      show(take, 0);
      setSavedId(null);
      // A new intro: its own entry in the sidebar.
      const id = newIntroId();
      localIdRef.current = id;
      setLocalId(id);
      promptRef.current = (opts.prompt ?? prompt).trim();
      const usedSite = opts.site !== undefined ? opts.site : site;
      madeFromRef.current = {
        url: usedSite?.url ?? (siteUrl.trim() || undefined),
        prompt: promptRef.current || undefined,
        photos: photosRef.current.length ? [...photosRef.current] : undefined,
        length: opts.length ?? length,
        story: storyRef.current,
        site: usedSite ?? null,
        brandColors: opts.colors ?? activeColors,
        brandMode,
      };
      setTakes([{ ...take, label: "Original" }]);
      if (before.plan !== HERO_PLAN && booted.current && !bootingRef.current)
        setToast({
          text: "Made a new video",
          key: Date.now(),
          undo: () => {
            setPlan(before.plan);
            madeFromRef.current = before.madeFrom;
            setLocalId(before.localId);
            localIdRef.current = before.localId;
            setSavedId(before.savedId);
            setPrompt(before.prompt);
            setTakes(before.takes);
            setCurrent(before.current);
            setEngine(before.engine);
            setEngineLabel(before.engineLabel);
            setVersion((v) => v + 1);
          },
        });
      // On a phone the preview sits below the form: bring the new video into view.
      if (booted.current && !bootingRef.current && window.matchMedia("(max-width: 900px)").matches)
        requestAnimationFrame(() => document.querySelector(".studio .player")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      bootingRef.current = false;
      if (take.note || take.plan.notes?.length) setNote([take.note, ...(take.plan.notes ?? [])].filter(Boolean).join(" "));
    } catch (e) {
      if (!stopped(e)) throw e;
    } finally {
      if (stillRunning(run)) setLoading(false);
    }
  };

  /**
   * Remake: a new version of the film with other slides for its sections (another story angle,
   * feature layout, interaction moment, opener…). Every version is kept, so Undo steps back and
   * Original returns to the first.
   */
  const [remaking, setRemaking] = useState(false);
  const [remakeMenu, setRemakeMenu] = useState(false);
  /** Adds a version after the ones there are, and shows it. */
  const addTake = (take: Take) => {
    const base = takes.length ? takes : [{ plan, engine, engineLabel, label: "Original", angle: storyRef.current !== "auto" ? storyRef.current : undefined }];
    const next = [...base, take];
    setTakes(next);
    show(take, next.length - 1);
  };

  /**
   * Remake design: the same story (slides, words, pictures, timing and your edits) with each slide
   * in another design of its family. Instant, made in the browser.
   */
  const remakeDesign = () => {
    setRemakeMenu(false);
    const n = takes.filter((t) => t.label.startsWith("Design")).length + 1;
    const { plan: next, changed } = redesignPlan(planRef.current, n, restyleScene);
    if (!changed) {
      setToast({ text: "These slides have no other designs that fit their content.", key: Date.now() });
      return;
    }
    addTake({ plan: next, engine: "manual", engineLabel: "", label: `Design ${n}`, angle: takes[current]?.angle });
    setToast({ text: `New designs for ${changed} slide${changed === 1 ? "" : "s"}, same story.`, key: Date.now() });
  };

  /**
   * The story angles a new telling can take, in turn after the one on screen, keeping only those the
   * material supports (problem-led needs problems to open on, proof-first needs real proof) and
   * that actually tell it differently. Judged with the built-in director, which runs in the browser.
   */
  const nextStory = (): Angle | undefined => {
    const source = promptRef.current.trim() || prompt.trim();
    const local = (angle: Angle) => {
      const common = { aspect: plan.aspect, length, palette: "auto" as const, seed: plan.seed, style: styleRef.current, template: templateRef.current, safe: true, angle };
      try {
        return site ? planFromSite(site, { ...common, colors: plan.brand?.colors, direction: source }) : source ? planFromPrompt({ prompt: source, ...common }) : null;
      } catch {
        return null;
      }
    };
    const shape = (p: VideoPlan) => p.scenes.map((s) => s.role ?? "").join(">");
    const now = shape(planRef.current);
    const order: Angle[] = site?.kind === "product" ? ["product", "proof", "story"] : ["problem", "bab", "product", "proof", "story"];
    const last = takes[current]?.angle ?? (storyRef.current !== "auto" ? storyRef.current : "story");
    const from = Math.max(0, order.indexOf(last));
    for (let k = 1; k <= order.length; k++) {
      const angle = order[(from + k) % order.length];
      const p = local(angle);
      if (!p) continue;
      const roles = new Set(p.scenes.map((s) => s.role));
      if ((angle === "problem" || angle === "bab") && !roles.has("pain")) continue;
      if (angle === "proof" && !["quote", "logos", "metric", "cards"].some((r) => roles.has(r))) continue;
      if (shape(p) === now) continue;
      return angle;
    }
    return undefined;
  };

  /** The Story picker: retells the video on screen in the story chosen (Auto: the director's pick). */
  const applyStory = async (choice: "auto" | Angle) => {
    setStory(choice);
    storyRef.current = choice;
    // Before there's a video of your own (or while one is being made) it applies to the next Generate.
    // (Retold from what the video on screen was made from, not from an edit typed since.)
    const source = promptRef.current.trim();
    if (!(site || source) || loading || importing || remaking || takesLoading) return;
    if (madeFromRef.current) madeFromRef.current = { ...madeFromRef.current, story: choice };
    const { run, signal } = startRun();
    setRemaking(true);
    setNote(null);
    try {
      const angle = choice === "auto" ? undefined : choice;
      const take = await direct({ seed: plan.seed, angle, signal, ...(site ? {} : { prompt: source }) });
      if (!stillRunning(run)) return;
      const name = angle ? ANGLES.find((a) => a.id === angle)?.name : "Auto";
      addTake({ ...take, label: `Story · ${name}`, angle });
      if (take.note) setNote(take.note);
    } catch (e) {
      if (!stopped(e)) throw e;
    } finally {
      if (stillRunning(run)) setRemaking(false);
    }
  };

  /** Remake story: a new telling of the same material (another story angle, where it makes sense). */
  const remake = async () => {
    setRemakeMenu(false);
    const { run, signal } = startRun();
    setRemaking(true);
    setNote(null);
    try {
      const n = takes.filter((t) => t.label.startsWith("Story") || t.label.startsWith("Remake")).length + 1;
      // Trailers have no story angles: a remake draws other slides for the same beats.
      const angle = plan.style === "trailer" ? undefined : nextStory();
      const take = await direct({ seed: Math.floor(Math.random() * 1e9), variant: n, angle, signal });
      if (!stillRunning(run)) return;
      const name = ANGLES.find((a) => a.id === angle)?.name;
      addTake({ ...take, label: name ? `Story ${n} · ${name}` : `Remake ${n}`, angle });
      if (take.note) setNote(take.note);
      else if (plan.style !== "trailer" && !angle) setNote("This material supports one story, so the remake tells it with other slides. Add problems, steps or proof (or import the website) for other ways to tell it.");
    } catch (e) {
      if (!stopped(e)) throw e;
    } finally {
      if (stillRunning(run)) setRemaking(false);
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
    const { run, signal } = startRun();
    setTakesLoading(true);
    try {
      const angles: (Angle | undefined)[] = site ? ["product", "proof", "story"] : [undefined, undefined, undefined];
      const results = await Promise.all(angles.map((angle) => direct({ angle, seed: Math.floor(Math.random() * 1e9), signal })));
      if (!stillRunning(run)) return;
      setTakes((prev) => {
        const base = prev.length ? prev : [{ plan, engine, engineLabel, label: "Original" }];
        return [...base, ...results.map((r, i) => ({ ...r, label: `Take ${base.length + i + 1}${r.label !== "Take" ? ` · ${r.label}` : ""}` }))].slice(-8);
      });
    } catch (e) {
      if (!stopped(e)) throw e;
    } finally {
      if (stillRunning(run)) setTakesLoading(false);
    }
  };

  /** Scrape a website, pull its brand colours, then storyboard an intro from it. */
  const [urlHint, setUrlHint] = useState<string | null>(null);
  const importSite = async (raw?: string, fmt: { aspect?: Aspect; length?: Length } = {}) => {
    const url = (raw ?? siteUrl).trim();
    if (!url) return;
    // Not an address at all (words, no domain): say so here instead of trying to import it.
    // (A bare 10-character Amazon product code still imports.)
    if (/\s/.test(url) || (!url.includes(".") && !/^[A-Z0-9]{10}$/i.test(url))) {
      setUrlHint("That doesn't look like a web address. Paste a link like yourproduct.com or a product listing, or describe your product below.");
      return;
    }
    setUrlHint(null);
    const { run, signal } = startRun();
    setImporting(true);
    // Narrate what's happening while the site is captured and read.
    const stages = ["Opening the site in a real browser…", "Capturing screenshots…", "Reading copy, features and proof…"];
    let si = 0;
    setImportStage(stages[0]);
    const timer = setInterval(() => setImportStage(stages[Math.min(++si, stages.length - 1)]), 2500);
    setImportError(null);
    setSiteCheck(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // No message from Prodintro.com itself: the hosting gateway answered (the server crashed,
        // restarted or ran out of time), which is on our side, not the website's.
        const ours = !data.error && res.status >= 500;
        throw Object.assign(
          new Error(
            ours
              ? `Prodintro.com's server didn't finish reading the site (error ${res.status} from the hosting service). It may be restarting or short of memory while capturing the page.`
              : (data.error ?? `The import failed (${res.status}).`),
          ),
          { code: ours ? "server" : data.code, suggestion: data.suggestion, side: ours ? "ours" : res.status === 429 ? "limit" : data.code === "failed" ? "ours" : "site" },
        );
      }
      if (!stillRunning(run)) return;
      const s: SiteData = data.site;
      setSite(s);
      setSiteUrl(s.url);
      const colorSources = [s.logo, ...s.images.slice(0, 2)].filter(Boolean).map((u) => assetUrl(u as string));
      clearInterval(timer);
      setImportStage("Detecting brand colours…");
      const colors = (await extractBrandColors(colorSources, s.themeColor)) ?? undefined;
      const fromLogo = (s.logo ? await extractLogoColors(assetUrl(s.logo)) : null) ?? undefined;
      if (!stillRunning(run)) return;
      setBrandColors(colors);
      setLogoColors(fromLogo);
      // A full story arc needs room: websites default to the long cut. Product videos keep the
      // length chosen for where they'll run (short-form social works best at 15–30s).
      const len = fmt.length ?? (s.kind === "product" ? length : length === "standard" ? "long" : length);
      setLength(len);
      setImportStage(`Directing your ${s.name} video…`);
      const chosen = brandMode === "logo" ? fromLogo ?? colors : brandMode === "site" ? colors : undefined;
      if (brandMode === "logo" && !fromLogo) setBrandMode("site");
      await generate({ site: s, colors: chosen, length: len, aspect: fmt.aspect, signal });
      // The site's and the logo's colours, so reopening the intro offers both again.
      if (stillRunning(run) && madeFromRef.current?.site === s) madeFromRef.current = { ...madeFromRef.current, brandColors: colors, logoColors: fromLogo, brandMode: brandMode === "logo" && !fromLogo ? "site" : brandMode };
    } catch (e) {
      clearInterval(timer);
      if (stopped(e) || !stillRunning(run)) return;
      const err = e as Error & { code?: string; suggestion?: string; side?: "site" | "ours" | "limit" | "network" };
      const network = err.name === "TypeError";
      setImportError({
        message: network ? "Couldn't reach Prodintro.com's server. Check your internet connection and try again." : err.message,
        code: network ? "failed" : err.code,
        suggestion: err.suggestion,
        url,
        side: network ? "network" : (err.side ?? "site"),
      });
      // Find out whether the website itself is fine (unless it's a limit or a typo).
      if (!network && err.side !== "limit" && err.code !== "invalid") runSiteCheck(url);
      else setSiteCheck(null);
    } finally {
      clearInterval(timer);
      if (stillRunning(run)) {
        setImporting(false);
        setImportStage(null);
      }
    }
  };

  /** Stop the director: the request is cancelled and every button goes back to its default. */
  const stopDirecting = () => {
    runRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setRemaking(false);
    setTakesLoading(false);
    setImporting(false);
    setImportStage(null);
    setToast({ text: "Stopped. The video on screen is unchanged.", key: Date.now() });
  };

  /** After a failed import: start a prompt about the site instead. */
  const describeInstead = (url: string) => {
    const name = url.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
    setImportError(null);
    if (!prompt.trim()) setPrompt(`An intro for ${name}: `);
    requestAnimationFrame(() => {
      const el = document.getElementById("studio-prompt") as HTMLTextAreaElement | null;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    });
  };

  // ── The sidebar: intros saved to the account and the ones made in this browser, newest first.
  const [accountFilms, setAccountFilms] = useState<{ id: string; title: string; updatedAt: number; thumb?: string }[]>([]);
  const loadAccountFilms = useCallback(() => {
    fetch("/api/account/films")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && Array.isArray(d.films) && setAccountFilms(d.films))
      .catch(() => {});
  }, []);
  const sidebarIntros = useMemo<SidebarIntro[]>(() => {
    const saved = new Set(accountFilms.map((f) => f.id));
    const out: SidebarIntro[] = accountFilms.map((f) => ({ key: `a:${f.id}`, title: f.title || "Untitled intro", updatedAt: f.updatedAt, color: "#7c5cff", thumb: f.thumb }));
    for (const l of localIntros) if (!(l.savedId && saved.has(l.savedId))) out.push({ key: `l:${l.id}`, title: l.title, updatedAt: l.updatedAt, color: l.color });
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [accountFilms, localIntros]);
  const currentIntro = savedId && accountFilms.some((f) => f.id === savedId) ? `a:${savedId}` : localId ? `l:${localId}` : null;
  const busy = loading || importing || remaking || takesLoading;
  /** Open an intro from the sidebar (an account copy, or this browser's). */
  const openIntro = (x: SidebarIntro) => {
    if (busy || x.key === currentIntro) return;
    const id = x.key.slice(2);
    setSelected(null);
    setNote(null);
    setSite(null);
    if (x.key.startsWith("a:")) {
      fetch(`/api/account/films/${encodeURIComponent(id)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((f: { id: string; plan: VideoPlan; inputs?: MadeFrom }) => {
          const p = sanitizePlan(f.plan);
          setPlan(p);
          setAspect(p.aspect);
          if (p.template) setTemplate(p.template);
          setTakes([]);
          setCurrent(0);
          setSavedId(f.id);
          const local = localIntros.find((l) => l.savedId === f.id);
          // The fields it was made from: this browser's copy has the imported site too.
          const kept = local ? loadLocalIntro<{ inputs?: MadeFrom; prompt?: string }>(local.id) : null;
          restoreInputs(kept?.inputs ?? f.inputs, kept?.prompt ?? "");
          localIdRef.current = local?.id ?? null;
          setLocalId(local?.id ?? null);
          setEngine("manual");
          setVersion((v) => v + 1);
        })
        .catch(() => setToast({ text: "That intro couldn't be opened.", key: Date.now() }));
      return;
    }
    const saved = loadLocalIntro<{ plan: VideoPlan; prompt?: string; savedId?: string | null; inputs?: MadeFrom }>(id);
    if (!saved?.plan?.scenes?.length) {
      setToast({ text: "That intro is no longer in this browser.", key: Date.now() });
      return;
    }
    const p = sanitizePlan(saved.plan);
    setPlan(p);
    setAspect(p.aspect);
    if (p.template) setTemplate(p.template);
    restoreInputs(saved.inputs, saved.prompt ?? "");
    setSavedId(saved.savedId ?? null);
    setTakes([]);
    setCurrent(0);
    localIdRef.current = id;
    setLocalId(id);
    setEngine("manual");
    setVersion((v) => v + 1);
  };
  /** + New intro: an empty studio, the description box ready. */
  const newIntro = () => {
    if (busy) return;
    restoreInputs(null);
    setPlan(HERO_PLAN);
    setTakes([]);
    setCurrent(0);
    setSavedId(null);
    localIdRef.current = null;
    setLocalId(null);
    setSelected(null);
    setNote(null);
    setVersion((v) => v + 1);
    try {
      localStorage.removeItem(FILM_KEY);
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => document.getElementById("studio-prompt")?.focus());
  };

  /** Sidebar ⋯ menu: rename an intro (the account copy and this browser's). */
  const renameIntro = (x: SidebarIntro, title: string) => {
    const id = x.key.slice(2);
    if (x.key.startsWith("a:")) {
      setAccountFilms((fs) => fs.map((f) => (f.id === id ? { ...f, title } : f)));
      const local = localIntros.find((l) => l.savedId === id);
      if (local) setLocalIntros(renameLocalIntro(local.id, title));
      fetch(`/api/account/films/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) })
        .then((r) => {
          if (!r.ok) throw new Error();
        })
        .catch(() => {
          setToast({ text: "Couldn't rename that intro.", key: Date.now() });
          loadAccountFilms();
        });
      return;
    }
    setLocalIntros(renameLocalIntro(id, title));
  };
  /** Sidebar ⋯ menu: a copy of an intro, kept in this browser (and in the account when signed in). */
  const duplicateIntro = async (x: SidebarIntro) => {
    const id = x.key.slice(2);
    let made: { id: string; list: LocalIntro[] } | null = null;
    if (x.key.startsWith("a:")) {
      try {
        const r = await fetch(`/api/account/films/${encodeURIComponent(id)}`);
        if (!r.ok) throw new Error();
        const f = (await r.json()) as { plan: VideoPlan; title?: string; thumb?: string; inputs?: MadeFrom };
        const plan = sanitizePlan(f.plan);
        // The account keeps the copy too, when there's room (otherwise it stays in this browser).
        const res = await fetch("/api/account/films", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `${x.title} copy`.slice(0, 120), plan, thumb: f.thumb, inputs: f.inputs }) });
        const saved = res.ok ? ((await res.json()) as { id: string }) : null;
        made = duplicateLocalIntro({ title: x.title, color: plan.brand?.colors?.primary ?? "#7c5cff", aspect: plan.aspect }, { v: 1, plan, prompt: f.inputs?.prompt ?? "", inputs: f.inputs, current: 0, takes: [] });
        if (made && saved) made = { id: made.id, list: saveLocalIntro({ ...made.list.find((l) => l.id === made!.id)!, savedId: saved.id }, { ...loadLocalIntro<Record<string, unknown>>(made.id), savedId: saved.id }) };
        if (saved) loadAccountFilms();
        else if (res.status === 402) setToast({ text: "Your plan's saved intros are full, so the copy is kept in this browser.", key: Date.now(), link: { label: "My intros", href: "/account" } });
      } catch {
        made = null;
      }
    } else {
      const l = localIntros.find((i) => i.id === id);
      made = l ? duplicateLocalIntro(l) : null;
    }
    if (!made) {
      setToast({ text: "Couldn't duplicate that intro.", key: Date.now() });
      return;
    }
    setLocalIntros(made.list);
    setToast({ text: `Duplicated as “${made.list.find((l) => l.id === made!.id)?.title ?? "a copy"}”.`, key: Date.now() });
  };
  /** Sidebar ⋯ menu: delete an intro (after the menu's confirm). Deleting the open one starts a new intro. */
  const deleteIntro = (x: SidebarIntro) => {
    const id = x.key.slice(2);
    const wasOpen = x.key === currentIntro;
    if (x.key.startsWith("a:")) {
      setAccountFilms((fs) => fs.filter((f) => f.id !== id));
      // This browser's copy of it goes too, so it doesn't reappear as a local intro.
      let list = localIntros;
      for (const l of localIntros) if (l.savedId === id) list = removeLocalIntro(l.id);
      setLocalIntros(list);
      fetch(`/api/account/films/${encodeURIComponent(id)}`, { method: "DELETE" })
        .then((r) => {
          if (!r.ok) throw new Error();
        })
        .catch(() => {
          setToast({ text: "Couldn't delete that intro from your account.", key: Date.now() });
          loadAccountFilms();
        });
    } else setLocalIntros(removeLocalIntro(id));
    if (wasOpen) {
      // Nothing left to autosave into the deleted intro.
      savedIdRef.current = null;
      localIdRef.current = null;
      newIntro();
    }
    setToast({ text: `Deleted “${x.title}”.`, key: Date.now() });
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
      const film = { v: 1, plan, prompt, inputs: madeFromRef.current ?? undefined, current, savedId: savedIdRef.current, localId: localIdRef.current, takes: takes.map(({ plan: tp, engine: te, engineLabel: tl, label }) => ({ plan: tp, engine: te, engineLabel: tl, label })) };
      // The sidebar's copy of this intro.
      if (localIdRef.current)
        setLocalIntros(
          saveLocalIntro(
            {
              id: localIdRef.current,
              // A name you gave it stays; otherwise it follows the video's name.
              ...(() => {
                const was = listLocalIntros().find((x) => x.id === localIdRef.current);
                return was?.named ? { title: was.title, named: true } : { title: introTitle(plan, prompt) };
              })(),
              updatedAt: Date.now(),
              color: plan.brand?.colors?.primary ?? "#7c5cff",
              aspect: plan.aspect,
              savedId: savedIdRef.current ?? undefined,
            },
            { ...film, takes: [], current: 0 },
          ),
        );
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
        .then((f: { id: string; plan: VideoPlan; inputs?: MadeFrom }) => {
          const p = sanitizePlan(f.plan);
          setPlan(p);
          setAspect(p.aspect);
          if (p.template) setTemplate(p.template);
          setTakes([]);
          setCurrent(0);
          setSavedId(f.id);
          const local = listLocalIntros().find((l) => l.savedId === f.id);
          const kept = local ? loadLocalIntro<{ inputs?: MadeFrom; prompt?: string }>(local.id) : null;
          if (local) {
            localIdRef.current = local.id;
            setLocalId(local.id);
          }
          restoreInputs(kept?.inputs ?? f.inputs, kept?.prompt ?? "");
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
          restoreInputs(saved.inputs, saved.prompt ?? "");
          if (typeof saved.savedId === "string") setSavedId(saved.savedId);
          const lid = typeof saved.localId === "string" ? saved.localId : newIntroId();
          localIdRef.current = lid;
          setLocalId(lid);
          const savedTakes = Array.isArray(saved.takes) ? (saved.takes as Take[]).map((t) => ({ ...t, plan: sanitizePlan(t.plan) })) : [];
          setTakes(savedTakes);
          setCurrent(Math.min(Math.max(0, saved.current ?? 0), Math.max(0, savedTakes.length - 1)));
          setEngine("manual");
          setNote("Restored your last video from this browser. Generate or Import starts a new one.");
        }
      } catch {
        /* nothing saved, or unreadable */
      }
      return;
    }
    if (!params.get("skill")) saving.current = true;
    cleanUrl();
    const shared = hash.startsWith("#plan=") ? decodePlan(hash.slice(6)) : null;
    // A shared plan or a slide preview wins over ?url=: no import after all.
    if (shared || params.get("skill")) {
      setImporting(false);
      setImportStage(null);
    }
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
    // A format carried by the link (?aspect=9:16&length=standard), e.g. from a shared or bookmarked link.
    const fa = params.get("aspect");
    const fl = params.get("length");
    const fmt = {
      aspect: fa === "9:16" || fa === "1:1" || fa === "16:9" ? (fa as Aspect) : undefined,
      length: isLength(fl) ? fl : undefined,
    };
    if (fmt.aspect) setAspect(fmt.aspect);
    if (fmt.length) setLength(fmt.length);
    // ?look=trailer: the product video cut as a trailer.
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

  /**
   * Keep your own edits claim-safe, without asking: when you leave a field, the slide's words get
   * the same pass as the director's (superlatives, guarantees, numbers and offers reworded or left
   * out), and a note says what changed. Returns the safe plan.
   */
  const keepClaimSafe = (only?: number) => {
    const cur = planRef.current;
    const safe = safePlan(cur, { keepScenes: true });
    const changed: string[] = [];
    const scenes = cur.scenes.map((sc, k) => {
      if (only !== undefined && k !== only) return sc;
      const next = safe.scenes[k];
      const fields = ["text", "subtext", "eyebrow", "items", "vo"] as const;
      if (fields.every((f) => JSON.stringify(sc[f]) === JSON.stringify(next[f]))) return sc;
      for (const f of fields) {
        const a = sc[f];
        const b = next[f];
        if (JSON.stringify(a) === JSON.stringify(b) || !a) continue;
        changed.push(`“${String(Array.isArray(a) ? a.join(", ") : a).replace(/\*/g, "")}”${b && (!Array.isArray(b) || b.length) ? ` → “${String(Array.isArray(b) ? b.join(", ") : b).replace(/\*/g, "")}”` : " (left out)"}`);
      }
      return { ...sc, text: next.text, subtext: next.subtext, eyebrow: next.eyebrow, items: next.items, vo: next.vo };
    });
    if (!changed.length) return cur;
    const out = { ...cur, scenes };
    record(`claims:${only ?? "all"}`);
    setPlan(out);
    planRef.current = out;
    setToast({ text: `Kept it claim-safe: ${changed.slice(0, 2).join("; ")}${changed.length > 2 ? ` and ${changed.length - 2} more` : ""}`, key: Date.now() });
    return out;
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
    const brandName = (skill === "liquid-logo" || skill === "logo-reveal" || LOGO_3D_IDS.has(skill) || LOGO_CLEAN_IDS.has(skill)) && plan.brand?.name;
    // Everything else is written from the film's own material, not the slide's sample: the
    // built-in director's version of this slide for the same website, listing or prompt.
    const source = promptRef.current.trim() || prompt.trim();
    const direct = (variant: number, angle?: Angle) => {
      const common = { aspect: plan.aspect, length, palette: "auto" as const, seed: (plan.seed + variant * 7919) >>> 0, style: styleRef.current, template: templateRef.current, safe: true, variant };
      if (site) return planFromSite(site, { ...common, angle, colors: plan.brand?.colors, direction: source });
      return source ? planFromPrompt({ prompt: source, ...common }) : null;
    };
    const content = brandName || skill === "qr-end" ? null : slideContent(skill, plan, direct);
    const scene: Scene = {
      skill,
      text: brandName || content?.text || k.sample.text,
      subtext: content ? content.subtext : k.sample.subtext,
      items: skill === "qr-end" ? undefined : content ? content.items : k.sample.items,
      eyebrow: plan.style === "saas" ? content?.eyebrow : undefined,
      media: content?.media,
      role: content?.role,
      vo: narrating ? content?.vo : undefined,
      duration: skill === "qr-end" ? 4.5 : Math.min(6, Math.max(2.5, content?.duration ?? 3.5)),
      transition: plan.scenes[at - 1]?.transition ?? "cut",
    };
    const next = sanitizePlan({ ...plan, scenes: [...plan.scenes.slice(0, at), scene, ...plan.scenes.slice(at)] });
    setPlan(next);
    setEngine("manual");
    selectScene(at, next);
  };

  keys.current = { selectScene: (i) => selectScene(i), removeScene, duplicateScene, selected, count: plan.scenes.length };

  /** One slide's editor: in the storyboard grid, and under the player when picked on the timeline. */
  // Pictures a slide can show: the site's images, screenshots and videos, uploaded photos, links
  // and uploads added in the slide editor, and what the film already uses.
  const [extraMedia, setExtraMedia] = useState<Media[]>([]);
  const mediaLibrary = useMemo(() => {
    const out: Media[] = [];
    const seen = new Set<string>();
    const add = (src: string | null | undefined, kind: Media["kind"] = "image") => {
      if (!src) return;
      const u = assetUrl(src);
      if (seen.has(u)) return;
      seen.add(u);
      out.push({ src: u, kind });
    };
    site?.images.forEach((x) => add(x));
    plan.brand?.images.forEach((x) => add(x));
    add(site?.shots?.hero);
    site?.shots?.sections.forEach((x) => add(x));
    add(site?.shots?.full);
    site?.videos.forEach((x) => add(x, "video"));
    plan.brand?.videos.forEach((x) => add(x, "video"));
    photos.forEach((x) => add(x));
    extraMedia.forEach((m) => add(m.src, m.kind));
    plan.scenes.forEach((x) => x.media && add(x.media.src, x.media.kind));
    return out.slice(0, 48);
  }, [site, plan.brand, plan.scenes, photos, extraMedia]);

  const sceneCard = (s: Scene, i: number, where: "grid" | "inspector") => {
    const skill = SKILL_MAP[s.skill];
    // Blur Reveal's list is only a fallback eyebrow; SaaS films have the chapter label for that.
    const showItems = skill.itemsHint !== undefined && !(plan.style === "saas" && s.skill === "blur-reveal") && s.skill !== "qr-end";
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
          <SkillPicker plan={plan} scene={s} value={s.skill} onPick={(id) => {
            if (id === s.skill) return;
            const r = restyleScene(s, id, plan);
            updateScene(i, { skill: id, text: r.text, subtext: r.subtext, items: r.items });
          }} />
        </div>
        {plan.style === "saas" && (
          <label className="fld">
            <span className="fld-cap">Chapter label</span>
            <input className="input eyebrow-input" value={s.eyebrow ?? ""} placeholder="Optional, e.g. How it works" onChange={(e) => updateScene(i, { eyebrow: e.target.value || undefined })} onBlur={() => keepClaimSafe(i)} />
          </label>
        )}
        <label className="fld">
          <span className="fld-cap">
            Headline <em>*word* = accent colour</em>
          </span>
          <input className={`input headline ${plan.style === "saas" ? "natural" : ""}`} value={s.text} maxLength={200} onChange={(e) => updateScene(i, { text: e.target.value })} onBlur={() => keepClaimSafe(i)} />
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
              onBlur={() => keepClaimSafe(i)}
            />
          </label>
        )}
        {s.skill === "qr-end" &&
          (() => {
            const typed = (s.items?.[0] ?? "").trim();
            const target = qrTarget({ scene: s, brand: plan.brand });
            return (
              <label className="fld">
                <span className="fld-cap">
                  QR code link <em>where the code takes viewers</em>
                </span>
                <input
                  className={`input${typed && !target ? " invalid" : ""}`}
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={s.items?.[0] ?? ""}
                  placeholder={plan.brand?.domain ? `Leave empty for ${plan.brand.domain}` : "https://yoursite.com/offer"}
                  onChange={(e) => updateScene(i, { items: e.target.value.trim() ? [e.target.value] : undefined })}
                  aria-label="QR code link"
                />
                <span className={`hint${target ? "" : " warn"}`}>
                  {target ? `Scans to ${target}` : typed ? "That doesn't look like a link (e.g. yoursite.com/offer)." : "Add a link: there's no website for the code to open."}
                </span>
              </label>
            );
          })()}
        {s.skill !== "qr-end" && (s.role === "cta" || i === plan.scenes.length - 1) && SKILL_MAP["qr-end"] && (
          <button type="button" className="link-btn qr-add" onClick={() => updateScene(i, { skill: "qr-end" })} title="Turn this end card into one with a scannable QR code">
            ▦ Show a QR code on this slide
          </button>
        )}
        <label className="fld">
          <span className="fld-cap">Subtext</span>
          <input className="input" value={s.subtext ?? ""} maxLength={60} placeholder="Optional" onChange={(e) => updateScene(i, { subtext: e.target.value || undefined })} onBlur={() => keepClaimSafe(i)} />
        </label>
        {(MEDIA_SKILLS.has(s.skill) || s.media) && (
          <SlideMedia
            value={s.media}
            library={mediaLibrary}
            onChange={(m) => updateScene(i, { media: m })}
            onAdd={(m) => setExtraMedia((cur) => [m, ...cur.filter((x) => x.src !== m.src)].slice(0, 24))}
            waiting={needsPicture(s, plan)}
          />
        )}
        {s.skill === "product-zoom" && <ZoomLensEditor scene={s} brand={plan.brand} onChange={(z) => updateScene(i, { zoom: z })} />}
        {s.skill === "ui-tour" && <TourAreaEditor scene={s} index={i} plan={plan} onChange={(tour) => updateScene(i, { tour })} />}
        {narrating && (
          <div className="vo-line">
            <label className="fld">
              <span className="fld-cap">Narration</span>
              <textarea className="input" rows={2} value={s.vo ?? ""} maxLength={240} placeholder="Leave empty for no voice here" onChange={(e) => updateScene(i, { vo: e.target.value || undefined })} onBlur={() => keepClaimSafe(i)} />
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
          <TransitionPicker
            plan={plan}
            value={s.transition}
            onPick={(tr) => {
              // A slide of its own: the video-wide transition steps aside (the other slides keep theirs).
              if (transFx) rememberTransFx(null);
              updateScene(i, { transition: tr });
            }}
          />
          <div className="scene-actions">
            <button className="icon-btn sm" onClick={() => moveScene(i, i - 1)} disabled={i === 0} aria-label="Move earlier" title="Move earlier">←</button>
            <button className="icon-btn sm" onClick={() => moveScene(i, i + 1)} disabled={i === plan.scenes.length - 1} aria-label="Move later" title="Move later">→</button>
            <button className="icon-btn sm" onClick={() => duplicateScene(i)} aria-label="Duplicate slide" title="Duplicate (D)">⧉</button>
            <button className="icon-btn sm" onClick={() => removeScene(i)} disabled={plan.scenes.length <= 1} aria-label="Remove slide" title="Remove from the video (Delete)">✕</button>
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
      .then((a) => {
        setAccount({ user: a.user, limits: a.limits });
        if (a.user) loadAccountFilms();
      })
      .catch(() => setAccount(null));
  }, [loadAccountFilms]);
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
        body: JSON.stringify({ id: savedIdRef.current ?? undefined, plan: p, thumb, inputs: accountInputs(madeFromRef.current) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSavingState("");
        setToast({ text: data.error ?? "Couldn't save.", key: Date.now(), link: res.status === 402 ? { label: "My intros", href: "/account" } : undefined });
        return;
      }
      setSavedId(data.id);
      loadAccountFilms();
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
        <h1 className="studio-title">{plan.title}</h1>
        <span className={`engine-badge ${engine}`}>
          {engine === "ai" ? `✦ ${engineLabel || "AI director"}` : engine === "builtin" ? "Built-in director" : engine === "sample" ? "Sample video" : "Manual edit"}
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
        <IntroSidebar
          intros={sidebarIntros}
          current={currentIntro}
          onOpen={openIntro}
          onNew={newIntro}
          onRename={renameIntro}
          onDuplicate={duplicateIntro}
          onDelete={deleteIntro}
          allHref="/account"
          note={account?.user ? undefined : "Kept in this browser. Sign in to save them to your account."}
        />
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
              onChange={(e) => {
                setSiteUrl(e.target.value);
                if (urlHint) setUrlHint(null);
              }}
              placeholder="Website or listing link"
              title="Your website (yourproduct.com), or an Amazon, eBay, AliExpress, Etsy or Shopify product listing"
              aria-label="Website or listing URL"
              aria-invalid={!!urlHint}
              aria-describedby={urlHint ? "url-hint" : undefined}
              inputMode="url"
            />
            {importing ? (
              <button className="btn stop-btn" type="button" onClick={stopDirecting} title="Stop the import. The video on screen stays as it is.">
                ■ Stop
              </button>
            ) : (
              <button className="btn btn-ghost" type="submit" disabled={loading}>
                Import
              </button>
            )}
          </form>
          {urlHint && (
            <p id="url-hint" className="hint url-hint" role="alert">
              {urlHint}
            </p>
          )}
          {(() => {
            const m = siteUrl.trim().includes(".") ? marketOf(siteUrl) : null;
            return m && !importing ? <p className="hint">{m.id === "shop" ? "A shop's product page" : `${m.name} listing`}: imports as a product video, from the product&apos;s own title, bullet points and photos.</p> : null;
          })()}
          {importStage && (
            <p className="hint import-stage">
              <span className="spinner sm" /> {importStage}
            </p>
          )}
          {importError && (
            <div className="import-error">
              <p>Import didn&apos;t work: the details and next steps are on the preview.</p>
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
                    {/* (A photo past the 48-hour clean-up no longer loads: it drops off the list.) */}
                    <img src={src} alt="" onError={() => setPhotos((cur) => cur.filter((x) => x !== src))} />
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
                  photos above, and type the product&apos;s name and features in the prompt (e.g. &ldquo;Aero Buds: wireless earbuds with noise cancelling, long battery life and a pocket case&rdquo;), then Generate.
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

          <label className="field-label" htmlFor="studio-prompt">
            {site ? "Extra direction (optional)" : "Or describe it"}
          </label>
          <textarea
            id="studio-prompt"
            maxLength={PROMPT_MAX}
            aria-describedby="prompt-meter"
            aria-label={site ? "Extra direction for the video" : "Describe your video"}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={site ? "e.g. focus on the dashboard, end with 'Book a demo'" : "Describe your video: product, what it does, the vibe…"}
            rows={site ? 2 : 3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
            }}
          />
          <PromptMeter text={prompt} optional={!!site} />
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

          {/* The format (9:16, 16:9, 1:1) is picked in the player's toolbar, under the video. */}
          <div className="field-stack">
            <div>
          <label className="field-label">Length</label>
          <div className="seg-control">
            {LENGTHS.map((l) => (
              <button key={l.id} className={length === l.id ? "active" : ""} onClick={() => setLength(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
            </div>
            <div>
              <label className="field-label" htmlFor="story-pick">
                Story
              </label>
              <select
                id="story-pick"
                className="select"
                value={story}
                onChange={(e) => void applyStory(e.target.value as "auto" | Angle)}
                title="How the video tells it. Problem → solution opens on the problems (the site's own, or ones written from its services or features), then shows how each is solved."
              >
                <option value="auto">Auto (director&apos;s pick)</option>
                {ANGLES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <details className="hint claim-note">
            <summary>✓ Claim-safe wording, automatically</summary>
            Superlatives, guarantees, numbers, offers (&ldquo;free&rdquo;, trials, discounts) and health claims are reworded or left out, in what the
            director writes and in your own edits. (Automated screening, not legal advice.)
          </details>

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
                title="New trailers take the style that matches your product"
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
                title="New videos take the style suggested for their kind of product. A style you pick applies to this video and its remakes; the next website or prompt gets its own best style."
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

          <details className="fold">
            <summary>
              <span className="field-label inline">Heading font</span> <span className="tpl-desc">{fontChoice ? FONT_LABELS[fontChoice].name : "Style default"}</span>
            </summary>
            <FontPicker value={fontChoice} onChange={chooseFont} kind={fontKind} current={fontChoice ? (plan.style === "trailer" ? TRAILER_STYLE_MAP[plan.trailerStyle ?? ""]?.mood.font ?? plan.font : TEMPLATE_MAP[plan.template ?? template]?.font ?? plan.font) : plan.font} />
            <p className="hint">{fontKind === "trailer" ? "Movie-title faces, paired with their own subtitle faces." : "Applies to the headlines; subtitles stay in a clean sans."}</p>
          </details>
          <details className="fold">
            <summary>
              <span className="field-label inline">Transitions</span> <span className="tpl-desc">{transFx ? TRANSITION_NAMES[transFx] : "Style default"}</span>
            </summary>
            <TransitionStylePicker plan={plan} value={transFx} onChange={chooseTransFx} />
            <p className="hint">{transFx ? `${TRANSITION_NAMES[transFx]} between every slide. Change one slide's under that slide.` : "The director's mix of transitions. Pick one to use it between every slide."}</p>
          </details>
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
          <label className="field-label">
            Motion blur <span className="tpl-desc">{motionBlur ? "On" : "Off"}</span>
          </label>
          <div className="seg-control">
            <button className={motionBlur ? "active" : ""} onClick={() => chooseMotionBlur(true)}>
              Film blur
            </button>
            <button className={!motionBlur ? "active" : ""} onClick={() => chooseMotionBlur(false)}>
              Off
            </button>
          </div>
          <p className="hint">{motionBlur ? "In the exported video, fast moves streak like a film camera's and still parts stay sharp. The preview stays sharp." : "Every exported frame pin-sharp, even mid-move."}</p>
          <label className="field-label">
            Contrast slides <span className="tpl-desc">{contrastOn ? "On" : "Off"}</span>
          </label>
          <div className="seg-control">
            <button className={contrastOn ? "active" : ""} onClick={() => chooseContrast(true)}>
              Colour breaks
            </button>
            <button className={!contrastOn ? "active" : ""} onClick={() => chooseContrast(false)}>
              Off
            </button>
          </div>
          <p className="hint">{contrastOn ? "Now and then a words-only slide flips to a bold block of your colour, to change the pace." : "Slides keep the style's own background."}</p>
          <details className="fold">
            <summary>
              <span className="field-label inline">Mouse pointer</span> <span className="tpl-desc">{POINTER_NAMES[pointer]}</span>
            </summary>
            <PointerPicker plan={plan} value={pointer} onChange={choosePointer} />
            <p className="hint">{pointer === "auto" ? "A 3D pointer that suits the colours: white on dark styles, graphite on light ones." : `The ${POINTER_NAMES[pointer].toLowerCase()} pointer in product demos, tours and buttons.`}</p>
          </details>
          {(style !== "trailer" || plan.product) && (
            <>
              <details className="fold">
                <summary>
                  <span className="field-label inline">Background shapes</span> <span className="tpl-desc">{shapes === "off" ? "Off" : SHAPE_SET_INFO[shapes].name}</span>
                </summary>
                <ShapesPicker value={shapes} onChange={chooseShapes} watermark={watermark} onWatermark={chooseWatermark} plan={{ palette: plan.palette, font: plan.font, seed: plan.seed, bpm: plan.bpm, brand: plan.brand, look: plan.style === "saas" ? plan.look : TEMPLATE_MAP[template].look }} />
                <p className="hint">{shapes === "off" ? "A clean stage with no floating shapes." : shapes === "text" ? "Your line in big, faint rows drifting behind every slide." : "They drift around the edges and pulse with the beat."}</p>
              </details>
            </>
          )}
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
              : "The palette's colours at full strength."}
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
            {loading || importing ? (
              <button className="btn btn-lg grow stop-btn" onClick={stopDirecting} title="Stop the director. The video on screen stays as it is.">
                <span className="spinner sm" /> {importing && !loading ? "Importing…" : "Directing…"} <span className="stop-label">■ Stop</span>
              </button>
            ) : (
              <button className="btn btn-primary btn-lg grow" onClick={() => generate()} disabled={remaking || takesLoading}>
                Generate ✦
              </button>
            )}
            {remaking ? (
              <button className="btn btn-lg stop-btn" onClick={stopDirecting} title="Stop the remake. The video on screen stays as it is.">
                <span className="spinner sm" /> Remaking… <span className="stop-label">■ Stop</span>
              </button>
            ) : (
              <div className="remake-wrap">
                <button
                  className="btn btn-ghost btn-lg"
                  onClick={() => setRemakeMenu((o) => !o)}
                  disabled={loading || importing || takesLoading}
                  aria-haspopup="menu"
                  aria-expanded={remakeMenu}
                  title="A new version: new designs for the same story, or a new story. Undo or Original brings back earlier versions."
                >
                  Remake ↻
                </button>
                {remakeMenu && (
                  <>
                    <div className="remake-scrim" onClick={() => setRemakeMenu(false)} aria-hidden />
                    <div className="remake-menu" role="menu" onKeyDown={(e) => e.key === "Escape" && setRemakeMenu(false)}>
                      <button role="menuitem" autoFocus onClick={remakeDesign}>
                        <strong>Remake design</strong>
                        <span>Same story and words, new slide designs</span>
                      </button>
                      <button role="menuitem" onClick={() => void remake()}>
                        <strong>Remake story</strong>
                        <span>{plan.style === "trailer" ? "Other slides for the same beats" : "A new way to tell it, where the material allows"}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Phones: the export is in the thumb bar too (the player's own button is further up). */}
            <button className="btn btn-ghost btn-lg phone-only" onClick={() => window.dispatchEvent(new Event("studio:export"))} disabled={loading || importing}>
              Export
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
          {note && (
            <div className="director-note wide-only" role="status">
              <p>{note}</p>
              <button type="button" className="director-note-close" onClick={() => setNote(null)} aria-label="Dismiss this note">
                ×
              </button>
            </div>
          )}


          </div>
        </aside>

        <section className="main">
          {note && (
            <div className="director-note phone-note" role="status">
              <p>{note}</p>
              <button type="button" className="director-note-close" onClick={() => setNote(null)} aria-label="Dismiss this note">
                ×
              </button>
            </div>
          )}
          <div className={`stage-wrap${loading || importing ? " building" : ""}`}>
            {(importing || (loading && !takesLoading)) && <BuildProgress importing={importing} stage={importStage} site={importing ? siteUrl : undefined} onStop={stopDirecting} />}
            {!importing && !loading && importError && (
              <ImportFailure
                failure={importError}
                check={siteCheck}
                onRetry={() => void importSite(importError.url)}
                onSuggestion={() => {
                  setSiteUrl(importError.suggestion!);
                  void importSite(importError.suggestion);
                }}
                onPhotos={() => photoInput.current?.click()}
                onDescribe={() => describeInstead(importError.url)}
                onClose={() => setImportError(null)}
              />
            )}
            <Player
              plan={playPlan}
              resetKey={version}
              seek={seek}
              onScene={setActiveScene}
              onEditScene={updateScene}
              limits={account?.limits}
              onAspect={(a) => {
                setAspect(a);
                setGlobal({ aspect: a });
              }}
              onSpeed={(k) => setGlobal({ speed: k === 1 ? undefined : k })}
              beforeExport={async () => {
                // Slides still showing a placeholder instead of your picture.
                const waiting = plan.scenes.map((x, k) => (needsPicture(x, plan) ? k + 1 : 0)).filter(Boolean);
                if (
                  waiting.length &&
                  !window.confirm(
                    `Slide${waiting.length > 1 ? "s" : ""} ${waiting.join(", ")} still show${waiting.length > 1 ? "" : "s"} a placeholder instead of your image. Add images in the slide editor (Image → Add image), or export with the placeholder${waiting.length > 1 ? "s" : ""}?`,
                  )
                )
                  return false;
                // Every exported intro is claim-safe: anything still unsafe is reworded first (no questions).
                if (keepClaimSafe() !== plan) await new Promise((r) => setTimeout(r, 60));
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
                {plan.scenes.length} slides · {outputDuration(plan).toFixed(1)}s{playSpeed(plan) !== 1 ? ` at ${playSpeed(plan)}×` : ""}
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
            onRestyle={(i, id) => {
              const s = plan.scenes[i];
              if (!s || id === s.skill) return;
              // The same as picking the design from the slide's menu: its words carried over.
              const r = restyleScene(s, id, plan);
              updateScene(i, { skill: id, text: r.text, subtext: r.subtext, items: r.items });
            }}
          />
          {selected !== null && plan.scenes[selected] && <div className="inspector">{sceneCard(plan.scenes[selected], selected, "inspector")}</div>}

          <div className="takes">
            <div className="takes-head">
              <h2>Versions</h2>
              <span className="hint">Your original, remakes and alternative cuts. Click one to go back to it.</span>
            </div>
            <div className="takes-row">
              {takes.map((t, i) => (
                <button key={i} className={`take-card ${i === current ? "active" : ""}`} onClick={() => show(t, i)} title="Use this version">
                  <LoopCanvas plan={t.plan} long={300} fps={15} />
                  <span className="take-name">{t.label}</span>
                </button>
              ))}
              <button
                className="take-card more"
                onClick={takesLoading ? stopDirecting : moreTakes}
                disabled={!takesLoading && (loading || remaking || importing)}
                title={takesLoading ? "Stop: the takes you have stay as they are." : undefined}
              >
                <span>{takesLoading ? "Directing 3 takes… ■ Stop" : "✦ 3 more takes"}</span>
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

/** The longest description the director reads (the server keeps the first 1,000 characters). */
const PROMPT_MAX = 1000;
/** Enough for a good video: the name, what it does and two or three features. */
const PROMPT_GOOD = 60;

/**
 * Under the description: how far it is from a good length (the name, what it does, two or three
 * features), what the director found in it, and the characters left.
 */
function PromptMeter({ text, optional }: { text: string; optional: boolean }) {
  const n = text.trim().length;
  const left = PROMPT_MAX - text.length;
  const parsed = useMemo(() => (n >= 12 ? parseSaasPrompt(text) : null), [text, n]);
  const features = parsed?.features.length ?? 0;
  let hint: string;
  let state: "low" | "ok" | "good" = "good";
  if (optional) {
    hint = n ? "Extra direction for the director: what to focus on, how to end." : "Optional: what to focus on, or how to end (\u201cend with Book a demo\u201d).";
  } else if (n < PROMPT_GOOD) {
    state = "low";
    hint = n ? `${PROMPT_GOOD - n} more characters for a stronger video: the name, what it does and 2\u20133 features.` : `Aim for ${PROMPT_GOOD}+ characters: the name, what it does and 2\u20133 features.`;
  } else if (features < 2) {
    state = "ok";
    hint = "Good length. Tip: list 2\u20133 features (\u201cwith X, Y and Z\u201d) for feature slides of your own.";
  } else {
    hint = `\u2713 Good: ${parsed?.brand ? `${parsed.brand}, ` : ""}${features} features found.`;
  }
  return (
    <div className={`prompt-meter ${state}`} id="prompt-meter" aria-live="polite">
      {!optional && (
        <span className="prompt-progress" aria-hidden>
          <span style={{ width: `${Math.min(100, (n / PROMPT_GOOD) * 100)}%` }} />
        </span>
      )}
      <span className="prompt-hint">{hint}</span>
      <span className={`prompt-left${left <= 100 ? " few" : ""}`} title={`${text.length} of ${PROMPT_MAX} characters`}>
        {left <= 100 ? `${left} left` : `${text.length}/${PROMPT_MAX}`}
      </span>
    </div>
  );
}
