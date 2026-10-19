-- D1 schema for danceforhisglory.co.za
-- Apply with:  wrangler d1 execute danceforhisglory --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS bookings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT NOT NULL,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT,
  organisation TEXT,
  intent       TEXT,          -- give_and_come | give_only | come_only
  seats        INTEGER NOT NULL DEFAULT 0,
  give_when    TEXT,          -- before | night | both | done | talk
  amount_band  TEXT,
  tax_cert     TEXT,
  couple_code  TEXT,
  dietary      TEXT,
  message      TEXT,
  ip           TEXT,
  user_agent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);

CREATE TABLE IF NOT EXISTS referrals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at     TEXT NOT NULL,
  referrer_name  TEXT NOT NULL,
  referrer_phone TEXT,
  prospect_name  TEXT NOT NULL,
  prospect_phone TEXT,
  prospect_email TEXT,
  prospect_type  TEXT,
  context        TEXT,
  use_name       TEXT,
  ip             TEXT
);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON referrals(created_at);

-- Pheiffer's Table page (/table/): each guest's dance style and hopes for the night.
-- Created automatically by functions/api/table.js on first use.
CREATE TABLE IF NOT EXISTS answers (
  seat    INTEGER PRIMARY KEY,   -- 101 to 120
  dance   TEXT NOT NULL DEFAULT '',
  hope    TEXT NOT NULL DEFAULT '',
  updated TEXT NOT NULL
);
