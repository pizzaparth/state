ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
-- People already using State skip first-run setup
UPDATE "users" SET "onboarded_at" = now();
