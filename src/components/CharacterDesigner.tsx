"use client";

import { useEffect, useRef, useState } from "react";
import { ART_STYLES, BODIES, KINDS, CAST_MAX, EYES, HAIR_STYLES, HAIRS, HEADS, introColors, matchColors, MODERN, NEUTRALS, PATTERNS, PLAYFUL_SKINS, RANGES, sanitizeCast, SKINS } from "@/engine/cast";
import { PALETTES } from "@/engine/palettes";
import { drawAbstract, idle, makeCharacter, waveArm, type AbsPose } from "@/engine/skills/abstract";
import { blinkAt } from "@/engine/skills/characters";
import { mixHex } from "@/engine/math";
import type { CastMember, CharacterKind, Palette } from "@/engine/types";

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

/** Colours to design in when there's no video to match (the /characters page): bright and mixed. */
const SHOWCASE: Palette = { ...PALETTES.pastel, primary: "#8338ec", secondary: "#ff6b6b", accent: "#06d6a0", bg0: "#f4f1fb", bg1: "#ffffff", light: true };

/** A brand-new random character, dressed in `palette`'s colours. */
export function newCharacter(palette: Palette = SHOWCASE, kind: CharacterKind = "abstract"): CastMember {
  return makeCharacter(Math.floor(Math.random() * 2 ** 31), palette, kind);
}

const LABELS: Record<string, string> = {
  abstract: "Abstract",
  memphis: "Memphis",
  blob: "Blob",
  stick: "Stick figure",
  classic: "Classic cartoon",
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
  // Measure the figure (any kind) with a dry run at a 100-unit height, standing at the origin.
  const rig = drawAbstract(scratch(), 0, 0, 100, c, pose);
  if (focus === "head") {
    const span = rig.head.y - rig.top + rig.head.r;
    const unit = (H * 0.5 * 100) / span;
    drawAbstract(ctx, W / 2, H * 0.6 - (rig.head.y / 100) * unit, unit, c, pose);
    return;
  }
  const total = -rig.top / 100;
  const unit = Math.min((H * 0.84) / total, W * 1.4);
  drawAbstract(ctx, W / 2, H * 0.93, unit, c, pose);
}

let scratchCtx: CanvasRenderingContext2D | null = null;
const scratch = () => (scratchCtx ??= document.createElement("canvas").getContext("2d")!);

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
export function CastThumb({ c, palette, slot = 0 }: { c: CastMember; palette?: Palette; slot?: number }) {
  return <Figure c={palette ? matchColors(c, palette, slot) : c} w={32} h={38} />;
}

/**
 * The designer in a dialog (the studio's): Esc or the backdrop closes it; focus starts inside and
 * returns to where it was.
 */
