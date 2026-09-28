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
import "./globals.css";

export const metadata: Metadata = {
  title: "IntroMaker — Prompt to epic motion graphics",
  description:
    "Type a prompt, get a cinematic motion-graphics video. 33 pro animation skills, SaaS launch films, website import, AI director, generated soundtrack and one-click export.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
