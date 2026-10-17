CREATE TABLE IF NOT EXISTS players (
  telegram_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  username TEXT,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  state JSONB NOT NULL,
  free_case_opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_events (
  event_id BIGSERIAL PRIMARY KEY,
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  action_type TEXT NOT NULL,
  xp_delta INTEGER NOT NULL DEFAULT 0,
  balance_delta INTEGER NOT NULL DEFAULT 0,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (telegram_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS market_listings (
  listing_id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES players(telegram_id),
  item JSONB NOT NULL,
  asking_price INTEGER NOT NULL CHECK (asking_price > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_at TIMESTAMPTZ,
  buyer_id TEXT REFERENCES players(telegram_id)
);

CREATE TABLE IF NOT EXISTS game_containers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('clothing', 'car', 'plates')),
  tier INTEGER NOT NULL CHECK (tier > 0),
  price INTEGER NOT NULL CHECK (price >= 0),
  sort_order INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '📦',
  image TEXT NOT NULL DEFAULT 'containers/second.png',
  drops JSONB NOT NULL CHECK (jsonb_typeof(drops) = 'array'),
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS game_containers_order_idx ON game_containers (sort_order, id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS telegram_admin_sessions (
  telegram_id TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS market_listings_active_created_idx
  ON market_listings (created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS player_events_player_created_idx
  ON player_events (telegram_id, created_at DESC);
