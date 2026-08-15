import { describe, it, expect } from "vitest";
import { classifyIntent } from "@/lib/assistant/intentClassifier";

describe("classifyIntent", () => {
  it("maps 'what should I apply to today' phrasing to WHAT_SHOULD_I_APPLY_TODAY", () => {
    expect(classifyIntent("What should I apply to today?").intent).toBe("WHAT_SHOULD_I_APPLY_TODAY");
    expect(classifyIntent("what to apply for this week").intent).toBe("WHAT_SHOULD_I_APPLY_TODAY");
  });

  it("maps score-explanation phrasing to EXPLAIN_JOB_SCORE and extracts the entity", () => {
    const result = classifyIntent("Why was Globex marked don't apply?");
    expect(result.intent).toBe("EXPLAIN_JOB_SCORE");
    expect(result.entityQuery).toMatch(/Globex/i);
  });

  it("maps resume-tailoring phrasing to CUSTOMIZE_RESUME", () => {
    expect(classifyIntent("Can you customize my resume for Acme?").intent).toBe("CUSTOMIZE_RESUME");
    expect(classifyIntent("tailor my resume").intent).toBe("CUSTOMIZE_RESUME");
  });

  it("maps prior-application phrasing to the honest HAVE_I_APPLIED_BEFORE decline path", () => {
    expect(classifyIntent("Have I applied to Initech before?").intent).toBe("HAVE_I_APPLIED_BEFORE");
  });

  it("maps 'prepare my application' phrasing to CUSTOMIZE_RESUME, not PREPARE_FOR_INTERVIEW", () => {
    expect(classifyIntent("Prepare my application for Globex").intent).toBe("CUSTOMIZE_RESUME");
  });

  it("maps interview-prep phrasing to PREPARE_FOR_INTERVIEW", () => {
    expect(classifyIntent("Prepare me for my interview").intent).toBe("PREPARE_FOR_INTERVIEW");
    expect(classifyIntent("Can you help with interview prep for Globex?").intent).toBe("PREPARE_FOR_INTERVIEW");
  });

  it("maps contact-finding phrasing to FIND_CONTACT", () => {
    expect(classifyIntent("Find the hiring manager for Globex").intent).toBe("FIND_CONTACT");
    expect(classifyIntent("Who should I contact at Acme?").intent).toBe("FIND_CONTACT");
  });

  it("maps 'why am I not hearing back' phrasing to WHY_NOT_HEARING_BACK", () => {
    expect(classifyIntent("Why am I not hearing back?").intent).toBe("WHY_NOT_HEARING_BACK");
    expect(classifyIntent("Why aren't I getting interviews?").intent).toBe("WHY_NOT_HEARING_BACK");
  });

  it("falls back to GENERAL_FALLBACK for unrecognized phrasing", () => {
    expect(classifyIntent("What's the weather like today?").intent).toBe("GENERAL_FALLBACK");
  });
});
