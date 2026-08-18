import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton — avoids exhausting the Postgres connection pool across
// hot-reloads, which each re-execute this module in a fresh closure otherwise.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
