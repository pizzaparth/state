import { pgTable, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { organisations } from "./organisations";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    organisationId: text("organisation_id").references(() => organisations.id, { onDelete: "set null" }),
    provider: text("provider").notNull(), // "razorpay" | "stripe"
    providerCustomerId: text("provider_customer_id"),
    // Unique so signed webhook deliveries upsert idempotently
    providerSubscriptionId: text("provider_subscription_id").unique(),
    plan: text("plan").notNull(), // "individual" | "organisation"
    status: text("status").notNull(), // "incomplete" | "active" | "past_due" | "canceled" | "expired"
    seats: integer("seats").notNull().default(1), // organisation plan is billed per member
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index("subscriptions_user_idx").on(table.userId),
    index("subscriptions_organisation_idx").on(table.organisationId),
  ]
);
