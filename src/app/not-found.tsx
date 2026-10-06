import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Page not found · Prodintro.com" };

/** A missing page, in the site's own look, with the ways back. */
export default function NotFound() {
  return (
    <main>
      <Nav />
      <article className="legal not-found">
        <h1>This page isn&apos;t here</h1>
        <p className="lead">The link may be old or mistyped. Start a video in the studio, or head back to the home page.</p>
        <p className="not-found-actions">
          <Link href="/studio" className="btn btn-primary">
            Open the studio
          </Link>
          <Link href="/" className="btn btn-ghost">
            Home page
          </Link>
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}
