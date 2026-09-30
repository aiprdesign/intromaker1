import type { Metadata } from "next";
import Nav from "@/components/Nav";
import AccountApp from "./AccountApp";

export const metadata: Metadata = {
  title: "My intros · IntroMaker",
  description: "Sign in to save your intros and manage your plan.",
  robots: { index: false },
};

export default function Account() {
  return (
    <>
      <Nav cta={false} />
      <AccountApp />
    </>
  );
}
