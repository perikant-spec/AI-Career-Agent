export function IntentChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="border border-border-strong bg-card text-ink-secondary rounded-pill px-3 py-1.5 text-[12.5px] cursor-pointer hover:bg-white hover:border-ink-quaternary"
    >
      {label}
    </button>
  );
}
