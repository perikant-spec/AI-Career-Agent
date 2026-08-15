import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import type { SubscriptionStatus } from "./plans";

const STRIPE_STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  incomplete: "INCOMPLETE",
  incomplete_expired: "INCOMPLETE",
  unpaid: "PAST_DUE",
  paused: "CANCELED",
};

/** The single writer of Stripe-derived fields on Subscription — called from the webhook
 *  handler only, never from a client-facing route, so the DB can never claim an entitlement
 *  Stripe doesn't actually agree with. Looks the user up by the `userId` metadata key set at
 *  Checkout creation time (via `subscription_data.metadata`), which Stripe copies onto the
 *  Subscription object itself. */
export async function syncSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) return; // not one of ours (or predates this metadata) — nothing to sync

  const status = STRIPE_STATUS_MAP[subscription.status] ?? "INCOMPLETE";
  const item = subscription.items.data[0];
  const currentPeriodEnd = item ? new Date(item.current_period_end * 1000) : null;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: status === "ACTIVE" || status === "TRIALING" ? "PRO" : "FREE",
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: item?.price.id ?? null,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      plan: status === "ACTIVE" || status === "TRIALING" ? "PRO" : "FREE",
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: item?.price.id ?? null,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}
