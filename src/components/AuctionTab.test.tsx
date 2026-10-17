import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AuctionTab from './AuctionTab';
import { STARTING_PLAYER } from '../game/player';

describe('AuctionTab guidance', () => {
  it('explains the market and separates buying from the player’s own listings', () => {
    const markup = renderToStaticMarkup(createElement(AuctionTab, {
      player: STARTING_PLAYER,
      onAction: async () => undefined,
      onOpenProfile: () => undefined,
    }));

    expect(markup).toContain('Как пользоваться рынком');
    expect(markup).toContain('Купить');
    expect(markup).toContain('Мои лоты');
    expect(markup).toContain('сними объявление');
  });
});
