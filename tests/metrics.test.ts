import { describe, expect, it } from "vitest";
import { calculateCompletionRate, calculateConsistency, calculateMedianCycleTimeHours, calculateThroughput, calculateVelocity, objectivePosition, percentile } from "@/lib/metrics";
import { checklistCount, toggleChecklistLine } from "@/lib/checklist";
import { isoWeek, weekStart } from "@/lib/week";

const DAY = 86_400_000;
const now = new Date("2026-11-12T12:00:00Z");

describe("formulas", () => {
  it("velocity, throughput, completion, consistency", () => {
    expect(calculateVelocity(214, 30)).toBe(7.13);
    expect(calculateThroughput(9, 30)).toBe(0.3);
    expect(calculateCompletionRate(3, 4)).toBe(75);
    expect(calculateConsistency(12, 18)).toBe(66.7);
    expect(calculateConsistency(1, 0)).toBe(0);
  });

  it("median cycle time and percentiles", () => {
    expect(calculateMedianCycleTimeHours([3_600_000, 7_200_000, 10_800_000, 14_400_000])).toBe(2.5);
    expect(percentile([5, 1, 3], 50)).toBe(3);
    expect(percentile([], 50)).toBeNull();
  });
});

describe("objectivePosition", () => {
  const base = { currentValue: 50, targetValue: 100, startAt: new Date(now.getTime() - 10 * DAY), completedAt: null };

  it("open without a deadline", () => {
    expect(objectivePosition({ ...base, deadlineAt: null }, now).status).toBe("open");
  });

  it("overdue past the deadline, with the days past", () => {
    const pos = objectivePosition({ ...base, deadlineAt: new Date(now.getTime() - 3 * DAY) }, now);
    expect(pos.status).toBe("overdue");
    expect(pos.daysOver).toBe(3);
  });

  it("ahead, on track, behind against required velocity", () => {
    // 5/day so far; 50 left
    expect(objectivePosition({ ...base, deadlineAt: new Date(now.getTime() + 20 * DAY) }, now).status).toBe("ahead"); // needs 2.5
    expect(objectivePosition({ ...base, deadlineAt: new Date(now.getTime() + 10 * DAY) }, now).status).toBe("on track"); // needs 5
    expect(objectivePosition({ ...base, deadlineAt: new Date(now.getTime() + 5 * DAY) }, now).status).toBe("behind"); // needs 10
  });

  it("completed when reached", () => {
    expect(objectivePosition({ ...base, currentValue: 100, deadlineAt: null }, now).status).toBe("completed");
  });
});

describe("checklists and weeks", () => {
  it("counts and ticks lines in place", () => {
    const text = "Plan\n- [ ] outline\n- [x] read\nnotes";
    expect(checklistCount(text)).toEqual({ done: 1, total: 2 });
    expect(toggleChecklistLine(text, 1, true)).toBe("Plan\n- [x] outline\n- [x] read\nnotes");
    expect(checklistCount("no list")).toBeNull();
  });

  it("ISO weeks", () => {
    expect(isoWeek("2026-11-12")).toBe("2026-W46");
    expect(isoWeek("2027-01-03")).toBe("2026-W53");
    expect(weekStart("2026-W01")).toBe("2025-12-29");
    expect(weekStart("2025-W53")).toBeNull();
  });
});
