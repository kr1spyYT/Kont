import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PremiumAuctionSection from './PremiumAuctionSection';
import { STARTING_PLAYER } from '../game/player';
import type { PremiumAuctionLot } from '../types/server';

const premiumLot: PremiumAuctionLot = {
  id: 'premium-lot-test',
  seller: '@seller',
  sellerId: 'seller-id',
  item: {
    id: 'rare-jacket',
    name: 'Лимитированная куртка',
    type: 'clothing',
    rarity: 'epic',
    saleCategory: 'limited',
    icon: '🧥',
    image: '/items/rare-jacket.webp',
    price: 20_000,
    basePrice: 25_000,
    respect: 30,
    serial: '#014/500',
    wear: 95,
    createdAt: '2026-10-19T00:00:00.000Z',
    containerId: 'archive',
    slot: 'torso',
    authenticity: 'original',
  },
  saleCategory: 'limited',
  startingPrice: 15_000,
  currentBid: 18_000,
  endsAt: '2026-10-20T00:00:00.000Z',
  listedAt: '2026-10-19T00:00:00.000Z',
  isMine: false,
  isHighestBidder: false,
};

describe('PremiumAuctionSection', () => {
  it('explains escrow and displays an empty premium auction state', () => {
    const markup = renderToStaticMarkup(createElement(PremiumAuctionSection, {
      player: STARTING_PLAYER,
      onAction: async () => undefined,
      onOpenProfile: () => undefined,
    }));

    expect(markup).toContain('Премиальный аукцион');
    expect(markup).toContain('при перебивании деньги возвращаются');
    expect(markup).toContain('Активных премиальных лотов пока нет.');
    expect(markup).toContain('Пока нет доступных коллекционных активов');
  });

  it('shows current bid, the next minimum, and an escrow bid action', () => {
    const markup = renderToStaticMarkup(createElement(PremiumAuctionSection, {
      player: STARTING_PLAYER,
      premiumLots: [premiumLot],
      onAction: async () => undefined,
      onOpenProfile: () => undefined,
    }));

    const normalizedMarkup = markup.replace(/[\u00a0\u202f]/g, ' ');
    expect(normalizedMarkup).toContain('Лимитированная куртка');
    expect(normalizedMarkup).toContain('18 000');
    expect(normalizedMarkup).toContain('Минимум 18 001');
    expect(markup).toContain('Ставка');
    expect(markup).toContain('средства лидера заблокированы в эскроу');
  });
});
