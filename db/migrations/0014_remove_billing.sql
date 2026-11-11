DROP TABLE "subscriptions" CASCADE;--> statement-breakpoint
DROP TABLE "payments" CASCADE;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "subscription_status";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "subscription_plan";