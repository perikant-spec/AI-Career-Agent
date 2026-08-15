import { describe, it, expect } from "vitest";
import { validateEntry, pinManualEntryConfidence, validateCitations } from "@/lib/evidence/validator";

const SOURCE = `Senior Product Manager, Acme Inc.
March 2021 - Present
- Ran onboarding experiments that lifted activation 18%.
- Managed 2 direct reports and the customer support handoff.`;

describe("validateEntry — exact match", () => {
  it("confirms a verbatim quote as VERIFIED and returns its real span", () => {
    const result = validateEntry(
      {
        value: "Ran onboarding experiments that lifted activation 18%.",
        confidence: "VERIFIED",
        sourceSpan: {
          start: 0,
          end: 0,
          text: "Ran onboarding experiments that lifted activation 18%.",
        },
      },
      SOURCE
    );
    expect(result.confidence).toBe("VERIFIED");
    expect(result.matchedVia).toBe("EXACT");
    expect(result.span?.text).toContain("18%");
  });

  it("is case/whitespace-insensitive but still requires the real substring", () => {
    const result = validateEntry(
      { value: "senior product manager,   acme inc.", confidence: "VERIFIED" },
      SOURCE
    );
    expect(result.confidence).toBe("VERIFIED");
    expect(result.matchedVia).toBe("EXACT");
  });
});

describe("validateEntry — fuzzy match caps at SUPPORTED_INFERENCE", () => {
  it("never lets a fuzzy match justify VERIFIED", () => {
    const result = validateEntry(
      {
        value: "leadership",
        confidence: "VERIFIED",
        sourceSpan: {
          start: 0,
          end: 0,
          text: "Managed 2 direct reports and the customer support handoff",
        },
      },
      SOURCE
    );
    // The quote itself ("Managed 2 direct reports...") IS an exact substring of SOURCE, so
    // this should actually resolve EXACT — use a genuinely partial/reworded quote instead to
    // exercise the fuzzy path.
    expect(result.matchedVia).toBe("EXACT");

    const fuzzyResult = validateEntry(
      {
        value: "leadership",
        confidence: "VERIFIED",
        sourceSpan: {
          start: 0,
          end: 0,
          text: "Managed direct reports and customer support handoff duties",
        },
      },
      SOURCE
    );
    expect(fuzzyResult.matchedVia).not.toBe("EXACT");
    if (fuzzyResult.matchedVia === "FUZZY") {
      expect(fuzzyResult.confidence).toBe("SUPPORTED_INFERENCE");
    } else {
      expect(fuzzyResult.confidence).toBe("NOT_VERIFIED");
    }
  });
});

describe("validateEntry — downgrade-only rule", () => {
  it("downgrades a claim with no real basis in the source to NOT_VERIFIED", () => {
    const result = validateEntry(
      { value: "Fluent in Mandarin and led a 200-person org", confidence: "VERIFIED" },
      SOURCE
    );
    expect(result.confidence).toBe("NOT_VERIFIED");
    expect(result.matchedVia).toBe("NONE");
  });

  it("never upgrades a claim beyond what was originally asserted, even with a perfect match", () => {
    const result = validateEntry(
      {
        value: "Ran onboarding experiments that lifted activation 18%.",
        confidence: "NOT_VERIFIED",
        sourceSpan: {
          start: 0,
          end: 0,
          text: "Ran onboarding experiments that lifted activation 18%.",
        },
      },
      SOURCE
    );
    // Structurally this is a perfect EXACT match (would justify VERIFIED), but the entry only
    // claimed NOT_VERIFIED — the validator must not upgrade it.
    expect(result.confidence).toBe("NOT_VERIFIED");
  });

  it("leaves MISSING entries as MISSING without attempting a match", () => {
    const result = validateEntry({ value: "", confidence: "MISSING" }, SOURCE);
    expect(result.confidence).toBe("MISSING");
    expect(result.matchedVia).toBe("NONE");
  });
});

describe("pinManualEntryConfidence", () => {
  it("always returns NOT_VERIFIED — a user cannot self-declare a higher confidence", () => {
    expect(pinManualEntryConfidence()).toBe("NOT_VERIFIED");
  });
});

describe("validateCitations", () => {
  it("accepts citations that resolve to allowed entity ids", () => {
    const result = validateCitations(["a", "b"], new Set(["a", "b", "c"]));
    expect(result.valid).toBe(true);
    expect(result.invalidIds).toHaveLength(0);
  });

  it("flags citations to ids outside the allowed set as fabricated references", () => {
    const result = validateCitations(["a", "ghost-id"], new Set(["a", "b"]));
    expect(result.valid).toBe(false);
    expect(result.invalidIds).toEqual(["ghost-id"]);
  });
});
