"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_LIMITS, describeLimits, type PlanId, type PlanLimits } from "@/lib/plans";

/**
 * Free and unlimited for now (with the limits the site owner has set, the defaults until they
 * load), and a commercial licence on request.
 */
export default function PricingCards() {
  const [plans, setPlans] = useState<Record<PlanId, PlanLimits>>(DEFAULT_LIMITS);
  const [contact, setContact] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((a) => {
        if (a.plans) setPlans(a.plans);
        setContact(a.contactEmail ?? null);
      })
      .catch(() => {});
  }, []);
  const licenceHref = contact ? `mailto:${contact}?subject=${encodeURIComponent("IntroMaker commercial licence")}` : "/license";
  return (
    <div className="pricing two">
      <div className="price-card">
        <h3>Free</h3>
        <div className="price">
          $0<small>unlimited, for now</small>
        </div>
        <ul>
          {["All 79 motion skills", "Generated soundtrack and voice-over", ...describeLimits(plans.free), "For personal and non-commercial use"].map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <Link href="/studio" className="btn btn-ghost">
          Start making videos
        </Link>
      </div>
      <div className="price-card featured">
        <span className="badge">Commercial use</span>
        <h3>Commercial licence</h3>
        <div className="price">
          Contact us<small></small>
        </div>
        <ul>
          {["Use IntroMaker for a business, a client or an agency", "Run it on your own servers or in your product", "Everything in Free, with no limits", "Available on request"].map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <a href={licenceHref} className="btn btn-primary">
          Contact for a licence
        </a>
      </div>
    </div>
  );
}
