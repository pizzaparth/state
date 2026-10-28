import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"), // "planned" | "active" | "paused" | "completed" | "archived"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});
