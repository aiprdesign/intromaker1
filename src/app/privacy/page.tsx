import type { Metadata } from "next";
import Link from "next/link";
import Nav, { Logo } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Privacy · IntroMaker",
  description: "What IntroMaker does with the websites you import, your API keys and your videos.",
};

/** Plain-language privacy note for the hosted demo. Kept in step with what the code does. */
export default function Privacy() {
  return (
    <main>
      <Nav />
      <article className="legal">
        <h1>Privacy</h1>
        <p className="lead">
          IntroMaker is a portfolio project. There are no accounts, no cookies and no analytics. Here is exactly what happens to what you give it.
        </p>

        <h2>Your videos</h2>
        <p>
          Storyboards, edits and exports stay in your browser. Videos are rendered on your own computer and never uploaded. A share link carries the storyboard
          after the <code>#</code> in the address, which browsers don&apos;t send to the server.
        </p>

        <h2>Websites you import</h2>
        <p>
          The server opens the public page you enter in a headless browser, reads its text and takes screenshots of it, its UI components and its logo. The
          screenshots are stored on the server so the studio can show them, and are deleted automatically after 7 days. Only public addresses can be imported:
          private and internal networks are refused. Please import only sites you have the right to use.
        </p>

        <h2>API keys</h2>
        <p>
          Keys you enter (AI providers, cloud voices) are saved in your browser&apos;s local storage, not on the server. They are sent with each request that
          needs them, passed straight to that provider, and never stored or written to logs (error messages have keys removed). Use a key with a spending limit,
          and remove it any time from the AI settings. The demo&apos;s own AI key, when one is set, has a daily budget; after it, the built-in director is used.
        </p>

        <h2>AI and voice providers</h2>
        <p>
          When you choose an AI director or a cloud voice, your prompt, the imported site&apos;s text and screenshots (for AI) or the narration text (for voice)
          go to that provider under its own terms. The built-in director and the free on-device voice send nothing anywhere; the voice model is downloaded
          once from public CDNs (jsDelivr, Hugging Face).
        </p>

        <h2>What the server keeps</h2>
        <ul>
          <li>Screenshots of imported sites, for 7 days.</li>
          <li>Your IP address, in memory only and for at most 24 hours, to apply rate limits. It is never written to disk.</li>
          <li>Error logs, which can include the address of a site that failed to load.</li>
        </ul>

        <h2>Claims in generated copy</h2>
        <p>
          By default the copy is screened to stay generic, and health or medical claims are always removed. This is automated screening, not legal advice:
          review your video before publishing it.
        </p>

        <p className="back">
          <Link href="/studio" className="btn btn-primary">
            Open the studio
          </Link>
        </p>
      </article>
      <footer className="footer">
        <Logo />
        <span>
          © {new Date().getFullYear()} IntroMaker · <Link href="/privacy">Privacy</Link> · <Link href="/licenses">Licences</Link>
        </span>
      </footer>
    </main>
  );
}
