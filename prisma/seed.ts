// Creates one demo account with a resume already parsed into a Career Profile and a few
// scored jobs, so a reviewer can see the product mid-use instead of staring at empty states.
// Safe to re-run — skips seeding if the demo account already has data.
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { extractAndValidateResumeEntries } from "../lib/profile/buildProfileEntries";
import { extractJobRequirements } from "../lib/jobs/extractJob";
import { scoreJobForUser } from "../lib/scoring/scoreJob";
import { ensureApplicationPackage } from "../lib/application/generateApplicationPackage";
import { ensureOutreachMessage } from "../lib/networking/generateOutreachMessage";
import { ensureFollowUpForApplication } from "../lib/followups/ensureFollowUp";
import { ensureInterviewPrep } from "../lib/interview/generateInterviewPrep";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo12345";

const DEMO_RESUME = `Peri Kant
peri.kant@example.com

Summary
Product manager with 6 years in B2B SaaS, focused on onboarding and activation.

Experience
Senior Product Manager, Acme Inc.
March 2021 - Present
- Ran onboarding experiments that lifted activation 18%.
- Owned the activation roadmap across three squads.
- Managed 2 direct reports and the customer support handoff.

Product Manager, Globex Corp
June 2018 - February 2021
- Launched the self-serve billing flow, reducing support tickets 30%.
- Led cross-functional planning with design and engineering.

Education
Bachelor of Science in Computer Science, State University

Skills
Product management, roadmapping, SQL, stakeholder management, Jira, A/B testing

Certifications
Certified Scrum Master`;

const DEMO_JOBS = [
  `Group Product Manager

Globex is hiring a Group Product Manager to own our activation roadmap.

Location: Remote (US)
Salary: $150,000 - $180,000

Required:
- 6+ years of product management experience
- Strong SQL and stakeholder management skills
- Experience with roadmapping and A/B testing

Preferred:
- Familiarity with Jira and experimentation platforms

This is a senior role. No visa sponsorship is available for this position.`,
  `Cloud Security Engineer

SecureCorp is hiring a Cloud Security Engineer.

Required:
- 5+ years of security experience
- AWS Certified Solutions Architect required
- Strong SQL skills

This is a senior role.`,
  `PM needed. Remote. Apply now.`,
];

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    const resumeCount = await prisma.resumeDocument.count({ where: { userId: existing.id } });
    if (resumeCount > 0) {
      console.log(`Demo account already seeded (${DEMO_EMAIL}) — skipping.`);
      return;
    }
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user =
    existing ??
    (await prisma.user.create({
      data: { email: DEMO_EMAIL, passwordHash, name: "Peri Kant" },
    }));

  const resumeDocument = await prisma.resumeDocument.create({
    data: {
      userId: user.id,
      fileName: "demo-resume.txt",
      storageKey: "seed/demo-resume.txt",
      mimeType: "text/plain",
      fileSizeBytes: Buffer.byteLength(DEMO_RESUME, "utf-8"),
      rawText: DEMO_RESUME,
      extractionStatus: "SUCCESS",
      isMaster: true,
    },
  });

  const extraction = await extractAndValidateResumeEntries(DEMO_RESUME, resumeDocument.id);
  await prisma.$transaction(
    extraction.entries.map((entry, i) =>
      prisma.careerProfileEntry.create({
        data: {
          userId: user.id,
          sourceDocumentId: resumeDocument.id,
          section: entry.section,
          label: entry.label,
          value: entry.value,
          structuredData: entry.structuredData ? JSON.stringify(entry.structuredData) : undefined,
          confidence: entry.confidence,
          basisText: entry.basisText,
          sourceSpanStart: entry.sourceSpan?.start,
          sourceSpanEnd: entry.sourceSpan?.end,
          sourceSpanText: entry.sourceSpan?.text,
          orderIndex: i,
        },
      })
    )
  );

  for (const [i, rawText] of DEMO_JOBS.entries()) {
    const jobExtraction = await extractJobRequirements(rawText);
    const job = await prisma.job.create({
      data: {
        userId: user.id,
        source: "MANUAL_PASTE",
        rawText,
        title: jobExtraction.title,
        company: jobExtraction.company,
        locationText: jobExtraction.location ?? jobExtraction.parsedRequirements.locationText,
        parsedRequirements: JSON.stringify(jobExtraction.parsedRequirements),
        extractionConfidence: jobExtraction.extractionConfidence,
      },
    });
    await scoreJobForUser(user.id, job.id);
    // Mirrors what POST /api/jobs does — every scored job enters the tracker at Discovered.
    const application = await prisma.application.create({ data: { userId: user.id, jobId: job.id } });
    if (i === 0) {
      // Showcase the full application workspace on the strongest match: resume, cover letter,
      // and Q&A generated and approved, sitting at Ready to Apply.
      await ensureApplicationPackage(user.id, job.id);
      await prisma.application.update({
        where: { id: application.id },
        data: {
          status: "READY_TO_APPLY",
          resumeApproved: true,
          coverLetterApproved: true,
          qaApproved: true,
        },
      });

      // Showcase networking too: a user-supplied contact with a drafted connection request.
      const contact = await prisma.contact.create({
        data: {
          userId: user.id,
          jobId: job.id,
          name: "Dana Reyes",
          role: "Director of Product",
          contactType: "HIRING_MANAGER",
          relationshipNote: "Found her listed as the hiring manager on the posting.",
          warmth: 20,
          profileUrl: "https://www.linkedin.com/in/example-dana-reyes",
        },
      });
      await ensureOutreachMessage(user.id, contact.id, "CONNECTION_REQUEST");
    } else if (i === 1) {
      // A second application mid-pipeline, further along than Discovered — applied 10 days ago
      // with the default 7-day follow-up timer, so its reminder shows up overdue in the demo.
      const appliedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await prisma.application.update({
        where: { id: application.id },
        data: { status: "SCREENING", appliedAt },
      });
      await ensureFollowUpForApplication(user.id, application.id, appliedAt);
    } else if (i === 2) {
      // Third application at Interview stage, so its prep workspace (company research,
      // question sets, STAR answers) is generated and browsable in the demo.
      await prisma.application.update({ where: { id: application.id }, data: { status: "INTERVIEW", appliedAt: new Date() } });
      await ensureInterviewPrep(user.id, application.id);
    }
  }

  console.log(`Seeded demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
