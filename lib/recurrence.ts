/**
 * Recurring tasks (docs/state_desc.md §28). Completing a recurring task records its commit
 * and creates the next occurrence; only that one future instance ever exists. Due dates
 * are calendar days in the person's timezone, worked out here as YYYY-MM-DD strings.
 */

export const RECURRENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "interval:14", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
] as const;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Set weekdays of a `days:` rule (0 = Sunday), sorted Monday first. */
export function ruleWeekdays(rule: string): number[] {
  const m = rule.match(/^days:([0-6](?:,[0-6])*)$/);
  if (!m) return [];
  return [...new Set(m[1].split(",").map(Number))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
}

export function recurrenceLabel(rule: string): string {
  const preset = RECURRENCE_OPTIONS.find((o) => o.value === rule);
  if (preset) return preset.label;
  const days = Number(rule.match(/^interval:(\d+)$/)?.[1]);
  if (days) return days % 7 === 0 ? `Every ${days / 7} weeks` : `Every ${days} days`;
  const weekdays = ruleWeekdays(rule);
  return weekdays.length ? `On ${weekdays.map((d) => DAY_NAMES[d]).join(", ")}` : rule;
}

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const toDay = (date: Date) => date.toISOString().slice(0, 10);


/** One step of a rule from a day. Monthly keeps the day of month, clamped to shorter months. */
export function step(day: string, rule: string): string {
  const d = toDate(day);
  if (rule === "monthly") {
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
    return toDay(target);
  }
  const weekdays = ruleWeekdays(rule);
  if (weekdays.length) {
    // The next listed weekday after `day`
    for (let i = 1; i <= 7; i++) {
      const next = new Date(d.getTime() + i * 86_400_000);
      if (weekdays.includes(next.getUTCDay())) return toDay(next);
    }
  }
  const days = rule === "daily" || rule === "weekdays" ? 1 : rule === "weekly" ? 7 : Number(rule.match(/^interval:(\d+)$/)?.[1]);
  if (!days) throw new Error(`Unknown recurrence rule: ${rule}`);
  d.setUTCDate(d.getUTCDate() + days);
  // Weekdays skip Saturday and Sunday
  while (rule === "weekdays" && (d.getUTCDay() === 0 || d.getUTCDay() === 6)) d.setUTCDate(d.getUTCDate() + 1);
  return toDay(d);
}

/**
 * Due day of the next occurrence: one step after the current due day (or after today
 * when there was none), moved forward until it is after today, so finishing late never
 * creates an occurrence that is already overdue.
 */
export function nextDueDay(rule: string, dueDay: string | null, today: string): string {
  let next = step(dueDay ?? today, rule);
  for (let i = 0; next <= today && i < 1000; i++) next = step(next, rule);
  // A due day so old that stepping did not catch up: start again from today
  return next > today ? next : step(today, rule);
}
