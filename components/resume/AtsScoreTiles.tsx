export function AtsScoreTiles({ before, after }: { before: number; after: number }) {
  return (
    <div className="flex gap-2.5">
      <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
        <div className="text-[11px] text-ink-tertiary">ATS before</div>
        <div className="font-mono text-[22px]">{before}</div>
      </div>
      <div className="bg-accent-success-bg border border-accent-success-border rounded-xl px-4 py-3 text-center">
        <div className="text-[11px] text-accent-success-text">ATS after</div>
        <div className="font-mono text-[22px] text-accent-success-text">{after}</div>
      </div>
    </div>
  );
}
