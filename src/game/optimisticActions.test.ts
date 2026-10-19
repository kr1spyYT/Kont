import { describe, expect, it } from 'vitest';
import type { ClothingItem, InventoryItem } from '../types/game';
import type { GameAction } from '../types/server';
import { STARTING_PLAYER } from './player';
import { applyOptimisticAction, getOptimisticResourceKey } from './optimisticActions';

const commonItem: ClothingItem = {
  id: 'common-1', name: 'Худи Common', type: 'clothing', rarity: 'common', saleCategory: 'common',
  icon: '👕', price: 800, basePrice: 1_000, respect: 1, serial: '#001/500', wear: 80,
  createdAt: '2026-10-19T00:00:00.000Z', containerId: 'second-hand-bale', slot: 'torso', authenticity: 'original',
};

const rareItem: ClothingItem = { ...commonItem, id: 'rare-1', name: 'Архивная вещь', rarity: 'legendary', saleCategory: 'limited', basePrice: 100_000 };

const container = {
  id: 'case-1', order: 1, tier: 1, name: 'Тестовый кейс', category: 'clothing' as const, price: 1_500,
  description: '', icon: '📦', image: '', contents: [],
};

describe('optimistic player actions', () => {
  it('projects quick sale using trusted catalog price and removes the item immediately', () => {
    const player = { ...STARTING_PLAYER, balance: 500, inventory: [commonItem] };
    const action: GameAction = { type: 'quick-sell-item', itemId: commonItem.id, requestId: 'sale-1' };
    const projected = applyOptimisticAction(player, action, []);

    expect(projected?.balance).toBe(1_500);
    expect(projected?.inventory).toEqual([]);
    expect(player.inventory).toEqual([commonItem]);
  });

  it('bulk-sells only eligible common items and protects equipped and premium items', () => {
    const equipped = { ...commonItem, id: 'equipped-1', slot: 'head' as const };
    const player = {
      ...STARTING_PLAYER,
      inventory: [commonItem, equipped, rareItem],
      equippedClothing: { head: equipped.id },
    };
    const projected = applyOptimisticAction(player, { type: 'quick-sell-junk', requestId: 'bulk-1' }, []);

    expect(projected?.balance).toBe(player.balance + commonItem.basePrice);
    expect(projected?.inventory.map((item) => item.id)).toEqual(['equipped-1', 'rare-1']);
  });

  it('does not optimistically remove ineligible, equipped, or plate-bearing items', () => {
    const equippedPlayer = { ...STARTING_PLAYER, inventory: [commonItem], equippedClothing: { torso: commonItem.id } };
    const rareAction: GameAction = { type: 'quick-sell-item', itemId: rareItem.id, requestId: 'sale-rare' };
    expect(applyOptimisticAction({ ...STARTING_PLAYER, inventory: [commonItem] }, rareAction, [])).toBeUndefined();
    expect(applyOptimisticAction(equippedPlayer, { type: 'quick-sell-item', itemId: commonItem.id, requestId: 'sale-equipped' }, [])).toBeUndefined();

    const car: InventoryItem = {
      ...commonItem, id: 'car-1', name: 'Машина', type: 'car', slot: 'car', mileage: 50_000, licensePlate: 'A123AA77',
    };
    expect(applyOptimisticAction({ ...STARTING_PLAYER, inventory: [car] }, { type: 'quick-sell-item', itemId: car.id, requestId: 'sale-car' }, [])).toBeUndefined();
  });

  it('projects container payment or key use without inventing a drop', () => {
    const player = { ...STARTING_PLAYER, balance: 5_000, containerKeys: 2 };
    const paid = applyOptimisticAction(player, { type: 'open-container', containerId: container.id, free: false, requestId: 'open-1' }, [container]);
    const keyed = applyOptimisticAction(player, { type: 'open-container', containerId: container.id, free: false, useKey: true, requestId: 'open-2' }, [container]);

    expect(paid?.balance).toBe(3_500);
    expect(paid?.inventory).toEqual(player.inventory);
    expect(keyed?.containerKeys).toBe(1);
    expect(player.balance).toBe(5_000);
  });

  it('consumes a season case token in the projected state', () => {
    const player = { ...STARTING_PLAYER, seasonCaseTokens: { 'case-1': 2 } };
    const projected = applyOptimisticAction(player, { type: 'open-season-case', containerId: 'case-1', requestId: 'season-open' }, []);
    expect(projected?.seasonCaseTokens['case-1']).toBe(1);
    expect(player.seasonCaseTokens['case-1']).toBe(2);
  });

  it('locks duplicate inventory and balance operations by shared resource', () => {
    expect(getOptimisticResourceKey({ type: 'quick-sell-junk', requestId: 'bulk' })).toBe('inventory-and-balance');
    expect(getOptimisticResourceKey({ type: 'open-container', containerId: 'case-1', free: false, requestId: 'open' })).toBe('inventory-and-balance');
    expect(getOptimisticResourceKey({ type: 'set-avatar', avatarEmoji: '🧢', requestId: 'avatar' })).toBeUndefined();
  });
});
