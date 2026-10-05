"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SKILL_GROUPS, SKILL_MAP } from "@/engine/skills";
import type { Scene, SkillId, VideoPlan } from "@/engine/types";
import { later, skillThumb, thumbsReady } from "@/lib/thumbs";

/**
 * Slide-style picker: a searchable menu where every style shows a live thumbnail (rendered in the
 * film's own colours, font and brand) next to its name. `variant="add"` renders an "Add slide"
 * button instead of the current-style field.
 */
export default function SkillPicker({
  plan,
  value,
  onPick,
  variant = "field",
  label,
  scene,
}: {
  plan: VideoPlan;
  /** The slide being restyled: the menu previews every style with this slide's own content. */
  scene?: Scene;
  value?: SkillId;
  onPick: (id: SkillId) => void;
  variant?: "field" | "add";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  const [cursor, setCursor] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return SKILL_GROUPS.map((g) => ({
      name: g.name,
      skills: g.skills.filter((s) => words.every((w) => `${s.name} ${s.tagline} ${g.name}`.toLowerCase().includes(w))),
    })).filter((g) => g.skills.length);
  }, [q]);
  const flat = useMemo(() => groups.flatMap((g) => g.skills), [groups]);

  // The current style's thumbnail on the field itself.
  const [fieldThumb, setFieldThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!value || variant !== "field") return;
    let alive = true;
    thumbsReady()
      .then(() => later(() => skillThumb(value, plan, scene), () => alive))
      .then((src) => src && alive && setFieldThumb(src));
    return () => {
      alive = false;
    };
  }, [value, plan, variant, scene]);

  // Thumbnails paint only for the tiles in view (and just below), a few milliseconds at a time,
  // with one update per frame: opening and scrolling stay instant, and a style far down the menu
  // (the product-photo ones cut their photo out on first use) costs nothing until it's scrolled to.
  const body = useRef<HTMLDivElement>(null);
  const shown = pos !== null;
  const done = useRef(new Set<string>());
  useEffect(() => {
    done.current = new Set();
  }, [plan, scene]);
  useEffect(() => {
    if (!open || !shown || !body.current) return;
    let alive = true;
    let timer = 0;
    let raf = 0;
    let ready = false;
    const inView = new Set<string>();
    let batch: Record<string, string> = {};
    const flush = () => {
      raf = 0;
      const b = batch;
      batch = {};
      setThumbs((t) => ({ ...t, ...b }));
    };
    const step = () => {
      timer = 0;
      if (!alive) return;
      const until = performance.now() + 8;
      for (const id of inView) {
        if (done.current.has(id)) continue;
        done.current.add(id);
        batch[id] = skillThumb(id as SkillId, plan, scene);
        if (performance.now() > until) break;
      }
      if (Object.keys(batch).length && !raf) raf = requestAnimationFrame(flush);
      if ([...inView].some((id) => !done.current.has(id))) timer = window.setTimeout(step, 0);
    };
    const kick = () => {
      if (ready && !timer) timer = window.setTimeout(step, 0);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.skill!;
          if (e.isIntersecting) inView.add(id);
          else inView.delete(id);
        }
        kick();
      },
      { root: body.current, rootMargin: "120px 0px" },
    );
    body.current.querySelectorAll<HTMLElement>("[data-skill]").forEach((el) => io.observe(el));
    thumbsReady().then(() => {
      ready = true;
      kick();
    });
    return () => {
      alive = false;
      io.disconnect();
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      // Painted but not yet shown: keep them (they're cached), shown on the next open.
      if (Object.keys(batch).length) setThumbs((t) => ({ ...t, ...batch }));
    };
  }, [open, shown, flat, plan, scene]);
  // A new look (palette, font, style) means new thumbnails.
  useEffect(() => setThumbs({}), [plan, scene]);

  // Place the menu under the button (or above it when there is no room), inside the viewport.
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

  // Focus the search once the menu is placed; close on a click outside or Escape anywhere.
  useEffect(() => {
    if (open && shown) search.current?.focus({ preventScroll: true });
  }, [open, shown]);
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  useEffect(() => setCursor(0), [q]);
  useEffect(() => {
    menu.current?.querySelector(`[data-i="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const choose = (id: SkillId) => {
    onPick(id);
    setOpen(false);
    setQ("");
    btn.current?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const cols = window.innerWidth < 560 ? 2 : 3;
    if (e.key === "Enter" && flat[cursor]) {
      e.preventDefault();
      choose(flat[cursor].id);
    } else if (e.key === "ArrowRight") setCursor((c) => Math.min(flat.length - 1, c + 1));
    else if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, c - 1));
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(flat.length - 1, c + cols));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - cols));
    }
  };

  const current = value ? SKILL_MAP[value] : undefined;
  const portrait = plan.aspect === "9:16";
  let n = -1;
  return (
    <>
      {variant === "field" ? (
        <button ref={btn} type="button" className={`skill-field${open ? " open" : ""}`} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} title={current?.tagline}>
          <span className={`skill-thumb sm${portrait ? " tall" : ""}`}>{fieldThumb && <img src={fieldThumb} alt="" />}</span>
          <span className="skill-field-name">{current?.name ?? "Choose a style"}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      ) : (
        <button ref={btn} type="button" className="scene-add" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}>
          {label ?? "+ Add slide"}
        </button>
      )}
      {open && pos && (
        <div ref={menu} className="skill-menu" role="dialog" aria-label="Slide styles" style={{ left: pos.left, top: pos.top, maxHeight: pos.maxH }} onKeyDown={onKey}>
          <div className="skill-menu-head">
            <input ref={search} className="input sm" placeholder={`Search ${flat.length} slide styles…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search slide styles" />
          </div>
          <div className="skill-menu-body" ref={body}>
            {groups.map((g) => (
              <section key={g.name}>
                <h4>{g.name}</h4>
                <div className="skill-grid">
                  {g.skills.map((s) => {
                    n++;
                    const i = n;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        data-i={i}
                        data-skill={s.id}
                        className={`skill-tile${s.id === value ? " current" : ""}${i === cursor ? " cursor" : ""}`}
                        onClick={() => choose(s.id)}
                        onMouseEnter={() => setCursor(i)}
                        title={s.tagline}
                      >
                        <span className={`skill-thumb${portrait ? " tall" : ""}`}>{thumbs[s.id] ? <img src={thumbs[s.id]} alt="" /> : <span className="skill-thumb-wait" />}</span>
                        <span className="skill-tile-text">
                          <strong>{s.name}</strong>
                          <small>{s.tagline}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            {!flat.length && <p className="skill-menu-empty">No slide style matches “{q}”.</p>}
          </div>
        </div>
      )}
    </>
  );
}
