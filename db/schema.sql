CREATE TABLE IF NOT EXISTS players (
  telegram_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  username TEXT,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  state JSONB NOT NULL,
  free_case_opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_updates (
  update_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES players(telegram_id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS game_updates_published_idx ON game_updates (published_at DESC, update_id DESC);

CREATE TABLE IF NOT EXISTS player_seen_game_updates (
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  update_id TEXT NOT NULL REFERENCES game_updates(update_id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, update_id)
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
  cooldown_seconds INTEGER NOT NULL DEFAULT 0 CHECK (cooldown_seconds >= 0),
  deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE game_containers ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER NOT NULL DEFAULT 0 CHECK (cooldown_seconds >= 0);
CREATE INDEX IF NOT EXISTS game_containers_order_idx ON game_containers (sort_order, id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS player_container_openings (
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  container_id TEXT NOT NULL REFERENCES game_containers(id) ON DELETE CASCADE,
  last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, container_id)
);
CREATE INDEX IF NOT EXISTS player_container_openings_player_idx ON player_container_openings (telegram_id, last_opened_at DESC);

CREATE TABLE IF NOT EXISTS telegram_admin_sessions (
  telegram_id TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO game_settings (setting_key, setting_value) VALUES
  ('marketplaceEnabled', 'true'::jsonb),
  ('containersEnabled', 'true'::jsonb),
  ('resaleMultiplier', '0.65'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS game_assets (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type = 'image/webp'),
  image_data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('clothing', 'car')),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  image TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
  base_price INTEGER NOT NULL CHECK (base_price > 0),
  respect INTEGER NOT NULL DEFAULT 0 CHECK (respect >= 0),
  slot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS game_items_type_name_idx ON game_items (type, name);

CREATE INDEX IF NOT EXISTS market_listings_active_created_idx
  ON market_listings (created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS player_events_player_created_idx
  ON player_events (telegram_id, created_at DESC);

CREATE TABLE IF NOT EXISTS game_seasons (
  season_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ends_at TIMESTAMPTZ,
  premium_price_stars INTEGER NOT NULL DEFAULT 250 CHECK (premium_price_stars > 0),
  limited_container_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS game_seasons_single_active_idx ON game_seasons (is_active) WHERE is_active;
INSERT INTO game_seasons (season_id, name, premium_price_stars, is_active)
VALUES ('season-1-genesis', 'Season 1: Genesis', 250, TRUE)
ON CONFLICT (season_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS player_season_progress (
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
  season_xp INTEGER NOT NULL DEFAULT 0 CHECK (season_xp >= 0),
  is_premium_pass BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, season_id)
);
CREATE TABLE IF NOT EXISTS player_season_xp_events (
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  xp_delta INTEGER NOT NULL CHECK (xp_delta > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, season_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS player_season_reward_claims (
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 30),
  track TEXT NOT NULL CHECK (track IN ('free', 'premium')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, season_id, level, track)
);
CREATE TABLE IF NOT EXISTS season_pass_invoices (
  invoice_payload TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
  stars_amount INTEGER NOT NULL CHECK (stars_amount > 0),
  invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS season_pass_one_pending_invoice_idx
  ON season_pass_invoices (telegram_id, season_id) WHERE status = 'pending';
CREATE TABLE IF NOT EXISTS season_pass_payments (
  telegram_payment_charge_id TEXT PRIMARY KEY,
  provider_payment_charge_id TEXT,
  invoice_payload TEXT NOT NULL UNIQUE REFERENCES season_pass_invoices(invoice_payload),
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency = 'XTR'),
  stars_amount INTEGER NOT NULL CHECK (stars_amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
