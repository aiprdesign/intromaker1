import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import { readSettings } from "@/lib/admin";
import { effectiveBilling, REFUND_DAYS } from "@/lib/stripe-links";

// Whether payments are on, and the contact address (Admin → Plans), are read at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms and refunds · IntroMaker",
  description: `IntroMaker's plans, ${REFUND_DAYS}-day refunds, cancelling, and using what you make.`,
};

/** Plain-language terms: plans, the refund window, cancelling, and what you may import. */
export default async function Terms() {
  const s = await readSettings();
  // Live only once Stripe payments are set up (a Payment Link, from Admin or the environment).
  const b = effectiveBilling(s.billing);
  if (!b.monthlyLink && !b.yearlyLink) notFound();
  const contact = s.contactEmail?.trim();
  const mail = contact ? `mailto:${contact}?subject=${encodeURIComponent("IntroMaker refund")}` : null;
  return (
    <main>
      <Nav />
      <article className="legal">
        <h1>Terms and refunds</h1>
        <p className="lead">
          IntroMaker is a portfolio project. These terms are short and in plain language. If something here is unclear, {mail ? <a href={mail}>email us</a> : "ask us"}{" "}
          before you pay.
        </p>

        <h2 id="refunds">{REFUND_DAYS}-day refunds</h2>
        <p>
          If Pro isn&apos;t right for you, ask for a refund within <strong>{REFUND_DAYS} days</strong> of a payment and we&apos;ll refund that payment in full,
          no questions asked. This covers your first payment and renewals, monthly or yearly.
        </p>
        <ul>
          <li>
            To ask: {mail ? (
              <>
                email <a href={mail}>{contact}</a> from the address on your account
              </>
            ) : (
              "contact us from the address on your account"
            )}
            , and say which payment. Refunds go back to the card you paid with through Stripe, and usually show within 5 to 10 business days, depending on
            your bank.
          </li>
          <li>When a payment is refunded in full, your account goes back to the Free plan and the subscription is cancelled, so you aren&apos;t charged again.</li>
          <li>Your saved intros stay on your account. If you have more than the Free plan holds, you can still open and delete them.</li>
          <li>After {REFUND_DAYS} days a payment isn&apos;t refundable, but you can cancel so the next one isn&apos;t taken.</li>
        </ul>

        <h2>Plans and payments</h2>
        <p>
          The Free plan costs nothing. Pro is a subscription, billed monthly or yearly by Stripe, at the price shown when you upgrade. We don&apos;t see or
          keep your card details: Stripe handles payments.
        </p>

        <h2>Cancelling</h2>
        <p>
          Cancel when you like from <strong>Manage billing</strong> on your <Link href="/account">account page</Link>. Pro stays on until the end of the
          period you&apos;ve paid for, then the account moves to Free.
        </p>

        <h2>What you make and what you import</h2>
        <ul>
          <li>The videos you make are yours to use, within the <Link href="/license">licence</Link> for the plan you&apos;re on.</li>
          <li>Import websites, listings and photos you have the right to use, and check the video before you publish it.</li>
          <li>Generated copy is screened to stay generic, but it isn&apos;t legal advice: you&apos;re responsible for the claims in what you publish.</li>
        </ul>

        <h2>Your data</h2>
        <p>
          What we keep, and for how long, is on the <Link href="/privacy">privacy page</Link>. You can delete your account from your account page.
        </p>

        <p className="back">
          <Link href="/studio" className="btn btn-primary">
            Try for Free!
          </Link>
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}
