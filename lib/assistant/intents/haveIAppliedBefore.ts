import { prisma } from "@/lib/prisma";

/** Milestone 6 built the Application entity — this now checks real data instead of declining. */
export async function haveIAppliedBefore(userId: string, query: string) {
  const q = query.toLowerCase();

  const applications = await prisma.application.findMany({
    where: { userId },
    include: { job: true },
  });

  const match = applications.find((a) => {
    const company = (a.job.company ?? "").toLowerCase();
    return company && (company.includes(q) || q.includes(company));
  });

  if (!match) {
    return {
      available: false,
      reason: "I couldn't find a job matching that company — check the Jobs page for the exact name.",
    };
  }

  return {
    available: true,
    company: match.job.company ?? "Unknown company",
    applied: !!match.appliedAt,
    status: match.status,
  };
}
