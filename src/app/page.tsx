import Link from "next/link";
import HeroPrompt from "@/components/HeroPrompt";
import LoopCanvas from "@/components/LoopCanvas";
import PricingCards from "@/components/PricingCards";
import SampleFilms from "@/components/SampleFilms";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import TermsLink from "@/components/TermsLink";
import SkillGrid from "@/components/SkillGrid";
import { HOME_BACKDROP } from "@/engine/demos";

const STEPS = [
  {
    n: "01",
    title: "Enter your URL",
    body: "Paste your website and we'll import your logo, product shots, UI, copy and colours. Selling a product? Paste its Amazon, eBay, Etsy or Shopify listing, or upload photos. No website yet? Describe your product instead.",
  },
  {
    n: "02",
    title: "AI Director",
    body: "The director storyboards a hook, title reveal, feature beats and outro — picking skills, palette, type and tempo.",
  },
  {
    n: "03",
    title: "Tweak & export",
    body: "Edit any scene’s text, skill or timing live, then export a 1080p or 4K video with a generated soundtrack.",
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
          {/* The headline follows the chosen tab (launch film, or product video). */}
          <HeroPrompt />
        </div>
      </section>

      <section className="section" id="samples">
        <div className="section-head">
          <span className="eyebrow">Sample videos</span>
          <h2>See what it makes.</h2>
          <p>A SaaS launch, a speed promo, a product video and a trailer for imaginary brands, built from the slides that suit them. They play live in your browser, frame for frame what you export.</p>
        </div>
        <SampleFilms />
      </section>

      <section className="section" id="skills">
        <div className="section-head">
          <span className="eyebrow">The skill library</span>
          <h2>215 motion skills, rendered live.</h2>
          <p>The cards below are real-time output of the engine: the same frames you export.</p>
        </div>
        <SkillGrid limit={9} swipe />
        <div className="center">
          <Link href="/skills" className="btn btn-ghost btn-lg">
            See the 215 skills →
          </Link>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>From idea to export, in three steps.</h2>
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
        <PricingCards />
      </section>

      <section className="section cta-band">
        <h2>Your next intro is one prompt away.</h2>
        <Link href="/studio" className="btn btn-primary btn-lg">
          Try it free
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
