import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { projects } from "./projects";

export const boards = pgTable("boards", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("personal"), // "personal" | "organisation" | "project"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
