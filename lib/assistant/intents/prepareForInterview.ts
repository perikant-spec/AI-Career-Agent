import { prisma } from "@/lib/prisma";

/** Reports real readiness (rehearsed count / total) for applications at Interview stage —
 *  never invents a readiness figure, and is honest when there's nothing at that stage yet. */
export async function prepareForInterview(userId: string, query: string) {
  const applications = await prisma.application.findMany({
    where: { userId, status: { in: ["INTERVIEW", "FINAL_INTERVIEW"] } },
    include: { job: true, interviewPrep: { include: { questions: true } } },
  });

  if (applications.length === 0) {
    return {
      available: false,
      reason: "No applications at Interview stage yet — prep builds automatically once one moves there.",
    };
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? applications.filter((a) => {
        const title = (a.job.title ?? "").toLowerCase();
        const company = (a.job.company ?? "").toLowerCase();
        return (title && (title.includes(q) || q.includes(title))) || (company && (company.includes(q) || q.includes(company)));
      })
    : applications;

  const list = (filtered.length > 0 ? filtered : applications).map((a) => {
    const total = a.interviewPrep?.questions.length ?? 0;
    const rehearsed = a.interviewPrep?.questions.filter((qu) => qu.rehearsed).length ?? 0;
    return {
      applicationId: a.id,
      company: a.job.company ?? "Unknown company",
      title: a.job.title ?? "Untitled role",
      readiness: total > 0 ? Math.round((rehearsed / total) * 100) : 0,
      rehearsedCount: rehearsed,
      totalCount: total,
    };
  });

  return { available: true, applications: list };
}
