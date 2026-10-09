import Link from "next/link";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import ShowcaseGallery from "./ShowcaseGallery";

export const metadata = {
  title: "Showcase · Prodintro.com",
  description: "Intros made from short written briefs for made-up apps, shops, studios and firms: 3D devices and homes, cartoon characters, liquid, sci-fi and editorial styles. They play live in your browser.",
};

export default function ShowcasePage() {
  return (
    <main>
      <Nav />
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Showcase</span>
          <h1 className="section-h1">One brief in, a finished intro out.</h1>
          <p>
            The intros below were made from short written briefs for made-up businesses: their name, tagline, features, tone and button. They play live in your browser, frame for frame what you export. Open one to edit it, or roll your own.
          </p>
          <div className="show-actions">
            <Link href="/studio?random=1" className="btn btn-primary">
              🎲 Make a random intro
            </Link>
            <Link href="/studio" className="btn btn-ghost">
              Write your own brief
            </Link>
          </div>
        </div>
        <ShowcaseGallery />
      </section>
      <SiteFooter />
    </main>
  );
}
