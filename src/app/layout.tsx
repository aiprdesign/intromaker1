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

export const metadata: Metadata = {
  title: "IntroMaker — Prompt to epic motion graphics",
  description:
    "Type a prompt, get a cinematic motion-graphics video. 40 pro animation skills, SaaS launch films, website import, AI director, produced soundtrack, voice-over and one-click export.",
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
