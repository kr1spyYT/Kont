import { describe, expect, it } from 'vitest';
import { STARTING_PLAYER } from '../../src/game/player.js';
import { makeSnapshot } from './game.js';
import type { PlayerRow } from './game.js';
import type { AuthenticatedPlayer } from '../../src/types/server.js';

describe('player profile premium-pass status', () => {
  it('includes the active Season Pass VIP status in the own-profile snapshot', () => {
    const user: AuthenticatedPlayer = { id: 'player-1', firstName: 'Игрок' };
    const row: PlayerRow = {
      telegram_id: user.id,
      first_name: user.firstName,
      last_name: null,
      username: null,
      xp: 0,
      state: STARTING_PLAYER,
      free_case_opened_at: null,
    };

    expect(makeSnapshot(row, user, true).isPremiumPass).toBe(true);
    expect(makeSnapshot(row, user).isPremiumPass).toBe(false);
  });
});
