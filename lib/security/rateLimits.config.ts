// Every non-auth rate limit in one place, so tuning a number doesn't require hunting through
// route files. Auth-endpoint limits (login/register/password-reset) stay defined at their call
// sites (app/api/auth/*, app/api/mobile/auth/*) since Milestone 13 — this file covers the
// endpoints added in this hardening phase: uploads, imports, and every AI-invoking action.
//
// Shape: { userMax, userWindowMs, globalMax, globalWindowMs }. Global limits are set well above
// realistic aggregate legitimate traffic for an early-stage product — their job is to cap
// worst-case cost/load if many accounts are used at once (e.g. a bot-created account farm), not
// to constrain normal usage. Revisit both numbers once real traffic data exists.
const HOUR = 60 * 60 * 1000;

export const RATE_LIMITS = {
  resumeUpload: { userMax: 10, userWindowMs: HOUR, globalMax: 500, globalWindowMs: HOUR },
  jobImport: { userMax: 30, userWindowMs: HOUR, globalMax: 1000, globalWindowMs: HOUR },
  jobImportAdzuna: { userMax: 10, userWindowMs: HOUR, globalMax: 200, globalWindowMs: HOUR },
  assistantChat: { userMax: 60, userWindowMs: HOUR, globalMax: 2000, globalWindowMs: HOUR },
  applicationGeneration: { userMax: 20, userWindowMs: HOUR, globalMax: 500, globalWindowMs: HOUR },
  resumeCustomization: { userMax: 20, userWindowMs: HOUR, globalMax: 500, globalWindowMs: HOUR },
  jobRescore: { userMax: 30, userWindowMs: HOUR, globalMax: 800, globalWindowMs: HOUR },
  networkingGeneration: { userMax: 30, userWindowMs: HOUR, globalMax: 500, globalWindowMs: HOUR },
  followUpGeneration: { userMax: 30, userWindowMs: HOUR, globalMax: 500, globalWindowMs: HOUR },
  mockInterviewScoring: { userMax: 40, userWindowMs: HOUR, globalMax: 800, globalWindowMs: HOUR },
} as const;

export type RateLimitScope = keyof typeof RATE_LIMITS;
