"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined, email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("Account created, but sign-in failed. Try logging in.");
      return;
    }

    router.push("/resumes/upload");
    router.refresh();
  }

  return (
    <Card className="p-7">
      <h1 className="font-serif text-[28px]">Create your account</h1>
      <p className="text-ink-secondary text-[13.5px] mt-1.5 mb-6">
        Everything downstream traces back to the resume you upload next — nothing here is
        used to train models unless you turn that on later in Settings.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary">
          Name (optional)
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-btn border border-border-strong bg-card px-3 py-2 text-[14px] text-ink-primary outline-none focus:border-ink-quaternary"
          />
        </label>
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
          Password
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="text-[11.5px] text-ink-quaternary">At least 8 characters.</span>
        </label>

        {error ? (
          <div className="text-[12.5px] text-accent-risk-text bg-accent-risk-bg border border-accent-risk-border rounded-btn px-3 py-2">
            {error}
          </div>
        ) : null}

        <Button type="submit" variant="primary" disabled={loading} className="mt-1.5">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-[13px] text-ink-tertiary mt-5 text-center">
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </Card>
  );
}
