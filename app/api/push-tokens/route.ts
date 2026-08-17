import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/auth/resolveUserId";

const registerSchema = z.object({
  token: z.string().trim().min(1),
  platform: z.enum(["IOS", "ANDROID", "WEB"]),
});

const unregisterSchema = z.object({
  token: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  // Upsert on the token itself, not (userId, token) -- a token can legitimately move to a
  // different account on the same device (e.g. sign out, sign in as someone else), and the new
  // owner's registration should win rather than erroring on a stale unique-constraint conflict.
  const pushToken = await prisma.pushToken.upsert({
    where: { token: parsed.data.token },
    create: { userId, token: parsed.data.token, platform: parsed.data.platform },
    update: { userId, platform: parsed.data.platform },
  });

  return NextResponse.json({ pushToken: { id: pushToken.id, platform: pushToken.platform } });
}

export async function DELETE(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = unregisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  // Scoped to this user's own token -- never deletes another user's row even if the token string
  // were somehow guessed, since deleteMany's where clause requires both to match.
  await prisma.pushToken.deleteMany({ where: { token: parsed.data.token, userId } });

  return NextResponse.json({ success: true });
}
