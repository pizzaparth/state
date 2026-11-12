/**
 * Time-series statistics for the Metrics page. Pure functions over daily values (oldest
 * first); every one maps to a short formula shown next to its number.
 */

export const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

/** Sample standard deviation (n − 1); null below two points. */
export function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = sum(values) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

/** Trailing mean over `window` points; null until the window is full. */
export function rollingMean(values: number[], window: number): (number | null)[] {
  let acc = 0;
  return values.map((v, i) => {
    acc += v;
    if (i >= window) acc -= values[i - window];
    return i >= window - 1 ? acc / window : null;
  });
}

export function cumulative(values: number[]): number[] {
  let acc = 0;
  return values.map((v) => (acc += v));
}

/** Ordinary least squares of value on day index: slope per day and R². */
export function linearTrend(values: number[]): { slope: number; intercept: number; r2: number } | null {
  const n = values.length;
  if (n < 3) return null;
  const mx = (n - 1) / 2;
  const my = sum(values) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  values.forEach((y, x) => {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  });
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy) };
}

/** Autocorrelation at `lag` (ρ); null when the series is flat or too short. */
export function autocorrelation(values: number[], lag: number): number | null {
  const n = values.length;
  if (n <= lag + 2) return null;
  const m = sum(values) / n;
  const denom = values.reduce((s, v) => s + (v - m) ** 2, 0);
  if (denom === 0) return null;
  let num = 0;
  for (let i = lag; i < n; i++) num += (values[i] - m) * (values[i - lag] - m);
  return num / denom;
}

/**
 * Runs of active days (value > 0). The current run may end today or yesterday, so an
 * unfinished today does not break it.
 */
export function streaks(values: number[]): { longest: number; current: number } {
  let longest = 0;
  let run = 0;
  for (const v of values) {
    run = v > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let end = values.length - 1;
  if (end >= 0 && values[end] === 0) end--;
  let current = 0;
  while (end >= 0 && values[end] > 0) {
    current++;
    end--;
  }
  return { longest, current };
}

/** Percent below the running peak (0 at a new high, negative under it). */
export function drawdown(values: (number | null)[]): (number | null)[] {
  let peak = 0;
  return values.map((v) => {
    if (v === null) return null;
    peak = Math.max(peak, v);
    return peak > 0 ? ((v - peak) / peak) * 100 : 0;
  });
}

/** Monday of the week containing a YYYY-MM-DD key. */
export function weekStart(key: string, startsOn: "monday" | "sunday" = "monday"): string {
  const d = new Date(`${key}T00:00:00Z`);
  const offset = startsOn === "monday" ? (d.getUTCDay() + 6) % 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/** Groups day rows into weeks (Monday or Sunday start), oldest first, keeping each week's days. */
export function byWeek<T extends { day: string }>(rows: T[], startsOn: "monday" | "sunday" = "monday"): { week: string; days: T[] }[] {
  const out: { week: string; days: T[] }[] = [];
  for (const row of rows) {
    const week = weekStart(row.day, startsOn);
    if (out.at(-1)?.week !== week) out.push({ week, days: [] });
    out.at(-1)!.days.push(row);
  }
  return out;
}

/** Up to `count` round tick values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t <= max + step * 0.001; t += step) ticks.push(Number(t.toFixed(10)));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Percent change from `prior` to `current`; null without a prior value. */
export const change = (current: number, prior: number) => (prior > 0 ? ((current - prior) / prior) * 100 : null);
