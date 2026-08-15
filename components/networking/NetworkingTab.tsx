"use client";

import { useEffect, useState, useCallback } from "react";
import { ContactCard, type ContactCardData } from "./ContactCard";
import { ContactForm, type NewContactInput } from "./ContactForm";

export function NetworkingTab({ jobId }: { jobId: string }) {
  const [contacts, setContacts] = useState<ContactCardData[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}/contacts`);
    if (!res.ok) return;
    const body = await res.json();
    setContacts(body.contacts ?? []);
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(input: NewContactInput) {
    setSubmitting(true);
    await fetch(`/api/jobs/${jobId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    await load();
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="text-[13px] text-ink-tertiary mb-3.5">
        Who to reach out to for this role. You add the contact — nothing is auto-discovered.
      </div>

      <div className="flex flex-col gap-2 mb-5 max-w-[640px]">
        {contacts === null ? (
          <div className="text-[13.5px] text-ink-tertiary">Loading…</div>
        ) : contacts.length === 0 ? (
          <div className="text-[13.5px] text-ink-tertiary">No contacts added for this job yet.</div>
        ) : (
          contacts.map((c) => <ContactCard key={c.id} contact={c} onDelete={() => handleDelete(c.id)} />)
        )}
      </div>

      <div className="max-w-[640px] border-t border-[#F0ECE1] pt-4">
        <div className="text-[12.5px] font-semibold mb-2.5">Add a contact</div>
        <ContactForm onSubmit={handleAdd} submitting={submitting} />
      </div>
    </div>
  );
}
