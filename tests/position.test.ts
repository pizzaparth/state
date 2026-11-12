import { describe, expect, it } from "vitest";
import { keyBetween } from "@/lib/position";

const between = (a: string | null, b: string | null) => {
  const k = keyBetween(a, b);
  if (a !== null) expect(k > a).toBe(true);
  if (b !== null) expect(k < b).toBe(true);
  return k;
};

describe("keyBetween", () => {
  it("orders keys bytewise", () => {
    between(null, null);
    between("a", null);
    between(null, "a");
    between("a", "b");
    between("a", "a1");
    between("az", "b");
  });

  it("keeps finding room after many inserts at the same spot", () => {
    let low = "a";
    const high = "b";
    for (let i = 0; i < 200; i++) low = between(low, high);
    let hi = "b";
    for (let i = 0; i < 200; i++) hi = between("a", hi);
  });

  it("appends when neighbours are out of order or invalid", () => {
    expect(keyBetween("c", "b") > "c").toBe(true);
    expect(keyBetween("c", "B!") > "c").toBe(true);
  });
});
