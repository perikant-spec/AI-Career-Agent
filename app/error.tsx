"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { getLogger } from "@/lib/logging";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    getLogger().error("Client-side route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <div className="max-w-[440px] text-center">
        <div className="font-mono text-[13px] text-accent-risk-text uppercase tracking-wide mb-3">
          Something went wrong
        </div>
        <h1 className="font-serif text-[30px] font-normal mb-2">This page hit an error</h1>
        <p className="text-[14.5px] text-ink-secondary mb-6">
          Nothing about your data was changed. Try again, or head back to your dashboard.
          {error.digest ? <span className="block mt-1 text-[12px] text-ink-quaternary">Reference: {error.digest}</span> : null}
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <a href="/assistant">
            <Button variant="secondary">Back to dashboard</Button>
          </a>
        </div>
      </div>
    </div>
  );
}
