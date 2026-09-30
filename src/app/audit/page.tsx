import type { Metadata } from "next";
import Nav from "@/components/Nav";
import LayoutAudit from "./LayoutAudit";

export const metadata: Metadata = {
  title: "Layout audit · IntroMaker",
  description: "Every skill checked against IntroMaker's design system: title-safe areas, clipping and overlapping text.",
  robots: { index: false },
};

/** Design-system QA: renders every skill in every format and reports layout problems. */
export default function Audit() {
  return (
    <main>
      <Nav />
      <LayoutAudit />
    </main>
  );
}
