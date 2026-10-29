import { pgTable, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { projects } from "./projects";
import { tasks } from "./tasks";
import { users } from "./users";

export const commits = pgTable(
  "commits",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    executionValue: integer("execution_value").notNull().default(2), // mirrors weight or manual score
    source: text("source").notNull().default("manual"), // "task_completion" | "manual" | "imported" | "integration"
    // Original event time; immutable after creation
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("commits_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("commits_user_created_idx").on(table.userId, table.createdAt),
    index("commits_project_created_idx").on(table.projectId, table.createdAt),
    // Foreign key lookups (task deletion sets task_id null on every commit, live or not)
    index("commits_task_idx").on(table.taskId),
    // Idempotent auto-commit: at most one live commit per completed task
    // Search: substring match on messages (pg_trgm)
    index("commits_message_trgm_idx").using("gin", sql`${table.message} gin_trgm_ops`),
    uniqueIndex("commits_task_live_uidx").on(table.taskId).where(sql`${table.taskId} is not null and ${table.deletedAt} is null`),
  ]
);
