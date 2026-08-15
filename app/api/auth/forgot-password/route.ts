import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/lib/auth/passwordReset";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";

export async function POST(request: Request) {
  const rate = checkRateLimit(`forgot-password:${getClientIp(request)}`, 60 * 60 * 1000, 5);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);

  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const baseUrl = new URL(request.url).origin;
  await requestPasswordReset(parsed.data.email, baseUrl);

  // Same response whether or not the account exists — never confirm/deny a registered email.
  return NextResponse.json({
    message: "If an account exists for that email, a reset link is on its way.",
  });
}
