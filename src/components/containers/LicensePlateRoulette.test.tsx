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
    expect(markup).toContain('src="/assets/season/genesis/vip-frame-empty.webp"');
    expect(markup).toContain('data-plate-zone="main"');
    expect(markup).toContain('aspect-[2.15/1]');
    expect(markup).toContain('object-fill');
    expect(markup).toContain('max-w-[300px]');
    expect(markup).toContain('left-[9%] top-[30%] z-10 flex h-[42%] w-[59%]');
    expect(markup).toContain('data-plate-zone="region"');
    expect(markup).toContain('left-[70%] top-[28%] z-10 flex h-[45%] w-[21%] flex-col items-center justify-between');
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
