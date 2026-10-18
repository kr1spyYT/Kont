import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedPlayer } from '../../src/types/server.js';
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
      position: index + 1,
    }));
    database.query
      .mockResolvedValueOnce({ rows: [{ is_banned: false }], rowCount: 1 })
      .mockResolvedValueOnce({ rows, rowCount: rows.length });

    const result = await loadLeaderboard({ id: 'current-player', firstName: 'Игрок' } as AuthenticatedPlayer, 'xp');
    const leaderboardSql = String(database.query.mock.calls[1]?.[0]);

    expect(leaderboardSql).toContain('WHERE position <= 100 OR telegram_id = $1');
    expect(result.entries).toHaveLength(100);
    expect(result.entries[0]?.position).toBe(1);
    expect(result.entries[99]?.position).toBe(100);
    expect(result.currentPosition).toBe(101);
    expect(database.client.release).toHaveBeenCalledOnce();
  });
});
