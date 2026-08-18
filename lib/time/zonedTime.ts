// Dependency-free IANA timezone conversion built on Intl.DateTimeFormat -- Node 20+ and Hermes
// (Expo SDK 57+) both ship full ICU data, so this avoids adding date-fns-tz/luxon/dayjs for what
// is, at its core, one well-known technique: guess a UTC instant, read back what wall-clock time
// that instant displays as in the target zone, and correct by the difference. Used everywhere a
// stored UTC instant (InterviewPrep.scheduledAt) needs to become a user's local wall-clock time,
// and vice versa for the datetime picker that captures it.

export interface ZonedWallTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second?: number;
}

const REFERENCE_LOCALE = "en-US";

function wallTimeToEpochMs(wall: ZonedWallTime): number {
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second ?? 0);
}

function readZonedParts(instant: Date, timeZone: string): Required<ZonedWallTime> {
  const parts = new Intl.DateTimeFormat(REFERENCE_LOCALE, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Intl reports hour 24 for midnight under some hourCycle/locale combinations even with h23
  // requested -- normalize back to 0 so downstream arithmetic (and the morning-window check)
  // never sees an out-of-range hour.
  const hour = get("hour") % 24;

  return { year: get("year"), month: get("month"), day: get("day"), hour, minute: get("minute"), second: get("second") };
}

/** Offset of `timeZone` at `instant`, in minutes, such that `wallAsUtc = utcInstant + offsetMinutes`. */
function offsetMinutesAt(instant: number, timeZone: string): number {
  const wallAsUtc = wallTimeToEpochMs(readZonedParts(new Date(instant), timeZone));
  return (wallAsUtc - instant) / 60000;
}

/**
 * Converts a wall-clock local time (as typed into a datetime picker, meant to be read in
 * `timeZone`) into the UTC instant it represents.
 *
 * Technique: read the zone's real offset at a naive guess instant (treating the wall-clock digits
 * as if they were themselves UTC), then apply that offset once. On an ordinary day this is exact,
 * since the offset is constant for months at a time and the naive guess always lands close enough
 * to read the correct one. Near a DST transition it resolves both edge cases sensibly without
 * throwing, verified against Node's real ICU data in tests/unit/time/zonedTime.test.ts:
 *
 * - **Spring-forward gap** (e.g. 2:30 AM on a "clocks jump from 2:00 to 3:00" day never occurs):
 *   the naive guess reads the pre-transition (standard-time) offset, and applying it pushes the
 *   resulting instant *past* the real transition into daylight time -- equivalent to the wall
 *   clock reading shifted forward by the size of the jump (2:30 -> 3:30 local).
 * - **Fall-back ambiguity** (e.g. 1:30 AM occurs twice): the naive guess reads the offset in
 *   effect for the earlier, pre-transition occurrence, which is a real, valid instant -- so that
 *   one is returned deterministically, every time.
 */
export function zonedWallTimeToUtc(wall: ZonedWallTime, timeZone: string): Date {
  const naiveEpoch = wallTimeToEpochMs(wall);
  const offsetAtNaive = offsetMinutesAt(naiveEpoch, timeZone);
  return new Date(naiveEpoch - offsetAtNaive * 60000);
}

/** Converts a stored UTC instant into its wall-clock parts in `timeZone` (storage -> display). */
export function utcToZonedParts(instant: Date, timeZone: string): Required<ZonedWallTime> & { weekday: string } {
  const parts = readZonedParts(instant, timeZone);
  const weekday = new Intl.DateTimeFormat(REFERENCE_LOCALE, { timeZone, weekday: "short" }).format(instant);
  return { ...parts, weekday };
}

export type DateTimeFormatStyle = "short" | "long";

/** Human-readable local date/time string, e.g. "Aug 18, 10:00 AM" (short) for push copy/UI. */
export function formatZonedDateTime(instant: Date, timeZone: string, style: DateTimeFormatStyle = "short"): string {
  return new Intl.DateTimeFormat(REFERENCE_LOCALE, {
    timeZone,
    month: style === "short" ? "short" : "long",
    day: "numeric",
    year: style === "long" ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
}

/**
 * The daily-briefing cron's core per-user question: what hour is it right now in their zone, and
 * what's "today" for them (the DailyBriefingLog.localDate dedup key) -- both from one Intl call.
 */
export function currentLocalHourAndDate(timeZone: string, now: Date = new Date()): { hour: number; localDate: string } {
  const parts = readZonedParts(now, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { hour: parts.hour, localDate: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` };
}

/** Computes the UTC instant range covering a user's local calendar day (00:00:00 -> 23:59:59.999). */
export function zonedDayRangeUtc(localDate: { year: number; month: number; day: number }, timeZone: string): { startUtc: Date; endUtc: Date } {
  const startUtc = zonedWallTimeToUtc({ ...localDate, hour: 0, minute: 0, second: 0 }, timeZone);
  const nextDay = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day + 1));
  const endUtc = zonedWallTimeToUtc(
    { year: nextDay.getUTCFullYear(), month: nextDay.getUTCMonth() + 1, day: nextDay.getUTCDate(), hour: 0, minute: 0, second: 0 },
    timeZone
  );
  return { startUtc, endUtc };
}

let cachedSupportedTimeZones: Set<string> | null = null;

/** Validates an IANA zone name, e.g. for the preferences PATCH schema and the settings <select>. */
export function isValidIanaTimeZone(tz: string): boolean {
  // "UTC" is a valid Intl.DateTimeFormat timeZone (and this app's UserPreferences.timezone
  // default) but isn't itself enumerated by Intl.supportedValuesOf("timeZone") -- that list only
  // contains real IANA identifiers (the canonical equivalent is "Etc/UTC") -- so it needs an
  // explicit carve-out rather than failing validation against the app's own default value.
  if (tz === "UTC") return true;
  if (!cachedSupportedTimeZones) {
    cachedSupportedTimeZones = new Set(Intl.supportedValuesOf("timeZone"));
  }
  return cachedSupportedTimeZones.has(tz);
}
