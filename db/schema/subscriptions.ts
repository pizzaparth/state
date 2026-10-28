import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { organisations } from "./organisations";

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organisationId: text("organisation_id").references(() => organisations.id, { onDelete: "set null" }),
  provider: text("provider").notNull(), // "razorpay" | "stripe"
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  plan: text("plan").notNull(), // "individual" | "organisation"
  status: text("status").notNull().default("active"), // "active" | "trialing" | "past_due" | "canceled"
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
