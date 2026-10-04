"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// One look per page load, shared by the footers that ask.
let online: Promise<boolean> | null = null;
const paymentsOn = () =>
  (online ??= fetch("/api/account")
    .then((r) => (r.ok ? r.json() : null))
    .then((a: { billing?: { online?: boolean } } | null) => !!a?.billing?.online)
    .catch(() => false));

/** " · Terms and refunds" in a footer, only once Stripe payments are set up (the page 404s until then). */
export default function TermsLink() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    void paymentsOn().then((v) => alive && setOn(v));
    return () => {
      alive = false;
    };
  }, []);
  return on ? (
    <>
      {" · "}
      <Link href="/terms">Terms and refunds</Link>
    </>
  ) : null;
}
