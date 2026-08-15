import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation/auth";
import { signMobileToken } from "@/lib/mobile/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";

export async function POST(request: Request) {
  const rate = checkRateLimit(`mobile-register:${getClientIp(request)}`, 60 * 60 * 1000, 5);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
    select: { id: true, email: true, name: true },
  });

  const token = await signMobileToken(user.id);
  return NextResponse.json({ token, user }, { status: 201 });
}
