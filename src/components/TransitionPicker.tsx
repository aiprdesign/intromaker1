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

/** Frames in a tile's looping strip, and the time between them. */
const FRAMES = 14;
const STEP = 0.085;
const SW = 192;
const SH = 108;

/**
 * Looping strips (like GIFs): each transition's frames rendered once into one sprite canvas, a few
 * frames at a time between other work, so opening the menu stays instant. Kept for the current look.
 */
const strips = new Map<string, Promise<HTMLCanvasElement>>();
let stripLook = "";
let queue: Promise<void> = Promise.resolve();
const idle = () => new Promise<void>((res) => setTimeout(res, 0));

function stripFor(lookKey: string, mini: VideoPlan, tr: Transition): Promise<HTMLCanvasElement> {
  if (lookKey !== stripLook) {
    strips.clear();
    stripLook = lookKey;
  }
  const key = tr;
  let p = strips.get(key);
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
        let until = performance.now() + 12;
        for (let i = 0; i < FRAMES; i++) {
          while (mediaState.exporting) await new Promise((r) => setTimeout(r, 500));
          renderFrame(ctx, mini, A_LEN - 0.35 + i * STEP, SW, SH, { grain: false });
          out.drawImage(c, i * SW, 0);
          if (performance.now() > until) {
            await idle();
            until = performance.now() + 12;
          }
        }
        resolve(sprite);
      });
    });
    strips.set(key, p);
  }
  return p;
}

/** One transition looping in its tile (from its strip), or playing live and smooth while `play`. */
function TransitionPreview({ plan, lookKey, tr, play, w, h }: { plan: VideoPlan; lookKey: string; tr: Transition; play: boolean; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mini = useMemo(() => previewPlan(plan, tr), [plan, tr]);
  const [sprite, setSprite] = useState<HTMLCanvasElement | null>(null);
  const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    let alive = true;
    setSprite(null);
    void stripFor(lookKey, mini, tr).then((s) => alive && setSprite(s));
    return () => {
      alive = false;
    };
  }, [lookKey, mini, tr]);
  // The strip on a loop (or, with reduced motion, its middle frame held).
  useEffect(() => {
    const c = ref.current;
    if (!c || !sprite || play) return;
    const ctx = c.getContext("2d")!;
    const show = (i: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(sprite, i * SW, 0, SW, SH, 0, 0, c.width, c.height);
    };
    if (still) {
      show(Math.floor(FRAMES * 0.6));
      return;
    }
    let raf = 0;
    let shown = -1;
    const t0 = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // Hold the last frame a moment before looping, so the landing reads.
      const i = Math.min(FRAMES - 1, Math.floor(((now - t0) / 1000 / STEP) % (FRAMES + 6)));
      if (i !== shown) {
        shown = i;
        show(i);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sprite, play, still]);
  // Live: loop from just before the transition to the next slide settling, at full frame rate.
  useEffect(() => {
    if (!play || still) return;
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const loop = 1.8;
    let alive = true;
    void ensureFonts().then(() => {
      if (!alive) return;
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (mediaState.exporting || now - last < 1000 / 30 - 2) return;
        last = now;
        renderFrame(ctx, mini, A_LEN - 0.55 + (((now - t0) / 1000) % loop), c.width, c.height, { grain: false });
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
  // Previews only depend on the look, not on the storyboard's words.
  const lookKey = JSON.stringify([plan.palette, plan.font, plan.style, plan.template, plan.trailerStyle, plan.look, plan.brand?.name, plan.brand?.logo, plan.brand?.colors, plan.seed, plan.glow, plan.shapes, plan.scheme, plan.bpm]);
  const look = useMemo(
    () => ({ ...plan, scenes: [] }) as VideoPlan,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan.palette, plan.font, plan.style, plan.template, plan.trailerStyle, plan.look, plan.brand, plan.seed, plan.glow, plan.shapes, plan.scheme, plan.bpm],
  );

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
