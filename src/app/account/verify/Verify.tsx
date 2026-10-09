"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Where a sign-in link lands: the token is read from the address's fragment (so it never reaches
 * server logs), spent with one request, and the page moves on to where the visitor was going.
 * The request is made by this page rather than by opening the link, so email scanners that open
 * links ahead of the visitor don't use it up.
 */
export default function Verify() {
  const [state, setState] = useState<{ status: "working" | "done" | "error"; text?: string }>({ status: "working" });
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = new URLSearchParams(location.hash.slice(1)).get("t");
    // (The token leaves the address bar straight away.)
    history.replaceState(null, "", location.pathname);
    if (!token) {
      setState({ status: "error", text: "This sign-in link is incomplete. Open the link from the email again, or ask for a new one." });
      return;
    }
    fetch("/api/account/magic/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as { error?: string; next?: string | null; created?: boolean };
        if (!r.ok) throw new Error(data.error ?? "That didn't work. Ask for a new sign-in link.");
        setState({ status: "done", text: data.created ? "Your account is ready." : "You're signed in." });
        const next = data.next && data.next.startsWith("/") && !data.next.startsWith("//") ? data.next : "/account";
        setTimeout(() => location.replace(next), 700);
      })
      .catch((e: Error) => setState({ status: "error", text: e.message }));
  }, []);
  return (
    <main className="account">
      <div className="account-card auth verify-card">
        {state.status === "working" && (
          <>
            <span className="verify-spinner" aria-hidden />
            <h1>Signing you in…</h1>
          </>
        )}
        {state.status === "done" && (
          <>
            <span className="sent-icon" aria-hidden>
              ✓
            </span>
            <h1>{state.text}</h1>
            <p className="hint">Taking you back…</p>
          </>
        )}
        {state.status === "error" && (
          <>
            <h1>That link didn&apos;t work</h1>
            <p>{state.text}</p>
            <Link className="btn btn-primary" href="/account?mode=in">
              Send me a new link
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
