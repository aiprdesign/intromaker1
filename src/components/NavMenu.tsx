"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS: [string, string][] = [
  ["/#product", "Product videos"],
  ["/showcase", "Showcase"],
  ["/skills", "Skills"],
  ["/characters", "Characters"],
  ["/#how", "How it works"],
  ["/#pricing", "Pricing"],
  ["/account", "My intros"],
];

/**
 * The site's links: a row on wide screens, a menu behind a button on phones (closed again by a
 * link, Escape or a new page). The page you're on is marked.
 */
export default function NavMenu({ cta }: { cta: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <nav id="site-menu" className={`nav-links${open ? " open" : ""}`} aria-label="Main">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} aria-current={!href.includes("#") && path === href ? "page" : undefined} onClick={() => setOpen(false)}>
            {label}
          </Link>
        ))}
      </nav>
      {cta && (
        <Link href="/studio" className="btn btn-primary nav-cta">
          Try it free
        </Link>
      )}
      <button type="button" className="nav-menu-btn" aria-expanded={open} aria-controls="site-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        </svg>
      </button>
    </>
  );
}
