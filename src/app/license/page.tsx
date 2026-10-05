import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import TermsLink from "@/components/TermsLink";
import { readSettings } from "@/lib/admin";

// The contact address is the site owner's setting, read at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Licence · Prodintro.com",
  description: "Prodintro.com is free and unlimited for personal and non-commercial use. Commercial use needs a licence: contact us.",
};

/** The terms in plain language: free for non-commercial use, a commercial licence on request. */
export default async function License() {
  const contact = (await readSettings().catch(() => null))?.contactEmail;
  const mail = contact ? `mailto:${contact}?subject=${encodeURIComponent("Prodintro.com commercial licence")}` : null;
  return (
    <main>
      <Nav />
      <article className="legal">
        <h1>Licence</h1>
        <p className="lead">Prodintro.com is a portfolio project. It is free and unlimited to use, for now, for personal and non-commercial purposes; commercial use needs a licence.</p>

        <h2>Free: personal and non-commercial use</h2>
        <p>
          Make as many videos as you like, with the styles, skills and export sizes, for personal projects, study, hobbies, and charities, schools,
          research and public bodies. Rate limits that protect the service from abuse still apply.
        </p>

        <h2>Commercial use: contact us</h2>
        <p>
          Using Prodintro.com for a business, for clients, in an agency, or running its code on your own servers or inside a product you sell needs a commercial
          licence. {mail ? <a href={mail}>Contact us at {contact}</a> : "Contact the site owner"} and tell us how you&apos;d like to use it.
        </p>

        <h2>The source code</h2>
        <p>
          Prodintro.com&apos;s own code is released under the{" "}
          <a href="https://polyformproject.org/licenses/noncommercial/1.0.0" target="_blank" rel="noopener">
            PolyForm Noncommercial License 1.0.0
          </a>
          : you may use, change and share it for any non-commercial purpose; commercial use needs a separate licence from us. Versions published earlier
          under the MIT licence stay available under MIT. The open-source components it uses keep their own licences: see{" "}
          <Link href="/licenses">open-source licences</Link>.
        </p>

        <p>
          <Link href="/studio" className="btn btn-primary">
            Start making videos
          </Link>
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}
