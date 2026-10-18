import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STARTING_PLAYER } from '../../game/player';
import LicensePlateRoulette from './LicensePlateRoulette';

describe('LicensePlateRoulette visibility', () => {
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
