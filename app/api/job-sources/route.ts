import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Connection status only — never exposes key values, and the presence check itself is the
// entire gate for whether the Adzuna import route will do anything.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    sources: [
      {
        id: "manual",
        name: "Manual paste / URL",
        configured: true,
        description: "Always available — paste a job posting's text on the Jobs page.",
      },
      {
        id: "adzuna",
        name: "Adzuna",
        configured: Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
        description: "Licensed job-search API. Free self-serve signup at developer.adzuna.com.",
      },
    ],
  });
}
