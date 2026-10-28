import { pgTable, text, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";
import { users } from "./users";

export const metricSnapshots = pgTable("metric_snapshots", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  metricType: text("metric_type").notNull(), // "execution" | "velocity" | "throughput" | "cycle_time" | "consistency"
  period: text("period").notNull(), // "day" | "7d" | "30d" | "90d" | "1y" | "all"
  value: doublePrecision("value").notNull().default(0),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
});
