/**
 * Fractional ordering keys for board cards (tasks.position). Keys are base-36 digit
 * strings compared bytewise (`collate "C"`), so moving a card rewrites only that card.
 */
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

// Trailing zeros do not change a key's value ("a00" == "a"), and midpoint needs them gone
const trim = (key: string) => key.replace(/0+$/, "");

function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? "0") === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a ? DIGITS.indexOf(a[0]) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length;
  if (digitB - digitA > 1) return DIGITS[Math.round((digitA + digitB) / 2)];
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA] + midpoint(a.slice(1), null);
}

/**
 * A key strictly between `before` and `after`. Null `before` means the start of the
 * column, null `after` the end. Keys outside the alphabet or out of order fall back to
 * appending after `before`.
 */
export function keyBetween(before: string | null, after: string | null): string {
  const valid = (k: string | null) => k === null || /^[0-9a-z]*$/.test(k);
  const a = before && valid(before) ? trim(before) : "";
  let b = after && valid(after) ? trim(after) : null;
  if (b !== null && (b === "" || b <= a)) b = null;
  return midpoint(a, b);
}
