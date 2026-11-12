/** ISO weeks ("2026-W46") as calendar days. Pure date arithmetic on YYYY-MM-DD keys. */

const DAY = 86_400_000;
const toMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const shiftDay = (day: string, n: number) => toDay(toMs(day) + n * DAY);

/** ISO week of a day: "2026-W46" (weeks start Monday; week 1 holds the year's first Thursday). */
export function isoWeek(day: string): string {
  const d = new Date(toMs(day));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(d.getTime() + (3 - dow) * DAY);
  const year = thursday.getUTCFullYear();
  const week = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Monday of an ISO week, or null for a malformed value. */
export function weekStart(week: string | undefined | null): string | null {
  const m = week?.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const n = Number(m[2]);
  if (n < 1 || n > 53 || year < 2000 || year > 2100) return null;
  const jan4 = Date.UTC(year, 0, 4);
  const mondayW1 = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY;
  const start = toDay(mondayW1 + (n - 1) * 7 * DAY);
  // Week 53 only exists in some years
  return isoWeek(start) === `${year}-W${m[2]}` ? start : null;
}

/** Monday of the week holding `day`. */
export const mondayOf = (day: string) => shiftDay(day, -((new Date(toMs(day)).getUTCDay() + 6) % 7));
