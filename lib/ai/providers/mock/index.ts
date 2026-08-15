import type {
  AIProvider,
  ApplicationAnswersRequest,
  ApplicationAnswersResult,
  ApplicationGenerationFacts,
  CoverLetterResult,
  FollowUpMessageRequest,
  FollowUpMessageResult,
  JobExtractionResult,
  MockInterviewScoreRequest,
  MockInterviewScoreResult,
  OutreachMessageRequest,
  OutreachMessageResult,
  RationaleRequest,
  RationaleResult,
  ResumeCustomizationRequest,
  ResumeCustomizationResult,
  ResumeExtractionResult,
} from "@/lib/ai/types";
import { extractResumeEntitiesHeuristic } from "./resumeExtraction";
import { extractJobRequirementsHeuristic } from "./jobExtraction";
import { generateRationaleHeuristic } from "./rationale";
import { generateAssistantReplyHeuristic } from "./assistantReply";
import { generateResumeCustomizationHeuristic } from "./resumeCustomization";
import { generateCoverLetterHeuristic } from "./coverLetter";
import { generateApplicationAnswersHeuristic } from "./applicationAnswers";
import { generateOutreachMessageHeuristic } from "./outreachMessage";
import { generateFollowUpMessageHeuristic } from "./followUpMessage";
import { scoreMockInterviewResponseHeuristic } from "./mockInterviewScore";

/**
 * The zero-API-key provider — a genuine heuristic engine (section-header splitting, a curated
 * skills/certification taxonomy, date-range parsing, template-based rationale text), not
 * random placeholder output. Every extraction still passes through the Evidence Validator
 * (lib/evidence/validator.ts) exactly like the real Claude-backed provider does, so swapping
 * providers never changes what's allowed to reach the user.
 */
class MockProvider implements AIProvider {
  readonly name = "mock" as const;
  readonly version = "heuristic-1.0";

  async extractResumeEntities(rawText: string, _documentId: string): Promise<ResumeExtractionResult> {
    void _documentId;
    return extractResumeEntitiesHeuristic(rawText);
  }

  async extractJobRequirements(rawText: string): Promise<JobExtractionResult> {
    return extractJobRequirementsHeuristic(rawText);
  }

  async generateRationale(request: RationaleRequest): Promise<RationaleResult> {
    return generateRationaleHeuristic(request);
  }

  async generateAssistantReply(intent: string, toolResults: Record<string, unknown>): Promise<string> {
    return generateAssistantReplyHeuristic(intent, toolResults);
  }

  async generateResumeCustomization(request: ResumeCustomizationRequest): Promise<ResumeCustomizationResult> {
    return generateResumeCustomizationHeuristic(request);
  }

  async generateCoverLetter(facts: ApplicationGenerationFacts): Promise<CoverLetterResult> {
    return generateCoverLetterHeuristic(facts);
  }

  async generateApplicationAnswers(request: ApplicationAnswersRequest): Promise<ApplicationAnswersResult> {
    return generateApplicationAnswersHeuristic(request);
  }

  async generateOutreachMessage(request: OutreachMessageRequest): Promise<OutreachMessageResult> {
    return generateOutreachMessageHeuristic(request);
  }

  async generateFollowUpMessage(request: FollowUpMessageRequest): Promise<FollowUpMessageResult> {
    return generateFollowUpMessageHeuristic(request);
  }

  async scoreMockInterviewResponse(request: MockInterviewScoreRequest): Promise<MockInterviewScoreResult> {
    return scoreMockInterviewResponseHeuristic(request);
  }
}

export const mockProvider: AIProvider = new MockProvider();
