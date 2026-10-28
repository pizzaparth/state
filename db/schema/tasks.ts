import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { projects } from "./projects";
import { boards } from "./boards";
import { columns } from "./columns";
import { users } from "./users";

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  boardId: text("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  columnId: text("column_id").notNull().references(() => columns.id, { onDelete: "cascade" }),
  assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
  creatorId: text("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("none"), // "none" | "low" | "medium" | "high" | "urgent"
  weight: integer("weight").notNull().default(2), // 1 = small, 2 = normal, 4 = major, 8 = milestone
  position: integer("position").notNull().default(0),
  dueAt: timestamp("due_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});
