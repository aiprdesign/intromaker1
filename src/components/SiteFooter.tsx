import Link from "next/link";
import { Logo } from "@/components/Nav";
import TermsLink from "@/components/TermsLink";

/** What people search for, linked to the part of the SaaS videos guide that answers it. */
const KEYWORDS: { label: string; href: string }[] = [
  { label: "SaaS video maker", href: "/saas-video-maker" },
  { label: "SaaS intro videos", href: "/saas-video-maker#saas-intro" },
  { label: "Product intro videos", href: "/saas-video-maker#product-intro" },
  { label: "URL to video", href: "/saas-video-maker#url-to-video" },
  { label: "Website to video", href: "/saas-video-maker#url-to-video" },
  { label: "SaaS launch videos", href: "/saas-video-maker#launch" },
  { label: "Product demo videos", href: "/saas-video-maker#demo" },
  { label: "Explainer videos", href: "/saas-video-maker#explainer" },
  { label: "App promo videos", href: "/saas-video-maker#app-promo" },
  { label: "3D logo intros", href: "/saas-video-maker#logo-intro" },
  { label: "Reels, TikTok and Shorts", href: "/saas-video-maker#social" },
  { label: "Product videos from a listing", href: "/saas-video-maker#product-listing" },
];

/** The site footer: SaaS video topics, the tools, and the legal pages. */
export default function SiteFooter() {
  return (
    <footer className="footer site-footer">
      <div className="footer-cols">
        <div className="footer-brand">
          <Logo />
          <p>An AI video maker for SaaS intros, product videos and launch trailers, rendered in your browser.</p>
        </div>
        <nav className="footer-col" aria-label="SaaS videos">
          <h3>SaaS videos</h3>
          <ul className="footer-keywords">
            {KEYWORDS.map((k) => (
              <li key={k.label}>
                <Link href={k.href}>{k.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="footer-col" aria-label="Make a video">
          <h3>Make a video</h3>
          <ul>
            <li>
              <Link href="/studio">Studio</Link>
            </li>
            <li>
              <Link href="/#product">Product videos</Link>
            </li>
            <li>
              <Link href="/skills">Motion skills</Link>
            </li>
            <li>
              <Link href="/skills#3d-logo">3D logo slides</Link>
            </li>
            <li>
              <Link href="/#samples">Sample videos</Link>
            </li>
            <li>
              <Link href="/#pricing">Pricing</Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="footer-legal">
        © {new Date().getFullYear()} IntroMaker · <Link href="/privacy">Privacy</Link>
        <TermsLink /> · <Link href="/license">Licence</Link> · <Link href="/licenses">Open-source licences</Link>
      </div>
    </footer>
  );
}
