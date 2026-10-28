DROP INDEX "tasks_board_column_idx";--> statement-breakpoint
CREATE INDEX "tasks_inbox_idx" ON "tasks" USING btree ("workspace_id","created_at") WHERE "tasks"."board_id" is null and "tasks"."deleted_at" is null and "tasks"."completed_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_board_column_idx" ON "tasks" USING btree ("board_id","column_id","position" collate "C");