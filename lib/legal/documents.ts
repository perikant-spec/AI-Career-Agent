/**
 * The technical hook legal documents connect to — not the documents themselves. Nothing in this
 * file is legal advice or a substitute for real counsel-drafted Terms of Service / Privacy
 * Policy text; `body: null` means exactly that: no legal document has been supplied yet.
 * app/terms/page.tsx and app/privacy/page.tsx render an explicit placeholder notice when body is
 * null, never invented policy language.
 *
 * `version` is what gets stamped onto User.termsVersion/privacyVersion at the moment a user
 * accepts (see app/api/auth/register/route.ts) — bump it whenever real content is published or
 * materially changed so hasCurrentConsent() can detect who needs to re-consent.
 */
export type LegalDocSlug = "terms" | "privacy";

export interface LegalDocument {
  slug: LegalDocSlug;
  title: string;
  version: string;
  /** null until legal counsel supplies real text — never filled with placeholder prose. */
  body: string | null;
}

export const LEGAL_DOCUMENTS: Record<LegalDocSlug, LegalDocument> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    version: "unpublished-draft-1",
    body: null,
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    version: "unpublished-draft-1",
    body: null,
  },
};

export function getLegalDocument(slug: LegalDocSlug): LegalDocument {
  return LEGAL_DOCUMENTS[slug];
}

/** True only when the user has accepted the *current* version of both documents — a version
 *  bump (real content replacing a placeholder, or a later material change) makes every existing
 *  acceptance stale until re-confirmed. */
export function hasCurrentConsent(user: {
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  privacyAcceptedAt: Date | null;
  privacyVersion: string | null;
}): boolean {
  return (
    user.termsAcceptedAt !== null &&
    user.termsVersion === LEGAL_DOCUMENTS.terms.version &&
    user.privacyAcceptedAt !== null &&
    user.privacyVersion === LEGAL_DOCUMENTS.privacy.version
  );
}
