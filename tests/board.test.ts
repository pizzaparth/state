import { describe, expect, it } from "vitest";
import { filterCards, formatBoardFilter, formatColumnFilters, matchesColumnFilter, parseBoardFilter, parseColumnFilters } from "@/lib/board-filter";

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
    expect(titles({ work: "relay" })).toEqual(["Fix WAL bug"]);
    expect(titles({ priority: "low" })).toEqual(["Read paper"]);
    expect(titles({ tag: "study" })).toEqual(["Plan week"]);
    expect(titles({ due: "overdue" })).toEqual(["Fix WAL bug"]);
    expect(titles({ due: "today" })).toEqual(["Read paper"]);
    expect(titles({ due: "week" })).toEqual(["Read paper", "Plan week"]);
    expect(titles({ due: "none" })).toEqual(["Someday"]);
    expect(titles({ q: "PAPER" })).toEqual(["Read paper"]);
  });

  it("reads only valid values from the URL", () => {
    expect(parseBoardFilter("work=Relay&priority=urgent&due=today&q=%20x%20")).toEqual({ work: "relay", due: "today", q: "x" });
    expect(parseBoardFilter("project=relay")).toEqual({ work: "relay" });
    expect(formatBoardFilter({ work: "relay", q: "a b" })).toBe("work=relay&q=a+b");
  });
});

describe("column filter", () => {
  const today = "2026-11-12"; // Thursday; week ends Sunday 15th
  const base = { title: "t", projectSlug: null, tags: [], priority: "high", weight: 4, dueDay: "2026-11-10" };

  it("matches weight, priority and due together", () => {
    expect(matchesColumnFilter(base, undefined, today)).toBe(true);
    expect(matchesColumnFilter(base, { weight: 4, priority: "high", due: "overdue" }, today)).toBe(true);
    expect(matchesColumnFilter(base, { weight: 2 }, today)).toBe(false);
    expect(matchesColumnFilter(base, { priority: "low" }, today)).toBe(false);
    expect(matchesColumnFilter(base, { due: "week" }, today)).toBe(false);
    expect(matchesColumnFilter({ ...base, dueDay: null }, { due: "none" }, today)).toBe(true);
  });

  it("round-trips the cookie and drops bad values", () => {
    const filters = { a: { weight: 4, due: "today" as const }, b: {} };
    expect(parseColumnFilters(formatColumnFilters(filters))).toEqual({ a: { weight: 4, due: "today" } });
    expect(parseColumnFilters('{"a":{"weight":3,"priority":"urgent","due":"soon"},"b c":{"weight":4}}')).toEqual({});
    expect(parseColumnFilters("not json")).toEqual({});
    expect(parseColumnFilters('["a"]')).toEqual({});
  });
});
