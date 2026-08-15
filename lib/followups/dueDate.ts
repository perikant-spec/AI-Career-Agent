const DAY_MS = 24 * 60 * 60 * 1000;

/** A fixed offset from the given anchor time — the PRD's "MVP: manual timers," not an adaptive
 *  or response-rate-informed schedule (that's explicitly a later milestone). */
export function computeFollowUpDueDate(anchor: Date, days: number): Date {
  return new Date(anchor.getTime() + days * DAY_MS);
}

export function isDue(dueDate: Date, now: Date = new Date()): boolean {
  return dueDate.getTime() <= now.getTime();
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}
