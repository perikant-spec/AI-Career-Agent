import { describe, it, expect } from "vitest";
import {
  zonedWallTimeToUtc,
  utcToZonedParts,
  currentLocalHourAndDate,
  zonedDayRangeUtc,
  isValidIanaTimeZone,
} from "@/lib/time/zonedTime";

describe("zonedWallTimeToUtc / utcToZonedParts", () => {
  it("round-trips a non-DST, non-hour-offset zone (Asia/Kolkata, UTC+5:30)", () => {
    const utc = zonedWallTimeToUtc({ year: 2026, month: 6, day: 15, hour: 14, minute: 30 }, "Asia/Kolkata");
    // 14:30 IST - 5:30 = 09:00 UTC
    expect(utc.toISOString()).toBe("2026-06-15T09:00:00.000Z");
    expect(utcToZonedParts(utc, "Asia/Kolkata")).toMatchObject({ year: 2026, month: 6, day: 15, hour: 14, minute: 30 });
  });

  it("resolves a US spring-forward gap by shifting forward past it, not throwing", () => {
    // 2024-03-10: America/Chicago clocks jump from 2:00 AM CST straight to 3:00 AM CDT --
    // 2:30 AM never happens. Verified against real ICU data: resolves to 3:30 AM CDT (the wall
    // clock reading shifted forward by the 1-hour jump), i.e. 08:30 UTC.
    const utc = zonedWallTimeToUtc({ year: 2024, month: 3, day: 10, hour: 2, minute: 30 }, "America/Chicago");
    expect(utc.toISOString()).toBe("2024-03-10T08:30:00.000Z");
    expect(utcToZonedParts(utc, "America/Chicago")).toMatchObject({ year: 2024, month: 3, day: 10, hour: 3, minute: 30 });
  });

  it("resolves a US fall-back ambiguity to the first (pre-transition) occurrence, deterministically", () => {
    // 2024-11-03: America/Chicago clocks fall back from 2:00 AM CDT to 1:00 AM CST -- 1:30 AM
    // happens twice (once in CDT, once in CST). Verified: resolves to the earlier, CDT
    // occurrence (06:30 UTC), not the later CST one (07:30 UTC).
    const utc = zonedWallTimeToUtc({ year: 2024, month: 11, day: 3, hour: 1, minute: 30 }, "America/Chicago");
    expect(utc.toISOString()).toBe("2024-11-03T06:30:00.000Z");
    expect(utcToZonedParts(utc, "America/Chicago")).toMatchObject({ year: 2024, month: 11, day: 3, hour: 1, minute: 30 });
  });

  it("handles Southern Hemisphere DST, where the daylight-saving direction is inverted", () => {
    // Australia/Sydney observes daylight time (AEDT, UTC+11) in the southern-hemisphere summer
    // (Nov-Apr) and standard time (AEST, UTC+10) in winter (May-Oct) -- the opposite calendar
    // half from Northern Hemisphere zones like America/Chicago above.
    const summer = zonedWallTimeToUtc({ year: 2026, month: 1, day: 15, hour: 14, minute: 0 }, "Australia/Sydney");
    expect(summer.toISOString()).toBe("2026-01-15T03:00:00.000Z"); // AEDT, UTC+11

    const winter = zonedWallTimeToUtc({ year: 2026, month: 7, day: 15, hour: 14, minute: 0 }, "Australia/Sydney");
    expect(winter.toISOString()).toBe("2026-07-15T04:00:00.000Z"); // AEST, UTC+10
  });

  it("is a no-op passthrough for UTC itself", () => {
    const utc = zonedWallTimeToUtc({ year: 2026, month: 1, day: 1, hour: 0, minute: 0 }, "UTC");
    expect(utc.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("currentLocalHourAndDate", () => {
  const fixed = new Date("2026-08-17T14:00:00Z");

  it("computes the correct local hour and calendar date per zone from one fixed UTC instant", () => {
    expect(currentLocalHourAndDate("UTC", fixed)).toEqual({ hour: 14, localDate: "2026-08-17" });
    expect(currentLocalHourAndDate("America/Chicago", fixed)).toEqual({ hour: 9, localDate: "2026-08-17" }); // CDT, UTC-5
    expect(currentLocalHourAndDate("Asia/Kolkata", fixed)).toEqual({ hour: 19, localDate: "2026-08-17" }); // UTC+5:30
    // Sydney in August is southern-hemisphere winter (AEST, UTC+10): 14:00 + 10h rolls into the next day.
    expect(currentLocalHourAndDate("Australia/Sydney", fixed)).toEqual({ hour: 0, localDate: "2026-08-18" });
  });
});

describe("zonedDayRangeUtc", () => {
  it("computes a 24-hour UTC range for a local calendar day in a non-UTC zone", () => {
    const { startUtc, endUtc } = zonedDayRangeUtc({ year: 2026, month: 6, day: 15 }, "Asia/Kolkata");
    expect(startUtc.toISOString()).toBe("2026-06-14T18:30:00.000Z"); // 2026-06-15 00:00 IST
    expect(endUtc.toISOString()).toBe("2026-06-15T18:30:00.000Z"); // 2026-06-16 00:00 IST
    expect(endUtc.getTime() - startUtc.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("spans 23 hours across a spring-forward day (the missed hour genuinely doesn't exist)", () => {
    const { startUtc, endUtc } = zonedDayRangeUtc({ year: 2024, month: 3, day: 10 }, "America/Chicago");
    expect(endUtc.getTime() - startUtc.getTime()).toBe(23 * 60 * 60 * 1000);
  });
});

describe("isValidIanaTimeZone", () => {
  it("accepts real IANA zone names and rejects garbage", () => {
    expect(isValidIanaTimeZone("America/Chicago")).toBe(true);
    expect(isValidIanaTimeZone("UTC")).toBe(true);
    expect(isValidIanaTimeZone("Australia/Sydney")).toBe(true);
    expect(isValidIanaTimeZone("Not/AZone")).toBe(false);
    expect(isValidIanaTimeZone("")).toBe(false);
  });
});
