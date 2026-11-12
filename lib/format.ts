import { currentLocale } from "./locale";

/**
 * Display formatting. Timestamps are stored in UTC and converted to the viewer's
 * timezone only here, in the viewer's locale (lib/locale.ts). The browser uses the same
 * locale, so markup is hydration-safe.
 */

const DAY_MS = 86_400_000;

/** YYYY-MM-DD for the instant in the given timezone. */
export function dayKey(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function formatTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat(currentLocale(), { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export function formatDate(date: Date, tz: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat(currentLocale(), { timeZone: tz, ...opts }).format(date);
}

export function formatDateTime(date: Date, tz: string): string {
  return `${formatDate(date, tz, { day: "numeric", month: "short", year: "numeric" })}, ${formatTime(date, tz)}`;
}

/** Shifts a YYYY-MM-DD key by whole days (calendar arithmetic, no timezone involved). */
export function shiftDayKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Label for a day key: Today, Yesterday, or a short date. */
export function dayLabel(key: string, todayKey: string): string {
  if (key === todayKey) return "Today";
  if (key === shiftDayKey(todayKey, -1)) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(currentLocale(), { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat(currentLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** Compact duration: hours under two days, otherwise days. */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const hours = ms / 3_600_000;
  return hours < 48 ? `${formatNumber(hours, 1)}h` : `${formatNumber(hours / 24, 1)}d`;
}

export type DueState = { label: string; tone: "overdue" | "today" | "soon" | "later" };

/** Due date relative to the viewer's today, e.g. "Today", "Tomorrow", "2d overdue". */
export function dueState(due: Date, now: Date, tz: string): DueState {
  const today = dayKey(now, tz);
  const dueKey = dayKey(due, tz);
  const diff = Math.round((Date.parse(dueKey) - Date.parse(today)) / DAY_MS);
  if (diff < 0) return { label: `${-diff}d overdue`, tone: "overdue" };
  if (diff === 0) return { label: "Today", tone: "today" };
  if (diff === 1) return { label: "Tomorrow", tone: "soon" };
  return { label: formatDate(due, tz), tone: diff <= 3 ? "soon" : "later" };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Provider amount in the currency's minor unit (paise, cents) as money: ₹199, $4.99. */
export function formatMoney(minor: number, currency: string): string {
  const format = new Intl.NumberFormat("en-IN", { style: "currency", currency });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  const value = minor / 10 ** digits;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(value);
}
