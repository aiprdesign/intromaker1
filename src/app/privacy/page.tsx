import type { Metadata } from "next";
import Link from "next/link";
import Nav, { Logo } from "@/components/Nav";
import { adminEnabled } from "@/lib/admin";
import { CAPTURE_STORAGE } from "@/lib/storage";

// Whether this server keeps a log of films depends on its settings, read at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy · IntroMaker",
  description: "What IntroMaker does with the websites you import, your API keys and your videos.",
};

/** Plain-language privacy note for the hosted demo. Kept in step with what the code does. */
export default function Privacy() {
  const logging = adminEnabled();
  return (
    <main>
      <Nav />
      <article className="legal">
        <h1>Privacy</h1>
        <p className="lead">
          IntroMaker is a portfolio project. Accounts are optional, and there are no tracking cookies and no analytics. Here is exactly what happens to what you give it.
        </p>

        <h2>Your videos</h2>
        <p>
          Videos are rendered on your own computer and not uploaded. Your work in progress is saved in your browser so a reload doesn&apos;t lose it. A share
          link carries the storyboard after the <code>#</code> in the address, which browsers don&apos;t send to the server.
        </p>
        {logging ? (
          <p>
            <strong>This site keeps a log of the videos made on it</strong>, which its owner can review: the prompt or website address, the storyboard (the text on the slides and the styles used) and when it was made, for new videos, remakes and exports. Without an account you appear in it only as an anonymous code
            (a salted hash of your address), not by your address itself. If you&apos;re signed in to an account, the entry is also linked to your
            account&apos;s email, so the owner can see the intros an account made; deleting your account removes that link. The video file is not
            included. Don&apos;t put anything private in a prompt.
          </p>
        ) : (
          <p>This site doesn&apos;t keep a log of the videos made on it: storyboards and edits stay in your browser.</p>
        )}

        <h2>Accounts</h2>
        <p>
          An account is optional. If you create one, the server keeps your email address, your password as a salted scrypt hash (not the password itself),
          your plan, how many AI videos and website imports you&apos;ve used this month and today, and the intros you save (their storyboards and a small
          thumbnail). Signing in sets one cookie, which keeps you signed in for 30 days; there are no tracking cookies. You can delete your account and your saved intros at any time from your account page.
        </p>
        <p>
          If you pay for Pro, payment happens on Stripe&apos;s own pages: your card details go to Stripe, not to this server. Stripe tells the server that you
          paid, and the server keeps your Stripe customer and subscription ids and the subscription&apos;s status, so your plan follows your subscription.
          Stripe&apos;s own privacy policy covers what it keeps.
        </p>

        <h2>Websites you import</h2>
        <p>
          The server opens the public page you enter in a headless browser, reads its text and takes screenshots of it, its UI components and its logo.{" "}
          {CAPTURE_STORAGE === "browser"
            ? "The screenshots aren't written to the server's disk: it holds them in memory only while your video is being made (up to 30 minutes), and your browser keeps its own copy."
            : "The screenshots are stored on the server so the studio, share links and saved intros can show them, and are deleted automatically after 7 days. Your browser also keeps its own copy."}{" "}
          The site&apos;s own images and videos are passed through to your browser and not stored. Only public addresses can be imported: private and internal
          networks are refused. Please import only sites you have the right to use.
        </p>

        <h2>Product listings and photos</h2>
        <p>
          A marketplace listing (Amazon, eBay, Etsy, a Shopify store…) is read like a website: its title, bullet points and photo addresses. Its photos are
          passed through to your browser and not stored; prices, ratings and reviews are not used. Product photos you add are resized and re-saved as plain
          JPEGs in your browser first (so camera details such as location are dropped), then{" "}
          {CAPTURE_STORAGE === "browser"
            ? "held in the server's memory only while your video is being made (up to 30 minutes)."
            : "stored on the server like website screenshots and deleted automatically after 7 days."}{" "}
          Please use only listings and photos you have the right to use, such as your own.
        </p>

        <h2>API keys</h2>
        <p>
          Keys you enter (AI providers, cloud voices) are saved in your browser&apos;s local storage, not on the server. They are sent with the requests that need them, passed straight to that provider, and not stored or written to logs (error messages have keys removed). Use a key with a spending limit,
          and remove it any time from the AI settings. The demo&apos;s own AI key, when one is set, has a daily budget; after it, the built-in director is used.
        </p>

        <h2>AI and voice providers</h2>
        <p>
          When you choose an AI director or a cloud voice, your prompt, the imported site&apos;s text and screenshots (for AI) or the narration text (for voice)
          go to that provider under its own terms. The built-in director and the free on-device voice don&apos;t send your data out; the voice model is downloaded
          once from public CDNs (jsDelivr, Hugging Face).
        </p>

        <h2>What the server keeps</h2>
        <ul>
          {CAPTURE_STORAGE === "browser" ? (
            <li>Screenshots of imported sites, in memory only, for up to 30 minutes; not on disk.</li>
          ) : (
            <li>Screenshots of imported sites, for 7 days.</li>
          )}
          <li>Your IP address, in memory only and for at most 24 hours, to apply rate limits and to block signing in from an address after 3 wrong passwords (for an hour). It isn&apos;t written to disk.</li>
          <li>Error logs, which can include the address of a site that failed to load.</li>
          {logging && <li>The video log described above, up to the most recent few thousand videos, until the owner deletes it.</li>}
          <li>If you have an account: your email, password hash, plan, usage counts and saved intros, until you delete the account.</li>
        </ul>

        <h2>Claims in generated copy</h2>
        <p>
          By default the copy is screened to stay generic, and health or medical claims are removed. This is automated screening, not legal advice:
          review your video before publishing it.
        </p>

        <p className="back">
          <Link href="/studio" className="btn btn-primary">
            Try for Free!
          </Link>
        </p>
      </article>
      <footer className="footer">
        <Logo />
        <span>
          © {new Date().getFullYear()} IntroMaker · <Link href="/privacy">Privacy</Link> · <Link href="/license">Licence</Link> · <Link href="/licenses">Open-source licences</Link>
        </span>
      </footer>
    </main>
  );
}
