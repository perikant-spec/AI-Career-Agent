"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token || !email) {
    return (
      <Card className="p-7">
        <h1 className="font-serif text-[28px]">Reset your password</h1>
        <p className="text-ink-secondary text-[13.5px] mt-1.5">
          This link is missing its token — copy the full link from the email, or{" "}
          <a href="/forgot-password">request a new one</a>.
        </p>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't reset your password. Please try again.");
      return;
    }
    setSuccess(true);
  }

  return (
    <Card className="p-7">
      <h1 className="font-serif text-[28px]">Set a new password</h1>
      <p className="text-ink-secondary text-[13.5px] mt-1.5 mb-6">
        Choose a new password for <strong>{email}</strong>. This link only works once.
      </p>

      {success ? (
        <>
          <div className="text-[13.5px] text-accent-success-text bg-accent-success-bg border border-accent-success-border rounded-btn px-3.5 py-3">
            Your password has been updated.
          </div>
          <Button variant="primary" className="mt-4 w-full">
            <a href="/login" className="text-inherit no-underline">Sign in</a>
          </Button>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary">
            New password
            <PasswordInput
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="text-[11.5px] text-ink-quaternary">At least 8 characters.</span>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary">
            Confirm new password
            <PasswordInput
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>

          {error ? (
            <div className="text-[12.5px] text-accent-risk-text bg-accent-risk-bg border border-accent-risk-border rounded-btn px-3 py-2">
              {error}
            </div>
          ) : null}

          <Button type="submit" variant="primary" disabled={loading} className="mt-1.5">
            {loading ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </Card>
  );
}
