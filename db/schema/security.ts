import { pgTable, text, integer, bigint, timestamp } from "drizzle-orm/pg-core";

// Better Auth rate limiter storage (rateLimit.storage = "database"). Shared across
// serverless instances, unlike the default in-memory limiter.
export const rateLimits = pgTable("rate_limits", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Fixed-window throttles keyed by account or user rather than IP, so rotating
// source addresses cannot bypass them (lib/security/throttle.ts).
export const throttleBuckets = pgTable("throttle_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});
