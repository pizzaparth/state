-- The personal board page is now called "Board"; rename existing personal boards that
-- still carry the old default name. Boards renamed by hand are left alone.
UPDATE "boards" SET "name" = 'Board' WHERE "type" = 'personal' AND "name" = 'Personal';
