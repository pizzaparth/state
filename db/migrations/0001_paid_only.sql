UPDATE "users" SET "subscription_status" = 'none' WHERE "subscription_status" IS NULL OR "subscription_status" = 'trialing';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "subscription_status" SET DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "subscription_status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "trial_ends_at";