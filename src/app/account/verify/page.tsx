import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Verify from "./Verify";

export const metadata: Metadata = {
  title: "Signing in · Prodintro.com",
  robots: { index: false },
  // (The sign-in token is in the address's fragment; never pass the page on as a referrer.)
  referrer: "no-referrer",
};

export default function VerifyPage() {
  return (
    <>
      <Nav cta={false} />
      <Verify />
    </>
  );
}
