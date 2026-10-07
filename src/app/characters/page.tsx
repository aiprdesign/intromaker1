import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import CharacterLab from "./CharacterLab";

export const metadata = {
  title: "Character designer · Prodintro.com",
  description: "Design simple, modern abstract characters: body, head, hair, face, colours and proportions. Shuffle for ideas, download PNGs, and star them in your videos.",
};

export default function CharactersPage() {
  return (
    <main>
      <Nav />
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Character designer</span>
          <h1 className="section-h1">Design your own abstract characters.</h1>
          <p>Pick a body, head, hair and face, set the colours and proportions, or shuffle for ideas. Download them as PNGs, or star them in a video.</p>
        </div>
        <CharacterLab />
      </section>
      <SiteFooter />
    </main>
  );
}
