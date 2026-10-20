import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '../types/game';
import { getQuickSellEligibleItems, getQuickSellValue } from './economy';

const clothes = (id: string, rarity: InventoryItem['rarity'] = 'common'): InventoryItem => ({
  id, type: 'clothing', name: id, rarity, icon: '👕', price: 1_000, basePrice: 2_000, respect: 1,
  serial: '#001/500', wear: 100, createdAt: '2026-01-01T00:00:00.000Z', containerId: 'test', slot: 'torso', authenticity: 'unverified',
});

describe('safe quick sale', () => {
  it('pays 100 percent of the trusted base price', () => {
    expect(getQuickSellValue(clothes('shirt'))).toBe(2_000);
  });

  it('includes every rarity in bulk sale while protecting equipped items', () => {
    const common = clothes('common');
    const uncommon = clothes('uncommon', 'uncommon');
    const rare = clothes('rare', 'rare');
    expect(getQuickSellEligibleItems([common, uncommon, rare], new Set(['common']))).toEqual([uncommon, rare]);
  });

  it('includes limited clothing and elite cars in bulk sale', () => {
    const limited = { ...clothes('limited', 'rare'), saleCategory: 'limited' as const };
    const eliteCar: InventoryItem = {
      id: 'elite-car', type: 'car', name: 'Collector car', rarity: 'common', saleCategory: 'elite_cars', icon: '🚗',
      price: 1_000, basePrice: 2_000, respect: 1, serial: '#002/500', wear: 100,
      createdAt: '2026-01-01T00:00:00.000Z', containerId: 'test', slot: 'car', mileage: 50_000,
    };
    expect(getQuickSellEligibleItems([limited, eliteCar])).toEqual([limited, eliteCar]);
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
