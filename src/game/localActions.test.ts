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

describe('container key opening', () => {
  it('spends exactly one key instead of rubles', () => {
    const player = { ...STARTING_PLAYER, balance: 15_000, containerKeys: 1 };
    const response = applyLocalAction(player, {
      type: 'open-container', containerId: 'hype-box', free: false, useKey: true, requestId: 'open-with-key',
    }, user);

    expect(response.snapshot.player.containerKeys).toBe(0);
    expect(response.snapshot.player.balance).toBe(player.balance);
    expect(response.snapshot.player.inventory).toHaveLength(player.inventory.length + 1);
    expect(response.result?.message).toContain('за ключ');
  });

  it('rejects key opening without a key', () => {
    expect(() => applyLocalAction(STARTING_PLAYER, {
      type: 'open-container', containerId: 'hype-box', free: false, useKey: true, requestId: 'no-key',
    }, user)).toThrow('нет ключа');
  });
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

  it('protects favorite plates from sale and auction until unfavorited', () => {
    const favorite = createLicensePlateItem('В777ВВ 77', 'favorite');
    const player = { ...STARTING_PLAYER, licensePlates: [favorite], favoriteLicensePlateIds: [favorite.id] };

    expect(() => applyLocalAction(player, {
      type: 'sell-license-plate', plateId: favorite.id, requestId: 'sell-favorite',
    }, user)).toThrow('избранного');
    expect(() => applyLocalAction(player, {
      type: 'sell-license-plates', rarity: 'all', requestId: 'sell-favorites',
    }, user)).toThrow('Нет свободных номеров');
    expect(() => applyLocalAction(player, {
      type: 'list-license-plate', plateId: favorite.id, askingPrice: 50_000, requestId: 'list-favorite',
    }, user)).toThrow('избран');

    const unprotected = applyLocalAction(player, {
      type: 'set-license-plate-favorite', plateId: favorite.id, favorite: false, requestId: 'unfavorite',
    }, user).snapshot.player;
    const sold = applyLocalAction(unprotected, {
      type: 'sell-license-plate', plateId: favorite.id, requestId: 'sell-unfavorited',
    }, user);

    expect(sold.snapshot.player.favoriteLicensePlateIds).toEqual([]);
    expect(sold.snapshot.player.licensePlates).toEqual([]);
  });
});
