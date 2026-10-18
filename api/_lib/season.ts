import type { PoolClient } from 'pg';
import { createId } from '../../src/utils/id.js';
import { normalizePlayerState } from '../../src/persistence/playerStorage.js';
import { withEquippedStats } from '../../src/game/player.js';
import { getSeasonLevel, getSeasonTiers, SEASON_PASS_ID, SEASON_PASS_LEVELS, SEASON_PASS_PRICE_STARS, type SeasonTrack } from '../../src/game/seasonPass.js';

import type { AuthenticatedPlayer } from '../../src/types/server.js';
import type { Container, PlayerState } from '../../src/types/game.js';
import { listContainerCatalog } from './containers.js';

export interface SeasonRow {
  season_id: string;
  name: string;
  ends_at: Date | string | null;
  premium_price_stars: number;
  limited_container_id: string | null;
  is_active: boolean;
}

export interface SeasonSnapshot {
  season: null | {
    id: string;
    name: string;
    endsAt?: string;
    premiumPriceStars: number;
    limitedContainerId?: string;
    limitedContainerName?: string;
    isActive: boolean;
  };
  seasonXp: number;
  level: number;
  isPremiumPass: boolean;
  claimedRewards: string[];
  tiers: ReturnType<typeof getSeasonTiers>;
}

export interface StarsPayment {
  invoice_payload: string;
  currency: string;
  total_amount: number;
  telegram_payment_charge_id: string;
  provider_payment_charge_id?: string;
}

export interface PreCheckoutQuery {
  id: string;
  from: { id: number };
  invoice_payload: string;
  currency: string;
  total_amount: number;
}

const nowIso = () => new Date().toISOString();
const isSeasonOpen = (season: SeasonRow) => season.is_active && (!season.ends_at || new Date(season.ends_at).getTime() > Date.now());

