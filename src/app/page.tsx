import Link from "next/link";
import HeroPrompt from "@/components/HeroPrompt";
import LoopCanvas from "@/components/LoopCanvas";
import Nav, { Logo } from "@/components/Nav";
import SkillGrid from "@/components/SkillGrid";
import { HERO_PLAN } from "@/engine/demos";

const STEPS = [
  {
    n: "01",
    title: "Prompt or paste a URL",
    body: "Describe the vibe, brand, claims and numbers — or paste your website and we'll import your logo, product shots, video, copy and colours.",
  },
  {
    n: "02",
    title: "AI Director",
    body: "The director storyboards a hook, title reveal, feature beats and outro — picking skills, palette, type and tempo.",
  },
  {
    n: "03",
    title: "Tweak & export",
    body: "Edit any scene’s text, skill or timing live, then export 1080p video with a generated trailer soundtrack.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["All 44 motion skills", "Built-in director", "720p & 1080p export", "Generated soundtrack"],
    cta: "Start creating",
  },
  {
    name: "Pro",
    price: "$19",
    period: "/ month",
    featured: true,
    features: ["Everything in Free", "Claude AI Director", "Unlimited remixes", "Vertical & square formats", "Priority new skills"],
    cta: "Go Pro",
  },
  {
    name: "Studio",
    price: "$49",
    period: "/ month",
    features: ["Everything in Pro", "Brand kits & custom palettes", "Team workspaces", "Commercial license"],
    cta: "Contact sales",
  },
];

export default function Home() {
  return (
    <main>
      <Nav />
      <section className="hero">
        <div className="hero-bg" aria-hidden>
          <LoopCanvas plan={HERO_PLAN} long={1280} fps={60} className="hero-canvas" />
          <div className="hero-fade" />
        </div>
        <div className="hero-content">
          <span className="eyebrow">✦ Prompt → Motion Graphics</span>
          <h1>
            Epic motion graphics
            <br />
            <span className="grad">from a single prompt.</span>
          </h1>
          <p className="lede">
            IntroMaker turns a prompt, or your website, into a product launch film or an epic trailer. Paste a URL and it pulls
            your logo, screenshots, video, copy, testimonials and brand colours into a beat-synced video with a cursor-driven
            product tour, bento features and a clicked CTA.
          </p>
          <HeroPrompt />
        </div>
      </section>

      <section className="section" id="skills">
        <div className="section-head">
          <span className="eyebrow">The skill library</span>
          <h2>33 pro motion skills. All rendered live.</h2>
          <p>Every card below is real-time output of the engine — the same frames you export.</p>
        </div>
        <SkillGrid limit={9} />
        <div className="center">
          <Link href="/skills" className="btn btn-ghost btn-lg">
            See all 44 skills →
          </Link>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>From idea to export in under a minute.</h2>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.n}>
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="section-head">
          <span className="eyebrow">Pricing</span>
          <h2>Start free. Go epic.</h2>
        </div>
        <div className="pricing">
          {PLANS.map((p) => (
            <div className={`price-card ${p.featured ? "featured" : ""}`} key={p.name}>
              {p.featured && <span className="badge">Most popular</span>}
              <h3>{p.name}</h3>
              <div className="price">
                {p.price}
                <small>{p.period}</small>
              </div>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link href="/studio" className={`btn ${p.featured ? "btn-primary" : "btn-ghost"}`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="section cta-band">
        <h2>Your next intro is one prompt away.</h2>
        <Link href="/studio" className="btn btn-primary btn-lg">
          Open the Studio ✦
        </Link>
      </section>

      <footer className="footer">
        <Logo />
        <span>
          © {new Date().getFullYear()} IntroMaker. Rendered in your browser. · <Link href="/privacy">Privacy</Link>
        </span>
      </footer>
    </main>
  );
}
