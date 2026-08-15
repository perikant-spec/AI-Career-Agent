"use client";

import { useEffect, useState, useCallback } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { ContactCard, type ContactCardData } from "@/components/networking/ContactCard";

interface NetworkingContact extends ContactCardData {
  messagesDrafted: number;
  messagesSent: number;
}

export default function NetworkingHubPage() {
  const [contacts, setContacts] = useState<NetworkingContact[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/contacts");
    if (!res.ok) return;
    const body = await res.json();
    setContacts(body.contacts ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalSent = contacts?.reduce((sum, c) => sum + c.messagesSent, 0) ?? 0;
  const totalDrafted = contacts?.reduce((sum, c) => sum + c.messagesDrafted, 0) ?? 0;

  return (
    <div className="px-10 py-11 max-w-[1120px]">
      <SectionHeader
        title="Networking"
        description="Who to contact, and why. Contacts you add are labelled by source — nothing here is guessed on your behalf."
      />

      <div className="grid grid-cols-[1fr_292px] gap-4.5 mt-6 items-start">
        <div className="flex flex-col gap-2.5">
          {contacts === null ? (
            <div className="text-[13.5px] text-ink-tertiary">Loading…</div>
          ) : contacts.length === 0 ? (
            <Card className="p-6 text-[13.5px] text-ink-tertiary">
              No contacts yet. Add one from a job&apos;s application workspace — open a job,
              click &quot;Prepare application,&quot; and use the Networking tab.
            </Card>
          ) : (
            contacts.map((c) => <ContactCard key={c.id} contact={c} />)
          )}
        </div>

        <Card className="p-[18px]">
          <div className="text-[12.5px] font-semibold mb-2.5">Outreach activity</div>
          <div className="flex justify-between text-[12.5px] py-1">
            <span className="text-ink-secondary">Contacts</span>
            <span className="font-mono">{contacts?.length ?? 0}</span>
          </div>
          <div className="flex justify-between text-[12.5px] py-1">
            <span className="text-ink-secondary">Messages drafted</span>
            <span className="font-mono">{totalDrafted}</span>
          </div>
          <div className="flex justify-between text-[12.5px] py-1">
            <span className="text-ink-secondary">Messages sent</span>
            <span className="font-mono">{totalSent}</span>
          </div>
          <div className="text-[11px] text-ink-quaternary mt-2.5 leading-relaxed">
            No reply tracking — that needs email/inbox integration, which isn&apos;t built yet.
          </div>
        </Card>
      </div>
    </div>
  );
}
