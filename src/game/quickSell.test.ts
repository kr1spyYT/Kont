import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '../types/game';
import { getQuickSellEligibleItems, getQuickSellValue } from './economy';

const clothes = (id: string, rarity: InventoryItem['rarity'] = 'common'): InventoryItem => ({
  id, type: 'clothing', name: id, rarity, icon: '👕', price: 1_000, basePrice: 2_000, respect: 1,
  serial: '#001/500', wear: 100, createdAt: '2026-01-01T00:00:00.000Z', containerId: 'test', slot: 'torso', authenticity: 'unverified',
});

describe('safe quick sale', () => {
  it('pays 78 percent of base price', () => {
    expect(getQuickSellValue(clothes('shirt'))).toBe(1_560);
  });

  it('keeps rare items and anything equipped out of bulk liquidation', () => {
    const common = clothes('common');
    const uncommon = clothes('uncommon', 'uncommon');
    const rare = clothes('rare', 'rare');
    expect(getQuickSellEligibleItems([common, uncommon, rare], new Set(['common']))).toEqual([uncommon]);
  });

  it('protects cars with an installed plate', () => {
    const protectedCar: InventoryItem = {
      id: 'car-plate', type: 'car', name: 'Car', rarity: 'common', icon: '🚗', price: 1_000, basePrice: 2_000,
      respect: 1, serial: '#001/500', wear: 100, createdAt: '2026-01-01T00:00:00.000Z', containerId: 'test', slot: 'car', mileage: 50_000,
      licensePlateId: 'plate-1',
    };
    expect(getQuickSellEligibleItems([protectedCar])).toEqual([]);
  });
});