export function CharacterDesignerModal({ cast, onChange, palette, onClose }: { cast: CastMember[]; onChange: (cast: CastMember[]) => void; palette: Palette; onClose: () => void }) {
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
        <CharacterDesigner cast={cast} onChange={onChange} palette={palette} match />
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

/** What each type of character is. */
const KIND_HINT: Record<CharacterKind, string> = {
  abstract: "Minimal geometric people with bendy noodle limbs.",
  memphis: "The modern Corporate Memphis look: tiny heads, long bendy limbs, big hands and feet.",
  blob: "A cute one-shape mascot with big eyes and stubby legs, great for kids and friendly apps.",
  stick: "A minimal stick figure: an empty round head and line limbs in one colour, great for explainers.",
  classic: "A traditional rubber-hose cartoon: white gloves, pie-cut eyes and big shoes.",
};
const BODY_LABELS: Partial<Record<CharacterKind, Record<string, string>>> = {
  blob: { arch: "Ghost", bell: "Pear", triangle: "Gumdrop" },
  stick: { pill: "Plain", triangle: "Dress" },
};
const PATTERN_LABELS: Partial<Record<CharacterKind, Record<string, string>>> = {
  blob: { half: "Belly" },
  stick: { none: "None", stripes: "Scarf", dots: "Bow tie", half: "T-shirt" },
};
const HAIR_LABELS: Partial<Record<CharacterKind, Record<string, string>>> = {
  blob: { cap: "Tuft", bun: "Antenna", spikes: "Spikes", wave: "Sprout", afro: "Fluffy", beanie: "Beanie" },
};
const EYE_LABELS: Partial<Record<CharacterKind, Record<string, string>>> = {
  blob: { dots: "Big eyes", lines: "Happy", ovals: "Beady" },
  classic: { dots: "Pie-cut", lines: "Happy", ovals: "Classic" },
};

/** Switching type: the parts that type needs set sensibly (a blob's arms and feet match its body…). */
function kindFix(m: CastMember, k: CharacterKind): Partial<CastMember> {
  const fix: Partial<CastMember> = { kind: k === "abstract" ? undefined : k };
  if (k === "blob") Object.assign(fix, { armColor: m.bodyColor, legColor: mixHex(m.bodyColor, "#000000", 0.2), shoe: mixHex(m.bodyColor, "#000000", 0.35) });
  if (k === "stick") Object.assign(fix, { body: m.body === "bell" || m.body === "triangle" ? "triangle" : "pill", legColor: NEUTRALS.includes(m.legColor) ? m.legColor : NEUTRALS[1] });
  if ((m.kind === "blob" || m.kind === "classic") && (k === "abstract" || k === "memphis")) Object.assign(fix, { armColor: m.skin, legColor: NEUTRALS[1], shoe: NEUTRALS[0] });
  return fix;
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

function Tiles<T extends string>({ name, options, value, make, focus, onPick, labels }: { name: string; options: readonly T[]; value: T; make: (o: T) => CastMember; focus?: "full" | "head"; onPick: (o: T) => void; labels?: Partial<Record<string, string>> }) {
  return (
    <div className="cd-tiles" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={o === value} className={`cd-tile${o === value ? " active" : ""}`} onClick={() => onPick(o)} title={labels?.[o] ?? label(o)}>
          <Figure c={make(o)} w={58} h={64} focus={focus} />
          <span>{labels?.[o] ?? label(o)}</span>
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
export default function CharacterDesigner({ cast, onChange, palette = SHOWCASE, match = false }: { cast: CastMember[]; onChange: (cast: CastMember[]) => void; palette?: Palette; match?: boolean }) {
  const [sel, setSel] = useState(0);
  const i = Math.min(sel, Math.max(0, cast.length - 1));
  const raw = cast[i];
  // What it looks like in this video: the intro's colours, unless it has its own (match is set
  // when there's a video to match; on its own page a character shows the colours it was made in).
  const shown = (c: CastMember, k: number) => (match ? matchColors(c, palette, k) : c);
  const m = raw && shown(raw, i);
  const brand = introColors(palette).slice(0, 3);

  // New characters come out in the style you're using.
  const styled = (c: CastMember, art = cast[sel]?.art ?? cast[0]?.art) => (art && art !== "flat" ? { ...c, art } : c);
  const add = () => {
    if (cast.length >= CAST_MAX) return;
    onChange([...cast, styled(newCharacter(palette, cast[sel]?.kind ?? cast[0]?.kind))]);
    setSel(cast.length);
  };
  if (!raw || !m) {
    return (
      <div className="cd-empty">
        <p>Design simple abstract characters for your videos: pick a body, head, hair and face, then the colours and proportions. Or shuffle for ideas.</p>
        <button type="button" className="btn btn-primary" onClick={add}>
          Create a character
        </button>
      </div>
    );
  }
  /** Change the character. `own`: a colour you picked, so it keeps your colours from now on. */
  const update = (patch: Partial<CastMember>, own = false) => {
    const base = own ? { ...m, ownColors: true } : raw;
    const next = { ...base, ...patch };
    // Bare arms follow the skin; sleeves follow the top.
    if (patch.skin && base.armColor === base.skin) next.armColor = patch.skin;
    if (patch.bodyColor && base.armColor === base.bodyColor) next.armColor = patch.bodyColor;
    onChange(cast.map((c, k) => (k === i ? next : c)));
  };
  const shuffle = () => update({ ...newCharacter(palette, raw.kind), art: raw.art, name: raw.name, ownColors: raw.ownColors });
  const recolor = () => {
    // A new mix of the intro's colours (yours from now on).
    const set = introColors(palette);
    const pick = () => set[Math.floor(Math.random() * set.length)];
    const body = pick();
    let pattern = pick();
    if (pattern === body) pattern = "#ffffff";
    update({ bodyColor: body, patternColor: pattern, armColor: m.armColor === m.skin ? m.skin : body, shoe: Math.random() < 0.5 ? NEUTRALS[0] : pick() }, true);
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
  const kind = m.kind ?? "abstract";

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
              <Figure c={shown(c, k)} w={44} h={52} />
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
          <h3>Type</h3>
          <Tiles name="Type of character" options={KINDS} value={kind} make={(o) => ({ ...m, ...kindFix(m, o) })} onPick={(o) => update(kindFix(m, o))} />
          <p className="hint">{KIND_HINT[kind]}</p>
        </section>
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
          <h3>Colours</h3>
          <div className="seg-control">
            <button type="button" className={!raw.ownColors ? "active" : ""} onClick={() => onChange(cast.map((c, k) => (k === i ? { ...c, ownColors: undefined } : c)))}>
              Match the intro
            </button>
            <button type="button" className={raw.ownColors ? "active" : ""} onClick={() => update({}, true)}>
              My colours
            </button>
          </div>
          <p className="hint">{raw.ownColors ? "Keeps the colours you chose in any video." : match ? "Dressed in this video's colours, and they follow if you change them. Pick any colour below to choose your own." : "In a video, the clothes take that video's colours. Pick any colour below to keep your own."}</p>
        </section>
        <section>
          <h3>{kind === "blob" ? "Shape" : "Body"}</h3>
          {kind !== "classic" && kind !== "stick" && <Tiles name="Body shape" options={BODIES} labels={BODY_LABELS[kind]} value={m.body} make={(o) => ({ ...m, body: o })} onPick={(o) => update({ body: o })} />}
          {kind !== "classic" && kind !== "stick" && <Tiles name="Pattern" options={PATTERNS} labels={PATTERN_LABELS[kind]} value={m.pattern} make={(o) => ({ ...m, pattern: o })} onPick={(o) => update({ pattern: o })} />}
          {kind !== "stick" && (
            <>
              <span className="cd-label">{kind === "classic" ? "Shirt" : "Colour"}</span>
              <Colors name="Body colour" colors={[...brand, ...MODERN]} value={m.bodyColor} onPick={(c) => update({ bodyColor: c }, true)} />
            </>
          )}
          {(kind === "classic" || (m.pattern !== "none" && kind !== "stick")) && (
            <>
              <span className="cd-label">{kind === "classic" ? "Shorts" : kind === "blob" && m.pattern === "half" ? "Belly" : "Pattern colour"}</span>
              <Colors name="Pattern colour" colors={["#ffffff", ...brand, ...MODERN]} value={m.patternColor} onPick={(c) => update({ patternColor: c }, true)} />
            </>
          )}
          <div className="cd-ranges">
            {kind !== "stick" && <Range name="Width" value={m.bodyW} range={RANGES.bodyW} onChange={(v) => update({ bodyW: v })} />}
            <Range name={kind === "stick" ? "Body length" : "Height"} value={m.bodyH} range={RANGES.bodyH} onChange={(v) => update({ bodyH: v })} />
          </div>
        </section>
        {kind !== "blob" && (
          <section>
            <h3>Head</h3>
            {(kind === "abstract" || kind === "memphis") && <Tiles name="Head shape" options={HEADS} value={m.head} make={(o) => ({ ...m, head: o })} focus="head" onPick={(o) => update({ head: o })} />}
            {kind !== "stick" && (
              <>
                <span className="cd-label">Skin</span>
                <Colors name="Skin" colors={[...SKINS, ...PLAYFUL_SKINS]} value={m.skin} onPick={(c) => update({ skin: c })} />
              </>
            )}
            <div className="cd-ranges">
              <Range name="Size" value={m.headR} range={RANGES.headR} onChange={(v) => update({ headR: v })} />
              {kind !== "classic" && kind !== "stick" && <Range name="Neck" value={m.neck} range={RANGES.neck} onChange={(v) => update({ neck: v })} />}
            </div>
          </section>
        )}
        {kind !== "stick" && (<>
        <section>
          <h3>{kind === "blob" ? "On top" : "Hair"}</h3>
          <Tiles name="Hair style" options={kind === "blob" ? (["none", "cap", "bun", "spikes", "wave", "afro", "beanie"] as const) : HAIR_STYLES} labels={HAIR_LABELS[kind]} value={m.hair} make={(o) => ({ ...m, hair: o })} focus="head" onPick={(o) => update({ hair: o })} />
          {m.hair !== "none" && m.hair !== "beanie" && (
            <>
              <span className="cd-label">Colour</span>
              <Colors name="Hair colour" colors={[...HAIRS, ...MODERN.slice(0, 5)]} value={m.hairColor} onPick={(c) => update({ hairColor: c }, !HAIRS.slice(0, 5).includes(c))} />
            </>
          )}
        </section>
        <section>
          <h3>Face</h3>
          <Tiles name="Eyes" options={EYES} labels={EYE_LABELS[kind]} value={m.eyes} make={(o) => ({ ...m, eyes: o })} focus="head" onPick={(o) => update({ eyes: o })} />
          <div className="cd-toggles">
            {(kind === "blob" || kind === "memphis" ? (["glasses", "cheeks"] as const) : (["glasses", "cheeks", "nose"] as const)).map((k) => (
              <button key={k} type="button" className={`chip${m[k] ? " active" : ""}`} aria-pressed={m[k]} onClick={() => update({ [k]: !m[k] })}>
                {k === "glasses" ? "Glasses" : k === "cheeks" ? "Rosy cheeks" : kind === "classic" ? "Button nose" : "Nose"}
              </button>
            ))}
          </div>
        </section>
        </>)}
        <section>
          <h3>{kind === "stick" ? "Lines" : kind === "classic" ? "Shoes" : "Arms and legs"}</h3>
          {(kind === "abstract" || kind === "memphis") && (
            <div className="seg-control">
              <button type="button" className={!sleeves ? "active" : ""} onClick={() => update({ armColor: m.skin })}>
                Bare arms
              </button>
              <button type="button" className={sleeves ? "active" : ""} onClick={() => update({ armColor: m.bodyColor }, true)}>
                Sleeves
              </button>
            </div>
          )}
          {kind !== "classic" && (
            <>
              <span className="cd-label">{kind === "stick" ? "Line colour" : kind === "memphis" ? "Trousers" : "Legs"}</span>
              <Colors name="Leg colour" colors={[...NEUTRALS, ...MODERN.slice(0, 6)]} value={m.legColor} onPick={(c) => update({ legColor: c }, true)} />
            </>
          )}
          {kind !== "stick" && (
            <>
              <span className="cd-label">{kind === "blob" ? "Feet" : "Shoes"}</span>
              <Colors name="Shoe colour" colors={[...NEUTRALS.slice(0, 3), "#8a4b2a", ...brand, ...MODERN.slice(0, 5)]} value={m.shoe} onPick={(c) => update({ shoe: c }, true)} />
            </>
          )}
          <div className="cd-ranges">
            <Range name="Leg length" value={m.legLen} range={RANGES.legLen} onChange={(v) => update({ legLen: v })} />
          </div>
        </section>
      </div>
    </div>
  );
}
