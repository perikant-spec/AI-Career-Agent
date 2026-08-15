"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function AccountActionsCard() {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        opt in — no such toggle exists yet in this phase, so nothing is ever used for training.
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
