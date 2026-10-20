import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AuctionTab from './AuctionTab';
import { STARTING_PLAYER } from '../game/player';
import type { MarketListing } from '../types/server';

const marketListing = {
  id: 'test-listing',
  seller: 'Игрок рынка',
  listedAt: '2026-10-19T00:00:00.000Z',
  askingPrice: 1_200,
  isMine: false,
  item: {
    id: 'test-item',
    name: 'Тестовая куртка',
    type: 'clothing',
    rarity: 'rare',
    icon: '👕',
    image: '/items/test-item.webp',
    price: 1_000,
    basePrice: 1_000,
    respect: 1,
    serial: '#001/500',
    wear: 90,
    createdAt: '2026-10-19T00:00:00.000Z',
    containerId: 'test-container',
    slot: 'torso',
    authenticity: 'unverified',
  },
} as unknown as MarketListing;

describe('AuctionTab navigation', () => {
  it('separates buying, own listings, and listing creation', () => {
    const markup = renderToStaticMarkup(createElement(AuctionTab, {
      player: STARTING_PLAYER,
      onAction: async () => undefined,
      onOpenProfile: () => undefined,
    }));

    expect(markup).toContain('Купить');
    expect(markup).toContain('Мои лоты');
    expect(markup).toContain('Выставить');
    expect(markup).toContain('Фильтры и сортировка');
    expect(markup).toContain('Номера 🔢');
    expect(markup).toContain('value="secret"');
  });

  it('uses the Genesis gavel and verified seal on the market lot card', () => {
    const markup = renderToStaticMarkup(createElement(AuctionTab, {
      player: STARTING_PLAYER,
      marketListings: [marketListing],
      onAction: async () => undefined,
      onOpenProfile: () => undefined,
    }));

    expect(markup).toContain('src="/assets/season/genesis/rewards/auction-gavel.webp"');
    expect(markup).toContain('src="/assets/season/genesis/rewards/verified-seal.webp"');
    expect(markup).toContain('Тестовая куртка');
  });
});
