import { z } from "zod";

/**
 * Task creation & update schemas
 */
export const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  projectId: z.string().optional().nullable(),
  boardId: z.string().min(1, "Board is required"),
  columnId: z.string().min(1, "Column is required"),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).default("none"),
  weight: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]).default(2),
  dueAt: z.coerce.date().optional().nullable(),
});

export type TaskInput = z.infer<typeof taskSchema>;

/**
 * Commit creation schema (manual or terminal completion)
 */
export const commitSchema = z.object({
  message: z.string().min(1, "Commit message is required").max(500),
  workspaceId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  executionValue: z.number().int().min(1).max(32).default(2),
  source: z.enum(["task_completion", "manual", "imported", "integration"]).default("manual"),
});

export type CommitInput = z.infer<typeof commitSchema>;

/**
 * Project creation schema
 */
export const projectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  slug: z.string().min(1).max(100),
  description: z.string().optional(),
  workspaceId: z.string().min(1),
  status: z.enum(["planned", "active", "paused", "completed", "archived"]).default("active"),
});

export type ProjectInput = z.infer<typeof projectSchema>;

/**
 * Quick Inbox capture parser (deterministic syntax without LLM)
 * e.g. "implement caching tomorrow #relaydb !high"
 */
export function parseQuickCapture(input: string): {
  title: string;
  projectSlug?: string;
  priority?: "low" | "medium" | "high" | "urgent";
} {
  let text = input.trim();
  let projectSlug: string | undefined;
  let priority: "low" | "medium" | "high" | "urgent" | undefined;

  // Extract #project
  const projectMatch = text.match(/#([\w-]+)/);
  if (projectMatch) {
    projectSlug = projectMatch[1];
    text = text.replace(projectMatch[0], "").trim();
  }

  // Extract !priority
  const priorityMatch = text.match(/!(urgent|high|medium|low)/i);
  if (priorityMatch) {
    priority = priorityMatch[1].toLowerCase() as any;
    text = text.replace(priorityMatch[0], "").trim();
  }

  return {
    title: text,
    projectSlug,
    priority,
  };
}
