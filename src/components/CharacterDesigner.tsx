"use client";

import { useEffect, useRef, useState } from "react";
import { ART_STYLES, BODIES, CAST_MAX, EYES, HAIR_STYLES, HAIRS, HEADS, MODERN, NEUTRALS, PATTERNS, PLAYFUL_SKINS, RANGES, sanitizeCast, SKINS } from "@/engine/cast";
import { PALETTES } from "@/engine/palettes";
import { drawAbstract, idle, makeCharacter, waveArm, type AbsPose } from "@/engine/skills/abstract";
import { blinkAt } from "@/engine/skills/characters";
import type { CastMember, Palette } from "@/engine/types";

/** Where the designed characters are kept in the browser (shared by the studio and /characters). */
export const CAST_KEY = "intromaker.cast";

export function loadCast(): CastMember[] {
  try {
    return sanitizeCast(JSON.parse(localStorage.getItem(CAST_KEY) ?? "null")) ?? [];
  } catch {
    return [];
  }
}

export function saveCast(cast: CastMember[]) {
  try {
    localStorage.setItem(CAST_KEY, JSON.stringify(cast));
  } catch {
    /* storage full or blocked: the cast still works for this visit */
  }
}

/** A brand-new random character, dressed partly in `palette`'s colours. */
export function newCharacter(palette: Palette = PALETTES.swiss): CastMember {
  return makeCharacter(Math.floor(Math.random() * 2 ** 31), palette);
}

const LABELS: Record<string, string> = {
  flat: "Flat",
  soft: "Soft 3D",
  outline: "Outline",
  line: "Line art",
  paper: "Paper cut",
  pill: "Pill",
  arch: "Arch",
  bell: "Bell",
  triangle: "Triangle",
  round: "Round",
  block: "Block",
  none: "None",
  stripes: "Stripes",
  dots: "Dots",
  half: "Two-tone",
  circle: "Circle",
  oval: "Oval",
  squircle: "Rounded square",
  cap: "Short",
  bun: "Bun",
  spikes: "Spiky",
  wave: "Wavy",
  bob: "Bob",
  afro: "Curly",
  beanie: "Beanie",
  lines: "Lines",
  ovals: "Ovals",
};
const label = (k: string) => LABELS[k] ?? k;

const STILL: AbsPose = { armL: 0.3, armR: 0.3, mouth: "smile", blink: 0 };

/** How far above the head's centre the hair reaches, in head radii. */
const hairTop = (c: CastMember) => (c.hair === "spikes" || c.hair === "bun" || c.hair === "beanie" ? 1.5 : 1.15);

/**
 * Draw a character fitted to a W × H box: the whole figure standing on the floor, or (`head`) a
 * close-up of the head and shoulders.
 */
function paintFigure(ctx: CanvasRenderingContext2D, W: number, H: number, c: CastMember, pose: AbsPose, focus: "full" | "head" = "full") {
  const below = c.legLen + c.bodyH + c.neck + c.headR * 0.85;
  if (focus === "head") {
    const unit = (H * 0.5) / (c.headR * (1 + hairTop(c)));
    drawAbstract(ctx, W / 2, H * 0.6 + below * unit, unit, c, pose);
    return;
  }
  const total = below + c.headR * hairTop(c);
  const unit = Math.min((H * 0.84) / total, W * 1.4);
  drawAbstract(ctx, W / 2, H * 0.93, unit, c, pose);
}

/** A still render of a character on a small canvas (option tiles, the cast strip). */
function Figure({ c, w, h, focus = "full" }: { c: CastMember; w: number; h: number; focus?: "full" | "head" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(c);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    paintFigure(ctx, w, h, c, STILL, focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, w, h, focus]);
  return <canvas ref={ref} style={{ width: w, height: h }} aria-hidden="true" />;
}

/** A small still of a character, for lists of the cast. */
export function CastThumb({ c }: { c: CastMember }) {
  return <Figure c={c} w={32} h={38} />;
}

/**
 * The designer in a dialog (the studio's): Esc or the backdrop closes it; focus starts inside and
 * returns to where it was.
 */
