/**
 * Deterministic demo data for the landing page. Seeded so server and client render
 * identical markup (no hydration mismatch) and the story numbers always add up.
 */

export const DEMO_END = Date.UTC(2026, 9, 28); // 28 Oct 2026
const DAY = 86_400_000;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoDay {
  date: number; // UTC ms at midnight
  commits: number;
  execution: number;
  tasks: number;
  projects: number;
}

/** 371 days (53 full weeks) ending on DEMO_END, oldest first. */
export const DEMO_DAYS: DemoDay[] = (() => {
  const rand = mulberry32(0x57a7e);
  const days: DemoDay[] = [];
  for (let i = 370; i >= 0; i--) {
    const date = DEMO_END - i * DAY;
    const weekday = new Date(date).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    // Slow upward trend, quieter weekends, occasional rest days
    const trend = 0.55 + (370 - i) / 740;
    const rest = rand() < (weekend ? 0.45 : 0.08);
    const commits = rest ? 0 : Math.max(1, Math.round((weekend ? 2 : 5) * trend * (0.4 + rand() * 1.2)));
    const tasks = rest ? 0 : Math.max(0, commits - Math.round(rand() * 2));
    const execution = rest ? 0 : commits * 2 + Math.round(rand() * commits * 1.5);
    days.push({ date, commits, execution, tasks, projects: rest ? 0 : 1 + Math.floor(rand() * 4) });
  }
  return days;
})();

export function intensity(execution: number): 0 | 1 | 2 | 3 | 4 {
  if (execution === 0) return 0;
  if (execution <= 6) return 1;
  if (execution <= 12) return 2;
  if (execution <= 20) return 3;
  return 4;
}

/** Dark-surface ramp; lightness-only so it reads without colour vision. */
export const INTENSITY_FILL = ["#1A1A19", "#3A3A38", "#6F6F6B", "#B7B7B3", "#F4F4F2"] as const;

export const formatDay = (date: number) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);

export const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
