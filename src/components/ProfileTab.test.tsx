import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STARTING_PLAYER } from '../game/player';
import ProfileTab from './ProfileTab';

const renderProfile = (player: typeof STARTING_PLAYER) => renderToStaticMarkup(createElement(ProfileTab, {
  player,
  onAction: async () => undefined,
  onOpenInventory: () => undefined,
  onOpenSeason: () => undefined,
  rankTitle: 'Уличный игрок',
  playerName: 'Тестовый игрок',
  rankPosition: 1,
}));

describe('profile license plate frame controls', () => {
  it('explains how to earn the level-20 VIP frame when it is not owned', () => {
    const markup = renderProfile(STARTING_PLAYER);

    expect(markup).toContain('SEASON 01 // VIP выдаётся за VIP-награду 20-го уровня');
    expect(markup).toContain('активируй VIP Pass');
    expect(markup).toContain('Открыть Season Pass');
  });

  it('shows an equipped plate preview and an option to remove it', () => {
    const markup = renderProfile({
      ...STARTING_PLAYER,
      licensePlateFrames: ['season-01-vip'],
      equippedLicensePlateFrameId: 'season-01-vip',
    });

    expect(markup).toContain('data-frame-id="season-01-vip"');
    expect(markup).toContain('Надета');
    expect(markup).toContain('Снять');
  });
});
