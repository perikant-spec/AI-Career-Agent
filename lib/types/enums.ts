// Every enum-like field in the schema is modeled as `String` at the DB layer (SQLite/Postgres
// enum support diverges) — these unions are the single source of truth for valid values.

export const CONFIDENCE_LEVELS = [
  "VERIFIED",
  "SUPPORTED_INFERENCE",
  "NOT_VERIFIED",
  "MISSING",
] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

// Ordinal scale used by the Evidence Validator's "can only downgrade" rule.
export const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  VERIFIED: 3,
  SUPPORTED_INFERENCE: 2,
  NOT_VERIFIED: 1,
  MISSING: 0,
};

export const PROFILE_SECTIONS = [
  "SUMMARY",
  "SKILL",
  "EXPERIENCE",
  "EDUCATION",
  "CERTIFICATION",
  "ACHIEVEMENT",
] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export const RESUME_EXTRACTION_STATUSES = [
  "PENDING",
  "SUCCESS",
  "PARTIAL",
  "FAILED",
  "UNSUPPORTED_FORMAT",
] as const;
export type ResumeExtractionStatus = (typeof RESUME_EXTRACTION_STATUSES)[number];

export const JOB_SOURCES = ["MANUAL_PASTE", "ADZUNA"] as const;
export type JobSource = (typeof JOB_SOURCES)[number];

export const SENIORITY_LEVELS = [
  "INTERN",
  "JUNIOR",
  "MID",
  "SENIOR",
  "STAFF",
  "PRINCIPAL",
  "MANAGER",
  "DIRECTOR",
  "EXEC",
] as const;
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

export const SENIORITY_RANK: Record<SeniorityLevel, number> = {
  INTERN: 0,
  JUNIOR: 1,
  MID: 2,
  SENIOR: 3,
  STAFF: 4,
  PRINCIPAL: 5,
  MANAGER: 5,
  DIRECTOR: 6,
  EXEC: 7,
};

export const REMOTE_POLICIES = ["REMOTE", "HYBRID", "ONSITE", "UNKNOWN"] as const;
export type RemotePolicy = (typeof REMOTE_POLICIES)[number];

export const RECOMMENDATION_TIERS = [
  "APPLY_STRONG",
  "APPLY",
  "APPLY_IF_INTERESTED",
  "LOW_PRIORITY",
  "DONT_APPLY",
] as const;
export type RecommendationTier = (typeof RECOMMENDATION_TIERS)[number];

export const RECOMMENDATION_LABELS: Record<RecommendationTier, string> = {
  APPLY_STRONG: "Apply — Strong Match",
  APPLY: "Apply",
  APPLY_IF_INTERESTED: "Apply if Interested",
  LOW_PRIORITY: "Low Priority",
  DONT_APPLY: "Don't Apply",
};

