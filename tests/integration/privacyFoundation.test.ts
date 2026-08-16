import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";
import { createWebSession } from "./helpers/webSession";

// Requires a running dev server against a real database — same convention as the other
// tests/integration specs (see tests/integration/fullWorkflow.e2e.test.ts).
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const STEP_TIMEOUT = 30000;

async function serverReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON (status ${res.status}), got: ${text.slice(0, 300)}`);
  }
}

const createdUserIds: string[] = [];
let serverUp = false;

beforeAll(async () => {
  serverUp = await serverReachable();
}, 10000);

afterAll(async () => {
  const ids = createdUserIds.filter(Boolean);
  if (ids.length > 0) await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("Privacy foundation — consent, legal pages, AI data usage preference", () => {
  it(
    "registration is rejected without acceptedLegal: true",
    async () => {
      if (!serverUp) return console.warn("Dev server not reachable — skipping.");
      const email = `privacy-consent-${randomUUID()}@example.com`;

      const missing = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "longenoughpassword" }),
      });
      expect(missing.status).toBe(400);

      const declined = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "longenoughpassword", acceptedLegal: false }),
      });
      expect(declined.status).toBe(400);

      const noRow = await prisma.user.findUnique({ where: { email } });
      expect(noRow).toBeNull();
    },
    STEP_TIMEOUT
  );

  it(
    "registration with acceptedLegal: true records the exact current legal-document versions and an acceptance timestamp",
    async () => {
      if (!serverUp) return console.warn("Dev server not reachable — skipping.");
      const email = `privacy-consent-${randomUUID()}@example.com`;
      const beforeRegister = new Date();

      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "longenoughpassword", acceptedLegal: true }),
      });
      expect(res.status).toBe(201);
      const { user } = await json<{ user: { id: string } }>(res);
      createdUserIds.push(user.id);

      const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.termsVersion).toBe(LEGAL_DOCUMENTS.terms.version);
      expect(row.privacyVersion).toBe(LEGAL_DOCUMENTS.privacy.version);
      expect(row.termsAcceptedAt).not.toBeNull();
      expect(row.privacyAcceptedAt).not.toBeNull();
      expect(row.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(beforeRegister.getTime());
    },
    STEP_TIMEOUT
  );

  it(
    "GET /terms and /privacy render the placeholder notice, not fabricated legal text",
    async () => {
      if (!serverUp) return console.warn("Dev server not reachable — skipping.");
      for (const path of ["/terms", "/privacy"]) {
        const res = await fetch(`${BASE_URL}${path}`);
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toMatch(/has not been published yet|placeholder/i);
      }
    },
    STEP_TIMEOUT
  );

  it(
    "AI training preference defaults to false and is persisted through the preferences API",
    async () => {
      if (!serverUp) return console.warn("Dev server not reachable — skipping.");
      const email = `privacy-aiopt-${randomUUID()}@example.com`;
      const password = "longenoughpassword";

      const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, acceptedLegal: true }),
      });
      const { user } = await json<{ user: { id: string } }>(registerRes);
      createdUserIds.push(user.id);
      const cookie = await createWebSession(BASE_URL, email, password);

      const initial = await fetch(`${BASE_URL}/api/preferences`, { headers: { Cookie: cookie } });
      const initialBody = await json<{ preferences: { aiTrainingOptIn: boolean } }>(initial);
      expect(initialBody.preferences.aiTrainingOptIn).toBe(false);

      const putRes = await fetch(`${BASE_URL}/api/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ aiTrainingOptIn: true }),
      });
      const putBody = await json<{ preferences: { aiTrainingOptIn: boolean } }>(putRes);
      expect(putBody.preferences.aiTrainingOptIn).toBe(true);

      const refetched = await fetch(`${BASE_URL}/api/preferences`, { headers: { Cookie: cookie } });
      const refetchedBody = await json<{ preferences: { aiTrainingOptIn: boolean } }>(refetched);
      expect(refetchedBody.preferences.aiTrainingOptIn).toBe(true);

      // Persisted at the DB layer, not just echoed back by the API.
      const prefsRow = await prisma.userPreferences.findUniqueOrThrow({ where: { userId: user.id } });
      expect(prefsRow.aiTrainingOptIn).toBe(true);
    },
    STEP_TIMEOUT
  );

  it(
    "account export includes consent metadata",
    async () => {
      if (!serverUp) return console.warn("Dev server not reachable — skipping.");
      const email = `privacy-export-${randomUUID()}@example.com`;
      const password = "longenoughpassword";

      const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, acceptedLegal: true }),
      });
      const { user } = await json<{ user: { id: string } }>(registerRes);
      createdUserIds.push(user.id);
      const cookie = await createWebSession(BASE_URL, email, password);

      const exportRes = await fetch(`${BASE_URL}/api/account/export`, { headers: { Cookie: cookie } });
      expect(exportRes.status).toBe(200);
      const exportBody = await json<{ user: { termsVersion: string; privacyVersion: string; termsAcceptedAt: string } }>(exportRes);
      expect(exportBody.user.termsVersion).toBe(LEGAL_DOCUMENTS.terms.version);
      expect(exportBody.user.privacyVersion).toBe(LEGAL_DOCUMENTS.privacy.version);
      expect(exportBody.user.termsAcceptedAt).toBeTruthy();
    },
    STEP_TIMEOUT
  );
});
