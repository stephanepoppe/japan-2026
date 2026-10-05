-- AI day plans and Surprise me. Run once against the live database:
--   npx wrangler d1 execute japan-2026 --remote --file=migrations/0002_ai_suggestions.sql
-- New databases get these from schema.sql.
CREATE TABLE IF NOT EXISTS plans (
  day        TEXT PRIMARY KEY,       -- YYYY-MM-DD
  stay_key   TEXT NOT NULL,          -- which stay it belongs to, so "rethink" can clear its siblings
  plan       TEXT NOT NULL,          -- JSON: area, intro, stops[]
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS plans_stay ON plans(stay_key);

-- One split per stay: which area each day goes to.
CREATE TABLE IF NOT EXISTS areas (
  stay_key   TEXT PRIMARY KEY,
  areas      TEXT NOT NULL,          -- JSON: [{ day, area, why }]
  created_at TEXT NOT NULL
);

-- Everything Surprise me has shown, per city, so it never repeats across both phones.
CREATE TABLE IF NOT EXISTS surprises (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  city       TEXT NOT NULL,
  title      TEXT NOT NULL,
  place      TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS surprises_city ON surprises(city);
