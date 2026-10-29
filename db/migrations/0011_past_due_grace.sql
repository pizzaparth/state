ALTER TABLE "subscriptions" ADD COLUMN "past_due_since" timestamp with time zone;--> statement-breakpoint
-- Subscriptions already past due start their grace period from their last update
UPDATE "subscriptions" SET "past_due_since" = "updated_at" WHERE "status" = 'past_due';
