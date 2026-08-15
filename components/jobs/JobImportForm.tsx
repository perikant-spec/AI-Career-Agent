"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function JobImportForm({ onImported }: { onImported: () => void }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    setUpgradeRequired(false);

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: text }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't import that posting.");
      setUpgradeRequired(Boolean(body.upgradeRequired));
      return;
    }

    setText("");
    onImported();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-start gap-2 bg-card border border-border-strong rounded-xl px-3.5 py-2.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the full job posting text here…"
          rows={3}
          className="flex-1 bg-transparent outline-none text-[13.5px] resize-y"
        />
        <Button type="submit" variant="primary" disabled={submitting || !text.trim()}>
          {submitting ? "Scoring…" : "Import"}
        </Button>
      </div>
      {error ? (
        <div className="text-[12.5px] text-accent-risk-text bg-accent-risk-bg border border-accent-risk-border rounded-btn px-3 py-2 flex items-center gap-2 flex-wrap">
          <span>{error}</span>
          {upgradeRequired ? (
            <Link href="/settings" className="underline font-medium">
              Upgrade to Pro
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
