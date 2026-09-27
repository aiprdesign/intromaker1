import { Suspense } from "react";
import Studio from "./Studio";

export const metadata = { title: "Studio — IntroMaker" };

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="studio-loading">Loading studio…</div>}>
      <Studio />
    </Suspense>
  );
}
