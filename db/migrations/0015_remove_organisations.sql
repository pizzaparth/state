ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "audit_events_organisation_id_organisations_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_events_org_created_idx";--> statement-breakpoint
ALTER TABLE "audit_events" DROP COLUMN IF EXISTS "organisation_id";--> statement-breakpoint
DROP TABLE IF EXISTS "organisation_invitations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "organisation_members" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "organisations" CASCADE;--> statement-breakpoint
DELETE FROM "workspaces" WHERE "type" = 'organisation';
