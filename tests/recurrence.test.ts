import { describe, expect, it } from "vitest";
import { nextDueDay, recurrenceLabel, ruleWeekdays, step } from "@/lib/recurrence";

describe("recurrence", () => {
  it.each([
    ["daily", "2026-11-12", "2026-11-13"],
    ["weekly", "2026-11-12", "2026-11-19"],
    ["weekdays", "2026-11-13", "2026-11-16"], // Friday → Monday
    ["monthly", "2026-01-31", "2026-02-28"],
    ["interval:14", "2026-11-12", "2026-11-26"],
    ["days:1,3,5", "2026-11-12", "2026-11-13"], // Thu → Fri
    ["days:1,3,5", "2026-11-13", "2026-11-16"], // Fri → Mon
    ["days:0", "2026-11-12", "2026-11-15"],
  ])("%s steps %s to %s", (rule, day, next) => {
    expect(step(day, rule)).toBe(next);
  });

  it("never schedules the next occurrence in the past", () => {
    expect(nextDueDay("daily", "2026-01-01", "2026-11-12")).toBe("2026-11-13");
    expect(nextDueDay("weekly", null, "2026-11-12")).toBe("2026-11-19");
  });

  it("labels rules", () => {
    expect(recurrenceLabel("interval:21")).toBe("Every 3 weeks");
    expect(recurrenceLabel("interval:10")).toBe("Every 10 days");
    expect(recurrenceLabel("days:5,1,3")).toBe("On Mon, Wed, Fri");
    expect(ruleWeekdays("days:0,6")).toEqual([6, 0]);
  });

  it("refuses unknown rules", () => {
    expect(() => step("2026-11-12", "fortnightly")).toThrow();
  });
});
