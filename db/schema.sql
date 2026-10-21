DROP TABLE IF EXISTS buy;
DROP TABLE IF EXISTS unlocked;

CREATE TABLE buy (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  description    TEXT NOT NULL,
  reserved_until TEXT,
  tier           INTEGER NOT NULL DEFAULT 1 CHECK (tier IN (0, 1, 2, 3)),
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_buy_created_at ON buy (created_at);

CREATE TABLE unlocked (
  session_id   TEXT PRIMARY KEY,
  description  TEXT NOT NULL,
  tier         INTEGER NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT NOT NULL,
  price_cents  INTEGER NOT NULL,
  purchased_at TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_unlocked_created_at ON unlocked (created_at);