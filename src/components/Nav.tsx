import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="logo">
      <span className="logo-mark" aria-hidden>
        <svg viewBox="0 0 32 32" width="26" height="26">
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#00f0ff" />
              <stop offset="1" stopColor="#ff2bd6" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#lg)" />
          <path d="M12 9.5v13l10.5-6.5z" fill="#05030d" />
        </svg>
      </span>
      IntroMaker
    </Link>
  );
}

export default function Nav({ cta = true }: { cta?: boolean }) {
  return (
    <header className="nav">
      <Logo />
      <nav className="nav-links">
        <Link href="/skills">Skills</Link>
        <Link href="/#how">How it works</Link>
        <Link href="/#pricing">Pricing</Link>
        <Link href="/account">My intros</Link>
      </nav>
      {cta && (
        <Link href="/studio" className="btn btn-primary">
          Open Studio
        </Link>
      )}
    </header>
  );
}
