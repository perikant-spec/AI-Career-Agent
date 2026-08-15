import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getMailProvider } from "@/lib/mail";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const BCRYPT_COST = 12; // matches passwordHash elsewhere (app/api/auth/register/route.ts)

/**
 * Always resolves the same way regardless of whether the account exists — the caller must not
 * branch on this to avoid leaking which emails are registered. Only sends mail when a matching
 * account is found.
 */
export async function requestPasswordReset(email: string, baseUrl: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return;

  // Only the bcrypt hash of the token is stored — same rule as passwords. The raw token exists
  // only in the emailed link and the requester's browser.
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(rawToken, BCRYPT_COST);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
  await getMailProvider().sendMail({
    to: user.email,
    subject: "Reset your Career Agent password",
    text: `Someone requested a password reset for this account.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email — your password hasn't changed.`,
  });
}

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
}

export async function resetPassword(email: string, token: string, newPassword: string): Promise<ResetPasswordResult> {
  const invalidResult = { success: false, error: "This reset link is invalid or has expired." };

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordResetTokenHash || !user.passwordResetTokenExpiresAt) {
    return invalidResult;
  }
  if (user.passwordResetTokenExpiresAt.getTime() < Date.now()) {
    return invalidResult;
  }

  const valid = await bcrypt.compare(token, user.passwordResetTokenHash);
  if (!valid) return invalidResult;

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await prisma.user.update({
    where: { id: user.id },
    // Single-use: cleared the moment it's consumed, success or not reusable after.
    data: { passwordHash, passwordResetTokenHash: null, passwordResetTokenExpiresAt: null },
  });

  return { success: true };
}
