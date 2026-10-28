import { pgTable, text, doublePrecision, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { users } from "./users";
import { projects } from "./projects";
import { tasks } from "./tasks";

// Objectives are measurable positions: current / target over a deadline (docs/state_desc.md §24)
export const objectives = pgTable(
  "objectives",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    currentValue: doublePrecision("current_value").notNull().default(0),
    targetValue: doublePrecision("target_value").notNull(),
    unit: text("unit").notNull(), // e.g. "modules"
    startAt: timestamp("start_at", { withTimezone: true }).defaultNow().notNull(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Status (ahead | on track | behind | completed) is derived from velocity vs required velocity, never stored
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("objectives_workspace_idx").on(table.workspaceId),
    index("objectives_owner_idx").on(table.ownerId),
  ]
);

export const objectiveProjects = pgTable(
  "objective_projects",
  {
    objectiveId: text("objective_id").notNull().references(() => objectives.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.objectiveId, table.projectId] }),
    index("objective_projects_project_idx").on(table.projectId),
  ]
);

export const objectiveTasks = pgTable(
  "objective_tasks",
  {
    objectiveId: text("objective_id").notNull().references(() => objectives.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.objectiveId, table.taskId] }),
    index("objective_tasks_task_idx").on(table.taskId),
  ]
);
