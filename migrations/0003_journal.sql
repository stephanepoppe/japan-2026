-- The journal: moments the owners post, comments readers leave. Run once against the live database:
--   npx wrangler d1 execute japan-2026 --remote --file=migrations/0003_journal.sql
-- New databases get these from schema.sql.
CREATE TABLE IF NOT EXISTS moments (
  id         TEXT PRIMARY KEY,
  day        TEXT NOT NULL,          -- YYYY-MM-DD, Japan time
  time       TEXT NOT NULL,          -- HH:MM, Japan time
  place_name TEXT,
  lat        REAL,                   -- no coordinates = no pin on the map
  lon        REAL,
  text       TEXT NOT NULL,
  photos     TEXT NOT NULL,          -- JSON: [{ key, w, h }], files in the PHOTOS R2 bucket
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS moments_day ON moments(day, time);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  moment_id  TEXT NOT NULL,
  name       TEXT NOT NULL,          -- typed by the reader; readers have no verified identity here
  text       TEXT NOT NULL,
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_moment ON comments(moment_id);
