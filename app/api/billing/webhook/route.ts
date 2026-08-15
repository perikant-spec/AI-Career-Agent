import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, isWebhookConfigured } from "@/lib/billing/stripeClient";
import { syncSubscriptionFromStripe } from "@/lib/billing/syncSubscription";

const SYNCED_EVENTS = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);

/** The only writer path for Subscription.plan/status/stripe* fields — everything else in this
 *  app only ever reads entitlements, never grants them. Signature-verified against the raw
 *  body, so this can't be spoofed by posting a fake "you're subscribed now" payload. */
export async function POST(request: Request) {
  if (!isWebhookConfigured()) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (SYNCED_EVENTS.has(event.type)) {
    await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
  }

  return NextResponse.json({ received: true });
}
