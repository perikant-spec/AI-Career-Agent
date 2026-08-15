import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

// Auth.js has no built-in signup endpoint — Credentials-only auth needs its own.
export async function POST(request: Request) {
  const rate = checkRateLimit(`register:${getClientIp(request)}`, 60 * 60 * 1000, 5);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      termsAcceptedAt: now,
      termsVersion: LEGAL_DOCUMENTS.terms.version,
      privacyAcceptedAt: now,
      privacyVersion: LEGAL_DOCUMENTS.privacy.version,
    },
    select: { id: true, email: true, name: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
