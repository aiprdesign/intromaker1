import type { Metadata } from "next";
import { Logo } from "@/components/Nav";
import UnlockForm from "./UnlockForm";

export const metadata: Metadata = { title: "Enter PIN · Prodintro.com", robots: { index: false, follow: false } };

/** Where a locked site sends visitors (Admin → Site PIN). */
export default async function Unlock({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const raw = (await searchParams).next;
  const next = typeof raw === "string" ? raw : "/";
  // Only a path on this site (not another site, not back here).
  const safe = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/unlock") ? next : "/";
  return (
    <main className="unlock">
      <div className="unlock-card">
        <Logo />
        <h1>This site is private</h1>
        <p>Enter the PIN you were given to continue.</p>
        <UnlockForm next={safe} />
      </div>
    </main>
  );
}
