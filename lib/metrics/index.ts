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
