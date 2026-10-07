"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";

export interface SidebarIntro {
  /** "a:<id>" for an intro saved to the account, "l:<id>" for one kept in this browser. */
  key: string;
  title: string;
  updatedAt: number;
  color: string;
  thumb?: string;
}

const PREF = "intromaker.sidebar";

const ago = (t: number) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/**
 * The studio's left sidebar: your intros, newest first, with the open one highlighted and a search
 * box once there are more than six; + New intro at the top and All intros at the bottom. It folds
 * to icons only (its button or ⌘/Ctrl+B; hovering an icon names the intro), remembered on this
 * device; open on wide screens and folded on smaller ones until you choose. Hidden on phones.
 * Each intro's ⋯ menu (or a right-click) renames, duplicates or deletes it (deleting asks first).
 */
export default function IntroSidebar({
  intros,
  current,
  onOpen,
  onNew,
  onRename,
  onDuplicate,
  onDelete,
  allHref,
  note,
}: {
  intros: SidebarIntro[];
  current: string | null;
  onOpen: (intro: SidebarIntro) => void;
  onNew: () => void;
  onRename?: (intro: SidebarIntro, title: string) => void;
  onDuplicate?: (intro: SidebarIntro) => void;
  onDelete?: (intro: SidebarIntro) => void;
  allHref: string;
  /** A line under the list (e.g. that intros are kept in this browser until you sign in). */
  note?: string;
}) {
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState("");
  // An intro's menu (drawn fixed, outside the scrolling list), and the one being renamed.
  const [menu, setMenu] = useState<{ intro: SidebarIntro; top: number; left: number; confirm?: boolean } | null>(null);
  const [renaming, setRenaming] = useState<{ key: string; value: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const actions = !!(onRename || onDuplicate || onDelete);
  const openMenu = (intro: SidebarIntro, anchor: { top: number; left: number }) => {
    setTip(null);
    setMenu({ intro, top: Math.min(anchor.top, window.innerHeight - 170), left: anchor.left });
  };
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    window.addEventListener("resize", () => setMenu(null), { once: true });
    // Focus the first choice, so the menu works from the keyboard.
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>("button")?.focus());
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [menu]);
  const finishRename = (save: boolean) => {
    const r = renaming;
    setRenaming(null);
    if (!r || !save) return;
    const x = intros.find((i) => i.key === r.key);
    const title = r.value.trim();
    if (x && title && title !== x.title) onRename?.(x, title);
  };
  // Folded: hovering an icon names it (drawn outside the scrolling list, so it isn't clipped).
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);
  const tipProps = (text: string) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      if (open && !(e.currentTarget as HTMLElement).classList.contains("rail-toggle")) return;
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ text, top: r.top + r.height / 2, left: r.right + 10 });
    },
    onMouseLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      if (open) return;
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ text, top: r.top + r.height / 2, left: r.right + 10 });
    },
    onBlur: () => setTip(null),
  });
  // Your choice, else open on wide screens and folded on smaller ones.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(PREF);
    } catch {
      /* ignore */
    }
    setOpen(saved ? saved === "open" : window.innerWidth >= 1440);
  }, []);
  const toggle = () =>
    setOpen((o) => {
      setTip(null);
      try {
        localStorage.setItem(PREF, o ? "closed" : "open");
      } catch {
        /* ignore */
      }
      return !o;
    });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return words.length ? intros.filter((x) => words.every((w) => x.title.toLowerCase().includes(w))) : intros;
  }, [intros, q]);
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const keys = mac ? "⌘B" : "Ctrl+B";

  return (
    <nav className={`intro-rail${open ? " open" : " folded"}`} aria-label="Your intros">
      <div className="rail-head">
        <button type="button" className="rail-toggle" onClick={toggle} aria-expanded={open} aria-label={open ? "Collapse sidebar" : "Expand sidebar"} {...tipProps(`${open ? "Collapse" : "Expand"} (${keys})`)}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M9.5 4.5v15" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
        {open && <span className="rail-title">Your intros</span>}
      </div>
      <button type="button" className="rail-new" onClick={onNew} aria-label="New intro" {...tipProps("New intro")}>
        <span className="rail-plus" aria-hidden>
          +
        </span>
        {open && <span>New intro</span>}
      </button>
      {open && intros.length > 6 && (
        <input className="input rail-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search intros" aria-label="Search your intros" />
      )}
      <ul className="rail-list">
        {shown.map((x) => {
          const on = x.key === current;
          const editing = renaming?.key === x.key;
          return (
            <li key={x.key} className={`rail-row${menu?.intro.key === x.key ? " menu-open" : ""}`}>
              {editing ? (
                <div className={`rail-item rail-editing${on ? " current" : ""}`}>
                  <span className="rail-icon" style={{ background: x.thumb ? undefined : x.color }} aria-hidden>
                    {x.thumb ? <img src={x.thumb} alt="" /> : (x.title.trim()[0] ?? "•").toUpperCase()}
                  </span>
                  <input
                    className="rail-rename"
                    autoFocus
                    value={renaming.value}
                    maxLength={80}
                    aria-label="Intro name"
                    onChange={(e) => setRenaming({ key: x.key, value: e.target.value })}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") finishRename(true);
                      if (e.key === "Escape") finishRename(false);
                    }}
                    onBlur={() => finishRename(true)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className={`rail-item${on ? " current" : ""}`}
                  onClick={() => onOpen(x)}
                  onContextMenu={(e) => {
                    if (!actions) return;
                    e.preventDefault();
                    openMenu(x, { top: e.clientY, left: e.clientX });
                  }}
                  aria-current={on ? "page" : undefined}
                  aria-label={open ? undefined : x.title}
                  {...tipProps(x.title)}
                >
                  <span className="rail-icon" style={{ background: x.thumb ? undefined : x.color }} aria-hidden>
                    {x.thumb ? <img src={x.thumb} alt="" /> : (x.title.trim()[0] ?? "•").toUpperCase()}
                  </span>
                  {open && (
                    <span className="rail-text">
                      <span className="rail-name">{x.title}</span>
                      <small>{ago(x.updatedAt)}</small>
                    </span>
                  )}
                </button>
              )}
              {open && actions && !editing && (
                <button
                  type="button"
                  className="rail-more"
                  aria-label={`More for ${x.title}`}
                  aria-haspopup="menu"
                  aria-expanded={menu?.intro.key === x.key}
                  onClick={(e) => {
                    if (menu?.intro.key === x.key) return setMenu(null);
                    const r = e.currentTarget.getBoundingClientRect();
                    openMenu(x, { top: r.bottom + 4, left: r.right - 168 });
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                    <circle cx="5" cy="12" r="1.8" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                    <circle cx="19" cy="12" r="1.8" fill="currentColor" />
                  </svg>
                </button>
              )}
            </li>
          );
        })}
        {open && !intros.length && <li className="rail-empty">Your intros appear here as you make them.</li>}
        {open && intros.length > 0 && !shown.length && <li className="rail-empty">No intros match “{q}”.</li>}
      </ul>
      {open && note && <p className="rail-note">{note}</p>}
      <a className="rail-all" href={allHref} aria-label={open ? undefined : "All intros"} {...tipProps("All intros")}>
        <Icon name="Layers" size={16} />
        {open && <span>All intros</span>}
      </a>
      {menu && (
        <div ref={menuRef} className="rail-menu" role="menu" aria-label={menu.intro.title} style={{ top: menu.top, left: Math.max(8, menu.left) }}>
          {menu.confirm ? (
            <>
              <p className="rail-confirm">
                Delete <b>{menu.intro.title}</b>? {menu.intro.key.startsWith("a:") ? "It's removed from your account." : "It's removed from this browser."} This can't be undone.
              </p>
              <div className="rail-confirm-row">
                <button type="button" role="menuitem" className="rail-menu-item" onClick={() => setMenu(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="rail-menu-item danger"
                  onClick={() => {
                    const x = menu.intro;
                    setMenu(null);
                    onDelete?.(x);
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          ) : (
            <>
              {onRename && (
                <button
                  type="button"
                  role="menuitem"
                  className="rail-menu-item"
                  onClick={() => {
                    if (!open) toggle();
                    setRenaming({ key: menu.intro.key, value: menu.intro.title });
                    setMenu(null);
                  }}
                >
                  <Icon name="Pencil" size={15} /> Rename
                </button>
              )}
              {onDuplicate && (
                <button
                  type="button"
                  role="menuitem"
                  className="rail-menu-item"
                  onClick={() => {
                    const x = menu.intro;
                    setMenu(null);
                    onDuplicate(x);
                  }}
                >
                  <Icon name="Copy" size={15} /> Duplicate
                </button>
              )}
              {onDelete && (
                <button type="button" role="menuitem" className="rail-menu-item danger" onClick={() => setMenu({ ...menu, confirm: true })}>
                  <Icon name="Trash2" size={15} /> Delete
                </button>
              )}
            </>
          )}
        </div>
      )}
      {tip && (
        <span className="rail-tip" role="tooltip" style={{ top: tip.top, left: tip.left }}>
          {tip.text}
        </span>
      )}
    </nav>
  );
}
