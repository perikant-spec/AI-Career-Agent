import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";
import { MAX_RESUME_FILE_SIZE_BYTES, isAllowedResumeFile } from "@/lib/storage/types";
import { extractResumeText } from "@/lib/resumeText/extract";
import { extractAndValidateResumeEntries } from "@/lib/profile/buildProfileEntries";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resumes = await prisma.resumeDocument.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSizeBytes: true,
      extractionStatus: true,
      extractionError: true,
      isMaster: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ resumes });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }
  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large (10MB max)." }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedResumeFile(mimeType, file.name)) {
    return NextResponse.json(
      { error: "Only PDF and DOCX files are supported. Try exporting to one of those, or paste your resume text directly." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const extraction = await extractResumeText(buffer, mimeType, file.name);
  const storageKey = await getStorageProvider().put({ userId, fileName: file.name, mimeType, data: buffer });

  const existingCount = await prisma.resumeDocument.count({ where: { userId } });
  const isMaster = existingCount === 0;

  const resumeDocument = await prisma.resumeDocument.create({
    data: {
      userId,
      fileName: file.name,
      storageKey,
      mimeType,
      fileSizeBytes: file.size,
      rawText: extraction.text,
      extractionStatus: extraction.status,
      extractionError: extraction.error,
      isMaster,
    },
  });

  if (extraction.status !== "SUCCESS") {
    return NextResponse.json({
      resume: {
        id: resumeDocument.id,
        fileName: resumeDocument.fileName,
        extractionStatus: resumeDocument.extractionStatus,
        extractionError: resumeDocument.extractionError,
      },
      profileEntriesCreated: 0,
      warnings: [],
      conflicts: [],
    });
  }

  let aiStatus: "SUCCESS" | "ERROR" = "SUCCESS";
  let result;
  try {
    result = await extractAndValidateResumeEntries(extraction.text, resumeDocument.id);
  } catch (err) {
    aiStatus = "ERROR";
    await prisma.aIInteraction.create({
      data: {
        userId,
        toolName: "resume.extract",
        provider: "unknown",
        inputRef: resumeDocument.id,
        outputRef: "",
        status: "ERROR",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      },
    });
    return NextResponse.json(
      { error: "Resume extraction failed. Please try again or paste your resume text directly." },
      { status: 500 }
    );
  }

  const existingEntryCount = await prisma.careerProfileEntry.count({ where: { userId } });

  await prisma.$transaction([
    ...result.entries.map((entry, i) =>
      prisma.careerProfileEntry.create({
        data: {
          userId,
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
          orderIndex: existingEntryCount + i,
        },
      })
    ),
    prisma.aIInteraction.create({
      data: {
        userId,
        toolName: "resume.extract",
        provider: result.provider,
        providerVersion: result.providerVersion,
        inputRef: resumeDocument.id,
        outputRef: `${result.entries.length} entries`,
        status: aiStatus,
      },
    }),
  ]);

  return NextResponse.json({
    resume: {
      id: resumeDocument.id,
      fileName: resumeDocument.fileName,
      extractionStatus: resumeDocument.extractionStatus,
    },
    profileEntriesCreated: result.entries.length,
    warnings: result.warnings,
    conflicts: result.conflicts,
  });
}
