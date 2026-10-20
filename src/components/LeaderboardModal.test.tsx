import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry } from '../types/server';
import LeaderboardModal, { formatItemCount } from './LeaderboardModal';

const demoEntry: LeaderboardEntry = {
  telegramId: '1001',
  displayName: 'Игрок LootLand',
  username: 'loot_player',
  xp: 1_000,
  respect: 25,
  collectionValue: 12_000,
  collectionCount: 3,
  rankTitle: 'Новое лицо',
  position: 1,
};

describe('LeaderboardModal Genesis podium', () => {
  it.each([
    [1, '1 предмет'],
    [2, '2 предмета'],
    [5, '5 предметов'],
    [11, '11 предметов'],
    [21, '21 предмет'],
  ])('formats Russian item counts: %i → %s', (count, expected) => {
    expect(formatItemCount(count)).toBe(expected);
  });

  it('shows the top player on the Genesis podium and exposes profile navigation', () => {
    const markup = renderToStaticMarkup(createElement(LeaderboardModal, {
      isServerGame: false,
      demoEntry,
      onClose: () => undefined,
      onOpenProfile: () => undefined,
    }));

    expect(markup).toContain('Форбс синдиката · топ-3');
    expect(markup).toContain('src="/assets/season/genesis/rewards/trophy-gold.webp"');
    expect(markup).toContain('Открыть профиль Игрок LootLand, место 1');
    expect(markup).toContain('@loot_player');
  });

  it('provides an explicit manual refresh control in server mode', () => {
    const markup = renderToStaticMarkup(createElement(LeaderboardModal, {
      isServerGame: true,
      demoEntry,
      onClose: () => undefined,
      onOpenProfile: () => undefined,
    }));

    expect(markup).toContain('aria-label="Обновить рейтинг"');
  });

  it('uses the premium gold treatment for the selected metric', () => {
    const markup = renderToStaticMarkup(createElement(LeaderboardModal, {
      isServerGame: false,
      demoEntry,
      onClose: () => undefined,
      onOpenProfile: () => undefined,
    }));

    expect(markup).toContain('from-[#8c6d2c] via-[#cfa84c] to-[#9a7730]');
    expect(markup).toContain('text-black/95 font-extrabold');
    expect(markup).not.toContain('bg-amber-400 text-[#151719]');
  });
});