export async function ensureSeasonTables(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS game_seasons (
      season_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ends_at TIMESTAMPTZ,
      premium_price_stars INTEGER NOT NULL DEFAULT 250 CHECK (premium_price_stars > 0),
      limited_container_id TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS game_seasons_single_active_idx ON game_seasons (is_active) WHERE is_active`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS player_season_progress (
      telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
      season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
      season_xp INTEGER NOT NULL DEFAULT 0 CHECK (season_xp >= 0),
      is_premium_pass BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (telegram_id, season_id)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS player_season_xp_events (
      telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
      season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL,
      xp_delta INTEGER NOT NULL CHECK (xp_delta > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (telegram_id, season_id, idempotency_key)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS player_season_reward_claims (
      telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
      season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
      level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 30),
      track TEXT NOT NULL CHECK (track IN ('free', 'premium')),
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (telegram_id, season_id, level, track)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS season_pass_invoices (
      invoice_payload TEXT PRIMARY KEY,
      telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
      season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
      stars_amount INTEGER NOT NULL CHECK (stars_amount > 0),
      invoice_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS season_pass_one_pending_invoice_idx
    ON season_pass_invoices (telegram_id, season_id) WHERE status = 'pending'`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS season_pass_payments (
      telegram_payment_charge_id TEXT PRIMARY KEY,
      provider_payment_charge_id TEXT,
      invoice_payload TEXT NOT NULL UNIQUE REFERENCES season_pass_invoices(invoice_payload),
      telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
      season_id TEXT NOT NULL REFERENCES game_seasons(season_id) ON DELETE CASCADE,
      currency TEXT NOT NULL CHECK (currency = 'XTR'),
      stars_amount INTEGER NOT NULL CHECK (stars_amount > 0),
      paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(
    `INSERT INTO game_seasons (season_id, name, premium_price_stars, is_active)
     VALUES ($1, 'Season 1: Genesis', $2, TRUE) ON CONFLICT (season_id) DO NOTHING`,
    [SEASON_PASS_ID, SEASON_PASS_PRICE_STARS],
  );
}

export async function getActiveSeason(client: PoolClient): Promise<SeasonRow | undefined> {
  await ensureSeasonTables(client);
  const { rows } = await client.query<SeasonRow>(
    `SELECT season_id, name, ends_at, premium_price_stars, limited_container_id, is_active
     FROM game_seasons WHERE is_active = TRUE ORDER BY updated_at DESC LIMIT 1`,
  );
  return rows[0];
}

export async function getSeasonSnapshot(client: PoolClient, telegramId: string): Promise<SeasonSnapshot> {
  const season = await getActiveSeason(client);
  if (!season) return { season: null, seasonXp: 0, level: 1, isPremiumPass: false, claimedRewards: [], tiers: [] };
  await client.query(
    `INSERT INTO player_season_progress (telegram_id, season_id)
     VALUES ($1, $2) ON CONFLICT (telegram_id, season_id) DO NOTHING`,
    [telegramId, season.season_id],
  );
  const { rows: progressRows } = await client.query<{ season_xp: number; is_premium_pass: boolean }>(
    `SELECT season_xp, is_premium_pass FROM player_season_progress WHERE telegram_id = $1 AND season_id = $2`,
    [telegramId, season.season_id],
  );
  const { rows: claimRows } = await client.query<{ level: number; track: SeasonTrack }>(
    `SELECT level, track FROM player_season_reward_claims WHERE telegram_id = $1 AND season_id = $2`,
    [telegramId, season.season_id],
  );
  const containers = await listContainerCatalog(client);
  const limitedContainer = containers.find((entry) => entry.id === season.limited_container_id);
  const seasonXp = Number(progressRows[0]?.season_xp) || 0;
  return {
    season: {
      id: season.season_id,
      name: season.name,
      endsAt: season.ends_at ? new Date(season.ends_at).toISOString() : undefined,
      premiumPriceStars: Number(season.premium_price_stars),
      limitedContainerId: season.limited_container_id ?? undefined,
      limitedContainerName: limitedContainer?.name,
      isActive: isSeasonOpen(season),
    },
    seasonXp,
    level: getSeasonLevel(seasonXp),
    isPremiumPass: progressRows[0]?.is_premium_pass ?? false,
    claimedRewards: claimRows.map((claim) => `${claim.level}:${claim.track}`),
    tiers: getSeasonTiers(limitedContainer?.name),
  };
}

export async function awardSeasonXp(client: PoolClient, telegramId: string, xpDelta: number, idempotencyKey: string): Promise<void> {
  if (!Number.isSafeInteger(xpDelta) || xpDelta <= 0) return;
  const season = await getActiveSeason(client);
  if (!season || !isSeasonOpen(season)) return;
  const event = await client.query(
    `INSERT INTO player_season_xp_events (telegram_id, season_id, idempotency_key, xp_delta)
     VALUES ($1, $2, $3, $4) ON CONFLICT (telegram_id, season_id, idempotency_key) DO NOTHING RETURNING idempotency_key`,
    [telegramId, season.season_id, idempotencyKey, xpDelta],
  );
  if (!event.rowCount) return;
  await client.query(
    `INSERT INTO player_season_progress (telegram_id, season_id, season_xp)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id, season_id) DO UPDATE
       SET season_xp = player_season_progress.season_xp + EXCLUDED.season_xp, updated_at = NOW()`,
    [telegramId, season.season_id, xpDelta],
  );
}

export function validateStarsPayment(
  invoice: { invoice_payload: string; telegram_id: string; stars_amount: number },
  payment: StarsPayment,
  telegramId: string,
): boolean {
  return payment.invoice_payload === invoice.invoice_payload
    && payment.currency === 'XTR'
    && Number(payment.total_amount) === Number(invoice.stars_amount)
    && telegramId === invoice.telegram_id
    && typeof payment.telegram_payment_charge_id === 'string'
    && payment.telegram_payment_charge_id.length > 0;
}

export function isSameStarsPaymentReplay(
  existing: { telegram_id: string; invoice_payload: string },
  telegramId: string,
  payment: StarsPayment,
): boolean {
  return existing.telegram_id === telegramId && existing.invoice_payload === payment.invoice_payload;
}

async function telegramApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN or BOT_TOKEN is not configured.');
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const body = await response.json() as { ok?: boolean; description?: string; result?: T };
  if (!response.ok || !body.ok) throw new Error(`Telegram ${method} failed: ${body.description ?? response.statusText}`);
  return body.result as T;
}

export async function createSeasonPassInvoice(client: PoolClient, user: AuthenticatedPlayer): Promise<{ invoiceUrl: string; seasonName: string; stars: number }> {
  let season: SeasonRow | undefined;
  let invoicePayload = '';
  let stars = 0;
  await client.query('BEGIN');
  try {
    season = await getActiveSeason(client);
    if (!season || !isSeasonOpen(season)) throw new Error('Сезон сейчас не принимает покупки.');
    await client.query(
      `INSERT INTO player_season_progress (telegram_id, season_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.id, season.season_id],
    );
    const { rows: playerRows } = await client.query<{ is_premium_pass: boolean }>(
      `SELECT is_premium_pass FROM player_season_progress WHERE telegram_id = $1 AND season_id = $2 FOR UPDATE`,
      [user.id, season.season_id],
    );
    if (playerRows[0]?.is_premium_pass) throw new Error('Премиум-пропуск этого сезона уже открыт.');
    await client.query(
      `UPDATE season_pass_invoices SET status = 'failed'
       WHERE telegram_id = $1 AND season_id = $2 AND status = 'pending' AND expires_at <= NOW()`,
      [user.id, season.season_id],
    );
    const { rows: pendingInvoices } = await client.query<{ invoice_payload: string; invoice_url: string | null; stars_amount: number }>(
      `SELECT invoice_payload, invoice_url, stars_amount FROM season_pass_invoices
       WHERE telegram_id = $1 AND season_id = $2 AND status = 'pending' FOR UPDATE`,
      [user.id, season.season_id],
    );
    if (pendingInvoices[0]) {
      if (!pendingInvoices[0].invoice_url) throw new Error('Счёт уже формируется. Повтори через несколько секунд.');
      await client.query('COMMIT');
      return { invoiceUrl: pendingInvoices[0].invoice_url, seasonName: season.name, stars: Number(pendingInvoices[0].stars_amount) };
    }
    stars = Number(season.premium_price_stars);
    invoicePayload = `season-pass:${season.season_id}:${user.id}:${createId('invoice')}`;
    await client.query(
      `INSERT INTO season_pass_invoices (invoice_payload, telegram_id, season_id, stars_amount, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '3 hours')`,
      [invoicePayload, user.id, season.season_id, stars],
    );
    await client.query('COMMIT');
  } catch (failure) {
    await client.query('ROLLBACK');
    throw failure;
  }
  try {
    const invoiceUrl = await telegramApi<string>('createInvoiceLink', {
      title: `${season.name} · Premium Pass`,
      description: `Премиум-награды Season 1: Genesis · ${SEASON_PASS_LEVELS} уровней`,
      payload: invoicePayload,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: 'Season 1 Premium Pass', amount: stars }],
    });
    await client.query('UPDATE season_pass_invoices SET invoice_url = $1 WHERE invoice_payload = $2', [invoiceUrl, invoicePayload]);
    return { invoiceUrl, seasonName: season.name, stars };
  } catch (failure) {
    await client.query(`UPDATE season_pass_invoices SET status = 'failed' WHERE invoice_payload = $1`, [invoicePayload]);
    throw failure;
  }
}

export async function validatePreCheckout(client: PoolClient, query: PreCheckoutQuery): Promise<{ ok: boolean; errorMessage?: string }> {
  await ensureSeasonTables(client);
  const { rows } = await client.query<SeasonRow & { invoice_payload: string; telegram_id: string; stars_amount: number; status: string; expires_at: Date | string }>(
    `SELECT i.invoice_payload, i.telegram_id, i.stars_amount, i.status, i.expires_at,
            s.season_id, s.name, s.ends_at, s.premium_price_stars, s.limited_container_id, s.is_active
     FROM season_pass_invoices i JOIN game_seasons s ON s.season_id = i.season_id
     WHERE i.invoice_payload = $1`,
    [query.invoice_payload],
  );
  const invoice = rows[0];
  if (!invoice || invoice.status !== 'pending' || new Date(invoice.expires_at).getTime() <= Date.now()) {
    return { ok: false, errorMessage: 'Счёт истёк. Открой покупку в игре ещё раз.' };
  }
  if (!isSeasonOpen(invoice)) return { ok: false, errorMessage: 'Сезон завершён, покупка недоступна.' };
  if (String(query.from.id) !== invoice.telegram_id || query.currency !== 'XTR' || Number(query.total_amount) !== Number(invoice.stars_amount)) {
    return { ok: false, errorMessage: 'Не удалось проверить сумму или аккаунт этого платежа.' };
  }
  const { rows: progressRows } = await client.query<{ is_premium_pass: boolean }>(
    `SELECT is_premium_pass FROM player_season_progress WHERE telegram_id = $1 AND season_id = $2`,
    [invoice.telegram_id, invoice.season_id],
  );
  if (progressRows[0]?.is_premium_pass) return { ok: false, errorMessage: 'Премиум-пропуск уже открыт.' };
  return { ok: true };
}

export async function applySuccessfulStarsPayment(client: PoolClient, telegramId: string, payment: StarsPayment): Promise<void> {
  await client.query('BEGIN');
  try {
    await ensureSeasonTables(client);
    const { rows } = await client.query<{
      invoice_payload: string; telegram_id: string; season_id: string; stars_amount: number; status: string;
    }>(
      `SELECT invoice_payload, telegram_id, season_id, stars_amount, status
       FROM season_pass_invoices WHERE invoice_payload = $1 FOR UPDATE`,
      [payment.invoice_payload],
    );
    const invoice = rows[0];
    if (!invoice || !validateStarsPayment(invoice, payment, telegramId)) throw new Error('Telegram Stars payment did not match a pending invoice.');
    const { rows: existingRows } = await client.query<{ telegram_id: string; invoice_payload: string }>(
      `SELECT telegram_id, invoice_payload FROM season_pass_payments WHERE telegram_payment_charge_id = $1`,
      [payment.telegram_payment_charge_id],
    );
    if (existingRows[0]) {
      if (!isSameStarsPaymentReplay(existingRows[0], telegramId, payment)) {
        throw new Error('Telegram payment charge id was already used by another purchase.');
      }
      await client.query('COMMIT');
      return;
    }
    if (invoice.status !== 'pending' && invoice.status !== 'paid') throw new Error('This season pass invoice is not payable.');
    await client.query(
      `INSERT INTO season_pass_payments
        (telegram_payment_charge_id, provider_payment_charge_id, invoice_payload, telegram_id, season_id, currency, stars_amount)
       VALUES ($1, $2, $3, $4, $5, 'XTR', $6)`,
      [payment.telegram_payment_charge_id, payment.provider_payment_charge_id ?? null, payment.invoice_payload, telegramId, invoice.season_id, payment.total_amount],
    );
    await client.query(`UPDATE season_pass_invoices SET status = 'paid' WHERE invoice_payload = $1`, [payment.invoice_payload]);
    await client.query(
      `INSERT INTO player_season_progress (telegram_id, season_id, is_premium_pass)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (telegram_id, season_id) DO UPDATE SET is_premium_pass = TRUE, updated_at = NOW()`,
      [telegramId, invoice.season_id],
    );
    await client.query('COMMIT');
  } catch (failure) {
    await client.query('ROLLBACK');
    throw failure;
  }
}

export async function claimSeasonReward(
  client: PoolClient,
  user: AuthenticatedPlayer,
  level: number,
  track: SeasonTrack,
): Promise<{ snapshot: SeasonSnapshot; message: string }> {
  if (!Number.isSafeInteger(level) || level < 1 || level > 30 || (track !== 'free' && track !== 'premium')) throw new Error('Награда сезона выбрана неверно.');
  await client.query('BEGIN');
  try {
    await ensureSeasonTables(client);
    const season = await getActiveSeason(client);
    if (!season || !isSeasonOpen(season)) throw new Error('Сезон завершён или не активен.');
    const { rows: playerRows } = await client.query<{ state: unknown }>(
      `SELECT state FROM players WHERE telegram_id = $1 FOR UPDATE`, [user.id],
    );
    if (!playerRows[0]) throw new Error('Сначала открой профиль игрока.');
    await client.query(
      `INSERT INTO player_season_progress (telegram_id, season_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.id, season.season_id],
    );
    const { rows: progressRows } = await client.query<{ season_xp: number; is_premium_pass: boolean }>(
      `SELECT season_xp, is_premium_pass FROM player_season_progress WHERE telegram_id = $1 AND season_id = $2 FOR UPDATE`,
      [user.id, season.season_id],
    );
    const progress = progressRows[0];
    if (getSeasonLevel(Number(progress.season_xp)) < level) throw new Error('Сначала набери нужный сезонный XP.');
    if (track === 'premium' && !progress.is_premium_pass) throw new Error('Сначала открой премиум-пропуск.');
    const { rows: insertedClaims } = await client.query(
      `INSERT INTO player_season_reward_claims (telegram_id, season_id, level, track)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING level`,
      [user.id, season.season_id, level, track],
    );
    if (!insertedClaims.length) {
      await client.query('COMMIT');
      return { snapshot: await getSeasonSnapshot(client, user.id), message: 'Эта награда уже получена.' };
    }
    const tiers = getSeasonTiers();
    const reward = tiers[level - 1][track];
    let state: PlayerState = normalizePlayerState(playerRows[0].state);
    state.balance += reward.coins;
    let message = `Получена награда уровня ${level}: +${reward.coins.toLocaleString('ru-RU')} ₽.`;
    if (reward.bonus?.kind === 'license-plate-frame') {
      state.licensePlateFrames = [...new Set([...(state.licensePlateFrames ?? []), reward.bonus.id])];
      message += ' Открыта рамка SEASON 01 // VIP.';
    } else if (reward.bonus?.kind === 'limited-case') {
      if (!season.limited_container_id) throw new Error('Администратор ещё не привязал лимитированный кейс к сезону.');
      const container = (await listContainerCatalog(client)).find((entry) => entry.id === season.limited_container_id);
      if (!container || (container.category !== 'clothing' && container.category !== 'car') || !container.contents.length) {
        throw new Error('Лимитированный кейс сезона сейчас недоступен.');
      }
      state.seasonCaseTokens = { ...(state.seasonCaseTokens ?? {}), [container.id]: (state.seasonCaseTokens?.[container.id] ?? 0) + 1 };
      message += ` В контейнеры добавлен билет на бесплатное открытие «${container.name}».`;
    }
    await client.query(
      `UPDATE players SET state = $1::jsonb, updated_at = NOW() WHERE telegram_id = $2`,
      [JSON.stringify(withEquippedStats({ ...state, auctionListings: [] })), user.id],
    );
    await client.query('COMMIT');
    return { snapshot: await getSeasonSnapshot(client, user.id), message };
  } catch (failure) {
    await client.query('ROLLBACK');
    throw failure;
  }
}

export async function updateSeasonSettings(
  client: PoolClient,
  seasonId: string,
  field: 'name' | 'ends_at' | 'premium_price_stars' | 'limited_container_id' | 'is_active',
  value: string | number | boolean | null,
): Promise<void> {
  await ensureSeasonTables(client);
  if (field === 'is_active' && value === true) {
    await client.query('UPDATE game_seasons SET is_active = FALSE, updated_at = NOW() WHERE is_active = TRUE AND season_id <> $1', [seasonId]);
  }
  const allowedFields: Record<typeof field, string> = {
    name: 'name', ends_at: 'ends_at', premium_price_stars: 'premium_price_stars',
    limited_container_id: 'limited_container_id', is_active: 'is_active',
  };
  await client.query(`UPDATE game_seasons SET ${allowedFields[field]} = $1, updated_at = NOW() WHERE season_id = $2`, [value, seasonId]);
}

export async function listSeasonContainers(client: PoolClient): Promise<Container[]> {
  return (await listContainerCatalog(client)).filter((container) => container.category === 'clothing' || container.category === 'car');
}

export const seasonNow = nowIso;
