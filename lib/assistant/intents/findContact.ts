import { prisma } from "@/lib/prisma";

/**
 * "Find the hiring manager" — honest about what this app actually does: it never auto-discovers
 * anyone (no scraping, no licensed enrichment provider configured). This reports contacts the
 * user has already added for a matching job, or says plainly that none exist yet.
 */
export async function findContact(userId: string, query: string) {
  const jobs = await prisma.job.findMany({ where: { userId }, include: { contacts: true } });
  const q = query.toLowerCase();

  const match = jobs.find((j) => {
    const title = (j.title ?? "").toLowerCase();
    const company = (j.company ?? "").toLowerCase();
    return (
      (title && (title.includes(q) || q.includes(title))) ||
      (company && (company.includes(q) || q.includes(company)))
    );
  });

  if (!match) {
    return {
      available: false,
      reason: "I couldn't find a job matching that — check the Jobs page for the exact title or company.",
    };
  }

  if (match.contacts.length === 0) {
    return {
      available: true,
      hasContacts: false,
      job: { title: match.title ?? "Untitled role", company: match.company ?? "Unknown company" },
      reason:
        "No contacts on file for this one yet — I don't auto-discover hiring managers or recruiters. Add one from the application's Networking tab if you know who to reach.",
    };
  }

  return {
    available: true,
    hasContacts: true,
    job: { title: match.title ?? "Untitled role", company: match.company ?? "Unknown company" },
    contacts: match.contacts
      .sort((a, b) => (b.warmth ?? -1) - (a.warmth ?? -1))
      .map((c) => ({ name: c.name, role: c.role, contactType: c.contactType })),
  };
}
