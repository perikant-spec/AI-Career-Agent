import type Stripe from "stripe";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

let cached: Stripe | null = null;

/**
 * Lazily requires the Stripe SDK so it's never touched (and no network call ever attempted)
 * when no key is configured — same pattern as lib/ai#getAIProvider and lib/jobs/sources/adzuna.
 * Throws if called without a key; callers must check isStripeConfigured() first.
 */
export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured — set STRIPE_SECRET_KEY.");
  }
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const StripeCtor = require("stripe") as typeof Stripe;
    cached = new StripeCtor(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });
  }
  return cached;
}
