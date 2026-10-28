import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { projects } from "./projects";
import { tasks } from "./tasks";
import { users } from "./users";

export const commits = pgTable("commits", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  executionValue: integer("execution_value").notNull().default(2), // mirrors weight or manual score
  source: text("source").notNull().default("manual"), // "task_completion" | "manual" | "imported" | "integration"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
