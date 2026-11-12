ALTER TABLE "users" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "columns" ADD COLUMN "wip_limit" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "defer_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "planned_for" date;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "column_entered_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "projects_name_trgm_idx" ON "projects" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "tasks_description_trgm_idx" ON "tasks" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "tasks_planned_idx" ON "tasks" USING btree ("workspace_id","planned_for") WHERE "tasks"."planned_for" is not null;--> statement-breakpoint
CREATE INDEX "tags_name_trgm_idx" ON "tags" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
-- Existing cards: best known time they reached their column
UPDATE "tasks" SET "column_entered_at" = coalesce("completed_at", "started_at", "created_at");