export function CharacterDesignerModal({ cast, onChange, palette, onClose }: { cast: CastMember[]; onChange: (cast: CastMember[]) => void; palette?: Palette; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("button, input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      back?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={box} className="modal char-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Character designer">
        <div className="modal-head">
          <h2>Character designer</h2>
          <button className="icon-btn sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <CharacterDesigner cast={cast} onChange={onChange} palette={palette} />
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** The big live preview: the character idles, blinks, looks around and now and then waves. */
function LivePreview({ c }: { c: CastMember }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cRef = useRef(c);
  cRef.current = c;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();
    const frame = () => {
      const rect = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(1, rect.width);
      const H = Math.max(1, rect.height);
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      const ctx = cv.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const t = still ? 0 : (performance.now() - t0) / 1000;
      const id = idle(t, 0);
      // A wave every six seconds: up, rock, down.
      const cy = t % 6;
      const up = Math.min(1, Math.max(0, (cy - 1.2) / 0.35));
      const down = Math.min(1, Math.max(0, (cy - 3.2) / 0.35));
      const k = still ? 0 : (up - down) * (up - down) * (3 - 2 * (up - down));
      paintFigure(ctx, W, H, cRef.current, {
        armL: id.armL,
        armR: waveArm(t, k),
        curlR: 0.5,
        lift: id.lift,
        squash: id.squash,
        mouth: k > 0.3 ? "open" : "smile",
        blink: blinkAt(t, 0.5),
        look: Math.sin(t * 0.6) * 0.5,
      });
      if (!still) raf = requestAnimationFrame(frame);
    };
    frame();
    const ro = new ResizeObserver(() => still && frame());
    ro.observe(cv);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  return <canvas ref={ref} className="cd-live" aria-label="Your character, moving" role="img" />;
}

/** Save one character as a transparent PNG. */
function downloadPng(c: CastMember) {
  const W = 1024;
  const H = 1280;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  paintFigure(cv.getContext("2d")!, W, H, c, { armL: 0.3, armR: 0.3, mouth: "smile", blink: 0 });
  cv.toBlob((b) => {
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `${(c.name || "character").replace(/[^\w-]+/g, "-").toLowerCase()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
}

function Tiles<T extends string>({ name, options, value, make, focus, onPick }: { name: string; options: readonly T[]; value: T; make: (o: T) => CastMember; focus?: "full" | "head"; onPick: (o: T) => void }) {
  return (
    <div className="cd-tiles" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={o === value} className={`cd-tile${o === value ? " active" : ""}`} onClick={() => onPick(o)} title={label(o)}>
          <Figure c={make(o)} w={58} h={64} focus={focus} />
          <span>{label(o)}</span>
        </button>
      ))}
    </div>
  );
}

function Colors({ name, colors, value, onPick }: { name: string; colors: string[]; value: string; onPick: (c: string) => void }) {
  const list = [...new Set(colors.map((c) => c.toLowerCase()))];
  const custom = !list.includes(value.toLowerCase());
  return (
    <div className="cd-colors" role="radiogroup" aria-label={name}>
      {list.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={c === value.toLowerCase()} aria-label={c} className={`cd-color${c === value.toLowerCase() ? " active" : ""}`} style={{ background: c }} onClick={() => onPick(c)} />
      ))}
      <label className={`cd-color cd-custom${custom ? " active" : ""}`} title="Any colour" style={custom ? { background: value } : undefined}>
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} aria-label={`${name}: any colour`} />
        {!custom && <span aria-hidden="true">+</span>}
      </label>
    </div>
  );
}

function Range({ name, value, range, onChange }: { name: string; value: number; range: readonly [number, number]; onChange: (v: number) => void }) {
  const [lo, hi] = range;
  return (
    <label className="cd-range">
      <span>{name}</span>
      <input type="range" min={lo} max={hi} step={(hi - lo) / 100} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/**
 * The character designer: build simple abstract characters (body, head, hair, face, colours and
 * proportions), shuffle for ideas, keep a cast of up to CAST_MAX, and download any one as a PNG.
 */
export default function CharacterDesigner({ cast, onChange, palette = PALETTES.swiss }: { cast: CastMember[]; onChange: (cast: CastMember[]) => void; palette?: Palette }) {
  const [sel, setSel] = useState(0);
  const i = Math.min(sel, Math.max(0, cast.length - 1));
  const m = cast[i];
  const brand = [palette.primary, palette.secondary];

  // New characters come out in the style you're using.
  const styled = (c: CastMember, art = cast[sel]?.art ?? cast[0]?.art) => (art && art !== "flat" ? { ...c, art } : c);
  const add = () => {
    if (cast.length >= CAST_MAX) return;
    onChange([...cast, styled(newCharacter(palette))]);
    setSel(cast.length);
  };
  if (!m) {
    return (
      <div className="cd-empty">
        <p>Design simple abstract characters for your videos: pick a body, head, hair and face, then the colours and proportions. Or shuffle for ideas.</p>
        <button type="button" className="btn btn-primary" onClick={add}>
          Create a character
        </button>
      </div>
    );
  }
  const update = (patch: Partial<CastMember>) => {
    const next = { ...m, ...patch };
    // Bare arms follow the skin; sleeves follow the top.
    if (patch.skin && m.armColor === m.skin) next.armColor = patch.skin;
    if (patch.bodyColor && m.armColor === m.bodyColor) next.armColor = patch.bodyColor;
    onChange(cast.map((c, k) => (k === i ? next : c)));
  };
  const shuffle = () => update({ ...styled(newCharacter(palette), m.art), art: m.art, name: m.name });
  const recolor = () => {
    const r = newCharacter(palette);
    update({ bodyColor: r.bodyColor, patternColor: r.patternColor, skin: r.skin, hairColor: r.hairColor, legColor: r.legColor, shoe: r.shoe, armColor: m.armColor === m.skin ? r.skin : r.bodyColor });
  };
  const remove = () => {
    onChange(cast.filter((_, k) => k !== i));
    setSel(Math.max(0, i - 1));
  };
  const move = (d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= cast.length) return;
    const next = [...cast];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setSel(j);
  };
  const sleeves = m.armColor !== m.skin;

  return (
    <div className="cd">
      <div className="cd-stage">
        <div className="cd-preview">
          <LivePreview c={m} />
        </div>
        <input className="input cd-name" value={m.name ?? ""} maxLength={24} placeholder={`Character ${i + 1}`} aria-label="Name" onChange={(e) => update({ name: e.target.value })} />
        <div className="cd-actions">
          <button type="button" className="btn btn-ghost sm" onClick={shuffle} title="A whole new design">
            Shuffle
          </button>
          <button type="button" className="btn btn-ghost sm" onClick={recolor} title="New colours, same shapes">
            New colours
          </button>
          <button type="button" className="btn btn-ghost sm" onClick={() => downloadPng(m)} title="A transparent PNG, 1024 × 1280">
            Download PNG
          </button>
        </div>
        <div className="cd-cast" role="listbox" aria-label="Your characters">
          {cast.map((c, k) => (
            <button key={k} type="button" role="option" aria-selected={k === i} className={`cd-member${k === i ? " active" : ""}`} onClick={() => setSel(k)} title={c.name || `Character ${k + 1}`}>
              <Figure c={c} w={44} h={52} />
              {k === 0 && <span className="cd-lead">Lead</span>}
            </button>
          ))}
          {cast.length < CAST_MAX && (
            <button type="button" className="cd-member cd-add" onClick={add} title="Add a character" aria-label="Add a character">
              +
            </button>
          )}
        </div>
        <div className="cd-actions">
          <button type="button" className="btn btn-ghost sm" onClick={() => move(-1)} disabled={i === 0} title="Earlier in the cast">
            ← Move
          </button>
          <button type="button" className="btn btn-ghost sm" onClick={() => move(1)} disabled={i === cast.length - 1} title="Later in the cast">
            Move →
          </button>
          <button type="button" className="btn btn-ghost sm" onClick={() => cast.length < CAST_MAX && (onChange([...cast.slice(0, i + 1), { ...m, name: undefined }, ...cast.slice(i + 1)]), setSel(i + 1))} disabled={cast.length >= CAST_MAX}>
            Duplicate
          </button>
          <button type="button" className="btn btn-ghost sm danger" onClick={remove}>
            Remove
          </button>
        </div>
        <p className="hint">The lead says hello and starts the conversations; the rest of your cast stand front and centre in crowds, then generated people fill in.</p>
      </div>

      <div className="cd-controls">
        <section>
          <h3>Style</h3>
          <Tiles name="Drawing style" options={ART_STYLES} value={m.art ?? "flat"} make={(o) => ({ ...m, art: o })} onPick={(o) => update({ art: o === "flat" ? undefined : o })} />
          <div className="cd-actions">
            <button type="button" className="btn btn-ghost sm" onClick={() => onChange(cast.map((c) => ({ ...c, art: m.art })))} disabled={cast.every((c) => (c.art ?? "flat") === (m.art ?? "flat"))}>
              Use this style for the whole cast
            </button>
          </div>
        </section>
        <section>
          <h3>Body</h3>
          <Tiles name="Body shape" options={BODIES} value={m.body} make={(o) => ({ ...m, body: o })} onPick={(o) => update({ body: o })} />
          <Tiles name="Pattern" options={PATTERNS} value={m.pattern} make={(o) => ({ ...m, pattern: o })} onPick={(o) => update({ pattern: o })} />
          <span className="cd-label">Colour</span>
          <Colors name="Body colour" colors={[...brand, ...MODERN]} value={m.bodyColor} onPick={(c) => update({ bodyColor: c })} />
          {m.pattern !== "none" && (
            <>
              <span className="cd-label">Pattern colour</span>
              <Colors name="Pattern colour" colors={["#ffffff", ...brand, ...MODERN]} value={m.patternColor} onPick={(c) => update({ patternColor: c })} />
            </>
          )}
          <div className="cd-ranges">
            <Range name="Width" value={m.bodyW} range={RANGES.bodyW} onChange={(v) => update({ bodyW: v })} />
            <Range name="Height" value={m.bodyH} range={RANGES.bodyH} onChange={(v) => update({ bodyH: v })} />
          </div>
        </section>
        <section>
          <h3>Head</h3>
          <Tiles name="Head shape" options={HEADS} value={m.head} make={(o) => ({ ...m, head: o })} focus="head" onPick={(o) => update({ head: o })} />
          <span className="cd-label">Skin</span>
          <Colors name="Skin" colors={[...SKINS, ...PLAYFUL_SKINS]} value={m.skin} onPick={(c) => update({ skin: c })} />
          <div className="cd-ranges">
            <Range name="Size" value={m.headR} range={RANGES.headR} onChange={(v) => update({ headR: v })} />
            <Range name="Neck" value={m.neck} range={RANGES.neck} onChange={(v) => update({ neck: v })} />
          </div>
        </section>
        <section>
          <h3>Hair</h3>
          <Tiles name="Hair style" options={HAIR_STYLES} value={m.hair} make={(o) => ({ ...m, hair: o })} focus="head" onPick={(o) => update({ hair: o })} />
          {m.hair !== "none" && (
            <>
              <span className="cd-label">Colour</span>
              <Colors name="Hair colour" colors={[...HAIRS, ...MODERN.slice(0, 5)]} value={m.hairColor} onPick={(c) => update({ hairColor: c })} />
            </>
          )}
        </section>
        <section>
          <h3>Face</h3>
          <Tiles name="Eyes" options={EYES} value={m.eyes} make={(o) => ({ ...m, eyes: o })} focus="head" onPick={(o) => update({ eyes: o })} />
          <div className="cd-toggles">
            {(["glasses", "cheeks", "nose"] as const).map((k) => (
              <button key={k} type="button" className={`chip${m[k] ? " active" : ""}`} aria-pressed={m[k]} onClick={() => update({ [k]: !m[k] })}>
                {k === "glasses" ? "Glasses" : k === "cheeks" ? "Rosy cheeks" : "Nose"}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3>Arms and legs</h3>
          <div className="seg-control">
            <button type="button" className={!sleeves ? "active" : ""} onClick={() => update({ armColor: m.skin })}>
              Bare arms
            </button>
            <button type="button" className={sleeves ? "active" : ""} onClick={() => update({ armColor: m.bodyColor })}>
              Sleeves
            </button>
          </div>
          <span className="cd-label">Legs</span>
          <Colors name="Leg colour" colors={[...NEUTRALS, ...MODERN.slice(0, 6)]} value={m.legColor} onPick={(c) => update({ legColor: c })} />
          <span className="cd-label">Shoes</span>
          <Colors name="Shoe colour" colors={[...NEUTRALS.slice(0, 3), ...brand, ...MODERN.slice(0, 5)]} value={m.shoe} onPick={(c) => update({ shoe: c })} />
          <div className="cd-ranges">
            <Range name="Leg length" value={m.legLen} range={RANGES.legLen} onChange={(v) => update({ legLen: v })} />
          </div>
        </section>
      </div>
    </div>
  );
}
