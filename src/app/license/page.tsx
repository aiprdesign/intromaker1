import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import TermsLink from "@/components/TermsLink";
import { planLimits, readSettings } from "@/lib/admin";

// The contact address is the site owner's setting, read at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Licence · Prodintro.com",
  description: "Sign up free and export videos you can use for your business. For more, contact us for a commercial licence.",
};

/** The terms in plain language: a free account's videos may be used commercially; more on a licence; the code is proprietary. */
export default async function License() {
  const contact = (await readSettings().catch(() => null))?.contactEmail;
  const mail = contact ? `mailto:${contact}?subject=${encodeURIComponent("Prodintro.com commercial licence")}` : null;
  const free = (await planLimits().catch(() => null))?.free.exports ?? 3;
  const limited = free < 100_000;
  return (
    <main>
      <Nav />
      <article className="legal">
        <h1>Licence</h1>
        <p className="lead">
          {limited
            ? `Sign up free and export ${free} video${free === 1 ? "" : "s"}, yours to use for personal or commercial purposes. For more, contact us for a commercial licence.`
            : "Prodintro.com is a portfolio project. It is free and unlimited to use, for now, for personal and non-commercial purposes; commercial use needs a licence."}
        </p>

        {limited ? (
          <>
            <h2>Free account: {free} video{free === 1 ? "" : "s"}, commercial use included</h2>
            <p>
              Create a free account (your email, first name and country) and export up to {free} video{free === 1 ? "" : "s"}. Use them for your business, your
              clients, your website, ads and social media, as well as personal projects. You can make and preview as many videos as you like; the count is of
              exports. Rate limits that protect the service from abuse still apply.
            </p>
          </>
        ) : (
          <>
            <h2>Free: personal and non-commercial use</h2>
            <p>
              Make as many videos as you like, with the styles, skills and export sizes, for personal projects, study, hobbies, and charities, schools,
              research and public bodies. Rate limits that protect the service from abuse still apply.
            </p>
          </>
        )}

        <h2>Commercial use: contact us</h2>
        <p>
          {limited ? "More videos for a business, for clients or in an agency need a commercial licence." : "Using Prodintro.com for a business, for clients or in an agency needs a commercial licence."} {mail ? <a href={mail}>Contact us at {contact}</a> : "Contact the site owner"} and tell us how you&apos;d like to use it.
        </p>

        <h2>The source code</h2>
        <p>
          Prodintro.com is proprietary software: its code is not open source, and all rights are reserved. It may not be copied, changed, shared, hosted
          or run without our written permission. The third-party components it&apos;s built on keep their own licences: see{" "}
          <Link href="/licenses">third-party licences</Link>.
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
