import { describe, expect, it } from "vitest";

import { cronMatches, parseCron, validateCron } from "./cron";

// Mon 2026-06-15 14:30 local time
const MONDAY_1430 = new Date(2026, 5, 15, 14, 30);

describe("parseCron / validateCron", () => {
  it("accepts common expressions", () => {
    for (const expr of [
      "* * * * *",
      "0 3 * * *",
      "*/15 * * * *",
      "30 2 1,15 * *",
      "0 9-17 * * 1-5",
    ]) {
      expect(validateCron(expr)).toBeNull();
    }
  });

  it("rejects malformed expressions", () => {
    expect(validateCron("")).toMatch(/required/);
    expect(validateCron("* * * *")).toMatch(/5 fields/);
    expect(validateCron("61 * * * *")).toMatch(/Invalid/);
    expect(validateCron("a * * * *")).toMatch(/Invalid/);
    expect(validateCron("*/0 * * * *")).toMatch(/Invalid/);
    expect(validateCron("5-1 * * * *")).toMatch(/Invalid/);
  });

  it("parses steps over ranges", () => {
    const cron = parseCron("2-10/4 * * * *");
    expect([...cron!.minute]).toEqual([2, 6, 10]);
  });
});

describe("cronMatches", () => {
  it("matches wildcards", () => {
    expect(cronMatches("* * * * *", MONDAY_1430)).toBe(true);
  });

  it("matches exact minute and hour", () => {
    expect(cronMatches("30 14 * * *", MONDAY_1430)).toBe(true);
    expect(cronMatches("31 14 * * *", MONDAY_1430)).toBe(false);
    expect(cronMatches("30 15 * * *", MONDAY_1430)).toBe(false);
  });

  it("matches step minutes", () => {
    expect(cronMatches("*/15 * * * *", MONDAY_1430)).toBe(true); // 30 is /15
    expect(cronMatches("*/7 * * * *", MONDAY_1430)).toBe(false);
  });

  it("matches weekday ranges", () => {
    expect(cronMatches("30 14 * * 1-5", MONDAY_1430)).toBe(true); // Monday
    expect(cronMatches("30 14 * * 0,6", MONDAY_1430)).toBe(false);
  });

  it("matches month and day-of-month", () => {
    expect(cronMatches("30 14 15 6 *", MONDAY_1430)).toBe(true);
    expect(cronMatches("30 14 16 6 *", MONDAY_1430)).toBe(false);
  });

  it("ORs dom and dow when both are restricted (standard cron)", () => {
    // The 16th OR Monday — date is Monday the 15th, so dow matches.
    expect(cronMatches("30 14 16 * 1", MONDAY_1430)).toBe(true);
    // The 15th OR Tuesday — dom matches.
    expect(cronMatches("30 14 15 * 2", MONDAY_1430)).toBe(true);
    // The 16th OR Tuesday — neither matches.
    expect(cronMatches("30 14 16 * 2", MONDAY_1430)).toBe(false);
  });
});
