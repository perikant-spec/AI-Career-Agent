import { describe, it, expect } from "vitest";
import { registerSchema } from "@/lib/validation/auth";
import { LEGAL_DOCUMENTS, getLegalDocument, hasCurrentConsent } from "@/lib/legal/documents";

describe("registerSchema — legal consent is required to create an account", () => {
  const base = { email: "person@example.com", password: "longenoughpassword" };

  it("rejects registration when acceptedLegal is missing", () => {
    const result = registerSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("rejects registration when acceptedLegal is explicitly false", () => {
    const result = registerSchema.safeParse({ ...base, acceptedLegal: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/terms of service/i);
    }
  });

  it("accepts registration when acceptedLegal is true", () => {
    const result = registerSchema.safeParse({ ...base, acceptedLegal: true });
    expect(result.success).toBe(true);
  });
});

describe("lib/legal/documents.ts — technical hooks, not invented legal text", () => {
  it("every document is a real placeholder (body: null) rather than fabricated policy language", () => {
    for (const slug of ["terms", "privacy"] as const) {
      const doc = getLegalDocument(slug);
      expect(doc.body).toBeNull();
      expect(doc.version).toBeTruthy();
      expect(doc.title.length).toBeGreaterThan(0);
    }
  });

  it("terms and privacy carry independently versioned identities", () => {
    expect(LEGAL_DOCUMENTS.terms.slug).toBe("terms");
    expect(LEGAL_DOCUMENTS.privacy.slug).toBe("privacy");
  });
});

describe("hasCurrentConsent", () => {
  const currentUser = {
    termsAcceptedAt: new Date(),
    termsVersion: LEGAL_DOCUMENTS.terms.version,
    privacyAcceptedAt: new Date(),
    privacyVersion: LEGAL_DOCUMENTS.privacy.version,
  };

  it("is true when both documents were accepted at their current version", () => {
    expect(hasCurrentConsent(currentUser)).toBe(true);
  });

  it("is false when consent was never recorded", () => {
    expect(
      hasCurrentConsent({ termsAcceptedAt: null, termsVersion: null, privacyAcceptedAt: null, privacyVersion: null })
    ).toBe(false);
  });

  it("is false when the accepted version is stale (a legal doc was updated since)", () => {
    expect(hasCurrentConsent({ ...currentUser, termsVersion: "some-old-version" })).toBe(false);
    expect(hasCurrentConsent({ ...currentUser, privacyVersion: "some-old-version" })).toBe(false);
  });

  it("is false when only one of the two documents was accepted", () => {
    expect(hasCurrentConsent({ ...currentUser, privacyAcceptedAt: null })).toBe(false);
  });
});
