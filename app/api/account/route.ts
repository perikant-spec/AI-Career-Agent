import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";
import { deleteAccountSchema } from "@/lib/validation/auth";
import { getStorageProvider } from "@/lib/storage";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";

/** Password-confirmed, self-service, irreversible. Every user-owned table cascades from the
 *  User row (`onDelete: Cascade` on every relation in the schema), so this is the only DB
 *  operation needed; uploaded resume files live on disk outside the DB and are cleaned up
 *  separately via storage.deleteAll. No admin path exists that can do this on a user's behalf —
 *  the caller must supply their own current password. */
export async function DELETE(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = checkRateLimit(`delete-account:${userId}`, 60 * 60 * 1000, 5);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds!);

  const body = await request.json().catch(() => null);
  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  await getStorageProvider().deleteAll(userId);
  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ success: true });
}
