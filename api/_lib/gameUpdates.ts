import type { PoolClient } from 'pg';
import type { GameUpdate } from '../../src/types/server.js';
import { createId } from '../../src/utils/id.js';
import { isOwnerTelegramId } from './auth.js';

export const MAX_GAME_UPDATE_TITLE_LENGTH = 80;
export const MAX_GAME_UPDATE_BODY_LENGTH = 3_000;

interface GameUpdateRow {
  update_id: string;
  title: string;
  body: string;
  published_at: Date | string;
}

export class GameUpdateRequestError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
    this.name = 'GameUpdateRequestError';
  }
}

export function requireGameUpdatePublisher(telegramId: string): void {
  if (!isOwnerTelegramId(telegramId)) {
    throw new GameUpdateRequestError('Публиковать обновления может только владелец игры.', 403);
  }
}

export function validateGameUpdateDraft(title: unknown, body: unknown): { title: string; body: string } {
  if (typeof title !== 'string' || !title.trim() || title.trim().length > MAX_GAME_UPDATE_TITLE_LENGTH) {
    throw new GameUpdateRequestError(`Заголовок должен содержать от 1 до ${MAX_GAME_UPDATE_TITLE_LENGTH} символов.`);
  }
  if (typeof body !== 'string' || !body.trim() || body.trim().length > MAX_GAME_UPDATE_BODY_LENGTH) {
    throw new GameUpdateRequestError(`Текст обновления должен содержать от 1 до ${MAX_GAME_UPDATE_BODY_LENGTH} символов.`);
  }
  return { title: title.trim(), body: body.trim() };
}

export async function ensureGameUpdateTables(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS game_updates (
      update_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES players(telegram_id),
      published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query('CREATE INDEX IF NOT EXISTS game_updates_published_idx ON game_updates (published_at DESC, update_id DESC)');
  await client.query(`
    CREATE TABLE IF NOT EXISTS player_seen_game_updates (
      telegram_id TEXT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
      update_id TEXT NOT NULL REFERENCES game_updates(update_id) ON DELETE CASCADE,
      seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (telegram_id, update_id)
    )
  `);
}

const toGameUpdate = (row: GameUpdateRow): GameUpdate => ({
  id: row.update_id,
  title: row.title,
  body: row.body,
  publishedAt: new Date(row.published_at).toISOString(),
});

export async function listUnseenGameUpdates(client: PoolClient, telegramId: string): Promise<GameUpdate[]> {
  const { rows } = await client.query<GameUpdateRow>(
    `SELECT update.update_id, update.title, update.body, update.published_at
     FROM game_updates AS update
     WHERE NOT EXISTS (
       SELECT 1 FROM player_seen_game_updates AS seen
       WHERE seen.telegram_id = $1 AND seen.update_id = update.update_id
     )
     ORDER BY update.published_at DESC, update.update_id DESC`,
    [telegramId],
  );
  return rows.map(toGameUpdate);
}

export async function publishGameUpdate(
  client: PoolClient,
  telegramId: string,
  draft: { title: string; body: string },
): Promise<GameUpdate> {
  const { rows } = await client.query<GameUpdateRow>(
    `INSERT INTO game_updates (update_id, title, body, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING update_id, title, body, published_at`,
    [createId('update'), draft.title, draft.body, telegramId],
  );
  return toGameUpdate(rows[0]);
}

export async function markGameUpdateSeen(client: PoolClient, telegramId: string, updateId: string): Promise<boolean> {
  const result = await client.query(
    `INSERT INTO player_seen_game_updates (telegram_id, update_id)
     SELECT $1, game_update.update_id
     FROM game_updates AS game_update
     WHERE game_update.update_id = $2
     ON CONFLICT (telegram_id, update_id) DO NOTHING
     RETURNING update_id`,
    [telegramId, updateId],
  );
  return (result.rowCount ?? 0) > 0;
}
