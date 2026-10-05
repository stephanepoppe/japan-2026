-- Day items added from the phones. One row per item so two people editing at the
-- same time can't overwrite each other (Q9b).
CREATE TABLE IF NOT EXISTS items (
  id         TEXT PRIMARY KEY,
  day        TEXT NOT NULL,          -- YYYY-MM-DD
  time       TEXT,                   -- optional HH:MM
  title      TEXT NOT NULL,
  location   TEXT,                   -- optional free text; becomes a Maps link
  notes      TEXT,
  created_by TEXT NOT NULL,          -- email, from the Cloudflare Access JWT
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_day ON items(day);

-- AI day plans, area splits and Surprise me history (see migrations/0002).
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

-- Shared bookmarks for the Links tab. Seeds go in once with fixed ids; deleting one
-- sticks unless someone re-runs this file.
CREATE TABLE IF NOT EXISTS links (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  url        TEXT NOT NULL,          -- http(s) only, checked in the function
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO links (id, title, url, created_by, created_at) VALUES
  ('seed-smartex',  'Shinkansen (smart-ex)',  'https://smart-ex.jp/en/',                    'seed', '2026-01-01T00:00:00Z'),
  ('seed-airbnb',   'Airbnb trips',           'https://www.airbnb.be/trips',                'seed', '2026-01-01T00:00:01Z'),
  ('seed-booking',  'Booking.com trips',      'https://secure.booking.com/mytrips.html',    'seed', '2026-01-01T00:00:02Z'),
  ('seed-maps',     'Google Maps',            'https://maps.google.com',                    'seed', '2026-01-01T00:00:03Z'),
  ('seed-jorudan',  'Japan Transit (Jorudan)','https://world.jorudan.co.jp/mln/en/',        'seed', '2026-01-01T00:00:04Z'),
  ('seed-klm',      'KLM my trip',            'https://www.klm.be/trip',                    'seed', '2026-01-01T00:00:05Z');

-- The journal (see migrations/0003).
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
