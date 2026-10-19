import type { PoolClient } from 'pg';
import type { PlayerState } from '../../src/types/game.js';

export interface AdminPlayer {
  telegram_id: string;
  first_name: string;
  last_name: string | null;
  username: string | null;
  xp: number;
  state: PlayerState;
  is_banned: boolean;
}

export interface AdminListing {
  listing_id: string;
  item: { name?: string };
  asking_price: number;
  created_at: Date;
  seller_id: string;
  first_name: string;
  last_name: string | null;
  username: string | null;
}

export interface AdminActivityEvent {
  event_id: number | string;
  telegram_id: string;
  first_name: string;
  last_name: string | null;
  username: string | null;
  action_type: string;
  xp_delta: number;
  balance_delta: number;
  created_at: Date | string;
}

export interface EconomySettings {
  marketplaceEnabled: boolean;
  containersEnabled: boolean;
  resaleMultiplier: number;
}

const defaultEconomySettings: EconomySettings = {
  marketplaceEnabled: true,
  containersEnabled: true,
  resaleMultiplier: 0.65,
};

export async function ensureAdminTables(client: PoolClient): Promise<void> {
  await client.query('ALTER TABLE players ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE');
  await client.query(`
    CREATE TABLE IF NOT EXISTS game_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  for (const [key, value] of Object.entries(defaultEconomySettings)) {
    await client.query(
      'INSERT INTO game_settings (setting_key, setting_value) VALUES ($1, $2::jsonb) ON CONFLICT (setting_key) DO NOTHING',
      [key, JSON.stringify(value)],
    );
  }
}

export async function getEconomySettings(client: PoolClient): Promise<EconomySettings> {
  const { rows } = await client.query<{ setting_key: keyof EconomySettings; setting_value: unknown }>(
    'SELECT setting_key, setting_value FROM game_settings WHERE setting_key = ANY($1::text[])',
    [Object.keys(defaultEconomySettings)],
  );
  return rows.reduce((settings, row) => ({
    ...settings,
    [row.setting_key]: row.setting_value,
  }), { ...defaultEconomySettings });
}

export async function updateEconomySetting(
  client: PoolClient,
  key: keyof EconomySettings,
  value: boolean | number,
): Promise<void> {
  if (key === 'resaleMultiplier') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.1 || value > 2) {
      throw new Error('Коэффициент перепродажи должен быть от 0,1 до 2,0.');
    }
  } else if (typeof value !== 'boolean') {
    throw new Error('Для этого параметра нужно выбрать Да или Нет.');
  }
  await client.query(
    `INSERT INTO game_settings (setting_key, setting_value) VALUES ($1, $2::jsonb)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
    [key, JSON.stringify(value)],
  );
}

export async function searchAdminPlayers(client: PoolClient, rawSearch: string): Promise<AdminPlayer[]> {
  const search = rawSearch.trim().replace(/^@/, '');
  if (!search) return [];
  const { rows } = await client.query<AdminPlayer>(
    `SELECT telegram_id, first_name, last_name, username, xp, state, is_banned
     FROM players
     WHERE telegram_id = $1 OR username ILIKE $2 OR first_name ILIKE $2 OR last_name ILIKE $2
     ORDER BY updated_at DESC LIMIT 10`,
    [search, `%${search}%`],
  );
  return rows;
}

export async function getAdminPlayer(client: PoolClient, id: string): Promise<AdminPlayer | undefined> {
  const { rows } = await client.query<AdminPlayer>(
    `SELECT telegram_id, first_name, last_name, username, xp, state, is_banned
     FROM players WHERE telegram_id = $1`,
    [id],
  );
  return rows[0];
}

export async function getAdminPlayerByIdentifier(client: PoolClient, identifier: string): Promise<AdminPlayer | undefined> {
  const search = identifier.trim().replace(/^@/, '');
  if (!search || search.length > 32) return undefined;
  if (/^\d{1,20}$/.test(search)) return getAdminPlayer(client, search);
  if (!/^[A-Za-z0-9_]{5,32}$/.test(search)) return undefined;
  const { rows } = await client.query<AdminPlayer>(
    `SELECT telegram_id, first_name, last_name, username, xp, state, is_banned
     FROM players WHERE LOWER(username) = LOWER($1) LIMIT 2`,
    [search],
  );
  if (rows.length > 1) throw new Error('Найдено несколько аккаунтов с этим username. Используй Telegram ID.');
  return rows[0];
}

