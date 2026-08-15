import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Unauthenticated on purpose — deployment platforms and uptime monitors hit this without a
// session. Confirms the app can actually reach its database, not just that the process is
// running (a hung DB connection is a real failure mode a bare "200 OK" would miss).
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch {
    return NextResponse.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
