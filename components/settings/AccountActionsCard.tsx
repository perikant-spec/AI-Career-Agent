"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function AccountActionsCard() {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiTrainingOptIn, setAiTrainingOptIn] = useState<boolean | null>(null);
  const [savingToggle, setSavingToggle] = useState(false);

  const loadToggle = useCallback(async () => {
    const res = await fetch("/api/preferences");
    if (!res.ok) return;
    const body = await res.json();
    setAiTrainingOptIn(body.preferences.aiTrainingOptIn ?? false);
  }, []);

  useEffect(() => {
    loadToggle();
  }, [loadToggle]);

  async function handleToggle(next: boolean) {
    setAiTrainingOptIn(next);
    setSavingToggle(true);
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiTrainingOptIn: next }),
    });
    setSavingToggle(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't delete your account.");
      setDeleting(false);
      return;
    }
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <Card className="p-5">
      <div className="text-[13.5px] font-semibold mb-1">Privacy &amp; data</div>
      <div className="text-[12.5px] text-ink-tertiary leading-relaxed mb-4">
        Resume files and application data are never used to train models unless you explicitly
        opt in below. Read the{" "}
        <a href="/terms" target="_blank" className="underline">Terms of Service</a> and{" "}
        <a href="/privacy" target="_blank" className="underline">Privacy Policy</a>.
      </div>

      <div className="flex items-center justify-between gap-3 pb-4">
        <div>
          <div className="text-[13px] font-medium">Use my data to improve AI models</div>
          <div className="text-[12px] text-ink-tertiary mt-0.5">
            Off by default. No training pipeline exists in this product today — this only
            controls what a future one would be allowed to use.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={aiTrainingOptIn ?? false}
          disabled={aiTrainingOptIn === null || savingToggle}
          onClick={() => handleToggle(!aiTrainingOptIn)}
          className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
            aiTrainingOptIn ? "bg-accent-teal" : "bg-border-strong"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-card transition-transform ${
              aiTrainingOptIn ? "translate-x-4" : ""
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <div className="text-[13px] font-medium">Export your data</div>
          <div className="text-[12px] text-ink-tertiary mt-0.5">
            Every job, application, message, and profile entry this app has stored for you, as JSON.
          </div>
        </div>
        <a href="/api/account/export">
          <Button variant="secondary">Download</Button>
        </a>
      </div>

      <div className="border-t border-border pt-4 mt-4">
        {!confirming ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium">Delete your account</div>
              <div className="text-[12px] text-ink-tertiary mt-0.5">
                Permanently deletes everything — resumes, jobs, applications, messages. Cannot be undone.
              </div>
            </div>
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              Delete account
            </Button>
          </div>
        ) : (
          <div>
            <div className="text-[13px] font-medium text-accent-risk-text mb-2">
              This permanently deletes your account and everything in it. Enter your password to confirm.
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Current password"
              className="rounded-btn border border-border-strong bg-card px-3 py-2 text-[14px] outline-none focus:border-ink-quaternary w-full max-w-[280px]"
            />
            {error ? <div className="text-[12px] text-accent-risk-text mt-1.5">{error}</div> : null}
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="destructive"
                disabled={deleting || !password}
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Permanently delete my account"}
              </Button>
              <Button
                variant="ghost"
                disabled={deleting}
                onClick={() => {
                  setConfirming(false);
                  setPassword("");
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
