import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { getStripeClient, isStripeConfigured } from "@/lib/billing/stripeClient";
import { getProPriceId } from "@/lib/billing/plans";

/** Creates a Stripe Checkout Session for the Pro subscription and returns its URL for the
 *  client to redirect to. Never attempted when Stripe isn't configured — mirrors the Adzuna
 *  "not configured" pattern rather than throwing a raw SDK error at the user. */
export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const priceId = getProPriceId();
  if (!isStripeConfigured() || !priceId) {
    return NextResponse.json({ configured: false });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const stripe = getStripeClient();
  const baseUrl = new URL(request.url).origin;

  const subscription = await prisma.subscription.findUnique({ where: { userId } });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: subscription?.stripeCustomerId ?? undefined,
      customer_email: subscription?.stripeCustomerId ? undefined : user.email,
      client_reference_id: userId,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
      success_url: `${baseUrl}/settings?checkout=success`,
      cancel_url: `${baseUrl}/settings?checkout=cancelled`,
    });
    return NextResponse.json({ configured: true, url: session.url });
  } catch (err) {
    // A misconfigured key/price still counts as "configured" (env vars are set) but the actual
    // Stripe call failed — surface that as a clean JSON error rather than a raw 500 HTML page,
    // which would otherwise leave the client's redirect button stuck forever.
    return NextResponse.json(
      { configured: true, error: err instanceof Error ? err.message : "Couldn't start checkout." },
      { status: 502 }
    );
  }
}
