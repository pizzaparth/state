/**
 * Time zone helpers. Zones are IANA names ("Asia/Kolkata"); a name is accepted only if
 * the runtime's Intl data knows it, so the server and Postgres agree on what it means.
 */

export function isTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Every zone the runtime knows, sorted; UTC first. */
export function timeZones(): string[] {
  const list = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return ["UTC", ...list.filter((z) => z !== "UTC")];
}

/** Short zone name at an instant: "IST", "GMT+5:30", "CET". */
export function zoneAbbreviation(tz: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName");
    return part?.value ?? tz;
  } catch {
    return tz;
  }
}

/** Milliseconds `tz` is ahead of UTC at an instant. */
export function zoneOffsetMs(tz: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Epoch ms of the next local midnight in `tz` after `now`. */
export function nextMidnight(tz: string, now: Date = new Date()): number {
  const offset = zoneOffsetMs(tz, now);
  const local = now.getTime() + offset;
  const nextLocal = Math.floor(local / 86_400_000) * 86_400_000 + 86_400_000;
  // Re-read the offset at the target, in case a DST change falls in between
  return nextLocal - zoneOffsetMs(tz, new Date(nextLocal - offset));
}