// Application pipeline — always a manual, user-driven transition (PRD §19 / master prompt §19).
// No automated status detection exists in this milestone; email/calendar-assisted suggestions
// are a later milestone and would still require user confirmation, never a silent auto-update.
export const APPLICATION_STATUSES = [
  "DISCOVERED",
  "SHORTLISTED",
  "PREPARING",
  "READY_TO_APPLY",
  "APPLIED",
  "RECRUITER_CONTACT",
  "SCREENING",
  "INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  DISCOVERED: "Discovered",
  SHORTLISTED: "Shortlisted",
  PREPARING: "Preparing",
  READY_TO_APPLY: "Ready to Apply",
  APPLIED: "Applied",
  RECRUITER_CONTACT: "Recruiter Contact",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  FINAL_INTERVIEW: "Final Interview",
  OFFER: "Offer",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

// Kanban column order — separate from the union order above only for readability; kept in sync
// deliberately rather than derived, so a future reorder of one doesn't silently reorder the other.
export const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [...APPLICATION_STATUSES];

export const LIVE_APPLICATION_STATUSES: ApplicationStatus[] = APPLICATION_STATUSES.filter(
  (s) => !["DISCOVERED", "ACCEPTED", "REJECTED", "WITHDRAWN"].includes(s)
);

// Networking (Milestone 7) — contacts are always user-supplied in this build; licensed contact
// enrichment (Apollo/Hunter/ContactOut) needs an account we can't create on the user's behalf,
// so PROVIDER_VERIFIED is a valid future value with no code path producing it today.
export const CONTACT_TYPES = [
  "HIRING_MANAGER",
  "RECRUITER",
  "TEAM_LEAD",
  "EXISTING_CONNECTION",
  "REFERRAL",
  "OTHER",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  HIRING_MANAGER: "Hiring Manager",
  RECRUITER: "Recruiter",
  TEAM_LEAD: "Team Lead",
  EXISTING_CONNECTION: "Existing Connection",
  REFERRAL: "Referral",
  OTHER: "Other",
};

export const CONTACT_SOURCES = ["USER_SUPPLIED", "PROVIDER_VERIFIED"] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

export const OUTREACH_MESSAGE_TYPES = [
  "CONNECTION_REQUEST",
  "AFTER_CONNECT",
  "RECRUITER_MESSAGE",
  "HIRING_MANAGER_MESSAGE",
  "REFERRAL_ASK",
  "FOLLOW_UP",
] as const;
export type OutreachMessageType = (typeof OUTREACH_MESSAGE_TYPES)[number];

export const OUTREACH_MESSAGE_TYPE_LABELS: Record<OutreachMessageType, string> = {
  CONNECTION_REQUEST: "Connection Request",
  AFTER_CONNECT: "After Connect",
  RECRUITER_MESSAGE: "Recruiter",
  HIRING_MANAGER_MESSAGE: "Hiring Manager",
  REFERRAL_ASK: "Referral Ask",
  FOLLOW_UP: "Follow-Up",
};

export const OUTREACH_MESSAGE_STATUSES = ["DRAFT", "SENT"] as const;
export type OutreachMessageStatus = (typeof OUTREACH_MESSAGE_STATUSES)[number];

// Follow-Up Engine (Milestone 8) — "due" is computed at read time (dueDate <= now), never by a
// background job, since none exists in this build. Status here is only ever user-driven.
export const FOLLOW_UP_STATUSES = ["PENDING", "COMPLETED", "DISMISSED"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

// Interview Preparation (Milestone 9) — STAR answers are deterministically extracted from
// verified experience, not AI-generated; only mock-interview scoring involves an AI call.
export const INTERVIEW_QUESTION_CATEGORIES = [
  "BEHAVIORAL",
  "TECHNICAL",
  "ROLE_SPECIFIC",
  "LEADERSHIP",
  "COMPANY_FIT",
] as const;
export type InterviewQuestionCategory = (typeof INTERVIEW_QUESTION_CATEGORIES)[number];

export const INTERVIEW_QUESTION_CATEGORY_LABELS: Record<InterviewQuestionCategory, string> = {
  BEHAVIORAL: "Behavioral",
  TECHNICAL: "Technical",
  ROLE_SPECIFIC: "Role-Specific",
  LEADERSHIP: "Leadership",
  COMPANY_FIT: "Company Fit",
};

export const MATCH_CATEGORIES = [
  "skills",
  "experience",
  "seniority",
  "industry",
  "location",
  "compensation",
  "educationCertification",
  "careerTrajectory",
] as const;
export type MatchCategory = (typeof MATCH_CATEGORIES)[number];

export const MATCH_CATEGORY_LABELS: Record<MatchCategory, string> = {
  skills: "Skills",
  experience: "Experience",
  seniority: "Seniority",
  industry: "Industry",
  location: "Location",
  compensation: "Compensation",
  educationCertification: "Education / Certification",
  careerTrajectory: "Career Trajectory",
};

// AI provider identity — extensible beyond mock/anthropic (e.g. gemini, openai) per the
// multi-provider abstraction; only mock + anthropic have real implementations today.
export type AIProviderName = "mock" | "anthropic" | string;
