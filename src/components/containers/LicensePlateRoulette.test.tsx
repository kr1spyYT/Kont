import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STARTING_PLAYER } from '../../game/player';
import LicensePlateRoulette from './LicensePlateRoulette';

describe('LicensePlateRoulette visibility', () => {
  it('renders the equipped seasonal frame with grouped readable plate symbols', () => {
    const markup = renderToStaticMarkup(createElement(LicensePlateRoulette, {
      player: { ...STARTING_PLAYER, licensePlateFrames: ['season-01-vip'], equippedLicensePlateFrameId: 'season-01-vip' },
      onAction: async () => undefined,
    }));

    expect(markup).toContain('aria-label="Госномер А000АА 77, рамка SEASON 01 // VIP"');
    expect(markup).toContain('data-frame-id="season-01-vip"');
    expect(markup).toContain('src="/assets/season/genesis/vip-license-frame.webp"');
    expect(markup).toContain('SEASON 01 // VIP');
    expect(markup).toContain('license-plate-typeface');
    expect(markup).toContain('ml-[0.2em]');
  });

  it('does not display an owned frame after it has been unequipped', () => {
    const markup = renderToStaticMarkup(createElement(LicensePlateRoulette, {
      player: { ...STARTING_PLAYER, licensePlateFrames: ['season-01-vip'], equippedLicensePlateFrameId: null },
      onAction: async () => undefined,
    }));

    expect(markup).not.toContain('data-frame-id="season-01-vip"');
    expect(markup).not.toContain('рамка SEASON 01 // VIP');
  });

  it('hides scenario odds while keeping the roulette available', () => {
    const markup = renderToStaticMarkup(createElement(LicensePlateRoulette, {
      player: STARTING_PLAYER,
      onAction: async () => undefined,
    }));

    expect(markup).not.toContain('Шансы сценария прокрутки');
    expect(markup).not.toContain('Шансы номерной рулетки');
    expect(markup).toContain('Номерная рулетка');
    expect(markup).toContain('Крутить за');
  });
});
