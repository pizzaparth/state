import { pgTable, text, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { users } from "./users";

export const organisations = pgTable("organisations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  description: text("description"),
  timezone: text("timezone").default("UTC").notNull(), // organisation-level metric day boundaries
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
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
    index("organisation_members_user_idx").on(table.userId),
  ]
);

export const organisationInvitations = pgTable(
  "organisation_invitations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organisationId: text("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    invitedById: text("invited_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("pending"), // "pending" | "accepted" | "revoked" | "expired"
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("organisation_invitations_org_idx").on(table.organisationId),
    index("organisation_invitations_email_idx").on(table.email),
  ]
);
