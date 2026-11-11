ALTER TABLE "users" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "users_demo_created_idx" ON "users" USING btree ("created_at") WHERE "users"."is_demo";--> statement-breakpoint
-- Fresh start for the personal deployment: every earlier account and its data goes.
-- The owner account is recreated on the first sign-in with OWNER_CODE.
DELETE FROM "users";--> statement-breakpoint
DELETE FROM "workspaces";--> statement-breakpoint
DELETE FROM "verifications";--> statement-breakpoint
DELETE FROM "audit_events";
