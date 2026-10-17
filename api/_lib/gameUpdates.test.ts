import type { PoolClient } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  markGameUpdateSeen,
  requireGameUpdatePublisher,
  validateGameUpdateDraft,
} from './gameUpdates.js';

const originalOwnerId = process.env.OWNER_TELEGRAM_ID;

afterEach(() => {
  if (originalOwnerId === undefined) delete process.env.OWNER_TELEGRAM_ID;
  else process.env.OWNER_TELEGRAM_ID = originalOwnerId;
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

  it('allows only the configured game owner to publish', () => {
    process.env.OWNER_TELEGRAM_ID = '1065784387';
    expect(() => requireGameUpdatePublisher('1065784387')).not.toThrow();

    expect(() => requireGameUpdatePublisher('42')).toThrow('только владелец');
    try {
      requireGameUpdatePublisher('42');
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 403 });
    }
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
