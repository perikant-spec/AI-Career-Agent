"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  return (
    <Card className="p-7">
      <h1 className="font-serif text-[28px]">Reset your password</h1>
      <p className="text-ink-secondary text-[13.5px] mt-1.5 mb-6">
        Enter the email on your account and we&apos;ll send a link to reset your password.
      </p>

      {submitted ? (
        <div className="text-[13.5px] text-ink-primary bg-card border border-border rounded-btn px-3.5 py-3 leading-relaxed">
          If an account exists for <strong>{email}</strong>, a reset link is on its way.
          {process.env.NODE_ENV !== "production" ? (
            <>
              {" "}
              No email service is configured in this environment — check the{" "}
              <a href="/dev/outbox">dev outbox</a> for the link.
            </>
          ) : null}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-btn border border-border-strong bg-card px-3 py-2 text-[14px] text-ink-primary outline-none focus:border-ink-quaternary"
            />
          </label>

          {error ? (
            <div className="text-[12.5px] text-accent-risk-text bg-accent-risk-bg border border-accent-risk-border rounded-btn px-3 py-2">
              {error}
            </div>
          ) : null}

          <Button type="submit" variant="primary" disabled={loading} className="mt-1.5">
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="text-[13px] text-ink-tertiary mt-5 text-center">
        <a href="/login">Back to sign in</a>
      </p>
    </Card>
  );
}
