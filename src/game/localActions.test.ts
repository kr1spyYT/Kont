import { describe, expect, it } from 'vitest';
import { applyLocalAction } from './localActions';
import { createLicensePlateItem } from './licensePlates';
import { STARTING_PLAYER } from './player';
import { getResaleValue } from './economy';
import type { CarItem } from '../types/game';

const user = { id: 'test-player', firstName: 'Test' };

const carWithPlate = (plateId: string): CarItem => ({
  id: 'test-car',
  name: 'Тестовая машина',
  type: 'car',
  rarity: 'common',
  icon: '🚘',
  price: 100_000,
  basePrice: 100_000,
  respect: 0,
  serial: '#001/500',
  wear: 100,
  createdAt: '2026-10-17T00:00:00.000Z',
  containerId: 'test',
  slot: 'car',
  mileage: 20_000,
  licensePlateId: plateId,
});

describe('bulk license plate sale', () => {
  it('sells only the chosen rarity and preserves installed plates', () => {
    const common = createLicensePlateItem('А246ВС 25', 'free-common');
    const rare = createLicensePlateItem('А111ВС 25', 'free-rare');
    const installedLegendary = createLicensePlateItem('Х777ХХ 77', 'installed-legendary');
    const player = {
      ...STARTING_PLAYER,
      balance: 10_000,
      licensePlates: [common, rare, installedLegendary],
      inventory: [carWithPlate(installedLegendary.id)],
    };

    const response = applyLocalAction(player, {
      type: 'sell-license-plates',
      rarity: 'common',
      requestId: 'sell-common',
    }, user);

    expect(response.snapshot.player.licensePlates.map((plate) => plate.id)).toEqual(['free-rare', 'installed-legendary']);
    expect(response.snapshot.player.balance).toBe(10_000 + getResaleValue(common));
    expect(response.result?.message).toContain('Продано номеров: 1');
  });

  it('sells all free rarities in one action but excludes installed plates', () => {
    const common = createLicensePlateItem('А246ВС 25', 'free-common');
    const secret = createLicensePlateItem('В777ВВ 77', 'free-secret');
    const installed = createLicensePlateItem('Х777ХХ 77', 'installed-legendary');
    const player = {
      ...STARTING_PLAYER,
      licensePlates: [common, secret, installed],
      inventory: [carWithPlate(installed.id)],
    };

    const response = applyLocalAction(player, {
      type: 'sell-license-plates',
      rarity: 'all',
      requestId: 'sell-all',
    }, user);

    expect(response.snapshot.player.licensePlates.map((plate) => plate.id)).toEqual(['installed-legendary']);
    expect(response.snapshot.player.balance).toBe(STARTING_PLAYER.balance + getResaleValue(common) + getResaleValue(secret));
    expect(response.result?.message).toContain('Продано номеров: 2');
  });
});
