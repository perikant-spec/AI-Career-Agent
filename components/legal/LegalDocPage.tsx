import { Card } from "@/components/ui/Card";
import type { LegalDocument } from "@/lib/legal/documents";

/** Renders a legal document page from lib/legal/documents.ts. When `body` is null (no document
 *  has been supplied by legal counsel yet) this shows an explicit, honest placeholder notice —
 *  never invented policy text standing in for the real thing. */
export function LegalDocPage({ doc }: { doc: LegalDocument }) {
  return (
    <div className="min-h-screen bg-bg flex justify-center px-6 py-14">
      <div className="w-full max-w-[640px]">
        <a href="/" className="text-[13px] text-ink-tertiary hover:text-ink-secondary">
          ← Back
        </a>
        <Card className="p-7 mt-4">
          <h1 className="font-serif text-[26px]">{doc.title}</h1>
          <div className="text-[12px] text-ink-quaternary mt-1 font-mono">Version: {doc.version}</div>

          {doc.body === null ? (
            <div className="mt-6 border border-accent-warning-border bg-accent-warning-bg text-accent-warning-text rounded-btn px-4 py-3.5 text-[13.5px] leading-relaxed">
              This document has not been published yet — the version above is a technical
              placeholder pending legal review, not a substitute for real {doc.title.toLowerCase()}{" "}
              language. Registering an account records acceptance of whatever version is current
              at the time; if this placeholder is later replaced with real, counsel-reviewed text
              under a new version number, existing accounts will be asked to re-confirm.
            </div>
          ) : (
            <div className="mt-6 text-[14px] leading-relaxed text-ink-secondary whitespace-pre-wrap">
              {doc.body}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
