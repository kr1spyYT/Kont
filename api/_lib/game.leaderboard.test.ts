import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedPlayer } from '../../src/types/server.js';
import type { CarItem, PlayerState } from '../../src/types/game.js';
import { STARTING_PLAYER } from '../../src/game/player.js';

const database = vi.hoisted(() => {
  const query = vi.fn();
  const client = { query, release: vi.fn() };
  const pool = { connect: vi.fn(async () => client) };
  return { query, client, pool };
});

vi.mock('./db.js', () => ({ getPool: () => database.pool }));

import { loadLeaderboard } from './game.js';

afterEach(() => {
  database.query.mockReset();
  database.client.release.mockClear();
  database.pool.connect.mockClear();
});

describe('loadLeaderboard', () => {
  it('returns the top 100 and keeps the current player’s actual position', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      telegram_id: index === 100 ? 'current-player' : `player-${index + 1}`,
      first_name: `Игрок ${index + 1}`,
      last_name: null,
      username: null,
      xp: 1_000 - index,
      state: STARTING_PLAYER,
    }));
    database.query
      .mockResolvedValueOnce({ rows: [{ is_banned: false }], rowCount: 1 })
      .mockResolvedValueOnce({ rows, rowCount: rows.length });

    const result = await loadLeaderboard({ id: 'current-player', firstName: 'Игрок' } as AuthenticatedPlayer, 'xp');
    const leaderboardSql = String(database.query.mock.calls[1]?.[0]);

    expect(leaderboardSql).toContain('FROM players');
    expect(leaderboardSql).not.toContain('ROW_NUMBER()');
    expect(result.entries).toHaveLength(100);
    expect(result.entries[0]?.position).toBe(1);
    expect(result.entries[99]?.position).toBe(100);
    expect(result.currentPosition).toBe(101);
    expect(database.client.release).toHaveBeenCalledOnce();
  });

  it.each([
    ['respect', ['player-b', 'player-c', 'player-a']],
    ['xp', ['player-b', 'player-a', 'player-c']],
    ['collection', ['player-a', 'player-c', 'player-b']],
  ] as const)('sorts %s by the final displayed score before assigning places', async (metric, expectedOrder) => {
    const playerState = (carId: string, respect: number, price: number, licensePlate?: string): PlayerState => {
      const car: CarItem = {
        id: carId,
        name: carId,
        type: 'car',
        rarity: 'common',
        icon: '🚘',
        price,
        basePrice: price,
        respect,
        serial: '#001/500',
        wear: 100,
        createdAt: '2026-10-20T00:00:00.000Z',
        containerId: 'test',
        slot: 'car',
        mileage: 15_000,
        ...(licensePlate ? { licensePlateId: `${carId}-plate` } : {}),
      };
      return {
        ...STARTING_PLAYER,
        respect: 999_999,
        inventory: [car],
        licensePlates: licensePlate
          ? [{ id: `${carId}-plate`, plate: licensePlate, price: 5_000 }]
          : [],
        activeCarId: carId,
      };
    };
    const rows = [
      { telegram_id: 'player-a', first_name: 'Игрок A', last_name: null, username: null, xp: 900, state: playerState('car-a', 5_000, 200_000) },
      { telegram_id: 'player-b', first_name: 'Игрок B', last_name: null, username: null, xp: 1_100, state: playerState('car-b', 4_000, 80_000, 'А001ВС 50') },
      { telegram_id: 'player-c', first_name: 'Игрок C', last_name: null, username: null, xp: 800, state: playerState('car-c', 5_200, 150_000) },
    ];
    database.query
      .mockResolvedValueOnce({ rows: [{ is_banned: false }], rowCount: 1 })
      .mockResolvedValueOnce({ rows, rowCount: rows.length });

    const result = await loadLeaderboard({ id: 'player-a', firstName: 'Игрок' } as AuthenticatedPlayer, metric);

    expect(result.entries.map((entry) => entry.telegramId)).toEqual(expectedOrder);
    expect(result.entries.map((entry) => entry.position)).toEqual([1, 2, 3]);
    expect(result.currentPosition).toBe(expectedOrder.indexOf('player-a') + 1);
    if (metric === 'respect') {
      expect(result.entries.map((entry) => entry.respect)).toEqual([5_400, 5_200, 5_000]);
    }
  });
});
