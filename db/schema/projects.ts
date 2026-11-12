import { pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    // Longer free-text notes (max 10 000), edited on the project page
    notes: text("notes"),
    status: text("status").notNull().default("active"), // "planned" | "active" | "paused" | "completed" | "archived"
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("projects_workspace_slug_uidx").on(table.workspaceId, table.slug),
    index("projects_name_trgm_idx").using("gin", sql`${table.name} gin_trgm_ops`),
  ]
);
