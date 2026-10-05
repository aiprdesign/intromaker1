"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ensureFonts } from "@/engine/fonts";
import { mediaState } from "@/engine/media";
import { renderFrame } from "@/engine/renderer";
import { SKILL_MAP } from "@/engine/skills";
import { TRANSITIONS, type Scene, type Transition, type VideoPlan } from "@/engine/types";

export const TRANSITION_NAMES: Record<Transition, string> = {
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
  morph: "Morph",
  portal: "Portal",
  iris: "Iris",
  spin: "Spin",
  split: "Split",
  swipe: "Card swipe",
};

const TRANSITION_HINTS: Record<Transition, string> = {
  cut: "Straight to the next slide, on the beat.",
  flash: "A quick fade through light.",
  zoom: "Punches in through the frame.",
  glitch: "A short digital glitch.",
  wipe: "A bar wipes across to reveal it.",
  whip: "A fast blurred pan sideways.",
  dolly: "The camera glides into the next slide.",
  leak: "A warm light leak washes over.",
  shutter: "Blinds close and open on it.",
  push: "The next slide pushes this one out.",
  dissolve: "A soft cross-fade.",
  liquid: "A liquid wave pours it in.",
  cube: "The slides turn like faces of a cube.",
  morph: "One slide melts into the next.",
  portal: "It opens through a growing portal.",
  iris: "A circle opens on the next slide.",
  spin: "Spins out into the next slide.",
  split: "The slide splits open down the middle.",
  swipe: "Swiped away like a card.",
};

/** Seconds of the outgoing slide in a preview (the transition lands here). */
const A_LEN = 1.5;

/** A two-slide plan in the video's own look, the second slide arriving with `tr`. */
function previewPlan(plan: VideoPlan, tr: Transition): VideoPlan {
  const trailer = plan.style === "trailer";
  const a: Scene = trailer
    ? { skill: "cinematic-title", text: "THIS SLIDE", duration: A_LEN, transition: "cut" }
    : { skill: "blur-reveal", text: "This *slide*", duration: A_LEN, transition: "cut" };
  const bSkill = trailer ? "god-rays" : "icon-features";
  const b: Scene = {
    skill: bSkill,
    text: trailer ? "THE NEXT" : "The *next* one",
    items: SKILL_MAP[bSkill].sample.items,
    duration: 2,
    transition: tr,
  };
  return { ...plan, aspect: "16:9", scenes: [a, b], voiceover: undefined };
}

/**
 * The loop: the outgoing slide settled, the whole transition, the next slide settled; a short hold at
 * each end, then a dissolve back to the start, so the loop never jumps mid-move.
 */
const WIN_START = A_LEN - 0.55;
const WIN = 2;
const FPS = 24;
const FRAMES = Math.round(WIN * FPS) + 1;
const HOLD_IN = 0.3;
const HOLD_OUT = 0.5;
const FADE = 0.35;
const CYCLE = HOLD_IN + WIN + HOLD_OUT + FADE;
/** Where the loop is `e` seconds in: the video time to show, and how far the dissolve back has got. */
function phase(e: number) {
  const x = e % CYCLE;
  if (x < HOLD_IN) return { t: WIN_START, back: 0 };
  if (x < HOLD_IN + WIN) return { t: WIN_START + (x - HOLD_IN), back: 0 };
  if (x < HOLD_IN + WIN + HOLD_OUT) return { t: WIN_START + WIN, back: 0 };
  return { t: WIN_START + WIN, back: ease((x - HOLD_IN - WIN - HOLD_OUT) / FADE) };
}
const ease = (k: number) => k * k * (3 - 2 * k);
/** Strip frame size (small tiles; the tile under the pointer renders live at full size). */
const SW = 144;
const SH = 81;

/**
 * Looping strips (like GIFs): each transition's frames at 24 fps rendered once into one sprite
 * canvas, a few frames at a time between other work, so opening a picker stays instant. Kept for
 * the current look only.
 */
const strips = new Map<string, Promise<HTMLCanvasElement>>();
let stripLook = "";
let queue: Promise<void> = Promise.resolve();
/** Wait for the browser to be idle (so building strips never stutters the player), at most ~200 ms. */
const idle = () =>
  new Promise<void>((res) => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => res(), { timeout: 200 });
    else setTimeout(res, 16);
  });

