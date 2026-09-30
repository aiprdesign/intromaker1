import { handleStripeEvent, verifyStripeSignature, webhookConfigured, type StripeEvent } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook: add this URL as an endpoint in Stripe (Developers → Webhooks) with the events
 * checkout.session.completed, customer.subscription.updated, customer.subscription.deleted and
 * invoice.payment_failed, and put its signing secret in STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  if (!webhookConfigured()) return Response.json({ error: "Stripe webhook not configured (set STRIPE_WEBHOOK_SECRET)" }, { status: 503 });
  const payload = await req.text();
  if (payload.length > 1_000_000) return Response.json({ error: "Payload too large" }, { status: 413 });
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET!)) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  let ev: StripeEvent;
  try {
    ev = JSON.parse(payload);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!ev?.id || !ev.type || !ev.data?.object) return Response.json({ error: "Not a Stripe event" }, { status: 400 });
  try {
    const result = await handleStripeEvent(ev);
    return Response.json({ received: true, result });
  } catch (e) {
    // A 500 makes Stripe retry later.
    console.error("[stripe] event failed:", ev.type, (e as Error).message);
    return Response.json({ error: "Event failed" }, { status: 500 });
  }
}
