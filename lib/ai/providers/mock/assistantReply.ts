// Phrases the orchestrator's tool-call results into prose. Every branch reads only fields
// already present on `toolResults` (produced by a real DB-backed intent handler in
// lib/assistant/intents/*) — it cannot introduce a claim the tool didn't return.
export function generateAssistantReplyHeuristic(
  intent: string,
  toolResults: Record<string, unknown>
): string {
  switch (intent) {
    case "WHAT_SHOULD_I_APPLY_TODAY": {
      const jobs = (toolResults.jobs as Array<{ title: string; company: string; score: number }>) ?? [];
      if (jobs.length === 0) {
        const totalScored = (toolResults.totalScored as number) ?? 0;
        return totalScored > 0
          ? `None of your ${totalScored} scored jobs clear your usual threshold today. Rather than force a match, worth reviewing whether your target roles or resume emphasis need adjusting.`
          : "You don't have any scored jobs yet — paste a posting on the Jobs page and I'll score it against your profile.";
      }
      const lines = jobs
        .slice(0, 5)
        .map((j) => `${j.company} — ${j.title} (${j.score}% match)`)
        .join("; ");
      return `You have ${jobs.length} job${jobs.length > 1 ? "s" : ""} worth a look today: ${lines}.`;
    }

    case "EXPLAIN_JOB_SCORE": {
      if (!toolResults.found) {
        return "I couldn't find a scored job matching that name — check the Jobs page for the exact title or company.";
      }
      const job = toolResults.job as { title: string; company: string };
      const score = toolResults.score as number;
      const tier = toolResults.tierLabel as string;
      const disqualifiers = (toolResults.disqualifiers as string[]) ?? [];
      const topGaps = (toolResults.topGaps as string[]) ?? [];

      let text = `${job.company} — ${job.title} scored ${score} (${tier}).`;
      if (disqualifiers.length > 0) {
        text += ` Disqualified because: ${disqualifiers.join(" ")}`;
      } else if (topGaps.length > 0) {
        text += ` Main gaps: ${topGaps.join(" ")}`;
      }
      return text;
    }

    case "CUSTOMIZE_RESUME": {
      if (toolResults.available === false) {
        return (toolResults.reason as string) ?? "I couldn't find that job.";
      }
      const job = toolResults.job as { title: string; company: string };
      const alreadyGenerated = toolResults.alreadyGenerated as boolean;
      return alreadyGenerated
        ? `You already have a tailored resume for ${job.company} — ${job.title}. Open that job's application workspace to see it, regenerate it, or move on to the cover letter and Q&A.`
        : `Open ${job.company} — ${job.title} and click "Prepare application" — it'll build a tailored resume, cover letter, and application answers, all grounded in your verified profile.`;
    }

    case "HAVE_I_APPLIED_BEFORE": {
      if (toolResults.available === false) {
        return (toolResults.reason as string) ?? "Application tracking isn't built yet in this phase.";
      }
      const applied = toolResults.applied as boolean;
      const company = toolResults.company as string;
      return applied
        ? `Yes — you have a prior application on file for ${company}.`
        : `No prior application on file for ${company}. This would be your first.`;
    }

    case "FIND_CONTACT": {
      if (toolResults.available === false) {
        return (toolResults.reason as string) ?? "I couldn't find that job.";
      }
      const job = toolResults.job as { title: string; company: string };
      if (!toolResults.hasContacts) {
        return `${(toolResults.reason as string) ?? ""} (${job.company} — ${job.title})`.trim();
      }
      const contacts = (toolResults.contacts as Array<{ name: string; role: string | null; contactType: string }>) ?? [];
      const lines = contacts.map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ");
      return `For ${job.company} — ${job.title}, you have ${contacts.length} contact${contacts.length === 1 ? "" : "s"} on file: ${lines}.`;
    }

    case "PREPARE_FOR_INTERVIEW": {
      if (toolResults.available === false) {
        return (toolResults.reason as string) ?? "Nothing at Interview stage yet.";
      }
      const apps = (toolResults.applications as Array<{ company: string; title: string; readiness: number; rehearsedCount: number; totalCount: number }>) ?? [];
      if (apps.length === 1) {
        const a = apps[0];
        return `${a.company} — ${a.title}: ${a.readiness}% ready (${a.rehearsedCount} of ${a.totalCount} answers rehearsed). Open the interview prep workspace to keep going.`;
      }
      const lines = apps.map((a) => `${a.company} — ${a.title} (${a.readiness}% ready)`).join("; ");
      return `You have ${apps.length} applications at Interview stage: ${lines}.`;
    }

    case "WHY_NOT_HEARING_BACK": {
      const sampleSize = toolResults.sampleSize as number;
      if (toolResults.tooFewToAnalyze) {
        return `You've only applied to ${sampleSize} job${sampleSize === 1 ? "" : "s"} so far — too few to spot a reliable pattern yet. Worth revisiting this once you've applied to more.`;
      }
      const responseRate = toolResults.responseRate as number;
      const responseCount = toolResults.responseCount as number;
      const overdueFollowUps = toolResults.overdueFollowUps as number;
      let text = `Based on ${sampleSize} applications, ${responseCount} (${responseRate}%) have gotten some response (recruiter contact or further).`;
      if (toolResults.canCompareScores) {
        const avgProgressed = toolResults.avgScoreProgressed as number;
        const avgStuck = toolResults.avgScoreStuck as number;
        const nP = toolResults.progressedSampleSize as number;
        const nS = toolResults.stuckSampleSize as number;
        text += ` Applications that got a response averaged a ${avgProgressed} match score (n=${nP}) vs. ${avgStuck} for ones still waiting (n=${nS}) — a small sample, so treat this as a hint, not a rule.`;
      } else {
        text += " Not enough applications in both groups yet to compare match scores reliably.";
      }
      if (overdueFollowUps > 0) {
        text += ` You also have ${overdueFollowUps} overdue follow-up${overdueFollowUps === 1 ? "" : "s"} — worth sending those.`;
      }
      return text;
    }

    default:
      return "I'm not sure how to help with that yet — try asking what to apply to today, or why a specific job was scored the way it was.";
  }
}
