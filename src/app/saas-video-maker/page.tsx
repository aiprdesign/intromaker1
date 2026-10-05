import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import { SITE_URL_ENV } from "@/lib/site";

const TITLE = "SaaS video maker: intro, launch and product videos from a URL · Prodintro.com";
const DESCRIPTION =
  "Turn your website URL into a SaaS intro video. Prodintro.com imports your logo, UI, copy and colours, and its AI director cuts a product intro, launch or demo video with a 3D logo reveal, a soundtrack and voice-over, ready for your site, Reels, TikTok and Shorts.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "SaaS video maker",
    "SaaS intro video",
    "SaaS launch video",
    "SaaS explainer video",
    "product intro video",
    "product demo video",
    "product launch video",
    "URL to video",
    "website to video",
    "AI video generator",
    "app promo video",
    "3D logo intro",
    "logo animation",
    "motion graphics",
    "startup video",
    "Product Hunt launch video",
  ],
  // The canonical address only when the public address is known (INTROMAKER_SITE_URL).
  ...(SITE_URL_ENV ? { alternates: { canonical: "/saas-video-maker" } } : {}),
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "Prodintro.com", ...(SITE_URL_ENV ? { url: "/saas-video-maker" } : {}) },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I turn a URL into a video?",
    a: "Paste your website address on the homepage and press Import. Prodintro.com opens the public page, reads its headline, features and calls to action, captures your logo, UI and colours, and the director storyboards a SaaS intro video from them. You can edit the result in the studio and export it.",
  },
  {
    q: "What is a SaaS intro video?",
    a: "A short video, usually 15 to 60 seconds, that introduces a software product: a hook, the brand reveal, the product in action, the main features and a call to action. It sits on a landing page hero, in a launch post or before a demo.",
  },
  {
    q: "What's the difference between a product intro video and a demo video?",
    a: "A product intro video tells people what the product is and why it matters, in under a minute. A product demo video walks through how it works. Prodintro.com's SaaS style mixes the two: intro beats for the story, and demo moments (a command palette, an AI prompt, a click flow, a kanban board) for the product in action.",
  },
  {
    q: "Can I make a vertical video for Reels, TikTok and Shorts?",
    a: "Yes. Switch the format to 9:16 (or 1:1 for feeds) and the layout reflows for it. Exports are 1080p.",
  },
  {
    q: "Do I need a logo?",
    a: "No. With a logo, the 3D logo intros extrude your own mark. Without one, they use your site's app icon, or a generated brand mark in your colours.",
  },
  {
    q: "Can I add a voice-over and music?",
    a: "A soundtrack is generated for the video, with the drop timed to the logo reveal. Turn on Voice-over and the director writes a narrator line for the scenes, with word-by-word captions.",
  },
  {
    q: "Which websites can I import?",
    a: "Public websites you have the right to use, such as your own product's site. Private and internal addresses are refused.",
  },
];

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "saas-intro",
    title: "SaaS intro videos",
    body: (
      <>
        <p>
          A SaaS intro video has one job: to tell a visitor what your software does before they scroll away. Prodintro.com builds it the way launch teams do. It
          opens on a hook taken from your own headline or the problem you solve, reveals the brand on the music&apos;s drop, shows the product in action,
          lays out the features and ends on your call to action.
        </p>
        <p>
          Pick from 45 SaaS styles, from dark developer-tool grids to light keynote stages, 3D glass and cinematic launches. The director picks the slides,
          palette, typeface and tempo for your product, and you can change any of them.
        </p>
      </>
    ),
  },
  {
    id: "product-intro",
    title: "Product intro videos",
    body: (
      <>
        <p>
          A product intro video introduces what you&apos;ve built in under a minute. Prodintro.com writes it from the product&apos;s own words: your feature
          names become bento tiles and feature cards with matching icons, your screenshots become a zoom tour with callouts, and your tagline sits under
          the logo.
        </p>
        <p>
          No website yet? Describe the product in a sentence (&quot;a project management app for remote teams with tasks, docs and chat&quot;) and the
          director picks the icons, cards and moments that fit it.
        </p>
      </>
    ),
  },
  {
    id: "url-to-video",
    title: "URL to video: turn your website into a video",
    body: (
      <>
        <p>Paste a URL and Prodintro.com reads the page the way a visitor would:</p>
        <ul>
          <li>your logo, captured at the sharpest size the site offers, and your brand colours;</li>
          <li>your headline, tagline, features and call to action;</li>
          <li>screenshots of the hero and the page, split into their real sections and UI components;</li>
          <li>your product images and videos, where the site has them.</li>
        </ul>
        <p>
          Cookie banners, chat widgets and pop-ups are removed from the captures. The UI Assemble slide then rebuilds your product from its own components
          on screen, and the website scroll slide tours the page.
        </p>
      </>
    ),
  },
  {
    id: "launch",
    title: "SaaS launch videos",
    body: (
      <p>
        For a launch day post, a Product Hunt page or a changelog, the launch slides show what&apos;s new: a changelog that writes itself, keycaps for a
        shortcut, a spotlight callout on the new feature, toggles switching on, an exploded view of the UI and a device trio showing the product on desktop,
        tablet and phone. The soundtrack builds to a drop exactly as the logo lands, and the final chord hits on the CTA button&apos;s click.
      </p>
    ),
  },
  {
    id: "demo",
    title: "Product demo videos",
    body: (
      <p>
        Demo moments show the product doing its job, animated in your colours: a command palette searching and running an action, an AI prompt answering,
        a one-click flow, a notification stack, code going to deploy, a kanban card moving across, live cursors working together, a chat thread, the app on a phone and a file dropped in
        with its results popping out. The director picks the moment that fits your product from its own copy, and adds a who-it&apos;s-for slide when
        your site names the teams it serves.
      </p>
    ),
  },
  {
    id: "explainer",
    title: "Explainer videos",
    body: (
      <p>
        An explainer video walks through the problem, the answer and how it works. The pain → solution and problem → solution slides set up the problem in
        your customers&apos; words, the how-it-works slide takes them through the steps, and voice-over narrates it with captions that read with the
        sound off.
      </p>
    ),
  },
  {
    id: "app-promo",
    title: "App promo videos",
    body: (
      <p>
        For a mobile or desktop app, the app icon is captured from the site, the device slides frame the screens, and the end card can carry a QR code to
        the download page for a talk, booth or big screen.
      </p>
    ),
  },
  {
    id: "logo-intro",
    title: "3D logo intros",
    body: (
      <p>
        The brand reveal is the moment of the video, so it gets its own section of eight 3D logo animations. Your logo becomes a solid object with depth, a
        floor reflection and a sweep of light: it can snap into a 3D block, spin like a coin, assemble from shards, rise through a reflective floor under a
        spotlight, collapse from glass layers, sit inside orbiting rings, arrive down a fly-through tunnel or flip in strips. They land on the drop of
        the soundtrack. For a calmer brand there are eight clean, flat logo animations too: a line drawing itself on, a wipe into a lock-up with the name, a pop
        and burst, a dot morphing into the logo, slices, a dot grid, a typed lock-up and shapes collapsing into the mark. <Link href="/skills#3d-logo">See the 3D logo intros →</Link>
      </p>
    ),
  },
  {
    id: "social",
    title: "Videos for Reels, TikTok, Shorts and your landing page",
    body: (
      <p>
        One storyboard plays in three formats: 16:9 for your landing page, YouTube and demos, 9:16 for Reels, TikTok and Shorts, and 1:1 for feeds. The
        layout reflows for the format, with text kept inside title-safe areas. Export the format on screen as a 1080p video.
      </p>
    ),
  },
  {
    id: "product-listing",
    title: "Product videos from a listing",
    body: (
      <p>
        Selling a physical product? Paste an Amazon, eBay, Etsy, Walmart or Shopify product link, or upload your photos, and Prodintro.com makes a product video:
        the product on stage within the first second, its benefits as callouts around it, different angles and an end card. Use listings and photos you
        have the right to use.
      </p>
    ),
  },
];

