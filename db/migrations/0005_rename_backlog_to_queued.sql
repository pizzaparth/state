-- The first column of every board is shown as "Queued". Only default-named columns
-- change; state_type stays 'backlog', so no behaviour depends on the label.
UPDATE "columns" SET "name" = 'Queued' WHERE "state_type" = 'backlog' AND "name" = 'Backlog';
