DROP TABLE IF EXISTS buy;

CREATE TABLE buy (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  description    TEXT NOT NULL,
  is_unlocked    INTEGER NOT NULL DEFAULT 0 CHECK (is_unlocked IN (0, 1)),
  reserved_until TEXT,
  tier           INTEGER NOT NULL DEFAULT 1 CHECK (tier IN (0, 1, 2, 3)),
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_buy_created_at ON buy (created_at);