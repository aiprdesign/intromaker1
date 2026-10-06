import type { Metadata } from "next";
import "@fontsource/anton/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/800.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/playfair-display/800.css";
import "@fontsource/manrope/800.css";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import "@fontsource/jost/600.css";
import "@fontsource/jost/700.css";
import "./globals.css";
import { SITE_URL_ENV } from "@/lib/site";

export const metadata: Metadata = {
  // Absolute links (canonical, Open Graph) need the public address: INTROMAKER_SITE_URL.
  ...(SITE_URL_ENV ? { metadataBase: new URL(SITE_URL_ENV) } : {}),
  title: "Prodintro.com — Instant Videos for Saas, Products, & Websites!",
  description:
    "Paste your website URL or type a prompt and get a SaaS intro video: an AI director, 161 motion skills, 3D logo intros, a produced soundtrack, voice-over and 1080p export for your landing page, Reels, TikTok and Shorts.",
  keywords: ["SaaS video maker", "SaaS intro video", "product intro video", "URL to video", "website to video", "product demo video", "launch video", "3D logo intro", "motion graphics", "AI video generator"],
  openGraph: { siteName: "Prodintro.com", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions (Grammarly, ColorZilla, Dark Reader, password managers…) add attributes
    // to <html>/<body> before React loads; ignore those two tags only. Real mismatches anywhere
    // inside the app are still reported.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
