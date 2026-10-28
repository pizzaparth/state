import { pgTable, text, timestamp, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { tasks } from "./tasks";
import { commits } from "./commits";

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tags_workspace_name_uidx").on(table.workspaceId, table.name),
  ]
);

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

export const commitTags = pgTable(
  "commit_tags",
  {
    commitId: text("commit_id").notNull().references(() => commits.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.commitId, table.tagId] }),
  ]
);
