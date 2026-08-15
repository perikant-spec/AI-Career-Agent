import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { getStripeClient, isStripeConfigured } from "@/lib/billing/stripeClient";

/** Creates a Stripe Billing Portal session so the user can manage/cancel their own
 *  subscription directly on Stripe — this app never cancels or modifies billing on their
 *  behalf. */
export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isStripeConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account yet — subscribe to Pro first." }, { status: 400 });
  }

  const stripe = getStripeClient();
  const baseUrl = new URL(request.url).origin;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${baseUrl}/settings`,
    });
    return NextResponse.json({ configured: true, url: session.url });
  } catch (err) {
    return NextResponse.json(
      { configured: true, error: err instanceof Error ? err.message : "Couldn't open the billing portal." },
      { status: 502 }
    );
  }
}
