import { describe, expect, it } from 'vitest';
import { calculateEquippedStats, calculateStatusCapital, STARTING_PLAYER } from './player';
import type { CarItem, ClothingItem, PlayerState } from '../types/game';

const car: CarItem = {
  id: 'car',
  name: 'Тестовый автомобиль',
  type: 'car',
  rarity: 'common',
  icon: '🚘',
  price: 100_000,
  basePrice: 100_000,
  respect: 100,
  serial: '#001/500',
  wear: 100,
  createdAt: '2026-10-20T00:00:00.000Z',
  containerId: 'test',
  slot: 'car',
  mileage: 15_000,
  licensePlateId: 'plate',
};

const plate = { id: 'plate', plate: 'М999ММ 99', price: 50_000 };

const makePlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  ...STARTING_PLAYER,
  inventory: [car],
  licensePlates: [plate],
  activeCarId: car.id,
  ...overrides,
});

describe('vehicle and license plate status synergy', () => {
  it.each([
    ['А246ВС 50', 5],
    ['А100ВС 50', 15],
    ['А121ВС 50', 15],
    ['А001ВС 50', 35],
    ['А123АА 50', 35],
    ['А123МР 97', 75],
  ])('assigns %s a +%s%% respect bonus', (licensePlate, bonus) => {
    expect(calculateEquippedStats(makePlayer({
      licensePlates: [{ ...plate, plate: licensePlate }],
    })).carPlateBonusPercent).toBe(bonus);
  });

  it('applies the plate bonus to car respect without changing item prices', () => {
    const player = makePlayer();
    const stats = calculateEquippedStats(player);

    expect(stats.respect).toBe(175);
    expect(stats.carRespectBonus).toBe(75);
    expect(player.inventory[0].price).toBe(100_000);
  });

  it('calculates status capital with the car valuation bonus and preserves plate value', () => {
    const player = makePlayer();

    expect(calculateStatusCapital(player)).toBe(25_000 + 175_000 + 50_000);
  });

  it('applies the full outfit multiplier after plate synergy', () => {
    const clothing = (id: string, slot: ClothingItem['slot']): ClothingItem => ({
      id,
      name: id,
      type: 'clothing',
      rarity: 'common',
      icon: '👕',
      price: 1_000,
      basePrice: 1_000,
      respect: 10,
      serial: '#001/500',
      wear: 100,
      createdAt: '2026-10-20T00:00:00.000Z',
      containerId: 'test',
      slot,
      authenticity: 'original',
    });
    const clothes = [
      clothing('head', 'head'),
      clothing('torso', 'torso'),
      clothing('legs', 'legs'),
      clothing('shoes', 'shoes'),
      clothing('accessory', 'accessory'),
    ];
    const player = makePlayer({
      inventory: [car, ...clothes],
      equippedClothing: Object.fromEntries(clothes.map((item) => [item.slot, item.id])),
    });

    expect(calculateEquippedStats(player).respect).toBe(270);
  });

  it('uses the VIP season frame for the attached car plate only', () => {
    const player = makePlayer({
      licensePlates: [{ ...plate, plate: 'А246ВС 50' }],
      licensePlateFrames: ['season-01-vip'],
    });

    expect(calculateEquippedStats(player).carPlateBonusPercent).toBe(75);
  });
});