export async function adjustAdminPlayer(
  client: PoolClient,
  id: string,
  field: 'balance' | 'xp',
  delta: number,
): Promise<AdminPlayer> {
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 2_000_000_000) {
    throw new Error('Укажи ненулевое целое число от 1 до 2 000 000 000.');
  }
  await client.query('BEGIN');
  try {
    const player = await getAdminPlayerForUpdate(client, id);
    if (!player) throw new Error('Игрок не найден.');
    if (field === 'balance') {
      const balance = Number(player.state.balance) || 0;
      if (balance + delta < 0) throw new Error('Баланс нельзя уменьшить ниже нуля.');
      player.state.balance = balance + delta;
      await client.query(
        'UPDATE players SET state = $1::jsonb, updated_at = NOW() WHERE telegram_id = $2',
        [JSON.stringify(player.state), id],
      );
    } else {
      const xp = Number(player.xp) || 0;
      if (xp + delta < 0) throw new Error('XP нельзя уменьшить ниже нуля.');
      player.xp = xp + delta;
      await client.query('UPDATE players SET xp = $1, updated_at = NOW() WHERE telegram_id = $2', [player.xp, id]);
    }
    await client.query('COMMIT');
    return player;
  } catch (failure) {
    await client.query('ROLLBACK');
    throw failure;
  }
}

