import { describe, it, expect } from "vitest";
import { generateOutreachMessageHeuristic } from "@/lib/ai/providers/mock/outreachMessage";
import type { OutreachMessageRequest } from "@/lib/ai/types";

function request(overrides: Partial<OutreachMessageRequest> = {}): OutreachMessageRequest {
  return {
    jobTitle: "Group Product Manager",
    companyName: "Globex",
    topMatchedSkills: ["SQL", "Roadmapping"],
    topRelevantPhrase: "Owned the activation roadmap across three squads.",
    citedEntities: [{ id: "e1", label: "Acme bullet", value: "Owned the activation roadmap" }],
    contactName: "Dana Reyes",
    contactRole: "Director of Product",
    messageType: "CONNECTION_REQUEST",
    relationshipNote: undefined,
    ...overrides,
  };
}

describe("generateOutreachMessageHeuristic", () => {
  it("addresses the contact by first name", () => {
    const result = generateOutreachMessageHeuristic(request());
    expect(result.content).toContain("Dana");
  });

  it("never fabricates a shared history when relationshipNote is absent", () => {
    const result = generateOutreachMessageHeuristic(request({ relationshipNote: undefined }));
    expect(result.content).not.toMatch(/mutual|worked together|alumni/i);
  });

  it("incorporates the user's own relationshipNote verbatim rather than inventing one", () => {
    const note = "We met at a product conference last year.";
    const result = generateOutreachMessageHeuristic(request({ relationshipNote: note, messageType: "REFERRAL_ASK" }));
    expect(result.content).toContain(note);
  });

  it("produces a distinct template per message type", () => {
    const types: OutreachMessageRequest["messageType"][] = [
      "CONNECTION_REQUEST",
      "AFTER_CONNECT",
      "RECRUITER_MESSAGE",
      "HIRING_MANAGER_MESSAGE",
      "REFERRAL_ASK",
      "FOLLOW_UP",
    ];
    const contents = types.map((messageType) => generateOutreachMessageHeuristic(request({ messageType })).content);
    expect(new Set(contents).size).toBe(types.length);
  });

  it("only cites entities actually offered, passed through unchanged", () => {
    const result = generateOutreachMessageHeuristic(request());
    expect(result.citedEntityIds).toEqual(["e1"]);
  });

  it("degrades gracefully with no matched skills, no relevant phrase, and no cited entities", () => {
    const result = generateOutreachMessageHeuristic(
      request({ topMatchedSkills: [], topRelevantPhrase: undefined, citedEntities: [] })
    );
    expect(result.content).toContain("Globex");
    expect(result.citedEntityIds).toEqual([]);
  });

  it("mentions the job title and company for a hiring manager message", () => {
    const result = generateOutreachMessageHeuristic(request({ messageType: "HIRING_MANAGER_MESSAGE" }));
    expect(result.content).toContain("Group Product Manager");
    expect(result.content).toContain("Globex");
  });
});
