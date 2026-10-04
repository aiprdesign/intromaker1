"use client";

import Link from "next/link";
import { REFUND_DAYS } from "@/lib/stripe-links";
import { useEffect, useState } from "react";
import { DEFAULT_LIMITS, describeLimits, type PlanId, type PlanLimits } from "@/lib/plans";

type Info = { plans: Record<PlanId, PlanLimits>; contactEmail: string | null; proPrice: string | null; online: boolean };

/**
 * The pricing section. Free and unlimited for now, with a commercial licence on request; once the
 * owner sells Pro (Stripe links in Admin → Billing, a price, and limits Pro unlocks over Free) a
 * Pro card sits between them, its button going to sign-up and then straight to checkout.
 */
export default function PricingCards() {
  const [info, setInfo] = useState<Info>({ plans: DEFAULT_LIMITS, contactEmail: null, proPrice: null, online: false });
  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((a) => setInfo({ plans: a.plans ?? DEFAULT_LIMITS, contactEmail: a.contactEmail ?? null, proPrice: a.proPrice ?? null, online: !!a.billing?.online }))
      .catch(() => {});
  }, []);
  const { plans, contactEmail, proPrice } = info;
  // Pro is only offered when it can be bought and is worth buying.
  const sellsPro = info.online && !!proPrice && JSON.stringify(plans.free) !== JSON.stringify(plans.pro);
  const f = plans.free;
  const freeUnlimited = f.savedFilms >= 100_000 && f.aiPerMonth >= 1_000_000 && f.importsPerDay >= 100_000 && !f.watermark;
  const licenceHref = contactEmail ? `mailto:${contactEmail}?subject=${encodeURIComponent("IntroMaker commercial licence")}` : "/license";
  return (
    <>
      <div className="section-head">
        <span className="eyebrow">Pricing</span>
        {sellsPro ? (
          <>
            <h2>Start free. Go Pro when you need more.</h2>
            <p className="lead">Make intros free, then upgrade for {proPrice} to unlock Pro. Cancel when you like from your account. Need it for a business or a client? Contact us for a licence.</p>
          </>
        ) : (
          <>
            <h2>{freeUnlimited ? "Free and unlimited, for now." : "Free to start."}</h2>
            <p className="lead">
              IntroMaker is a portfolio project: try it free{freeUnlimited ? " and unlimited" : ""}, for personal and non-commercial use. Want to use it commercially? Contact us for a licence.
            </p>
          </>
        )}
      </div>
      <div className={`pricing ${sellsPro ? "three" : "two"}`}>
        <div className="price-card">
          <h3>Free</h3>
          <div className="price">
            $0<small>{sellsPro || !freeUnlimited ? "to start" : "unlimited, for now"}</small>
          </div>
          <ul>
            {["120 motion skills", "Generated soundtrack and voice-over", ...describeLimits(plans.free), "For personal and non-commercial use"].map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Link href="/studio" className="btn btn-ghost">
            Start making videos
          </Link>
        </div>
        {sellsPro && (
          <div className="price-card featured">
            <span className="badge">Pro</span>
            <h3>Pro</h3>
            <div className="price">{proPrice}</div>
            <ul>
              {["The Free features, plus:", ...describeLimits(plans.pro).filter((l) => !describeLimits(plans.free).includes(l))].map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link href="/account?plan=pro" className="btn btn-primary">
              Get Pro
            </Link>
            <span className="hint">
              Secure checkout by Stripe. Cancel from your account. <Link href="/terms#refunds">{REFUND_DAYS}-day refunds</Link>
            </span>
          </div>
        )}
        <div className={`price-card${sellsPro ? "" : " featured"}`}>
          {!sellsPro && <span className="badge">Commercial use</span>}
          <h3>Commercial licence</h3>
          <div className="price">
            Contact us<small></small>
          </div>
          <ul>
            {["Use IntroMaker for a business, a client or an agency", "Run it on your own servers or in your product", sellsPro ? "Pro features, for commercial work" : "The Free features, for commercial work", "Available on request"].map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <a href={licenceHref} className={`btn ${sellsPro ? "btn-ghost" : "btn-primary"}`}>
            Contact for a licence
          </a>
        </div>
      </div>
    </>
  );
}
