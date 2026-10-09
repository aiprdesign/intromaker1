import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Reset from "./Reset";

export const metadata: Metadata = {
  title: "Choose a new password · Prodintro.com",
  robots: { index: false },
  // (The reset token is in the address's fragment; never pass the page on as a referrer.)
  referrer: "no-referrer",
};

export default function ResetPage() {
  return (
    <>
      <Nav cta={false} />
      <Reset />
    </>
  );
}