function stripFor(lookKey: string, mini: VideoPlan, tr: Transition): Promise<HTMLCanvasElement> {
  if (lookKey !== stripLook) {
    strips.clear();
    stripLook = lookKey;
  }
  let p = strips.get(tr);
  if (!p) {
    p = new Promise<HTMLCanvasElement>((resolve) => {
      queue = queue.then(async () => {
        await ensureFonts();
        const sprite = document.createElement("canvas");
        sprite.width = SW * FRAMES;
        sprite.height = SH;
        const out = sprite.getContext("2d")!;
        const c = document.createElement("canvas");
        c.width = SW;
        c.height = SH;
        const ctx = c.getContext("2d")!;
        await idle();
        let until = performance.now() + 8;
        for (let i = 0; i < FRAMES; i++) {
          while (mediaState.exporting) await new Promise((r) => setTimeout(r, 500));
          renderFrame(ctx, mini, WIN_START + i / FPS, SW, SH, { grain: false });
          out.drawImage(c, i * SW, 0);
          if (performance.now() > until) {
            await idle();
            until = performance.now() + 8;
          }
        }
        resolve(sprite);
      });
    });
    strips.set(tr, p);
  }
  return p;
}

/** One transition looping in its tile (from its strip), or rendered live at full size while `play`. */
export function TransitionPreview({ plan, lookKey, tr, play, w, h }: { plan: VideoPlan; lookKey: string; tr: Transition; play: boolean; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mini = useMemo(() => previewPlan(plan, tr), [plan, tr]);
  const [sprite, setSprite] = useState<HTMLCanvasElement | null>(null);
  const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // A first frame right away (the outgoing slide), then the strip once it's rendered.
  useEffect(() => {
    let alive = true;
    setSprite(null);
    void ensureFonts().then(() => {
      const c = ref.current;
      if (alive && c) renderFrame(c.getContext("2d")!, mini, still ? A_LEN + 0.6 : WIN_START, c.width, c.height, { grain: false });
    });
    if (!still) void stripFor(lookKey, mini, tr).then((s) => alive && setSprite(s));
    return () => {
      alive = false;
    };
  }, [lookKey, mini, tr, still]);
  // The strip on its loop.
  useEffect(() => {
    const c = ref.current;
    if (!c || !sprite || play || still) return;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    let raf = 0;
    let shown = "";
    const t0 = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const { t, back } = phase((now - t0) / 1000);
      const i = Math.min(FRAMES - 1, Math.round((t - WIN_START) * FPS));
      const key = `${i}|${back.toFixed(2)}`;
      if (key === shown) return;
      shown = key;
      ctx.globalAlpha = 1;
      ctx.drawImage(sprite, i * SW, 0, SW, SH, 0, 0, c.width, c.height);
      if (back > 0) {
        ctx.globalAlpha = back;
        ctx.drawImage(sprite, 0, 0, SW, SH, 0, 0, c.width, c.height);
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sprite, play, still]);
  // Live, at full size: the same loop, rendered as it plays.
  useEffect(() => {
    if (!play || still) return;
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    // The loop's first frame, kept to dissolve back to.
    const first = document.createElement("canvas");
    first.width = c.width;
    first.height = c.height;
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    let alive = true;
    void ensureFonts().then(() => {
      if (!alive) return;
      renderFrame(first.getContext("2d")!, mini, WIN_START, first.width, first.height, { grain: false });
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (mediaState.exporting || now - last < 1000 / 30 - 2) return;
        last = now;
        const { t, back } = phase((now - t0) / 1000);
        renderFrame(ctx, mini, t, c.width, c.height, { grain: false });
        if (back > 0) {
          ctx.save();
          ctx.globalAlpha = back;
          ctx.drawImage(first, 0, 0);
          ctx.restore();
        }
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [play, mini, still]);
  return <canvas ref={ref} width={w} height={h} />;
}

/** The video's look for previews (they only depend on the look, not on the storyboard's words). */
function useLook(plan: VideoPlan) {
  const lookKey = JSON.stringify([plan.palette, plan.font, plan.style, plan.template, plan.trailerStyle, plan.look, plan.brand?.name, plan.brand?.logo, plan.brand?.colors, plan.seed, plan.glow, plan.shapes, plan.scheme, plan.bpm]);
  const look = useMemo(
    () => ({ ...plan, scenes: [] }) as VideoPlan,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookKey],
  );
  return { look, lookKey };
}

/**
 * The video's transition, for the Style panel (like Heading font and Text effect): "Style default"
 * keeps the director's mix; any other choice applies to every slide. Each tile loops its transition
 * in the current look, and the one under the pointer plays live.
 */
export function TransitionStylePicker({ plan, value, onChange }: { plan: VideoPlan; value: Transition | null; onChange: (t: Transition | null) => void }) {
  const { look, lookKey } = useLook(plan);
  const [hover, setHover] = useState<Transition | null>(null);
  return (
    <div className="fx-grid" role="listbox" aria-label="Transitions">
      <button role="option" aria-selected={value === null} className={`fx-card default ${value === null ? "active" : ""}`} onClick={() => onChange(null)}>
        <span className="fx-name">Style default</span>
        <span className="fx-note">The director&apos;s mix</span>
      </button>
      {TRANSITIONS.map((tr) => (
        <button
          key={tr}
          role="option"
          aria-selected={value === tr}
          className={`fx-card ${value === tr ? "active" : ""}`}
          onClick={() => onChange(tr)}
          onMouseEnter={() => setHover(tr)}
          onMouseLeave={() => setHover((h) => (h === tr ? null : h))}
          onFocus={() => setHover(tr)}
          title={TRANSITION_HINTS[tr]}
        >
          <TransitionPreview plan={look} lookKey={lookKey} tr={tr} play={hover === tr} w={240} h={135} />
          <span className="fx-name">{TRANSITION_NAMES[tr]}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Transition picker: the field shows the current transition; the menu shows every transition as a
 * preview in the video's own look, the one under the pointer (or keyboard) playing on a loop.
 */
export default function TransitionPicker({ plan, value, onPick }: { plan: VideoPlan; value: Transition; onPick: (t: Transition) => void }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const { look, lookKey } = useLook(plan);

  useLayoutEffect(() => {
    if (!open || !btn.current) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const width = Math.min(620, window.innerWidth - 24);
      const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
      const below = window.innerHeight - r.bottom - 16;
      const above = r.top - 16;
      const maxH = Math.min(520, Math.max(below, above));
      const top = below >= Math.min(360, above) ? r.bottom + 6 : r.top - 6 - maxH;
      setPos({ left, top, maxH });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setCursor(Math.max(0, TRANSITIONS.indexOf(value)));
    const away = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      btn.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, value]);

  const placed = pos !== null;
  useEffect(() => {
    if (open && placed) (menu.current?.querySelector(`[data-i="${cursor}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
    // Focus only when the menu first appears; arrow keys move the cursor after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placed]);
  useEffect(() => {
    menu.current?.querySelector(`[data-i="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const choose = (t: Transition) => {
    onPick(t);
    setOpen(false);
    btn.current?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const cols = window.innerWidth < 560 ? 2 : 3;
    const n = TRANSITIONS.length;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(TRANSITIONS[cursor]);
    } else if (e.key === "ArrowRight") setCursor((c) => Math.min(n - 1, c + 1));
    else if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, c - 1));
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(n - 1, c + cols));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - cols));
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`skill-field transition-field${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Transition in: ${TRANSITION_NAMES[value]}`}
        title={`Transition into this slide: ${TRANSITION_HINTS[value]}`}
      >
        <span className="skill-field-name">{TRANSITION_NAMES[value] ?? value}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      {open && pos && (
        <div ref={menu} className="skill-menu" role="dialog" aria-label="Transitions" style={{ left: pos.left, top: pos.top, maxHeight: pos.maxH }} onKeyDown={onKey}>
          <div className="skill-menu-head transition-menu-head">Transition into this slide</div>
          <div className="skill-menu-body">
            <div className="skill-grid">
              {TRANSITIONS.map((tr, i) => (
                <button
                  key={tr}
                  type="button"
                  data-i={i}
                  className={`skill-tile${tr === value ? " current" : ""}${i === cursor ? " cursor" : ""}`}
                  onClick={() => choose(tr)}
                  onMouseEnter={() => setCursor(i)}
                  onFocus={() => setCursor(i)}
                  title={TRANSITION_HINTS[tr]}
                >
                  <span className="skill-thumb">
                    <TransitionPreview plan={look} lookKey={lookKey} tr={tr} play={i === cursor} w={320} h={180} />
                  </span>
                  <span className="skill-tile-text">
                    <strong>{TRANSITION_NAMES[tr]}</strong>
                    <small>{TRANSITION_HINTS[tr]}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
