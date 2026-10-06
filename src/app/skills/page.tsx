import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import SkillGrid from "@/components/SkillGrid";

export const metadata = { title: "Motion skills · Prodintro.com" };

export default function SkillsPage() {
  return (
    <main>
      <Nav />
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Skill showcase</span>
          <h1 className="section-h1">Effects and palettes, side by side.</h1>
          <p>Switch palettes to see the skills re-skin instantly. Pick one to start a project with it.</p>
        </div>
        <SkillGrid pickers />
      </section>
      <SiteFooter />
    </main>
  );
}
