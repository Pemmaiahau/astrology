-- Chart log: one row per Markdown report downloaded. See README § "Chart log".
--
-- Applied with:
--   npx wrangler d1 execute astrology-chart-log --remote --file=./migrations/0001_create_chart_logs.sql
--
-- Types are SQLite's, so they are advisory rather than enforced; the route
-- is what guarantees the shape, by whitelisting and truncating every field
-- before it reaches the bind call.
CREATE TABLE IF NOT EXISTS chart_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  mode          TEXT    NOT NULL,   -- 'auto' (ephemeris) | 'manual' (typed positions)
  native_name   TEXT,
  gender        TEXT,
  birth_date    TEXT,               -- YYYY-MM-DD as entered
  birth_time    TEXT,               -- HH:mm as entered; the zone lives beside it
  place_name    TEXT,
  place_admin   TEXT,
  place_country TEXT,
  latitude      REAL,
  longitude     REAL,
  timezone      TEXT
);

-- The only query this table is read by is "what came in recently", so the
-- one index that matters is on arrival order.
CREATE INDEX IF NOT EXISTS idx_chart_logs_created_at ON chart_logs (created_at DESC);
