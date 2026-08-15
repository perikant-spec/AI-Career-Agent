import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { signMobileToken } from "@/lib/mobile/auth";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // Keyed by IP+email (not IP alone) — caps brute-forcing one account without also blocking a
  // shared network (office Wi-Fi, campus NAT) from signing into different accounts.
  const rate = checkRateLimit(`mobile-login:${getClientIp(request)}:${email}`, 15 * 60 * 1000, 10);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !valid) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const token = await signMobileToken(user.id);
  return NextResponse.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
}
