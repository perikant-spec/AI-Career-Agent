import type {
  AIProviderName,
  ConfidenceLevel,
  ProfileSection,
  RemotePolicy,
  SeniorityLevel,
} from "@/lib/types/enums";

export interface SourceSpan {
  start: number;
  end: number;
  text: string;
}

export interface ExtractedProfileEntry {
  section: ProfileSection;
  label: string;
  value: string;
  structuredData?: Record<string, unknown>;
  confidence: ConfidenceLevel;
  basisText?: string;
  /** Absent when confidence is MISSING — there is nothing in the source to point to. */
  sourceSpan?: SourceSpan;
}

export interface ProfileConflict {
  description: string;
  relatedLabels: string[];
}

export interface ResumeExtractionResult {
  entries: ExtractedProfileEntry[];
  warnings: string[];
  conflicts: ProfileConflict[];
}

export interface JobRequirements {
  requiredSkills: string[];
  niceToHaveSkills: string[];
  minYearsExperience?: number;
  seniorityLevel?: SeniorityLevel;
  requiredCertifications: string[];
  industry?: string;
  workAuthorizationRequirement?: string;
  salaryMin?: number;
  salaryMax?: number;
  locationText?: string;
  remotePolicy?: RemotePolicy;
}

export interface JobExtractionResult {
  title?: string;
  company?: string;
  location?: string;
  parsedRequirements: JobRequirements;
  /** Forced low (NOT_VERIFIED) for sparse postings rather than a falsely precise read. */
  extractionConfidence: ConfidenceLevel;
  warnings: string[];
}

export interface RationaleRequest {
  kind: "MATCH_STRENGTHS_GAPS" | "DISQUALIFIER_EXPLANATION" | "ASSISTANT_REPLY";
  /** Only entities the generated text is allowed to reference. */
  citedEntities: Array<{ id: string; label: string; value: string }>;
  /** Deterministic computed facts the text must be grounded in — never overridden by the AI. */
  facts: Record<string, unknown>;
}

export interface RationaleResult {
  /** Human-readable combined text — what a generic caller (e.g. an assistant reply) would show. */
  text: string;
  citedEntityIds: string[];
  /** Populated only for kind === 'MATCH_STRENGTHS_GAPS', where the caller needs the two lists
   *  kept separate (they're persisted as distinct MatchScore.strengths/gaps arrays). */
  structured?: { strengths: string[]; gaps: string[] };
}

export interface ResumeCustomizationRequest {
  masterSummary?: string;
  /** Entities this generation is allowed to reference — validated the same way rationale
   *  citations are (lib/evidence/validator.ts#validateCitations). */
  citedEntities: Array<{ id: string; label: string; value: string }>;
  /** A verified phrase from the single most job-relevant bullet — the one thing safe to fold
   *  into the summary, computed deterministically by lib/resume/customize.ts. */
  topRelevantPhrase?: string;
  jobTitle?: string;
}

export interface ResumeCustomizationResult {
  tailoredSummary: string;
  citedEntityIds: string[];
}

/** Shared by cover-letter and application-answer generation — both are grounded in the same
 *  deterministic facts (lib/application/facts.ts#buildApplicationFacts). */
export interface ApplicationGenerationFacts {
  jobTitle?: string;
  companyName?: string;
  topMatchedSkills: string[];
  topRelevantPhrase?: string;
  citedEntities: Array<{ id: string; label: string; value: string }>;
}

export interface CoverLetterResult {
  content: string;
  citedEntityIds: string[];
}

export interface ApplicationAnswersRequest extends ApplicationGenerationFacts {
  questions: string[];
}

export interface ApplicationAnswerItem {
  question: string;
  answer: string;
  citedEntityIds: string[];
}

export interface ApplicationAnswersResult {
  answers: ApplicationAnswerItem[];
}

/** Grounded the same way a cover letter is, plus the contact's own details and the user's own
 *  relationshipNote (never an AI-inferred claim about the relationship). */
export interface OutreachMessageRequest extends ApplicationGenerationFacts {
  contactName: string;
  contactRole?: string;
  messageType: string; // OutreachMessageType — kept as string to avoid an enums.ts import here
  relationshipNote?: string;
}

export interface OutreachMessageResult {
  content: string;
  citedEntityIds: string[];
}

/** Grounded the same way a cover letter is, plus how long it's been since applying — never
 *  fabricates a reason for the silence or a claim about the employer's process. */
export interface FollowUpMessageRequest extends ApplicationGenerationFacts {
  daysSinceApplied: number;
}

export interface FollowUpMessageResult {
  content: string;
  citedEntityIds: string[];
}

/** Scores the response's own structure/content only — the rubric never asks for a claim about
 *  the candidate beyond what's in the text they typed. */
export interface MockInterviewScoreRequest {
  question: string;
  responseText: string;
}

export interface MockInterviewScoreResult {
  scoreRelevance: number;
  scoreClarity: number;
  scoreStructure: number;
  scoreCompleteness: number;
  feedback: string;
}

export interface AIProvider {
  readonly name: AIProviderName;
  readonly version: string;
  extractResumeEntities(rawText: string, documentId: string): Promise<ResumeExtractionResult>;
  extractJobRequirements(rawText: string): Promise<JobExtractionResult>;
  generateRationale(request: RationaleRequest): Promise<RationaleResult>;
  generateAssistantReply(intent: string, toolResults: Record<string, unknown>): Promise<string>;
  /** The only AI-generated piece of the resume customizer — everything else (skill order,
   *  bullet order, term adaptation) is deterministic. Never allowed to introduce a claim not
   *  present in masterSummary/topRelevantPhrase. */
  generateResumeCustomization(request: ResumeCustomizationRequest): Promise<ResumeCustomizationResult>;
  /** Grounded only in the facts handed to it — never invents enthusiasm, achievements, or
   *  motivations beyond what topMatchedSkills/topRelevantPhrase actually support. */
  generateCoverLetter(facts: ApplicationGenerationFacts): Promise<CoverLetterResult>;
  /** Batched (one call, several questions) rather than one call per question — cost-conscious,
   *  same grounding rule as generateCoverLetter. */
  generateApplicationAnswers(request: ApplicationAnswersRequest): Promise<ApplicationAnswersResult>;
  /** Same grounding rule again, plus the contact's name/role/relationshipNote — all user-supplied,
   *  never an AI-inferred claim about who this person is or why they're relevant. */
  generateOutreachMessage(request: OutreachMessageRequest): Promise<OutreachMessageResult>;
  /** Same grounding rule again — daysSinceApplied is the only new fact, and it's never used to
   *  invent a reason for not hearing back. */
  generateFollowUpMessage(request: FollowUpMessageRequest): Promise<FollowUpMessageResult>;
  /** Grounded only in the question and the response text itself — never claims anything about
   *  the candidate beyond what they typed. */
  scoreMockInterviewResponse(request: MockInterviewScoreRequest): Promise<MockInterviewScoreResult>;
}
