import type { PoolClient } from 'pg';
import { createId } from '../../src/utils/id.js';
import { normalizePlayerState } from '../../src/persistence/playerStorage.js';
import { withEquippedStats } from '../../src/game/player.js';
import { grantLicensePlateFrame } from '../../src/game/licensePlates.js';
import { getSeasonLevel, getSeasonTiers, SEASON_PASS_ID, SEASON_PASS_LEVELS, SEASON_PASS_PRICE_STARS, type SeasonReward, type SeasonRewardType, type SeasonTier, type SeasonTrack } from '../../src/game/seasonPass.js';

import type { AuthenticatedPlayer } from '../../src/types/server.js';
import type { ClothingSlot, Container, InventoryItem, PlayerState, Rarity } from '../../src/types/game.js';
import { listContainerCatalog } from './containers.js';
import { getCatalogItem, listCatalogItems, type CatalogItem } from './catalogItems.js';
import { materializeImageSources } from './imageAssets.js';

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
  tiers: SeasonTier[];
}

export interface SeasonRewardUpdate {
  level: number;
  track: SeasonTrack;
  type: SeasonRewardType;
  amount: number;
  refId?: string;
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
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
      premium_price_stars INTEGER NOT NULL DEFAULT 250 CHECK (premium_price_stars > 0),
      limited_container_id TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`ALTER TABLE game_seasons ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ`);
  await client.query(`UPDATE game_seasons SET starts_at = updated_at WHERE starts_at IS NULL`);
  await client.query(`ALTER TABLE game_seasons ALTER COLUMN starts_at SET DEFAULT NOW()`);
  await client.query(`ALTER TABLE game_seasons ALTER COLUMN starts_at SET NOT NULL`);
  await client.query(`ALTER TABLE game_seasons ALTER COLUMN ends_at SET DEFAULT (NOW() + INTERVAL '30 days')`);
  await client.query(`UPDATE game_seasons SET ends_at = starts_at + INTERVAL '30 days' WHERE ends_at IS NULL`);
  await client.query(`ALTER TABLE game_seasons ALTER COLUMN ends_at SET NOT NULL`);
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
  const defaults = getSeasonTiers().flatMap((tier) => ([
    { ...tier.free, level: tier.level, track: 'free' as const },
    { ...tier.premium, level: tier.level, track: 'premium' as const },
  ]));
  await client.query(
    `INSERT INTO season_pass_rewards (season_id, level, track, reward_type, amount, reward_ref, title, description)
     SELECT $1, reward.level, reward.track, reward.type, reward.amount, reward.ref_id, reward.title, reward.description
     FROM jsonb_to_recordset($2::jsonb) AS reward(
       level INTEGER, track TEXT, type TEXT, amount INTEGER, ref_id TEXT, title TEXT, description TEXT
     )
     ON CONFLICT (season_id, level, track) DO NOTHING`,
    [SEASON_PASS_ID, JSON.stringify(defaults.map((entry) => ({
      level: entry.level, track: entry.track, type: entry.type, amount: entry.amount,
      ref_id: entry.refId ?? null, title: entry.title, description: entry.description,
    })))],
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
  const { rows: rewardRows } = await client.query<{
    level: number; track: SeasonTrack; reward_type: SeasonRewardType; amount: number;
    reward_ref: string | null; title: string; description: string;
  }>(
    `SELECT level, track, reward_type, amount, reward_ref, title, description
     FROM season_pass_rewards WHERE season_id = $1 ORDER BY level, track`,
    [season.season_id],
  );
  const itemCatalog = await listCatalogItems(client);
  const rewardItemIds = new Set(rewardRows.filter((row) => row.reward_type === 'item' && row.reward_ref).map((row) => row.reward_ref as string));
  const rewardItems = itemCatalog.filter((item) => rewardItemIds.has(item.id));
  const materializedImages = await materializeImageSources(client, rewardItems.map((item) => item.image));
  const items = new Map(rewardItems.map((item, index) => [item.id, { ...item, image: materializedImages[index] }]));
  const defaults = getSeasonTiers(limitedContainer?.name);
  const rewardByKey = new Map(rewardRows.map((row) => [`${row.level}:${row.track}`, row]));
  const tiers = defaults.map((defaultTier) => {
    const resolve = (track: SeasonTrack): SeasonReward => {
      const row = rewardByKey.get(`${defaultTier.level}:${track}`);
      if (!row) return defaultTier[track];
      const refId = row.reward_ref ?? (defaultTier.level === 30 && track === 'premium' ? season.limited_container_id ?? undefined : undefined);
      const item = row.reward_type === 'item' && refId ? items.get(refId) : undefined;
      const container = row.reward_type === 'container' && refId ? containers.find((entry) => entry.id === refId) : undefined;
      return {
        type: row.reward_type, amount: Number(row.amount), title: item?.name ?? container?.name ?? row.title,
        description: row.description, ...(refId ? { refId } : {}),
        ...(item ? { image: item.image, icon: item.icon } : {}),
        ...(container ? { image: container.image, icon: container.icon } : {}),
      };
    };
    return { ...defaultTier, free: resolve('free'), premium: resolve('premium') };
  });
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
    tiers,
  };
}

