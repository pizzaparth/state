import { pgTable, text, integer, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { projects } from "./projects";
import { boards } from "./boards";
import { columns } from "./columns";
import { users } from "./users";

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    // Null board/column = Inbox capture (not yet triaged onto a board)
    boardId: text("board_id").references(() => boards.id, { onDelete: "cascade" }),
    columnId: text("column_id").references(() => columns.id, { onDelete: "set null" }),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    creatorId: text("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    priority: text("priority").notNull().default("none"), // "none" | "low" | "medium" | "high" | "critical"
    weight: integer("weight").notNull().default(2), // 1 = small, 2 = normal, 4 = major, 8 = milestone
    // Lexicographic fractional ordering key; moving a card rewrites only that card's key
    position: text("position").notNull().default("a0"),
    // Recurrence: "daily" | "weekdays" | "weekly" | "monthly" | "interval:<days>"
    recurrenceRule: text("recurrence_rule"),
    recurrenceParentId: text("recurrence_parent_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft delete; permanent cleanup after retention window
  },
  (table) => [
    check("tasks_weight_check", sql`${table.weight} in (1, 2, 4, 8)`),
    index("tasks_workspace_idx").on(table.workspaceId),
    // Bytewise collation matches the fractional ordering keys (lib/position.ts)
    index("tasks_board_column_idx").on(table.boardId, table.columnId, sql`${table.position} collate "C"`),
    // Inbox: untriaged, open captures per workspace, newest first
    index("tasks_inbox_idx")
      .on(table.workspaceId, table.createdAt)
      .where(sql`${table.boardId} is null and ${table.deletedAt} is null and ${table.completedAt} is null`),
    index("tasks_project_idx").on(table.projectId),
    index("tasks_assignee_idx").on(table.assigneeId),
    // Foreign keys: deleting a column, user or task must not scan the whole table
    index("tasks_column_idx").on(table.columnId),
    index("tasks_creator_idx").on(table.creatorId),
    index("tasks_completed_at_idx").on(table.workspaceId, table.completedAt),
  ]
);
