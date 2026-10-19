import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import InventoryTab from './InventoryTab';
import type { PlayerState } from '../types/game';

const player = {
  balance: 25_000,
  respect: 0,
  inventory: [{
    id: 'test-hoodie',
    name: 'Тестовое худи',
    type: 'clothing',
    rarity: 'common',
    icon: '👕',
    image: '/items/thrasher-hoodie.png',
    price: 1_800,
    basePrice: 1_800,
    respect: 3,
    serial: '#001/500',
    wear: 82.5,
    createdAt: '2026-10-19T00:00:00.000Z',
    containerId: 'second-hand-bale',
    slot: 'torso',
    authenticity: 'unverified',
  }],
  licensePlates: [],
  favoriteLicensePlateIds: [],
  licensePlateFrames: [],
  seasonCaseTokens: {},
  containerKeys: 0,
  dailyMissions: { day: '2026-10-19', progress: {}, claimed: [] },
  equippedClothing: {},
  auctionListings: [],
  closedMarketListingIds: [],
  avatarEmoji: '🙂',
  economyVersion: 4,
} as PlayerState;

const markup = renderToStaticMarkup(createElement(InventoryTab, {
  player,
  onAction: async () => undefined,
  onOpenGarage: () => undefined,
}));

describe('inventory collection layout', () => {
  it('renders collection items in a responsive three-column card grid', () => {
    expect(markup).toContain('grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-4');
    expect(markup).toContain('Тестовое худи');
    expect(markup).toContain('src="/items/thrasher-hoodie.png"');
    expect(markup).toContain('Действия: Тестовое худи');
  });

  it('keeps the estimated bulk sale available below the collection', () => {
    expect(markup).toContain('Продай обычные предметы по 100% государственной цене.');
    expect(markup).toContain('Доступно: 1 предметов');
    expect(markup).toContain('Продать всё');
    expect(markup).not.toContain('Подтверждение массовой продажи');
  });
});