export async function updateSeasonReward(client: PoolClient, seasonId: string, input: SeasonRewardUpdate): Promise<void> {
  await ensureSeasonTables(client);
  const { level, track, type, amount } = input;
  if (!Number.isSafeInteger(level) || level < 1 || level > SEASON_PASS_LEVELS) throw new Error('Уровень должен быть от 1 до 30.');
  if (track !== 'free' && track !== 'premium') throw new Error('Выбери бесплатную или VIP-тропу.');
  if (!['coins', 'container', 'item', 'xp', 'frame', 'keys'].includes(type)) throw new Error('Тип награды не поддерживается.');
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 2_000_000_000) throw new Error('Количество должно быть целым числом от 1 до 2 000 000 000.');
  if ((type === 'container' || type === 'item') && amount > 50) throw new Error('За один уровень можно выдать не больше 50 предметов или билетов.');
  if (type === 'frame' && amount !== 1) throw new Error('Рамка госномера выдаётся в единственном экземпляре.');
  if (type === 'xp' && amount > 100_000_000) throw new Error('XP-награда не может быть больше 100 000 000.');
  if (type === 'keys' && amount > 1_000_000) throw new Error('Нельзя выдать больше 1 000 000 ключей за уровень.');
  let refId: string | null = null;
  let title = '';
  let description = '';
  if (type === 'coins') { title = `${amount.toLocaleString('ru-RU')} ₽`; description = 'Игровая валюта'; }
  else if (type === 'xp') { title = `${amount.toLocaleString('ru-RU')} XP`; description = 'Опыт сезона'; }
  else if (type === 'keys') { title = `Ключ ×${amount}`; description = 'Для открытия контейнеров'; }
  else if (type === 'frame') { refId = input.refId || 'season-01-vip'; title = 'SEASON 01 // VIP'; description = 'Эксклюзивная рамка госномера'; }
  else if (type === 'container') {
    if (!input.refId) throw new Error('Выбери существующий контейнер.');
    const container = (await listContainerCatalog(client)).find((entry) => entry.id === input.refId);
    if (!container || (container.category !== 'clothing' && container.category !== 'car') || !container.contents.length) throw new Error('Этот контейнер не найден или не подходит как сезонная награда.');
    refId = container.id; title = container.name; description = 'Билет на бесплатное открытие';
  } else {
    if (!input.refId) throw new Error('Выбери существующий предмет или автомобиль.');
    const item = await getCatalogItem(client, input.refId);
    if (!item) throw new Error('Предмет больше не найден в каталоге.');
    refId = item.id; title = item.name; description = item.type === 'car' ? 'Автомобиль' : 'Предмет';
  }
  await client.query(
    `INSERT INTO season_pass_rewards (season_id, level, track, reward_type, amount, reward_ref, title, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (season_id, level, track) DO UPDATE SET reward_type = EXCLUDED.reward_type,
       amount = EXCLUDED.amount, reward_ref = EXCLUDED.reward_ref, title = EXCLUDED.title,
       description = EXCLUDED.description, updated_at = NOW()`,
    [seasonId, level, track, type, amount, refId, title, description],
  );
}

