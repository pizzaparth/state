import { z } from "zod";

/**
 * Task creation & update schemas
 */
export const PRIORITIES = ["none", "low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const RECURRENCE_RULES = /^(daily|weekdays|weekly|monthly|interval:[1-9]\d{0,2})$/;

// Only title is required; omitting boardId/columnId places the task in the Inbox
export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  description: z.string().trim().max(10_000).optional(),
  projectId: z.string().optional().nullable(),
  boardId: z.string().min(1).optional().nullable(),
  columnId: z.string().min(1).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  priority: z.enum(PRIORITIES).default("none"),
  weight: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]).default(2),
  dueAt: z.coerce.date().optional().nullable(),
  recurrenceRule: z.string().regex(RECURRENCE_RULES, "Invalid recurrence").optional().nullable(),
});

export type TaskInput = z.infer<typeof taskSchema>;

/**
 * Commit creation schema (manual or terminal completion)
 */
export const commitSchema = z.object({
  message: z.string().trim().min(1, "Commit message is required").max(500),
  workspaceId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  executionValue: z.number().int().min(1).max(32).default(2),
  source: z.enum(["task_completion", "manual", "imported", "integration"]).default("manual"),
});

export type CommitInput = z.infer<typeof commitSchema>;

/**
 * Commit edits are limited: message clarification, project reassignment, tags.
 * Timestamp, execution value, and source are immutable.
 */
export const commitUpdateSchema = z.strictObject({
  message: z.string().trim().min(1, "Commit message is required").max(500).optional(),
  projectId: z.string().optional().nullable(),
  tagIds: z.array(z.string().min(1)).max(50).optional(),
});

export type CommitUpdateInput = z.infer<typeof commitUpdateSchema>;

/**
 * Product mutations (Server Actions). Only ids and user-editable fields are accepted;
 * workspace, author, timestamps and execution value are always derived on the server.
 * strictObject rejects unknown keys, so extra fields like userId or workspaceId fail.
 */
export const objectId = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Invalid id");

export const moveTaskSchema = z.strictObject({
  taskId: objectId,
  columnId: objectId,
  /** Card directly above the drop position in the target column; null = top. */
  afterTaskId: objectId.nullable(),
});

/** Inbox triage: puts an untriaged task into a column of a board in its own workspace. */
export const placeTaskSchema = z.strictObject({
  taskId: objectId,
  columnId: objectId,
});

/** Title edit from the task panel. Same length limit as a capture. */
export const renameTaskSchema = z.strictObject({
  taskId: objectId,
  title: z.string().trim().min(1, "Give the task a title.").max(500, "Keep the title under 500 characters."),
});

export const setTaskPrioritySchema = z.strictObject({
  taskId: objectId,
  priority: z.enum(PRIORITIES),
});

/** Delete and undo-delete take only the task id. */
export const taskRefSchema = z.strictObject({
  taskId: objectId,
});

export const captureTaskSchema = z.strictObject({
  text: z.string().trim().min(1, "Type a task first.").max(500),
});

export const manualCommitSchema = z.strictObject({
  message: z.string().trim().min(1, "Describe what you did.").max(500),
  projectId: objectId.nullable(),
  weight: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]),
});

/**
 * Project creation schema
 */
export const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens").max(100),
  description: z.string().trim().max(2_000).optional(),
  workspaceId: z.string().min(1),
  status: z.enum(["planned", "active", "paused", "completed", "archived"]).default("active"),
});

export type ProjectInput = z.infer<typeof projectSchema>;

/**
 * Quick Inbox capture parser (deterministic syntax without LLM)
 * e.g. "implement caching #relaydb !high"
 * TODO: date tokens (tomorrow, fri, 2026-10-30) and @person per docs/state_desc.md §9
 */
export function parseQuickCapture(input: string): {
  title: string;
  projectSlug?: string;
  priority?: Exclude<Priority, "none">;
} {
  let text = input.trim();
  let projectSlug: string | undefined;
  let priority: Exclude<Priority, "none"> | undefined;

  // Extract #project
  const projectMatch = text.match(/#([\w-]+)/);
  if (projectMatch) {
    projectSlug = projectMatch[1];
    text = text.replace(projectMatch[0], "").trim();
  }

  // Extract !priority
  const priorityMatch = text.match(/!(critical|high|medium|low)\b/i);
  if (priorityMatch) {
    priority = priorityMatch[1].toLowerCase() as Exclude<Priority, "none">;
    text = text.replace(priorityMatch[0], "").trim();
  }

  return {
    title: text,
    projectSlug,
    priority,
  };
}

/**
 * Checkout request (paid-only access; no trial)
 */
export const checkoutSchema = z
  .object({
    plan: z.enum(["individual", "organisation"]),
    interval: z.enum(["monthly", "yearly"]).default("monthly"),
    seats: z.coerce.number().int().min(1).max(500).default(1),
  })
  .transform((input) => ({ ...input, seats: input.plan === "individual" ? 1 : input.seats }));

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * Razorpay Checkout handler payload, verified server-side before granting access
 */
export const razorpayVerifySchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});
