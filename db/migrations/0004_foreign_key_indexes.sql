CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organisation_invitations_invited_by_idx" ON "organisation_invitations" USING btree ("invited_by_id");--> statement-breakpoint
CREATE INDEX "organisations_workspace_idx" ON "organisations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "boards_project_idx" ON "boards" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_column_idx" ON "tasks" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX "tasks_creator_idx" ON "tasks" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "commits_task_idx" ON "commits" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "commit_tags_tag_idx" ON "commit_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "task_tags_tag_idx" ON "task_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "metric_snapshots_user_idx" ON "metric_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "objective_projects_project_idx" ON "objective_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "objective_tasks_task_idx" ON "objective_tasks" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "objectives_owner_idx" ON "objectives" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id");