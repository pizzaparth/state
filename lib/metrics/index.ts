/**
 * State Deterministic Metric Formulas
 * Reference: docs/state_desc.md (Sections 17 to 23)
 * All calculations must remain transparent and explainable (no opaque "productivity scores").
 */

export interface MetricSummary {
  execution: number;
  tasksCompleted: number;
  commitsTotal: number;
  completionRate: number; // 0 to 100 percentage
  medianCycleTimeHours: number;
  activeDays: number;
  totalDays: number;
  consistencyRate: number; // 0 to 100 percentage
  velocityPerDay: number;
  throughputPerDay: number;
}

/**
 * Calculates Velocity = total execution / number of days in period
 */
export function calculateVelocity(execution: number, periodDays: number): number {
  if (periodDays <= 0) return 0;
  return Number((execution / periodDays).toFixed(2));
}

/**
 * Calculates Throughput = completed tasks / number of days in period
 */
export function calculateThroughput(completedTasksCount: number, periodDays: number): number {
  if (periodDays <= 0) return 0;
  return Number((completedTasksCount / periodDays).toFixed(2));
}

/**
 * Calculates Completion Ratio = completed planned tasks / total planned tasks
 */
export function calculateCompletionRate(completedCount: number, totalPlannedCount: number): number {
  if (totalPlannedCount <= 0) return 0;
  return Number(((completedCount / totalPlannedCount) * 100).toFixed(1));
}

/**
 * Calculates Consistency = active days (days with at least 1 commit) / eligible days
 */
export function calculateConsistency(activeDaysCount: number, eligibleDaysCount: number): number {
  if (eligibleDaysCount <= 0) return 0;
  return Number(((activeDaysCount / eligibleDaysCount) * 100).toFixed(1));
}

/**
 * Computes median cycle time in hours from duration milliseconds
 */
export function calculateMedianCycleTimeHours(durationsMs: number[]): number {
  if (durationsMs.length === 0) return 0;
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianMs = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Number((medianMs / (1000 * 60 * 60)).toFixed(1));
}

/** Percentile (0–100) of a numeric sample using nearest-rank; null for empty input. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank];
}

export function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((s, v) => s + v, 0) / values.length;
}

export type ObjectiveStatus = "completed" | "ahead" | "on track" | "behind" | "open" | "overdue";

/**
 * Objective position (docs/state_desc.md §24): current velocity since start versus the
 * velocity required to reach the target by the deadline. Status bands are ±10%.
 * Without a deadline there is nothing to be on track against: "open". A deadline that
 * has passed with the target not reached is "overdue", with the days past.
 */
export function objectivePosition(
  o: { currentValue: number; targetValue: number; startAt: Date; deadlineAt: Date | null; completedAt: Date | null },
  now: Date
) {
  const DAY = 86_400_000;
  const remaining = Math.max(0, o.targetValue - o.currentValue);
  const elapsedDays = Math.max(1, (now.getTime() - o.startAt.getTime()) / DAY);
  const velocity = o.currentValue / elapsedDays;
  const daysLeft = o.deadlineAt ? Math.max(0, (o.deadlineAt.getTime() - now.getTime()) / DAY) : null;
  const required = daysLeft === null ? null : daysLeft === 0 ? Infinity : remaining / daysLeft;
  const projected = velocity > 0 ? new Date(now.getTime() + (remaining / velocity) * DAY) : null;

  let status: ObjectiveStatus;
  if (o.completedAt || remaining === 0) status = "completed";
  else if (o.deadlineAt === null) status = "open";
  else if (now.getTime() > o.deadlineAt.getTime()) status = "overdue";
  else if (velocity >= required! * 1.1) status = "ahead";
  else if (velocity >= required! * 0.9) status = "on track";
  else status = "behind";

  const daysOver = o.deadlineAt && now.getTime() > o.deadlineAt.getTime() ? Math.ceil((now.getTime() - o.deadlineAt.getTime()) / DAY) : 0;
  return { velocity, required, projected, daysLeft, remaining, status, daysOver };
}
