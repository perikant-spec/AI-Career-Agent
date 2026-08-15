import Link from "next/link";
import { StaticPill } from "@/components/ui/Pill";
import { CONTACT_TYPE_LABELS, type ContactType } from "@/lib/types/enums";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export interface ContactCardData {
  id: string;
  name: string;
  role: string | null;
  contactType: string;
  source: string;
  warmth: number | null;
  jobTitle?: string | null;
  company?: string | null;
}

export function ContactCard({ contact, onDelete }: { contact: ContactCardData; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3.5">
      <div className="w-9 h-9 flex-none rounded-full bg-black/[0.06] flex items-center justify-center text-[12.5px] font-semibold text-ink-tertiary">
        {initials(contact.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14.5px] font-semibold">{contact.name}</span>
          {contact.role ? <span className="text-[13px] text-ink-secondary">{contact.role}</span> : null}
          <StaticPill tone={contact.source === "PROVIDER_VERIFIED" ? "success" : "default"}>
            {contact.source === "PROVIDER_VERIFIED" ? "Verified" : "You supplied this"}
          </StaticPill>
        </div>
        <div className="text-[12px] text-ink-tertiary mt-1">
          {CONTACT_TYPE_LABELS[contact.contactType as ContactType]}
          {contact.company ? ` · ${contact.company}` : ""}
          {contact.jobTitle ? ` — ${contact.jobTitle}` : ""}
        </div>
      </div>
      {contact.warmth !== null ? (
        <div className="text-right min-w-[64px]">
          <div className="text-[11px] text-ink-quaternary">Warmth</div>
          <div className="font-mono text-[14px]">{contact.warmth}</div>
        </div>
      ) : null}
      <Link href={`/networking/${contact.id}`}>
        <span className="text-[12.5px] border border-border-strong rounded-btn px-3.5 py-2 whitespace-nowrap inline-block cursor-pointer hover:border-ink-quaternary">
          Draft message
        </span>
      </Link>
      {onDelete ? (
        <button
          onClick={onDelete}
          className="text-[12px] text-ink-quaternary hover:text-accent-risk-text bg-transparent border-0 cursor-pointer"
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}
