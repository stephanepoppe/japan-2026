-- For databases created before `location` existed. New ones get it from schema.sql.
ALTER TABLE items ADD COLUMN location TEXT;
