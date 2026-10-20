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

const renderInventory = (state: PlayerState) => renderToStaticMarkup(createElement(InventoryTab, {
  player: state,
  onAction: async () => undefined,
  onOpenGarage: () => undefined,
}));

const markup = renderInventory(player);
const equippedMarkup = renderInventory({
  ...player,
  equippedClothing: { torso: 'test-hoodie' },
});
const testCar = {
  ...player.inventory[0],
  id: 'test-car',
  name: 'Porsche 911 GT3 RS',
  type: 'car',
  mileage: 15_530,
} as PlayerState['inventory'][number];
const carMarkup = renderInventory({ ...player, inventory: [testCar] });

describe('inventory collection layout', () => {
  it('renders collection items in a responsive three-column card grid', () => {
    expect(markup).toContain('grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-4');
    expect(markup).toContain('Тестовое худи');
    expect(markup).toContain('src="/items/thrasher-hoodie.png"');
    expect(markup).toContain('Действия: Тестовое худи');
  });

  it('keeps rarity on one line and moves equipped status to the preview bottom', () => {
    expect(equippedMarkup).toContain('absolute left-1.5 top-1.5 z-10 shrink-0 whitespace-nowrap rounded-full');
    expect(equippedMarkup).toContain('px-2 py-1 text-[8px] font-bold uppercase leading-none');
    expect(equippedMarkup).not.toContain('[overflow-wrap:anywhere]');
    expect(equippedMarkup).toContain('absolute bottom-1.5 left-1.5 z-10 whitespace-nowrap rounded-full');
    expect(equippedMarkup).toContain('• НАДЕТО');
  });

  it('shows car mileage on a separate line above its plate', () => {
    const normalizedMarkup = carMarkup.replace(/\s+/gu, ' ');
    expect(normalizedMarkup).toContain('15 530 км');
    expect(carMarkup).toContain('flex min-w-0 flex-col items-start gap-1');
    expect(carMarkup).toContain('Без номера');
  });

  it('keeps the estimated bulk sale available below the collection', () => {
    expect(markup).toContain('Продай обычные предметы по 100% государственной цене.');
    expect(markup).toContain('Доступно: 1 предметов');
    expect(markup).toContain('Продать всё');
    expect(markup).not.toContain('Подтверждение массовой продажи');
  });
});
