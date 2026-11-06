-- Reservation: a listing is held while its Stripe Checkout Session is open.
ALTER TABLE buy ADD COLUMN reserved_until TEXT;
ALTER TABLE buy ADD COLUMN stripe_session_id TEXT;

-- Sold listings. Contact details live here once the row leaves `buy`.
CREATE TABLE unlocked (
  id                INTEGER PRIMARY KEY,   -- same id the listing had in `buy`
  stripe_session_id TEXT NOT NULL UNIQUE,  -- UNIQUE makes webhook retries idempotent
  description       TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT NOT NULL,
  price             INTEGER NOT NULL,      -- smallest currency unit (e.g. cents)
  currency          TEXT NOT NULL,
  listed_at         TEXT NOT NULL,         -- original buy.created_at
  unlocked_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);