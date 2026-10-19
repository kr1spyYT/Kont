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

CREATE TABLE IF NOT EXISTS financial_ledger (
  ledger_id BIGSERIAL PRIMARY KEY,
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id),
  idempotency_key TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  amount_delta BIGINT NOT NULL CHECK (amount_delta <> 0),
  balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
  reference_type TEXT,
  reference_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (telegram_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS financial_ledger_player_created_idx
  ON financial_ledger (telegram_id, created_at DESC);

CREATE TABLE IF NOT EXISTS premium_auction_lots (
  lot_id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES players(telegram_id),
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('item', 'plate')),
  asset_instance_id TEXT NOT NULL,
  sale_category TEXT NOT NULL CHECK (sale_category IN ('limited', 'elite_cars', 'rare_plates')),
  asset_snapshot JSONB NOT NULL,
  starting_price BIGINT NOT NULL CHECK (starting_price BETWEEN 1 AND 2000000000),
  current_bid BIGINT CHECK (current_bid BETWEEN 1 AND 2000000000),
  highest_bidder_id TEXT REFERENCES players(telegram_id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  CHECK ((highest_bidder_id IS NULL) = (current_bid IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS premium_auction_active_asset_idx
  ON premium_auction_lots (asset_kind, asset_instance_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS premium_auction_active_ends_idx
  ON premium_auction_lots (ends_at, created_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS premium_auction_bids (
  bid_id BIGSERIAL PRIMARY KEY,
  lot_id TEXT NOT NULL REFERENCES premium_auction_lots(lot_id),
  bidder_id TEXT NOT NULL REFERENCES players(telegram_id),
  request_id TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount BETWEEN 1 AND 2000000000),
  status TEXT NOT NULL DEFAULT 'leading' CHECK (status IN ('leading', 'outbid', 'won', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bidder_id, request_id)
);
CREATE INDEX IF NOT EXISTS premium_auction_bids_lot_created_idx
  ON premium_auction_bids (lot_id, created_at DESC);

CREATE TABLE IF NOT EXISTS game_security_events (
  event_id BIGSERIAL PRIMARY KEY,
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'notice' CHECK (severity IN ('notice', 'warning', 'high')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS game_security_events_player_created_idx
  ON game_security_events (telegram_id, created_at DESC);

CREATE TABLE IF NOT EXISTS player_action_rate_limits (
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  action_group TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, action_group)
);
CREATE INDEX IF NOT EXISTS player_action_rate_limits_updated_idx
  ON player_action_rate_limits (updated_at);

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
  ('resaleMultiplier', '0.65'::jsonb),
  ('seasonProgression', '{"baseXp":100,"levelStepXp":10,"dailyActionXpCap":250,"quickSellXpDailyCap":50}'::jsonb)
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
  sale_category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE game_items ADD COLUMN IF NOT EXISTS sale_category TEXT;
UPDATE game_items SET sale_category = CASE
  WHEN type = 'car' AND rarity IN ('rare', 'epic', 'legendary', 'mythic') THEN 'elite_cars'
  WHEN type = 'clothing' AND rarity IN ('rare', 'epic', 'legendary', 'mythic') THEN 'limited'
  ELSE 'common' END WHERE sale_category IS NULL;
ALTER TABLE game_items ALTER COLUMN sale_category SET DEFAULT 'common';
ALTER TABLE game_items ALTER COLUMN sale_category SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_items_sale_category_check') THEN
    ALTER TABLE game_items ADD CONSTRAINT game_items_sale_category_check
      CHECK (sale_category IN ('common', 'limited', 'elite_cars', 'rare_plates'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS game_items_type_name_idx ON game_items (type, name);

CREATE INDEX IF NOT EXISTS market_listings_active_created_idx
  ON market_listings (created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS player_events_player_created_idx
  ON player_events (telegram_id, created_at DESC);

CREATE TABLE IF NOT EXISTS game_seasons (
  season_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  premium_price_stars INTEGER NOT NULL DEFAULT 250 CHECK (premium_price_stars > 0),
  limited_container_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE game_seasons ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
UPDATE game_seasons SET starts_at = updated_at WHERE starts_at IS NULL;
ALTER TABLE game_seasons ALTER COLUMN starts_at SET DEFAULT NOW();
ALTER TABLE game_seasons ALTER COLUMN starts_at SET NOT NULL;
ALTER TABLE game_seasons ALTER COLUMN ends_at SET DEFAULT (NOW() + INTERVAL '30 days');
UPDATE game_seasons SET ends_at = starts_at + INTERVAL '30 days' WHERE ends_at IS NULL;
ALTER TABLE game_seasons ALTER COLUMN ends_at SET NOT NULL;
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
  source_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, season_id, idempotency_key)
);
ALTER TABLE player_season_xp_events ADD COLUMN IF NOT EXISTS source_type TEXT;
UPDATE player_season_xp_events SET source_type = CASE
  WHEN idempotency_key LIKE 'claim:%' THEN 'reward'
  ELSE 'action' END WHERE source_type IS NULL;
ALTER TABLE player_season_xp_events ALTER COLUMN source_type SET DEFAULT 'action';
ALTER TABLE player_season_xp_events ALTER COLUMN source_type SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_season_xp_events_source_type_check') THEN
    ALTER TABLE player_season_xp_events ADD CONSTRAINT player_season_xp_events_source_type_check
      CHECK (source_type IN ('action', 'contract', 'reward'));
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS player_season_reward_claims (
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 30),
  track TEXT NOT NULL CHECK (track IN ('free', 'premium')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, season_id, level, track)
);
CREATE TABLE IF NOT EXISTS season_pass_rewards (
  season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 30),
  track TEXT NOT NULL CHECK (track IN ('free', 'premium')),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('coins', 'container', 'item', 'xp', 'frame', 'keys')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reward_ref TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season_id, level, track)
);
CREATE TABLE IF NOT EXISTS season_contracts (
  season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
  contract_id TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  event_type TEXT NOT NULL CHECK (event_type IN ('open-container', 'equip-item')),
  target_count INTEGER NOT NULL CHECK (target_count > 0),
  xp_reward INTEGER NOT NULL CHECK (xp_reward > 0),
  title TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season_id, contract_id)
);

CREATE TABLE IF NOT EXISTS player_season_contract_progress (
  telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (telegram_id, season_id, contract_id, period_key),
  FOREIGN KEY (season_id, contract_id) REFERENCES season_contracts(season_id, contract_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS player_season_contracts_period_idx
  ON player_season_contract_progress (telegram_id, period_key, updated_at DESC);
INSERT INTO season_contracts (season_id, contract_id, cadence, event_type, target_count, xp_reward, title)
VALUES
  ('season-1-genesis', 'daily-open-two', 'daily', 'open-container', 2, 50, 'Открой любые 2 контейнера'),
  ('season-1-genesis', 'daily-equip-one', 'daily', 'equip-item', 1, 40, 'Собери образ: экипируй предмет')
ON CONFLICT (season_id, contract_id) DO NOTHING;

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
