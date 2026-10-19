import type { PoolClient } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteGameUpdate,
  markGameUpdateSeen,
  parseGameUpdateMessage,
  publishGameUpdate,
  requireGameUpdatePublisher,
  validateGameUpdateDraft,
} from './gameUpdates.js';

const originalOwnerId = process.env.OWNER_TELEGRAM_ID;
const originalAdminIds = process.env.ADMIN_IDS;
const originalAdminUserIds = process.env.ADMIN_USER_IDS;

afterEach(() => {
  if (originalOwnerId === undefined) delete process.env.OWNER_TELEGRAM_ID;
  else process.env.OWNER_TELEGRAM_ID = originalOwnerId;
  if (originalAdminIds === undefined) delete process.env.ADMIN_IDS;
  else process.env.ADMIN_IDS = originalAdminIds;
  if (originalAdminUserIds === undefined) delete process.env.ADMIN_USER_IDS;
  else process.env.ADMIN_USER_IDS = originalAdminUserIds;
  vi.restoreAllMocks();
});

describe('game update publishing', () => {
  it('trims valid update drafts and enforces field limits', () => {
    expect(validateGameUpdateDraft('  Новая тачка  ', '  Добавили новый автомобиль.  ')).toEqual({
      title: 'Новая тачка',
      body: 'Добавили новый автомобиль.',
    });
    expect(() => validateGameUpdateDraft(' ', 'Описание')).toThrow('Заголовок');
    expect(() => validateGameUpdateDraft('x'.repeat(81), 'Описание')).toThrow('Заголовок');
    expect(() => validateGameUpdateDraft('Обновление', 'x'.repeat(3_001))).toThrow('Текст обновления');
  });

  it('parses pipe-separated and multiline Telegram updates', () => {
    expect(parseGameUpdateMessage('Новая тачка | Добавили новую машину.')).toEqual({ title: 'Новая тачка', body: 'Добавили новую машину.' });
    const newline = String.fromCharCode(10);
    expect(parseGameUpdateMessage(['Обновление сезона', 'Добавили награды.', 'Исправили ошибки.'].join(newline))).toEqual({
      title: 'Обновление сезона', body: ['Добавили награды.', 'Исправили ошибки.'].join(newline),
    });
  });

  it('allows only IDs in the configured admin list to publish', () => {
    delete process.env.ADMIN_IDS;
    delete process.env.ADMIN_USER_IDS;
    process.env.OWNER_TELEGRAM_ID = '1065784387';
    expect(() => requireGameUpdatePublisher('1065784387')).not.toThrow();
    expect(() => requireGameUpdatePublisher('42')).toThrow('только администраторы');

    process.env.ADMIN_IDS = ' , ; ';
    process.env.ADMIN_USER_IDS = '';
    expect(() => requireGameUpdatePublisher('1065784387')).not.toThrow();
    process.env.ADMIN_IDS = '42, 84';
    expect(() => requireGameUpdatePublisher('42')).not.toThrow();
    expect(() => requireGameUpdatePublisher('84')).not.toThrow();
    expect(() => requireGameUpdatePublisher('1065784387')).toThrow();
  });

  it('publishes and deletes announcements in the game update table', async () => {
    const publishedQuery = vi.fn().mockResolvedValue({ rows: [{ update_id: 'update-test', title: 'Genesis', body: 'Новый сезон', published_at: '2026-10-19T00:00:00Z' }] });
    const publishedClient = { query: publishedQuery } as unknown as PoolClient;
    await expect(publishGameUpdate(publishedClient, 'admin-1', { title: 'Genesis', body: 'Новый сезон' })).resolves.toMatchObject({ id: 'update-test', title: 'Genesis', body: 'Новый сезон' });
    expect(String(publishedQuery.mock.calls[0][0])).toContain('INSERT INTO game_updates');
    expect(publishedQuery.mock.calls[0][1]).toEqual([expect.any(String), 'Genesis', 'Новый сезон', 'admin-1']);

    const deleteQuery = vi.fn().mockResolvedValue({ rows: [{ title: 'Опечатка' }] });
    await expect(deleteGameUpdate({ query: deleteQuery } as unknown as PoolClient, 'update-1')).resolves.toBe('Опечатка');
    expect(deleteQuery).toHaveBeenCalledWith('DELETE FROM game_updates WHERE update_id = $1 RETURNING title', ['update-1']);
  });

  it('stores a per-player acknowledgement once and treats retries idempotently', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 0 });
    const client = { query } as unknown as PoolClient;

    expect(await markGameUpdateSeen(client, 'player-1', 'update-1')).toBe(true);
    expect(await markGameUpdateSeen(client, 'player-1', 'update-1')).toBe(false);
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[0][0])).toContain('ON CONFLICT (telegram_id, update_id) DO NOTHING');
    expect(query.mock.calls[0][1]).toEqual(['player-1', 'update-1']);
  });
});
