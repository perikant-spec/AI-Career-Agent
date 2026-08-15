import { prisma } from "@/lib/prisma";

/**
 * Milestone 5 built the actual customizer — this intent now reports real status (does a
 * matching job exist, is a tailored version already generated) instead of a blanket decline.
 * It stays read-only: the assistant directs the user to the button that does the generating,
 * rather than triggering a mutating action from chat.
 */
export async function customizeResume(userId: string, query: string) {
  const jobs = await prisma.job.findMany({ where: { userId } });
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

  const existingVersion = await prisma.resumeVersion.findUnique({
    where: { userId_jobId: { userId, jobId: match.id } },
  });

  return {
    available: true,
    job: { title: match.title ?? "Untitled role", company: match.company ?? "Unknown company" },
    alreadyGenerated: !!existingVersion,
  };
}
