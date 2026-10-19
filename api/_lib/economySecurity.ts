import type { PoolClient } from 'pg';

export type GameActionRateGroup = 'container-open' | 'quick-sale' | 'market' | 'general';

export interface FinancialLedgerEntry {
  telegramId: string;
  idempotencyKey: string;
  operationType: string;
  amountDelta: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  details?: Record<string, unknown>;
}

interface RateLimitPolicy {
  maxAttempts: number;
  windowSeconds: number;
  blockSeconds: number;
}

const RATE_LIMIT_POLICIES: Record<GameActionRateGroup, RateLimitPolicy> = {
  'container-open': { maxAttempts: 12, windowSeconds: 60, blockSeconds: 60 },
  'quick-sale': { maxAttempts: 12, windowSeconds: 60, blockSeconds: 60 },
  market: { maxAttempts: 20, windowSeconds: 60, blockSeconds: 60 },
  general: { maxAttempts: 60, windowSeconds: 60, blockSeconds: 60 },
};

export const getGameActionRateGroup = (actionType: string): GameActionRateGroup => {
  if (['open-container', 'open-season-case', 'spin-license-plate'].includes(actionType)) return 'container-open';
  if (actionType.includes('sell')) return 'quick-sale';
  if (actionType.startsWith('list-') || actionType.startsWith('premium-') || actionType.includes('listing') || actionType.includes('auction') || actionType.includes('bid')) return 'market';
  return 'general';
};

let economySecurityTablesReady: Promise<void> | undefined;

export function ensureEconomySecurityTables(client: PoolClient): Promise<void> {
  if (!economySecurityTablesReady) {
    economySecurityTablesReady = createEconomySecurityTables(client).catch((failure) => {
      economySecurityTablesReady = undefined;
      throw failure;
    });
  }
  return economySecurityTablesReady;
}

async function createEconomySecurityTables(client: PoolClient): Promise<void> {
  await client.query(`
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
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS financial_ledger_player_created_idx
    ON financial_ledger (telegram_id, created_at DESC)`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS game_security_events (
      event_id BIGSERIAL PRIMARY KEY,
      telegram_id TEXT NOT NULL REFERENCES players(telegram_id),
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'notice' CHECK (severity IN ('notice', 'warning', 'high')),
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS game_security_events_player_created_idx
    ON game_security_events (telegram_id, created_at DESC)`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS player_action_rate_limits (
      telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
      action_group TEXT NOT NULL,
      window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      blocked_until TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (telegram_id, action_group)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS player_action_rate_limits_updated_idx
    ON player_action_rate_limits (updated_at)`);
}

export async function recordFinancialLedgerEntry(client: PoolClient, entry: FinancialLedgerEntry): Promise<void> {
  if (!Number.isSafeInteger(entry.amountDelta) || entry.amountDelta === 0) throw new Error('Финансовая запись должна иметь ненулевое целое изменение баланса.');
  if (!Number.isSafeInteger(entry.balanceAfter) || entry.balanceAfter < 0) throw new Error('Финансовая запись содержит недопустимый остаток баланса.');

  const inserted = await client.query<{ ledger_id: string }>(
    `INSERT INTO financial_ledger
       (telegram_id, idempotency_key, operation_type, amount_delta, balance_after, reference_type, reference_id, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT (telegram_id, idempotency_key) DO NOTHING
     RETURNING ledger_id`,
    [entry.telegramId, entry.idempotencyKey, entry.operationType, entry.amountDelta, entry.balanceAfter,
      entry.referenceType ?? null, entry.referenceId ?? null, JSON.stringify(entry.details ?? {})],
  );
  if (inserted.rowCount === 1) return;

  const existing = await client.query<{ operation_type: string; amount_delta: number; balance_after: number }>(
    `SELECT operation_type, amount_delta, balance_after
     FROM financial_ledger WHERE telegram_id = $1 AND idempotency_key = $2`,
    [entry.telegramId, entry.idempotencyKey],
  );
  const prior = existing.rows[0];
  if (!prior || prior.operation_type !== entry.operationType
    || Number(prior.amount_delta) !== entry.amountDelta || Number(prior.balance_after) !== entry.balanceAfter) {
    throw new Error('Ключ финансовой операции уже использован с другими значениями.');
  }
}

export async function consumeGameActionRateLimit(
  client: PoolClient,
  telegramId: string,
  group: GameActionRateGroup,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const policy = RATE_LIMIT_POLICIES[group];
  const { rows } = await client.query<{
    attempt_count: number;
    window_started_at: Date | string;
    blocked_until: Date | string | null;
  }>(
    `INSERT INTO player_action_rate_limits
       (telegram_id, action_group, window_started_at, attempt_count, blocked_until, updated_at)
     VALUES ($1, $2, NOW(), 1, NULL, NOW())
     ON CONFLICT (telegram_id, action_group) DO UPDATE SET
       window_started_at = CASE
         WHEN player_action_rate_limits.window_started_at <= NOW() - make_interval(secs => $3::double precision)
         THEN NOW() ELSE player_action_rate_limits.window_started_at END,
       attempt_count = CASE
         WHEN player_action_rate_limits.window_started_at <= NOW() - make_interval(secs => $3::double precision)
         THEN 1 ELSE player_action_rate_limits.attempt_count + 1 END,
       blocked_until = CASE
         WHEN player_action_rate_limits.window_started_at <= NOW() - make_interval(secs => $3::double precision)
         THEN NULL
         WHEN player_action_rate_limits.attempt_count + 1 > $4
         THEN NOW() + make_interval(secs => $5::double precision)
         ELSE player_action_rate_limits.blocked_until END,
       updated_at = NOW()
     RETURNING attempt_count, window_started_at, blocked_until`,
    [telegramId, group, policy.windowSeconds, policy.maxAttempts, policy.blockSeconds],
  );
  const row = rows[0];
  if (!row) throw new Error('Не удалось проверить частоту игровых действий.');
  const blockedUntil = row.blocked_until ? new Date(row.blocked_until).getTime() : 0;
  const allowed = Number(row.attempt_count) <= policy.maxAttempts && blockedUntil <= Date.now();
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1_000) || policy.blockSeconds);

  if (!allowed) {
    await client.query(
      `INSERT INTO game_security_events (telegram_id, event_type, severity, details)
       VALUES ($1, 'action_rate_limited', 'warning', $2::jsonb)`,
      [telegramId, JSON.stringify({ actionGroup: group, retryAfterSeconds })],
    );
  }
  return { allowed, retryAfterSeconds };
}

export async function recordSecurityEvent(
  client: PoolClient,
  telegramId: string,
  eventType: string,
  severity: 'notice' | 'warning' | 'high',
  details: Record<string, unknown> = {},
): Promise<void> {
  await client.query(
    `INSERT INTO game_security_events (telegram_id, event_type, severity, details)
     VALUES ($1,$2,$3,$4::jsonb)`,
    [telegramId, eventType, severity, JSON.stringify(details)],
  );
}

export const GAME_RATE_LIMIT_POLICIES = RATE_LIMIT_POLICIES;
