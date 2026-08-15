"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StaticPill } from "@/components/ui/Pill";

interface BillingStatus {
  plan: "FREE" | "PRO";
  status: string;
  jobsUsed: number;
  jobCap: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeConfigured: boolean;
}

export function BillingCard() {
  const checkoutParam = useSearchParams().get("checkout");
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [redirecting, setRedirecting] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/billing/status");
    if (!res.ok) return;
    setStatus(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load, checkoutParam]);

  async function handleUpgrade() {
    setRedirecting("checkout");
    setError(null);
    const res = await fetch("/api/billing/checkout", { method: "POST" });
    const body = await res.json();
    if (body.url) {
      window.location.href = body.url;
      return;
    }
    setError(body.configured === false ? "Stripe isn't connected yet." : body.error ?? "Couldn't start checkout.");
    setRedirecting(null);
  }

  async function handleManage() {
    setRedirecting("portal");
    setError(null);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const body = await res.json();
    if (body.url) {
      window.location.href = body.url;
      return;
    }
    setError(body.error ?? "Couldn't open the billing portal.");
    setRedirecting(null);
  }

  if (!status) {
    return (
      <Card className="p-5">
        <div className="text-[13.5px] font-semibold mb-3">Billing</div>
        <div className="text-[13px] text-ink-tertiary">Loading…</div>
      </Card>
    );
  }

  const isPro = status.plan === "PRO";
  const usagePct = status.jobCap ? Math.min(100, Math.round((status.jobsUsed / status.jobCap) * 100)) : 0;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="text-[13.5px] font-semibold">Billing</div>
        <StaticPill tone={isPro ? "success" : "default"}>{isPro ? "Pro" : "Free"}</StaticPill>
        {!status.stripeConfigured ? <StaticPill>Stripe not connected</StaticPill> : null}
      </div>

      {checkoutParam === "success" ? (
        <div className="text-[12.5px] text-accent-success-text mb-2">
          Checkout complete — this updates automatically once Stripe confirms the subscription.
        </div>
      ) : null}
      {checkoutParam === "cancelled" ? (
        <div className="text-[12.5px] text-ink-tertiary mb-2">Checkout cancelled — no charge was made.</div>
      ) : null}

      {isPro ? (
        <>
          <div className="text-[12.5px] text-ink-tertiary mb-3.5">
            Unlimited jobs, full application packages, networking outreach, and interview prep.
            {status.cancelAtPeriodEnd && status.currentPeriodEnd
              ? ` Cancels on ${new Date(status.currentPeriodEnd).toLocaleDateString()}.`
              : status.currentPeriodEnd
                ? ` Renews ${new Date(status.currentPeriodEnd).toLocaleDateString()}.`
                : ""}
          </div>
          <Button variant="secondary" disabled={redirecting !== null} onClick={handleManage}>
            {redirecting === "portal" ? "Opening…" : "Manage subscription"}
          </Button>
        </>
      ) : (
        <>
          <div className="text-[12.5px] text-ink-tertiary mb-2">
            Free plan: track up to {status.jobCap} jobs and get match scores. Pro unlocks
            application packages, networking outreach drafting, and interview prep.
          </div>
          {status.jobCap ? (
            <div className="mb-3.5">
              <div className="h-1.5 rounded-pill bg-black/5 overflow-hidden">
                <div
                  className="h-full bg-accent-teal rounded-pill"
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              <div className="text-[11.5px] text-ink-quaternary mt-1">
                {status.jobsUsed} / {status.jobCap} jobs tracked
              </div>
            </div>
          ) : null}
          <Button variant="accent" disabled={redirecting !== null} onClick={handleUpgrade}>
            {redirecting === "checkout" ? "Redirecting…" : "Upgrade to Pro"}
          </Button>
        </>
      )}

      {error ? <div className="text-[12px] text-accent-risk-text mt-2.5">{error}</div> : null}
    </Card>
  );
}
