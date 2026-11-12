import { describe, expect, it } from "vitest";
import { formatBoardSort, parseBoardSort, sortCards } from "@/lib/board-sort";
import { filterCards, formatBoardFilter, parseBoardFilter } from "@/lib/board-filter";

const card = (title: string, extra: Partial<{ priority: string; weight: number; dueAt: number | null; projectName: string | null; createdAt: number }> = {}) => ({
  title,
  priority: "none",
  weight: 2,
  dueAt: null,
  projectName: null,
  createdAt: 0,
  ...extra,
});

describe("board sort", () => {
  it("round-trips and drops unknown keys", () => {
    expect(parseBoardSort("priority.desc,bogus.asc,priority.asc,due")).toEqual([
      { field: "priority", dir: "desc" },
      { field: "due", dir: "asc" },
    ]);
    expect(formatBoardSort([])).toBe("manual");
  });

  it("sorts by keys in order, blanks last, ties keep manual order", () => {
    const cards = [card("b", { priority: "low" }), card("a", { priority: "high", dueAt: 5 }), card("c", { priority: "high" }), card("d", { priority: "high", dueAt: 1 })];
    expect(sortCards(cards, parseBoardSort("priority.desc,due.asc")).map((c) => c.title)).toEqual(["d", "a", "c", "b"]);
    expect(sortCards(cards, parseBoardSort("due.desc")).map((c) => c.title)).toEqual(["a", "d", "b", "c"]);
  });
});

describe("board filter", () => {
  const cards = [
    { title: "Fix WAL bug", projectSlug: "relay", priority: "high", tags: ["build"], dueDay: "2026-11-10" },
    { title: "Read paper", projectSlug: "thesis", priority: "low", tags: [], dueDay: "2026-11-12" },
    { title: "Plan week", projectSlug: null, priority: "none", tags: ["study"], dueDay: "2026-11-15" },
    { title: "Someday", projectSlug: null, priority: "none", tags: [], dueDay: null },
  ];
  const today = "2026-11-12"; // Thursday; week ends Sunday 15th
  const titles = (f: Parameters<typeof filterCards>[1]) => filterCards(cards, f, today).map((c) => c.title);

  it("filters by each field", () => {
    expect(titles({ project: "relay" })).toEqual(["Fix WAL bug"]);
    expect(titles({ priority: "low" })).toEqual(["Read paper"]);
    expect(titles({ tag: "study" })).toEqual(["Plan week"]);
    expect(titles({ due: "overdue" })).toEqual(["Fix WAL bug"]);
    expect(titles({ due: "today" })).toEqual(["Read paper"]);
    expect(titles({ due: "week" })).toEqual(["Read paper", "Plan week"]);
    expect(titles({ due: "none" })).toEqual(["Someday"]);
    expect(titles({ q: "PAPER" })).toEqual(["Read paper"]);
  });

  it("reads only valid values from the URL", () => {
    expect(parseBoardFilter("project=Relay&priority=urgent&due=today&q=%20x%20")).toEqual({ project: "relay", due: "today", q: "x" });
    expect(formatBoardFilter({ project: "relay", q: "a b" })).toBe("project=relay&q=a+b");
  });
});
