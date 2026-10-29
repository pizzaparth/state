import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { subscriptions } from "./subscriptions";

// One row per recurring charge attempt reported by a provider (Razorpay
// subscription.charged, Stripe invoice.paid / invoice.payment_failed). Amounts are in
// the currency's minor unit (paise, cents) exactly as the provider charged them.
export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    provider: text("provider").notNull(), // "razorpay" | "stripe"
    // Razorpay payment id or Stripe invoice id; unique so webhook retries upsert
    providerPaymentId: text("provider_payment_id").notNull().unique(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(), // "paid" | "failed"
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    receiptUrl: text("receipt_url"),
    chargedAt: timestamp("charged_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payments_user_charged_idx").on(table.userId, table.chargedAt),
    index("payments_subscription_idx").on(table.subscriptionId),
  ]
);
