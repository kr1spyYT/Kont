import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STARTING_PLAYER } from '../game/player';
import type { CarItem, PlayerState } from '../types/game';
import GarageTab from './GarageTab';

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
  mileage: 15_530,
  licensePlateId: 'plate',
};

const player: PlayerState = {
  ...STARTING_PLAYER,
  inventory: [car],
  licensePlates: [{ id: 'plate', plate: 'М999ММ 99', price: 50_000 }],
  activeCarId: car.id,
};

describe('garage status podium', () => {
  it('shows the installed plate synergy on the vehicle and itemized status', () => {
    const markup = renderToStaticMarkup(createElement(GarageTab, {
      player,
      onAction: async () => undefined,
      rankPosition: 3,
    }));
    const normalizedMarkup = markup.replace(/\s+/gu, ' ');

    expect(markup).toContain('Синергия номера: +75% ★');
    expect(markup).toContain('Мой статус в Форбс');
    expect(markup).toContain('#3 в Форбс');
    expect(normalizedMarkup).toContain('15 530 км');
  });
});