function makeSeasonInventoryItem(item: CatalogItem, image: string): InventoryItem {
  const serial = `#${String(Math.floor(Math.random() * 500) + 1).padStart(3, '0')}/500`;
  const base = {
    id: createId('season-reward'), name: item.name, rarity: item.rarity as Rarity, icon: item.icon, image,
    price: item.basePrice, basePrice: item.basePrice, respect: item.respect, serial, wear: 100,
    createdAt: nowIso(), containerId: 'season-pass-reward',
  };
  if (item.type === 'car') return { ...base, type: 'car', slot: 'car', mileage: 50_000 };
  const slots: ClothingSlot[] = ['head', 'torso', 'legs', 'shoes', 'accessory'];
  if (!item.slot || item.slot === 'car' || !slots.includes(item.slot)) throw new Error('У сезонного предмета одежды не настроен слот.');
  return { ...base, type: 'clothing', slot: item.slot, authenticity: 'unverified' };
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
    const { rows: rewardRows } = await client.query<{ reward_type: SeasonRewardType; amount: number; reward_ref: string | null; title: string }>(
      `SELECT reward_type, amount, reward_ref, title FROM season_pass_rewards
       WHERE season_id = $1 AND level = $2 AND track = $3 FOR SHARE`,
      [season.season_id, level, track],
    );
    const reward = rewardRows[0];
    if (!reward) throw new Error('Для этого уровня пока не настроена награда.');
    const { rows: insertedClaims } = await client.query(
      `INSERT INTO player_season_reward_claims (telegram_id, season_id, level, track)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING level`,
      [user.id, season.season_id, level, track],
    );
    if (!insertedClaims.length) {
      await client.query('COMMIT');
      return { snapshot: await getSeasonSnapshot(client, user.id), message: 'Эта награда уже получена.' };
    }
    const amount = Number(reward.amount);
    let state: PlayerState = normalizePlayerState(playerRows[0].state);
    let message = `Получена награда уровня ${level}: ${reward.title}.`;
    if (reward.reward_type === 'coins') {
      if (!Number.isSafeInteger(state.balance + amount) || state.balance + amount > 2_000_000_000) throw new Error('Награда превышает максимальный баланс.');
      state.balance += amount;
    } else if (reward.reward_type === 'xp') {
      await client.query(
        `INSERT INTO player_season_xp_events (telegram_id, season_id, idempotency_key, xp_delta)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [user.id, season.season_id, `claim:${level}:${track}`, amount],
      );
      if (Number(progress.season_xp) + amount > 2_000_000_000) throw new Error('Награда превышает максимальный сезонный XP.');
      await client.query(
        `UPDATE player_season_progress SET season_xp = season_xp + $3, updated_at = NOW()
         WHERE telegram_id = $1 AND season_id = $2`,
        [user.id, season.season_id, amount],
      );
      message = `Получена награда уровня ${level}: +${amount.toLocaleString('ru-RU')} XP.`;
    } else if (reward.reward_type === 'keys') {
      if (state.containerKeys + amount > 1_000_000) throw new Error('Награда превышает максимальное количество ключей.');
      state.containerKeys += amount;
      message = `Получена награда уровня ${level}: +${amount} ключ(ей).`;
    } else if (reward.reward_type === 'frame') {
      const frameId = reward.reward_ref ?? 'season-01-vip';
      const updatedFrames = grantLicensePlateFrame(
        state.licensePlateFrames ?? [],
        state.equippedLicensePlateFrameId,
        frameId,
      );
      state.licensePlateFrames = updatedFrames.licensePlateFrames;
      state.equippedLicensePlateFrameId = updatedFrames.equippedLicensePlateFrameId;
      message += ' Рамка добавлена в коллекцию.';
    } else if (reward.reward_type === 'container') {
      const containerId = reward.reward_ref ?? (level === 30 && track === 'premium' ? season.limited_container_id : null);
      if (!containerId) throw new Error('Администратор ещё не привязал контейнер к этой сезонной награде.');
      const container = (await listContainerCatalog(client)).find((entry) => entry.id === containerId);
      if (!container || (container.category !== 'clothing' && container.category !== 'car') || !container.contents.length) throw new Error('Контейнер сезонной награды сейчас недоступен.');
      state.seasonCaseTokens = { ...(state.seasonCaseTokens ?? {}), [container.id]: (state.seasonCaseTokens?.[container.id] ?? 0) + amount };
      message = `Получена награда уровня ${level}: ${container.name} · билет на ${amount} бесплатн. открытие.`;
    } else {
      if (!reward.reward_ref) throw new Error('Администратор не выбрал предмет для этой награды.');
      const item = await getCatalogItem(client, reward.reward_ref);
      if (!item) throw new Error('Предмет этой награды больше не найден в каталоге.');
      const [image] = await materializeImageSources(client, [item.image]);
      state.inventory = [...state.inventory, ...Array.from({ length: amount }, () => makeSeasonInventoryItem(item, image))];
      message = `Получена награда уровня ${level}: ${item.name}${amount > 1 ? ` ×${amount}` : ''}.`;
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
  if (field === 'ends_at' && value === null) {
    await client.query(
      `UPDATE game_seasons SET ends_at = starts_at + INTERVAL '30 days', updated_at = NOW() WHERE season_id = $1`,
      [seasonId],
    );
    return;
  }
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
