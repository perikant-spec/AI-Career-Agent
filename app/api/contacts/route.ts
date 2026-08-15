import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contacts = await prisma.contact.findMany({
    where: { userId },
    orderBy: [{ warmth: "desc" }, { createdAt: "desc" }],
    include: { job: true, messages: true },
  });

  return NextResponse.json({
    contacts: contacts.map((c) => ({
      id: c.id,
      jobId: c.jobId,
      jobTitle: c.job.title,
      company: c.job.company,
      name: c.name,
      role: c.role,
      contactType: c.contactType,
      source: c.source,
      relationshipNote: c.relationshipNote,
      warmth: c.warmth,
      profileUrl: c.profileUrl,
      messagesDrafted: c.messages.length,
      messagesSent: c.messages.filter((m) => m.status === "SENT").length,
    })),
  });
}