export default function SaasVideoMaker() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Prodintro.com",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web browser",
      description: DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  return (
    <main>
      <Nav />
      <article className="legal seo-page">
        <span className="eyebrow">SaaS video maker</span>
        <h1>SaaS intro, launch and product videos from your URL</h1>
        <p className="lead">
          Paste your website and get a SaaS intro video built from your own logo, UI, copy and colours: a hook, a 3D logo reveal on the drop, the product
          in action, your features and your call to action. Edit it in the studio, then export it for your landing page, launch post, Reels, TikTok or
          Shorts.
        </p>
        <p className="seo-cta">
          <Link href="/studio" className="btn btn-primary btn-lg">
            Make a SaaS video
          </Link>
          <Link href="/#samples" className="btn btn-ghost btn-lg">
            See sample videos
          </Link>
        </p>

        <nav className="seo-toc" aria-label="On this page">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
          <a href="#faq">Questions</a>
        </nav>

        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id}>
            <h2>{s.title}</h2>
            {s.body}
          </section>
        ))}

        <section id="how">
          <h2>How to make a SaaS video</h2>
          <ol>
            <li>
              <strong>Paste your URL</strong> on the homepage, or describe your product if there&apos;s no website yet.
            </li>
            <li>
              <strong>Let the AI director storyboard it</strong>: hook, logo reveal, product, features and call to action, with a style, palette and tempo
              that suit it.
            </li>
            <li>
              <strong>Edit and export</strong>: change any slide&apos;s words, style, timing or transition, add voice-over, pick the format and export a
              1080p video.
            </li>
          </ol>
        </section>

        <section id="faq">
          <h2>Questions</h2>
          {FAQ.map((f) => (
            <details key={f.q} className="seo-faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        <p className="seo-cta">
          <Link href="/studio" className="btn btn-primary btn-lg">
            Make a SaaS video
          </Link>
        </p>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SiteFooter />
    </main>
  );
}
