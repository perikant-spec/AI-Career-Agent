import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPassword } from "@/lib/auth/passwordReset";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";

export async function POST(request: Request) {
  const rate = checkRateLimit(`reset-password:${getClientIp(request)}`, 60 * 60 * 1000, 10);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);

  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { email, token, password } = parsed.data;
  const result = await resetPassword(email, token, password);
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Couldn't reset your password." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
