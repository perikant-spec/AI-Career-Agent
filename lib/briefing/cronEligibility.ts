// The hourly cron's per-user decision, extracted as a pure function so it's testable without a
// route/DB in the loop -- the route itself is responsible for computing currentLocalHour (via
// lib/time#currentLocalHourAndDate) and alreadySentToday (a DailyBriefingLog existence check).

// [7, 9) local -- a single-hour-wide window would risk missing a user entirely if a cron tick is
// ever delayed or skipped (GitHub Actions schedule triggers are not guaranteed to fire exactly on
// time); two hours gives one retry margin while still reading as "morning" to a recipient.
export const MORNING_WINDOW_START_HOUR = 7;
export const MORNING_WINDOW_END_HOUR = 9;

export interface CronEligibilityInput {
  currentLocalHour: number;
  alreadySentToday: boolean;
}

export function isEligibleForBriefing({ currentLocalHour, alreadySentToday }: CronEligibilityInput): boolean {
  if (alreadySentToday) return false;
  return currentLocalHour >= MORNING_WINDOW_START_HOUR && currentLocalHour < MORNING_WINDOW_END_HOUR;
}
