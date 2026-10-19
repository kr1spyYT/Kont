BEGIN;

-- Explicit server-owned sale policy. Existing catalog rows get a one-time
-- rarity/type-based category; populated categories are never overwritten.
ALTER TABLE game_items ADD COLUMN IF NOT EXISTS sale_category TEXT;
UPDATE game_items SET sale_category = CASE
  WHEN type = 'car' AND rarity IN ('rare', 'epic', 'legendary', 'mythic') THEN 'elite_cars'
  WHEN type = 'clothing' AND rarity IN ('rare', 'epic', 'legendary', 'mythic') THEN 'limited'
  ELSE 'common' END
WHERE sale_category IS NULL;
ALTER TABLE game_items ALTER COLUMN sale_category SET DEFAULT 'common';
ALTER TABLE game_items ALTER COLUMN sale_category SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_items_sale_category_check') THEN
    ALTER TABLE game_items ADD CONSTRAINT game_items_sale_category_check
      CHECK (sale_category IN ('common', 'limited', 'elite_cars', 'rare_plates'));
  END IF;
END $$;

-- Classify old XP events without changing accumulated player XP.
ALTER TABLE player_season_xp_events ADD COLUMN IF NOT EXISTS source_type TEXT;
UPDATE player_season_xp_events SET source_type = CASE
  WHEN idempotency_key LIKE 'claim:%' THEN 'reward'
  ELSE 'action' END
WHERE source_type IS NULL;
ALTER TABLE player_season_xp_events ALTER COLUMN source_type SET DEFAULT 'action';
ALTER TABLE player_season_xp_events ALTER COLUMN source_type SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_season_xp_events_source_type_check') THEN
    ALTER TABLE player_season_xp_events ADD CONSTRAINT player_season_xp_events_source_type_check
      CHECK (source_type IN ('action', 'contract', 'reward'));
  END IF;
END $$;

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

INSERT INTO game_settings (setting_key, setting_value) VALUES
  ('seasonProgression', '{"baseXp":100,"levelStepXp":10,"dailyActionXpCap":250,"quickSellXpDailyCap":50}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- Convert existing flat-curve XP into equivalent level progress under the new curve.
-- Existing level and fractional progress are preserved; XP is never reset.
WITH prior AS (
  SELECT telegram_id, season_id, season_xp AS old_xp,
         LEAST(29, GREATEST(0, FLOOR(season_xp::numeric / 100)::integer)) AS completed_levels
  FROM player_season_progress
  WHERE season_id = 'season-1-genesis' AND season_xp > 0
)
UPDATE player_season_progress progress
SET season_xp = CASE
  WHEN prior.old_xp < 2900 THEN
    prior.completed_levels * 100
      + 10 * prior.completed_levels * (prior.completed_levels - 1) / 2
      + FLOOR((prior.old_xp - prior.completed_levels * 100)::numeric
          * (100 + prior.completed_levels * 10) / 100)::integer
  ELSE 6960 + (prior.old_xp - 2900)
END
FROM prior
WHERE progress.telegram_id = prior.telegram_id AND progress.season_id = prior.season_id;

COMMIT;