async function getAdminPlayerForUpdate(client: PoolClient, id: string): Promise<AdminPlayer | undefined> {
  const { rows } = await client.query<AdminPlayer>(
    `SELECT telegram_id, first_name, last_name, username, xp, state, is_banned
     FROM players WHERE telegram_id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0];
}

export async function setPlayerBanned(client: PoolClient, id: string, banned: boolean): Promise<void> {
  const result = await client.query(
    'UPDATE players SET is_banned = $2, updated_at = NOW() WHERE telegram_id = $1',
    [id, banned],
  );
  if (result.rowCount !== 1) throw new Error('Игрок не найден.');
}

export async function resetPlayerContainerCooldowns(client: PoolClient, id: string): Promise<number> {
  const result = await client.query(
    'DELETE FROM player_container_openings WHERE telegram_id = $1',
    [id],
  );
  return result.rowCount ?? 0;
}

export async function listAdminListings(client: PoolClient, offset = 0): Promise<AdminListing[]> {
  const { rows } = await client.query<AdminListing>(
    `SELECT l.listing_id, l.item, l.asking_price, l.created_at, l.seller_id,
            p.first_name, p.last_name, p.username
     FROM market_listings l JOIN players p ON p.telegram_id = l.seller_id
     WHERE l.status = 'active'
     ORDER BY l.created_at DESC
     LIMIT 11 OFFSET $1`,
    [Math.max(0, Math.floor(offset))],
  );
  return rows;
}

const adminActivityLabels: Record<string, string> = {
  'open-container': 'Открытие контейнера',
  'spin-license-plate': 'Рулетка номеров',
  'sell-item': 'Продажа предмета',
  'sell-license-plate': 'Продажа номера',
  'list-item': 'Выставление предмета',
  'list-license-plate': 'Выставление номера',
  'cancel-listing': 'Снятие лота',
  'buy-listing': 'Покупка лота',
  'top-up-owner': 'Тестовое пополнение',
};

export function formatAdminActivityLabel(actionType: string): string {
  return adminActivityLabels[actionType] ?? actionType.replace(/[-_]/g, ' ');
}

export function formatAdminActivity(event: AdminActivityEvent): string {
  const date = event.created_at instanceof Date ? event.created_at : new Date(event.created_at);
  const formattedDate = Number.isFinite(date.getTime())
    ? date.toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    : 'Время неизвестно';
  const playerName = [event.first_name, event.last_name].filter(Boolean).join(' ')
    || (event.username ? `@${event.username}` : `Игрок ${event.telegram_id}`);
  const balanceDelta = Number(event.balance_delta) || 0;
  const xpDelta = Number(event.xp_delta) || 0;
  const changes = [
    ...(balanceDelta ? [`${balanceDelta > 0 ? '+' : ''}${balanceDelta.toLocaleString('ru-RU')} ₽`] : []),
    ...(xpDelta ? [`${xpDelta > 0 ? '+' : ''}${xpDelta.toLocaleString('ru-RU')} XP`] : []),
  ];
  return `${formattedDate} · ${formatAdminActivityLabel(event.action_type)}\n${playerName} · ${changes.length ? changes.join(' · ') : 'без изменений баланса и XP'}`;
}

export async function listAdminActivity(client: PoolClient, offset = 0, telegramId?: string): Promise<AdminActivityEvent[]> {
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const playerFilter = telegramId ? 'WHERE e.telegram_id = $3' : '';
  const { rows } = await client.query<AdminActivityEvent>(
    `SELECT e.event_id, e.telegram_id, p.first_name, p.last_name, p.username,
            e.action_type, e.xp_delta, e.balance_delta, e.created_at
     FROM player_events e
     JOIN players p ON p.telegram_id = e.telegram_id
     ${playerFilter}
     ORDER BY e.created_at DESC, e.event_id DESC
     LIMIT $1 OFFSET $2`,
    [11, safeOffset, ...(telegramId ? [telegramId] : [])],
  );
  return rows;
}

export async function moderateListing(client: PoolClient, listingId: string): Promise<void> {
  await client.query('BEGIN');
  try {
    const listing = await client.query<{ seller_id: string; item: unknown }>(
      `SELECT seller_id, item FROM market_listings
       WHERE listing_id = $1 AND status = 'active' FOR UPDATE`,
      [listingId],
    );
    const row = listing.rows[0];
    if (!row) throw new Error('Активный лот не найден.');
    const playerResult = await client.query<{ state: PlayerState }>(
      'SELECT state FROM players WHERE telegram_id = $1 FOR UPDATE',
      [row.seller_id],
    );
    const player = playerResult.rows[0];
    if (!player) throw new Error('Профиль продавца не найден.');
    const state = player.state;
    state.inventory = [...state.inventory, row.item as PlayerState['inventory'][number]];
    await client.query(
      'UPDATE players SET state = $1::jsonb, updated_at = NOW() WHERE telegram_id = $2',
      [JSON.stringify(state), row.seller_id],
    );
    const updated = await client.query(
      `UPDATE market_listings SET status = 'cancelled'
       WHERE listing_id = $1 AND status = 'active'`,
      [listingId],
    );
    if (updated.rowCount !== 1) throw new Error('Лот успел измениться. Обнови список.');
    await client.query('COMMIT');
  } catch (failure) {
    await client.query('ROLLBACK');
    throw failure;
  }
}

export async function loadAdminAnalytics(client: PoolClient) {
  const { rows } = await client.query<{
    total_players: string;
    active_players: string;
    banned_players: string;
    active_listings: string;
    sales_24h: string;
    openings_24h: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM players) AS total_players,
       (SELECT COUNT(*) FROM players WHERE updated_at >= NOW() - INTERVAL '7 days') AS active_players,
       (SELECT COUNT(*) FROM players WHERE is_banned) AS banned_players,
       (SELECT COUNT(*) FROM market_listings WHERE status = 'active') AS active_listings,
       (SELECT COUNT(*) FROM market_listings WHERE status = 'sold' AND sold_at >= NOW() - INTERVAL '24 hours') AS sales_24h,
       (SELECT COUNT(*) FROM player_events WHERE action_type = 'open-container' AND created_at >= NOW() - INTERVAL '24 hours') AS openings_24h`,
  );
  return rows[0];
}

export async function listAnnouncementRecipients(client: PoolClient, offset: number, limit: number) {
  const { rows } = await client.query<{ telegram_id: string }>(
    'SELECT telegram_id FROM players ORDER BY telegram_id LIMIT $1 OFFSET $2',
    [limit, offset],
  );
  return rows.map((row) => row.telegram_id);
}

export async function countAnnouncementRecipients(client: PoolClient): Promise<number> {
  const { rows } = await client.query<{ count: string }>('SELECT COUNT(*) AS count FROM players');
  return Number(rows[0]?.count) || 0;
}
