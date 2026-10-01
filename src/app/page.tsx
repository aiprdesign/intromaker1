import Link from "next/link";
import HeroPrompt from "@/components/HeroPrompt";
import LoopCanvas from "@/components/LoopCanvas";
import PricingCards from "@/components/PricingCards";
import Nav, { Logo } from "@/components/Nav";
import SkillGrid from "@/components/SkillGrid";
import { HOME_BACKDROP } from "@/engine/demos";

const STEPS = [
  {
    n: "01",
    title: "Enter your URL",
    body: "Paste your website and we'll import your logo, product shots, UI, copy and colours. No website yet? Describe your product instead.",
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


export default function Home() {
  return (
    <main>
      <Nav />
      <section className="hero">
        <div className="hero-bg" aria-hidden>
          <LoopCanvas plan={HOME_BACKDROP} long={1280} fps={60} className="hero-canvas" />
          <div className="hero-fade" />
        </div>
        <div className="hero-content">
          <span className="eyebrow">✦ SaaS video from your URL</span>
          <h1>
            SaaS launch videos,
            <br />
            <span className="grad">from your URL.</span>
          </h1>
          <p className="lede">
            Enter your website below. IntroMaker reads your logo, brand colours, screenshots, UI and copy, picks the scenes that suit your
            product, and directs a beat-synced launch film you can edit and export in 1080p.
          </p>
          <HeroPrompt />
        </div>
      </section>

      <section className="section" id="skills">
        <div className="section-head">
          <span className="eyebrow">The skill library</span>
          <h2>60 pro motion skills. All rendered live.</h2>
          <p>Every card below is real-time output of the engine — the same frames you export.</p>
        </div>
        <SkillGrid limit={9} />
        <div className="center">
          <Link href="/skills" className="btn btn-ghost btn-lg">
            See all 60 skills →
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
        <PricingCards />
      </section>

      <section className="section cta-band">
        <h2>Your next intro is one prompt away.</h2>
        <Link href="/studio" className="btn btn-primary btn-lg">
          Try for Free!
        </Link>
      </section>

      <footer className="footer">
        <Logo />
        <span>
          © {new Date().getFullYear()} IntroMaker. Rendered in your browser. · <Link href="/privacy">Privacy</Link> · <Link href="/licenses">Open-source licences</Link>
        </span>
      </footer>
    </main>
  );
}
