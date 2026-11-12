import { describe, expect, it } from "vitest";
import { parseQuickCapture as parse } from "@/lib/validation";

const today = "2026-10-29"; // a Thursday

describe("parseQuickCapture", () => {
  it.each([
    ["Draft outline tomorrow !low", { title: "Draft outline", dueDate: "2026-10-30", priority: "low" }],
    ["call thu", { title: "call", dueDate: "2026-11-05" }],
    ["plan monday #relay !HIGH", { title: "plan", dueDate: "2026-11-02", projectSlug: "relay", priority: "high" }],
    ["write in 3d +4", { title: "write", dueDate: "2026-11-01", weight: 4 }],
    ["review in 2w", { title: "review", dueDate: "2026-11-12" }],
    ["plan next week ~weekly", { title: "plan", dueDate: "2026-11-02", repeat: "weekly" }],
    ["pay rent eom", { title: "pay rent", dueDate: "2026-10-31" }],
    ["talk 15 nov", { title: "talk", dueDate: "2026-11-15" }],
    ["talk nov 15", { title: "talk", dueDate: "2026-11-15" }],
    ["talk 1 oct", { title: "talk", dueDate: "2027-10-01" }],
    ["run ~daily +8", { title: "run", repeat: "daily", weight: 8 }],
    ["ship 2026-12-01", { title: "ship", dueDate: "2026-12-01" }],
  ])("%s", (input, expected) => {
    expect(parse(input, today)).toMatchObject(expected);
  });

  it.each([
    ["ship 2026-02-30", "ship 2026-02-30"],
    ["x 31 feb", "x 31 feb"],
    ["x 1999-12-31", "x 1999-12-31"],
    ["email bob@x.com today", "email bob@x.com"],
    ["Learn C# basics", "Learn C# basics"],
    ["C++ +3 points", "C++ +3 points"],
    ["Sundays matter", "Sundays matter"],
    ["Personal chore @aarav", "Personal chore @aarav"],
  ])("leaves %s in the title", (input, title) => {
    expect(parse(input, today).title).toBe(title);
  });

  it("keeps backslash-escaped tokens as text", () => {
    expect(parse("Fix \\#12 \\!high on \\fri #relay !low", today)).toMatchObject({ title: "Fix #12 !high on fri", projectSlug: "relay", priority: "low", dueDate: undefined });
  });

  it("reads each token once", () => {
    expect(parse("a #one #two !high !low", today)).toMatchObject({ title: "a #two !low", projectSlug: "one", priority: "high" });
  });
});
