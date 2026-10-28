import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { users } from "./users";

export const organisations = pgTable("organisations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organisationMembers = pgTable(
  "organisation_members",
  {
    organisationId: text("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // "owner" | "admin" | "member" | "viewer"
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organisationId, table.userId] }),
  ]
);
