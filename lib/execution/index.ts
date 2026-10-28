/**
 * State Execution Weights & Graph Calculations
 * Reference: docs/state_desc.md (Sections 15 & 17)
 */

export const TASK_WEIGHTS = {
  SMALL: 1,
  NORMAL: 2,
  MAJOR: 4,
  MILESTONE: 8,
} as const;

export type TaskWeight = typeof TASK_WEIGHTS[keyof typeof TASK_WEIGHTS];

export interface ExecutionCell {
  date: string; // ISO date YYYY-MM-DD
  commitsCount: number;
  tasksCompleted: number;
  executionValue: number;
  intensity: 0 | 1 | 2 | 3 | 4; // Visual density level
}

/**
 * Calculates visual intensity level (0 to 4) based on daily execution value.
 */
export function getExecutionIntensity(executionValue: number): 0 | 1 | 2 | 3 | 4 {
  if (executionValue === 0) return 0;
  if (executionValue <= 2) return 1;
  if (executionValue <= 6) return 2;
  if (executionValue <= 12) return 3;
  return 4;
}

/**
 * Computes execution value from an array of commits
 */
export function computeTotalExecution(commits: Array<{ executionValue: number }>): number {
  return commits.reduce((sum, item) => sum + item.executionValue, 0);
}
