import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { tasks } from "./tasks";

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const taskTags = pgTable(
  "task_tags",
  {
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.tagId] }),
  ]
);
