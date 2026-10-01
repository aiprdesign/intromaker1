"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_LIMITS, describeLimits, type PlanId, type PlanLimits } from "@/lib/plans";

/** Free and Pro, with the limits the site owner has set (the defaults until they load). */
export default function PricingCards() {
  const [plans, setPlans] = useState<Record<PlanId, PlanLimits>>(DEFAULT_LIMITS);
  const [proPrice, setProPrice] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((a) => {
        if (a.plans) setPlans(a.plans);
        setProPrice(a.proPrice ?? null);
      })
      .catch(() => {});
  }, []);
  const cards = [
    { id: "free" as const, name: "Free", price: "$0", period: "forever", intro: ["All 63 motion skills", "Generated soundtrack and voice-over"], cta: "Try for Free!", href: "/studio" },
    { id: "pro" as const, name: "Pro", price: proPrice || "Ask us", period: "", intro: ["Everything in Free"], cta: "Get Pro", href: "/account", featured: true },
  ];
  return (
    <div className="pricing two">
      {cards.map((p) => (
        <div className={`price-card ${p.featured ? "featured" : ""}`} key={p.id}>
          {p.featured && <span className="badge">For launches</span>}
          <h3>{p.name}</h3>
          <div className="price">
            {p.price}
            <small>{p.period}</small>
          </div>
          <ul>
            {[...p.intro, ...describeLimits(plans[p.id])].map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Link href={p.href} className={`btn ${p.featured ? "btn-primary" : "btn-ghost"}`}>
            {p.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}
