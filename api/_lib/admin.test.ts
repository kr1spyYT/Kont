import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  formatAdminActivity,
  formatAdminActivityLabel,
  getAdminPlayerByIdentifier,
  listAdminActivity,
  resetPlayerContainerCooldowns,
} from './admin.js';

function createClient(result: { rows?: unknown[]; rowCount?: number } = {}) {
  const query = vi.fn().mockResolvedValue({ rows: [], ...result });
  return { client: { query } as unknown as PoolClient, query };
}

describe('admin player support tools', () => {
  it('resolves players by exact Telegram username or numeric ID', async () => {
    const player = { telegram_id: '12345', first_name: 'Игрок', last_name: null, username: 'loot_player', xp: 0, state: {}, is_banned: false };
    const { client, query } = createClient({ rows: [player] });

    await expect(getAdminPlayerByIdentifier(client, '@Loot_Player')).resolves.toEqual(player);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LOWER(username) = LOWER($1)'), ['Loot_Player']);

    const idClient = createClient();
    await getAdminPlayerByIdentifier(idClient.client, '123456789');
    expect(idClient.query).toHaveBeenCalledWith(expect.stringContaining('WHERE telegram_id = $1'), ['123456789']);
  });

  it('lists recent activity newest first with a safe nonnegative offset', async () => {
    const { client, query } = createClient();

    await listAdminActivity(client, -4);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY e.created_at DESC, e.event_id DESC'), [11, 0]);
  });

  it('limits a player history query to that player', async () => {
    const { client, query } = createClient();

    await listAdminActivity(client, 20, 'player-123');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE e.telegram_id = $3'), [11, 20, 'player-123']);
  });

  it('reports how many container cooldowns were reset', async () => {
    const { client, query } = createClient({ rowCount: 3 });

    await expect(resetPlayerContainerCooldowns(client, 'player-123')).resolves.toBe(3);
    expect(query).toHaveBeenCalledWith('DELETE FROM player_container_openings WHERE telegram_id = $1', ['player-123']);
  });

  it('formats activity in Moscow time with readable action labels', () => {
    const line = formatAdminActivity({
      event_id: 5,
      telegram_id: 'player-123',
      first_name: 'Игрок',
      last_name: null,
      username: null,
      action_type: 'open-container',
      balance_delta: -1500,
      xp_delta: 2,
      created_at: '2026-10-17T12:00:00.000Z',
    });

    expect(line).toContain('Открытие контейнера');
    expect(line).toContain('\n');
    expect(line).toContain('Игрок');
    expect(line).toContain('₽');
    expect(line).toContain('+2 XP');
    expect(formatAdminActivityLabel('future-action')).toBe('future action');
  });
});
