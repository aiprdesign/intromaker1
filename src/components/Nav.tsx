import Link from "next/link";
import { useId } from "react";
import NavMenu from "./NavMenu";

export function Logo() {
  // (Each logo has its own gradient id: the header and footer both draw one.)
  const gid = `lg${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Link href="/" className="logo">
      <span className="logo-mark" aria-hidden>
        <svg viewBox="0 0 32 32" width="26" height="26">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#00f0ff" />
              <stop offset="1" stopColor="#ff2bd6" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="28" height="28" rx="8" fill={`url(#${gid})`} />
          <path d="M12 9.5v13l10.5-6.5z" fill="#05030d" />
        </svg>
      </span>
      Prodintro.com
    </Link>
  );
}

export default function Nav({ cta = true }: { cta?: boolean }) {
  return (
    <header className="nav">
      <Logo />
      <NavMenu cta={cta} />
    </header>
  );
}
