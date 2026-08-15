"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Incorrect email or password.");
      return;
    }

    router.push("/assistant");
    router.refresh();
  }

  return (
    <Card className="p-7">
      <h1 className="font-serif text-[28px]">Welcome back</h1>
      <p className="text-ink-secondary text-[13.5px] mt-1.5 mb-6">
        Sign in to pick up your job search where you left off.
      </p>

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
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary">
          <div className="flex justify-between items-baseline">
            <span>Password</span>
            <a href="/forgot-password" className="text-[12px]">Forgot password?</a>
          </div>
          <PasswordInput
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? (
          <div className="text-[12.5px] text-accent-risk-text bg-accent-risk-bg border border-accent-risk-border rounded-btn px-3 py-2">
            {error}
          </div>
        ) : null}

        <Button type="submit" variant="primary" disabled={loading} className="mt-1.5">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-[13px] text-ink-tertiary mt-5 text-center">
        Don&apos;t have an account? <a href="/register">Create one</a>
      </p>
    </Card>
  );
}
